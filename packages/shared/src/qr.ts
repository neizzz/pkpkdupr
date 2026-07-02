import type { Player } from "./player";

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
  duprRating: Player["duprRating"];
};

export interface VerifyPlayerQrTokenResponse {
  player: PlayerQrPublicPlayer;
}

export interface DevPlayerQrToken {
  player: PlayerQrPublicPlayer;
  payload: string;
}

export interface DevPlayerQrTokenListResponse {
  players: DevPlayerQrToken[];
}
