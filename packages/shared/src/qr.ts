import type { Player, PlayerDupr } from "./player";

export interface PlayerQrTokenResponse {
  payload: string;
  expiresAt: string;
  ttlSeconds: number;
}

export interface VerifyPlayerQrTokenRequest {
  payload: string;
}

export type PlayerQrPublicPlayer = Pick<
  Player,
  "id" | "username" | "gender" | "avatarUrl"
> & {
  duprRating: PlayerDupr;
};

export interface VerifyPlayerQrTokenResponse {
  player: PlayerQrPublicPlayer;
}
