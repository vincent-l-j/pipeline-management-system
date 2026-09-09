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


# The object store's endpoint follows its region, the way the Azure authority
# follows the tenant — one value to set per environment instead of two that can
# disagree with each other.
def test_the_object_store_endpoint_is_derived_from_the_region():
    settings = Settings(_env_file=None, SPACES_REGION="syd1", SPACES_ENDPOINT="")

    assert settings.spaces_endpoint_url == "https://syd1.digitaloceanspaces.com"


def test_an_explicit_object_store_endpoint_wins_over_the_region():
    """The override exists so a compatible store can be pointed at directly."""
    settings = Settings(
        _env_file=None, SPACES_REGION="syd1", SPACES_ENDPOINT="https://store.internal:9000"
    )

    assert settings.spaces_endpoint_url == "https://store.internal:9000"


def test_the_object_store_is_unconfigured_by_default(monkeypatch):
    """Empty, not absent: an unconfigured document store degrades one feature and
    must not stop the app booting the way a missing SECRET_KEY does."""
    for name in ("SPACES_REGION", "SPACES_BUCKET", "SPACES_ACCESS_KEY_ID"):
        monkeypatch.delenv(name, raising=False)

    settings = Settings(_env_file=None)

    assert (settings.SPACES_REGION, settings.SPACES_BUCKET, settings.SPACES_ACCESS_KEY_ID) == (
        "",
        "",
        "",
    )
