### VAL-ATTACH-004: A failed upload leaves nothing behind

When the document store rejects or cannot receive the file, the user is told the upload
failed and the pitch gains no attachment entry. A record pointing at a file that was never
stored is worse than a failed upload, because it reads as success until someone clicks it.
Tool: the API with the document store made to fail
Evidence: the error returned to the caller, and the pitch's attachment list unchanged
