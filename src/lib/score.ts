import { KNOLSKAPE_BANDS } from "../data/bands";

export const bandFor = (score: number) =>
  KNOLSKAPE_BANDS[Math.min(4, Math.max(0, Math.ceil(Math.round(score) / 2) - 1))];

export const scoreColor = (score: number) => bandFor(score).color;
export const scoreLabel = (score: number) =>
  score >= 9
    ? "Role Model"
    : score >= 7
      ? "Proficient"
      : score >= 5
        ? "Competent"
        : score >= 3
          ? "Emerging"
          : "Novice";
