import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  VITEST: process.env.VITEST,
  DOMAIN: process.env.DOMAIN,
  WEB_PUBLIC_PORT: process.env.WEB_PUBLIC_PORT,
  ADMIN_STACK_PORT: process.env.ADMIN_STACK_PORT,
  CORS_ADDITIONAL_ORIGINS: process.env.CORS_ADDITIONAL_ORIGINS,
  DEV_CORS_ORIGINS: process.env.DEV_CORS_ORIGINS,
};

const restoreEnvironment = () => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

describe("production CORS origin isolation", () => {
  afterEach(() => {
    restoreEnvironment();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("현재 앱 도메인 web/admin origin만 허용하고 다른 도메인은 거부한다", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.env.NODE_ENV = "production";
    process.env.VITEST = "true";
    process.env.DOMAIN = "pkelo.app";
    process.env.WEB_PUBLIC_PORT = "443";
    process.env.ADMIN_STACK_PORT = "3333";
    process.env.CORS_ADDITIONAL_ORIGINS = "";
    vi.resetModules();

    const { app } = await import("../index");

    const webOriginResponse = await request(app)
      .get("/api/health")
      .set("Origin", "https://pkelo.app");
    expect(webOriginResponse.status).toBe(200);
    expect(webOriginResponse.headers["access-control-allow-origin"]).toBe(
      "https://pkelo.app",
    );

    const adminOriginResponse = await request(app)
      .get("/api/health")
      .set("Origin", "https://pkelo.app:3333");
    expect(adminOriginResponse.status).toBe(200);
    expect(adminOriginResponse.headers["access-control-allow-origin"]).toBe(
      "https://pkelo.app:3333",
    );

    const rejectedOriginResponse = await request(app)
      .get("/api/health")
      .set("Origin", "https://untrusted.example");
    expect(rejectedOriginResponse.status).toBe(500);
    expect(
      rejectedOriginResponse.headers["access-control-allow-origin"],
    ).toBeUndefined();

    const localhostResponse = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:8080");
    expect(localhostResponse.status).toBe(500);
    expect(localhostResponse.headers["access-control-allow-origin"]).toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });
});

describe("development CORS origin isolation", () => {
  afterEach(() => {
    restoreEnvironment();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("PKELO 개발 호스트만 허용하도록 별도 origin 목록을 적용한다", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.env.NODE_ENV = "development";
    process.env.VITEST = "true";
    process.env.DOMAIN = "pkelo.localhost";
    process.env.DEV_CORS_ORIGINS =
      "http://pkelo.localhost:8081,http://pkelo.localhost:3101";
    vi.resetModules();

    const { app } = await import("../index");

    const webOriginResponse = await request(app)
      .get("/api/health")
      .set("Origin", "http://pkelo.localhost:8081");
    expect(webOriginResponse.status).toBe(200);
    expect(webOriginResponse.headers["access-control-allow-origin"]).toBe(
      "http://pkelo.localhost:8081",
    );

    const primaryOriginResponse = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:8080");
    expect(primaryOriginResponse.status).toBe(500);
    expect(primaryOriginResponse.headers["access-control-allow-origin"]).toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
