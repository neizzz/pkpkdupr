import {
  DUPR_DEFAULT_RATING,
  createDefaultPlayerDupr,
  createDefaultPlayerDuprMetrics,
  getCompositeDoublesRating,
  getCompositeSinglesRating,
  normalizeNullablePlayerDupr,
  shouldStorePlayerDuprAsNull,
  type StoredPlayerDupr,
} from "@pkpkdupr/shared/player";
import { describe, expect, it } from "vitest";

describe("public DUPR exposure", () => {
  it("전체 NR state는 null로 노출한다", () => {
    expect(normalizeNullablePlayerDupr(null)).toBeNull();
    expect(shouldStorePlayerDuprAsNull(null)).toBe(true);
  });

  it("legacy 3.5 기본 state는 NR로 정리한다", () => {
    const legacyDefaultState: StoredPlayerDupr = {
      rating: createDefaultPlayerDupr(3.5),
      metrics: createDefaultPlayerDuprMetrics(),
    };

    expect(shouldStorePlayerDuprAsNull(legacyDefaultState)).toBe(true);
    expect(normalizeNullablePlayerDupr(legacyDefaultState)).toBeNull();
  });

  it("복식만 경기한 경우 singles는 NR, doubles만 노출한다", () => {
    const state: StoredPlayerDupr = {
      rating: {
        singles: DUPR_DEFAULT_RATING,
        doubles: 3.246,
      },
      metrics: {
        singles: { confidence: 0, accuracy: null },
        doubles: { confidence: 12, accuracy: null },
      },
    };

    const publicDupr = normalizeNullablePlayerDupr(state);

    expect(publicDupr).not.toBeNull();
    expect(publicDupr?.singles).toBeNull();
    expect(publicDupr?.doubles).toBe(3.246);
    expect(getCompositeSinglesRating(publicDupr)).toBeNull();
    expect(getCompositeDoublesRating(publicDupr)).toBe(3.246);
  });

  it("단식만 경기한 경우 doubles는 NR, singles만 노출한다", () => {
    const state: StoredPlayerDupr = {
      rating: {
        singles: 3.112,
        doubles: DUPR_DEFAULT_RATING,
      },
      metrics: {
        singles: { confidence: 8, accuracy: null },
        doubles: { confidence: 0, accuracy: null },
      },
    };

    const publicDupr = normalizeNullablePlayerDupr(state);

    expect(publicDupr).not.toBeNull();
    expect(publicDupr?.singles).toBe(3.112);
    expect(publicDupr?.doubles).toBeNull();
    expect(getCompositeSinglesRating(publicDupr)).toBe(3.112);
    expect(getCompositeDoublesRating(publicDupr)).toBeNull();
  });

  it("metrics가 없는 legacy rated data는 singles/doubles composite로 축약한다", () => {
    const legacyRatedState: StoredPlayerDupr = {
      rating: {
        singles: 4.035,
        doubles: 4.167,
      },
      metrics: createDefaultPlayerDuprMetrics(),
    };

    const publicDupr = normalizeNullablePlayerDupr(legacyRatedState);

    expect(publicDupr).not.toBeNull();
    expect(getCompositeSinglesRating(publicDupr)).toBe(4.035);
    expect(getCompositeDoublesRating(publicDupr)).toBe(4.167);
  });

  it("legacy subtype 구조를 읽을 때 singles/doubles track으로 축약한다", () => {
    const publicDupr = normalizeNullablePlayerDupr({
      rating: {
        total: 4.1,
        singles: {
          standard: 4.05,
          unrestricted: 4.02,
        },
        doubles: {
          mixed: 4.22,
          men: 4.18,
          women: 4.11,
          unrestricted: 4.16,
        },
      },
      metrics: createDefaultPlayerDuprMetrics(),
    });

    expect(publicDupr).not.toBeNull();
    expect(publicDupr?.singles).toBe(4.035);
    expect(publicDupr?.doubles).toBe(4.167);
  });
});
