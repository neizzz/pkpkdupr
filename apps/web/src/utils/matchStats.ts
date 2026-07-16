import { getMatchTopLevelType } from "@pkpkdupr/shared/match";
import type { MatchInfo } from "@/components/Match";
import type {
  MemberProfileMatchStats,
  MemberProfileRatingDelta,
} from "@/components/MemberProfile";

export const createEmptyMatchStats = (): MemberProfileMatchStats => ({
  singles: { matchWins: 0, matchLosses: 0, setWins: 0, setLosses: 0 },
  doubles: { matchWins: 0, matchLosses: 0, setWins: 0, setLosses: 0 },
});

export const createEmptyRatingDelta = (): MemberProfileRatingDelta => ({
  singles: { last7Days: 0, last30Days: 0 },
  doubles: { last7Days: 0, last30Days: 0 },
});

const getWinningTeamIndex = (scores: MatchInfo["scores"]): 0 | 1 | null => {
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

const getPlayerTeamIndex = (
  match: MatchInfo,
  playerId: string,
): 0 | 1 | null => {
  const teamIndex = match.teams.findIndex((team) =>
    team.players.some((teamPlayer) => teamPlayer.id === playerId),
  );

  return teamIndex === 0 || teamIndex === 1 ? teamIndex : null;
};

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
