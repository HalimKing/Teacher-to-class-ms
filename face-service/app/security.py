import hmac

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader

from app.state import get_settings

api_key_header = APIKeyHeader(name="X-Api-Key", auto_error=False)


def require_api_key(provided: str | None = Depends(api_key_header)) -> None:
    expected = get_settings().api_key
    if not expected or not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "code": "UNAUTHORIZED", "message": "Unauthorized."},
        )
