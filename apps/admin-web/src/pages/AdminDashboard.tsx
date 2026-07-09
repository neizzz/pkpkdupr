import React, { useState, useEffect } from "react";
import type {
  OfficialDuprAdjustmentPreview,
  Player,
  PlayerCreationLog,
  PlayerCreationSource,
  PlayerDuprMetrics,
  PublicPlayerDupr,
  PlayerRatingChangeLog,
  PlayerStatus,
  PlayerStatusChangeLog,
} from "@pkpkdupr/shared/player";
import {
  getCompositeDoublesRating,
  getCompositeSinglesRating,
} from "@pkpkdupr/shared/player";
import {
  matchModeLabels,
  matchSourceLabels,
  matchTypeLabels,
  type MatchMode,
  type MatchScore,
  type MatchSource,
  type MatchStatus,
  type MatchType,
} from "@pkpkdupr/shared/match";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import AdminMatchBatchForm, {
  type AdminBatchMatchSubmitPayload,
} from "../components/AdminMatchBatchForm";

type PlayerInfo = Pick<
  Player,
  "id" | "username" | "duprRating" | "gender" | "status"
> & {
  duprMetrics: PlayerDuprMetrics;
  createdAt: string;
  updatedAt: string;
};

type PlayerGender = Player["gender"];
type PlayerStatusLogsByPlayerId = Record<string, PlayerStatusChangeLog[]>;
type PlayerCreationLogsByPlayerId = Record<string, PlayerCreationLog[]>;
type MatchPlayerInfo = Pick<
  Player,
  "id" | "username" | "gender" | "status" | "duprRating"
>;
type MatchTeamInfo = {
  id: string;
  name: string;
  players: MatchPlayerInfo[];
};
type MatchApprovalInfo = {
  playerId: string;
  approvedAt: string;
};
type MatchSessionInfo = {
  name?: string;
  date: string;
};
type MatchInfo = {
  id: string;
  type: MatchType;
  mode: MatchMode;
  source: MatchSource;
  creatorPlayerId: string;
  name?: string;
  sessionName?: string;
  session?: MatchSessionInfo;
  status: MatchStatus;
  teams: [MatchTeamInfo, MatchTeamInfo];
  scores?: MatchScore[];
  resultSubmittedByPlayerId: string | null;
  resultSubmittedAt: string | null;
  approvals: MatchApprovalInfo[];
  location?: string;
  scheduledAt: string;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
};

const toLocalDateTimeInputValue = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const genderLabelMap: Record<PlayerGender, string> = {
  M: "남",
  F: "여",
};

const statusLabelMap: Record<PlayerStatus, string> = {
  active: "활성",
  inactive: "비활성",
};

const statusBadgeClassMap: Record<PlayerStatus, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-slate-200 text-slate-700",
};

const matchStatusLabelMap: Record<MatchStatus, string> = {
  created: "예정",
  "pending-approval": "합의중",
  completed: "완료",
  cancelled: "취소",
};

const matchStatusBadgeClassMap: Record<MatchStatus, string> = {
  created: "bg-sky-100 text-sky-700",
  "pending-approval": "bg-violet-100 text-violet-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-200 text-slate-700",
};

const creationSourceLabelMap: Record<PlayerCreationSource, string> = {
  self_register: "일반 가입",
  admin_register: "관리자 생성",
  bootstrap: "초기 관리자 생성",
};

const PROTECTED_ADMIN_USERNAME =
  (import.meta.env.VITE_PROTECTED_ADMIN_USERNAME as string | undefined) ??
  "admin";
const INITIAL_ADMIN_CREATED_PASSWORD = "123qwe";

const formatDupr = (value?: number | null) =>
  typeof value === "number" ? value.toFixed(3) : "NR";

const formatConfidence = (value?: number | null) =>
  typeof value === "number" ? `${Math.round(value)}%` : "-";

const formatDuprDelta = (value?: number) => {
  if (typeof value !== "number") {
    return "-";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(3)}`;
};

const averageConfidence = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

const getCompositeSinglesConfidence = (metrics?: PlayerDuprMetrics | null) =>
  metrics
    ? averageConfidence([
        metrics.singles.standard.confidence,
        metrics.singles.unrestricted.confidence,
      ])
    : null;

const getCompositeDoublesConfidence = (metrics?: PlayerDuprMetrics | null) =>
  metrics
    ? averageConfidence([
        metrics.doubles.mixed.confidence,
        metrics.doubles.men.confidence,
        metrics.doubles.women.confidence,
        metrics.doubles.unrestricted.confidence,
      ])
    : null;

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const getScoreLabel = (scores?: MatchScore[]) => {
  if (!scores?.length) {
    return "-";
  }

  return scores.map((score) => `${score.scoreA}:${score.scoreB}`).join(" · ");
};

const getDisplayRatingForMatchType = (
  matchType: MatchType,
  duprRating?: PublicPlayerDupr | null,
) => {
  if (!duprRating) {
    return null;
  }

  switch (matchType) {
    case "singles":
      return duprRating.singles.standard;
    case "unrestricted-singles":
      return duprRating.singles.unrestricted;
    case "mixed-doubles":
      return duprRating.doubles.mixed;
    case "men-doubles":
      return duprRating.doubles.men;
    case "women-doubles":
      return duprRating.doubles.women;
    case "unrestricted-doubles":
      return duprRating.doubles.unrestricted;
    default:
      return null;
  }
};

const getTeamLabel = (team: MatchTeamInfo, matchType: MatchType) =>
  team.players
    .map((member) => {
      const displayRating = getDisplayRatingForMatchType(
        matchType,
        member.duprRating,
      );
      return `${member.username} (${formatDupr(displayRating)})`;
    })
    .join(", ") || team.name;

const normalizeDraftValue = (value: string) => value.trim();

const AdminDashboard: React.FC = () => {
  const { player, isAdmin, logout, token } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [isMatchListExpanded, setIsMatchListExpanded] = useState(true);
  const [statusLogsByPlayerId, setStatusLogsByPlayerId] =
    useState<PlayerStatusLogsByPlayerId>({});
  const [creationLogsByPlayerId, setCreationLogsByPlayerId] =
    useState<PlayerCreationLogsByPlayerId>({});
  const [genderDrafts, setGenderDrafts] = useState<Record<string, PlayerGender>>(
    {},
  );
  const [statusDrafts, setStatusDrafts] = useState<Record<string, PlayerStatus>>(
    {},
  );
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>(
    {},
  );
  const [matchNameDrafts, setMatchNameDrafts] = useState<Record<string, string>>(
    {},
  );
  const [matchSessionNameDrafts, setMatchSessionNameDrafts] = useState<
    Record<string, string>
  >({});
  const [matchSessionDateDrafts, setMatchSessionDateDrafts] = useState<
    Record<string, string>
  >({});
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const [bulkSessionName, setBulkSessionName] = useState("");
  const [bulkSessionDate, setBulkSessionDate] = useState("");
  const [savingGenderPlayerId, setSavingGenderPlayerId] = useState<string | null>(
    null,
  );
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  const [savingMatchMetadataIds, setSavingMatchMetadataIds] = useState<string[]>(
    [],
  );
  const [isSavingBulkMatchMetadata, setIsSavingBulkMatchMetadata] =
    useState(false);
  const [resettingPasswordPlayerId, setResettingPasswordPlayerId] =
    useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [officialPlayerId, setOfficialPlayerId] = useState("");
  const [officialReason, setOfficialReason] = useState("");
  const [officialRatings, setOfficialRatings] = useState({
    standardSingles: "",
    unrestrictedSingles: "",
    mixed: "",
    men: "",
    women: "",
    unrestricted: "",
  });
  const [officialConfidence, setOfficialConfidence] = useState({
    standardSingles: "",
    unrestrictedSingles: "",
    mixed: "",
    men: "",
    women: "",
    unrestricted: "",
  });
  const [officialPreview, setOfficialPreview] =
    useState<OfficialDuprAdjustmentPreview | null>(null);
  const [isPreviewingOfficialDupr, setIsPreviewingOfficialDupr] =
    useState(false);
  const [isApplyingOfficialDupr, setIsApplyingOfficialDupr] = useState(false);
  const [isRecalculatingRatings, setIsRecalculatingRatings] = useState(false);
  const [isSavingAdminMatches, setIsSavingAdminMatches] = useState(false);
  const [adminMatchFormResetKey, setAdminMatchFormResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  useEffect(() => {
    if (token && player && !isAdmin) {
      alert("관리자 권한이 필요합니다.");
      logout();
      navigate("/login");
    }
  }, [token, player, isAdmin, logout, navigate]);

  const syncGenderDrafts = (loadedPlayers: PlayerInfo[]) => {
    setGenderDrafts((prev) => {
      const next: Record<string, PlayerGender> = {};
      loadedPlayers.forEach((loadedPlayer) => {
        next[loadedPlayer.id] = prev[loadedPlayer.id] ?? loadedPlayer.gender;
      });
      return next;
    });
  };

  const syncStatusDrafts = (loadedPlayers: PlayerInfo[]) => {
    setStatusDrafts((prev) => {
      const next: Record<string, PlayerStatus> = {};
      loadedPlayers.forEach((loadedPlayer) => {
        next[loadedPlayer.id] = prev[loadedPlayer.id] ?? loadedPlayer.status;
      });
      return next;
    });
  };

  const syncMatchDrafts = (loadedMatches: MatchInfo[]) => {
    setMatchNameDrafts((prev) => {
      const next: Record<string, string> = {};
      loadedMatches.forEach((loadedMatch) => {
        next[loadedMatch.id] = prev[loadedMatch.id] ?? (loadedMatch.name ?? "");
      });
      return next;
    });
    setMatchSessionNameDrafts((prev) => {
      const next: Record<string, string> = {};
      loadedMatches.forEach((loadedMatch) => {
        next[loadedMatch.id] =
          prev[loadedMatch.id] ??
          (loadedMatch.sessionName ?? loadedMatch.session?.name ?? "");
      });
      return next;
    });
    setMatchSessionDateDrafts((prev) => {
      const next: Record<string, string> = {};
      loadedMatches.forEach((loadedMatch) => {
        next[loadedMatch.id] =
          prev[loadedMatch.id] ??
          toLocalDateTimeInputValue(loadedMatch.session?.date ?? null);
      });
      return next;
    });
    setSelectedMatchIds((prev) =>
      prev.filter((selectedMatchId) =>
        loadedMatches.some((loadedMatch) => loadedMatch.id === selectedMatchId),
      ),
    );
  };

  const loadPlayers = async () => {
    const res = await fetch("/api/admin/players", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error("회원 목록을 불러오지 못했습니다.");
    }

    const data = (await res.json()) as PlayerInfo[];
    setPlayers(data);
    syncGenderDrafts(data);
    syncStatusDrafts(data);
  };

  const loadCreationLogs = async () => {
    const res = await fetch("/api/admin/player-creation-logs", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error("계정 생성 로그를 불러오지 못했습니다.");
    }

    const data = (await res.json()) as PlayerCreationLogsByPlayerId;
    setCreationLogsByPlayerId(data);
  };

  const loadStatusLogs = async () => {
    const res = await fetch("/api/admin/player-status-logs", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error("상태 변경 로그를 불러오지 못했습니다.");
    }

    const data = (await res.json()) as PlayerStatusLogsByPlayerId;
    setStatusLogsByPlayerId(data);
  };

  const loadMatches = async () => {
    const res = await fetch("/api/admin/matches", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error("매치 목록을 불러오지 못했습니다.");
    }

    const data = (await res.json()) as MatchInfo[];
    setMatches(data);
    syncMatchDrafts(data);
  };

  const loadDashboardData = async () => {
    try {
      setError(null);
      await Promise.all([
        loadPlayers(),
        loadCreationLogs(),
        loadStatusLogs(),
        loadMatches(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    }
  };

  useEffect(() => {
    if (token && isAdmin) {
      loadDashboardData();
    }
  }, [token, isAdmin]);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: newUsername,
          password: INITIAL_ADMIN_CREATED_PASSWORD,
          gender,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "회원 추가 실패");
      }
      setSuccess(
        `${newUsername} 회원이 추가되었습니다. 초기 비밀번호는 ${INITIAL_ADMIN_CREATED_PASSWORD} 이며, 첫 로그인 시 비밀번호 변경이 필요합니다.`,
      );
      setNewUsername("");
      await loadDashboardData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    }
  };

  const handleGenderChange = async (playerId: string) => {
    const targetPlayer = players.find((item) => item.id === playerId);
    if (targetPlayer?.username === PROTECTED_ADMIN_USERNAME) {
      setError("admin 계정 성별은 변경할 수 없습니다.");
      setSuccess(null);
      return;
    }

    const nextGender = genderDrafts[playerId];
    if (!nextGender) {
      return;
    }

    try {
      setSavingGenderPlayerId(playerId);
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/admin/players/${playerId}/gender`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ gender: nextGender }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "성별 변경 실패");
      }

      const data = (await res.json()) as {
        player: PlayerInfo;
        changed: boolean;
      };

      setPlayers((prev) =>
        prev.map((item) => (item.id === data.player.id ? data.player : item)),
      );
      setGenderDrafts((prev) => ({ ...prev, [playerId]: data.player.gender }));
      setSuccess(
        data.changed
          ? `${data.player.username} 회원 성별이 ${genderLabelMap[data.player.gender]}으로 변경되었습니다.`
          : "변경된 성별이 없습니다.",
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setSavingGenderPlayerId(null);
    }
  };

  const handleStatusChange = async (playerId: string) => {
    const targetPlayer = players.find((item) => item.id === playerId);
    if (targetPlayer?.username === PROTECTED_ADMIN_USERNAME) {
      setError("admin 계정의 상태는 변경할 수 없습니다.");
      setSuccess(null);
      return;
    }

    const nextStatus = statusDrafts[playerId];
    if (!nextStatus) {
      return;
    }

    try {
      setSavingPlayerId(playerId);
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/admin/players/${playerId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "상태 변경 실패");
      }

      const data = (await res.json()) as {
        player: PlayerInfo;
        log: PlayerStatusChangeLog | null;
      };

      setPlayers((prev) =>
        prev.map((item) => (item.id === data.player.id ? data.player : item)),
      );
      setStatusDrafts((prev) => ({ ...prev, [playerId]: data.player.status }));
      const nextLog = data.log;

      if (nextLog) {
        setStatusLogsByPlayerId((prev) => ({
          ...prev,
          [playerId]: [nextLog, ...(prev[playerId] ?? [])],
        }));
        setSuccess(
          `${data.player.username} 회원 상태가 ${statusLabelMap[data.player.status]}로 변경되었습니다.`,
        );
      } else {
        setSuccess("변경된 상태가 없습니다.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setSavingPlayerId(null);
    }
  };

  const handlePasswordReset = async (playerId: string) => {
    const targetPlayer = players.find((item) => item.id === playerId);
    if (targetPlayer?.username === PROTECTED_ADMIN_USERNAME) {
      setError("admin 계정 비밀번호는 이 화면에서 초기화할 수 없습니다.");
      setSuccess(null);
      return;
    }

    const password = passwordDrafts[playerId] ?? "";
    if (password.length < 6) {
      setError("임시 비밀번호는 6자 이상이어야 합니다.");
      setSuccess(null);
      return;
    }

    try {
      setResettingPasswordPlayerId(playerId);
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/admin/players/${playerId}/password-reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "비밀번호 초기화 실패");
      }

      const data = (await res.json()) as { player: PlayerInfo };
      setPlayers((prev) =>
        prev.map((item) => (item.id === data.player.id ? data.player : item)),
      );
      setPasswordDrafts((prev) => ({ ...prev, [playerId]: "" }));
      setSuccess(
        `${data.player.username} 회원의 비밀번호가 초기화되었습니다. 임시 비밀번호로 첫 로그인 시 비밀번호 변경이 필요합니다.`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setResettingPasswordPlayerId(null);
    }
  };

  const handleRecalculateRatings = async () => {
    try {
      setIsRecalculatingRatings(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/admin/ratings/recalculate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "레이팅 재계산 실패");
      }

      const data = (await res.json()) as {
        changedPlayerCount: number;
        completedMatchCount: number;
        ratingChangeLogs: PlayerRatingChangeLog[];
      };
      await loadDashboardData();
      setSuccess(
        `레이팅 재계산이 완료되었습니다. 완료 매치 ${data.completedMatchCount}개 기준, ${data.changedPlayerCount}명 변동 (${data.ratingChangeLogs.length}건 기록).`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setIsRecalculatingRatings(false);
    }
  };

  const handleAdminMatchBatchSubmit = async (
    payload: AdminBatchMatchSubmitPayload,
  ) => {
    try {
      setIsSavingAdminMatches(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/admin/matches/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "관리자 경기 저장 실패");
      }

      const data = (await res.json()) as {
        createdCount: number;
        changedPlayerCount: number;
        completedMatchCount: number;
        ratingChangeLogs: PlayerRatingChangeLog[];
      };

      await loadDashboardData();
      setAdminMatchFormResetKey((prev) => prev + 1);
      setSuccess(
        `관리자 입력 경기 ${data.createdCount}건을 저장했습니다. 완료 매치 ${data.completedMatchCount}개 기준, ${data.changedPlayerCount}명 변동 (${data.ratingChangeLogs.length}건 기록).`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
      throw err;
    } finally {
      setIsSavingAdminMatches(false);
    }
  };

  const handleMatchMetadataSave = async (matchId: string) => {
    const targetMatch = matches.find((match) => match.id === matchId);
    if (!targetMatch) {
      return;
    }

    const nextName = normalizeDraftValue(matchNameDrafts[matchId] ?? "");
    const nextSessionName = normalizeDraftValue(
      matchSessionNameDrafts[matchId] ?? "",
    );
    const nextSessionDate = (matchSessionDateDrafts[matchId] ?? "").trim();

    const isNameChanged = nextName !== (targetMatch.name ?? "");
    const currentSessionName =
      targetMatch.sessionName ?? targetMatch.session?.name ?? "";
    const isSessionNameChanged = nextSessionName !== currentSessionName;
    const currentSessionDate = toLocalDateTimeInputValue(
      targetMatch.session?.date ?? null,
    );
    const isSessionDateChanged = nextSessionDate !== currentSessionDate;

    if (!isNameChanged && !isSessionNameChanged && !isSessionDateChanged) {
      return;
    }

    if ((nextSessionName || nextSessionDate) && !nextSessionName) {
      setError("세션이 있으면 세션명을 입력해주세요.");
      setSuccess(null);
      return;
    }

    if ((nextSessionName || nextSessionDate) && !nextSessionDate) {
      setError("세션이 있으면 세션 날짜를 입력해주세요.");
      setSuccess(null);
      return;
    }

    try {
      setSavingMatchMetadataIds((prev) =>
        prev.includes(matchId) ? prev : [...prev, matchId],
      );
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/admin/matches/${matchId}/metadata`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: nextName,
          sessionName: nextSessionName,
          sessionDate: nextSessionDate,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "매치 메타데이터 수정 실패");
      }

      const updatedMatch = (await res.json()) as MatchInfo;
      setMatches((prev) =>
        prev.map((match) => (match.id === updatedMatch.id ? updatedMatch : match)),
      );
      setMatchNameDrafts((prev) => ({
        ...prev,
        [matchId]: updatedMatch.name ?? "",
      }));
      setMatchSessionNameDrafts((prev) => ({
        ...prev,
        [matchId]:
          updatedMatch.sessionName ?? updatedMatch.session?.name ?? "",
      }));
      setMatchSessionDateDrafts((prev) => ({
        ...prev,
        [matchId]: toLocalDateTimeInputValue(updatedMatch.session?.date ?? null),
      }));
      setSuccess("매치 세션명/세션 날짜/매치명을 수정했습니다.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setSavingMatchMetadataIds((prev) =>
        prev.filter((savingMatchId) => savingMatchId !== matchId),
      );
    }
  };

  const toggleMatchSelection = (matchId: string) => {
    setSelectedMatchIds((prev) =>
      prev.includes(matchId)
        ? prev.filter((selectedMatchId) => selectedMatchId !== matchId)
        : [...prev, matchId],
    );
  };

  const handleToggleAllMatches = () => {
    setSelectedMatchIds((prev) =>
      prev.length === matches.length ? [] : matches.map((match) => match.id),
    );
  };

  const handleBulkSessionApply = async () => {
    if (selectedMatchIds.length === 0) {
      setError("세션을 일괄 반영할 매치를 먼저 선택해주세요.");
      setSuccess(null);
      return;
    }

    const nextSessionName = normalizeDraftValue(bulkSessionName);
    const nextSessionDate = bulkSessionDate.trim();

    if ((nextSessionName || nextSessionDate) && !nextSessionName) {
      setError("세션을 일괄 반영하려면 세션명을 입력해주세요.");
      setSuccess(null);
      return;
    }

    if ((nextSessionName || nextSessionDate) && !nextSessionDate) {
      setError("세션을 일괄 반영하려면 세션 날짜를 입력해주세요.");
      setSuccess(null);
      return;
    }

    const selectedMatches = matches.filter((match) =>
      selectedMatchIds.includes(match.id),
    );
    const matchesToUpdate = selectedMatches.filter((match) => {
      const currentSessionName =
        match.sessionName ?? match.session?.name ?? "";
      const currentSessionDate = toLocalDateTimeInputValue(
        match.session?.date ?? null,
      );

      return (
        currentSessionName !== nextSessionName ||
        currentSessionDate !== nextSessionDate
      );
    });

    if (matchesToUpdate.length === 0) {
      setSuccess("선택한 매치에 반영할 세션 변경이 없습니다.");
      setError(null);
      return;
    }

    try {
      setIsSavingBulkMatchMetadata(true);
      setSavingMatchMetadataIds((prev) => [
        ...new Set([...prev, ...matchesToUpdate.map((match) => match.id)]),
      ]);
      setError(null);
      setSuccess(null);

      const results = await Promise.allSettled(
        matchesToUpdate.map(async (match) => {
          const res = await fetch(`/api/admin/matches/${match.id}/metadata`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              sessionName: nextSessionName,
              sessionDate: nextSessionDate,
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "세션 일괄 반영 실패");
          }

          return (await res.json()) as MatchInfo;
        }),
      );

      const updatedMatches = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      const failedResults = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );

      if (updatedMatches.length > 0) {
        const updatedMatchesById = new Map(
          updatedMatches.map((updatedMatch) => [updatedMatch.id, updatedMatch]),
        );
        setMatches((prev) =>
          prev.map((match) => updatedMatchesById.get(match.id) ?? match),
        );
        setMatchNameDrafts((prev) => {
          const next = { ...prev };
          updatedMatches.forEach((updatedMatch) => {
            next[updatedMatch.id] = updatedMatch.name ?? "";
          });
          return next;
        });
        setMatchSessionNameDrafts((prev) => {
          const next = { ...prev };
          updatedMatches.forEach((updatedMatch) => {
            next[updatedMatch.id] =
              updatedMatch.sessionName ?? updatedMatch.session?.name ?? "";
          });
          return next;
        });
        setMatchSessionDateDrafts((prev) => {
          const next = { ...prev };
          updatedMatches.forEach((updatedMatch) => {
            next[updatedMatch.id] = toLocalDateTimeInputValue(
              updatedMatch.session?.date ?? null,
            );
          });
          return next;
        });
      }

      if (failedResults.length > 0) {
        const firstError = failedResults[0].reason;
        setError(
          firstError instanceof Error
            ? firstError.message
            : "일부 매치 세션 반영에 실패했습니다.",
        );
        setSuccess(
          updatedMatches.length > 0
            ? `선택한 ${selectedMatchIds.length}개 중 ${updatedMatches.length}개 매치에 세션을 반영했습니다.`
            : null,
        );
        return;
      }

      setSelectedMatchIds([]);
      setSuccess(
        `${updatedMatches.length}개 매치에 세션명/세션 날짜를 일괄 반영했습니다.`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
      setSuccess(null);
    } finally {
      setIsSavingBulkMatchMetadata(false);
      setSavingMatchMetadataIds((prev) =>
        prev.filter(
          (savingMatchId) =>
            !matchesToUpdate.some((match) => match.id === savingMatchId),
        ),
      );
    }
  };

  const buildOfficialDuprPayload = () => ({
    ratings: {
      singles: {
        standard: Number(officialRatings.standardSingles),
        unrestricted: Number(officialRatings.unrestrictedSingles),
      },
      doubles: {
        mixed: Number(officialRatings.mixed),
        men: Number(officialRatings.men),
        women: Number(officialRatings.women),
        unrestricted: Number(officialRatings.unrestricted),
      },
    },
    confidence: {
      singles: {
        standard: Number(officialConfidence.standardSingles),
        unrestricted: Number(officialConfidence.unrestrictedSingles),
      },
      doubles: {
        mixed: Number(officialConfidence.mixed),
        men: Number(officialConfidence.men),
        women: Number(officialConfidence.women),
        unrestricted: Number(officialConfidence.unrestricted),
      },
    },
    reason: officialReason,
  });

  const handleOfficialDuprSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setOfficialPreview(null);

    if (!officialPlayerId) {
      setError("공식 DUPR를 반영할 회원을 선택해주세요.");
      return;
    }

    try {
      setIsPreviewingOfficialDupr(true);
      const res = await fetch(
        `/api/admin/players/${officialPlayerId}/official-dupr/preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(buildOfficialDuprPayload()),
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "공식 DUPR 영향 미리보기 실패");
      }

      const data = (await res.json()) as OfficialDuprAdjustmentPreview;
      setOfficialPreview(data);
      setSuccess(
        data.impacts.length > 0
          ? `${data.impacts.length}명의 예상 점수 변동을 확인했습니다.`
          : "예상 점수 변동이 없습니다.",
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setIsPreviewingOfficialDupr(false);
    }
  };

  const handleOfficialDuprApply = async () => {
    setError(null);
    setSuccess(null);

    if (!officialPlayerId) {
      setError("공식 DUPR를 반영할 회원을 선택해주세요.");
      return;
    }

    try {
      setIsApplyingOfficialDupr(true);
      const res = await fetch(
        `/api/admin/players/${officialPlayerId}/official-dupr`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(buildOfficialDuprPayload()),
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "공식 DUPR 반영 실패");
      }

      const data = (await res.json()) as {
        player: PlayerInfo;
        ratingChangeLogs: PlayerRatingChangeLog[];
      };
      setPlayers((prev) =>
        prev.map((item) => (item.id === data.player.id ? data.player : item)),
      );
      setOfficialReason("");
      setOfficialPreview(null);
      await loadDashboardData();
      setSuccess(
        `공식 DUPR 반영 및 전체 재계산이 완료되었습니다. (${data.ratingChangeLogs.length}명 변동 기록)`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setIsApplyingOfficialDupr(false);
    }
  };

  if (!token || !isAdmin) return null;

  const genderLabel = player?.gender === "M" ? "남" : "여";
  const nowPlaying = () => new Date().toLocaleString("ko-KR");
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <header className="bg-white shadow-sm border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-600">🏓 PkpkDupr Admin</h1>
        <div className="flex gap-4 items-center">
          <span className="text-sm text-gray-600">
            {player?.username} ({genderLabel}) / 관리자
          </span>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="text-sm text-red-500 hover:text-red-700 font-medium"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[144rem] space-y-8 p-6">
        <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2 text-gray-700">
            신규 회원 추가
          </h2>

          {error && (
            <div className="bg-error/10 border border-error/20 text-error px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-2 rounded text-sm">
              {success}
            </div>
          )}

          <form
            onSubmit={handleAddPlayer}
            className="grid grid-cols-2 gap-4 items-end"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                required
                placeholder="계정명"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                초기 비밀번호
              </label>
              <div className="w-full rounded-lg border bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                {INITIAL_ADMIN_CREATED_PASSWORD}
              </div>
            </div>
            <div className="col-span-2 flex gap-6 items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="M"
                  checked={gender === "M"}
                  onChange={() => setGender("M")}
                />
                Male
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="F"
                  checked={gender === "F"}
                  onChange={() => setGender("F")}
                />
                Female
              </label>
            </div>
            <div className="col-span-2">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                회원 추가
              </button>
            </div>
          </form>
        </section>

        <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-700">
                레이팅 재계산
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                전체 완료 매치를 기준으로 모든 회원의 DUPR을 다시 계산합니다.
              </p>
            </div>
            <button
              type="button"
              disabled={isRecalculatingRatings}
              onClick={() => void handleRecalculateRatings()}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:bg-emerald-300 transition-colors"
            >
              {isRecalculatingRatings ? "재계산 중..." : "전체 레이팅 재계산"}
            </button>
          </div>
        </section>

        <AdminMatchBatchForm
          players={players}
          isSubmitting={isSavingAdminMatches}
          protectedAdminUsername={PROTECTED_ADMIN_USERNAME}
          resetKey={adminMatchFormResetKey}
          onSubmit={handleAdminMatchBatchSubmit}
        />

        <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2 text-gray-700">
            공식 DUPR 수동 반영
          </h2>
          <form
            onSubmit={handleOfficialDuprSubmit}
            className="grid grid-cols-4 gap-4 items-end"
          >
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                회원
              </label>
              <select
                required
                value={officialPlayerId}
                onChange={(e) => {
                  setOfficialPlayerId(e.target.value);
                  setOfficialPreview(null);
                }}
                className="w-full px-4 py-2 border rounded-lg bg-white"
              >
                <option value="">회원 선택</option>
                {players.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.username}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                사유
              </label>
              <input
                type="text"
                value={officialReason}
                onChange={(e) => {
                  setOfficialReason(e.target.value);
                  setOfficialPreview(null);
                }}
                placeholder="정식 DUPR 반영 사유"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            {[
              ["standardSingles", "Singles"],
              ["unrestrictedSingles", "Unrestricted Singles"],
              ["mixed", "Mixed"],
              ["men", "Men"],
              ["women", "Women"],
              ["unrestricted", "Unrestricted"],
            ].map(([key, label]) => (
              <React.Fragment key={key}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label} Rating
                  </label>
                  <input
                    type="number"
                    required
                    min={2}
                    max={8}
                    step={0.001}
                    placeholder="2.000~8.000"
                    value={officialRatings[key as keyof typeof officialRatings]}
                    onChange={(e) =>
                      setOfficialRatings((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    onInput={() => setOfficialPreview(null)}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label} Confidence (%)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={100}
                    step={1}
                    placeholder="0~100"
                    value={
                      officialConfidence[key as keyof typeof officialConfidence]
                    }
                    onChange={(e) =>
                      setOfficialConfidence((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    onInput={() => setOfficialPreview(null)}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
              </React.Fragment>
            ))}
            <div className="col-span-4 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isPreviewingOfficialDupr || isApplyingOfficialDupr}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors"
              >
                {isPreviewingOfficialDupr ? "미리보기 중..." : "영향 미리보기"}
              </button>
              {officialPreview ? (
                <button
                  type="button"
                  disabled={isApplyingOfficialDupr || isPreviewingOfficialDupr}
                  onClick={handleOfficialDuprApply}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:bg-emerald-300 transition-colors"
                >
                  {isApplyingOfficialDupr ? "반영 중..." : "확정 반영"}
                </button>
              ) : null}
            </div>
          </form>
          {officialPreview ? (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-indigo-900">
                    예상 점수 변동
                  </h3>
                  <p className="text-xs text-indigo-700">
                    {officialPreview.player.username} 공식 DUPR 기준점 반영 후
                    전체 완료 매치를 재계산한 결과입니다.
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700">
                  {officialPreview.impacts.length}명
                </span>
              </div>
              {officialPreview.impacts.length === 0 ? (
                <p className="text-sm text-gray-500">예상 변동이 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-indigo-800">
                        <th className="pb-2">회원</th>
                        <th className="pb-2">Total</th>
                        <th className="pb-2">Singles</th>
                        <th className="pb-2">U Singles</th>
                        <th className="pb-2">Mixed</th>
                        <th className="pb-2">Men</th>
                        <th className="pb-2">Women</th>
                        <th className="pb-2">Unrestricted</th>
                        <th className="pb-2">관련 매치</th>
                      </tr>
                    </thead>
                    <tbody>
                      {officialPreview.impacts.map((impact) => (
                        <tr key={impact.playerId} className="border-b last:border-0">
                          <td className="py-2 font-semibold text-gray-800">
                            {impact.username}
                          </td>
                          {[
                            ["total", impact.nextRating.total, impact.delta.total],
                            [
                              "singles",
                              impact.nextRating.singles.standard,
                              impact.delta.singles.standard,
                            ],
                            [
                              "unrestricted-singles",
                              impact.nextRating.singles.unrestricted,
                              impact.delta.singles.unrestricted,
                            ],
                            [
                              "mixed",
                              impact.nextRating.doubles.mixed,
                              impact.delta.doubles.mixed,
                            ],
                            [
                              "men",
                              impact.nextRating.doubles.men,
                              impact.delta.doubles.men,
                            ],
                            [
                              "women",
                              impact.nextRating.doubles.women,
                              impact.delta.doubles.women,
                            ],
                            [
                              "unrestricted",
                              impact.nextRating.doubles.unrestricted,
                              impact.delta.doubles.unrestricted,
                            ],
                          ].map(([key, nextValue, deltaValue]) => (
                            <td key={key} className="py-2">
                              <span className="font-medium text-gray-800">
                                {formatDupr(nextValue as number)}
                              </span>
                              <span
                                className={`ml-1 ${
                                  (deltaValue as number) > 0
                                    ? "text-emerald-600"
                                    : (deltaValue as number) < 0
                                      ? "text-red-500"
                                      : "text-gray-400"
                                }`}
                              >
                                ({formatDuprDelta(deltaValue as number)})
                              </span>
                            </td>
                          ))}
                          <td className="py-2 text-gray-600">
                            {impact.relatedMatchCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </section>

        <section className="bg-white rounded-xl shadow-sm mt-2 p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-lg font-semibold text-gray-700">
              매치 목록 ({matches.length})
            </h2>
            <button
              type="button"
              onClick={() => setIsMatchListExpanded((prev) => !prev)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {isMatchListExpanded ? "접기" : "펼치기"}
            </button>
          </div>

          {!isMatchListExpanded ? null : matches.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              등록된 매치가 없습니다.
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      일괄 세션명
                    </label>
                    <input
                      type="text"
                      value={bulkSessionName}
                      onChange={(e) => setBulkSessionName(e.target.value)}
                      placeholder="예: 수요일 저녁 세션"
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      일괄 세션 날짜
                    </label>
                    <input
                      type="datetime-local"
                      value={bulkSessionDate}
                      onChange={(e) => setBulkSessionDate(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleAllMatches}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white"
                    >
                      {selectedMatchIds.length === matches.length
                        ? "전체 선택 해제"
                        : "전체 선택"}
                    </button>
                    <button
                      type="button"
                      disabled={
                        isSavingBulkMatchMetadata || selectedMatchIds.length === 0
                      }
                      onClick={() => void handleBulkSessionApply()}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white disabled:bg-slate-300"
                    >
                      {isSavingBulkMatchMetadata
                        ? "일괄 반영 중..."
                        : `선택 ${selectedMatchIds.length}개 일괄 반영`}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  수정할 매치를 선택한 뒤 같은 세션명/세션 날짜를 한 번에 반영할 수 있습니다.
                  두 값을 모두 비우고 반영하면 선택한 매치의 세션 정보가 제거됩니다.
                </p>
              </div>

              <div className="overflow-x-auto">
              <table className="w-full min-w-[1600px] table-auto text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="px-4 pb-3 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={
                          matches.length > 0 &&
                          selectedMatchIds.length === matches.length
                        }
                        onChange={handleToggleAllMatches}
                        aria-label="전체 매치 선택"
                      />
                    </th>
                    <th className="px-4 pb-3 whitespace-nowrap">일시</th>
                    <th className="px-4 pb-3 whitespace-nowrap">세션명</th>
                    <th className="px-4 pb-3 whitespace-nowrap">세션 날짜</th>
                    <th className="px-4 pb-3 whitespace-nowrap">매치명</th>
                    <th className="px-4 pb-3 whitespace-nowrap">타입</th>
                    <th className="px-4 pb-3 whitespace-nowrap">모드</th>
                    <th className="px-4 pb-3 whitespace-nowrap">상태</th>
                    <th className="px-4 pb-3 whitespace-nowrap">생성 방식</th>
                    <th className="px-4 pb-3 whitespace-nowrap">참가자</th>
                    <th className="px-4 pb-3 whitespace-nowrap">스코어</th>
                    <th className="px-4 pb-3 whitespace-nowrap">수정</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((match) => {
                    const draftMatchName = matchNameDrafts[match.id] ?? match.name ?? "";
                    const draftSessionName =
                      matchSessionNameDrafts[match.id] ??
                      match.sessionName ??
                      match.session?.name ??
                      "";
                    const draftSessionDate =
                      matchSessionDateDrafts[match.id] ??
                      toLocalDateTimeInputValue(match.session?.date ?? null);
                    const normalizedDraftMatchName =
                      normalizeDraftValue(draftMatchName);
                    const normalizedDraftSessionName =
                      normalizeDraftValue(draftSessionName);
                    const isMatchNameDirty =
                      normalizedDraftMatchName !== (match.name ?? "");
                    const isSessionNameDirty =
                      normalizedDraftSessionName !==
                      (match.sessionName ?? match.session?.name ?? "");
                    const isSessionDateDirty =
                      draftSessionDate !==
                      toLocalDateTimeInputValue(match.session?.date ?? null);
                    const isSavingMatchMetadata =
                      savingMatchMetadataIds.includes(match.id);

                    return (
                      <tr
                        key={match.id}
                        className="border-b align-top hover:bg-gray-50"
                      >
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedMatchIds.includes(match.id)}
                            onChange={() => toggleMatchSelection(match.id)}
                            aria-label={`${match.name ?? match.id} 선택`}
                          />
                        </td>
                        <td className="px-4 py-4 min-w-[130px] text-xs text-gray-600">
                          <div className="space-y-1">
                            <div>{formatDateTime(match.scheduledAt)}</div>
                            {match.session?.date ? (
                              <div className="text-slate-400">
                                세션 날짜: {formatDateTime(match.session.date)}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4 min-w-[180px]">
                          <input
                            type="text"
                            value={draftSessionName}
                            onChange={(e) =>
                              setMatchSessionNameDrafts((prev) => ({
                                ...prev,
                                [match.id]: e.target.value,
                              }))
                            }
                            placeholder="세션명"
                            className="w-full rounded-lg border px-3 py-2"
                          />
                        </td>
                        <td className="px-4 py-4 min-w-[220px]">
                          <input
                            type="datetime-local"
                            value={draftSessionDate}
                            onChange={(e) =>
                              setMatchSessionDateDrafts((prev) => ({
                                ...prev,
                                [match.id]: e.target.value,
                              }))
                            }
                            placeholder="2026-07-09T18:30"
                            className="w-full rounded-lg border px-3 py-2"
                          />
                        </td>
                        <td className="px-4 py-4 min-w-[180px]">
                          <input
                            type="text"
                            value={draftMatchName}
                            onChange={(e) =>
                              setMatchNameDrafts((prev) => ({
                                ...prev,
                                [match.id]: e.target.value,
                              }))
                            }
                            placeholder="매치명"
                            className="w-full rounded-lg border px-3 py-2"
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-700">
                          {matchTypeLabels[match.type]}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-700">
                          {matchModeLabels[match.mode]}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${matchStatusBadgeClassMap[match.status]}`}
                          >
                            {matchStatusLabelMap[match.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-700">
                          {matchSourceLabels[match.source]}
                        </td>
                        <td className="px-4 py-4 min-w-[280px] text-xs text-gray-600">
                          <div className="space-y-1 leading-5">
                            <div>
                              <span className="font-medium text-gray-700">A</span>
                              <span className="mx-1">·</span>
                              <span>{getTeamLabel(match.teams[0], match.type)}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">B</span>
                              <span className="mx-1">·</span>
                              <span>{getTeamLabel(match.teams[1], match.type)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-700">
                          {getScoreLabel(match.scores)}
                        </td>
                        <td className="px-4 py-4 min-w-[120px]">
                          <button
                            type="button"
                            disabled={
                              isSavingMatchMetadata ||
                              (!isMatchNameDirty &&
                                !isSessionNameDirty &&
                                !isSessionDateDirty)
                            }
                            onClick={() => void handleMatchMetadataSave(match.id)}
                            className="rounded-lg bg-slate-800 px-3 py-2 text-white disabled:bg-slate-300"
                          >
                            {isSavingMatchMetadata ? "저장 중..." : "저장"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </>
          )}
        </section>

        <section className="bg-white rounded-xl shadow-sm mt-2 p-6 space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2 text-gray-700">
            회원 목록 ({players.length})
          </h2>

          {players.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              등록된 회원이 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1360px] table-auto text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="px-4 pb-3 whitespace-nowrap">Username</th>
                    <th className="px-4 pb-3 whitespace-nowrap">DUPR</th>
                    <th className="px-4 pb-3 whitespace-nowrap">Confidence</th>
                    <th className="px-4 pb-3 whitespace-nowrap">성별</th>
                    <th className="px-4 pb-3 whitespace-nowrap">현재 상태</th>
                    <th className="px-4 pb-3 whitespace-nowrap">상태 변경</th>
                    <th className="px-4 pb-3 whitespace-nowrap">
                      비밀번호 초기화
                    </th>
                    <th className="px-4 pb-3 whitespace-nowrap">생성 로그</th>
                    <th className="px-4 pb-3 whitespace-nowrap">상태 로그</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => {
                    const creationLogs = creationLogsByPlayerId[p.id] ?? [];
                    const statusLogs = statusLogsByPlayerId[p.id] ?? [];
                    const latestCreationLog = creationLogs[0];
                    const draftGender = genderDrafts[p.id] ?? p.gender;
                    const draftStatus = statusDrafts[p.id] ?? p.status;
                    const isSavingGender = savingGenderPlayerId === p.id;
                    const isSaving = savingPlayerId === p.id;
                    const isResettingPassword = resettingPasswordPlayerId === p.id;
                    const passwordDraft = passwordDrafts[p.id] ?? "";
                    const isGenderDirty = draftGender !== p.gender;
                    const isDirty = draftStatus !== p.status;
                    const isProtectedAdminAccount =
                      p.username === PROTECTED_ADMIN_USERNAME;
                    const singlesRating = getCompositeSinglesRating(p.duprRating);
                    const doublesRating = getCompositeDoublesRating(p.duprRating);
                    const singlesConfidence = p.duprRating
                      ? getCompositeSinglesConfidence(p.duprMetrics)
                      : null;
                    const doublesConfidence = p.duprRating
                      ? getCompositeDoublesConfidence(p.duprMetrics)
                      : null;

                    return (
                      <tr key={p.id} className="border-b align-top hover:bg-gray-50">
                        <td className="px-4 py-4 font-medium whitespace-nowrap">
                          {p.username}
                        </td>
                        <td className="px-4 py-4 min-w-[120px] text-blue-600">
                          <div className="space-y-1 text-xs">
                            <div>S {formatDupr(singlesRating)}</div>
                            <div>D {formatDupr(doublesRating)}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 min-w-[120px] text-slate-600">
                          <div className="space-y-1 text-xs">
                            <div>S {formatConfidence(singlesConfidence)}</div>
                            <div>D {formatConfidence(doublesConfidence)}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 min-w-[220px]">
                          <div className="flex items-center gap-2">
                            <select
                              value={draftGender}
                              disabled={isProtectedAdminAccount}
                              onChange={(e) =>
                                setGenderDrafts((prev) => ({
                                  ...prev,
                                  [p.id]: e.target.value as PlayerGender,
                                }))
                              }
                              className="border rounded-lg px-3 py-2 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <option value="M">남</option>
                              <option value="F">여</option>
                            </select>
                            <button
                              type="button"
                              disabled={
                                isProtectedAdminAccount ||
                                !isGenderDirty ||
                                isSavingGender
                              }
                              onClick={() => void handleGenderChange(p.id)}
                              className="px-3 py-2 rounded-lg bg-slate-800 text-white disabled:bg-slate-300"
                            >
                              {isSavingGender ? "저장 중..." : "저장"}
                            </button>
                            {isProtectedAdminAccount ? (
                              <span className="text-xs text-slate-500">
                                admin 계정은 변경 불가
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            현재: {genderLabelMap[p.gender]}
                          </p>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClassMap[p.status]}`}
                          >
                            {statusLabelMap[p.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4 min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <select
                              value={draftStatus}
                              disabled={isProtectedAdminAccount}
                              onChange={(e) =>
                                setStatusDrafts((prev) => ({
                                  ...prev,
                                  [p.id]: e.target.value as PlayerStatus,
                                }))
                              }
                              className="border rounded-lg px-3 py-2 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <option value="active">active</option>
                              <option value="inactive">inactive</option>
                            </select>
                            <button
                              type="button"
                              disabled={
                                isProtectedAdminAccount || !isDirty || isSaving
                              }
                              onClick={() => handleStatusChange(p.id)}
                              className="px-3 py-2 rounded-lg bg-slate-800 text-white disabled:bg-slate-300"
                            >
                              {isSaving ? "저장 중..." : "저장"}
                            </button>
                            {isProtectedAdminAccount ? (
                              <span className="text-xs text-slate-500">
                                admin 계정은 변경 불가
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4 min-w-[280px]">
                          <div className="flex items-center gap-2">
                            <input
                              type="password"
                              minLength={6}
                              placeholder="임시 비밀번호"
                              value={passwordDraft}
                              disabled={isProtectedAdminAccount}
                              onChange={(e) =>
                                setPasswordDrafts((prev) => ({
                                  ...prev,
                                  [p.id]: e.target.value,
                                }))
                              }
                              className="w-32 border rounded-lg px-3 py-2 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                            />
                            <button
                              type="button"
                              disabled={
                                isProtectedAdminAccount ||
                                isResettingPassword ||
                                passwordDraft.length < 6
                              }
                              onClick={() => void handlePasswordReset(p.id)}
                              className="px-3 py-2 rounded-lg bg-orange-600 text-white disabled:bg-slate-300"
                            >
                              {isResettingPassword ? "초기화 중..." : "초기화"}
                            </button>
                          </div>
                          {isProtectedAdminAccount ? (
                            <p className="mt-1 text-xs text-slate-500">
                              admin 계정은 변경 불가
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-gray-400">
                              초기화 후 첫 로그인 상태가 됩니다.
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4 min-w-[240px] text-xs text-gray-600">
                          {!latestCreationLog ? (
                            <span className="text-gray-400">로그 없음</span>
                          ) : (
                            <div className="space-y-1.5 leading-5">
                              <div className="font-medium text-gray-700">
                                {creationSourceLabelMap[latestCreationLog.creationSource]}
                              </div>
                              <div>
                                생성자: {latestCreationLog.createdByUsername}
                              </div>
                              <div>
                                {new Date(latestCreationLog.createdAt).toLocaleString("ko-KR")}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 min-w-[300px] text-xs text-gray-600">
                          {statusLogs.length === 0 ? (
                            <span className="text-gray-400">로그 없음</span>
                          ) : (
                            <ul className="space-y-1.5">
                              {statusLogs.slice(0, 3).map((log) => (
                                <li key={log.id} className="leading-5">
                                  <span className="font-medium text-gray-700">
                                    {statusLabelMap[log.previousStatus]}
                                  </span>
                                  <span className="mx-1">→</span>
                                  <span className="font-medium text-gray-700">
                                    {statusLabelMap[log.nextStatus]}
                                  </span>
                                  <span className="mx-1">·</span>
                                  <span>{log.changedByUsername}</span>
                                  <span className="mx-1">·</span>
                                  <span>
                                    {new Date(log.changedAt).toLocaleString("ko-KR")}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="text-center text-xs text-gray-400">
          Last checked: {nowPlaying()}
        </footer>
      </main>
    </div>
  );
};

export default AdminDashboard;
