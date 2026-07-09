import {
  createDefaultPlayerDupr,
  createDefaultPlayerDuprMetrics,
  type StoredPlayerDupr,
} from "@pkpkdupr/shared/player";
import { describe, expect, it } from "vitest";
import {
  getScoreMarginMultiplier,
  getSetMarginMultiplier,
  RatingService,
} from "../services/RatingService";

const createState = (rating = 3): StoredPlayerDupr => ({
  rating: createDefaultPlayerDupr(rating),
  metrics: createDefaultPlayerDuprMetrics(),
});

describe("RatingService", () => {
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

    expect(closeResult.winner.rating.singles.standard).toBe(3.034);
    expect(closeResult.loser.rating.singles.standard).toBe(2.966);
    expect(blowoutResult.winner.rating.singles.standard).toBe(3.045);
    expect(blowoutResult.loser.rating.singles.standard).toBe(2.955);
    expect(blowoutResult.winner.rating.singles.standard).toBeGreaterThan(
      closeResult.winner.rating.singles.standard,
    );
    expect(blowoutResult.loser.rating.singles.standard).toBeLessThan(
      closeResult.loser.rating.singles.standard,
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

    expect(twoToOneResult.winner.rating.singles.standard).toBe(3.034);
    expect(twoToOneResult.loser.rating.singles.standard).toBe(2.966);
    expect(twoToZeroResult.winner.rating.singles.standard).toBe(3.036);
    expect(twoToZeroResult.loser.rating.singles.standard).toBe(2.964);
    expect(twoToZeroResult.winner.rating.singles.standard).toBeGreaterThan(
      twoToOneResult.winner.rating.singles.standard,
    );
    expect(twoToZeroResult.loser.rating.singles.standard).toBeLessThan(
      twoToOneResult.loser.rating.singles.standard,
    );
  });
});
