import type { Player } from "@pkpkdupr/shared/player";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { FriendRepository } from "../repositories/FriendRepository";
import {
  AuthService,
  type AuthenticatedSession,
} from "../services/AuthService";

const now = new Date("2026-08-18T00:00:00.000Z");
const currentPlayer: Player = {
  id: "Pfriend1",
  username: "current-player",
  gender: "F",
  status: "active",
  duprRating: null,
  createdAt: now,
  updatedAt: now,
};
const scannedPlayer: Player = {
  ...currentPlayer,
  id: "Pfriend2",
  username: "scanned-player",
};
const session: AuthenticatedSession = {
  payload: { playerId: currentPlayer.id, isAdmin: false },
  player: currentPlayer,
  isFirstLogin: false,
};

describe("POST /api/friends/player-qr", () => {
  beforeEach(() => {
    vi.spyOn(
      AuthService.prototype,
      "authenticateAccessToken",
    ).mockResolvedValue(session);
    vi.spyOn(AuthService.prototype, "initAdmin").mockResolvedValue(
      currentPlayer,
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it("상대 플레이어 QR을 검증해 즉시 친구로 추가한다", async () => {
    vi.spyOn(AuthService.prototype, "verifyPlayerQrToken").mockResolvedValue({
      player: scannedPlayer,
    });
    const addFriendship = vi
      .spyOn(FriendRepository.prototype, "addFriendship")
      .mockResolvedValue({
        playerId: currentPlayer.id,
        friendPlayerId: scannedPlayer.id,
        createdAt: now.toISOString(),
      });

    const response = await request(app)
      .post("/api/friends/player-qr")
      .set("Authorization", "Bearer test-token")
      .send({ payload: "player-qr-payload" });

    expect(response.status).toBe(201);
    expect(addFriendship).toHaveBeenCalledWith(
      currentPlayer.id,
      scannedPlayer.id,
    );
  });

  it.each([
    ["자기 자신", currentPlayer, "자기 자신은 친구로 추가할 수 없습니다."],
    ["이미 등록한 친구", scannedPlayer, "이미 친구로 등록되어 있습니다."],
  ])("%s QR은 거부한다", async (_label, qrPlayer, message) => {
    vi.spyOn(AuthService.prototype, "verifyPlayerQrToken").mockResolvedValue({
      player: qrPlayer,
    });
    vi.spyOn(FriendRepository.prototype, "addFriendship").mockRejectedValue(
      new Error(message),
    );

    const response = await request(app)
      .post("/api/friends/player-qr")
      .set("Authorization", "Bearer test-token")
      .send({ payload: "player-qr-payload" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: message });
  });
});
