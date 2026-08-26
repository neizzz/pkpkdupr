import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.route("**/api/runtime-notice", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ enabled: false }),
    }),
  );
});

test("익명 부트스트랩은 /api/me 호출 없이 로그인 화면을 표시한다", async ({ page }) => {
  let meRequested = false;
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ authenticated: false }) }),
  );
  await page.route("**/api/me", (route) => {
    meRequested = true;
    return route.fulfill({ status: 401, body: JSON.stringify({ code: "SESSION_INVALID" }) });
  });

  await page.goto("http://pkelo.localhost:4173/login");
  await expect(page.getByRole("button", { name: "카카오 로그인" })).toBeVisible();
  expect(meRequested).toBe(false);
});

test("카카오 로그인 시작 요청에 자동 로그인 유지 여부를 보낸다", async ({ page }) => {
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ authenticated: false }) }),
  );
  await page.route("**/api/auth/kakao/start", async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toEqual({ persist: true });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ redirectUrl: "/auth/kakao/callback?mock=1" }),
    });
  });

  await page.goto("http://pkelo.localhost:4173/login");
  await page.getByRole("checkbox", { name: "자동 로그인" }).check();
  await page.getByRole("button", { name: "카카오 로그인" }).click();
  await expect(page).toHaveURL(/\/auth\/kakao\/callback\?mock=1$/);
});

test("자동 로그인 한 대 제한 안내를 툴팁으로 표시한다", async ({ page }) => {
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ authenticated: false }) }),
  );

  await page.goto("http://pkelo.localhost:4173/login");
  await page.getByRole("button", { name: "메인 기기 한 대 제한 안내 보기" }).click();
  await expect(
    page.getByText("자동 로그인은 한 대의 메인 기기에서만 유지됩니다."),
  ).toBeVisible();
});

test("신규 카카오 사용자는 자동 가입 뒤 세션으로 메인에 이동한다", async ({ page }) => {
  let sessionCall = 0;
  await page.route("**/api/auth/session", (route) => {
    sessionCall += 1;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        sessionCall === 1
          ? { authenticated: false }
          : {
              authenticated: true,
              player: {
                id: "player-new-kakao",
                username: "신규 사용자",
                gender: "F",
                age: 35,
                isFirstLogin: false,
                privacyPolicyConsentVersion: "2026-08-26",
              },
            },
      ),
    });
  });
  await page.route("**/api/auth/kakao/exchange", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ status: "authenticated", isFirstLogin: false }),
    }),
  );
  await page.route("**/api/me", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "player-new-kakao",
        username: "신규 사용자",
        gender: "F",
        age: 35,
        isFirstLogin: false,
        privacyPolicyConsentVersion: "2026-08-26",
      }),
    }),
  );

  await page.goto("http://pkelo.localhost:4173/login/kakao/callback#ticket=handoff-ticket");
  await expect(page).toHaveURL("http://pkelo.localhost:4173/");
});
