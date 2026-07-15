# Code clarity — self-documenting code and when to comment

Comments decay faster than code. They go stale when implementations change, and
out-of-date comments are worse than no comments — they actively mislead. Prefer
expressive code that documents itself.

## The principle

**Explain *why* in comments; let the code explain *what*.**

Comments should be rare. When they exist, they protect against categories of
problems that code cannot:

- **Why** a non-obvious choice exists (business rule, architectural constraint).
- **Why** a workaround is needed (bug in a dependency, performance gotcha, or
  compatibility quirk).
- **What will break** if someone changes this code (side effects, invariants,
  warnings of consequences).
- **Legal/compliance** notes (licenses, data handling, regulatory constraints).

Comments should *never* repeat what the code already says clearly.

## Guidelines

### Do: Use comments for intent and non-obvious choices

```python
# Avoid the N+1 query: fetch all contacts in one query, not per pitch.
contacts = db.query(Contact).filter(Contact.pitch_id.in_(pitch_ids)).all()

# The AI parser is optional; fall back to basic line splitting if not configured.
parsed = parse_notes(notes)

# We store `changed_at` in UTC so historical comparisons are unambiguous.
pitch.changed_at = datetime.now(timezone.utc)
```

### Don't: Comment obvious code

❌ **Bad:**
```python
# Initialize an empty list
items = []

# Add item to the list
items.append(item)

# Fetch the user from the database
user = db.query(User).filter(User.id == user_id).first()
```

Good naming and structure already communicate intent.

### Don't: Comment out code — delete it

❌ **Bad:**
```python
# old_way_to_do_it(x)
new_way_to_do_it(x)
```

✅ **Good:**
```python
new_way_to_do_it(x)
```

Git history is the archive. Commented code is noise and accumulates rot.

### Don't: Use closing-brace or closing-tag comments

❌ **Bad:**
```python
if condition:
    do_something()
# end if

def long_function():
    ...
# end long_function
```

Indentation and block structure already show nesting. These comments add nothing.

### Do: Explain consequences and gotchas

```python
# Calling this twice in the same request updates modified_at each time.
# Tests must account for the second timestamp being newer.
pitch.touch()

# This query is unindexed on `created_at` and scans the full table.
# For large datasets, use the date-filtered API endpoint instead.
all_pitches = db.query(Pitch).all()
```

### Do: Use clear, expressive names

Instead of a comment that says what a variable does:

❌ **Bad:**
```python
# This is a list of pitch IDs that passed screening
x = [...]
```

✅ **Good:**
```python
screened_pitch_ids = [...]
```

### Do: Use comments to explain architectural rationale

```python
# Integrity checks live in app code, not in DB triggers or foreign keys.
# SQLite tests don't enforce FK constraints, so violations wouldn't surface
# until production. We catch them here instead.
if not db.query(Pitch).filter(Pitch.id == pitch.id).first():
    raise ValueError("Invalid pitch_id")
```

### Don't: Use comments to replace good error messages

❌ **Bad:**
```python
# Pitch must exist
if not pitch:
    raise ValueError("not found")
```

✅ **Good:**
```python
if not pitch:
    raise HTTPException(status_code=404, detail="Pitch not found")
```

## In practice

- **Names win.** Rename a function or variable to be clearer before adding a
  comment. A well-named `authenticated_and_active_user` needs no comment;
  `u` with a comment explaining what `u` is has both failed.
- **Limit to one short line.** Multi-line comment blocks are a sign the code
  itself needs refactoring.
- **Keep comments near the code they describe.** A comment at the top of a file
  explaining a function will rot; put it right before the function.
- **The code must stay correct if the comment is deleted.** If removing the
  comment breaks understanding of correctness, the code isn't clear enough yet.

## Updating docs alongside code

When a commit changes established patterns or behavior, update the relevant
best-practices doc in the same change (see `docs/best-practices/README.md`).
Code wins; the docs are orientation. Keep them synchronized so they remain a
trusted reference.
