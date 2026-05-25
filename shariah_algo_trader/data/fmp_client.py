import requests


class FMPError(Exception):
    pass


_DEFAULT_BASE_URL = "https://financialmodelingprep.com/api/v3"


class FMPClient:
    def __init__(self, api_key: str, base_url: str = _DEFAULT_BASE_URL, session=None):
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._session = session or requests.Session()

    def get(self, path: str, params: dict | None = None) -> list | dict:
        url = f"{self._base_url}/{path.lstrip('/')}"
        query = {"apikey": self._api_key, **(params or {})}
        try:
            response = self._session.get(url, params=query)
        except requests.RequestException as exc:
            raise FMPError(f"HTTP request failed: {exc}") from exc

        if not response.ok:
            raise FMPError(f"FMP returned {response.status_code} for {path}")

        try:
            return response.json()
        except ValueError as exc:
            raise FMPError(f"malformed JSON from FMP: {exc}") from exc
