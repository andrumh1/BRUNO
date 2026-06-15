/**
 * I18nProvider — global locale, currency and FX-rate context.
 *
 *  Detection order:
 *    1. authenticated user preference  (/api/i18n/detect)
 *    2. localStorage cache             ("bruno-i18n")
 *    3. fresh /api/i18n/detect         (IP/header based)
 *    4. en-US / USD fallback
 *
 *  Public API via `useI18n()`:
 *    { country, currency, locale, isEU, compliance,
 *      countries, currencies, rates,
 *      setPreference(currency, country),
 *      formatPrice(amount, fromCurrency?),  // converts + formats
 *      convert(amount, from, to),
 *    }
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STORAGE_KEY = "bruno-i18n";

const DEFAULT = {
  country: "US",
  currency: "USD",
  locale: "en-US",
  isEU: false,
  compliance: { framework: "generic", framework_label: "Standard", consent_required: false },
};

const I18nContext = createContext({
  ...DEFAULT,
  countries: [],
  currencies: [],
  rates: { base: "USD", rates: {} },
  setPreference: async () => {},
  formatPrice: () => "",
  convert: () => 0,
  ready: false,
});

export function I18nProvider({ children }) {
  const { token } = useAuth();
  const [state, setState] = useState(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) return { ...DEFAULT, ...JSON.parse(cached), ready: false };
    } catch (_e) { /* ignore */ }
    return { ...DEFAULT, ready: false };
  });
  const [countries, setCountries] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [rates, setRates] = useState({ base: "USD", rates: {} });

  // Detect locale (depends on auth)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`${API}/i18n/detect`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (cancelled) return;
        const next = {
          country: r.data.country,
          currency: r.data.currency,
          locale: r.data.locale,
          isEU: !!r.data.is_eu,
          compliance: r.data.compliance,
          countryName: r.data.country_name,
          taxKind: r.data.tax_kind,
          taxRateDefault: r.data.tax_rate_default,
          ready: true,
        };
        setState(next);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (_e) { /* ignore */ }
      } catch (_e) {
        if (!cancelled) setState((p) => ({ ...p, ready: true }));
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Fetch reference data once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, cu, rt] = await Promise.all([
          axios.get(`${API}/i18n/countries`),
          axios.get(`${API}/i18n/currencies`),
          axios.get(`${API}/i18n/rates?base=USD`),
        ]);
        if (cancelled) return;
        setCountries(c.data?.countries || []);
        setCurrencies(cu.data?.currencies || []);
        setRates({ base: rt.data?.base || "USD", rates: rt.data?.rates || {} });
      } catch (_e) { /* offline */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const convert = useCallback((amount, from, to) => {
    from = (from || rates.base || "USD").toUpperCase();
    to = (to || state.currency || "USD").toUpperCase();
    if (!amount || from === to) return amount;
    const r = rates.rates || {};
    const fromRate = from === rates.base ? 1 : r[from];
    const toRate = to === rates.base ? 1 : r[to];
    if (!fromRate || !toRate) return amount;
    const inBase = amount / fromRate;
    return inBase * toRate;
  }, [rates, state.currency]);

  const formatPrice = useCallback((amount, fromCurrency) => {
    const target = state.currency || "USD";
    const converted = convert(amount, fromCurrency || target, target);
    try {
      return new Intl.NumberFormat(state.locale || "en-US", {
        style: "currency",
        currency: target,
        maximumFractionDigits: ["COP", "CLP", "HUF", "JPY"].includes(target) ? 0 : 2,
      }).format(converted);
    } catch (_e) {
      return `${target} ${(+converted).toFixed(2)}`;
    }
  }, [state.currency, state.locale, convert]);

  const setPreference = useCallback(async (currency, country, locale) => {
    if (!token) {
      const next = { ...state, currency: (currency || state.currency).toUpperCase(), country: country || state.country, locale: locale || state.locale };
      setState(next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (_e) { /* ignore */ }
      return next;
    }
    const r = await axios.post(`${API}/i18n/preference`,
      { currency, country, locale },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const cfg = countries.find((c) => c.code === (country || state.country).toUpperCase());
    const next = {
      ...state,
      currency: r.data?.preferred_currency || currency,
      country: r.data?.preferred_country || country || state.country,
      locale: r.data?.preferred_locale || locale || (cfg?.locale ?? state.locale),
      isEU: cfg?.is_eu ?? state.isEU,
    };
    setState(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (_e) { /* ignore */ }
    return next;
  }, [token, state, countries]);

  const value = useMemo(() => ({
    ...state,
    countries,
    currencies,
    rates,
    setPreference,
    formatPrice,
    convert,
  }), [state, countries, currencies, rates, setPreference, formatPrice, convert]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
