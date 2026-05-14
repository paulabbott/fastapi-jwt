import os
import sys
import tempfile
from pathlib import Path

# Before any app import: isolated JSON user store per pytest process.
_tmp_users = tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".json", encoding="utf-8")
_tmp_users.write("{}")
_tmp_users.close()
os.environ["USERS_STORE_PATH"] = _tmp_users.name

_tmp_groups = tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".json", encoding="utf-8")
_tmp_groups.write("{}")
_tmp_groups.close()
os.environ["GROUPS_STORE_PATH"] = _tmp_groups.name

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("SURVEY_API_BEARER_TOKEN", "test-survey-api-bearer")
