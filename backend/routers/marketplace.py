"""Marketplace routes for product/service cards."""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, List
import uuid

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user, get_current_user_optional
from models.user import User

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


class ProductCreate(BaseModel):
    title: str
    description: str
    price: float
    currency: str = "USD"
    category: str
    subcategory: Optional[str] = None
    stock: Optional[int] = None
    images: List[str] = []
    location: Optional[str] = None
    shipping_available: bool = False
    shipping_cost: Optional[float] = None
    condition: str = "new"  # new, used, refurbished
    tags: List[str] = []
    deal_enabled: bool = False  # Enable purchase via DEAL
    deal_partner_id: Optional[str] = None
    deal_referral_code: Optional[str] = None


class ProductUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    category: Optional[str] = None
    stock: Optional[int] = None
    images: Optional[List[str]] = None
    location: Optional[str] = None
    shipping_available: Optional[bool] = None
    shipping_cost: Optional[float] = None
    condition: Optional[str] = None
    status: Optional[str] = None  # active, sold, paused
    tags: Optional[List[str]] = None
    deal_enabled: Optional[bool] = None
    deal_partner_id: Optional[str] = None
    deal_referral_code: Optional[str] = None


class CartItem(BaseModel):
    product_id: str
    quantity: int = 1


# Product Categories
CATEGORIES = [
    {"id": "electronics", "name": "Electrónica", "icon": "💻"},
    {"id": "clothing", "name": "Ropa y Accesorios", "icon": "👕"},
    {"id": "home", "name": "Hogar y Jardín", "icon": "🏠"},
    {"id": "services", "name": "Servicios", "icon": "🔧"},
    {"id": "vehicles", "name": "Vehículos", "icon": "🚗"},
    {"id": "sports", "name": "Deportes", "icon": "⚽"},
    {"id": "beauty", "name": "Belleza y Salud", "icon": "💄"},
    {"id": "food", "name": "Alimentos", "icon": "🍔"},
    {"id": "art", "name": "Arte y Colecciones", "icon": "🎨"},
    {"id": "other", "name": "Otros", "icon": "📦"}
]


@router.get("/categories")
async def get_categories():
    """Get all marketplace categories"""
    return CATEGORIES


@router.post("/products")
async def create_product(
    product: ProductCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new product listing"""
    product_doc = {
        "id": str(uuid.uuid4()),
        "seller_id": current_user.id,
        "seller_name": current_user.name,
        **product.model_dump(),
        "status": "active",
        "views": 0,
        "favorites": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.marketplace_products.insert_one(product_doc)
    
    # Return without _id
    product_doc.pop("_id", None)
    return product_doc


@router.get("/products")
async def list_products(
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    condition: Optional[str] = None,
    location: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = "newest",  # newest, price_asc, price_desc, popular
    skip: int = 0,
    limit: int = 20,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """List marketplace products with filters"""
    query = {"status": "active"}
    
    if category:
        query["category"] = category
    if condition:
        query["condition"] = condition
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    if min_price is not None:
        query["price"] = {"$gte": min_price}
    if max_price is not None:
        query.setdefault("price", {})["$lte"] = max_price
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"tags": {"$in": [search.lower()]}}
        ]
    
    # Sort options
    sort_options = {
        "newest": [("created_at", -1)],
        "price_asc": [("price", 1)],
        "price_desc": [("price", -1)],
        "popular": [("views", -1)]
    }
    sort_by = sort_options.get(sort, [("created_at", -1)])
    
    products = await db.marketplace_products.find(
        query, {"_id": 0}
    ).sort(sort_by).skip(skip).limit(limit).to_list(limit)
    
    # Add seller info
    for product in products:
        seller = await db.users.find_one(
            {"id": product["seller_id"]}, 
            {"_id": 0, "hashed_password": 0}
        )
        if seller:
            product["seller"] = {
                "id": seller["id"],
                "name": seller.get("name", ""),
                "avatar_url": seller.get("avatar_url")
            }
    
    total = await db.marketplace_products.count_documents(query)
    
    return {
        "products": products,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/products/{product_id}")
async def get_product(
    product_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get a single product by ID"""
    product = await db.marketplace_products.find_one(
        {"id": product_id}, {"_id": 0}
    )
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Increment views
    await db.marketplace_products.update_one(
        {"id": product_id},
        {"$inc": {"views": 1}}
    )
    
    # Get seller info
    seller = await db.users.find_one(
        {"id": product["seller_id"]},
        {"_id": 0, "hashed_password": 0}
    )
    if seller:
        product["seller"] = {
            "id": seller["id"],
            "name": seller.get("name", ""),
            "avatar_url": seller.get("avatar_url")
        }
    
    # Check if user has favorited
    if current_user:
        favorite = await db.product_favorites.find_one({
            "user_id": current_user.id,
            "product_id": product_id
        })
        product["is_favorited"] = favorite is not None
    
    return product


@router.put("/products/{product_id}")
async def update_product(
    product_id: str,
    updates: ProductUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a product listing"""
    product = await db.marketplace_products.find_one({"id": product_id})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product["seller_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.marketplace_products.update_one(
        {"id": product_id},
        {"$set": update_data}
    )
    
    updated = await db.marketplace_products.find_one({"id": product_id}, {"_id": 0})
    return updated


@router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a product listing"""
    product = await db.marketplace_products.find_one({"id": product_id})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product["seller_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.marketplace_products.delete_one({"id": product_id})
    return {"status": "deleted"}


@router.post("/products/{product_id}/favorite")
async def toggle_favorite(
    product_id: str,
    current_user: User = Depends(get_current_user)
):
    """Toggle favorite status for a product"""
    existing = await db.product_favorites.find_one({
        "user_id": current_user.id,
        "product_id": product_id
    })
    
    if existing:
        await db.product_favorites.delete_one({"_id": existing["_id"]})
        await db.marketplace_products.update_one(
            {"id": product_id},
            {"$inc": {"favorites": -1}}
        )
        return {"favorited": False}
    else:
        await db.product_favorites.insert_one({
            "user_id": current_user.id,
            "product_id": product_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.marketplace_products.update_one(
            {"id": product_id},
            {"$inc": {"favorites": 1}}
        )
        return {"favorited": True}


@router.get("/my-products")
async def get_my_products(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get current user's products"""
    query = {"seller_id": current_user.id}
    if status:
        query["status"] = status
    
    products = await db.marketplace_products.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return products


# Shopping Cart
@router.get("/cart")
async def get_cart(current_user: User = Depends(get_current_user)):
    """Get user's shopping cart"""
    cart = await db.shopping_carts.find_one(
        {"user_id": current_user.id},
        {"_id": 0}
    )
    
    if not cart:
        return {"items": [], "total": 0}
    
    # Populate product details
    items_with_details = []
    total = 0
    
    for item in cart.get("items", []):
        product = await db.marketplace_products.find_one(
            {"id": item["product_id"]},
            {"_id": 0}
        )
        if product and product["status"] == "active":
            item_total = product["price"] * item["quantity"]
            items_with_details.append({
                **item,
                "product": product,
                "subtotal": item_total
            })
            total += item_total
    
    return {
        "items": items_with_details,
        "total": total,
        "currency": items_with_details[0]["product"]["currency"] if items_with_details else "USD"
    }


@router.post("/cart/add")
async def add_to_cart(
    item: CartItem,
    current_user: User = Depends(get_current_user)
):
    """Add item to cart"""
    # Verify product exists and is active
    product = await db.marketplace_products.find_one({
        "id": item.product_id,
        "status": "active"
    })
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or unavailable")
    
    # Can't buy your own product
    if product["seller_id"] == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot buy your own product")
    
    # Check stock
    if product.get("stock") is not None and product["stock"] < item.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    # Get or create cart
    cart = await db.shopping_carts.find_one({"user_id": current_user.id})
    
    if cart:
        # Check if item already in cart
        existing_item = next(
            (i for i in cart["items"] if i["product_id"] == item.product_id),
            None
        )
        
        if existing_item:
            # Update quantity
            await db.shopping_carts.update_one(
                {"user_id": current_user.id, "items.product_id": item.product_id},
                {"$inc": {"items.$.quantity": item.quantity}}
            )
        else:
            # Add new item
            await db.shopping_carts.update_one(
                {"user_id": current_user.id},
                {"$push": {"items": item.model_dump()}}
            )
    else:
        # Create new cart
        await db.shopping_carts.insert_one({
            "user_id": current_user.id,
            "items": [item.model_dump()],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"status": "added"}


@router.delete("/cart/{product_id}")
async def remove_from_cart(
    product_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove item from cart"""
    await db.shopping_carts.update_one(
        {"user_id": current_user.id},
        {"$pull": {"items": {"product_id": product_id}}}
    )
    return {"status": "removed"}


@router.delete("/cart")
async def clear_cart(current_user: User = Depends(get_current_user)):
    """Clear entire cart"""
    await db.shopping_carts.delete_one({"user_id": current_user.id})
    return {"status": "cleared"}
