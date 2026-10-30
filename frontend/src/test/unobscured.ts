/**
 * Whether a user can read an element where it is, without scrolling: its box
 * lies inside the viewport and nothing is painted over it — no sticky app bar
 * above it, no pinned save bar below it. Browser suite only; jsdom has no
 * layout, so every answer there would be vacuous.
 */
export function unobscured(element: Element): {
  inViewport: boolean;
  onTop: boolean;
} {
  const { top, bottom, left, right } = element.getBoundingClientRect();
  const inViewport =
    top >= 0 &&
    left >= 0 &&
    bottom <= window.innerHeight &&
    right <= window.innerWidth;

  // Inset past a rounded corner, which hit-testing honours, and past a
  // neighbour's border, so neither answers for the element.
  const probes: [number, number][] = [
    [left + 10, top + 10],
    [right - 10, top + 10],
    [(left + right) / 2, (top + bottom) / 2],
    [left + 10, bottom - 10],
    [right - 10, bottom - 10],
  ];
  const onTop = probes.every(([x, y]) => {
    const hit = document.elementFromPoint(x, y);
    return hit !== null && element.contains(hit);
  });

  return { inViewport, onTop };
}
