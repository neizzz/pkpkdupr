import type { Match } from "@pkpkdupr/shared/match";
import type { MatchRepository } from "../repositories/MatchRepository";
import type { AuthService } from "./AuthService";

type AutoApprovalMatchRepository = Pick<
  MatchRepository,
  | "completeExpiredAutoApprovals"
  | "findAutoApprovedMatchesAwaitingRating"
  | "markAutoApprovalRatingApplied"
>;

type AutoApprovalRatingService = Pick<AuthService, "applyMatchResultToRatings">;

/** 만료된 합의를 완료하고, 실패한 평점 반영도 다음 주기에 다시 시도합니다. */
export class AutoApprovalService {
  private isProcessing = false;

  constructor(
    private readonly matchRepository: AutoApprovalMatchRepository,
    private readonly authService: AutoApprovalRatingService,
  ) {}

  async process(now: Date = new Date()): Promise<{
    completedMatches: Match[];
    appliedRatingCount: number;
  }> {
    if (this.isProcessing) {
      return { completedMatches: [], appliedRatingCount: 0 };
    }

    this.isProcessing = true;
    try {
      const completedMatches =
        await this.matchRepository.completeExpiredAutoApprovals(now);
      const awaitingRating =
        await this.matchRepository.findAutoApprovedMatchesAwaitingRating();
      let appliedRatingCount = 0;

      for (const match of awaitingRating) {
        try {
          await this.authService.applyMatchResultToRatings(match);
          await this.matchRepository.markAutoApprovalRatingApplied(match.id, now);
          appliedRatingCount += 1;
        } catch (error) {
          console.error(
            `[AUTO_APPROVAL] 평점 반영 실패 (다음 주기에 재시도): ${match.id}`,
            error,
          );
        }
      }

      return { completedMatches, appliedRatingCount };
    } finally {
      this.isProcessing = false;
    }
  }
}
