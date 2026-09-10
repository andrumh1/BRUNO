from typing import Optional


def _is_video_post(post: dict) -> bool:
    if not post:
        return False
    if post.get("post_type") == "video" or post.get("video_url"):
        return True
    return any((m or {}).get("type") == "video" for m in (post.get("media") or []))


def _post_preview(post: dict) -> Optional[str]:
    for m in (post.get("media") or []):
        if m.get("poster_url") or m.get("thumbnail_url"):
            return m.get("poster_url") or m.get("thumbnail_url")
        if m.get("type") != "video" and m.get("url"):
            return m.get("url")
    return post.get("thumbnail_url") or post.get("image_url") or ((post.get("attachments") or [{}])[0].get("url"))


async def enrich_notification(notif: dict) -> dict:
    """Attach deep-link `url`, `preview_url`, `target_label` and a human `message`
    so tapping a notification always lands on the thing that happened."""
    from utils.database import db

    ntype = notif.get("type") or ""
    ttype = notif.get("target_type") or ""
    tid = notif.get("target_id")
    actor = (notif.get("actor") or {}).get("username") or notif.get("actor_name") or "Alguien"

    url = notif.get("url") or notif.get("action_url")
    preview = None
    label = None

    post = None
    comment_id = None
    if ttype == "comment" and tid:
        c = await db.comments.find_one({"id": tid}, {"_id": 0, "post_id": 1})
        if c:
            comment_id = tid
            post = await db.posts.find_one({"id": c["post_id"]}, {"_id": 0})
    elif ttype == "post" and tid:
        post = await db.posts.find_one({"id": tid}, {"_id": 0})

    if post:
        is_video = _is_video_post(post)
        label = "reel" if is_video else "publicación"
        preview = _post_preview(post)
        base = f"/reels?id={post['id']}" if is_video else f"/post/{post['id']}"
        if ntype in ("comment", "mention") or comment_id:
            base += ("&" if "?" in base else "?") + "comments=1"
            if comment_id:
                base += f"&comment={comment_id}"
        url = url or base
    elif ttype == "user" and tid:
        url = url or f"/profile/{tid}"
    elif ttype in ("chat", "conversation", "message") and tid:
        url = url or f"/chat/{tid}"
    elif ttype == "live" and tid:
        url = url or f"/lives/{tid}"
    elif ttype == "story" and tid:
        url = url or f"/stories/{tid}"
    elif ttype == "card" and tid:
        url = url or f"/c/{tid}"

    if not url:
        url = {"follow": f"/profile/{notif.get('actor_id')}" if notif.get("actor_id") else "/my-profile",
               "moderation_warning": "/settings", "new_message": "/chat"}.get(ntype, "/notifications")

    if not notif.get("message") and not notif.get("body"):
        what = label or "contenido"
        notif["message"] = {
            "like": f"A {actor} le gustó tu {what}",
            "comment": f"{actor} comentó tu {what}",
            "mention": f"{actor} te mencionó en un{'a ' + what if what == 'publicación' else ' ' + what}",
            "repost": f"{actor} compartió tu {what}",
            "follow": f"{actor} comenzó a seguirte",
            "remix": f"{actor} hizo un remix de tu {what}",
        }.get(ntype, notif.get("title") or "Tienes una nueva notificación")

    notif["url"] = url
    notif["preview_url"] = preview
    notif["target_label"] = label
    return notif


async def emit_notification_ws(notif_doc: dict, user_id: Optional[str] = None) -> None:
    """Send a 'notification' event over the user's open WebSocket connections.

    Uses the global ws_manager from server.py. Failures are swallowed so we
    never break the request that created the notification.
    """
    try:
        target = user_id or notif_doc.get("user_id")
        if not target:
            return
        try:
            notif_doc = await enrich_notification(dict(notif_doc))
        except Exception:
            pass
        from utils.ws_manager import ws_manager
        payload = {
            "type": "notification",
            "notification": notif_doc,
        }
        await ws_manager.send_personal_message(payload, target)
    except Exception:
        # best-effort — never block the caller
        return
