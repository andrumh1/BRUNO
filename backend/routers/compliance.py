"""
Compliance Router - Handles account deletion, reports, and data export
Required for Apple App Store compliance
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os

router = APIRouter(tags=["compliance"])

# Database connection will be passed from server.py
db = None

def set_db(database):
    global db
    db = database

# Models
class ReportRequest(BaseModel):
    content_type: str  # 'post', 'user', 'comment', 'product', 'message'
    content_id: str
    reason: str
    additional_info: Optional[str] = ""

class DeleteAccountRequest(BaseModel):
    password: str
    confirm_text: str

# Helper to get current user from token
async def get_current_user_from_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    
    import jwt
    try:
        payload = jwt.decode(token, os.environ.get("JWT_SECRET", "super-secret-key"), algorithms=["HS256"])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============================================
# REPORTS
# ============================================

@router.post("/api/reports")
async def create_report(
    report: ReportRequest,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Submit a content report"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    report_doc = {
        "reporter_id": current_user["id"],
        "content_type": report.content_type,
        "content_id": report.content_id,
        "reason": report.reason,
        "additional_info": report.additional_info,
        "status": "pending",  # pending, reviewing, resolved, dismissed
        "created_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "reviewed_by": None,
        "action_taken": None
    }
    
    result = await db.reports.insert_one(report_doc)
    
    return {"success": True, "report_id": str(result.inserted_id)}

@router.get("/api/reports/my")
async def get_my_reports(current_user: dict = Depends(get_current_user_from_token)):
    """Get user's submitted reports"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    reports = await db.reports.find(
        {"reporter_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return reports

# ============================================
# ACCOUNT DELETION
# ============================================

@router.delete("/api/profile/delete-account")
async def delete_account(
    request: DeleteAccountRequest,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Delete user account and all associated data - Required by Apple"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if request.confirm_text != "ELIMINAR MI CUENTA":
        raise HTTPException(status_code=400, detail="Confirmation text incorrect")
    
    # Verify password
    import bcrypt
    user = await db.users.find_one({"id": current_user["id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check password (if user has password - Google auth users may not)
    if user.get("password"):
        if not bcrypt.checkpw(request.password.encode(), user["password"].encode()):
            raise HTTPException(status_code=401, detail="Incorrect password")
    
    user_id = current_user["id"]
    
    # Schedule deletion (for GDPR compliance, we mark for deletion first)
    deletion_record = {
        "user_id": user_id,
        "email": current_user.get("email"),
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "scheduled_deletion": datetime.now(timezone.utc).isoformat(),  # 30 days from now in production
        "status": "scheduled"
    }
    await db.account_deletions.insert_one(deletion_record)
    
    # Immediately delete/anonymize data
    try:
        # Delete user's posts
        await db.posts.delete_many({"author_id": user_id})
        
        # Delete user's cards
        await db.cards.delete_many({"user_id": user_id})
        
        # Delete user's products
        await db.products.delete_many({"seller_id": user_id})
        
        # Delete user's stories
        await db.stories.delete_many({"user_id": user_id})
        
        # Delete user's comments
        await db.comments.delete_many({"author_id": user_id})
        
        # Delete user's messages (keep conversations for other users but anonymize)
        await db.messages.update_many(
            {"sender_id": user_id},
            {"$set": {"sender_id": "deleted_user", "sender_name": "Usuario eliminado"}}
        )
        
        # Remove user from chats
        await db.chats.update_many(
            {"participants": user_id},
            {"$pull": {"participants": user_id}}
        )
        
        # Delete user's notifications
        await db.notifications.delete_many({"user_id": user_id})
        
        # Delete user's points history
        await db.points_history.delete_many({"user_id": user_id})
        
        # Cancel subscriptions
        await db.subscriptions.update_many(
            {"user_id": user_id},
            {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Delete or anonymize the user account
        await db.users.delete_one({"id": user_id})
        
        # Update deletion record
        await db.account_deletions.update_one(
            {"user_id": user_id},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
        
    except Exception as e:
        # Log error but don't fail - partial deletion is still valid
        print(f"Error during account deletion: {e}")
        await db.account_deletions.update_one(
            {"user_id": user_id},
            {"$set": {"status": "partial", "error": str(e)}}
        )
    
    return {"success": True, "message": "Account scheduled for deletion"}

# ============================================
# DATA EXPORT
# ============================================

@router.get("/profile/export")
async def export_user_data(current_user: dict = Depends(get_current_user)):
    """Export all user data - GDPR compliance"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    user_id = current_user["id"]
    
    export_data = {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "user_info": {
            "id": current_user.get("id"),
            "name": current_user.get("name"),
            "email": current_user.get("email"),
            "bio": current_user.get("bio"),
            "location": current_user.get("location"),
            "website": current_user.get("website"),
            "created_at": current_user.get("created_at"),
            "subscription_tier": current_user.get("subscription_tier", "free")
        }
    }
    
    # Get user's cards
    cards = await db.cards.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    export_data["cards"] = cards
    
    # Get user's posts
    posts = await db.posts.find(
        {"author_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    export_data["posts"] = posts
    
    # Get user's products
    products = await db.products.find(
        {"seller_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    export_data["products"] = products
    
    # Get user's stories
    stories = await db.stories.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    export_data["stories"] = stories
    
    # Get user's messages sent
    messages = await db.messages.find(
        {"sender_id": user_id},
        {"_id": 0}
    ).to_list(5000)
    export_data["messages_sent"] = messages
    
    # Get user's points history
    points = await db.points_history.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    export_data["points_history"] = points
    
    # Get user's reports
    reports = await db.reports.find(
        {"reporter_id": user_id},
        {"_id": 0}
    ).to_list(100)
    export_data["reports_submitted"] = reports
    
    return export_data

# ============================================
# ADMIN MODERATION (for future use)
# ============================================

@router.get("/admin/reports")
async def get_pending_reports(
    status: str = "pending",
    current_user: dict = Depends(get_current_user)
):
    """Get reports for moderation - Admin only"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Check if user is admin (subscription tier check or role check)
    if current_user.get("subscription_tier") not in ["admin", "business"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    reports = await db.reports.find(
        {"status": status},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return reports

@router.put("/admin/reports/{report_id}")
async def update_report_status(
    report_id: str,
    action: str,  # 'dismiss', 'warn_user', 'remove_content', 'suspend_user'
    current_user: dict = Depends(get_current_user)
):
    """Update report status - Admin only"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if current_user.get("subscription_tier") not in ["admin", "business"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from bson import ObjectId
    
    result = await db.reports.update_one(
        {"_id": ObjectId(report_id)},
        {
            "$set": {
                "status": "resolved",
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
                "reviewed_by": current_user["id"],
                "action_taken": action
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return {"success": True, "action": action}
