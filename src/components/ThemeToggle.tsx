import { useContext } from "react";
import { ThemeContext } from "../lib/theme";

export default function ThemeToggle() {
  const { dark, toggle } = useContext(ThemeContext);
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className="rail-item"
    >
      {dark ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="8" cy="8" r="3.2" />
          <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.95 3.05l-1.13 1.13M4.18 11.82l-1.13 1.13M12.95 12.95l-1.13-1.13M4.18 4.18L3.05 3.05" />
        </svg>
      ) : (
        <svg
          width="20"
          height="20"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13.5 9.5A5.5 5.5 0 116.5 2.5a4.5 4.5 0 007 7z" />
        </svg>
      )}
    </button>
  );
}
