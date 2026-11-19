import { AppShell } from "@/components/layout/AppShell";
import { PermissionPicker } from "@/components/PermissionPicker";
import { RecoveryCodeDialog } from "@/components/RecoveryCodeDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  DEFAULT_EMPLOYEE_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  type PermissionKey,
} from "@/convex/permissions";
import { useSession } from "@/hooks/use-session";
import {
  PASSWORD_RULE,
  errorMessage,
  isValidPassword,
  sanitizePhoneInput,
} from "@/lib/auth";
import { faDateLong } from "@/lib/format";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRound,
  UserRoundX,
  Users,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

type EmployeeRow = {
  id: Id<"employees">;
  fullName: string;
  phone: string;
  roleTitle: string | null;
  permissions: string[];
  active: boolean;
  hasAccount: boolean;
  createdAt: number;
  updatedAt: number;
  isSelf: boolean;
};

const EMPTY_ADD = {
  fullName: "",
  phone: "",
  roleTitle: "",
  password: "",
  confirmPassword: "",
};

function permissionsLabel(permissions: string[]) {
  return permissions
    .map(
      (key) =>
        PERMISSION_DEFINITIONS.find((item) => item.key === key)?.label ?? key,
    )
    .slice(0, 2);
}

export default function Employees() {
  const { context } = useSession();
  const employeeList = useQuery(api.employees.list, {});
  const createEmployee = useAction(api.authActions.createEmployee);
  const updateEmployee = useMutation(api.employees.update);
  const setEmployeeActive = useMutation(api.employees.setActive);
  const removeEmployee = useMutation(api.employees.remove);

  const isOwner = context?.isOwner ?? false;
  const allowedKeys = isOwner
    ? undefined
    : (context?.permissions as PermissionKey[] | undefined);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD);
  const [addPermissions, setAddPermissions] = useState<PermissionKey[]>([
    ...DEFAULT_EMPLOYEE_PERMISSIONS,
  ]);
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [employeeRecoveryCode, setEmployeeRecoveryCode] = useState<
    string | null
  >(null);
  const [showEmployeeRecovery, setShowEmployeeRecovery] = useState(false);

  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    roleTitle: "",
    permissions: [] as PermissionKey[],
    active: true,
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<EmployeeRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const employees = (employeeList?.employees ?? []) as EmployeeRow[];

  const openAdd = () => {
    setAddForm(EMPTY_ADD);
    setAddPermissions([...DEFAULT_EMPLOYEE_PERMISSIONS]);
    setAddError(null);
    setShowAddPassword(false);
    setAddOpen(true);
  };

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddError(null);
    if (addForm.fullName.trim().length < 2) {
      setAddError("نام کارمند را کامل وارد کنید.");
      return;
    }
    if (addForm.phone.length !== 11) {
      setAddError("شماره موبایل را به شکل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.");
      return;
    }
    if (!isValidPassword(addForm.password)) {
      setAddError(PASSWORD_RULE);
      return;
    }
    if (addForm.password !== addForm.confirmPassword) {
      setAddError("رمز عبور و تکرار آن یکسان نیستند.");
      return;
    }

    setAddLoading(true);
    try {
      const result = await createEmployee({
        fullName: addForm.fullName.trim(),
        phone: addForm.phone,
        password: addForm.password,
        confirmPassword: addForm.confirmPassword,
        roleTitle: addForm.roleTitle.trim() || undefined,
        permissions: addPermissions,
      });
      setEmployeeRecoveryCode(result.recoveryCode);
      setShowEmployeeRecovery(true);
      toast.success("کارمند اضافه شد؛ رمز عبور را به او تحویل دهید.");
      setAddOpen(false);
      setAddForm(EMPTY_ADD);
    } catch (caught) {
      setAddError(
        errorMessage(caught, "درخواست حساب کارمند ممکن نشد. اطلاعات را بررسی کنید."),
      );
    } finally {
      setAddLoading(false);
    }
  };

  const openEdit = (employee: EmployeeRow) => {
    setEditing(employee);
    setEditForm({
      fullName: employee.fullName,
      roleTitle: employee.roleTitle ?? "",
      permissions: employee.permissions.filter(
        (key): key is PermissionKey =>
          PERMISSION_DEFINITIONS.some((item) => item.key === key),
      ),
      active: employee.active,
    });
    setEditError(null);
  };

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setEditError(null);
    if (editForm.fullName.trim().length < 2) {
      setEditError("نام کارمند را کامل وارد کنید.");
      return;
    }
    setEditLoading(true);
    try {
      await updateEmployee({
        employeeId: editing.id,
        fullName: editForm.fullName.trim(),
        roleTitle: editForm.roleTitle.trim() || undefined,
        permissions: editForm.permissions,
        active: editForm.active,
      });
      toast.success("دسترسی‌های کارمند به‌روزرسانی شد.");
      setEditing(null);
    } catch (caught) {
      setEditError(
        errorMessage(caught, "ذخیره تغییرات ممکن نشد. دوباره تلاش کنید."),
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggle = async (employee: EmployeeRow) => {
    setBusyId(employee.id);
    try {
      await setEmployeeActive({
        employeeId: employee.id,
        active: !employee.active,
      });
      toast.success(
        employee.active
          ? "دسترسی کارمند غیرفعال شد."
          : "دسترسی کارمند فعال شد.",
      );
    } catch (caught) {
      toast.error(errorMessage(caught, "تغییر وضعیت ممکن نشد."));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await removeEmployee({ employeeId: deleteTarget.id });
      toast.success("کارمند از مجموعه حذف شد.");
      setDeleteTarget(null);
    } catch (caught) {
      toast.error(errorMessage(caught, "حذف کارمند ممکن نشد."));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <AppShell active="employees">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">
              کارمندان و دسترسی‌ها
            </h1>
            <p className="mt-1 max-w-xl text-[11.5px] leading-6 text-muted-foreground">
              ساخت حساب جدید فقط توسط مدیر اصلی انجام می‌شود. مجوزهای کارکنان فعلی را
              را دقیق تعیین کنید. هر کارمند فقط به داده‌های همین کافی‌نت دسترسی
              دارد.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => window.location.assign("https://t.me/Cafenetyarr")}
            className="clay-primary h-11 rounded-xl border-0 px-4 text-[12px] font-bold hover:brightness-105"
          >
            <Plus className="size-4" />
            درخواست حساب کارمند
          </Button>
        </div>

        <section className="clay rounded-[28px] p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="tile-navy grid size-11 place-items-center rounded-[14px]">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-extrabold">
                {context?.user.name ?? "صاحب کافی‌نت"}
              </p>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                صاحب کافی‌نت · دسترسی کامل به همه بخش‌ها
              </p>
            </div>
            <Badge variant="secondary" className="rounded-full text-[10px]">
              مالک مجموعه
            </Badge>
          </div>
        </section>

        {employeeList === undefined ? (
          <div className="clay flex items-center justify-center rounded-[28px] p-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : employees.length === 0 ? (
          <div className="clay flex flex-col items-center rounded-[28px] p-8 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Users className="size-5" />
            </span>
            <p className="mt-3 text-sm font-bold">هنوز کارمندی اضافه نشده است</p>
            <p className="mt-1 max-w-sm text-[11px] leading-6 text-muted-foreground">
              برای هر کارمند یک حساب مستقل بسازید تا تنها به بخش‌هایی که اجازه
              می‌دهید دسترسی داشته باشد.
            </p>
            <Button
              type="button"
              onClick={() => window.location.assign("https://t.me/Cafenetyarr")}
              className="clay-primary mt-4 h-10 rounded-xl border-0 px-4 text-[11.5px] font-bold hover:brightness-105"
            >
              <Plus className="size-4" />
              درخواست اولین حساب کارمند
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {employees.map((employee) => {
              const labels = permissionsLabel(employee.permissions);
              const busy = busyId === employee.id;
              return (
                <article
                  key={employee.id}
                  className="clay flex flex-col gap-4 rounded-[26px] p-4 sm:flex-row sm:items-center sm:p-5"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-[13px] text-xs font-extrabold ${
                        employee.active
                          ? "tile-mint"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {employee.fullName.trim().charAt(0) || "ک"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[12.5px] font-extrabold">
                          {employee.fullName}
                        </p>
                        <Badge
                          variant="secondary"
                          className="rounded-full text-[9.5px]"
                        >
                          {employee.active ? "فعال" : "غیرفعال"}
                        </Badge>
                        {employee.isSelf && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary">
                            حساب شما
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                        {employee.roleTitle || "کارمند"} ·{" "}
                        <span dir="ltr" className="inline-block">
                          {employee.phone}
                        </span>
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {labels.map((label) => (
                          <span
                            key={label}
                            className="rounded-full bg-primary/8 px-2 py-0.5 text-[9px] font-medium text-primary"
                          >
                            {label}
                          </span>
                        ))}
                        {employee.permissions.length > labels.length && (
                          <span className="text-[9px] text-muted-foreground">
                            +{employee.permissions.length - labels.length} مجوز
                            دیگر
                          </span>
                        )}
                        <span className="text-[9px] text-muted-foreground/80">
                          عضویت: {faDateLong(employee.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(employee)}
                      disabled={employee.isSelf}
                      className="clay-sm h-9 rounded-xl border-0 px-3 text-[10.5px] font-semibold text-foreground/80 hover:bg-transparent hover:text-primary disabled:opacity-40"
                    >
                      <Pencil className="size-3.5" />
                      ویرایش
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(employee)}
                      disabled={employee.isSelf || busy}
                      className="h-9 rounded-xl px-3 text-[10.5px] font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : employee.active ? (
                        <UserRoundX className="size-3.5" />
                      ) : (
                        <UserCheck className="size-3.5" />
                      )}
                      {employee.active ? "غیرفعال" : "فعال"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`حذف ${employee.fullName}`}
                      onClick={() => setDeleteTarget(employee)}
                      disabled={employee.isSelf}
                      className="size-9 rounded-xl text-destructive hover:bg-destructive/10 disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="clay-inset flex items-start gap-2 rounded-[24px] p-4 text-[10.5px] leading-5 text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            ورود کارمندان با همان شماره موبایل و رمز عبوری است که تعیین می‌کنید.
            رمز عبور فقط یک بار هنگام ساخت حساب ثبت می‌شود و به‌صورت هش‌شده در
            سرور نگهداری می‌شود. حذف یا غیرفعال‌کردن کارمند، دسترسی او را
            بلافاصله قطع می‌کند.
          </p>
        </div>
      </div>

      {/* Add employee */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="clay max-h-[90vh] w-[min(34rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[28px] border-0 p-0">
          <div className="border-b border-border/50 px-5 py-4 pe-5 ps-12">
            <DialogHeader className="text-start">
              <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
                <UserRound className="size-4 text-primary" />
                درخواست حساب کارمند
              </DialogTitle>
              <DialogDescription className="text-[11px] leading-5">
                یک حساب واقعی برای کارمند ساخته می‌شود؛ رمز عبور را بعد از ثبت
                به او تحویل دهید.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleAdd} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="emp-name" className="text-[11.5px] font-semibold">
                  نام و نام خانوادگی
                </Label>
                <Input
                  id="emp-name"
                  required
                  disabled={addLoading}
                  value={addForm.fullName}
                  onChange={(event) =>
                    setAddForm((prev) => ({
                      ...prev,
                      fullName: event.target.value,
                    }))
                  }
                  placeholder="مثلاً رضا کریمی"
                  className="clay-inset h-10 rounded-xl border-0 bg-transparent text-[12px] shadow-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp-phone" className="text-[11.5px] font-semibold">
                  شماره موبایل
                </Label>
                <Input
                  id="emp-phone"
                  type="tel"
                  inputMode="numeric"
                  required
                  disabled={addLoading}
                  value={addForm.phone}
                  onChange={(event) =>
                    setAddForm((prev) => ({
                      ...prev,
                      phone: sanitizePhoneInput(event.target.value),
                    }))
                  }
                  placeholder="09123456789"
                  dir="ltr"
                  className="clay-inset h-10 rounded-xl border-0 bg-transparent text-left text-[12px] shadow-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emp-role" className="text-[11.5px] font-semibold">
                عنوان شغلی (اختیاری)
              </Label>
              <Input
                id="emp-role"
                disabled={addLoading}
                value={addForm.roleTitle}
                onChange={(event) =>
                  setAddForm((prev) => ({
                    ...prev,
                    roleTitle: event.target.value,
                  }))
                }
                placeholder="مثلاً مسئول شیفت"
                className="clay-inset h-10 rounded-xl border-0 bg-transparent text-[12px] shadow-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="emp-password"
                  className="text-[11.5px] font-semibold"
                >
                  رمز عبور
                </Label>
                <div className="relative">
                  <Input
                    id="emp-password"
                    type={showAddPassword ? "text" : "password"}
                    required
                    disabled={addLoading}
                    value={addForm.password}
                    onChange={(event) =>
                      setAddForm((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                    dir="ltr"
                    className="clay-inset h-10 rounded-xl border-0 bg-transparent pl-9 pr-3 text-left text-[12px] shadow-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword((prev) => !prev)}
                    aria-label="نمایش یا پنهان کردن رمز"
                    className="absolute left-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-primary"
                  >
                    {showAddPassword ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="emp-confirm"
                  className="text-[11.5px] font-semibold"
                >
                  تکرار رمز عبور
                </Label>
                <Input
                  id="emp-confirm"
                  type={showAddPassword ? "text" : "password"}
                  required
                  disabled={addLoading}
                  value={addForm.confirmPassword}
                  onChange={(event) =>
                    setAddForm((prev) => ({
                      ...prev,
                      confirmPassword: event.target.value,
                    }))
                  }
                  dir="ltr"
                  className="clay-inset h-10 rounded-xl border-0 bg-transparent text-left text-[12px] shadow-none"
                />
              </div>
            </div>
            <p className="text-[10px] leading-4 text-muted-foreground">
              {PASSWORD_RULE}
            </p>

            <div>
              <p className="mb-2 text-[11.5px] font-semibold">سطح دسترسی</p>
              <PermissionPicker
                value={addPermissions}
                onChange={setAddPermissions}
                allowedKeys={allowedKeys}
                disabled={addLoading}
              />
            </div>

            {addError && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[11px] font-medium leading-5 text-destructive">
                {addError}
              </p>
            )}

            <Button
              type="submit"
              disabled={addLoading}
              className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105"
            >
              {addLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              ساخت حساب کارمند
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit employee */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="clay max-h-[90vh] w-[min(34rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[28px] border-0 p-0">
          <div className="border-b border-border/50 px-5 py-4 pe-5 ps-12">
            <DialogHeader className="text-start">
              <DialogTitle className="text-base font-extrabold">
                ویرایش دسترسی {editing?.fullName}
              </DialogTitle>
              <DialogDescription className="text-[11px] leading-5">
                تغییرات بلافاصله روی حساب کارمند اعمال می‌شود.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleEdit} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-name"
                  className="text-[11.5px] font-semibold"
                >
                  نام و نام خانوادگی
                </Label>
                <Input
                  id="edit-name"
                  required
                  disabled={editLoading}
                  value={editForm.fullName}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      fullName: event.target.value,
                    }))
                  }
                  className="clay-inset h-10 rounded-xl border-0 bg-transparent text-[12px] shadow-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-role"
                  className="text-[11.5px] font-semibold"
                >
                  عنوان شغلی
                </Label>
                <Input
                  id="edit-role"
                  disabled={editLoading}
                  value={editForm.roleTitle}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      roleTitle: event.target.value,
                    }))
                  }
                  className="clay-inset h-10 rounded-xl border-0 bg-transparent text-[12px] shadow-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 p-3">
              <div>
                <p className="text-[11.5px] font-semibold">دسترسی فعال</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  با غیرفعال‌کردن، ورود کارمند به داده‌های مجموعه قطع می‌شود.
                </p>
              </div>
              <Checkbox
                checked={editForm.active}
                onCheckedChange={(checked) =>
                  setEditForm((prev) => ({ ...prev, active: checked === true }))
                }
                disabled={editLoading}
              />
            </div>

            <div>
              <p className="mb-2 text-[11.5px] font-semibold">مجوزها</p>
              <PermissionPicker
                value={editForm.permissions}
                onChange={(permissions) =>
                  setEditForm((prev) => ({ ...prev, permissions }))
                }
                allowedKeys={allowedKeys}
                disabled={editLoading}
              />
            </div>

            {editError && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[11px] font-medium leading-5 text-destructive">
                {editError}
              </p>
            )}

            <Button
              type="submit"
              disabled={editLoading}
              className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105"
            >
              {editLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              ذخیره دسترسی‌ها
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <RecoveryCodeDialog
        code={employeeRecoveryCode}
        open={showEmployeeRecovery}
        onOpenChange={(open) => {
          setShowEmployeeRecovery(open);
          if (!open) setEmployeeRecoveryCode(null);
        }}
        title="کد بازیابی کارمند"
        description="این کد را همراه رمز عبور به کارمند تحویل دهید تا در صورت فراموشی رمز، خودش آن را بازنشانی کند."
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="clay w-[min(28rem,calc(100vw-1.5rem))] rounded-[26px] border-0">
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle className="text-base font-extrabold">
              حذف {deleteTarget?.fullName}؟
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[11px] leading-6">
              دسترسی این کارمند به مجموعه فوراً قطع می‌شود. حساب ورود او باقی
              می‌ماند اما به داده‌های هیچ کافی‌نتی دسترسی نخواهد داشت. برای قطع
              موقت دسترسی می‌توانید به‌جای حذف، او را غیرفعال کنید.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel className="rounded-xl">انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={deleteLoading}
              className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              حذف کارمند
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
