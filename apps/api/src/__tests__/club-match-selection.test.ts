import {
  getRecentCompletedMatches,
  isMatchForClub,
} from "@pkpkdupr/shared/club";
import type { Match } from "@pkpkdupr/shared/match";
import type { Player } from "@pkpkdupr/shared/player";
import { describe, expect, it } from "vitest";

const clubId = "Cclub001";
const clubMemberIds = new Set(["Pmember1", "Pmember2"]);
const buildPlayer = (id: string): Player => ({
  id,
  username: id,
  gender: "M",
  status: "active",
  duprRating: null,
  createdAt: new Date("2026-08-01T09:00:00.000Z"),
  updatedAt: new Date("2026-08-01T09:00:00.000Z"),
});

const buildMatch = (overrides: Partial<Match> = {}): Match =>
  ({
    id: "Mmatch001",
    status: "created",
    teams: [
      { id: "team-a", name: "A", players: [buildPlayer("Pmember1")] },
      { id: "team-b", name: "B", players: [buildPlayer("Pmember2")] },
    ],
    matchStartsAt: new Date("2026-08-01T09:00:00.000Z"),
    completedAt: null,
    ...overrides,
  }) as Match;

describe("club match selection", () => {
  it("소속 세션 매치와 모든 소속 멤버가 참여한 단독 매치만 포함한다", () => {
    const clubSessionMatch = buildMatch({
      id: "Msession01",
      session: { id: "Ssession1", clubId, name: "소속 세션" } as Match["session"],
    });
    const standaloneMatch = buildMatch({ id: "Mstandalone" });
    const outsideParticipantMatch = buildMatch({
      id: "Moutside01",
      teams: [
        { id: "team-a", name: "A", players: [buildPlayer("Pmember1")] },
        { id: "team-b", name: "B", players: [buildPlayer("Poutside1")] },
      ],
    });
    const otherClubSessionMatch = buildMatch({
      id: "Motherclub",
      session: {
        id: "Ssession2",
        clubId: "Cother001",
        name: "다른 소속 세션",
      } as Match["session"],
    });

    const selectedIds = [
      clubSessionMatch,
      standaloneMatch,
      outsideParticipantMatch,
      otherClubSessionMatch,
    ]
      .filter((match) => isMatchForClub(match, clubId, clubMemberIds))
      .map((match) => match.id);

    expect(selectedIds).toEqual(["Msession01", "Mstandalone"]);
  });

  it("최근 1주일의 완료 매치만 최신순으로 최대 다섯 건 반환한다", () => {
    const now = new Date("2026-08-10T09:00:00.000Z");
    const completedMatches = Array.from({ length: 6 }, (_, index) =>
      buildMatch({
        id: `Mrecent0${index + 1}`,
        status: "completed",
        completedAt: new Date(
          now.getTime() - (index + 1) * 24 * 60 * 60 * 1000,
        ),
      }),
    );
    const stale = buildMatch({
      id: "Mstale001",
      status: "completed",
      completedAt: new Date("2026-08-02T08:59:59.999Z"),
    });
    const pending = buildMatch({
      id: "Mpending1",
      status: "pending-approval",
      completedAt: null,
    });

    expect(
      getRecentCompletedMatches(
        [...completedMatches, stale, pending],
        99,
        now,
      ).map((match) => match.id),
    ).toEqual([
      "Mrecent01",
      "Mrecent02",
      "Mrecent03",
      "Mrecent04",
      "Mrecent05",
    ]);
  });
});
