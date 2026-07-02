import React, { useState, useEffect } from "react";
import type {
  Player,
  PlayerCreationLog,
  PlayerCreationSource,
  PlayerStatus,
  PlayerStatusChangeLog,
} from "@pkpkdupr/shared/player";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

type PlayerInfo = Pick<
  Player,
  "id" | "username" | "duprRating" | "gender" | "status"
> & {
  createdAt: string;
  updatedAt: string;
};

type PlayerStatusLogsByPlayerId = Record<string, PlayerStatusChangeLog[]>;
type PlayerCreationLogsByPlayerId = Record<string, PlayerCreationLog[]>;

const statusLabelMap: Record<PlayerStatus, string> = {
  active: "활성",
  inactive: "비활성",
};

const statusBadgeClassMap: Record<PlayerStatus, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-slate-200 text-slate-700",
};

const creationSourceLabelMap: Record<PlayerCreationSource, string> = {
  self_register: "일반 가입",
  admin_register: "관리자 생성",
  bootstrap: "초기 관리자 생성",
};

const PROTECTED_ADMIN_USERNAME = "admin";

const formatDupr = (value?: number | null) =>
  typeof value === "number" ? value.toFixed(3) : "NR";

const AdminDashboard: React.FC = () => {
  const { player, isAdmin, logout, token } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [statusLogsByPlayerId, setStatusLogsByPlayerId] =
    useState<PlayerStatusLogsByPlayerId>({});
  const [creationLogsByPlayerId, setCreationLogsByPlayerId] =
    useState<PlayerCreationLogsByPlayerId>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, PlayerStatus>>(
    {},
  );
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [officialPlayerId, setOfficialPlayerId] = useState("");
  const [officialReason, setOfficialReason] = useState("");
  const [officialRatings, setOfficialRatings] = useState({
    singles: "",
    mixed: "",
    men: "",
    women: "",
  });
  const [officialConfidence, setOfficialConfidence] = useState({
    singles: "",
    mixed: "",
    men: "",
    women: "",
  });
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

  const syncStatusDrafts = (loadedPlayers: PlayerInfo[]) => {
    setStatusDrafts((prev) => {
      const next: Record<string, PlayerStatus> = {};
      loadedPlayers.forEach((loadedPlayer) => {
        next[loadedPlayer.id] = prev[loadedPlayer.id] ?? loadedPlayer.status;
      });
      return next;
    });
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

  const loadDashboardData = async () => {
    try {
      setError(null);
      await Promise.all([loadPlayers(), loadCreationLogs(), loadStatusLogs()]);
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
          password: newPassword,
          gender,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "회원 추가 실패");
      }
      setSuccess(`${newUsername} 회원이 추가되었습니다.`);
      setNewUsername("");
      setNewPassword("");
      await loadDashboardData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
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

  const handleOfficialDuprSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!officialPlayerId) {
      setError("공식 DUPR를 반영할 회원을 선택해주세요.");
      return;
    }

    const ratings = {
      singles: Number(officialRatings.singles),
      doubles: {
        mixed: Number(officialRatings.mixed),
        men: Number(officialRatings.men),
        women: Number(officialRatings.women),
      },
    };
    const confidence = {
      singles: Number(officialConfidence.singles),
      doubles: {
        mixed: Number(officialConfidence.mixed),
        men: Number(officialConfidence.men),
        women: Number(officialConfidence.women),
      },
    };

    try {
      const res = await fetch(
        `/api/admin/players/${officialPlayerId}/official-dupr`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ratings,
            confidence,
            reason: officialReason,
          }),
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "공식 DUPR 반영 실패");
      }

      const data = (await res.json()) as { player: PlayerInfo };
      setPlayers((prev) =>
        prev.map((item) => (item.id === data.player.id ? data.player : item)),
      );
      setOfficialReason("");
      await loadDashboardData();
      setSuccess("공식 DUPR 반영 및 전체 재계산이 완료되었습니다.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
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

      <main className="p-6 max-w-6xl mx-auto space-y-8">
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
                Password
              </label>
              <input
                type="password"
                required
                placeholder="최소 6자"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
                onChange={(e) => setOfficialPlayerId(e.target.value)}
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
                onChange={(e) => setOfficialReason(e.target.value)}
                placeholder="정식 DUPR 반영 사유"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            {[
              ["singles", "Singles"],
              ["mixed", "Mixed"],
              ["men", "Men"],
              ["women", "Women"],
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
                    value={officialRatings[key as keyof typeof officialRatings]}
                    onChange={(e) =>
                      setOfficialRatings((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label} Confidence
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={100}
                    step={1}
                    value={
                      officialConfidence[key as keyof typeof officialConfidence]
                    }
                    onChange={(e) =>
                      setOfficialConfidence((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
              </React.Fragment>
            ))}
            <div className="col-span-4">
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
              >
                공식 DUPR 반영 및 전체 재계산
              </button>
            </div>
          </form>
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 pl-2">Username</th>
                    <th className="pb-2">DUPR</th>
                    <th className="pb-2">성별</th>
                    <th className="pb-2">현재 상태</th>
                    <th className="pb-2">상태 변경</th>
                    <th className="pb-2">생성 로그</th>
                    <th className="pb-2 pr-2">상태 로그</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => {
                    const creationLogs = creationLogsByPlayerId[p.id] ?? [];
                    const statusLogs = statusLogsByPlayerId[p.id] ?? [];
                    const latestCreationLog = creationLogs[0];
                    const draftStatus = statusDrafts[p.id] ?? p.status;
                    const isSaving = savingPlayerId === p.id;
                    const isDirty = draftStatus !== p.status;
                    const isProtectedAdminAccount =
                      p.username === PROTECTED_ADMIN_USERNAME;

                    return (
                      <tr key={p.id} className="border-b align-top hover:bg-gray-50">
                        <td className="py-3 pl-2 font-medium">{p.username}</td>
                        <td className="py-3 text-blue-600">
                          <div className="space-y-1 text-xs">
                            <div>S {formatDupr(p.duprRating?.singles)}</div>
                            <div>Mx {formatDupr(p.duprRating?.doubles.mixed)}</div>
                            <div>
                              Men {formatDupr(p.duprRating?.doubles.men)} / Women{" "}
                              {formatDupr(p.duprRating?.doubles.women)}
                            </div>
                          </div>
                        </td>
                        <td className="py-3">{p.gender === "M" ? "남" : "여"}</td>
                        <td className="py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClassMap[p.status]}`}
                          >
                            {statusLabelMap[p.status]}
                          </span>
                        </td>
                        <td className="py-3 min-w-[180px]">
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
                        <td className="py-3 min-w-[240px] text-xs text-gray-600">
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
                        <td className="py-3 pr-2 min-w-[280px] text-xs text-gray-600">
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
