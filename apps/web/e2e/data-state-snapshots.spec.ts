import { expect, test, type Page, type Route } from "@playwright/test";

type FixtureOptions = {
  authenticated?: boolean;
  clubEmpty?: boolean;
  historyEmpty?: boolean;
  longProfileName?: boolean;
  matchFeedEmpty?: boolean;
  memberEmpty?: boolean;
  profileEmpty?: boolean;
  qrError?: boolean;
  sessionEmpty?: boolean;
  useFixedClock?: boolean;
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
  isFirstLogin: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-08-12T00:00:00.000Z",
};

const jiwoo = {
  id: "player-jiwoo",
  username: "박지우",
  gender: "F",
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
});

const club = {
  id: "club-1",
  name: "한강 피클볼",
  description: "함께 성장하는 주말 피클볼 클럽",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
};

const clubDashboard = (empty = false) => ({
  club,
  membership: {
    clubId: club.id,
    playerId: me.id,
    role: "owner",
    status: "active",
    requestedAt: "2026-01-01T00:00:00.000Z",
    joinedAt: "2026-01-01T00:00:00.000Z",
  },
  upcomingSessions: empty
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
          body: "오전 10시에 A 코트에서 만나요.",
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
  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname;
    const profile = profileSummary(options.profileEmpty);
    const dashboard = clubDashboard(options.profileEmpty);

    if (path === "/api/runtime-notice") {
      return fulfillJson(route, { enabled: false });
    }
    if (path === "/api/me") {
      return fulfillJson(route, {
        ...me,
        username: options.longProfileName
          ? "김하늘🎾Alice피클볼이름이길어도아이디옆에서최대한길게표시합니다"
          : me.username,
        isFirstLogin: false,
      });
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
            { kind: "match", match: primaryMatch },
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
                  role: "owner",
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
      const matches = options.historyEmpty ? [] : [primaryMatch, secondaryMatch];
      return fulfillJson(route, { matches, total: matches.length });
    }
    if (path === `/api/matches/${primaryMatch.id}`) {
      return fulfillJson(route, primaryMatch);
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
};

const capture = (page: Page, name: string) =>
  expect(page).toHaveScreenshot(name, {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
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

test("카카오 로그인 화면", async ({ page }) => {
  await installFixture(page, { authenticated: false });
  await page.goto("http://pkelo.localhost:4173/login");
  await expect(page.getByRole("link", { name: "카카오 로그인" })).toBeVisible();
  await capture(page, "kakao-login.png");
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
  await page.getByRole("button", { name: "테스트 복식 매치 상세 보기" }).click();
  await expect(page.getByRole("dialog", { name: "매치 상세" })).toBeVisible();
  await capture(page, "match-detail--with-data.png");
  await page.getByRole("button", { name: "뒤로가기" }).click();
  await expect(page.getByRole("dialog", { name: "매치 상세" })).toBeHidden();
  await page.getByRole("button", { name: "토요 오픈플레이 세션 상세 보기" }).click();
  await expect(page.getByRole("dialog", { name: "세션 상세" })).toBeVisible();
  await capture(page, "session-detail--with-data.png");

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await openApp(page, { sessionEmpty: true });
  await page.getByRole("tab", { name: "내 매치" }).click();
  await page.getByRole("button", { name: "토요 오픈플레이 세션 상세 보기" }).click();
  await expect(page.getByRole("dialog", { name: "세션 상세" })).toBeVisible();
  await expect(page.getByText("이 세션에 표시할 내 경기가 없어요.")).toBeVisible();
  await capture(page, "session-detail--empty.png");
});

test("매치 생성 바텀시트와 내 QR modal", async ({ page }) => {
  await openApp(page);
  await page.getByRole("tab", { name: "내 매치" }).click();
  await page.getByRole("button", { name: "+ 매치 만들기" }).click();
  await expect(page.getByRole("dialog", { name: "Create match" })).toBeVisible();
  await capture(page, "create-match-sheet.png");

  await page.getByRole("button", { name: "취소" }).click();
  await page.getByRole("button", { name: "내 QR 코드 열기" }).click();
  await expect(page.getByRole("dialog", { name: "내 QR 코드" })).toBeVisible();
  await capture(page, "player-qr-modal--with-data.png");

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await openApp(page, { qrError: true });
  await page.getByRole("button", { name: "내 QR 코드 열기" }).click();
  await expect(page.getByText("QR 코드를 생성하지 못했어요.")).toBeVisible();
  await capture(page, "player-qr-modal--empty.png");
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
});

test("멤버 프로필과 전체 매치 drawer의 with-data와 empty 상태", async ({ page }) => {
  await openMemberProfile(page);
  await expect(page.getByText("최근 매치")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "최고 평점" }),
  ).toContainText("4.120");
  await capture(page, "member-profile--with-data.png");
  await page.getByRole("button", { name: "전체 보기" }).click();
  const profileMatchHistoryDrawer = page.getByRole("dialog", {
    name: "전체 매치",
  });
  await expect(profileMatchHistoryDrawer).toBeVisible();
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
  await expect(page.getByText("완료된 매치가 없어요.", { exact: true })).toBeVisible();
  await emptyProfileMatchHistoryDrawer.evaluate((element) => {
    const spacer = document.createElement("div");
    spacer.style.height = "1000px";
    element.append(spacer);
    element.scrollTo({ top: 120 });
  });
  await expect
    .poll(() => emptyProfileMatchHistoryDrawer.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await capture(page, "profile-match-history--empty.png");
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
  await expect(page.getByRole("dialog", { name: "상태메시지 수정" })).toBeVisible();
  await capture(page, "status-message-sheet--with-data.png");

  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "전체 보기" }).click();
  const myProfileMatchHistoryDrawer = page.getByRole("dialog", {
    name: "전체 매치",
  });
  await expect(myProfileMatchHistoryDrawer).toBeVisible();
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
    .toMatch(/^김하늘🎾.*…$/);
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
  await capture(page, "affiliations--with-data.png");
  await page.getByRole("button", { name: "운영진 관리" }).click();
  await expect(page.getByRole("dialog", { name: "클럽 운영진 관리" })).toBeVisible();
  await capture(page, "club-management--with-data.png");
  await page.getByRole("button", { name: "뒤로가기" }).click();
  await page.getByRole("button", { name: "한강 피클볼의 매치 전체 보기" }).click();
  await expect(page.getByRole("dialog", { name: "한강 피클볼의 매치 전체" })).toBeVisible();
  await capture(page, "club-match-history--with-data.png");

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await openApp(page, { clubEmpty: true });
  await page.getByRole("tab", { name: "클럽" }).click();
  await expect(
    page.getByText("클럽을 만들거나 클럽 구성원에게 초대받아보세요."),
  ).toBeVisible();
  await capture(page, "affiliations--empty.png");
  await page.getByRole("button", { name: "+ 클럽 만들기" }).click();
  await expect(page.getByRole("dialog", { name: "클럽 만들기" })).toBeVisible();
  await capture(page, "club-create-sheet.png");
});

test("클럽 공지는 drawer에서 전체 내용을 보여준다", async ({ page }) => {
  await openApp(page);
  await page.getByRole("tab", { name: "클럽" }).click();

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
  await capture(page, "club-announcement-detail--with-data.png");
  await announcementDetail.getByRole("button", { name: "뒤로가기" }).click();
  await expect(announcementDetail).toHaveCount(0);

  await page.getByRole("button", { name: "운영진 관리" }).click();
  const managementDrawer = page.getByRole("dialog", {
    name: "클럽 운영진 관리",
  });
  const managementAnnouncementButton = managementDrawer.getByRole("button", {
    name: "토요일 오픈플레이 안내 공지 상세 보기",
  });
  await expect(managementAnnouncementButton).toBeVisible();
  await managementAnnouncementButton.click();

  await expect(announcementDetail).toBeVisible();
  await expect(
    announcementDetail.getByText("오전 10시에 A 코트에서 만나요."),
  ).toBeVisible();
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
  await expect(clubManagementDrawer.getByText("공지 관리")).toBeVisible();
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

test("설정 탭과 로그아웃 확인 modal", async ({ page }) => {
  await openApp(page);
  await page.getByRole("tab", { name: "설정" }).click();
  await expect(page.getByRole("heading", { name: "앱 버전" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "계정" })).toBeHidden();
  await capture(page, "settings.png");
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByRole("dialog", { name: "로그아웃 확인" })).toBeVisible();
  await capture(page, "logout-modal.png");
});
