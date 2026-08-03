import {
  getMatchTopLevelType,
  type Match,
  type MatchTopLevelType,
} from "@pkpkdupr/shared/match";
import type {
  PlayerRatingChangeLog,
  PlayerRatingHistory,
} from "@pkpkdupr/shared/player";

export type PlayerProfileMatchStats = Record<
  MatchTopLevelType,
  {
    matchWins: number;
    matchLosses: number;
    setWins: number;
    setLosses: number;
  }
>;

export type PlayerProfileRatingDelta = Record<
  MatchTopLevelType,
  { last7Days: number; last30Days: number }
>;

export type MatchWithRatingChanges = Match & {
  ratingChanges?: PlayerRatingChangeLog[];
};

export interface PlayerProfileSummary {
  matchStats: PlayerProfileMatchStats;
  ratingDelta: PlayerProfileRatingDelta;
  ratingHistory: PlayerRatingHistory;
  recentMatches: MatchWithRatingChanges[];
}

const createEmptyMatchStats = (): PlayerProfileMatchStats => ({
  singles: { matchWins: 0, matchLosses: 0, setWins: 0, setLosses: 0 },
  doubles: { matchWins: 0, matchLosses: 0, setWins: 0, setLosses: 0 },
});

const createEmptyRatingDelta = (): PlayerProfileRatingDelta => ({
  singles: { last7Days: 0, last30Days: 0 },
  doubles: { last7Days: 0, last30Days: 0 },
});

const getWinningTeamIndex = (match: Match): 0 | 1 | null => {
  if (!match.scores?.length) return null;

  const setWins = match.scores.reduce<[number, number]>(
    ([teamA, teamB], score) => [
      teamA + Number(score.scoreA > score.scoreB),
      teamB + Number(score.scoreB > score.scoreA),
    ],
    [0, 0],
  );
  if (setWins[0] !== setWins[1]) return setWins[0] > setWins[1] ? 0 : 1;

  const points = match.scores.reduce<[number, number]>(
    ([teamA, teamB], score) => [teamA + score.scoreA, teamB + score.scoreB],
    [0, 0],
  );
  if (points[0] === points[1]) return null;
  return points[0] > points[1] ? 0 : 1;
};

const getPlayerTeamIndex = (match: Match, playerId: string): 0 | 1 | null => {
  const index = match.teams.findIndex((team) =>
    team.players.some((player) => player.id === playerId),
  );
  return index === 0 || index === 1 ? index : null;
};

const getMatchStartsAtMs = (match: Match) => {
  const value = match.matchStartsAt.getTime();
  return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
};

export const buildPlayerProfileSummary = (
  matches: MatchWithRatingChanges[],
  playerId: string,
  ratingHistory: PlayerRatingHistory,
  now: Date = new Date(),
): PlayerProfileSummary => {
  const matchStats = createEmptyMatchStats();
  const ratingDelta = createEmptyRatingDelta();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  for (const match of matches) {
    if (match.status !== "completed") continue;

    const playerTeamIndex = getPlayerTeamIndex(match, playerId);
    const winningTeamIndex = getWinningTeamIndex(match);
    const category = getMatchTopLevelType(match.type);

    if (playerTeamIndex !== null && winningTeamIndex !== null) {
      if (playerTeamIndex === winningTeamIndex) {
        matchStats[category].matchWins += 1;
      } else {
        matchStats[category].matchLosses += 1;
      }

      for (const score of match.scores ?? []) {
        const setWinner =
          score.scoreA === score.scoreB
            ? null
            : score.scoreA > score.scoreB
              ? 0
              : 1;
        if (setWinner === null) continue;
        if (setWinner === playerTeamIndex) {
          matchStats[category].setWins += 1;
        } else {
          matchStats[category].setLosses += 1;
        }
      }
    }

    const change = match.ratingChanges?.find(
      (candidate) => candidate.playerId === playerId,
    );
    if (!change) continue;

    const elapsedMs = now.getTime() - change.createdAt.getTime();
    const delta = change.delta[category];
    if (elapsedMs <= sevenDaysMs) ratingDelta[category].last7Days += delta;
    if (elapsedMs <= thirtyDaysMs) ratingDelta[category].last30Days += delta;
  }

  const recentMatches = matches
    .filter((match) => match.status === "completed")
    .sort((left, right) => getMatchStartsAtMs(right) - getMatchStartsAtMs(left))
    .slice(0, 5);

  return { matchStats, ratingDelta, ratingHistory, recentMatches };
};
