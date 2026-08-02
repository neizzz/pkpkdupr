import type {
  Club,
  ClubAnnouncement,
  ClubDashboard,
  ClubInvite,
  ClubMember,
  ClubMembership,
} from "@pkpkdupr/shared/club";
import { generateEntityId } from "@pkpkdupr/shared/entityId";
import {
  DbRequestError,
  hydrateManagedSession,
  hydrateMatch,
} from "./MatchRepository";

const DB_SERVER_URL = process.env.DB_SERVER_URL || "http://localhost:5001";

const toDate = (value: string | Date) => new Date(value);

const hydrateClub = (record: any): Club => ({
  id: record.id,
  name: record.name,
  description: typeof record.description === "string" ? record.description : "",
  createdAt: toDate(record.createdAt),
  updatedAt: toDate(record.updatedAt),
});

const hydrateMembership = (record: any): ClubMembership => ({
  clubId: record.clubId,
  playerId: record.playerId,
  role: record.role,
  status: record.status,
  requestedAt: toDate(record.requestedAt),
  joinedAt: record.joinedAt ? toDate(record.joinedAt) : undefined,
  player: record.player
    ? {
        id: record.player.id,
        username: record.player.username,
        avatarUrl: record.player.avatarUrl ?? undefined,
      }
    : undefined,
});

const hydrateAnnouncement = (record: any): ClubAnnouncement => ({
  id: record.id,
  clubId: record.clubId,
  title: record.title,
  body: record.body,
  createdByPlayerId: record.createdByPlayerId,
  createdAt: toDate(record.createdAt),
  updatedAt: toDate(record.updatedAt),
});

const hydrateInvite = (record: any): ClubInvite => ({
  clubId: record.clubId,
  token: record.token,
  createdAt: toDate(record.createdAt),
  revokedAt: record.revokedAt ? toDate(record.revokedAt) : undefined,
});

const hydrateMember = (record: any): ClubMember => ({
  id: record.id,
  username: record.username,
  gender: record.gender,
  avatarUrl: record.avatarUrl ?? undefined,
  role: record.role,
  joinedAt: toDate(record.joinedAt),
});

const hydrateDashboard = (record: any): ClubDashboard => ({
  club: hydrateClub(record.club),
  membership: hydrateMembership(record.membership),
  upcomingSessions: (record.upcomingSessions ?? []).map(hydrateManagedSession),
  upcomingMatches: (record.upcomingMatches ?? []).map(hydrateMatch),
  announcements: (record.announcements ?? []).map(hydrateAnnouncement),
  rankings: {
    singles: record.rankings?.singles ?? [],
    doubles: record.rankings?.doubles ?? [],
  },
  members: (record.members ?? []).map(hydrateMember),
  pendingRequests: (record.pendingRequests ?? []).map(hydrateMembership),
});

export class ClubRepository {
  private async dbRequest<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const res = await fetch(`${DB_SERVER_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new DbRequestError(
        errorData.error || `DB 서버 요청 실패: ${res.status}`,
        res.status,
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async findById(clubId: string): Promise<Club | undefined> {
    try {
      return hydrateClub(await this.dbRequest<any>(`/internal/clubs/${clubId}`));
    } catch (error) {
      if ((error as DbRequestError).status === 404) return undefined;
      throw error;
    }
  }

  async findMembership(
    clubId: string,
    playerId: string,
  ): Promise<ClubMembership | undefined> {
    try {
      return hydrateMembership(
        await this.dbRequest<any>(
          `/internal/clubs/${encodeURIComponent(clubId)}/memberships/${encodeURIComponent(playerId)}`,
        ),
      );
    } catch (error) {
      if ((error as DbRequestError).status === 404) return undefined;
      throw error;
    }
  }

  async findMyClubs(playerId: string) {
    const records = await this.dbRequest<any[]>(
      `/internal/clubs/by-player/${encodeURIComponent(playerId)}`,
    );
    return records.map((record) => ({
      club: hydrateClub(record.club),
      membership: hydrateMembership(record.membership),
    }));
  }

  async createClub(
    name: string,
    description: string,
    ownerPlayerId: string,
  ): Promise<Club> {
    const club = await this.dbRequest<any>("/internal/clubs", {
      method: "POST",
      body: JSON.stringify({
        id: generateEntityId("club"),
        name,
        description,
        ownerPlayerId,
      }),
    });
    return hydrateClub(club);
  }

  async getDashboard(clubId: string, playerId: string) {
    try {
      return hydrateDashboard(
        await this.dbRequest<any>(
          `/internal/clubs/${encodeURIComponent(clubId)}/dashboard/${encodeURIComponent(playerId)}`,
        ),
      );
    } catch (error) {
      if ((error as DbRequestError).status === 404) return undefined;
      throw error;
    }
  }

  async requestJoinByInvite(token: string, playerId: string) {
    return hydrateMembership(
      await this.dbRequest<any>("/internal/clubs/invite-join-requests", {
        method: "POST",
        body: JSON.stringify({ token, playerId }),
      }),
    );
  }

  async approveJoinRequest(clubId: string, playerId: string) {
    return hydrateMembership(
      await this.dbRequest<any>(
        `/internal/clubs/${encodeURIComponent(clubId)}/join-requests/${encodeURIComponent(playerId)}/approve`,
        { method: "POST" },
      ),
    );
  }

  async rejectJoinRequest(clubId: string, playerId: string) {
    await this.dbRequest<void>(
      `/internal/clubs/${encodeURIComponent(clubId)}/join-requests/${encodeURIComponent(playerId)}`,
      { method: "DELETE" },
    );
  }

  async addMemberByPlayerQr(clubId: string, playerId: string) {
    return hydrateMembership(
      await this.dbRequest<any>(
        `/internal/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(playerId)}`,
        { method: "POST" },
      ),
    );
  }

  async setMemberRole(
    clubId: string,
    playerId: string,
    role: "manager" | "member",
  ) {
    return hydrateMembership(
      await this.dbRequest<any>(
        `/internal/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(playerId)}/role`,
        { method: "PATCH", body: JSON.stringify({ role }) },
      ),
    );
  }

  async transferOwnership(clubId: string, playerId: string) {
    await this.dbRequest<void>(
      `/internal/clubs/${encodeURIComponent(clubId)}/ownership-transfer`,
      { method: "POST", body: JSON.stringify({ playerId }) },
    );
  }

  async getInvite(clubId: string) {
    return hydrateInvite(
      await this.dbRequest<any>(
        `/internal/clubs/${encodeURIComponent(clubId)}/invite`,
      ),
    );
  }

  async rotateInvite(clubId: string) {
    return hydrateInvite(
      await this.dbRequest<any>(
        `/internal/clubs/${encodeURIComponent(clubId)}/invite/rotate`,
        { method: "POST" },
      ),
    );
  }

  async listMembers(clubId: string): Promise<ClubMember[]> {
    const records = await this.dbRequest<any[]>(
      `/internal/clubs/${encodeURIComponent(clubId)}/members`,
    );
    return records.map(hydrateMember);
  }

  async createAnnouncement(
    clubId: string,
    input: { title: string; body: string; createdByPlayerId: string },
  ) {
    return hydrateAnnouncement(
      await this.dbRequest<any>(
        `/internal/clubs/${encodeURIComponent(clubId)}/announcements`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    );
  }

  async findAnnouncement(announcementId: string) {
    try {
      return hydrateAnnouncement(
        await this.dbRequest<any>(
          `/internal/club-announcements/${encodeURIComponent(announcementId)}`,
        ),
      );
    } catch (error) {
      if ((error as DbRequestError).status === 404) return undefined;
      throw error;
    }
  }

  async updateAnnouncement(
    announcementId: string,
    input: { title: string; body: string },
  ) {
    return hydrateAnnouncement(
      await this.dbRequest<any>(
        `/internal/club-announcements/${encodeURIComponent(announcementId)}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    );
  }

  async deleteAnnouncement(announcementId: string) {
    await this.dbRequest<void>(
      `/internal/club-announcements/${encodeURIComponent(announcementId)}`,
      { method: "DELETE" },
    );
  }
}
