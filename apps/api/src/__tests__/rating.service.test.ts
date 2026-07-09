import {
  createDefaultPlayerDupr,
  createDefaultPlayerDuprMetrics,
  type StoredPlayerDupr,
} from "@pkpkdupr/shared/player";
import { describe, expect, it } from "vitest";
import {
  getDecayedConfidenceByInactivity,
  getScoreMarginMultiplier,
  getSetMarginMultiplier,
  RatingService,
} from "../services/RatingService";

const DAY_MS = 24 * 60 * 60 * 1000;

const createState = (rating = 3, confidence = 0): StoredPlayerDupr => ({
  rating: createDefaultPlayerDupr(rating),
  metrics: createDefaultPlayerDuprMetrics(confidence),
});

describe("RatingService", () => {
  it("2주 유예 후 1일마다 1.5씩 confidence가 감소하고 floor는 0이다", () => {
    expect(getDecayedConfidenceByInactivity(50, 14 * DAY_MS)).toBe(50);
    expect(getDecayedConfidenceByInactivity(50, 15 * DAY_MS)).toBe(48.5);
    expect(getDecayedConfidenceByInactivity(50, 20 * DAY_MS)).toBe(41);
    expect(getDecayedConfidenceByInactivity(5, 30 * DAY_MS)).toBe(0);
  });

  it("점수차가 클수록 multiplier가 커진다", () => {
    expect(getScoreMarginMultiplier([{ scoreA: 11, scoreB: 9 }])).toBe(1.05);
    expect(getScoreMarginMultiplier([{ scoreA: 11, scoreB: 1 }])).toBe(1.417);
    expect(getScoreMarginMultiplier()).toBe(1);
  });

  it("보수적인 세트차 multiplier를 적용한다", () => {
    expect(getSetMarginMultiplier([{ scoreA: 11, scoreB: 9 }])).toBe(1);
    expect(
      getSetMarginMultiplier([
        { scoreA: 11, scoreB: 9 },
        { scoreA: 9, scoreB: 11 },
        { scoreA: 11, scoreB: 9 },
      ]),
    ).toBe(1.03);
    expect(
      getSetMarginMultiplier([
        { scoreA: 11, scoreB: 9 },
        { scoreA: 11, scoreB: 9 },
      ]),
    ).toBe(1.08);
  });

  it("같은 승패여도 점수차가 크면 DUPR 변화량이 더 커진다", () => {
    const service = new RatingService();
    const closeResult = service.replayMatch({
      type: "singles",
      winnerTeamIndex: 0,
      scores: [{ scoreA: 11, scoreB: 9 }],
      participants: [
        { playerId: "winner", teamIndex: 0, state: createState() },
        { playerId: "loser", teamIndex: 1, state: createState() },
      ],
    });
    const blowoutResult = service.replayMatch({
      type: "singles",
      winnerTeamIndex: 0,
      scores: [{ scoreA: 11, scoreB: 1 }],
      participants: [
        { playerId: "winner", teamIndex: 0, state: createState() },
        { playerId: "loser", teamIndex: 1, state: createState() },
      ],
    });

    expect(closeResult.winner.rating.singles).toBe(3.034);
    expect(closeResult.loser.rating.singles).toBe(2.966);
    expect(blowoutResult.winner.rating.singles).toBe(3.045);
    expect(blowoutResult.loser.rating.singles).toBe(2.955);
    expect(blowoutResult.winner.rating.singles).toBeGreaterThan(
      closeResult.winner.rating.singles,
    );
    expect(blowoutResult.loser.rating.singles).toBeLessThan(
      closeResult.loser.rating.singles,
    );
  });

  it("같은 최종 승패여도 2:0 승리가 2:1 승리보다 DUPR 변화량이 더 크다", () => {
    const service = new RatingService();
    const twoToOneResult = service.replayMatch({
      type: "singles",
      winnerTeamIndex: 0,
      scores: [
        { scoreA: 11, scoreB: 9 },
        { scoreA: 9, scoreB: 11 },
        { scoreA: 11, scoreB: 9 },
      ],
      participants: [
        { playerId: "winner", teamIndex: 0, state: createState() },
        { playerId: "loser", teamIndex: 1, state: createState() },
      ],
    });
    const twoToZeroResult = service.replayMatch({
      type: "singles",
      winnerTeamIndex: 0,
      scores: [
        { scoreA: 11, scoreB: 9 },
        { scoreA: 11, scoreB: 9 },
      ],
      participants: [
        { playerId: "winner", teamIndex: 0, state: createState() },
        { playerId: "loser", teamIndex: 1, state: createState() },
      ],
    });

    expect(twoToOneResult.winner.rating.singles).toBe(3.034);
    expect(twoToOneResult.loser.rating.singles).toBe(2.966);
    expect(twoToZeroResult.winner.rating.singles).toBe(3.036);
    expect(twoToZeroResult.loser.rating.singles).toBe(2.964);
    expect(twoToZeroResult.winner.rating.singles).toBeGreaterThan(
      twoToOneResult.winner.rating.singles,
    );
    expect(twoToZeroResult.loser.rating.singles).toBeLessThan(
      twoToOneResult.loser.rating.singles,
    );
  });

  it("장기 미플레이로 confidence가 낮아지면 같은 경기에서도 DUPR 변화량이 더 커진다", () => {
    const service = new RatingService();
    const freshResult = service.replayMatch({
      type: "singles",
      winnerTeamIndex: 0,
      scores: [{ scoreA: 11, scoreB: 9 }],
      inactiveElapsedMsByPlayerId: {
        winner: 14 * DAY_MS,
        loser: 14 * DAY_MS,
      },
      participants: [
        { playerId: "winner", teamIndex: 0, state: createState(3, 50) },
        { playerId: "loser", teamIndex: 1, state: createState(3, 50) },
      ],
    });
    const staleResult = service.replayMatch({
      type: "singles",
      winnerTeamIndex: 0,
      scores: [{ scoreA: 11, scoreB: 9 }],
      inactiveElapsedMsByPlayerId: {
        winner: 20 * DAY_MS,
        loser: 20 * DAY_MS,
      },
      participants: [
        { playerId: "winner", teamIndex: 0, state: createState(3, 50) },
        { playerId: "loser", teamIndex: 1, state: createState(3, 50) },
      ],
    });

    expect(freshResult.winner.rating.singles).toBe(3.017);
    expect(freshResult.loser.rating.singles).toBe(2.983);
    expect(staleResult.winner.rating.singles).toBe(3.025);
    expect(staleResult.loser.rating.singles).toBe(2.975);
    expect(staleResult.winner.rating.singles).toBeGreaterThan(
      freshResult.winner.rating.singles,
    );
    expect(staleResult.loser.rating.singles).toBeLessThan(
      freshResult.loser.rating.singles,
    );
  });

  it("peerConfidence도 decay된 값으로 계산되어 장기 미플레이 peers일수록 confidence 상승폭이 줄어든다", () => {
    const service = new RatingService();
    const freshPeersResult = service.replayMatch({
      type: "mixed-doubles",
      winnerTeamIndex: 0,
      scores: [{ scoreA: 11, scoreB: 9 }],
      inactiveElapsedMsByPlayerId: {
        a: 14 * DAY_MS,
        b: 14 * DAY_MS,
        c: 14 * DAY_MS,
        d: 14 * DAY_MS,
      },
      participants: [
        { playerId: "a", teamIndex: 0, state: createState(3, 50) },
        { playerId: "b", teamIndex: 0, state: createState(3, 50) },
        { playerId: "c", teamIndex: 1, state: createState(3, 50) },
        { playerId: "d", teamIndex: 1, state: createState(3, 50) },
      ],
    });
    const stalePeersResult = service.replayMatch({
      type: "mixed-doubles",
      winnerTeamIndex: 0,
      scores: [{ scoreA: 11, scoreB: 9 }],
      inactiveElapsedMsByPlayerId: {
        a: 14 * DAY_MS,
        b: 24 * DAY_MS,
        c: 24 * DAY_MS,
        d: 24 * DAY_MS,
      },
      participants: [
        { playerId: "a", teamIndex: 0, state: createState(3, 50) },
        { playerId: "b", teamIndex: 0, state: createState(3, 50) },
        { playerId: "c", teamIndex: 1, state: createState(3, 50) },
        { playerId: "d", teamIndex: 1, state: createState(3, 50) },
      ],
    });

    expect(freshPeersResult.a.metrics.doubles.confidence).toBe(53);
    expect(stalePeersResult.a.metrics.doubles.confidence).toBe(52);
    expect(stalePeersResult.a.metrics.doubles.confidence).toBeLessThan(
      freshPeersResult.a.metrics.doubles.confidence,
    );
  });

  it("unrestricted-singles도 singles track를 갱신한다", () => {
    const service = new RatingService();
    const result = service.replayMatch({
      type: "unrestricted-singles",
      winnerTeamIndex: 0,
      scores: [{ scoreA: 11, scoreB: 9 }],
      participants: [
        { playerId: "winner", teamIndex: 0, state: createState() },
        { playerId: "loser", teamIndex: 1, state: createState() },
      ],
    });

    expect(result.winner.rating.singles).toBe(3.034);
    expect(result.winner.rating.doubles).toBe(3);
  });

  it("모든 doubles subtype이 doubles track를 갱신한다", () => {
    const service = new RatingService();

    for (const type of [
      "mixed-doubles",
      "men-doubles",
      "women-doubles",
      "unrestricted-doubles",
    ] as const) {
      const result = service.replayMatch({
        type,
        winnerTeamIndex: 0,
        scores: [{ scoreA: 11, scoreB: 9 }],
        participants: [
          { playerId: "a", teamIndex: 0, state: createState() },
          { playerId: "b", teamIndex: 0, state: createState() },
          { playerId: "c", teamIndex: 1, state: createState() },
          { playerId: "d", teamIndex: 1, state: createState() },
        ],
      });

      expect(result.a.rating.doubles).toBe(3.034);
      expect(result.a.rating.singles).toBe(3);
    }
  });
});
