### A removal's red phase does not leave a test behind

Observed: removing linked files from pitches produced two tests that assert the
feature is gone — `test_file_link_routes_are_gone`, checking a 404 on
`/api/pitches/{id}/files`, and a frontend case asserting the string `"Linked Files"`
is absent from the pitch detail page. Both were written to get a red-green cycle on a
change whose whole content is deletion. Both were kept after green. Neither can fail
except by someone deliberately rebuilding the feature, and the 404 one would pass
just as well for `/api/pitches/{id}/flurble` — it asserts a property shared by
infinitely many paths that were never routes.
Root cause: TDD says write the failing test first, and on a removal the only thing
that can fail first is an absence assertion. That makes it feel earned. But the test
that drives a deletion and the test that guards a behaviour are different artifacts
that happen to be the same code at the moment of the commit: the first is scaffolding
whose value is spent the instant it goes green, the second keeps paying. A test naming
a route or a string that appears in no source file is also actively misleading — it
reads like a clue to something a reader should go find, and there is nothing to find.
The regression it imagines is not a slip anyone makes; reviving a deleted feature is a
decision, and decisions are governed by the ADR that records them, not by a test the
reviver would simply delete along with everything else in their way.
Rule: on a removal, use the absence assertion to drive the deletion, then delete it
with the code it removed. What survives the commit is the ADR explaining why the thing
is gone, and any test of behaviour that _remains_ — for a dropped table, that the
migration drops and its downgrade restores; for a removed card, that the surviving
layout is still right. Keep a test of absence only where something would silently
recreate it, such as a generated artifact or a permission that fails open.
Check: a test whose assertions are all negative — `not in`, `queryBy... toBeNull`, a
404 — naming an identifier, route or string that a grep of the same branch finds
nowhere else.
