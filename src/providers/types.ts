import { z } from "zod";
import { Difficulty, Mode, Scenario, SessionTurn, TurnClassification } from "../domain/scenario";

// Every external AI capability sits behind one of these interfaces. The mock implementations keep
// the app fully usable offline; the http implementations talk to the local API server, which is the
// only place that holds provider keys.

export const NpcRequest = z.object({
  scenario: Scenario,
  mode: Mode,
  difficulty: Difficulty,
  transcript: z.array(SessionTurn),
  playerTurn: z.number().int().min(1),
});
export type NpcRequest = z.infer<typeof NpcRequest>;

export const NpcResponse = z.object({
  text: z.string().min(1),
  incidentId: z.string().nullable(),
  meta: z.object({
    provider: z.string(),
    model: z.string().nullable(),
    promptVersion: z.string().nullable(),
  }),
});
export type NpcResponse = z.infer<typeof NpcResponse>;

export const ClassifyRequest = z.object({
  scenario: Scenario,
  transcript: z.array(SessionTurn),
  turnIndex: z.number().int().min(0),
});
export type ClassifyRequest = z.infer<typeof ClassifyRequest>;

export const ClassifyResponse = z.object({
  classification: TurnClassification,
  // Agreement between two independent classification passes, when the server ran both.
  agreement: z.number().min(0).max(1).nullable(),
  meta: z.object({
    provider: z.string(),
    model: z.string().nullable(),
    promptVersion: z.string().nullable(),
  }),
});
export type ClassifyResponse = z.infer<typeof ClassifyResponse>;

export const LanguageAnalysis = z.object({
  cefr: z.object({
    overall: z.string(),
    band: z.string(),
    summary: z.string(),
    dimensions: z.array(z.object({ name: z.string(), level: z.string(), note: z.string() })),
  }),
  sentiment: z.array(z.object({ label: z.string(), pct: z.number().min(0).max(100) })),
  tone: z.array(z.object({ label: z.string(), pct: z.number().min(0).max(100) })),
  clarity: z.object({ score: z.number().min(0).max(10), note: z.string() }),
});
export type LanguageAnalysis = z.infer<typeof LanguageAnalysis>;

export const SkillEvidenceSummary = z.object({
  skillId: z.string(),
  name: z.string(),
  score: z.number(),
  indicators: z.array(
    z.object({
      indicatorId: z.string(),
      label: z.string(),
      band: z.string().nullable(),
      quotes: z.array(z.string()),
    }),
  ),
});

export const ReportRequest = z.object({
  scenario: Scenario,
  transcript: z.array(SessionTurn),
  skills: z.array(SkillEvidenceSummary),
  overall: z.number(),
});
export type ReportRequest = z.infer<typeof ReportRequest>;

export const ReportNarrative = z.object({
  overall: z.array(z.string()).min(1),
  recommendations: z.array(z.object({ title: z.string(), detail: z.string() })).min(1),
  skillFeedback: z.record(z.string(), z.string()),
  // Descriptive language analysis. Only an LLM provider can supply it; the mock returns null.
  language: LanguageAnalysis.nullable(),
  meta: z.object({
    provider: z.string(),
    model: z.string().nullable(),
    promptVersion: z.string().nullable(),
  }),
});
export type ReportNarrative = z.infer<typeof ReportNarrative>;

export interface NpcProvider {
  reply(req: NpcRequest): Promise<NpcResponse>;
}
export interface TurnClassifier {
  classify(req: ClassifyRequest): Promise<ClassifyResponse>;
}
export interface ReportWriter {
  write(req: ReportRequest): Promise<ReportNarrative>;
}
export interface Providers {
  name: string;
  npc: NpcProvider;
  classifier: TurnClassifier;
  reporter: ReportWriter;
}
