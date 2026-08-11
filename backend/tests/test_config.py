"""SECRET_KEY and AZURE_CLIENT_SECRET must come from the environment.

If they had defaults, a misconfigured production would boot on a known key
(forgeable JWTs) instead of failing loudly. These tests pin that the app refuses
to construct its settings when either is absent.
"""

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_missing_secret_key_is_fatal(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_missing_azure_client_secret_is_fatal(monkeypatch):
    monkeypatch.delenv("AZURE_CLIENT_SECRET", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)
