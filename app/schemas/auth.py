from typing import Literal

from pydantic import BaseModel, Field

StaffRole = Literal["super_admin", "survey_creator", "survey_runner"]


class UserCredentials(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8, max_length=256)


class AdminCreateUser(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8, max_length=256)
    role: StaffRole
    group: str = Field(min_length=1, max_length=64)


class AdminCreateGroup(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class GroupUserRow(BaseModel):
    username: str
    role: str


class GroupUsersResponse(BaseModel):
    users: list[GroupUserRow]
