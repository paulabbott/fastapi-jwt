from pydantic import BaseModel, Field


class InviteRecipientIn(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    otp: str = Field(default="", max_length=64)


class SendParticipantInvitesRequest(BaseModel):
    recipients: list[InviteRecipientIn] = Field(min_length=1, max_length=50)


class SentItemOut(BaseModel):
    email: str
    link: str


class FailedItemOut(BaseModel):
    email: str
    detail: str


class SendParticipantInvitesResponse(BaseModel):
    sent: list[SentItemOut]
    failed: list[FailedItemOut]
