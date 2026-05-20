/**
 * useActiveStories — fetches which of the given user_ids have an active
 * non-expired 24h story right now. Returns { activeMap, openStories(uid) }.
 *
 * Backed by GET /api/stories/active-users?user_ids=... and
 * GET /api/stories/user/{uid} for opening the viewer.
 */
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function useActiveStories(userIds = [], { enabled = true } = {}) {
  const { token } = useAuth();
  const [activeMap, setActiveMap] = useState({});
  const [openedStories, setOpenedStories] = useState(null);

  const fetchActive = useCallback(async () => {
    if (!enabled || userIds.length === 0) {
      setActiveMap({});
      return;
    }
    try {
      const ids = userIds.filter(Boolean).join(",");
      const res = await axios.get(`${API}/stories/active-users`, {
        params: { user_ids: ids },
      });
      setActiveMap(res.data?.active || {});
    } catch (_) {
      /* swallow */
    }
  }, [enabled, userIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  const openStories = useCallback(
    async (uid, userName = "Usuario", avatarUrl = "") => {
      if (!uid) return;
      try {
        const res = await axios.get(`${API}/stories/user/${uid}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const stories = res.data || [];
        if (stories.length === 0) {
          setOpenedStories(null);
          return false;
        }
        setOpenedStories({
          user_id: uid,
          user_name: userName,
          avatar_url: avatarUrl,
          stories,
        });
        return true;
      } catch (_) {
        return false;
      }
    },
    [token]
  );

  const closeStories = useCallback(() => setOpenedStories(null), []);

  return { activeMap, openStories, closeStories, openedStories, refreshActive: fetchActive };
}
