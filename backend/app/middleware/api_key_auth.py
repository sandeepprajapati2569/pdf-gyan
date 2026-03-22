from fastapi import Request, HTTPException, status
from app.services.api_key_service import validate_api_key


async def get_api_key_user(request: Request) -> dict:
    """Dependency that authenticates via API key in Authorization header."""
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header. Use: Bearer pgyan_xxx",
        )

    raw_key = auth_header[7:]  # Strip "Bearer "

    if not raw_key.startswith("pgyan_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key format",
        )

    user = await validate_api_key(raw_key)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key",
        )

    return user
