import {
  getMatchTopLevelType,
  type Match,
} from "@pkpkdupr/shared/match";
import {
  roundDuprRating,
  type PlayerDuprCategory,
  type PlayerRatingChangeLog,
  type PlayerRatingHistory,
  type PublicPlayerDupr,
} from "@pkpkdupr/shared/player";
import { getOfficialDuprRecencyWeight } from "./AuthService";

type MatchWithRatingChanges = Match & {
  ratingChanges?: PlayerRatingChangeLog[];
};

const categories: PlayerDuprCategory[] = ["singles", "doubles"];

const createEmptyHistory = (): PlayerRatingHistory => ({
  singles: [],
  doubles: [],
});

const isValidDate = (value: Date) => Number.isFinite(value.getTime());

const applyProgressiveCorrection = (
  points: PlayerRatingHistory[PlayerDuprCategory],
  targetRating: number,
  referenceAt: Date,
) => {
  if (!points.length || !isValidDate(referenceAt)) return;

  const latestPoint = points.at(-1)!;
  const correction = targetRating - latestPoint.rating;
  if (Math.abs(correction) < Number.EPSILON) return;

  const referenceWeight = getOfficialDuprRecencyWeight(
    latestPoint.createdAt,
    referenceAt,
  );
  if (!Number.isFinite(referenceWeight) || referenceWeight <= 0) return;

  for (const point of points) {
    const weight =
      getOfficialDuprRecencyWeight(point.createdAt, referenceAt) /
      referenceWeight;
    point.rating += correction * Math.min(1, Math.max(0, weight));
  }
};

/**
 * 현재 레이팅 엔진이 재생한 경기 이력을 프로필 차트용으로 보정한다.
 *
 * 공식 DUPR 반영을 별도 차트 점으로 추가하지 않고, 해당 시점 이전의 완료
 * 경기 지점에 30일 반감기 보정을 분배한다. 따라서 공식 반영일에 수직 점프가
 * 생기지 않으면서도 마지막 차트 값은 현재 레이팅과 동일하다.
 */
export const buildPlayerRatingHistory = (
  matches: MatchWithRatingChanges[],
  playerId: string,
  currentRating: PublicPlayerDupr | null | undefined,
  ratingChangeLogs: PlayerRatingChangeLog[],
  now: Date = new Date(),
): PlayerRatingHistory => {
  const history = createEmptyHistory();

  for (const match of matches) {
    if (match.status !== "completed") continue;

    const change = match.ratingChanges?.find(
      (candidate) => candidate.playerId === playerId,
    );
    if (!change || !isValidDate(change.createdAt)) continue;

    const category = getMatchTopLevelType(match.type);
    const rating = change.nextRating[category];
    if (!Number.isFinite(rating)) continue;

    history[category].push({
      rating,
      createdAt: new Date(change.createdAt),
      source: "match",
    });
  }

  const officialAdjustments = ratingChangeLogs
    .filter(
      (log) =>
        log.playerId === playerId &&
        log.source === "official_adjustment_recalculation" &&
        isValidDate(log.createdAt),
    )
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

  for (const category of categories) {
    history[category].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );

    for (const adjustment of officialAdjustments) {
      if (adjustment.delta[category] === 0) continue;

      const eligiblePoints = history[category].filter(
        (point) => point.createdAt.getTime() <= adjustment.createdAt.getTime(),
      );
      const targetRating = adjustment.nextRating[category];
      if (!Number.isFinite(targetRating)) continue;

      applyProgressiveCorrection(
        eligiblePoints,
        targetRating,
        adjustment.createdAt,
      );
    }

    const targetRating = currentRating?.[category];
    if (typeof targetRating !== "number" || !Number.isFinite(targetRating)) {
      // 프로필이 NR로 표시되는 종목에는 현재값과 불일치하는 과거 선을
      // 노출하지 않는다.
      history[category] = [];
      continue;
    }

    if (!history[category].length) {
      const latestAdjustment = officialAdjustments.at(-1);
      history[category].push({
        rating: targetRating,
        createdAt: new Date(latestAdjustment?.createdAt ?? now),
        source: "current",
      });
      continue;
    }

    const latestAdjustment = officialAdjustments.at(-1);
    const latestPoint = history[category].at(-1)!;
    const referenceAt =
      latestAdjustment && latestAdjustment.createdAt > latestPoint.createdAt
        ? latestAdjustment.createdAt
        : latestPoint.createdAt;
    applyProgressiveCorrection(history[category], targetRating, referenceAt);
    history[category] = history[category].map((point) => ({
      ...point,
      rating: roundDuprRating(point.rating),
    }));
  }

  return history;
};
