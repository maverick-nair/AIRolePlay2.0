import type { ClaimRung } from "./scenario";

// The claim ladder: what an organisation may say about this instrument, and the evidence that earns it.
// Reports always state the current rung. Nothing above the current rung is ever claimed in UI copy.
export const CLAIM_LADDER: Record<
  ClaimRung,
  { title: string; claim: string; requires: string; fitFor: string }
> = {
  1: {
    title: "Structured feedback",
    claim: "Evidence linked feedback on observable behaviours, scored by rules from authored indicators.",
    requires:
      "Published scoring method, behavioural indicators with anchors, every rating traced to quoted turns.",
    fitFor: "Development conversations and self directed practice. Not for talent decisions.",
  },
  2: {
    title: "Calibrated",
    claim: "AI ratings agree with trained human assessors at a published level per skill.",
    requires:
      "A calibration set of several hundred transcripts rated by trained assessors, with agreement reported per skill.",
    fitFor: "Readiness signals and development planning with human review available.",
  },
  3: {
    title: "Consistent and fair",
    claim: "Scores are stable across parallel scenarios and fair across groups, language and modality.",
    requires:
      "Parallel form reliability, repeated run consistency, and subgroup analysis by first language, region, accent and text versus voice.",
    fitFor: "Programme level readiness decisions with human oversight.",
  },
  4: {
    title: "Validated",
    claim: "A validated readiness assessment with convergent and criterion evidence.",
    requires:
      "Agreement with assessment centre or 360 ratings, criterion evidence against performance data, a technical manual and third party review.",
    fitFor: "Development decisions and, with client specific validation, talent decisions.",
  },
};

export function claimLadder(current: ClaimRung) {
  return ([1, 2, 3, 4] as const).map((rung) => ({
    rung,
    ...CLAIM_LADDER[rung],
    state: rung < current ? "earned" : rung === current ? "current" : "ahead",
  }));
}
