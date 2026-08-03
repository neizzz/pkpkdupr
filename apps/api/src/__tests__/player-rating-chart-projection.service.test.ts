import type { PlayerRatingHistory } from "@pkpkdupr/shared/player";
import { describe, expect, it } from "vitest";
import {
  PLAYER_RATING_CHART_MAX_POINTS,
  buildPlayerRatingChartProjection,
} from "../services/PlayerRatingChartProjectionService";

const now = new Date("2026-08-03T12:00:00.000Z");
const dayBefore = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe("buildPlayerRatingChartProjection", () => {
  it("90일 시작 anchor와 현재 양끝점을 고정하고 내부 지점을 최대 여섯 개만 남긴다", () => {
    const history: PlayerRatingHistory = {
      singles: [
        { rating: 3.2, createdAt: dayBefore(120), source: "match" },
        { rating: 3.4, createdAt: dayBefore(85), source: "match" },
        { rating: 2.7, createdAt: dayBefore(78), source: "match" },
        { rating: 3.5, createdAt: dayBefore(70), source: "match" },
        { rating: 2.5, createdAt: dayBefore(63), source: "match" },
        { rating: 3.7, createdAt: dayBefore(56), source: "match" },
        { rating: 3.1, createdAt: dayBefore(49), source: "match" },
        { rating: 4.2, createdAt: dayBefore(42), source: "match" },
        { rating: 3.2, createdAt: dayBefore(35), source: "match" },
        { rating: 3.8, createdAt: dayBefore(28), source: "match" },
        { rating: 3.0, createdAt: dayBefore(21), source: "match" },
        { rating: 3.6, createdAt: dayBefore(14), source: "match" },
        { rating: 3.3, createdAt: dayBefore(7), source: "match" },
      ],
      doubles: [],
    };

    const projection = buildPlayerRatingChartProjection(history, now).singles;

    expect(projection).toHaveLength(PLAYER_RATING_CHART_MAX_POINTS);
    expect(projection[0]).toMatchObject({
      rating: 3.2,
      source: "anchor",
      createdAt: dayBefore(90),
    });
    expect(projection.at(-1)).toMatchObject({
      rating: 3.3,
      source: "current",
      createdAt: now,
    });
    expect(projection.map((point) => point.rating)).toEqual(
      expect.arrayContaining([2.5, 4.2]),
    );
  });

  it("직선 추세에서는 불필요한 내부 변곡점을 저장하지 않는다", () => {
    const history: PlayerRatingHistory = {
      singles: Array.from({ length: 12 }, (_, index) => ({
        rating: 3 + index * 0.05,
        createdAt: dayBefore(80 - index * (80 / 11)),
        source: "match" as const,
      })),
      doubles: [],
    };

    const projection = buildPlayerRatingChartProjection(history, now).singles;

    expect(projection).toHaveLength(2);
    expect(projection[0]?.source).toBe("match");
    expect(projection[1]).toMatchObject({ source: "match", createdAt: now });
  });
});
