import React, { useEffect, useMemo, useState } from "react";
import { Button, Drawer } from "@heroui/react";
import { IoQrCodeSharp } from "react-icons/io5";
import type { MatchType } from "@pkpkdupr/shared/match";
import { matchTypeLabels } from "@pkpkdupr/shared/match";
import type { Player } from "@pkpkdupr/shared/player";
import UserChip from "@/components/UserChip";
import { useAuth } from "@/context/AuthContext";

type MatchMember = Pick<Player, "id" | "username" | "gender" | "avatarUrl">;
type MatchTeams = [MatchMember[], MatchMember[]];
type TeamIndex = 0 | 1;

const normalizeMatchMember = (
  value:
    | Partial<Pick<Player, "id" | "username" | "gender" | "avatarUrl">>
    | null
    | undefined,
): MatchMember | null => {
  if (!value?.id || (value.gender !== "M" && value.gender !== "F")) {
    return null;
  }

  return {
    id: value.id,
    username: value.username || value.id,
    gender: value.gender,
    avatarUrl: value.avatarUrl,
  };
};

const mergeUniqueMembers = (members: MatchMember[]) => {
  const seen = new Set<string>();

  return members.filter((member) => {
    if (seen.has(member.id)) {
      return false;
    }
    seen.add(member.id);
    return true;
  });
};

const resolveMatchType = (members: MatchMember[]): MatchType | null => {
  if (members.length === 2) {
    return "singles";
  }

  if (members.length !== 4) {
    return null;
  }

  const menCount = members.filter((member) => member.gender === "M").length;
  const womenCount = members.filter((member) => member.gender === "F").length;

  if (menCount === 2 && womenCount === 2) {
    return "mixed-doubles";
  }

  if (menCount === 4) {
    return "men-doubles";
  }

  if (womenCount === 4) {
    return "women-doubles";
  }

  return null;
};

const createEmptyTeams = (): MatchTeams => [[], []];

const buildInitialTeams = (
  members: MatchMember[],
  matchType: MatchType | null,
): MatchTeams => {
  if (!matchType) {
    return createEmptyTeams();
  }

  if (matchType === "singles") {
    return [[members[0]], [members[1]]];
  }

  if (matchType === "mixed-doubles") {
    const men = members.filter((member) => member.gender === "M");
    const women = members.filter((member) => member.gender === "F");

    return [
      [men[0], women[0]],
      [men[1], women[1]],
    ];
  }

  return [
    [members[0], members[1]],
    [members[2], members[3]],
  ];
};

const isMixedDoublesTeamValid = (team: MatchMember[]) =>
  team.length === 2 &&
  team.some((member) => member.gender === "M") &&
  team.some((member) => member.gender === "F");

const areTeamsValid = (teams: MatchTeams, matchType: MatchType | null) => {
  if (!matchType) {
    return false;
  }

  if (matchType === "singles") {
    return teams[0].length === 1 && teams[1].length === 1;
  }

  if (matchType === "mixed-doubles") {
    return teams.every(isMixedDoublesTeamValid);
  }

  if (matchType === "men-doubles") {
    return teams.every(
      (team) =>
        team.length === 2 && team.every((member) => member.gender === "M"),
    );
  }

  return teams.every(
    (team) =>
      team.length === 2 && team.every((member) => member.gender === "F"),
  );
};

const findMemberTeamIndex = (
  teams: MatchTeams,
  memberId: string,
): TeamIndex | null => {
  if (teams[0].some((member) => member.id === memberId)) {
    return 0;
  }

  if (teams[1].some((member) => member.id === memberId)) {
    return 1;
  }

  return null;
};

const findTeamMember = (teams: MatchTeams, memberId: string) =>
  teams.flat().find((member) => member.id === memberId) ?? null;

const canSwapMembers = (
  teams: MatchTeams,
  matchType: MatchType | null,
  sourceMemberId: string | null,
  targetMember: MatchMember,
) => {
  if (!matchType || !sourceMemberId) {
    return false;
  }

  const sourceTeamIndex = findMemberTeamIndex(teams, sourceMemberId);
  const targetTeamIndex = findMemberTeamIndex(teams, targetMember.id);
  const sourceMember = findTeamMember(teams, sourceMemberId);

  if (
    sourceTeamIndex === null ||
    targetTeamIndex === null ||
    !sourceMember ||
    sourceTeamIndex === targetTeamIndex ||
    sourceMember.id === targetMember.id
  ) {
    return false;
  }

  if (matchType === "mixed-doubles") {
    return sourceMember.gender === targetMember.gender;
  }

  return true;
};

interface CreateMatchDrawerBodyProps {
  onCreateMatch: () => void;
}

const CreateMatchDrawerBody: React.FC<CreateMatchDrawerBodyProps> = ({
  onCreateMatch,
}) => {
  const { player, token } = useAuth();
  const [matchMemberCandidates, setMatchMemberCandidates] = useState<
    MatchMember[]
  >([]);
  const [selectedMatchMembers, setSelectedMatchMembers] = useState<
    MatchMember[]
  >([]);
  const [teams, setTeams] = useState<MatchTeams>(() => createEmptyTeams());
  const [selectedSwapMemberId, setSelectedSwapMemberId] = useState<
    string | null
  >(null);
  const selectedMatchType = useMemo(
    () => resolveMatchType(selectedMatchMembers),
    [selectedMatchMembers],
  );
  const canCreateMatch = areTeamsValid(teams, selectedMatchType);
  const canAddMatchMember =
    selectedMatchMembers.length < 4 &&
    matchMemberCandidates.some(
      (candidate) =>
        !selectedMatchMembers.some((member) => member.id === candidate.id),
    );
  const hasTeams = !!selectedMatchType && teams.some((team) => team.length > 0);

  useEffect(() => {
    let isCancelled = false;

    const loadMatchMemberCandidates = async () => {
      const currentPlayerMember = normalizeMatchMember(player);
      const nextMembers: MatchMember[] = currentPlayerMember
        ? [currentPlayerMember]
        : [];

      if (token) {
        try {
          const res = await fetch("/api/players", {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.ok) {
            const players = (await res.json()) as Player[];
            nextMembers.push(
              ...players
                .map((candidate) => normalizeMatchMember(candidate))
                .filter((candidate): candidate is MatchMember => !!candidate),
            );
          }
        } catch {
          // 멤버 후보 로딩 실패 시 현재 사용자 후보만 유지합니다.
        }
      }

      if (!isCancelled) {
        setMatchMemberCandidates(mergeUniqueMembers(nextMembers));
      }
    };

    void loadMatchMemberCandidates();

    return () => {
      isCancelled = true;
    };
  }, [player, token]);

  useEffect(() => {
    setSelectedSwapMemberId(null);
    setTeams(buildInitialTeams(selectedMatchMembers, selectedMatchType));
  }, [selectedMatchMembers, selectedMatchType]);

  const handleAddMatchMemberByQr = () => {
    const nextMember = matchMemberCandidates.find(
      (candidate) =>
        !selectedMatchMembers.some((member) => member.id === candidate.id),
    );

    if (!nextMember || selectedMatchMembers.length >= 4) {
      return;
    }

    setSelectedMatchMembers((prev) => [...prev, nextMember]);
  };

  const handleRemoveMatchMember = (memberId: string) => {
    setSelectedMatchMembers((prev) =>
      prev.filter((member) => member.id !== memberId),
    );
    setTeams((prev) => [
      prev[0].filter((member) => member.id !== memberId),
      prev[1].filter((member) => member.id !== memberId),
    ]);
    setSelectedSwapMemberId(null);
  };

  const handleTeamMemberPress = (member: MatchMember) => {
    if (selectedSwapMemberId === member.id) {
      setSelectedSwapMemberId(null);
      return;
    }

    if (!selectedSwapMemberId) {
      setSelectedSwapMemberId(member.id);
      return;
    }

    if (!canSwapMembers(teams, selectedMatchType, selectedSwapMemberId, member)) {
      return;
    }

    setTeams((prev) => {
      const sourceMember = findTeamMember(prev, selectedSwapMemberId);
      const targetMember = findTeamMember(prev, member.id);

      if (!sourceMember || !targetMember) {
        return prev;
      }

      return [
        prev[0].map((teamMember) => {
          if (teamMember.id === sourceMember.id) return targetMember;
          if (teamMember.id === targetMember.id) return sourceMember;
          return teamMember;
        }),
        prev[1].map((teamMember) => {
          if (teamMember.id === sourceMember.id) return targetMember;
          if (teamMember.id === targetMember.id) return sourceMember;
          return teamMember;
        }),
      ];
    });
    setSelectedSwapMemberId(null);
  };

  return (
    <>
      <Drawer.Body className="flex flex-col gap-5 pb-4">
        <section>
          {/* <div className="flex items-start justify-between gap-3 mt-8"> */}
          <div className="relative mt-8">
            <div>
              <p className="text-sm font-semibold text-amber-950">멤버</p>
            </div>
            <Button
              size="sm"
              onPress={handleAddMatchMemberByQr}
              isDisabled={!canAddMatchMember}
              className="absolute top-1 right-0 shrink-0 rounded-full bg-[#409eff] px-3 text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              <IoQrCodeSharp className="size-4" />
              멤버 추가
            </Button>
          </div>

          <div className="flex min-h-10 flex-wrap gap-2">
            {selectedMatchMembers.length > 0 ? (
              selectedMatchMembers.map((member) => (
                <UserChip
                  key={member.id}
                  player={member}
                  onRemove={() => handleRemoveMatchMember(member.id)}
                />
              ))
            ) : (
              <p className="mt-2 text-sm text-amber-700/70">
                아직 추가된 멤버가 없어요.
              </p>
            )}
          </div>
        </section>

        <section>
          <p className="text-sm font-semibold text-amber-950">매치 타입</p>
          {selectedMatchType ? (
            <div className="mt-2 rounded-2xl border border-[#409eff] bg-[#409eff]/10 px-3 py-2 text-sm font-semibold text-[#409eff]">
              {matchTypeLabels[selectedMatchType]}
            </div>
          ) : (
            <p className="mt-2 text-sm text-red-500">
              유효한 성별 구성이 필요해요.
            </p>
          )}
        </section>

        {hasTeams ? (
          <section>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-amber-950">팀</p>
              {selectedSwapMemberId ? (
                <p className="text-xs text-amber-700/70">
                  교체할 상대 팀 멤버를 선택하세요.
                </p>
              ) : (
                <p className="text-xs text-amber-700/70">
                  멤버를 탭해서 팀을 교체할 수 있어요.
                </p>
              )}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-3">
              {teams.map((team, teamIndex) => {
                const typedTeamIndex = teamIndex as TeamIndex;

                return (
                  <div
                    key={typedTeamIndex}
                    className="rounded-2xl border border-amber-200 bg-white px-3 py-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700/70">
                      Team {typedTeamIndex === 0 ? "A" : "B"}
                    </p>
                    <div className="mt-2 flex flex-col gap-2">
                      {team.map((member) => {
                        const isSelected = selectedSwapMemberId === member.id;
                        const isSwappable = canSwapMembers(
                          teams,
                          selectedMatchType,
                          selectedSwapMemberId,
                          member,
                        );
                        const isClickable =
                          !selectedSwapMemberId || isSelected || isSwappable;

                        return (
                          <button
                            key={member.id}
                            type="button"
                            disabled={!isClickable}
                            onClick={() => handleTeamMemberPress(member)}
                            className={`w-fit rounded-full transition ${
                              isSelected
                                ? "ring-2 ring-[#409eff] ring-offset-2"
                                : ""
                            } ${
                              selectedSwapMemberId && !isSelected && !isSwappable
                                ? "cursor-not-allowed opacity-35"
                                : "cursor-pointer opacity-100"
                            }`}
                          >
                            <UserChip player={member} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </Drawer.Body>
      <Drawer.Footer className="pt-0">
        <Button
          className="w-full rounded-2xl bg-[#409eff] py-3 text-base font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
          isDisabled={!canCreateMatch}
          onPress={onCreateMatch}
        >
          매치 생성
        </Button>
      </Drawer.Footer>
    </>
  );
};

export default CreateMatchDrawerBody;
