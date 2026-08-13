/**
 * A searchable single-select, built by hand.
 *
 * There is no component library here and the dependency list is deliberately
 * short, so this follows the ARIA 1.2 "combobox with list autocomplete" pattern
 * directly: an input owning a listbox, with the highlighted row named by
 * aria-activedescendant rather than focused.
 *
 * Filtering is client-side over the options it is handed. Callers pass a list
 * they already have; there is no fetching, no debounce and no request race.
 *
 * Three behaviours exist for reasons that are easy to undo by accident:
 *   - Enter calls preventDefault before selecting. This lives inside the pitch
 *     form, and without it choosing an option submits the pitch.
 *   - Options commit on mousedown, not click. Click loses the race against the
 *     blur that closes the list, so the row is gone before the click lands.
 *   - Escape stops propagation only while the list is open, so it closes the
 *     list without also dismissing a surrounding dialog — but still reaches that
 *     dialog once the list is shut.
 */

import { useState } from "react";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  /** Also the id the caller's <label htmlFor> points at. */
  id: string;
  options: ComboboxOption[];
  /** The selected option's value, or "" for none. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Supplying this adds a final row that creates a new option. */
  onCreate?: (query: string) => void;
  createLabel?: (query: string) => string;
  emptyMessage?: string;
}

export default function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  onCreate,
  createLabel = (query) => (query ? `Add "${query}"` : "Add new"),
  emptyMessage = "No matches",
}: ComboboxProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  /**
   * The text the user has typed, or null for "hasn't typed since opening".
   * Null is what makes Escape cheap: dropping back to null reverts the visible
   * text to the selected label without touching the selection.
   */
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const listId = `${id}-listbox`;

  const selected = options.find((option) => option.value === value) ?? null;
  const text = query ?? selected?.label ?? "";

  const needle = (query ?? "").trim().toLowerCase();
  const matches = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options;

  // The create row is always last and always present when offered — the common
  // case is a near-duplicate existing ("Rozetta Institute" when the user needs
  // "Rozetta Institute (NSW)"), so hiding it on a match would hide it exactly
  // when it is wanted.
  const rowCount = matches.length + (onCreate ? 1 : 0);
  const createIndex = onCreate ? matches.length : -1;
  const optionId = (index: number) => `${id}-option-${String(index)}`;

  function show(): void {
    if (disabled) return;
    setOpen(true);
    setHighlight(0);
  }

  function close(): void {
    setOpen(false);
    setQuery(null);
  }

  function commit(index: number): void {
    if (index === createIndex) {
      onCreate?.((query ?? "").trim());
      close();
      return;
    }
    // A bounds check rather than a truthiness check on the element: Enter on an
    // empty list with no create row reaches this with nothing to take, and the
    // compiler does not model index access as possibly-undefined.
    if (index < 0 || index >= matches.length) return;
    onChange(matches[index].value);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        show();
        return;
      }
      setHighlight((prev) => (rowCount ? (prev + 1) % rowCount : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        show();
        return;
      }
      setHighlight((prev) => (rowCount ? (prev - 1 + rowCount) % rowCount : 0));
      return;
    }
    if (e.key === "Enter") {
      // Unconditional while open: even with nothing to commit, Enter must not
      // reach the surrounding form.
      if (open) {
        e.preventDefault();
        commit(highlight);
      }
      return;
    }
    if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        close();
      }
      return;
    }
    if (e.key === "Tab") {
      close();
    }
  }

  const inputClass =
    className ??
    "w-full border border-navy-200 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300 disabled:bg-navy-50 disabled:text-navy-400";

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && rowCount ? optionId(highlight) : undefined
        }
        autoComplete="off"
        disabled={disabled}
        value={text}
        placeholder={placeholder}
        className={inputClass}
        onFocus={show}
        onMouseDown={show}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
        // Safe to close synchronously: a row's mousedown calls preventDefault,
        // so focus never leaves the input and this does not fire on selection.
        onBlur={close}
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-60 overflow-auto bg-white border border-navy-200 rounded-lg shadow-lg py-1 text-sm"
        >
          {matches.map((option, index) => (
            <li
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={index === highlight}
              onMouseDown={(e) => {
                // Keep focus on the input so the blur-close never races us.
                e.preventDefault();
                commit(index);
              }}
              onMouseEnter={() => {
                setHighlight(index);
              }}
              className={`px-3 py-2 cursor-pointer ${
                index === highlight
                  ? "bg-navy-50 text-navy-900"
                  : "text-navy-700"
              }`}
            >
              {option.label}
            </li>
          ))}

          {!matches.length && !onCreate && (
            <li className="px-3 py-2 text-navy-400">{emptyMessage}</li>
          )}

          {onCreate && (
            <li
              id={optionId(createIndex)}
              role="option"
              aria-selected={createIndex === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(createIndex);
              }}
              onMouseEnter={() => {
                setHighlight(createIndex);
              }}
              className={`px-3 py-2 cursor-pointer font-medium border-t border-navy-100 ${
                createIndex === highlight
                  ? "bg-teal-50 text-teal-800"
                  : "text-teal-700"
              }`}
            >
              {createLabel((query ?? "").trim())}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
