import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, Drawer } from "@heroui/react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { IoQrCodeSharp } from "react-icons/io5";
import type { MatchType } from "@pkpkdupr/shared/match";
import { matchTypeLabels } from "@pkpkdupr/shared/match";
import type { Player } from "@pkpkdupr/shared/player";
import type { VerifyPlayerQrTokenResponse } from "@pkpkdupr/shared/qr";
import Avatar from "@/components/Avatar";
import UserChip from "@/components/UserChip";
import { useAuth } from "@/context/AuthContext";

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const lastScannedPayloadRef = useRef<string | null>(null);
  const selectedMatchMembersRef = useRef<MatchMember[]>(selectedMatchMembers);
  const currentPlayerMember = useMemo(
    () => normalizeMatchMember(player),
    [player],
  );
  const selectedMatchType = useMemo(
    () => resolveMatchType(selectedMatchMembers),
    [selectedMatchMembers],
  );
  const canCreateMatch = isOnline && areTeamsValid(teams, selectedMatchType);
  const canAddMatchMember = isOnline && !!token && selectedMatchMembers.length < 4;

  useEffect(() => {
    let isCancelled = false;

    const loadMatchMemberCandidates = async () => {
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

    selectedMatchMembersRef.current = [
      ...selectedMatchMembersRef.current,
      nextMember,
    ];
    setSelectedMatchMembers((prev) => [...prev, nextMember]);
    setMatchMemberCandidates((prev) =>
      mergeUniqueMembers([...prev, nextMember]),
    );
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

      const res = await fetch("/api/matches", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: selectedMatchType,
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

  const qrScannerPanel = (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="bs-text-title text-amber-950">현재 멤버</p>
        <div className="flex flex-wrap items-center gap-2">
          {selectedMatchMembers.length > 0 ? (
            selectedMatchMembers.map((member) => {
              const isMe = member.id === currentPlayerMember?.id;

              return (
                <UserChip
                  key={member.id}
                  player={member}
                  onRemove={
                    isMe ? undefined : () => handleRemoveMatchMember(member.id)
                  }
                  isMe={isMe}
                />
              );
            })
          ) : (
            <p className="bs-text-body text-amber-700/70">
              아직 추가된 멤버가 없어요.
            </p>
          )}
        </div>
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
                  <p className="bs-text-title text-amber-950">멤버</p>
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

              <div className="flex flex-wrap gap-2">
                {selectedMatchMembers.length > 0 ? (
                  selectedMatchMembers.map((member) => {
                    const isMe = member.id === currentPlayerMember?.id;

                    return (
                      <UserChip
                        key={member.id}
                        player={member}
                        onRemove={
                          isMe
                            ? undefined
                            : () => handleRemoveMatchMember(member.id)
                        }
                        isMe={isMe}
                      />
                    );
                  })
                ) : (
                  <p className="bs-text-body text-amber-700/70">
                    아직 추가된 멤버가 없어요.
                  </p>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <p className="bs-text-title text-amber-950">매치 타입</p>
              {selectedMatchType ? (
                <div className="bs-text-title rounded-2xl border border-[#409eff] bg-[#409eff]/10 px-3 py-2 text-[#409eff]">
                  {matchTypeLabels[selectedMatchType]}
                </div>
              ) : (
                <p className="bs-text-body text-error">
                  유효한 성별 구성이 필요해요.
                </p>
              )}
            </section>

            <section className="flex flex-col gap-2">
              {selectedMatchType ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="bs-text-title text-amber-950">팀 구성</p>
                  {selectedSwapMemberId ? (
                    <p className="bs-text-caption text-amber-700/70">
                      교체할 상대 팀 멤버를 선택하세요.
                    </p>
                  ) : (
                    <p className="bs-text-caption text-amber-700/70">
                      멤버를 탭해서 팀을 교체할 수 있어요.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <p className="bs-text-title text-amber-950">팀 구성</p>
                  <p className="bs-text-body text-error">
                    유효한 성별 구성이 필요해요.
                  </p>
                </>
              )}

              {selectedMatchType ? (
                <div className="grid grid-cols-2 gap-3">
                  {teams.map((team, teamIndex) => {
                    const typedTeamIndex = teamIndex as TeamIndex;

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
                            const isSelected =
                              selectedSwapMemberId === member.id;
                            const isSwappable = canSwapMembers(
                              teams,
                              selectedMatchType,
                              selectedSwapMemberId,
                              member,
                            );
                            const isClickable =
                              !selectedSwapMemberId ||
                              isSelected ||
                              isSwappable;

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
                                  selectedSwapMemberId &&
                                  !isSelected &&
                                  !isSwappable
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
              ) : null}
            </section>
          </>
        )}
      </Drawer.Body>
      {!isQrScannerOpen ? (
        <Drawer.Footer className="flex flex-col gap-2 px-5 pt-0">
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
      ) : null}
    </>
  );
};

export default CreateMatchDrawerBody;
