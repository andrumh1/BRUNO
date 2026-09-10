import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const PAGE = 12;

export const normalizeReel = (post) => {
  const firstMedia = (post.media || [])[0] || {};
  const firstAttach = (post.attachments || [])[0] || {};
  const url = firstMedia.url || firstMedia.secure_url || firstAttach.url || post.media_url || post.image_url;
  const isVideo = firstMedia.type === "video" || /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(url || "");
  return {
    ...post,
    video_url: isVideo ? url : post.video_url || null,
    mp4_url: firstMedia.mp4_url || firstAttach.mp4_url || post.mp4_url || null,
    poster_url: firstMedia.poster_url || firstAttach.poster_url || post.poster_url || post.thumbnail_url || null,
    image_url: !isVideo ? url : post.image_url || post.thumbnail_url || null,
    thumbnail_url: post.thumbnail_url || firstMedia.poster_url || (!isVideo ? url : null),
    audio_name: post.audio_name || post.music?.title || null,
    author: {
      id: post.user?.id || post.user_id,
      name: post.user?.display_name || post.user?.name,
      username: post.user?.username || post.user?.name,
      avatar_url: post.user?.avatar_url,
    },
  };
};

/**
 * useReelsFeed — infinite, algorithmic reels feed with dedupe + history.
 *  mode: "for_you" | "following" | { userId }  (profile mode = chronological)
 */
export function useReelsFeed({ token, mode, profileUserId, initialReelId }) {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const seenRef = useRef(new Set());
  const seedRef = useRef(Math.floor(Math.random() * 1e9));
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchPage = useCallback(async (reset = false) => {
    const exclude = reset ? [] : [...seenRef.current];
    const url = profileUserId
      ? `${API}/posts?user_id=${profileUserId}&media_only=true&limit=60`
      : `${API}/posts/recommended-videos?limit=${PAGE}&mode=${mode}&seed=${seedRef.current}&exclude=${exclude.join(",")}`;
    const res = await axios.get(url, { headers }).catch(() => ({ data: [] }));
    let list = (Array.isArray(res.data) ? res.data : [])
      .filter((p) => (Array.isArray(p.media) && p.media.some((m) => m.url || m.secure_url)) || p.media_url || p.image_url || p.attachments?.length)
      .map(normalizeReel)
      .filter((r) => r.video_url || r.image_url);
    if (profileUserId) list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    list = list.filter((r) => reset || !seenRef.current.has(r.id));
    list.forEach((r) => seenRef.current.add(r.id));
    return list;
  }, [token, mode, profileUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    seenRef.current = new Set();
    setLoading(true); setDone(false);
    (async () => {
      const first = await fetchPage(true);
      if (cancelled) return;
      // Deep-link: make sure the requested reel is first
      if (initialReelId && !first.some((r) => r.id === initialReelId)) {
        const one = await axios.get(`${API}/posts/${initialReelId}`, { headers }).then((r) => normalizeReel(r.data)).catch(() => null);
        if (one) { first.unshift(one); seenRef.current.add(one.id); }
      } else if (initialReelId) {
        const idx = first.findIndex((r) => r.id === initialReelId);
        if (idx > 0) first.unshift(...first.splice(idx, 1));
      }
      setReels(first);
      setDone(profileUserId ? true : first.length < PAGE);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fetchPage, initialReelId, profileUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (loadingMore || done || profileUserId) return;
    setLoadingMore(true);
    const more = await fetchPage(false);
    setReels((prev) => [...prev, ...more]);
    if (more.length === 0) setDone(true);
    setLoadingMore(false);
  }, [fetchPage, loadingMore, done, profileUserId]);

  const trackView = useCallback((id) => {
    axios.post(`${API}/posts/${id}/view`, {}, { headers }).catch(() => {});
    try {
      const h = JSON.parse(localStorage.getItem("bruno-reels-history") || "[]").filter((x) => x !== id);
      h.unshift(id);
      localStorage.setItem("bruno-reels-history", JSON.stringify(h.slice(0, 200)));
    } catch (_) { /* ignore */ }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchReel = useCallback((id, patch) => {
    setReels((prev) => prev.map((r) => (r.id === id ? { ...r, ...(typeof patch === "function" ? patch(r) : patch) } : r)));
  }, []);

  return { reels, loading, loadingMore, done, loadMore, trackView, patchReel };
}
