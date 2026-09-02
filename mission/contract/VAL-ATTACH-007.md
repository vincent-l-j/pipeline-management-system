### VAL-ATTACH-007: Store credentials never appear in logs or responses

No log line or error response contains the client secret, an access token, or a signed
download URL. A signed URL is itself a credential — anyone holding it can fetch the file
without authenticating.
Tool: the logs and error responses from a successful upload and from a failing one
Evidence: the captured output, searched for the secret, the token and the signature
parameter
