import type {
  Band,
  IndicatorHit,
  InstrumentSkill,
  Objective,
  Scenario,
  TurnClassification,
} from "./scenario";

// ---------- Consequence tables (authored; the only place bands become numbers) ----------

export const BAND_POINTS: Record<Band, number> = { Strong: 10, Adequate: 7, Weak: 4, Harmful: 1 };
// An indicator the scenario gave an opportunity for, but the participant never showed, counts as Weak.
export const NOT_OBSERVED_POINTS = 4;

export const XP_RULES = {
  onTopic: 25,
  perObjective: 45,
  maxLengthBonus: 20,
  substantiveWords: 4,
  streakThreshold: 3,
  streakMultiplier: 1.5,
} as const;

export const LEVELS = [
  { name: "Newcomer", floor: 0 },
  { name: "Emerging", floor: 300 },
  { name: "Competent", floor: 500 },
  { name: "Proficient", floor: 700 },
  { name: "Role Model", floor: 900 },
] as const;

export const LEVEL_SPAN = 200;

export function levelFor(xp: number): (typeof LEVELS)[number] {
  let level: (typeof LEVELS)[number] = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.floor) level = l;
  return level;
}

// The level after the one this XP sits in, or null at the top.
export function nextLevel(xp: number): (typeof LEVELS)[number] | null {
  return LEVELS.find((l) => l.floor > xp) ?? null;
}

// Share of the way from this level's floor to the next level's floor (the top level uses LEVEL_SPAN).
export function levelProgress(xp: number) {
  const level = levelFor(xp);
  const span = (nextLevel(xp)?.floor ?? level.floor + LEVEL_SPAN) - level.floor;
  return Math.min(100, Math.max(0, ((xp - level.floor) / span) * 100));
}

// Progress is only what saved runs earned: every learner starts at zero XP on their first run.
export function totalXp(runs: { startXp: number; endXp: number }[]): number {
  return runs.reduce((sum, r) => sum + Math.max(0, r.endXp - r.startXp), 0);
}

// Rank on a board of other players' points, 1 being the top. Ties rank alongside.
export function rankAmong(xp: number, others: number[]): number {
  return 1 + others.filter((p) => p > xp).length;
}

// ---------- Indicator and skill scores ----------

export type IndicatorResult = {
  indicatorId: string;
  label: string;
  observed: boolean;
  band: Band | null;
  points: number;
  evidence: (IndicatorHit & { turnIndex: number })[];
};

export type SkillResult = {
  id: string;
  name: string;
  desc: string;
  weight: number;
  score: number;
  indicators: IndicatorResult[];
  hasHarmful: boolean;
  observedCount: number;
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Several hits on one indicator average their points, so one good turn cannot mask a harmful one.
export function scoreIndicator(
  indicator: InstrumentSkill["indicators"][number],
  hits: IndicatorResult["evidence"],
) {
  if (hits.length === 0)
    return {
      indicatorId: indicator.id,
      label: indicator.label,
      observed: false,
      band: null,
      points: NOT_OBSERVED_POINTS,
      evidence: [],
    } satisfies IndicatorResult;
  const points = mean(hits.map((h) => BAND_POINTS[h.band]));
  const band = bandFromPoints(points);
  return { indicatorId: indicator.id, label: indicator.label, observed: true, band, points, evidence: hits };
}

export function bandFromPoints(points: number): Band {
  if (points >= 8.5) return "Strong";
  if (points >= 5.5) return "Adequate";
  if (points >= 2.5) return "Weak";
  return "Harmful";
}

export function scoreSkill(skill: InstrumentSkill, classifications: TurnClassification[]): SkillResult {
  const hitsByIndicator = new Map<string, IndicatorResult["evidence"]>();
  for (const c of classifications)
    for (const h of c.hits) {
      const list = hitsByIndicator.get(h.indicatorId) ?? [];
      list.push({ ...h, turnIndex: c.turnIndex });
      hitsByIndicator.set(h.indicatorId, list);
    }
  const indicators = skill.indicators.map((i) => scoreIndicator(i, hitsByIndicator.get(i.id) ?? []));
  const raw = mean(indicators.map((i) => i.points));
  return {
    id: skill.id,
    name: skill.name,
    desc: skill.desc,
    weight: skill.weight,
    score: Math.min(10, Math.max(1, Math.round(raw))),
    indicators,
    hasHarmful: indicators.some((i) => i.band === "Harmful"),
    observedCount: indicators.filter((i) => i.observed).length,
  };
}

export type ScoreSummary = {
  skills: SkillResult[];
  overall: number;
  weightedAverage: number;
  passed: boolean;
  // Share of indicators that were actually observed. Low coverage means a short or narrow conversation.
  coverage: number;
};

export function scoreSession(scenario: Scenario, classifications: TurnClassification[]): ScoreSummary {
  const skills = scenario.instrument.skills.map((s) => scoreSkill(s, classifications));
  const totalWeight = skills.reduce((a, s) => a + s.weight, 0);
  const weightedAverage = skills.reduce((a, s) => a + s.score * s.weight, 0) / totalWeight;
  const overall = Math.min(10, Math.max(1, Math.round(weightedAverage)));
  const indicatorCount = skills.reduce((a, s) => a + s.indicators.length, 0);
  const observed = skills.reduce((a, s) => a + s.observedCount, 0);
  return {
    skills,
    overall,
    weightedAverage,
    passed: overall >= scenario.passScore,
    coverage: indicatorCount ? observed / indicatorCount : 0,
  };
}

// ---------- Objectives ----------

export function objectiveMet(objective: Objective, classification: TurnClassification) {
  return classification.hits.some(
    (h) => objective.indicatorIds.includes(h.indicatorId) && (h.band === "Strong" || h.band === "Adequate"),
  );
}

// ---------- Per turn gamification (pure; the session page only renders the result) ----------

export type TurnOutcome = {
  gain: number;
  multiplied: boolean;
  nextStreak: number;
  newlyMet: boolean[];
  earnedBadges: string[];
  levelledUp: boolean;
  onTopic: boolean;
  note: string;
};

export function turnOutcome(input: {
  scenario: Scenario;
  text: string;
  classification: TurnClassification;
  metObjectives: boolean[];
  streak: number;
  xp: number;
  badges: string[];
}): TurnOutcome {
  const { scenario, text, classification, metObjectives, streak, xp, badges } = input;
  const objectives = scenario.instrument.objectives;
  const matched = objectives.map((o) => objectiveMet(o, classification));
  const newlyMet = matched.map((m, i) => m && !metObjectives[i]);
  const newCount = newlyMet.filter(Boolean).length;
  const words = text.split(/\s+/).filter(Boolean);
  const onTopic = classification.onTopic || classification.hits.length > 0;

  // Relevance gate: a line that neither engages the scenario nor shows a behaviour earns nothing.
  if (!onTopic) {
    return {
      gain: 0,
      multiplied: false,
      nextStreak: 0,
      newlyMet: objectives.map(() => false),
      earnedBadges: [],
      levelledUp: false,
      onTopic: false,
      note: "Off-topic. Steer back to the negotiation",
    };
  }

  const nextStreak = streak + 1;
  const multiplied = nextStreak >= XP_RULES.streakThreshold;
  const substantive = words.length >= XP_RULES.substantiveWords;
  const base =
    XP_RULES.onTopic +
    newCount * XP_RULES.perObjective +
    (substantive ? Math.min(words.length, XP_RULES.maxLengthBonus) : 0);
  const gain = Math.round(base * (multiplied ? XP_RULES.streakMultiplier : 1));

  const earned: string[] = [];
  const add = (id: string) => {
    if (!badges.includes(id) && !earned.includes(id)) earned.push(id);
  };
  add("icebreaker");
  if (multiplied) add("hot-streak");
  newlyMet.forEach((m, i) => m && add(objectives[i].badgeId));
  if (objectives.length && metObjectives.every((v, i) => v || newlyMet[i])) add("clean-sweep");

  const firstNew = newlyMet.indexOf(true);
  return {
    gain,
    multiplied,
    nextStreak,
    newlyMet,
    earnedBadges: earned,
    levelledUp: levelFor(xp + gain).name !== levelFor(xp).name,
    onTopic: true,
    note: firstNew >= 0 ? `${objectives[firstNew].label} complete` : "On topic",
  };
}

// ---------- Practice hints (in the moment nudges, never scores) ----------

export function hintFor(scenario: Scenario, recent: TurnClassification[]): string | null {
  const last = recent[recent.length - 1];
  if (!last) return null;
  const weak = last.hits.find((h) => h.band === "Weak" || h.band === "Harmful");
  if (weak) {
    for (const s of scenario.instrument.skills)
      for (const i of s.indicators) if (i.id === weak.indicatorId) return i.coaching.hint;
  }
  // Two consecutive turns without any probing behaviour: nudge towards a question.
  const probing = (c: TurnClassification) => c.hits.some((h) => h.indicatorId.startsWith("probing"));
  if (recent.length >= 2 && !probing(last) && !probing(recent[recent.length - 2])) {
    const probe = scenario.instrument.skills
      .flatMap((s) => s.indicators)
      .find((i) => i.id.startsWith("probing"));
    return probe?.coaching.hint ?? null;
  }
  return null;
}

// Practice runs still available on a scenario. Never negative; the store may hold more runs than
// the cap if the cap was lowered after they were saved.
export function practiceRunsLeft(used: number, max: number): number {
  return Math.max(0, max - used);
}
