"""Optional v7 demo tenant groups (survey workspace names), stored in the real ``groups.json`` store."""

import os

from app.services.group_service import group_store

DEMO_WORKSPACE_GROUP_NAMES = (
    "Hartwell & Sons",
    "Meridian Research Group",
    "Foxglove Studio",
)


def ensure_demo_workspace_groups() -> None:
    """Create named tenant groups if missing. Skipped when running under pytest."""
    if os.environ.get("PYTEST_VERSION"):
        return
    existing = {str(g["name"]) for g in group_store.list_groups()}
    for name in DEMO_WORKSPACE_GROUP_NAMES:
        if name not in existing:
            group_store.create_group(name)
            existing.add(name)
