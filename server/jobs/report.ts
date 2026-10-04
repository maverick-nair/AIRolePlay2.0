import { z } from "zod";
import type { JobConfig } from "../config";
import type { Runner } from "../llm/runner";
import { fill, loadPrompt } from "../prompts";
import type { SessionTurn } from "../../src/domain/scenario";
import { mockProviders } from "../../src/providers/mock";
import { LanguageAnalysis, type ReportNarrative, type ReportRequest } from "../../src/providers/types";

// Structured output for the report writer. skillFeedback is an array here (structured output
// grammars prefer closed shapes) and becomes a record on the way out.
export const ReportNarrativeOutput = z.object({
  overall: z.array(z.string()),
  recommendations: z.array(z.object({ title: z.string(), detail: z.string() })),
  skillFeedback: z.array(z.object({ skillId: z.string(), feedback: z.string() })),
  language: LanguageAnalysis,
});
type ReportNarrativeOutput = z.infer<typeof ReportNarrativeOutput>;

const transcriptText = (t: SessionTurn[]) => t.map((x) => `${x.time} ${x.speaker}: ${x.text}`).join("\n");

export function makeReportJob(runner: Runner, config: JobConfig) {
  const prompt = loadPrompt("report", config.promptVersion);

  return async function report(req: ReportRequest): Promise<ReportNarrative> {
    const user = fill(prompt.body, {
      title: req.scenario.title,
      playerRole: req.scenario.stimulus.player.role,
      overall: String(req.overall),
      skills: req.skills
        .map(
          (s) =>
            `### ${s.name} (id ${s.skillId}): ${s.score}/10\n` +
            s.indicators
              .map(
                (i) =>
                  `- ${i.label}: ${i.band ?? "Not observed"}${i.quotes.length ? `\n  evidence: ${i.quotes.map((q) => `"${q}"`).join(" | ")}` : ""}`,
              )
              .join("\n"),
        )
        .join("\n\n"),
      transcript: transcriptText(req.transcript),
    });

    const outcome = await runner.run<ReportNarrativeOutput>("report", config, async (client, route) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await client.parse({
          system: "You write evidence bound skills reports. Answer only in the requested structure.",
          messages: [{ role: "user", content: user }],
          maxTokens: 6000,
          effort: route.effort ?? "medium",
          schema: ReportNarrativeOutput,
          schemaName: "ReportNarrativeOutput",
        });
        if (r.refused) return { value: null, usage: r.usage, model: r.model };
        if (r.parsed && r.parsed.overall.length && r.parsed.recommendations.length)
          return { value: r.parsed, usage: r.usage, model: r.model };
      }
      return {
        value: null,
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        model: client.model,
      };
    });

    if (outcome.value === null) return mockProviders.reporter.write(req);
    const skillFeedback: Record<string, string> = {};
    for (const s of outcome.value.skillFeedback) skillFeedback[s.skillId] = s.feedback;
    return {
      overall: outcome.value.overall,
      recommendations: outcome.value.recommendations,
      skillFeedback,
      language: outcome.value.language,
      meta: { provider: outcome.route!.provider, model: outcome.model, promptVersion: prompt.version },
    };
  };
}
