import type { Club, ClubDashboard, ClubMembership } from "@pkpkdupr/shared/club";
import type { Player } from "@pkpkdupr/shared/player";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { ClubRepository } from "../repositories/ClubRepository";
import {
  AuthService,
  type AuthenticatedSession,
} from "../services/AuthService";

const now = new Date("2026-08-01T09:00:00.000Z");
const clubId = "Cclub001";

const buildPlayer = (id: string, username: string): Player => ({
  id,
  username,
  gender: "M",
  status: "active",
  duprRating: { singles: 3.5, doubles: 3.5 },
  createdAt: now,
  updatedAt: now,
});

const owner = buildPlayer("Powner01", "owner");
const manager = buildPlayer("Pmanag01", "manager");
const member = buildPlayer("Pmember1", "member");
const scanned = buildPlayer("Pscan001", "scanned");

const buildSession = (player: Player): AuthenticatedSession => ({
  payload: { playerId: player.id, isAdmin: false },
  player,
  isFirstLogin: false,
});

const buildMembership = (
  playerId: string,
  role: ClubMembership["role"],
): ClubMembership => ({
  clubId,
  playerId,
  role,
  status: "active",
  requestedAt: now,
  joinedAt: now,
});

const club: Club = {
  id: clubId,
  name: "테스트 클럽",
  description: "테스트 소개",
  createdAt: now,
  updatedAt: now,
};

const dashboard: ClubDashboard = {
  club,
  membership: buildMembership(owner.id, "owner"),
  upcomingSessions: [],
  upcomingMatches: [],
  announcements: [],
  rankings: { singles: [], doubles: [] },
  members: [],
  pendingRequests: [],
};

describe("club API", () => {
  beforeEach(() => {
    vi.spyOn(AuthService.prototype, "authenticateAccessToken").mockResolvedValue(
      buildSession(owner),
    );
    vi.spyOn(ClubRepository.prototype, "findMembership").mockResolvedValue(
      buildMembership(owner.id, "owner"),
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it("클럽 생성 시 현재 사용자를 클럽장으로 전달한다", async () => {
    const createClub = vi
      .spyOn(ClubRepository.prototype, "createClub")
      .mockResolvedValue(club);

    const response = await request(app)
      .post("/api/clubs")
      .set("Authorization", "Bearer test-token")
      .send({ name: " 테스트 클럽 ", description: " 테스트 소개 " });

    expect(response.status).toBe(201);
    expect(createClub).toHaveBeenCalledWith("테스트 클럽", "테스트 소개", owner.id);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: clubId,
        name: "테스트 클럽",
        description: "테스트 소개",
      }),
    );
  });

  it("운영진이 플레이어 QR을 스캔하면 즉시 멤버로 추가한다", async () => {
    vi.spyOn(AuthService.prototype, "authenticateAccessToken").mockResolvedValue(
      buildSession(manager),
    );
    vi.spyOn(ClubRepository.prototype, "findMembership").mockResolvedValue(
      buildMembership(manager.id, "manager"),
    );
    vi.spyOn(AuthService.prototype, "verifyPlayerQrToken").mockResolvedValue({
      player: scanned,
    });
    const addMember = vi
      .spyOn(ClubRepository.prototype, "addMemberByPlayerQr")
      .mockResolvedValue(buildMembership(scanned.id, "member"));

    const response = await request(app)
      .post(`/api/clubs/${clubId}/player-qr-members`)
      .set("Authorization", "Bearer test-token")
      .send({ payload: "player-qr-payload" });

    expect(response.status).toBe(201);
    expect(addMember).toHaveBeenCalledWith(clubId, scanned.id);
  });

  it("멤버가 클럽 QR을 스캔하면 가입 요청을 생성한다", async () => {
    vi.spyOn(AuthService.prototype, "authenticateAccessToken").mockResolvedValue(
      buildSession(member),
    );
    const requestJoin = vi
      .spyOn(ClubRepository.prototype, "requestJoinByInvite")
      .mockResolvedValue({
        clubId,
        playerId: member.id,
        role: "member",
        status: "pending",
        requestedAt: now,
      });

    const response = await request(app)
      .post("/api/club-invites/join-requests")
      .set("Authorization", "Bearer test-token")
      .send({ payload: "club-invite-token" });

    expect(response.status).toBe(201);
    expect(requestJoin).toHaveBeenCalledWith("club-invite-token", member.id);
  });

  it("일반 멤버는 가입 요청을 승인할 수 없다", async () => {
    vi.spyOn(AuthService.prototype, "authenticateAccessToken").mockResolvedValue(
      buildSession(member),
    );
    vi.spyOn(ClubRepository.prototype, "findMembership").mockResolvedValue(
      buildMembership(member.id, "member"),
    );
    const approve = vi.spyOn(ClubRepository.prototype, "approveJoinRequest");

    const response = await request(app)
      .post(`/api/clubs/${clubId}/join-requests/${scanned.id}/approve`)
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(403);
    expect(approve).not.toHaveBeenCalled();
  });

  it("운영진은 다른 멤버의 운영진 권한을 위임할 수 없다", async () => {
    vi.spyOn(AuthService.prototype, "authenticateAccessToken").mockResolvedValue(
      buildSession(manager),
    );
    vi.spyOn(ClubRepository.prototype, "findMembership").mockResolvedValue(
      buildMembership(manager.id, "manager"),
    );
    const setMemberRole = vi.spyOn(ClubRepository.prototype, "setMemberRole");

    const response = await request(app)
      .patch(`/api/clubs/${clubId}/members/${member.id}/role`)
      .set("Authorization", "Bearer test-token")
      .send({ role: "manager" });

    expect(response.status).toBe(403);
    expect(setMemberRole).not.toHaveBeenCalled();
  });

  it("활성 멤버에게만 클럽 대시보드를 반환한다", async () => {
    vi.spyOn(ClubRepository.prototype, "getDashboard").mockResolvedValue(
      dashboard,
    );

    const response = await request(app)
      .get(`/api/clubs/${clubId}/dashboard`)
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ club: expect.objectContaining({ id: clubId }) }),
    );
  });
});
