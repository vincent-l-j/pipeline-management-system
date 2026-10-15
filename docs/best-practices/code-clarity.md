# Code clarity — self-documenting code and when to comment

Comments decay faster than code. They go stale when implementations change, and
out-of-date comments are worse than no comments — they actively mislead. Prefer
expressive code that documents itself.

## The principle

**Ideally, no comments exist.** Names, structure and tests carry the meaning.

Comment only where the code would otherwise **mislead** — where a careful reader
would get it wrong, or "fix" it and break something:

- **A workaround** for a quirk outside the code: a dependency bug, a browser or
  platform behaviour, a performance trap.
- **What will break** if someone changes this code, when no test would catch it.
- **Legal/compliance** notes (licenses, data handling, regulatory constraints).

A non-obvious business rule is not on that list. The code enforces it, a test
pins it, and the spec or commit message explains it; a comment restating it is a
third copy that nothing keeps in sync.

## Guidelines

### Do: Comment the workaround that looks like a mistake

```ts
for (let i = 1; i <= steps; i++) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", ... });
  // Real frames, so Chromium's gesture recogniser sees a drag.
  await new Promise((r) => setTimeout(r, 16));
}
```

Without the comment, the sleep reads as leftover debugging and gets deleted.

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

### Don't: Restate business rules or specs

❌ **Bad:**

```tsx
<button
  // WCAG 2.5.5 covers a mouse as much as a finger, so the target applies at
  // every width.
  className="min-h-11 min-w-11"
>
```

The rule lives in the spec, the reason in the commit message, and a test fails if
the target shrinks. The comment adds a copy that can drift from all three.

### Don't: Put exact values in comments

❌ **Bad:**

```tsx
// 44px each way for a finger, dropped at `md`.
```

A size, breakpoint or count restated in a comment goes stale the moment the code
changes, and nothing fails when it does. Let the code (or a test) carry the value.

### Don't: Explain what a test already guards

❌ **Bad:**

```tsx
{/* A labelled group, so the chips are reachable as a set. */}
<div role="group" aria-labelledby="pitch-domains-label">
```

If removing the markup fails a test loudly, the test is the explanation.

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
