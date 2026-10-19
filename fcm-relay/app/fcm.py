"""Envío a FCM v1 con firebase-admin (ADC de la cuenta de servicio del servicio Cloud Run; sin claves JSON)."""
import asyncio
import logging
import os
from typing import List, Tuple

logger = logging.getLogger("fcm-relay.fcm")
_sem = asyncio.Semaphore(int(os.environ.get("FCM_CONCURRENCY", "20")))
DEAD_CODES = ("unregistered", "invalid-argument", "not-found", "registration-token-not-registered")


class FcmSender:
    def __init__(self):
        import firebase_admin
        from firebase_admin import credentials, messaging
        if not firebase_admin._apps:
            firebase_admin.initialize_app(credentials.ApplicationDefault(), {"projectId": os.environ["GOOGLE_CLOUD_PROJECT"]})
        self._m = messaging

    async def send(self, req) -> Tuple[int, int, List[str]]:
        m = self._m
        data = dict(req.data)
        if req.url:
            data.setdefault("url", req.url)
        msg = m.MulticastMessage(
            tokens=req.tokens,
            notification=m.Notification(title=req.title, body=req.body, image=req.image),
            data=data,
            android=m.AndroidConfig(priority="high", notification=m.AndroidNotification(icon="ic_notification", color="#FF6B35", sound="default", click_action="FLUTTER_NOTIFICATION_CLICK")),
            apns=m.APNSConfig(payload=m.APNSPayload(aps=m.Aps(alert=m.ApsAlert(title=req.title, body=req.body), sound="default", badge=1, content_available=True))),
        )
        async with _sem:
            resp = await asyncio.to_thread(m.send_each_for_multicast, msg, req.dry_run)
        invalid = []
        for tok, r in zip(req.tokens, resp.responses):
            if not r.success:
                code = str(getattr(r.exception, "code", "") or r.exception).lower()
                if any(c in code for c in DEAD_CODES):
                    invalid.append(tok)
                else:
                    logger.warning("fcm_error", extra={"code": code[:80]})
        return resp.success_count, resp.failure_count, invalid
