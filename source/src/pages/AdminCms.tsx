import { AdminShell } from "@/components/layout/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/backend/api";
import type { Id } from "@/backend/ids";
import { errorMessage } from "@/lib/auth";
import { faDateLong, faNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@/backend/client";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  History,
  Home,
  LayoutTemplate,
  ListTree,
  Loader2,
  Palette,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Undo2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type ThemeDraft = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  darkBackgroundColor: string;
  buttonColor: string;
  buttonTextColor: string;
  fontFamily: "vazirmatn" | "tahoma" | "system";
  textScale: number;
  cardRadius: number;
  cardStyle: "clay" | "flat" | "outline";
  iconStyle: "rounded" | "circle" | "square";
  backgroundImageUrl: string | null;
  darkModeEnabled: boolean;
};

type FeatureCard = {
  title: string;
  description: string;
  icon: string;
  tone: string;
  active: boolean;
};

type HomeDraft = {
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  announcementEnabled: boolean;
  announcementText: string;
  features: FeatureCard[];
  sectionOrder: string[];
  hiddenSections: string[];
};

type PageDraft = {
  title: string;
  summary: string;
  body: string;
  imageUrls: string[];
  sortOrder: number;
  status: "published" | "hidden";
};

type NavRow = {
  id: Id<"navigation_items">;
  label: string;
  href: string;
  location: "public" | "dashboard" | "footer";
  sortOrder: number;
  isActive: boolean;
  isExternal: boolean;
  requiredPlanCode: string | null;
  requiredPermission: string | null;
};

type FeatureRow = {
  id: Id<"feature_flags">;
  key: string;
  label: string;
  description: string;
  isEnabled: boolean;
  allowedPlans: string[];
  allowedRoles: string[];
  dailyLimit: number;
  monthlyLimit: number;
  sortOrder: number;
};

const PLAN_LABELS: Record<string, string> = {
  basic: "پایه",
  pro: "حرفه‌ای",
  premium: "ویژه",
  trial: "آزمایشی",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "صاحب کافی‌نت",
  employee: "کارمند",
  site_admin: "مدیر سایت",
};

const SECTION_LABELS: Record<string, string> = {
  features: "امکانات",
  version: "معرفی دفتر مالی",
  benefits: "مزیت‌ها",
  roadmap: "نقشه راه",
  plans: "اشتراک‌ها",
  cta: "فراخوان پایانی",
};

const ICON_OPTIONS = [
  "calculator",
  "newspaper",
  "globe",
  "bot",
  "receipt",
  "sparkles",
  "shield",
  "users",
  "wallet",
];

const TONE_OPTIONS = ["tile-navy", "tile-mint", "tile-peach", "tile-lilac"];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default function AdminCms() {
  const overview = useQuery(api.siteCms.overview, {});
  const ensure = useMutation(api.siteCms.ensure);
  const saveSettingsDraft = useMutation(api.siteCms.saveSettingsDraft);
  const publishSettings = useMutation(api.siteCms.publishSettings);
  const discardSettingsDraft = useMutation(api.siteCms.discardSettingsDraft);
  const restoreSettingsVersion = useMutation(api.siteCms.restoreSettingsVersion);

  const createPage = useMutation(api.siteCms.createPage);
  const savePageDraft = useMutation(api.siteCms.savePageDraft);
  const discardPageDraft = useMutation(api.siteCms.discardPageDraft);
  const publishPage = useMutation(api.siteCms.publishPage);
  const restorePageVersion = useMutation(api.siteCms.restorePageVersion);

  const saveNavigationItem = useMutation(api.siteCms.saveNavigationItem);
  const deleteNavigationItem = useMutation(api.siteCms.deleteNavigationItem);
  const saveFeatureFlag = useMutation(api.siteCms.saveFeatureFlag);
  const saveFeaturePlanLimit = useMutation(api.siteCms.saveFeaturePlanLimit);

  const [tab, setTab] = useState("pages");
  const [themeDraft, setThemeDraft] = useState<ThemeDraft | null>(null);
  const [homeDraft, setHomeDraft] = useState<HomeDraft | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<Id<"site_pages"> | null>(null);
  const [pageDraftState, setPageDraft] = useState<PageDraft | null>(null);
  const [newPage, setNewPage] = useState({ slug: "", title: "" });
  const [selectedFeatureId, setSelectedFeatureId] =
    useState<Id<"feature_flags"> | null>(null);
  const [featureDraftState, setFeatureDraft] = useState<FeatureRow | null>(null);
  const [planLimitForm, setPlanLimitForm] = useState({
    planCode: "basic",
    isAllowed: true,
    dailyLimit: 0,
    monthlyLimit: 0,
  });
  const [navDraft, setNavDraft] = useState<{
    id: Id<"navigation_items"> | null;
    label: string;
    href: string;
    location: "public" | "dashboard" | "footer";
    sortOrder: number;
    isActive: boolean;
    isExternal: boolean;
    requiredPlanCode: string;
    requiredPermission: string;
  }>({
    id: null,
    label: "",
    href: "/",
    location: "public",
    sortOrder: 10,
    isActive: true,
    isExternal: false,
    requiredPlanCode: "",
    requiredPermission: "",
  });
  const [busy, setBusy] = useState<string | null>(null);

  const settingsDraft = useMemo(() => {
    if (!overview) return null;
    return {
      theme: themeDraft ?? overview.settings.draft.theme,
      home: homeDraft ?? overview.settings.draft.home,
    };
  }, [overview, themeDraft, homeDraft]);

  const selectedPage =
    overview?.pages.find((page) => page.id === selectedPageId) ??
    overview?.pages[0];
  const pageDraft = pageDraftState ?? selectedPage?.draft ?? null;
  const pageHistory = useQuery(
    api.siteCms.history,
    selectedPage
      ? { entityType: "site_page", entityKey: selectedPage.slug }
      : "skip",
  );
  const settingsHistory = useQuery(api.siteCms.history, {
    entityType: "site_settings",
  });
  const selectedFeature =
    overview?.features.find((feature) => feature.id === selectedFeatureId) ??
    overview?.features[0];
  const featureDraft = featureDraftState ?? selectedFeature ?? null;
  const featureHistory = useQuery(
    api.siteCms.history,
    selectedFeature
      ? { entityType: "feature", entityKey: selectedFeature.key }
      : "skip",
  );

  const run = async (key: string, work: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await work();
      toast.success(success);
    } catch (caught) {
      toast.error(errorMessage(caught, "عملیات انجام نشد."));
    } finally {
      setBusy(null);
    }
  };

  const handleEnsure = () =>
    run("ensure", () => ensure({}), "ساختار مدیریت سایت آماده شد.");

  const saveThemeAndHomeDraft = async () => {
    if (!settingsDraft) return;
    await saveSettingsDraft({ settings: settingsDraft });
  };

  const handleSaveSettings = () =>
    run(
      "settings-save",
      saveThemeAndHomeDraft,
      "پیش‌نویس ظاهر و صفحه اصلی ذخیره شد.",
    );

  const handlePublishSettings = () =>
    run(
      "settings-publish",
      async () => {
        if (themeDraft || homeDraft) await saveThemeAndHomeDraft();
        await publishSettings({});
        setThemeDraft(null);
        setHomeDraft(null);
      },
      "تغییرات سایت منتشر شد.",
    );

  const handleDiscardSettings = () =>
    run(
      "settings-discard",
      async () => {
        await discardSettingsDraft({});
        setThemeDraft(null);
        setHomeDraft(null);
      },
      "پیش‌نویس به نسخه منتشرشده برگشت.",
    );

  const handleSavePage = () =>
    run(
      "page-save",
      async () => {
        if (!selectedPage || !pageDraft) return;
        await savePageDraft({ pageId: selectedPage.id, ...pageDraft });
      },
      "پیش‌نویس صفحه ذخیره شد.",
    );

  const handlePublishPage = () =>
    run(
      "page-publish",
      async () => {
        if (!selectedPage) return;
        if (pageDraftState) {
          await savePageDraft({ pageId: selectedPage.id, ...pageDraftState });
        }
        await publishPage({ pageId: selectedPage.id });
      },
      "صفحه منتشر شد.",
    );

  const handleCreatePage = () =>
    run(
      "page-create",
      async () => {
        const result = await createPage(newPage);
        setNewPage({ slug: "", title: "" });
        setSelectedPageId(result.pageId);
        setPageDraft(null);
      },
      "صفحه پیش‌نویس ساخته شد.",
    );

  const handleSaveNavigation = () =>
    run(
      "nav-save",
      async () => {
        await saveNavigationItem({
          ...(navDraft.id ? { itemId: navDraft.id } : {}),
          label: navDraft.label,
          href: navDraft.href,
          location: navDraft.location,
          sortOrder: navDraft.sortOrder,
          isActive: navDraft.isActive,
          isExternal: navDraft.isExternal,
          requiredPlanCode: navDraft.requiredPlanCode || undefined,
          requiredPermission: navDraft.requiredPermission || undefined,
        });
        setNavDraft({
          id: null,
          label: "",
          href: "/",
          location: "public",
          sortOrder: 10,
          isActive: true,
          isExternal: false,
          requiredPlanCode: "",
          requiredPermission: "",
        });
      },
      "آیتم منو ذخیره شد.",
    );

  const handleDeleteNavigation = (item: NavRow) => {
    if (!window.confirm(`آیتم «${item.label}» حذف شود؟`)) return;
    run("nav-delete", () => deleteNavigationItem({ itemId: item.id }), "آیتم منو حذف شد.");
  };

  const handleSaveFeature = () =>
    run(
      "feature-save",
      async () => {
        if (!featureDraft) return;
        await saveFeatureFlag({
          featureId: featureDraft.id,
          isEnabled: featureDraft.isEnabled,
          allowedPlans: featureDraft.allowedPlans,
          allowedRoles: featureDraft.allowedRoles,
          dailyLimit: featureDraft.dailyLimit,
          monthlyLimit: featureDraft.monthlyLimit,
        });
      },
      "سیاست قابلیت ذخیره شد.",
    );

  const handleSavePlanLimit = () =>
    run(
      "plan-limit-save",
      async () => {
        if (!selectedFeature) return;
        await saveFeaturePlanLimit({
          featureKey: selectedFeature.key,
          ...planLimitForm,
        });
      },
      "محدودیت پلن ذخیره شد.",
    );

  if (overview === undefined) {
    return (
      <AdminShell active="site">
        <div className="clay flex justify-center rounded-[28px] p-10">
          <Loader2 className="size-5 animate-spin" />
        </div>
      </AdminShell>
    );
  }

  if (overview === null) {
    return (
      <AdminShell active="site">
        <div className="clay rounded-[28px] p-8 text-center">
          <ShieldCheck className="mx-auto size-8 text-primary" />
          <h1 className="mt-3 text-lg font-extrabold">دسترسی مالک لازم است</h1>
          <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
            این بخش فقط برای مدیر کل پلتفرم و پس از تأیید دومرحله‌ای در دسترس است.
          </p>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell active="site">
      <div className="space-y-4">
        <section className="relative overflow-hidden rounded-[30px] bg-[oklch(0.24_0.045_264)] px-5 py-6 text-white sm:px-7">
          <div className="pointer-events-none absolute -end-16 -top-20 size-56 rounded-full bg-[oklch(0.72_0.1_170)]/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[9.5px] font-bold tracking-wide text-white/55">
                <span className="grid size-7 place-items-center rounded-lg bg-white/10 text-emerald-200">
                  <LayoutTemplate className="size-3.5" />
                </span>
                مرکز مدیریت محتوا و تنظیمات پویا
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight">
                مدیریت سایت و ظاهر
              </h1>
              <p className="mt-2 max-w-2xl text-[10.5px] leading-6 text-white/60">
                صفحات، ظاهر، صفحه اصلی، منوها و قابلیت‌ها را بدون تغییر کد
                مدیریت کنید. تغییرات ابتدا پیش‌نویس می‌شوند و فقط با انتشار
                برای کاربران دیده می‌شوند.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                variant="ghost"
                className="h-9 rounded-xl border border-white/15 bg-white/10 text-[10px] font-bold text-white hover:bg-white/15 hover:text-white"
              >
                <Link to="/admin/settings">
                  <Palette className="size-3.5" />
                  لوگو و هویت
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setTab("history")}
                className="h-9 rounded-xl border border-white/15 bg-white/10 text-[10px] font-bold text-white hover:bg-white/15 hover:text-white"
              >
                <History className="size-3.5" />
                تاریخچه
              </Button>
              <Button
                type="button"
                onClick={handleEnsure}
                disabled={busy === "ensure"}
                className="h-9 rounded-xl border-0 bg-white text-[10px] font-bold text-[oklch(0.24_0.045_264)] hover:bg-white/90"
              >
                {busy === "ensure" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                همگام‌سازی ساختار
              </Button>
            </div>
          </div>
        </section>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="clay-inset flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl p-1.5">
            <TabTrigger value="pages" icon={LayoutTemplate} label="صفحات" />
            <TabTrigger value="theme" icon={Palette} label="ظاهر" />
            <TabTrigger value="home" icon={Home} label="صفحه اصلی" />
            <TabTrigger value="navigation" icon={ListTree} label="منوها" />
            <TabTrigger value="features" icon={SlidersHorizontal} label="قابلیت‌ها" />
            <TabTrigger value="history" icon={History} label="تاریخچه" />
          </TabsList>

          <TabsContent value="pages" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[0.85fr_1.5fr]">
              <section className="clay rounded-[26px] p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[12px] font-extrabold">صفحات سایت</h2>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">
                      {faNumber(overview.pages.length)} صفحه ثبت شده است.
                    </p>
                  </div>
                  <Badge variant="secondary" className="rounded-full text-[8px]">
                    پیش‌نویس جدا
                  </Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {overview.pages.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => {
                        setSelectedPageId(page.id);
                        setPageDraft(clone(page.draft));
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start transition-colors",
                        selectedPageId === page.id
                          ? "clay-sm text-primary"
                          : "bg-muted/35 hover:bg-muted/55",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[10.5px] font-bold">
                          {page.draft.title}
                        </span>
                        <span dir="ltr" className="mt-0.5 block text-[8.5px] text-muted-foreground">
                          /p/{page.slug}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[8px] font-semibold",
                          page.draft.status === "published"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {page.draft.status === "published" ? "منتشرشده" : "مخفی"}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-muted/30 p-3">
                  <p className="text-[9.5px] font-bold">افزودن صفحه جدید</p>
                  <div className="mt-2 grid gap-2">
                    <Input
                      dir="ltr"
                      value={newPage.slug}
                      onChange={(event) =>
                        setNewPage((previous) => ({
                          ...previous,
                          slug: event.target.value,
                        }))
                      }
                      placeholder="about-partners"
                      className="clay-inset h-9 rounded-xl border-0 bg-transparent text-[10px]"
                    />
                    <Input
                      value={newPage.title}
                      onChange={(event) =>
                        setNewPage((previous) => ({
                          ...previous,
                          title: event.target.value,
                        }))
                      }
                      placeholder="عنوان صفحه"
                      className="clay-inset h-9 rounded-xl border-0 bg-transparent text-[10px]"
                    />
                    <Button
                      type="button"
                      onClick={handleCreatePage}
                      disabled={busy === "page-create"}
                      className="clay-primary h-9 rounded-xl border-0 text-[9.5px] font-bold"
                    >
                      {busy === "page-create" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                      ساخت پیش‌نویس صفحه
                    </Button>
                  </div>
                </div>
              </section>

              {selectedPage && pageDraft ? (
                <section className="clay rounded-[26px] p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[12px] font-extrabold">
                        ویرایش: {selectedPage.draft.title}
                      </h2>
                      <p className="mt-0.5 text-[9px] text-muted-foreground">
                        نسخه منتشرشده و پیش‌نویس از هم جدا نگهداری می‌شوند.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleSavePage}
                        disabled={busy === "page-save"}
                        className="h-8 rounded-lg px-2 text-[9px]"
                      >
                        <Save className="size-3.5" />
                        ذخیره پیش‌نویس
                      </Button>
                      <Button
                        type="button"
                        onClick={() =>
                          setPageDraft({
                            title: selectedPage.published.title,
                            summary: selectedPage.published.summary,
                            body: selectedPage.published.body,
                            imageUrls: selectedPage.published.imageUrls,
                            sortOrder: selectedPage.published.sortOrder,
                            status: selectedPage.published.status,
                          })
                        }
                        variant="ghost"
                        className="h-8 rounded-lg px-2 text-[9px]"
                      >
                        <Undo2 className="size-3.5" />
                        بازگردانی
                      </Button>
                      <Button
                        type="button"
                        onClick={handlePublishPage}
                        disabled={busy === "page-publish"}
                        className="clay-primary h-8 rounded-lg border-0 px-2.5 text-[9px] font-bold"
                      >
                        {busy === "page-publish" ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Rocket className="size-3.5" />
                        )}
                        انتشار
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="عنوان صفحه">
                      <Input
                        value={pageDraft.title}
                        onChange={(event) =>
                          setPageDraft({ ...pageDraft, title: event.target.value })
                        }
                        className="clay-inset h-9 rounded-xl border-0 bg-transparent text-[10.5px]"
                      />
                    </Field>
                    <Field label="ترتیب نمایش">
                      <Input
                        dir="ltr"
                        type="number"
                        value={pageDraft.sortOrder}
                        onChange={(event) =>
                          setPageDraft({
                            ...pageDraft,
                            sortOrder: Number(event.target.value) || 0,
                          })
                        }
                        className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10.5px]"
                      />
                    </Field>
                    <Field label="خلاصه صفحه" className="sm:col-span-2">
                      <Textarea
                        value={pageDraft.summary}
                        onChange={(event) =>
                          setPageDraft({ ...pageDraft, summary: event.target.value })
                        }
                        className="clay-inset min-h-16 rounded-xl border-0 bg-transparent text-[10.5px]"
                      />
                    </Field>
                    <Field label="متن صفحه (هر پاراگراف با خط خالی جدا شود)" className="sm:col-span-2">
                      <Textarea
                        value={pageDraft.body}
                        onChange={(event) =>
                          setPageDraft({ ...pageDraft, body: event.target.value })
                        }
                        className="clay-inset min-h-40 rounded-xl border-0 bg-transparent text-[10.5px] leading-6"
                      />
                    </Field>
                    <Field label="تصاویر (هر URL در یک خط)" className="sm:col-span-2">
                      <Textarea
                        dir="ltr"
                        value={pageDraft.imageUrls.join("\n")}
                        onChange={(event) =>
                          setPageDraft({
                            ...pageDraft,
                            imageUrls: event.target.value
                              .split("\n")
                              .map((value) => value.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="https://..."
                        className="clay-inset min-h-16 rounded-xl border-0 bg-transparent text-left text-[9.5px]"
                      />
                    </Field>
                    <Field label="وضعیت پیش‌نویس">
                      <Select
                        value={pageDraft.status}
                        onValueChange={(value) =>
                          setPageDraft({
                            ...pageDraft,
                            status: value as PageDraft["status"],
                          })
                        }
                      >
                        <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="published">منتشرشده</SelectItem>
                          <SelectItem value="hidden">مخفی</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          run(
                            "page-discard",
                            () => discardPageDraft({ pageId: selectedPage.id }),
                            "پیش‌نویس کنار گذاشته شد.",
                          )
                        }
                        className="h-9 rounded-xl text-[9.5px] text-muted-foreground"
                      >
                        <Undo2 className="size-3.5" />
                        کنار گذاشتن پیش‌نویس
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-muted/30 p-3">
                    <div className="flex items-center gap-1.5 text-[9.5px] font-bold">
                      <Eye className="size-3.5" />
                      پیش‌نمایش پیش‌نویس
                    </div>
                    <div className="mt-2 rounded-xl bg-background/70 p-3">
                      <p className="text-[11px] font-extrabold">{pageDraft.title}</p>
                      {pageDraft.summary && (
                        <p className="mt-1 text-[9px] leading-5 text-muted-foreground">
                          {pageDraft.summary}
                        </p>
                      )}
                      <p className="mt-2 line-clamp-4 whitespace-pre-line text-[9px] leading-5 text-foreground/75">
                        {pageDraft.body || "متن صفحه هنوز نوشته نشده است."}
                      </p>
                    </div>
                  </div>

                  {pageHistory && pageHistory.length > 0 && (
                    <div className="mt-4">
                      <p className="flex items-center gap-1.5 text-[9.5px] font-bold">
                        <History className="size-3.5" />
                        نسخه‌های منتشرشده این صفحه
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {pageHistory.map((version) => (
                          <div
                            key={version.id}
                            className="flex items-center justify-between gap-2 rounded-xl bg-muted/30 px-2.5 py-2"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[9px] font-semibold">
                                {version.label}
                              </span>
                              <span className="text-[8px] text-muted-foreground">
                                {faDateLong(version.createdAt)}
                              </span>
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                void run(
                                  "page-restore",
                                  async () => {
                                    await restorePageVersion({
                                      pageId: selectedPage.id,
                                      versionId: version.id,
                                    });
                                    setPageDraft(null);
                                  },
                                  "نسخه در پیش‌نویس بازیابی شد؛ برای اعمال، انتشار را بزنید.",
                                );
                              }}
                              className="h-7 shrink-0 rounded-lg px-2 text-[8px]"
                            >
                              بازیابی
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              ) : (
                <section className="clay flex items-center justify-center rounded-[26px] p-10 text-[10px] text-muted-foreground">
                  یک صفحه را برای ویرایش انتخاب کنید.
                </section>
              )}
            </div>
          </TabsContent>

          <TabsContent value="theme" className="space-y-4">
            {settingsDraft && (
              <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                <section className="clay rounded-[26px] p-4 sm:p-5">
                  <SectionTitle
                    icon={Palette}
                    title="رنگ‌ها، فونت و شکل رابط"
                    description="این مقادیر روی سایت عمومی اعمال می‌شوند؛ پیش‌نمایش کنار صفحه فقط از پیش‌نویس استفاده می‌کند."
                  />
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ColorField
                      label="رنگ اصلی"
                      value={settingsDraft.theme.primaryColor}
                      onChange={(value) =>
                        setThemeDraft({
                          ...settingsDraft.theme,
                          primaryColor: value,
                        })
                      }
                    />
                    <ColorField
                      label="رنگ ثانویه"
                      value={settingsDraft.theme.secondaryColor}
                      onChange={(value) =>
                        setThemeDraft({
                          ...settingsDraft.theme,
                          secondaryColor: value,
                        })
                      }
                    />
                    <ColorField
                      label="پس‌زمینه روشن"
                      value={settingsDraft.theme.backgroundColor}
                      onChange={(value) =>
                        setThemeDraft({
                          ...settingsDraft.theme,
                          backgroundColor: value,
                        })
                      }
                    />
                    <ColorField
                      label="پس‌زمینه تاریک"
                      value={settingsDraft.theme.darkBackgroundColor}
                      onChange={(value) =>
                        setThemeDraft({
                          ...settingsDraft.theme,
                          darkBackgroundColor: value,
                        })
                      }
                    />
                    <ColorField
                      label="رنگ دکمه"
                      value={settingsDraft.theme.buttonColor}
                      onChange={(value) =>
                        setThemeDraft({
                          ...settingsDraft.theme,
                          buttonColor: value,
                        })
                      }
                    />
                    <ColorField
                      label="رنگ متن دکمه"
                      value={settingsDraft.theme.buttonTextColor}
                      onChange={(value) =>
                        setThemeDraft({
                          ...settingsDraft.theme,
                          buttonTextColor: value,
                        })
                      }
                    />
                    <Field label="فونت فارسی">
                      <Select
                        value={settingsDraft.theme.fontFamily}
                        onValueChange={(value) =>
                          setThemeDraft({
                            ...settingsDraft.theme,
                            fontFamily: value as ThemeDraft["fontFamily"],
                          })
                        }
                      >
                        <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="vazirmatn">وزیرمتن</SelectItem>
                          <SelectItem value="tahoma">Tahoma</SelectItem>
                          <SelectItem value="system">فونت سیستم</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="مقیاس متن (٪)">
                      <Input
                        dir="ltr"
                        type="number"
                        min={85}
                        max={125}
                        value={settingsDraft.theme.textScale}
                        onChange={(event) =>
                          setThemeDraft({
                            ...settingsDraft.theme,
                            textScale: Number(event.target.value) || 100,
                          })
                        }
                        className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10px]"
                      />
                    </Field>
                    <Field label="گردی گوشه‌ها (px)">
                      <Input
                        dir="ltr"
                        type="number"
                        min={6}
                        max={36}
                        value={settingsDraft.theme.cardRadius}
                        onChange={(event) =>
                          setThemeDraft({
                            ...settingsDraft.theme,
                            cardRadius: Number(event.target.value) || 24,
                          })
                        }
                        className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10px]"
                      />
                    </Field>
                    <Field label="شکل کارت‌ها">
                      <Select
                        value={settingsDraft.theme.cardStyle}
                        onValueChange={(value) =>
                          setThemeDraft({
                            ...settingsDraft.theme,
                            cardStyle: value as ThemeDraft["cardStyle"],
                          })
                        }
                      >
                        <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="clay">برجسته (Clay)</SelectItem>
                          <SelectItem value="flat">مسطح</SelectItem>
                          <SelectItem value="outline">خط‌دار</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="شکل آیکون‌ها">
                      <Select
                        value={settingsDraft.theme.iconStyle}
                        onValueChange={(value) =>
                          setThemeDraft({
                            ...settingsDraft.theme,
                            iconStyle: value as ThemeDraft["iconStyle"],
                          })
                        }
                      >
                        <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="rounded">گوشه‌گرد</SelectItem>
                          <SelectItem value="circle">دایره</SelectItem>
                          <SelectItem value="square">مربع</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="تصویر پس‌زمینه (URL)" className="sm:col-span-2">
                      <Input
                        dir="ltr"
                        value={settingsDraft.theme.backgroundImageUrl ?? ""}
                        onChange={(event) =>
                          setThemeDraft({
                            ...settingsDraft.theme,
                            backgroundImageUrl: event.target.value || null,
                          })
                        }
                        placeholder="https://..."
                        className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[9.5px]"
                      />
                    </Field>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2.5">
                    <div>
                      <p className="text-[9.5px] font-semibold">حالت تاریک فعال باشد</p>
                      <p className="mt-0.5 text-[8.5px] text-muted-foreground">
                        با غیرفعال‌کردن، تم روشن به‌عنوان حالت پیش‌فرض اعمال می‌شود.
                      </p>
                    </div>
                    <Switch
                      checked={settingsDraft.theme.darkModeEnabled}
                      onCheckedChange={(value) =>
                        setThemeDraft({
                          ...settingsDraft.theme,
                          darkModeEnabled: value,
                        })
                      }
                    />
                  </div>
                  <SettingsActions
                    busy={busy}
                    onSave={handleSaveSettings}
                    onPublish={handlePublishSettings}
                    onDiscard={handleDiscardSettings}
                  />
                </section>

                <ThemePreview theme={settingsDraft.theme} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="home" className="space-y-4">
            {settingsDraft && (
              <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                <section className="clay rounded-[26px] p-4 sm:p-5">
                  <SectionTitle
                    icon={Home}
                    title="محتوای صفحه اصلی"
                    description="عنوان، معرفی، دکمه‌ها، بنر و کارت‌های امکانات از همین‌جا کنترل می‌شوند."
                  />
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="برچسب بالای عنوان">
                      <Input
                        value={settingsDraft.home.heroEyebrow}
                        onChange={(event) =>
                          setHomeDraft({
                            ...settingsDraft.home,
                            heroEyebrow: event.target.value,
                          })
                        }
                        className="clay-inset h-9 rounded-xl border-0 bg-transparent text-[10px]"
                      />
                    </Field>
                    <Field label="عنوان اصلی">
                      <Input
                        value={settingsDraft.home.heroTitle}
                        onChange={(event) =>
                          setHomeDraft({
                            ...settingsDraft.home,
                            heroTitle: event.target.value,
                          })
                        }
                        className="clay-inset h-9 rounded-xl border-0 bg-transparent text-[10px]"
                      />
                    </Field>
                    <Field label="متن معرفی" className="sm:col-span-2">
                      <Textarea
                        value={settingsDraft.home.heroSubtitle}
                        onChange={(event) =>
                          setHomeDraft({
                            ...settingsDraft.home,
                            heroSubtitle: event.target.value,
                          })
                        }
                        className="clay-inset min-h-20 rounded-xl border-0 bg-transparent text-[10px] leading-6"
                      />
                    </Field>
                    <Field label="برچسب دکمه اصلی">
                      <Input
                        value={settingsDraft.home.primaryCtaLabel}
                        onChange={(event) =>
                          setHomeDraft({
                            ...settingsDraft.home,
                            primaryCtaLabel: event.target.value,
                          })
                        }
                        className="clay-inset h-9 rounded-xl border-0 bg-transparent text-[10px]"
                      />
                    </Field>
                    <Field label="لینک دکمه اصلی">
                      <Input
                        dir="ltr"
                        value={settingsDraft.home.primaryCtaHref}
                        onChange={(event) =>
                          setHomeDraft({
                            ...settingsDraft.home,
                            primaryCtaHref: event.target.value,
                          })
                        }
                        className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[9.5px]"
                      />
                    </Field>
                    <Field label="برچسب دکمه دوم">
                      <Input
                        value={settingsDraft.home.secondaryCtaLabel}
                        onChange={(event) =>
                          setHomeDraft({
                            ...settingsDraft.home,
                            secondaryCtaLabel: event.target.value,
                          })
                        }
                        className="clay-inset h-9 rounded-xl border-0 bg-transparent text-[10px]"
                      />
                    </Field>
                    <Field label="لینک دکمه دوم">
                      <Input
                        dir="ltr"
                        value={settingsDraft.home.secondaryCtaHref}
                        onChange={(event) =>
                          setHomeDraft({
                            ...settingsDraft.home,
                            secondaryCtaHref: event.target.value,
                          })
                        }
                        className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[9.5px]"
                      />
                    </Field>
                  </div>

                  <div className="mt-4 rounded-2xl bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[9.5px] font-bold">بنر و اطلاعیه ویژه</p>
                        <p className="mt-0.5 text-[8.5px] text-muted-foreground">
                          در بالای صفحه اصلی نمایش داده می‌شود.
                        </p>
                      </div>
                      <Switch
                        checked={settingsDraft.home.announcementEnabled}
                        onCheckedChange={(value) =>
                          setHomeDraft({
                            ...settingsDraft.home,
                            announcementEnabled: value,
                          })
                        }
                      />
                    </div>
                    {settingsDraft.home.announcementEnabled && (
                      <Textarea
                        value={settingsDraft.home.announcementText}
                        onChange={(event) =>
                          setHomeDraft({
                            ...settingsDraft.home,
                            announcementText: event.target.value,
                          })
                        }
                        className="clay-inset mt-2 min-h-16 rounded-xl border-0 bg-transparent text-[10px]"
                        placeholder="متن اطلاعیه..."
                      />
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9.5px] font-bold">کارت‌های امکانات</p>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setHomeDraft({
                            ...settingsDraft.home,
                            features: [
                              ...settingsDraft.home.features,
                              {
                                title: "قابلیت جدید",
                                description: "",
                                icon: "sparkles",
                                tone: "tile-navy",
                                active: true,
                              },
                            ],
                          })
                        }
                        className="h-7 rounded-lg px-2 text-[8.5px]"
                      >
                        <Plus className="size-3" />
                        افزودن کارت
                      </Button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {settingsDraft.home.features.map((feature, index) => (
                        <div key={`${index}-${feature.title}`} className="rounded-xl bg-muted/30 p-2.5">
                          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                            <Input
                              value={feature.title}
                              onChange={(event) => {
                                const features = [...settingsDraft.home.features];
                                features[index] = {
                                  ...feature,
                                  title: event.target.value,
                                };
                                setHomeDraft({ ...settingsDraft.home, features });
                              }}
                              className="clay-inset h-8 rounded-lg border-0 bg-transparent text-[9.5px]"
                              placeholder="عنوان"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() =>
                                setHomeDraft({
                                  ...settingsDraft.home,
                                  features: settingsDraft.home.features.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                })
                              }
                              className="h-8 rounded-lg px-2 text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                          <Textarea
                            value={feature.description}
                            onChange={(event) => {
                              const features = [...settingsDraft.home.features];
                              features[index] = {
                                ...feature,
                                description: event.target.value,
                              };
                              setHomeDraft({ ...settingsDraft.home, features });
                            }}
                            className="clay-inset mt-2 min-h-14 rounded-lg border-0 bg-transparent text-[9px] leading-5"
                            placeholder="توضیح کوتاه"
                          />
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Select
                              value={feature.icon}
                              onValueChange={(value) => {
                                const features = [...settingsDraft.home.features];
                                features[index] = { ...feature, icon: value };
                                setHomeDraft({ ...settingsDraft.home, features });
                              }}
                            >
                              <SelectTrigger className="clay-inset h-7 w-32 rounded-lg border-0 bg-transparent text-[8.5px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {ICON_OPTIONS.map((icon) => (
                                  <SelectItem key={icon} value={icon}>
                                    {icon}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={feature.tone}
                              onValueChange={(value) => {
                                const features = [...settingsDraft.home.features];
                                features[index] = { ...feature, tone: value };
                                setHomeDraft({ ...settingsDraft.home, features });
                              }}
                            >
                              <SelectTrigger className="clay-inset h-7 w-32 rounded-lg border-0 bg-transparent text-[8.5px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {TONE_OPTIONS.map((tone) => (
                                  <SelectItem key={tone} value={tone}>
                                    {tone}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <label className="flex items-center gap-1.5 text-[8.5px] text-muted-foreground">
                              <Switch
                                checked={feature.active}
                                onCheckedChange={(value) => {
                                  const features = [...settingsDraft.home.features];
                                  features[index] = { ...feature, active: value };
                                  setHomeDraft({ ...settingsDraft.home, features });
                                }}
                              />
                              فعال
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-[9.5px] font-bold">ترتیب بخش‌های صفحه اصلی</p>
                    <div className="mt-2 space-y-1.5">
                      {settingsDraft.home.sectionOrder.map((key, index) => (
                        <div
                          key={key}
                          className="flex items-center gap-2 rounded-xl bg-muted/30 px-2.5 py-1.5"
                        >
                          <span className="w-5 text-center text-[8px] text-muted-foreground">
                            {faNumber(index + 1)}
                          </span>
                          <span className="flex-1 text-[9px] font-semibold">
                            {SECTION_LABELS[key] ?? key}
                          </span>
                          <label className="flex items-center gap-1 text-[8px] text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={!settingsDraft.home.hiddenSections.includes(key)}
                              onChange={(event) => {
                                const hiddenSections = event.target.checked
                                  ? settingsDraft.home.hiddenSections.filter((item) => item !== key)
                                  : [...settingsDraft.home.hiddenSections, key];
                                setHomeDraft({ ...settingsDraft.home, hiddenSections });
                              }}
                            />
                            نمایش
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={index === 0}
                            onClick={() => {
                              const order = [...settingsDraft.home.sectionOrder];
                              [order[index - 1], order[index]] = [
                                order[index],
                                order[index - 1],
                              ];
                              setHomeDraft({ ...settingsDraft.home, sectionOrder: order });
                            }}
                            className="size-6 rounded-md p-0"
                          >
                            <ArrowUp className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={index === settingsDraft.home.sectionOrder.length - 1}
                            onClick={() => {
                              const order = [...settingsDraft.home.sectionOrder];
                              [order[index + 1], order[index]] = [
                                order[index],
                                order[index + 1],
                              ];
                              setHomeDraft({ ...settingsDraft.home, sectionOrder: order });
                            }}
                            className="size-6 rounded-md p-0"
                          >
                            <ArrowDown className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <SettingsActions
                    busy={busy}
                    onSave={handleSaveSettings}
                    onPublish={handlePublishSettings}
                    onDiscard={handleDiscardSettings}
                  />
                </section>

                <HomePreview home={settingsDraft.home} theme={settingsDraft.theme} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="navigation" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <section className="clay rounded-[26px] p-4">
                <SectionTitle
                  icon={ListTree}
                  title="منوهای سایت"
                  description="منوهای عمومی، فوتر و داشبورد؛ ترتیب و دسترسی هر آیتم را تعیین کنید."
                />
                <div className="mt-3 space-y-2">
                  {overview.navigation.map((item) => (
                    <div key={item.id} className="rounded-xl bg-muted/30 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[9.5px] font-bold">{item.label}</p>
                          <p dir="ltr" className="mt-0.5 truncate text-[8px] text-muted-foreground">
                            {item.href}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="secondary" className="rounded-full text-[7.5px]">
                              {item.location === "public"
                                ? "عمومی"
                                : item.location === "footer"
                                  ? "فوتر"
                                  : "داشبورد"}
                            </Badge>
                            {!item.isActive && (
                              <Badge variant="secondary" className="rounded-full text-[7.5px]">
                                مخفی
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              setNavDraft({
                                id: item.id,
                                label: item.label,
                                href: item.href,
                                location: item.location,
                                sortOrder: item.sortOrder,
                                isActive: item.isActive,
                                isExternal: item.isExternal,
                                requiredPlanCode: item.requiredPlanCode ?? "",
                                requiredPermission: item.requiredPermission ?? "",
                              })
                            }
                            className="size-7 rounded-md p-0"
                          >
                            <Save className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleDeleteNavigation(item)}
                            className="size-7 rounded-md p-0 text-destructive"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="clay rounded-[26px] p-4 sm:p-5">
                <SectionTitle
                  icon={Plus}
                  title={navDraft.id ? "ویرایش آیتم منو" : "افزودن آیتم منو"}
                  description="لینک خارجی فقط با http یا https پذیرفته می‌شود."
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="عنوان">
                    <Input
                      value={navDraft.label}
                      onChange={(event) =>
                        setNavDraft({ ...navDraft, label: event.target.value })
                      }
                      className="clay-inset h-9 rounded-xl border-0 bg-transparent text-[10px]"
                    />
                  </Field>
                  <Field label="نشانی">
                    <Input
                      dir="ltr"
                      value={navDraft.href}
                      onChange={(event) =>
                        setNavDraft({ ...navDraft, href: event.target.value })
                      }
                      className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[9.5px]"
                    />
                  </Field>
                  <Field label="محل نمایش">
                    <Select
                      value={navDraft.location}
                      onValueChange={(value) =>
                        setNavDraft({
                          ...navDraft,
                          location: value as typeof navDraft.location,
                        })
                      }
                    >
                      <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="public">هدر عمومی</SelectItem>
                        <SelectItem value="footer">فوتر</SelectItem>
                        <SelectItem value="dashboard">داشبورد</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="ترتیب">
                    <Input
                      dir="ltr"
                      type="number"
                      value={navDraft.sortOrder}
                      onChange={(event) =>
                        setNavDraft({
                          ...navDraft,
                          sortOrder: Number(event.target.value) || 0,
                        })
                      }
                      className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10px]"
                    />
                  </Field>
                  <Field label="پلن مجاز (اختیاری)">
                    <Select
                      value={navDraft.requiredPlanCode || "all"}
                      onValueChange={(value) =>
                        setNavDraft({
                          ...navDraft,
                          requiredPlanCode: value === "all" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all">همه پلن‌ها</SelectItem>
                        {Object.entries(PLAN_LABELS).map(([code, label]) => (
                          <SelectItem key={code} value={code}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="دسترسی نقش (اختیاری)">
                    <Input
                      dir="ltr"
                      value={navDraft.requiredPermission}
                      onChange={(event) =>
                        setNavDraft({
                          ...navDraft,
                          requiredPermission: event.target.value,
                        })
                      }
                      placeholder="dashboard.view"
                      className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[9.5px]"
                    />
                  </Field>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <ToggleLine
                    label="نمایش داده شود"
                    checked={navDraft.isActive}
                    onChange={(value) => setNavDraft({ ...navDraft, isActive: value })}
                  />
                  <ToggleLine
                    label="لینک خارجی"
                    checked={navDraft.isExternal}
                    onChange={(value) =>
                      setNavDraft({ ...navDraft, isExternal: value })
                    }
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleSaveNavigation}
                    disabled={busy === "nav-save"}
                    className="clay-primary h-9 rounded-xl border-0 text-[9.5px] font-bold"
                  >
                    {busy === "nav-save" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    ذخیره منو
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setNavDraft({
                        id: null,
                        label: "",
                        href: "/",
                        location: "public",
                        sortOrder: 10,
                        isActive: true,
                        isExternal: false,
                        requiredPlanCode: "",
                        requiredPermission: "",
                      })
                    }
                    className="h-9 rounded-xl text-[9.5px]"
                  >
                    فرم خالی
                  </Button>
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="features" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <section className="clay rounded-[26px] p-4">
                <SectionTitle
                  icon={SlidersHorizontal}
                  title="قابلیت‌های سراسری"
                  description="خاموش‌کردن قابلیت در سمت سرور اعمال می‌شود؛ فقط دکمه مخفی نمی‌شود."
                />
                <div className="mt-3 space-y-2">
                  {overview.features.map((feature) => (
                    <button
                      key={feature.id}
                      type="button"
                      onClick={() => {
                        setSelectedFeatureId(feature.id);
                        setFeatureDraft(clone(feature));
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start",
                        selectedFeatureId === feature.id
                          ? "clay-sm text-primary"
                          : "bg-muted/35 hover:bg-muted/55",
                      )}
                    >
                      <span>
                        <span className="block text-[9.5px] font-bold">{feature.label}</span>
                        <span dir="ltr" className="text-[8px] text-muted-foreground">
                          {feature.key}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          feature.isEnabled ? "bg-emerald-500" : "bg-rose-500",
                        )}
                      />
                    </button>
                  ))}
                </div>
                <div className="mt-3 rounded-xl bg-muted/30 p-3 text-[9px] leading-5 text-muted-foreground">
                  مصرف هوش مصنوعی این ماه: {faNumber(overview.usage.aiRequests)}
                  <br />
                  {overview.usage.note}
                  <br />
                  سقف روزانه/ماهانه ایجنت از مصرف واقعی همان قابلیت اعمال می‌شود؛
                  سایر قابلیت‌ها با مجوز پلن و نقش کنترل می‌شوند.
                </div>
              </section>

              {featureDraft && selectedFeature && (
                <section className="clay rounded-[26px] p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <SectionTitle
                      icon={ShieldCheck}
                      title={featureDraft.label}
                      description={featureDraft.description}
                    />
                    <Switch
                      checked={featureDraft.isEnabled}
                      onCheckedChange={(value) =>
                        setFeatureDraft({ ...featureDraft, isEnabled: value })
                      }
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="پلن‌های مجاز">
                      <div className="flex flex-wrap gap-2 rounded-xl bg-muted/30 p-2.5">
                        {Object.entries(PLAN_LABELS).map(([code, label]) => (
                          <label key={code} className="flex items-center gap-1.5 text-[8.5px]">
                            <input
                              type="checkbox"
                              checked={featureDraft.allowedPlans.includes(code)}
                              onChange={(event) => {
                                const allowedPlans = event.target.checked
                                  ? [...featureDraft.allowedPlans, code]
                                  : featureDraft.allowedPlans.filter((item) => item !== code);
                                setFeatureDraft({ ...featureDraft, allowedPlans });
                              }}
                              className="size-3 rounded border-border"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </Field>
                    <Field label="نقش‌های مجاز">
                      <div className="flex flex-wrap gap-2 rounded-xl bg-muted/30 p-2.5">
                        {Object.entries(ROLE_LABELS).map(([code, label]) => (
                          <label key={code} className="flex items-center gap-1.5 text-[8.5px]">
                            <input
                              type="checkbox"
                              checked={featureDraft.allowedRoles.includes(code)}
                              onChange={(event) => {
                                const allowedRoles = event.target.checked
                                  ? [...featureDraft.allowedRoles, code]
                                  : featureDraft.allowedRoles.filter((item) => item !== code);
                                setFeatureDraft({ ...featureDraft, allowedRoles });
                              }}
                              className="size-3 rounded border-border"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </Field>
                    <Field label="سقف روزانه (۰ = بدون سقف)">
                      <Input
                        dir="ltr"
                        type="number"
                        min={0}
                        value={featureDraft.dailyLimit}
                        onChange={(event) =>
                          setFeatureDraft({
                            ...featureDraft,
                            dailyLimit: Number(event.target.value) || 0,
                          })
                        }
                        className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10px]"
                      />
                    </Field>
                    <Field label="سقف ماهانه (۰ = بدون سقف)">
                      <Input
                        dir="ltr"
                        type="number"
                        min={0}
                        value={featureDraft.monthlyLimit}
                        onChange={(event) =>
                          setFeatureDraft({
                            ...featureDraft,
                            monthlyLimit: Number(event.target.value) || 0,
                          })
                        }
                        className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10px]"
                      />
                    </Field>
                  </div>
                  <Button
                    type="button"
                    onClick={handleSaveFeature}
                    disabled={busy === "feature-save"}
                    className="clay-primary mt-3 h-9 rounded-xl border-0 text-[9.5px] font-bold"
                  >
                    {busy === "feature-save" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    ذخیره سیاست قابلیت
                  </Button>

                  <div className="mt-4 rounded-2xl bg-muted/30 p-3">
                    <p className="text-[9.5px] font-bold">محدودیت اختصاصی پلن</p>
                    <p className="mt-0.5 text-[8.5px] text-muted-foreground">
                      این مقدار جای پلن‌های مجاز همان قابلیت را می‌گیرد.
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-4">
                      <Select
                        value={planLimitForm.planCode}
                        onValueChange={(value) =>
                          setPlanLimitForm({ ...planLimitForm, planCode: value })
                        }
                      >
                        <SelectTrigger className="clay-inset h-8 w-full rounded-lg border-0 bg-transparent text-[9px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {Object.entries(PLAN_LABELS).map(([code, label]) => (
                            <SelectItem key={code} value={code}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        dir="ltr"
                        type="number"
                        min={0}
                        placeholder="روزانه"
                        value={planLimitForm.dailyLimit}
                        onChange={(event) =>
                          setPlanLimitForm({
                            ...planLimitForm,
                            dailyLimit: Number(event.target.value) || 0,
                          })
                        }
                        className="clay-inset h-8 rounded-lg border-0 bg-transparent text-left text-[9px]"
                      />
                      <Input
                        dir="ltr"
                        type="number"
                        min={0}
                        placeholder="ماهانه"
                        value={planLimitForm.monthlyLimit}
                        onChange={(event) =>
                          setPlanLimitForm({
                            ...planLimitForm,
                            monthlyLimit: Number(event.target.value) || 0,
                          })
                        }
                        className="clay-inset h-8 rounded-lg border-0 bg-transparent text-left text-[9px]"
                      />
                      <Button
                        type="button"
                        onClick={handleSavePlanLimit}
                        disabled={busy === "plan-limit-save"}
                        className="h-8 rounded-lg bg-primary/10 text-[8.5px] font-bold text-primary hover:bg-primary/15"
                      >
                        ذخیره
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Switch
                        checked={planLimitForm.isAllowed}
                        onCheckedChange={(value) =>
                          setPlanLimitForm({ ...planLimitForm, isAllowed: value })
                        }
                      />
                      <span className="text-[8.5px] text-muted-foreground">
                        دسترسی این پلن مجاز باشد
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {overview.planLimits
                        .filter((limit) => limit.featureKey === selectedFeature.key)
                        .map((limit) => (
                          <div
                            key={limit.id}
                            className="flex items-center justify-between rounded-lg bg-background/60 px-2 py-1.5 text-[8.5px]"
                          >
                            <span>{PLAN_LABELS[limit.planCode] ?? limit.planCode}</span>
                            <span className={limit.isAllowed ? "text-emerald-600" : "text-rose-600"}>
                              {limit.isAllowed ? "مجاز" : "غیرمجاز"}
                            </span>
                          </div>
                        ))}
                    </div>
                    {featureHistory && featureHistory.length > 0 && (
                      <div className="mt-3 border-t border-border/40 pt-2">
                        <p className="text-[8.5px] font-semibold text-muted-foreground">
                          تاریخچه تغییر سیاست
                        </p>
                        <div className="mt-1 space-y-1">
                          {featureHistory.slice(0, 4).map((version) => (
                            <div
                              key={version.id}
                              className="flex items-center justify-between gap-2 text-[8px] text-muted-foreground"
                            >
                              <span className="truncate">{version.label}</span>
                              <span className="shrink-0">{faDateLong(version.createdAt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="clay rounded-[26px] p-4 sm:p-5">
                <SectionTitle
                  icon={History}
                  title="تاریخچه ظاهر و صفحه اصلی"
                  description="هر انتشار یک نسخه جدید می‌سازد؛ بازیابی، نسخه را به پیش‌نویس برمی‌گرداند."
                />
                <div className="mt-3 space-y-2">
                  {settingsHistory?.length ? (
                    settingsHistory.map((version) => (
                      <div key={version.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/30 p-2.5">
                        <span className="min-w-0">
                          <span className="block truncate text-[9px] font-semibold">
                            {version.label}
                          </span>
                          <span className="text-[8px] text-muted-foreground">
                            {faDateLong(version.createdAt)}
                          </span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                                                        onClick={() => {
                                void run(
                                  "settings-restore",
                                  async () => {
                                    await restoreSettingsVersion({ versionId: version.id });
                                    setThemeDraft(null);
                                    setHomeDraft(null);
                                  },
                                  "نسخه در پیش‌نویس بازیابی شد؛ برای اعمال، انتشار را بزنید.",
                                );
                              }}
                          className="h-7 shrink-0 rounded-lg px-2 text-[8px]"
                        >
                          <Undo2 className="size-3" />
                          بازیابی
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl bg-muted/30 p-4 text-center text-[9px] text-muted-foreground">
                      هنوز نسخه‌ای منتشر نشده است.
                    </p>
                  )}
                </div>
              </section>
              <section className="clay rounded-[26px] p-4 sm:p-5">
                <SectionTitle
                  icon={LayoutTemplate}
                  title="نسخه‌ها و وضعیت انتشار"
                  description="تاریخچه عمومی همه نسخه‌های محتوایی سایت."
                />
                <div className="mt-3 space-y-2">
                  {overview.versions.map((version) => (
                    <div key={version.id} className="rounded-xl bg-muted/30 p-2.5">
                      <p className="truncate text-[9px] font-semibold">{version.label}</p>
                      <p className="mt-0.5 text-[8px] text-muted-foreground">
                        {faDateLong(version.createdAt)} · {version.entityType}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </TabsContent>
        </Tabs>

        {settingsDraft && (
          <div className="clay flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3">
            <p className="text-[9px] leading-5 text-muted-foreground">
              تغییرات ذخیره‌نشده روی سایت عمومی دیده نمی‌شوند. انتشار را فقط
              پس از بررسی پیش‌نمایش انجام دهید.
            </p>
            <div className="flex items-center gap-1.5 text-[8.5px]">
              <span className="size-2 rounded-full bg-amber-500" />
              پیش‌نویس جدا از نسخه عمومی
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function TabTrigger({
  value,
  icon: Icon,
  label,
}: {
  value: string;
  icon: typeof LayoutTemplate;
  label: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className="h-8 shrink-0 gap-1.5 rounded-xl px-2.5 text-[9px] data-[state=active]:clay-sm data-[state=active]:text-primary"
    >
      <Icon className="size-3.5" />
      {label}
    </TabsTrigger>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof LayoutTemplate;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div>
        <h2 className="text-[11.5px] font-extrabold">{title}</h2>
        <p className="mt-0.5 text-[8.5px] leading-4 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[9px]">{label}</Label>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
          aria-label={label}
        />
        <Input
          dir="ltr"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left font-mono text-[9px]"
        />
      </div>
    </Field>
  );
}

function ToggleLine({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[9px] text-muted-foreground">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}

function SettingsActions({
  busy,
  onSave,
  onPublish,
  onDiscard,
}: {
  busy: string | null;
  onSave: () => void;
  onPublish: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button
        type="button"
        onClick={onSave}
        disabled={busy === "settings-save"}
        variant="ghost"
        className="h-9 rounded-xl text-[9.5px]"
      >
        {busy === "settings-save" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Save className="size-3.5" />
        )}
        ذخیره پیش‌نویس
      </Button>
      <Button
        type="button"
        onClick={onPublish}
        disabled={busy === "settings-publish"}
        className="clay-primary h-9 rounded-xl border-0 text-[9.5px] font-bold"
      >
        {busy === "settings-publish" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Rocket className="size-3.5" />
        )}
        انتشار تغییرات
      </Button>
      <Button
        type="button"
        onClick={onDiscard}
        disabled={busy === "settings-discard"}
        variant="ghost"
        className="h-9 rounded-xl text-[9.5px] text-muted-foreground"
      >
        <Undo2 className="size-3.5" />
        کنار گذاشتن
      </Button>
    </div>
  );
}

function ThemePreview({ theme }: { theme: ThemeDraft }) {
  return (
    <section className="clay h-fit rounded-[26px] p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
          <Eye className="size-4" />
        </span>
        <div>
          <h2 className="text-[11.5px] font-extrabold">پیش‌نمایش زنده</h2>
          <p className="mt-0.5 text-[8.5px] text-muted-foreground">
            فقط پیش‌نویس؛ تغییری در سایت عمومی ایجاد نمی‌کند.
          </p>
        </div>
      </div>
      <div
        className="mt-4 overflow-hidden rounded-[22px] border p-4"
        style={{
          background: theme.backgroundColor,
          borderColor: theme.primaryColor,
          fontFamily:
            theme.fontFamily === "tahoma"
              ? "Tahoma, sans-serif"
              : theme.fontFamily === "system"
                ? "system-ui, sans-serif"
                : '"Vazirmatn", sans-serif',
          fontSize: `${theme.textScale}%`,
        }}
      >
        <div
          className="rounded-2xl p-4 text-white"
          style={{
            background: `linear-gradient(145deg, ${theme.buttonColor}, color-mix(in oklab, ${theme.buttonColor} 78%, #000))`,
            borderRadius: theme.cardRadius,
          }}
        >
          <p className="text-[9px] opacity-75">کافی‌نت‌یار</p>
          <p className="mt-1 text-[14px] font-extrabold">فضای کاری نرم کافی‌نت</p>
          <span
            className="mt-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[8px] font-bold"
            style={{ background: theme.buttonColor, color: theme.buttonTextColor }}
          >
            <Check className="size-3" />
            نمونه دکمه
          </span>
        </div>
        <div
          className="mt-3 bg-white/75 p-3 dark:bg-black/20"
          style={{ borderRadius: theme.cardRadius }}
        >
          <div className="flex items-center gap-2">
            <span
              className="grid size-7 place-items-center bg-emerald-100 text-emerald-700"
              style={{
                borderRadius:
                  theme.iconStyle === "circle"
                    ? 999
                    : theme.iconStyle === "square"
                      ? 6
                      : 10,
              }}
            >
              <Palette className="size-3.5" />
            </span>
            <p className="text-[9px] font-bold" style={{ color: theme.primaryColor }}>
              کارت نمونه
            </p>
          </div>
          <p className="mt-2 text-[8px] leading-4 text-slate-600">
            رنگ اصلی، ثانویه، گردی گوشه و فونت در این ناحیه دیده می‌شوند.
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[8px] text-muted-foreground">
        <span>رنگ اصلی: {theme.primaryColor}</span>
        <span>رنگ دکمه: {theme.buttonColor}</span>
        <span>گردی: {theme.cardRadius}px</span>
        <span>مقیاس: {theme.textScale}٪</span>
      </div>
    </section>
  );
}

function HomePreview({ home, theme }: { home: HomeDraft; theme: ThemeDraft }) {
  return (
    <section className="clay h-fit rounded-[26px] p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
          <Eye className="size-4" />
        </span>
        <div>
          <h2 className="text-[11.5px] font-extrabold">پیش‌نمایش صفحه اصلی</h2>
          <p className="mt-0.5 text-[8.5px] text-muted-foreground">
            متن‌ها و ترتیب بخش‌ها قبل از انتشار.
          </p>
        </div>
      </div>
      {home.announcementEnabled && home.announcementText.trim() && (
        <p className="mt-3 rounded-lg bg-primary/10 px-2 py-1.5 text-[8.5px] text-primary">
          {home.announcementText}
        </p>
      )}
      <div
        className="mt-3 rounded-[18px] p-4"
        style={{ background: theme.backgroundColor, borderRadius: theme.cardRadius }}
      >
        <Badge variant="secondary" className="rounded-full text-[7.5px]">
          {home.heroEyebrow}
        </Badge>
        <h3 className="mt-2 line-clamp-2 whitespace-pre-line text-[13px] font-black leading-6">
          {home.heroTitle}
        </h3>
        <p className="mt-1 line-clamp-3 text-[8px] leading-4 text-muted-foreground">
          {home.heroSubtitle}
        </p>
        <span
          className="mt-3 inline-flex rounded-lg px-2.5 py-1.5 text-[8px] font-bold"
          style={{ background: theme.buttonColor, color: theme.buttonTextColor }}
        >
          {home.primaryCtaLabel}
        </span>
        <div className="mt-3 space-y-1.5">
          {home.features.slice(0, 3).map((feature) => (
            <div
              key={feature.title}
              className="flex items-center justify-between rounded-lg bg-background/70 px-2 py-1.5"
              style={{ borderRadius: Math.max(6, theme.cardRadius - 8) }}
            >
              <span className="truncate text-[8px] font-semibold">{feature.title}</span>
              <span className={feature.active ? "text-emerald-600" : "text-muted-foreground"}>
                {feature.active ? "فعال" : "خاموش"}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {home.sectionOrder.map((key) => (
          <span key={key} className="rounded-full bg-muted/50 px-2 py-1 text-[7.5px]">
            {SECTION_LABELS[key] ?? key}
          </span>
        ))}
      </div>
    </section>
  );
}
