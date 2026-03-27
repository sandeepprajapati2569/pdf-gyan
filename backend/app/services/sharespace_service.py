"""
Sharespace Service — controlled document sharing with redaction support.
Shares workspace files externally with read/write permissions and page-level redaction.
"""

import os
import secrets
import logging
import hashlib
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════
# EXTERNAL USER VERIFICATION
# ═══════════════════════════════════════════════════════════


def _generate_otp() -> str:
    """Generate a 6-digit OTP."""
    import random
    return str(random.randint(100000, 999999))


async def request_share_verification(db: AsyncIOMotorDatabase, token: str, email: str) -> dict:
    """Send OTP to email for share access verification. Returns status."""
    share = await db.shared_files.find_one({"share_token": token})
    if not share:
        return {"error": "Share not found"}

    # Check if this share requires email verification
    recipients = share.get("recipients", [])
    if recipients and email.lower().strip() not in [r.lower().strip() for r in recipients]:
        return {"error": "This file was not shared with this email address"}

    # Generate OTP and store it
    otp = _generate_otp()
    otp_hash = hashlib.sha256(otp.encode()).hexdigest()
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)

    await db.share_verifications.update_one(
        {"share_token": token, "email": email.lower().strip()},
        {"$set": {
            "otp_hash": otp_hash,
            "expires_at": expires,
            "verified": False,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    # Send OTP email
    try:
        from app.services.email_service import send_share_otp_email
        await send_share_otp_email(
            to_email=email,
            otp=otp,
            filename=share.get("original_filename", "Document"),
        )
    except Exception as e:
        logger.error(f"Failed to send share OTP: {e}")
        return {"error": "Failed to send verification email"}

    return {"status": "otp_sent", "email": email}


async def verify_share_otp(db: AsyncIOMotorDatabase, token: str, email: str, otp: str) -> dict:
    """Verify OTP and return a session token for accessing the share."""
    otp_hash = hashlib.sha256(otp.encode()).hexdigest()

    record = await db.share_verifications.find_one({
        "share_token": token,
        "email": email.lower().strip(),
        "otp_hash": otp_hash,
    })

    if not record:
        return {"error": "Invalid verification code"}

    exp = record.get("expires_at")
    if exp:
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            return {"error": "Verification code expired"}

    # Mark as verified and generate session token
    session_token = secrets.token_urlsafe(32)
    session_expires = datetime.now(timezone.utc) + timedelta(hours=24)

    await db.share_verifications.update_one(
        {"_id": record["_id"]},
        {"$set": {
            "verified": True,
            "session_token": session_token,
            "session_expires": session_expires,
        }},
    )

    # Track this as an access record
    await db.share_access_log.update_one(
        {"share_token": token, "email": email.lower().strip()},
        {"$set": {
            "last_accessed": datetime.now(timezone.utc),
            "filename": (await db.shared_files.find_one({"share_token": token}) or {}).get("original_filename", ""),
        }, "$inc": {"access_count": 1}},
        upsert=True,
    )

    return {"status": "verified", "session_token": session_token, "expires_in": "24h"}


async def validate_share_session(db: AsyncIOMotorDatabase, token: str, session_token: str) -> bool:
    """Check if a session token is valid for a given share."""
    record = await db.share_verifications.find_one({
        "share_token": token,
        "session_token": session_token,
        "verified": True,
    })
    if not record:
        return False

    exp = record.get("session_expires")
    if exp:
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            return False

    return True


async def get_files_shared_with_email(db: AsyncIOMotorDatabase, email: str) -> list[dict]:
    """Get all shares for a specific email — for the external user's dashboard. Includes expired."""
    shares = []
    cursor = db.shared_files.find({
        "recipients": {"$regex": f"^{email.lower().strip()}$", "$options": "i"},
    }).sort("created_at", -1)

    now = datetime.now(timezone.utc)
    async for s in cursor:
        exp = s.get("expires_at")
        is_expired = False
        if exp:
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            is_expired = exp < now

        if not s.get("is_active", True):
            is_expired = True

        shares.append({
            "share_token": s["share_token"],
            "filename": s.get("original_filename", "Unknown"),
            "file_type": s.get("file_type"),
            "permission": s.get("permission", "read"),
            "expires_at": s.get("expires_at"),
            "created_at": s.get("created_at"),
            "has_password": bool(s.get("password")),
            "expired": is_expired,
        })

    return shares


# ═══════════════════════════════════════════════════════════
# SHARE CREATION & MANAGEMENT
# ═══════════════════════════════════════════════════════════


async def create_share(
    db: AsyncIOMotorDatabase, user_id: str, file_id: str,
    permission: str = "read", recipients: list[str] = None,
    redactions: list[dict] = None, expires_days: int = 30,
    password: str = None, file_doc: dict = None,
) -> dict:
    """Create a share link for a workspace file. Stores in main DB for public access."""
    # Try to get file doc if not provided
    if not file_doc:
        file_doc = await db.workspace_files.find_one({"_id": ObjectId(file_id), "user_id": user_id})
    if not file_doc:
        return None

    # Hash password if provided
    hashed_pw = None
    if password:
        import bcrypt
        hashed_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    token = secrets.token_urlsafe(20)
    now = datetime.now(timezone.utc)

    share = {
        "share_token": token,
        "file_id": file_id,
        "owner_id": user_id,
        "original_filename": file_doc.get("original_filename", "Unknown"),
        "file_type": file_doc.get("file_type", "unknown"),
        "file_path": file_doc.get("file_path", ""),  # denormalized for public access
        "page_count": file_doc.get("page_count"),
        "permission": permission if permission in ("read", "write") else "read",
        "recipients": recipients or [],
        "password": hashed_pw,
        "redactions": redactions or [],
        "expires_at": now + timedelta(days=max(1, min(expires_days, 365))),
        "view_count": 0,
        "last_viewed_at": None,
        "is_active": True,
        "created_at": now,
    }

    await db.shared_files.insert_one(share)
    share["_id"] = str(share.get("_id", ""))
    return {
        "share_token": token,
        "permission": share["permission"],
        "recipients": share["recipients"],
        "expires_at": share["expires_at"],
        "redactions": share["redactions"],
    }


async def get_public_share(db: AsyncIOMotorDatabase, token: str, count_view: bool = False) -> dict | None:
    """Fetch a share by token. Only counts a view when count_view=True."""
    share = await db.shared_files.find_one({"share_token": token})
    if not share:
        return None
    if not share.get("is_active", True):
        return None
    expires = share.get("expires_at")
    if expires:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < datetime.now(timezone.utc):
            return None

    if count_view:
        await db.shared_files.update_one(
            {"share_token": token},
            {"$inc": {"view_count": 1}, "$set": {"last_viewed_at": datetime.now(timezone.utc)}},
        )

    return share


async def verify_share_password(share: dict, password: str) -> bool:
    """Check if the provided password matches the share's password."""
    if not share.get("password"):
        return True  # No password required
    import bcrypt
    return bcrypt.checkpw(password.encode(), share["password"].encode())


async def get_user_shares(db: AsyncIOMotorDatabase, user_id: str) -> list[dict]:
    """List all shares created by a user."""
    shares = []
    cursor = db.shared_files.find({"owner_id": user_id}).sort("created_at", -1).limit(100)
    async for s in cursor:
        shares.append({
            "id": str(s["_id"]),
            "share_token": s["share_token"],
            "file_id": s["file_id"],
            "original_filename": s.get("original_filename", "Unknown"),
            "file_type": s.get("file_type"),
            "permission": s.get("permission", "read"),
            "recipients": s.get("recipients", []),
            "redactions_count": len(s.get("redactions", [])),
            "view_count": s.get("view_count", 0),
            "is_active": s.get("is_active", True),
            "has_password": bool(s.get("password")),
            "expires_at": s.get("expires_at"),
            "created_at": s.get("created_at"),
        })
    return shares


async def get_shares_for_file(db: AsyncIOMotorDatabase, user_id: str, file_id: str) -> list[dict]:
    """List all shares for a specific file."""
    shares = []
    cursor = db.shared_files.find({"owner_id": user_id, "file_id": file_id}).sort("created_at", -1)
    async for s in cursor:
        shares.append({
            "id": str(s["_id"]),
            "share_token": s["share_token"],
            "permission": s.get("permission", "read"),
            "recipients": s.get("recipients", []),
            "view_count": s.get("view_count", 0),
            "is_active": s.get("is_active", True),
            "expires_at": s.get("expires_at"),
            "created_at": s.get("created_at"),
        })
    return shares


async def update_share(db: AsyncIOMotorDatabase, user_id: str, token: str, updates: dict) -> bool:
    """Update share settings. Only owner can update."""
    allowed_fields = {"permission", "recipients", "redactions", "is_active"}
    filtered = {k: v for k, v in updates.items() if k in allowed_fields}

    # Handle extend_days separately
    extend_days = updates.get("extend_days")

    if not filtered and not extend_days:
        return False

    mongo_update = {}
    if filtered:
        mongo_update["$set"] = filtered

    if extend_days and isinstance(extend_days, int) and extend_days > 0:
        # Extend from current expiry or from now
        share = await db.shared_files.find_one({"share_token": token, "owner_id": user_id})
        if share:
            current_expiry = share.get("expires_at") or datetime.now(timezone.utc)
            if current_expiry.tzinfo is None:
                current_expiry = current_expiry.replace(tzinfo=timezone.utc)
            # If already expired, extend from now
            if current_expiry < datetime.now(timezone.utc):
                current_expiry = datetime.now(timezone.utc)
            new_expiry = current_expiry + timedelta(days=extend_days)
            if "$set" not in mongo_update:
                mongo_update["$set"] = {}
            mongo_update["$set"]["expires_at"] = new_expiry
            mongo_update["$set"]["is_active"] = True  # Re-activate if extending

    if not mongo_update:
        return False

    result = await db.shared_files.update_one(
        {"share_token": token, "owner_id": user_id},
        mongo_update,
    )
    return result.modified_count > 0


async def revoke_share(db: AsyncIOMotorDatabase, user_id: str, token: str) -> bool:
    """Deactivate a share. Keeps the record for audit."""
    result = await db.shared_files.update_one(
        {"share_token": token, "owner_id": user_id},
        {"$set": {"is_active": False}},
    )
    return result.modified_count > 0


async def delete_share(db: AsyncIOMotorDatabase, user_id: str, token: str) -> bool:
    """Permanently delete a share."""
    result = await db.shared_files.delete_one({"share_token": token, "owner_id": user_id})
    return result.deleted_count > 0


# ═══════════════════════════════════════════════════════════
# PREVIEW & REDACTION
# ═══════════════════════════════════════════════════════════


def is_page_redacted(page_num: int, redactions: list[dict]) -> bool:
    """Check if a specific page number is in the redaction list."""
    return any(r.get("type") == "page" and r.get("page") == page_num for r in redactions)


def get_visible_pages(total_pages: int, redactions: list[dict]) -> list[int]:
    """Get list of visible page numbers (1-based), excluding redacted ones."""
    redacted = {r["page"] for r in redactions if r.get("type") == "page"}
    return [p for p in range(1, total_pages + 1) if p not in redacted]


async def get_share_preview(db: AsyncIOMotorDatabase, token: str, virtual_page: int = 1) -> dict | None:
    """Get preview content for a shared file. Handles redaction for read-only shares.
    For PDFs: returns PNG image bytes.
    For others: returns filtered text.
    virtual_page is 1-based and maps around redacted pages."""
    share = await db.shared_files.find_one({"share_token": token, "is_active": True})
    if not share:
        return None

    _exp = share.get("expires_at")
    if _exp and (_exp.replace(tzinfo=timezone.utc) if _exp.tzinfo is None else _exp) < datetime.now(timezone.utc):
        return None

    file_path = share.get("file_path", "")
    file_type = share.get("file_type", "")

    if not file_path or not os.path.exists(file_path):
        return {"error": "File no longer available"}

    redactions = share.get("redactions", []) if share.get("permission") == "read" else []

    if file_type == "pdf":
        return await _preview_pdf(file_path, virtual_page, redactions, share.get("page_count"))
    else:
        # For non-PDF, read text from file or extracted_text in share
        text = ""
        try:
            if file_path.endswith(('.txt', '.csv', '.md')):
                with open(file_path, 'r', encoding='utf-8') as f:
                    text = f.read()[:100000]
            else:
                # Try to look up in any DB — fallback to file_id
                file_doc = await db.workspace_files.find_one({"_id": ObjectId(share["file_id"])})
                if file_doc:
                    text = file_doc.get("extracted_text", "")[:100000]
        except Exception:
            pass
        return await _preview_non_pdf(
            {"extracted_text": text, "file_type": file_type, "original_filename": share.get("original_filename", "")},
            redactions, share.get("permission"),
        )


def _get_text_redactions_for_page(page_num: int, redactions: list) -> list[str]:
    """Get list of text strings to redact on a specific page."""
    return [r["text"] for r in redactions if r.get("type") == "text" and r.get("page") == page_num and r.get("text")]


async def get_page_text_blocks(file_path: str, page_num: int) -> dict:
    """Extract text blocks from a PDF page with positions and page dimensions.
    Returns { blocks: [...], width, height } for overlay positioning."""
    try:
        import fitz
        pdf = fitz.open(file_path)
        if page_num < 1 or page_num > len(pdf):
            pdf.close()
            return {"blocks": [], "width": 0, "height": 0}

        page = pdf[page_num - 1]
        page_rect = page.rect  # page dimensions in points
        blocks_data = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
        result = []
        for block in blocks_data:
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                text = ""
                for span in line.get("spans", []):
                    text += span.get("text", "")
                text = text.strip()
                if text and len(text) > 1:
                    bbox = line["bbox"]  # (x0, y0, x1, y1) in points
                    # Convert to percentages of page dimensions for responsive overlay
                    result.append({
                        "text": text,
                        "bbox": [round(b, 1) for b in bbox],
                        "pct": {
                            "x": round(bbox[0] / page_rect.width * 100, 2),
                            "y": round(bbox[1] / page_rect.height * 100, 2),
                            "w": round((bbox[2] - bbox[0]) / page_rect.width * 100, 2),
                            "h": round((bbox[3] - bbox[1]) / page_rect.height * 100, 2),
                        },
                        "page": page_num,
                    })
        pdf.close()
        return {
            "blocks": result,
            "width": round(page_rect.width, 1),
            "height": round(page_rect.height, 1),
        }
    except Exception as e:
        logger.error(f"[Sharespace] Failed to extract text blocks: {e}")
        return {"blocks": [], "width": 0, "height": 0}


async def _preview_pdf(file_path: str, virtual_page: int, redactions: list, total_pages: int) -> dict:
    """Render a PDF page as PNG with text redactions applied as black boxes."""
    try:
        import fitz
        pdf = fitz.open(file_path)
        actual_total = len(pdf)
        visible = get_visible_pages(actual_total, redactions)

        if not visible:
            pdf.close()
            return {"error": "All pages are redacted"}

        if virtual_page < 1 or virtual_page > len(visible):
            pdf.close()
            return {"error": f"Page {virtual_page} not found (visible: {len(visible)})"}

        actual_page = visible[virtual_page - 1]
        page = pdf[actual_page - 1]

        # Apply text-level redactions — find text and draw black rectangles
        text_redactions = _get_text_redactions_for_page(actual_page, redactions)
        if text_redactions:
            for text_to_redact in text_redactions:
                instances = page.search_for(text_to_redact)
                for rect in instances:
                    # Add redaction annotation (black box)
                    page.add_redact_annot(rect, fill=(0, 0, 0))
            # Apply all redactions (permanently removes text under the boxes)
            page.apply_redactions()

        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        pdf.close()

        return {
            "type": "image",
            "data": img_bytes,
            "page": virtual_page,
            "total_visible": len(visible),
            "actual_page": actual_page,
        }
    except Exception as e:
        logger.error(f"[Sharespace] PDF preview failed: {e}")
        return {"error": str(e)}


async def _preview_non_pdf(file_doc: dict, redactions: list, permission: str) -> dict:
    """Return filtered text content for non-PDF files."""
    text = file_doc.get("extracted_text", "")
    file_type = file_doc.get("file_type", "")

    # Apply redactions for read-only
    if permission == "read" and redactions:
        # For text-based redactions (text_block type)
        for r in sorted(redactions, key=lambda x: x.get("start_index", 0), reverse=True):
            if r.get("type") == "text_block" and r.get("start_index") is not None:
                start = r["start_index"]
                end = r.get("end_index", len(text))
                text = text[:start] + "[Content redacted by owner]" + text[end:]

    return {
        "type": "text",
        "file_type": file_type,
        "text": text[:100000],  # Cap at 100k chars for public preview
        "filename": file_doc.get("original_filename", ""),
    }


async def get_share_download(db: AsyncIOMotorDatabase, token: str) -> tuple | None:
    """Get file for download. Only allowed for write-permission shares."""
    share = await db.shared_files.find_one({"share_token": token, "is_active": True})
    if not share or share.get("permission") != "write":
        return None

    _exp = share.get("expires_at")
    if _exp and (_exp.replace(tzinfo=timezone.utc) if _exp.tzinfo is None else _exp) < datetime.now(timezone.utc):
        return None

    file_path = share.get("file_path", "")
    if not file_path or not os.path.exists(file_path):
        return None

    with open(file_path, "rb") as f:
        data = f.read()

    return data, share.get("original_filename", "file"), share.get("file_type", "bin")
