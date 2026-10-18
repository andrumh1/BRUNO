/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Plus } from "lucide-react";
import BrunoStoryViewer from "@/components/bruno/BrunoStoryViewer";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

// Active stories of followed users, shown as a strip over the reels; `reveal` (0..1) follows the upward scroll gesture.
export default function ReelsStoriesStrip({ token, user, visible, reveal }) {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [viewing, setViewing] = useState(null);
  const full = useMotionValue(1);
  const mv = reveal || full;
  const y = useTransform(mv, [0, 1], [-14, 0]);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/stories/feed`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setGroups(Array.isArray(r.data) ? r.data : []))
      .catch(() => setGroups([]));
  }, [token]);

  if (!token) return null;

  return (
    <>
      {visible && (
          <motion.div
            className="absolute inset-x-0 z-20 pointer-events-none" style={{ top: "calc(var(--safe-top) + 52px)", opacity: mv, y }}
            data-testid="reels-stories-strip"
          >
            <div className="flex gap-3 overflow-x-auto scrollbar-none px-3 py-2 pointer-events-auto" onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
              <button onClick={() => navigate("/camera")} className="flex flex-col items-center gap-1 shrink-0" data-testid="reels-story-create">
                <div className="relative w-14 h-14 rounded-full border-2 border-white/40 overflow-hidden bg-zinc-800 grid place-items-center">
                  {user?.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover opacity-80" /> : null}
                  <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-primary border-2 border-black grid place-items-center"><Plus className="w-3 h-3 text-white" strokeWidth={3} /></span>
                </div>
                <span className="text-[10px] text-white/90 drop-shadow">Tu historia</span>
              </button>
              {groups.map((g) => (
                <button key={g.user_id} onClick={() => setViewing(g)} className="flex flex-col items-center gap-1 shrink-0" data-testid={`reels-story-${g.user_id}`}>
                  <div className={`w-14 h-14 rounded-full p-[2px] ${g.has_unseen ? "bg-gradient-to-tr from-primary via-pink-500 to-yellow-400" : "bg-white/30"}`}>
                    <div className="w-full h-full rounded-full border-2 border-black overflow-hidden bg-zinc-800">
                      {g.avatar_url ? <img src={g.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-white text-sm font-bold">{(g.user_name || g.username || "?").charAt(0).toUpperCase()}</div>}
                    </div>
                  </div>
                  <span className="text-[10px] text-white/90 drop-shadow max-w-[60px] truncate">{g.user_name || g.username || "usuario"}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      {viewing && <BrunoStoryViewer userStories={viewing} allUsers={groups} onClose={() => setViewing(null)} onNavigate={(g) => setViewing(g)} />}
    </>
  );
}
