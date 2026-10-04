# Product strategy: AI RolePlay as assessment and as practice

This is the analysis the product is built on. It is written for KNOLSKAPE's position: AI RolePlay is the Experience product, Conversation AI is the Evaluate product, and both run on one skills ontology inside GENIE.

## Where the market is

Four camps are converging. Sales practice specialists (Hyperbound, Second Nature, Quantified, Awarathon) sell realistic buyer personas, voice first, with call scoring. Learning platforms bundle roleplay as a feature (Skillsoft CAISY, Sana inside Workday, Articulate, Yoodli). Simulation specialists (Attensi RealTalk, Mursion, Skillwell, Enparadigm) wrap roleplay in richer scenario worlds; Mursion keeps a human behind the avatar. Assessment incumbents (SHL, DDI, Korn Ferry, Mercer Mettl, Maki People) add conversational AI to instruments that already carry psychometric documentation. Within 18 months a decent roleplay will sit inside most LMS and sales enablement seats. A standalone "talk to an AI persona" product has no durable moat.

What competitors do well: realism and latency, scenario generation in minutes, CRM and call recording integrations, and (for the incumbents) validation language. Where gaps remain: almost nobody can show that a score measures what it claims. Single pass LLM scoring with no calibration set, no reliability statistics and no fairness analysis is the norm. Feedback is generic. Practice products count sessions, not improvement on a parallel form. Reports show ceiling effects. Voice emotion claims are unsupported by evidence and increasingly restricted by regulators.

### Table stakes, differentiators and defensible value

| Table stakes | Still differentiating | Defensible if done properly |
| --- | --- | --- |
| Voice and text, low latency, interruption | Standardised personas with fixed critical incidents | A documented instrument with published reliability and fairness evidence |
| Persona with goals, mood, objections | Evidence linked scoring: every rating traces to quoted turns | One skills ontology across assessment, practice, coaching and readiness dashboards |
| Scenario generation from a brief | Targeted retry from a chosen turn with persona state restored | Longitudinal first party data: the same person on parallel forms over months |
| Post session score and summary | Adaptive difficulty driven by the learner's weakest indicators | Authored scenario depth beyond sales |
| PDF, LMS and SSO, multilingual | Transfer evidence after practice | Governance: versioning, drift monitoring, audit trails, appeals |

Claims to treat as marketing until proven: "validated rubric" without a technical manual; emotion, confidence or empathy from voice; usage growth presented as learning; improvement measured on the same scenario the learner just repeated; "fair" without subgroup analysis; "realistic" measured by delight surveys.

## Assessment: an AI score is not an assessment until it behaves like one

1. **Construct definition.** Each skill has behavioural indicators written as anchored rating scales, scenario specific.
2. **Standardised stimulus.** Fixed critical incidents, fixed hidden interests, bounded adaptivity. Full improvisation is a practice feature.
3. **Scoring architecture.** The model is a classifier, not the judge of record. Bands with quotes; rules compute scores; two independent passes with a documented reconciliation rule; human review for disagreements.
4. **Reliability.** AI to human agreement per skill on a calibration set of several hundred transcripts; AI to AI consistency across runs and model versions; parallel form reliability across scenarios.
5. **Validity.** Content (expert mapping), convergent (assessment centre, 360, manager ratings), discriminant (not measuring English proficiency, verbosity or typing speed), criterion (performance data, eventually).
6. **Fairness.** Subgroup analysis by gender, age, first language, region, accent and modality. Length and fluency must not proxy for the skill.
7. **Explainability and contestability.** Every rating traces to quoted turns; participants can appeal to human review.
8. **Security.** One attempt, identity verification, prompt injection defence, hidden rubric.
9. **Governance.** Technical manual, versioning with re-validation, drift monitoring, human oversight, alignment with SIOP Principles, ISO 10667, the EEOC Uniform Guidelines and the EU AI Act (employment evaluation is high risk).

Conclusion: today's AI RolePlay scores, across the market, are credible for development conversations and readiness signals, and not yet for promotion, hiring or certification decisions. The product that gets there first with evidence owns the Evaluate category.

## Practice: safety, repetition and visible improvement

Psychological safety (private by default, challenging without humiliation), unlimited attempts, targeted retry with persona state restored, deliberate practice driven by the weakest indicators, two feedback timings (light hints in the moment, full debrief after), adaptive difficulty, multiple personas for transfer, coaching handoff with the transcript and evidence attached, and longitudinal tracking on parallel forms. Evidence for a practice claim is pre and post measurement on parallel forms with a comparison group and transfer measures. Session counts are engagement, not learning.

### How the product differs by mode

| Dimension | Assessment | Practice |
| --- | --- | --- |
| Attempts | One, identity verified | Unlimited, with rewind |
| Persona | Standardised incidents, bounded adaptivity | Fully adaptive, selectable difficulty |
| Criteria | Hidden | Visible on request |
| Feedback timing | After only | Optional hints plus debrief |
| Score | Banded, evidence linked, dual scored, review available | Formative, trend on parallel forms |
| Report audience | Participant and organisation | Participant first, shared by choice |
| Validation burden | Technical manual, reliability, fairness, drift | Pre and post, transfer evidence |

## Recommendations

**Capabilities.** Scenario model separating stimulus from instrument; standardised persona engine; evidence linked dual pass scoring with rules computing bands; targeted retry with state restore; adaptive difficulty and personas; reports quoting the transcript for every rating with one specific drill per priority; parallel forms per scenario; longitudinal readiness on the ontology; governance layer; authoring that generates indicators and anchors but requires expert sign off; transcript only voice scoring with consent.

**Priorities.** First six months: the instrument layer, calibration set with trained assessors for the top scenarios, targeted retry and parallel forms in practice. Six to twelve months: standardised assessment mode, technical manual, subgroup fairness analysis, a pre and post study with a client cohort. Twelve to twenty four months: convergent validity with design partners, criterion evidence where a client shares performance data, drift monitoring in production, third party review. Never add voice emotion inference.

**The claim ladder.** Only say what the current rung supports. Rung 1: structured, evidence linked feedback. Rung 2: AI ratings agree with trained assessors at a published level per skill. Rung 3: consistent across scenarios and fair across groups. Rung 4: a validated readiness assessment. Every report states its rung. This product ships at rung 1 and says so everywhere a score appears.

**Positioning.** Compete on the loop, not the chat: Conversation AI assesses on a validated instrument, AI RolePlay lets the person practise the same indicators safely, AI Koach coaches from the evidence, GenieTracker shows readiness moving over time. Lead with transparency: published methods, evidence linked reports, honest claim rungs, a governance story that answers the EU AI Act and SIOP questions before procurement asks. Leverage fifteen years of authored scenarios beyond sales. Against Mursion: standardisation at machine scale. Against the sales specialists: behavioural skills beyond sales plus an assessment grade instrument. Against SHL and DDI: the practice loop they cannot offer.

The single most defensible move is to be the vendor whose assessment claims an industrial psychologist can audit and whose practice claims an L&D leader can see in a pre and post chart.
