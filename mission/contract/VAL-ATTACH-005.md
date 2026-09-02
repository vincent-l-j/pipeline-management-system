### VAL-ATTACH-005: An unacceptable file is refused before it is sent

A file that exceeds the size limit or is of a disallowed type is refused by the server with
a message saying which limit it broke, and is never sent to the document store. The check
is server-side; a client that skips it changes nothing.
Tool: the API called directly with an oversized file and with a disallowed type
Evidence: the refusals and their messages, and the absence of any call to the document
store
