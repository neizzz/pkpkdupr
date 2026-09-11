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

test("로그인 전 standalone PWA에서도 대기 중인 업데이트를 안내한다", async ({ page }) => {
  await page.addInitScript(() => {
    const controllerChangeListeners = new Set<() => void>();
    const registration = {
      installing: null,
      waiting: {
        postMessage: () => {
          queueMicrotask(() => {
            controllerChangeListeners.forEach((listener) => listener());
          });
        },
      },
      unregister: async () => true,
      update: async () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    const serviceWorker = {
      controller: {},
      ready: Promise.resolve(registration),
      register: async () => registration,
      getRegistration: async () => registration,
      getRegistrations: async () => [registration],
      addEventListener: (type: string, listener: () => void) => {
        if (type === "controllerchange") controllerChangeListeners.add(listener);
      },
      removeEventListener: (type: string, listener: () => void) => {
        if (type === "controllerchange") controllerChangeListeners.delete(listener);
      },
    };

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: serviceWorker,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: query === "(display-mode: standalone)",
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  });
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ authenticated: false }) }),
  );

  await page.goto("http://pkelo.localhost:4173/login");

  await expect(page.getByRole("button", { name: "카카오 로그인" })).toBeVisible();
  await expect(page.getByText("새 버전이 있어요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "업데이트" })).toBeVisible();
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

test("로그인 오류를 화면 상단 prompt로 표시하고 닫을 수 있다", async ({ page }) => {
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ authenticated: false }) }),
  );

  await page.goto("http://pkelo.localhost:4173/login");
  const brand = page.getByAltText("PKELO 피클볼 로고");
  const brandPosition = await brand.boundingBox();

  await page.goto("http://pkelo.localhost:4173/login?error=kakao_login_failed");
  const alert = page.getByRole("alert");
  await expect(alert.locator("svg").first().locator("..")).toHaveClass(/text-error/);
  await expect(alert.getByText("로그인을 완료하지 못했어요.")).toHaveClass(/text-error/);
  await expect(alert).toContainText("카카오 로그인을 완료하지 못했습니다. 다시 시도해주세요.");
  await expect.poll(async () => (await alert.boundingBox())?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(40);
  await expect.poll(async () => (await brand.boundingBox())?.y).toBe(brandPosition?.y);

  await page.getByRole("button", { name: "로그인 오류 닫기" }).click();
  await expect(alert).toBeHidden();

  await page.route("**/api/auth/kakao/start", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "카카오 로그인 점검 중입니다." }),
    }),
  );
  await page.getByRole("button", { name: "카카오 로그인" }).click();
  await expect(alert).toContainText("카카오 로그인 점검 중입니다.");
  await page.getByRole("button", { name: "로그인 오류 닫기" }).click();
  await expect(alert).toBeHidden();
});

test("신규 카카오 사용자는 PKELO 프로필을 만든 뒤 세션으로 메인에 이동한다", async ({ page }) => {
  let onboardingCompleted = false;
  let fontSizePreference: "default" | "large" | null = null;
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        onboardingCompleted
          ? {
              authenticated: true,
              player: {
                id: "player-new-kakao",
                username: "신규 사용자",
                gender: "F",
                age: 35,
                isFirstLogin: false,
                fontSizePreference,
                privacyPolicyConsentVersion: "2026-08-31",
              },
            }
          : { authenticated: false },
      ),
    }),
  );
  await page.route("**/api/auth/kakao/exchange", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ status: "onboarding", registrationTicket: "registration-ticket" }),
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
        fontSizePreference,
        privacyPolicyConsentVersion: "2026-08-31",
      }),
    }),
  );
  await page.route("**/api/auth/kakao/onboarding", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      registrationTicket: "registration-ticket",
      username: "신규 사용자",
      gender: "F",
    });
    onboardingCompleted = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ status: "authenticated", isFirstLogin: false }),
    });
  });
  await page.route("**/api/me/preferences", async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toEqual({ fontSizePreference: "large" });
    fontSizePreference = "large";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ fontSizePreference }),
    });
  });

  await page.goto("http://pkelo.localhost:4173/login/kakao/callback#ticket=handoff-ticket");
  await expect(page.getByRole("heading", { name: "PKELO 프로필 만들기" })).toBeVisible();
  await expect(page.getByText("프로필 이미지 (선택)")).toHaveCount(0);
  const submitButton = page.getByRole("button", { name: "프로필 만들기" });
  await expect(submitButton).toBeDisabled();
  await page.getByLabel(/이름/).fill("신규");
  await expect(submitButton).toBeDisabled();
  await page.getByLabel(/이름/).fill("신");
  await page.getByText("여성", { exact: true }).click();
  await expect(submitButton).toBeDisabled();
  await page.getByLabel(/이름/).fill("신규 사용자");
  await expect(submitButton).toBeEnabled();
  await submitButton.click();
  await expect(page).toHaveURL("http://pkelo.localhost:4173/");
  const fontSizeDialog = page.getByRole("dialog", { name: "글자 크기 설정" });
  await expect(fontSizeDialog).toBeVisible();
  await expect(page.getByRole("button", { name: "글자 크기 설정 닫기" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(fontSizeDialog).toBeVisible();

  await fontSizeDialog.getByText("크게", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-font-size", "large");
  await fontSizeDialog.getByRole("button", { name: "적용하기" }).click();
  await expect(fontSizeDialog).toBeHidden();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-font-size", "large");
  await expect(fontSizeDialog).toHaveCount(0);
});
