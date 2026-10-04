export type Page = "landing" | "session" | "summary";

export type { SessionStats } from "./domain/report";

export type Line = { speaker: string; time: string; text: string; tag?: "strength" | "gap" };

export type ReportTab = "overview" | "evidence" | "comm" | "transcript" | "method";
