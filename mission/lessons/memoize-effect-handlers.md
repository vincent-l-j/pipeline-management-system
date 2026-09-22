### Memoize the helper instead of dodging the dependency array

Observed: the app shell closed its navigation drawer four ways — toggle, backdrop,
navigation and Escape — and the Escape path was the odd one out, calling
`setDrawerOpen(false)` where the other three called `closeDrawer`. One behaviour,
two spellings, in a twenty-line component.
Root cause: `closeDrawer` was a plain arrow function, so its identity changed on
every render. Referencing it inside the effect forced a choice between listing it,
which tears down and re-adds the document listener after every render, and omitting
it, which leaves a dependency array that no longer tells the truth. Bypassing the
helper dodged the choice, at the price of duplicating the exit path — and the
duplication is the part that survives into the next change.
Rule: a handler an effect needs is wrapped in `useCallback` and listed in the
dependency array. `useState` setters are identity-stable and need no entry; every
other function the effect calls does. Memoizing is the cheap half — it is one hook
call — and the dependency array stays honest for the reader who edits it next.
Check: an effect whose body calls a state setter that a sibling handler reaches
through a named helper.
Note: `frontend/eslint.config.mjs` extends only `js.configs.recommended` and the
typescript-eslint sets — there is no `eslint-plugin-react-hooks`, so nothing
mechanically checks a dependency array in this repo. Until that plugin lands, this
rule is enforced by attention alone, which is the weakest enforcement there is.
