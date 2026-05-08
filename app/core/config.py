import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    jwt_secret: str
    jwt_algorithm: str
    jwt_expiration_hours: int


def get_settings() -> Settings:
    return Settings(
        jwt_secret=os.getenv("JWT_SECRET", "your-secret-key"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        jwt_expiration_hours=int(os.getenv("JWT_EXPIRATION_HOURS", "24")),
    )


settings = get_settings()
