/**
 * A labelled native <select> over a list of value/label pairs.
 *
 * Several files grew their own copy of the same twenty lines — a wrapper div, a
 * label, a select, a blank first option and a map — differing only in id, label,
 * placeholder and options. This is that shape, once.
 *
 * Native rather than the Combobox next door: these are short, fixed vocabularies
 * where a search box is overhead, and a native select gets the platform's own
 * keyboard handling and mobile picker for free.
 *
 * It renders the field and nothing else. Help text, error text and any wrapper
 * spacing stay with the caller, where the layout decisions already live — the
 * pitch form does the same around its organisation picker.
 */

import { inputClass, labelClass } from "./formStyles";

export interface SelectOption {
  value: string;
  label: string;
}

interface OptionSelectProps {
  /** Also the id the rendered <label htmlFor> points at. */
  id: string;
  label: string;
  options: readonly SelectOption[];
  /** The selected option's value, or "" for none. */
  value: string;
  onChange: (value: string) => void;
  /**
   * Text for a blank first option. Omit it where the field always holds a real
   * value, so there is no empty state to offer.
   */
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function OptionSelect({
  id,
  label,
  options,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
}: OptionSelectProps): React.JSX.Element {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className={inputClass}
      >
        {/* Checked against undefined, not truthiness: an empty placeholder would
            otherwise render as a blank child and drop the option entirely. */}
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
