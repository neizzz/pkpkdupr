import { randomUUID } from "crypto";
import type {
  Club,
  ClubAnnouncement,
  ClubDashboard,
  ClubInvite,
  ClubMember,
  ClubMembership,
  ClubRankings,
  ClubRole,
} from "@pkpkdupr/shared/club";
import { generateEntityId, isEntityId } from "@pkpkdupr/shared/entityId";
import type { Match, ManagedMatchSession } from "@pkpkdupr/shared/match";
import {
  normalizeNullablePlayerDupr,
  type Player,
} from "@pkpkdupr/shared/player";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  clubAnnouncements,
  clubInvites,
  clubJoinRequests,
  clubMemberships,
  clubs,
  players,
} from "../db/schema";
import { MatchRepository } from "./MatchRepository";

type StoredClub = typeof clubs.$inferSelect;
type StoredMembership = typeof clubMemberships.$inferSelect;
type StoredJoinRequest = typeof clubJoinRequests.$inferSelect;
type StoredAnnouncement = typeof clubAnnouncements.$inferSelect;
type StoredInvite = typeof clubInvites.$inferSelect;
type StoredPlayer = typeof players.$inferSelect;

const toDate = (value: Date | string | number) => new Date(value);
const toUnixTimestampSeconds = (value: Date) =>
  Math.floor(value.getTime() / 1000);

const toClub = (record: StoredClub): Club => ({
  id: record.id,
  name: record.name,
  description: record.description,
  createdAt: toDate(record.createdAt),
  updatedAt: toDate(record.updatedAt),
});

const toActiveMembership = (record: StoredMembership): ClubMembership => ({
  clubId: record.clubId,
  playerId: record.playerId,
  role: record.role as ClubRole,
  status: "active",
  requestedAt: toDate(record.createdAt),
  joinedAt: toDate(record.joinedAt),
});

const toPendingMembership = (record: StoredJoinRequest): ClubMembership => ({
  clubId: record.clubId,
  playerId: record.playerId,
  role: "member",
  status: "pending",
  requestedAt: toDate(record.requestedAt),
});

const toAnnouncement = (record: StoredAnnouncement): ClubAnnouncement => ({
  id: record.id,
  clubId: record.clubId,
  title: record.title,
  body: record.body,
  createdByPlayerId: record.createdByPlayerId,
  createdAt: toDate(record.createdAt),
  updatedAt: toDate(record.updatedAt),
});

const toInvite = (record: StoredInvite): ClubInvite => ({
  clubId: record.clubId,
  token: record.token,
  createdAt: toDate(record.createdAt),
  revokedAt: record.revokedAt ? toDate(record.revokedAt) : undefined,
});

const toClubMember = (
  membership: StoredMembership,
  player: StoredPlayer,
): ClubMember => ({
  id: player.id,
  username: player.username,
  gender: player.gender as Player["gender"],
  avatarUrl: player.avatarUrl ?? undefined,
  role: membership.role as ClubRole,
  joinedAt: toDate(membership.joinedAt),
});

const clubRoleOrder: Record<ClubRole, number> = {
  owner: 0,
  manager: 1,
  member: 2,
};

export class ClubRepository {
  constructor(
    private readonly db: any,
    private readonly client: any,
    private readonly matchRepository: MatchRepository,
  ) {}

  async findById(clubId: string): Promise<Club | undefined> {
    if (!isEntityId(clubId, "club")) return undefined;
    const record = await this.db
      .select()
      .from(clubs)
      .where(eq(clubs.id, clubId))
      .get();
    return record ? toClub(record) : undefined;
  }

  async findMembership(
    clubId: string,
    playerId: string,
  ): Promise<ClubMembership | undefined> {
    const record = await this.db
      .select()
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, clubId),
          eq(clubMemberships.playerId, playerId),
        ),
      )
      .get();
    return record ? toActiveMembership(record) : undefined;
  }

  async findMyClubs(playerId: string): Promise<
    Array<{ club: Club; membership: ClubMembership }>
  > {
    const [activeRecords, pendingRecords] = await Promise.all([
      this.db
        .select()
        .from(clubMemberships)
        .where(eq(clubMemberships.playerId, playerId))
        .all(),
      this.db
        .select()
        .from(clubJoinRequests)
        .where(eq(clubJoinRequests.playerId, playerId))
        .all(),
    ]);
    const records = [
      ...activeRecords.map((record: StoredMembership) => ({
        clubId: record.clubId,
        membership: toActiveMembership(record),
      })),
      ...pendingRecords.map((record: StoredJoinRequest) => ({
        clubId: record.clubId,
        membership: toPendingMembership(record),
      })),
    ];
    const seenClubIds = new Set<string>();
    const result: Array<{ club: Club; membership: ClubMembership }> = [];
    for (const record of records) {
      if (seenClubIds.has(record.clubId)) continue;
      seenClubIds.add(record.clubId);
      const club = await this.findById(record.clubId);
      if (club) result.push({ club, membership: record.membership });
    }
    return result.sort(
      (left, right) =>
        right.membership.requestedAt.getTime() -
        left.membership.requestedAt.getTime(),
    );
  }

  async createClub(input: {
    id: string;
    name: string;
    description: string;
    ownerPlayerId: string;
  }): Promise<Club> {
    if (!isEntityId(input.id, "club")) {
      throw new Error("유효한 클럽 ID가 필요합니다.");
    }
    const name = input.name.trim();
    if (!name || name.length > 120) {
      throw new Error("클럽 이름은 1~120자여야 합니다.");
    }
    const description = input.description.trim();
    if (description.length > 500) {
      throw new Error("클럽 소개는 500자 이하여야 합니다.");
    }

    const now = new Date();
    const transaction = await this.client.transaction("write");
    let committed = false;
    try {
      await transaction.execute({
        sql: `INSERT INTO clubs (id, name, description, created_by_player_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          input.id,
          name,
          description,
          input.ownerPlayerId,
          toUnixTimestampSeconds(now),
          toUnixTimestampSeconds(now),
        ],
      });
      await transaction.execute({
        sql: `INSERT INTO club_memberships
                (id, club_id, player_id, role, joined_at, created_at, updated_at)
              VALUES (?, ?, ?, 'owner', ?, ?, ?)`,
        args: [
          `${input.id}-${input.ownerPlayerId}`,
          input.id,
          input.ownerPlayerId,
          toUnixTimestampSeconds(now),
          toUnixTimestampSeconds(now),
          toUnixTimestampSeconds(now),
        ],
      });
      await transaction.commit();
      committed = true;
    } finally {
      if (!committed) transaction.close();
    }

    const club = await this.findById(input.id);
    if (!club) throw new Error("클럽 생성에 실패했습니다.");
    return club;
  }

  async createJoinRequestByInvite(
    token: string,
    playerId: string,
  ): Promise<ClubMembership> {
    const invite = await this.db
      .select()
      .from(clubInvites)
      .where(and(eq(clubInvites.token, token), isNull(clubInvites.revokedAt)))
      .get();
    if (!invite) throw new Error("유효하지 않거나 만료된 클럽 QR입니다.");

    const active = await this.findMembership(invite.clubId, playerId);
    if (active) throw new Error("이미 이 클럽의 멤버입니다.");

    const existing = await this.db
      .select()
      .from(clubJoinRequests)
      .where(
        and(
          eq(clubJoinRequests.clubId, invite.clubId),
          eq(clubJoinRequests.playerId, playerId),
        ),
      )
      .get();
    if (existing) return toPendingMembership(existing);

    const now = new Date();
    await this.db.insert(clubJoinRequests).values({
      id: `${invite.clubId}-${playerId}`,
      clubId: invite.clubId,
      playerId,
      requestedAt: now,
    });
    return {
      clubId: invite.clubId,
      playerId,
      role: "member",
      status: "pending",
      requestedAt: now,
    };
  }

  async approveJoinRequest(
    clubId: string,
    playerId: string,
  ): Promise<ClubMembership> {
    const request = await this.db
      .select()
      .from(clubJoinRequests)
      .where(
        and(
          eq(clubJoinRequests.clubId, clubId),
          eq(clubJoinRequests.playerId, playerId),
        ),
      )
      .get();
    if (!request) throw new Error("가입 요청을 찾을 수 없습니다.");
    return await this.upsertActiveMember(clubId, playerId, "member", true);
  }

  async rejectJoinRequest(clubId: string, playerId: string): Promise<void> {
    await this.db
      .delete(clubJoinRequests)
      .where(
        and(
          eq(clubJoinRequests.clubId, clubId),
          eq(clubJoinRequests.playerId, playerId),
        ),
      );
  }

  async addMemberByPlayerQr(
    clubId: string,
    playerId: string,
  ): Promise<ClubMembership> {
    return await this.upsertActiveMember(clubId, playerId, "member", true);
  }

  private async upsertActiveMember(
    clubId: string,
    playerId: string,
    role: ClubRole,
    deleteJoinRequest: boolean,
  ): Promise<ClubMembership> {
    const existing = await this.findMembership(clubId, playerId);
    if (existing) return existing;

    const now = new Date();
    const transaction = await this.client.transaction("write");
    let committed = false;
    try {
      if (deleteJoinRequest) {
        await transaction.execute({
          sql: "DELETE FROM club_join_requests WHERE club_id = ? AND player_id = ?",
          args: [clubId, playerId],
        });
      }
      await transaction.execute({
        sql: `INSERT INTO club_memberships
                (id, club_id, player_id, role, joined_at, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `${clubId}-${playerId}`,
          clubId,
          playerId,
          role,
          toUnixTimestampSeconds(now),
          toUnixTimestampSeconds(now),
          toUnixTimestampSeconds(now),
        ],
      });
      await transaction.commit();
      committed = true;
    } finally {
      if (!committed) transaction.close();
    }
    const membership = await this.findMembership(clubId, playerId);
    if (!membership) throw new Error("클럽 멤버 추가에 실패했습니다.");
    return membership;
  }

  async setMemberRole(
    clubId: string,
    playerId: string,
    role: Exclude<ClubRole, "owner">,
  ): Promise<ClubMembership> {
    const existing = await this.findMembership(clubId, playerId);
    if (!existing) throw new Error("클럽 멤버를 찾을 수 없습니다.");
    if (existing.role === "owner") {
      throw new Error("클럽장의 역할은 위임 전에는 변경할 수 없습니다.");
    }
    await this.db
      .update(clubMemberships)
      .set({ role, updatedAt: new Date() })
      .where(
        and(
          eq(clubMemberships.clubId, clubId),
          eq(clubMemberships.playerId, playerId),
        ),
      );
    return (await this.findMembership(clubId, playerId))!;
  }

  async transferOwnership(clubId: string, nextOwnerPlayerId: string) {
    const nextOwner = await this.findMembership(clubId, nextOwnerPlayerId);
    if (!nextOwner) throw new Error("새 클럽장은 활성 멤버여야 합니다.");
    const currentOwner = await this.db
      .select()
      .from(clubMemberships)
      .where(
        and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.role, "owner")),
      )
      .get();
    if (!currentOwner) throw new Error("클럽장을 찾을 수 없습니다.");

    const now = new Date();
    const transaction = await this.client.transaction("write");
    let committed = false;
    try {
      await transaction.execute({
        sql: "UPDATE club_memberships SET role = 'manager', updated_at = ? WHERE id = ?",
        args: [toUnixTimestampSeconds(now), currentOwner.id],
      });
      await transaction.execute({
        sql: "UPDATE club_memberships SET role = 'owner', updated_at = ? WHERE club_id = ? AND player_id = ?",
        args: [toUnixTimestampSeconds(now), clubId, nextOwnerPlayerId],
      });
      await transaction.commit();
      committed = true;
    } finally {
      if (!committed) transaction.close();
    }
  }

  async getOrCreateInvite(clubId: string): Promise<ClubInvite> {
    const existing = await this.db
      .select()
      .from(clubInvites)
      .where(and(eq(clubInvites.clubId, clubId), isNull(clubInvites.revokedAt)))
      .orderBy(desc(clubInvites.createdAt))
      .get();
    if (existing) return toInvite(existing);
    return await this.rotateInvite(clubId);
  }

  async rotateInvite(clubId: string): Promise<ClubInvite> {
    const now = new Date();
    await this.db
      .update(clubInvites)
      .set({ revokedAt: now })
      .where(and(eq(clubInvites.clubId, clubId), isNull(clubInvites.revokedAt)));
    const record = {
      id: randomUUID(),
      clubId,
      token: randomUUID().split("-").join(""),
      createdAt: now,
      revokedAt: null,
    };
    await this.db.insert(clubInvites).values(record);
    return toInvite(record as StoredInvite);
  }

  async listMembers(clubId: string): Promise<ClubMember[]> {
    const memberships = await this.db
      .select()
      .from(clubMemberships)
      .where(eq(clubMemberships.clubId, clubId))
      .all();
    const result: ClubMember[] = [];
    for (const membership of memberships as StoredMembership[]) {
      const player = await this.db
        .select()
        .from(players)
        .where(eq(players.id, membership.playerId))
        .get();
      if (player?.status === "active") {
        result.push(toClubMember(membership, player));
      }
    }
    return result.sort(
      (left, right) =>
        clubRoleOrder[left.role] - clubRoleOrder[right.role] ||
        left.username.localeCompare(right.username, "ko"),
    );
  }

  async listPendingRequests(clubId: string): Promise<ClubMembership[]> {
    const records = await this.db
      .select()
      .from(clubJoinRequests)
      .where(eq(clubJoinRequests.clubId, clubId))
      .orderBy(desc(clubJoinRequests.requestedAt))
      .all();
    return await Promise.all(
      records.map(async (record: StoredJoinRequest) => {
        const pending = toPendingMembership(record);
        const player = await this.db
          .select()
          .from(players)
          .where(eq(players.id, record.playerId))
          .get();
        return player
          ? {
              ...pending,
              player: {
                id: player.id,
                username: player.username,
                avatarUrl: player.avatarUrl ?? undefined,
              },
            }
          : pending;
      }),
    );
  }

  async listAnnouncements(clubId: string): Promise<ClubAnnouncement[]> {
    const records = await this.db
      .select()
      .from(clubAnnouncements)
      .where(eq(clubAnnouncements.clubId, clubId))
      .orderBy(desc(clubAnnouncements.createdAt))
      .limit(20)
      .all();
    return records.map((record: StoredAnnouncement) => toAnnouncement(record));
  }

  async createAnnouncement(input: {
    clubId: string;
    title: string;
    body: string;
    createdByPlayerId: string;
  }): Promise<ClubAnnouncement> {
    const now = new Date();
    const id = generateEntityId("clubAnnouncement");
    await this.db.insert(clubAnnouncements).values({
      id,
      clubId: input.clubId,
      title: input.title.trim(),
      body: input.body.trim(),
      createdByPlayerId: input.createdByPlayerId,
      createdAt: now,
      updatedAt: now,
    });
    const created = await this.db
      .select()
      .from(clubAnnouncements)
      .where(eq(clubAnnouncements.id, id))
      .get();
    if (!created) throw new Error("공지 작성에 실패했습니다.");
    return toAnnouncement(created);
  }

  async updateAnnouncement(
    announcementId: string,
    input: { title: string; body: string },
  ): Promise<ClubAnnouncement | undefined> {
    await this.db
      .update(clubAnnouncements)
      .set({ title: input.title.trim(), body: input.body.trim(), updatedAt: new Date() })
      .where(eq(clubAnnouncements.id, announcementId));
    const updated = await this.db
      .select()
      .from(clubAnnouncements)
      .where(eq(clubAnnouncements.id, announcementId))
      .get();
    return updated ? toAnnouncement(updated) : undefined;
  }

  async deleteAnnouncement(announcementId: string): Promise<void> {
    await this.db.delete(clubAnnouncements).where(eq(clubAnnouncements.id, announcementId));
  }

  async findAnnouncement(announcementId: string): Promise<ClubAnnouncement | undefined> {
    const record = await this.db
      .select()
      .from(clubAnnouncements)
      .where(eq(clubAnnouncements.id, announcementId))
      .get();
    return record ? toAnnouncement(record) : undefined;
  }

  private async getRankings(members: ClubMember[]): Promise<ClubRankings> {
    const rated = await Promise.all(
      members.map(async (member) => {
        const player = await this.db
          .select()
          .from(players)
          .where(eq(players.id, member.id))
          .get();
        return player
          ? { member, rating: normalizeNullablePlayerDupr(player.duprRating) }
          : undefined;
      }),
    );
    const build = (category: "singles" | "doubles") =>
      rated
        .flatMap((entry) => {
          const rating = entry?.rating?.[category];
          return entry && typeof rating === "number"
            ? [{ member: entry.member, rating }]
            : [];
        })
        .sort(
          (left, right) =>
            right.rating - left.rating ||
            left.member.username.localeCompare(right.member.username, "ko"),
        )
        .map((entry, index) => ({
          rank: index + 1,
          playerId: entry.member.id,
          username: entry.member.username,
          avatarUrl: entry.member.avatarUrl,
          rating: entry.rating,
        }));
    return { singles: build("singles"), doubles: build("doubles") };
  }

  async getDashboard(
    clubId: string,
    playerId: string,
  ): Promise<ClubDashboard | undefined> {
    const [club, membership] = await Promise.all([
      this.findById(clubId),
      this.findMembership(clubId, playerId),
    ]);
    if (!club || !membership) return undefined;

    const members = await this.listMembers(clubId);
    const memberIds = new Set(members.map((member) => member.id));
    const now = new Date();
    const [{ matches: allMatches }, allSessions, announcements] = await Promise.all([
      this.matchRepository.findAll(0, 10_000),
      this.matchRepository.findSessions(),
      this.listAnnouncements(clubId),
    ]);
    const upcomingSessions = allSessions
      .filter(
        (session: ManagedMatchSession) =>
          session.clubId === clubId && session.date.getTime() >= now.getTime(),
      )
      .sort((left, right) => left.date.getTime() - right.date.getTime());
    const upcomingMatches = allMatches
      .filter((match: Match) => {
        if (match.matchStartsAt.getTime() < now.getTime()) return false;
        if (match.session?.clubId === clubId) return true;
        if (match.session) return false;
        const participants = match.teams.flatMap((team) => team.players);
        return (
          participants.length > 0 &&
          participants.every((participant) => memberIds.has(participant.id))
        );
      })
      .sort(
        (left, right) => left.matchStartsAt.getTime() - right.matchStartsAt.getTime(),
      );
    const pendingRequests =
      membership.role === "owner" || membership.role === "manager"
        ? await this.listPendingRequests(clubId)
        : [];

    return {
      club,
      membership,
      upcomingSessions,
      upcomingMatches,
      announcements,
      rankings: await this.getRankings(members),
      members,
      pendingRequests,
    };
  }
}
