import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

const privacyPolicyVersion = "2026-08-31";
type VisualFontSizePreference = "default" | "large";
const visualFontSizePreferences: VisualFontSizePreference[] = [
  "default",
  "large",
];
let activeVisualFontSizePreference: VisualFontSizePreference = "default";

type FixtureOptions = {
  authenticated?: boolean;
  clubEmpty?: boolean;
  clubSessionEmpty?: boolean;
  clubRole?: "owner" | "manager" | "member";
  historyEmpty?: boolean;
  longProfileName?: boolean;
  matchFeedEmpty?: boolean;
  matchScenario?: "default" | "result-entry" | "result-rejection";
  memberEmpty?: boolean;
  profileEmpty?: boolean;
  privacyPolicyConsentVersion?: string | null;
  qrError?: boolean;
  sessionEmpty?: boolean;
  useFixedClock?: boolean;
  withdrawalBlocked?: boolean;
  withdrawalBlockerCopies?: number;
  withdrawalEligibilityGate?: Promise<void>;
  withdrawalTracker?: { confirmations: string[] };
};

const fixedNow = new Date("2026-08-13T10:00:00.000+09:00");
const avatar = (label: string, color: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="58%" text-anchor="middle" font-size="42" fill="white">${label}</text></svg>`,
  )}`;

const me = {
  id: "player-me",
  username: "김하늘",
  gender: "F",
  birthDate: "1990-08-01",
  age: 36,
  status: "active",
  duprRating: { singles: 3.88, doubles: 4.12 },
  avatarUrl: avatar("하", "#2563eb"),
  affiliations: [
    { name: "한강 피클볼", isPrimary: true },
    { name: "주말 레슨", isPrimary: false },
  ],
  statusMessage: "오늘도 즐겁게",
  statusMessageBackgroundColor: "#0EA5E9",
  authProvider: "password",
  privacyPolicyConsentVersion: "2026-08-25",
  isFirstLogin: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-08-12T00:00:00.000Z",
};

const jiwoo = {
  id: "player-jiwoo",
  username: "박지우",
  gender: "F",
  birthDate: "1994-08-20",
  age: 31,
  status: "active",
  duprRating: { singles: 3.64, doubles: 3.92 },
  avatarUrl: avatar("지", "#db2777"),
  affiliations: [{ name: "한강 피클볼", isPrimary: true }],
  statusMessage: "복식 연습 중",
  statusMessageBackgroundColor: "#a855f7",
  lastPlayedAt: "2026-08-12T11:30:00.000Z",
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-08-12T00:00:00.000Z",
};

const minsu = {
  id: "player-minsu",
  username: "이민수",
  gender: "M",
  birthDate: "1988-02-14",
  status: "active",
  duprRating: { singles: 4.18, doubles: 4.05 },
  avatarUrl: avatar("민", "#059669"),
  affiliations: [{ name: "한강 피클볼", isPrimary: true }],
  statusMessage: "저녁 경기 가능",
  statusMessageBackgroundColor: "#f97316",
  lastPlayedAt: "2026-08-11T09:15:00.000Z",
  createdAt: "2026-01-03T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
};

const seojoon = {
  id: "player-seojoon",
  username: "최서준",
  gender: "M",
  birthDate: "1992-11-30",
  status: "active",
  duprRating: { singles: 3.42, doubles: 3.68 },
  avatarUrl: avatar("준", "#7c3aed"),
  affiliations: [{ name: "한강 피클볼", isPrimary: true }],
  createdAt: "2026-01-04T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
};

const primaryMatch = {
  id: "match-1",
  type: "mixed-doubles",
  mode: "best-of-3",
  source: "player_created",
  creatorPlayerId: me.id,
  name: "테스트 복식 매치",
  affiliationNames: ["한강 피클볼"],
  status: "completed",
  teams: [
    { id: "team-a", name: "블루팀", players: [me, jiwoo] },
    { id: "team-b", name: "그린팀", players: [minsu, seojoon] },
  ],
  scores: [
    { scoreA: 11, scoreB: 8 },
    { scoreA: 8, scoreB: 11 },
    { scoreA: 11, scoreB: 9 },
  ],
  resultSubmittedByPlayerId: me.id,
  resultSubmittedAt: "2026-08-10T10:15:00.000Z",
  autoApprovalDueAt: null,
  approvals: [
    { playerId: me.id, approvedAt: "2026-08-10T10:20:00.000Z" },
    { playerId: jiwoo.id, approvedAt: "2026-08-10T10:21:00.000Z" },
  ],
  location: "한강 스포츠센터",
  courtName: "A 코트",
  matchStartsAt: "2026-08-10T10:00:00.000Z",
  createdAt: "2026-08-09T00:00:00.000Z",
  completedAt: "2026-08-10T11:00:00.000Z",
  updatedAt: "2026-08-10T11:00:00.000Z",
  ratingChanges: [
    {
      id: "rating-change-1",
      playerId: me.id,
      source: "match_completed",
      sourceLogId: "match-1",
      previousRating: { singles: 3.86, doubles: 4.06 },
      nextRating: { singles: 3.88, doubles: 4.12 },
      delta: { singles: 0.02, doubles: 0.06 },
      createdAt: "2026-08-10T11:00:00.000Z",
    },
  ],
};

const matchForScenario = (scenario: FixtureOptions["matchScenario"] = "default") => {
  if (scenario === "result-entry") {
    return {
      ...primaryMatch,
      status: "created",
      scores: [],
      resultSubmittedByPlayerId: null,
      resultSubmittedAt: null,
      approvals: [],
      completedAt: null,
      ratingChanges: [],
    };
  }

  if (scenario === "result-rejection") {
    return {
      ...primaryMatch,
      status: "pending-approval",
      approvals: [],
      completedAt: null,
      ratingChanges: [],
    };
  }

  return primaryMatch;
};

const secondaryMatch = {
  ...primaryMatch,
  id: "match-2",
  name: "아침 싱글 매치",
  type: "singles",
  mode: "single-game",
  teams: [
    { id: "team-c", name: "하늘", players: [me] },
    { id: "team-d", name: "민수", players: [minsu] },
  ],
  scores: [{ scoreA: 11, scoreB: 7 }],
  matchStartsAt: "2026-08-08T08:30:00.000Z",
  completedAt: "2026-08-08T09:00:00.000Z",
};

const session = {
  id: "session-1",
  name: "토요 오픈플레이",
  date: "2026-08-15T10:00:00.000Z",
  location: "한강 스포츠센터",
  clubId: "club-1",
  affiliationNames: ["한강 피클볼"],
  status: "created",
  matchCount: 3,
  participants: [me, jiwoo, minsu].map(({ id, username, avatarUrl }) => ({
    id,
    username,
    avatarUrl,
  })),
  latestCreatedAt: "2026-08-12T11:00:00.000Z",
};

const profileSummary = (empty = false) => ({
  matchStats: {
    singles: empty
      ? { matchWins: 0, matchLosses: 0, setWins: 0, setLosses: 0 }
      : { matchWins: 8, matchLosses: 3, setWins: 9, setLosses: 4 },
    doubles: empty
      ? { matchWins: 0, matchLosses: 0, setWins: 0, setLosses: 0 }
      : { matchWins: 14, matchLosses: 6, setWins: 29, setLosses: 16 },
  },
  ratingDelta: {
    singles: empty ? { last7Days: 0, last30Days: 0 } : { last7Days: 0.03, last30Days: 0.11 },
    doubles: empty ? { last7Days: 0, last30Days: 0 } : { last7Days: 0.06, last30Days: 0.18 },
  },
  ratingHistory: {
    singles: empty
      ? []
      : [
          { rating: 3.72, createdAt: "2026-07-01T00:00:00.000Z", source: "anchor" },
          { rating: 3.88, createdAt: "2026-08-10T00:00:00.000Z", source: "current" },
        ],
    doubles: empty
      ? []
      : [
          { rating: 3.84, createdAt: "2026-07-01T00:00:00.000Z", source: "anchor" },
          { rating: 4.12, createdAt: "2026-08-10T00:00:00.000Z", source: "current" },
        ],
  },
  recentMatches: empty ? [] : [primaryMatch, secondaryMatch],
  recentMatchTotal: empty ? 0 : 4,
});

const club = {
  id: "club-1",
  name: "한강 피클볼",
  description: "함께 성장하는 주말 피클볼 클럽",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
};

const clubDashboard = (
  empty = false,
  membershipRole: NonNullable<FixtureOptions["clubRole"]> = "owner",
  sessionEmpty = false,
) => ({
  club,
  membership: {
    clubId: club.id,
    playerId: me.id,
    role: membershipRole,
    status: "active",
    requestedAt: "2026-01-01T00:00:00.000Z",
    joinedAt: "2026-01-01T00:00:00.000Z",
  },
  upcomingSessions: empty || sessionEmpty
    ? []
    : [
        {
          ...session,
          participantIds: [me.id, jiwoo.id, minsu.id],
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-12T00:00:00.000Z",
        },
      ],
  upcomingMatches: empty ? [] : [],
  recentCompletedMatches: empty ? [] : [primaryMatch, secondaryMatch],
  announcements: empty
    ? []
    : [
        {
          id: "announcement-1",
          clubId: club.id,
          title: "토요일 오픈플레이 안내",
          body: "오전 10시에 A 코트에서 만나요. https://pkelo.app/notice\nhttps://example.com/guide",
          createdByPlayerId: me.id,
          createdAt: "2026-08-12T00:00:00.000Z",
          updatedAt: "2026-08-12T00:00:00.000Z",
        },
        {
          id: "announcement-2",
          clubId: club.id,
          title: "신규 멤버 환영",
          body: "첫 참여 전에는 프로필을 확인해주세요.",
          createdByPlayerId: me.id,
          createdAt: "2026-08-11T00:00:00.000Z",
          updatedAt: "2026-08-11T00:00:00.000Z",
        },
      ],
  rankings: {
    singles: empty
      ? []
      : [
          { rank: 1, playerId: minsu.id, username: minsu.username, rating: 4.18 },
          { rank: 2, playerId: me.id, username: me.username, rating: 3.88 },
        ],
    doubles: empty
      ? []
      : [
          { rank: 1, playerId: me.id, username: me.username, rating: 4.12 },
          { rank: 2, playerId: minsu.id, username: minsu.username, rating: 4.05 },
        ],
  },
  members: [me, jiwoo, minsu].map((player, index) => ({
    id: player.id,
    username: player.username,
    avatarUrl: player.avatarUrl,
    gender: player.gender,
    role: index === 0 ? "owner" : index === 1 ? "manager" : "member",
    joinedAt: "2026-01-01T00:00:00.000Z",
  })),
});

const fulfillJson = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body),
  });

const installFixture = async (page: Page, options: FixtureOptions = {}) => {
  if (options.useFixedClock !== false) {
    await page.clock.install({ time: fixedNow });
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.addInitScript((authenticated) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    if (authenticated) {
      window.localStorage.setItem("token", "visual-snapshot-token");
    }
  }, options.authenticated !== false);
  let privacyPolicyConsentVersion =
    options.privacyPolicyConsentVersion === undefined
      ? privacyPolicyVersion
      : options.privacyPolicyConsentVersion;
  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname;
    const profile = profileSummary(options.profileEmpty);
    const match = matchForScenario(options.matchScenario);
    const clubRole = options.clubRole ?? "owner";
    const dashboard = clubDashboard(
      options.profileEmpty,
      clubRole,
      options.clubSessionEmpty,
    );

    if (path === "/api/runtime-notice") {
      return fulfillJson(route, { enabled: false });
    }
    if (path === "/api/auth/session") {
      if (options.authenticated === false) {
        return fulfillJson(route, { authenticated: false });
      }
      return fulfillJson(route, {
        authenticated: true,
        player: {
          ...me,
          username: options.longProfileName
            ? "김하늘🎾Alice피클볼이름이길어도아이디옆에서최대한길게표시합니다"
            : me.username,
          isFirstLogin: false,
          fontSizePreference: activeVisualFontSizePreference,
          privacyPolicyConsentVersion,
        },
      });
    }
    if (path === "/api/me") {
      return fulfillJson(route, {
        ...me,
        username: options.longProfileName
          ? "김하늘🎾Alice피클볼이름이길어도아이디옆에서최대한길게표시합니다"
          : me.username,
        isFirstLogin: false,
        fontSizePreference: activeVisualFontSizePreference,
        privacyPolicyConsentVersion,
      });
    }
    if (path === "/api/me/withdrawal-eligibility") {
      await options.withdrawalEligibilityGate;
      const blockerCopies = Math.max(1, options.withdrawalBlockerCopies ?? 1);
      return fulfillJson(route, options.withdrawalBlocked
        ? {
            eligible: false,
            blockers: {
              ownedClubs: [{ id: club.id, name: club.name }],
              activeMatches: Array.from({ length: blockerCopies }, (_, index) => ({
                id:
                  blockerCopies === 1
                    ? primaryMatch.id
                    : `${primaryMatch.id}-${index}`,
                name:
                  blockerCopies === 1
                    ? primaryMatch.name
                    : `${primaryMatch.name} ${index + 1}`,
                status: "evaluating",
              })),
              upcomingSessions: [{ id: session.id, name: session.name, date: session.date }],
            },
          }
        : {
            eligible: true,
            blockers: { ownedClubs: [], activeMatches: [], upcomingSessions: [] },
          });
    }
    if (path === "/api/me/withdrawal") {
      const confirmation = route.request().postDataJSON()?.confirmation;
      options.withdrawalTracker?.confirmations.push(String(confirmation ?? ""));
      return route.fulfill({ status: 204, body: "" });
    }
    if (path === "/api/me/privacy-policy-consent") {
      privacyPolicyConsentVersion = privacyPolicyVersion;
      return fulfillJson(route, {
        privacyPolicyConsentVersion,
        privacyPolicyConsentAgreedAt: "2026-08-18T00:00:00.000Z",
      }, 201);
    }
    if (path === "/api/player-qr-token") {
      return options.qrError
        ? fulfillJson(route, { error: "QR 코드를 생성하지 못했어요." }, 500)
        : fulfillJson(route, {
            payload: "pkelo://player/visual-snapshot-token",
            expiresAt: "2026-08-13T01:10:00.000Z",
          });
    }
    if (path === "/api/match-feed") {
      const items = options.matchFeedEmpty
        ? []
        : [
            { kind: "session", session },
            { kind: "match", match },
          ];
      return fulfillJson(route, { items, total: items.length });
    }
    if (path === "/api/players") {
      return fulfillJson(route, options.memberEmpty ? [] : [jiwoo, minsu]);
    }
    if (path === "/api/clubs") {
      return fulfillJson(
        route,
        options.clubEmpty
          ? []
          : [
              {
                club,
                membership: {
                  clubId: club.id,
                  playerId: me.id,
                  role: clubRole,
                  status: "active",
                  requestedAt: "2026-01-01T00:00:00.000Z",
                  joinedAt: "2026-01-01T00:00:00.000Z",
                },
              },
            ],
      );
    }
    if (path === `/api/clubs/${club.id}/dashboard`) {
      return fulfillJson(route, dashboard);
    }
    if (path === `/api/clubs/${club.id}/invite`) {
      return fulfillJson(route, {
        clubId: club.id,
        token: "club-invite-visual-snapshot",
        createdAt: "2026-08-13T00:00:00.000Z",
      });
    }
    if (path.startsWith("/api/players/") && path.endsWith("/profile-summary")) {
      return fulfillJson(route, profile);
    }
    if (path === "/api/matches") {
      const matches = options.historyEmpty ? [] : [match, secondaryMatch];
      return fulfillJson(route, { matches, total: matches.length });
    }
    if (path === `/api/matches/${primaryMatch.id}`) {
      return fulfillJson(route, match);
    }
    if (path === `/api/match-sessions/${session.id}/matches`) {
      return fulfillJson(route, options.sessionEmpty ? [] : [primaryMatch]);
    }
    if (path.startsWith(`/api/clubs/${club.id}/matches`)) {
      const matches = options.historyEmpty ? [] : [primaryMatch, secondaryMatch];
      return fulfillJson(route, { matches, total: matches.length });
    }
    return fulfillJson(route, {});
  });
};

const openApp = async (page: Page, options: FixtureOptions = {}) => {
  await installFixture(page, options);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Players" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-font-size",
    activeVisualFontSizePreference,
  );
};

const capture = async (page: Page, name: string) => {
  await page.locator("html").evaluate((html, preference) => {
    html.dataset.fontSize = preference;
  }, activeVisualFontSizePreference);
  await expect(page).toHaveScreenshot(
    activeVisualFontSizePreference === "default"
      ? name
      : `large--${name}`,
    {
      animations: "disabled",
      caret: "hide",
      fullPage: true,
    },
  );
};

const expectVisiblePillsToBeFullyRounded = async (locator: Locator) => {
  const pillMetrics = await locator.evaluateAll((elements) =>
    elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          height: rect.height,
          radius: Number.parseFloat(
            window.getComputedStyle(element).borderTopLeftRadius,
          ),
        };
      })
      .filter((metric) => metric.height > 0),
  );

  expect(pillMetrics.length).toBeGreaterThan(0);
  pillMetrics.forEach(({ height, radius }) => {
    expect(radius).toBeGreaterThanOrEqual(height / 2);
  });
};

const expectModalButtonTextToFit = async (locator: Locator) => {
  await expect(locator).toHaveCSS("white-space", "nowrap");
  await expect
    .poll(() =>
      locator.evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true);
};

const expectBottomSheetActionTone = async (
  locator: Locator,
  tone: "primary" | "secondary",
) => {
  await expect(locator).toHaveClass(
    new RegExp(`app-bottom-sheet-action-${tone}`),
  );

  if (await locator.isDisabled()) {
    await expect(locator).toHaveCSS("background-color", "rgb(226, 232, 240)");
    await expect(locator).toHaveCSS("color", "rgb(148, 163, 184)");
    return;
  }

  await expect(locator).toHaveCSS(
    "background-color",
    tone === "primary" ? "rgb(59, 82, 204)" : "rgb(241, 245, 249)",
  );
  await expect(locator).toHaveCSS(
    "color",
    tone === "primary" ? "rgb(255, 255, 255)" : "rgb(92, 104, 128)",
  );
};

const expectPressedBackground = async (
  page: Page,
  trigger: Locator,
  surface: Locator,
  color: string,
) => {
  await trigger.scrollIntoViewIfNeeded();
  const box = await trigger.boundingBox();
  if (!box) {
    throw new Error("pointerdown 대상의 위치를 찾지 못했습니다.");
  }

  await trigger.evaluate((element) => {
    element.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      { capture: true, once: true },
    );
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  try {
    await expect(surface).toHaveCSS("background-color", color);
    await expect(surface).toHaveCSS("opacity", "1");
  } finally {
    await page.mouse.up();
  }
};

const disableQrCamera = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
  });

const openMemberProfile = async (page: Page, options: FixtureOptions = {}) => {
  await openApp(page, options);
  await page.getByRole("button", { name: "박지우 프로필 보기" }).click();
  await expect(page.getByRole("dialog", { name: "멤버 프로필" })).toBeVisible();
};

const openMyProfile = async (page: Page, options: FixtureOptions = {}) => {
  await openApp(page, options);
  await page.getByRole("button", { name: "내 프로필" }).click();
  await expect(page.getByRole("dialog", { name: "내 프로필" })).toBeVisible();
};

for (const fontSizePreference of visualFontSizePreferences) {
  test.describe(`글자 크기 ${fontSizePreference}`, () => {
    test.beforeEach(() => {
      activeVisualFontSizePreference = fontSizePreference;
    });

test("카카오 로그인 화면", async ({ page }) => {
  await installFixture(page, { authenticated: false });
  await page.goto("http://pkelo.localhost:4173/login");
  await expect(page.getByRole("button", { name: "카카오 로그인" })).toBeVisible();
  await capture(page, "kakao-login.png");
});

test("개인정보 처리방침 화면", async ({ page }) => {
  await installFixture(page, { authenticated: false });
  await page.goto("/privacy");

  await expect(
    page.getByRole("heading", { name: "개인정보 처리방침" }),
  ).toBeVisible();
  await capture(page, "privacy-policy.png");
});

test("동의 이력이 없어도 로그인 사용자는 앱을 연다", async ({ page }) => {
  await installFixture(page, { privacyPolicyConsentVersion: null });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Players" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "개인정보 처리방침 동의" }),
  ).toHaveCount(0);
});

test("매치 탭의 with-data와 empty 상태", async ({ page }) => {
  await openApp(page);
  await page.getByRole("tab", { name: "내 매치" }).click();
  await expect(page.getByText("테스트 복식 매치")).toBeVisible();
  await capture(page, "matches--with-data.png");

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await openApp(page, { matchFeedEmpty: true });
  await page.getByRole("tab", { name: "내 매치" }).click();
  await expect(page.getByText("현재 표시할 내 매치가 없어요.")).toBeVisible();
  await capture(page, "matches--empty.png");
});

test("매치와 세션 상세의 data 상태", async ({ page }) => {
  await openApp(page);
  await page.getByRole("tab", { name: "내 매치" }).click();
  await expect(page.locator(".app-pill").first()).toBeVisible();
  await expectVisiblePillsToBeFullyRounded(page.locator(".app-pill"));
  await page.getByRole("button", { name: "테스트 복식 매치 상세 보기" }).click();
  const matchDetail = page.getByRole("dialog", { name: "매치 상세" });
  await expect(matchDetail).toBeVisible();
  await expect(matchDetail.getByText("스코어", { exact: true })).toBeVisible();
  await capture(page, "match-detail--with-data.png");
  await page.getByRole("button", { name: "뒤로가기" }).click();
  await expect(page.getByRole("dialog", { name: "매치 상세" })).toBeHidden();
  await page.getByRole("button", { name: "토요 오픈플레이 세션 상세 보기" }).click();
  const sessionDetail = page.getByRole("dialog", { name: "세션 상세" });
  await expect(sessionDetail).toBeVisible();
  await expect(
    sessionDetail.getByRole("button", {
      name: "테스트 복식 매치 상세 보기",
    }),
  ).toBeVisible();
  await capture(page, "session-detail--with-data.png");

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await openApp(page, { sessionEmpty: true });
  await page.getByRole("tab", { name: "내 매치" }).click();
  await page.getByRole("button", { name: "토요 오픈플레이 세션 상세 보기" }).click();
  const emptySessionDetail = page.getByRole("dialog", { name: "세션 상세" });
  await expect(emptySessionDetail).toBeVisible();
  const emptySessionMessage = page.getByText(
    "이 세션에 표시할 내 경기가 없어요.",
  );
  await expect(emptySessionMessage).toBeVisible();
  const [sessionMatchesBox, emptySessionMessageBox] = await Promise.all([
    emptySessionDetail.getByRole("region", { name: "Matches" }).boundingBox(),
    emptySessionMessage.boundingBox(),
  ]);
  expect(sessionMatchesBox).not.toBeNull();
  expect(emptySessionMessageBox).not.toBeNull();
  const emptySessionMessageCenterY =
    (emptySessionMessageBox?.y ?? 0) +
    (emptySessionMessageBox?.height ?? 0) / 2;
  expect(emptySessionMessageCenterY).toBeGreaterThan(
    (sessionMatchesBox?.y ?? 0) + (sessionMatchesBox?.height ?? 0) * 0.35,
  );
  expect(emptySessionMessageCenterY).toBeLessThan(
    (sessionMatchesBox?.y ?? 0) + (sessionMatchesBox?.height ?? 0) * 0.75,
  );
  await capture(page, "session-detail--empty.png");
});

test.describe("마우스 hover 피드백", () => {
  test.use({ hasTouch: false });

  test("hover 피드백은 불투명한 색상을 사용한다", async ({ page }) => {
    await openApp(page);

    const headerAction = page.getByRole("button", { name: "친구 추가" });
    await headerAction.hover();
    await expect(headerAction).toHaveCSS("color", "rgb(234, 255, 25)");
    await expect(headerAction).toHaveCSS("opacity", "1");

    const clubFilter = page.getByRole("tab", { name: "한강 피클볼" });
    await clubFilter.hover();
    await expect(clubFilter).toHaveCSS("background-color", "rgb(92, 104, 128)");
    await expect(clubFilter).toHaveCSS("opacity", "1");

    const memberProfileButton = page.getByRole("button", {
      name: "박지우 프로필 보기",
    });
    const memberRow = memberProfileButton.locator("..");
    await memberProfileButton.hover();
    await expect(memberRow).toHaveCSS("background-color", "rgb(235, 238, 250)");
    await expect(memberRow).toHaveCSS("opacity", "1");

    await page.getByRole("tab", { name: "내 매치" }).click();
    await page.getByRole("button", { name: "테스트 복식 매치 상세 보기" }).click();
    const matchDetail = page.getByRole("dialog", { name: "매치 상세" });
    const backButton = matchDetail.getByRole("button", { name: "뒤로가기" });
    await backButton.hover();
    await expect(backButton).toHaveCSS("background-color", "rgb(235, 238, 250)");
    await expect(backButton).toHaveCSS("opacity", "1");
  });

  test("pointerdown 피드백은 불투명한 색상을 사용한다", async ({ page }) => {
    await openApp(page);

    const memberProfileButton = page.getByRole("button", {
      name: "박지우 프로필 보기",
    });
    await expectPressedBackground(
      page,
      memberProfileButton,
      memberProfileButton.locator(".."),
      "rgb(217, 224, 247)",
    );
    await expectPressedBackground(
      page,
      page.getByRole("tab", { name: "한강 피클볼" }),
      page.getByRole("tab", { name: "한강 피클볼" }),
      "rgb(116, 129, 152)",
    );

    await page.getByRole("tab", { name: "내 매치" }).click();
    const matchCardButton = page.getByRole("button", {
      name: "테스트 복식 매치 상세 보기",
    });
    await expectPressedBackground(
      page,
      matchCardButton,
      matchCardButton.locator("> *").first(),
      "rgb(217, 224, 247)",
    );
    const sessionCardButton = page.getByRole("button", {
      name: "토요 오픈플레이 세션 상세 보기",
    });
    await expectPressedBackground(
      page,
      sessionCardButton,
      sessionCardButton.locator("> *").first(),
      "rgb(217, 224, 247)",
    );

    await openMemberProfile(page);
    const profileMatchButton = page
      .getByRole("dialog", { name: "멤버 프로필" })
      .getByRole("button", { name: /매치 상세 보기$/ })
      .first();
    await expectPressedBackground(
      page,
      profileMatchButton,
      profileMatchButton,
      "rgb(217, 224, 247)",
    );

    await openApp(page);
    await page.getByRole("tab", { name: "클럽" }).click();
    const clubMatchHistoryButton = page.getByRole("button", {
      name: "한강 피클볼의 매치 전체 보기",
    });
    await expect(clubMatchHistoryButton).toHaveClass(
      /active:bg-pkpk-pressed-surface/,
    );
  });
});

test("매치 생성 바텀시트와 내 QR modal", async ({ page }) => {
  await openApp(page);
  await page.getByRole("tab", { name: "내 매치" }).click();
  await expect(page.getByText("토요 오픈플레이", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "+ 매치 만들기" }).click();
  const createMatchSheet = page.getByRole("dialog", { name: "Create match" });
  await expect(createMatchSheet).toBeVisible();
  await expectBottomSheetActionTone(
    createMatchSheet.getByRole("button", { name: "취소" }),
    "secondary",
  );
  await expectBottomSheetActionTone(
    createMatchSheet.getByRole("button", { name: "길게 눌러 매치생성" }),
    "primary",
  );
  await capture(page, "create-match-sheet.png");

  await page.getByRole("button", { name: "취소" }).click();
  await page.getByRole("button", { name: "내 QR 코드 열기" }).click();
  const playerQrModal = page.getByRole("dialog", { name: "내 QR 코드" });
  await expect(playerQrModal).toBeVisible();
  const qrWithDataBox = await playerQrModal.boundingBox();
  await capture(page, "player-qr-modal--with-data.png");

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await openApp(page, { qrError: true });
  await page.getByRole("button", { name: "내 QR 코드 열기" }).click();
  await expect(page.getByText("QR 코드를 생성하지 못했어요.")).toBeVisible();
  const qrEmptyBox = await page
    .getByRole("dialog", { name: "내 QR 코드" })
    .boundingBox();
  expect(qrWithDataBox).not.toBeNull();
  expect(qrEmptyBox).not.toBeNull();
  expect(qrEmptyBox?.height).toBeCloseTo(qrWithDataBox?.height ?? 0, 3);
  await capture(page, "player-qr-modal--empty.png");
});

test("QR 스캔은 모든 진입점에서 modal로 열린다", async ({ page }) => {
  await openApp(page);
  await disableQrCamera(page);

  await page.getByRole("button", { name: "친구 추가" }).click();
  const friendScanner = page.getByRole("dialog", { name: "친구 QR 스캔" });
  await expect(friendScanner).toBeVisible();
  await expect(
    friendScanner.getByText("이 브라우저에서는 카메라 스캔을 사용할 수 없어요."),
  ).toBeVisible();
  await page.getByRole("button", { name: "친구 QR 스캔 닫기" }).click();
  await expect(friendScanner).toBeHidden();

  await page.getByRole("tab", { name: "내 매치" }).click();
  await page.getByRole("button", { name: "+ 매치 만들기" }).click();
  const createMatchSheet = page.getByRole("dialog", { name: "Create match" });
  await expect(createMatchSheet).toBeVisible();
  await createMatchSheet.getByRole("button", { name: "멤버 추가" }).click();
  const matchScanner = page.getByRole("dialog", {
    name: "매치 멤버 QR 스캔",
  });
  await expect(matchScanner).toBeVisible();
  await expect(
    matchScanner.getByText("이 브라우저에서는 카메라 스캔을 사용할 수 없어요."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "매치 멤버 QR 스캔 닫기" })
    .click();
  await expect(matchScanner).toBeHidden();
  await expect(createMatchSheet).toBeVisible();
  await page.getByRole("button", { name: "취소" }).click();

  await page.getByRole("tab", { name: "클럽" }).click();
  await page.getByRole("button", { name: "멤버 초대" }).click();
  const clubScanner = page.getByRole("dialog", { name: "멤버 QR 스캔" });
  await expect(clubScanner).toBeVisible();
  await expect(
    clubScanner.getByText("이 브라우저에서는 카메라 스캔을 사용할 수 없어요."),
  ).toBeVisible();
});

test("플레이어 목록의 with-data와 empty 상태", async ({ page }) => {
  await openApp(page);
  const addFriendButton = page.getByRole("button", { name: "친구 추가" });
  await expect(addFriendButton).toBeVisible();
  await expect(addFriendButton.getByText("친구 추가", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "박지우 프로필 보기" })).toBeVisible();
  await capture(page, "members--with-data.png");

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await openApp(page, { memberEmpty: true });
  const emptyFriendsMessage = page.getByText("현재 표시할 친구가 없어요.");
  await expect(emptyFriendsMessage).toBeVisible();
  const emptyFriendsMessageBox = await emptyFriendsMessage.boundingBox();
  expect(emptyFriendsMessageBox).not.toBeNull();
  expect(
    (emptyFriendsMessageBox?.y ?? 0) +
      (emptyFriendsMessageBox?.height ?? 0) / 2,
  ).toBeGreaterThan(400);
  await capture(page, "members--empty.png");
});

test("좁은 플레이어 헤더에서는 친구 추가 문구를 숨긴다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);

  const addFriendButton = page.getByRole("button", { name: "친구 추가" });
  await expect(addFriendButton).toBeVisible();
  await expect(
    addFriendButton.getByText("친구 추가", { exact: true }),
  ).toBeHidden();
  const myProfileButton = page.getByRole("button", { name: "내 프로필" });
  await expect(myProfileButton).toBeVisible();
  await page.getByRole("heading", { name: "Players" }).evaluate((heading) => {
    heading.style.minWidth = "16rem";
  });
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await expect(
    myProfileButton.locator(".members-my-profile-visible-label"),
  ).toHaveCount(0);
  const myProfileButtonMetrics = await myProfileButton.evaluate((button) => {
    const row = button.parentElement?.parentElement;
    const buttonRect = button.getBoundingClientRect();
    const rowRect = row?.getBoundingClientRect();
    return {
      buttonRight: buttonRect.right,
      rightLimit: (rowRect?.right ?? window.innerWidth) - 16,
    };
  });
  expect(myProfileButtonMetrics.buttonRight).toBeLessThanOrEqual(
    myProfileButtonMetrics.rightLimit,
  );
});

test("멤버 프로필과 전체 매치 drawer의 with-data와 empty 상태", async ({ page }) => {
  await openMemberProfile(page);
  await expect(page.getByText("최근 매치")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "최고 평점" }),
  ).toContainText("4.120");
  await expect(page.getByText("여성 · 31세", { exact: true })).toBeVisible();
  await capture(page, "member-profile--with-data.png");
  const memberHistoryResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/matches",
  );
  await page.getByRole("button", { name: "전체 보기" }).click();
  const profileMatchHistoryDrawer = page.getByRole("dialog", {
    name: "전체 매치",
  });
  await expect(profileMatchHistoryDrawer).toBeVisible();
  await memberHistoryResponse;
  await expect(
    profileMatchHistoryDrawer.getByLabel("추가 매치 로딩 중"),
  ).toBeHidden();
  await expect(profileMatchHistoryDrawer.getByText("박지우", { exact: true })).toBeVisible();
  await capture(page, "profile-match-history--with-data.png");

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await openMemberProfile(page, { historyEmpty: true, profileEmpty: true });
  await expect(
    page.getByRole("region", { name: "최고 평점" }),
  ).toContainText("기록 없음");
  await expect(page.getByText("최근 완료된 매치가 없어요.")).toBeVisible();
  await capture(page, "member-profile--empty.png");
  await page.getByRole("button", { name: "전체 보기" }).click();
  const emptyProfileMatchHistoryDrawer = page.getByRole("dialog", {
    name: "전체 매치",
  });
  const emptyMatchMessage = emptyProfileMatchHistoryDrawer.getByText(
    "완료된 매치가 없어요.",
    { exact: true },
  );
  await expect(emptyMatchMessage).toBeVisible();
  const [emptyDrawerBox, emptyMessageBox] = await Promise.all([
    emptyProfileMatchHistoryDrawer.boundingBox(),
    emptyMatchMessage.boundingBox(),
  ]);
  expect(emptyDrawerBox).not.toBeNull();
  expect(emptyMessageBox).not.toBeNull();
  const emptyMessageCenterY =
    (emptyMessageBox?.y ?? 0) + (emptyMessageBox?.height ?? 0) / 2;
  expect(emptyMessageCenterY).toBeGreaterThan(
    (emptyDrawerBox?.y ?? 0) + (emptyDrawerBox?.height ?? 0) * 0.35,
  );
  expect(emptyMessageCenterY).toBeLessThan(
    (emptyDrawerBox?.y ?? 0) + (emptyDrawerBox?.height ?? 0) * 0.75,
  );
  await capture(page, "profile-match-history--empty.png");
});

test("프로필 전체 매치는 최근 매치를 유지하며 추가 로딩 상태를 표시한다", async ({
  page,
}) => {
  await openMemberProfile(page);

  let releaseHistoryRequest: (() => void) | undefined;
  const historyRequestPending = new Promise<void>((resolve) => {
    releaseHistoryRequest = resolve;
  });
  await page.route("**/api/matches?*", async (route) => {
    await historyRequestPending;
    await route.fallback();
  });

  await page.getByRole("button", { name: "전체 보기" }).click();
  const historyDrawer = page.getByRole("dialog", { name: "전체 매치" });
  const loadingSpinner = historyDrawer.getByLabel("추가 매치 로딩 중");

  await expect(historyDrawer.getByText("박지우", { exact: true })).toBeVisible();
  await expect(loadingSpinner).toBeVisible();
  await expect(
    historyDrawer.getByText("완료된 매치가 없어요.", { exact: true }),
  ).toBeHidden();

  releaseHistoryRequest?.();
  await expect(loadingSpinner).toBeHidden();
  await expect(historyDrawer.getByText("박지우", { exact: true })).toBeVisible();

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await openMyProfile(page);

  let releaseMyHistoryRequest: (() => void) | undefined;
  const myHistoryRequestPending = new Promise<void>((resolve) => {
    releaseMyHistoryRequest = resolve;
  });
  await page.route("**/api/matches?*", async (route) => {
    await myHistoryRequestPending;
    await route.fallback();
  });

  await page.getByRole("button", { name: "전체 보기" }).click();
  const myHistoryDrawer = page.getByRole("dialog", { name: "전체 매치" });
  const myLoadingSpinner = myHistoryDrawer.getByLabel("추가 매치 로딩 중");

  await expect(myHistoryDrawer.getByText("김하늘", { exact: true })).toBeVisible();
  await expect(myLoadingSpinner).toBeVisible();
  await expect(
    myHistoryDrawer.getByText("완료된 매치가 없어요.", { exact: true }),
  ).toBeHidden();

  releaseMyHistoryRequest?.();
  await expect(myLoadingSpinner).toBeHidden();
  await expect(myHistoryDrawer.getByText("김하늘", { exact: true })).toBeVisible();
});

test("프로필 매치 상세 헤더의 프로필 식별 표시", async ({ page }) => {
  await openMemberProfile(page);
  const memberProfile = page.getByRole("dialog", { name: "멤버 프로필" });
  await memberProfile
    .getByRole("button", { name: /매치 상세 보기$/ })
    .first()
    .click();
  const memberMatchDetail = page.getByRole("dialog", { name: "매치 상세" });
  await expect(memberMatchDetail).toBeVisible();
  await expect(
    memberMatchDetail.locator(".sticky").getByText("박지우", { exact: true }),
  ).toBeVisible();
  await expect(memberMatchDetail.getByText("스코어", { exact: true })).toBeVisible();
  await capture(page, "profile-match-detail--member.png");

  await openMyProfile(page);
  const myProfile = page.getByRole("dialog", { name: "내 프로필" });
  await myProfile
    .getByRole("button", { name: /매치 상세 보기$/ })
    .first()
    .click();
  const myMatchDetail = page.getByRole("dialog", { name: "매치 상세" });
  await expect(myMatchDetail).toBeVisible();
  await expect(
    myMatchDetail.locator(".sticky").getByText("김하늘", { exact: true }),
  ).toBeVisible();
  await expect(myMatchDetail.getByText("스코어", { exact: true })).toBeVisible();
  await capture(page, "profile-match-detail--my.png");
});

test("내 프로필과 데이터 독립 바텀시트", async ({ page }) => {
  await openMyProfile(page);
  await expect(page.getByText("김하늘")).toBeVisible();
  await expect(page.getByText("70%")).toBeVisible();
  const myProfile = page.getByRole("dialog", { name: "내 프로필" });
  await expect(
    myProfile.getByRole("region", { name: "최고 평점" }),
  ).toContainText("4.120");
  await expect(
    myProfile.getByRole("region", { name: "최저 평점" }),
  ).toContainText("3.840");
  await expect(myProfile.getByText("2026. 8. 10.")).toBeVisible();
  await expect(myProfile.locator("canvas")).toHaveCount(0);
  await capture(page, "my-profile--with-data.png");

  await myProfile.getByRole("tab", { name: "Singles" }).click();
  await expect(
    myProfile.getByRole("region", { name: "최고 평점" }),
  ).toContainText("3.880");
  await expect(
    myProfile.getByRole("region", { name: "최저 평점" }),
  ).toContainText("3.720");
  await myProfile.getByRole("tab", { name: "Doubles" }).click();
  await page.getByRole("button", { name: "상태메시지 수정" }).click();
  const statusMessageSheet = page.getByRole("dialog", { name: "상태메시지 수정" });
  await expect(statusMessageSheet).toBeVisible();
  await expectBottomSheetActionTone(
    statusMessageSheet.getByRole("button", { name: "저장" }),
    "primary",
  );
  await capture(page, "status-message-sheet--with-data.png");

  await page.getByRole("button", { name: "Close" }).click();
  const myHistoryResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/matches",
  );
  await page.getByRole("button", { name: "전체 보기" }).click();
  const myProfileMatchHistoryDrawer = page.getByRole("dialog", {
    name: "전체 매치",
  });
  await expect(myProfileMatchHistoryDrawer).toBeVisible();
  await myHistoryResponse;
  await expect(
    myProfileMatchHistoryDrawer.getByLabel("추가 매치 로딩 중"),
  ).toBeHidden();
  await expect(myProfileMatchHistoryDrawer.getByText("김하늘", { exact: true })).toBeVisible();

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await openMyProfile(page, { profileEmpty: true });
  await expect(page.getByText("최근 완료된 매치가 없어요.")).toBeVisible();
  await capture(page, "my-profile--empty.png");
});

test("내 프로필 긴 이름은 Rating 카드 경계 안에서 ID와 함께 표시된다", async ({
  page,
}) => {
  const longProfileName =
    "김하늘🎾Alice피클볼이름이길어도아이디옆에서최대한길게표시합니다";
  await openMyProfile(page, { longProfileName: true });

  const profileDialog = page.getByRole("dialog", { name: "내 프로필" });
  const profileName = profileDialog.getByRole("heading", {
    name: longProfileName,
  });
  const playerIdButton = profileDialog.getByRole("button", {
    name: "Player ID 복사",
  });
  const ratingCard = profileDialog
    .getByRole("heading", { name: "Rating" })
    .locator("..");

  await expect(profileName).toBeVisible();
  await expect(playerIdButton).toBeVisible();
  await expect(profileDialog.getByText("70%")).toBeVisible();
  await expect
    .poll(() => profileName.textContent())
    .toMatch(/^김.+…$/);
  const [nameBox, playerIdBox, ratingCardBox] = await Promise.all([
    profileName.boundingBox(),
    playerIdButton.boundingBox(),
    ratingCard.boundingBox(),
  ]);
  if (!nameBox || !playerIdBox || !ratingCardBox) {
    throw new Error("프로필 헤더 또는 Rating 카드의 위치를 측정할 수 없습니다.");
  }

  const ratingCardRight = ratingCardBox.x + ratingCardBox.width;
  expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(ratingCardRight);
  expect(playerIdBox.x + playerIdBox.width).toBeLessThanOrEqual(
    ratingCardRight,
  );
});

test("클럽 탭과 클럽 내부 surface의 with-data와 empty 상태", async ({ page }) => {
  await openApp(page);
  await page.getByRole("tab", { name: "클럽" }).click();
  await expect(page.getByText("토요 오픈플레이")).toBeVisible();
  await expect(page.getByRole("heading", { name: "다가오는 세션" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "토요 오픈플레이 세션 상세 보기" }),
  ).toBeVisible();
  await expect(page.getByText("4.120", { exact: true })).toBeVisible();
  const recentMatchCards = page.getByTestId("club-recent-match-card");
  const [firstMatchCard, secondMatchCard] = await Promise.all([
    recentMatchCards.nth(0).boundingBox(),
    recentMatchCards.nth(1).boundingBox(),
  ]);
  if (!firstMatchCard || !secondMatchCard) {
    throw new Error("최근 완료 매치 카드의 크기를 측정할 수 없습니다.");
  }
  expect(firstMatchCard.height).toBe(secondMatchCard.height);
  expect(firstMatchCard.x + firstMatchCard.width / 2).toBeCloseTo(
    (page.viewportSize()?.width ?? 0) / 2,
    0,
  );
  await capture(page, "affiliations--with-data.png");
  await page.getByRole("button", { name: "운영진 관리" }).click();
  await expect(page.getByRole("dialog", { name: "클럽 운영진 관리" })).toBeVisible();
  await capture(page, "club-management--with-data.png");
  await page.getByRole("button", { name: "뒤로가기" }).click();
  await page.getByRole("button", { name: "한강 피클볼의 매치 전체 보기" }).click();
  const clubMatchHistoryDrawer = page.getByRole("dialog", {
    name: "한강 피클볼의 매치 전체",
  });
  await expect(clubMatchHistoryDrawer).toBeVisible();
  await expect(
    clubMatchHistoryDrawer.getByText("매치 전체", { exact: true }),
  ).toBeVisible();
  await expect(
    clubMatchHistoryDrawer.getByText("한강 피클볼", { exact: true }).first(),
  ).toBeVisible();
  await capture(page, "club-match-history--with-data.png");

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await openApp(page, { clubEmpty: true });
  await page.getByRole("tab", { name: "클럽" }).click();
  await expect(
    page.getByText("클럽을 만들거나 클럽 구성원에게 초대받아보세요."),
  ).toBeVisible();
  await capture(page, "affiliations--empty.png");
  await page.getByRole("button", { name: "+ 클럽 만들기" }).click();
  const clubCreateSheet = page.getByRole("dialog", { name: "클럽 만들기" });
  await expect(clubCreateSheet).toBeVisible();
  await expectBottomSheetActionTone(
    clubCreateSheet.getByRole("button", { name: "클럽 만들기" }),
    "primary",
  );
  await capture(page, "club-create-sheet.png");
});

test("다가오는 세션이 없으면 해당 섹션을 표시하지 않는다", async ({ page }) => {
  await openApp(page, { clubSessionEmpty: true });
  await page.getByRole("tab", { name: "클럽" }).click();

  await expect(page.getByRole("heading", { name: "다가오는 세션" })).toHaveCount(0);
  await expect(page.getByText("예정된 매치와 세션이 없어요.")).toHaveCount(0);
});

test("클럽 공지는 drawer에서 전체 내용을 보여준다", async ({ page }) => {
  await openApp(page);
  await page.getByRole("tab", { name: "클럽" }).click();

  await page.getByRole("button", { name: "+ 공지 추가" }).click();
  await expect(page.getByRole("dialog", { name: "공지 추가" })).toBeVisible();
  await page.getByRole("button", { name: "취소" }).click();

  const announcementButton = page.getByRole("button", {
    name: "토요일 오픈플레이 안내 공지 상세 보기",
  });
  await expect(announcementButton).toBeVisible();
  await expect(page.getByText("펼치기")).toHaveCount(0);
  await expect(page.getByText("접기")).toHaveCount(0);
  await announcementButton.click();

  const announcementDetail = page.getByRole("dialog", { name: "공지 상세" });
  await expect(announcementDetail).toBeVisible();
  await expect(
    announcementDetail.getByText("오전 10시에 A 코트에서 만나요."),
  ).toBeVisible();
  await expect(
    announcementDetail.getByRole("link", { name: "https://pkelo.app/notice" }),
  ).toHaveAttribute("href", "https://pkelo.app/notice");
  await expect(
    announcementDetail.getByRole("link", { name: "https://example.com/guide" }),
  ).toHaveAttribute("target", "_blank");
  await expect(announcementDetail.getByRole("button", { name: "공지 메뉴" })).toBeVisible();
  await capture(page, "club-announcement-detail--with-data.png");
  await announcementDetail.getByRole("button", { name: "뒤로가기" }).click();
  await expect(announcementDetail).toHaveCount(0);

  await page.getByRole("button", { name: "운영진 관리" }).click();
  const managementDrawer = page.getByRole("dialog", {
    name: "클럽 운영진 관리",
  });
  await expect(
    managementDrawer.getByRole("button", { name: "+ 공지 추가" }),
  ).toHaveCount(0);
});

test("운영진은 소속 탭에서 공지를 관리한다", async ({ page }) => {
  await openApp(page, { clubRole: "manager" });
  await page.getByRole("tab", { name: "클럽" }).click();

  await expect(page.getByRole("button", { name: "+ 공지 추가" })).toBeVisible();
  await page
    .getByRole("button", { name: "토요일 오픈플레이 안내 공지 상세 보기" })
    .click();
  const announcementDetail = page.getByRole("dialog", { name: "공지 상세" });
  await announcementDetail.getByRole("button", { name: "공지 메뉴" }).click();
  await expect(announcementDetail.getByRole("menuitem", { name: "제거" })).toBeVisible();
});

test("일반 멤버에게는 공지 관리 제어를 표시하지 않는다", async ({ page }) => {
  await openApp(page, { clubRole: "member" });
  await page.getByRole("tab", { name: "클럽" }).click();

  await expect(page.getByRole("button", { name: "+ 공지 추가" })).toHaveCount(0);
  await page
    .getByRole("button", { name: "토요일 오픈플레이 안내 공지 상세 보기" })
    .click();
  const announcementDetail = page.getByRole("dialog", { name: "공지 상세" });
  await expect(announcementDetail).toBeVisible();
  await expect(announcementDetail.getByRole("button", { name: "공지 메뉴" })).toHaveCount(0);
});

test("클럽 운영진 관리 drawer를 닫은 뒤 다시 열 수 있다", async ({ page }) => {
  await openApp(page, { useFixedClock: false });
  await page.getByRole("tab", { name: "클럽" }).click();

  const clubManagementDrawer = page.getByRole("dialog", {
    name: "클럽 운영진 관리",
  });
  const clubManagementDrawerElement = page.locator(
    '[role="dialog"][aria-label="클럽 운영진 관리"]',
  );
  const clubManagementButton = page.getByRole("button", {
    name: "운영진 관리",
  });
  await clubManagementButton.click({ position: { x: 20, y: 20 } });
  await expect(clubManagementDrawer).toBeVisible();

  await page.getByRole("button", { name: "뒤로가기" }).click();
  await expect(clubManagementDrawerElement).toHaveCount(0);

  await clubManagementButton.click({ position: { x: 20, y: 20 } });
  await expect(clubManagementDrawer).toBeVisible();
  await expect(clubManagementDrawerElement).toHaveCount(1);
  await expect(
    clubManagementDrawer.getByRole("heading", { name: "세션 만들기" }),
  ).toHaveCount(0);
  await expect(
    clubManagementDrawer.getByRole("img", { name: "박지우" }),
  ).toBeVisible();

  const releaseManagerButton = clubManagementDrawer.getByRole("button", {
    name: "운영진 해제",
  });
  const assignManagerButton = clubManagementDrawer.getByRole("button", {
    name: "운영진 지정",
  });
  await expect(releaseManagerButton).toBeVisible();
  await expect(assignManagerButton).toBeVisible();
  await expect(releaseManagerButton).toHaveClass(/!text-orange-600/);
  await expect(assignManagerButton).toHaveClass(/!text-white/);
  await expect(assignManagerButton).toHaveClass(/!bg-pkpk-primary-bg/);
});

test("클럽 운영과 전체 매치의 empty 내부 상태", async ({ page }) => {
  await openApp(page, { historyEmpty: true, profileEmpty: true });
  await page.getByRole("tab", { name: "클럽" }).click();
  await page.getByRole("button", { name: "운영진 관리" }).click();
  await expect(page.getByRole("button", { name: "멤버 초대" })).toBeVisible();
  await capture(page, "club-management--empty.png");

  await page.getByRole("button", { name: "뒤로가기" }).click();
  await page.getByRole("button", { name: "한강 피클볼의 매치 전체 보기" }).click();
  await expect(page.getByText("표시할 소속 매치가 없어요.")).toBeVisible();
  await capture(page, "club-match-history--empty.png");
});

test("설정 탭 운영방침 drawer와 로그아웃 확인 modal", async ({ page }) => {
  await openApp(page);
  await page.getByRole("tab", { name: "설정" }).click();
  await expect(page.getByRole("heading", { name: "앱 버전" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "계정" })).toBeHidden();
  await expect(page.getByRole("button", { name: "운영방침" })).toBeVisible();
  await capture(page, "settings.png");

  await page.getByRole("button", { name: "운영방침" }).click();
  const operatingPolicyDrawer = page.getByRole("dialog", { name: "운영방침" });
  const policyScrollArea = operatingPolicyDrawer.locator(
    '[aria-labelledby="privacy-policy-title"] > div',
  );
  await expect(operatingPolicyDrawer).toBeVisible();
  await expect(operatingPolicyDrawer.getByText("상호")).toBeVisible();
  await expect(operatingPolicyDrawer.getByText("벌스")).toBeVisible();
  await expect(operatingPolicyDrawer.getByText("163-20-01593")).toBeVisible();
  await expect(policyScrollArea).toHaveCSS("overflow-y", "auto");
  await capture(page, "operating-policy-drawer.png");

  await operatingPolicyDrawer.getByRole("button", { name: "뒤로가기" }).click();
  await expect(operatingPolicyDrawer).toHaveCount(0);

  await page.getByRole("button", { name: "로그아웃" }).click();
  const logoutDialog = page.getByRole("dialog", { name: "로그아웃 확인" });
  await expect(logoutDialog).toBeVisible();
  await expectModalButtonTextToFit(
    logoutDialog.getByRole("button", { name: "로그아웃", exact: true }),
  );
  await capture(page, "logout-modal.png");
});

test("회원 탈퇴 가능 상태와 차단 항목 modal", async ({ page }) => {
  await openApp(page);
  await page.getByRole("tab", { name: "설정" }).click();
  await page.getByRole("button", { name: "회원탈퇴" }).click();
  const eligibleModal = page.getByRole("dialog", { name: "회원 탈퇴 확인" });
  await expect(eligibleModal.getByLabel("탈퇴 확인 문구")).toBeVisible();
  const withdrawalButton = eligibleModal.getByRole("button", {
    name: "길게 눌러 회원탈퇴",
    exact: true,
  });
  await expect(withdrawalButton).toBeDisabled();
  await expectModalButtonTextToFit(withdrawalButton);
  await capture(page, "settings-withdrawal--eligible.png");

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await openApp(page, { withdrawalBlocked: true });
  await page.getByRole("tab", { name: "설정" }).click();
  await page.getByRole("button", { name: "회원탈퇴" }).click();
  const blockedModal = page.getByRole("dialog", { name: "회원 탈퇴 확인" });
  await expect(blockedModal.getByText("소유 클럽")).toBeVisible();
  await expect(blockedModal.getByText("진행 중인 경기")).toBeVisible();
  await expect(blockedModal.getByText("예정 세션")).toBeVisible();
  const blockedItemsScrollArea = blockedModal.getByRole("region", {
    name: "탈퇴 전 정리 항목",
  });
  await expect(blockedItemsScrollArea).toBeVisible();
  await expect(blockedItemsScrollArea).toHaveCSS("border-top-style", "solid");
  const blockedModalConfirmButton = blockedModal.getByRole("button", {
    name: "확인",
    exact: true,
  });
  await expect(blockedModalConfirmButton).toBeVisible();
  await expect(blockedModalConfirmButton).toBeEnabled();
  await capture(page, "settings-withdrawal--blocked.png");
  await blockedModalConfirmButton.click();
  await expect(blockedModal).toBeHidden();
});

test("회원 탈퇴 모달은 최대 높이를 넘지 않는다", async ({ page }) => {
  let resolveEligibility!: () => void;
  const withdrawalEligibilityGate = new Promise<void>((resolve) => {
    resolveEligibility = resolve;
  });
  await openApp(page, {
    withdrawalBlocked: true,
    withdrawalEligibilityGate,
  });
  await page.getByRole("tab", { name: "설정" }).click();
  await page.getByRole("button", { name: "회원탈퇴" }).click();

  const modal = page.getByRole("dialog", { name: "회원 탈퇴 확인" });
  await expect(modal.getByText("탈퇴 가능 여부를 확인하고 있습니다...")).toBeVisible();
  const loadingBox = await modal.boundingBox();
  expect(loadingBox).not.toBeNull();

  resolveEligibility();
  await expect(modal.getByRole("region", { name: "탈퇴 전 정리 항목" })).toBeVisible();
  const loadedBox = await modal.boundingBox();
  expect(loadedBox).not.toBeNull();
  expect(loadedBox?.width).toBeCloseTo(loadingBox?.width ?? 0, 1);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(loadedBox?.height ?? 0).toBeLessThanOrEqual(viewportHeight - 32);
});

test("회원 탈퇴 차단 항목이 많으면 modal 본문을 스크롤한다", async ({ page }) => {
  await openApp(page, {
    withdrawalBlocked: true,
    withdrawalBlockerCopies: 12,
  });
  await page.getByRole("tab", { name: "설정" }).click();
  await page.getByRole("button", { name: "회원탈퇴" }).click();

  const modal = page.getByRole("dialog", { name: "회원 탈퇴 확인" });
  await expect(modal.getByText("진행 중인 경기")).toBeVisible();
  const scrollArea = modal.getByRole("region", { name: "탈퇴 전 정리 항목" });
  await expect(scrollArea).toHaveCSS("overflow-y", "auto");
  await expect
    .poll(() =>
      scrollArea.evaluate((element) => element.scrollHeight > element.clientHeight),
    )
    .toBe(true);
  await expect(page.getByTestId("withdrawal-blockers-scrollbar")).toBeVisible();
  const [scrollAreaBox, confirmButtonBox] = await Promise.all([
    scrollArea.boundingBox(),
    modal.getByRole("button", { name: "확인", exact: true }).boundingBox(),
  ]);
  expect(scrollAreaBox).not.toBeNull();
  expect(confirmButtonBox).not.toBeNull();
  expect((scrollAreaBox?.y ?? 0) + (scrollAreaBox?.height ?? 0)).toBeLessThan(
    (confirmButtonBox?.y ?? 0) - 8,
  );
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(
    (confirmButtonBox?.y ?? 0) + (confirmButtonBox?.height ?? 0),
  ).toBeLessThanOrEqual(viewportHeight);
});

test("탈퇴 확인 문구가 일치할 때 한 번만 요청하고 로그인 화면으로 이동한다", async ({ page }) => {
  const tracker = { confirmations: [] as string[] };
  await openApp(page, { withdrawalTracker: tracker });
  await page.getByRole("tab", { name: "설정" }).click();
  await page.getByRole("button", { name: "회원탈퇴" }).click();
  const modal = page.getByRole("dialog", { name: "회원 탈퇴 확인" });
  const submit = modal.getByRole("button", {
    name: "길게 눌러 회원탈퇴",
    exact: true,
  });
  await modal.getByLabel("탈퇴 확인 문구").fill("탈 퇴");
  await expect(submit).toBeDisabled();
  await modal.getByLabel("탈퇴 확인 문구").fill("탈퇴");
  await submit.dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 1,
    isPrimary: true,
    button: 0,
  });
  await page.waitForTimeout(200);
  await submit.dispatchEvent("pointerup", {
    pointerType: "touch",
    pointerId: 1,
    isPrimary: true,
    button: 0,
  });
  expect(tracker.confirmations).toEqual([]);

  await submit.dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 2,
    isPrimary: true,
    button: 0,
  });
  await expect(page.getByRole("button", { name: "카카오 로그인" })).toBeVisible();
  expect(tracker.confirmations).toEqual(["탈퇴"]);
});

test("탈퇴 가능 여부 응답 전후에도 modal 위치와 크기를 유지한다", async ({ page }) => {
  let releaseEligibility: (() => void) | undefined;
  const withdrawalEligibilityGate = new Promise<void>((resolve) => {
    releaseEligibility = resolve;
  });
  await openApp(page, { withdrawalEligibilityGate });
  await page.getByRole("tab", { name: "설정" }).click();
  await page.getByRole("button", { name: "회원탈퇴" }).click();

  const modal = page.getByRole("dialog", { name: "회원 탈퇴 확인" });
  await expect(modal.getByText("탈퇴 가능 여부를 확인하고 있습니다...")).toBeVisible();
  const beforeEligibility = await modal.boundingBox();
  expect(beforeEligibility).not.toBeNull();

  releaseEligibility?.();
  await expect(modal.getByLabel("탈퇴 확인 문구")).toBeVisible();
  await expect.poll(() => modal.boundingBox()).toEqual(beforeEligibility);
});

test("QR 스캔 modal의 모든 진입점", async ({ page }) => {
  await openApp(page);
  await disableQrCamera(page);

  await page.getByRole("button", { name: "친구 추가" }).click();
  const friendScanner = page.getByRole("dialog", { name: "친구 QR 스캔" });
  await expect(friendScanner).toContainText(
    "이 브라우저에서는 카메라 스캔을 사용할 수 없어요.",
  );
  await expectBottomSheetActionTone(
    friendScanner.getByRole("button", { name: "닫기", exact: true }),
    "secondary",
  );
  await expectBottomSheetActionTone(
    friendScanner.getByRole("button", { name: "다시 스캔" }),
    "secondary",
  );
  await capture(page, "friend-qr-scanner-modal--camera-unavailable.png");
  await page.getByRole("button", { name: "친구 QR 스캔 닫기" }).click();

  await page.getByRole("tab", { name: "내 매치" }).click();
  await page.getByRole("button", { name: "+ 매치 만들기" }).click();
  const createMatchSheet = page.getByRole("dialog", { name: "Create match" });
  await createMatchSheet.getByRole("button", { name: "멤버 추가" }).click();
  const matchScanner = page.getByRole("dialog", {
    name: "매치 멤버 QR 스캔",
  });
  await expect(matchScanner).toContainText(
    "이 브라우저에서는 카메라 스캔을 사용할 수 없어요.",
  );
  await expectBottomSheetActionTone(
    matchScanner.getByRole("button", { name: "닫기", exact: true }),
    "secondary",
  );
  await expectBottomSheetActionTone(
    matchScanner.getByRole("button", { name: "다시 스캔" }),
    "secondary",
  );
  await capture(page, "match-member-qr-scanner-modal--camera-unavailable.png");
  await page
    .getByRole("button", { name: "매치 멤버 QR 스캔 닫기" })
    .click();
  await page.getByRole("button", { name: "취소" }).click();

  await page.getByRole("tab", { name: "클럽" }).click();
  await page.getByRole("button", { name: "멤버 초대" }).click();
  const clubScanner = page.getByRole("dialog", { name: "멤버 QR 스캔" });
  await expect(clubScanner).toContainText(
    "이 브라우저에서는 카메라 스캔을 사용할 수 없어요.",
  );
  await expectBottomSheetActionTone(
    clubScanner.getByRole("button", { name: "닫기", exact: true }),
    "secondary",
  );
  await expectBottomSheetActionTone(
    clubScanner.getByRole("button", { name: "다시 스캔" }),
    "secondary",
  );
  await capture(page, "club-member-qr-scanner-modal--camera-unavailable.png");
});

test("결과 입력 바텀시트와 결과 거부 확인 dialog", async ({ page }) => {
  await openApp(page, { matchScenario: "result-entry" });
  await page.getByRole("tab", { name: "내 매치" }).click();
  await page
    .getByRole("button", { name: "테스트 복식 매치 상세 보기" })
    .click();
  await page.getByRole("button", { name: "결과 입력" }).click();
  const resultSheet = page.getByRole("dialog", { name: "경기 결과 입력" });
  await expect(resultSheet).toBeVisible();
  await expectBottomSheetActionTone(
    resultSheet.getByRole("button", { name: "취소" }),
    "secondary",
  );
  await expectBottomSheetActionTone(
    resultSheet.getByRole("button", { name: "결과 입력" }),
    "primary",
  );
  await capture(page, "match-result-entry-sheet.png");

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await openApp(page, { matchScenario: "result-rejection" });
  await page.getByRole("tab", { name: "내 매치" }).click();
  await page
    .getByRole("button", { name: "테스트 복식 매치 상세 보기" })
    .click();
  await page.getByText("결과 거부", { exact: true }).last().click();
  const rejectionDialog = page.getByRole("alertdialog", {
    name: "정말 거부하시겠습니까?",
  });
  await expect(rejectionDialog).toBeVisible();
  await expectModalButtonTextToFit(
    rejectionDialog.getByRole("button", { name: "길게 눌러 결과 거부" }),
  );
  await capture(page, "match-result-rejection-dialog.png");
});

test("프로필 사진 확인 바텀시트", async ({ page }) => {
  await openMyProfile(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Jf7sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const avatarConfirmSheet = page.getByRole("dialog", { name: "프로필 사진 확인" });
  await expect(avatarConfirmSheet).toBeVisible();
  await expectBottomSheetActionTone(
    avatarConfirmSheet.getByRole("button", { name: "취소" }),
    "secondary",
  );
  await expectBottomSheetActionTone(
    avatarConfirmSheet.getByRole("button", { name: "적용" }),
    "primary",
  );
  await capture(page, "avatar-confirm-sheet.png");
});

test("상태메시지와 프로필 사진 바텀시트는 공통 액션 색상을 사용한다", async ({ page }) => {
  await openMyProfile(page);
  await page.getByRole("button", { name: "상태메시지 수정" }).click();
  const statusMessageSheet = page.getByRole("dialog", { name: "상태메시지 수정" });
  await expectBottomSheetActionTone(
    statusMessageSheet.getByRole("button", { name: "저장" }),
    "primary",
  );
  await page.getByRole("button", { name: "Close" }).last().click();
  await expect(statusMessageSheet).toBeHidden();

  await page.locator('input[type="file"]').setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Jf7sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const avatarConfirmSheet = page.getByRole("dialog", {
    name: "프로필 사진 확인",
  });
  await expectBottomSheetActionTone(
    avatarConfirmSheet.getByRole("button", { name: "취소" }),
    "secondary",
  );
  await expectBottomSheetActionTone(
    avatarConfirmSheet.getByRole("button", { name: "적용" }),
    "primary",
  );
});

test("공지 추가 바텀시트와 제거 확인 modal", async ({ page }) => {
  await openApp(page);
  await page.getByRole("tab", { name: "클럽" }).click();
  await page.getByRole("button", { name: "+ 공지 추가" }).click();
  const announcementCreateSheet = page.getByRole("dialog", { name: "공지 추가" });
  await expect(announcementCreateSheet).toBeVisible();
  await expectBottomSheetActionTone(
    announcementCreateSheet.getByRole("button", { name: "취소" }),
    "secondary",
  );
  await expectBottomSheetActionTone(
    announcementCreateSheet.getByRole("button", { name: "공지 등록" }),
    "primary",
  );
  await capture(page, "club-announcement-create-sheet.png");
  await page.getByRole("button", { name: "취소" }).click();

  await page
    .getByRole("button", { name: "토요일 오픈플레이 안내 공지 상세 보기" })
    .click();
  await page.getByRole("button", { name: "공지 메뉴" }).click();
  await page.getByRole("menuitem", { name: "제거" }).click();
  const announcementDeleteDialog = page.getByRole("dialog", {
    name: "공지 제거 확인",
  });
  await expect(announcementDeleteDialog).toBeVisible();
  await expectModalButtonTextToFit(
    announcementDeleteDialog.getByRole("button", {
      name: "길게 눌러 공지 제거",
    }),
  );
  await capture(page, "club-announcement-delete-modal.png");
});

test("생성 폼 임시 저장을 복원하거나 새로 작성할 수 있다", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const savedAt = Date.now();
    const save = (key: string, value: unknown) =>
      window.localStorage.setItem(
        key,
        JSON.stringify({ version: 1, savedAt, value }),
      );

    save("pkelo:form-draft:v1:match-create:player-me:global", {
      selectedMatchMembers: [],
      teams: [[], []],
      matchNameMode: "manual",
      matchName: "임시 매치",
      location: "임시 매치 장소",
      selectedMatchMode: "single-game",
    });
    save("pkelo:form-draft:v1:club-create:player-me:global", {
      name: "임시 클럽",
      description: "임시 클럽 소개",
    });
    save("pkelo:form-draft:v1:club-announcement-create:player-me:club-1", {
      title: "임시 공지",
      body: "임시 공지 내용",
    });
    save("pkelo:form-draft:v1:club-session-create:player-me:club-1", {
      name: "임시 세션",
      location: "임시 세션 장소",
      date: "2026-08-30T10:00",
    });
  });

  await page.getByRole("tab", { name: "내 매치" }).click();
  await page.getByRole("button", { name: "+ 매치 만들기" }).click();
  const draftRestoreDialog = page.getByRole("dialog", {
    name: "임시 저장 복원",
  });
  await expect(draftRestoreDialog).toBeVisible();
  await expectModalButtonTextToFit(
    draftRestoreDialog.getByRole("button", { name: "새로 작성" }),
  );
  await expectModalButtonTextToFit(
    draftRestoreDialog.getByRole("button", { name: "이어서 작성" }),
  );
  await draftRestoreDialog.getByRole("button", { name: "이어서 작성" }).click();
  const matchSheet = page.getByRole("dialog", { name: "Create match" });
  await expect(matchSheet.getByPlaceholder("매치 이름 입력")).toHaveValue("임시 매치");
  await expect(matchSheet.getByPlaceholder("장소 입력")).toHaveValue("임시 매치 장소");
  await matchSheet.getByRole("button", { name: "취소" }).click();

  await page.getByRole("tab", { name: "클럽" }).click();
  await page.getByRole("button", { name: "+ 클럽 만들기" }).click();
  await page.getByRole("button", { name: "이어서 작성" }).click();
  const clubSheet = page.getByRole("dialog", { name: "클럽 만들기" });
  await expect(clubSheet.getByPlaceholder("클럽 이름")).toHaveValue("임시 클럽");
  await clubSheet.getByPlaceholder("클럽 이름").fill("자동 저장 클럽");
  await expect.poll(() =>
    page.evaluate(() =>
      window.localStorage.getItem("pkelo:form-draft:v1:club-create:player-me:global"),
    ),
  ).toContain("자동 저장 클럽");
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "+ 공지 추가" }).click();
  await page.getByRole("button", { name: "이어서 작성" }).click();
  const announcementSheet = page.getByRole("dialog", { name: "공지 추가" });
  await expect(announcementSheet.getByPlaceholder("공지 제목")).toHaveValue("임시 공지");
  await announcementSheet.getByRole("button", { name: "취소" }).click();

  await page.getByRole("button", { name: "운영진 관리" }).click();
  await page.getByRole("button", { name: "이어서 작성" }).click();
  const managementDrawer = page.getByRole("dialog", { name: "클럽 운영진 관리" });
  await expect(managementDrawer.getByPlaceholder("세션 이름")).toHaveValue("임시 세션");
  await expect(managementDrawer.getByPlaceholder("장소")).toHaveValue("임시 세션 장소");
  await managementDrawer.getByRole("button", { name: "뒤로가기" }).click();

  await page.getByRole("button", { name: "+ 클럽 만들기" }).click();
  await page.getByRole("button", { name: "새로 작성" }).click();
  await expect(
    page.getByRole("dialog", { name: "클럽 만들기" }).getByPlaceholder("클럽 이름"),
  ).toHaveValue("");
  await expect.poll(() =>
    page.evaluate(() =>
      window.localStorage.getItem("pkelo:form-draft:v1:club-create:player-me:global"),
    ),
  ).toBeNull();
});
  });
}
