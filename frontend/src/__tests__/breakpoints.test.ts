import { describe, it, expect } from "vitest";
import resolveConfig from "tailwindcss/resolveConfig";
import tailwindConfig from "../../tailwind.config";
import { MD_MIN_WIDTH_PX } from "../breakpoints";

describe("MD_MIN_WIDTH_PX", () => {
  it("is the width Tailwind's md: classes start at", () => {
    const { screens } = resolveConfig(tailwindConfig).theme;

    expect(screens.md).toBe(`${String(MD_MIN_WIDTH_PX)}px`);
  });
});
