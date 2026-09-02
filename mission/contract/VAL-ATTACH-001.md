### VAL-ATTACH-001: Dropping a file on a pitch attaches it

A user with edit rights drags a file onto a pitch and it appears in that pitch's
attachment list without reloading the page, showing at least its name and who uploaded it.
Tool: agent-browser
Evidence: screenshots before and after the drop, network(POST attachment -> 201)
