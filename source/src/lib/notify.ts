import { toast } from "sonner";

/** Communicates that a section is intentionally out of the first version. */
export function notifySoon(feature = "این بخش") {
  toast(`${feature} در نسخه‌های بعدی فعال می‌شود`, {
    description: "نسخه اول کافی‌نت‌یار روی حسابداری هوشمند تمرکز دارد.",
  });
}
