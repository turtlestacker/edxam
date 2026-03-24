"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EXAMS, SUBJECTS } from "../lib/data";
import { generatePlan, plannedMinutesForDate, rescheduleMissedSession } from "../lib/scheduler";
import {
  defaultReminder,
  loadReminder,
  loadReviews,
  loadSessions,
  saveReminder,
  saveReviews,
  saveSessions
} from "../lib/storage";
import { ReminderConfig, ReviewLog, RevisionSession } from "../lib/types";

type Tab = "today" | "plan" | "progress";

const formatDate = (v: string) => new Date(v).toLocaleDateString();
const todayYmd = () => new Date().toISOString().slice(0, 10);

function nextTimeTodayOrTomorrow(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(h, m, 0, 0);
  if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
  return candidate;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("today");
  const [sessions, setSessions] = useState<RevisionSession[]>([]);
  const [reviews, setReviews] = useState<ReviewLog[]>([]);
  const [reminder, setReminder] = useState<ReminderConfig>(defaultReminder);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const primaryTimerRef = useRef<number | null>(null);
  const secondaryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const existing = loadSessions();
    setSessions(existing ?? generatePlan(new Date(), 90));
    setReviews(loadReviews());
    setReminder(loadReminder());
  }, []);

  useEffect(() => {
    if (!sessions.length) return;
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => saveReviews(reviews), [reviews]);
  useEffect(() => saveReminder(reminder), [reminder]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  const todaySessions = useMemo(
    () => sessions.filter((s) => s.date === todayYmd()).sort((a, b) => a.id.localeCompare(b.id)),
    [sessions]
  );

  const [nextExam, setNextExam] = useState<(typeof EXAMS)[number] | null>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    const exam = EXAMS.find((e) => new Date(e.dateTime) >= new Date()) ?? null;
    setNextExam(exam);
    setDaysLeft(exam ? Math.ceil((+new Date(exam.dateTime) - +new Date()) / (24 * 60 * 60 * 1000)) : null);
  }, []);

  const prompt = todaySessions
    .map((s) => `${SUBJECTS.find((x) => x.id === s.subjectId)?.name} ${s.plannedMinutes}m`)
    .join(" + ");

  function updateSession(id: string, patch: Partial<RevisionSession>) {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function promptInt(message: string, fallback: string) {
    return window.prompt(message, fallback) || fallback;
  }

  function sendReminder(message?: string) {
    if (!("Notification" in window)) return;
    Notification.requestPermission().then((perm) => {
      if (perm !== "granted") return;
      const body = message ?? (prompt ? `Tonight: ${prompt}` : "No sessions scheduled today");
      new Notification("Revision Tracker", { body });
    });
  }

  useEffect(() => {
    if (primaryTimerRef.current) window.clearTimeout(primaryTimerRef.current);
    if (secondaryTimerRef.current) window.clearTimeout(secondaryTimerRef.current);

    const primaryAt = nextTimeTodayOrTomorrow(reminder.primaryTime);
    const primaryDelay = +primaryAt - +new Date();

    primaryTimerRef.current = window.setTimeout(() => {
      const message = prompt
        ? `Today: ${prompt}`
        : "No sessions are planned today. Open the app and regenerate if needed.";
      sendReminder(message);
    }, Math.max(primaryDelay, 0));

    if (reminder.secondaryEnabled) {
      const secondaryAt = nextTimeTodayOrTomorrow("20:00");
      const secondaryDelay = +secondaryAt - +new Date();
      secondaryTimerRef.current = window.setTimeout(() => {
        const doneCount = sessions.filter((s) => s.date === todayYmd() && s.status === "done").length;
        if (doneCount === 0) {
          sendReminder(prompt ? `No sessions completed yet. Start: ${prompt}` : "No completed revision yet.");
        }
      }, Math.max(secondaryDelay, 0));
    }

    return () => {
      if (primaryTimerRef.current) window.clearTimeout(primaryTimerRef.current);
      if (secondaryTimerRef.current) window.clearTimeout(secondaryTimerRef.current);
    };
  }, [prompt, reminder, sessions]);

  function completeSession(session: RevisionSession) {
    const before = Number(promptInt("Confidence before (1-5)", "3"));
    const after = Number(promptInt("Confidence after (1-5)", "4"));
    const raw = (window.prompt("RAG status (red/amber/green)", "green") || "green").toLowerCase();
    const trafficLight = raw === "red" || raw === "amber" || raw === "green" ? raw : "green";
    const note = window.prompt("Quick note", "") || "";

    updateSession(session.id, {
      status: "done",
      actualMinutes: Number(promptInt("Actual minutes", String(session.plannedMinutes)))
    });
    setReviews((prev) => [
      ...prev,
      {
        sessionId: session.id,
        confidenceBefore: before,
        confidenceAfter: after,
        trafficLight,
        note
      }
    ]);
  }

  function markMissed(session: RevisionSession) {
    setSessions((prev) => {
      const missed = prev.find((s) => s.id === session.id);
      if (!missed) return prev;
      const withMissed = prev.map((s) => (s.id === session.id ? { ...s, status: "missed" as const } : s));
      return rescheduleMissedSession(withMissed, { ...missed, status: "missed" });
    });
  }

  function snoozeSession(session: RevisionSession) {
    setSessions((prev) => rescheduleMissedSession(prev, session, new Date(session.date)));
  }

  const grouped = useMemo(() => {
    const map = new Map<string, RevisionSession[]>();
    sessions.forEach((s) => {
      map.set(s.date, [...(map.get(s.date) || []), s]);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [sessions]);

  const progress = useMemo(() => {
    return SUBJECTS.map((subject) => {
      const bySub = sessions.filter((s) => s.subjectId === subject.id);
      const done = bySub.filter((s) => s.status === "done");
      const minutesDone = done.reduce((sum, s) => sum + s.actualMinutes, 0);
      const rate = bySub.length ? Math.round((done.length / bySub.length) * 100) : 0;
      const last = done.at(-1)?.date || "—";
      const reviewRows = reviews.filter((r) => bySub.some((s) => s.id === r.sessionId));
      const trend = reviewRows.length
        ? (
            reviewRows.reduce((sum, r) => sum + (r.confidenceAfter - r.confidenceBefore), 0) /
            reviewRows.length
          ).toFixed(1)
        : "0.0";
      return { subject: subject.name, minutesDone, rate, last, trend };
    });
  }, [reviews, sessions]);

  function moveDraggedSessionToDate(date: string) {
    if (!draggingId) return;
    setSessions((prev) => prev.map((s) => (s.id === draggingId ? { ...s, date, status: "planned" } : s)));
    setDraggingId(null);
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl p-4 md:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Revision Tracker</h1>
          <p className="text-sm text-slate-300">Single-student exam-led planner</p>
        </div>
        <div className="flex gap-2">
          {(["today", "plan", "progress"] as Tab[]).map((t) => (
            <button
              key={t}
              className={`button ${tab === t ? "bg-indigo-500" : "bg-slate-800 hover:bg-slate-700"}`}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {tab === "today" && (
        <section className="space-y-4">
          <div className="card">
            <p className="text-sm text-slate-400">Next exam</p>
            <h2 className="text-xl font-semibold">{nextExam?.title ?? "No upcoming exam"}</h2>
            {nextExam && (
              <p className="text-sm text-slate-300">
                {formatDate(nextExam.dateTime)} · {daysLeft} day(s) left
              </p>
            )}
          </div>
          <div className="card">
            <p className="mb-2 text-sm text-slate-400">Tonight prompt</p>
            <p>{prompt ? `Tonight: ${prompt}` : "No sessions today"}</p>
            <div className="mt-3 flex flex-wrap gap-4">
              <button className="button bg-emerald-600" onClick={() => sendReminder()}>
                Send reminder now
              </button>
              <label className="text-sm">
                Primary reminder:
                <input
                  type="time"
                  className="ml-2 rounded bg-slate-800 px-2 py-1"
                  value={reminder.primaryTime}
                  onChange={(e) => setReminder({ ...reminder, primaryTime: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={reminder.secondaryEnabled}
                  onChange={(e) => setReminder({ ...reminder, secondaryEnabled: e.target.checked })}
                />
                Enable 20:00 fallback reminder
              </label>
            </div>
          </div>
          <div className="space-y-3">
            {todaySessions.map((s) => {
              const subject = SUBJECTS.find((x) => x.id === s.subjectId)!;
              return (
                <div key={s.id} className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{subject.name}</h3>
                      <p className="text-sm text-slate-300">
                        {s.topic} · {s.plannedMinutes}m
                      </p>
                    </div>
                    <span className="rounded-full px-2 py-1 text-xs" style={{ background: subject.color }}>
                      {subject.priorityWeight.toFixed(1)}×
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="button bg-sky-700" onClick={() => updateSession(s.id, { status: "in_progress" })}>
                      Start
                    </button>
                    <button className="button bg-emerald-700" onClick={() => completeSession(s)}>
                      Done
                    </button>
                    <button className="button bg-amber-700" onClick={() => snoozeSession(s)}>
                      Snooze
                    </button>
                    <button className="button bg-rose-700" onClick={() => markMissed(s)}>
                      Mark missed
                    </button>
                    <span className="text-sm text-slate-300">Status: {s.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === "plan" && (
        <section className="space-y-4">
          <div className="card flex flex-wrap items-center justify-between gap-2">
            <p>Auto-generated weighted/exam-led plan with cap-aware rescheduling.</p>
            <button className="button bg-violet-700" onClick={() => setSessions(generatePlan(new Date(), 90))}>
              Reset & regenerate plan
            </button>
          </div>
          {grouped.map(([date, rows]) => (
            <div
              key={date}
              className="card"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => moveDraggedSessionToDate(date)}
            >
              <h3 className="mb-2 font-semibold">{formatDate(date)}</h3>
              <p className="mb-2 text-xs text-slate-400">
                Planned: {plannedMinutesForDate(sessions, date)} minutes
              </p>
              <div className="space-y-2">
                {rows.map((s) => (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={() => setDraggingId(s.id)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-800 p-2 text-sm"
                  >
                    <span>
                      {SUBJECTS.find((x) => x.id === s.subjectId)?.name} · {s.plannedMinutes}m · {s.status}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        className="rounded bg-slate-700 px-2 py-1"
                        value={s.date}
                        onChange={(e) => updateSession(s.id, { date: e.target.value })}
                      />
                      <button className="button bg-slate-700" onClick={() => snoozeSession(s)}>
                        Move smart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === "progress" && (
        <section className="grid gap-3 md:grid-cols-2">
          {progress.map((row) => (
            <div key={row.subject} className="card">
              <h3 className="font-semibold">{row.subject}</h3>
              <p className="text-sm text-slate-300">Minutes completed: {row.minutesDone}</p>
              <p className="text-sm text-slate-300">Completion rate: {row.rate}%</p>
              <p className="text-sm text-slate-300">Last revised: {row.last}</p>
              <p className="text-sm text-slate-300">Confidence trend: {row.trend}</p>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
