import { z } from "zod";

// A scenario is two things that must stay separable:
//   stimulus:   what the participant experiences (persona, opening, critical incidents, hidden interests)
//   instrument: what is measured (skills, behavioural indicators, anchors, objectives)
// Assessment mode freezes the stimulus so every participant meets an equivalent challenge.
// Practice mode may vary difficulty and persona, but always scores against the same instrument.

export const Band = z.enum(["Strong", "Adequate", "Weak", "Harmful"]);
export type Band = z.infer<typeof Band>;

export const Mode = z.enum(["practice", "assessment"]);
export type Mode = z.infer<typeof Mode>;

export const Difficulty = z.enum(["measured", "firm", "hardball"]);
export type Difficulty = z.infer<typeof Difficulty>;

export const Indicator = z.object({
  id: z.string(),
  label: z.string(),
  // Behaviourally anchored rating scale: what each band looks like in this scenario.
  anchors: z.object({
    strong: z.string(),
    adequate: z.string(),
    weak: z.string(),
    harmful: z.string(),
  }),
  // Authored coaching copy. Reports quote this verbatim, never invented prose.
  coaching: z.object({
    recommendation: z.string(),
    drill: z.string(),
    hint: z.string(),
  }),
});
export type Indicator = z.infer<typeof Indicator>;

export const InstrumentSkill = z.object({
  id: z.string(),
  name: z.string(),
  desc: z.string(),
  weight: z.number().int().positive(),
  indicators: z.array(Indicator).min(1),
});
export type InstrumentSkill = z.infer<typeof InstrumentSkill>;

export const Objective = z.object({
  id: z.string(),
  label: z.string(),
  sub: z.string(),
  xp: z.number().int().positive(),
  badgeId: z.string(),
  // Completing an objective is behavioural: at least one listed indicator at Adequate or better.
  indicatorIds: z.array(z.string()).min(1),
});
export type Objective = z.infer<typeof Objective>;

export const CriticalIncident = z.object({
  id: z.string(),
  label: z.string(),
  // Fires when the persona replies to the player's Nth turn (1 based). 0 is the opening.
  afterPlayerTurn: z.number().int().min(0),
  // Directive for the LLM persona, and the exact line the scripted mock persona says.
  directive: z.string(),
  mockLine: z.string(),
});
export type CriticalIncident = z.infer<typeof CriticalIncident>;

export const ClaimRung = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export type ClaimRung = z.infer<typeof ClaimRung>;

export const Scenario = z.object({
  id: z.string(),
  version: z.string(),
  title: z.string(),
  category: z.string(),
  durationSeconds: z.number().int().positive(),
  passScore: z.number().int().min(1).max(10),
  stimulus: z.object({
    persona: z.object({
      name: z.string(),
      role: z.string(),
      organisation: z.string(),
      portraitAlt: z.string(),
      // The persona's real interests. Never shown to the participant in assessment mode.
      hiddenInterests: z.array(z.string()),
      styleByDifficulty: z.record(Difficulty, z.string()),
    }),
    player: z.object({ role: z.string(), goal: z.string(), challenge: z.string(), scene: z.string() }),
    opening: z.array(z.object({ speaker: z.string(), time: z.string(), text: z.string() })),
    incidents: z.array(CriticalIncident),
    // Lines the scripted mock persona cycles through between incidents.
    mockReplies: z.array(z.string()).min(1),
    mockDictation: z.string(),
  }),
  instrument: z.object({
    id: z.string(),
    version: z.string(),
    skills: z.array(InstrumentSkill).min(1),
    objectives: z.array(Objective),
    // Where this instrument sits on the claim ladder, and the evidence behind that position.
    claimRung: ClaimRung,
    evidenceSummary: z.array(z.string()),
    // Sample cohort data used until a backend supplies real peer statistics.
    peerBaseline: z.record(z.string(), z.number()),
  }),
});
export type Scenario = z.infer<typeof Scenario>;

export const SessionTurn = z.object({
  speaker: z.string(),
  time: z.string(),
  text: z.string(),
});
export type SessionTurn = z.infer<typeof SessionTurn>;

// What a classifier returns for one participant turn. Bands only, never numbers:
// the engine turns bands into scores through the authored consequence table.
export const IndicatorHit = z.object({
  indicatorId: z.string(),
  band: Band,
  quote: z.string(),
  note: z.string(),
});
export type IndicatorHit = z.infer<typeof IndicatorHit>;

export const TurnClassification = z.object({
  turnIndex: z.number().int().min(0),
  onTopic: z.boolean(),
  hits: z.array(IndicatorHit),
});
export type TurnClassification = z.infer<typeof TurnClassification>;

export function validateScenario(input: unknown): Scenario {
  const scenario = Scenario.parse(input);
  const indicatorIds = new Set(scenario.instrument.skills.flatMap((s) => s.indicators.map((i) => i.id)));
  for (const o of scenario.instrument.objectives)
    for (const id of o.indicatorIds)
      if (!indicatorIds.has(id)) throw new Error(`Objective ${o.id} references unknown indicator ${id}`);
  return scenario;
}
