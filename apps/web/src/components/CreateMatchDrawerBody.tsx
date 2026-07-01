import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Drawer } from "@heroui/react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { IoQrCodeSharp } from "react-icons/io5";
import type { MatchType } from "@pkpkdupr/shared/match";
import { matchTypeLabels } from "@pkpkdupr/shared/match";
import type { Player } from "@pkpkdupr/shared/player";
import type { VerifyPlayerQrTokenResponse } from "@pkpkdupr/shared/qr";
import UserChip from "@/components/UserChip";
import { useAuth } from "@/context/AuthContext";

type MatchMember = Pick<Player, "id" | "username" | "gender" | "avatarUrl">;
type MatchTeams = [MatchMember[], MatchMember[]];
type TeamIndex = 0 | 1;
type QrScannerStatus = "idle" | "scanning" | "verifying" | "confirm" | "error";

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

const getCameraErrorMessage = (error: unknown) => {
  if (
    window.location.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname)
  ) {
    return "카메라 스캔은 HTTPS 환경에서 사용할 수 있어요.";
  }

  if (error instanceof DOMException) {
    if (
      error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError"
    ) {
      return "카메라 권한이 필요해요. 브라우저 권한을 허용한 뒤 다시 시도해주세요.";
    }

    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "사용 가능한 카메라를 찾지 못했어요.";
    }

    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "카메라를 시작하지 못했어요. 다른 앱이 카메라를 사용 중인지 확인해주세요.";
    }
  }

  return "QR 스캐너를 시작하지 못했어요. 다시 시도해주세요.";
};

interface CreateMatchDrawerBodyProps {
  onCreateMatch: () => void;
}

const CreateMatchDrawerBody: React.FC<CreateMatchDrawerBodyProps> = ({
  onCreateMatch,
}) => {
  const { player, token } = useAuth();
  const [, setMatchMemberCandidates] = useState<MatchMember[]>([]);
  const [selectedMatchMembers, setSelectedMatchMembers] = useState<
    MatchMember[]
  >([]);
  const [teams, setTeams] = useState<MatchTeams>(() => createEmptyTeams());
  const [selectedSwapMemberId, setSelectedSwapMemberId] = useState<
    string | null
  >(null);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [qrScannerStatus, setQrScannerStatus] =
    useState<QrScannerStatus>("idle");
  const [qrScannerError, setQrScannerError] = useState<string | null>(null);
  const [pendingQrMember, setPendingQrMember] = useState<MatchMember | null>(
    null,
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const lastScannedPayloadRef = useRef<string | null>(null);
  const selectedMatchMembersRef = useRef<MatchMember[]>(selectedMatchMembers);
  const selectedMatchType = useMemo(
    () => resolveMatchType(selectedMatchMembers),
    [selectedMatchMembers],
  );
  const canCreateMatch = areTeamsValid(teams, selectedMatchType);
  const canAddMatchMember = !!token && selectedMatchMembers.length < 4;
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

  useEffect(() => {
    selectedMatchMembersRef.current = selectedMatchMembers;
  }, [selectedMatchMembers]);

  const stopQrScanner = useCallback(() => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const closeQrScanner = useCallback(() => {
    stopQrScanner();
    setIsQrScannerOpen(false);
    setQrScannerStatus("idle");
    setQrScannerError(null);
    setPendingQrMember(null);
    lastScannedPayloadRef.current = null;
  }, [stopQrScanner]);

  const showQrScannerError = useCallback((message: string) => {
    setQrScannerStatus("error");
    setQrScannerError(message);
    setPendingQrMember(null);
    lastScannedPayloadRef.current = null;
  }, []);

  const verifyScannedQrPayload = useCallback(
    async (payload: string) => {
      if (!token) {
        showQrScannerError("로그인이 필요해요.");
        return;
      }

      if (selectedMatchMembersRef.current.length >= 4) {
        showQrScannerError("매치 멤버는 최대 4명까지 추가할 수 있어요.");
        return;
      }

      try {
        setQrScannerStatus("verifying");
        setQrScannerError(null);
        setPendingQrMember(null);

        const res = await fetch("/api/player-qr-token/verify", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ payload }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error || "QR 코드를 검증하지 못했어요.",
          );
        }

        const data = (await res.json()) as VerifyPlayerQrTokenResponse;
        const nextMember = normalizeMatchMember(data.player);
        if (!nextMember) {
          throw new Error("유효한 멤버 정보가 아니에요.");
        }

        if (
          selectedMatchMembersRef.current.some(
            (member) => member.id === nextMember.id,
          )
        ) {
          showQrScannerError(`${nextMember.username}님은 이미 추가된 멤버예요.`);
          return;
        }

        if (selectedMatchMembersRef.current.length >= 4) {
          showQrScannerError("매치 멤버는 최대 4명까지 추가할 수 있어요.");
          return;
        }

        setPendingQrMember(nextMember);
        setQrScannerStatus("confirm");
      } catch (err) {
        showQrScannerError(
          err instanceof Error ? err.message : "QR 코드를 검증하지 못했어요.",
        );
      }
    },
    [showQrScannerError, token],
  );

  useEffect(() => {
    if (!isQrScannerOpen || qrScannerStatus !== "scanning") {
      return;
    }

    let isCancelled = false;

    const startScanner = async () => {
      const video = videoRef.current;
      if (!video) {
        showQrScannerError("QR 스캐너 화면을 준비하지 못했어요.");
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        showQrScannerError("이 브라우저에서는 카메라 스캔을 사용할 수 없어요.");
        return;
      }

      try {
        stopQrScanner();
        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 250,
          delayBetweenScanSuccess: 500,
        });

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (result, _error, controls) => {
            if (!result || lastScannedPayloadRef.current) {
              return;
            }

            const payload = result.getText();
            if (!payload) {
              return;
            }

            lastScannedPayloadRef.current = payload;
            controls.stop();
            scannerControlsRef.current = null;
            void verifyScannedQrPayload(payload);
          },
        );

        if (isCancelled) {
          controls.stop();
          return;
        }

        scannerControlsRef.current = controls;
      } catch (err) {
        if (!isCancelled) {
          showQrScannerError(getCameraErrorMessage(err));
        }
      }
    };

    void startScanner();

    return () => {
      isCancelled = true;
      stopQrScanner();
    };
  }, [
    isQrScannerOpen,
    qrScannerStatus,
    showQrScannerError,
    stopQrScanner,
    verifyScannedQrPayload,
  ]);

  useEffect(() => stopQrScanner, [stopQrScanner]);

  const handleAddMatchMemberByQr = () => {
    if (!token) {
      return;
    }

    if (selectedMatchMembers.length >= 4) {
      return;
    }

    setIsQrScannerOpen(true);
    setQrScannerStatus("scanning");
    setQrScannerError(null);
    setPendingQrMember(null);
    lastScannedPayloadRef.current = null;
  };

  const handleRetryQrScan = () => {
    stopQrScanner();
    setQrScannerStatus("scanning");
    setQrScannerError(null);
    setPendingQrMember(null);
    lastScannedPayloadRef.current = null;
  };

  const handleConfirmQrMember = () => {
    if (!pendingQrMember) {
      return;
    }

    if (selectedMatchMembersRef.current.length >= 4) {
      showQrScannerError("매치 멤버는 최대 4명까지 추가할 수 있어요.");
      return;
    }

    if (
      selectedMatchMembersRef.current.some(
        (member) => member.id === pendingQrMember.id,
      )
    ) {
      showQrScannerError(`${pendingQrMember.username}님은 이미 추가된 멤버예요.`);
      return;
    }

    setSelectedMatchMembers((prev) => [...prev, pendingQrMember]);
    setMatchMemberCandidates((prev) =>
      mergeUniqueMembers([...prev, pendingQrMember]),
    );
    closeQrScanner();
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
              isDisabled={!canAddMatchMember || isQrScannerOpen}
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
                  isMe={member.id === player?.id}
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
                            <UserChip
                              player={member}
                              isMe={member.id === player?.id}
                            />
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

      {isQrScannerOpen
        ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/45 px-4 pb-4 pt-16">
          <div className="w-full max-w-[430px] rounded-3xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold text-amber-950">
                  QR 멤버 추가
                </p>
                <p className="mt-1 text-xs text-amber-700/70">
                  멤버의 QR 코드를 카메라에 맞춰주세요.
                </p>
              </div>
              <Button
                size="sm"
                onPress={closeQrScanner}
                className="rounded-full px-3"
              >
                닫기
              </Button>
            </div>

            <div className="mt-4 overflow-hidden rounded-3xl border border-amber-100 bg-slate-950">
              {qrScannerStatus === "scanning" ? (
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="aspect-[3/4] w-full bg-slate-950 object-cover"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.22)]"
                  />
                  <p className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
                    QR 코드를 스캔 중입니다.
                  </p>
                </div>
              ) : null}

              {qrScannerStatus === "verifying" ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 bg-white px-5 text-center">
                  <div className="size-10 animate-spin rounded-full border-[3px] border-[#409eff]/20 border-t-[#409eff]" />
                  <p className="text-sm font-semibold text-amber-950">
                    QR 코드를 확인 중입니다...
                  </p>
                </div>
              ) : null}

              {qrScannerStatus === "confirm" && pendingQrMember ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 bg-white px-5 text-center">
                  <UserChip
                    player={pendingQrMember}
                    isMe={pendingQrMember.id === player?.id}
                  />
                  <div>
                    <p className="text-base font-bold text-amber-950">
                      {pendingQrMember.username}님을 매치 멤버로 추가할까요?
                    </p>
                    <p className="mt-2 text-xs text-amber-700/70">
                      추가하면 현재 매치 멤버 목록에 반영됩니다.
                    </p>
                  </div>
                </div>
              ) : null}

              {qrScannerStatus === "error" ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 bg-white px-5 text-center">
                  <div className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-500">
                    스캔 실패
                  </div>
                  <p className="text-sm font-semibold text-amber-950">
                    {qrScannerError}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex gap-2">
              {qrScannerStatus === "confirm" ? (
                <>
                  <Button
                    className="flex-1 rounded-2xl bg-slate-100 text-slate-700"
                    onPress={handleRetryQrScan}
                  >
                    다시 스캔
                  </Button>
                  <Button
                    className="flex-1 rounded-2xl bg-slate-100 text-slate-700"
                    onPress={closeQrScanner}
                  >
                    취소
                  </Button>
                  <Button
                    className="flex-1 rounded-2xl bg-[#409eff] font-semibold text-white"
                    onPress={handleConfirmQrMember}
                  >
                    추가
                  </Button>
                </>
              ) : null}

              {qrScannerStatus === "error" ? (
                <>
                  <Button
                    className="flex-1 rounded-2xl bg-slate-100 text-slate-700"
                    onPress={closeQrScanner}
                  >
                    닫기
                  </Button>
                  <Button
                    className="flex-1 rounded-2xl bg-[#409eff] font-semibold text-white"
                    onPress={handleRetryQrScan}
                  >
                    다시 스캔
                  </Button>
                </>
              ) : null}

              {qrScannerStatus === "scanning" ||
              qrScannerStatus === "verifying" ? (
                <Button
                  className="w-full rounded-2xl bg-slate-100 text-slate-700"
                  onPress={closeQrScanner}
                >
                  취소
                </Button>
              ) : null}
            </div>
          </div>
        </div>,
        document.body,
          )
        : null}
    </>
  );
};

export default CreateMatchDrawerBody;
