import React from "react";
import ReactDOM from "react-dom/client";
import AssessmentApp from "./apps/AssessmentApp";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AssessmentApp />
  </React.StrictMode>,
);
