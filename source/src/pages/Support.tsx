import { AppShell } from "@/components/layout/AppShell";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/backend/api";
import type { Id } from "@/backend/ids";
import { errorMessage } from "@/lib/auth";
import { faDateLong } from "@/lib/format";
import { useMutation, useQuery } from "@/backend/client";
import {
  ChevronLeft,
  LifeBuoy,
  Loader2,
  MessageSquarePlus,
  Plus,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";
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
};
const CATEGORY_LABELS: Record<string, string> = {
  account: "حساب",
  billing: "مالی و اشتراک",
  technical: "فنی",
  content: "محتوا و اطلاعات",
  other: "سایر",
};

type Ticket = {
  id: Id<"support_tickets">;
  number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  lastMessageAt: number;
  createdAt: number;
  closedAt: number | null;
};

export default function Support() {
  const ticketsQuery = useQuery(api.support.myTickets, {});
  const tickets = (ticketsQuery ?? []) as Ticket[];
  const createTicket = useMutation(api.support.createTicket);
  const replyMyTicket = useMutation(api.support.replyMyTicket);
  const closeMyTicket = useMutation(api.support.closeMyTicket);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Id<"support_tickets"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [form, setForm] = useState({
    subject: "",
    body: "",
    category: "technical",
    priority: "normal",
  });
  const detail = useQuery(
    api.support.myTicket,
    selected ? { ticketId: selected } : "skip",
  );

  const handleCreate = async () => {
    if (form.subject.trim().length < 4 || form.body.trim().length < 10) {
      toast.error("موضوع و توضیح تیکت را کامل کنید.");
      return;
    }
    setBusy(true);
    try {
      const result = await createTicket({
        subject: form.subject,
        body: form.body,
        category: form.category as "account" | "billing" | "technical" | "content" | "other",
        priority: form.priority as "low" | "normal" | "high",
      });
      toast.success(`تیکت ${result.number} ثبت شد.`);
      setCreateOpen(false);
      setForm({ subject: "", body: "", category: "technical", priority: "normal" });
      setSelected(result.ticketId);
    } catch (caught) {
      toast.error(errorMessage(caught, "ثبت تیکت ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  const handleReply = async () => {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      await replyMyTicket({ ticketId: selected, body: reply });
      toast.success("پاسخ ثبت شد.");
      setReply("");
    } catch (caught) {
      toast.error(errorMessage(caught, "ثبت پاسخ ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await closeMyTicket({ ticketId: selected });
      toast.success("تیکت بسته شد.");
    } catch (caught) {
      toast.error(errorMessage(caught, "بستن تیکت ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell active="support">
      <div className="space-y-5">
        <section className="clay rounded-[30px] p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="clay-inset inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] text-muted-foreground">
                <LifeBuoy className="size-3.5" /> پشتیبانی کافی‌نت‌یار
              </span>
              <h1 className="mt-3 text-xl font-extrabold sm:text-2xl">چطور می‌توانیم کمک کنیم؟</h1>
              <p className="mt-2 max-w-2xl text-[11px] leading-6 text-muted-foreground">
                تیکت شما مستقیماً برای تیم پشتیبانی ثبت می‌شود و فقط برای شما و
                تیم پشتیبانی قابل مشاهده است. برای اطلاعات حساس رمز عبور ارسال نکنید.
              </p>
            </div>
            <Button type="button" onClick={() => setCreateOpen(true)} className="clay-primary h-10 rounded-xl border-0 text-[11px] font-bold">
              <Plus className="size-4" />
              تیکت جدید
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold">تیکت‌های من</h2>
            <Badge variant="secondary" className="rounded-full text-[8.5px]">
              {tickets.filter((ticket) => ticket.status !== "closed").length.toLocaleString("fa-IR")} فعال
            </Badge>
          </div>
          {ticketsQuery === undefined ? (
            <div className="clay flex justify-center rounded-[26px] p-10"><Loader2 className="size-5 animate-spin" /></div>
          ) : tickets.length === 0 ? (
            <div className="clay flex flex-col items-center rounded-[28px] p-10 text-center">
              <MessageSquarePlus className="size-7 text-muted-foreground" />
              <p className="mt-2 text-sm font-bold">هنوز تیکتی ندارید</p>
              <p className="mt-1 text-[10px] text-muted-foreground">در صورت بروز مشکل، یک تیکت برای تیم پشتیبانی ثبت کنید.</p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <button key={ticket.id} type="button" onClick={() => setSelected(ticket.id)} className="clay flex w-full items-center gap-3 rounded-[22px] p-3.5 text-start transition-colors hover:bg-primary/5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <LifeBuoy className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span dir="ltr" className="text-[8.5px] text-muted-foreground">{ticket.number}</span>
                    <Badge variant="secondary" className="rounded-full text-[8px]">{STATUS_LABELS[ticket.status]}</Badge>
                    <Badge variant="secondary" className="rounded-full text-[8px]">{CATEGORY_LABELS[ticket.category]}</Badge>
                  </div>
                  <p className="mt-1 truncate text-[11px] font-bold">{ticket.subject}</p>
                  <p className="mt-0.5 text-[9px] text-muted-foreground">آخرین پیام: {faDateLong(ticket.lastMessageAt)}</p>
                </div>
                <ChevronLeft className="size-4 text-muted-foreground" />
              </button>
            ))
          )}
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="clay max-h-[88vh] w-[min(35rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[28px] border-0">
          <DialogHeader className="text-start">
            <DialogTitle className="text-base font-extrabold">ثبت تیکت پشتیبانی</DialogTitle>
            <DialogDescription className="text-[10.5px] leading-5">مشکل را دقیق توضیح دهید تا تیم پشتیبانی سریع‌تر بررسی کند.</DialogDescription>
          </DialogHeader>
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px]">موضوع</Label>
              <Input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="مثلاً خطا در ثبت تراکنش" className="clay-inset h-9 rounded-xl border-0 bg-transparent text-[10.5px]" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[10px]">دسته</Label>
                <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                  <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px]">اولویت</Label>
                <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}>
                  <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(PRIORITY_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px]">توضیحات</Label>
              <Textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="جزئیات مشکل، زمان بروز و اقداماتی که انجام داده‌اید..." className="clay-inset min-h-28 rounded-xl border-0 bg-transparent text-[10.5px]" />
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={handleCreate} disabled={busy} className="clay-primary h-10 flex-1 rounded-xl border-0 text-[11px] font-bold">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-3.5" />}
                ارسال تیکت
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} className="h-10 flex-1 rounded-xl text-[11px]">انصراف</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={selected !== null} onOpenChange={(value) => !value && setSelected(null)}>
        <DialogContent className="clay max-h-[88vh] w-[min(40rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[28px] border-0 p-0">
          <div className="border-b border-border/50 p-5">
            <DialogHeader className="text-start">
              <DialogTitle className="text-base font-extrabold">{detail?.subject ?? "تیکت پشتیبانی"}</DialogTitle>
              <DialogDescription className="text-[10px]">{detail ? `${detail.number} · ${STATUS_LABELS[detail.status]}` : "در حال بارگذاری"}</DialogDescription>
            </DialogHeader>
          </div>
          {!detail ? (
            <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin" /></div>
          ) : (
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full text-[8px]">{CATEGORY_LABELS[detail.category]}</Badge>
                <Badge variant="secondary" className="rounded-full text-[8px]">{PRIORITY_LABELS[detail.priority]}</Badge>
                {detail.status === "closed" && (
                  <Badge variant="secondary" className="rounded-full text-[8px]">بسته</Badge>
                )}
              </div>
              <div className="space-y-2">
                {detail.messages.map((message) => (
                  <div key={message.id} className={`rounded-2xl p-3 text-[10px] leading-6 ${message.isAdmin ? "bg-primary/10" : "bg-muted/45"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{message.isAdmin ? "پشتیبانی" : "شما"}</span>
                      <span className="text-[8px] text-muted-foreground">{faDateLong(message.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                  </div>
                ))}
              </div>
              {detail.status !== "closed" ? (
                <div className="space-y-2">
                  <Textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="پاسخ یا توضیح تکمیلی..." className="clay-inset min-h-20 rounded-xl border-0 bg-transparent text-[10.5px]" />
                  <div className="flex gap-2">
                    <Button type="button" onClick={handleReply} disabled={busy || !reply.trim()} className="clay-primary h-9 flex-1 rounded-xl border-0 text-[10px] font-bold">
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-3.5" />}
                      ارسال
                    </Button>
                    <Button type="button" variant="ghost" onClick={handleClose} disabled={busy} className="h-9 rounded-xl px-3 text-[9.5px] text-muted-foreground">
                      <X className="size-3.5" /> بستن تیکت
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 rounded-xl bg-muted/40 p-3 text-[9.5px] text-muted-foreground">
                  <ShieldCheck className="size-3.5" /> این تیکت بسته شده است. برای پیگیری موضوع جدید، تیکت تازه بسازید.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
