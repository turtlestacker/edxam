import { ReminderConfig, ReviewLog, RevisionSession } from "./types";

const SESSIONS_KEY = "revision.sessions.v1";
const REVIEWS_KEY = "revision.reviews.v1";
const REMINDER_KEY = "revision.reminders.v1";

export const defaultReminder: ReminderConfig = {
  primaryTime: "18:30",
  secondaryEnabled: true
};

export function loadSessions(): RevisionSession[] | null {
  const raw = globalThis.localStorage?.getItem(SESSIONS_KEY);
  return raw ? (JSON.parse(raw) as RevisionSession[]) : null;
}

export function saveSessions(sessions: RevisionSession[]) {
  globalThis.localStorage?.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function loadReviews(): ReviewLog[] {
  const raw = globalThis.localStorage?.getItem(REVIEWS_KEY);
  return raw ? (JSON.parse(raw) as ReviewLog[]) : [];
}

export function saveReviews(reviews: ReviewLog[]) {
  globalThis.localStorage?.setItem(REVIEWS_KEY, JSON.stringify(reviews));
}

export function loadReminder(): ReminderConfig {
  const raw = globalThis.localStorage?.getItem(REMINDER_KEY);
  return raw ? (JSON.parse(raw) as ReminderConfig) : defaultReminder;
}

export function saveReminder(config: ReminderConfig) {
  globalThis.localStorage?.setItem(REMINDER_KEY, JSON.stringify(config));
}
