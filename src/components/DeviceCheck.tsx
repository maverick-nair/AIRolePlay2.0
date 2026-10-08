import { useEffect, useRef, useState } from "react";

// Microphone and camera access test for the assessment brief. Nothing is captured until the
// participant presses a test button (consent first), nothing is recorded or sent, and every
// track is stopped when the test ends or the component unmounts.
type Status = "untested" | "testing" | "ok" | "blocked" | "unavailable";

const LABEL: Record<Status, string> = {
  untested: "Not tested",
  testing: "Testing",
  ok: "Working",
  blocked: "Blocked by the browser",
  unavailable: "Not available on this device",
};

function statusColor(s: Status) {
  if (s === "ok") return "var(--ok)";
  if (s === "blocked" || s === "unavailable") return "var(--danger)";
  return "rgb(var(--ink) / 0.7)";
}

export default function DeviceCheck() {
  const [mic, setMic] = useState<Status>("untested");
  const [cam, setCam] = useState<Status>("untested");
  const [level, setLevel] = useState(0);
  const micStream = useRef<MediaStream | null>(null);
  const camStream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);

  const stopMic = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    micStream.current?.getTracks().forEach((t) => t.stop());
    micStream.current = null;
    void audioCtx.current?.close();
    audioCtx.current = null;
    setLevel(0);
  };
  const stopCam = () => {
    camStream.current?.getTracks().forEach((t) => t.stop());
    camStream.current = null;
    if (video.current) video.current.srcObject = null;
  };
  useEffect(
    () => () => {
      stopMic();
      stopCam();
    },
    [],
  );

  const supported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  async function testMic() {
    if (!supported) return setMic("unavailable");
    if (micStream.current) {
      stopMic();
      return setMic("untested");
    }
    setMic("testing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream.current = stream;
      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += (v - 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / data.length) / 40));
        raf.current = requestAnimationFrame(tick);
      };
      tick();
      setMic("ok");
    } catch (err) {
      setMic(err instanceof DOMException && err.name === "NotFoundError" ? "unavailable" : "blocked");
    }
  }

  async function testCam() {
    if (!supported) return setCam("unavailable");
    if (camStream.current) {
      stopCam();
      return setCam("untested");
    }
    setCam("testing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      camStream.current = stream;
      if (video.current) {
        video.current.srcObject = stream;
        await video.current.play().catch(() => undefined);
      }
      setCam("ok");
    } catch (err) {
      setCam(err instanceof DOMException && err.name === "NotFoundError" ? "unavailable" : "blocked");
    }
  }

  const Row = ({
    name,
    status,
    action,
    onClick,
    children,
    media,
  }: {
    name: string;
    status: Status;
    action: string;
    onClick: () => void;
    children?: React.ReactNode;
    media?: React.ReactNode;
  }) => (
    <div className="flex items-center gap-3 py-2 border-t" style={{ borderColor: "var(--edge)" }}>
      <div className="flex-1 min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-ink t-body">{name}</span>
          <span className="t-small" style={{ color: statusColor(status) }} role="status">
            {LABEL[status]}
          </span>
        </p>
        {children && <div className="mt-1 min-h-[8px] flex items-center">{children}</div>}
      </div>
      {media}
      <button onClick={() => void onClick()} className="flex-none btn btn-secondary !min-h-10 !px-3 text-sm">
        {action}
      </button>
    </div>
  );

  return (
    <div>
      <Row
        name="Microphone"
        status={mic}
        action={micStream.current ? "Stop test" : "Test microphone"}
        onClick={testMic}
      >
        <div
          className="w-full h-2 overflow-hidden rounded-full"
          style={{ background: "var(--edge)" }}
          aria-hidden
        >
          <div
            className="h-full"
            style={{
              width: `${Math.round(level * 100)}%`,
              background: "var(--ok)",
              transition: "width 80ms linear",
            }}
          />
        </div>
      </Row>
      <Row
        name="Camera"
        status={cam}
        action={camStream.current ? "Stop test" : "Test camera"}
        onClick={testCam}
        media={
          <video
            ref={video}
            muted
            playsInline
            aria-label="Camera preview"
            className="w-12 h-12 flex-none object-cover rounded-[var(--radius-sm)]"
            style={{ background: "var(--surface-2)", display: cam === "ok" ? "block" : "none" }}
          />
        }
      >
        <p className="text-ink/80 t-small">
          {cam !== "ok" && "The preview appears here. "}Your picture is never recorded or scored.
        </p>
      </Row>
      <p className="text-ink/80 t-small pt-2 border-t" style={{ borderColor: "var(--edge)" }}>
        Only your transcript is assessed; nothing is inferred from your voice or face.
      </p>
    </div>
  );
}
