export type Subject = {
  id: string;
  name: string;
  priorityWeight: number;
  color: string;
};

export type Exam = {
  id: string;
  subjectId: string;
  title: string;
  dateTime: string;
  paper: string;
};

export type RevisionSessionStatus = "planned" | "in_progress" | "done" | "missed";

export type RevisionSession = {
  id: string;
  date: string;
  subjectId: string;
  plannedMinutes: number;
  actualMinutes: number;
  topic: string;
  status: RevisionSessionStatus;
};

export type ReviewLog = {
  sessionId: string;
  confidenceBefore: number;
  confidenceAfter: number;
  trafficLight: "red" | "amber" | "green";
  note: string;
};

export type ReminderConfig = {
  primaryTime: string;
  secondaryEnabled: boolean;
};
