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

export const isMatchForClub = (
  match: Match,
  clubId: string,
  memberIds: ReadonlySet<string>,
) => {
  if (match.session?.clubId === clubId) return true;
  if (match.session) return false;
  const participants = match.teams.flatMap((team) => team.players);
  return (
    participants.length > 0 &&
    participants.every((participant) => memberIds.has(participant.id))
  );
};

export const getRecentCompletedMatches = (
  matches: readonly Match[],
  limit: number = 2,
) =>
  matches
    .filter((match) => match.status === "completed" && match.completedAt !== null)
    .sort(
      (left, right) =>
        (right.completedAt?.getTime() ?? 0) -
        (left.completedAt?.getTime() ?? 0),
    )
    .slice(0, limit);

export interface ClubDashboard {
  club: Club;
  membership: ClubMembership;
  upcomingSessions: ManagedMatchSession[];
  upcomingMatches: Match[];
  recentCompletedMatches: Match[];
  announcements: ClubAnnouncement[];
  rankings: ClubRankings;
  members: ClubMember[];
  pendingRequests: ClubMembership[];
}

export interface ClubMatchList {
  matches: Match[];
  total: number;
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
