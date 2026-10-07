import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

/** /u/:username → /profile/:id (menciones en reels y comentarios). */
export default function UsernameRedirect() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    axios.get(`${API}/users/by-username/${encodeURIComponent(username)}`)
      .then((r) => navigate(`/profile/${r.data.id}`, { replace: true }))
      .catch(() => { setFailed(true); brunoToast.error(`No encontramos a @${username}`); setTimeout(() => navigate(-1), 900); });
  }, [username]); // eslint-disable-line react-hooks/exhaustive-deps
  return failed ? <div className="min-h-screen grid place-items-center text-sm text-muted-foreground" data-testid="username-not-found">Usuario no encontrado</div> : <BrunoLoader />;
}
