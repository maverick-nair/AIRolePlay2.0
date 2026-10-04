export default function FlameIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.5c.6 2.4 3.8 3.9 3.8 7.4A3.8 3.8 0 0 1 8 12.7a3.8 3.8 0 0 1-3.8-3.8c0-1.6.8-2.6 1.6-3.4.2 1.1.8 1.8 1.5 2.1C7 5.6 7.2 3.4 8 1.5Z"
        fill="currentColor"
      />
      <path
        d="M8 14.5a2.2 2.2 0 0 1-2.2-2.2c0-1 .7-1.7 1.3-2.2.1.7.5 1 .9 1.2.1-.8.4-1.5 1-2.1.6 1 1.2 1.8 1.2 3.1A2.2 2.2 0 0 1 8 14.5Z"
        fill="currentColor"
        opacity=".55"
      />
    </svg>
  );
}
