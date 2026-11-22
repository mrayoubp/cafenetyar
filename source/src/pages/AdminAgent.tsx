import { AdminShell } from "@/components/layout/AdminShell";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/backend/api";
import type { Id } from "@/backend/ids";
import { useSession } from "@/hooks/use-session";
import { errorMessage } from "@/lib/auth";
import {
  faDateLong,
  faDateTime,
  faNumber,
  faToman,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "@/backend/client";
import {
  Activity,
  Archive,
  BookOpen,
  Bot,
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderPlus,
  History,
  Paperclip,
  Upload,
  Library,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  useDeferredValue,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Navigate } from "react-router";
import { toast } from "sonner";

type Tab = "knowledge" | "rates" | "feedback";
type DocStatus = "draft" | "approved" | "archived";

type KnowledgeDoc = {
  id: Id<"knowledge_documents">;
  title: string;
  summary: string;
  categoryId: Id<"knowledge_categories">;
  categoryName: string;
  sourceName: string;
  sourceUrl: string | null;
  sourceId: Id<"price_sources"> | null;
  fileName: string | null;
  tags: string[];
  status: DocStatus;
  chunkCount: number;
  lastReviewedAt: number | null;
  updatedAt: number;
};
type KnowledgeCategory = {
  id: Id<"knowledge_categories">;
  name: string;
  description: string | null;
  tone: string;
  isActive: boolean;
  documentCount: number;
  approvedCount: number;
};
type SourceRow = {
  id: Id<"price_sources">;
  name: string;
  url: string | null;
  kind: "official" | "market" | "internal";
  description: string | null;
  isActive: boolean;
  usageCount: number;
};
type ServiceRow = {
  id: Id<"services">;
  name: string;
  description: string;
  unit: string;
  categoryId: Id<"service_categories">;
  categoryName: string;
  basePriceToman: number | null;
  priceType: "official" | "suggested" | "custom";
  priceStatus: "active" | "needs_review" | "inactive";
  source: SourceRow | null;
  validFrom: number | null;
  validUntil: number | null;
  isAddon: boolean;
  isActive: boolean;
  sortOrder: number;
  cafeOverrideCount: number;
  updatedAt: number;
};
type ServiceCategory = {
  id: Id<"service_categories">;
  name: string;
  description: string | null;
  tone: string;
  isActive: boolean;
  serviceCount: number;
};
type RateSuggestion = {
  id: Id<"rate_suggestions">;
  serviceName: string;
  unit: string;
  cafeName: string;
  proposedPriceToman: number;
  proposedPriceType: "official" | "suggested" | "custom";
  sourceName: string | null;
  note: string | null;
  createdAt: number;
};
type HistoryRow = {
  id: string;
  scope: "platform" | "cafe";
  serviceName: string;
  cafeName: string | null;
  oldPriceToman: number | null;
  newPriceToman: number | null;
  oldStatus: string | null;
  newStatus: string | null;
  sourceName: string | null;
  note: string | null;
  changedByName: string;
  changedAt: number;
};
type AgentPerformance = {
  total: number;
  success: number;
  fallback: number;
  errors: number;
  avgDurationMs: number;
  aiRequests: number;
  aiCostPerRequestToman: number;
  estimatedCostToman: number;
  aiEnabled: boolean;
  aiModel: string;
  routes: { route: string; count: number }[];
  recentErrors: {
    id: string;
    route: string;
    status: "fallback" | "error";
    question: string;
    errorMessage: string | null;
    durationMs: number;
    createdAt: number;
  }[];
};

type FeedbackRow = {
  id: string;
  rating: "helpful" | "not_helpful";
  note: string | null;
  answerExcerpt: string;
  userName: string;
  cafeName: string;
  createdAt: number;
};
type FaqRow = {
  question: string;
  count: number;
  lastAskedAt: number;
  cafeCount: number;
};

const TONES = [
  { value: "navy", label: "سرمه‌ای" },
  { value: "mint", label: "سبزآبی" },
  { value: "peach", label: "هلویی" },
  { value: "lilac", label: "بنفش" },
];
const TONE_CLASS: Record<string, string> = {
  navy: "tile-navy",
  mint: "tile-mint",
  peach: "tile-peach",
  lilac: "tile-lilac",
};

const DOC_STATUS: Record<DocStatus, string> = {
  draft: "پیش‌نویس",
  approved: "تأییدشده",
  archived: "بایگانی",
};
const AGENT_ROUTE_LABELS: Record<string, string> = {
  permission: "کنترل دسترسی",
  pricing: "نرخ‌نامه",
  "pricing-unmatched": "نرخ‌نامه بدون تطبیق",
  ai: "هوش مصنوعی",
};

const PRICE_TYPE: Record<string, string> = {
  official: "رسمی",
  suggested: "پیشنهادی",
  custom: "اختصاصی",
};

const EMPTY_DOC = {
  categoryId: "",
  title: "",
  summary: "",
  content: "",
  sourceId: "none",
  sourceName: "",
  sourceUrl: "",
  fileId: "",
  fileName: "",
  fileSize: 0,
  fileMimeType: "",
  tags: "",
  status: "draft" as DocStatus,
};
const EMPTY_SERVICE = {
  name: "",
  categoryId: "",
  description: "",
  unit: "",
  price: "",
  priceType: "suggested" as "official" | "suggested",
  priceStatus: "needs_review" as "active" | "needs_review" | "inactive",
  sourceId: "none",
  validFrom: "",
  validUntil: "",
  isAddon: false,
  isActive: true,
  sortOrder: 0,
};
const EMPTY_SOURCE = {
  name: "",
  url: "",
  kind: "official" as "official" | "market" | "internal",
  description: "",
  isActive: true,
};

function parseAmount(value: string) {
  const normalized = value.replace(/[۰-۹]/g, (digit) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)),
  );
  const number = Number(normalized.replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function toDateInput(ms: number | null | undefined) {
  if (!ms) return "";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateInput(value: string) {
  if (!value) return undefined;
  const ms = new Date(`${value}T12:00:00`).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

export default function AdminAgent() {
  const { context, isLoading } = useSession();
  const isAdmin = context?.isSiteAdmin === true;
  const [tab, setTab] = useState<Tab>("knowledge");

  const knowledgeOverview = useQuery(
    api.knowledgeAdmin.overview,
    isAdmin ? {} : "skip",
  );
  const ratesOverview = useQuery(
    api.ratesAdmin.overview,
    isAdmin ? {} : "skip",
  );
  const knowledgeCategoriesQuery = useQuery(
    api.knowledgeAdmin.categories,
    isAdmin ? {} : "skip",
  );
  const serviceCategoriesQuery = useQuery(
    api.ratesAdmin.categories,
    isAdmin ? {} : "skip",
  );
  const sourcesQuery = useQuery(
    api.ratesAdmin.sources,
    isAdmin ? {} : "skip",
  );

  const [docSearch, setDocSearch] = useState("");
  const deferredDocSearch = useDeferredValue(docSearch);
  const [docStatus, setDocStatus] = useState("all");
  const [docCategory, setDocCategory] = useState("all");
  const documentsQuery = useQuery(
    api.knowledgeAdmin.documents,
    isAdmin && tab === "knowledge"
      ? {
          search: deferredDocSearch || undefined,
          categoryId:
            docCategory === "all"
              ? undefined
              : (docCategory as Id<"knowledge_categories">),
          status: docStatus === "all" ? undefined : (docStatus as DocStatus),
        }
      : "skip",
  );
  const [editingDocId, setEditingDocId] =
    useState<Id<"knowledge_documents"> | null>(null);

  const [serviceSearch, setServiceSearch] = useState("");
  const deferredServiceSearch = useDeferredValue(serviceSearch);
  const [serviceStatus, setServiceStatus] = useState("all");
  const [serviceCategory, setServiceCategory] = useState("all");
  const servicesQuery = useQuery(
    api.ratesAdmin.listServices,
    isAdmin && tab === "rates"
      ? {
          search: deferredServiceSearch || undefined,
          categoryId:
            serviceCategory === "all"
              ? undefined
              : (serviceCategory as Id<"service_categories">),
          status: serviceStatus as
            | "all"
            | "active"
            | "inactive"
            | "priced"
            | "needs_review",
        }
      : "skip",
  );
  const rateSuggestionsQuery = useQuery(
    api.ratesAdmin.suggestions,
    isAdmin && tab === "rates" ? { status: "pending" } : "skip",
  );
  const rateHistoryQuery = useQuery(
    api.ratesAdmin.history,
    isAdmin && tab === "rates" ? {} : "skip",
  );
  const feedbackQuery = useQuery(
    api.knowledgeAdmin.feedback,
    isAdmin && tab === "feedback" ? {} : "skip",
  );
  const performanceQuery = useQuery(
    api.knowledgeAdmin.agentPerformance,
    isAdmin && tab === "feedback" ? {} : "skip",
  );
  const faqQuery = useQuery(
    api.knowledgeAdmin.frequentQuestions,
    isAdmin && tab === "feedback" ? {} : "skip",
  );

  const setDocumentStatus = useMutation(api.knowledgeAdmin.setDocumentStatus);
  const deleteDocument = useMutation(api.knowledgeAdmin.deleteDocument);
  const createKnowledgeCategory = useMutation(api.knowledgeAdmin.createCategory);
  const updateKnowledgeCategory = useMutation(api.knowledgeAdmin.updateCategory);
  const deleteKnowledgeCategory = useMutation(api.knowledgeAdmin.deleteCategory);
  const createService = useMutation(api.ratesAdmin.createService);
  const updateService = useMutation(api.ratesAdmin.updateService);
  const setServiceActive = useMutation(api.ratesAdmin.setServiceActive);
  const deleteService = useMutation(api.ratesAdmin.deleteService);
  const createServiceCategory = useMutation(api.ratesAdmin.createCategory);
  const updateServiceCategory = useMutation(api.ratesAdmin.updateCategory);
  const deleteServiceCategory = useMutation(api.ratesAdmin.deleteCategory);
  const createSource = useMutation(api.ratesAdmin.createSource);
  const updateSource = useMutation(api.ratesAdmin.updateSource);
  const deleteSource = useMutation(api.ratesAdmin.deleteSource);
  const approveRateSuggestion = useMutation(api.ratesAdmin.approveRateSuggestion);
  const rejectRateSuggestion = useMutation(api.ratesAdmin.rejectRateSuggestion);
  const restorePriceVersion = useMutation(api.ratesAdmin.restorePriceVersion);
  const seedAgentCatalog = useMutation(api.ratesAdmin.seedAgentCatalog);

  const knowledgeCategories = (knowledgeCategoriesQuery ?? []) as KnowledgeCategory[];
  const serviceCategories = (serviceCategoriesQuery ?? []) as ServiceCategory[];
  const sources = (sourcesQuery ?? []) as SourceRow[];
  const documents = (documentsQuery ?? []) as KnowledgeDoc[];
  const services = (servicesQuery ?? []) as ServiceRow[];
  const suggestions = (rateSuggestionsQuery ?? []) as RateSuggestion[];
  const history = (rateHistoryQuery ?? []) as HistoryRow[];
  const feedbackRows = (feedbackQuery ?? []) as FeedbackRow[];
  const performance = performanceQuery as AgentPerformance | undefined;
  const faqs = (faqQuery ?? []) as FaqRow[];

  const [docOpen, setDocOpen] = useState(false);

  const [knowledgeCategoryOpen, setKnowledgeCategoryOpen] = useState(false);
  const [editingKnowledgeCategory, setEditingKnowledgeCategory] =
    useState<KnowledgeCategory | null>(null);
  const [knowledgeCategoryForm, setKnowledgeCategoryForm] = useState({
    name: "",
    description: "",
    tone: "navy",
    isActive: true,
  });

  const [serviceOpen, setServiceOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceRow | null>(null);
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [savingService, setSavingService] = useState(false);

  const [serviceCategoryOpen, setServiceCategoryOpen] = useState(false);
  const [editingServiceCategory, setEditingServiceCategory] =
    useState<ServiceCategory | null>(null);
  const [serviceCategoryForm, setServiceCategoryForm] = useState({
    name: "",
    description: "",
    tone: "navy",
    isActive: true,
  });

  const [sourceOpen, setSourceOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<SourceRow | null>(null);
  const [sourceForm, setSourceForm] = useState(EMPTY_SOURCE);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const [confirm, setConfirm] = useState<{
    kind: "document" | "service" | "knowledgeCategory" | "serviceCategory" | "source";
    id: string;
    title: string;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingSmall, setSavingSmall] = useState(false);

  if (isLoading) {
    return (
      <AdminShell active="agent">
        <div className="clay flex min-h-40 items-center justify-center rounded-[28px]">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AdminShell>
    );
  }

  if (!isAdmin) return <Navigate to="/admin" replace />;

  const openNewDoc = () => {
    setEditingDocId(null);
    setDocOpen(true);
  };

  const openEditDoc = (doc: KnowledgeDoc) => {
    setEditingDocId(doc.id);
    setDocOpen(true);
  };

  const openNewService = () => {
    setEditingService(null);
    setServiceForm({
      ...EMPTY_SERVICE,
      categoryId: serviceCategories[0]?.id ?? "",
      sortOrder: services.length,
    });
    setServiceError(null);
    setServiceOpen(true);
  };

  const openEditService = (service: ServiceRow) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      categoryId: service.categoryId,
      description: service.description,
      unit: service.unit,
      price: service.basePriceToman === null ? "" : String(service.basePriceToman),
      priceType: service.priceType === "custom" ? "suggested" : service.priceType,
      priceStatus: service.priceStatus,
      sourceId: service.source?.id ?? "none",
      validFrom: toDateInput(service.validFrom),
      validUntil: toDateInput(service.validUntil),
      isAddon: service.isAddon,
      isActive: service.isActive,
      sortOrder: service.sortOrder,
    });
    setServiceError(null);
    setServiceOpen(true);
  };

  const submitService = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!serviceForm.categoryId) {
      setServiceError("دسته‌بندی خدمت را انتخاب کنید.");
      return;
    }
    setSavingService(true);
    setServiceError(null);
    try {
      const payload = {
        name: serviceForm.name,
        categoryId: serviceForm.categoryId as Id<"service_categories">,
        description: serviceForm.description,
        unit: serviceForm.unit,
        basePriceToman:
          serviceForm.price.trim() === ""
            ? undefined
            : parseAmount(serviceForm.price),
        priceType: serviceForm.priceType,
        priceStatus: serviceForm.priceStatus,
        sourceId:
          serviceForm.sourceId === "none"
            ? undefined
            : (serviceForm.sourceId as Id<"price_sources">),
        validFrom: fromDateInput(serviceForm.validFrom),
        validUntil: fromDateInput(serviceForm.validUntil),
        isAddon: serviceForm.isAddon,
        isActive: serviceForm.isActive,
        sortOrder: serviceForm.sortOrder,
      };
      if (editingService) {
        await updateService({ ...payload, serviceId: editingService.id });
      } else {
        await createService(payload);
      }
      setServiceOpen(false);
      toast.success("خدمت و نرخ پایه ذخیره شد.");
    } catch (error) {
      setServiceError(errorMessage(error, "ذخیره خدمت ممکن نشد."));
    } finally {
      setSavingService(false);
    }
  };

  const saveKnowledgeCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingSmall(true);
    try {
      if (editingKnowledgeCategory) {
        await updateKnowledgeCategory({
          categoryId: editingKnowledgeCategory.id,
          name: knowledgeCategoryForm.name,
          description: knowledgeCategoryForm.description || undefined,
          icon: "book",
          tone: knowledgeCategoryForm.tone,
          isActive: knowledgeCategoryForm.isActive,
        });
      } else {
        await createKnowledgeCategory({
          name: knowledgeCategoryForm.name,
          description: knowledgeCategoryForm.description || undefined,
          icon: "book",
          tone: knowledgeCategoryForm.tone,
        });
      }
      setKnowledgeCategoryOpen(false);
      toast.success("دسته دانش ذخیره شد.");
    } catch (error) {
      toast.error(errorMessage(error, "ذخیره دسته دانش ممکن نشد."));
    } finally {
      setSavingSmall(false);
    }
  };

  const saveServiceCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingSmall(true);
    try {
      if (editingServiceCategory) {
        await updateServiceCategory({
          categoryId: editingServiceCategory.id,
          name: serviceCategoryForm.name,
          description: serviceCategoryForm.description || undefined,
          icon: "receipt",
          tone: serviceCategoryForm.tone,
          isActive: serviceCategoryForm.isActive,
        });
      } else {
        await createServiceCategory({
          name: serviceCategoryForm.name,
          description: serviceCategoryForm.description || undefined,
          icon: "receipt",
          tone: serviceCategoryForm.tone,
        });
      }
      setServiceCategoryOpen(false);
      toast.success("دسته خدمت ذخیره شد.");
    } catch (error) {
      toast.error(errorMessage(error, "ذخیره دسته خدمت ممکن نشد."));
    } finally {
      setSavingSmall(false);
    }
  };

  const saveSource = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingSmall(true);
    setSourceError(null);
    try {
      if (editingSource) {
        await updateSource({
          sourceId: editingSource.id,
          name: sourceForm.name,
          url: sourceForm.url || undefined,
          kind: sourceForm.kind,
          description: sourceForm.description || undefined,
          isActive: sourceForm.isActive,
        });
      } else {
        await createSource({
          name: sourceForm.name,
          url: sourceForm.url || undefined,
          kind: sourceForm.kind,
          description: sourceForm.description || undefined,
        });
      }
      setSourceOpen(false);
      toast.success("منبع رسمی ذخیره شد.");
    } catch (error) {
      setSourceError(errorMessage(error, "ذخیره منبع ممکن نشد."));
    } finally {
      setSavingSmall(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.kind === "document") {
        await deleteDocument({
          documentId: confirm.id as Id<"knowledge_documents">,
        });
      } else if (confirm.kind === "service") {
        await deleteService({ serviceId: confirm.id as Id<"services"> });
      } else if (confirm.kind === "knowledgeCategory") {
        await deleteKnowledgeCategory({
          categoryId: confirm.id as Id<"knowledge_categories">,
        });
      } else if (confirm.kind === "serviceCategory") {
        await deleteServiceCategory({
          categoryId: confirm.id as Id<"service_categories">,
        });
      } else {
        await deleteSource({ sourceId: confirm.id as Id<"price_sources"> });
      }
      const archived =
        confirm.kind === "document" || confirm.kind === "service";
      setConfirm(null);
      toast.success(
        archived
          ? "با موفقیت بایگانی شد و از فهرست فعال خارج شد."
          : "با موفقیت حذف شد.",
      );
    } catch (error) {
      toast.error(errorMessage(error, "حذف ممکن نشد."));
    }
  };

  const handleSeed = async () => {
    setBusyId("seed");
    try {
      const result = await seedAgentCatalog();
      toast.success(
        `${faNumber(result.servicesCreated)} خدمت و ${faNumber(
          result.knowledgeCategories,
        )} دسته دانش اضافه شد.`,
      );
    } catch (error) {
      toast.error(errorMessage(error, "درج فهرست پایه ممکن نشد."));
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { key: Tab; label: string; icon: typeof BookOpen }[] = [
    { key: "knowledge", label: "پایگاه دانش", icon: Library },
    { key: "rates", label: "نرخ‌نامه پایه", icon: ReceiptText },
    { key: "feedback", label: "پرسش‌ها و بازخورد", icon: Bot },
  ];

  return (
    <AdminShell active="agent">
      <div className="space-y-5">
        <section className="clay relative overflow-hidden rounded-[30px] p-5 sm:p-6">
          <div className="pointer-events-none absolute -end-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="clay-inset inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] text-muted-foreground">
                <Bot className="size-3.5" />
                مرکز کنترل ایجنت هوشمند
              </span>
              <h1 className="mt-3 text-xl font-extrabold sm:text-2xl">
                دانش، نرخ‌نامه و بازخورد
              </h1>
              <p className="mt-2 max-w-2xl text-[11.5px] leading-6 text-muted-foreground">
                اسناد تأییدشده، منابع رسمی، نرخ پایه خدمات و بازخورد کاربران را
                مدیریت کنید. ایجنت فقط از محتوای تأییدشده و نرخ‌های معتبر استفاده
                می‌کند.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSeed}
                disabled={busyId === "seed"}
                className="h-10 rounded-xl text-[11px] font-semibold"
              >
                {busyId === "seed" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                درج دسته‌ها و خدمات پایه
              </Button>
              <Button
                type="button"
                onClick={tab === "knowledge" ? openNewDoc : openNewService}
                className="clay-primary h-10 rounded-xl border-0 text-[11px] font-bold hover:brightness-105"
              >
                <Plus className="size-4" />
                {tab === "knowledge" ? "سند جدید" : "خدمت جدید"}
              </Button>
            </div>
          </div>
          <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-6">
            <Stat label="اسناد تأییدشده" value={knowledgeOverview?.documents.approved ?? 0} />
            <Stat label="کل اسناد" value={knowledgeOverview?.documents.total ?? 0} />
            <Stat label="چانک جستجو" value={knowledgeOverview?.chunks ?? 0} />
            <Stat label="خدمات" value={ratesOverview?.services.total ?? 0} />
            <Stat label="نرخ پایه معتبر" value={ratesOverview?.services.priced ?? 0} />
            <Stat label="پیشنهاد نرخ" value={ratesOverview?.pendingSuggestions ?? 0} />
          </div>
        </section>

        <div className="flex flex-wrap gap-1.5">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors",
                  tab === item.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "knowledge" && (
          <div className="space-y-4">
            <section className="clay rounded-[28px] p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={docSearch}
                    onChange={(event) => setDocSearch(event.target.value)}
                    placeholder="جستجو در عنوان، متن و برچسب اسناد…"
                    className="h-10 ps-9"
                  />
                </div>
                <Select value={docCategory} onValueChange={setDocCategory}>
                  <SelectTrigger className="h-10 w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">همه دسته‌ها</SelectItem>
                    {knowledgeCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={docStatus} onValueChange={setDocStatus}>
                  <SelectTrigger className="h-10 w-full sm:w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                    <SelectItem value="approved">تأییدشده</SelectItem>
                    <SelectItem value="draft">پیش‌نویس</SelectItem>
                    <SelectItem value="archived">بایگانی</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-4 space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="clay-inset rounded-[20px] p-3.5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <FileText className="size-4 text-primary" />
                          <p className="text-[12px] font-extrabold">{doc.title}</p>
                          <Badge variant="secondary" className="rounded-full text-[8.5px]">
                            {doc.categoryName}
                          </Badge>
                          <span className={cn(
                            "rounded-full px-1.5 py-0.5 text-[8.5px] font-bold",
                            doc.status === "approved" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                            doc.status === "draft" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                            doc.status === "archived" && "bg-muted text-muted-foreground",
                          )}>
                            {DOC_STATUS[doc.status]}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-muted-foreground">{doc.summary}</p>
                        <p className="mt-1 text-[9px] text-muted-foreground/80">
                          منبع: {doc.sourceName} · {faNumber(doc.chunkCount)} چانک · {faDateTime(doc.updatedAt)}
                          {doc.lastReviewedAt ? ` · آخرین بررسی ${faDateLong(doc.lastReviewedAt)}` : ""}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {doc.fileName && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] text-primary">
                              <Paperclip className="size-2.5" />
                              {doc.fileName}
                            </span>
                          )}
                          {doc.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-muted px-1.5 py-0.5 text-[8px] text-muted-foreground">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1">
                        {doc.status !== "approved" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await setDocumentStatus({ documentId: doc.id, status: "approved" });
                                toast.success("سند تأیید شد.");
                              } catch (error) {
                                toast.error(errorMessage(error, "تأیید سند ممکن نشد."));
                              }
                            }}
                            className="h-8 rounded-lg text-[9.5px]"
                          >
                            <CheckCircle2 className="size-3" />
                            تأیید
                          </Button>
                        )}
                        <Button type="button" size="icon" variant="ghost" onClick={() => openEditDoc(doc)} className="size-8 rounded-lg" aria-label="ویرایش سند">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" onClick={() => setConfirm({ kind: "document", id: doc.id, title: doc.title })} className="size-8 rounded-lg text-muted-foreground" aria-label="بایگانی سند">
                          <Archive className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {documentsQuery && documents.length === 0 && <Empty text="سندی با این فیلتر پیدا نشد." />}
              </div>
            </section>

            <section className="clay rounded-[28px] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold">دسته‌بندی دانش</h2>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">دسته‌های فعال برای سازمان‌دهی اسناد ایجنت.</p>
                </div>
                <Button type="button" size="sm" onClick={() => { setEditingKnowledgeCategory(null); setKnowledgeCategoryForm({ name: "", description: "", tone: "navy", isActive: true }); setKnowledgeCategoryOpen(true); }} className="h-8 rounded-lg text-[10px]">
                  <FolderPlus className="size-3" />
                  دسته جدید
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {knowledgeCategories.map((category) => (
                  <div key={category.id} className="flex items-center gap-1 rounded-xl bg-muted/50 p-1.5">
                    <span className={cn(TONE_CLASS[category.tone] ?? "tile-navy", "grid size-6 place-items-center rounded-lg")}>
                      <BookOpen className="size-3" />
                    </span>
                    <span className="text-[10px] font-semibold">{category.name}</span>
                    <span className="text-[8.5px] text-muted-foreground">({faNumber(category.approvedCount)}/{faNumber(category.documentCount)})</span>
                    <button type="button" aria-label="ویرایش دسته" onClick={() => { setEditingKnowledgeCategory(category); setKnowledgeCategoryForm({ name: category.name, description: category.description ?? "", tone: category.tone, isActive: category.isActive }); setKnowledgeCategoryOpen(true); }} className="grid size-5 place-items-center rounded-md text-muted-foreground hover:text-primary">
                      <Pencil className="size-2.5" />
                    </button>
                    <button type="button" aria-label="حذف دسته" onClick={() => setConfirm({ kind: "knowledgeCategory", id: category.id, title: category.name })} className="grid size-5 place-items-center rounded-md text-muted-foreground hover:text-destructive">
                      <XCircle className="size-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <SourcesSection
              sources={sources}
              onNew={() => { setEditingSource(null); setSourceForm(EMPTY_SOURCE); setSourceError(null); setSourceOpen(true); }}
              onEdit={(source) => { setEditingSource(source); setSourceForm({ name: source.name, url: source.url ?? "", kind: source.kind, description: source.description ?? "", isActive: source.isActive }); setSourceError(null); setSourceOpen(true); }}
              onDelete={(source) => setConfirm({ kind: "source", id: source.id, title: source.name })}
            />
          </div>
        )}

        {tab === "rates" && (
          <div className="space-y-4">
            {suggestions.length > 0 && (
              <section className="clay rounded-[28px] p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <Send className="size-4 text-primary" />
                  <h2 className="text-sm font-extrabold">نرخ‌های پیشنهادی در انتظار</h2>
                  <Badge variant="secondary" className="rounded-full text-[9px]">{faNumber(suggestions.length)}</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {suggestions.map((suggestion) => (
                    <div key={suggestion.id} className="clay-inset flex flex-col gap-2 rounded-[18px] p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold">{suggestion.serviceName} <span className="text-muted-foreground">· {faToman(suggestion.proposedPriceToman)} / {suggestion.unit}</span></p>
                        <p className="mt-1 text-[9px] text-muted-foreground">از {suggestion.cafeName} · {PRICE_TYPE[suggestion.proposedPriceType]} {suggestion.sourceName ? `· منبع: ${suggestion.sourceName}` : ""}</p>
                        {suggestion.note && <p className="mt-1 text-[9px] text-muted-foreground">{suggestion.note}</p>}
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button type="button" size="sm" onClick={async () => { setBusyId(suggestion.id); try { await approveRateSuggestion({ suggestionId: suggestion.id }); toast.success("نرخ پیشنهادی به نرخ پایه تبدیل شد."); } catch (error) { toast.error(errorMessage(error, "تأیید نرخ ممکن نشد.")); } finally { setBusyId(null); } }} disabled={busyId === suggestion.id} className="h-8 rounded-lg text-[9.5px]">
                          <CheckCircle2 className="size-3" />
                          تأیید
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={async () => { setBusyId(suggestion.id); try { await rejectRateSuggestion({ suggestionId: suggestion.id }); toast.success("نرخ پیشنهادی رد شد."); } catch (error) { toast.error(errorMessage(error, "رد نرخ ممکن نشد.")); } finally { setBusyId(null); } }} disabled={busyId === suggestion.id} className="h-8 rounded-lg text-[9.5px] text-destructive">
                          <XCircle className="size-3" />
                          رد
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="clay rounded-[28px] p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder="جستجوی خدمت…" className="h-10 ps-9" />
                </div>
                <Select value={serviceCategory} onValueChange={setServiceCategory}>
                  <SelectTrigger className="h-10 w-full sm:w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">همه دسته‌ها</SelectItem>
                    {serviceCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={serviceStatus} onValueChange={setServiceStatus}>
                  <SelectTrigger className="h-10 w-full sm:w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">همه</SelectItem>
                    <SelectItem value="active">فعال</SelectItem>
                    <SelectItem value="needs_review">نیازمند بررسی</SelectItem>
                    <SelectItem value="priced">دارای نرخ</SelectItem>
                    <SelectItem value="inactive">غیرفعال</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button type="button" size="sm" variant="outline" onClick={() => { setEditingServiceCategory(null); setServiceCategoryForm({ name: "", description: "", tone: "navy", isActive: true }); setServiceCategoryOpen(true); }} className="h-8 rounded-lg text-[9.5px]"><FolderPlus className="size-3" />دسته خدمت</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setEditingSource(null); setSourceForm(EMPTY_SOURCE); setSourceError(null); setSourceOpen(true); }} className="h-8 rounded-lg text-[9.5px]"><FileText className="size-3" />منبع رسمی</Button>
              </div>
              <div className="mt-3 space-y-2">
                {services.map((service) => (
                  <div key={service.id} className="clay-inset rounded-[20px] p-3.5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[12px] font-extrabold">{service.name}</p>
                          <Badge variant="secondary" className="rounded-full text-[8.5px]">{service.categoryName}</Badge>
                          {service.isAddon && <Badge variant="outline" className="rounded-full text-[8.5px]">جانبی</Badge>}
                          <span className={cn("rounded-full px-1.5 py-0.5 text-[8.5px] font-bold", service.isActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>{service.isActive ? "فعال" : "غیرفعال"}</span>
                          {service.priceStatus !== "active" && <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-700 dark:text-amber-300">نیازمند بررسی</span>}
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">{service.description}</p>
                        <p className="mt-1 text-[9px] text-muted-foreground/80">
                          واحد: {service.unit} · {service.basePriceToman !== null ? `${faToman(service.basePriceToman)} (${PRICE_TYPE[service.priceType]})` : "بدون نرخ پایه"} · {faNumber(service.cafeOverrideCount)} نرخ اختصاصی
                          {service.source ? ` · منبع: ${service.source.name}` : ""}
                          {service.validUntil ? ` · تا ${faDateLong(service.validUntil)}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1">
                        <Button type="button" size="icon" variant="ghost" onClick={() => openEditService(service)} className="size-8 rounded-lg" aria-label="ویرایش خدمت"><Pencil className="size-3.5" /></Button>
                        <Button type="button" size="icon" variant="ghost" onClick={async () => { try { await setServiceActive({ serviceId: service.id, isActive: !service.isActive }); toast.success("وضعیت خدمت تغییر کرد."); } catch (error) { toast.error(errorMessage(error, "تغییر وضعیت ممکن نشد.")); } }} className="size-8 rounded-lg" aria-label="تغییر وضعیت"><CheckCircle2 className="size-3.5" /></Button>
                        <Button type="button" size="icon" variant="ghost" onClick={() => setConfirm({ kind: "service", id: service.id, title: service.name })} className="size-8 rounded-lg text-muted-foreground" aria-label="غیرفعال‌سازی خدمت"><Archive className="size-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
                {servicesQuery && services.length === 0 && <Empty text="خدمتی با این فیلتر پیدا نشد." />}
              </div>
            </section>

            <section className="clay rounded-[28px] p-4 sm:p-5">
              <div className="flex items-center gap-2"><History className="size-4 text-primary" /><h2 className="text-sm font-extrabold">آخرین تغییرات نرخ</h2></div>
              <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto pe-1">
                {history.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center gap-1.5 rounded-xl bg-muted/40 px-2.5 py-2 text-[9.5px]">
                    <span className="font-semibold">{row.serviceName}</span>
                    <span className="text-muted-foreground">{row.scope === "platform" ? "پایه" : row.cafeName ?? "کافی‌نت"}</span>
                    <span>{row.oldPriceToman !== null ? faToman(row.oldPriceToman) : "—"} ← {row.newPriceToman !== null ? faToman(row.newPriceToman) : "حذف"}</span>
                    {row.scope === "platform" &&
                      (row.oldPriceToman !== null || row.oldStatus !== null) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 rounded-md px-1.5 text-[8.5px] text-primary"
                          onClick={async () => {
                            try {
                              await restorePriceVersion({
                                historyId: row.id as Id<"price_history">,
                              });
                              toast.success("نرخ پایه از تاریخچه بازگردانی شد.");
                            } catch (error) {
                              toast.error(
                                errorMessage(error, "بازگردانی نرخ ممکن نشد."),
                              );
                            }
                          }}
                        >
                          بازگردانی
                        </Button>
                      )}
                    <span className="ms-auto text-muted-foreground">{row.changedByName} · {faDateTime(row.changedAt)}</span>
                  </div>
                ))}
                {history.length === 0 && <Empty text="تغییری ثبت نشده است." />}
              </div>
            </section>

            <SourcesSection
              sources={sources}
              onNew={() => { setEditingSource(null); setSourceForm(EMPTY_SOURCE); setSourceError(null); setSourceOpen(true); }}
              onEdit={(source) => { setEditingSource(source); setSourceForm({ name: source.name, url: source.url ?? "", kind: source.kind, description: source.description ?? "", isActive: source.isActive }); setSourceError(null); setSourceOpen(true); }}
              onDelete={(source) => setConfirm({ kind: "source", id: source.id, title: source.name })}
            />
          </div>
        )}

        {tab === "feedback" && (
          <div className="space-y-4">
            <section className="clay rounded-[28px] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-primary" />
                <h2 className="text-sm font-extrabold">سلامت و عملکرد دستیار</h2>
                <span className="ms-auto text-[9px] text-muted-foreground">
                  آخرین {faNumber(performance?.total ?? 0)} درخواست
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="clay-inset rounded-xl p-2.5">
                  <p className="text-base font-extrabold">{faNumber(performance?.aiRequests ?? 0)}</p>
                  <p className="mt-0.5 text-[8.5px] text-muted-foreground">مصرف کل سهمیه هوش مصنوعی</p>
                </div>
                <div className="clay-inset rounded-xl p-2.5">
                  <p className="text-base font-extrabold">
                    {performance?.aiCostPerRequestToman
                      ? faToman(performance.estimatedCostToman)
                      : "تنظیم نشده"}
                  </p>
                  <p className="mt-0.5 text-[8.5px] text-muted-foreground">هزینه تقریبی بر اساس نرخ تنظیمات</p>
                </div>
                <div className="clay-inset rounded-xl p-2.5">
                  <p className="truncate text-[10px] font-extrabold" dir="ltr">{performance?.aiModel ?? "—"}</p>
                  <p className="mt-1 text-[8.5px] text-muted-foreground">
                    {performance?.aiEnabled ? "سرویس فعال" : "سرویس غیرفعال"} · تنظیمات از پنل سامانه
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["موفق", performance?.success ?? 0, "text-emerald-700 dark:text-emerald-300"],
                  ["پاسخ جایگزین", performance?.fallback ?? 0, "text-amber-700 dark:text-amber-300"],
                  ["خطا", performance?.errors ?? 0, "text-destructive"],
                  ["میانگین زمان (ms)", performance?.avgDurationMs ?? 0, "text-foreground"],
                ].map(([label, value, tone]) => (
                  <div key={String(label)} className="clay-inset rounded-xl p-2.5">
                    <p className={`text-base font-extrabold ${tone}`}>
                      {faNumber(Number(value))}
                    </p>
                    <p className="mt-0.5 text-[8.5px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              {(performance?.routes.length ?? 0) > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {performance?.routes.map((row) => (
                    <span key={row.route} className="rounded-full bg-muted/60 px-2 py-1 text-[8.5px] text-muted-foreground">
                      {AGENT_ROUTE_LABELS[row.route] ?? row.route}: {faNumber(row.count)}
                    </span>
                  ))}
                </div>
              )}
              {performance && performance.recentErrors.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-bold text-muted-foreground">آخرین خطاها و پاسخ‌های جایگزین</p>
                  {performance.recentErrors.map((row) => (
                    <div key={row.id} className="rounded-xl bg-muted/40 p-2.5 text-[9px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={cn("rounded-full px-1.5 py-0.5 font-bold", row.status === "error" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700 dark:text-amber-300")}>
                          {row.status === "error" ? "خطا" : "جایگزین"}
                        </span>
                        <span className="text-muted-foreground">{AGENT_ROUTE_LABELS[row.route] ?? row.route}</span>
                        <span className="ms-auto text-muted-foreground">{faNumber(row.durationMs)}ms · {faDateTime(row.createdAt)}</span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-[10px]">{row.question}</p>
                      {row.errorMessage && (
                        <p className="mt-0.5 text-[8.5px] text-destructive/90" dir="ltr">
                          {row.errorMessage}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-muted/40 p-2.5 text-[9px] text-muted-foreground">
                  خطای ثبت‌شده‌ای وجود ندارد. اگر اتصال هوش مصنوعی برقرار نباشد، همین‌جا نمایش داده می‌شود.
                </p>
              )}
            </section>

            <section className="clay rounded-[28px] p-4 sm:p-5">
              <div className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /><h2 className="text-sm font-extrabold">پرسش‌های پرتکرار</h2></div>
              <p className="mt-1 text-[10px] text-muted-foreground">بر اساس پیام‌های کاربران در همه کافی‌نت‌ها؛ بدون نمایش اطلاعات هویتی.</p>
              <div className="mt-3 space-y-2">
                {faqs.map((faq) => (
                  <div key={`${faq.question}-${faq.lastAskedAt}`} className="flex flex-col gap-1 rounded-xl bg-muted/40 p-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[10.5px] leading-5">{faq.question}</p>
                    <span className="shrink-0 text-[9px] text-muted-foreground">{faNumber(faq.count)} بار · {faNumber(faq.cafeCount)} کافی‌نت</span>
                  </div>
                ))}
                {faqs.length === 0 && <Empty text="هنوز پرسشی ثبت نشده است." />}
              </div>
            </section>

            <section className="clay rounded-[28px] p-4 sm:p-5">
              <div className="flex items-center gap-2"><Bot className="size-4 text-primary" /><h2 className="text-sm font-extrabold">بازخورد پاسخ‌ها</h2></div>
              <div className="mt-3 space-y-2">
                {feedbackRows.map((row) => (
                  <div key={row.id} className="rounded-xl bg-muted/40 p-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.rating === "helpful" ? <ThumbsUp className="size-3.5 text-emerald-600" /> : <ThumbsDown className="size-3.5 text-destructive" />}
                      <span className="text-[9.5px] font-semibold">{row.rating === "helpful" ? "مفید" : "مفید نبود"}</span>
                      <span className="text-[9px] text-muted-foreground">{row.userName} · {row.cafeName} · {faDateTime(row.createdAt)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[9.5px] leading-5 text-muted-foreground">{row.answerExcerpt}</p>
                    {row.note && <p className="mt-1 text-[9px] text-foreground/80">یادداشت: {row.note}</p>}
                  </div>
                ))}
                {feedbackQuery && feedbackRows.length === 0 && <Empty text="هنوز بازخوردی ثبت نشده است." />}
              </div>
            </section>
          </div>
        )}
      </div>

      <DocumentDialog
        key={editingDocId ?? "new-document"}
        open={docOpen}
        documentId={editingDocId}
        initial={documents.find((doc) => doc.id === editingDocId) ?? null}
        categories={knowledgeCategories}
        sources={sources}
        onClose={() => {
          setDocOpen(false);
          setEditingDocId(null);
        }}
      />

      <Dialog open={serviceOpen} onOpenChange={setServiceOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[28px] sm:max-w-2xl">
          <DialogHeader><DialogTitle className="text-base font-extrabold">{editingService ? "ویرایش خدمت" : "خدمت جدید"}</DialogTitle><DialogDescription className="text-[11px] leading-6">نرخ پایه پلتفرم را ثبت کنید. نرخ اختصاصی هر کافی‌نت در پنل همان کافی‌نت تنظیم می‌شود.</DialogDescription></DialogHeader>
          <form onSubmit={submitService} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="نام خدمت"><Input value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} required minLength={2} maxLength={140} /></Field>
              <Field label="دسته‌بندی"><Select value={serviceForm.categoryId} onValueChange={(value) => setServiceForm({ ...serviceForm, categoryId: value })}><SelectTrigger className="w-full"><SelectValue placeholder="انتخاب دسته" /></SelectTrigger><SelectContent>{serviceCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></Field>
            </div>
            <Field label="توضیحات"><Textarea value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} rows={2} required minLength={5} maxLength={500} /></Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="واحد محاسبه"><Input value={serviceForm.unit} onChange={(event) => setServiceForm({ ...serviceForm, unit: event.target.value })} placeholder="صفحه، نفر، پرونده…" required maxLength={30} /></Field>
              <Field label="قیمت پایه (تومان)"><Input value={serviceForm.price} onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })} inputMode="numeric" dir="ltr" className="text-left" placeholder="خالی = بدون نرخ" /></Field>
              <Field label="ترتیب"><Input type="number" min={0} value={serviceForm.sortOrder} onChange={(event) => setServiceForm({ ...serviceForm, sortOrder: Number(event.target.value) || 0 })} dir="ltr" className="text-left" /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="نوع نرخ"><Select value={serviceForm.priceType} onValueChange={(value) => setServiceForm({ ...serviceForm, priceType: value as "official" | "suggested" })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="official">رسمی</SelectItem><SelectItem value="suggested">پیشنهادی</SelectItem></SelectContent></Select></Field>
              <Field label="وضعیت نرخ"><Select value={serviceForm.priceStatus} onValueChange={(value) => setServiceForm({ ...serviceForm, priceStatus: value as "active" | "needs_review" | "inactive" })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">فعال</SelectItem><SelectItem value="needs_review">نیازمند بررسی</SelectItem><SelectItem value="inactive">غیرفعال</SelectItem></SelectContent></Select></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="منبع قیمت"><Select value={serviceForm.sourceId} onValueChange={(value) => setServiceForm({ ...serviceForm, sourceId: value })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">بدون منبع</SelectItem>{sources.map((source) => <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>)}</SelectContent></Select></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="شروع اعتبار"><Input type="date" value={serviceForm.validFrom} onChange={(event) => setServiceForm({ ...serviceForm, validFrom: event.target.value })} dir="ltr" className="text-left" /></Field>
                <Field label="پایان اعتبار"><Input type="date" value={serviceForm.validUntil} onChange={(event) => setServiceForm({ ...serviceForm, validUntil: event.target.value })} dir="ltr" className="text-left" /></Field>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 text-[10.5px] font-semibold">خدمت جانبی<Switch checked={serviceForm.isAddon} onCheckedChange={(checked) => setServiceForm({ ...serviceForm, isAddon: checked })} /></label>
              <label className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 text-[10.5px] font-semibold">خدمت فعال<Switch checked={serviceForm.isActive} onCheckedChange={(checked) => setServiceForm({ ...serviceForm, isActive: checked })} /></label>
            </div>
            {serviceForm.priceStatus === "active" && serviceForm.price.trim() === "" && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-[10px] text-amber-700 dark:text-amber-300">برای نرخ فعال، مبلغ قیمت را وارد کنید.</p>}
            {serviceError && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[10.5px] leading-5 text-destructive">{serviceError}</p>}
            <Button type="submit" disabled={savingService} className="clay-primary h-10 w-full rounded-xl border-0 text-[11px] font-bold hover:brightness-105">{savingService ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}ذخیره خدمت</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={sourceOpen} onOpenChange={setSourceOpen}>
        <DialogContent className="rounded-[28px] sm:max-w-md">
          <DialogHeader><DialogTitle className="text-base font-extrabold">{editingSource ? "ویرایش منبع" : "منبع رسمی جدید"}</DialogTitle><DialogDescription className="text-[11px] leading-6">منابع رسمی و مستندات نرخ را یک‌جا نگه دارید.</DialogDescription></DialogHeader>
          <form onSubmit={saveSource} className="space-y-3">
            <Field label="نام منبع"><Input value={sourceForm.name} onChange={(event) => setSourceForm({ ...sourceForm, name: event.target.value })} required minLength={2} maxLength={140} /></Field>
            <Field label="لینک منبع"><Input value={sourceForm.url} onChange={(event) => setSourceForm({ ...sourceForm, url: event.target.value })} dir="ltr" className="text-left" placeholder="https://…" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="نوع"><Select value={sourceForm.kind} onValueChange={(value) => setSourceForm({ ...sourceForm, kind: value as "official" | "market" | "internal" })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="official">رسمی</SelectItem><SelectItem value="market">بازار</SelectItem><SelectItem value="internal">داخلی</SelectItem></SelectContent></Select></Field>
              {editingSource && <label className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 text-[10.5px] font-semibold">فعال<Switch checked={sourceForm.isActive} onCheckedChange={(checked) => setSourceForm({ ...sourceForm, isActive: checked })} /></label>}
            </div>
            <Field label="توضیح"><Textarea value={sourceForm.description} onChange={(event) => setSourceForm({ ...sourceForm, description: event.target.value })} rows={2} maxLength={400} /></Field>
            {sourceError && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[10.5px] text-destructive">{sourceError}</p>}
            <Button type="submit" disabled={savingSmall} className="clay-primary h-10 w-full rounded-xl border-0 text-[11px] font-bold hover:brightness-105">{savingSmall ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}ذخیره منبع</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={knowledgeCategoryOpen} onOpenChange={setKnowledgeCategoryOpen}>
        <DialogContent className="rounded-[28px] sm:max-w-md">
          <DialogHeader><DialogTitle className="text-base font-extrabold">{editingKnowledgeCategory ? "ویرایش دسته دانش" : "دسته دانش جدید"}</DialogTitle></DialogHeader>
          <form onSubmit={saveKnowledgeCategory} className="space-y-3">
            <Field label="نام دسته"><Input value={knowledgeCategoryForm.name} onChange={(event) => setKnowledgeCategoryForm({ ...knowledgeCategoryForm, name: event.target.value })} required minLength={2} maxLength={100} /></Field>
            <Field label="توضیح"><Textarea value={knowledgeCategoryForm.description} onChange={(event) => setKnowledgeCategoryForm({ ...knowledgeCategoryForm, description: event.target.value })} rows={2} maxLength={250} /></Field>
            <Field label="رنگ"><Select value={knowledgeCategoryForm.tone} onValueChange={(value) => setKnowledgeCategoryForm({ ...knowledgeCategoryForm, tone: value })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{TONES.map((tone) => <SelectItem key={tone.value} value={tone.value}>{tone.label}</SelectItem>)}</SelectContent></Select></Field>
            {editingKnowledgeCategory && <label className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 text-[10.5px] font-semibold">دسته فعال<Switch checked={knowledgeCategoryForm.isActive} onCheckedChange={(checked) => setKnowledgeCategoryForm({ ...knowledgeCategoryForm, isActive: checked })} /></label>}
            <Button type="submit" disabled={savingSmall} className="clay-primary h-10 w-full rounded-xl border-0 text-[11px] font-bold hover:brightness-105">{savingSmall ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}ذخیره</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={serviceCategoryOpen} onOpenChange={setServiceCategoryOpen}>
        <DialogContent className="rounded-[28px] sm:max-w-md">
          <DialogHeader><DialogTitle className="text-base font-extrabold">{editingServiceCategory ? "ویرایش دسته خدمت" : "دسته خدمت جدید"}</DialogTitle></DialogHeader>
          <form onSubmit={saveServiceCategory} className="space-y-3">
            <Field label="نام دسته"><Input value={serviceCategoryForm.name} onChange={(event) => setServiceCategoryForm({ ...serviceCategoryForm, name: event.target.value })} required minLength={2} maxLength={100} /></Field>
            <Field label="توضیح"><Textarea value={serviceCategoryForm.description} onChange={(event) => setServiceCategoryForm({ ...serviceCategoryForm, description: event.target.value })} rows={2} maxLength={250} /></Field>
            <Field label="رنگ"><Select value={serviceCategoryForm.tone} onValueChange={(value) => setServiceCategoryForm({ ...serviceCategoryForm, tone: value })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{TONES.map((tone) => <SelectItem key={tone.value} value={tone.value}>{tone.label}</SelectItem>)}</SelectContent></Select></Field>
            {editingServiceCategory && <label className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 text-[10.5px] font-semibold">دسته فعال<Switch checked={serviceCategoryForm.isActive} onCheckedChange={(checked) => setServiceCategoryForm({ ...serviceCategoryForm, isActive: checked })} /></label>}
            <Button type="submit" disabled={savingSmall} className="clay-primary h-10 w-full rounded-xl border-0 text-[11px] font-bold hover:brightness-105">{savingSmall ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}ذخیره</Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent className="rounded-[26px]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "document"
                ? `بایگانی ${confirm.title}؟`
                : confirm?.kind === "service"
                  ? `غیرفعال‌سازی ${confirm.title}؟`
                  : `حذف ${confirm?.title}؟`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[11px] leading-6">
              {confirm?.kind === "document"
                ? "سند از پاسخ‌های دستیار خارج می‌شود، اما فایل، متن استخراج‌شده و سابقه آن حفظ می‌شود و بعداً قابل بازگردانی است."
                : confirm?.kind === "service"
                  ? "خدمت از فهرست فعال نرخ‌نامه خارج می‌شود، اما تعریف آن و نرخ‌های اختصاصی کافی‌نت‌ها حفظ می‌شوند. بعداً می‌توانید آن را دوباره فعال کنید."
                  : "این مورد فقط وقتی حذف می‌شود که به داده دیگری وابسته نباشد. در صورت استفاده، سیستم اجازه حذف نمی‌دهد."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {confirm?.kind === "document" || confirm?.kind === "service" ? (
                <Archive className="size-4" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {confirm?.kind === "document" || confirm?.kind === "service"
                ? "بایگانی"
                : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

type KnowledgeDocDetail = {
  id: Id<"knowledge_documents">;
  title: string;
  summary: string;
  content: string;
  categoryId: Id<"knowledge_categories">;
  sourceId: Id<"price_sources"> | null;
  sourceName: string;
  sourceUrl: string | null;
  fileId: Id<"_storage"> | null;
  fileName: string | null;
  fileSize: number | null;
  fileMimeType: string | null;
  fileUrl: string | null;
  tags: string[];
  status: DocStatus;
};

function DocumentDialog({
  open,
  documentId,
  initial,
  categories,
  sources,
  onClose,
}: {
  open: boolean;
  documentId: Id<"knowledge_documents"> | null;
  initial: KnowledgeDoc | null;
  categories: KnowledgeCategory[];
  sources: SourceRow[];
  onClose: () => void;
}) {
  const detailQuery = useQuery(
    api.knowledgeAdmin.document,
    documentId ? { documentId } : "skip",
  );
  const detail = (detailQuery ?? null) as KnowledgeDocDetail | null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[28px] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold">
            {documentId ? "ویرایش سند دانش" : "افزودن سند دانش"}
          </DialogTitle>
          <DialogDescription className="text-[11px] leading-6">
            فقط اسناد تأییدشده در پاسخ‌های ایجنت استفاده می‌شوند. متن سند به
            چانک‌های جستجو تبدیل می‌شود.
          </DialogDescription>
        </DialogHeader>
        {documentId && !detail ? (
          <div className="flex min-h-40 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DocumentForm
            key={documentId ? `${detail?.id}-${detail?.content.length}` : "new"}
            documentId={documentId}
            detail={detail}
            initial={initial}
            categories={categories}
            sources={sources}
            onSaved={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DocumentForm({
  documentId,
  detail,
  initial,
  categories,
  sources,
  onSaved,
}: {
  documentId: Id<"knowledge_documents"> | null;
  detail: KnowledgeDocDetail | null;
  initial: KnowledgeDoc | null;
  categories: KnowledgeCategory[];
  sources: SourceRow[];
  onSaved: () => void;
}) {
  const saveDocument = useMutation(api.knowledgeAdmin.saveDocument);
  const generateUploadUrl = useMutation(api.knowledgeAdmin.generateUploadUrl);
  const seed = detail ?? initial;
  const [form, setForm] = useState<typeof EMPTY_DOC>(() => ({
    ...EMPTY_DOC,
    categoryId: seed?.categoryId ?? categories[0]?.id ?? "",
    title: seed?.title ?? "",
    summary: seed?.summary ?? "",
    content: detail?.content ?? "",
    sourceId: seed?.sourceId ?? "none",
    sourceName: seed?.sourceName ?? "",
    sourceUrl: seed?.sourceUrl ?? "",
    fileId: detail?.fileId ?? "",
    fileName: seed?.fileName ?? "",
    fileSize: detail?.fileSize ?? 0,
    fileMimeType: detail?.fileMimeType ?? "",
    tags: seed?.tags.join("، ") ?? "",
    status: seed?.status ?? ("draft" as DocStatus),
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const extractText = useAction(api.knowledgeExtract.extractTextFromFile);

  const uploadFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("حجم فایل راهنما نباید بیشتر از ۸ مگابایت باشد.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) throw new Error("آپلود فایل انجام نشد.");
      const result = (await response.json()) as { storageId?: string };
      if (!result.storageId) throw new Error("شناسه فایل دریافت نشد.");
      const fileId = result.storageId as Id<"_storage">;
      setForm((current) => ({
        ...current,
        fileId,
        fileName: file.name,
        fileSize: file.size,
        fileMimeType: file.type,
      }));
      setExtracting(true);
      try {
        const extracted = await extractText({
          fileId,
          fileName: file.name,
        });
        setForm((current) => ({ ...current, content: extracted.text }));
        toast.success(
          extracted.truncated
            ? "متن فایل استخراج شد و تا ۴۰ هزار نویسه در سند قرار گرفت."
            : "متن فایل استخراج و در سند قرار گرفت.",
        );
      } catch (caught) {
        setError(
          errorMessage(
            caught,
            "آپلود انجام شد اما استخراج متن ممکن نشد؛ متن را دستی وارد کنید.",
          ),
        );
      } finally {
        setExtracting(false);
      }
    } catch (caught) {
      setError(errorMessage(caught, "آپلود فایل راهنما ممکن نشد."));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (uploading || extracting) return;
    if (!form.categoryId) {
      setError("دسته‌بندی دانش را انتخاب کنید.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveDocument({
        documentId: documentId ?? undefined,
        categoryId: form.categoryId as Id<"knowledge_categories">,
        title: form.title,
        summary: form.summary,
        content: form.content,
        sourceId:
          form.sourceId === "none"
            ? undefined
            : (form.sourceId as Id<"price_sources">),
        sourceName: form.sourceName,
        sourceUrl: form.sourceUrl || undefined,
        fileId: form.fileId ? (form.fileId as Id<"_storage">) : undefined,
        fileName: form.fileId ? form.fileName || undefined : undefined,
        fileSize: form.fileId ? form.fileSize : undefined,
        fileMimeType: form.fileId ? form.fileMimeType || undefined : undefined,
        tags: form.tags
          .split(/[،,]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
        status: form.status,
      });
      toast.success("سند و چانک‌های جستجو ذخیره شدند.");
      onSaved();
    } catch (caught) {
      setError(errorMessage(caught, "ذخیره سند ممکن نشد."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
        <Field label="عنوان سند"><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required minLength={3} maxLength={160} /></Field>
        <Field label="دسته‌بندی"><Select value={form.categoryId} onValueChange={(value) => setForm({ ...form, categoryId: value })}><SelectTrigger className="w-full"><SelectValue placeholder="انتخاب دسته" /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></Field>
      </div>
      <Field label="خلاصه"><Textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} rows={2} required minLength={10} maxLength={400} /></Field>
      <Field label="متن کامل راهنما"><Textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} rows={10} required minLength={20} maxLength={40000} placeholder="محتوا را با منبع و تاریخ بررسی بنویسید…" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="منبع ثبت‌شده"><Select value={form.sourceId} onValueChange={(value) => { const source = sources.find((item) => item.id === value); setForm({ ...form, sourceId: value, sourceName: source?.name ?? form.sourceName }); }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">بدون منبع ثبت‌شده</SelectItem>{sources.map((source) => <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="نام منبع رسمی"><Input value={form.sourceName} onChange={(event) => setForm({ ...form, sourceName: event.target.value })} required minLength={2} maxLength={180} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="لینک منبع (اختیاری)"><Input value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} dir="ltr" className="text-left" /></Field>
        <Field label="برچسب‌ها (با ویرگول)"><Input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="آزمون، مدارک، ثبت‌نام" /></Field>
      </div>
      <Field label="فایل راهنما (اختیاری، حداکثر ۸ مگابایت)">
        <div className="clay-inset rounded-xl p-2.5">
          {form.fileName ? (
            <div className="flex flex-wrap items-center gap-2">
              <Paperclip className="size-3.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10.5px] font-semibold">{form.fileName}</p>
                <p className="text-[8.5px] text-muted-foreground">
                  {form.fileSize > 0 ? `${faNumber(Math.ceil(form.fileSize / 1024))} کیلوبایت` : "پیوست ثبت‌شده"}
                </p>
              </div>
              {detail?.fileUrl && form.fileId === detail.fileId && (
                <a href={detail.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[8.5px] text-primary hover:underline">
                  مشاهده <ExternalLink className="size-2.5" />
                </a>
              )}
              <button type="button" onClick={() => setForm({ ...form, fileId: "", fileName: "", fileSize: 0, fileMimeType: "" })} className="rounded-md px-1.5 py-1 text-[8.5px] text-destructive hover:bg-destructive/10">
                حذف فایل
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 px-3 py-2.5 text-[10px] text-muted-foreground hover:border-primary/50 hover:text-primary">
              {uploading || extracting ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {uploading
                ? "در حال آپلود فایل…"
                : extracting
                  ? "در حال استخراج متن فایل…"
                  : "انتخاب فایل PDF، Word (docx) یا متن"}
              <Input type="file" accept=".pdf,.docx,.txt,.md,.csv,application/pdf,text/plain" onChange={(event) => void uploadFile(event.target.files?.[0])} disabled={uploading || extracting} className="sr-only" />
            </label>
          )}
        </div>
      </Field>
      <Field label="وضعیت انتشار"><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as DocStatus })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">پیش‌نویس</SelectItem><SelectItem value="approved">تأییدشده</SelectItem><SelectItem value="archived">بایگانی</SelectItem></SelectContent></Select></Field>
      {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[10.5px] leading-5 text-destructive">{error}</p>}
      <Button type="submit" disabled={saving || uploading} className="clay-primary h-10 w-full rounded-xl border-0 text-[11px] font-bold hover:brightness-105">{saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}ذخیره سند</Button>
    </form>
  );
}

function SourcesSection({
  sources,
  onNew,
  onEdit,
  onDelete,
}: {
  sources: SourceRow[];
  onNew: () => void;
  onEdit: (source: SourceRow) => void;
  onDelete: (source: SourceRow) => void;
}) {
  return (
    <section className="clay rounded-[28px] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-sm font-extrabold">منابع رسمی و مستندات</h2><p className="mt-1 text-[10.5px] text-muted-foreground">منبع نرخ‌ها و اسناد دانش را یک‌جا مدیریت کنید.</p></div>
        <Button type="button" size="sm" onClick={onNew} className="h-8 rounded-lg text-[10px]"><Plus className="size-3" />منبع جدید</Button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {sources.map((source) => (
          <div key={source.id} className="clay-inset flex items-start gap-2 rounded-[18px] p-3">
            <span className="tile-mint grid size-8 shrink-0 place-items-center rounded-lg"><FileText className="size-3.5" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5"><p className="truncate text-[10.5px] font-bold">{source.name}</p>{!source.isActive && <Badge variant="secondary" className="text-[8px]">غیرفعال</Badge>}</div>
              <p className="mt-0.5 text-[8.5px] text-muted-foreground">{source.kind === "official" ? "رسمی" : source.kind === "market" ? "بازار" : "داخلی"} · {faNumber(source.usageCount)} استفاده</p>
              {source.url && <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[8.5px] text-primary hover:underline" dir="ltr">{source.url}<ExternalLink className="size-2.5" /></a>}
            </div>
            <div className="flex shrink-0">
              <button type="button" aria-label="ویرایش منبع" onClick={() => onEdit(source)} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:text-primary"><Pencil className="size-2.5" /></button>
              <button type="button" aria-label="حذف منبع" onClick={() => onDelete(source)} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:text-destructive"><Trash2 className="size-2.5" /></button>
            </div>
          </div>
        ))}
        {sources.length === 0 && <p className="rounded-xl bg-muted/40 p-3 text-[10px] text-muted-foreground sm:col-span-2">هنوز منبعی ثبت نشده است.</p>}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="clay-inset rounded-2xl p-3"><p className="text-lg font-extrabold leading-6">{faNumber(value)}</p><p className="text-[9px] text-muted-foreground">{label}</p></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl bg-muted/40 p-6 text-center text-[10.5px] text-muted-foreground">{text}</div>;
}
