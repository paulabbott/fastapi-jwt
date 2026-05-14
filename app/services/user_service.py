import json
import os
import threading
from pathlib import Path
from typing import Dict

import bcrypt

from app.core.config import get_settings
from app.schemas.auth import StaffRole

_BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")


def _is_bcrypt_hash(value: str) -> bool:
    return value.startswith(_BCRYPT_PREFIXES)


def _hash_password(plain: str) -> str:
    rounds = 12
    hashed = bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=rounds))
    return hashed.decode("ascii")


class FileBackedUserStore:
    """JSON file–backed user directory. Passwords are bcrypt hashes (see ``password`` field). Thread-safe."""

    def __init__(self, path: Path | None = None) -> None:
        self._path = path or Path(get_settings().users_store_path)
        self._lock = threading.Lock()

    def _read_raw(self) -> Dict[str, dict[str, str]]:
        if not self._path.exists():
            return {}
        try:
            raw = self._path.read_text(encoding="utf-8").strip()
            if not raw:
                return {}
            data = json.loads(raw)
        except (json.JSONDecodeError, OSError):
            return {}
        if not isinstance(data, dict):
            return {}
        out: Dict[str, dict[str, str]] = {}
        for k, v in data.items():
            if isinstance(v, dict) and "password" in v and "role" in v:
                g = v.get("group")
                out[str(k)] = {
                    "password": str(v["password"]),
                    "role": str(v["role"]),
                    "group": str(g) if g is not None and str(g).strip() != "" else "",
                }
        return out

    def _write_raw(self, users: Dict[str, dict[str, str]]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(self._path.suffix + ".tmp")
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(users, f, indent=2, sort_keys=True)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, self._path)
        except Exception:
            if tmp.exists():
                tmp.unlink(missing_ok=True)  # type: ignore[arg-type]
            raise

    def exists(self, username: str) -> bool:
        with self._lock:
            return username in self._read_raw()

    def is_empty(self) -> bool:
        with self._lock:
            return len(self._read_raw()) == 0

    def create_user(self, username: str, password: str, role: StaffRole, group: str) -> None:
        with self._lock:
            users = self._read_raw()
            users[username] = {
                "password": _hash_password(password),
                "role": role,
                "group": group,
            }
            self._write_raw(users)

    def get_role(self, username: str) -> StaffRole | None:
        with self._lock:
            rec = self._read_raw().get(username)
            if not rec:
                return None
            return rec["role"]  # type: ignore[return-value]

    def get_group(self, username: str) -> str:
        with self._lock:
            rec = self._read_raw().get(username)
            if not rec:
                return ""
            return str(rec.get("group") or "")

    def validate_credentials(self, username: str, password: str) -> bool:
        with self._lock:
            rec = self._read_raw().get(username)
            if not rec:
                return False
            stored = rec["password"]
            if not _is_bcrypt_hash(stored):
                return False
            try:
                return bool(
                    bcrypt.checkpw(
                        password.encode("utf-8"),
                        stored.encode("ascii"),
                    )
                )
            except (ValueError, TypeError):
                return False

    def clear(self) -> None:
        with self._lock:
            if self._path.exists():
                self._path.unlink()
            self._write_raw({})

    def list_usernames(self) -> list[str]:
        with self._lock:
            return sorted(self._read_raw().keys())

    def list_usernames_in_group(self, group: str) -> list[str]:
        with self._lock:
            users = self._read_raw()
            return sorted(u for u, rec in users.items() if rec.get("group") == group)

    def list_staff_in_group(self, group: str) -> list[dict[str, str]]:
        """Usernames and roles for accounts in ``group`` (sorted by username)."""
        with self._lock:
            users = self._read_raw()
            rows = [
                {"username": u, "role": str(rec["role"])}
                for u, rec in users.items()
                if rec.get("group") == group
            ]
            rows.sort(key=lambda r: r["username"])
            return rows

    def list_usernames_by_role(self, role: StaffRole) -> list[str]:
        with self._lock:
            users = self._read_raw()
            return sorted(u for u, rec in users.items() if rec["role"] == role)

    def list_usernames_by_role_in_group(self, role: StaffRole, group: str) -> list[str]:
        with self._lock:
            users = self._read_raw()
            return sorted(
                u
                for u, rec in users.items()
                if rec["role"] == role and rec.get("group") == group
            )

    def delete_user(self, username: str) -> bool:
        with self._lock:
            users = self._read_raw()
            if username not in users:
                return False
            del users[username]
            self._write_raw(users)
            return True


user_store = FileBackedUserStore()
