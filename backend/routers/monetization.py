"""
Monetization Router - Sponsored content, promoted cards, and creator monetization
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os
import uuid

router = APIRouter(tags=["monetization"])

# Database connection
db = None

def set_db(database):
    global db
    db = database

# Models
class CreateSponsoredPostRequest(BaseModel):
    post_id: Optional[str] = None  # Existing post to promote, or create new
    title: Optional[str] = None
    content: Optional[str] = None
    media_urls: List[str] = []
    target_audience: str = "all"  # all, followers, location, interests
    budget_points: int  # Points to spend
    duration_days: int = 7
    target_location: Optional[str] = None
    target_interests: List[str] = []

class PromoteCardRequest(BaseModel):
    card_id: str
    promotion_type: str  # "map_highlight", "feed_featured", "search_boost"
    budget_points: int
    duration_days: int = 7

class CreatorPayoutRequest(BaseModel):
    amount_points: int
    payout_method: str  # "bank", "paypal", "crypto"
    payout_details: dict

# Promotion costs (points per day)
PROMOTION_COSTS = {
    "sponsored_post": 50,  # 50 points per day
    "map_highlight": 100,  # 100 points per day for map visibility
    "feed_featured": 75,   # 75 points per day for feed boost
    "search_boost": 30,    # 30 points per day for search ranking
}

# Creator revenue share (percentage)
CREATOR_REVENUE_SHARE = 0.70  # 70% to creator

# Helper to get current user
async def get_current_user_from_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    
    import jwt
    try:
        payload = jwt.decode(token, os.environ.get("SECRET_KEY", "super-secret-key"), algorithms=["HS256"])
        email = payload.get("sub")
        user_id = payload.get("user_id")
        
        if user_id:
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        elif email:
            user = await db.users.find_one({"email": email}, {"_id": 0, "password": 0})
        else:
            raise HTTPException(status_code=401, detail="Invalid token format")
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============================================
# SPONSORED POSTS
# ============================================

@router.post("/api/monetization/sponsored-posts")
async def create_sponsored_post(
    request: CreateSponsoredPostRequest,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Create a sponsored post promotion"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Calculate total cost
    total_cost = PROMOTION_COSTS["sponsored_post"] * request.duration_days
    if request.budget_points < total_cost:
        raise HTTPException(
            status_code=400, 
            detail=f"Presupuesto insuficiente. Mínimo requerido: {total_cost} puntos para {request.duration_days} días"
        )
    
    # Check user has enough points
    user = await db.users.find_one({"id": current_user["id"]})
    if user.get("points", 0) < request.budget_points:
        raise HTTPException(status_code=400, detail="Puntos insuficientes")
    
    # Create or get post
    if request.post_id:
        post = await db.posts.find_one({"id": request.post_id, "author_id": current_user["id"]})
        if not post:
            raise HTTPException(status_code=404, detail="Post no encontrado")
    else:
        # Create new sponsored post
        post_id = str(uuid.uuid4())
        post_doc = {
            "id": post_id,
            "author_id": current_user["id"],
            "content": request.content or "",
            "media_urls": request.media_urls,
            "is_sponsored": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "likes_count": 0,
            "comments_count": 0
        }
        await db.posts.insert_one(post_doc)
        request.post_id = post_id
    
    # Create promotion record
    promotion_id = str(uuid.uuid4())
    start_date = datetime.now(timezone.utc)
    end_date = start_date + timedelta(days=request.duration_days)
    
    promotion_doc = {
        "id": promotion_id,
        "type": "sponsored_post",
        "user_id": current_user["id"],
        "post_id": request.post_id,
        "target_audience": request.target_audience,
        "target_location": request.target_location,
        "target_interests": request.target_interests,
        "budget_points": request.budget_points,
        "spent_points": 0,
        "duration_days": request.duration_days,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "status": "active",
        "impressions": 0,
        "clicks": 0,
        "engagements": 0,
        "created_at": start_date.isoformat()
    }
    
    await db.promotions.insert_one(promotion_doc)
    
    # Deduct points
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"points": -request.budget_points}}
    )
    
    # Mark post as sponsored
    await db.posts.update_one(
        {"id": request.post_id},
        {"$set": {"is_sponsored": True, "promotion_id": promotion_id}}
    )
    
    return {
        "id": promotion_id,
        "post_id": request.post_id,
        "budget_points": request.budget_points,
        "duration_days": request.duration_days,
        "end_date": end_date.isoformat(),
        "estimated_reach": request.budget_points * 10  # Rough estimate
    }

@router.get("/api/monetization/sponsored-posts")
async def get_my_sponsored_posts(
    current_user: dict = Depends(get_current_user_from_token)
):
    """Get user's sponsored post campaigns"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    promotions = await db.promotions.find(
        {"user_id": current_user["id"], "type": "sponsored_post"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return promotions

@router.get("/api/feed/sponsored")
async def get_sponsored_posts_for_feed(
    location: Optional[str] = None,
    limit: int = 3
):
    """Get sponsored posts for the feed (shown to users)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get active promotions
    query = {
        "type": "sponsored_post",
        "status": "active",
        "end_date": {"$gt": now}
    }
    
    if location:
        query["$or"] = [
            {"target_location": None},
            {"target_location": location},
            {"target_audience": "all"}
        ]
    
    promotions = await db.promotions.find(
        query,
        {"_id": 0}
    ).sort("budget_points", -1).limit(limit).to_list(limit)
    
    # Get the actual posts
    sponsored_posts = []
    for promo in promotions:
        post = await db.posts.find_one({"id": promo["post_id"]}, {"_id": 0})
        if post:
            # Get author info
            author = await db.users.find_one({"id": post["author_id"]}, {"_id": 0, "password": 0})
            post["author"] = author
            post["promotion"] = {
                "id": promo["id"],
                "type": "sponsored"
            }
            sponsored_posts.append(post)
            
            # Increment impressions
            await db.promotions.update_one(
                {"id": promo["id"]},
                {"$inc": {"impressions": 1}}
            )
    
    return sponsored_posts

# ============================================
# PROMOTED CARDS (Map & Feed)
# ============================================

@router.post("/api/monetization/promote-card")
async def promote_card(
    request: PromoteCardRequest,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Promote a card on the map or feed"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Validate promotion type
    if request.promotion_type not in PROMOTION_COSTS:
        raise HTTPException(status_code=400, detail="Tipo de promoción inválido")
    
    # Calculate cost
    cost_per_day = PROMOTION_COSTS[request.promotion_type]
    total_cost = cost_per_day * request.duration_days
    
    if request.budget_points < total_cost:
        raise HTTPException(
            status_code=400,
            detail=f"Presupuesto insuficiente. Mínimo: {total_cost} puntos"
        )
    
    # Check card ownership
    card = await db.cards.find_one({"id": request.card_id, "user_id": current_user["id"]})
    if not card:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    
    # Check user points
    user = await db.users.find_one({"id": current_user["id"]})
    if user.get("points", 0) < request.budget_points:
        raise HTTPException(status_code=400, detail="Puntos insuficientes")
    
    # Create promotion
    promotion_id = str(uuid.uuid4())
    start_date = datetime.now(timezone.utc)
    end_date = start_date + timedelta(days=request.duration_days)
    
    promotion_doc = {
        "id": promotion_id,
        "type": request.promotion_type,
        "user_id": current_user["id"],
        "card_id": request.card_id,
        "budget_points": request.budget_points,
        "spent_points": 0,
        "duration_days": request.duration_days,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "status": "active",
        "impressions": 0,
        "clicks": 0,
        "created_at": start_date.isoformat()
    }
    
    await db.promotions.insert_one(promotion_doc)
    
    # Deduct points
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"points": -request.budget_points}}
    )
    
    # Update card with promotion info
    await db.cards.update_one(
        {"id": request.card_id},
        {"$set": {
            f"promotion_{request.promotion_type}": {
                "id": promotion_id,
                "end_date": end_date.isoformat(),
                "active": True
            }
        }}
    )
    
    return {
        "id": promotion_id,
        "card_id": request.card_id,
        "promotion_type": request.promotion_type,
        "budget_points": request.budget_points,
        "end_date": end_date.isoformat()
    }

@router.get("/api/map/promoted-cards")
async def get_promoted_cards_for_map(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    limit: int = 10
):
    """Get promoted cards for map display"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get cards with active map_highlight promotions
    promoted_cards = await db.cards.find(
        {
            "promotion_map_highlight.active": True,
            "promotion_map_highlight.end_date": {"$gt": now},
            "location": {"$exists": True}
        },
        {"_id": 0}
    ).limit(limit).to_list(limit)
    
    # Track impressions
    for card in promoted_cards:
        promo_id = card.get("promotion_map_highlight", {}).get("id")
        if promo_id:
            await db.promotions.update_one(
                {"id": promo_id},
                {"$inc": {"impressions": 1}}
            )
    
    return promoted_cards

@router.get("/api/feed/promoted-businesses")
async def get_promoted_businesses(limit: int = 5):
    """Get promoted businesses for feed sidebar/section"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get cards with active feed_featured promotions
    promoted = await db.cards.find(
        {
            "promotion_feed_featured.active": True,
            "promotion_feed_featured.end_date": {"$gt": now}
        },
        {"_id": 0}
    ).sort("promotion_feed_featured.budget_points", -1).limit(limit).to_list(limit)
    
    return promoted

# ============================================
# CREATOR MONETIZATION
# ============================================

@router.get("/api/monetization/creator/earnings")
async def get_creator_earnings(
    current_user: dict = Depends(get_current_user_from_token)
):
    """Get creator's earnings summary"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    user_id = current_user["id"]
    
    # Get earnings from gifts in lives
    gift_earnings = await db.live_gifts.aggregate([
        {"$match": {"receiver_id": user_id}},
        {"$group": {
            "_id": None,
            "total_value": {"$sum": "$value"},
            "total_gifts": {"$sum": "$amount"}
        }}
    ]).to_list(1)
    
    gift_total = gift_earnings[0] if gift_earnings else {"total_value": 0, "total_gifts": 0}
    
    # Creator gets 70% of gift value
    creator_earnings = int(gift_total.get("total_value", 0) * CREATOR_REVENUE_SHARE)
    
    # Get pending payouts
    pending_payouts = await db.payouts.find(
        {"user_id": user_id, "status": "pending"},
        {"_id": 0}
    ).to_list(10)
    
    pending_amount = sum(p.get("amount_points", 0) for p in pending_payouts)
    
    # Get completed payouts
    completed_payouts = await db.payouts.find(
        {"user_id": user_id, "status": "completed"},
        {"_id": 0}
    ).to_list(50)
    
    paid_amount = sum(p.get("amount_points", 0) for p in completed_payouts)
    
    # Available to withdraw
    available = creator_earnings - pending_amount - paid_amount
    
    return {
        "total_earnings_points": creator_earnings,
        "total_gifts_received": gift_total.get("total_gifts", 0),
        "pending_payout": pending_amount,
        "paid_out": paid_amount,
        "available_to_withdraw": max(0, available),
        "revenue_share_percentage": int(CREATOR_REVENUE_SHARE * 100),
        "minimum_payout": 1000  # Minimum 1000 points to withdraw
    }

@router.post("/api/monetization/creator/payout")
async def request_payout(
    request: CreatorPayoutRequest,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Request a payout of earnings"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get available balance
    earnings = await get_creator_earnings(current_user)
    available = earnings["available_to_withdraw"]
    
    if request.amount_points > available:
        raise HTTPException(status_code=400, detail="Saldo insuficiente")
    
    if request.amount_points < 1000:
        raise HTTPException(status_code=400, detail="Mínimo de retiro: 1000 puntos")
    
    # Create payout request
    payout_id = str(uuid.uuid4())
    payout_doc = {
        "id": payout_id,
        "user_id": current_user["id"],
        "amount_points": request.amount_points,
        "payout_method": request.payout_method,
        "payout_details": request.payout_details,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": None
    }
    
    await db.payouts.insert_one(payout_doc)
    
    return {
        "id": payout_id,
        "amount_points": request.amount_points,
        "status": "pending",
        "message": "Solicitud de pago enviada. Se procesará en 3-5 días hábiles."
    }

@router.get("/api/monetization/creator/payouts")
async def get_payout_history(
    current_user: dict = Depends(get_current_user_from_token)
):
    """Get payout history"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    payouts = await db.payouts.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return payouts

# ============================================
# PRICING & INFO
# ============================================

@router.get("/api/monetization/pricing")
async def get_promotion_pricing():
    """Get current promotion pricing"""
    return {
        "currency": "BRUNO Points",
        "promotions": [
            {
                "type": "sponsored_post",
                "name": "Publicación Patrocinada",
                "description": "Tu post aparecerá destacado en el feed de usuarios",
                "cost_per_day": PROMOTION_COSTS["sponsored_post"],
                "min_days": 1,
                "max_days": 30,
                "benefits": ["Etiqueta 'Patrocinado'", "Alcance ampliado", "Métricas detalladas"]
            },
            {
                "type": "map_highlight",
                "name": "Destacado en Mapa",
                "description": "Tu tarjeta aparecerá resaltada en el mapa",
                "cost_per_day": PROMOTION_COSTS["map_highlight"],
                "min_days": 1,
                "max_days": 30,
                "benefits": ["Marcador especial", "Mayor visibilidad", "Prioridad en búsquedas cercanas"]
            },
            {
                "type": "feed_featured",
                "name": "Negocio Destacado",
                "description": "Tu negocio aparecerá en la sección de destacados",
                "cost_per_day": PROMOTION_COSTS["feed_featured"],
                "min_days": 1,
                "max_days": 30,
                "benefits": ["Banner promocional", "Posición privilegiada", "Badge de verificado"]
            },
            {
                "type": "search_boost",
                "name": "Impulso de Búsqueda",
                "description": "Mejora tu posición en los resultados de búsqueda",
                "cost_per_day": PROMOTION_COSTS["search_boost"],
                "min_days": 7,
                "max_days": 90,
                "benefits": ["Mayor ranking", "Más visitas", "Análisis de keywords"]
            }
        ],
        "creator_monetization": {
            "revenue_share": f"{int(CREATOR_REVENUE_SHARE * 100)}%",
            "minimum_payout": 1000,
            "payout_methods": ["bank", "paypal", "crypto"],
            "processing_time": "3-5 días hábiles"
        }
    }
