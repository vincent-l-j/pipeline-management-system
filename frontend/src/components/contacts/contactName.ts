/**
 * How a contact is written when only a name will do.
 *
 * Both name parts are optional — an email or an organisation is enough to
 * identify a contact — so this has to have an answer for a row with neither.
 */

interface NamedContact {
  first_name: string | null;
  last_name: string | null;
}

export function contactName(contact: NamedContact): string {
  const name = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ");
  return name || "Unnamed contact";
}
