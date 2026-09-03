### VAL-ATTACH-006: An attachment is reachable only through its own pitch

Naming an attachment's identifier under a pitch it does not belong to does not download or
delete it, even when the caller may edit the pitch they named. An identifier is not an
authorisation.
Tool: the API called with a valid attachment identifier under the wrong pitch
Evidence: the refusals for download and delete, and the file still present afterwards
