import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { setupHttp } from "@/lib/httpSetup";
import { setupPerfTelemetry } from "@/lib/perfTelemetry";

setupHttp();
setupPerfTelemetry();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
