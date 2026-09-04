import { beforeEach, describe, expect, it } from "vitest";

import { getDevUserId } from "@/lib/api";

describe("getDevUserId", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("generates and persists an id on first call", () => {
    const id = getDevUserId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(window.localStorage.getItem("audiotutor_dev_user_id")).toBe(id);
  });

  it("returns the same id on subsequent calls", () => {
    const first = getDevUserId();
    const second = getDevUserId();
    expect(second).toBe(first);
  });

  it("reuses an id already present in localStorage", () => {
    window.localStorage.setItem("audiotutor_dev_user_id", "existing-id");
    expect(getDevUserId()).toBe("existing-id");
  });
});
