import cors from "cors";
import express from "express";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
import {
  DEFAULT_MATCH_MODE,
  MATCH_RESULT_MAX_SCORE_COUNT,
  isSinglesMatchType,
  inferMatchModeFromScores,
  matchModeValues,
  matchTypeLabels,
  matchTypeValues,
  type MatchMode,
  type MatchScore,
  type Session,
  type MatchType,
  validateMatchScoresForMode,
} from "@pkpkdupr/shared/match";
import type { Player, PlayerStatus } from "@pkpkdupr/shared/player";
import type { VerifyPlayerQrTokenRequest } from "@pkpkdupr/shared/qr";
import {
  DbRequestError,
  MatchRepository,
} from "./repositories/MatchRepository";
import { AuthService, type AuthenticatedSession } from "./services/AuthService";

const app: express.Express = express();
const PORT = process.env.PORT || 4000;
const AVATAR_UPLOAD_ROUTE = "/uploads/avatars";
const AVATAR_MAX_BYTES = 1024 * 1024;
const AVATAR_MIME_TO_EXT: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const defaultAvatarUploadDir =
  path.basename(process.cwd()) === "api" &&
  path.basename(path.dirname(process.cwd())) === "apps"
    ? path.resolve(process.cwd(), "../../data/uploads/avatars")
    : path.resolve(process.cwd(), "data/uploads/avatars");
const avatarUploadDir = process.env.AVATAR_UPLOAD_DIR
  ? path.resolve(process.env.AVATAR_UPLOAD_DIR)
  : defaultAvatarUploadDir;
const PROTECTED_ADMIN_USERNAME = process.env.API_ADMIN_USERNAME || "admin";
const INITIAL_ADMIN_CREATED_PASSWORD = "123qwe";
const domain = process.env.DOMAIN || "pkpkdupr.duckdns.org";
const webPublicPort = process.env.WEB_PUBLIC_PORT || "443";
const adminStackPort =
  process.env.ADMIN_STACK_PORT || process.env.PROXY_PORT || "3333";
const webOrigin =
  webPublicPort === "443"
    ? `https://${domain}`
    : `https://${domain}:${webPublicPort}`;
const adminStackOrigin = `https://${domain}:${adminStackPort}`;
const allowedOrigins = new Set([
  webOrigin,
  adminStackOrigin,
  "https://neiz-office.fedev.kakao.com",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:3100",
  "http://127.0.0.1:3100",
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`허용되지 않은 Origin입니다: ${origin}`));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(AVATAR_UPLOAD_ROUTE, express.static(avatarUploadDir));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "PkpkDupr API is running!",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/ping", (_req, res) => {
  res.json({ message: "pong" });
});

const authService = new AuthService();
const matchRepository = new MatchRepository();
const playerStatuses: PlayerStatus[] = ["active", "inactive"];
const playerGenders: Array<Player["gender"]> = ["M", "F"];

type CreateMatchRequest = {
  name?: string;
  type?: MatchType;
  mode?: MatchMode;
  teams?: [
    { name?: string; playerIds?: string[] },
    { name?: string; playerIds?: string[] },
  ];
  location?: string;
  scheduledAt?: string;
};

type MatchTeamRequest = { name?: string; playerIds?: string[] };

type MatchSessionRequest = {
  name?: string;
  date?: string;
};

type AdminBatchMatchRequest = {
  session?: MatchSessionRequest;
  matches?: Array<{
    name?: string;
    type?: MatchType;
    mode?: MatchMode;
    teams?: [MatchTeamRequest, MatchTeamRequest];
    location?: string;
    scheduledAt?: string;
    scores?: MatchScore[];
  }>;
};

type SubmitMatchResultRequest = {
  scores?: MatchScore[];
};

type AdminMatchMetadataUpdateRequest = {
  name?: unknown;
  sessionName?: unknown;
  sessionDate?: unknown;
};

const normalizeOptionalName = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const normalizeMatchSession = (
  session: MatchSessionRequest | undefined,
): Session | undefined => {
  if (!session) {
    return undefined;
  }

  const name = normalizeOptionalName(session.name);
  const dateValue = typeof session.date === "string" ? session.date : undefined;

  if (!name && !dateValue) {
    return undefined;
  }

  if (!name) {
    throw new Error("세션명이 필요합니다.");
  }

  if (!dateValue) {
    throw new Error("세션 날짜를 입력해주세요.");
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error("유효한 세션 날짜가 필요합니다.");
  }

  return { name, date };
};

const normalizeOptionalDateString = (value: unknown) => {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("유효한 세션 날짜가 필요합니다.");
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error("유효한 세션 날짜가 필요합니다.");
  }

  return date.toISOString();
};

const validateSessionMetadataUpdate = ({
  hasSessionName,
  hasSessionDate,
  sessionName,
  sessionDate,
}: {
  hasSessionName: boolean;
  hasSessionDate: boolean;
  sessionName: string | undefined;
  sessionDate: string | null;
}) => {
  const hasEffectiveSessionName = Boolean(sessionName);
  const hasEffectiveSessionDate = Boolean(sessionDate);

  if (!hasSessionName && !hasSessionDate) {
    return;
  }

  if (!hasEffectiveSessionName && !hasEffectiveSessionDate) {
    return;
  }

  if (!hasEffectiveSessionName) {
    throw new Error("세션명이 필요합니다.");
  }

  if (!hasEffectiveSessionDate) {
    throw new Error("세션 날짜를 입력해주세요.");
  }
};

const isMatchType = (value: unknown): value is MatchType =>
  typeof value === "string" && matchTypeValues.includes(value as MatchType);

const isMatchMode = (value: unknown): value is MatchMode =>
  typeof value === "string" && matchModeValues.includes(value as MatchMode);

const isMixedDoublesTeamValid = (players: Player[]) =>
  players.length === 2 &&
  players.some((player) => player.gender === "M") &&
  players.some((player) => player.gender === "F");

const validateCreateMatchTeams = (
  matchType: MatchType,
  teams: [Player[], Player[]],
) => {
  if (isSinglesMatchType(matchType)) {
    return teams.every((team) => team.length === 1);
  }

  if (matchType === "mixed-doubles") {
    return teams.every(isMixedDoublesTeamValid);
  }

  if (matchType === "men-doubles") {
    return teams.every(
      (team) =>
        team.length === 2 && team.every((player) => player.gender === "M"),
    );
  }

  if (matchType === "women-doubles") {
    return teams.every(
      (team) =>
        team.length === 2 && team.every((player) => player.gender === "F"),
    );
  }

  return teams.every((team) => team.length === 2);
};

const inferMatchTypeFromTeams = (teams: [Player[], Player[]]): MatchType => {
  if (teams.every((team) => team.length === 1)) {
    const [firstPlayer, secondPlayer] = teams.flat();

    if (!firstPlayer || !secondPlayer) {
      throw new Error("유효한 팀 구성이 필요합니다.");
    }

    return firstPlayer.gender === secondPlayer.gender
      ? "unrestricted-singles"
      : "singles";
  }

  if (!teams.every((team) => team.length === 2)) {
    throw new Error("유효한 팀 구성이 필요합니다.");
  }

  const [teamA, teamB] = teams;
  const allPlayers = [...teamA, ...teamB];
  const menCount = allPlayers.filter((player) => player.gender === "M").length;
  const womenCount = allPlayers.filter(
    (player) => player.gender === "F",
  ).length;

  if (isMixedDoublesTeamValid(teamA) && isMixedDoublesTeamValid(teamB)) {
    return "mixed-doubles";
  }

  if (menCount === 4) {
    return "men-doubles";
  }

  if (womenCount === 4) {
    return "women-doubles";
  }

  return "unrestricted-doubles";
};

const normalizeRequestedTeamPlayerIds = (
  teams: [MatchTeamRequest, MatchTeamRequest],
) => {
  const flatPlayerIds = teams.flatMap((team) => team.playerIds ?? []);
  const uniquePlayerIds = new Set(flatPlayerIds);

  if (uniquePlayerIds.size !== flatPlayerIds.length) {
    throw new Error("중복된 멤버가 있습니다.");
  }

  return flatPlayerIds;
};

const buildMatchTeamsFromRequests = (
  teams: [MatchTeamRequest, MatchTeamRequest],
  playersById: Map<string, Player>,
) =>
  teams.map((team, teamIndex) => {
    const playerIds = team.playerIds ?? [];
    const players = playerIds.map((playerId) => playersById.get(playerId));

    if (players.some((player) => !player)) {
      throw new Error("유효하지 않은 멤버가 포함되어 있습니다.");
    }

    return {
      id: `team-${Date.now()}-${teamIndex === 0 ? "a" : "b"}`,
      name: team.name?.trim() || `Team ${teamIndex === 0 ? "A" : "B"}`,
      players: players as Player[],
    };
  }) as [
    { id: string; name: string; players: Player[] },
    { id: string; name: string; players: Player[] },
  ];

const normalizeMatchScores = (scores: unknown): MatchScore[] => {
  if (!Array.isArray(scores) || scores.length === 0) {
    throw new Error("한 개 이상의 스코어가 필요합니다.");
  }

  if (scores.length > MATCH_RESULT_MAX_SCORE_COUNT) {
    throw new Error(
      `스코어는 최대 ${MATCH_RESULT_MAX_SCORE_COUNT}개까지 입력할 수 있습니다.`,
    );
  }

  return scores.map((score, index) => {
    const scoreA = Number((score as MatchScore | undefined)?.scoreA);
    const scoreB = Number((score as MatchScore | undefined)?.scoreB);

    if (
      !Number.isInteger(scoreA) ||
      !Number.isInteger(scoreB) ||
      scoreA < 0 ||
      scoreB < 0 ||
      scoreA === scoreB
    ) {
      throw new Error(`${index + 1}번째 스코어가 유효하지 않습니다.`);
    }

    return { scoreA, scoreB };
  });
};

const parseAvatarDataUrl = (value: unknown) => {
  if (typeof value !== "string") {
    throw new Error("이미지 데이터가 필요합니다.");
  }

  const match = value.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/,
  );
  if (!match) {
    throw new Error("지원하지 않는 이미지 형식입니다.");
  }

  const [, mime, base64] = match;
  const ext = AVATAR_MIME_TO_EXT[mime];
  if (!ext) {
    throw new Error("지원하지 않는 이미지 형식입니다.");
  }

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) {
    throw new Error("이미지 데이터가 비어 있습니다.");
  }

  if (buffer.length > AVATAR_MAX_BYTES) {
    throw new Error("프로필 이미지는 1MB 이하만 업로드할 수 있습니다.");
  }

  return { buffer, ext };
};

const getLocalAvatarPath = (avatarUrl?: string | null) => {
  if (!avatarUrl?.startsWith(`${AVATAR_UPLOAD_ROUTE}/`)) {
    return null;
  }

  const fileName = path.basename(avatarUrl);
  if (
    !fileName ||
    fileName !== avatarUrl.slice(AVATAR_UPLOAD_ROUTE.length + 1)
  ) {
    return null;
  }

  return path.join(avatarUploadDir, fileName);
};

const removeLocalAvatarIfExists = async (avatarUrl?: string | null) => {
  const avatarPath = getLocalAvatarPath(avatarUrl);
  if (!avatarPath) {
    return;
  }

  await fs.unlink(avatarPath).catch(() => undefined);
};

const getBearerToken = (req: express.Request, res: express.Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "토큰이 필요합니다." });
    return null;
  }
  return header.split(" ")[1];
};

const getAuthSession = async (
  req: express.Request,
  res: express.Response,
): Promise<AuthenticatedSession | null> => {
  const token = getBearerToken(req, res);
  if (!token) {
    return null;
  }

  try {
    return await authService.authenticateAccessToken(token);
  } catch (err) {
    res.status(403).json({ error: (err as Error).message });
    return null;
  }
};

const getAuthPayload = async (req: express.Request, res: express.Response) => {
  const session = await getAuthSession(req, res);
  return session?.payload ?? null;
};

const requireAdmin = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const session = await getAuthSession(req, res);
  if (!session) {
    return;
  }
  if (!session.payload.isAdmin) {
    return res.status(403).json({ error: "관리자 권한이 필요합니다." });
  }
  next();
};

app.post("/api/register", async (req, res) => {
  try {
    const { username, password, gender } = req.body;
    if (!username || !password || !gender) {
      return res
        .status(400)
        .json({ error: "username, password, gender는 필수입니다." });
    }
    const player = await authService.register({ username, password, gender });
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "username과 password는 필수입니다." });
    }
    const result = await authService.login(
      username,
      password,
      rememberMe === true,
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/me", async (req, res) => {
  try {
    const session = await getAuthSession(req, res);
    if (!session) {
      return;
    }
    res.json({
      ...session.player,
      isFirstLogin: session.isFirstLogin,
      accessToken: session.refreshedAccessToken,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/players", async (req, res) => {
  try {
    const decoded = await getAuthPayload(req, res);
    if (!decoded) {
      return;
    }

    const players = await authService.getPublicPlayers();
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/player-qr-token", async (req, res) => {
  try {
    const decoded = await getAuthPayload(req, res);
    if (!decoded) {
      return;
    }

    const result = await authService.createPlayerQrToken(decoded.playerId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.get("/api/dev/player-qr-tokens", async (_req, res) => {
  try {
    const result = await authService.getDevPlayerQrTokens();
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

app.post("/api/player-qr-token/verify", async (req, res) => {
  try {
    if (!(await getAuthPayload(req, res))) {
      return;
    }

    const { payload } = req.body as VerifyPlayerQrTokenRequest;
    if (!payload) {
      return res.status(400).json({ error: "payload는 필수입니다." });
    }

    const result = await authService.verifyPlayerQrToken(payload);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.get("/api/matches", async (req, res) => {
  try {
    const decoded = await getAuthPayload(req, res);
    if (!decoded) {
      return;
    }

    const page = Number(req.query.page ?? 0);
    const limit = Number(req.query.limit ?? 20);
    const playerId =
      typeof req.query.playerId === "string" ? req.query.playerId : undefined;

    const result = playerId
      ? await matchRepository.findByPlayerId(playerId, page, limit)
      : await matchRepository.findAll(page, limit);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/matches", async (req, res) => {
  try {
    const decoded = await getAuthPayload(req, res);
    if (!decoded) {
      return;
    }

    const { name, type, mode, teams, location, scheduledAt } =
      req.body as CreateMatchRequest;
    if (type != null && !isMatchType(type)) {
      return res.status(400).json({ error: "유효한 매치 타입이 필요합니다." });
    }
    if (mode != null && !isMatchMode(mode)) {
      return res.status(400).json({ error: "유효한 경기 모드가 필요합니다." });
    }

    if (!teams || teams.length !== 2) {
      return res.status(400).json({ error: "두 팀 구성이 필요합니다." });
    }

    const creator = await authService.getPlayerById(decoded.playerId);
    if (
      !creator ||
      creator.status !== "active" ||
      creator.username === PROTECTED_ADMIN_USERNAME
    ) {
      return res
        .status(403)
        .json({ error: "매치를 생성할 수 없는 계정입니다." });
    }

    const publicPlayers = await authService.getPublicPlayers();
    const playersById = new Map<string, Player>(
      [creator, ...publicPlayers].map((player) => [player.id, player]),
    );
    const flatPlayerIds = normalizeRequestedTeamPlayerIds(teams);
    if (!flatPlayerIds.includes(decoded.playerId)) {
      return res
        .status(400)
        .json({ error: "매치 멤버에 본인이 포함되어야 합니다." });
    }

    const matchTeams = buildMatchTeamsFromRequests(teams, playersById);
    const resolvedMatchType = type
      ? type
      : inferMatchTypeFromTeams([matchTeams[0].players, matchTeams[1].players]);

    if (
      !validateCreateMatchTeams(resolvedMatchType, [
        matchTeams[0].players,
        matchTeams[1].players,
      ])
    ) {
      return res.status(400).json({
        error: `${matchTypeLabels[resolvedMatchType]}에 맞는 유효한 팀 구성이 필요합니다.`,
      });
    }

    const scheduledDate = scheduledAt ? new Date(scheduledAt) : new Date();
    if (Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ error: "유효한 경기 시간이 필요합니다." });
    }

    const match = await matchRepository.create({
      name: normalizeOptionalName(name),
      type: resolvedMatchType,
      mode: mode ?? DEFAULT_MATCH_MODE,
      source: "player_created",
      creatorPlayerId: decoded.playerId,
      status: "created",
      teams: matchTeams,
      scores: [],
      resultSubmittedByPlayerId: null,
      resultSubmittedAt: null,
      approvals: [],
      location: location?.trim() || "Court TBD",
      scheduledAt: scheduledDate,
      completedAt: null,
    });

    res.status(201).json(match);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/admin/matches/batch", requireAdmin, async (req, res) => {
  try {
    const decoded = await getAuthPayload(req, res);
    if (!decoded) {
      return;
    }

    const { matches: payloadMatches, session: requestedSession } =
      req.body as AdminBatchMatchRequest;
    if (!Array.isArray(payloadMatches) || payloadMatches.length === 0) {
      return res.status(400).json({ error: "한 개 이상의 경기가 필요합니다." });
    }

    const commonSession = normalizeMatchSession(requestedSession);

    const createdBy = await authService.getPlayerById(decoded.playerId);
    if (!createdBy || createdBy.status !== "active") {
      return res
        .status(403)
        .json({ error: "유효한 관리자 계정이 필요합니다." });
    }

    const allPlayers = await authService.getAllPlayers();
    const availablePlayers = allPlayers.filter(
      (candidate) =>
        candidate.status === "active" &&
        candidate.username !== PROTECTED_ADMIN_USERNAME,
    );
    const playersById = new Map<string, Player>(
      availablePlayers.map((player) => [player.id, player]),
    );
    const matchesToCreate = payloadMatches.map((requestedMatch, index) => {
      const label = `${index + 1}번째 경기`;
      const { name, type, mode, teams, location, scheduledAt, scores } =
        requestedMatch;

      if (!isMatchType(type)) {
        throw new Error(`${label}: 유효한 매치 타입이 필요합니다.`);
      }
      if (mode != null && !isMatchMode(mode)) {
        throw new Error(`${label}: 유효한 경기 모드가 필요합니다.`);
      }

      if (!teams || teams.length !== 2) {
        throw new Error(`${label}: 두 팀 구성이 필요합니다.`);
      }

      const flatPlayerIds = normalizeRequestedTeamPlayerIds(teams);
      if (flatPlayerIds.length === 0) {
        throw new Error(`${label}: 참가자를 선택해주세요.`);
      }

      const matchTeams = buildMatchTeamsFromRequests(teams, playersById);
      if (
        !validateCreateMatchTeams(type, [
          matchTeams[0].players,
          matchTeams[1].players,
        ])
      ) {
        throw new Error(
          `${label}: ${matchTypeLabels[type]}에 맞는 유효한 팀 구성이 필요합니다.`,
        );
      }

      const scheduledDate = scheduledAt ? new Date(scheduledAt) : new Date();
      if (Number.isNaN(scheduledDate.getTime())) {
        throw new Error(`${label}: 유효한 경기 시간이 필요합니다.`);
      }

      const normalizedScores = normalizeMatchScores(scores);
      const resolvedMode = mode ?? inferMatchModeFromScores(normalizedScores);
      validateMatchScoresForMode(resolvedMode, normalizedScores);

      return {
        id: `admin-match-${Date.now()}-${index}-${randomUUID()}`,
        name: normalizeOptionalName(name),
        session: commonSession,
        type,
        mode: resolvedMode,
        source: "admin_created_result" as const,
        creatorPlayerId: createdBy.id,
        status: "completed" as const,
        teams: matchTeams,
        scores: normalizedScores,
        resultSubmittedByPlayerId: createdBy.id,
        resultSubmittedAt: scheduledDate,
        approvals: [],
        location: location?.trim() || "Court TBD",
        scheduledAt: scheduledDate,
        completedAt: scheduledDate,
      };
    });

    const createdMatches = [];
    for (const matchInput of matchesToCreate) {
      createdMatches.push(await matchRepository.create(matchInput));
    }

    const { matches } = await matchRepository.findAll(0, 10000);
    const completedMatches = matches.filter(
      (match) => match.status === "completed",
    );
    const recalculation = await authService.recalculateDuprRatings(
      completedMatches,
      {
        source: "manual_recalculation",
        sourceLogId: `admin-match-batch-${Date.now()}-${randomUUID()}`,
      },
    );

    res.status(201).json({
      matches: createdMatches,
      createdCount: createdMatches.length,
      completedMatchCount: completedMatches.length,
      ...recalculation,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.get("/api/admin/matches", requireAdmin, async (_req, res) => {
  try {
    const result = await matchRepository.findAll(0, 10000);
    res.json(result.matches);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.patch(
  "/api/admin/matches/:matchId/metadata",
  requireAdmin,
  async (req, res) => {
    try {
      const body = req.body as AdminMatchMetadataUpdateRequest;
      const hasName = Object.prototype.hasOwnProperty.call(body, "name");
      const hasSessionName = Object.prototype.hasOwnProperty.call(
        body,
        "sessionName",
      );
      const hasSessionDate = Object.prototype.hasOwnProperty.call(
        body,
        "sessionDate",
      );

      if (!hasName && !hasSessionName && !hasSessionDate) {
        return res.status(400).json({ error: "수정할 필드가 없습니다." });
      }

      const normalizedSessionName = hasSessionName
        ? normalizeOptionalName(body.sessionName)
        : undefined;
      const normalizedSessionDate = hasSessionDate
        ? normalizeOptionalDateString(body.sessionDate)
        : undefined;

      validateSessionMetadataUpdate({
        hasSessionName,
        hasSessionDate,
        sessionName: normalizedSessionName,
        sessionDate: normalizedSessionDate ?? null,
      });

      const match = await matchRepository.updateMetadata(req.params.matchId, {
        ...(hasName ? { name: normalizeOptionalName(body.name) ?? null } : {}),
        ...(hasSessionName
          ? { sessionName: normalizedSessionName ?? null }
          : {}),
        ...(hasSessionDate
          ? { sessionDate: normalizedSessionDate ?? null }
          : {}),
      });

      res.json(match);
    } catch (err) {
      if (err instanceof DbRequestError && err.status === 404) {
        return res.status(404).json({ error: err.message });
      }
      res.status(400).json({ error: (err as Error).message });
    }
  },
);

app.get("/api/matches/:matchId", async (req, res) => {
  try {
    if (!(await getAuthPayload(req, res))) {
      return;
    }

    const match = await matchRepository.findById(req.params.matchId);
    if (!match) {
      return res.status(404).json({ error: "매치를 찾을 수 없습니다." });
    }

    res.json(match);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/matches/:matchId/result", async (req, res) => {
  try {
    const decoded = await getAuthPayload(req, res);
    if (!decoded) {
      return;
    }

    const { scores } = req.body as SubmitMatchResultRequest;
    const normalizedScores = normalizeMatchScores(scores);
    const match = await matchRepository.submitResult(
      req.params.matchId,
      decoded.playerId,
      normalizedScores,
    );

    res.json(match);
  } catch (err) {
    if (err instanceof DbRequestError && err.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/matches/:matchId/approval", async (req, res) => {
  try {
    const decoded = await getAuthPayload(req, res);
    if (!decoded) {
      return;
    }

    const match = await matchRepository.approveResult(
      req.params.matchId,
      decoded.playerId,
    );

    if (match.status === "completed") {
      await authService.applyMatchResultToRatings(match);
    }

    res.json(match);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.delete("/api/matches/:matchId/approval", async (req, res) => {
  try {
    const decoded = await getAuthPayload(req, res);
    if (!decoded) {
      return;
    }

    const match = await matchRepository.cancelApproval(
      req.params.matchId,
      decoded.playerId,
    );

    res.json(match);
  } catch (err) {
    if (err instanceof DbRequestError && err.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/change-password", async (req, res) => {
  try {
    const decoded = await getAuthPayload(req, res);
    if (!decoded) {
      return;
    }
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "비밀번호는 6자 이상이어야 합니다." });
    }
    await authService.changePassword(
      decoded.playerId,
      typeof currentPassword === "string" ? currentPassword : undefined,
      newPassword,
    );
    res.json({ message: "비밀번호가 변경되었습니다." });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.patch("/api/me/profile", async (req, res) => {
  try {
    const decoded = await getAuthPayload(req, res);
    if (!decoded) {
      return;
    }

    const { avatarUrl } = req.body as { avatarUrl?: string | null };
    if (
      typeof avatarUrl === "string" &&
      avatarUrl.trim().length > 0 &&
      avatarUrl.trim().length > 2048
    ) {
      return res
        .status(400)
        .json({ error: "프로필 이미지 URL이 너무 깁니다." });
    }

    const player = await authService.updatePlayerProfile(decoded.playerId, {
      avatarUrl,
    });
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/me/avatar", async (req, res) => {
  let nextAvatarPath: string | null = null;

  try {
    const decoded = await getAuthPayload(req, res);
    if (!decoded) {
      return;
    }

    const previousPlayer = await authService.getPlayerById(decoded.playerId);
    if (!previousPlayer) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }

    const { imageDataUrl } = req.body as { imageDataUrl?: unknown };
    const { buffer, ext } = parseAvatarDataUrl(imageDataUrl);
    const fileName = `${decoded.playerId}-${Date.now()}-${randomUUID()}.${ext}`;
    const avatarUrl = `${AVATAR_UPLOAD_ROUTE}/${fileName}`;
    nextAvatarPath = path.join(avatarUploadDir, fileName);

    await fs.mkdir(avatarUploadDir, { recursive: true });
    await fs.writeFile(nextAvatarPath, buffer);

    const player = await authService.updatePlayerProfile(decoded.playerId, {
      avatarUrl,
    });
    await removeLocalAvatarIfExists(previousPlayer.avatarUrl);

    res.json(player);
  } catch (err) {
    if (nextAvatarPath) {
      await fs.unlink(nextAvatarPath).catch(() => undefined);
    }
    res.status(400).json({ error: (err as Error).message });
  }
});

app.delete("/api/me/avatar", async (req, res) => {
  try {
    const decoded = await getAuthPayload(req, res);
    if (!decoded) {
      return;
    }

    const previousPlayer = await authService.getPlayerById(decoded.playerId);
    if (!previousPlayer) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }

    const player = await authService.updatePlayerProfile(decoded.playerId, {
      avatarUrl: null,
    });
    await removeLocalAvatarIfExists(previousPlayer.avatarUrl);

    res.json(player);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/admin/players", requireAdmin, async (_req, res) => {
  try {
    const players = await authService.getAdminPlayers();
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/admin/player-creation-logs", requireAdmin, async (_req, res) => {
  try {
    const logs = await authService.getPlayerCreationLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/admin/player-status-logs", requireAdmin, async (_req, res) => {
  try {
    const logs = await authService.getPlayerStatusLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.patch(
  "/api/admin/players/:playerId/gender",
  requireAdmin,
  async (req, res) => {
    try {
      const decoded = await getAuthPayload(req, res);
      if (!decoded) {
        return;
      }

      const { gender } = req.body as { gender?: Player["gender"] };
      if (!gender || !playerGenders.includes(gender)) {
        return res
          .status(400)
          .json({ error: "gender는 M 또는 F 여야 합니다." });
      }

      const result = await authService.updatePlayerGender(
        req.params.playerId,
        gender,
        decoded.playerId,
      );

      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  },
);

app.patch(
  "/api/admin/players/:playerId/status",
  requireAdmin,
  async (req, res) => {
    try {
      const decoded = await getAuthPayload(req, res);
      if (!decoded) {
        return;
      }

      const { status } = req.body as { status?: PlayerStatus };
      if (!status || !playerStatuses.includes(status)) {
        return res
          .status(400)
          .json({ error: "status는 active 또는 inactive 여야 합니다." });
      }

      const result = await authService.updatePlayerStatus(
        req.params.playerId,
        status,
        decoded.playerId,
      );

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  },
);

app.post(
  "/api/admin/players/:playerId/password-reset",
  requireAdmin,
  async (req, res) => {
    try {
      const decoded = await getAuthPayload(req, res);
      if (!decoded) {
        return;
      }

      const { password } = req.body as { password?: unknown };
      if (typeof password !== "string" || password.length < 6) {
        return res
          .status(400)
          .json({ error: "임시 비밀번호는 6자 이상이어야 합니다." });
      }

      const player = await authService.resetPlayerPassword(
        req.params.playerId,
        password,
        decoded.playerId,
      );

      res.json({ player });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  },
);

app.post("/api/admin/ratings/recalculate", requireAdmin, async (_req, res) => {
  try {
    const { matches } = await matchRepository.findAll(0, 10000);
    const completedMatches = matches.filter(
      (match) => match.status === "completed",
    );
    const result = await authService.recalculateDuprRatings(completedMatches, {
      source: "manual_recalculation",
      sourceLogId: `manual-recalculation-${Date.now()}-${randomUUID()}`,
    });

    res.json({
      ...result,
      completedMatchCount: completedMatches.length,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post(
  "/api/admin/players/:playerId/official-dupr",
  requireAdmin,
  async (req, res) => {
    try {
      const decoded = await getAuthPayload(req, res);
      if (!decoded) {
        return;
      }

      const { matches } = await matchRepository.findAll(0, 10000);
      const result = await authService.applyOfficialDuprAdjustment(
        {
          playerId: req.params.playerId,
          changedByPlayerId: decoded.playerId,
          ratings: req.body.ratings,
          confidence: req.body.confidence,
          reason: req.body.reason,
        },
        matches.filter((match) => match.status === "completed"),
      );

      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  },
);

app.post(
  "/api/admin/players/:playerId/official-dupr/preview",
  requireAdmin,
  async (req, res) => {
    try {
      const decoded = await getAuthPayload(req, res);
      if (!decoded) {
        return;
      }

      const { matches } = await matchRepository.findAll(0, 10000);
      const result = await authService.previewOfficialDuprAdjustment(
        {
          playerId: req.params.playerId,
          changedByPlayerId: decoded.playerId,
          ratings: req.body.ratings,
          confidence: req.body.confidence,
          reason: req.body.reason,
        },
        matches.filter((match) => match.status === "completed"),
      );

      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  },
);

app.post("/api/admin/register", requireAdmin, async (req, res) => {
  try {
    const decoded = await getAuthPayload(req, res);
    if (!decoded) {
      return;
    }

    const { username, gender } = req.body;
    if (!username || !gender) {
      return res.status(400).json({ error: "username, gender는 필수입니다." });
    }
    const player = await authService.registerAdmin(
      { username, password: INITIAL_ADMIN_CREATED_PASSWORD, gender },
      decoded.playerId,
    );
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export { app };

export const startServer = async () => {
  await authService.initAdmin();
  return (app as any).listen(PORT, () => {
    console.log(`🚀 API Server running on http://localhost:${PORT}`);
    console.log(
      `👤 Admin 계정 동기화 (${process.env.API_ADMIN_USERNAME || "admin"} / ${process.env.API_ADMIN_PASSWORD || "admin123qwe"})`,
    );
  });
};

if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
  void startServer();
}
