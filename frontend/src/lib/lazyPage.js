import React from "react";

const KEY = "bruno_chunk_reload";

// Carga diferida de páginas; si falla el chunk (red inestable o nuevo despliegue) reintenta una vez y recarga.
export function lazyPage(importer) {
  return React.lazy(() =>
    importer().then((m) => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } return m; }).catch(async (err) => {
      await new Promise((r) => setTimeout(r, 800));
      try { return await importer(); } catch (err2) {
        let reloaded = false; try { reloaded = sessionStorage.getItem(KEY) === "1"; } catch { /* ignore */ }
        if (!reloaded) { try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ } window.location.reload(); return new Promise(() => {}); }
        throw err2 || err;
      }
    }),
  );
}
