import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, Drawer, Radio, RadioGroup, Separator } from "@heroui/react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { IoQrCodeSharp } from "react-icons/io5";
import type {
  MatchMode,
  MatchTopLevelType,
  MatchType,
} from "@pkpkdupr/shared/match";
import {
  DEFAULT_MATCH_MODE,
  getMatchTopLevelType,
  isSinglesMatchType,
  matchModeLabels,
} from "@pkpkdupr/shared/match";
import type { Player } from "@pkpkdupr/shared/player";
import type { VerifyPlayerQrTokenResponse } from "@pkpkdupr/shared/qr";
import Avatar from "@/components/Avatar";
import UserChip from "@/components/UserChip";
import { useAuth } from "@/context/AuthContext";
import { buildApiUrl } from "@/lib/api";

type MatchMember = Pick<Player, "id" | "username" | "gender" | "avatarUrl"> & {
  duprRating?: Player["duprRating"];
};
type MatchTeams = [MatchMember[], MatchMember[]];
type TeamIndex = 0 | 1;
type QrScannerStatus = "idle" | "scanning" | "verifying" | "confirm" | "error";

const normalizeMatchMember = (
  value:
    | Partial<
        Pick<Player, "id" | "username" | "gender" | "avatarUrl" | "duprRating">
      >
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
    duprRating: "duprRating" in value ? value.duprRating : undefined,
  };
};

const formatRating = (rating?: number | null) => rating?.toFixed(2) ?? "NR";

const getGenderLabel = (gender: MatchMember["gender"]) =>
  gender === "M" ? "Male" : "Female";

const getGenderClassName = (gender: MatchMember["gender"]) =>
  gender === "M" ? "text-[#409eff]" : "text-[#f8626c]";

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

const areSameMatchMembers = (a: MatchMember[], b: MatchMember[]) =>
  a.length === b.length &&
  a.every((member, index) => {
    const target = b[index];

    return (
      !!target &&
      member.id === target.id &&
      member.username === target.username &&
      member.gender === target.gender &&
      member.avatarUrl === target.avatarUrl
    );
  });

const resolveMatchTopLevelType = (
  members: MatchMember[],
): MatchTopLevelType | null => {
  if (members.length === 2) {
    return "singles";
  }

  return members.length === 4 ? "doubles" : null;
};

const resolveDefaultMatchType = (
  members: MatchMember[],
  topLevelType: MatchTopLevelType | null,
): MatchType | null => {
  if (!topLevelType) {
    return null;
  }

  if (topLevelType === "singles") {
    return "singles";
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

  return "unrestricted-doubles";
};

const createEmptyTeams = (): MatchTeams => [[], []];

const buildPreviewTeams = (
  members: MatchMember[],
  teams: MatchTeams,
  matchType: MatchType | null,
): MatchTeams => {
  if (matchType) {
    return teams;
  }

  if (members.length <= 1) {
    return [[members[0]].filter((member): member is MatchMember => !!member), []];
  }

  if (members.length === 2) {
    return [
      [members[0]].filter((member): member is MatchMember => !!member),
      [members[1]].filter((member): member is MatchMember => !!member),
    ];
  }

  return [
    [members[0], members[1]].filter((member): member is MatchMember => !!member),
    [members[2], members[3]].filter((member): member is MatchMember => !!member),
  ];
};

const getPreviewTeamSlotCount = (
  members: MatchMember[],
  matchType: MatchType | null,
) => {
  if (matchType) {
    return isSinglesMatchType(matchType) ? 1 : 2;
  }

  return members.length >= 3 ? 2 : 1;
};

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

    if (men.length !== 2 || women.length !== 2) {
      return [
        [members[0], members[1]].filter(Boolean),
        [members[2], members[3]].filter(Boolean),
      ] as MatchTeams;
    }

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

  if (isSinglesMatchType(matchType)) {
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

  if (matchType === "women-doubles") {
    return teams.every(
      (team) =>
        team.length === 2 && team.every((member) => member.gender === "F"),
    );
  }

  return teams.every((team) => team.length === 2);
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

    if (
      error.name === "NotFoundError" ||
      error.name === "DevicesNotFoundError"
    ) {
      return "사용 가능한 카메라를 찾지 못했어요.";
    }

    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "카메라를 시작하지 못했어요. 다른 앱이 카메라를 사용 중인지 확인해주세요.";
    }
  }

  return "QR 스캐너를 시작하지 못했어요. 다시 시도해주세요.";
};

interface CreateMatchDrawerBodyProps {
  onCreateMatch: () => void | Promise<void>;
  onCancel: () => void;
  onQrScannerOpenChange?: (isOpen: boolean) => void;
  isOnline?: boolean;
}

const CreateMatchDrawerBody: React.FC<CreateMatchDrawerBodyProps> = ({
  onCreateMatch,
  onCancel,
  onQrScannerOpenChange,
  isOnline = true,
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
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [createMatchError, setCreateMatchError] = useState<string | null>(null);
  const [selectedMatchMode, setSelectedMatchMode] =
    useState<MatchMode>(DEFAULT_MATCH_MODE);
  const [selectedMatchType, setSelectedMatchType] = useState<MatchType | null>(
    null,
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const lastScannedPayloadRef = useRef<string | null>(null);
  const selectedMatchMembersRef = useRef<MatchMember[]>(selectedMatchMembers);
  const currentPlayerMember = useMemo(
    () => normalizeMatchMember(player),
    [player],
  );
  const selectedMatchTopLevelType = useMemo(
    () => resolveMatchTopLevelType(selectedMatchMembers),
    [selectedMatchMembers],
  );
  const canCreateMatch =
    isOnline && !!selectedMatchType && areTeamsValid(teams, selectedMatchType);
  const canAddMatchMember = isOnline && !!token && selectedMatchMembers.length < 4;
  const previewTeams = useMemo(
    () => buildPreviewTeams(selectedMatchMembers, teams, selectedMatchType),
    [selectedMatchMembers, selectedMatchType, teams],
  );
  const previewTeamSlotCount = useMemo(
    () => getPreviewTeamSlotCount(selectedMatchMembers, selectedMatchType),
    [selectedMatchMembers, selectedMatchType],
  );

  useEffect(() => {
    let isCancelled = false;

    const loadMatchMemberCandidates = async () => {
      const nextMembers: MatchMember[] = currentPlayerMember
        ? [currentPlayerMember]
        : [];

      if (token) {
        try {
          const res = await fetch(buildApiUrl("/api/players"), {
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
  }, [currentPlayerMember, token]);

  useEffect(() => {
    if (!currentPlayerMember) {
      return;
    }

    setSelectedMatchMembers((prev) => {
      const next = mergeUniqueMembers([
        currentPlayerMember,
        ...prev.filter((member) => member.id !== currentPlayerMember.id),
      ]).slice(0, 4);

      if (areSameMatchMembers(prev, next)) {
        return prev;
      }

      selectedMatchMembersRef.current = next;
      return next;
    });
  }, [currentPlayerMember]);

  useEffect(() => {
    const nextDefaultType = resolveDefaultMatchType(
      selectedMatchMembers,
      selectedMatchTopLevelType,
    );

    setSelectedMatchType((previousType) => {
      if (!nextDefaultType) {
        return null;
      }

      if (
        previousType &&
        getMatchTopLevelType(previousType) === selectedMatchTopLevelType
      ) {
        return previousType;
      }

      return nextDefaultType;
    });
  }, [selectedMatchMembers, selectedMatchTopLevelType]);

  useEffect(() => {
    setSelectedSwapMemberId(null);
    setTeams(buildInitialTeams(selectedMatchMembers, selectedMatchType));
    setCreateMatchError(null);
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
    onQrScannerOpenChange?.(false);
    setIsQrScannerOpen(false);
    setQrScannerStatus("idle");
    setQrScannerError(null);
    setPendingQrMember(null);
    lastScannedPayloadRef.current = null;
  }, [onQrScannerOpenChange, stopQrScanner]);

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
      if (!isOnline) {
        showQrScannerError("오프라인에서는 QR 코드를 검증할 수 없습니다. 온라인 연결이 필요합니다.");
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

        const res = await fetch(buildApiUrl("/api/player-qr-token/verify"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ payload }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "QR 코드를 검증하지 못했어요.");
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
          showQrScannerError(
            `${nextMember.username}님은 이미 추가된 멤버예요.`,
          );
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
    [isOnline, showQrScannerError, token],
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

  useEffect(
    () => () => {
      onQrScannerOpenChange?.(false);
    },
    [onQrScannerOpenChange],
  );

  const handleAddMatchMemberByQr = () => {
    if (!token) {
      return;
    }

    if (selectedMatchMembers.length >= 4) {
      return;
    }

    onQrScannerOpenChange?.(true);
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

    const nextMember = pendingQrMember;

    if (selectedMatchMembersRef.current.length >= 4) {
      showQrScannerError("매치 멤버는 최대 4명까지 추가할 수 있어요.");
      return;
    }

    if (
      selectedMatchMembersRef.current.some(
        (member) => member.id === nextMember.id,
      )
    ) {
      showQrScannerError(`${nextMember.username}님은 이미 추가된 멤버예요.`);
      return;
    }

    const nextMembers = [...selectedMatchMembersRef.current, nextMember];

    selectedMatchMembersRef.current = nextMembers;
    setSelectedMatchMembers(nextMembers);
    setMatchMemberCandidates((prev) =>
      mergeUniqueMembers([...prev, nextMember]),
    );

    if (nextMembers.length >= 4) {
      closeQrScanner();
      return;
    }

    handleRetryQrScan();
  };

  const handleRemoveMatchMember = (memberId: string) => {
    if (memberId === currentPlayerMember?.id) {
      return;
    }

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

    if (
      !canSwapMembers(teams, selectedMatchType, selectedSwapMemberId, member)
    ) {
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

  const handleCreateMatchPress = async () => {
    if (!token) {
      setCreateMatchError("로그인이 필요해요.");
      return;
    }
    if (!isOnline) {
      setCreateMatchError("오프라인에서는 매치를 생성할 수 없습니다. 온라인 연결이 필요합니다.");
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

  const renderTeamGrid = (interactive: boolean) => (
    <div className="grid grid-cols-2 gap-3">
      {previewTeams.map((team, teamIndex) => {
        const typedTeamIndex = teamIndex as TeamIndex;
        const emptySlotCount = Math.max(0, previewTeamSlotCount - team.length);

        return (
          <div
            key={typedTeamIndex}
            className="rounded-2xl border border-border bg-white px-3 py-3"
          >
            <p className="bs-text-caption font-semibold uppercase tracking-wide text-amber-700/70">
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
                const isMe = member.id === currentPlayerMember?.id;

                return (
                  <div
                    key={member.id}
                    role={interactive ? "button" : undefined}
                    tabIndex={interactive && isClickable ? 0 : undefined}
                    onClick={
                      interactive && isClickable
                        ? () => handleTeamMemberPress(member)
                        : undefined
                    }
                    onKeyDown={
                      interactive && isClickable
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleTeamMemberPress(member);
                            }
                          }
                        : undefined
                    }
                    className={`w-fit rounded-full transition ${
                      isSelected ? "ring-2 ring-[#409eff] ring-offset-2" : ""
                    } ${
                      interactive && selectedSwapMemberId && !isSelected && !isSwappable
                        ? "cursor-not-allowed opacity-35"
                        : interactive
                          ? "cursor-pointer opacity-100"
                          : "cursor-default opacity-100"
                    }`}
                  >
                    <UserChip
                      player={member}
                      onRemove={
                        isMe ? undefined : () => handleRemoveMatchMember(member.id)
                      }
                      isMe={isMe}
                    />
                  </div>
                );
              })}
              {Array.from({ length: emptySlotCount }).map((_, emptyIndex) => (
                <div
                  key={`empty-${typedTeamIndex}-${emptyIndex}`}
                  className="flex h-6 w-30 items-center rounded-full border border-dashed border-border bg-slate-50 px-3 text-sm text-slate-400"
                >
                  빈 자리
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const qrScannerPanel = (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="bs-text-title text-amber-950">팀 구성</p>
        {renderTeamGrid(false)}
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-slate-950">
        {qrScannerStatus === "scanning" ? (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="aspect-square w-full bg-slate-950 object-cover"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.22)]"
            />
            <p className="bs-text-caption absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-black/55 px-3 py-1 font-semibold text-white">
              QR 코드를 스캔 중입니다.
            </p>
          </div>
        ) : null}

        {qrScannerStatus === "verifying" ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 bg-white px-5 text-center">
            <div className="size-10 animate-spin rounded-full border-[3px] border-[#409eff]/20 border-t-[#409eff]" />
            <p className="bs-text-title text-amber-950">
              QR 코드를 확인 중입니다...
            </p>
          </div>
        ) : null}

        {qrScannerStatus === "confirm" && pendingQrMember ? (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-4 bg-white px-5 text-center">
            <div className="flex w-full max-w-[180px] min-w-0 flex-col items-center rounded-2xl bg-white/90 px-3 py-4 text-center shadow-sm ring-1 ring-border">
              <Avatar
                size="sm"
                avatarUrl={pendingQrMember.avatarUrl}
                name={pendingQrMember.username}
                isMe={pendingQrMember.id === player?.id}
              />
              <div className="mt-3 min-w-0">
                <p className="truncate font-semibold text-amber-950">
                  {pendingQrMember.username}
                </p>
                <p
                  className={`mt-1 text-xs font-medium ${getGenderClassName(
                    pendingQrMember.gender,
                  )}`}
                >
                  {getGenderLabel(pendingQrMember.gender)}
                </p>
                <p className="mt-2 text-sm font-semibold text-amber-950">
                  {formatRating(pendingQrMember.duprRating?.total)}
                </p>
              </div>
            </div>
            <div>
              <p className="bs-text-head text-amber-950">
                {pendingQrMember.username}님을 매치 멤버로 추가할까요?
              </p>
              <p className="bs-text-caption mt-2 text-amber-700/70">
                추가하면 현재 매치 멤버 목록에 반영됩니다.
              </p>
            </div>
          </div>
        ) : null}

        {qrScannerStatus === "error" ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 bg-white px-5 text-center">
            <div className="bs-text-caption rounded-full bg-error/10 px-3 py-1 font-bold text-error">
              스캔 실패
            </div>
            <p className="bs-text-title text-error">{qrScannerError}</p>
          </div>
        ) : null}
      </div>

      <div className="flex gap-2">
        {qrScannerStatus === "confirm" ? (
          <>
            <Button
              className="flex-1 rounded-2xl bg-red-50 font-semibold text-red-500"
              onPress={handleRetryQrScan}
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

        {qrScannerStatus === "scanning" || qrScannerStatus === "verifying" ? (
          <Button
            className="w-full rounded-2xl bg-[#409eff] font-semibold text-white"
            onPress={closeQrScanner}
          >
            완료
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <Drawer.Body className="flex flex-col gap-5 px-5 pb-4">
        {isQrScannerOpen ? (
          qrScannerPanel
        ) : (
          <>
            <section className="flex flex-col gap-2">
              <div className="relative flex items-start justify-between gap-3 mt-8">
                <div>
                  <p className="bs-text-title text-amber-950">팀 구성</p>
                </div>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleAddMatchMemberByQr();
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
                  {renderTeamGrid(true)}
                </>
              ) : (
                <>
                  {renderTeamGrid(false)}
                  <p className="bs-text-body text-error">
                    멤버 2명 또는 4명이 필요해요.
                  </p>
                </>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <p className="bs-text-title text-amber-950">경기 모드</p>
              <RadioGroup
                aria-label="경기 모드"
                value={selectedMatchMode}
                onChange={(value) => setSelectedMatchMode(value as MatchMode)}
                orientation="horizontal"
                className="flex gap-5"
              >
                {(["single-game", "best-of-3"] as const).map((mode) => (
                  <Radio key={mode} value={mode}>
                    <div
                      onClick={() => setSelectedMatchMode(mode)}
                      className="cursor-pointer"
                    >
                      <Radio.Content
                        className="flex select-none items-center gap-2 py-1"
                      >
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
                            selectedMatchMode === mode
                              ? "opacity-100"
                              : "opacity-45"
                          }`}
                        >
                          {matchModeLabels[mode]}
                        </span>
                      </Radio.Content>
                    </div>
                  </Radio>
                ))}
              </RadioGroup>
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
            {createMatchError ? (
              <p className="bs-text-body text-error">{createMatchError}</p>
            ) : null}
            <div className="grid w-full grid-cols-3 gap-2">
              <Button
                className="w-full rounded-2xl bg-red-50 py-3 text-base font-semibold text-red-500"
                isDisabled={isCreatingMatch}
                onPress={onCancel}
              >
                취소
              </Button>
              <Button
                className="col-span-2 w-full rounded-2xl bg-[#409eff] py-3 text-base font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
                isDisabled={!canCreateMatch || isCreatingMatch}
                onPress={handleCreateMatchPress}
              >
                {!isOnline ? "온라인 연결 필요" : isCreatingMatch ? "생성 중..." : "매치 생성"}
              </Button>
            </div>
          </Drawer.Footer>
        </>
      ) : null}
    </>
  );
};

export default CreateMatchDrawerBody;
