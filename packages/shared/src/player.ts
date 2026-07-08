export type PlayerStatus = "active" | "inactive";

export type PlayerCreationSource =
  | "self_register"
  | "admin_register"
  | "bootstrap";

export interface PlayerDuprSingles {
  standard: number;
  unrestricted: number;
}

export interface PlayerDuprDoubles {
  mixed: number;
  men: number;
  women: number;
  unrestricted: number;
}

export interface PlayerDupr {
  total: number;
  doubles: PlayerDuprDoubles;
  singles: PlayerDuprSingles;
}

export type PlayerDuprSinglesKey = keyof PlayerDuprSingles;
export type PlayerDuprDoublesKey = keyof PlayerDuprDoubles;
export type PlayerDuprCategory =
  | `singles.${PlayerDuprSinglesKey}`
  | `doubles.${PlayerDuprDoublesKey}`;

export interface PlayerDuprMetric {
  confidence: number;
  accuracy: number | null;
}

export interface PlayerDuprMetricsSingles {
  standard: PlayerDuprMetric;
  unrestricted: PlayerDuprMetric;
}

export interface PlayerDuprMetricsDoubles {
  mixed: PlayerDuprMetric;
  men: PlayerDuprMetric;
  women: PlayerDuprMetric;
  unrestricted: PlayerDuprMetric;
}

export interface PlayerDuprMetrics {
  doubles: PlayerDuprMetricsDoubles;
  singles: PlayerDuprMetricsSingles;
}

export interface StoredPlayerDupr {
  rating: PlayerDupr;
  metrics: PlayerDuprMetrics;
}

export interface OfficialDuprAdjustmentLog {
  id: string;
  playerId: string;
  changedByPlayerId: string;
  changedByUsername: string;
  ratings: Partial<{
    singles: Partial<PlayerDuprSingles>;
    doubles: Partial<PlayerDuprDoubles>;
  }>;
  confidence: Partial<{
    singles: Partial<Record<PlayerDuprSinglesKey, number>>;
    doubles: Partial<Record<PlayerDuprDoublesKey, number>>;
  }>;
  previousRating: PlayerDupr;
  nextRating: PlayerDupr;
  preUpdateAccuracy: Partial<{
    singles: Partial<Record<PlayerDuprSinglesKey, number | null>>;
    doubles: Partial<Record<PlayerDuprDoublesKey, number | null>>;
  }>;
  reason: string | null;
  createdAt: Date;
}

export type PlayerRatingChangeSource =
  | "official_adjustment_recalculation"
  | "manual_recalculation";

export interface PlayerRatingChangeLog {
  id: string;
  playerId: string;
  source: PlayerRatingChangeSource;
  sourceLogId: string;
  previousRating: PlayerDupr;
  nextRating: PlayerDupr;
  delta: PlayerDupr;
  createdAt: Date;
}

export interface OfficialDuprAdjustmentImpact {
  playerId: string;
  username: string;
  previousRating: PlayerDupr;
  nextRating: PlayerDupr;
  delta: PlayerDupr;
  relatedMatchCount: number;
}

export interface OfficialDuprAdjustmentPreview {
  player: Player;
  impacts: OfficialDuprAdjustmentImpact[];
}

export const DUPR_DEFAULT_RATING = 3.5;
export const DUPR_MIN_RATING = 2;
export const DUPR_MAX_RATING = 8;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const average = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

export const roundDuprRating = (value: number) =>
  Math.round(value * 1000) / 1000;

export const normalizeDuprRatingValue = (value: unknown): number => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return DUPR_DEFAULT_RATING;
  }

  if (parsed === 1000) {
    return DUPR_DEFAULT_RATING;
  }

  const officialScaleValue = parsed > 10 ? parsed / 1000 : parsed;
  return roundDuprRating(
    clamp(officialScaleValue, DUPR_MIN_RATING, DUPR_MAX_RATING),
  );
};

const normalizeMetricValue = (
  value: unknown,
  fallback: PlayerDuprMetric = { confidence: 0, accuracy: null },
): PlayerDuprMetric => {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const confidence = Number(record.confidence ?? fallback.confidence);
  const rawAccuracy = record.accuracy ?? fallback.accuracy;
  const accuracy = rawAccuracy == null ? null : Number(rawAccuracy);

  return {
    confidence: Math.round(clamp(Number.isFinite(confidence) ? confidence : 0, 0, 100)),
    accuracy:
      accuracy == null || !Number.isFinite(accuracy)
        ? null
        : Math.round(clamp(accuracy, 0, 100)),
  };
};

export const getCompositeSinglesRating = (
  duprRating?: PlayerDupr | null,
): number | null => {
  if (!duprRating) {
    return null;
  }

  return roundDuprRating(
    average([
      duprRating.singles.standard,
      duprRating.singles.unrestricted,
    ]),
  );
};

export const getCompositeDoublesRating = (
  duprRating?: PlayerDupr | null,
): number | null => {
  if (!duprRating) {
    return null;
  }

  return roundDuprRating(
    average([
      duprRating.doubles.mixed,
      duprRating.doubles.men,
      duprRating.doubles.women,
      duprRating.doubles.unrestricted,
    ]),
  );
};

export const createDefaultPlayerDuprMetrics = (
  confidence = 0,
  accuracy: number | null = null,
): PlayerDuprMetrics => ({
  doubles: {
    mixed: { confidence, accuracy },
    men: { confidence, accuracy },
    women: { confidence, accuracy },
    unrestricted: { confidence, accuracy },
  },
  singles: {
    standard: { confidence, accuracy },
    unrestricted: { confidence, accuracy },
  },
});

export const computeTotalDuprRating = (rating: Omit<PlayerDupr, "total">) =>
  roundDuprRating(
    average([
      getCompositeSinglesRating({ ...rating, total: DUPR_DEFAULT_RATING }) ??
        DUPR_DEFAULT_RATING,
      getCompositeDoublesRating({ ...rating, total: DUPR_DEFAULT_RATING }) ??
        DUPR_DEFAULT_RATING,
    ]),
  );

export const createDefaultPlayerDupr = (
  seed: unknown = DUPR_DEFAULT_RATING,
): PlayerDupr => {
  const normalizedSeed = normalizeDuprRatingValue(seed);
  const rating = {
    doubles: {
      mixed: normalizedSeed,
      men: normalizedSeed,
      women: normalizedSeed,
      unrestricted: normalizedSeed,
    },
    singles: {
      standard: normalizedSeed,
      unrestricted: normalizedSeed,
    },
  };

  return {
    ...rating,
    total: computeTotalDuprRating(rating),
  };
};

export const isDefaultPlayerDupr = (rating: PlayerDupr) =>
  rating.total === DUPR_DEFAULT_RATING &&
  rating.singles.standard === DUPR_DEFAULT_RATING &&
  rating.singles.unrestricted === DUPR_DEFAULT_RATING &&
  rating.doubles.mixed === DUPR_DEFAULT_RATING &&
  rating.doubles.men === DUPR_DEFAULT_RATING &&
  rating.doubles.women === DUPR_DEFAULT_RATING &&
  rating.doubles.unrestricted === DUPR_DEFAULT_RATING;

const normalizeSinglesRating = (
  value: unknown,
  fallback: number,
): PlayerDuprSingles => {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return {
      standard: normalizeDuprRatingValue(record.standard ?? fallback),
      unrestricted: normalizeDuprRatingValue(record.unrestricted ?? fallback),
    };
  }

  const normalized = normalizeDuprRatingValue(value ?? fallback);
  return {
    standard: normalized,
    unrestricted: normalized,
  };
};

const normalizeDoublesRating = (
  value: unknown,
  fallback: number,
): PlayerDuprDoubles => {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    mixed: normalizeDuprRatingValue(record.mixed ?? fallback),
    men: normalizeDuprRatingValue(record.men ?? fallback),
    women: normalizeDuprRatingValue(record.women ?? fallback),
    unrestricted: normalizeDuprRatingValue(record.unrestricted ?? fallback),
  };
};

export const normalizePlayerDupr = (value: unknown): PlayerDupr => {
  if (typeof value === "number" || typeof value === "string") {
    return createDefaultPlayerDupr(value);
  }

  if (!value || typeof value !== "object") {
    return createDefaultPlayerDupr();
  }

  const record = value as Record<string, unknown>;
  const ratingSource =
    record.rating && typeof record.rating === "object"
      ? (record.rating as Record<string, unknown>)
      : record;
  const baseTotal = normalizeDuprRatingValue(ratingSource.total);
  const rawSingles = ratingSource.singles;
  const rawDoubles = ratingSource.doubles;
  const legacySinglesSeed =
    rawSingles && typeof rawSingles === "object"
      ? baseTotal
      : normalizeDuprRatingValue(rawSingles ?? baseTotal);
  const rating = {
    doubles: normalizeDoublesRating(rawDoubles, baseTotal),
    singles: normalizeSinglesRating(rawSingles, legacySinglesSeed),
  };

  return {
    ...rating,
    total: computeTotalDuprRating(rating),
  };
};

const isDefaultPlayerDuprMetrics = (metrics: PlayerDuprMetrics) =>
  metrics.singles.standard.confidence === 0 &&
  metrics.singles.standard.accuracy == null &&
  metrics.singles.unrestricted.confidence === 0 &&
  metrics.singles.unrestricted.accuracy == null &&
  metrics.doubles.mixed.confidence === 0 &&
  metrics.doubles.mixed.accuracy == null &&
  metrics.doubles.men.confidence === 0 &&
  metrics.doubles.men.accuracy == null &&
  metrics.doubles.women.confidence === 0 &&
  metrics.doubles.women.accuracy == null &&
  metrics.doubles.unrestricted.confidence === 0 &&
  metrics.doubles.unrestricted.accuracy == null;

const normalizeSinglesMetrics = (
  value: unknown,
  fallback: PlayerDuprMetric = { confidence: 0, accuracy: null },
): PlayerDuprMetricsSingles => {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("standard" in record || "unrestricted" in record) {
      return {
        standard: normalizeMetricValue(record.standard, fallback),
        unrestricted: normalizeMetricValue(record.unrestricted, fallback),
      };
    }
  }

  const normalized = normalizeMetricValue(value, fallback);
  return {
    standard: normalized,
    unrestricted: normalized,
  };
};

const normalizeDoublesMetrics = (
  value: unknown,
  fallback: PlayerDuprMetric = { confidence: 0, accuracy: null },
): PlayerDuprMetricsDoubles => {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    mixed: normalizeMetricValue(record.mixed, fallback),
    men: normalizeMetricValue(record.men, fallback),
    women: normalizeMetricValue(record.women, fallback),
    unrestricted: normalizeMetricValue(record.unrestricted, fallback),
  };
};

export const normalizeStoredPlayerDupr = (value: unknown): StoredPlayerDupr => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return {
        rating: createDefaultPlayerDupr(),
        metrics: createDefaultPlayerDuprMetrics(),
      };
    }

    if (trimmed.startsWith("{")) {
      try {
        return normalizeStoredPlayerDupr(JSON.parse(trimmed));
      } catch {
        return {
          rating: createDefaultPlayerDupr(),
          metrics: createDefaultPlayerDuprMetrics(),
        };
      }
    }

    return {
      rating: createDefaultPlayerDupr(trimmed),
      metrics: createDefaultPlayerDuprMetrics(),
    };
  }

  const rating = normalizePlayerDupr(value);
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const metricsSource =
    record.metrics && typeof record.metrics === "object"
      ? (record.metrics as Record<string, unknown>)
      : {};

  return {
    rating,
    metrics: {
      doubles: normalizeDoublesMetrics(metricsSource.doubles),
      singles: normalizeSinglesMetrics(metricsSource.singles),
    },
  };
};

export const shouldStorePlayerDuprAsNull = (value: unknown): boolean => {
  if (value == null) {
    return true;
  }

  if (typeof value === "string" && !value.trim()) {
    return true;
  }

  const state = normalizeStoredPlayerDupr(value);
  return (
    isDefaultPlayerDupr(state.rating) && isDefaultPlayerDuprMetrics(state.metrics)
  );
};

export const normalizeNullablePlayerDupr = (value: unknown): PlayerDupr | null =>
  shouldStorePlayerDuprAsNull(value)
    ? null
    : normalizeStoredPlayerDupr(value).rating;

export const serializeStoredPlayerDupr = (value: StoredPlayerDupr) =>
  JSON.stringify({
    rating: normalizePlayerDupr(value.rating),
    metrics: value.metrics,
  });

export const getDuprRatingByCategory = (
  rating: PlayerDupr,
  category: PlayerDuprCategory,
) => {
  const [group, key] = category.split(".") as [
    "singles" | "doubles",
    string,
  ];

  if (group === "singles") {
    return rating.singles[key as PlayerDuprSinglesKey];
  }

  return rating.doubles[key as PlayerDuprDoublesKey];
};

export const setDuprRatingByCategory = (
  rating: PlayerDupr,
  category: PlayerDuprCategory,
  value: number,
): PlayerDupr => {
  const [group, key] = category.split(".") as [
    "singles" | "doubles",
    string,
  ];
  const next: Omit<PlayerDupr, "total"> = {
    doubles: { ...rating.doubles },
    singles: { ...rating.singles },
  };

  if (group === "singles") {
    next.singles[key as PlayerDuprSinglesKey] = normalizeDuprRatingValue(value);
  } else {
    next.doubles[key as PlayerDuprDoublesKey] =
      normalizeDuprRatingValue(value);
  }

  return {
    ...next,
    total: computeTotalDuprRating(next),
  };
};

export const getDuprMetricByCategory = (
  metrics: PlayerDuprMetrics,
  category: PlayerDuprCategory,
) => {
  const [group, key] = category.split(".") as [
    "singles" | "doubles",
    string,
  ];

  if (group === "singles") {
    return metrics.singles[key as PlayerDuprSinglesKey];
  }

  return metrics.doubles[key as PlayerDuprDoublesKey];
};

export const setDuprMetricByCategory = (
  metrics: PlayerDuprMetrics,
  category: PlayerDuprCategory,
  value: PlayerDuprMetric,
): PlayerDuprMetrics => {
  const [group, key] = category.split(".") as [
    "singles" | "doubles",
    string,
  ];

  if (group === "singles") {
    return {
      ...metrics,
      singles: {
        ...metrics.singles,
        [key]: normalizeMetricValue(value),
      },
    };
  }

  return {
    ...metrics,
    doubles: {
      ...metrics.doubles,
      [key]: normalizeMetricValue(value),
    },
  };
};

export interface Player {
  id: string;
  username: string;
  duprRating: PlayerDupr | null;
  gender: "M" | "F";
  status: PlayerStatus;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerProfile extends Player {
  totalMatches: number;
  winRate: number;
}

export interface PlayerCreationLog {
  id: string;
  playerId: string;
  createdByPlayerId: string | null;
  createdByUsername: string;
  creationSource: PlayerCreationSource;
  createdAt: Date;
}

export interface PlayerStatusChangeLog {
  id: string;
  playerId: string;
  previousStatus: PlayerStatus;
  nextStatus: PlayerStatus;
  changedByPlayerId: string;
  changedByUsername: string;
  changedAt: Date;
}
