/**
 * HighlightsSection — Instagram-style saved stories on a user's profile.
 *
 * Renders horizontal scroll of collection covers. Tapping opens that
 * collection in the BrunoStoryViewer so it plays through all saved stories
 * just like the 24h ones.
 *
 * Owner extras:
 *   - "+ Nueva" pill to create a new collection (prompts collection name and
 *     picks an active story to add).
 *   - Long-press / menu to rename or delete.
 */
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, BookmarkPlus, Trash2, Pencil, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import BrunoStoryViewer from "@/components/bruno/BrunoStoryViewer";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function HighlightsSection({ userId, isOwner = false, userName = "", avatarUrl = "" }) {
  const { token } = useAuth();
  const [data, setData] = useState({ collections: [], total_items: 0 });
  const [loading, setLoading] = useState(true);
  const [openCol, setOpenCol] = useState(null);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/stories/highlights/${userId}`);
      setData(res.data || { collections: [], total_items: 0 });
    } catch (_) {
      /* swallow */
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAddFromActive = async () => {
    setAdding(true);
    try {
      // Fetch user's currently active stories so they can pick one to highlight
      const res = await axios.get(`${API}/stories/user/${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const stories = res.data || [];
      if (stories.length === 0) {
        brunoToast.info("Publica una historia primero para destacarla aqui");
        return;
      }
      const colName = (window.prompt(
        "Nombre de la coleccion (ej. Viajes, Trabajo, Estilo):",
        "Destacadas"
      ) || "").trim();
      if (!colName) return;
      const last = stories[0];
      await axios.post(
        `${API}/stories/${last.id}/save`,
        { collection: colName, cover_url: last.media_url },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      brunoToast.success(`Guardado en "${colName}"`);
      refresh();
    } catch (e) {
      brunoToast.error(e?.response?.data?.detail || "No se pudo guardar la historia");
    } finally {
      setAdding(false);
    }
  };

  const deleteHighlight = async (highlightId) => {
    try {
      await axios.delete(`${API}/stories/highlights/${highlightId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      brunoToast.success("Historia destacada eliminada");
      refresh();
    } catch (_) {
      brunoToast.error("No se pudo eliminar");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground" data-testid="highlights-loading">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Cargando destacadas...
      </div>
    );
  }

  const hasCollections = data.collections.length > 0;
  if (!hasCollections && !isOwner) return null;

  return (
    <section className="mt-4" data-testid="highlights-section">
      <div className="flex items-center justify-between px-4 mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <BookmarkPlus className="w-4 h-4 text-purple-500" />
          Historias destacadas
        </h3>
        {isOwner && hasCollections && (
          <span className="text-[10px] text-muted-foreground">{data.total_items} guardadas</span>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none" data-testid="highlights-list">
        {isOwner && (
          <button
            type="button"
            onClick={handleAddFromActive}
            disabled={adding}
            data-testid="highlights-add-btn"
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            <span className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground/40 grid place-items-center bg-muted/30 group-hover:bg-muted/60 transition-colors">
              {adding ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <Plus className="w-6 h-6 text-muted-foreground" />}
            </span>
            <span className="text-[10px] text-muted-foreground">Nueva</span>
          </button>
        )}

        {data.collections.map((col) => (
          <button
            key={col.name}
            type="button"
            onClick={() => setOpenCol(col)}
            data-testid={`highlight-col-${col.name}`}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            <span
              className="w-16 h-16 rounded-full p-[2px] grid place-items-center"
              style={{ background: "conic-gradient(from 220deg, #b446ff, #ff2d75, #ff5a00, #b446ff)" }}
            >
              <span className="w-full h-full rounded-full bg-background grid place-items-center overflow-hidden">
                {col.cover_url ? (
                  <img src={col.cover_url} alt={col.name} className="w-[58px] h-[58px] rounded-full object-cover" />
                ) : (
                  <BookmarkPlus className="w-5 h-5 text-purple-500" />
                )}
              </span>
            </span>
            <span className="text-[11px] font-medium max-w-[64px] truncate">{col.name}</span>
            <span className="text-[9px] text-muted-foreground -mt-1">{col.count} {col.count === 1 ? "story" : "stories"}</span>
          </button>
        ))}
      </div>

      {/* Viewer for selected collection — items are saved-highlight rows w/ media */}
      <AnimatePresence>
        {openCol && (
          <BrunoStoryViewer
            userStories={{
              user_id: userId,
              user_name: userName,
              avatar_url: avatarUrl,
              stories: openCol.items.map((it) => ({
                id: it.story_id,
                user_id: userId,
                media_url: it.media_url,
                media_type: it.media_type,
                caption: it.caption,
                created_at: it.saved_at,
                duration: it.media_type === "video" ? 15 : 5,
                _highlight_id: it.id,
              })),
            }}
            allUsers={[]}
            onClose={() => setOpenCol(null)}
          />
        )}
      </AnimatePresence>

      {/* Owner-only actions menu (rename / delete) — quick visual list below ring */}
      {isOwner && hasCollections && (
        <details className="px-4 mt-2 group">
          <summary className="text-[10px] text-muted-foreground cursor-pointer list-none flex items-center gap-1">
            <Pencil className="w-3 h-3" />
            Gestionar destacadas
          </summary>
          <ul className="mt-2 space-y-1.5">
            {data.collections.flatMap((col) =>
              col.items.map((it) => (
                <li key={it.id} className="flex items-center gap-2 text-xs">
                  <img src={it.cover_url || it.media_url} alt="" className="w-7 h-7 rounded-md object-cover" />
                  <span className="truncate flex-1">{col.name} · {(it.caption || it.media_type).slice(0, 30)}</span>
                  <button
                    type="button"
                    onClick={() => deleteHighlight(it.id)}
                    className="text-destructive/80 hover:text-destructive p-1"
                    data-testid={`highlight-delete-${it.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </details>
      )}
    </section>
  );
}
