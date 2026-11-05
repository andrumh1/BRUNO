import axios from "axios";
import { recordApiCall } from "@/lib/perfTelemetry";
import { compressFormDataImages } from "@/lib/uploadOptim";
import { refreshSession, clearSession, hasSession } from "@/lib/session";

const AUTH_ENDPOINT = /\/api\/auth\/(login|register|refresh|logout|session\/restore|google|forgot-password|reset-password)/;

// Imágenes Cloudinary ya subidas → formato/calidad automáticos (WebP/AVIF) solo al LEER, sin tocar la base de datos.
const CLD_IMG = /(res\.cloudinary\.com\/[^/"\\]+\/image\/upload\/)(v\d+\/)/g;
const optimizeCloudinary = (data, headers) => (typeof data === "string" && String(headers?.["content-type"] || "").includes("json") && data.includes("/image/upload/v") ? data.replace(CLD_IMG, "$1f_auto,q_auto/$2") : data);

const DEFAULT_TIMEOUT = 20000;
const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const MAX_RETRIES = 2;

export function setupHttp() {
  axios.defaults.timeout = DEFAULT_TIMEOUT;
  const defaults = Array.isArray(axios.defaults.transformResponse) ? axios.defaults.transformResponse : [axios.defaults.transformResponse].filter(Boolean);

  axios.interceptors.request.use(async (config) => {
    config.metadata = { start: performance.now() };
    const method = String(config.method || "get").toLowerCase();
    if (method === "get" && !config.responseType) config.transformResponse = [optimizeCloudinary, ...defaults];
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      if (config.timeout === DEFAULT_TIMEOUT) config.timeout = 0; // las subidas no se cortan a los 20 s
      config.data = await compressFormDataImages(config.data);
    }
    return config;
  });

  axios.interceptors.response.use(
    (res) => { recordApiCall(res.config?.url, res.status, performance.now() - (res.config?.metadata?.start || performance.now()), "ok"); if (String(res.config?.url || "").startsWith(API_BASE)) window.dispatchEvent(new Event("bruno:api-ok")); return res; },
    async (error) => {
      const cfg = error.config || {};
      const status = error.response?.status || 0;
      const ms = performance.now() - (cfg.metadata?.start || performance.now());
      const isNetwork = !error.response && error.code !== "ERR_CANCELED";
      const kind = error.code === "ERR_CANCELED" ? "cancelled" : error.code === "ECONNABORTED" ? "timeout" : isNetwork ? "network" : status >= 500 ? "server" : "client";
      if (kind !== "cancelled" && (status >= 500 || isNetwork)) recordApiCall(cfg.url, status, ms, kind);

      const method = String(cfg.method || "get").toLowerCase();

      // Access token caducado → renovar una sola vez (en vuelo compartido) y reintentar con el token nuevo. Solo un rechazo real del refresh cierra la sesión.
      if (status === 401 && !cfg.__authRetry && !cfg.__skipAuthRetry && !AUTH_ENDPOINT.test(cfg.url || "") && hasSession()) {
        cfg.__authRetry = true;
        const r = await refreshSession();
        if (r.ok) {
          const hadAuth = cfg.headers?.Authorization || cfg.headers?.get?.("Authorization");
          if (hadAuth) { if (cfg.headers.set) cfg.headers.set("Authorization", `Bearer ${r.token}`); else cfg.headers.Authorization = `Bearer ${r.token}`; }
          return axios(cfg);
        }
        if (r.fatal) { clearSession(); window.dispatchEvent(new CustomEvent("bruno:session-expired", { detail: { code: r.code } })); }
        return Promise.reject(error);
      }

      cfg.__retries = cfg.__retries || 0;
      const retryable = method === "get" && kind !== "cancelled" && (isNetwork || RETRYABLE_STATUS.has(status)) && cfg.__retries < MAX_RETRIES && navigator.onLine !== false;
      if (retryable) {
        cfg.__retries += 1;
        await new Promise((r) => setTimeout(r, 400 * cfg.__retries + Math.random() * 200));
        return axios(cfg);
      }
      if (isNetwork && String(cfg.url || "").startsWith(API_BASE)) window.dispatchEvent(new CustomEvent("bruno:api-unreachable", { detail: { url: cfg.url, kind } }));
      return Promise.reject(error);
    },
  );
}
