from typing import Dict


class UserStore:
    def __init__(self) -> None:
        self._users: Dict[str, str] = {}

    def exists(self, username: str) -> bool:
        return username in self._users

    def register(self, username: str, password: str) -> None:
        self._users[username] = password

    def validate_credentials(self, username: str, password: str) -> bool:
        return self._users.get(username) == password

    def clear(self) -> None:
        self._users.clear()

    def list_usernames(self) -> list[str]:
        return sorted(self._users.keys())


user_store = UserStore()
