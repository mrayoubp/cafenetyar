import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * In-app renewal reminders run daily. Email/SMS delivery remains disabled
 * until a real provider is configured and approved.
 */
crons.daily(
  "subscription renewal reminders",
  { hourUTC: 6, minuteUTC: 0 },
  internal.notifications.generateRenewalReminders,
);

export default crons;
