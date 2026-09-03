### VAL-UI-001: A render error shows a recoverable fallback, not a blank page

When a page component throws while rendering, the application shows an error screen
explaining what happened and offering a way to continue, instead of a blank white page.
Tool: agent-browser, with a temporary throw in a page component
Evidence: screenshot of the fallback
