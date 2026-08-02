import type { Player } from "@pkpkdupr/shared/player";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  VITEST: process.env.VITEST,
  USER_AUTH_PROVIDER: process.env.USER_AUTH_PROVIDER,
};

const restoreEnvironment = () => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

const admin: Player = {
  id: "Padmin",
  username: "admin",
  gender: "M",
  status: "active",
  duprRating: null,
  createdAt: new Date("2026-08-02T00:00:00.000Z"),
  updatedAt: new Date("2026-08-02T00:00:00.000Z"),
};

describe("PKELO auth provider routes", () => {
  afterEach(() => {
    restoreEnvironment();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("PKELO 일반 비밀번호 로그인은 차단하고 관리자 로그인만 허용한다", async () => {
    process.env.NODE_ENV = "development";
    process.env.VITEST = "true";
    process.env.USER_AUTH_PROVIDER = "kakao-mock";
    vi.resetModules();

    const { PasswordAuthService } = await import("../services/PasswordAuthService");
    const adminLogin = vi
      .spyOn(PasswordAuthService.prototype, "loginAdmin")
      .mockResolvedValue({
        accessToken: "admin-token",
        isFirstLogin: false,
        isAdmin: true,
      });
    vi.spyOn(PasswordAuthService.prototype, "initAdmin").mockResolvedValue(admin);
    const { app } = await import("../index");

    const userLogin = await request(app)
      .post("/api/login")
      .send({ username: "user", password: "password" });
    expect(userLogin.status).toBe(404);
    expect(userLogin.body.error).toContain("Kakao");

    const administratorLogin = await request(app)
      .post("/api/admin/login")
      .send({ username: "admin", password: "admin-password" });
    expect(administratorLogin.status).toBe(200);
    expect(administratorLogin.body).toMatchObject({
      accessToken: "admin-token",
      isAdmin: true,
    });
    expect(adminLogin).toHaveBeenCalledWith("admin", "admin-password");
  });

  it("Kakao 계정은 비밀번호 변경 API를 사용할 수 없다", async () => {
    process.env.NODE_ENV = "development";
    process.env.VITEST = "true";
    process.env.USER_AUTH_PROVIDER = "kakao-mock";
    vi.resetModules();

    const { AuthService } = await import("../services/AuthService");
    const { PasswordAuthService } = await import("../services/PasswordAuthService");
    vi.spyOn(AuthService.prototype, "authenticateAccessToken").mockResolvedValue({
      payload: { playerId: "Pkakao", authProvider: "kakao-mock" },
      player: { ...admin, id: "Pkakao", username: "kakao-player" },
      isFirstLogin: false,
    });
    const changePassword = vi.spyOn(PasswordAuthService.prototype, "changePassword");
    const { app } = await import("../index");

    const response = await request(app)
      .post("/api/change-password")
      .set("Authorization", "Bearer kakao-token")
      .send({ newPassword: "next-password" });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain("Kakao");
    expect(changePassword).not.toHaveBeenCalled();
  });
});
