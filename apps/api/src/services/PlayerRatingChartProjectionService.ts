import type { Match } from "@pkpkdupr/shared/match";
import type {
  Player,
  PlayerDuprCategory,
  PlayerRatingChangeLog,
  PlayerRatingHistory,
  PlayerRatingHistoryPoint,
} from "@pkpkdupr/shared/player";
import type {
  MatchRepository,
  PlayerRatingChartProjection,
} from "../repositories/MatchRepository";
import type { AuthService } from "./AuthService";
import { buildPlayerRatingHistory } from "./PlayerRatingHistoryService";

export const PLAYER_RATING_CHART_WINDOW_DAYS = 90;
export const PLAYER_RATING_CHART_MAX_INTERIOR_POINTS = 6;
export const PLAYER_RATING_CHART_MAX_POINTS =
  PLAYER_RATING_CHART_MAX_INTERIOR_POINTS + 2;

type MatchWithRatingChanges = Match & {
  ratingChanges?: PlayerRatingChangeLog[];
};

const categories: PlayerDuprCategory[] = ["singles", "doubles"];
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_SIGNIFICANT_CHART_DEVIATION = 0.0005;

const isValidPoint = (point: PlayerRatingHistoryPoint) =>
  Number.isFinite(point.rating) && !Number.isNaN(point.createdAt.getTime());

const isSameKoreanDate = (left: Date, right: Date) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(left) === formatter.format(right);
};

const clonePoint = (
  point: PlayerRatingHistoryPoint,
  overrides: Partial<PlayerRatingHistoryPoint> = {},
): PlayerRatingHistoryPoint => ({
  ...point,
  ...overrides,
  createdAt: new Date(overrides.createdAt ?? point.createdAt),
});

const getLargestDeviationIndex = (
  points: PlayerRatingHistoryPoint[],
  startIndex: number,
  endIndex: number,
) => {
  const start = points[startIndex];
  const end = points[endIndex];
  if (!start || !end || endIndex - startIndex < 2) return null;

  const duration = end.createdAt.getTime() - start.createdAt.getTime();
  let candidate: number | null = null;
  let largestDeviation = 0;

  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const point = points[index];
    if (!point) continue;
    const ratio = duration === 0
      ? (index - startIndex) / (endIndex - startIndex)
      : (point.createdAt.getTime() - start.createdAt.getTime()) / duration;
    const expectedRating = start.rating + (end.rating - start.rating) * ratio;
    const deviation = Math.abs(point.rating - expectedRating);
    if (deviation > largestDeviation) {
      largestDeviation = deviation;
      candidate = index;
    }
  }

  return candidate;
};

/**
 * 전체 decay 보정이 끝난 선을 최근 90일의 작은 차트 projection으로 압축한다.
 * 양끝점은 고정하고, 실제 최고/최저와 선형 추세에서 가장 많이 벗어나는 지점만
 * 최대 여섯 개 보존한다.
 */
export const buildPlayerRatingChartProjection = (
  history: PlayerRatingHistory,
  now: Date = new Date(),
): PlayerRatingHistory => {
  const cutoff = new Date(
    now.getTime() - PLAYER_RATING_CHART_WINDOW_DAYS * DAY_MS,
  );

  return Object.fromEntries(
    categories.map((category) => {
      const sorted = history[category]
        .filter(isValidPoint)
        .map((point) => clonePoint(point))
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
      const beforeCutoff = sorted.filter(
        (point) => point.createdAt.getTime() < cutoff.getTime(),
      ).at(-1);
      const inWindow = sorted.filter(
        (point) => point.createdAt.getTime() >= cutoff.getTime(),
      );
      const timeline: PlayerRatingHistoryPoint[] = [
        ...(beforeCutoff
          ? [clonePoint(beforeCutoff, { createdAt: cutoff, source: "anchor" })]
          : []),
        ...inWindow,
      ];

      const latest = timeline.at(-1);
      if (latest && !isSameKoreanDate(latest.createdAt, now)) {
        timeline.push(
          clonePoint(latest, { createdAt: now, source: "current" }),
        );
      }

      const uniqueTimeline = timeline.filter(
        (point, index, points) =>
          index === 0 ||
          point.createdAt.getTime() !== points[index - 1]?.createdAt.getTime(),
      );
      if (uniqueTimeline.length <= PLAYER_RATING_CHART_MAX_POINTS) {
        return [category, uniqueTimeline];
      }

      const selected = new Set<number>([0, uniqueTimeline.length - 1]);
      const maximum = Math.max(...uniqueTimeline.map((point) => point.rating));
      const minimum = Math.min(...uniqueTimeline.map((point) => point.rating));
      const maxIndex = uniqueTimeline.findIndex((point) => point.rating === maximum);
      const minIndex = uniqueTimeline.findIndex((point) => point.rating === minimum);
      if (maxIndex > 0 && maxIndex < uniqueTimeline.length - 1) selected.add(maxIndex);
      if (minIndex > 0 && minIndex < uniqueTimeline.length - 1) selected.add(minIndex);

      while (selected.size < PLAYER_RATING_CHART_MAX_POINTS) {
        const selectedIndexes = [...selected].sort((left, right) => left - right);
        let nextIndex: number | null = null;
        let largestDeviation = 0;

        for (let index = 1; index < selectedIndexes.length; index += 1) {
          const startIndex = selectedIndexes[index - 1];
          const endIndex = selectedIndexes[index];
          if (startIndex == null || endIndex == null) continue;
          const candidate = getLargestDeviationIndex(
            uniqueTimeline,
            startIndex,
            endIndex,
          );
          if (candidate == null) continue;

          const start = uniqueTimeline[startIndex]!;
          const end = uniqueTimeline[endIndex]!;
          const point = uniqueTimeline[candidate]!;
          const duration = end.createdAt.getTime() - start.createdAt.getTime();
          const ratio = duration === 0
            ? (candidate - startIndex) / (endIndex - startIndex)
            : (point.createdAt.getTime() - start.createdAt.getTime()) / duration;
          const expectedRating = start.rating + (end.rating - start.rating) * ratio;
          const deviation = Math.abs(point.rating - expectedRating);
          if (deviation > largestDeviation) {
            largestDeviation = deviation;
            nextIndex = candidate;
          }
        }

        if (
          nextIndex == null ||
          largestDeviation <= MIN_SIGNIFICANT_CHART_DEVIATION
        ) {
          break;
        }
        selected.add(nextIndex);
      }

      return [
        category,
        [...selected]
          .sort((left, right) => left - right)
          .map((index) => uniqueTimeline[index]!),
      ];
    }),
  ) as PlayerRatingHistory;
};

export const attachMatchRatingChanges = (
  matches: Match[],
  ratingChangeLogs: PlayerRatingChangeLog[],
): MatchWithRatingChanges[] => {
  const logsByMatch = new Map<string, PlayerRatingChangeLog[]>();
  for (const log of ratingChangeLogs) {
    if (log.source !== "match_completed") continue;
    const matchId = log.sourceLogId
      .replace(/^match-completed-/, "")
      .replace(/-[^-]+$/, "");
    const logs = logsByMatch.get(matchId) ?? [];
    logs.push(log);
    logsByMatch.set(matchId, logs);
  }

  return matches.map((match) => ({
    ...match,
    ratingChanges: logsByMatch.get(match.id) ?? [],
  }));
};

type ProjectionRepository = Pick<
  MatchRepository,
  | "findByPlayerId"
  | "getPlayerRatingChangeLogs"
  | "getPlayerRatingChartProjection"
  | "replacePlayerRatingChartProjection"
>;

type PlayerLookup = Pick<AuthService, "getPlayerById">;

export class PlayerRatingChartProjectionService {
  constructor(
    private readonly matchRepository: ProjectionRepository,
    private readonly playerLookup: PlayerLookup,
  ) {}

  async getOrRebuild(playerId: string): Promise<PlayerRatingChartProjection> {
    const existing = await this.matchRepository.getPlayerRatingChartProjection(
      playerId,
    );
    return existing ?? this.rebuildPlayer(playerId);
  }

  async rebuildPlayer(playerId: string): Promise<PlayerRatingChartProjection> {
    const [result, ratingChangeLogs, player] = await Promise.all([
      this.matchRepository.findByPlayerId(playerId, 0, 10_000),
      this.matchRepository.getPlayerRatingChangeLogs(playerId),
      this.playerLookup.getPlayerById(playerId),
    ]);
    const history = buildPlayerRatingHistory(
      attachMatchRatingChanges(result.matches, ratingChangeLogs),
      playerId,
      player?.duprRating,
      ratingChangeLogs,
    );
    const generatedAt = new Date();
    const projection = {
      history: buildPlayerRatingChartProjection(history, generatedAt),
      generatedAt,
    };
    return this.matchRepository.replacePlayerRatingChartProjection(
      playerId,
      projection,
    );
  }

  async rebuildPlayers(playerIds: Iterable<string>): Promise<void> {
    const uniquePlayerIds = [...new Set([...playerIds].filter(Boolean))];
    await Promise.all(uniquePlayerIds.map((playerId) => this.rebuildPlayer(playerId)));
  }
}
