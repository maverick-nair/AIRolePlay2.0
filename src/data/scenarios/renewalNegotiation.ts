import { validateScenario } from "../../domain/scenario";

// Scenario content for the renewal negotiation with Margaret Hale. Stimulus and instrument are
// authored separately so assessment mode can freeze the stimulus while practice varies it.
export const renewalNegotiation = validateScenario({
  id: "renewal-negotiation",
  version: "2.0.0",
  title: "Renewal Negotiation with Margaret Hale",
  category: "Sales Negotiation",
  durationSeconds: 900,
  passScore: 8,
  stimulus: {
    persona: {
      name: "Margaret Hale",
      role: "VP Procurement",
      organisation: "Northwind Freight",
      portraitAlt: "Margaret Hale, VP of Procurement, in a white shirt",
      hiddenInterests: [
        "Her CFO has asked for visible savings this year and she needs something she can take upstairs",
        "Her operations team is worried about migrating 40 depots mid season",
        "She would accept a longer term if the price is protected and she gets a reason to commit",
        "She values a supplier who treats her as a partner, not an account",
      ],
      styleByDifficulty: {
        measured:
          "Firm but fair. You give the player room to ask questions and you reward good ones with information.",
        firm: "Sharp and well prepared. You push back on vague claims and return to price whenever the player stalls.",
        hardball:
          "Impatient and sceptical. You interrupt rambling, repeat the deadline, and concede nothing without a concrete trade.",
      },
    },
    player: {
      role: "You are a senior account executive at Cloudline and have owned the Northwind account since it was signed. The contract is worth $1.2M a year and your quarter depends on it. You know the platform has cut their late deliveries, but you also know your price is the highest in the market.",
      goal: "Renew the contract on terms that protect your margin and the relationship. Find out what is really driving Margaret's position, trade value rather than hand out discounts, and leave with an agreed next step that both of you can take back to your leadership.",
      challenge:
        "Margaret lays down a competitor quote 22% below yours and a Friday deadline. Hold your ground without losing her, and turn an ultimatum into a real negotiation.",
      scene:
        "Northwind's glass-walled boardroom, three days before the contract expires. Margaret has done her homework, brought a rival quote, and made it clear she is willing to walk. Her team relies on your platform every day, but her CFO only sees the invoice. What you uncover in the next few minutes decides whether this becomes a price war or a partnership.",
    },
    opening: [
      {
        speaker: "Margaret Hale",
        time: "0:12",
        text: "Thanks for coming in. I'll be direct. We like the platform, but I have a mandate to cut spend this year and I can't renew at the current rate.",
      },
      {
        speaker: "You",
        time: "0:34",
        text: "I appreciate you being upfront, Margaret. Before we get into numbers, can you tell me what a successful renewal looks like from your CFO's side?",
      },
      {
        speaker: "Margaret Hale",
        time: "1:02",
        text: "Lower cost, plain and simple. And frankly, I have a quote from Freightwise that comes in 22% under yours. If you can't match it by Friday, we're moving.",
      },
      {
        speaker: "You",
        time: "1:28",
        text: "I understand. Our pricing reflects the uptime and support you've had over three years, and I'd hate to see that put at risk over a headline number.",
      },
      {
        speaker: "Margaret Hale",
        time: "2:05",
        text: "Uptime is expected. I need something I can take upstairs. So what can you actually do on price?",
      },
    ],
    incidents: [
      {
        id: "competitor-detail",
        label: "The fine print",
        afterPlayerTurn: 1,
        directive:
          "Reveal that the Freightwise quote covers only the core platform and standard support, with onboarding extra, but stress that your CFO only reads the total.",
        mockLine:
          "Their quote covers the core platform and standard support. No dedicated account team, and onboarding is extra. But my CFO doesn't read the fine print, he reads the total.",
      },
      {
        id: "savings-demand",
        label: "Show me the savings",
        afterPlayerTurn: 2,
        directive:
          "Demand hard savings expressed in Northwind's own numbers. Make clear that a bigger invoice than the alternative is all you can see right now.",
        mockLine:
          "If you could show me hard savings in our own numbers, I might have something to work with. Right now all I have is a bigger invoice than the alternative.",
      },
      {
        id: "longer-term-hint",
        label: "The buying signal",
        afterPlayerTurn: 3,
        directive:
          "Drop a conditional buying signal: you are not against a longer term, but you would need price protection and a real reason to commit. Do not elaborate unless asked.",
        mockLine:
          "I'm not against a longer term, but I'd need price protection and a real reason to commit. What would you be willing to put on the table for that?",
      },
      {
        id: "cfo-deadline",
        label: "Friday is real",
        afterPlayerTurn: 5,
        directive:
          "Repeat that your CFO wants an answer by Friday and ask exactly what the player will put in writing and by when.",
        mockLine:
          "Let me be clear, Friday is real. My CFO wants an answer. What exactly are you going to put in writing, and when will I have it?",
      },
    ],
    mockReplies: [
      "That's helpful. But my CFO sees an invoice that's 22% higher than the alternative. Savings are harder to see than costs.",
      "Go on. I'm listening, but I need specifics, not reassurance.",
      "Ten is a start. It doesn't close the gap, though.",
      "Weekend support is nice, but it's not what moves the number.",
      "Now that's something I can take to my CFO. Send me the numbers in writing.",
    ],
    mockDictation:
      "That's fair, Margaret. Before I talk price, help me understand what the Freightwise quote includes, and what your CFO would need to see to justify staying with us?",
  },
  instrument: {
    id: "renewal-negotiation-instrument",
    version: "1.0.0",
    claimRung: 1,
    evidenceSummary: [
      "Scoring method published: bands from authored indicators, points from a fixed consequence table, no model generated numbers.",
      "Every rating traces to quoted turns in the transcript.",
      "No calibration set, agreement statistics, parallel forms or fairness analysis yet.",
    ],
    peerBaseline: {
      strategy: 6.4,
      value: 6.9,
      objection: 6.1,
      listening: 6.3,
      probing: 5.8,
      relationship: 7.0,
    },
    skills: [
      {
        id: "strategy",
        name: "Negotiation Strategy",
        desc: "Planning and steering the negotiation: knowing your walk-away point, sequencing concessions, and trading value instead of giving it away.",
        weight: 20,
        indicators: [
          {
            id: "strategy.anchor",
            label: "Holds the value anchor before moving on price",
            anchors: {
              strong:
                "Reframes the conversation around outcomes and holds list price through the first push.",
              adequate: "Mentions value before discussing price, but drifts to price quickly.",
              weak: "Moves to price as soon as it is raised.",
              harmful: "Volunteers a discount before any value or question.",
            },
            coaching: {
              recommendation: "Set the agenda around outcomes before any number is discussed.",
              drill:
                "Write a 30 second value opening for your next three renewals and say it before any price talk.",
              hint: "You moved to price early. Anchor on outcomes first.",
            },
          },
          {
            id: "strategy.conditional-concession",
            label: "Trades concessions for something in return",
            anchors: {
              strong:
                "Every movement on price is tied to term, volume, scope or a reference, in the form If you can do X, I can do Y.",
              adequate: "Asks for something in return, but after the concession is already on the table.",
              weak: "Offers a discount without a condition attached.",
              harmful: "Stacks several unconditional concessions in one turn.",
            },
            coaching: {
              recommendation:
                "Never concede without a trade. Name what you need in return before you move on price, and tie it to details the client has already shared.",
              drill:
                "Rewrite three concessions from past deals as If you can do X, I can do Y. Say them aloud until the conditional feels natural.",
              hint: "That concession had no condition. Ask for something back.",
            },
          },
          {
            id: "strategy.batna",
            label: "Tests the real cost of the alternative",
            anchors: {
              strong:
                "Quantifies switching cost and migration risk and asks whether the rival quote includes them.",
              adequate: "Mentions switching risk in general terms.",
              weak: "Takes the competitor quote at face value.",
              harmful: "Disparages the competitor instead of testing the comparison.",
            },
            coaching: {
              recommendation:
                "Treat a rival quote as a comparison to test, not a price to beat. Ask what it includes and what switching will cost.",
              drill: "List five hidden costs of switching for your product and turn each into a question.",
              hint: "Test the alternative: what does the rival quote include, and what does switching cost?",
            },
          },
          {
            id: "strategy.next-steps",
            label: "Closes with owned next steps",
            anchors: {
              strong:
                "Agrees a specific next step with an owner and a date, and proposes a joint session with the decision maker.",
              adequate: "Agrees a follow up without an owner or date.",
              weak: "Ends without a next step.",
              harmful: "Pressures for a signature on the spot.",
            },
            coaching: {
              recommendation:
                "Close every call with who does what by when, and ask to present to the person who signs.",
              drill:
                "End your next five calls by stating owner, action and date out loud and confirming them.",
              hint: "Lock in a next step: who, what, by when.",
            },
          },
        ],
      },
      {
        id: "value",
        name: "Value Articulation",
        desc: "Connecting the offer to the client's own business outcomes, so the conversation is about return on investment rather than cost alone.",
        weight: 20,
        indicators: [
          {
            id: "value.business-impact",
            label: "Links the platform to business outcomes",
            anchors: {
              strong:
                "Ties the platform to outcomes the CFO cares about, such as fewer late deliveries and lower penalties, with a dollar figure.",
              adequate: "Names outcomes but does not quantify them.",
              weak: "Lists features rather than outcomes.",
              harmful: "Makes unverifiable claims about results.",
            },
            coaching: {
              recommendation:
                "Quantify value in the client's own numbers and bring it back every time price resurfaces.",
              drill: "Prepare a one line value statement: Because of X, you saved Y, which is worth Z.",
              hint: "Translate that feature into an outcome with a number.",
            },
          },
          {
            id: "value.client-evidence",
            label: "Uses the client's own evidence",
            anchors: {
              strong:
                "Quotes Northwind's own performance data, such as the 14% drop in late deliveries, and what it is worth.",
              adequate: "Refers to past results without specifics.",
              weak: "Uses generic claims about the product.",
              harmful: "Invents figures the client would not recognise.",
            },
            coaching: {
              recommendation:
                "A savings figure the buyer can repeat upstairs is far harder to set aside than a general claim.",
              drill:
                "For your next three accounts, pull one client owned metric and one dollar translation before the call.",
              hint: "Use their numbers: what has the platform measurably done for Northwind?",
            },
          },
          {
            id: "value.differentiation",
            label: "Differentiates on what the rival lacks",
            anchors: {
              strong:
                "Names what the rival quote excludes, such as the dedicated team or onboarding, and quantifies its value.",
              adequate: "Names a differentiator without quantifying it.",
              weak: "Does not distinguish the offer from the competitor's.",
              harmful: "Criticises the competitor personally.",
            },
            coaching: {
              recommendation:
                "Put a value on what only you provide, so the comparison is total cost, not headline price.",
              drill:
                "Price three of your differentiators in the client's terms and practise stating them in one sentence.",
              hint: "What does your offer include that the rival quote leaves out?",
            },
          },
        ],
      },
      {
        id: "objection",
        name: "Objection Handling",
        desc: "Staying composed under pressure, acknowledging concerns, and exploring objections instead of defending against them.",
        weight: 15,
        indicators: [
          {
            id: "objection.composure",
            label: "Stays composed under the ultimatum",
            anchors: {
              strong:
                "Tone stays steady and professional when the deadline is raised, with no defensiveness.",
              adequate: "Mostly steady, with a slightly defensive phrase.",
              weak: "Becomes defensive or flustered.",
              harmful: "Responds with sarcasm, blame or threats.",
            },
            coaching: {
              recommendation: "Treat an ultimatum as information, not a verdict. Pause before you respond.",
              drill: "Record yourself answering five ultimatums and check for defensive words.",
              hint: "Keep it steady. The deadline is information, not a verdict.",
            },
          },
          {
            id: "objection.acknowledge",
            label: "Acknowledges the concern before answering",
            anchors: {
              strong: "Names the pressure the client is under and validates it before responding.",
              adequate: "Brief acknowledgement, then straight to the answer.",
              weak: "Skips acknowledgement entirely.",
              harmful: "Dismisses the concern.",
            },
            coaching: {
              recommendation: "Acknowledge, ask, then answer. A question always comes before your answer.",
              drill: "Practise the Acknowledge, Ask, Answer pattern on five common objections.",
              hint: "Acknowledge her pressure before you answer it.",
            },
          },
          {
            id: "objection.reframe",
            label: "Explores the objection before defending",
            anchors: {
              strong:
                "Asks what the rival quote includes or what the CFO needs to see before responding on substance.",
              adequate: "Reframes around risk, but only after a defence.",
              weak: "Defends pricing immediately.",
              harmful: "Argues with the client about the objection.",
            },
            coaching: {
              recommendation:
                "Ask one clarifying question before you respond to the substance of any objection.",
              drill:
                "Write five clarifying questions for your most common objection and use one in every call this week.",
              hint: "Before defending the price, ask what sits behind the objection.",
            },
          },
        ],
      },
      {
        id: "listening",
        name: "Active Listening",
        desc: "Hearing what is said and what is not, reflecting it back accurately, and letting the client's words shape the next move.",
        weight: 15,
        indicators: [
          {
            id: "listening.paraphrase",
            label: "Paraphrases the client's position",
            anchors: {
              strong: "Summarises the CFO mandate accurately and checks the summary with the client.",
              adequate: "Reflects part of what was said.",
              weak: "Moves on without reflecting.",
              harmful: "Misstates the client's position.",
            },
            coaching: {
              recommendation: "Reflect the client's words back before you add your own.",
              drill: "In your next three calls, paraphrase every major statement before responding.",
              hint: "Reflect back what she just told you before you respond.",
            },
          },
          {
            id: "listening.cues",
            label: "Picks up conditional buying signals",
            anchors: {
              strong:
                "Hears conditional language such as I'm not against a longer term and explores it straight away.",
              adequate: "Notices the signal but explores it late.",
              weak: "Misses the signal and changes subject.",
              harmful: "Contradicts the client's opening.",
            },
            coaching: {
              recommendation:
                "Listen for conditional language such as I'm not against or I'd need. These are openings. Reflect them back at once.",
              drill:
                "Write down every conditional phrase a client uses in your next three calls, then check how many you followed up.",
              hint: "She left a door open. Ask what that would look like.",
            },
          },
          {
            id: "listening.build",
            label: "Builds on what the client said",
            anchors: {
              strong: "Each response uses something the client just said as its starting point.",
              adequate: "Sometimes builds on the client's words, sometimes delivers prepared points.",
              weak: "Delivers prepared points regardless of what was said.",
              harmful: "Talks over or ignores the client.",
            },
            coaching: {
              recommendation: "Let the client's last sentence shape your next one.",
              drill: "Practise starting every reply with a phrase the client used.",
              hint: "Start from her last sentence, not your next slide.",
            },
          },
        ],
      },
      {
        id: "probing",
        name: "Evidence-based Probing",
        desc: "Asking questions that uncover the interests, constraints, and decision criteria behind a client's stated position.",
        weight: 15,
        indicators: [
          {
            id: "probing.open-questions",
            label: "Asks open questions",
            anchors: {
              strong:
                "Asks open questions that invite the client's real priorities, such as what success looks like for the CFO.",
              adequate: "Asks questions, but mostly closed ones.",
              weak: "Asks no questions in the turn.",
              harmful: "Asks leading or loaded questions.",
            },
            coaching: {
              recommendation: "Open questions first. Target eight or more in a call of this length.",
              drill: "Convert ten closed questions from your last call into open ones.",
              hint: "Ask an open question: what, how or why.",
            },
          },
          {
            id: "probing.follow-up",
            label: "Follows up beyond the first answer",
            anchors: {
              strong:
                "After an important answer, asks at least one deeper question such as what is behind that.",
              adequate: "Occasionally follows up.",
              weak: "Accepts the first answer and moves on.",
              harmful: "Interrupts the answer with a pitch.",
            },
            coaching: {
              recommendation:
                "Use the rule of three: after any important answer, ask two follow ups before you respond with your position.",
              drill:
                "Take one recent client objection and write five follow up questions, each one level deeper.",
              hint: "Go one level deeper: what is behind that?",
            },
          },
          {
            id: "probing.decision-criteria",
            label: "Surfaces the decision criteria",
            anchors: {
              strong: "Confirms how the CFO will judge the renewal and who else signs off.",
              adequate: "Asks about the CFO but not how the decision is made.",
              weak: "Never asks how the decision will be judged.",
              harmful: "Assumes the criteria and argues against them.",
            },
            coaching: {
              recommendation: "Confirm how the decision will be judged and by whom before you make an offer.",
              drill:
                "Add two questions to your call plan: how will this be measured, and who else is involved.",
              hint: "Find out how the CFO will judge this, and who else signs.",
            },
          },
        ],
      },
      {
        id: "relationship",
        name: "Relationship Management",
        desc: "Protecting trust and goodwill while negotiating firmly, so the client wants to keep working with you after the deal.",
        weight: 15,
        indicators: [
          {
            id: "relationship.empathy",
            label: "Recognises the client's pressure",
            anchors: {
              strong:
                "Positions themselves on the client's side of the table: It sounds like you're being asked to show real savings, and I want to help you do that.",
              adequate: "Shows some understanding of the client's situation.",
              weak: "Focuses only on their own position.",
              harmful: "Blames the client for the pressure.",
            },
            coaching: {
              recommendation: "Recognise the pressure the client is under without judging it.",
              drill:
                "Write three sentences that put you on the client's side and use one early in every call.",
              hint: "Show her you understand the pressure she is under.",
            },
          },
          {
            id: "relationship.commitment",
            label: "Offers a personal commitment",
            anchors: {
              strong:
                "Offers something personal the client can hold them to, such as an executive sponsor or a quarterly review.",
              adequate: "Mentions ongoing support in general terms.",
              weak: "Offers no commitment beyond the contract.",
              harmful: "Makes promises the company cannot keep.",
            },
            coaching: {
              recommendation:
                "Balance firmness on terms with generosity on attention. Offer something personal that costs little and signals partnership.",
              drill: "List three low cost, high value commitments you can offer any key account.",
              hint: "Offer something personal she can hold you to.",
            },
          },
          {
            id: "relationship.tone",
            label: "Keeps the tone collaborative",
            anchors: {
              strong: "Stays warm and respectful through the ultimatum, using we and together language.",
              adequate: "Professional but transactional.",
              weak: "Cold or curt.",
              harmful: "Rude, sarcastic or threatening.",
            },
            coaching: {
              recommendation: "Firm on terms, warm in tone.",
              drill: "Re-read your last three difficult emails and rewrite the coldest sentence in each.",
              hint: "Keep the tone collaborative, even under pressure.",
            },
          },
        ],
      },
    ],
    objectives: [
      {
        id: "deadlock",
        label: "Break the Deadlock",
        sub: "Get the conversation moving past the opening standoff",
        xp: 60,
        badgeId: "detective",
        indicatorIds: ["probing.open-questions", "objection.reframe", "probing.decision-criteria"],
      },
      {
        id: "margin",
        label: "Protect the Margin",
        sub: "Close the call with a deal you can take back to your own team",
        xp: 50,
        badgeId: "trader",
        indicatorIds: ["strategy.conditional-concession", "value.client-evidence", "strategy.batna"],
      },
      {
        id: "ally",
        label: "Win Her Over",
        sub: "Walk out with an ally, not just a signature",
        xp: 40,
        badgeId: "listener",
        indicatorIds: ["listening.paraphrase", "listening.cues", "relationship.empathy"],
      },
    ],
  },
});
