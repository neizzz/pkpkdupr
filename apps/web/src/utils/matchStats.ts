import { getMatchTopLevelType } from "@pkpkdupr/shared/match";
import type { PlayerRatingChangeLog } from "@pkpkdupr/shared/player";
import type { MatchInfo } from "@/components/Match";
import type {
  ProfileMatchListItem,
  ProfileMatchOutcome,
} from "@/components/ProfileMatchList";
import type {
  MemberProfileMatchStats,
  MemberProfileRatingDelta,
  MemberProfileRatingHistory,
} from "@/components/MemberProfile";

export const createEmptyMatchStats = (): MemberProfileMatchStats => ({
  singles: { matchWins: 0, matchLosses: 0, setWins: 0, setLosses: 0 },
  doubles: { matchWins: 0, matchLosses: 0, setWins: 0, setLosses: 0 },
});

export const createEmptyRatingDelta = (): MemberProfileRatingDelta => ({
  singles: { last7Days: 0, last30Days: 0 },
  doubles: { last7Days: 0, last30Days: 0 },
});

export const createEmptyRatingHistory = (): MemberProfileRatingHistory => ({
  singles: [],
  doubles: [],
});

const ratingHistoryDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Seoul",
});

const getRatingHistoryDateKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = Object.fromEntries(
    ratingHistoryDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const getWinningTeamIndex = (
  scores: MatchInfo["scores"],
): 0 | 1 | null => {
  if (!scores?.length) {
    return null;
  }

  const teamWins = scores.reduce<[number, number]>(
    (acc, score) => {
      if (score.scoreA > score.scoreB) acc[0] += 1;
      if (score.scoreB > score.scoreA) acc[1] += 1;
      return acc;
    },
    [0, 0],
  );

  if (teamWins[0] !== teamWins[1]) {
    return teamWins[0] > teamWins[1] ? 0 : 1;
  }

  const points = scores.reduce<[number, number]>(
    (acc, score) => [acc[0] + score.scoreA, acc[1] + score.scoreB],
    [0, 0],
  );

  if (points[0] === points[1]) {
    return null;
  }

  return points[0] > points[1] ? 0 : 1;
};

export const getPlayerTeamIndex = (
  match: MatchInfo,
  playerId: string,
): 0 | 1 | null => {
  const teamIndex = match.teams.findIndex((team) =>
    team.players.some((teamPlayer) => teamPlayer.id === playerId),
  );

  return teamIndex === 0 || teamIndex === 1 ? teamIndex : null;
};

const getMatchStartsAtMs = (match: MatchInfo) => {
  const value = new Date(match.matchStartsAt).getTime();
  return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
};

export const buildProfileMatchList = (
  matches: MatchInfo[],
  playerId: string,
): ProfileMatchListItem[] =>
  matches
    .flatMap((match) => {
      if (match.status !== "completed") return [];

      const playerTeamIndex = getPlayerTeamIndex(match, playerId);
      if (playerTeamIndex === null) return [];

      const winningTeamIndex = getWinningTeamIndex(match.scores);
      const outcome: ProfileMatchOutcome =
        winningTeamIndex === null
          ? "unknown"
          : winningTeamIndex === playerTeamIndex
            ? "win"
            : "loss";
      const category = getMatchTopLevelType(match.type);
      const ratingChange = match.ratingChanges?.find(
        (change) => change.playerId === playerId,
      );
      const rawDelta = ratingChange?.delta[category];
      const ratingDelta =
        typeof rawDelta === "number" && Number.isFinite(rawDelta)
          ? rawDelta
          : null;
      const opponentTeam = match.teams[1 - playerTeamIndex];
      const opponentMemberNames = opponentTeam.players
        .map((player) => player.username?.trim() || player.id)
        .filter(Boolean)
        .join(", ");
      // 팀명은 DB에 영속되지 않아 조회 시 항상 Team A/B로 재구성된다.
      // 최근 매치에서는 신뢰할 수 있는 상대 선수 이름만 사용한다.
      const opponentName = opponentMemberNames || "상대 선수 정보 없음";

      return [{ match, opponentName, outcome, ratingDelta }];
    })
    .sort(
      (left, right) =>
        getMatchStartsAtMs(right.match) - getMatchStartsAtMs(left.match),
    );

export const buildRecentProfileMatches = (
  matches: MatchInfo[],
  playerId: string,
  limit: number = 5,
) => buildProfileMatchList(matches, playerId).slice(0, limit);

export const buildMatchStats = (
  matches: MatchInfo[],
  playerId: string,
): MemberProfileMatchStats => {
  const stats = createEmptyMatchStats();

  matches.forEach((match) => {
    if (match.status !== "completed") {
      return;
    }

    const playerTeamIndex = getPlayerTeamIndex(match, playerId);
    const winningTeamIndex = getWinningTeamIndex(match.scores);

    if (playerTeamIndex === null || winningTeamIndex === null) {
      return;
    }

    const category = getMatchTopLevelType(match.type);

    if (playerTeamIndex === winningTeamIndex) {
      stats[category].matchWins += 1;
    } else {
      stats[category].matchLosses += 1;
    }

    if (match.scores) {
      for (const score of match.scores) {
        const setWinner =
          score.scoreA > score.scoreB
            ? 0
            : score.scoreB > score.scoreA
              ? 1
              : null;
        if (setWinner === null) continue;

        if (setWinner === playerTeamIndex) {
          stats[category].setWins += 1;
        } else {
          stats[category].setLosses += 1;
        }
      }
    }
  });

  return stats;
};

export const buildRatingDelta = (
  matches: MatchInfo[],
  playerId: string,
): MemberProfileRatingDelta => {
  const delta = createEmptyRatingDelta();
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  for (const match of matches) {
    if (match.status !== "completed" || !match.ratingChanges) {
      continue;
    }

    const change = match.ratingChanges.find((c) => c.playerId === playerId);
    if (!change) continue;

    const changeDate = new Date(change.createdAt).getTime();
    const category = getMatchTopLevelType(match.type);

    const categoryDelta =
      category === "singles" ? change.delta.singles : change.delta.doubles;

    if (now - changeDate <= sevenDaysMs) {
      delta[category].last7Days += categoryDelta;
    }
    if (now - changeDate <= thirtyDaysMs) {
      delta[category].last30Days += categoryDelta;
    }
  }

  return delta;
};

export const buildRatingHistory = (
  matches: MatchInfo[],
  playerId: string,
  ratingAdjustmentLogs: PlayerRatingChangeLog[] = [],
): MemberProfileRatingHistory => {
  const history = createEmptyRatingHistory();

  for (const match of matches) {
    if (match.status !== "completed" || !match.ratingChanges) {
      continue;
    }

    const change = match.ratingChanges.find((item) => item.playerId === playerId);
    if (!change) continue;

    const category = getMatchTopLevelType(match.type);
    const rating = change.nextRating[category];
    const createdAt = new Date(change.createdAt);

    if (!Number.isFinite(rating) || Number.isNaN(createdAt.getTime())) {
      continue;
    }

    history[category].push({
      rating,
      createdAt: createdAt.toISOString(),
      source: "match",
    });
  }

  for (const adjustment of ratingAdjustmentLogs) {
    if (
      adjustment.playerId !== playerId ||
      adjustment.source !== "official_adjustment_recalculation"
    ) {
      continue;
    }

    const createdAt = new Date(adjustment.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      continue;
    }

    for (const category of ["singles", "doubles"] as const) {
      const rating = adjustment.nextRating[category];
      if (!Number.isFinite(rating) || adjustment.delta[category] === 0) {
        continue;
      }

      history[category].push({
        rating,
        createdAt: createdAt.toISOString(),
        source: "official-adjustment",
      });
    }
  }

  for (const category of ["singles", "doubles"] as const) {
    history[category].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );

    // 하루에 여러 경기·공식 반영이 있어도 차트에는 해당 날짜의 마지막
    // 레이팅만 남겨 날짜별 한 점으로 읽히게 한다.
    const latestPointByDate = new Map<string, (typeof history)[typeof category][number]>();
    for (const point of history[category]) {
      latestPointByDate.set(getRatingHistoryDateKey(point.createdAt), point);
    }
    history[category] = [...latestPointByDate.values()];
  }

  return history;
};
