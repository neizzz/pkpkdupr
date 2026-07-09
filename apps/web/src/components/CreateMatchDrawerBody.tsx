import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Drawer, Radio, RadioGroup, Separator } from "@heroui/react";
import { IoQrCodeSharp } from "react-icons/io5";
import type { MatchMode } from "@pkpkdupr/shared/match";
import { DEFAULT_MATCH_MODE } from "@pkpkdupr/shared/match";
import { useAuth } from "@/context/AuthContext";
import { buildApiUrl } from "@/lib/api";
import CreateMatchModeSelector from "./CreateMatchModeSelector";
import CreateMatchQrScannerPanel from "./CreateMatchQrScannerPanel";
import CreateMatchTeamGrid from "./CreateMatchTeamGrid";
import HoldToConfirmButton from "./HoldToConfirmButton";
import {
  areSameMatchMembers,
  areSameMatchTeams,
  areTeamsValid,
  buildInitialTeams,
  buildPreviewTeams,
  canSwapMembers,
  createEmptyTeams,
  mergeUniqueMembers,
  normalizeMatchMember,
  resolveSelectedMatchType,
  type MatchMember,
  type MatchTeams,
} from "./CreateMatchDrawerBody.utils";
import useCreateMatchQrScanner from "./useCreateMatchQrScanner";

interface CreateMatchDrawerBodyProps {
  onCreateMatch: () => void | Promise<void>;
  onCancel: () => void;
  onQrScannerOpenChange?: (isOpen: boolean) => void;
  isOnline?: boolean;
  closeQrScannerRequestKey?: number;
}

const CreateMatchDrawerBody: React.FC<CreateMatchDrawerBodyProps> = ({
  onCreateMatch,
  onCancel,
  onQrScannerOpenChange,
  isOnline = true,
  closeQrScannerRequestKey = 0,
}) => {
  const { player, token } = useAuth();
  const [selectedMatchMembers, setSelectedMatchMembers] = useState<MatchMember[]>([]);
  const [teams, setTeams] = useState<MatchTeams>(() => createEmptyTeams());
  const [selectedSwapMemberId, setSelectedSwapMemberId] = useState<string | null>(null);
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [createMatchError, setCreateMatchError] = useState<string | null>(null);
  const [matchNameMode, setMatchNameMode] = useState<"auto" | "manual">("auto");
  const [matchName, setMatchName] = useState("");
  const [selectedMatchMode, setSelectedMatchMode] =
    useState<MatchMode>(DEFAULT_MATCH_MODE);
  const selectedMatchMembersRef = useRef<MatchMember[]>(selectedMatchMembers);

  const currentPlayerMember = useMemo(() => normalizeMatchMember(player), [player]);
  const selectedMatchType = useMemo(
    () => resolveSelectedMatchType(selectedMatchMembers),
    [selectedMatchMembers],
  );
  const trimmedMatchName = matchName.trim();
  const matchNameValidationError =
    matchNameMode === "manual" && !trimmedMatchName
      ? "매치 이름을 입력해주세요."
      : null;
  const canCreateMatch =
    isOnline &&
    !!selectedMatchType &&
    areTeamsValid(teams, selectedMatchType) &&
    !matchNameValidationError;
  const canAddMatchMember = isOnline && !!token && selectedMatchMembers.length < 4;
  const previewTeams = useMemo(
    () => buildPreviewTeams(selectedMatchMembers, teams, selectedMatchType),
    [selectedMatchMembers, selectedMatchType, teams],
  );

  const applyMembersState = useCallback((nextMembers: MatchMember[]) => {
    const nextMatchType = resolveSelectedMatchType(nextMembers);
    const nextTeams = buildInitialTeams(nextMembers, nextMatchType);

    selectedMatchMembersRef.current = nextMembers;
    setSelectedMatchMembers((prev) =>
      areSameMatchMembers(prev, nextMembers) ? prev : nextMembers,
    );
    setTeams((prev) => (areSameMatchTeams(prev, nextTeams) ? prev : nextTeams));
    setSelectedSwapMemberId(null);
    setCreateMatchError(null);
  }, []);

  useEffect(() => {
    if (!currentPlayerMember) {
      return;
    }

    const nextMembers = mergeUniqueMembers([
      currentPlayerMember,
      ...selectedMatchMembers.filter((member) => member.id !== currentPlayerMember.id),
    ]).slice(0, 4);

    if (areSameMatchMembers(selectedMatchMembers, nextMembers)) {
      return;
    }

    applyMembersState(nextMembers);
  }, [applyMembersState, currentPlayerMember, selectedMatchMembers]);

  useEffect(() => {
    selectedMatchMembersRef.current = selectedMatchMembers;
  }, [selectedMatchMembers]);

  const {
    videoRef,
    isQrScannerOpen,
    qrScannerStatus,
    qrScannerError,
    pendingQrMember,
    openQrScanner,
    retryQrScan,
    closeQrScanner,
  } = useCreateMatchQrScanner({
    token,
    isOnline,
    selectedMatchMembersRef,
    onQrScannerOpenChange,
    closeQrScannerRequestKey,
  });

  const handleConfirmQrMember = () => {
    if (!pendingQrMember) {
      return;
    }

    const nextMember = pendingQrMember;

    if (selectedMatchMembersRef.current.length >= 4) {
      closeQrScanner();
      return;
    }

    if (
      selectedMatchMembersRef.current.some(
        (member) => member.id === nextMember.id,
      )
    ) {
      retryQrScan();
      return;
    }

    const nextMembers = [...selectedMatchMembersRef.current, nextMember];
    applyMembersState(nextMembers);

    if (nextMembers.length >= 4) {
      closeQrScanner();
      return;
    }

    retryQrScan();
  };

  const handleRemoveMatchMember = (memberId: string) => {
    if (memberId === currentPlayerMember?.id) {
      return;
    }

    const nextMembers = selectedMatchMembersRef.current.filter(
      (member) => member.id !== memberId,
    );

    applyMembersState(nextMembers);
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
      const sourceMember = prev.flat().find((teamMember) => teamMember.id === selectedSwapMemberId);
      const targetMember = prev.flat().find((teamMember) => teamMember.id === member.id);

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

  const handleCreateMatchPress = async () => {
    if (!token) {
      setCreateMatchError("로그인이 필요해요.");
      return;
    }
    if (!isOnline) {
      setCreateMatchError(
        "오프라인에서는 매치를 생성할 수 없습니다. 온라인 연결이 필요합니다.",
      );
      return;
    }

    if (!selectedMatchType || !areTeamsValid(teams, selectedMatchType)) {
      setCreateMatchError("유효한 팀 구성이 필요해요.");
      return;
    }

    try {
      setIsCreatingMatch(true);
      setCreateMatchError(null);

      const res = await fetch(buildApiUrl("/api/matches"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(matchNameMode === "manual" ? { name: trimmedMatchName } : {}),
          mode: selectedMatchMode,
          teams: teams.map((team, teamIndex) => ({
            name: `Team ${teamIndex === 0 ? "A" : "B"}`,
            playerIds: team.map((member) => member.id),
          })),
          location: "Court TBD",
          scheduledAt: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "매치를 생성하지 못했어요.");
      }

      await onCreateMatch();
    } catch (err) {
      setCreateMatchError(
        err instanceof Error ? err.message : "매치를 생성하지 못했어요.",
      );
    } finally {
      setIsCreatingMatch(false);
    }
  };

  const teamGrid = (
    <CreateMatchTeamGrid
      previewTeams={previewTeams}
      teams={teams}
      selectedMatchType={selectedMatchType}
      selectedSwapMemberId={selectedSwapMemberId}
      currentPlayerMemberId={currentPlayerMember?.id}
      interactive={!isQrScannerOpen}
      onRemoveMember={handleRemoveMatchMember}
      onPressMember={handleTeamMemberPress}
    />
  );

  return (
    <>
      <Drawer.Body className="flex flex-col gap-5 px-5 pb-4">
        {isQrScannerOpen ? (
          <CreateMatchQrScannerPanel
            teamGrid={
              <CreateMatchTeamGrid
                previewTeams={previewTeams}
                teams={teams}
                selectedMatchType={selectedMatchType}
                selectedSwapMemberId={selectedSwapMemberId}
                currentPlayerMemberId={currentPlayerMember?.id}
                interactive={false}
                onRemoveMember={handleRemoveMatchMember}
                onPressMember={handleTeamMemberPress}
              />
            }
            videoRef={videoRef}
            qrScannerStatus={qrScannerStatus}
            qrScannerError={qrScannerError}
            pendingQrMember={pendingQrMember}
            currentPlayerId={player?.id}
            onRetry={retryQrScan}
            onConfirm={handleConfirmQrMember}
            onClose={closeQrScanner}
          />
        ) : (
          <>
            <section className="flex flex-col gap-2">
              <div className="relative mt-8 flex items-start justify-between gap-3">
                <div>
                  <p className="bs-text-title text-amber-950">팀 구성</p>
                </div>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openQrScanner();
                  }}
                  disabled={!canAddMatchMember || isQrScannerOpen}
                  className="absolute right-0 -top-2 flex shrink-0 items-center gap-1 rounded-full bg-[#409eff] px-4 py-2 text-sm font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <IoQrCodeSharp className="size-4" />
                  멤버 추가
                </button>
              </div>

              {selectedMatchType ? (
                <>
                  <p className="bs-text-caption text-amber-700/70">
                    {selectedSwapMemberId
                      ? "교체할 상대 팀 멤버를 선택하세요."
                      : "멤버를 탭해서 팀을 교체할 수 있어요."}
                  </p>
                  {teamGrid}
                </>
              ) : (
                <>
                  <p className="bs-text-caption text-error">
                    멤버 2명 또는 4명이 필요해요.
                  </p>
                  {teamGrid}
                </>
              )}
            </section>

            <CreateMatchModeSelector
              selectedMatchMode={selectedMatchMode}
              onChange={setSelectedMatchMode}
            />

            <section className="flex flex-col gap-2">
              <p className="bs-text-title text-amber-950">매치 이름</p>
              <RadioGroup
                aria-label="매치 이름 입력 방식"
                value={matchNameMode}
                onChange={(value) => setMatchNameMode(value as "auto" | "manual")}
                orientation="horizontal"
                className="flex gap-5"
              >
                {([
                  { value: "auto", label: "자동" },
                  { value: "manual", label: "입력폼" },
                ] as const).map((option) => (
                  <Radio key={option.value} value={option.value}>
                    <div
                      onClick={() => setMatchNameMode(option.value)}
                      className="cursor-pointer"
                    >
                      <Radio.Content className="flex select-none items-center gap-2 py-1">
                        <Radio.Control className="flex size-5 items-center justify-center rounded-full border border-slate-300 bg-white">
                          <Radio.Indicator className="flex size-full items-center justify-center">
                            {({ isSelected }) => (
                              <span
                                className={`block size-2.5 rounded-full bg-[#409eff] transition-all duration-200 ease-out ${
                                  isSelected
                                    ? "scale-100 opacity-100"
                                    : "scale-0 opacity-0"
                                }`}
                              />
                            )}
                          </Radio.Indicator>
                        </Radio.Control>
                        <span
                          className={`bs-text-title text-amber-950 transition-all duration-200 ease-out ${
                            matchNameMode === option.value ? "opacity-100" : "opacity-45"
                          }`}
                        >
                          {option.label}
                        </span>
                      </Radio.Content>
                    </div>
                  </Radio>
                ))}
              </RadioGroup>
              {matchNameMode === "manual" ? (
                <input
                  type="text"
                  value={matchName}
                  onChange={(event) => {
                    setMatchName(event.target.value);
                    setCreateMatchError(null);
                  }}
                  placeholder="매치 이름 입력"
                  className="app-mobile-input w-full rounded-2xl border border-border px-4 py-3 text-base text-amber-950 outline-none"
                />
              ) : null}
            </section>
          </>
        )}
      </Drawer.Body>
      {!isQrScannerOpen ? (
        <>
          <div className="px-5">
            <Separator />
          </div>
          <Drawer.Footer className="flex flex-col gap-2 px-5 pt-3">
            {createMatchError || matchNameValidationError ? (
              <p className="bs-text-body text-error">
                {createMatchError ?? matchNameValidationError}
              </p>
            ) : null}
            <div className="grid w-full grid-cols-3 gap-2">
              <Button
                className="app-action-button w-full rounded-2xl bg-red-50 py-3 text-base font-semibold text-red-500"
                isDisabled={isCreatingMatch}
                onPress={onCancel}
              >
                취소
              </Button>
              <HoldToConfirmButton
                ariaLabel="길게 눌러 매치생성"
                onComplete={handleCreateMatchPress}
                isDisabled={!canCreateMatch || isCreatingMatch}
                className="app-action-button col-span-2 w-full justify-center rounded-2xl bg-[#409eff] px-3 py-3 text-base font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
                progressClassName="bg-white/20"
              >
                {!isOnline
                  ? "온라인 연결 필요"
                  : isCreatingMatch
                    ? "생성 중..."
                    : "길게 눌러 매치생성"}
              </HoldToConfirmButton>
            </div>
          </Drawer.Footer>
        </>
      ) : null}
    </>
  );
};

export default CreateMatchDrawerBody;
