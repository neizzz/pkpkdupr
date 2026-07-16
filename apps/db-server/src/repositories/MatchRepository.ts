import type {
  MatchMode,
  Match,
  MatchResultApproval,
  MatchScore,
  Session,
  MatchSource,
  MatchType,
  Team,
} from "@pkpkdupr/shared/match";
import {
  DEFAULT_MATCH_MODE,
  MATCH_RESULT_MAX_SCORE_COUNT,
  validateMatchScoresForMode,
} from "@pkpkdupr/shared/match";
import {
  normalizeNullablePlayerDupr,
  type Player,
  type PublicPlayerDupr,
} from "@pkpkdupr/shared/player";
import { and, desc, eq } from "drizzle-orm";
import {
  matchParticipants,
  matchResultApprovals,
  matches,
  matchScores,
  players,
} from "../db/schema";

type StoredMatch = typeof matches.$inferSelect;
type StoredMatchParticipant = typeof matchParticipants.$inferSelect;
type StoredMatchScore = typeof matchScores.$inferSelect;
type StoredMatchApproval = typeof matchResultApprovals.$inferSelect;
type StoredPlayer = typeof players.$inferSelect;

export const COMPLETED_MATCH_RESULT_EDIT_ERROR_MESSAGE =
  "이미 완료된 매치 결과는 수정할 수 없습니다.";
export const COMPLETED_MATCH_APPROVAL_CANCEL_ERROR_MESSAGE =
  "이미 완료된 매치 합의는 취소할 수 없습니다.";

export class CompletedMatchResultEditError extends Error {
  constructor() {
    super(COMPLETED_MATCH_RESULT_EDIT_ERROR_MESSAGE);
    this.name = "CompletedMatchResultEditError";
  }
}

export class CompletedMatchApprovalCancelError extends Error {
  constructor() {
    super(COMPLETED_MATCH_APPROVAL_CANCEL_ERROR_MESSAGE);
    this.name = "CompletedMatchApprovalCancelError";
  }
}

export interface CreateMatchInput {
  id: string;
  type: MatchType;
  mode: MatchMode;
  source?: MatchSource;
  creatorPlayerId: string;
  name?: string;
  session?: Session;
  status: Match["status"];
  teams: [Team, Team];
  scores?: MatchScore[];
  location: string;
  scheduledAt: Date;
  matchStartsAt: Date;
  completedAt: Date | null;
  resultSubmittedByPlayerId?: string | null;
  resultSubmittedAt?: Date | null;
  approvals?: MatchResultApproval[];
}

export interface UpdateMatchMetadataInput {
  name?: string | null;
  sessionName?: string | null;
  sessionDate?: Date | null;
}

export interface MatchParticipantDuprSnapshot {
  matchId: string;
  playerId: string;
  duprRating: PublicPlayerDupr | null;
}

const toDateOrNull = (value: Date | string | number | null | undefined) =>
  value == null ? null : new Date(value);

const toDate = (value: Date | string | number) => new Date(value);

// Drizzle's `timestamp` integer mode persists Unix seconds. Raw libSQL queries
// bypass that conversion, so match mutation timestamps must be converted here.
const toUnixTimestampSeconds = (value: Date) =>
  Math.floor(value.getTime() / 1000);

const toPublicPlayer = (record: StoredPlayer): Player => ({
  id: record.id,
  username: record.username,
  duprRating: normalizeNullablePlayerDupr(record.duprRating),
  gender: record.gender as Player["gender"],
  status: record.status as Player["status"],
  avatarUrl: record.avatarUrl ?? undefined,
  createdAt: toDate(record.createdAt),
  updatedAt: toDate(record.updatedAt),
});

const toMatchScore = (score: StoredMatchScore): MatchScore => ({
  scoreA: score.scoreA,
  scoreB: score.scoreB,
});

const toApproval = (approval: StoredMatchApproval): MatchResultApproval => ({
  playerId: approval.playerId,
  approvedAt: toDate(approval.approvedAt),
});

const parseParticipantDuprSnapshot = (
  value: string | null,
): PublicPlayerDupr | null | undefined => {
  if (value == null) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed == null) {
      return null;
    }
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }

    const { singles, doubles } = parsed as Record<string, unknown>;
    const isPublicRating = (rating: unknown): rating is number | null =>
      rating == null || (typeof rating === "number" && Number.isFinite(rating));

    return isPublicRating(singles) && isPublicRating(doubles)
      ? { singles, doubles }
      : undefined;
  } catch {
    return undefined;
  }
};

const areScoresEqual = (
  currentScores: MatchScore[] = [],
  nextScores: MatchScore[],
) =>
  currentScores.length === nextScores.length &&
  currentScores.every(
    (currentScore, index) =>
      currentScore.scoreA === nextScores[index]?.scoreA &&
      currentScore.scoreB === nextScores[index]?.scoreB,
  );

/**
 * MatchRepository - DB 서버의 경기 저장소.
 *
 * matches, match_scores, match_participants, match_result_approvals를 조립해
 * shared Match 계약 형태로 반환합니다.
 */
export class MatchRepository {
  constructor(
    private db: any,
    private client: any,
  ) {}

  async findById(id: string): Promise<Match | undefined> {
    const match = await this.db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .get();

    if (!match) {
      return undefined;
    }

    return await this.hydrateMatch(match);
  }

  async findAll(
    page: number = 0,
    limit: number = 20,
    playerId?: string,
  ): Promise<{ matches: Match[]; total: number }> {
    const allMatches = await this.db
      .select()
      .from(matches)
      .orderBy(desc(matches.createdAt))
      .all();
    const hydratedMatches: Match[] = await Promise.all(
      allMatches.map((match: StoredMatch) => this.hydrateMatch(match)),
    );
    const filteredMatches = playerId
      ? hydratedMatches.filter((match) =>
          match.teams.some((team) =>
            team.players.some((player) => player.id === playerId),
          ),
        )
      : hydratedMatches;
    const start = page * limit;

    return {
      matches: filteredMatches.slice(start, start + limit),
      total: filteredMatches.length,
    };
  }

  async create(data: CreateMatchInput): Promise<Match> {
    const now = new Date();

    if ((data.scores?.length ?? 0) > 0) {
      validateMatchScoresForMode(data.mode, data.scores ?? []);
    }

    await this.db.insert(matches).values({
      id: data.id,
      type: data.type,
      mode: data.mode,
      source: data.source ?? "player_created",
      creatorPlayerId: data.creatorPlayerId,
      name: data.name?.trim() || null,
      sessionName: data.session?.name?.trim() || null,
      sessionDate: toDateOrNull(data.session?.date),
      status: data.status,
      location: data.location,
      scheduledAt: new Date(data.scheduledAt),
      matchStartsAt: new Date(data.matchStartsAt),
      completedAt: toDateOrNull(data.completedAt),
      resultSubmittedByPlayerId: data.resultSubmittedByPlayerId ?? null,
      resultSubmittedAt: toDateOrNull(data.resultSubmittedAt),
      createdAt: now,
      updatedAt: now,
    });

    await this.createParticipants(data.id, data.teams);
    await this.replaceScores(data.id, data.scores ?? []);
    await this.createApprovals(data.id, data.approvals ?? []);

    const created = await this.findById(data.id);
    if (!created) {
      throw new Error("매치 생성에 실패했습니다.");
    }
    return created;
  }

  async fillMissingParticipantDuprSnapshots(
    snapshots: MatchParticipantDuprSnapshot[],
  ): Promise<{
    updatedParticipantCount: number;
    updatedMatchCount: number;
  }> {
    const updatedMatchIds = new Set<string>();
    let updatedParticipantCount = 0;

    for (const snapshot of snapshots) {
      if (!snapshot.matchId || !snapshot.playerId) {
        continue;
      }

      const result = await this.client.execute({
        sql: `
          UPDATE match_participants
          SET dupr_rating_json = ?
          WHERE match_id = ?
            AND player_id = ?
            AND dupr_rating_json IS NULL
        `,
        args: [
          JSON.stringify(snapshot.duprRating ?? null),
          snapshot.matchId,
          snapshot.playerId,
        ],
      });

      if (result.rowsAffected) {
        updatedParticipantCount += result.rowsAffected;
        updatedMatchIds.add(snapshot.matchId);
      }
    }

    return {
      updatedParticipantCount,
      updatedMatchCount: updatedMatchIds.size,
    };
  }

  async submitResult(
    matchId: string,
    submittedByPlayerId: string,
    scores: MatchScore[],
    approvalId: string,
    submittedAt: Date = new Date(),
  ): Promise<Match> {
    const existing = await this.findById(matchId);
    if (!existing) {
      throw new Error("매치를 찾을 수 없습니다.");
    }

    if (existing.status === "completed") {
      throw new CompletedMatchResultEditError();
    }

    if (
      existing.status !== "created" &&
      existing.status !== "pending-approval"
    ) {
      throw new Error("결과를 입력할 수 없는 매치 상태입니다.");
    }

    if (existing.creatorPlayerId !== submittedByPlayerId) {
      throw new Error("매치 생성자만 결과를 입력할 수 있습니다.");
    }

    if (scores.length > MATCH_RESULT_MAX_SCORE_COUNT) {
      throw new Error(
        `스코어는 최대 ${MATCH_RESULT_MAX_SCORE_COUNT}개까지 입력할 수 있습니다.`,
      );
    }

    validateMatchScoresForMode(existing.mode, scores);

    const scoreColumns = await this.getMatchScoreColumns();
    const shouldResetApprovals =
      existing.status === "created" || !areScoresEqual(existing.scores, scores);
    const transaction = await this.client.transaction("write");
    let committed = false;

    try {
      const updateResult = await transaction.execute({
        sql: `
          UPDATE matches
          SET
            status = ?,
            result_submitted_by_player_id = ?,
            result_submitted_at = ?,
            completed_at = NULL,
            updated_at = ?
          WHERE id = ?
            AND status IN ('created', 'pending-approval')
        `,
        args: [
          "pending-approval",
          submittedByPlayerId,
          toUnixTimestampSeconds(submittedAt),
          toUnixTimestampSeconds(submittedAt),
          matchId,
        ],
      });

      if (!updateResult.rowsAffected) {
        throw new Error("RESULT_SUBMIT_STATE_CONFLICT");
      }

      await this.replaceScoresWithExecutor(
        matchId,
        scores,
        scoreColumns,
        transaction,
      );
      if (shouldResetApprovals) {
        await transaction.execute({
          sql: `DELETE FROM match_result_approvals WHERE match_id = ?`,
          args: [matchId],
        });
      }
      await transaction.execute({
        sql: `
          INSERT OR IGNORE INTO match_result_approvals (id, match_id, player_id, approved_at)
          VALUES (?, ?, ?, ?)
        `,
        args: [
          approvalId,
          matchId,
          submittedByPlayerId,
          toUnixTimestampSeconds(submittedAt),
        ],
      });
      if (!shouldResetApprovals) {
        await this.completeMatchIfFullyApproved(
          matchId,
          submittedAt,
          transaction,
        );
      }

      await transaction.commit();
      committed = true;
    } catch (error) {
      transaction.close();
      const current = await this.findById(matchId);
      if (
        (error as Error).message === "RESULT_SUBMIT_STATE_CONFLICT" &&
        current?.status === "completed"
      ) {
        throw new CompletedMatchResultEditError();
      }
      throw error;
    } finally {
      if (!committed) {
        transaction.close();
      }
    }

    const updated = await this.findById(matchId);
    if (!updated) {
      throw new Error("매치 결과 저장에 실패했습니다.");
    }
    return updated;
  }

  async approveResult(
    matchId: string,
    playerId: string,
    approvalId: string,
    approvedAt: Date = new Date(),
  ): Promise<Match> {
    const existing = await this.findById(matchId);
    if (!existing) {
      throw new Error("매치를 찾을 수 없습니다.");
    }

    if (existing.status !== "pending-approval") {
      throw new Error("승인할 수 없는 매치 상태입니다.");
    }

    const participantIds = existing.teams.flatMap((team) =>
      team.players.map((player) => player.id),
    );
    if (!participantIds.includes(playerId)) {
      throw new Error("매치 참여자만 결과를 승인할 수 있습니다.");
    }

    if (existing.approvals.some((approval) => approval.playerId === playerId)) {
      throw new Error("이미 승인한 매치 결과입니다.");
    }

    const transaction = await this.client.transaction("write");
    let committed = false;

    try {
      await transaction.execute({
        sql: `
          INSERT INTO match_result_approvals (id, match_id, player_id, approved_at)
          VALUES (?, ?, ?, ?)
        `,
        args: [
          approvalId,
          matchId,
          playerId,
          toUnixTimestampSeconds(approvedAt),
        ],
      });

      await this.completeMatchIfFullyApproved(matchId, approvedAt, transaction);

      await transaction.commit();
      committed = true;
    } finally {
      if (!committed) {
        transaction.close();
      }
    }

    const completed = await this.findById(matchId);
    if (!completed) {
      throw new Error("매치 완료 처리에 실패했습니다.");
    }
    return completed;
  }

  async cancelApproval(matchId: string, playerId: string): Promise<Match> {
    const existing = await this.findById(matchId);
    if (!existing) {
      throw new Error("매치를 찾을 수 없습니다.");
    }

    if (existing.status === "completed") {
      throw new CompletedMatchApprovalCancelError();
    }

    if (existing.status !== "pending-approval") {
      throw new Error("합의를 취소할 수 없는 매치 상태입니다.");
    }

    const participantIds = existing.teams.flatMap((team) =>
      team.players.map((player) => player.id),
    );
    if (!participantIds.includes(playerId)) {
      throw new Error("매치 참여자만 합의를 취소할 수 있습니다.");
    }

    if (
      !existing.approvals.some((approval) => approval.playerId === playerId)
    ) {
      throw new Error("취소할 합의 내역이 없습니다.");
    }

    const transaction = await this.client.transaction("write");
    let committed = false;

    try {
      const deleteResult = await transaction.execute({
        sql: `
          DELETE FROM match_result_approvals
          WHERE match_id = ?
            AND player_id = ?
            AND EXISTS (
              SELECT 1
              FROM matches
              WHERE matches.id = match_result_approvals.match_id
                AND matches.status = 'pending-approval'
            )
        `,
        args: [matchId, playerId],
      });

      if (!deleteResult.rowsAffected) {
        throw new Error("APPROVAL_CANCEL_STATE_CONFLICT");
      }

      await transaction.commit();
      committed = true;
    } catch (error) {
      transaction.close();
      const current = await this.findById(matchId);
      if (
        (error as Error).message === "APPROVAL_CANCEL_STATE_CONFLICT" &&
        current?.status === "completed"
      ) {
        throw new CompletedMatchApprovalCancelError();
      }
      throw error;
    } finally {
      if (!committed) {
        transaction.close();
      }
    }

    const updated = await this.findById(matchId);
    if (!updated) {
      throw new Error("합의 취소 처리에 실패했습니다.");
    }
    return updated;
  }

  async updateMetadata(
    id: string,
    data: UpdateMatchMetadataInput,
  ): Promise<Match | undefined> {
    const updatePayload: Partial<typeof matches.$inferInsert> = {
      updatedAt: new Date(),
    };

    if ("name" in data) {
      updatePayload.name = data.name?.trim() || null;
    }

    if ("sessionName" in data) {
      updatePayload.sessionName = data.sessionName?.trim() || null;
    }

    if ("sessionDate" in data) {
      updatePayload.sessionDate = toDateOrNull(data.sessionDate);
    }

    await this.db.update(matches).set(updatePayload).where(eq(matches.id, id));
    return await this.findById(id);
  }

  private async hydrateMatch(match: StoredMatch): Promise<Match> {
    const [participants, scores, approvals] = await Promise.all([
      this.db
        .select()
        .from(matchParticipants)
        .where(eq(matchParticipants.matchId, match.id))
        .all(),
      this.db
        .select()
        .from(matchScores)
        .where(eq(matchScores.matchId, match.id))
        .all(),
      this.db
        .select()
        .from(matchResultApprovals)
        .where(eq(matchResultApprovals.matchId, match.id))
        .all(),
    ]);
    const playerRecords = await Promise.all(
      participants.map((participant: StoredMatchParticipant) =>
        this.db
          .select()
          .from(players)
          .where(eq(players.id, participant.playerId))
          .get(),
      ),
    );
    const playerById = new Map<string, Player>(
      playerRecords
        .filter(Boolean)
        .map((player: StoredPlayer) => [player.id, toPublicPlayer(player)]),
    );
    const teams: [Team, Team] = [0, 1].map((teamIndex) => ({
      id: `${match.id}-team-${teamIndex}`,
      name: `Team ${teamIndex === 0 ? "A" : "B"}`,
      players: participants
        .filter(
          (participant: StoredMatchParticipant) =>
            participant.teamIndex === teamIndex,
        )
        .map((participant: StoredMatchParticipant) => {
          const player = playerById.get(participant.playerId);
          const duprRating = parseParticipantDuprSnapshot(
            participant.duprRatingJson,
          );

          return player && duprRating !== undefined
            ? { ...player, duprRating }
            : player;
        })
        .filter((player: Player | undefined): player is Player =>
          Boolean(player),
        ),
    })) as [Team, Team];

    const hydratedMatch = {
      id: match.id,
      type: match.type as MatchType,
      mode: (match.mode as MatchMode | null) ?? DEFAULT_MATCH_MODE,
      source: (match.source as MatchSource | null) ?? "player_created",
      creatorPlayerId: match.creatorPlayerId,
      name: match.name?.trim() || undefined,
      sessionName: match.sessionName?.trim() || undefined,
      session: match.sessionDate
        ? {
            name: match.sessionName?.trim() || undefined,
            date: toDate(match.sessionDate),
          }
        : undefined,
      status: match.status as Match["status"],
      teams,
      scores: scores.map(toMatchScore),
      resultSubmittedByPlayerId: match.resultSubmittedByPlayerId ?? null,
      resultSubmittedAt: toDateOrNull(match.resultSubmittedAt),
      approvals: approvals.map(toApproval),
      location: match.location,
      scheduledAt: toDate(match.scheduledAt),
      matchStartsAt: toDate(match.matchStartsAt),
      createdAt: toDate(match.createdAt),
      completedAt: toDateOrNull(match.completedAt),
      updatedAt: toDate(match.updatedAt),
    } as Match & { sessionName?: string };

    return hydratedMatch;
  }

  private async createParticipants(matchId: string, teams: [Team, Team]) {
    for (const [teamIndex, team] of teams.entries()) {
      for (const player of team.players) {
        await this.db.insert(matchParticipants).values({
          id: `${matchId}-team-${teamIndex}-${player.id}`,
          matchId,
          teamIndex,
          playerId: player.id,
          duprRatingJson: JSON.stringify(player.duprRating ?? null),
        });
      }
    }
  }

  private async replaceScores(matchId: string, scores: MatchScore[]) {
    await this.db.delete(matchScores).where(eq(matchScores.matchId, matchId));
    const scoreColumns = await this.getMatchScoreColumns();

    for (const [index, score] of scores.entries()) {
      await this.insertScore({
        id: `${matchId}-score-${index + 1}`,
        matchId,
        score,
        columns: scoreColumns,
      });
    }
  }

  private async replaceScoresWithExecutor(
    matchId: string,
    scores: MatchScore[],
    columns: Set<string>,
    executor: { execute: (statement: any) => Promise<any> },
  ) {
    await executor.execute({
      sql: `DELETE FROM match_scores WHERE match_id = ?`,
      args: [matchId],
    });

    for (const [index, score] of scores.entries()) {
      await this.insertScore({
        id: `${matchId}-score-${index + 1}`,
        matchId,
        score,
        columns,
        executor,
      });
    }
  }

  private async completeMatchIfFullyApproved(
    matchId: string,
    completedAt: Date,
    executor: { execute: (statement: any) => Promise<any> },
  ) {
    await executor.execute({
      sql: `
        UPDATE matches
        SET
          status = 'completed',
          completed_at = ?,
          updated_at = ?
        WHERE id = ?
          AND status = 'pending-approval'
          AND NOT EXISTS (
            SELECT 1
            FROM match_participants
            WHERE match_participants.match_id = matches.id
              AND NOT EXISTS (
                SELECT 1
                FROM match_result_approvals
                WHERE match_result_approvals.match_id = match_participants.match_id
                  AND match_result_approvals.player_id = match_participants.player_id
              )
          )
      `,
      args: [
        toUnixTimestampSeconds(completedAt),
        toUnixTimestampSeconds(completedAt),
        matchId,
      ],
    });
  }

  private async getMatchScoreColumns(): Promise<Set<string>> {
    const result = await this.client.execute(`PRAGMA table_info(match_scores)`);
    return new Set(
      result.rows.map((row: { name?: unknown }) => String(row.name)),
    );
  }

  private async insertScore({
    id,
    matchId,
    score,
    columns,
    executor = this.client,
  }: {
    id: string;
    matchId: string;
    score: MatchScore;
    columns: Set<string>;
    executor?: { execute: (statement: any) => Promise<any> };
  }) {
    const insertColumns = ["id", "match_id"];
    const args: Array<string | number> = [id, matchId];

    const addColumn = (column: string, value: number) => {
      if (!columns.has(column)) {
        return;
      }
      insertColumns.push(column);
      args.push(value);
    };

    addColumn("score_a", score.scoreA);
    addColumn("score_b", score.scoreB);
    // Legacy local SQLite files may still have these NOT NULL columns.
    // Keep them populated until old DB files are recreated or migrated away.
    addColumn("team_a", score.scoreA);
    addColumn("team_b", score.scoreB);
    addColumn("t_b", score.scoreB);

    await executor.execute({
      sql: `INSERT INTO match_scores (${insertColumns.join(", ")}) VALUES (${insertColumns.map(() => "?").join(", ")})`,
      args,
    });
  }

  private async createApprovals(
    matchId: string,
    approvals: MatchResultApproval[],
  ) {
    for (const approval of approvals) {
      await this.insertApprovalIfMissing(
        `${matchId}-approval-${approval.playerId}`,
        matchId,
        approval.playerId,
        approval.approvedAt,
      );
    }
  }

  private async insertApprovalIfMissing(
    id: string,
    matchId: string,
    playerId: string,
    approvedAt: Date,
  ) {
    const existing = await this.db
      .select()
      .from(matchResultApprovals)
      .where(
        and(
          eq(matchResultApprovals.matchId, matchId),
          eq(matchResultApprovals.playerId, playerId),
        ),
      )
      .get();

    if (existing) {
      return;
    }

    await this.db.insert(matchResultApprovals).values({
      id,
      matchId,
      playerId,
      approvedAt,
    });
  }
}
