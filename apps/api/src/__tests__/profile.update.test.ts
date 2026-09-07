import type { Player } from "@pkpkdupr/shared/player";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import {
  AuthService,
  type AuthenticatedSession,
} from "../services/AuthService";

const now = new Date("2026-07-24T10:00:00.000Z");
const player: Player = {
  id: "Pprofile",
  username: "profile-player",
  gender: "M",
  status: "active",
  duprRating: null,
  createdAt: now,
  updatedAt: now,
};
const session: AuthenticatedSession = {
  payload: { playerId: player.id, isAdmin: false },
  player,
  isFirstLogin: false,
};

describe("PATCH /api/me/profile", () => {
  beforeEach(() => {
    vi.spyOn(AuthService.prototype, "authenticateDeviceSession").mockResolvedValue(
      session,
    );
    vi.spyOn(AuthService.prototype, "initAdmin").mockResolvedValue(player);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("상태메시지와 대표 소속을 저장한다", async () => {
    const updatedPlayer: Player = {
      ...player,
      affiliations: [
        { name: "PKELO Gangnam", isPrimary: true },
        { name: "Weekend Club", isPrimary: false },
      ],
      statusMessage: "즐겁게 플레이해요",
      statusMessageBackgroundColor: "#D1FAE5",
    };
    const updateProfile = vi
      .spyOn(AuthService.prototype, "updatePlayerProfile")
      .mockResolvedValue(updatedPlayer);

    const response = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", "pkelo_session=test-session")
      .set("Origin", "http://localhost:8080")
      .send({
        affiliations: updatedPlayer.affiliations,
        statusMessage: "  즐겁게 플레이해요  ",
        statusMessageBackgroundColor: "#d1fae5",
      });

    expect(response.status).toBe(200);
    expect(updateProfile).toHaveBeenCalledWith(player.id, {
      affiliations: updatedPlayer.affiliations,
      statusMessage: "즐겁게 플레이해요",
      statusMessageBackgroundColor: "#D1FAE5",
    });
    expect(response.body).toMatchObject({
      affiliations: updatedPlayer.affiliations,
      statusMessage: updatedPlayer.statusMessage,
      statusMessageBackgroundColor: updatedPlayer.statusMessageBackgroundColor,
    });
  });

  it("대표가 둘 이상인 소속 목록을 거부한다", async () => {
    const updateProfile = vi.spyOn(AuthService.prototype, "updatePlayerProfile");

    const response = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", "pkelo_session=test-session")
      .set("Origin", "http://localhost:8080")
      .send({
        affiliations: [
          { name: "PKELO Gangnam", isPrimary: true },
          { name: "Weekend Club", isPrimary: true },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("대표 소속을 하나 지정해 주세요.");
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("생년월일을 저장하고 미래 날짜를 거부한다", async () => {
    const updatedPlayer: Player = { ...player, birthDate: "1990-08-25" };
    const updateProfile = vi
      .spyOn(AuthService.prototype, "updatePlayerProfile")
      .mockResolvedValue(updatedPlayer);

    const saved = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", "pkelo_session=test-session")
      .set("Origin", "http://localhost:8080")
      .send({ birthDate: "1990-08-25" });

    expect(saved.status).toBe(200);
    expect(updateProfile).toHaveBeenCalledWith(player.id, {
      birthDate: "1990-08-25",
    });

    const rejected = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", "pkelo_session=test-session")
      .set("Origin", "http://localhost:8080")
      .send({ birthDate: "2999-01-01" });

    expect(rejected.status).toBe(400);
    expect(rejected.body.error).toBe("생년월일은 오늘 이후일 수 없습니다.");
  });
});

describe("PATCH /api/me/preferences", () => {
  beforeEach(() => {
    vi.spyOn(AuthService.prototype, "authenticateDeviceSession").mockResolvedValue(
      session,
    );
    vi.spyOn(AuthService.prototype, "initAdmin").mockResolvedValue(player);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("지원하는 글자 크기를 계정에 저장한다", async () => {
    const updatePreference = vi
      .spyOn(AuthService.prototype, "updatePlayerFontSizePreference")
      .mockResolvedValue("large");

    const response = await request(app)
      .patch("/api/me/preferences")
      .set("Cookie", "pkelo_session=test-session")
      .set("Origin", "http://localhost:8080")
      .send({ fontSizePreference: "large" });

    expect(response.status).toBe(200);
    expect(updatePreference).toHaveBeenCalledWith(player.id, "large");
    expect(response.body).toEqual({ fontSizePreference: "large" });
  });

  it("지원하지 않는 글자 크기를 거부한다", async () => {
    const updatePreference = vi.spyOn(
      AuthService.prototype,
      "updatePlayerFontSizePreference",
    );

    const response = await request(app)
      .patch("/api/me/preferences")
      .set("Cookie", "pkelo_session=test-session")
      .set("Origin", "http://localhost:8080")
      .send({ fontSizePreference: "extra-large" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("지원하지 않는 글자 크기입니다.");
    expect(updatePreference).not.toHaveBeenCalled();
  });

  it("저장소 장애 시 재시도 가능한 오류를 반환한다", async () => {
    vi.spyOn(
      AuthService.prototype,
      "updatePlayerFontSizePreference",
    ).mockRejectedValue(new Error("DB unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await request(app)
      .patch("/api/me/preferences")
      .set("Cookie", "pkelo_session=test-session")
      .set("Origin", "http://localhost:8080")
      .send({ fontSizePreference: "default" });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: "글자 크기 설정을 저장하지 못했습니다.",
      code: "FONT_SIZE_PREFERENCE_UNAVAILABLE",
    });
    expect(errorSpy).toHaveBeenCalled();
  });
});
