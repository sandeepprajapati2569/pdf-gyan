"""
Sharespace Router — controlled file sharing with redaction and access protection.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import Response
from app.dependencies import get_current_user, get_user_db
from app.services.sharespace_service import (
    create_share, get_public_share, verify_share_password,
    get_user_shares, get_shares_for_file, update_share, revoke_share, delete_share,
    get_share_preview, get_share_download, get_page_text_blocks,
    request_share_verification, verify_share_otp, validate_share_session,
    get_files_shared_with_email,
)
from app.services.workspace_service import get_workspace_file
from app.config import settings
from pydantic import BaseModel
from typing import Optional
from app import database as _database

router = APIRouter(tags=["sharespace"])


# ═══════════════════════════════════════════════════════════
# AUTHENTICATED ENDPOINTS (owner)
# ═══════════════════════════════════════════════════════════


class CreateShareRequest(BaseModel):
    permission: str = "read"
    recipients: list[str] = []
    redactions: list[dict] = []
    expires_days: int = 30
    password: Optional[str] = None


class UpdateShareRequest(BaseModel):
    permission: Optional[str] = None
    recipients: Optional[list[str]] = None
    redactions: Optional[list[dict]] = None
    is_active: Optional[bool] = None
    extend_days: Optional[int] = None  # Add days to current expiry


@router.post("/api/sharespace/files/{file_id}/share")
async def create_file_share(
    file_id: str,
    request: CreateShareRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a share link for a workspace file."""
    user_db = await get_user_db(current_user)
    # Verify file exists in user's DB
    file_doc = await get_workspace_file(user_db, current_user["_id"], file_id)
    if not file_doc:
        raise HTTPException(404, "File not found")

    # Always store shares in main DB so public endpoints can find them
    result = await create_share(
        _database.db, current_user["_id"], file_id,
        permission=request.permission,
        recipients=request.recipients,
        redactions=request.redactions,
        expires_days=request.expires_days,
        password=request.password,
        file_doc=file_doc,
    )
    if not result:
        raise HTTPException(500, "Failed to create share")

    # Send email notifications to recipients
    if request.recipients:
        share_url = f"{request.recipients}"  # placeholder
        try:
            from app.services.email_service import send_share_notification_email
            for email in request.recipients:
                await send_share_notification_email(
                    to_email=email,
                    filename=file_doc.get("original_filename", "Document"),
                    share_token=result["share_token"],
                    sender_name=current_user.get("name", "Someone"),
                )
        except Exception:
            pass  # Email is best-effort, don't fail the share

    return result


@router.get("/api/sharespace/files/{file_id}/shares")
async def list_file_shares(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    # Shares always in _database.db
    return await get_shares_for_file(_database.db, current_user["_id"], file_id)


@router.get("/api/sharespace/my-shares")
async def list_my_shares(current_user: dict = Depends(get_current_user)):
    return await get_user_shares(_database.db, current_user["_id"])


@router.get("/api/sharespace/received")
async def list_received_shares(current_user: dict = Depends(get_current_user)):
    """Get all shares where the current user's email is in recipients."""
    email = current_user.get("email", "")
    if not email:
        return []
    return await get_files_shared_with_email(_database.db, email)


@router.post("/api/sharespace/{token}/claim")
async def claim_shared_file(
    token: str,
    folder_id: str = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Copy a shared file to the user's workspace (requires write permission)."""
    share = await get_public_share(_database.db, token)
    if not share:
        raise HTTPException(404, "Share not found or expired")

    # Check user email is in recipients
    email = current_user.get("email", "").lower().strip()
    if email not in [r.lower().strip() for r in share.get("recipients", [])]:
        raise HTTPException(403, "Not authorized to claim this file")

    if share.get("permission") != "write":
        raise HTTPException(403, "Write permission required to claim this file")

    # Get original file
    file_id = share.get("file_id")
    owner_id = share.get("owner_id")
    if not file_id or not owner_id:
        raise HTTPException(400, "Invalid share record")

    # Find the original workspace file (from owner's DB)
    import os, shutil
    from bson import ObjectId as ObjId

    original = await _database.db.workspace_files.find_one({"_id": ObjId(file_id)})
    if not original:
        raise HTTPException(404, "Original file no longer exists")

    # Copy the physical file
    db = await get_user_db(current_user)
    new_file_id = str(ObjId())
    user_dir = os.path.join(settings.UPLOAD_DIR, current_user["_id"], "workspace")
    os.makedirs(user_dir, exist_ok=True)

    ext = os.path.splitext(original.get("original_filename", ""))[1] or ".pdf"
    new_path = os.path.join(user_dir, f"{new_file_id}{ext}")

    src_path = original.get("file_path", "")
    if os.path.exists(src_path):
        shutil.copy2(src_path, new_path)
    else:
        raise HTTPException(404, "Source file not found on disk")

    from datetime import datetime, timezone
    record = {
        "_id": ObjId(new_file_id),
        "user_id": current_user["_id"],
        "workspace_id": current_user["_id"],
        "original_filename": original.get("original_filename", "claimed_file"),
        "file_type": original.get("file_type", "pdf"),
        "file_path": new_path,
        "extracted_text": original.get("extracted_text", ""),
        "char_count": original.get("char_count", 0),
        "page_count": original.get("page_count"),
        "folder_id": folder_id,
        "access_level": "workspace",
        "shared_with": [],
        "locked_by": None,
        "status": "ready",
        "error_message": None,
        "claimed_from": token,
        "created_at": datetime.now(timezone.utc),
    }
    await db.workspace_files.insert_one(record)

    return {"status": "claimed", "file_id": new_file_id, "filename": record["original_filename"]}


@router.patch("/api/sharespace/{token}")
async def update_file_share(
    token: str,
    request: UpdateShareRequest,
    current_user: dict = Depends(get_current_user),
):
    updates = request.model_dump(exclude_none=True)
    success = await update_share(_database.db, current_user["_id"], token, updates)
    if not success:
        raise HTTPException(404, "Share not found")
    return {"status": "updated"}


@router.get("/api/sharespace/files/{file_id}/page-text")
async def get_file_page_text(
    file_id: str,
    page: int = Query(1, ge=1),
    current_user: dict = Depends(get_current_user),
):
    """Get text blocks from a PDF page for text-level redaction selection."""
    db = await get_user_db(current_user)
    file_doc = await get_workspace_file(db, current_user["_id"], file_id)
    if not file_doc:
        raise HTTPException(404, "File not found")
    if file_doc.get("file_type") != "pdf":
        raise HTTPException(400, "Text blocks only available for PDF files")

    data = await get_page_text_blocks(file_doc["file_path"], page)
    return {"blocks": data["blocks"], "page": page, "width": data["width"], "height": data["height"]}


@router.delete("/api/sharespace/{token}")
async def revoke_file_share(
    token: str,
    permanent: bool = Query(False),
    current_user: dict = Depends(get_current_user),
):
    if permanent:
        success = await delete_share(_database.db, current_user["_id"], token)
    else:
        success = await revoke_share(_database.db, current_user["_id"], token)
    if not success:
        raise HTTPException(404, "Share not found")
    return {"status": "revoked" if not permanent else "deleted"}


# ═══════════════════════════════════════════════════════════
# PUBLIC ENDPOINTS (no auth required)
# ═══════════════════════════════════════════════════════════


class VerifyEmailRequest(BaseModel):
    email: str


class VerifyOTPRequest(BaseModel):
    email: str
    otp: str


@router.post("/api/shared-file/{token}/request-access")
async def request_access(token: str, request: VerifyEmailRequest):
    """Request OTP to verify email for accessing a shared file."""
    result = await request_share_verification(_database.db, token, request.email)
    if result.get("error"):
        raise HTTPException(400, result["error"])
    return result


@router.post("/api/shared-file/{token}/verify")
async def verify_access(token: str, request: VerifyOTPRequest):
    """Verify OTP and get a session token."""
    result = await verify_share_otp(_database.db, token, request.email, request.otp)
    if result.get("error"):
        raise HTTPException(400, result["error"])
    return result


@router.get("/api/shared-file/my-files")
async def get_my_shared_files(email: str = Query(...)):
    """Get all files shared with an email — external user's dashboard."""
    if not email or "@" not in email:
        raise HTTPException(400, "Valid email required")
    files = await get_files_shared_with_email(_database.db, email.lower().strip())
    return {"files": files, "email": email}


class PortalEmailRequest(BaseModel):
    email: str


class PortalOTPRequest(BaseModel):
    email: str
    otp: str


@router.post("/api/shared-file/portal/verify-email")
async def portal_request_verification(request: PortalEmailRequest):
    """Send OTP for portal email verification. Checks if any shares exist for this email."""
    email = request.email.lower().strip()
    if "@" not in email:
        raise HTTPException(400, "Valid email required")

    # Check if any shares exist for this email
    count = await _database.db.shared_files.count_documents({
        "recipients": {"$regex": f"^{email}$", "$options": "i"},
        "is_active": True,
    })

    if count == 0:
        raise HTTPException(404, "No files have been shared with this email address")

    # Generate and send OTP
    import hashlib, random
    otp = str(random.randint(100000, 999999))
    otp_hash = hashlib.sha256(otp.encode()).hexdigest()

    from datetime import datetime, timezone, timedelta
    await _database.db.share_verifications.update_one(
        {"portal_email": email},
        {"$set": {
            "portal_email": email,
            "otp_hash": otp_hash,
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
            "verified": False,
        }},
        upsert=True,
    )

    try:
        from app.services.email_service import send_share_otp_email
        await send_share_otp_email(to_email=email, otp=otp, filename="Shared Files Portal")
    except Exception:
        raise HTTPException(500, "Failed to send verification email")

    return {"status": "otp_sent", "email": email}


@router.post("/api/shared-file/portal/verify-otp")
async def portal_verify_otp(request: PortalOTPRequest):
    """Verify portal OTP and return session token."""
    import hashlib, secrets
    email = request.email.lower().strip()
    otp_hash = hashlib.sha256(request.otp.encode()).hexdigest()

    record = await _database.db.share_verifications.find_one({
        "portal_email": email,
        "otp_hash": otp_hash,
    })

    if not record:
        raise HTTPException(400, "Invalid verification code")

    from datetime import datetime, timezone, timedelta
    exp = record.get("expires_at")
    if exp:
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            raise HTTPException(400, "Verification code expired")

    session_token = secrets.token_urlsafe(32)
    await _database.db.share_verifications.update_one(
        {"_id": record["_id"]},
        {"$set": {
            "verified": True,
            "session_token": session_token,
            "session_expires": datetime.now(timezone.utc) + timedelta(hours=24),
        }},
    )

    return {"status": "verified", "session_token": session_token}


@router.get("/api/shared-file/{token}")
async def get_shared_file_meta(token: str, password: str = Query(None), session: str = Query(None)):
    """Get metadata for a shared file. Public endpoint. Counts one view per metadata load."""
    share = await get_public_share(_database.db, token, count_view=True)
    if not share:
        raise HTTPException(404, "Share not found or expired")

    # Check if email verification is required
    recipients = share.get("recipients", [])
    requires_verification = len(recipients) > 0

    if requires_verification and not session:
        return {
            "verification_required": True,
            "filename": share.get("original_filename"),
            "file_type": share.get("file_type"),
        }

    # Validate session if verification is required
    if requires_verification and session:
        valid = await validate_share_session(_database.db, token, session)
        if not valid:
            return {
                "verification_required": True,
                "session_expired": True,
                "filename": share.get("original_filename"),
                "file_type": share.get("file_type"),
            }

    # Password check (separate from email verification)
    if share.get("password"):
        if not password:
            return {"password_required": True, "filename": share.get("original_filename")}
        valid = await verify_share_password(share, password)
        if not valid:
            raise HTTPException(403, "Invalid password")

    return {
        "filename": share.get("original_filename"),
        "file_type": share.get("file_type"),
        "page_count": share.get("page_count"),
        "permission": share.get("permission"),
        "redactions_count": len(share.get("redactions", [])),
        "created_at": share.get("created_at"),
        "expires_at": share.get("expires_at"),
        "verified": True,
    }


@router.get("/api/shared-file/{token}/preview")
async def get_shared_file_preview(
    token: str,
    page: int = Query(1, ge=1),
    password: str = Query(None),
    session: str = Query(None),
):
    """Get preview content for a shared file. PDFs return PNG images."""
    share = await get_public_share(_database.db, token)
    if not share:
        raise HTTPException(404, "Share not found or expired")

    # Check email verification
    if share.get("recipients") and not await validate_share_session(_database.db, token, session or ""):
        raise HTTPException(403, "Email verification required")

    if share.get("password"):
        if not password:
            raise HTTPException(403, "Password required")
        valid = await verify_share_password(share, password)
        if not valid:
            raise HTTPException(403, "Invalid password")

    result = await get_share_preview(_database.db, token, page)
    if not result:
        raise HTTPException(404, "Preview not available")

    if result.get("error"):
        raise HTTPException(400, result["error"])

    if result["type"] == "image":
        return Response(
            content=result["data"],
            media_type="image/png",
            headers={
                "Cache-Control": "private, max-age=300",
                "X-Total-Pages": str(result.get("total_visible", 0)),
                "X-Current-Page": str(result.get("page", 1)),
            },
        )

    # Text-based preview
    return {
        "type": result["type"],
        "file_type": result.get("file_type"),
        "text": result.get("text", ""),
        "filename": result.get("filename", ""),
    }


@router.get("/api/shared-file/{token}/download")
async def download_shared_file(token: str, password: str = Query(None)):
    """Download the original file. Only for write-permission shares."""
    share = await get_public_share(_database.db, token)
    if not share:
        raise HTTPException(404, "Share not found or expired")

    if share.get("permission") != "write":
        raise HTTPException(403, "Download not allowed for read-only shares")

    if share.get("password"):
        if not password:
            raise HTTPException(403, "Password required")
        valid = await verify_share_password(share, password)
        if not valid:
            raise HTTPException(403, "Invalid password")

    result = await get_share_download(_database.db, token)
    if not result:
        raise HTTPException(404, "File not available")

    data, filename, file_type = result
    mime_map = {"pdf": "application/pdf", "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "txt": "text/plain", "csv": "text/csv", "md": "text/markdown"}

    return Response(
        content=data,
        media_type=mime_map.get(file_type, "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
