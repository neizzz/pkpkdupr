import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import {
  CLUB_DESCRIPTION_MAX_LENGTH,
  getUnicodeCodePointLength,
  truncateToUnicodeCodePoints,
  type Club,
  ClubDashboard,
  ClubInvite,
  ClubMembership,
  ClubRankingEntry,
} from "@pkpkdupr/shared/club";
import type {
  Match as SharedMatch,
  ManagedMatchSession,
} from "@pkpkdupr/shared/match";
import { PiRankingLight } from "react-icons/pi";
import { TbAffiliate } from "react-icons/tb";
import {
  IoCalendarOutline,
  IoChevronForward,
  IoMegaphoneOutline,
  IoPeopleOutline,
  IoPeople,
  IoPerson,
  IoPersonAddOutline,
  IoQrCodeOutline,
  IoRefreshOutline,
  IoScanOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import QrCode from "react-qr-code";
import BottomSheet from "@/components/BottomSheet";
import ClubQrScannerSheetBody from "@/components/ClubQrScannerSheetBody";
import DetailPageHeader from "@/components/DetailPageHeader";
import HeaderFilterTabs from "@/components/HeaderFilterTabs";
import MatchCard, {
  type MatchInfo,
  type MatchListResponse,
  type MatchSessionSummaryInfo,
} from "@/components/Match";
import ProfileMatchDetailDrawer from "@/components/ProfileMatchDetailDrawer";
import RightDrawer from "@/components/RightDrawer";
import SessionDetail from "@/components/SessionDetail";
import TabPanelHeader from "@/components/TabPanelHeader";
import TabPanelEmptyState from "@/components/TabPanelEmptyState";
import TabPanelStatus from "@/components/TabPanelStatus";
import { useAuth } from "@/context/AuthContext";
import { useTabNavigation } from "@/context/TabNavigationContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { buildApiUrl } from "@/lib/api";

type ClubListItem = { club: Club; membership: ClubMembership };
type ScannerTarget = "invite" | "player" | null;
type RankingCategory = "singles" | "doubles";

const noop = () => {};
const CLUB_MATCH_HISTORY_PAGE_SIZE = 20;

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const formatDateTime = (value: Date | string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "일정 미정"
    : dateTimeFormatter.format(date);
};

const getMatchName = (match: SharedMatch) =>
  match.name ||
  match.teams
    .flatMap((team) => team.players.map((player) => player.username))
    .join(" · ");

const SectionTitle: React.FC<{
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}> = ({ icon, title, action }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex min-w-0 items-center gap-2">
      {icon ? <span className="text-pkpk-primary-bg">{icon}</span> : null}
      <h3 className="text-base font-bold text-pkpk-main-font">{title}</h3>
    </div>
    {action}
  </div>
);

const Affiliations: React.FC = () => {
  const { token, player } = useAuth();
  const isOnline = useOnlineStatus();
  const {
    depthStacks,
    pushDepth,
    registerPullToRefresh,
    registerScrollContainer,
    restoreScrollTop,
    saveScrollPosition,
    scrollToTop,
    selectedTab,
  } = useTabNavigation();
  const [clubs, setClubs] = useState<ClubListItem[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<ClubDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [clubName, setClubName] = useState("");
  const [clubDescription, setClubDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<ScannerTarget>(null);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [rankingCategory, setRankingCategory] =
    useState<RankingCategory>("doubles");
  const [managementError, setManagementError] = useState<string | null>(null);
  const [invite, setInvite] = useState<ClubInvite | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [sessionLocation, setSessionLocation] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [selectedSession, setSelectedSession] =
    useState<MatchSessionSummaryInfo | null>(null);
  const [selectedSessionMatches, setSelectedSessionMatches] = useState<
    MatchInfo[]
  >([]);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchInfo | null>(null);
  const [clubMatchHistoryClub, setClubMatchHistoryClub] = useState<
    Pick<Club, "id" | "name"> | null
  >(null);
  const [clubMatchHistoryMatches, setClubMatchHistoryMatches] = useState<
    MatchInfo[]
  >([]);
  const [isClubMatchHistoryLoading, setIsClubMatchHistoryLoading] =
    useState(false);
  const [clubMatchHistoryError, setClubMatchHistoryError] = useState<
    string | null
  >(null);
  const [clubMatchHistoryPage, setClubMatchHistoryPage] = useState(0);
  const [clubMatchHistoryTotal, setClubMatchHistoryTotal] = useState(0);

  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      if (!token) throw new Error("로그인이 필요합니다.");
      if (!isOnline) throw new Error("온라인 연결이 필요합니다.");
      const res = await fetch(buildApiUrl(path), {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(options.headers ?? {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "요청을 처리하지 못했어요.");
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    },
    [isOnline, token],
  );

  const loadClubs = useCallback(
    async (preferredClubId?: string) => {
      if (!token) return;
      setIsLoading(true);
      setError(null);
      try {
        const nextClubs = await request<ClubListItem[]>("/api/clubs");
        setClubs(nextClubs);
        const activeClubs = nextClubs.filter(
          (item) => item.membership.status === "active",
        );
        setSelectedClubId((current) => {
          if (preferredClubId && activeClubs.some((item) => item.club.id === preferredClubId)) {
            return preferredClubId;
          }
          if (current && activeClubs.some((item) => item.club.id === current)) {
            return current;
          }
          return activeClubs[0]?.club.id ?? null;
        });
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "클럽을 불러오지 못했어요.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [request, token],
  );

  const loadDashboard = useCallback(async () => {
    if (!selectedClubId || !token) {
      setDashboard(null);
      return;
    }
    setIsDashboardLoading(true);
    setError(null);
    try {
      setDashboard(
        await request<ClubDashboard>(
          `/api/clubs/${encodeURIComponent(selectedClubId)}/dashboard`,
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "클럽 정보를 불러오지 못했어요.",
      );
    } finally {
      setIsDashboardLoading(false);
    }
  }, [request, selectedClubId, token]);

  useEffect(() => {
    void loadClubs();
  }, [loadClubs]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(
    () =>
      registerPullToRefresh("affiliations", async () => {
        await loadClubs(selectedClubId ?? undefined);
        await loadDashboard();
      }),
    [loadClubs, loadDashboard, registerPullToRefresh, selectedClubId],
  );

  const activeClubs = useMemo(
    () => clubs.filter((item) => item.membership.status === "active"),
    [clubs],
  );
  const pendingClubs = useMemo(
    () => clubs.filter((item) => item.membership.status === "pending"),
    [clubs],
  );
  const isManager =
    dashboard?.membership.role === "owner" ||
    dashboard?.membership.role === "manager";
  const isOwner = dashboard?.membership.role === "owner";

  const createClub = async () => {
    const name = clubName.trim();
    const description = clubDescription.trim();
    if (!name) return;
    setIsCreating(true);
    setError(null);
    try {
      const created = await request<Club>("/api/clubs", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      });
      setClubName("");
      setClubDescription("");
      setIsCreateOpen(false);
      await loadClubs(created.id);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "클럽을 만들지 못했어요.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleInviteScan = useCallback(
    async (payload: string) => {
      await request("/api/club-invites/join-requests", {
        method: "POST",
        body: JSON.stringify({ payload }),
      });
      await loadClubs();
    },
    [loadClubs, request],
  );

  const handlePlayerScan = useCallback(
    async (payload: string) => {
      if (!selectedClubId) throw new Error("클럽을 선택해주세요.");
      await request(
        `/api/clubs/${encodeURIComponent(selectedClubId)}/player-qr-members`,
        { method: "POST", body: JSON.stringify({ payload }) },
      );
      await loadDashboard();
    },
    [loadDashboard, request, selectedClubId],
  );

  const loadInvite = useCallback(async () => {
    if (!selectedClubId || !isManager) return;
    try {
      setInvite(
        await request<ClubInvite>(
          `/api/clubs/${encodeURIComponent(selectedClubId)}/invite`,
        ),
      );
    } catch (inviteError) {
      setManagementError(
        inviteError instanceof Error
          ? inviteError.message
          : "클럽 QR을 불러오지 못했어요.",
      );
    }
  }, [isManager, request, selectedClubId]);

  useEffect(() => {
    if (isManagementOpen) void loadInvite();
  }, [isManagementOpen, loadInvite]);

  const reloadManagement = async () => {
    setManagementError(null);
    await Promise.all([loadDashboard(), loadClubs(selectedClubId ?? undefined)]);
  };

  const runManagementAction = async (action: () => Promise<void>) => {
    try {
      setManagementError(null);
      await action();
      await reloadManagement();
    } catch (actionError) {
      setManagementError(
        actionError instanceof Error
          ? actionError.message
          : "관리 작업을 처리하지 못했어요.",
      );
    }
  };

  const createAnnouncement = async () => {
    if (!selectedClubId || !announcementTitle.trim() || !announcementBody.trim()) {
      return;
    }
    await runManagementAction(async () => {
      await request(`/api/clubs/${encodeURIComponent(selectedClubId)}/announcements`, {
        method: "POST",
        body: JSON.stringify({ title: announcementTitle, body: announcementBody }),
      });
      setAnnouncementTitle("");
      setAnnouncementBody("");
    });
  };

  const createSession = async () => {
    if (!selectedClubId || !sessionName.trim() || !sessionLocation.trim() || !sessionDate) {
      return;
    }
    await runManagementAction(async () => {
      await request(`/api/clubs/${encodeURIComponent(selectedClubId)}/sessions`, {
        method: "POST",
        body: JSON.stringify({
          name: sessionName,
          location: sessionLocation,
          date: new Date(sessionDate).toISOString(),
        }),
      });
      setSessionName("");
      setSessionLocation("");
      setSessionDate("");
    });
  };

  const selectClub = (clubId: string) => {
    if (clubId === selectedClubId) return;
    setDashboard(null);
    setSelectedClubId(clubId);
  };

  const loadSessionMatches = useCallback(
    async (session: MatchSessionSummaryInfo) => {
      setIsLoadingSession(true);
      setSessionError(null);
      try {
        setSelectedSessionMatches(
          await request<MatchInfo[]>(
            `/api/match-sessions/${encodeURIComponent(session.id)}/matches`,
          ),
        );
      } catch (loadError) {
        setSessionError(
          loadError instanceof Error
            ? loadError.message
            : "세션 매치를 불러오지 못했어요.",
        );
      } finally {
        setIsLoadingSession(false);
      }
    },
    [request],
  );

  const loadClubMatchHistory = useCallback(
    async (clubId: string, page: number, append = false) => {
      setIsClubMatchHistoryLoading(true);
      setClubMatchHistoryError(null);
      try {
        const searchParams = new URLSearchParams({
          page: String(page),
          limit: String(CLUB_MATCH_HISTORY_PAGE_SIZE),
        });
        const data = await request<MatchListResponse>(
          `/api/clubs/${encodeURIComponent(clubId)}/matches?${searchParams.toString()}`,
        );
        setClubMatchHistoryMatches((current) => {
          if (!append) return data.matches;
          const currentIds = new Set(current.map((match) => match.id));
          return [
            ...current,
            ...data.matches.filter((match) => !currentIds.has(match.id)),
          ];
        });
        setClubMatchHistoryPage(page + 1);
        setClubMatchHistoryTotal(data.total);
      } catch (loadError) {
        setClubMatchHistoryError(
          loadError instanceof Error
            ? loadError.message
            : "소속 매치를 불러오지 못했어요.",
        );
      } finally {
        setIsClubMatchHistoryLoading(false);
      }
    },
    [request],
  );

  const openMatchDetail = useCallback(
    (match: MatchInfo) => {
      saveScrollPosition("affiliations");
      pushDepth("affiliations", {
        id: `club-match-detail:${match.id}`,
        kind: "match-detail",
        onClose: noop,
      });
      setSelectedMatch(match);
      window.requestAnimationFrame(() => scrollToTop("auto"));
    },
    [pushDepth, saveScrollPosition, scrollToTop],
  );

  const openClubMatchHistory = useCallback(() => {
    if (!dashboard) return;

    const historyClub = {
      id: dashboard.club.id,
      name: dashboard.club.name,
    };
    saveScrollPosition("affiliations");
    pushDepth("affiliations", {
      id: `club-match-history:${historyClub.id}`,
      kind: "match-history",
      onClose: noop,
    });
    setClubMatchHistoryClub(historyClub);
    setClubMatchHistoryMatches([]);
    setClubMatchHistoryError(null);
    setClubMatchHistoryPage(0);
    setClubMatchHistoryTotal(0);
    window.requestAnimationFrame(() => scrollToTop("auto"));
    void loadClubMatchHistory(historyClub.id, 0);
  }, [dashboard, loadClubMatchHistory, pushDepth, saveScrollPosition, scrollToTop]);

  const openSessionDetail = useCallback(
    (session: ManagedMatchSession) => {
      if (!dashboard) return;

      const sessionDetail: MatchSessionSummaryInfo = {
        id: session.id,
        name: session.name,
        date: new Date(session.date).toISOString(),
        location: session.location,
        clubId: session.clubId,
        affiliationNames: session.affiliationNames,
        status: "created",
        matchCount: session.matchCount,
        participants: dashboard.members
          .filter((member) => session.participantIds.includes(member.id))
          .map((member) => ({
            id: member.id,
            username: member.username,
            avatarUrl: member.avatarUrl,
          })),
        latestCreatedAt: new Date(session.updatedAt).toISOString(),
      };

      saveScrollPosition("affiliations");
      pushDepth("affiliations", {
        id: `club-session-detail:${session.id}`,
        kind: "session-detail",
        onClose: noop,
      });
      setSelectedSession(sessionDetail);
      setSelectedSessionMatches([]);
      setSessionError(null);
      window.requestAnimationFrame(() => scrollToTop("auto"));
      void loadSessionMatches(sessionDetail);
    },
    [dashboard, loadSessionMatches, pushDepth, saveScrollPosition, scrollToTop],
  );

  const completeSessionDetailClose = useCallback(() => {
    setSelectedSession(null);
    setSelectedSessionMatches([]);
    setSessionError(null);
    restoreScrollTop("affiliations");
  }, [restoreScrollTop]);

  const completeMatchDetailClose = useCallback(() => {
    setSelectedMatch(null);
    restoreScrollTop("affiliations");
  }, [restoreScrollTop]);

  const completeClubMatchHistoryClose = useCallback(() => {
    setClubMatchHistoryClub(null);
    setClubMatchHistoryMatches([]);
    setClubMatchHistoryError(null);
    setClubMatchHistoryPage(0);
    setClubMatchHistoryTotal(0);
    restoreScrollTop("affiliations");
  }, [restoreScrollTop]);

  const sessionDepthId = selectedSession
    ? `club-session-detail:${selectedSession.id}`
    : null;
  const matchDepthId = selectedMatch
    ? `club-match-detail:${selectedMatch.id}`
    : null;
  const clubMatchHistoryDepthId = clubMatchHistoryClub
    ? `club-match-history:${clubMatchHistoryClub.id}`
    : null;
  const isSessionDrawerOpen =
    !!sessionDepthId && depthStacks.affiliations.includes(sessionDepthId);
  const isMatchDrawerOpen =
    !!matchDepthId && depthStacks.affiliations.includes(matchDepthId);
  const isClubMatchHistoryDrawerOpen =
    !!clubMatchHistoryDepthId &&
    depthStacks.affiliations.includes(clubMatchHistoryDepthId);

  const registerSessionScrollContainer = useCallback(
    (element: HTMLDivElement | null) => {
      if (!sessionDepthId) return;
      registerScrollContainer("affiliations", sessionDepthId, element);
    },
    [registerScrollContainer, sessionDepthId],
  );

  const registerMatchScrollContainer = useCallback(
    (element: HTMLDivElement | null) => {
      if (!matchDepthId) return;
      registerScrollContainer("affiliations", matchDepthId, element);
    },
    [matchDepthId, registerScrollContainer],
  );

  const registerClubMatchHistoryScrollContainer = useCallback(
    (element: HTMLDivElement | null) => {
      if (!clubMatchHistoryDepthId) return;
      registerScrollContainer("affiliations", clubMatchHistoryDepthId, element);
    },
    [clubMatchHistoryDepthId, registerScrollContainer],
  );

  const renderSchedule = () => {
    if (!dashboard) return null;
    const sessions = dashboard.upcomingSessions.slice(0, 2);
    const standaloneMatches = dashboard.upcomingMatches
      .filter((match) => !match.session)
      .slice(0, 2);
    if (!sessions.length && !standaloneMatches.length) {
      return (
        <p className="rounded-2xl border border-dashed border-border bg-white px-4 py-5 text-center text-sm text-pkpk-sub-font">
          예정된 매치와 세션이 없어요.
        </p>
      );
    }
    return (
      <div className="space-y-2">
        {sessions.map((session: ManagedMatchSession) => (
          <button
            key={session.id}
            type="button"
            onClick={() => openSessionDetail(session)}
            className="flex items-center gap-3 rounded-2xl border border-border bg-white px-3 py-3"
          >
            <div className="rounded-xl bg-pkpk-session-bg px-2 py-1.5 text-center text-xs font-bold text-pkpk-primary-bg">
              {formatDateTime(session.date).split(" ").slice(0, 2).join(" ")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-pkpk-main-font">
                {session.name}
              </p>
              <p className="mt-0.5 truncate text-xs text-pkpk-sub-font">
                {formatDateTime(session.date)} · {session.location}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-pkpk-accent-bg px-2 py-1 text-[11px] font-bold text-pkpk-dark">
              세션
            </span>
            <IoChevronForward className="size-4 shrink-0 text-pkpk-sub-font" />
          </button>
        ))}
        {standaloneMatches.map((match) => (
          <button
            key={match.id}
            type="button"
            onClick={() => openMatchDetail(match as unknown as MatchInfo)}
            className="flex items-center gap-3 rounded-2xl border border-border bg-white px-3 py-3"
          >
            <div className="rounded-xl bg-pkpk-session-bg px-2 py-1.5 text-center text-xs font-bold text-pkpk-primary-bg">
              매치
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-pkpk-main-font">
                {getMatchName(match)}
              </p>
              <p className="mt-0.5 truncate text-xs text-pkpk-sub-font">
                {formatDateTime(match.matchStartsAt)} · {match.location}
              </p>
            </div>
            <IoChevronForward className="size-4 shrink-0 text-pkpk-sub-font" />
          </button>
        ))}
      </div>
    );
  };

  const renderRecentCompletedMatches = () => {
    if (!dashboard) return null;
    if (!dashboard.recentCompletedMatches.length) {
      return (
        <p className="rounded-2xl border border-dashed border-border bg-white px-4 py-5 text-center text-sm text-pkpk-sub-font">
          최근에 끝난 매치가 없어요.
        </p>
      );
    }
    return (
      <div className="space-y-2">
        {dashboard.recentCompletedMatches.map((match) => (
          <button
            key={match.id}
            type="button"
            onClick={() => openMatchDetail(match as unknown as MatchInfo)}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white px-3 py-3 text-left"
          >
            <div className="rounded-xl bg-pkpk-session-bg px-2 py-1.5 text-center text-xs font-bold text-pkpk-primary-bg">
              완료
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-pkpk-main-font">
                {getMatchName(match)}
              </p>
              <p className="mt-0.5 truncate text-xs text-pkpk-sub-font">
                {formatDateTime(match.completedAt ?? match.matchStartsAt)} · {match.location}
              </p>
            </div>
            <IoChevronForward className="size-4 shrink-0 text-pkpk-sub-font" />
          </button>
        ))}
      </div>
    );
  };

  const renderRankings = (entries: ClubRankingEntry[]) => {
    if (!entries.length) {
      return (
        <p className="rounded-2xl border border-dashed border-border bg-white px-4 py-5 text-center text-sm text-pkpk-sub-font">
          랭킹을 표시할 멤버가 없어요.
        </p>
      );
    }
    return (
      <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
        {entries.slice(0, 5).map((entry) => (
          <li key={entry.playerId} className="flex items-center gap-3 px-4 py-3">
            <span
              className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                entry.rank === 1
                  ? "bg-pkpk-accent-bg text-pkpk-dark"
                  : "bg-pkpk-session-bg text-pkpk-sub-font"
              }`}
            >
              {entry.rank}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-pkpk-main-font">
              {entry.username}
            </span>
            <span className="text-sm font-bold text-pkpk-primary-bg">
              {entry.rating.toFixed(2)}
            </span>
          </li>
        ))}
      </ol>
    );
  };

  return (
    <div className="flex h-full min-h-full flex-col">
      <TabPanelHeader
        title="Clubs"
        footer={
          activeClubs.length ? (
            <HeaderFilterTabs
              ariaLabel="클럽 범위"
              selectedId={selectedClubId}
              onSelect={selectClub}
              tabs={activeClubs.map((item) => ({
                id: item.club.id,
                label: item.club.name,
                icon: <TbAffiliate aria-hidden="true" className="size-3.5" />,
                labelClassName: "max-w-24 truncate",
              }))}
            />
          ) : null
        }
      >
        <button
          type="button"
          className="h-9 px-1 text-sm font-semibold text-pkpk-primary-font transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!isOnline}
          onClick={() => setIsCreateOpen(true)}
        >
          + 클럽 만들기
        </button>
      </TabPanelHeader>

      <div className="tab-panel-header-content flex min-h-0 flex-1 flex-col bg-white">
        {isLoading ? (
          <TabPanelStatus isLoading ariaLabel="클럽을 불러오는 중" message="클럽을 불러오는 중이에요." />
        ) : error && !activeClubs.length ? (
          <TabPanelStatus tone="error" message={error} />
        ) : !activeClubs.length ? (
          <TabPanelEmptyState message="클럽을 만들거나 주변 클럽에 가입해보세요.">
            <Button
              variant="secondary"
              className="mt-2 rounded-full px-4 font-semibold text-pkpk-primary-bg"
              isDisabled={!isOnline}
              onPress={() => setScannerTarget("invite")}
            >
              <IoScanOutline className="mr-1 size-4" />
              클럽 QR 스캔
            </Button>
            {pendingClubs.length ? (
              <div className="mt-3 w-full max-w-sm rounded-2xl border border-pkpk-primary-bg/15 bg-white px-4 py-3 text-left">
                <p className="text-sm font-bold text-pkpk-main-font">가입 요청 대기</p>
                <p className="mt-1 text-sm text-pkpk-sub-font">
                  {pendingClubs.map((item) => item.club.name).join(", ")}
                </p>
              </div>
            ) : null}
          </TabPanelEmptyState>
        ) : (
          <div className="relative z-30 mx-auto w-full min-h-full shrink-0">
            <div className="relative z-10">
              <div className="divide-y-[6px] divide-pkpk-section-border">
                {error ? (
                  <section className="px-4 py-4">
                    <div className="rounded-2xl border border-error/20 bg-white px-4 py-3 text-sm font-medium text-error">
                      {error}
                    </div>
                  </section>
                ) : null}

                {isDashboardLoading || !dashboard ? (
                  <TabPanelStatus isLoading ariaLabel="클럽 정보를 불러오는 중" message="클럽 정보를 불러오는 중이에요." />
                ) : (
                  <>
                    <section className="space-y-5 px-4 py-4">
                      <div className="space-y-3">
                        <SectionTitle
                          icon={<IoCalendarOutline className="size-5" />}
                          title="다가오는 매치 & 세션"
                        />
                        {renderSchedule()}
                      </div>
                      <div className="space-y-3">
                        <SectionTitle
                          icon={<IoCalendarOutline className="size-5" />}
                          title="최근에 끝난 매치"
                        />
                        {renderRecentCompletedMatches()}
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={openClubMatchHistory}
                          className="flex items-center gap-0.5 px-1 py-1 text-sm text-pkpk-primary-bg transition-colors hover:bg-pkpk-primary-bg/5 active:bg-pkpk-primary-bg/10"
                        >
                          {dashboard.club.name}의 매치 전체 보기
                          <IoChevronForward className="size-4" />
                        </button>
                      </div>
                    </section>

                    <section className="space-y-3 px-4 py-4">
                      <SectionTitle icon={<IoMegaphoneOutline className="size-5" />} title="공지" />
                      {dashboard.announcements.length ? (
                        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
                          {dashboard.announcements.slice(0, 3).map((announcement) => (
                            <div key={announcement.id} className="flex gap-3 px-4 py-3">
                              <IoMegaphoneOutline className="mt-0.5 size-4 shrink-0 text-pkpk-primary-bg" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-pkpk-main-font">
                                  {announcement.title}
                                </p>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-pkpk-sub-font">
                                  {announcement.body}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-2xl border border-dashed border-border bg-white px-4 py-5 text-center text-sm text-pkpk-sub-font">
                          등록된 공지가 없어요.
                        </p>
                      )}
                    </section>

                    <section className="space-y-3 px-4 py-4">
                      <SectionTitle
                        icon={<PiRankingLight className="size-5" />}
                        title="랭킹"
                      />
                      <div className="grid grid-cols-2 rounded-xl bg-pkpk-session-bg p-1">
                        {(["doubles", "singles"] as RankingCategory[]).map((category) => {
                          const Icon =
                            category === "doubles" ? IoPeople : IoPerson;
                          return (
                            <button
                              key={category}
                              type="button"
                              onClick={() => setRankingCategory(category)}
                              className={`flex items-center justify-center gap-1 rounded-lg py-2 text-sm font-bold transition-colors ${
                                rankingCategory === category
                                  ? "bg-white text-pkpk-primary-bg shadow-sm"
                                  : "text-pkpk-sub-font"
                              }`}
                            >
                              <Icon
                                aria-hidden="true"
                                className={
                                  category === "singles" ? "size-3" : "size-3.5"
                                }
                              />
                              {category === "singles" ? "Singles" : "Doubles"}
                            </button>
                          );
                        })}
                      </div>
                      {renderRankings(dashboard.rankings[rankingCategory])}
                    </section>

                    {isManager ? (
                      <button
                        type="button"
                        onClick={() => setIsManagementOpen(true)}
                        className="flex w-full items-center gap-3 border-b-[6px] border-pkpk-section-border bg-white px-4 py-4 text-left"
                      >
                        <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-pkpk-primary-bg shadow-sm">
                          <IoShieldCheckmarkOutline className="size-6" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-pkpk-main-font">운영진 관리</span>
                          <span className="mt-0.5 block text-xs text-pkpk-sub-font">
                            가입 요청, 공지, 세션, 멤버 권한을 관리해요.
                          </span>
                        </span>
                        <IoChevronForward className="size-5 shrink-0 text-pkpk-sub-font" />
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomSheet
        isOpen={isCreateOpen}
        isActive={selectedTab === "affiliations"}
        onOpenChange={setIsCreateOpen}
        ariaLabel="클럽 만들기"
      >
        <BottomSheet.Body>
          <div>
            <h2 className="bs-text-head text-pkpk-main-font">클럽 만들기</h2>
            <p className="mt-1 text-sm text-pkpk-sub-font">
              만든 분은 바로 클럽장이 됩니다.
            </p>
          </div>
          <input
            value={clubName}
            maxLength={120}
            onChange={(event) => setClubName(event.target.value)}
            placeholder="클럽 이름"
            className="app-mobile-input w-full rounded-2xl border border-border bg-white px-4 text-pkpk-main-font outline-none focus:border-pkpk-primary-bg"
          />
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="club-description"
                className="text-sm font-semibold text-pkpk-main-font"
              >
                클럽 소개 <span className="font-normal text-pkpk-sub-font">(선택)</span>
              </label>
              <span className="text-xs text-pkpk-sub-font">
                {getUnicodeCodePointLength(clubDescription)}/
                {CLUB_DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
            <textarea
              id="club-description"
              value={clubDescription}
              onChange={(event) =>
                setClubDescription(
                  truncateToUnicodeCodePoints(
                    event.target.value,
                    CLUB_DESCRIPTION_MAX_LENGTH,
                  ),
                )
              }
              placeholder="클럽을 소개해 주세요"
              className="club-description-input min-h-24 w-full resize-none rounded-2xl border border-border bg-white px-4 py-3 text-sm text-pkpk-main-font outline-none focus:border-pkpk-primary-bg"
            />
          </div>
          <Button
            className="app-action-button rounded-2xl bg-pkpk-primary-bg font-bold text-white"
            isDisabled={!clubName.trim() || isCreating || !isOnline}
            onPress={() => void createClub()}
          >
            {isCreating ? "만드는 중..." : "클럽 만들기"}
          </Button>
        </BottomSheet.Body>
      </BottomSheet>

      <BottomSheet
        isOpen={scannerTarget !== null}
        isActive={selectedTab === "affiliations"}
        onOpenChange={(open) => !open && setScannerTarget(null)}
        ariaLabel="클럽 QR 스캔"
      >
        {scannerTarget ? (
          <ClubQrScannerSheetBody
            key={scannerTarget}
            successMessage={
              scannerTarget === "invite"
                ? "클럽 가입 요청을 보냈어요."
                : "클럽 멤버로 추가했어요."
            }
            onScanned={
              scannerTarget === "invite" ? handleInviteScan : handlePlayerScan
            }
            onClose={() => setScannerTarget(null)}
          />
        ) : (
          <div />
        )}
      </BottomSheet>

      <RightDrawer
        isOpen={isManagementOpen}
        isActive={selectedTab === "affiliations"}
        ariaLabel="클럽 운영진 관리"
        layer={40}
        onExited={() => setManagementError(null)}
        onPullToRefresh={async () => {
          await Promise.all([loadDashboard(), loadInvite()]);
        }}
      >
        <div className="min-h-full p-3">
          <div className="sticky top-0 z-10 -mx-3 mb-4 flex h-12 items-center justify-between border-b border-border bg-pkpk-bg px-4">
            <div>
              <p className="text-lg font-bold text-pkpk-secondary-bg">운영진 관리</p>
              <p className="text-xs text-pkpk-sub-font">{dashboard?.club.name}</p>
            </div>
            <Button
              variant="secondary"
              className="rounded-full px-3 text-sm font-semibold"
              onPress={() => setIsManagementOpen(false)}
            >
              닫기
            </Button>
          </div>

          {managementError ? (
            <p className="mb-3 rounded-xl border border-error/20 bg-white px-3 py-2 text-sm text-error">
              {managementError}
            </p>
          ) : null}

          {dashboard ? (
            <div className="space-y-5">
              <section className="space-y-3">
                <SectionTitle icon={<IoQrCodeOutline className="size-5" />} title="클럽 QR" />
                <div className="rounded-2xl border border-border bg-white p-4">
                  {invite ? (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="rounded-2xl border border-border p-3">
                        <QrCode value={invite.token} size={148} />
                      </div>
                      <p className="text-xs leading-5 text-pkpk-sub-font">
                        멤버가 이 QR을 스캔하면 가입 요청이 생성됩니다.
                      </p>
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-pkpk-sub-font">QR을 불러오는 중이에요.</p>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      className="rounded-xl font-semibold"
                      onPress={() => setScannerTarget("player")}
                    >
                      <IoScanOutline className="mr-1 size-4" />
                      멤버 QR 스캔
                    </Button>
                    <Button
                      variant="secondary"
                      className="rounded-xl font-semibold text-pkpk-primary-bg"
                      onPress={() =>
                        void runManagementAction(async () => {
                          if (!selectedClubId) return;
                          setInvite(
                            await request<ClubInvite>(
                              `/api/clubs/${encodeURIComponent(selectedClubId)}/invite/rotate`,
                              { method: "POST" },
                            ),
                          );
                        })
                      }
                    >
                      <IoRefreshOutline className="mr-1 size-4" />
                      QR 재발급
                    </Button>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <SectionTitle icon={<IoPersonAddOutline className="size-5" />} title="가입 요청" />
                {dashboard.pendingRequests.length ? (
                  <div className="space-y-2">
                    {dashboard.pendingRequests.map((pending) => (
                      <div key={pending.playerId} className="rounded-2xl border border-border bg-white p-3">
                        <p className="truncate text-sm font-bold text-pkpk-main-font">{pending.player?.username ?? pending.playerId}</p>
                        <p className="mt-0.5 text-xs text-pkpk-sub-font">가입 요청 대기 중</p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button
                            className="rounded-xl bg-pkpk-primary-bg font-semibold text-white"
                            onPress={() =>
                              void runManagementAction(() =>
                                request(
                                  `/api/clubs/${encodeURIComponent(dashboard.club.id)}/join-requests/${encodeURIComponent(pending.playerId)}/approve`,
                                  { method: "POST" },
                                ),
                              )
                            }
                          >
                            승인
                          </Button>
                          <Button
                            variant="secondary"
                            className="rounded-xl font-semibold text-pkpk-sub-font"
                            onPress={() =>
                              void runManagementAction(() =>
                                request(
                                  `/api/clubs/${encodeURIComponent(dashboard.club.id)}/join-requests/${encodeURIComponent(pending.playerId)}`,
                                  { method: "DELETE" },
                                ),
                              )
                            }
                          >
                            거절
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-border bg-white px-4 py-5 text-center text-sm text-pkpk-sub-font">대기 중인 가입 요청이 없어요.</p>
                )}
              </section>

              <section className="space-y-3">
                <SectionTitle icon={<IoMegaphoneOutline className="size-5" />} title="공지 작성" />
                <div className="space-y-2 rounded-2xl border border-border bg-white p-3">
                  <input value={announcementTitle} maxLength={160} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="공지 제목" className="app-mobile-input w-full rounded-xl border border-border px-3 outline-none focus:border-pkpk-primary-bg" />
                  <textarea value={announcementBody} maxLength={4000} onChange={(event) => setAnnouncementBody(event.target.value)} placeholder="공지 내용" className="min-h-24 w-full rounded-xl border border-border p-3 text-sm outline-none focus:border-pkpk-primary-bg" />
                  <Button className="w-full rounded-xl bg-pkpk-primary-bg font-semibold text-white" isDisabled={!announcementTitle.trim() || !announcementBody.trim()} onPress={() => void createAnnouncement()}>
                    공지 등록
                  </Button>
                </div>
              </section>

              <section className="space-y-3">
                <SectionTitle icon={<IoCalendarOutline className="size-5" />} title="세션 만들기" />
                <div className="space-y-2 rounded-2xl border border-border bg-white p-3">
                  <input value={sessionName} onChange={(event) => setSessionName(event.target.value)} placeholder="세션 이름" className="app-mobile-input w-full rounded-xl border border-border px-3 outline-none focus:border-pkpk-primary-bg" />
                  <input value={sessionLocation} onChange={(event) => setSessionLocation(event.target.value)} placeholder="장소" className="app-mobile-input w-full rounded-xl border border-border px-3 outline-none focus:border-pkpk-primary-bg" />
                  <input value={sessionDate} type="datetime-local" onChange={(event) => setSessionDate(event.target.value)} className="app-mobile-input w-full rounded-xl border border-border px-3 outline-none focus:border-pkpk-primary-bg" />
                  <Button className="w-full rounded-xl bg-pkpk-primary-bg font-semibold text-white" isDisabled={!sessionName.trim() || !sessionLocation.trim() || !sessionDate} onPress={() => void createSession()}>
                    세션 만들기
                  </Button>
                </div>
              </section>

              <section className="space-y-3">
                <SectionTitle icon={<IoPeopleOutline className="size-5" />} title="멤버 및 권한" />
                <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
                  {dashboard.members.map((member) => (
                    <div key={member.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-full bg-pkpk-session-bg text-sm font-bold text-pkpk-primary-bg">
                          {member.username.slice(0, 1)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-pkpk-main-font">{member.username}</p>
                          <p className="text-xs text-pkpk-sub-font">{member.role === "owner" ? "클럽장" : member.role === "manager" ? "운영진" : "멤버"}</p>
                        </div>
                      </div>
                      {isOwner && member.id !== player?.id ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {member.role !== "owner" ? (
                            <Button
                              variant="secondary"
                              className="rounded-xl text-xs font-semibold text-pkpk-primary-bg"
                              onPress={() =>
                                void runManagementAction(() =>
                                  request(
                                    `/api/clubs/${encodeURIComponent(dashboard.club.id)}/members/${encodeURIComponent(member.id)}/role`,
                                    {
                                      method: "PATCH",
                                      body: JSON.stringify({ role: member.role === "manager" ? "member" : "manager" }),
                                    },
                                  ),
                                )
                              }
                            >
                              {member.role === "manager" ? "운영진 해제" : "운영진 지정"}
                            </Button>
                          ) : null}
                          {member.role !== "owner" ? (
                            <Button
                              variant="secondary"
                              className="rounded-xl text-xs font-semibold text-pkpk-sub-font"
                              onPress={() => {
                                if (!window.confirm(`${member.username}님에게 클럽장 권한을 위임할까요?`)) return;
                                void runManagementAction(() =>
                                  request(
                                    `/api/clubs/${encodeURIComponent(dashboard.club.id)}/ownership-transfer`,
                                    { method: "POST", body: JSON.stringify({ playerId: member.id }) },
                                  ),
                                );
                              }}
                            >
                              클럽장 위임
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </RightDrawer>

      {clubMatchHistoryClub && clubMatchHistoryDepthId ? (
        <RightDrawer
          isOpen={isClubMatchHistoryDrawerOpen}
          isActive={selectedTab === "affiliations"}
          ariaLabel={`${clubMatchHistoryClub.name}의 매치 전체`}
          onExited={completeClubMatchHistoryClose}
          onScrollContainerChange={registerClubMatchHistoryScrollContainer}
          onPullToRefresh={() =>
            loadClubMatchHistory(clubMatchHistoryClub.id, 0)
          }
          layer={60}
          className="!bg-white"
        >
          <div className="min-h-full bg-white">
            <DetailPageHeader
              title={`${clubMatchHistoryClub.name}의 매치 전체`}
              tabKey="affiliations"
              backgroundClassName="bg-white"
            />
            <div className="space-y-3 p-3">
              <h2 className="px-1 text-xl font-bold text-pkpk-secondary-bg">
                {clubMatchHistoryClub.name}의 매치 전체
              </h2>
              {isClubMatchHistoryLoading && !clubMatchHistoryMatches.length ? (
                <TabPanelStatus
                  isLoading
                  ariaLabel="소속 매치를 불러오는 중"
                  message="소속 매치를 불러오는 중이에요."
                />
              ) : clubMatchHistoryError ? (
                <div className="space-y-3">
                  <TabPanelStatus tone="error" message={clubMatchHistoryError} />
                  <Button
                    type="button"
                    className="app-action-button w-full rounded-2xl bg-pkpk-primary-bg font-semibold text-white"
                    onPress={() =>
                      void loadClubMatchHistory(clubMatchHistoryClub.id, 0)
                    }
                  >
                    다시 시도
                  </Button>
                </div>
              ) : !clubMatchHistoryMatches.length ? (
                <TabPanelStatus message="표시할 소속 매치가 없어요." />
              ) : (
                <>
                  <div className="space-y-3">
                    {clubMatchHistoryMatches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        currentPlayerId={player?.id}
                        onPress={openMatchDetail}
                      />
                    ))}
                  </div>
                  {clubMatchHistoryMatches.length < clubMatchHistoryTotal ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="app-action-button w-full rounded-2xl font-semibold"
                      isDisabled={isClubMatchHistoryLoading}
                      onPress={() =>
                        void loadClubMatchHistory(
                          clubMatchHistoryClub.id,
                          clubMatchHistoryPage,
                          true,
                        )
                      }
                    >
                      {isClubMatchHistoryLoading ? "불러오는 중..." : "더 보기"}
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </RightDrawer>
      ) : null}

      {selectedSession && sessionDepthId ? (
        <RightDrawer
          isOpen={isSessionDrawerOpen}
          isActive={selectedTab === "affiliations"}
          ariaLabel="세션 상세"
          onExited={completeSessionDetailClose}
          onScrollContainerChange={registerSessionScrollContainer}
          onPullToRefresh={() => loadSessionMatches(selectedSession)}
          layer={60}
        >
          <SessionDetail
            session={selectedSession}
            matches={selectedSessionMatches}
            currentPlayerId={player?.id}
            isLoading={isLoadingSession}
            error={sessionError}
            onRetry={() => void loadSessionMatches(selectedSession)}
            onPressMatch={openMatchDetail}
            tabKey="affiliations"
          />
        </RightDrawer>
      ) : null}

      {selectedMatch && matchDepthId ? (
        <ProfileMatchDetailDrawer
          isOpen={isMatchDrawerOpen}
          isActive={selectedTab === "affiliations"}
          tabKey="affiliations"
          match={selectedMatch}
          currentPlayerId={player?.id}
          onExited={completeMatchDetailClose}
          onScrollContainerChange={registerMatchScrollContainer}
          layer={70}
        />
      ) : null}
    </div>
  );
};

export default Affiliations;
