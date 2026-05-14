from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import verify_survey_api_bearer
from app.services.survey_store import survey_store

router = APIRouter(tags=["survey"])


class CreateSurveyBody(BaseModel):
    title: str
    survey_json: dict[str, Any] = Field(default_factory=dict)


class UpdateSurveyBody(BaseModel):
    title: str
    survey_json: dict[str, Any] = Field(default_factory=dict)


class SubmitAnswerBody(BaseModel):
    answer_json: dict[str, Any] = Field(default_factory=dict)


# --- Surveys (authenticated) ---


@router.get("/surveys")
def list_surveys(_: None = Depends(verify_survey_api_bearer)) -> list[dict[str, Any]]:
    return survey_store.list_surveys()


@router.get("/surveys/{survey_id}/metadata")
def survey_metadata(survey_id: str, _: None = Depends(verify_survey_api_bearer)) -> dict[str, Any]:
    meta = survey_store.survey_meta(survey_id)
    if not meta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    return meta


@router.get("/surveys/{survey_id}")
def get_survey(survey_id: str, _: None = Depends(verify_survey_api_bearer)) -> dict[str, Any]:
    s = survey_store.get_survey(survey_id)
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    return s


@router.post("/surveys", status_code=status.HTTP_201_CREATED)
def create_survey(body: CreateSurveyBody, _: None = Depends(verify_survey_api_bearer)) -> dict[str, str]:
    sid = survey_store.create_survey(body.title, body.survey_json)
    return {"survey_id": sid}


@router.put("/surveys/{survey_id}")
def update_survey(
    survey_id: str, body: UpdateSurveyBody, _: None = Depends(verify_survey_api_bearer)
) -> dict[str, bool]:
    if not survey_store.update_survey(survey_id, body.title, body.survey_json):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    return {"updated": True}


@router.delete("/surveys/{survey_id}")
def delete_survey(survey_id: str, _: None = Depends(verify_survey_api_bearer)) -> dict[str, bool]:
    if not survey_store.delete_survey(survey_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    return {"deleted": True}


# --- Deploys (authenticated) ---


@router.get("/surveys/{survey_id}/deploys")
def list_deploys(survey_id: str, _: None = Depends(verify_survey_api_bearer)) -> list[dict[str, Any]]:
    if not survey_store.survey_exists(survey_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    return survey_store.list_deploys(survey_id)


@router.post("/surveys/{survey_id}/deploys", status_code=status.HTTP_201_CREATED)
def create_deploy(survey_id: str, _: None = Depends(verify_survey_api_bearer)) -> dict[str, str]:
    did = survey_store.create_deploy(survey_id)
    if not did:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    return {"deploy_id": did}


@router.get("/deploys/{deploy_id}/metadata")
def deploy_metadata(deploy_id: str, _: None = Depends(verify_survey_api_bearer)) -> dict[str, Any]:
    meta = survey_store.deploy_meta(deploy_id)
    if not meta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deploy not found")
    return meta


@router.get("/deploys/{deploy_id}")
def get_deploy(deploy_id: str, _: None = Depends(verify_survey_api_bearer)) -> dict[str, Any]:
    d = survey_store.get_deploy(deploy_id)
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deploy not found")
    return d


@router.put("/deploys/{deploy_id}/stop")
def stop_deploy(deploy_id: str, _: None = Depends(verify_survey_api_bearer)) -> dict[str, bool]:
    if not survey_store.set_deploy_status(deploy_id, "stopped"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deploy not found")
    return {"updated": True}


@router.put("/deploys/{deploy_id}/resume")
def resume_deploy(deploy_id: str, _: None = Depends(verify_survey_api_bearer)) -> dict[str, bool]:
    if not survey_store.set_deploy_status(deploy_id, "active"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deploy not found")
    return {"updated": True}


@router.put("/deploys/{deploy_id}/close")
def close_deploy(deploy_id: str, _: None = Depends(verify_survey_api_bearer)) -> dict[str, bool]:
    if not survey_store.set_deploy_status(deploy_id, "closed"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deploy not found")
    return {"updated": True}


@router.delete("/deploys/{deploy_id}")
def delete_deploy(deploy_id: str, _: None = Depends(verify_survey_api_bearer)) -> dict[str, bool]:
    if not survey_store.delete_deploy(deploy_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deploy not found")
    return {"deleted": True}


# --- Links (authenticated) ---


@router.get("/deploys/{deploy_id}/links")
def get_links(deploy_id: str, _: None = Depends(verify_survey_api_bearer)) -> list[dict[str, Any]] | dict[str, Any]:
    if not survey_store.deploy_exists(deploy_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deploy not found")
    return survey_store.get_links(deploy_id)


@router.post("/deploys/{deploy_id}/links/{count}", status_code=status.HTTP_201_CREATED)
def create_links(
    deploy_id: str, count: int, _: None = Depends(verify_survey_api_bearer)
) -> list[dict[str, str]]:
    if count < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="count must be >= 1")
    links = survey_store.create_links(deploy_id, count)
    if links is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deploy not found")
    return links


@router.delete("/deploys/{deploy_id}/links/{link_id}")
def delete_link(
    deploy_id: str, link_id: str, _: None = Depends(verify_survey_api_bearer)
) -> dict[str, bool]:
    if not survey_store.deploy_exists(deploy_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deploy not found")
    if not survey_store.delete_link(deploy_id, link_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
    return {"deleted": True}


# --- Answers (Bearer required; same token as rest of Survey API) ---


@router.get("/deploys/{deploy_id}/answers")
def list_answers(deploy_id: str, _: None = Depends(verify_survey_api_bearer)) -> list[dict[str, Any]]:
    if not survey_store.deploy_exists(deploy_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deploy not found")
    return survey_store.list_answers(deploy_id)


@router.post("/deploys/{deploy_id}/answers", status_code=status.HTTP_201_CREATED)
def submit_answer(
    deploy_id: str, body: SubmitAnswerBody, _: None = Depends(verify_survey_api_bearer)
) -> dict[str, str]:
    aid = survey_store.submit_answer(deploy_id, body.answer_json, link_id=None)
    if not aid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deploy not found")
    return {"answer_id": aid}


@router.post("/deploys/{deploy_id}/answers/{link_id}", status_code=status.HTTP_201_CREATED)
def submit_answer_with_link(
    deploy_id: str, link_id: str, body: SubmitAnswerBody, _: None = Depends(verify_survey_api_bearer)
) -> dict[str, str]:
    aid = survey_store.submit_answer(deploy_id, body.answer_json, link_id=link_id)
    if not aid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deploy not found")
    return {"answer_id": aid}


@router.delete("/answers/{answer_id}")
def delete_answer(answer_id: str, _: None = Depends(verify_survey_api_bearer)) -> dict[str, bool]:
    if not survey_store.delete_answer(answer_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found")
    return {"deleted": True}
