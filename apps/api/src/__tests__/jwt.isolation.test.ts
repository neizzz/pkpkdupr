import { afterEach, describe, expect, it, vi } from "vitest";

const originalJwtSecret = process.env.JWT_SECRET;

afterEach(() => {
  if (originalJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalJwtSecret;
  }
  vi.resetModules();
});

describe("JWT secret isolation", () => {
  it("한 앱의 access token은 다른 JWT_SECRET으로 검증되지 않는다", async () => {
    process.env.JWT_SECRET = "pkpkdupr-test-secret";
    vi.resetModules();
    const primaryJwt = await import("../config/jwt");
    const primaryToken = primaryJwt.createAccessToken({ playerId: "player-primary" });

    process.env.JWT_SECRET = "pkelo-test-secret";
    vi.resetModules();
    const pkeloJwt = await import("../config/jwt");

    expect(pkeloJwt.decodeToken(primaryToken)).toBeNull();
  });
});
