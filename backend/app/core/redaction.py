"""Credential redaction for caller data on its way into the log stream.

Two overlapping layers, both documented under "Logging" in
docs/best-practices/backend-fastapi.md. Apply them at the boundary, never per field.
"""

import re

REDACTED = "REDACTED"

# Not "" (reads as a broken reporter) and not "/" (claims the home page).
NO_PATH = "(no path)"

# Matched exactly, not by suffix: suffix matching would eat `zipcode` and `monkey`,
# so compound spellings are named individually.
_CREDENTIAL_PARAM_NAMES = (
    "access_token",
    "refresh_token",
    "id_token",
    "session_token",
    "csrf_token",
    "token",
    "client_secret",
    "secret",
    "password",
    "passwd",
    "pwd",
    "api_key",
    "apikey",
    "key",
    "authorization",
    "auth",
    "credential",
    "signature",
    # Object stores hand out URLs whose query string *is* the credential, under a
    # different name each. `sig` is Azure's and `tempauth` is Graph's; both are
    # here because this list is cheap and a URL from anywhere can reach a log line.
    # Spelled out rather than left to `auth`, which cannot match `tempauth`: the
    # word boundary refuses a match that starts mid-word.
    "sig",
    "tempauth",
    # S3 signs with the same idea and hyphenates every name, which is why these
    # need naming too: `signature` and `credential` above cannot reach them,
    # because a hyphen is what precedes them.
    "x-amz-signature",
    "x-amz-credential",
    "x-amz-security-token",
    # The key pair, in the spellings a config dump or a client library uses. Named
    # in full for the same reason: `secret` is followed by a separator rather than
    # an `=`, and `key` is preceded by one.
    "secret_access_key",
    "access_key_id",
    # The OAuth authorization code: one exchange away from a token.
    "code",
    "session",
)

# Longest first, so `access_token` wins over `token`.
_NAMES_PATTERN = "|".join(sorted(_CREDENTIAL_PARAM_NAMES, key=len, reverse=True))

# `%3Ftoken=` was a real bypass; see "Normalise before you match" in
# docs/best-practices/backend-fastapi.md.
_CREDENTIAL_ASSIGNMENT = re.compile(
    rf"""
    (?P<boundary>  %[0-9A-F]* | (?<![A-Z0-9_-]) )   # a percent-escape, or a word start
    (?P<name>      {_NAMES_PATTERN} )
    (?P<separator> [ \t]*=[ \t]*["']? )             # takes any opening quote with it
    (?P<value>     [^\s&#;,"'<>()\[\]{{}}\\]+ )     # to the first character that ends one
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Nothing else is decoded, so `%20` and `%2F` in a path survive.
_URL_SEPARATOR = re.compile(
    r"""
      [?#]                 # the literal separators
    | %(?:25)*(?:3F|23)    # or percent-escaped, at any depth of re-encoding
    """,
    re.IGNORECASE | re.VERBOSE,
)


def redact_credentials(text: str) -> str:
    """Replace the value of every credential-shaped assignment, keeping the rest."""
    return _CREDENTIAL_ASSIGNMENT.sub(rf"\g<boundary>\g<name>\g<separator>{REDACTED}", text)


def reduce_url_to_path(url: str) -> str:
    """Return the path of a caller-supplied URL, with the query and fragment gone."""
    # Cut rather than substitute, so the surviving path stays the caller's own bytes.
    separator = _URL_SEPARATOR.search(url)
    path = url[: separator.start()] if separator else url
    return path or NO_PATH
