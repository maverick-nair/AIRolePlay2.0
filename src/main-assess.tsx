import React from "react";
import ReactDOM from "react-dom/client";
import AssessmentApp from "./apps/AssessmentApp";
import "./index.css";
import { PRODUCTS, applyProductTheme } from "./products";

// Set the product theme before the first paint, so its fonts and tokens apply from the start.
applyProductTheme(PRODUCTS["conversation-ai"]);

// Render once the product fonts are ready (or after 800 ms), so text never re-wraps after the
// first paint and the layout does not shift.
const fonts = Promise.all(
  ['400 1em "IBM Plex Sans Variable"', '600 1em "IBM Plex Sans Variable"', '500 1em "IBM Plex Mono"'].map(
    (f) => document.fonts?.load(f),
  ),
);
void Promise.race([fonts, new Promise((r) => setTimeout(r, 800))]).then(() =>
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <AssessmentApp />
    </React.StrictMode>,
  ),
);
