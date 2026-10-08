import type { Band, IndicatorHit, Scenario, TurnClassification } from "../domain/scenario";
import { opportunityFor } from "../domain/report";
import type {
  ClassifyRequest,
  ClassifyResponse,
  NpcRequest,
  NpcResponse,
  Providers,
  ReportNarrative,
  ReportRequest,
} from "./types";

// Offline providers. The classifier is a transparent heuristic: pattern rules per indicator that
// produce bands and quote the turn as evidence. It exists so the product runs without a key, and so
// tests are deterministic. It is not a validated scorer and the report says so.

const META = { provider: "mock", model: null, promptVersion: null };

const TOPIC_RX =
  /\b(price|pricing|cost|discount|quote|contract|renew|term|budget|value|saving|roi|deal|offer|proposal|competitor|freightwise|cfo|support|platform|volume|scope|margin|invoice|deadline|friday|delivery|deliveries|partner|commit|agreement|number|spend|depot|migration|onboarding|penalt)/i;

type Rule = {
  indicatorId: string;
  strong?: RegExp;
  adequate?: RegExp;
  weak?: RegExp;
  harmful?: RegExp;
  notes: Partial<Record<Band, string>>;
};

const QUESTION = /\?/;
const OPEN_Q =
  /\b(what|how|why|tell me|walk me|describe|explain|share|which|help me understand|could you|can you)\b[^?]*\?/i;
const OFFER =
  /\b(\d{1,2}\s?%|percent|discount|off\b|reduce|lower the price|price match|match (it|that|them|their|the|your)( (price|quote|offer|number|rate))?|beat (their|the|that) (price|quote|offer))/i;
const CONDITION =
  /\b(if you|if we|in return|in exchange|provided|on condition|when you|once you|for that)\b/i;
const RUDE =
  /\b(ridiculous|stupid|waste of time|take it or leave it|your problem|not my problem|whatever)\b/i;

const RULES: Rule[] = [
  {
    indicatorId: "strategy.anchor",
    strong:
      /\b(before (we|i) (get|talk|discuss) (into|about)? ?(numbers|price|pricing)|outcomes?|what success looks like|value (first|before))/i,
    weak: /\b(what (price|number) (do you|would you) need|how much (lower|less)|(we|i) (can|could|will|'ll) (match|beat) (it|that|them|their|the|your))/i,
    harmful: /\b(i can (give|do|offer) (you )?\d{1,2}\s?%)/i,
    notes: {
      Strong: "Held the conversation on outcomes before price.",
      Weak: "Moved to price as soon as it came up.",
      Harmful: "Volunteered a discount before any value or question.",
    },
  },
  {
    indicatorId: "strategy.conditional-concession",
    strong: new RegExp(
      `(${OFFER.source}).*(${CONDITION.source})|(${CONDITION.source}).*(${OFFER.source})`,
      "i",
    ),
    weak: OFFER,
    notes: {
      Strong: "Tied the concession to something in return.",
      Weak: "Concession offered with nothing asked in return. It sets a new floor.",
    },
  },
  {
    indicatorId: "strategy.batna",
    strong:
      /\b(switching|migration|migrat|move \d+ depots|moving \d+ depots|onboarding|total cost|hidden cost|what (does|is) (their|the freightwise|that) quote include)/i,
    adequate: /\b(risk of (switching|moving|changing)|change (is|would be) (costly|risky))/i,
    harmful: /\b(freightwise (is|are) (cheap|junk|terrible|a joke)|they (will|would) let you down)\b/i,
    notes: {
      Strong: "Tested the real cost of the alternative instead of taking the quote at face value.",
      Adequate: "Raised switching risk in general terms.",
      Harmful: "Disparaged the competitor rather than testing the comparison.",
    },
  },
  {
    indicatorId: "strategy.next-steps",
    strong:
      /\b(by (monday|tuesday|wednesday|thursday|friday)|(i'll|i will) (send|have|get) (you )?(a |the )?(proposal|numbers|figures|options)|set (up )?a call|walk (your|the) cfo through)/i,
    adequate: /\b(follow up|next step|get back to you|circle back)\b/i,
    harmful: /\b(sign (today|now|this)|need (a|your) signature (today|now))\b/i,
    notes: {
      Strong: "Agreed a concrete next step with a date and proposed involving the decision maker.",
      Adequate: "Mentioned a follow up without an owner or date.",
      Harmful: "Pressured for a signature on the spot.",
    },
  },
  {
    indicatorId: "value.business-impact",
    strong:
      /\b(\$\s?\d|\d+k\b|\d+\s?%\s?(fewer|less|reduction|drop|improvement)|late deliveries|penalt|saved you|avoided)/i,
    adequate: /\b(outcome|impact|results?|performance|efficien|reliab|uptime)\b/i,
    notes: {
      Strong: "Tied the platform to a quantified business outcome.",
      Adequate: "Named outcomes without quantifying them.",
    },
  },
  {
    indicatorId: "value.client-evidence",
    strong: /\b(your (own )?(numbers|data|figures)|since go-live|your late deliveries|14\s?%|310k|\$310)/i,
    adequate: /\b(over (the last|three) years?|what (you've|you have) (seen|achieved)|track record)\b/i,
    notes: {
      Strong: "Used Northwind's own evidence rather than a generic claim.",
      Adequate: "Referred to past results without specifics.",
    },
  },
  {
    indicatorId: "value.differentiation",
    strong:
      /\b(dedicated (account )?team|their quote (doesn't|does not|excludes)|not included in|standard support only|what (you'd|you would) (lose|give up))/i,
    adequate: /\b(unlike|different(iat)?|only we|what sets us apart|our (support|team|service))\b/i,
    harmful: /\b(freightwise (is|are) (cheap|junk|terrible|a joke))\b/i,
    notes: {
      Strong: "Named what the rival quote leaves out and why it matters.",
      Adequate: "Named a differentiator without putting a value on it.",
      Harmful: "Criticised the competitor instead of differentiating.",
    },
  },
  {
    indicatorId: "objection.composure",
    strong:
      /\b(i understand|that's fair|fair enough|i hear you|understood|appreciate you (being|telling))\b/i,
    harmful: RUDE,
    notes: { Strong: "Stayed composed when pressure was applied.", Harmful: "Tone turned hostile." },
  },
  {
    indicatorId: "objection.acknowledge",
    strong:
      /\b(sounds like (you're|you are) (under|being asked)|i can see (why|that|the pressure)|that's a (real|fair|legitimate) (concern|point|pressure)|i understand the pressure)/i,
    adequate: /\b(i understand|i hear you|fair point|appreciate that)\b/i,
    harmful: /\b(that's not (true|right|fair)|you're wrong|with respect, no)\b/i,
    notes: {
      Strong: "Named and validated the pressure before responding.",
      Adequate: "Brief acknowledgement before moving to the answer.",
      Harmful: "Dismissed the concern.",
    },
  },
  {
    indicatorId: "objection.reframe",
    strong:
      /\b(what (does|is) (the |their |that )?(freightwise |rival |competitor |other )?quote (include|cover)|what (would|does) your cfo need|what('s| is) (behind|driving)|before (i|we) (talk|get to|discuss) price)/i,
    adequate: /\b(risk|total cost|more than (the|a) (headline|number|price))\b/i,
    weak: /\b(our (price|pricing) (reflects|is based on|covers)|we're worth it|you get what you pay for)\b/i,
    notes: {
      Strong: "Explored the objection with a question before responding.",
      Adequate: "Reframed the quote around risk and total cost.",
      Weak: "Defended the price straight away instead of exploring the objection.",
    },
  },
  {
    indicatorId: "listening.paraphrase",
    strong:
      /\b(so (what i'm hearing|if i understand|you're saying|your cfo)|it sounds like|to (summarise|summarize|recap)|if i've got (this|that) right|let me (play|reflect) (that|this) back)/i,
    adequate: /\b(you mentioned|you said|as you said|you noted|earlier you)\b/i,
    notes: {
      Strong: "Paraphrased the client's position and checked it.",
      Adequate: "Referred back to what the client said.",
    },
  },
  {
    indicatorId: "listening.cues",
    strong:
      /\b(longer term|price protection|multi-year|three-year|3-year|you'd need|you said you'd|what would (that|a longer term) look like)/i,
    notes: { Strong: "Picked up the conditional buying signal and explored it." },
  },
  {
    indicatorId: "listening.build",
    adequate:
      /\b(you (mentioned|said|raised|talked about)|building on (that|what you)|to your point|coming back to)\b/i,
    notes: { Adequate: "Built the reply on something the client said." },
  },
  {
    indicatorId: "probing.open-questions",
    strong: OPEN_Q,
    adequate: QUESTION,
    notes: { Strong: "Asked an open question.", Adequate: "Asked a closed question." },
  },
  {
    indicatorId: "probing.follow-up",
    strong:
      /\b(what('s| is) (behind|driving|underneath)|why is that|how (will|would) (that|it) be (measured|judged)|tell me more|say more|what else)\b/i,
    notes: { Strong: "Followed up beyond the first answer." },
  },
  {
    indicatorId: "probing.decision-criteria",
    strong:
      /\b(who (else )?(signs|decides|is involved|needs to approve|sign off)|how (will|does) (your cfo|the board|the decision)|what (criteria|does (he|she|your cfo) (judge|measure|need to see)))/i,
    adequate: /\bcfo\b.*\?/i,
    notes: {
      Strong: "Surfaced how the decision will be judged and by whom.",
      Adequate: "Asked about the CFO without confirming the criteria.",
    },
  },
  {
    indicatorId: "relationship.empathy",
    strong:
      /\b(i want to help you|on your side|help you (do|show|get) that|i get that you|i know (you're|you are) under)/i,
    adequate: /\b(appreciate|understand (your|the) (position|situation|pressure)|that must be)\b/i,
    harmful: /\b(that's your problem|not my (concern|problem)|you (chose|created) this)\b/i,
    notes: {
      Strong: "Positioned yourself on the client's side of the table.",
      Adequate: "Showed understanding of the client's situation.",
      Harmful: "Blamed the client for the pressure.",
    },
  },
  {
    indicatorId: "relationship.commitment",
    strong:
      /\b(executive sponsor|quarterly (business )?review|i('ll| will) personally|my (direct|personal) (line|number)|dedicated migration team)/i,
    adequate: /\b(we('ll| will) (support|be there|look after)|ongoing support|our commitment)\b/i,
    notes: {
      Strong: "Offered a personal commitment the client can hold you to.",
      Adequate: "Mentioned ongoing support in general terms.",
    },
  },
  {
    indicatorId: "relationship.tone",
    strong:
      /\b(together|partnership|partner with you|let's (work|look|find|figure|build|explore)|work with you|we can (work|find|figure|build|explore|look))\b/i,
    harmful: RUDE,
    notes: { Strong: "Kept the tone collaborative.", Harmful: "Tone turned hostile." },
  },
];

const quoteOf = (text: string) => (text.length > 180 ? `${text.slice(0, 177).trimEnd()}...` : text);

export function classifyHeuristically(
  scenario: Scenario,
  text: string,
  turnIndex: number,
): TurnClassification {
  const known = new Set(scenario.instrument.skills.flatMap((s) => s.indicators.map((i) => i.id)));
  const hits: IndicatorHit[] = [];
  for (const r of RULES) {
    if (!known.has(r.indicatorId)) continue;
    let band: Band | null = null;
    if (r.harmful?.test(text)) band = "Harmful";
    else if (r.strong?.test(text)) band = "Strong";
    else if (r.adequate?.test(text)) band = "Adequate";
    else if (r.weak?.test(text)) band = "Weak";
    if (band)
      hits.push({ indicatorId: r.indicatorId, band, quote: quoteOf(text), note: r.notes[band] ?? "" });
  }
  return { turnIndex, onTopic: TOPIC_RX.test(text), hits };
}

class MockClassifier {
  async classify(req: ClassifyRequest): Promise<ClassifyResponse> {
    const turn = req.transcript[req.turnIndex];
    const classification = classifyHeuristically(req.scenario, turn?.text ?? "", req.turnIndex);
    return { classification, agreement: null, meta: META };
  }
}

const PRESSURE = [
  " And I don't have all afternoon.",
  " Friday hasn't moved.",
  " Give me something concrete.",
];

class MockNpc {
  async reply(req: NpcRequest): Promise<NpcResponse> {
    const { scenario, playerTurn, difficulty } = req;
    const incident = scenario.stimulus.incidents.find((i) => i.afterPlayerTurn === playerTurn);
    const lines = scenario.stimulus.mockReplies;
    let text = incident ? incident.mockLine : lines[(playerTurn - 1) % lines.length];
    if (difficulty === "hardball" && !incident) text += PRESSURE[playerTurn % PRESSURE.length];
    return { text, incidentId: incident?.id ?? null, meta: META };
  }
}

class MockReporter {
  async write(req: ReportRequest): Promise<ReportNarrative> {
    const indicators = req.skills.flatMap((s) => s.indicators.map((i) => ({ ...i, skill: s.name })));
    const strong = indicators.filter((i) => i.band === "Strong");
    const gaps = indicators.filter((i) => i.band === "Weak" || i.band === "Harmful");
    const unseen = indicators.filter((i) => i.band === null);
    const list = (xs: string[]) =>
      xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;

    const overall: string[] = [];
    if (strong.length)
      overall.push(
        `The behaviours that reached the Strong anchor were: ${list(strong.slice(0, 3).map((i) => i.label.toLowerCase()))}. Each was observed in your own words in the transcript and carried the conversation forward.`,
      );
    else overall.push("Few of the assessed behaviours reached the Strong anchor in this conversation.");
    if (gaps.length)
      overall.push(
        `The main development area is ${list(gaps.slice(0, 2).map((i) => i.label.toLowerCase()))}. The evidence tab quotes the turns where this showed.`,
      );
    if (unseen.length) {
      // Name the moment the chance came up, so "not observed" points at a turn, not at a template.
      const first = req.scenario.stimulus.persona.name.split(" ")[0];
      const cited = unseen.flatMap((i) => {
        const o = opportunityFor(req.scenario, req.transcript, i.indicatorId);
        if (o.kind !== "moment") return [];
        const said = o.quote.split(/(?<=[.?!])\s/)[0];
        return [`${i.label.toLowerCase()} at ${o.time}, when ${first} said "${said}"`];
      });
      overall.push(
        `${unseen.length} of ${indicators.length} indicators were not observed, and unobserved indicators count as Weak.${cited.length ? ` The clearest missed chances: ${list(cited.slice(0, 2))}` : ""}`,
      );
    }

    const coaching = new Map(
      req.scenario.instrument.skills.flatMap((s) => s.indicators.map((i) => [i.id, i.coaching] as const)),
    );
    const priorities = [...gaps, ...unseen].slice(0, 4);
    const recommendations = (priorities.length ? priorities : indicators.slice(0, 3)).map((i) => ({
      title: i.label,
      detail: coaching.get(i.indicatorId)?.recommendation ?? "",
    }));

    const skillFeedback: Record<string, string> = {};
    for (const s of req.skills) {
      const shown = s.indicators
        .filter((i) => i.band === "Strong" || i.band === "Adequate")
        .map((i) => i.label);
      const missed = s.indicators
        .filter((i) => i.band !== "Strong" && i.band !== "Adequate")
        .map((i) => i.label);
      skillFeedback[s.skillId] = [
        shown.length
          ? `Observed in your words: ${list(shown.map((l) => l.toLowerCase()))}.`
          : "None of this skill's indicators reached the Adequate anchor.",
        missed.length
          ? `Not shown or below the anchor: ${list(missed.map((l) => l.toLowerCase()))}.`
          : "Every indicator for this skill was demonstrated.",
      ].join(" ");
    }

    return { overall, recommendations, skillFeedback, language: null, meta: META };
  }
}

export const mockProviders: Providers = {
  name: "mock",
  npc: new MockNpc(),
  classifier: new MockClassifier(),
  reporter: new MockReporter(),
};
