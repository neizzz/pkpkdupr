import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

type FontSizePreference = "default" | "large" | null;

const player = {
  id: "Pfontsizevisual",
  username: "큰 글씨 사용자",
  gender: "F",
  age: 42,
  duprRating: null,
  affiliations: [],
  status: "active",
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
  isFirstLogin: false,
  privacyPolicyConsentVersion: "2026-08-31",
};

const fulfillJson = (route: Route, body: unknown) =>
  route.fulfill({
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body),
  });

const installFixture = async (
  page: Page,
  fontSizePreference: FontSizePreference,
) => {
  await page.clock.install({ time: new Date("2026-08-31T12:00:00+09:00") });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/runtime-notice") {
      return fulfillJson(route, { enabled: false });
    }
    if (path === "/api/auth/session") {
      return fulfillJson(route, {
        authenticated: true,
        player: { ...player, fontSizePreference },
      });
    }
    if (path === "/api/me") {
      return fulfillJson(route, { ...player, fontSizePreference });
    }
    if (path === "/api/players") {
      return fulfillJson(route, []);
    }
    if (path === "/api/clubs") {
      return fulfillJson(route, []);
    }
    if (path === "/api/match-feed") {
      return fulfillJson(route, { items: [], total: 0 });
    }
    return fulfillJson(route, {});
  });
};

const capture = async (page: Page, name: string) => {
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(name, {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
  });
};

const expectButtonTextToFit = async (button: Locator) => {
  await expect(button).toHaveCSS("white-space", "nowrap");
  await expect
    .poll(() =>
      button.evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true);
};

test("첫 진입 모달에서 큰 글씨를 미리 본다", async ({ page }) => {
  await installFixture(page, null);
  await page.goto("/");

  const dialog = page.getByRole("dialog", { name: "글자 크기 설정" });
  await expect(dialog).toBeVisible();
  await expectButtonTextToFit(
    dialog.getByRole("button", { name: "적용하기" }),
  );
  const defaultOption = dialog.locator("label", {
    hasText: "기본 글자 크기",
  });
  const largeOption = dialog.locator("label", {
    hasText: "기본보다 30% 크게",
  });
  const [defaultOptionFontSize, largeOptionFontSize] = await Promise.all([
    defaultOption.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    ),
    largeOption.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    ),
  ]);
  expect(largeOptionFontSize / defaultOptionFontSize).toBeCloseTo(1.3, 2);

  await dialog.getByText("기본", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-font-size", "default");
  await capture(page, "default--first-entry-modal.png");

  await dialog.getByText("크게", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-font-size", "large");
  await capture(page, "large--first-entry-modal.png");
});

test("큰 글씨 플레이어와 설정 화면", async ({ page }) => {
  await installFixture(page, "large");
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Players" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-font-size", "large");
  await expect(page.getByText("현재 표시할 친구가 없어요.")).toBeVisible();
  const largeMetrics = await page.getByRole("heading", { name: "Players" }).evaluate(
    (heading) => ({
      fontSize: Number.parseFloat(getComputedStyle(heading).fontSize),
      iconWidth: Number.parseFloat(
        getComputedStyle(
          document.querySelector('[aria-label="친구 추가"] svg')!,
        ).width,
      ),
    }),
  );
  await page.locator("html").evaluate((html) => {
    html.dataset.fontSize = "default";
  });
  const defaultMetrics = await page.getByRole("heading", { name: "Players" }).evaluate(
    (heading) => ({
      fontSize: Number.parseFloat(getComputedStyle(heading).fontSize),
      iconWidth: Number.parseFloat(
        getComputedStyle(
          document.querySelector('[aria-label="친구 추가"] svg')!,
        ).width,
      ),
    }),
  );
  expect(largeMetrics.fontSize / defaultMetrics.fontSize).toBeCloseTo(1.3, 2);
  expect(largeMetrics.iconWidth).toBe(defaultMetrics.iconWidth);
  await page.locator("html").evaluate((html) => {
    html.dataset.fontSize = "large";
  });
  await capture(page, "large--players-empty.png");

  await page.getByRole("tab", { name: "설정" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("크게", { exact: true })).toBeVisible();
  await capture(page, "large--settings.png");

  await page.getByRole("button", { name: /글자 크기.*크게/ }).click();
  const dialog = page.getByRole("dialog", { name: "글자 크기 설정" });
  await dialog.getByText("기본", { exact: true }).first().click();
  await expect(page.locator("html")).toHaveAttribute("data-font-size", "default");
  await dialog.getByRole("button", { name: "글자 크기 설정 닫기" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-font-size", "large");
});
