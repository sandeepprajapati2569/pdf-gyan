"""
Teams Router — collaborative workspaces with members and roles.

Collections:
    teams: { _id, name, owner_id, created_at }
    team_members: { _id, team_id, user_id, email, role, status, invited_at, joined_at }

Roles: owner, admin, member, viewer
Status: invited, active
"""

import secrets
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from app.dependencies import get_current_user, get_user_db
from app.database import get_db
from bson import ObjectId

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/teams", tags=["teams"])


# ─── Models ──────────────────────────────────────

class CreateTeamRequest(BaseModel):
    name: str


class InviteMemberRequest(BaseModel):
    email: str
    role: str = "member"  # admin, member, viewer


class UpdateMemberRoleRequest(BaseModel):
    role: str  # admin, member, viewer


# ─── Create Team ─────────────────────────────────

@router.post("")
async def create_team(
    request: CreateTeamRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a new team workspace."""
    db = await get_user_db(current_user)

    # Limit teams per user
    existing = await db.teams.count_documents({"owner_id": current_user["_id"]})
    if existing >= 5:
        raise HTTPException(400, "Maximum 5 teams per user")

    team = {
        "name": request.name[:100].strip(),
        "owner_id": current_user["_id"],
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.teams.insert_one(team)
    team_id = str(result.inserted_id)

    # Add owner as first member
    await db.team_members.insert_one({
        "team_id": team_id,
        "user_id": current_user["_id"],
        "email": current_user.get("email", ""),
        "role": "owner",
        "status": "active",
        "invited_at": datetime.now(timezone.utc),
        "joined_at": datetime.now(timezone.utc),
    })

    return {"id": team_id, "name": team["name"], "role": "owner"}


# ─── List User's Teams ──────────────────────────

@router.get("")
async def list_teams(current_user: dict = Depends(get_current_user)):
    db = await get_user_db(current_user)

    # Find all teams the user is a member of
    memberships = db.team_members.find({
        "user_id": current_user["_id"],
        "status": "active",
    })

    teams = []
    async for mem in memberships:
        team = await db.teams.find_one({"_id": ObjectId(mem["team_id"])})
        if team:
            member_count = await db.team_members.count_documents({
                "team_id": mem["team_id"], "status": "active",
            })
            teams.append({
                "id": str(team["_id"]),
                "name": team.get("name", "Untitled"),
                "role": mem.get("role", "member"),
                "member_count": member_count,
                "created_at": team.get("created_at"),
            })

    return teams


# ─── Get Team Details ────────────────────────────

@router.get("/{team_id}")
async def get_team(
    team_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = await get_user_db(current_user)

    # Verify membership
    member = await db.team_members.find_one({
        "team_id": team_id,
        "user_id": current_user["_id"],
        "status": "active",
    })
    if not member:
        raise HTTPException(403, "Not a member of this team")

    team = await db.teams.find_one({"_id": ObjectId(team_id)})
    if not team:
        raise HTTPException(404, "Team not found")

    return {
        "id": str(team["_id"]),
        "name": team.get("name"),
        "your_role": member.get("role"),
        "created_at": team.get("created_at"),
    }


# ─── List Members ───────────────────────────────

@router.get("/{team_id}/members")
async def list_members(
    team_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = await get_user_db(current_user)

    # Verify membership
    member = await db.team_members.find_one({
        "team_id": team_id,
        "user_id": current_user["_id"],
        "status": "active",
    })
    if not member:
        raise HTTPException(403, "Not a member of this team")

    cursor = db.team_members.find({"team_id": team_id})
    members = []
    async for m in cursor:
        # Get user info
        user_info = None
        if m.get("user_id"):
            user_info = await db.users.find_one(
                {"_id": m["user_id"]},
                {"name": 1, "email": 1},
            )

        members.append({
            "id": str(m["_id"]),
            "email": m.get("email", user_info.get("email", "") if user_info else ""),
            "name": user_info.get("name", "") if user_info else "",
            "role": m.get("role", "member"),
            "status": m.get("status", "invited"),
            "joined_at": m.get("joined_at"),
        })

    return members


# ─── Invite Member ──────────────────────────────

@router.post("/{team_id}/invite")
async def invite_member(
    team_id: str,
    request: InviteMemberRequest,
    current_user: dict = Depends(get_current_user),
):
    db = await get_user_db(current_user)

    # Verify caller is admin or owner
    caller = await db.team_members.find_one({
        "team_id": team_id,
        "user_id": current_user["_id"],
        "status": "active",
    })
    if not caller or caller.get("role") not in ("owner", "admin"):
        raise HTTPException(403, "Only admins can invite members")

    if request.role not in ("admin", "member", "viewer"):
        raise HTTPException(400, "Invalid role")

    # Check if already a member
    existing = await db.team_members.find_one({
        "team_id": team_id,
        "email": request.email.lower(),
    })
    if existing:
        raise HTTPException(400, "User already invited or is a member")

    # Check member limit
    count = await db.team_members.count_documents({"team_id": team_id})
    if count >= 20:
        raise HTTPException(400, "Maximum 20 members per team")

    # Find user by email
    invited_user = await db.users.find_one({"email": request.email.lower()})

    member_doc = {
        "team_id": team_id,
        "user_id": invited_user["_id"] if invited_user else None,
        "email": request.email.lower(),
        "role": request.role,
        "status": "active" if invited_user else "invited",
        "invited_at": datetime.now(timezone.utc),
        "invited_by": current_user["_id"],
    }
    if invited_user:
        member_doc["joined_at"] = datetime.now(timezone.utc)

    await db.team_members.insert_one(member_doc)

    return {
        "email": request.email,
        "role": request.role,
        "status": member_doc["status"],
        "message": "Member added" if invited_user else "Invitation sent (user will see team when they register)",
    }


# ─── Update Member Role ─────────────────────────

@router.patch("/{team_id}/members/{member_id}")
async def update_member_role(
    team_id: str,
    member_id: str,
    request: UpdateMemberRoleRequest,
    current_user: dict = Depends(get_current_user),
):
    db = await get_user_db(current_user)

    caller = await db.team_members.find_one({
        "team_id": team_id,
        "user_id": current_user["_id"],
        "status": "active",
    })
    if not caller or caller.get("role") not in ("owner", "admin"):
        raise HTTPException(403, "Only admins can update roles")

    if request.role not in ("admin", "member", "viewer"):
        raise HTTPException(400, "Invalid role")

    target = await db.team_members.find_one({"_id": ObjectId(member_id), "team_id": team_id})
    if not target:
        raise HTTPException(404, "Member not found")

    if target.get("role") == "owner":
        raise HTTPException(400, "Cannot change owner role")

    await db.team_members.update_one(
        {"_id": ObjectId(member_id)},
        {"$set": {"role": request.role}},
    )
    return {"status": "updated", "role": request.role}


# ─── Remove Member ──────────────────────────────

@router.delete("/{team_id}/members/{member_id}")
async def remove_member(
    team_id: str,
    member_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = await get_user_db(current_user)

    caller = await db.team_members.find_one({
        "team_id": team_id,
        "user_id": current_user["_id"],
        "status": "active",
    })
    if not caller or caller.get("role") not in ("owner", "admin"):
        raise HTTPException(403, "Only admins can remove members")

    target = await db.team_members.find_one({"_id": ObjectId(member_id), "team_id": team_id})
    if not target:
        raise HTTPException(404, "Member not found")

    if target.get("role") == "owner":
        raise HTTPException(400, "Cannot remove the team owner")

    await db.team_members.delete_one({"_id": ObjectId(member_id)})
    return {"status": "removed"}


# ─── Share Document with Team ────────────────────

@router.post("/{team_id}/share-document")
async def share_document_with_team(
    team_id: str,
    document_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """Share a document with all team members."""
    db = await get_user_db(current_user)

    caller = await db.team_members.find_one({
        "team_id": team_id,
        "user_id": current_user["_id"],
        "status": "active",
    })
    if not caller:
        raise HTTPException(403, "Not a member of this team")

    # Verify document belongs to user
    doc = await db.documents.find_one({
        "_id": ObjectId(document_id),
        "user_id": current_user["_id"],
    })
    if not doc:
        raise HTTPException(404, "Document not found")

    # Add team_id to document's shared_teams list
    await db.documents.update_one(
        {"_id": ObjectId(document_id)},
        {"$addToSet": {"shared_teams": team_id}},
    )

    return {"message": f"Document shared with team", "document_id": document_id}
