/**
 * LikesModal — shows all posts the user has liked, grouped by author.
 *
 *  Endpoint: GET /api/users/me/liked-posts
 *  Response: { total_likes, groups: [{ user, posts, count }] }
 *
 *  Each author group is collapsible; tap a post to navigate to the original.
 */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X, Heart, ChevronDown, ChevronUp, Loader2, MessageCircle, ImageIcon } from "lucide-react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import BrunoAvatar from "@/components/bruno/BrunoAvatar";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function PostMiniature({ post }) {
  const firstMedia = (post.media || [])[0];
  return (
    <Link
      to={`/post/${post.id}`}
      className="block rounded-xl border border-orange-100 hover:border-orange-300 bg-white p-3 transition-colors"
      data-testid={`liked-post-${post.id}`}
    >
      <div className="flex gap-3">
        {firstMedia?.url ? (
          firstMedia.type === "image" ? (
            <img src={firstMedia.url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-stone-900 flex items-center justify-center flex-shrink-0">
              <ImageIcon className="w-5 h-5 text-white/70" />
            </div>
          )
        ) : (
          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center flex-shrink-0">
            <Heart className="w-5 h-5 text-orange-500 fill-orange-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-stone-800 line-clamp-2">
            {post.content || <span className="italic text-stone-400">Sin texto</span>}
          </p>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-stone-500">
            <span className="inline-flex items-center gap-1">
              <Heart className="w-3 h-3 text-orange-500" />
              {post.likes_count || 0}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              {post.comments_count || 0}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function AuthorGroup({ group, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const u = group.user || {};
  return (
    <div className="bg-orange-50/40 rounded-2xl border border-orange-100 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-3 hover:bg-orange-100/40 transition-colors"
        data-testid={`liked-group-${u.id}`}
      >
        <BrunoAvatar userId={u.id} src={u.avatar_url} name={u.display_name || u.username} size={40} />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-bold text-stone-900 truncate">{u.display_name || u.username || "Usuario"}</p>
          <p className="text-[11px] text-stone-500">{group.count} publicación{group.count === 1 ? "" : "es"}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
          <Heart className="w-3 h-3 fill-current" /> {group.count}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-orange-500" /> : <ChevronDown className="w-4 h-4 text-orange-500" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2">
              {group.posts.map(p => (
                <PostMiniature key={p.id} post={p} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LikesModal({ open, onClose }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ total_likes: 0, groups: [] });

  useEffect(() => {
    if (!open || !token) return;
    let active = true;
    setLoading(true);
    axios.get(`${API}/users/me/liked-posts`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => { if (active) setData(res.data); })
      .catch(() => { if (active) setData({ total_likes: 0, groups: [] }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, token]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose} data-testid="likes-modal-backdrop">
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col overflow-hidden"
        style={{ background: "linear-gradient(180deg,#FFFCF6 0%,#FFF1DF 100%)" }}
        onClick={e => e.stopPropagation()}
        data-testid="likes-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-orange-100">
          <div className="flex items-center gap-2">
            <div className="grid place-items-center w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 shadow-md shadow-orange-500/30">
              <Heart className="w-4 h-4 text-white fill-white" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900">Tus likes</h3>
              <p className="text-[11px] text-stone-500">
                {loading ? "Cargando..." : `${data.total_likes} publicaci${data.total_likes === 1 ? "ón" : "ones"} · ${data.groups.length} perfil${data.groups.length === 1 ? "" : "es"}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center w-9 h-9 rounded-full bg-white/80 border border-orange-200 text-stone-600 hover:bg-white"
            data-testid="likes-modal-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          ) : data.groups.length === 0 ? (
            <div className="text-center py-10">
              <Heart className="w-10 h-10 mx-auto text-orange-300 mb-3" />
              <p className="text-sm font-semibold text-stone-700">Aún no tienes likes</p>
              <p className="text-xs text-stone-500 mt-1">Toca el corazón en cualquier publicación para empezar.</p>
            </div>
          ) : (
            data.groups.map((g, i) => (
              <AuthorGroup key={g.user?.id || `g-${i}`} group={g} defaultOpen={i < 2} />
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
