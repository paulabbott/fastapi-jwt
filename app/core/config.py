import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    jwt_secret: str
    jwt_algorithm: str
    jwt_expiration_hours: int
    survey_api_bearer_token: str
    users_store_path: str
    groups_store_path: str
    resend_api_key: str
    resend_from: str


def get_settings() -> Settings:
    root_data = Path(__file__).resolve().parents[2] / "data"
    default_users = root_data / "users.json"
    default_groups = root_data / "groups.json"
    return Settings(
        jwt_secret=os.getenv("JWT_SECRET", "your-secret-key"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        jwt_expiration_hours=int(os.getenv("JWT_EXPIRATION_HOURS", "24")),
        survey_api_bearer_token=os.getenv("SURVEY_API_BEARER_TOKEN", ""),
        users_store_path=os.getenv("USERS_STORE_PATH", str(default_users)),
        groups_store_path=os.getenv("GROUPS_STORE_PATH", str(default_groups)),
        resend_api_key=os.getenv("RESEND_API_KEY", ""),
        resend_from=os.getenv("RESEND_FROM", "onboarding@resend.dev"),
    )


settings = get_settings()
