import useCountUp from "../lib/useCountUp";

export default function RollingNumber({ value, className }: { value: number; className?: string }) {
  const v = useCountUp(value);
  return <span className={`tabular-nums ${className ?? ""}`}>{v.toLocaleString()}</span>;
}
