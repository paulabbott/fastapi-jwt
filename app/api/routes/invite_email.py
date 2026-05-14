from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import StaffContext, require_invite_email_staff
from app.core.config import get_settings
from app.schemas.invite_email import (
    FailedItemOut,
    SendParticipantInvitesRequest,
    SendParticipantInvitesResponse,
    SentItemOut,
)
from app.services.invite_resend import send_participant_invites

router = APIRouter(prefix="/invite", tags=["invite"])


@router.post(
    "/send-participant-emails",
    response_model=SendParticipantInvitesResponse,
)
async def send_participant_emails(
    body: SendParticipantInvitesRequest,
    _ctx: StaffContext = Depends(require_invite_email_staff),
) -> SendParticipantInvitesResponse:
    settings = get_settings()
    if not settings.resend_api_key.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RESEND_API_KEY is not configured",
        )

    pairs = [(r.email.strip(), r.otp or "") for r in body.recipients]

    try:
        sent_raw, failed_raw = await send_participant_invites(pairs)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e

    return SendParticipantInvitesResponse(
        sent=[SentItemOut(**x) for x in sent_raw],
        failed=[FailedItemOut(**x) for x in failed_raw],
    )
