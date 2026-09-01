"""Request and response schemas for browser error reports.

`extra` stays at Pydantic's default "ignore", not "forbid": an unknown field is never
read either way, and "forbid" would turn SPA/backend version skew into a 422 on every
report — telemetry vanishing exactly when something changed.
"""

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.redaction import redact_credentials, reduce_url_to_path

MAX_MESSAGE_LENGTH = 500
MAX_URL_LENGTH = 500
MAX_STACK_LENGTH = 4000
MAX_COMPONENT_STACK_LENGTH = 4000
MAX_REQUEST_ID_LENGTH = 64


class ClientErrorReport(BaseModel):
    """A browser failure as the SPA saw it."""

    message: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)
    # Plain str, not AnyHttpUrl: relative routes, `blob:` and `chrome-extension://`
    # frames are all real crash sites, and a 422 would discard the report.
    url: str = Field(min_length=1, max_length=MAX_URL_LENGTH)
    stack: str | None = Field(default=None, max_length=MAX_STACK_LENGTH)
    component_stack: str | None = Field(default=None, max_length=MAX_COMPONENT_STACK_LENGTH)
    correlated_request_id: str | None = Field(default=None, max_length=MAX_REQUEST_ID_LENGTH)

    @field_validator("url")
    @classmethod
    def keep_only_the_path(cls, value: str) -> str:
        """Drop the query string and fragment before the URL can reach a log record.

        Here, not at the call site that logs it: this is the allowlist every caller
        crosses, including a stale bundle or a direct POST.
        """
        return reduce_url_to_path(value)

    @model_validator(mode="after")
    def redact_credentials_from_every_field(self) -> "ClientErrorReport":
        """Redact credential-shaped values from the whole record, not a chosen few.

        Iterates the fields rather than naming them, so a field added tomorrow inherits
        the rule. Redaction can lengthen a value (`key=a` → `key=REDACTED`), so the caps
        are enforced on the way in and deliberately not re-checked here.
        """
        for name in type(self).model_fields:
            value = getattr(self, name)
            if isinstance(value, str):
                setattr(self, name, redact_credentials(value))
        return self


class ClientErrorAck(BaseModel):
    """The id that locates the record this report produced."""

    request_id: str
