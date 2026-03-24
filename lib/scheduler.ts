import { EXAMS, SUBJECTS } from "./data";
import { RevisionSession, Subject } from "./types";

const PRE_MAY_MONTH_INDEX = 4; // May
const PRE_MAY_SWITCH_DAY = 10;

const toYmd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, days: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};

function byDateAsc<T extends { dateTime: string }>(rows: T[]) {
  return rows.sort((a, b) => +new Date(a.dateTime) - +new Date(b.dateTime));
}

function byPriorityDesc<T extends { priorityWeight: number }>(rows: T[]) {
  return rows.sort((a, b) => b.priorityWeight - a.priorityWeight);
}

function isAfterSwitch(date: Date) {
  return date >= new Date(date.getFullYear(), PRE_MAY_MONTH_INDEX, PRE_MAY_SWITCH_DAY);
}

function dailyCap(date: Date) {
  if (isAfterSwitch(date)) return 90;
  const dow = date.getDay();
  return dow === 0 || dow === 6 ? 60 : 45;
}

function findSubject(id: string): Subject {
  return SUBJECTS.find((s) => s.id === id) ?? SUBJECTS[0];
}

function upcomingExams(from: Date) {
  return byDateAsc(EXAMS.filter((e) => new Date(e.dateTime) >= from));
}

function weightedPreMaySubject(
  date: Date,
  rollingMinutes: Map<string, number>,
  recentSubjects: string[]
): string {
  const candidates = SUBJECTS.map((s) => {
    const planned = rollingMinutes.get(s.id) ?? 0;
    // lower score = more under-served vs weight, therefore more urgent
    const score = planned / s.priorityWeight;
    return { id: s.id, score, weight: s.priorityWeight };
  }).sort((a, b) => a.score - b.score || b.weight - a.weight);

  const highestPriorityIds = SUBJECTS.filter((s) => s.priorityWeight >= 2).map((s) => s.id);
  const highestSeenRecently = recentSubjects.some((id) => highestPriorityIds.includes(id));
  if (!highestSeenRecently && date.getDay() !== 0) {
    return highestPriorityIds[0];
  }

  return candidates[0].id;
}

function postMayFocus(date: Date): { primary: string; secondary?: string; split: [number, number?] } {
  const upcoming = upcomingExams(date);
  if (!upcoming.length) {
    return { primary: "music", split: [90] };
  }

  const first = upcoming[0];
  const sameDay = upcoming.filter((x) => x.dateTime.slice(0, 10) === first.dateTime.slice(0, 10));
  if (sameDay.length > 1) {
    const ranked = byPriorityDesc(sameDay.map((e) => findSubject(e.subjectId)));
    return { primary: ranked[0].id, secondary: ranked[1]?.id ?? ranked[0].id, split: [45, 45] };
  }

  const within48h = upcoming.find((e) => {
    const diff = +new Date(e.dateTime) - +new Date(first.dateTime);
    return diff > 0 && diff <= 48 * 60 * 60 * 1000;
  });

  if (within48h) {
    return { primary: first.subjectId, secondary: within48h.subjectId, split: [60, 30] };
  }

  return { primary: first.subjectId, split: [90] };
}

function shouldProtectMusic(date: Date, primarySubjectId: string) {
  const musicExam = EXAMS.find((e) => e.subjectId === "music" && new Date(e.dateTime) >= date);
  if (!musicExam || primarySubjectId === "music") return false;
  return +new Date(musicExam.dateTime) - +date <= 2 * 24 * 60 * 60 * 1000;
}

export function generatePlan(start: Date, days = 60): RevisionSession[] {
  const sessions: RevisionSession[] = [];
  const rollingMinutes = new Map<string, number>();
  const recentSubjects: string[] = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const ymd = toYmd(date);

    if (!isAfterSwitch(date)) {
      const minutes = dailyCap(date);
      const subjectId = weightedPreMaySubject(date, rollingMinutes, recentSubjects.slice(-2));

      sessions.push({
        id: `${ymd}-${subjectId}`,
        date: ymd,
        subjectId,
        plannedMinutes: minutes,
        actualMinutes: 0,
        topic: `Weighted revision: ${findSubject(subjectId).name}`,
        status: "planned"
      });

      rollingMinutes.set(subjectId, (rollingMinutes.get(subjectId) ?? 0) + minutes);
      recentSubjects.push(subjectId);
      continue;
    }

    const focus = postMayFocus(date);

    sessions.push({
      id: `${ymd}-${focus.primary}`,
      date: ymd,
      subjectId: focus.primary,
      plannedMinutes: focus.split[0],
      actualMinutes: 0,
      topic: `Exam-led focus: ${findSubject(focus.primary).name}`,
      status: "planned"
    });

    if (focus.secondary && focus.split[1]) {
      sessions.push({
        id: `${ymd}-${focus.secondary}-split`,
        date: ymd,
        subjectId: focus.secondary,
        plannedMinutes: focus.split[1],
        actualMinutes: 0,
        topic: `Split prep: ${findSubject(focus.secondary).name}`,
        status: "planned"
      });
    }

    if (shouldProtectMusic(date, focus.primary)) {
      const dayRows = sessions.filter((s) => s.date === ymd);
      const musicAlready = dayRows.some((s) => s.subjectId === "music");
      if (!musicAlready) {
        const maxRow = dayRows.sort((a, b) => b.plannedMinutes - a.plannedMinutes)[0];
        if (maxRow && maxRow.plannedMinutes >= 60) {
          maxRow.plannedMinutes -= 30;
          sessions.push({
            id: `${ymd}-music-protected`,
            date: ymd,
            subjectId: "music",
            plannedMinutes: 30,
            actualMinutes: 0,
            topic: "Protected Music block",
            status: "planned"
          });
        }
      }
    }
  }

  return sessions;
}

export function moveSessionToTomorrow(session: RevisionSession): RevisionSession {
  const next = addDays(new Date(session.date), 1);
  return { ...session, date: toYmd(next), status: "planned" };
}

export function rescheduleMissedSession(
  sessions: RevisionSession[],
  target: RevisionSession,
  fromDate = new Date(target.date)
): RevisionSession[] {
  const candidate = { ...target, status: "planned" as const };

  for (let offset = 1; offset <= 21; offset++) {
    const date = addDays(fromDate, offset);
    const ymd = toYmd(date);
    const cap = dailyCap(date);
    const used = sessions
      .filter((s) => s.id !== target.id && s.date === ymd)
      .reduce((sum, s) => sum + s.plannedMinutes, 0);

    if (used + candidate.plannedMinutes <= cap) {
      return sessions.map((s) => (s.id === target.id ? { ...candidate, date: ymd } : s));
    }

    const dayRows = sessions
      .filter((s) => s.date === ymd && s.id !== target.id)
      .sort((a, b) => findSubject(a.subjectId).priorityWeight - findSubject(b.subjectId).priorityWeight);

    const lowPriority = dayRows[0];
    if (lowPriority && findSubject(lowPriority.subjectId).priorityWeight < findSubject(candidate.subjectId).priorityWeight) {
      const movedLow = moveSessionToTomorrow(lowPriority);
      const updated = sessions.map((s) => {
        if (s.id === lowPriority.id) return movedLow;
        if (s.id === target.id) return { ...candidate, date: ymd };
        return s;
      });
      return updated;
    }
  }

  return sessions.map((s) => (s.id === target.id ? moveSessionToTomorrow(candidate) : s));
}

export function plannedMinutesForDate(sessions: RevisionSession[], ymd: string) {
  return sessions.filter((s) => s.date === ymd).reduce((sum, s) => sum + s.plannedMinutes, 0);
}
