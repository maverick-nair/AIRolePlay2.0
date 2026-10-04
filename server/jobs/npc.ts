import type { JobConfig } from "../config";
import type { Runner } from "../llm/runner";
import type { ChatMessage } from "../llm/types";
import { fill, loadPrompt } from "../prompts";
import { mockProviders } from "../../src/providers/mock";
import type { NpcRequest, NpcResponse } from "../../src/providers/types";

const PLAYER = "You";

export function makeNpcJob(runner: Runner, config: JobConfig) {
  const prompt = loadPrompt("npc", config.promptVersion);

  return async function npc(req: NpcRequest): Promise<NpcResponse> {
    const { scenario, mode, difficulty, transcript, playerTurn } = req;
    const incident = scenario.stimulus.incidents.find((i) => i.afterPlayerTurn === playerTurn);
    const p = scenario.stimulus.persona;
    const system = fill(prompt.body, {
      personaName: p.name,
      personaRole: p.role,
      personaOrganisation: p.organisation,
      scene: scenario.stimulus.player.scene,
      playerRole: scenario.stimulus.player.role,
      hiddenInterests: p.hiddenInterests.map((h) => `- ${h}`).join("\n"),
      style: p.styleByDifficulty[difficulty],
      modeRules:
        mode === "assessment"
          ? "This is a standardised assessment. Keep your position, pressure and concessions consistent with the directives you are given each turn. Do not volunteer information the participant has not asked for. Do not soften because the participant seems to struggle."
          : "This is practice. Respond naturally to what the participant does. Reward good questions with information and make poor moves cost something, so the participant can feel the difference.",
      incidentDirective: incident
        ? `Critical incident for this reply: ${incident.directive}`
        : "No scripted incident this turn. Respond to what the participant just said.",
    });
    const messages: ChatMessage[] = transcript.map((t) => ({
      role: t.speaker === PLAYER ? "user" : "assistant",
      content: t.text,
    }));

    const outcome = await runner.run("npc", config, async (client, route) => {
      const r = await client.complete({
        system,
        messages,
        maxTokens: 400,
        effort: route.effort ?? "low",
        cacheSystem: true,
      });
      return { value: r.refused || !r.text ? null : r.text, usage: r.usage, model: r.model };
    });

    if (outcome.value === null) return mockProviders.npc.reply(req);
    return {
      text: outcome.value,
      incidentId: incident?.id ?? null,
      meta: { provider: outcome.route!.provider, model: outcome.model, promptVersion: prompt.version },
    };
  };
}
