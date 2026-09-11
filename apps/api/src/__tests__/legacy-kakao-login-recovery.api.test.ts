import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../index";

describe("legacy Kakao login recovery", () => {
  it("구형 PWA 로그인 경로는 OAuth를 시작하지 않고 캐시 복구 문서를 반환한다", async () => {
    const response = await request(app).get("/auth/kakao/login");

    expect(response.status).toBe(410);
    expect(response.headers["content-type"]).toMatch(/^text\/html/);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.headers["clear-site-data"]).toBe('"cache"');
    expect(response.text).toContain("navigator.serviceWorker");
    expect(response.text).toContain("caches.delete");
    expect(response.text).toContain("/login?recovery=legacy-pwa");
    expect(response.text).not.toContain("kakaoAuthService.start");
  });
});
