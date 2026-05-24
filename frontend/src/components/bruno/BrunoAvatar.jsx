/**
 * BrunoAvatar — universal circular avatar with auto story-ring detection.
 *
 *  Usage:
 *    <BrunoAvatar userId={id} src={avatar} name="Carlos" size={48} />
 *
 *  Subscribes to a global "story activity" map (BrunoStoryContext) which keeps
 *  ONE socket-fed map of who has an active 24h story. Publishing a story from
 *  anywhere in the app updates this map instantly, so every avatar (feed,
 *  chat, profile, map pill) lights up its bubble at the same time.
 */
import React, { useCallback } from "react";
import axios from "axios";
import StoryRing from "@/components/bruno/StoryRing";
import { useStoryActivity } from "@/contexts/StoryActivityContext";
import { useAuth } from "@/contexts/AuthContext";
import BrunoStoryViewer from "@/components/bruno/BrunoStoryViewer";
import { User as UserIcon } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BrunoAvatar({
  userId,
  src,
  name = "",
  size = 48,
  thickness = 2,
  testId,
  onClick,
  fallback = null,
}) {
  const { activeMap } = useStoryActivity();
  const { token } = useAuth();
  const [storiesData, setStoriesData] = React.useState(null);

  const hasActive = !!(userId && activeMap[userId]);

  const openStories = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await axios.get(`${API}/stories/user/${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const stories = res.data || [];
      if (stories.length === 0) return;
      setStoriesData({
        user_id: userId,
        user_name: name || "Usuario",
        avatar_url: src,
        stories,
      });
    } catch (_) { /* swallow */ }
  }, [userId, name, src, token]);

  const fallbackEl = fallback || (
    <div
      className="w-full h-full grid place-items-center bg-gradient-to-br from-orange-100 to-orange-200 text-orange-600 font-bold"
      style={{ fontSize: size * 0.4 }}
    >
      {name ? name[0]?.toUpperCase() : <UserIcon className="w-1/2 h-1/2 opacity-70" />}
    </div>
  );

  return (
    <>
      <StoryRing
        hasActive={hasActive}
        size={size}
        thickness={thickness}
        testId={testId}
        onOpen={openStories}
      >
        {src ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover"
            onClick={onClick}
          />
        ) : (
          fallbackEl
        )}
      </StoryRing>

      {storiesData && (
        <BrunoStoryViewer
          userStories={storiesData}
          allUsers={[]}
          onClose={() => setStoriesData(null)}
        />
      )}
    </>
  );
}
