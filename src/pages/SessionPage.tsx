import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import VoiceWave from "../components/VoiceWave";
import RollingNumber from "../components/RollingNumber";
import ConfettiBurst from "../components/ConfettiBurst";
import FlameIcon from "../components/FlameIcon";
import BadgeMedal from "../components/BadgeMedal";
import BandChip from "../components/BandChip";
import CountdownTimer from "../components/CountdownTimer";
import { CAMERA_PREVIEW_SRC, PORTRAIT_SRC } from "../data/scenario";
import { BADGES } from "../data/badges";
import type { Difficulty, Mode, Scenario, SessionTurn, TurnClassification } from "../domain/scenario";
import { hintFor, levelFor, levelProgress, turnOutcome, type TurnBehaviour } from "../domain/scoring";
import { assembleReport, buildReportRequest, type Report, type SessionStats } from "../domain/report";
import reportId from "../lib/reportId";
import { scoreSession } from "../domain/scoring";
import { providers } from "../providers";
import { saveAttempt } from "../store/attempts";
import type { Product } from "../products";
import useMediaQuery from "../lib/useMediaQuery";
import AppShell from "../components/AppShell";
import Icon from "../components/Icon";
import Tabs, { tabPanelProps } from "../components/Tabs";

const OPENING_OFFSET_SECONDS = 125; // the authored opening ends at 2:05
const HOLD_MS = 350; // a press on the mic longer than this is hold to talk; shorter is tap to toggle

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
  log: FeedbackEntry[];
};

type PanelTab = "coach" | "transcript";

type FeedbackEntry = {
  id: number;
  time: string;
  gain: number;
  behaviour: TurnBehaviour | null;
  note: string;
};

const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.tagName === "TEXTAREA" ||
    el.tagName === "INPUT" ||
    el.tagName === "BUTTON" ||
    el.tagName === "SUMMARY" ||
    el.isContentEditable);

// The call screen. One stage for both products: the persona and her words own the centre, the
// composer is voice first, and the side panels are drawers. The posture differs by mode: AI RolePlay
// adds a coach lane, a practice toolbar and the game layer; Conversation AI stays in focus mode.
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
  startXp?: number;
  onEnd: (report: Report) => void;
}) {
  const isPractice = mode === "practice";
  const objectives = scenario.instrument.objectives;
  const persona = scenario.stimulus.persona;
  const firstName = persona.name.split(" ")[0];

  const [muted, setMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [speaking, setSpeaking] = useState(true);
  // Drawers dock beside the stage on wide screens and open as full screen sheets on small ones.
  const lgUp = useMediaQuery("(min-width: 1024px)");
  // One details panel beside the stage: docked open on a laptop, a sheet on request below that.
  const [panelTab, setPanelTab] = useState<PanelTab>(isPractice ? "coach" : "transcript");
  const [panelOpen, setPanelOpen] = useState(lgUp);
  useEffect(() => setPanelOpen(lgUp), [lgUp]);
  const panelCloseRef = useRef<HTMLButtonElement | null>(null);
  const panelReturnRef = useRef<HTMLElement | null>(null);
  const openPanel = (tab: PanelTab) => {
    if (!lgUp && !panelOpen) panelReturnRef.current = document.activeElement as HTMLElement | null;
    setPanelTab(tab);
    setPanelOpen(true);
  };
  const closePanel = () => {
    setPanelOpen(false);
    if (!lgUp) panelReturnRef.current?.focus();
  };
  const togglePanel = (tab: PanelTab) => (panelOpen && panelTab === tab ? closePanel() : openPanel(tab));
  // As a sheet the panel covers the call, so focus moves into it and returns on close.
  useEffect(() => {
    if (panelOpen && !lgUp) panelCloseRef.current?.focus();
  }, [panelOpen, lgUp]);
  const [showCriteria, setShowCriteria] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<SessionTurn[]>(scenario.stimulus.opening);
  const [classifications, setClassifications] = useState<TurnClassification[]>([]);
  const [agreements, setAgreements] = useState<number[]>([]);
  const [xp, setXp] = useState(startXp);
  const [streak, setStreak] = useState(0);
  const [turns, setTurns] = useState(0);
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
  const [metObjectives, setMetObjectives] = useState<boolean[]>(objectives.map(() => false));
  const [chip, setChip] = useState<FeedbackEntry | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [log, setLog] = useState<FeedbackEntry[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef(Date.now());
  const replyTimers = useRef<number[]>([]);
  const streamRef = useRef<number | null>(null);
  const openingTimer = useRef<number | null>(null);
  const interruptions = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const elapsedSeconds = () => OPENING_OFFSET_SECONDS + Math.floor((Date.now() - startRef.current) / 1000);
  // Message timestamps derive from wall-clock, so the countdown can tick in its own
  // component without re-rendering the whole session every second.
  function nowStamp() {
    const e = elapsedSeconds();
    return `${Math.floor(e / 60)}:${String(e % 60).padStart(2, "0")}`;
  }

  // Opening line: the persona finishes speaking before the floor opens (or the learner interrupts).
  useEffect(() => {
    openingTimer.current = window.setTimeout(() => setSpeaking(false), 3200);
    return () => {
      if (openingTimer.current) window.clearTimeout(openingTimer.current);
    };
  }, []);

  useEffect(
    () => () => {
      replyTimers.current.forEach((t) => window.clearTimeout(t));
      if (streamRef.current) window.clearInterval(streamRef.current);
    },
    [],
  );

  // Conversation state, shown on the stage and read by assistive technology.
  const last = messages[messages.length - 1];
  const thinking = speaking && (last?.speaker === "You" || last?.text === "");
  const personaSpeaking = speaking && !thinking;
  const state: "thinking" | "speaking" | "listening" | "your-turn" = thinking
    ? "thinking"
    : personaSpeaking
      ? "speaking"
      : isRecording
        ? "listening"
        : "your-turn";
  const STATE_LABEL = {
    thinking: `${firstName} is thinking`,
    speaking: `${firstName} is speaking`,
    listening: "Listening to you",
    "your-turn": "Your turn",
  } as const;

  // ---------------- Interrupting ----------------
  // Both products allow interruption. The persona stops where she is; the count is kept as
  // descriptive data for the report and never enters a score.
  const interrupt = useCallback(() => {
    if (!personaSpeaking) return false;
    if (streamRef.current) {
      window.clearInterval(streamRef.current);
      streamRef.current = null;
      setMessages((m) => {
        const c = [...m];
        const l = c[c.length - 1];
        if (l && l.speaker !== "You" && l.text) c[c.length - 1] = { ...l, text: `${l.text} ...` };
        return c;
      });
    }
    if (openingTimer.current) window.clearTimeout(openingTimer.current);
    replyTimers.current.forEach((t) => window.clearTimeout(t));
    replyTimers.current = [];
    interruptions.current += 1;
    setSpeaking(false);
    return true;
  }, [personaSpeaking]);

  // ---------------- Voice ----------------
  // Dictation: the live transcription fills the composer as you speak; releasing the mic (or the
  // Space bar) sends it. Dictation is simulated until a speech to text adapter is connected.
  const dictRef = useRef("");
  const recordingRef = useRef(false);
  useEffect(() => {
    recordingRef.current = isRecording;
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

  function startRecording() {
    if (finishing || recordingRef.current) return;
    if (thinking) return;
    if (personaSpeaking) interrupt();
    recordingRef.current = true;
    setIsRecording(true);
  }
  function stopRecording(send = true) {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setIsRecording(false);
    if (send && dictRef.current.trim()) void handleSubmit(dictRef.current, true);
  }

  // Mic button: a short tap toggles, a press and hold talks until release.
  const press = useRef<{ at: number; stopOnUp: boolean } | null>(null);
  const micDown = () => {
    if (recordingRef.current) press.current = { at: Date.now(), stopOnUp: true };
    else {
      press.current = { at: Date.now(), stopOnUp: false };
      startRecording();
    }
  };
  const micUp = () => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    if (p.stopOnUp || Date.now() - p.at >= HOLD_MS) stopRecording(true);
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, panelOpen, panelTab]);

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

  // The persona takes the floor: a short think, then her line streams as she says it.
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
        streamRef.current = null;
        replyTimers.current.push(window.setTimeout(() => setSpeaking(false), 400));
      }
    }, 170);
    streamRef.current = id;
  }

  async function handleSubmit(override?: string, fromVoice = false) {
    const text = (override ?? draft).trim();
    if (!text || finishing) return;
    if (thinking && !fromVoice) return;
    // Sending while the persona is mid line is an interruption.
    if (personaSpeaking) interrupt();
    setSpeaking(true);
    setHint(null);
    setChip(null);
    setWhyOpen(false);

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
      log,
    };
    setSnapshots((s) => [...s.slice(0, turns), snapshot]);

    const playerTurn: SessionTurn = { speaker: "You", time: nowStamp(), text };
    const transcript = [...messages, playerTurn];
    const turnIndex = transcript.length - 1;
    setMessages(transcript);
    setDraft("");
    setIsRecording(false);
    recordingRef.current = false;
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
    const entry: FeedbackEntry = {
      id: Date.now(),
      time: playerTurn.time,
      gain: outcome.gain,
      behaviour: outcome.behaviour,
      note: outcome.note,
    };

    if (!outcome.onTopic) {
      setStreak(0);
      if (isPractice) {
        setChip(entry);
        setLog((l) => [entry, ...l]);
      }
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

    // Celebrations, most important first: level up, then objective, then badge. Practice only.
    const b0 = BADGES.find((b) => b.id === outcome.earnedBadges[0]);
    const moment = outcome.levelledUp
      ? {
          title: `Level up: ${levelFor(xp + outcome.gain).name}`,
          sub: "Your practice level went up",
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
    if (moment && isPractice) {
      setUnlock({ key: Date.now(), ...moment });
      replyTimers.current.push(window.setTimeout(() => setUnlock(null), 2600));
      if (moment.kind !== "badge") {
        let origin: { x: number; y: number } | undefined;
        if (moment.kind === "objective") {
          const row = document.querySelector<HTMLElement>(
            `[data-objective="${outcome.newlyMet.indexOf(true)}"]`,
          );
          const btn = document.querySelector<HTMLElement>("[data-anchor='objectives']");
          const el = row && row.getClientRects().length ? row : btn;
          if (el) {
            const rc = el.getBoundingClientRect();
            origin = { x: rc.left + Math.min(rc.width / 2, 28), y: rc.top + rc.height / 2 };
          }
        }
        setBurst((b) => ({ n: b.n + 1, origin }));
      }
    }

    setXp(xp + outcome.gain);
    setBestStreak(Math.max(bestStreak, outcome.nextStreak));
    setStreak(outcome.nextStreak);
    if (isPractice) {
      setChip(entry);
      setLog((l) => [entry, ...l]);
    }

    if (isPractice && hints) {
      const h = hintFor(scenario, nextClassifications);
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
    setLog(snap.log);
    setSnapshots((s) => s.slice(0, playerTurnOrdinal));
    setDraft(removed?.text ?? "");
    setHint(null);
    setChip(null);
    textareaRef.current?.focus();
  }
  const canRewindLast = isPractice && snapshots.length > 0 && !speaking && !finishing;
  const rewindLast = () => canRewindLast && rewindTo(snapshots.length - 1);
  // When a reply misses and a hint fires at the same moment, they share one card instead of two.
  const hintInSheet =
    !!hint && !!chip?.behaviour && (chip.behaviour.band === "Weak" || chip.behaviour.band === "Harmful");

  // Practice only: a hint on request, even when automatic hints are off.
  function requestHint() {
    if (!isPractice) return;
    const h = hintFor(scenario, classifications);
    if (h) return setHint(h);
    const open = objectives.find((_, i) => !metObjectives[i]);
    const ind = scenario.instrument.skills
      .flatMap((s) => s.indicators)
      .find((i) => open?.indicatorIds.includes(i.id));
    setHint(ind?.coaching.hint ?? "Ask an open question about what the client needs to see.");
  }

  // What counts: shows the criteria under each objective, and brings the coach into view to show them.
  function toggleCriteria() {
    if (!isPractice) return;
    if (!showCriteria && !(panelOpen && panelTab === "coach")) openPanel("coach");
    setShowCriteria((v) => !v);
  }

  // ---------------- Ending ----------------
  // Ending a call is the one action that cannot be taken back. Conversation AI asks first, because
  // the attempt is single; AI RolePlay gives a five second window to resume instead of a dialog.
  const [confirmEnd, setConfirmEnd] = useState<string | null>(null);
  const [pendingEnd, setPendingEnd] = useState<number | null>(null);
  const keepTalkingRef = useRef<HTMLButtonElement | null>(null);
  const endTriggerRef = useRef<HTMLButtonElement | null>(null);
  function requestEnd() {
    if (finishing) return;
    if (isPractice) return setPendingEnd(5);
    const left = Math.max(0, scenario.durationSeconds - Math.floor((Date.now() - startRef.current) / 1000));
    setConfirmEnd(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`);
  }
  function closeConfirm() {
    setConfirmEnd(null);
    endTriggerRef.current?.focus();
  }
  useEffect(() => {
    if (pendingEnd === null) return;
    if (pendingEnd <= 0) {
      setPendingEnd(null);
      void endCall();
      return;
    }
    const id = window.setTimeout(() => setPendingEnd((p) => (p === null ? null : p - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [pendingEnd]);
  useEffect(() => {
    if (confirmEnd) keepTalkingRef.current?.focus();
  }, [confirmEnd]);

  async function endCall() {
    if (finishing) return;
    setConfirmEnd(null);
    setPendingEnd(null);
    setFinishing(true);
    replyTimers.current.forEach((t) => window.clearTimeout(t));
    if (streamRef.current) window.clearInterval(streamRef.current);
    const completedAt = new Date().toISOString();
    const scores = scoreSession(scenario, classifications);
    const narrative = await providers.reporter.write(buildReportRequest(scenario, messages, scores));
    const stats: SessionStats = {
      startXp,
      endXp: xp,
      badges,
      bestStreak,
      objectives: objectivesDone,
      interruptions: interruptions.current,
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

  // ---------------- Keyboard ----------------
  // Hold Space to talk (interrupting if the persona is mid line). In practice: H for a hint,
  // W for what counts, R to rewind the last turn. Ignored while typing or on a focused control.
  const keys = useRef({ startRecording, stopRecording, requestHint, rewindLast, toggleCriteria });
  keys.current = { startRecording, stopRecording, requestHint, rewindLast, toggleCriteria };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector("[role=alertdialog]")) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) keys.current.startRecording();
        return;
      }
      if (!isPractice || e.repeat) return;
      if (e.key === "h" || e.key === "H") keys.current.requestHint();
      if (e.key === "w" || e.key === "W") keys.current.toggleCriteria();
      if (e.key === "r" || e.key === "R") keys.current.rewindLast();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && recordingRef.current && !isTypingTarget(e.target)) {
        e.preventDefault();
        keys.current.stopRecording(true);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [isPractice]);

  const lastPersonaLine = (() => {
    for (let i = messages.length - 1; i >= 0; i--)
      if (messages[i].speaker !== "You") return { index: i, text: messages[i].text };
    return null;
  })();

  // Which player-turn ordinal does a transcript index correspond to (for rewind buttons)?
  const openingLength = scenario.stimulus.opening.length;
  const playerOrdinalAt = (index: number) =>
    messages.slice(openingLength, index + 1).filter((m) => m.speaker === "You").length - 1;

  const closeIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );

  const barButton = (label: string, active: boolean, onClick: () => void, icon: ReactNode) => (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className="btn !px-3 border"
      style={{
        background: active ? "var(--accent-soft)" : "var(--surface)",
        borderColor: active ? "var(--accent-ui)" : "var(--line)",
        color: active ? "var(--accent-soft-ink)" : "rgb(var(--ink) / 0.85)",
      }}
    >
      {icon}
      <span aria-hidden className="hidden md:inline text-sm">
        {label}
      </span>
    </button>
  );

  const ringColor = state === "listening" ? "var(--danger)" : "var(--accent-ui)";
  const panelTabs: { id: PanelTab; label: string }[] = isPractice
    ? [
        { id: "coach", label: "Coach" },
        { id: "transcript", label: "Transcript" },
      ]
    : [{ id: "transcript", label: "Transcript" }];
  const panelLabel = panelTab === "coach" ? "coach" : "transcript";

  return (
    <AppShell product={product} fixed railFromLg>
      <div className="h-full flex flex-col gap-2 lg:gap-3 p-2 sm:p-3 lg:p-4 overflow-hidden">
        {/* Header card: what this is, how far along, how long is left, and the way out. */}
        <header className="card flex-none flex flex-wrap sm:flex-nowrap items-center gap-2 md:gap-3 px-3 py-2 md:px-5 md:py-3">
          <div className="min-w-0 w-full sm:w-auto sm:flex-1">
            <p className="text-xs md:text-[13px] text-ink/75 truncate">
              {product.name}
              <span aria-hidden className="mx-1.5">
                /
              </span>
              {isPractice ? `Practice run, ${difficulty}` : "Assessment, one attempt"}
            </p>
            <h1 className="font-display font-semibold text-ink text-[15px] md:text-lg leading-tight truncate">
              {scenario.title}
            </h1>
          </div>

          {isPractice && (
            <div className="hidden md:flex flex-col gap-1 w-36 flex-none" data-anchor="objectives">
              <p className="text-xs text-ink/75 tabular-nums" aria-hidden>
                Objectives {objectivesDone}/{objectives.length}
              </p>
              <div
                className="flex items-center gap-1"
                role="img"
                aria-label={`${objectivesDone} of ${objectives.length} objectives complete`}
              >
                {objectives.map((o, i) => (
                  <span
                    key={o.id}
                    className="h-2 flex-1 rounded-full transition-colors duration-300"
                    style={{ background: metObjectives[i] ? "var(--ok)" : "var(--line)" }}
                  />
                ))}
              </div>
            </div>
          )}
          <CountdownTimer initial={scenario.durationSeconds} onExpire={onExpire} />
          {isPractice &&
            barButton(
              "Coach",
              panelOpen && panelTab === "coach",
              () => togglePanel("coach"),
              <Icon name="target" size={18} />,
            )}
          {barButton(
            "Transcript",
            panelOpen && panelTab === "transcript",
            () => togglePanel("transcript"),
            <Icon name="list" size={18} />,
          )}
          <button
            ref={endTriggerRef}
            onClick={requestEnd}
            disabled={finishing || pendingEnd !== null}
            className="btn !px-3 md:!px-4 border whitespace-nowrap ml-auto sm:ml-0"
            style={{
              background: "var(--surface)",
              color: "var(--danger)",
              borderColor: "var(--danger)",
            }}
          >
            End Call
          </button>
        </header>

        <div className="flex-1 min-h-0 flex gap-3">
          {/* The stage card */}
          <main
            aria-label="Conversation"
            className="card flex-1 min-w-0 flex flex-col overflow-y-auto md:overflow-hidden"
          >
            <div className="relative flex-1 min-h-0 md:overflow-y-auto flex flex-col items-center justify-start md:justify-center px-4 md:px-8 pt-4 md:pt-6 pb-4 gap-3 md:gap-5">
              {/* Persona: the same 1:1 portrait as the lobby, with a ring that shows who has the floor */}
              <div className="flex items-center gap-4 w-full md:w-auto md:flex-col">
                <div className="relative flex-none">
                  <div
                    aria-hidden
                    className={`absolute -inset-1.5 md:-inset-2 rounded-[calc(var(--radius)+6px)] transition-opacity duration-300 ${state === "speaking" || state === "listening" ? "speak-ring" : ""}`}
                    style={{
                      border: `2px solid ${ringColor}`,
                      opacity: state === "your-turn" ? 0 : state === "thinking" ? 0.4 : 1,
                    }}
                  />
                  <figure
                    className={`relative w-20 md:w-[clamp(120px,22vh,260px)] aspect-square overflow-hidden rounded-[var(--radius)] ${state === "thinking" ? "thinking-shimmer" : ""}`}
                    style={{ background: "var(--surface-2)" }}
                  >
                    <img
                      src={PORTRAIT_SRC}
                      alt={persona.portraitAlt}
                      className="portrait-img absolute inset-0 w-full h-full object-cover object-top"
                    />
                    <figcaption
                      className="hidden md:block absolute left-2 bottom-2 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: "var(--surface)", color: "rgb(var(--ink))" }}
                    >
                      {persona.name}
                    </figcaption>
                  </figure>
                </div>
                <div className="min-w-0 flex flex-col items-start gap-2 md:items-center md:gap-3">
                  <div className="md:text-center">
                    <p className="font-display font-semibold text-ink text-lg leading-tight md:sr-only">
                      {persona.name}
                    </p>
                    <p className="text-ink/75 text-sm">
                      {persona.role}, {persona.organisation}
                    </p>
                  </div>
                  <p
                    className="flex-none inline-flex items-center gap-2 h-7 px-3 rounded-full text-xs font-semibold"
                    style={{
                      color:
                        state === "your-turn"
                          ? "var(--ok)"
                          : state === "listening"
                            ? "var(--danger)"
                            : "var(--brand)",
                      background: "var(--surface-2)",
                    }}
                  >
                    {state === "speaking" || state === "listening" ? (
                      <VoiceWave
                        active
                        color={state === "listening" ? "var(--danger)" : "var(--brand)"}
                        bars={8}
                        className="!h-3 w-8"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className={`w-2 h-2 rounded-full ${state === "thinking" ? "animate-pulse" : ""}`}
                        style={{ background: "currentColor" }}
                      />
                    )}
                    {STATE_LABEL[state]}
                  </p>
                </div>
              </div>

              {/* Live caption: what the persona just said, always on, on every viewport */}
              {lastPersonaLine && (
                <div
                  key={lastPersonaLine.index}
                  role="region"
                  aria-label={`${persona.name}, latest line`}
                  tabIndex={0}
                  className="w-full max-w-2xl text-center max-h-40 min-h-0 shrink overflow-y-auto px-2"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span className="sr-only">{persona.name} says: </span>
                  <p className="caption-in text-ink text-base sm:text-lg md:text-xl leading-snug text-left md:text-center">
                    {lastPersonaLine.text || " "}
                  </p>
                </div>
              )}

              {/* Your camera, only when it is on: a 1:1 tile in the corner of the stage */}
              {cameraOn && (
                <figure
                  className="absolute top-3 right-3 w-24 md:w-32 aspect-square overflow-hidden rounded-[var(--radius-sm)] border shadow-lg"
                  style={{ background: "var(--surface-2)", borderColor: "var(--edge)" }}
                >
                  <img
                    src={CAMERA_PREVIEW_SRC}
                    alt="Your camera view"
                    className="w-full h-full object-cover"
                  />
                  <figcaption
                    className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"
                    style={{ background: "var(--surface)", color: "rgb(var(--ink))" }}
                  >
                    {isRecording && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] animate-pulse" />
                    )}
                    You
                  </figcaption>
                </figure>
              )}
            </div>

            {/* Control bar: voice first, text always. Sticks to the bottom while a phone scrolls the stage. */}
            <div
              className="flex-none sticky bottom-0 z-20 md:static px-3 md:px-6 pb-3 pt-3 border-t"
              style={{ background: "var(--surface)", borderColor: "var(--edge)" }}
            >
              <div className="max-w-4xl mx-auto">
                {hint && isPractice && !hintInSheet && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="sheet-in flex items-start gap-3 mb-2 px-4 py-2.5 text-sm rounded-[var(--radius-sm)]"
                    style={{ background: "var(--accent-soft)" }}
                  >
                    <Icon name="bulb" size={18} className="mt-0.5 flex-none text-[var(--accent-soft-ink)]" />
                    <span className="flex-1 text-ink">
                      <span className="font-semibold">Hint </span>
                      {hint}
                    </span>
                    <button
                      onClick={() => setHint(null)}
                      aria-label="Dismiss hint"
                      className="-my-1 w-8 h-8 flex-none flex items-center justify-center rounded-[var(--radius-sm)] text-ink/80"
                    >
                      {closeIcon}
                    </button>
                  </div>
                )}
                {timeUp && isPractice && (
                  <div
                    role="status"
                    className="mb-2 px-3 py-2 text-sm text-ink/85 rounded-[var(--radius-sm)]"
                    style={{ background: "var(--surface-2)" }}
                  >
                    Time is up for a scored call. You can keep practising, or end the call to see your report.
                  </div>
                )}
                {chip && isPractice && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`sheet-in mb-2 px-4 py-3 border rounded-[var(--radius-sm)] ${
                      !chip.behaviour
                        ? ""
                        : chip.behaviour.band === "Strong" || chip.behaviour.band === "Adequate"
                          ? "sheet-ok"
                          : "sheet-warn"
                    }`}
                    style={
                      chip.behaviour
                        ? undefined
                        : { background: "var(--surface-2)", borderColor: "var(--edge)" }
                    }
                  >
                    <div className="flex flex-wrap sm:flex-nowrap items-start gap-x-3 gap-y-2">
                      <span
                        aria-hidden
                        className="mt-0.5 w-8 h-8 flex-none rounded-full flex items-center justify-center"
                        style={{
                          background: !chip.behaviour
                            ? "rgb(var(--ink) / 0.55)"
                            : chip.behaviour.band === "Strong" || chip.behaviour.band === "Adequate"
                              ? "var(--ok)"
                              : "var(--warn)",
                          color: "var(--surface)",
                        }}
                      >
                        {chip.behaviour &&
                        (chip.behaviour.band === "Weak" || chip.behaviour.band === "Harmful") ? (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M7 3v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                            <circle cx="7" cy="11" r="1.2" fill="currentColor" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path
                              d="M3 7.5l2.5 2.5L11 4.5"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="sheet-title font-display font-bold text-base leading-tight">
                          {!chip.behaviour
                            ? "On topic"
                            : chip.behaviour.band === "Strong"
                              ? "Strong reply"
                              : chip.behaviour.band === "Adequate"
                                ? "Good reply"
                                : "Not quite"}
                          <span className="ml-2 text-sm font-semibold text-ink/80 tabular-nums whitespace-nowrap">
                            {chip.gain > 0 ? `+${chip.gain} XP` : "No XP"}
                          </span>
                        </p>
                        <p className="text-sm text-ink mt-0.5">
                          {chip.behaviour ? chip.behaviour.label : chip.note}
                        </p>
                        {hintInSheet && (
                          <p className="text-sm text-ink/85 mt-1 leading-relaxed">
                            <span className="font-semibold">Hint </span>
                            {hint}
                          </p>
                        )}
                        {whyOpen && chip.behaviour?.why && (
                          <p className="mt-1.5 text-sm text-ink/85 leading-relaxed">{chip.behaviour.why}</p>
                        )}
                      </div>
                      <div className="flex flex-none items-center gap-2 w-full sm:w-auto pl-11 sm:pl-0">
                        {chip.behaviour?.why && (
                          <button
                            onClick={() => setWhyOpen((v) => !v)}
                            aria-expanded={whyOpen}
                            className="btn btn-secondary !min-h-10 !px-3 text-sm"
                          >
                            {whyOpen ? "Hide why" : "Why?"}
                          </button>
                        )}
                        {chip.behaviour &&
                          (chip.behaviour.band === "Weak" || chip.behaviour.band === "Harmful") &&
                          canRewindLast && (
                            <button onClick={rewindLast} className="btn btn-primary !min-h-10 !px-3 text-sm">
                              Try again
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className="flex items-end gap-2 p-1.5 transition-colors rounded-[var(--radius-sm)]"
                  style={{
                    background: "var(--surface)",
                    border: isRecording ? "2px solid var(--danger)" : "1px solid var(--line)",
                  }}
                >
                  <button
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      micDown();
                    }}
                    onPointerUp={micUp}
                    onPointerLeave={() => press.current && !press.current.stopOnUp && micUp()}
                    onClick={(e) => {
                      // Keyboard activation (no pointer) toggles.
                      if (e.detail !== 0) return;
                      if (recordingRef.current) stopRecording(true);
                      else startRecording();
                    }}
                    disabled={thinking || finishing}
                    aria-pressed={isRecording}
                    aria-keyshortcuts="Space"
                    className="btn btn-primary !min-h-12 !px-4 flex-none select-none touch-none"
                    style={isRecording ? { background: "var(--danger)" } : undefined}
                  >
                    {isRecording ? (
                      <VoiceWave active color="#ffffff" bars={6} className="!h-4 w-6" />
                    ) : (
                      <Icon name="mic" size={18} />
                    )}
                    <span className="sr-only sm:not-sr-only">
                      {isRecording ? "Release to send" : "Hold to talk"}
                    </span>
                    <span className="sr-only">
                      {isRecording
                        ? ", or tap to stop and send"
                        : personaSpeaking
                          ? `, interrupts ${firstName}`
                          : ", or tap to start speaking"}
                    </span>
                    <kbd
                      aria-hidden
                      className="kbd"
                      style={{ color: "#ffffff", borderColor: "rgb(255 255 255 / 0.7)" }}
                    >
                      Space
                    </kbd>
                  </button>
                  <label htmlFor="composer" className="sr-only">
                    Your reply
                  </label>
                  <textarea
                    id="composer"
                    ref={textareaRef}
                    value={draft}
                    readOnly={isRecording}
                    disabled={thinking || finishing}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSubmit();
                      }
                    }}
                    rows={1}
                    placeholder={
                      thinking
                        ? `${firstName} is thinking...`
                        : isRecording
                          ? "Listening..."
                          : personaSpeaking
                            ? `Type to interrupt ${firstName}`
                            : "Or type your reply"
                    }
                    className="flex-1 min-w-0 resize-none bg-transparent text-ink text-base leading-relaxed placeholder:text-ink/70 px-2 py-2.5 max-h-32 focus:outline-none"
                  />
                  <button
                    onClick={() => void handleSubmit()}
                    disabled={!draft.trim() || thinking || isRecording || finishing}
                    aria-label="Send reply"
                    className="w-12 h-12 flex-none flex items-center justify-center rounded-[var(--radius-sm)] transition-colors disabled:cursor-not-allowed"
                    style={{
                      background:
                        draft.trim() && !thinking && !isRecording ? "var(--accent)" : "var(--surface-2)",
                      color: draft.trim() && !thinking && !isRecording ? "#ffffff" : "rgb(var(--ink) / 0.7)",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M8 13V3M4 7l4-4 4 4"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

                {/* Toolbar: call controls for everyone, practice tools for AI RolePlay */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setCameraOn((v) => !v)}
                    aria-pressed={cameraOn}
                    className="btn btn-secondary !min-h-10 !px-3 text-sm !font-medium"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      aria-hidden
                    >
                      <path d="M23 7l-7 5 7 5V7z" />
                      <rect x="1" y="5" width="15" height="14" rx="2" />
                      {!cameraOn && <line x1="1" y1="1" x2="23" y2="23" />}
                    </svg>
                    <span className="sr-only sm:not-sr-only">{cameraOn ? "Camera on" : "Camera off"}</span>
                  </button>
                  <button
                    onClick={() => setMuted((v) => !v)}
                    aria-pressed={muted}
                    className="btn btn-secondary !min-h-10 !px-3 text-sm !font-medium"
                  >
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
                      <path d="M5 7H3v4h2l4 3V4L5 7z" fill="currentColor" />
                      {muted ? (
                        <line
                          x1="12"
                          y1="6"
                          x2="17"
                          y2="12"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      ) : (
                        <path
                          d="M12.5 5.5c1.2 1 1.2 5 0 6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      )}
                    </svg>
                    <span className="sr-only sm:not-sr-only">
                      {muted ? `${firstName} muted` : `${firstName}'s voice on`}
                    </span>
                  </button>
                  {isPractice && (
                    <>
                      <span
                        aria-hidden
                        className="hidden sm:block w-px h-6 mx-1"
                        style={{ background: "var(--edge)" }}
                      />
                      <button
                        onClick={requestHint}
                        aria-keyshortcuts="H"
                        className="btn btn-secondary !min-h-10 !px-3 text-sm !font-medium"
                      >
                        Hint <kbd className="kbd">H</kbd>
                      </button>
                      <button
                        onClick={toggleCriteria}
                        aria-pressed={showCriteria}
                        aria-keyshortcuts="W"
                        className="btn btn-secondary !min-h-10 !px-3 text-sm !font-medium"
                        style={
                          showCriteria
                            ? {
                                borderColor: "var(--accent-ui)",
                                background: "var(--accent-soft)",
                                color: "var(--accent-soft-ink)",
                              }
                            : undefined
                        }
                      >
                        What counts <kbd className="kbd">W</kbd>
                      </button>
                      <button
                        onClick={rewindLast}
                        disabled={!canRewindLast}
                        aria-keyshortcuts="R"
                        className="btn btn-secondary !min-h-10 !px-3 text-sm !font-medium"
                      >
                        <span>
                          Rewind<span className="hidden sm:inline"> last turn</span>
                        </span>
                        <kbd className="kbd">R</kbd>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </main>

          {/* Details panel: Coach and Transcript tabs in AI RolePlay, the transcript alone in Conversation AI.
              Docked beside the stage on a laptop, a full screen sheet on smaller screens. */}
          {panelOpen && (
            <aside
              aria-label={isPractice ? "Call details" : "Transcript"}
              onKeyDown={(e) => {
                if (e.key === "Escape" && !lgUp) closePanel();
              }}
              className={`${lgUp ? "card w-[360px] flex-none" : "fixed inset-0 z-50 safe-area md:inset-y-0 md:right-0 md:left-auto md:w-96 md:border-l md:shadow-2xl"} flex flex-col overflow-hidden`}
              style={lgUp ? undefined : { background: "var(--surface)", borderColor: "var(--edge)" }}
            >
              <div className="flex items-center gap-2 px-3 pt-3 pb-2 flex-none">
                {isPractice ? (
                  <Tabs
                    label="Call details"
                    idPrefix="call"
                    tabs={panelTabs}
                    value={panelTab}
                    onChange={setPanelTab}
                    className="flex-1"
                  />
                ) : (
                  <h2 className="flex-1 px-1 font-display font-semibold text-ink text-base">
                    Transcript
                    <span className="ml-2 text-sm font-normal text-ink/75 tabular-nums">
                      {messages.length} lines
                    </span>
                  </h2>
                )}
                <button
                  ref={panelCloseRef}
                  onClick={closePanel}
                  className="w-11 h-11 flex-none flex items-center justify-center rounded-[var(--radius-sm)] text-ink/80 hover:bg-[var(--surface-2)]"
                  aria-label={`Close ${panelLabel}`}
                >
                  {closeIcon}
                </button>
              </div>

              {isPractice && (
                <div
                  {...tabPanelProps("call", "coach")}
                  className={`${panelTab === "coach" ? "flex" : "hidden"} flex-1 min-h-0 flex-col overflow-y-auto px-3 pb-3 gap-3`}
                >
                  {/* Progress */}
                  <section
                    className="flex items-center gap-3 p-3 rounded-[var(--radius-sm)]"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <span
                      className="relative w-11 h-11 flex items-center justify-center flex-none"
                      aria-hidden
                    >
                      <svg width="44" height="44" viewBox="0 0 36 36" className="-rotate-90">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" strokeWidth="3" />
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke="var(--accent-ui)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={`${(levelPct / 100) * 94.2} 94.2`}
                          style={{ transition: "stroke-dasharray .9s cubic-bezier(.2,.8,.2,1)" }}
                        />
                      </svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ink/75">{level}</p>
                      <p className="font-display font-bold text-ink text-lg leading-tight">
                        <RollingNumber value={xp} />{" "}
                        <span className="text-sm font-medium text-ink/75">XP</span>
                      </p>
                    </div>
                    <span
                      className="flex items-center gap-1 h-7 px-2 rounded-full text-xs font-bold tabular-nums"
                      style={
                        streak >= 3
                          ? { background: "var(--accent)", color: "#fff" }
                          : { background: "var(--surface)", color: "rgb(var(--ink) / 0.85)" }
                      }
                      aria-label={`Strong streak ${streak}${streak >= 3 ? ", 1.5 times XP active" : ""}`}
                    >
                      <FlameIcon size={13} />
                      {streak}
                      {streak >= 3 && <span>x1.5</span>}
                    </span>
                    <span
                      className="text-xs text-ink/80 tabular-nums"
                      aria-label={`${badges.length} badges earned`}
                    >
                      <span className="font-bold text-ink">{badges.length}</span>/{BADGES.length}
                    </span>
                  </section>

                  {/* Objectives */}
                  <section>
                    <div className="flex items-center justify-between px-1 mb-2">
                      <h3 className="text-sm font-semibold text-ink">Objectives</h3>
                      <span className="font-semibold text-ink/80 text-xs tabular-nums">
                        {objectivesDone}/{objectives.length}
                      </span>
                    </div>
                    <div
                      className="h-1.5 mx-1 mb-1 overflow-hidden rounded-full"
                      style={{ background: "var(--edge)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${objectivesPct}%`, background: "var(--ok)" }}
                      />
                    </div>
                    <ul>
                      {objectives.map((o, i) => {
                        const done = metObjectives[i];
                        const criteria = scenario.instrument.skills
                          .flatMap((s) => s.indicators)
                          .filter((ind) => o.indicatorIds.includes(ind.id))
                          .map((ind) => ind.label);
                        return (
                          <li key={o.id} data-objective={i} className="flex items-start gap-3 px-1 py-2">
                            <span
                              className="relative w-8 h-8 flex-none rounded-full flex items-center justify-center"
                              style={{
                                background: done ? "var(--ok-tint)" : "var(--surface)",
                                border: done ? "1.5px solid var(--ok)" : "1.5px solid var(--line)",
                              }}
                            >
                              {done ? (
                                <Icon name="check" size={15} stroke={2.2} className="text-[var(--ok)]" />
                              ) : (
                                <span className="font-semibold text-sm text-ink/80 tabular-nums">
                                  {i + 1}
                                </span>
                              )}
                              {celebrate === i && (
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
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-snug text-ink/90">{o.label}</p>
                              <p
                                className="text-xs"
                                style={{ color: done ? "var(--ok)" : "rgb(var(--ink) / 0.75)" }}
                              >
                                {done ? `Completed, +${o.xp} XP` : `${o.sub}`}
                              </p>
                              {showCriteria && (
                                <ul className="mt-1 space-y-0.5" aria-label="What counts">
                                  {criteria.map((c) => (
                                    <li key={c} className="text-xs text-ink/85 leading-snug flex gap-1.5">
                                      <span
                                        aria-hidden
                                        className="mt-1.5 w-1 h-1 rounded-full flex-none"
                                        style={{ background: "var(--accent-ui)" }}
                                      />
                                      {c}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>

                  {/* What each turn showed */}
                  <section className="border-t pt-3" style={{ borderColor: "var(--edge)" }}>
                    <h3 className="text-sm font-semibold text-ink px-1 mb-2">This call</h3>
                    {log.length === 0 ? (
                      <p className="text-sm text-ink/80 leading-relaxed px-1">
                        After each reply, the behaviour it showed appears here with the reason. Choose What
                        counts to see the criteria.
                      </p>
                    ) : (
                      <ol className="space-y-2">
                        {log.map((e) => (
                          <li
                            key={e.id}
                            className="text-sm p-3 rounded-[var(--radius-sm)]"
                            style={{ background: "var(--surface-2)" }}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-ink/75 tabular-nums">{e.time}</span>
                              {e.behaviour && <BandChip band={e.behaviour.band} />}
                              <span className="ml-auto text-xs text-ink/75 tabular-nums">
                                {e.gain > 0 ? `+${e.gain}` : "0"} XP
                              </span>
                            </div>
                            <p className="text-ink/90 mt-1 leading-snug">
                              {e.behaviour ? e.behaviour.label : e.note}
                            </p>
                            {e.behaviour?.why && (
                              <p className="text-xs text-ink/80 mt-0.5 leading-snug">{e.behaviour.why}</p>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </div>
              )}

              <div
                {...(isPractice ? tabPanelProps("call", "transcript") : {})}
                tabIndex={undefined}
                className={`${panelTab === "transcript" ? "flex" : "hidden"} flex-1 min-h-0 flex-col`}
              >
                <div
                  ref={scrollRef}
                  role="log"
                  aria-label="Conversation so far"
                  aria-live="off"
                  tabIndex={0}
                  className="flex-1 overflow-auto px-3 pb-4 pt-1"
                >
                  <ol className="flex flex-col">
                    {messages.map((t, i) => {
                      const you = t.speaker === "You";
                      const ordinal = you && i >= openingLength ? playerOrdinalAt(i) : -1;
                      const canRewind =
                        isPractice && ordinal >= 0 && ordinal < snapshots.length && !speaking && !finishing;
                      return (
                        <li
                          key={i}
                          className="flex flex-col gap-1 px-1 py-3 border-t first:border-t-0"
                          style={{ borderColor: "var(--edge)" }}
                        >
                          <div className="flex items-center gap-2 text-[13px]">
                            <span
                              aria-hidden
                              className="w-2 h-2 rounded-full flex-none"
                              style={{ background: you ? "var(--accent-ui)" : "var(--line)" }}
                            />
                            <span className="font-semibold text-ink">{t.speaker}</span>
                            <span className="ml-auto text-xs text-ink/75 tabular-nums">{t.time}</span>
                          </div>
                          <p className="text-sm leading-relaxed text-ink/85 pl-4">{t.text}</p>
                          {canRewind && (
                            <button
                              onClick={() => rewindTo(ordinal)}
                              className="ml-3 self-start inline-flex items-center gap-1 text-xs font-semibold text-brand min-h-[32px] px-1 rounded-[var(--radius-sm)]"
                            >
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                                <path
                                  d="M3 8a5 5 0 1 0 1.5-3.5M3 3v2.5h2.5"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                />
                              </svg>
                              Retry from here
                              <span className="sr-only">, your turn at {t.time}</span>
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  {thinking && (
                    <div className="flex items-center gap-1 px-5 py-2 w-fit" aria-hidden>
                      {[0, 0.15, 0.3].map((d, i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-ink/40"
                          style={{ animation: `pulse ${1 + d}s ease-in-out infinite` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {isPractice && burst.n > 0 && (
        <ConfettiBurst key={burst.n} origin={burst.origin} pieces={burst.origin ? 60 : 90} />
      )}
      {isPractice && unlock && (
        <div
          key={unlock.key}
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 top-20 z-[61] flex justify-center pointer-events-none px-4"
        >
          <div
            className="unlock-pop card flex items-center gap-4 pl-3 pr-6 py-3"
            style={{
              borderColor: "var(--accent-ui)",
              boxShadow: "0 20px 50px -16px rgb(0 0 0 / 0.35)",
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
              size={48}
            />
            <div>
              <p className="text-brand text-xs font-bold">{unlock.title}</p>
              <p className="text-ink font-display font-semibold text-base">{unlock.sub}</p>
            </div>
            <p className="font-display font-bold text-2xl text-ink ml-2">
              +<RollingNumber value={unlock.xp} />
              <span className="text-sm text-ink/75"> XP</span>
            </p>
          </div>
        </div>
      )}

      {confirmEnd && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
          style={{
            background: "color-mix(in srgb, var(--bg) 70%, transparent)",
            backdropFilter: "blur(4px)",
          }}
          onClick={closeConfirm}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="end-title"
            aria-describedby="end-desc"
            className="card w-full max-w-md p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") return closeConfirm();
              if (e.key !== "Tab") return;
              const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
              const i = items.indexOf(document.activeElement as HTMLButtonElement);
              const next = e.shiftKey
                ? i <= 0
                  ? items.length - 1
                  : i - 1
                : i === items.length - 1
                  ? 0
                  : i + 1;
              e.preventDefault();
              items[next]?.focus();
            }}
          >
            <h2 id="end-title" className="font-display font-semibold text-ink text-xl mb-2">
              End the assessment?
            </h2>
            <p id="end-desc" className="text-ink/80 text-sm leading-relaxed mb-6">
              You have {confirmEnd} left. This is your only attempt: once it ends, your transcript is scored
              and the assessment cannot be resumed or retaken.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => void endCall()}
                className="btn border"
                style={{ color: "var(--danger)", borderColor: "var(--danger)", background: "var(--surface)" }}
              >
                End and score
              </button>
              <button ref={keepTalkingRef} onClick={closeConfirm} className="btn btn-primary">
                Keep talking
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingEnd !== null && (
        <div className="fixed inset-x-0 bottom-28 z-[70] flex justify-center px-4 pointer-events-none">
          <div className="card pointer-events-auto flex flex-wrap items-center gap-3 pl-5 pr-2 py-2 shadow-2xl">
            <p role="status" className="text-ink text-sm">
              Call ended. Scoring in{" "}
              <span className="tabular-nums font-semibold" aria-hidden>
                {pendingEnd} s
              </span>
              <span className="sr-only">a few seconds</span>.
            </p>
            <button
              autoFocus
              onClick={() => setPendingEnd(null)}
              className="btn btn-primary !min-h-10 !px-4 text-sm"
            >
              Resume call
            </button>
            <button onClick={() => void endCall()} className="btn btn-ghost !min-h-10 !px-3 text-sm">
              Score now
            </button>
          </div>
        </div>
      )}

      {finishing && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[62] flex items-center justify-center"
          style={{
            background: "color-mix(in srgb, var(--bg) 92%, transparent)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div className="card flex flex-col items-center gap-3 px-8 py-6 shadow-2xl">
            <VoiceWave active color="var(--brand)" bars={14} className="w-28" />
            <p className="font-display font-semibold text-ink">Preparing your report</p>
            <p className="text-ink/80 text-sm text-center max-w-xs">
              Checking {turns} {turns === 1 ? "turn" : "turns"} against{" "}
              {scenario.instrument.skills.reduce((a, s) => a + s.indicators.length, 0)} behaviours and writing
              the feedback.
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </AppShell>
  );
}
