import json
import os
import threading
from pathlib import Path
from typing import Any, Dict

from nanoid import generate

from app.core.config import get_settings

_MAX_ID_ATTEMPTS = 32


class FileBackedGroupStore:
    """JSON file mapping tenant group id to ``{ "name", "is_super_admin_group" }``. Thread-safe."""

    def __init__(self, path: Path | None = None) -> None:
        self._path = path or Path(get_settings().groups_store_path)
        self._lock = threading.Lock()

    def _read_raw(self) -> Dict[str, dict[str, Any]]:
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
        out: Dict[str, dict[str, Any]] = {}
        for k, v in data.items():
            if isinstance(v, dict) and "name" in v:
                flag = v.get("is_super_admin_group")
                out[str(k)] = {
                    "name": str(v["name"]),
                    "is_super_admin_group": flag is True,
                }
        return out

    def _write_raw(self, groups: Dict[str, dict[str, Any]]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(self._path.suffix + ".tmp")
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(groups, f, indent=2, sort_keys=True)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, self._path)
        except Exception:
            if tmp.exists():
                tmp.unlink(missing_ok=True)  # type: ignore[arg-type]
            raise

    def is_empty(self) -> bool:
        with self._lock:
            return len(self._read_raw()) == 0

    def exists(self, group_id: str) -> bool:
        with self._lock:
            return group_id in self._read_raw()

    def create_group(self, name: str, *, is_super_admin_group: bool = False) -> tuple[str, str]:
        with self._lock:
            groups = self._read_raw()
            for _ in range(_MAX_ID_ATTEMPTS):
                gid = generate()
                if gid not in groups:
                    groups[gid] = {
                        "name": name.strip() or "Unnamed",
                        "is_super_admin_group": is_super_admin_group,
                    }
                    self._write_raw(groups)
                    return gid, str(groups[gid]["name"])
            raise RuntimeError("Could not allocate a unique group id after several attempts")

    def list_groups(self) -> list[dict[str, Any]]:
        with self._lock:
            raw = self._read_raw()
            return [
                {
                    "id": gid,
                    "name": str(rec["name"]),
                    "is_super_admin_group": bool(rec["is_super_admin_group"]),
                }
                for gid, rec in sorted(raw.items(), key=lambda x: x[0])
            ]

    def clear(self) -> None:
        with self._lock:
            if self._path.exists():
                self._path.unlink()
            self._write_raw({})


group_store = FileBackedGroupStore()
