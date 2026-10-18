import { onLCP, onINP, onCLS, onFCP, onTTFB } from "web-vitals";

const API = process.env.REACT_APP_BACKEND_URL;
const state = { vitals: {}, apiCalls: 0, apiTotalMs: 0, apiFailures: [], sent: false };

export function recordApiCall(url, status, ms, kind) {
  state.apiCalls += 1;
  state.apiTotalMs += ms || 0;
  if (kind !== "ok" && state.apiFailures.length < 20) {
    const path = String(url || "").replace(API || "", "").split("?")[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id").slice(0, 160);
    state.apiFailures.push({ path, status: status || 0, kind, ms: Math.round(ms || 0) });
  }
}

const deviceClass = () => {
  const ua = navigator.userAgent;
  if (/iPad|Tablet|SM-T/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "móvil";
  return "escritorio";
};
const osName = () => {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "otro";
};

function navTiming() {
  const nav = performance.getEntriesByType?.("navigation")?.[0];
  if (!nav) return {};
  return { dom_ready_ms: Math.round(nav.domContentLoadedEventEnd), load_ms: Math.round(nav.loadEventEnd || nav.domComplete) };
}

function jsBytes() {
  try { return performance.getEntriesByType("resource").filter((r) => r.initiatorType === "script").reduce((s, r) => s + (r.transferSize || 0), 0); } catch { return undefined; }
}

function buildBeacon() {
  const c = navigator.connection || {};
  const isNative = !!window.Capacitor?.isNativePlatform?.();
  return {
    route: window.location.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id").split("/").slice(0, 3).join("/") || "/",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    device: deviceClass(),
    platform: isNative ? "app-nativa" : window.matchMedia?.("(display-mode: standalone)")?.matches ? "pwa" : "web",
    os: osName(),
    memory_gb: navigator.deviceMemory,
    cores: navigator.hardwareConcurrency,
    net_type: c.effectiveType,
    net_rtt_ms: c.rtt,
    net_downlink_mbps: c.downlink,
    save_data: c.saveData,
    ...state.vitals,
    ...navTiming(),
    js_bytes: jsBytes(),
    api_calls: state.apiCalls,
    api_avg_ms: state.apiCalls ? Math.round(state.apiTotalMs / state.apiCalls) : undefined,
    api_failures: state.apiFailures,
    app_version: process.env.REACT_APP_VERSION || "web",
  };
}

function flush() {
  if (state.sent || !API) return;
  state.sent = true;
  const body = JSON.stringify(buildBeacon());
  try {
    if (!navigator.sendBeacon?.(`${API}/api/telemetry/perf`, new Blob([body], { type: "application/json" }))) {
      fetch(`${API}/api/telemetry/perf`, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch { /* ignore */ }
}

export function setupPerfTelemetry() {
  if (typeof window === "undefined" || !API) return;
  const set = (k) => (m) => { state.vitals[k] = k === "cls" ? Math.round(m.value * 1000) / 1000 : Math.round(m.value); };
  onTTFB(set("ttfb_ms")); onFCP(set("fcp_ms")); onLCP(set("lcp_ms"), { reportAllChanges: true }); onCLS(set("cls"), { reportAllChanges: true }); onINP(set("inp_ms"), { reportAllChanges: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  window.addEventListener("pagehide", flush);
  setTimeout(flush, 45000);
}
