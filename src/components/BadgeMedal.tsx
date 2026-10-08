export default function BadgeMedal({
  mark,
  earned = true,
  size = 44,
}: {
  mark: string;
  earned?: boolean;
  size?: number;
}) {
  return (
    <span
      className="relative inline-flex items-center justify-center font-display font-bold flex-none"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.3),
        clipPath: "polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
        background: earned
          ? "linear-gradient(150deg, #ff8a4c, var(--accent) 55%, var(--accent-2))"
          : "rgb(var(--ink) / 0.1)",
        color: earned ? "#ffffff" : "rgb(var(--ink) / 0.7)",
      }}
    >
      {mark}
    </span>
  );
}
