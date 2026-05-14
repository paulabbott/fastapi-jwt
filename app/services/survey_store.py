from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

DeployStatus = str  # "active" | "stopped" | "closed"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SurveyStore:
    """In-memory Survey API backing store (dev / playground)."""

    def __init__(self) -> None:
        self._surveys: dict[str, dict[str, Any]] = {}
        self._deploys: dict[str, dict[str, Any]] = {}
        self._survey_deploy_order: dict[str, list[str]] = {}
        self._links: dict[str, list[dict[str, str]]] = {}
        self._answers: dict[str, list[dict[str, Any]]] = {}
        self._answer_by_id: dict[str, str] = {}

    def clear(self) -> None:
        self._surveys.clear()
        self._deploys.clear()
        self._survey_deploy_order.clear()
        self._links.clear()
        self._answers.clear()
        self._answer_by_id.clear()

    def survey_exists(self, survey_id: str) -> bool:
        return survey_id in self._surveys

    def deploy_exists(self, deploy_id: str) -> bool:
        return deploy_id in self._deploys

    def list_surveys(self) -> list[dict[str, Any]]:
        return [self._survey_payload(sid) for sid in sorted(self._surveys.keys())]

    def get_survey(self, survey_id: str) -> dict[str, Any] | None:
        if survey_id not in self._surveys:
            return None
        return self._survey_payload(survey_id)

    def survey_meta(self, survey_id: str) -> dict[str, Any] | None:
        s = self._surveys.get(survey_id)
        if not s:
            return None
        return {
            "survey_id": survey_id,
            "title": s["title"],
            "created_at": s["created_at"],
            "num_deploys": len(self._survey_deploy_order.get(survey_id, [])),
        }

    def create_survey(self, title: str, survey_json: dict[str, Any]) -> str:
        sid = str(uuid.uuid4())
        ts = _now_iso()
        self._surveys[sid] = {
            "title": title,
            "survey_json": survey_json,
            "created_at": ts,
            "updated_at": ts,
        }
        self._survey_deploy_order[sid] = []
        return sid

    def update_survey(self, survey_id: str, title: str, survey_json: dict[str, Any]) -> bool:
        s = self._surveys.get(survey_id)
        if not s:
            return False
        s["title"] = title
        s["survey_json"] = survey_json
        s["updated_at"] = _now_iso()
        return True

    def delete_survey(self, survey_id: str) -> bool:
        if survey_id not in self._surveys:
            return False
        for did in list(self._survey_deploy_order.get(survey_id, [])):
            self.delete_deploy(did)
        del self._surveys[survey_id]
        self._survey_deploy_order.pop(survey_id, None)
        return True

    def list_deploys(self, survey_id: str) -> list[dict[str, Any]]:
        if survey_id not in self._surveys:
            return []
        return [
            self._deploy_payload(did)
            for did in self._survey_deploy_order.get(survey_id, [])
            if did in self._deploys
        ]

    def create_deploy(self, survey_id: str) -> str | None:
        if survey_id not in self._surveys:
            return None
        did = str(uuid.uuid4())
        ts = _now_iso()
        self._deploys[did] = {
            "survey_id": survey_id,
            "deploy_json": {},
            "status": "active",
            "created_at": ts,
            "updated_at": ts,
        }
        self._survey_deploy_order.setdefault(survey_id, []).append(did)
        self._links[did] = []
        self._answers[did] = []
        return did

    def get_deploy(self, deploy_id: str) -> dict[str, Any] | None:
        if deploy_id not in self._deploys:
            return None
        return self._deploy_payload(deploy_id)

    def deploy_meta(self, deploy_id: str) -> dict[str, Any] | None:
        d = self._deploys.get(deploy_id)
        if not d:
            return None
        survey_id = d["survey_id"]
        title = self._surveys[survey_id]["title"]
        return {
            "deploy_id": deploy_id,
            "survey_id": survey_id,
            "title": title,
            "version": 1,
            "status": d["status"],
            "created_at": d["created_at"],
            "num_answers": len(self._answers.get(deploy_id, [])),
        }

    def set_deploy_status(self, deploy_id: str, status: DeployStatus) -> bool:
        d = self._deploys.get(deploy_id)
        if not d:
            return False
        d["status"] = status
        d["updated_at"] = _now_iso()
        return True

    def delete_deploy(self, deploy_id: str) -> bool:
        if deploy_id not in self._deploys:
            return False
        survey_id = self._deploys[deploy_id]["survey_id"]
        order = self._survey_deploy_order.get(survey_id, [])
        if deploy_id in order:
            order.remove(deploy_id)
        del self._deploys[deploy_id]
        for a in self._answers.pop(deploy_id, []):
            self._answer_by_id.pop(a["answer_id"], None)
        self._links.pop(deploy_id, None)
        return True

    def get_links(self, deploy_id: str) -> list[dict[str, str]] | dict[str, Any]:
        if deploy_id not in self._deploys:
            return []
        d = self._deploys[deploy_id]
        if d["status"] == "active" and not self._links.get(deploy_id):
            return {"open": True, "url": f"/public/deploy/{deploy_id}"}
        return list(self._links.get(deploy_id, []))

    def create_links(self, deploy_id: str, count: int) -> list[dict[str, str]] | None:
        if deploy_id not in self._deploys or count < 1:
            return None
        created: list[dict[str, str]] = []
        for _ in range(count):
            lid = str(uuid.uuid4())
            url = f"/public/deploy/{deploy_id}/link/{lid}"
            created.append({"link_id": lid, "url": url})
        self._links.setdefault(deploy_id, []).extend(created)
        self._deploys[deploy_id]["updated_at"] = _now_iso()
        return created

    def delete_link(self, deploy_id: str, link_id: str) -> bool:
        links = self._links.get(deploy_id)
        if not links:
            return False
        before = len(links)
        self._links[deploy_id] = [L for L in links if L["link_id"] != link_id]
        return len(self._links[deploy_id]) < before

    def list_answers(self, deploy_id: str) -> list[dict[str, Any]]:
        return list(self._answers.get(deploy_id, []))

    def submit_answer(
        self, deploy_id: str, answer_json: dict[str, Any], link_id: str | None
    ) -> str | None:
        if deploy_id not in self._deploys:
            return None
        aid = str(uuid.uuid4())
        row = {
            "answer_id": aid,
            "deploy_id": deploy_id,
            "link_id": link_id,
            "answer_json": answer_json,
            "created_at": _now_iso(),
        }
        self._answers.setdefault(deploy_id, []).append(row)
        self._answer_by_id[aid] = deploy_id
        return aid

    def delete_answer(self, answer_id: str) -> bool:
        deploy_id = self._answer_by_id.pop(answer_id, None)
        if not deploy_id:
            return False
        self._answers[deploy_id] = [a for a in self._answers[deploy_id] if a["answer_id"] != answer_id]
        return True

    def _survey_payload(self, survey_id: str) -> dict[str, Any]:
        s = self._surveys[survey_id]
        return {
            "survey_id": survey_id,
            "title": s["title"],
            "survey_json": s["survey_json"],
            "created_at": s["created_at"],
            "updated_at": s["updated_at"],
        }

    def _deploy_payload(self, deploy_id: str) -> dict[str, Any]:
        d = self._deploys[deploy_id]
        return {
            "deploy_id": deploy_id,
            "survey_id": d["survey_id"],
            "deploy_json": d["deploy_json"],
            "status": d["status"],
            "created_at": d["created_at"],
            "updated_at": d["updated_at"],
        }


survey_store = SurveyStore()
