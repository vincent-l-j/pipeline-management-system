### VAL-ATTACH-003: A read-only user cannot attach or remove files

A viewer can see a pitch's attachment list but cannot add to it or remove from it. The
refusal comes from the server on a direct request, not from a hidden button — hiding the
control in the interface is not the control.
Tool: the API called directly with a viewer's credentials
Evidence: the list request succeeding and the upload and delete requests refused, with
their status codes
