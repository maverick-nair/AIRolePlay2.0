import type { SessionTurn } from "./scenario";

// Descriptive conversation metrics computed from the transcript alone. They describe the
// conversation and are never turned into scores (see the audio rules in the repo CLAUDE.md).

export type DescriptiveMetrics = {
  playerTurns: number;
  npcTurns: number;
  talkShare: number; // share of words spoken by the player, 0 to 1
  questions: number;
  openQuestions: number;
  closedQuestions: number;
  avgWordsPerTurn: number;
  longestTurnWords: number;
  fillerWords: number;
  conditionalOffers: number;
  unconditionalOffers: number;
};

const OPEN_RX = /\b(what|how|why|tell me|walk me|describe|explain|share|which|help me understand)\b/i;
const FILLER_RX = /\b(um|uh|like|you know|basically|actually|literally|kind of|sort of)\b/gi;
const OFFER_RX = /\b(\d{1,2}\s?%|percent|discount|off\b|reduce the price|lower the price|match)/i;
const CONDITION_RX = /\b(if you|if we|in return|in exchange|provided|on condition|when you|once you)\b/i;

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
const sentences = (t: string) => t.split(/(?<=[.?!])\s+/).filter(Boolean);

export function describeTranscript(turns: SessionTurn[], playerSpeaker = "You"): DescriptiveMetrics {
  const player = turns.filter((t) => t.speaker === playerSpeaker);
  const npc = turns.filter((t) => t.speaker !== playerSpeaker);
  const playerWords = player.reduce((a, t) => a + words(t.text), 0);
  const npcWords = npc.reduce((a, t) => a + words(t.text), 0);
  let questions = 0;
  let open = 0;
  let fillers = 0;
  let conditional = 0;
  let unconditional = 0;
  let longest = 0;
  for (const t of player) {
    longest = Math.max(longest, words(t.text));
    fillers += (t.text.match(FILLER_RX) ?? []).length;
    for (const s of sentences(t.text)) {
      if (s.trim().endsWith("?")) {
        questions += 1;
        if (OPEN_RX.test(s)) open += 1;
      }
      if (OFFER_RX.test(s)) {
        if (CONDITION_RX.test(s)) conditional += 1;
        else unconditional += 1;
      }
    }
  }
  const total = playerWords + npcWords;
  return {
    playerTurns: player.length,
    npcTurns: npc.length,
    talkShare: total ? playerWords / total : 0,
    questions,
    openQuestions: open,
    closedQuestions: questions - open,
    avgWordsPerTurn: player.length ? Math.round(playerWords / player.length) : 0,
    longestTurnWords: longest,
    fillerWords: fillers,
    conditionalOffers: conditional,
    unconditionalOffers: unconditional,
  };
}

export function formatTalkShare(share: number) {
  const you = Math.round(share * 100);
  return `${you} : ${100 - you}`;
}
