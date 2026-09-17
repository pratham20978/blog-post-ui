import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("web liveness route", () => {
  it("answers without rendering layouts or contacting dependencies", () => {
    const response = GET();
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
