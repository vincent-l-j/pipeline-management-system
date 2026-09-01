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


# conftest.py sets LOG_LEVEL and ENVIRONMENT for the test run, so these have to be
# cleared before the defaults in config.py are observable.
def test_log_level_defaults_to_info(monkeypatch):
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    assert Settings(_env_file=None).LOG_LEVEL == "INFO"


def test_environment_defaults_to_development(monkeypatch):
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    assert Settings(_env_file=None).ENVIRONMENT == "development"
