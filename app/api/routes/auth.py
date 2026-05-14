from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from starlette.responses import Response

from app.api.deps import StaffContext, get_staff_context, require_super_admin
from app.core.security import create_access_token
from app.schemas.auth import AdminCreateGroup, AdminCreateUser, GroupUsersResponse, TokenResponse, UserCredentials
from app.services.group_service import group_store
from app.services.user_service import user_store

router = APIRouter(prefix="/auth", tags=["auth"])


def _bootstrap_default_group_id() -> str:
    if group_store.is_empty():
        gid, _ = group_store.create_group("Global Admin", is_super_admin_group=True)
        return gid
    groups = group_store.list_groups()
    return groups[0]["id"]


@router.post("/bootstrap", status_code=status.HTTP_201_CREATED)
def bootstrap_first_super_admin(user: UserCredentials) -> dict[str, str]:
    """One-time: create the first super_admin when there are no users. Disabled after that."""
    if not user_store.is_empty():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bootstrap is only allowed when there are no users yet",
        )
    group = _bootstrap_default_group_id()
    user_store.create_user(user.username, user.password, "super_admin", group)
    return {"username": user.username, "role": "super_admin", "group": group}


@router.post("/admin/users", status_code=status.HTTP_201_CREATED)
def admin_create_user(
    body: AdminCreateUser,
    _: StaffContext = Depends(require_super_admin),
) -> dict[str, str]:
    if user_store.exists(body.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists",
        )
    if not group_store.exists(body.group):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unknown group",
        )
    user_store.create_user(body.username, body.password, body.role, body.group)
    return {"username": body.username, "role": body.role, "group": body.group}


@router.post("/login", response_model=TokenResponse)
def login(user: UserCredentials) -> TokenResponse:
    if not user_store.validate_credentials(user.username, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    role = user_store.get_role(user.username)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    group = user_store.get_group(user.username)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    token = create_access_token(user.username, role, group)
    return TokenResponse(access_token=token)


@router.get("/super-admins")
def list_super_admins(ctx: StaffContext = Depends(require_super_admin)) -> dict[str, list[str]]:
    """Super admins in the same tenant as the caller (JWT ``group``)."""
    names = user_store.list_usernames_by_role_in_group("super_admin", ctx.group)
    return {"super_admins": names}


@router.delete("/admin/users/{username}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_user(
    username: str,
    ctx: StaffContext = Depends(require_super_admin),
) -> Response:
    if username == ctx.username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )
    if not user_store.exists(username):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user_store.get_group(username) != ctx.group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user_store.get_role(username) == "super_admin":
        admins = user_store.list_usernames_by_role_in_group("super_admin", ctx.group)
        if len(admins) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last super_admin for this group",
            )
    user_store.delete_user(username)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/users")
def list_users(ctx: StaffContext = Depends(get_staff_context)) -> dict[str, list[str]]:
    return {"users": user_store.list_usernames_in_group(ctx.group)}


@router.get("/groups/{group_id}/users", response_model=GroupUsersResponse)
def list_group_users(group_id: str, ctx: StaffContext = Depends(get_staff_context)) -> GroupUsersResponse:
    """List staff (username + role) in a tenant group.

    Callers may only request their own JWT ``group``, unless they are ``super_admin``
    (then any existing group id is allowed).
    """
    if not group_store.exists(group_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown group")
    if ctx.role != "super_admin" and ctx.group != group_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to list users for this group",
        )
    rows = user_store.list_staff_in_group(group_id)
    return GroupUsersResponse(users=rows)


@router.get("/admin/groups")
def admin_list_groups(_: StaffContext = Depends(require_super_admin)) -> dict[str, list[dict[str, Any]]]:
    return {"groups": group_store.list_groups()}


@router.post("/admin/groups", status_code=status.HTTP_201_CREATED)
def admin_create_group(
    body: AdminCreateGroup,
    _: StaffContext = Depends(require_super_admin),
) -> dict[str, str | bool]:
    gid, name = group_store.create_group(body.name)
    return {"id": gid, "name": name, "is_super_admin_group": False}
