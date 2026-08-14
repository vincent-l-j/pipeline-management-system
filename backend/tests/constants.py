"""Literals shared across the test modules.

Endpoint paths and status codes are deliberately left inline: the path under
test is the thing being asserted, and naming `200` adds indirection without
protecting anything. Only values whose *meaning* has to stay identical
everywhere they appear belong here.
"""

# An id that is syntactically a UUID but must never exist, for 403-before-404
# and not-found assertions. One value, so a test can never accidentally pick a
# placeholder that some other module has since inserted.
UNKNOWN_ID = "00000000-0000-0000-0000-000000000099"

# For the RBAC grids only, where the expectation column answers "may this role
# do this?" rather than "what status comes back". Reading a table of bare 200s
# and 403s means translating on every row. These are not general aliases for the
# status codes — assertions elsewhere keep the literal, and a grid over an
# endpoint whose success is not 200 should spell that out rather than bend
# ALLOWED to fit.
ALLOWED = 200
DENIED = 403
