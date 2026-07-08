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
        total: DUPR_DEFAULT_RATING,
        singles: {
          standard: DUPR_DEFAULT_RATING,
          unrestricted: DUPR_DEFAULT_RATING,
        },
        doubles: {
          mixed: 3.246,
          men: DUPR_DEFAULT_RATING,
          women: DUPR_DEFAULT_RATING,
          unrestricted: DUPR_DEFAULT_RATING,
        },
      },
      metrics: {
        singles: {
          standard: { confidence: 0, accuracy: null },
          unrestricted: { confidence: 0, accuracy: null },
        },
        doubles: {
          mixed: { confidence: 12, accuracy: null },
          men: { confidence: 0, accuracy: null },
          women: { confidence: 0, accuracy: null },
          unrestricted: { confidence: 0, accuracy: null },
        },
      },
    };

    const publicDupr = normalizeNullablePlayerDupr(state);

    expect(publicDupr).not.toBeNull();
    expect(publicDupr?.singles.standard).toBeNull();
    expect(publicDupr?.singles.unrestricted).toBeNull();
    expect(publicDupr?.doubles.mixed).toBe(3.246);
    expect(publicDupr?.doubles.men).toBeNull();
    expect(getCompositeSinglesRating(publicDupr)).toBeNull();
    expect(getCompositeDoublesRating(publicDupr)).toBe(3.246);
    expect(publicDupr?.total).toBe(3.246);
  });

  it("단식만 경기한 경우 doubles는 NR, singles만 노출한다", () => {
    const state: StoredPlayerDupr = {
      rating: {
        total: DUPR_DEFAULT_RATING,
        singles: {
          standard: 3.112,
          unrestricted: DUPR_DEFAULT_RATING,
        },
        doubles: {
          mixed: DUPR_DEFAULT_RATING,
          men: DUPR_DEFAULT_RATING,
          women: DUPR_DEFAULT_RATING,
          unrestricted: DUPR_DEFAULT_RATING,
        },
      },
      metrics: {
        singles: {
          standard: { confidence: 8, accuracy: null },
          unrestricted: { confidence: 0, accuracy: null },
        },
        doubles: {
          mixed: { confidence: 0, accuracy: null },
          men: { confidence: 0, accuracy: null },
          women: { confidence: 0, accuracy: null },
          unrestricted: { confidence: 0, accuracy: null },
        },
      },
    };

    const publicDupr = normalizeNullablePlayerDupr(state);

    expect(publicDupr).not.toBeNull();
    expect(publicDupr?.singles.standard).toBe(3.112);
    expect(publicDupr?.doubles.mixed).toBeNull();
    expect(getCompositeSinglesRating(publicDupr)).toBe(3.112);
    expect(getCompositeDoublesRating(publicDupr)).toBeNull();
    expect(publicDupr?.total).toBe(3.112);
  });

  it("metrics가 없는 legacy rated data는 기존 값을 유지한다", () => {
    const legacyRatedState: StoredPlayerDupr = {
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
    };

    const publicDupr = normalizeNullablePlayerDupr(legacyRatedState);

    expect(publicDupr).not.toBeNull();
    expect(getCompositeSinglesRating(publicDupr)).toBe(4.035);
    expect(getCompositeDoublesRating(publicDupr)).toBe(4.167);
    expect(publicDupr?.total).toBe(4.101);
  });
});
