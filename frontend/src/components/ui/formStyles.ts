/**
 * The shared form-field treatment.
 *
 * These two strings were copy-pasted into every page that renders a field;
 * keeping them here means a change to the input treatment lands in one place.
 * Several files still hold their own copy — this is where they should converge.
 */

export const inputClass =
  "w-full border border-navy-200 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300 disabled:bg-navy-50 disabled:text-navy-400";

export const labelClass = "block text-sm font-medium text-navy-700 mb-1";
