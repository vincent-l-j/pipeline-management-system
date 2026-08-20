/**
 * What the text typed into a contact picker says about the person meant by it.
 *
 * A picker's create row is reached by typing a name that isn't on file, so that
 * text is the best guess at the new contact and retyping it would be the whole
 * cost of the detour. Every field of a contact is optional, so a guess that is
 * only partly right costs nothing — the dialog it seeds is editable.
 *
 * An address is recognised rather than shoved into `first_name`: people search
 * these pickers by email as readily as by name, and "jane@example.com" as a
 * first name would be saved as one.
 */

/** The identifying fields a quick-create dialog can be seeded with. */
export interface QuickContactFields {
  first_name: string;
  last_name: string;
  email: string;
}

/** No whitespace and one @ with something either side — deliberately loose,
 *  since the API validates the address and reports back. */
const EMAIL_LIKE = /^[^\s@]+@[^\s@]+$/;

export function contactFromQuery(query: string): QuickContactFields {
  const text = query.trim();
  if (EMAIL_LIKE.test(text)) {
    return { first_name: "", last_name: "", email: text };
  }
  // Everything after the first gap is the surname: "van der Berg" is one name,
  // and a middle name is likelier to belong with the last than the first.
  const [first, ...rest] = text.split(/\s+/);
  return { first_name: first, last_name: rest.join(" "), email: "" };
}
