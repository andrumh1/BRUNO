// Reintento de WebSocket con retroceso exponencial + jitter (evita tormentas de reconexión en redes móviles inestables).
export function makeBackoff(base = 1500, max = 30000) {
  let attempt = 0;
  return {
    reset() { attempt = 0; },
    next() {
      const delay = Math.min(max, base * 2 ** attempt) * (0.7 + Math.random() * 0.6);
      attempt = Math.min(attempt + 1, 6);
      return navigator.onLine === false ? max : Math.round(delay);
    },
  };
}

// Ejecuta `cb` en cuanto el dispositivo vuelve a tener conexión; devuelve la función para desuscribirse.
export function onBackOnline(cb) {
  window.addEventListener("online", cb);
  return () => window.removeEventListener("online", cb);
}
