/**
 * StoryActivityContext — one global store of "who has an active story right now".
 *
 *  - On mount, fetches active stories for the current user + a bootstrap list
 *    of users you might interact with (followings, recent chats).
 *  - Exposes `markUserActive(userId)` so callers (the publish-story modal) can
 *    instantly mark themselves/another user as active.
 *  - Listens to the global realtime WebSocket via RealtimeNotificationContext:
 *    when an event of kind `story_published` arrives, the publisher's avatar
 *    lights up everywhere.
 *
 *  Components like <BrunoAvatar/> simply call `useStoryActivity()` to know if
 *  they should render the glowing bubble ring.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeNotifications } from "@/contexts/RealtimeNotificationContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Ctx = createContext({
  activeMap: {},
  registerUserIds: () => {},
  markUserActive: () => {},
  refresh: async () => {},
});

export const useStoryActivity = () => useContext(Ctx);

export default function StoryActivityProvider({ children }) {
  const { user, token } = useAuth();
  const { subscribe } = useRealtimeNotifications();
  const [activeMap, setActiveMap] = useState({});
  const [trackedIds, setTrackedIds] = useState(() => new Set());

  // Public: components register the userIds they care about
  const registerUserIds = useCallback((ids = []) => {
    if (!ids.length) return;
    setTrackedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of ids) {
        if (id && !next.has(id)) { next.add(id); changed = true; }
      }
      return changed ? next : prev;
    });
  }, []);

  // Mark a user as having an active story instantly (e.g. just published)
  const markUserActive = useCallback((uid, count = 1) => {
    if (!uid) return;
    setActiveMap((m) => ({ ...m, [uid]: count }));
  }, []);

  const refresh = useCallback(async () => {
    const ids = Array.from(trackedIds);
    if (user?.id) ids.push(user.id);
    if (!ids.length) return;
    try {
      const res = await axios.get(`${API}/stories/active-users`, {
        params: { user_ids: ids.join(",") },
      });
      setActiveMap(res.data?.active || {});
    } catch (_) { /* swallow */ }
  }, [trackedIds, user?.id]);

  useEffect(() => {
    refresh();
    // Refresh every 90s as a safety net (in case WS misses an event)
    const t = setInterval(refresh, 90000);
    return () => clearInterval(t);
  }, [refresh]);

  // Auto-track the current user always
  useEffect(() => {
    if (user?.id) registerUserIds([user.id]);
  }, [user?.id, registerUserIds]);

  // Realtime: when anyone publishes a story → light up their avatar instantly
  useEffect(() => {
    const unsub = subscribe((evt) => {
      if (!evt) return;
      if (evt.type === "story_published" || evt.kind === "story_published") {
        if (evt.user_id) markUserActive(evt.user_id);
      }
      if (evt.type === "story_expired" || evt.kind === "story_expired") {
        if (evt.user_id) {
          setActiveMap((m) => {
            const next = { ...m };
            delete next[evt.user_id];
            return next;
          });
        }
      }
    });
    return unsub;
  }, [subscribe, markUserActive]);

  // Also expose token so any consumer that needs it has access
  const value = useMemo(
    () => ({ activeMap, registerUserIds, markUserActive, refresh, token }),
    [activeMap, registerUserIds, markUserActive, refresh, token]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
