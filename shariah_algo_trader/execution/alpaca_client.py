import requests


class AlpacaError(Exception):
    pass


class AlpacaClient:
    def __init__(self, api_key: str, api_secret: str, base_url: str, session=None):
        self._base_url = base_url.rstrip("/")
        self._headers = {
            "APCA-API-KEY-ID": api_key,
            "APCA-API-SECRET-KEY": api_secret,
        }
        self._session = session or requests.Session()

    def get(self, path: str) -> list | dict:
        url = f"{self._base_url}/{path.lstrip('/')}"
        try:
            response = self._session.get(url, headers=self._headers)
        except requests.RequestException as exc:
            raise AlpacaError(f"HTTP request failed: {exc}") from exc

        if not response.ok:
            raise AlpacaError(f"Alpaca returned {response.status_code} for {path}")

        try:
            return response.json()
        except ValueError as exc:
            raise AlpacaError(f"malformed JSON from Alpaca: {exc}") from exc
