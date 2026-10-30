import "@testing-library/jest-dom";

// jsdom has no layout, so it leaves scrollIntoView unimplemented; a component
// that scrolls itself into view would otherwise throw. The browser suite
// asserts where things land.
Element.prototype.scrollIntoView = function scrollIntoView() {
  // Nothing to scroll without a layout.
};
