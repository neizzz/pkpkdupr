import { getMatchTopLevelType } from "@pkpkdupr/shared/match";
import type { MatchInfo } from "@/components/Match";
import type { MemberProfileMatchStats } from "@/components/MemberProfile";

export const createEmptyMatchStats = (): MemberProfileMatchStats => ({
  singles: { wins: 0, losses: 0 },
  doubles: { wins: 0, losses: 0 },
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

    if (playerTeamIndex === winningTeamIndex) {
      stats[getMatchTopLevelType(match.type)].wins += 1;
    } else {
      stats[getMatchTopLevelType(match.type)].losses += 1;
    }
  });

  return stats;
};
