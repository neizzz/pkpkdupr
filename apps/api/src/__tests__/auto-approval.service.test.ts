import { describe, expect, it, vi } from "vitest";
import { AutoApprovalService } from "../services/AutoApprovalService";

const evaluatingMatch = { id: "match-auto", status: "evaluating" } as any;

describe("AutoApprovalService", () => {
  it("만료·수동 합의 매치의 평점을 반영한 뒤 완료로 전환한다", async () => {
    const repository = {
      completeExpiredAutoApprovals: vi.fn().mockResolvedValue([evaluatingMatch]),
      findMatchesAwaitingRating: vi
        .fn()
        .mockResolvedValue([evaluatingMatch]),
      markRatingApplied: vi.fn().mockResolvedValue(undefined),
    };
    const authService = {
      applyMatchResultToRatings: vi.fn().mockResolvedValue([]),
    };
    const now = new Date("2026-07-31T10:00:00.000Z");

    const result = await new AutoApprovalService(
      repository as any,
      authService as any,
    ).process(now);

    expect(repository.completeExpiredAutoApprovals).toHaveBeenCalledWith(now);
    expect(authService.applyMatchResultToRatings).toHaveBeenCalledWith(
      evaluatingMatch,
    );
    expect(repository.markRatingApplied).toHaveBeenCalledWith(
      evaluatingMatch.id,
      now,
    );
    expect(result).toEqual({
      completedMatches: [evaluatingMatch],
      appliedRatingCount: 1,
    });
  });

  it("평점 반영에 실패하면 완료 시각을 기록하지 않아 다음 주기에 재시도한다", async () => {
    const repository = {
      completeExpiredAutoApprovals: vi.fn().mockResolvedValue([]),
      findMatchesAwaitingRating: vi
        .fn()
        .mockResolvedValue([evaluatingMatch]),
      markRatingApplied: vi.fn().mockResolvedValue(undefined),
    };
    const authService = {
      applyMatchResultToRatings: vi.fn().mockRejectedValue(new Error("failed")),
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await new AutoApprovalService(
      repository as any,
      authService as any,
    ).process();

    expect(repository.markRatingApplied).not.toHaveBeenCalled();
    expect(result.appliedRatingCount).toBe(0);
    errorSpy.mockRestore();
  });
});
