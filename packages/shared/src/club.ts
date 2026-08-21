import type { ManagedMatchSession, Match } from "./match";
import type { Player, PlayerDuprCategory, PublicPlayerDupr } from "./player";

export type ClubRole = "owner" | "manager" | "member";
export type ClubMembershipStatus = "active";

export const CLUB_DESCRIPTION_MAX_LENGTH = 500;
export const CLUB_ANNOUNCEMENT_MAX_COUNT = 5;
export const CLUB_ANNOUNCEMENT_BODY_MAX_LENGTH = 500;

/**
 * Counts Unicode code points instead of UTF-16 code units so astral characters
 * such as emoji are handled as one character by every club-description layer.
 */
export const getUnicodeCodePointLength = (value: string) =>
  Array.from(value).length;

export const truncateToUnicodeCodePoints = (value: string, maxLength: number) =>
  Array.from(value).slice(0, maxLength).join("");

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
}

export interface ClubMatchList {
  matches: Match[];
  total: number;
}

export type ClubMemberRating = Pick<Player, "id" | "username" | "avatarUrl"> & {
  duprRating: PublicPlayerDupr | null;
};
