import { describe, it, expect } from "vitest";
import { contactFromQuery } from "../quickContact";

describe("contactFromQuery", () => {
  it("splits a typed name into its two parts", () => {
    expect(contactFromQuery("Jane Doe")).toEqual({
      first_name: "Jane",
      last_name: "Doe",
      email: "",
    });
  });

  it("keeps a multi-word surname together", () => {
    expect(contactFromQuery("Ada van der Berg")).toEqual({
      first_name: "Ada",
      last_name: "van der Berg",
      email: "",
    });
  });

  it("reads a single word as a first name", () => {
    expect(contactFromQuery("Mononym")).toEqual({
      first_name: "Mononym",
      last_name: "",
      email: "",
    });
  });

  it("reads an email address as an email, not a name", () => {
    expect(contactFromQuery("jane@example.com")).toEqual({
      first_name: "",
      last_name: "",
      email: "jane@example.com",
    });
  });

  it("ignores surrounding and repeated whitespace", () => {
    expect(contactFromQuery("  Jane   Doe  ")).toEqual({
      first_name: "Jane",
      last_name: "Doe",
      email: "",
    });
  });

  it("has an answer for an empty query", () => {
    expect(contactFromQuery("")).toEqual({
      first_name: "",
      last_name: "",
      email: "",
    });
    expect(contactFromQuery("   ")).toEqual({
      first_name: "",
      last_name: "",
      email: "",
    });
  });
});
