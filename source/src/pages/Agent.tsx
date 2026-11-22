import { AppShell } from "@/components/layout/AppShell";
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
import { errorMessage } from "@/lib/auth";
import {
  faDateLong,
  faDateTime,
  faNumber,
  faRelativeTime,
  faToman,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "@/backend/client";
import {
  AlertTriangle,
  BookOpen,
  Bot,
  Calculator,
  ExternalLink,
  Loader2,
  Plus,
  ReceiptText,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Source = {
  title: string;
  url?: string;
  documentId?: Id<"knowledge_documents">;
  serviceId?: Id<"services">;
  updatedAt?: number;
  kind: "knowledge" | "price" | "official";
};

type GuideResult = {
  id: Id<"knowledge_documents">;
  title: string;
  summary: string;
  snippet: string;
  categoryName: string;
  sourceName: string;
  sourceUrl: string | null;
  fileUrl: string | null;
  reviewedAt: number;
  updatedAt: number;
};

type Calculation = {
  serviceId: Id<"services">;
  serviceName: string;
  quantity: number;
  unit: string;
  unitPriceToman: number;
  lineTotalToman: number;
  totalToman: number;
  priceType: "official" | "suggested" | "custom";
  addons?: {
    serviceId: Id<"services">;
    serviceName: string;
    quantity: number;
    unit: string;
    unitPriceToman: number;
    lineTotalToman: number;
  }[];
  sourceName?: string;
  validUntil?: number;
};

type Message = {
  id: Id<"agent_messages">;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  calculation: Calculation | null;
  model: string | null;
  createdAt: number;
  feedback: "helpful" | "not_helpful" | null;
};

type ConversationSummary = {
  id: Id<"agent_conversations">;
  title: string;
  messageCount: number;
  lastMessageAt: number;
  createdAt: number;
};

const SUGGESTIONS = [
  "شرایط ثبت‌نام آزمون استخدامی چیست؟",
  "برای ثبت‌نام در سامانه موردنظر چه مدارکی لازم است؟",
  "هزینه تایپ و پرینت چقدر محاسبه می‌شود؟",
  "مراحل دریافت یک گواهی یا مجوز چیست؟",
];

const SOURCE_LABELS: Record<Source["kind"], string> = {
  knowledge: "دانشنامه",
  price: "نرخ‌نامه",
  official: "سامانه رسمی",
};

const PRICE_LABELS: Record<Calculation["priceType"], string> = {
  official: "رسمی",
  suggested: "پیشنهادی",
  custom: "اختصاصی کافی‌نت",
};

export default function Agent() {
  const meta = useQuery(api.agent.meta, {});
  const conversationsQuery = useQuery(api.agent.conversations, {});
  const conversations = (conversationsQuery ?? []) as ConversationSummary[];
  const [currentId, setCurrentId] =
    useState<Id<"agent_conversations"> | null>(null);
  const conversation = useQuery(
    api.agent.conversation,
    currentId ? { conversationId: currentId } : "skip",
  );
  const ask = useAction(api.agent.ask);
  const submitFeedback = useMutation(api.agent.submitFeedback);
  const deleteConversation = useMutation(api.agent.deleteConversation);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<ConversationSummary | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideSearch, setGuideSearch] = useState("");
  const deferredGuideSearch = useDeferredValue(guideSearch);
  const guideQuery = useQuery(
    api.knowledge.search,
    guideOpen ? { search: deferredGuideSearch } : "skip",
  );
  const guideResults = (guideQuery?.results ?? []) as GuideResult[];
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = (conversation?.messages ?? []) as Message[];
  const now = meta?.serverNow ?? 0;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [messages.length, isSending, pendingText]);

  const sendMessage = async (raw: string) => {
    const text = raw.trim();
    if (!text || isSending) return;
    setInput("");
    setIsSending(true);
    if (!currentId) setPendingText(text);
    try {
      const result = await ask({
        message: text,
        conversationId: currentId ?? undefined,
      });
      setCurrentId(result.conversationId);
      setPendingText(null);
    } catch (error) {
      setPendingText(null);
      setInput(text);
      toast.error(errorMessage(error, "ارسال پیام ممکن نشد."));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  };

  const handleFeedback = async (
    message: Message,
    rating: "helpful" | "not_helpful",
  ) => {
    if (!currentId) return;
    try {
      await submitFeedback({
        messageId: message.id,
        conversationId: currentId,
        rating,
      });
      toast.success("بازخورد شما ثبت شد.");
    } catch (error) {
      toast.error(errorMessage(error, "ثبت بازخورد ممکن نشد."));
    }
  };

  const newChat = () => {
    setCurrentId(null);
    setPendingText(null);
    setInput("");
  };

  return (
    <AppShell active="agent">
      <div className="space-y-4">
        <section className="clay relative overflow-hidden rounded-[30px] p-5 sm:p-6">
          <div className="pointer-events-none absolute -end-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="clay-inset inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] text-muted-foreground">
                <Bot className="size-3.5" />
                دستیار تخصصی کافی‌نت‌یار
              </span>
              <h1 className="mt-3 text-xl font-extrabold sm:text-2xl">
                ایجنت هوشمند کافی‌نت
              </h1>
              <p className="mt-2 max-w-2xl text-[11.5px] leading-6 text-muted-foreground">
                درباره آزمون‌ها، سامانه‌های دولتی، مدارک، مراحل خدمات و
                نرخ‌نامه بپرسید. پاسخ‌ها فقط بر پایه دانش تأییدشده و نرخ معتبر
                همین کافی‌نت ارائه می‌شوند.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="clay-inset inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] text-muted-foreground">
                <BookOpen className="size-3.5" />
                {faNumber(meta?.knowledgeDocs ?? 0)} سند تأییدشده
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => setGuideOpen(true)}
                className="h-9 rounded-xl text-[10.5px] font-semibold"
              >
                <Search className="size-3.5" />
                جست‌وجوی راهنماها
              </Button>
              {meta?.usage && (
                <span className="clay-inset inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] text-muted-foreground">
                  <Sparkles className="size-3.5" />
                  سهمیه AI: {faNumber(meta.usage.aiUsed)}/
                  {meta.usage.aiLimit > 0 ? faNumber(meta.usage.aiLimit) : "نامحدود"}
                </span>
              )}
              {meta && (!meta.aiEnabled || !meta.aiConfigured) && (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-[10px] text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="size-3.5" />
                  دستیار محلی از منابع ذخیره‌شده و نرخ‌های شما پاسخ می‌دهد؛ مدل تولید متن متصل نیست.
                </span>
              )}
              {meta?.canViewRates !== false && (
                <Button
                  asChild
                  variant="outline"
                  className="h-9 rounded-xl text-[10.5px] font-semibold"
                >
                  <Link to="/dashboard/rates">
                    <ReceiptText className="size-3.5" />
                    نرخ‌نامه و ماشین‌حساب
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        {(meta?.knowledgeDocs ?? 0) === 0 && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-[10.5px] leading-5 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              هنوز سند تأییدشده‌ای در پایگاه دانش ثبت نشده است. ایجنت در
              موضوعات جزئی، اطلاعات قطعی اعلام نمی‌کند و شما را به منبع رسمی
              راهنمایی می‌کند.
            </p>
          </div>
        )}

        <div className="grid min-h-[62vh] items-start gap-3 lg:grid-cols-[16.5rem_minmax(0,1fr)]">
          <aside className="clay hidden rounded-[26px] p-3 lg:block">
            <Button
              type="button"
              onClick={newChat}
              className="clay-primary h-10 w-full rounded-xl border-0 text-[11px] font-bold hover:brightness-105"
            >
              <Plus className="size-4" />
              گفت‌وگوی جدید
            </Button>
            <p className="px-2 pb-1.5 pt-4 text-[10px] font-semibold text-muted-foreground">
              تاریخچه گفت‌وگوها
            </p>
            <div className="max-h-[48vh] space-y-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="rounded-xl bg-muted/50 p-3 text-[10px] leading-5 text-muted-foreground">
                  اولین پرسش خود را بپرسید تا تاریخچه اینجا ذخیره شود.
                </p>
              ) : (
                conversations.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-xl p-1.5 transition-colors",
                      currentId === item.id
                        ? "bg-primary/10"
                        : "hover:bg-muted/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setCurrentId(item.id)}
                      className="min-w-0 flex-1 text-start"
                    >
                      <p
                        className={cn(
                          "truncate text-[10.5px] font-semibold",
                          currentId === item.id && "text-primary",
                        )}
                      >
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[9px] text-muted-foreground">
                        {faNumber(item.messageCount)} پیام ·{" "}
                        {faRelativeTime(item.lastMessageAt, now)}
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label="حذف گفت‌وگو"
                      onClick={() => setDeleteTarget(item)}
                      className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 rounded-xl bg-muted/40 p-2.5 text-[9px] leading-4 text-muted-foreground">
              <ShieldCheck className="mb-1 size-3.5 text-primary" />
              گفت‌وگوها فقط برای حساب شما قابل مشاهده‌اند و به کافی‌نت دیگری
              منتقل نمی‌شوند.
            </div>
          </aside>

          <section className="clay flex min-h-[62vh] flex-col overflow-hidden rounded-[28px]">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="tile-navy grid size-8 place-items-center rounded-[10px]">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <p className="text-[11.5px] font-extrabold">
                    {conversation?.title ?? "گفت‌وگوی جدید"}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {conversation
                      ? `${faNumber(messages.length)} پیام`
                      : "پاسخ مبتنی بر منابع تأییدشده"}
                  </p>
                </div>
              </div>
              <div className="ms-auto lg:hidden">
                <Select
                  value={currentId ?? "new"}
                  onValueChange={(value) => {
                    if (value === "new") newChat();
                    else setCurrentId(value as Id<"agent_conversations">);
                  }}
                >
                  <SelectTrigger className="h-8 w-40 text-[9.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">گفت‌وگوی جدید</SelectItem>
                    {conversations.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {currentId && (
                <button
                  type="button"
                  onClick={() => {
                    const target = conversations.find(
                      (item) => item.id === currentId,
                    );
                    if (target) setDeleteTarget(target);
                  }}
                  className="ms-1 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive lg:hidden"
                  aria-label="حذف گفت‌وگو"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>

            <div
              ref={scrollRef}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-4"
            >
              {messages.length === 0 && !pendingText && (
                <div className="mx-auto flex max-w-lg flex-col items-center py-8 text-center">
                  <span className="tile-lilac grid size-14 place-items-center rounded-[20px]">
                    <Bot className="size-7" />
                  </span>
                  <h2 className="mt-4 text-base font-extrabold">
                    امروز چه کاری دارید؟
                  </h2>
                  <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
                    یکی از پرسش‌های پیشنهادی را انتخاب کنید یا پرسش خودتان را
                    بنویسید. من اطلاعات تأییدشده و نرخ‌های معتبر را بررسی
                    می‌کنم.
                  </p>
                  <div className="mt-5 grid w-full gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => void sendMessage(question)}
                        className="clay-sm clay-lift rounded-2xl p-3 text-start text-[10.5px] leading-5 font-medium text-foreground/85 hover:text-primary"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {message.role === "assistant" && (
                    <span className="tile-navy mt-0.5 grid size-8 shrink-0 place-items-center rounded-[10px]">
                      <Bot className="size-4" />
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[88%] rounded-[20px] px-3.5 py-3 text-[11.5px] leading-6 sm:max-w-[78%]",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "clay-inset text-foreground",
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {message.calculation && (
                      <div className="mt-3 rounded-2xl bg-card/70 p-3 text-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calculator className="size-3.5 text-primary" />
                          <p className="text-[10.5px] font-extrabold">
                            جزئیات محاسبه
                          </p>
                          <Badge
                            variant="secondary"
                            className="ms-auto rounded-full text-[8.5px]"
                          >
                            {PRICE_LABELS[message.calculation.priceType]}
                          </Badge>
                        </div>
                        <dl className="mt-2 space-y-1 text-[10px]">
                          <div className="flex justify-between gap-2">
                            <dt className="text-muted-foreground">نرخ واحد</dt>
                            <dd>
                              {faToman(message.calculation.unitPriceToman)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-muted-foreground">
                              مقدار ({message.calculation.unit})
                            </dt>
                            <dd>{faNumber(message.calculation.quantity)}</dd>
                          </div>
                          {message.calculation.addons?.map((addon) => (
                            <div
                              key={addon.serviceId}
                              className="flex justify-between gap-2"
                            >
                              <dt className="text-muted-foreground">
                                {addon.serviceName} (جانبی)
                              </dt>
                              <dd>{faToman(addon.lineTotalToman)}</dd>
                            </div>
                          ))}
                          <div className="flex justify-between gap-2 border-t border-border/50 pt-1 font-bold">
                            <dt>مبلغ نهایی</dt>
                            <dd>{faToman(message.calculation.totalToman)}</dd>
                          </div>
                        </dl>
                        {message.calculation.validUntil && (
                          <p className="mt-2 text-[9px] text-muted-foreground">
                            اعتبار نرخ تا{" "}
                            {faDateTime(message.calculation.validUntil)}
                          </p>
                        )}
                      </div>
                    )}

                    {message.role === "assistant" &&
                      message.sources.length > 0 && (
                        <div className="mt-3 border-t border-border/50 pt-2.5">
                          <p className="mb-1.5 flex items-center gap-1 text-[9.5px] font-bold text-muted-foreground">
                            <BookOpen className="size-3" />
                            منابع این پاسخ
                          </p>
                          <div className="grid gap-1">
                            {message.sources.map((source, index) => (
                              <div
                                key={`${source.title}-${index}`}
                                className="flex items-center gap-1.5 rounded-lg bg-card/60 px-2 py-1.5"
                              >
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[8px] text-muted-foreground">
                                  {SOURCE_LABELS[source.kind]}
                                </span>
                                <div className="min-w-0 flex-1">
                                  {source.url ? (
                                    <a
                                      href={source.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block truncate text-[9.5px] font-medium text-primary hover:underline"
                                    >
                                      {source.title}
                                    </a>
                                  ) : (
                                    <span className="block truncate text-[9.5px] font-medium">
                                      {source.title}
                                    </span>
                                  )}
                                  {source.updatedAt && (
                                    <p className="mt-0.5 text-[8px] text-muted-foreground">
                                      آخرین به‌روزرسانی: {faDateLong(source.updatedAt)}
                                    </p>
                                  )}
                                </div>
                                {source.url && (
                                  <ExternalLink className="size-2.5 shrink-0 text-primary" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {message.role === "assistant" && (
                      <div className="mt-2 flex items-center gap-1">
                        <span className="text-[8.5px] text-muted-foreground">
                          {faRelativeTime(message.createdAt, now)}
                        </span>
                        <div className="ms-auto flex items-center gap-0.5">
                          <button
                            type="button"
                            aria-label="پاسخ مفید بود"
                            onClick={() => handleFeedback(message, "helpful")}
                            className={cn(
                              "grid size-6 place-items-center rounded-md hover:bg-emerald-500/10 hover:text-emerald-600",
                              message.feedback === "helpful" &&
                                "bg-emerald-500/10 text-emerald-600",
                            )}
                          >
                            <ThumbsUp className="size-3" />
                          </button>
                          <button
                            type="button"
                            aria-label="پاسخ مفید نبود"
                            onClick={() =>
                              handleFeedback(message, "not_helpful")
                            }
                            className={cn(
                              "grid size-6 place-items-center rounded-md hover:bg-destructive/10 hover:text-destructive",
                              message.feedback === "not_helpful" &&
                                "bg-destructive/10 text-destructive",
                            )}
                          >
                            <ThumbsDown className="size-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {pendingText && (
                <div className="flex justify-end gap-2">
                  <div className="max-w-[88%] rounded-[20px] bg-primary px-3.5 py-3 text-[11.5px] leading-6 text-primary-foreground sm:max-w-[78%]">
                    <p className="whitespace-pre-wrap">{pendingText}</p>
                  </div>
                </div>
              )}

              {isSending && (
                <div className="flex gap-2">
                  <span className="tile-navy grid size-8 shrink-0 place-items-center rounded-[10px]">
                    <Bot className="size-4" />
                  </span>
                  <div className="clay-inset flex items-center gap-1.5 rounded-[20px] px-4 py-3">
                    <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-primary" />
                    <span className="ms-1 text-[9px] text-muted-foreground">
                      در حال بررسی منابع…
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border/50 p-3 sm:p-4">
              <div className="clay-inset flex items-end gap-2 rounded-2xl p-2">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="پرسش خود را بنویسید… (Enter برای ارسال، Shift+Enter برای خط جدید)"
                  rows={1}
                  disabled={isSending}
                  className="max-h-28 min-h-9 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-[11.5px] leading-6 shadow-none focus-visible:ring-0"
                />
                <Button
                  type="button"
                  aria-label="ارسال"
                  disabled={!input.trim() || isSending}
                  onClick={() => void sendMessage(input)}
                  className="clay-primary size-9 shrink-0 rounded-xl border-0 p-0 hover:brightness-105"
                >
                  {isSending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
              <p className="mt-2 flex items-start gap-1 px-1 text-[8.5px] leading-4 text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3 shrink-0" />
                ایجنت اطلاعات محرمانه نمی‌خواهد و هیچ درخواستی را نهایی نمی‌کند.
                اطلاعات رسمی را از منبع ذکرشده تأیید کنید.
              </p>
            </div>
          </section>
        </div>
      </div>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-[28px] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
              <Search className="size-4 text-primary" />
              جست‌وجوی راهنماهای تأییدشده
            </DialogTitle>
            <DialogDescription className="text-[10.5px] leading-6">
              فقط اسناد تأییدشده و دسته‌های فعال جست‌وجو می‌شوند؛ منبع و تاریخ
              بازبینی هر نتیجه نمایش داده می‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={guideSearch}
              onChange={(event) => setGuideSearch(event.target.value)}
              placeholder="مثلاً ثبت‌نام کنکور، گواهی عدم سوءپیشینه، اینترنت بانک…"
              className="h-10 rounded-xl ps-9 text-[11px]"
            />
          </div>
          <div className="space-y-2">
            {guideQuery === undefined ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-muted/40 p-8 text-[10px] text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                در حال جست‌وجو…
              </div>
            ) : guideResults.length === 0 ? (
              <div className="rounded-2xl bg-muted/40 p-5 text-center">
                <BookOpen className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-2 text-[11px] font-bold">
                  راهنمای تأییدشده‌ای برای این عبارت پیدا نشد.
                </p>
                <p className="mt-1 text-[9.5px] leading-5 text-muted-foreground">
                  عبارت دیگری امتحان کنید یا همین پرسش را در گفت‌وگو مطرح کنید تا
                  دستیار در صورت نبود منبع، صریح اعلام کند.
                </p>
              </div>
            ) : (
              guideResults.map((result) => (
                <article
                  key={result.id}
                  className="rounded-[20px] border border-border/50 bg-card/70 p-3"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-[11.5px] font-extrabold">{result.title}</h3>
                    <Badge variant="secondary" className="rounded-full text-[8px]">
                      {result.categoryName}
                    </Badge>
                  </div>
                  <p className="mt-1.5 line-clamp-3 text-[10px] leading-5 text-muted-foreground">
                    {result.snippet}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[8.5px] text-muted-foreground">
                    <span>منبع: {result.sourceName}</span>
                    <span>آخرین بازبینی: {faDateLong(result.reviewedAt)}</span>
                    {result.sourceUrl && (
                      <a
                        href={result.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        مشاهده منبع رسمی
                        <ExternalLink className="size-2.5" />
                      </a>
                    )}
                    {result.fileUrl && (
                      <a
                        href={result.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        فایل پیوست
                        <ExternalLink className="size-2.5" />
                      </a>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isSending}
                      onClick={() => {
                        setGuideOpen(false);
                        void sendMessage(`درباره «${result.title}» راهنمایی می‌کنی؟`);
                      }}
                      className="ms-auto h-7 rounded-lg px-2 text-[9px] text-primary"
                    >
                      <Bot className="size-3" />
                      پرسیدن از ایجنت
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-[26px]">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف گفت‌وگو؟</AlertDialogTitle>
            <AlertDialogDescription className="text-[11px] leading-6">
              «{deleteTarget?.title}» و همه پیام‌های آن برای همیشه حذف می‌شوند.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteConversation({
                    conversationId: deleteTarget.id,
                  });
                  if (currentId === deleteTarget.id) newChat();
                  setDeleteTarget(null);
                  toast.success("گفت‌وگو حذف شد.");
                } catch (error) {
                  toast.error(errorMessage(error, "حذف گفت‌وگو ممکن نشد."));
                }
              }}
            >
              حذف قطعی
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
