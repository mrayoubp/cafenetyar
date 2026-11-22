import { AdminShell } from "@/components/layout/AdminShell";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/backend/api";
import type { Id } from "@/backend/ids";
import { useSession } from "@/hooks/use-session";
import { errorMessage } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";
import { faDateLong, faNumber } from "@/lib/format";
import { useMutation, useQuery } from "@/backend/client";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  open: "باز",
  in_progress: "در حال بررسی",
  closed: "بسته",
};
const PRIORITY_LABELS: Record<string, string> = {
  low: "کم",
  normal: "عادی",
  high: "بالا",
  urgent: "فوری",
};
const CATEGORY_LABELS: Record<string, string> = {
  account: "حساب",
  billing: "مالی",
  technical: "فنی",
  content: "محتوا",
  other: "سایر",
};
const PAGE_SIZE = 12;

type Ticket = {
  id: Id<"support_tickets">;
  number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  userName: string;
  userPhone: string | null;
  cafeName: string | null;
  lastMessageAt: number;
  createdAt: number;
};
type ListData = {
  items: Ticket[];
  counts: { total: number; open: number; inProgress: number; closed: number; urgent: number };
};

export default function AdminSupport() {
  const { context } = useSession();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Id<"support_tickets"> | null>(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  const data = useQuery(api.support.adminList, {
    search: search.trim() || undefined,
    status: status === "all" ? undefined : (status as "open" | "in_progress" | "closed"),
    priority: priority === "all" ? undefined : (priority as "low" | "normal" | "high" | "urgent"),
  }) as ListData | undefined;
  const detail = useQuery(
    api.support.adminDetail,
    selected ? { ticketId: selected } : "skip",
  );
  const adminLogAccess = useMutation(api.support.adminLogAccess);
  const adminReply = useMutation(api.support.adminReply);
  const adminSetStatus = useMutation(api.support.adminSetStatus);
  const adminSetCategory = useMutation(api.support.adminSetCategory);
  const adminSetPriority = useMutation(api.support.adminSetPriority);

  const canManage =
    context?.isSuperAdmin ||
    context?.adminPermissions.includes("support.manage");

  const pages = Math.max(1, Math.ceil((data?.items.length ?? 0) / PAGE_SIZE));
  const items = useMemo(
    () => (data?.items ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [data?.items, page],
  );

  const openTicket = (ticketId: Id<"support_tickets">) => {
    setSelected(ticketId);
    setReply("");
    setInternal(false);
    void adminLogAccess({ ticketId }).catch(() => undefined);
  };

  const exportRows = () => {
    if (!data) return;
    downloadCsv(
      "support-tickets.csv",
      ["شماره", "موضوع", "کاربر", "کافی‌نت", "دسته", "اولویت", "وضعیت", "آخرین پیام", "تاریخ ایجاد"],
      data.items.map((row) => [
        row.number,
        row.subject,
        row.userName,
        row.cafeName,
        CATEGORY_LABELS[row.category],
        PRIORITY_LABELS[row.priority],
        STATUS_LABELS[row.status],
        faDateLong(row.lastMessageAt),
        faDateLong(row.createdAt),
      ]),
    );
  };

  const handleReply = async () => {
    if (!selected || !reply.trim()) {
      toast.error("متن پاسخ را وارد کنید.");
      return;
    }
    setBusy(true);
    try {
      await adminReply({
        ticketId: selected,
        body: reply,
        isInternal: internal,
      });
      toast.success(internal ? "یادداشت داخلی ثبت شد." : "پاسخ ارسال شد.");
      setReply("");
      setInternal(false);
    } catch (caught) {
      toast.error(errorMessage(caught, "ثبت پاسخ ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (next: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await adminSetStatus({
        ticketId: selected,
        status: next as "open" | "in_progress" | "closed",
      });
      toast.success("وضعیت تیکت تغییر کرد.");
    } catch (caught) {
      toast.error(errorMessage(caught, "تغییر وضعیت ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  const handleCategory = async (next: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await adminSetCategory({
        ticketId: selected,
        category: next as "account" | "billing" | "technical" | "content" | "other",
      });
      toast.success("دسته تیکت تغییر کرد.");
    } catch (caught) {
      toast.error(errorMessage(caught, "تغییر دسته ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  const handlePriority = async (next: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await adminSetPriority({
        ticketId: selected,
        priority: next as "low" | "normal" | "high" | "urgent",
      });
      toast.success("اولویت تیکت تغییر کرد.");
    } catch (caught) {
      toast.error(errorMessage(caught, "تغییر اولویت ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell active="support">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-black">پشتیبانی کاربران</h1>
            <p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">
              تیکت‌های متصل به کافی‌نت، اولویت‌بندی، پاسخ عمومی و یادداشت داخلی.
              کاربران فقط تیکت‌های خودشان را می‌بینند.
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={exportRows} disabled={!data?.items.length} className="clay-sm h-9 rounded-xl border-0 text-[10.5px]">
            <Download className="size-3.5" />
            خروجی CSV
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Count label="کل تیکت‌ها" value={data?.counts.total ?? 0} />
          <Count label="باز" value={data?.counts.open ?? 0} tone="text-primary" />
          <Count label="در حال بررسی" value={data?.counts.inProgress ?? 0} tone="text-amber-700 dark:text-amber-300" />
          <Count label="بسته" value={data?.counts.closed ?? 0} tone="text-muted-foreground" />
          <Count label="فوری" value={data?.counts.urgent ?? 0} tone="text-rose-700 dark:text-rose-300" />
        </div>

        <section className="clay rounded-[26px] p-3 sm:p-4">
          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="جستجوی شماره، موضوع، کاربر یا کافی‌نت" className="clay-inset h-9 rounded-xl border-0 bg-transparent ps-9 text-[10.5px] shadow-none" />
            </div>
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
              <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px] lg:w-40">
                <SelectValue placeholder="وضعیت" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                <SelectItem value="open">باز</SelectItem>
                <SelectItem value="in_progress">در حال بررسی</SelectItem>
                <SelectItem value="closed">بسته</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={(value) => { setPriority(value); setPage(1); }}>
              <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px] lg:w-32">
                <SelectValue placeholder="اولویت" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">همه اولویت‌ها</SelectItem>
                {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {data === undefined ? (
            <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center">
              <LifeBuoy className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-2 text-sm font-bold">تیکتی پیدا نشد</p>
              <p className="mt-1 text-[10px] text-muted-foreground">فیلترها یا جستجو را تغییر دهید.</p>
            </div>
          ) : (
            <>
              <div className="mt-3 space-y-2">
                {items.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => openTicket(ticket.id)}
                    className="clay-inset flex w-full flex-col gap-2 rounded-2xl p-3 text-start transition-colors hover:bg-primary/5 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span dir="ltr" className="text-[9px] text-muted-foreground">{ticket.number}</span>
                        <Badge variant="secondary" className="rounded-full text-[8px]">{STATUS_LABELS[ticket.status]}</Badge>
                        <Badge variant="secondary" className="rounded-full text-[8px]">{PRIORITY_LABELS[ticket.priority]}</Badge>
                        <Badge variant="secondary" className="rounded-full text-[8px]">{CATEGORY_LABELS[ticket.category]}</Badge>
                      </div>
                      <p className="mt-1 text-[11px] font-bold">{ticket.subject}</p>
                      <p className="mt-0.5 text-[9px] text-muted-foreground">
                        {ticket.userName} {ticket.userPhone ? `· ${ticket.userPhone}` : ""} {ticket.cafeName ? `· ${ticket.cafeName}` : ""}
                      </p>
                    </div>
                    <div className="text-start text-[9px] text-muted-foreground sm:text-end">
                      <p>آخرین پیام</p>
                      <p>{faDateLong(ticket.lastMessageAt)}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[9px] text-muted-foreground">
                  {faNumber(data.items.length)} تیکت · صفحه {faNumber(page)} از {faNumber(pages)}
                </p>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="size-8 rounded-lg"><ChevronRight className="size-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="size-8 rounded-lg"><ChevronLeft className="size-4" /></Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <Dialog open={selected !== null} onOpenChange={(value) => !value && setSelected(null)}>
        <DialogContent className="clay max-h-[88vh] w-[min(46rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[28px] border-0 p-0">
          <div className="border-b border-border/50 p-5">
            <DialogHeader className="text-start">
              <DialogTitle className="text-base font-extrabold">{detail?.subject ?? "جزئیات تیکت"}</DialogTitle>
              <DialogDescription className="text-[10px] leading-5">
                {detail ? `${detail.number} · ${detail.user.name}${detail.cafe ? ` · ${detail.cafe.name}` : ""}` : "در حال بارگذاری"}
              </DialogDescription>
            </DialogHeader>
          </div>
          {!detail ? (
            <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin" /></div>
          ) : (
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={detail.status} onValueChange={handleStatus} disabled={!canManage || busy}>
                  <SelectTrigger className="clay-inset h-8 w-36 rounded-lg border-0 bg-transparent text-[9.5px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="open">باز</SelectItem>
                    <SelectItem value="in_progress">در حال بررسی</SelectItem>
                    <SelectItem value="closed">بسته</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={detail.category} onValueChange={handleCategory} disabled={!canManage || busy}>
                  <SelectTrigger className="clay-inset h-8 w-32 rounded-lg border-0 bg-transparent text-[9.5px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={detail.priority} onValueChange={handlePriority} disabled={!canManage || busy}>
                  <SelectTrigger className="clay-inset h-8 w-32 rounded-lg border-0 bg-transparent text-[9.5px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {detail.assignedTo && (
                  <Badge variant="secondary" className="rounded-full text-[8px]">
                    <ShieldCheck className="me-1 size-3" /> مسئول: {detail.assignedTo}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                {detail.messages.map((message) => (
                  <div key={message.id} className={`rounded-2xl p-3 text-[10px] leading-6 ${message.isInternal ? "border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100" : message.isAdmin ? "bg-primary/10" : "bg-muted/45"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{message.isInternal ? "یادداشت داخلی" : message.isAdmin ? "پشتیبانی" : "کاربر"}</span>
                      <span className="text-[8px] text-muted-foreground">{faDateLong(message.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                  </div>
                ))}
              </div>

              {canManage && (
                <div className="space-y-2">
                  <Textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder={internal ? "یادداشت داخلی (برای کاربر نمایش داده نمی‌شود)" : "پاسخ به کاربر"} className="clay-inset min-h-20 rounded-xl border-0 bg-transparent text-[10.5px]" />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-[9.5px] text-muted-foreground">
                      <Checkbox checked={internal} onCheckedChange={(value) => setInternal(Boolean(value))} />
                      یادداشت داخلی
                    </label>
                    <Button type="button" onClick={handleReply} disabled={busy || !reply.trim()} className="clay-primary h-9 rounded-xl border-0 text-[10px] font-bold">
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-3.5" />}
                      ثبت
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="clay rounded-[20px] p-3">
      <p className="text-[9.5px] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-black ${tone ?? ""}`}>{faNumber(value)}</p>
    </div>
  );
}
