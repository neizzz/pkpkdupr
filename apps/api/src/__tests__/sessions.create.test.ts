import type { Player } from "@pkpkdupr/shared/player";
import type {
  ManagedMatchSession,
  Match,
  Session,
} from "@pkpkdupr/shared/match";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { MatchRepository } from "../repositories/MatchRepository";
import {
  AuthService,
  type AuthenticatedSession,
} from "../services/AuthService";

const now = new Date("2026-07-23T10:00:00.000Z");
const admin: Player = {
  id: "admin-001",
  username: "admin",
  gender: "M",
  status: "active",
  duprRating: null,
  createdAt: now,
  updatedAt: now,
};
const adminSession: AuthenticatedSession = {
  payload: { playerId: admin.id, isAdmin: true },
  player: admin,
  isFirstLogin: false,
};
const participants: Player[] = Array.from({ length: 4 }, (_, index) => ({
  id: `player-${index + 1}`,
  username: `player-${index + 1}`,
  gender: "M",
  status: "active",
  duprRating: null,
  createdAt: now,
  updatedAt: now,
}));
const managedSession: ManagedMatchSession = {
  id: "Ssession1",
  name: "토요 오전 세션",
  date: new Date("2026-07-25T01:00:00.000Z"),
  location: "PKELO Court A",
  participantIds: participants.map((player) => player.id),
  matchCount: 0,
  createdAt: now,
  updatedAt: now,
};

describe("admin match sessions", () => {
  beforeEach(() => {
    vi.spyOn(
      AuthService.prototype,
      "authenticateAccessToken",
    ).mockResolvedValue(adminSession);
    vi.spyOn(AuthService.prototype, "initAdmin").mockResolvedValue(admin);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("경기 결과 없이 예정 세션 정보만 생성한다", async () => {
    const createdSession: Session = {
      id: "Ssession1",
      name: "토요 오전 세션",
      date: new Date("2026-07-25T01:00:00.000Z"),
      location: "PKELO Court A",
    };
    const createSession = vi
      .spyOn(MatchRepository.prototype, "createSession")
      .mockResolvedValue(createdSession);

    const response = await request(app)
      .post("/api/admin/match-sessions")
      .set("Authorization", "Bearer admin-token")
      .send({
        name: createdSession.name,
        date: createdSession.date.toISOString(),
        location: createdSession.location,
      });

    expect(response.status).toBe(201);
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        name: createdSession.name,
        date: createdSession.date,
        location: createdSession.location,
      }),
    );
    expect(response.body).toEqual({
      ...createdSession,
      date: createdSession.date.toISOString(),
    });
  });

  it("필수 세션 정보가 없으면 생성하지 않는다", async () => {
    const createSession = vi.spyOn(
      MatchRepository.prototype,
      "createSession",
    );

    const response = await request(app)
      .post("/api/admin/match-sessions")
      .set("Authorization", "Bearer admin-token")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "세션 정보가 필요합니다." });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("세션 참여자를 등록한다", async () => {
    vi.spyOn(AuthService.prototype, "getAllPlayers").mockResolvedValue([
      admin,
      ...participants,
    ]);
    const replaceParticipants = vi
      .spyOn(MatchRepository.prototype, "replaceSessionParticipants")
      .mockResolvedValue(managedSession);

    const response = await request(app)
      .put(`/api/admin/match-sessions/${managedSession.id}/participants`)
      .set("Authorization", "Bearer admin-token")
      .send({ playerIds: managedSession.participantIds });

    expect(response.status).toBe(200);
    expect(replaceParticipants).toHaveBeenCalledWith(
      managedSession.id,
      managedSession.participantIds,
    );
    expect(response.body.participantIds).toEqual(
      managedSession.participantIds,
    );
  });

  it("등록된 참여자로 결과 없는 예정 경기를 생성한다", async () => {
    vi.spyOn(AuthService.prototype, "getAllPlayers").mockResolvedValue([
      admin,
      ...participants,
    ]);
    vi.spyOn(
      MatchRepository.prototype,
      "findSessionById",
    ).mockResolvedValue(managedSession);
    const createdMatch: Match = {
      id: "Mmatch01",
      name: "1번 경기",
      type: "men-doubles",
      mode: "single-game",
      source: "admin_created",
      creatorPlayerId: admin.id,
      session: managedSession,
      status: "created",
      teams: [
        {
          id: "team-a",
          name: "Team A",
          players: participants.slice(0, 2),
        },
        {
          id: "team-b",
          name: "Team B",
          players: participants.slice(2, 4),
        },
      ],
      scores: [],
      resultSubmittedByPlayerId: null,
      resultSubmittedAt: null,
      approvals: [],
      location: managedSession.location,
      matchStartsAt: managedSession.date,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const createMatch = vi
      .spyOn(MatchRepository.prototype, "create")
      .mockResolvedValue(createdMatch);

    const response = await request(app)
      .post(`/api/admin/match-sessions/${managedSession.id}/matches`)
      .set("Authorization", "Bearer admin-token")
      .send({
        name: createdMatch.name,
        type: createdMatch.type,
        mode: createdMatch.mode,
        matchStartsAt: createdMatch.matchStartsAt.toISOString(),
        teams: [
          {
            name: "Team A",
            playerIds: participants.slice(0, 2).map((player) => player.id),
          },
          {
            name: "Team B",
            playerIds: participants.slice(2, 4).map((player) => player.id),
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(createMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "created",
        source: "admin_created",
        scores: [],
        resultSubmittedByPlayerId: null,
        completedAt: null,
      }),
    );
    expect(response.body).toMatchObject({
      status: "created",
      source: "admin_created",
      scores: [],
      completedAt: null,
    });
  });

  it("관리자가 세션 예정 경기의 결과를 입력하고 레이팅을 재계산한다", async () => {
    const completedMatch: Match = {
      id: "Mmatch01",
      name: "1번 경기",
      type: "men-doubles",
      mode: "single-game",
      source: "admin_created",
      creatorPlayerId: admin.id,
      session: managedSession,
      status: "completed",
      teams: [
        {
          id: "team-a",
          name: "Team A",
          players: participants.slice(0, 2),
        },
        {
          id: "team-b",
          name: "Team B",
          players: participants.slice(2, 4),
        },
      ],
      scores: [{ scoreA: 11, scoreB: 8 }],
      resultSubmittedByPlayerId: admin.id,
      resultSubmittedAt: now,
      approvals: [],
      location: managedSession.location,
      matchStartsAt: managedSession.date,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const recordResult = vi
      .spyOn(MatchRepository.prototype, "recordAdminResult")
      .mockResolvedValue(completedMatch);
    vi.spyOn(MatchRepository.prototype, "findAll").mockResolvedValue({
      matches: [completedMatch],
      total: 1,
    });
    const recalculate = vi
      .spyOn(AuthService.prototype, "recalculateDuprRatings")
      .mockResolvedValue({
        ratingChangeLogs: [],
        perMatchLogs: [],
        changedPlayerCount: 0,
        restoredMatchDuprSnapshotCount: 0,
        restoredMatchDuprSnapshotMatchCount: 0,
        perMatchLogCount: 0,
      });

    const response = await request(app)
      .post(`/api/admin/matches/${completedMatch.id}/result`)
      .set("Authorization", "Bearer admin-token")
      .send({ scores: completedMatch.scores });

    expect(response.status).toBe(200);
    expect(recordResult).toHaveBeenCalledWith(
      completedMatch.id,
      admin.id,
      completedMatch.scores,
    );
    expect(recalculate).toHaveBeenCalledWith(
      [completedMatch],
      expect.objectContaining({ source: "manual_recalculation" }),
    );
    expect(response.body.match).toMatchObject({
      id: completedMatch.id,
      status: "completed",
      scores: completedMatch.scores,
    });
  });

  it("관리자가 세션 경기를 삭제하고 남은 완료 경기를 재계산한다", async () => {
    const verifyAdminPassword = vi
      .spyOn(AuthService.prototype, "verifyAdminPassword")
      .mockResolvedValue(true);
    const deleteMatch = vi
      .spyOn(MatchRepository.prototype, "delete")
      .mockResolvedValue(undefined);
    vi.spyOn(MatchRepository.prototype, "findAll").mockResolvedValue({
      matches: [],
      total: 0,
    });
    const recalculate = vi
      .spyOn(AuthService.prototype, "recalculateDuprRatings")
      .mockResolvedValue({
        ratingChangeLogs: [],
        perMatchLogs: [],
        changedPlayerCount: 0,
        restoredMatchDuprSnapshotCount: 0,
        restoredMatchDuprSnapshotMatchCount: 0,
        perMatchLogCount: 0,
      });

    const response = await request(app)
      .delete("/api/admin/matches/Mmatch01")
      .set("Authorization", "Bearer admin-token")
      .send({ adminPassword: "admin-password" });

    expect(response.status).toBe(200);
    expect(verifyAdminPassword).toHaveBeenCalledWith(
      admin.id,
      "admin-password",
    );
    expect(deleteMatch).toHaveBeenCalledWith("Mmatch01");
    expect(recalculate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ source: "manual_recalculation" }),
    );
    expect(response.body.deletedMatchId).toBe("Mmatch01");
  });

  it("admin 비밀번호가 틀리면 세션 경기를 삭제하지 않는다", async () => {
    vi.spyOn(AuthService.prototype, "verifyAdminPassword").mockResolvedValue(
      false,
    );
    const deleteMatch = vi.spyOn(MatchRepository.prototype, "delete");

    const response = await request(app)
      .delete("/api/admin/matches/Mmatch01")
      .set("Authorization", "Bearer admin-token")
      .send({ adminPassword: "wrong-password" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "admin 비밀번호가 올바르지 않습니다.",
    });
    expect(deleteMatch).not.toHaveBeenCalled();
  });
});
