import { z } from "zod";
import type { JobConfig } from "../config";
import type { Runner } from "../llm/runner";
import { fill, loadPrompt } from "../prompts";
import { Band, type IndicatorHit, type Scenario, type SessionTurn } from "../../src/domain/scenario";
import { BAND_POINTS } from "../../src/domain/scoring";
import { mockProviders } from "../../src/providers/mock";
import type { ClassifyRequest, ClassifyResponse } from "../../src/providers/types";

// Structured output the classifier model must produce. Bands only, never numbers.
export const ClassifierOutput = z.object({
  onTopic: z.boolean(),
  hits: z.array(z.object({ indicatorId: z.string(), band: Band, quote: z.string(), note: z.string() })),
});
type ClassifierOutput = z.infer<typeof ClassifierOutput>;

const transcriptText = (t: SessionTurn[]) => t.map((x) => `${x.time} ${x.speaker}: ${x.text}`).join("\n");

function indicatorText(scenario: Scenario) {
  return scenario.instrument.skills
    .map(
      (s) =>
        `### ${s.name}\n` +
        s.indicators
          .map(
            (i) =>
              `- id: ${i.id}\n  behaviour: ${i.label}\n  Strong: ${i.anchors.strong}\n  Adequate: ${i.anchors.adequate}\n  Weak: ${i.anchors.weak}\n  Harmful: ${i.anchors.harmful}`,
          )
          .join("\n"),
    )
    .join("\n\n");
}

// When two passes disagree, the more conservative band is kept. Agreement is the share of
// indicator and band pairs both passes produced identically.
export function reconcile(a: IndicatorHit[], b: IndicatorHit[]) {
  const byId = new Map<string, IndicatorHit>();
  for (const h of a) byId.set(h.indicatorId, h);
  let matches = 0;
  for (const h of b) {
    const prev = byId.get(h.indicatorId);
    if (!prev) byId.set(h.indicatorId, h);
    else if (prev.band === h.band) matches += 1;
    else if (BAND_POINTS[h.band] < BAND_POINTS[prev.band]) byId.set(h.indicatorId, h);
  }
  const union = byId.size || 1;
  return { hits: [...byId.values()], agreement: matches / union };
}

export function makeClassifyJob(runner: Runner, config: JobConfig, dualPass: boolean) {
  const prompt = loadPrompt("classify", config.promptVersion);

  async function pass(req: ClassifyRequest) {
    const { scenario, transcript, turnIndex } = req;
    const turn = transcript[turnIndex];
    const p = scenario.stimulus.persona;
    const known = new Set(scenario.instrument.skills.flatMap((s) => s.indicators.map((i) => i.id)));
    const user = fill(prompt.body, {
      title: scenario.title,
      playerRole: scenario.stimulus.player.role,
      personaName: p.name,
      personaRole: p.role,
      personaOrganisation: p.organisation,
      indicators: indicatorText(scenario),
      transcript: transcriptText(transcript.slice(0, turnIndex)),
      turn: `${turn.time} ${turn.speaker}: ${turn.text}`,
    });
    return runner.run<ClassifierOutput>("classify", config, async (client, route) => {
      // One retry on a parse failure, then the runner moves to the fallback route.
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await client.parse({
          system: "You are a trained behavioural assessor. Answer only in the requested structure.",
          messages: [{ role: "user", content: user }],
          maxTokens: 2000,
          effort: route.effort ?? "medium",
          schema: ClassifierOutput,
          schemaName: "ClassifierOutput",
        });
        if (r.refused) return { value: null, usage: r.usage, model: r.model };
        if (r.parsed) {
          return {
            value: { onTopic: r.parsed.onTopic, hits: r.parsed.hits.filter((h) => known.has(h.indicatorId)) },
            usage: r.usage,
            model: r.model,
          };
        }
      }
      return {
        value: null,
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        model: client.model,
      };
    });
  }

  return async function classify(req: ClassifyRequest): Promise<ClassifyResponse> {
    const first = await pass(req);
    if (first.value === null) return mockProviders.classifier.classify(req);
    let hits = first.value.hits;
    let agreement: number | null = null;
    if (dualPass) {
      const second = await pass(req);
      if (second.value !== null) ({ hits, agreement } = reconcile(first.value.hits, second.value.hits));
    }
    return {
      classification: { turnIndex: req.turnIndex, onTopic: first.value.onTopic || hits.length > 0, hits },
      agreement,
      meta: { provider: first.route!.provider, model: first.model, promptVersion: prompt.version },
    };
  };
}
