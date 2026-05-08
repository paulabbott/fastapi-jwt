from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token

security = HTTPBearer()


def get_current_username(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    return decode_access_token(credentials.credentials)
