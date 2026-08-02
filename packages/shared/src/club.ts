import type { ManagedMatchSession, Match } from "./match";
import type { Player, PlayerDuprCategory, PublicPlayerDupr } from "./player";

export type ClubRole = "owner" | "manager" | "member";
export type ClubMembershipStatus = "active" | "pending";

export interface Club {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClubMembership {
  clubId: string;
  playerId: string;
  role: ClubRole;
  status: ClubMembershipStatus;
  requestedAt: Date;
  joinedAt?: Date;
  player?: Pick<Player, "id" | "username" | "avatarUrl">;
}

export interface ClubMember
  extends Pick<Player, "id" | "username" | "avatarUrl" | "gender"> {
  role: ClubRole;
  joinedAt: Date;
}

export interface ClubAnnouncement {
  id: string;
  clubId: string;
  title: string;
  body: string;
  createdByPlayerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClubInvite {
  clubId: string;
  token: string;
  createdAt: Date;
  revokedAt?: Date;
}

export interface ClubRankingEntry {
  rank: number;
  playerId: string;
  username: string;
  avatarUrl?: string;
  rating: number;
}

export type ClubRankings = Record<PlayerDuprCategory, ClubRankingEntry[]>;

export interface ClubDashboard {
  club: Club;
  membership: ClubMembership;
  upcomingSessions: ManagedMatchSession[];
  upcomingMatches: Match[];
  announcements: ClubAnnouncement[];
  rankings: ClubRankings;
  members: ClubMember[];
  pendingRequests: ClubMembership[];
}

export interface ClubInvitePayload {
  token: string;
}

export interface ClubPlayerQrJoinRequest {
  payload: string;
}

export type ClubMemberRating = Pick<Player, "id" | "username" | "avatarUrl"> & {
  duprRating: PublicPlayerDupr | null;
};
