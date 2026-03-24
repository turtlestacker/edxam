import { Exam, Subject } from "./types";

export const SUBJECTS: Subject[] = [
  { id: "music", name: "Music", priorityWeight: 2, color: "#f43f5e" },
  { id: "history", name: "History", priorityWeight: 2, color: "#fb923c" },
  { id: "chemistry", name: "Chemistry", priorityWeight: 2, color: "#f59e0b" },
  { id: "biology", name: "Biology", priorityWeight: 1.5, color: "#10b981" },
  { id: "english-literature", name: "English Literature", priorityWeight: 1.5, color: "#0ea5e9" },
  { id: "maths", name: "Maths", priorityWeight: 1, color: "#6366f1" },
  { id: "english-language", name: "English Language", priorityWeight: 1, color: "#8b5cf6" },
  { id: "physics", name: "Physics", priorityWeight: 1, color: "#a855f7" },
  { id: "computer-science", name: "Computer Science", priorityWeight: 1, color: "#14b8a6" },
  { id: "spanish", name: "Spanish", priorityWeight: 1, color: "#ef4444" }
];

const year = new Date().getFullYear();
const iso = (m: number, d: number) => new Date(year, m - 1, d, 9, 0, 0).toISOString();

export const EXAMS: Exam[] = [
  { id: "eng-lit-1", subjectId: "english-literature", title: "English Literature Paper 1", dateTime: iso(5, 11), paper: "Paper 1" },
  { id: "bio-1", subjectId: "biology", title: "Biology Paper 1", dateTime: iso(5, 12), paper: "Paper 1" },
  { id: "hist-1", subjectId: "history", title: "History Paper 1", dateTime: iso(5, 15), paper: "Paper 1" },
  { id: "chem-1", subjectId: "chemistry", title: "Chemistry Paper 1", dateTime: iso(5, 18), paper: "Paper 1" },
  { id: "eng-lit-2", subjectId: "english-literature", title: "English Literature Paper 2", dateTime: iso(5, 19), paper: "Paper 2" },
  { id: "cs-1", subjectId: "computer-science", title: "Computer Science Paper", dateTime: iso(5, 19), paper: "Paper" },
  { id: "eng-lang", subjectId: "english-language", title: "English Language", dateTime: iso(6, 5), paper: "Paper" },
  { id: "music-1", subjectId: "music", title: "Music", dateTime: iso(6, 5), paper: "Paper" },
  { id: "spanish-1", subjectId: "spanish", title: "Spanish", dateTime: iso(6, 9), paper: "Paper" },
  { id: "hist-2", subjectId: "history", title: "History Paper 2", dateTime: iso(6, 9), paper: "Paper 2" },
  { id: "spanish-writing", subjectId: "spanish", title: "Spanish Writing", dateTime: iso(6, 16), paper: "Writing" }
].sort((a, b) => +new Date(a.dateTime) - +new Date(b.dateTime));
