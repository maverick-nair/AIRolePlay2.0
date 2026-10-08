import { useEffect, useRef, useState } from "react";
import ThemeToggle from "../components/ThemeToggle";
import VoiceWave from "../components/VoiceWave";
import RollingNumber from "../components/RollingNumber";
import ConfettiBurst from "../components/ConfettiBurst";
import FlameIcon from "../components/FlameIcon";
import BadgeMedal from "../components/BadgeMedal";
import ToolButton from "../components/ToolButton";
import CountdownTimer from "../components/CountdownTimer";
import LeaderboardIcon from "../components/LeaderboardIcon";
import { CAMERA_PREVIEW_SRC } from "../data/scenario";
import { BADGES } from "../data/badges";
import { PEERS } from "../data/peers";
import type { Difficulty, Mode, Scenario, SessionTurn, TurnClassification } from "../domain/scenario";
import { hintFor, levelFor, levelProgress, rankAmong, turnOutcome } from "../domain/scoring";
import { assembleReport, buildReportRequest, type Report, type SessionStats } from "../domain/report";
import reportId from "../lib/reportId";
import { scoreSession } from "../domain/scoring";
import { providers } from "../providers";
import { saveAttempt } from "../store/attempts";
import type { Product } from "../products";
import useMediaQuery from "../lib/useMediaQuery";

const OPENING_OFFSET_SECONDS = 125; // the authored opening ends at 2:05

// Everything the session needs to restore when the learner rewinds to an earlier turn.
type Snapshot = {
  messages: SessionTurn[];
  classifications: TurnClassification[];
  agreements: number[];
  xp: number;
  streak: number;
  bestStreak: number;
  badges: string[];
  metObjectives: boolean[];
  turns: number;
};

export default function SessionPage({
  product,
  scenario,
  mode,
  difficulty,
  hints,
  startXp = 0,
  onEnd,
}: {
  product: Product;
  scenario: Scenario;
  mode: Mode;
  difficulty: Difficulty;
  hints: boolean;
  // XP the learner has earned on earlier saved runs; zero on the first run.
  startXp?: number;
  onEnd: (report: Report) => void;
}) {
  const isPractice = mode === "practice";
  const objectives = scenario.instrument.objectives;
  const persona = scenario.stimulus.persona;

  const [muted, setMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [speaking, setSpeaking] = useState(true);
  // Side panels dock beside the call on wide screens and open as full screen sheets on phones.
  const mdUp = useMediaQuery("(min-width: 768px)");
  const lgUp = useMediaQuery("(min-width: 1024px)");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showObjectives, setShowObjectives] = useState(lgUp);
  const [showTranscript, setShowTranscript] = useState(mdUp);
  useEffect(() => setShowTranscript(mdUp), [mdUp]);
  useEffect(() => setShowObjectives(lgUp), [lgUp]);
  const [showCriteria, setShowCriteria] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<SessionTurn[]>(scenario.stimulus.opening);
  const [classifications, setClassifications] = useState<TurnClassification[]>([]);
  const [agreements, setAgreements] = useState<number[]>([]);
  const [xp, setXp] = useState(startXp);
  const [streak, setStreak] = useState(0);
  const [turns, setTurns] = useState(0);
  const [combo, setCombo] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [burst, setBurst] = useState<{ n: number; origin?: { x: number; y: number } }>({ n: 0 });
  const [unlock, setUnlock] = useState<{
    key: number;
    title: string;
    sub: string;
    xp: number;
    kind: "objective" | "level" | "badge";
  } | null>(null);
  const [badges, setBadges] = useState<string[]>([]);
  const [bestStreak, setBestStreak] = useState(0);
  const [floats, setFloats] = useState<{ id: number; v: number; mult: boolean }[]>([]);
  const [metObjectives, setMetObjectives] = useState<boolean[]>(objectives.map(() => false));
  const [feedback, setFeedback] = useState<{ gain: number; note: string; ok: boolean } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const endBtnRef = useRef<HTMLButtonElement | null>(null);
  const keepRef = useRef<HTMLButtonElement | null>(null);
  const endNowRef = useRef<HTMLButtonElement | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef(Date.now());
  const replyTimers = useRef<number[]>([]);

  const elapsedSeconds = () => OPENING_OFFSET_SECONDS + Math.floor((Date.now() - startRef.current) / 1000);
  // Message timestamps derive from wall-clock, so the countdown can tick in its own
  // component without re-rendering the whole session every second.
  function nowStamp() {
    const e = elapsedSeconds();
    return `${Math.floor(e / 60)}:${String(e % 60).padStart(2, "0")}`;
  }

  // Opening line: the persona finishes speaking before the floor opens.
  useEffect(() => {
    const id = window.setTimeout(() => setSpeaking(false), 3200);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => () => replyTimers.current.forEach((t) => window.clearTimeout(t)), []);

  // Dictation: live transcript fills as you speak; when you finish (or tap stop) the
  // message is sent automatically, as it would be in a real call.
  const dictRef = useRef("");
  useEffect(() => {
    if (!isRecording) return;
    const words = scenario.stimulus.mockDictation.split(" ");
    let i = 0;
    dictRef.current = "";
    setDraft("");
    const id = setInterval(() => {
      i += 1;
      dictRef.current = words.slice(0, i).join(" ");
      setDraft(dictRef.current);
      if (i >= words.length) {
        clearInterval(id);
        setIsRecording(false);
        void handleSubmit(dictRef.current);
      }
    }, 150);
    return () => clearInterval(id);
  }, [isRecording]);

  function toggleMic() {
    if (speaking) return;
    if (isRecording) {
      setIsRecording(false);
      if (dictRef.current.trim()) void handleSubmit(dictRef.current);
    } else setIsRecording(true);
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, showTranscript]);

  const level = levelFor(xp).name;
  const levelPct = levelProgress(xp);
  const objectivesDone = metObjectives.filter(Boolean).length;
  const objectivesPct = objectives.length ? (objectivesDone / objectives.length) * 100 : 0;
  const CONFETTI = [
    { a: -70, d: 26, c: "#ff8a4c" },
    { a: -35, d: 30, c: "#34d399" },
    { a: 0, d: 32, c: "#f59e0b" },
    { a: 35, d: 30, c: "#e8420f" },
    { a: 70, d: 26, c: "#fb7185" },
    { a: -110, d: 24, c: "#34d399" },
    { a: 110, d: 24, c: "#ff8a4c" },
    { a: 180, d: 22, c: "#f59e0b" },
  ];

  // Ranked board with the player folded in; on a tie the player sits level with the peer above.
  const board = [...PEERS, { name: "You", pts: xp, you: true }]
    .sort((a, b) => b.pts - a.pts || Number("you" in b) - Number("you" in a))
    .map((p, i) => ({ ...p, rank: i + 1 }));
  const myRank = rankAmong(
    xp,
    PEERS.map((p) => p.pts),
  );

  // The persona takes the floor: a short think, then her line streams as she says it.
  // The player cannot interrupt; mic and composer stay locked until she finishes.
  async function scheduleReply(transcript: SessionTurn[], playerTurn: number) {
    setSpeaking(true);
    const [reply] = await Promise.all([
      providers.npc.reply({ scenario, mode, difficulty, transcript, playerTurn }),
      new Promise((r) => replyTimers.current.push(window.setTimeout(r, 900))),
    ]);
    const words = reply.text.split(" ");
    setMessages((m) => [...m, { speaker: persona.name, time: nowStamp(), text: "" }]);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { ...c[c.length - 1], text: words.slice(0, i).join(" ") };
        return c;
      });
      if (i >= words.length) {
        window.clearInterval(id);
        replyTimers.current.push(window.setTimeout(() => setSpeaking(false), 400));
      }
    }, 170);
  }

  async function handleSubmit(override?: string) {
    const text = (override ?? draft).trim();
    if (!text || speaking || finishing) return;
    setSpeaking(true);
    setHint(null);

    // Snapshot before the turn so practice mode can rewind to exactly this point.
    const snapshot: Snapshot = {
      messages,
      classifications,
      agreements,
      xp,
      streak,
      bestStreak,
      badges,
      metObjectives,
      turns,
    };
    setSnapshots((s) => [...s.slice(0, turns), snapshot]);

    const playerTurn: SessionTurn = { speaker: "You", time: nowStamp(), text };
    const transcript = [...messages, playerTurn];
    const turnIndex = transcript.length - 1;
    setMessages(transcript);
    setDraft("");
    setIsRecording(false);
    setTurns(turns + 1);

    const { classification, agreement } = await providers.classifier.classify({
      scenario,
      transcript,
      turnIndex,
    });
    const nextClassifications = [...classifications, classification];
    setClassifications(nextClassifications);
    if (agreement !== null) setAgreements((a) => [...a, agreement]);

    const outcome = turnOutcome({ scenario, text, classification, metObjectives, streak, xp, badges });

    if (!outcome.onTopic) {
      setStreak(0);
      setFeedback({ gain: 0, note: outcome.note, ok: false });
      replyTimers.current.push(window.setTimeout(() => setFeedback(null), 2600));
      void scheduleReply(transcript, turns + 1);
      return;
    }

    if (outcome.earnedBadges.length) setBadges((b) => [...b, ...outcome.earnedBadges]);
    const newCount = outcome.newlyMet.filter(Boolean).length;
    if (newCount > 0) {
      setMetObjectives((prev) => prev.map((v, i) => v || outcome.newlyMet[i]));
      const idx = outcome.newlyMet.indexOf(true);
      setCelebrate(idx);
      replyTimers.current.push(window.setTimeout(() => setCelebrate(null), 1100));
    }

    // Celebrations, most important first: level up, then objective, then badge.
    const b0 = BADGES.find((b) => b.id === outcome.earnedBadges[0]);
    const moment = outcome.levelledUp
      ? {
          title: `Level up: ${levelFor(xp + outcome.gain).name}`,
          sub: "New rank unlocked on the leaderboard",
          xp: outcome.gain,
          kind: "level" as const,
        }
      : newCount > 0
        ? {
            title: "Objective complete",
            sub: objectives[outcome.newlyMet.indexOf(true)].label,
            xp: outcome.gain,
            kind: "objective" as const,
          }
        : b0
          ? { title: `Badge unlocked: ${b0.name}`, sub: b0.desc, xp: outcome.gain, kind: "badge" as const }
          : null;
    if (moment) {
      setUnlock({ key: Date.now(), ...moment });
      replyTimers.current.push(window.setTimeout(() => setUnlock(null), 2600));
      if (moment.kind !== "badge") {
        // Objective confetti fires from that objective in the open sidebar, or from the
        // top-bar Objectives button when the sidebar is closed.
        let origin: { x: number; y: number } | undefined;
        if (moment.kind === "objective") {
          const row = document.querySelector<HTMLElement>(
            `[data-objective="${outcome.newlyMet.indexOf(true)}"]`,
          );
          const btn = document.querySelector<HTMLElement>("[data-anchor='objectives-btn']");
          const el = row && row.getClientRects().length ? row : btn;
          if (el) {
            const rc = el.getBoundingClientRect();
            origin = { x: rc.left + Math.min(rc.width / 2, 28), y: rc.top + rc.height / 2 };
          }
        }
        setBurst((b) => ({ n: b.n + 1, origin }));
      }
    }

    const fid = Date.now();
    setFloats((f) => [...f, { id: fid, v: outcome.gain, mult: outcome.multiplied }]);
    replyTimers.current.push(window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== fid)), 1400));

    setXp(xp + outcome.gain);
    setBestStreak(Math.max(bestStreak, outcome.nextStreak));
    setStreak(outcome.nextStreak);
    setCombo(outcome.gain);
    setFeedback({ gain: outcome.gain, note: outcome.note, ok: true });
    replyTimers.current.push(
      window.setTimeout(() => {
        setCombo(null);
        setFeedback(null);
      }, 2400),
    );

    if (isPractice && hints) {
      const h = hintFor(scenario, nextClassifications);
      // The hint stays until the next reply: the persona holds the floor for several seconds first.
      if (h) setHint(h);
    }

    void scheduleReply(transcript, turns + 1);
  }

  // Practice only: rewind to the state before the k-th player turn and edit that line again.
  function rewindTo(playerTurnOrdinal: number) {
    const snap = snapshots[playerTurnOrdinal];
    if (!snap || speaking || finishing) return;
    const removed = messages[snap.messages.length];
    setMessages(snap.messages);
    setClassifications(snap.classifications);
    setAgreements(snap.agreements);
    setXp(snap.xp);
    setStreak(snap.streak);
    setBestStreak(snap.bestStreak);
    setBadges(snap.badges);
    setMetObjectives(snap.metObjectives);
    setTurns(snap.turns);
    setSnapshots((s) => s.slice(0, playerTurnOrdinal));
    setDraft(removed?.text ?? "");
    setHint(null);
    setFeedback({ gain: 0, note: "Rewound. Try this turn differently", ok: true });
    replyTimers.current.push(window.setTimeout(() => setFeedback(null), 2600));
  }

  async function endCall() {
    if (finishing) return;
    setFinishing(true);
    replyTimers.current.forEach((t) => window.clearTimeout(t));
    const completedAt = new Date().toISOString();
    const scores = scoreSession(scenario, classifications);
    const narrative = await providers.reporter.write(buildReportRequest(scenario, messages, scores));
    const stats: SessionStats = {
      startXp,
      endXp: xp,
      badges,
      bestStreak,
      objectives: objectivesDone,
      startRank: rankAmong(
        startXp,
        PEERS.map((p) => p.pts),
      ),
      endRank: myRank,
    };
    const report = assembleReport({
      id: reportId(completedAt, mode),
      scenario,
      mode,
      completedAt,
      durationSeconds: elapsedSeconds(),
      transcript: messages,
      classifications,
      narrative,
      stats,
      agreement: agreements.length ? agreements.reduce((a, b) => a + b, 0) / agreements.length : null,
    });
    saveAttempt(report);
    onEnd(report);
  }

  function onExpire() {
    setTimeUp(true);
    if (!isPractice) void endCall();
  }

  // Ending a call is final (it uses a practice run, or the one assessment attempt), so it asks first.
  function closeConfirm() {
    endBtnRef.current?.focus();
    setConfirmEnd(false);
  }
  useEffect(() => {
    if (confirmEnd) keepRef.current?.focus();
  }, [confirmEnd]);

  // Which player-turn ordinal does a transcript index correspond to (for rewind buttons)?
  const openingLength = scenario.stimulus.opening.length;
  const playerOrdinalAt = (index: number) =>
    messages.slice(openingLength, index + 1).filter((m) => m.speaker === "You").length - 1;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "transparent" }}>
      {/* Top bar: participants named up top */}
      <header className="flex items-center justify-between gap-3 px-4 md:px-8 h-16 border-b border-ink/10 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 flex items-center justify-center flex-none max-[360px]:hidden"
            style={{ background: "var(--accent)" }}
          >
            <span className="text-white text-xs font-bold font-display leading-none">{product.mark}</span>
          </div>
          <span
            className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 text-xs font-display uppercase tracking-wider"
            style={{ background: "rgba(52,211,153,0.12)", color: "var(--ok)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)]" /> Live
          </span>
          <span className="hidden lg:inline text-ink/80 font-display font-semibold text-sm">
            {product.name}
          </span>
          <span
            className="hidden lg:inline-flex items-center gap-2 px-2.5 py-1 text-xs font-display uppercase tracking-wider"
            style={
              isPractice
                ? { background: "rgb(var(--ink) / 0.06)", color: "rgb(var(--ink) / 0.8)" }
                : { background: "rgb(var(--accent-rgb) / 0.14)", color: "var(--brand)" }
            }
            title={
              isPractice
                ? `Practice: up to ${scenario.maxPracticeAttempts} runs, rewind available`
                : "Assessment: one attempt, standardised persona"
            }
          >
            {isPractice ? `Practice · ${difficulty}` : "Assessment · one attempt"}
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* XP HUD: level, rolling XP, progress to next level, streak multiplier. Practice only. */}
          {isPractice && (
            <div
              className="relative hidden md:flex items-center gap-3 pl-1 pr-3 py-1 border border-ink/15"
              style={{ background: "var(--surface)" }}
            >
              <span className="relative w-9 h-9 flex items-center justify-center" aria-hidden>
                <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="rgb(var(--ink) / 0.12)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="var(--brand)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${(levelPct / 100) * 94.2} 94.2`}
                    style={{ transition: "stroke-dasharray .9s cubic-bezier(.2,.8,.2,1)" }}
                  />
                </svg>
                <span className="absolute font-display font-bold text-xs text-ink">
                  {level
                    .split(" ")
                    .map((w) => w[0])
                    .join("")}
                </span>
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-ink/75 text-xs font-display uppercase tracking-widest">{level}</span>
                <span className="font-display font-bold text-ink text-sm">
                  <RollingNumber value={xp} /> <span className="text-ink/70 font-medium text-xs">XP</span>
                </span>
              </span>
              <span
                className="flex items-center gap-1 px-2 py-1 text-xs font-display font-bold tabular-nums"
                style={
                  streak >= 3
                    ? { background: "var(--accent)", color: "#fff" }
                    : { background: "rgb(var(--ink) / 0.06)", color: "rgb(var(--ink) / 0.8)" }
                }
                aria-label={`Streak ${streak}${streak >= 3 ? ", 1.5 times XP active" : ""}`}
              >
                <FlameIcon size={13} />
                {streak}
                {streak >= 3 && <span className="text-xs font-semibold">x1.5</span>}
              </span>
              <span
                className="text-ink/75 text-xs font-display tabular-nums"
                aria-label={`${badges.length} badges earned`}
              >
                <span className="font-bold text-ink">{badges.length}</span>/{BADGES.length} badges
              </span>
              {floats.map((f) => (
                <span
                  key={f.id}
                  aria-hidden
                  className="xp-float absolute left-12 -bottom-1 font-display font-bold text-sm"
                  style={{ color: "var(--brand)" }}
                >
                  +{f.v}
                  {f.mult ? " x1.5" : ""}
                </span>
              ))}
            </div>
          )}
          <CountdownTimer initial={scenario.durationSeconds} onExpire={onExpire} />

          <ToolButton active={showTranscript} onClick={() => setShowTranscript((v) => !v)} label="Transcript">
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="12" height="1.6" rx="0.8" fill="currentColor" />
              <rect x="1" y="6.2" width="8" height="1.6" rx="0.8" fill="currentColor" />
              <rect x="1" y="10.4" width="10" height="1.6" rx="0.8" fill="currentColor" />
            </svg>
          </ToolButton>
          <span data-anchor="objectives-btn" className="inline-flex">
            <ToolButton
              active={showObjectives}
              onClick={() => setShowObjectives((v) => !v)}
              label="Objectives"
              badge={isPractice ? `${objectivesDone}/${objectives.length}` : undefined}
              badgeColor="var(--ok)"
              badgeText="var(--bg)"
            >
              <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 7.5l3 3 7-7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </ToolButton>
          </span>
          {isPractice && (
            <span className="hidden sm:block">
              <ToolButton
                active={showLeaderboard}
                onClick={() => setShowLeaderboard((v) => !v)}
                label="Leaderboard"
                badge={`#${myRank}`}
                badgeColor="#f59e0b"
              >
                <LeaderboardIcon />
              </ToolButton>
            </span>
          )}
          <ThemeToggle />
          <button
            ref={endBtnRef}
            onClick={() => setConfirmEnd(true)}
            disabled={finishing}
            className="tool-btn px-3.5 py-2 min-h-[40px] text-xs font-semibold font-display disabled:opacity-60 whitespace-nowrap"
            style={{
              background: "rgba(244,63,94,0.12)",
              color: "var(--danger)",
              border: "1px solid rgba(244,63,94,0.3)",
            }}
          >
            End Call
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Transcript: left panel */}
        {showTranscript && (
          <aside
            aria-label="Transcript"
            className={`${mdUp ? "w-80 flex-none border-r border-ink/10" : "fixed inset-0 z-50 safe-area"} flex flex-col overflow-hidden`}
            style={{ background: "var(--surface-3)" }}
          >
            <div className="px-4 py-3 border-b border-ink/10 flex items-center justify-between flex-none">
              <span className="font-display font-semibold text-ink text-sm tracking-tight">Transcript</span>
              <div className="flex items-center gap-2">
                <span className="text-ink/70 text-xs tabular-nums">{messages.length} lines</span>
                <button
                  onClick={() => setShowTranscript(false)}
                  className="tool-btn -mr-1 w-6 h-6 flex items-center justify-center text-ink/70 hover:text-ink/80 transition-colors"
                  aria-label="Hide transcript"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div
              ref={scrollRef}
              role="region"
              aria-label="Conversation so far"
              tabIndex={0}
              className="flex-1 overflow-auto px-4 py-4 space-y-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)]"
            >
              {messages.map((t, i) => {
                const you = t.speaker === "You";
                const ordinal = you && i >= openingLength ? playerOrdinalAt(i) : -1;
                // The retry slot keeps its space while the persona speaks, so the transcript never jumps.
                const hasRewind = isPractice && ordinal >= 0 && ordinal < snapshots.length;
                const canRewind = hasRewind && !speaking && !finishing;
                return (
                  <div
                    key={i}
                    data-speaker={you ? "you" : "persona"}
                    className={`group/turn flex flex-col gap-1 ${you ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-ink/70 text-xs font-display">{t.speaker}</span>
                      <span className="text-ink/70 text-xs tabular-nums">{t.time}</span>
                    </div>
                    <div
                      className="max-w-[88%] px-3 py-2 text-sm leading-relaxed"
                      style={
                        you
                          ? {
                              background: "rgb(var(--accent-rgb) / 0.16)",
                              color: "rgb(var(--ink) / 0.9)",
                              border: "1px solid rgb(var(--accent-rgb) / 0.3)",
                            }
                          : {
                              background: "rgb(var(--ink) / 0.05)",
                              color: "rgb(var(--ink) / 0.7)",
                              border: "1px solid rgb(var(--ink) / 0.08)",
                            }
                      }
                    >
                      {t.text}
                    </div>
                    {hasRewind && (
                      <button
                        onClick={() => rewindTo(ordinal)}
                        disabled={!canRewind}
                        className={`${canRewind ? "" : "invisible"} text-xs font-display font-semibold text-brand opacity-70 hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] rounded px-1`}
                      >
                        Retry from here<span className="sr-only">, your turn at {t.time}</span>
                      </button>
                    )}
                  </div>
                );
              })}
              {speaking && messages[messages.length - 1]?.speaker === "You" && (
                <div
                  className="flex items-center gap-1 px-3 py-2 w-fit"
                  style={{ background: "rgb(var(--ink) / 0.05)", border: "1px solid rgb(var(--ink) / 0.08)" }}
                >
                  {[0, 0.15, 0.3].map((d, i) => (
                    <span
                      key={i}
                      className="w-1 h-1 rounded-full bg-ink/40"
                      style={{ animation: `pulse ${1 + d}s ease-in-out infinite` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}

        <main className="flex-1 flex flex-col overflow-y-auto md:overflow-hidden px-4 md:px-8 py-4 md:py-5 gap-3 md:gap-4">
          {/* RolePlay topic banner */}
          <div className="border border-ink/10 flex-none px-5 py-4" style={{ background: "var(--surface)" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="text-xs font-display uppercase tracking-widest"
                style={{ color: "var(--brand)" }}
              >
                {isPractice ? "Practice scenario" : "Assessment scenario"}
              </span>
              <span
                className="px-1.5 py-0.5 text-xs font-display uppercase tracking-wider"
                style={{ background: "rgba(52,211,153,0.14)", color: "var(--ok)" }}
              >
                Live
              </span>
            </div>
            <h1 className="font-display font-bold text-ink text-lg md:text-xl tracking-tight leading-snug">
              {scenario.title}
            </h1>
            <p className="hidden sm:block text-ink/70 text-sm mt-1 truncate">
              Protect the deal and the relationship under price pressure.
            </p>
          </div>

          {/* Video split */}
          <div
            className="flex-none md:flex-1 grid grid-cols-1 md:grid-cols-2 border border-ink/10 min-h-0"
            style={{ background: "rgb(var(--ink) / 0.08)", gap: 1 }}
          >
            {/* NPC frame */}
            <div
              className="relative overflow-hidden flex flex-col items-center justify-center min-h-[200px] pt-10 pb-4 md:py-0"
              style={{ background: "var(--surface-3)" }}
            >
              <div className="relative flex flex-col items-center gap-5 z-10">
                <div className="relative">
                  {speaking && (
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: "rgb(var(--accent-rgb) / 0.15)",
                        animation: "pulse-ring 2s ease-out infinite",
                        margin: -14,
                      }}
                    />
                  )}
                  <div
                    className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden flex items-center justify-center"
                    style={{
                      background: "var(--accent)",
                      border: speaking ? "2px solid var(--brand)" : "2px solid rgb(var(--ink) / 0.12)",
                      transition: "border-color 0.6s ease",
                    }}
                  >
                    <svg width="46" height="46" viewBox="0 0 36 36" fill="none">
                      <circle cx="18" cy="13" r="7" fill="#ffffff" />
                      <path
                        d="M4 34c0-7.732 6.268-14 14-14s14 6.268 14 14"
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
                <VoiceWave active={speaking} color="var(--brand)" className="w-44" />
                <p
                  aria-live="polite"
                  className="text-xs font-display uppercase tracking-widest text-ink/75 h-4"
                >
                  {speaking ? "Speaking" : isRecording ? "Listening" : "Waiting for you"}
                </p>
              </div>
              <div
                className="absolute top-3 left-3 px-2.5 py-1 flex items-center gap-2"
                style={{
                  background: "color-mix(in srgb, var(--bg) 78%, transparent)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${speaking ? "bg-[var(--ok)] animate-pulse" : "bg-ink/30"}`}
                />
                <span className="text-ink/85 text-xs font-medium font-display">{persona.name}</span>
              </div>
            </div>

            {/* User frame */}
            <div
              className="relative overflow-hidden flex flex-col items-center justify-center min-h-[200px] md:min-h-[240px]"
              style={{ background: "var(--surface-3)" }}
            >
              {cameraOn ? (
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    src={CAMERA_PREVIEW_SRC}
                    alt="Your camera view"
                    className="w-full h-full object-cover opacity-70"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, color-mix(in srgb, var(--bg) 85%, transparent), transparent 55%)",
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 pb-14">
                  <div className="w-20 h-20 rounded-full bg-ink/5 border border-ink/10 flex items-center justify-center">
                    <svg
                      width="30"
                      height="30"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-ink/70"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0A17.9 17.9 0 0112 21.75c-2.7 0-5.2-.58-7.5-1.63z"
                      />
                    </svg>
                  </div>
                  <span className="text-ink/70 text-sm font-medium">Camera Off</span>
                </div>
              )}
              <div
                className="absolute top-3 left-3 px-2.5 py-1 flex items-center gap-2 z-10"
                style={{
                  background: "color-mix(in srgb, var(--bg) 78%, transparent)",
                  backdropFilter: "blur(6px)",
                }}
              >
                {isRecording && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] animate-pulse" />
                )}
                <span className="text-ink/85 text-xs font-medium font-display">You</span>
                {muted && (
                  <svg width="11" height="11" viewBox="0 0 18 18" fill="none">
                    <line
                      x1="2"
                      y1="2"
                      x2="16"
                      y2="16"
                      stroke="var(--danger)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9 3v5.5M5 7H3v4h2l4 3V4"
                      stroke="rgb(var(--ink) / 0.5)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-4 z-10 flex flex-col items-center gap-1">
                <VoiceWave active={isRecording} color="var(--danger)" className="w-44" />
                <p className="text-xs font-display uppercase tracking-widest text-ink/75 h-4">
                  {isRecording ? "You are speaking" : speaking ? "Listening" : "Your turn"}
                </p>
              </div>
              {isPractice && combo !== null && (
                <div
                  role="status"
                  className="absolute top-3 right-3 px-2.5 py-1 font-display font-bold text-xs animate-fade-in-up z-10"
                  style={{ background: "rgba(16,185,129,0.22)", color: "var(--ok)" }}
                >
                  +{combo} XP
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 flex-none">
            <button
              className="w-12 h-12 flex items-center justify-center transition-colors"
              style={{
                background: cameraOn ? "rgb(var(--ink) / 0.06)" : "rgba(244,63,94,0.12)",
                border: cameraOn ? "1px solid rgb(var(--ink) / 0.12)" : "1px solid rgba(244,63,94,0.3)",
              }}
              onClick={() => setCameraOn((v) => !v)}
              aria-label={cameraOn ? "Turn off camera" : "Turn on camera"}
              aria-pressed={cameraOn}
            >
              {cameraOn ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgb(var(--ink) / 0.8)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--danger)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 16v3a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
            <button
              className="w-12 h-12 flex items-center justify-center transition-colors"
              style={{
                background: muted ? "rgba(244,63,94,0.12)" : "rgb(var(--ink) / 0.06)",
                border: muted ? "1px solid rgba(244,63,94,0.3)" : "1px solid rgb(var(--ink) / 0.12)",
              }}
              onClick={() => setMuted((v) => !v)}
              aria-label={muted ? "Unmute" : "Mute"}
              aria-pressed={muted}
            >
              {muted ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <line
                    x1="2"
                    y1="2"
                    x2="16"
                    y2="16"
                    stroke="var(--danger)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M9 3v5.5M5 7H3v4h2l4 3V4"
                    stroke="rgb(var(--ink) / 0.5)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M5 7H3v4h2l4 3V4L5 7z" fill="rgb(var(--ink) / 0.8)" />
                  <path
                    d="M12.5 5.5c1.167 1 1.167 5 0 6"
                    stroke="rgb(var(--ink) / 0.8)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* Composer: ChatGPT-style input with dictation. Sticks to the bottom while a phone scrolls the call. */}
          <div
            className="flex-none sticky bottom-0 z-20 md:static -mx-4 px-4 pb-1 md:mx-0 md:px-0 md:pb-0"
            style={{ background: "var(--bg)" }}
          >
            {hint && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-start gap-2 mb-2 px-3 py-2 text-xs font-display animate-fade-in-up"
                style={{
                  background: "rgb(var(--accent-rgb) / 0.12)",
                  color: "var(--brand)",
                  border: "1px solid rgb(var(--accent-rgb) / 0.4)",
                }}
              >
                <span className="font-bold uppercase tracking-wider text-xs mt-0.5">Hint</span>
                <span className="text-ink/85">{hint}</span>
              </div>
            )}
            {timeUp && isPractice && (
              <div
                role="status"
                className="flex items-center gap-2 mb-2 px-3 py-2 text-xs font-display"
                style={{
                  background: "rgb(var(--ink) / 0.06)",
                  color: "rgb(var(--ink) / 0.85)",
                  border: "1px solid rgb(var(--ink) / 0.12)",
                }}
              >
                Time is up for a scored call. You can keep practising, or end the call to see your report.
              </div>
            )}
            {isPractice && feedback && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 mb-2 px-3 py-2 text-xs font-display animate-fade-in-up"
                style={
                  feedback.ok
                    ? {
                        background: "rgba(16,185,129,0.16)",
                        color: "var(--ok)",
                        border: "1px solid rgba(16,185,129,0.4)",
                      }
                    : {
                        background: "rgba(244,63,94,0.14)",
                        color: "var(--danger)",
                        border: "1px solid rgba(244,63,94,0.45)",
                      }
                }
              >
                <span className="font-bold tabular-nums">
                  {feedback.gain > 0 ? `+${feedback.gain} XP` : "No XP"}
                </span>
                <span className="opacity-40">·</span>
                <span>{feedback.note}</span>
              </div>
            )}
            <div
              className="flex items-end gap-2 p-2 transition-colors"
              style={{
                background: "var(--surface)",
                opacity: speaking ? 0.7 : 1,
                border: isRecording
                  ? "1px solid rgb(var(--accent-rgb) / 0.55)"
                  : "1px solid rgb(var(--ink) / 0.12)",
              }}
            >
              <button
                onClick={toggleMic}
                disabled={speaking || finishing}
                aria-label={
                  speaking
                    ? `Microphone locked while ${persona.name} is speaking`
                    : isRecording
                      ? "Finish and send"
                      : "Speak your response"
                }
                aria-pressed={isRecording}
                className="w-10 h-10 flex-none flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: isRecording ? "#e11d48" : "rgb(var(--ink) / 0.06)",
                  border: isRecording ? "none" : "1px solid rgb(var(--ink) / 0.12)",
                }}
              >
                {isRecording ? (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <rect x="6" y="6" width="8" height="8" fill="white" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <rect x="7.5" y="3" width="5" height="9" rx="2.5" fill="rgb(var(--ink) / 0.75)" />
                    <path
                      d="M4 10c0 3.314 2.686 6 6 6s6-2.686 6-6"
                      stroke="rgb(var(--ink) / 0.75)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <line
                      x1="10"
                      y1="16"
                      x2="10"
                      y2="19"
                      stroke="rgb(var(--ink) / 0.75)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
              <textarea
                value={draft}
                readOnly={isRecording}
                disabled={speaking || finishing}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
                rows={1}
                placeholder={
                  speaking
                    ? `${persona.name.split(" ")[0]} is speaking...`
                    : isRecording
                      ? "Listening..."
                      : "Your turn: tap the mic or type"
                }
                className="flex-1 min-w-0 resize-none bg-transparent text-ink text-sm leading-relaxed placeholder:text-ink/70 px-2 py-2.5 max-h-32 focus:outline-none"
              />
              <button
                onClick={() => void handleSubmit()}
                disabled={!draft.trim() || speaking || isRecording || finishing}
                aria-label="Send response"
                className="w-10 h-10 flex-none flex items-center justify-center transition-colors disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                style={{
                  background:
                    draft.trim() && !speaking && !isRecording ? "var(--accent)" : "rgb(var(--ink) / 0.08)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 13V3M4 7l4-4 4 4"
                    stroke={draft.trim() && !speaking && !isRecording ? "#fff" : "rgb(var(--ink) / 0.7)"}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <p
              className={`text-ink/70 text-xs mt-2 px-1 leading-relaxed ${isRecording ? "flex items-center gap-1.5" : ""}`}
            >
              {isRecording ? (
                <>
                  <VoiceWave active color="var(--danger)" bars={10} className="!h-3 w-12 !justify-start" />
                  Speaking. Your message sends when you finish, or tap stop.
                </>
              ) : speaking ? (
                <>Floor locked. You can reply once {persona.name.split(" ")[0]} finishes.</>
              ) : (
                <>
                  Press <span className="text-ink/70 font-medium">Enter</span> to send ·{" "}
                  <span className="text-ink/70 font-medium">Shift + Enter</span> for a new line
                  {isPractice && <> · Rewind any of your turns from the transcript</>}
                </>
              )}
            </p>
          </div>
        </main>

        {/* Right column: objectives + leaderboard */}
        {(showObjectives || showLeaderboard) && (
          <div
            className={`${lgUp ? "w-72 flex-none border-l border-ink/10" : "fixed inset-0 z-50 safe-area"} flex flex-col overflow-hidden`}
            style={{ background: "var(--surface-3)" }}
          >
            {showObjectives && (
              <aside
                aria-label="Objectives"
                className={`flex flex-col overflow-hidden ${showLeaderboard ? "border-b border-ink/10" : "flex-1"}`}
              >
                <div className="px-4 py-3 border-b border-ink/10 flex items-center justify-between flex-none">
                  <span className="font-display font-semibold text-ink text-sm tracking-tight">
                    Objectives
                  </span>
                  <button
                    onClick={() => setShowObjectives(false)}
                    className="tool-btn -mr-1 w-6 h-6 flex items-center justify-center text-ink/70 hover:text-ink/80 transition-colors"
                    aria-label="Close objectives"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M4 4l8 8M12 4l-8 8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
                {isPractice && (
                  <div className="px-4 py-3 border-b border-ink/10 flex-none">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-ink/70 text-xs font-display uppercase tracking-widest">
                        Progress
                      </span>
                      <span className="font-display font-semibold text-ink text-xs tabular-nums">
                        {objectivesDone}/{objectives.length}
                      </span>
                    </div>
                    <div
                      className="h-1.5 w-full overflow-hidden"
                      style={{ background: "rgb(var(--ink) / 0.1)" }}
                    >
                      <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${objectivesPct}%`, background: "var(--ok)" }}
                      />
                    </div>
                  </div>
                )}
                <div className="py-2 overflow-auto">
                  {objectives.map((o, i) => {
                    // An assessment never shows live progress against its criteria.
                    const done = isPractice && metObjectives[i];
                    const celebrating = celebrate === i;
                    const criteria = scenario.instrument.skills
                      .flatMap((s) => s.indicators)
                      .filter((ind) => o.indicatorIds.includes(ind.id))
                      .map((ind) => ind.label);
                    return (
                      <div key={o.id} data-objective={i} className="flex items-start gap-3 px-4 py-2.5">
                        <div
                          className="relative w-9 h-9 flex-none flex items-center justify-center"
                          style={{
                            background: done ? "rgba(52,211,153,0.14)" : "rgb(var(--ink) / 0.05)",
                            border: done
                              ? "1px solid rgba(52,211,153,0.4)"
                              : "1px solid rgb(var(--ink) / 0.1)",
                          }}
                        >
                          {done ? (
                            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                              <path
                                d="M2.5 7.5l2.8 2.8L11.5 4"
                                stroke="var(--ok)"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            <span className="font-display font-semibold text-sm text-ink/70 tabular-nums">
                              {i + 1}
                            </span>
                          )}
                          {celebrating && (
                            <span
                              className="absolute inset-0 flex items-center justify-center pointer-events-none"
                              aria-hidden
                            >
                              {CONFETTI.map((p, k) => (
                                <span
                                  key={k}
                                  className="absolute w-1.5 h-1.5 rounded-[1px]"
                                  style={{
                                    background: p.c,
                                    ["--tx" as string]: `${Math.round(Math.cos((p.a * Math.PI) / 180) * p.d)}px`,
                                    ["--ty" as string]: `${Math.round(Math.sin((p.a * Math.PI) / 180) * p.d)}px`,
                                    animation: "confetti-burst 0.9s ease-out forwards",
                                  }}
                                />
                              ))}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm leading-snug"
                            style={{ color: done ? "rgb(var(--ink) / 0.85)" : "rgb(var(--ink) / 0.75)" }}
                          >
                            {o.label}
                          </p>
                          <p
                            className="text-xs font-display"
                            style={{ color: done ? "var(--ok)" : "rgb(var(--ink) / 0.7)" }}
                          >
                            {!isPractice
                              ? o.sub
                              : done
                                ? `Completed · +${o.xp} XP`
                                : showCriteria
                                  ? `${o.xp} XP`
                                  : `Hidden criteria · ${o.xp} XP`}
                          </p>
                          {isPractice && showCriteria && (
                            <ul className="mt-1 space-y-0.5">
                              {criteria.map((c) => (
                                <li key={c} className="text-xs text-ink/75 leading-snug flex gap-1.5">
                                  <span
                                    aria-hidden
                                    className="mt-1.5 w-1 h-1 rounded-full bg-brand flex-none"
                                  />
                                  {c}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {isPractice && (
                    <div className="px-4 pt-1 pb-2">
                      <button
                        onClick={() => setShowCriteria((v) => !v)}
                        className="text-xs font-display font-semibold text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] rounded px-1"
                        aria-expanded={showCriteria}
                      >
                        {showCriteria ? "Hide what counts" : "Show what counts"}
                      </button>
                    </div>
                  )}
                </div>
              </aside>
            )}
            {showLeaderboard && (
              <aside aria-label="Leaderboard" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-ink/10 flex items-center justify-between flex-none">
                  <span className="font-display font-semibold text-ink text-sm tracking-tight">
                    Cohort Leaderboard
                  </span>
                  <button
                    onClick={() => setShowLeaderboard(false)}
                    className="tool-btn -mr-1 w-6 h-6 flex items-center justify-center text-ink/70 hover:text-ink/80 transition-colors"
                    aria-label="Close leaderboard"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M4 4l8 8M12 4l-8 8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
                <p className="px-4 py-2.5 text-ink/70 text-xs border-b border-ink/10 flex-none">
                  Season XP against a sample cohort
                </p>
                <div className="flex-1 overflow-auto py-1">
                  {board.map((p) => {
                    const you = (p as { you?: boolean }).you;
                    const medal =
                      p.rank === 1 ? "#f59e0b" : p.rank === 2 ? "#cbd5e1" : p.rank === 3 ? "#d97706" : null;
                    return (
                      <div
                        key={p.name}
                        className="flex items-center gap-3 px-4 py-2.5 border-l-2 transition-all duration-300 ease-out hover:translate-x-0.5 hover:bg-ink/[0.04]"
                        style={{
                          background: you ? "rgb(var(--accent-rgb) / 0.12)" : "transparent",
                          borderColor: you ? "var(--accent)" : "transparent",
                        }}
                      >
                        {medal ? (
                          <span
                            className="w-5 h-5 flex-none flex items-center justify-center rounded-full text-xs font-display font-bold"
                            style={{ background: medal, color: "#1a1500" }}
                          >
                            {p.rank}
                          </span>
                        ) : (
                          <span
                            className="font-display font-bold text-sm tabular-nums w-5 text-center flex-none"
                            style={{ color: you ? "var(--brand)" : "rgb(var(--ink) / 0.7)" }}
                          >
                            {p.rank}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: you ? "rgb(var(--ink))" : "rgb(var(--ink) / 0.8)" }}
                          >
                            {p.name}
                            {you && <span className="text-brand"> (you)</span>}
                          </p>
                        </div>
                        <span
                          className="font-display font-semibold text-sm tabular-nums flex-none"
                          style={{ color: you ? "var(--brand)" : "rgb(var(--ink) / 0.7)" }}
                        >
                          {p.pts.toLocaleString()}
                          <span className="text-xs font-normal text-ink/70"> XP</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 py-3 border-t border-ink/10 flex-none">
                  <p className="text-ink/70 text-xs">
                    You are <span className="text-brand font-semibold">#{myRank}</span> of {board.length}.
                    Keep responding to climb.
                  </p>
                </div>
              </aside>
            )}
          </div>
        )}
      </div>

      {isPractice && burst.n > 0 && (
        <ConfettiBurst key={burst.n} origin={burst.origin} pieces={burst.origin ? 60 : 90} />
      )}
      {isPractice && unlock && (
        <div
          key={unlock.key}
          role="status"
          aria-live="assertive"
          className="fixed inset-x-0 top-24 z-[61] flex justify-center pointer-events-none px-4"
        >
          <div
            className="unlock-pop flex items-center gap-4 pl-3 pr-6 py-3 border shadow-2xl"
            style={{
              background: "var(--bg)",
              borderColor: "rgb(var(--accent-rgb) / 0.6)",
              boxShadow: "0 20px 60px -12px rgb(var(--accent-rgb) / 0.55)",
            }}
          >
            <BadgeMedal
              mark={
                unlock.kind === "level"
                  ? "LV"
                  : unlock.kind === "objective"
                    ? "OK"
                    : (BADGES.find((b) => unlock.title.endsWith(b.name))?.mark ?? "XP")
              }
              size={52}
            />
            <div>
              <p className="text-brand text-xs font-display font-bold uppercase tracking-widest">
                {unlock.title}
              </p>
              <p className="text-ink font-display font-semibold text-base">{unlock.sub}</p>
            </div>
            <p className="font-display font-bold text-2xl text-ink ml-2">
              +<RollingNumber value={unlock.xp} />
              <span className="text-sm text-ink/75"> XP</span>
            </p>
          </div>
        </div>
      )}
      {confirmEnd && !finishing && (
        <div
          className="fixed inset-0 z-[63] flex items-center justify-center px-4"
          style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeConfirm();
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="end-title"
            aria-describedby="end-desc"
            className="w-full max-w-md flex flex-col gap-4 px-6 py-5 border border-ink/15"
            style={{ background: "var(--surface)" }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                closeConfirm();
              }
              if (e.key === "Tab") {
                e.preventDefault();
                (document.activeElement === keepRef.current ? endNowRef : keepRef).current?.focus();
              }
            }}
          >
            <h2 id="end-title" className="font-display font-semibold text-ink text-lg">
              {isPractice ? "End the call and see your report?" : "End the assessment?"}
            </h2>
            <p id="end-desc" className="text-ink/80 text-sm leading-relaxed">
              {isPractice
                ? `This run is scored now and counts as one of your ${scenario.maxPracticeAttempts} practice runs.`
                : "This is your one attempt. The call is scored now and the report is saved."}
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                ref={keepRef}
                onClick={closeConfirm}
                className="px-5 py-2.5 min-h-[44px] font-display font-semibold text-sm text-ink border border-ink/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              >
                Keep talking
              </button>
              <button
                ref={endNowRef}
                onClick={() => {
                  setConfirmEnd(false);
                  void endCall();
                }}
                className="px-5 py-2.5 min-h-[44px] font-display font-semibold text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--brand)]"
                style={{ background: "var(--accent)" }}
              >
                End and score
              </button>
            </div>
          </div>
        </div>
      )}
      {finishing && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[62] flex items-center justify-center"
          style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}
        >
          <div
            className="flex flex-col items-center gap-3 px-8 py-6 border border-ink/15"
            style={{ background: "var(--surface)" }}
          >
            <VoiceWave active color="var(--brand)" bars={14} className="w-28" />
            <p className="font-display font-semibold text-ink text-sm">Preparing your report</p>
            <p className="text-ink/75 text-xs">
              Scoring every turn against the indicators and writing the feedback.
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes wave-bar {
          from { height: 4px; }
          to { height: 16px; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
