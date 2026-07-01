import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { IoSettingsOutline } from "react-icons/io5";
import Avatar from "@/components/Avatar";
import BottomSheet from "@/components/BottomSheet";
import MemberProfile from "@/components/MemberProfile";
import { useAuth } from "@/context/AuthContext";
import { useTabNavigation } from "@/context/TabNavigationContext";

const Me: React.FC = () => {
  const { player, token, updateProfile } = useAuth();
  const { closeDepth, pushDepth } = useTabNavigation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(player?.avatarUrl ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAvatarUrl(player?.avatarUrl ?? "");
  }, [player?.avatarUrl]);

  const clearFeedback = () => {
    setMessage(null);
    setError(null);
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();
    setIsSavingProfile(true);

    try {
      await updateProfile({ avatarUrl: avatarUrl.trim() || null });
      setMessage("프로필 이미지가 변경되었습니다.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "프로필 이미지를 변경하지 못했습니다.",
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();

    if (!token) {
      setError("로그인이 필요합니다.");
      return;
    }

    if (newPassword.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "비밀번호 변경 실패");
      }

      setNewPassword("");
      setConfirmPassword("");
      setMessage("비밀번호가 변경되었습니다.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "비밀번호를 변경하지 못했습니다.",
      );
    } finally {
      setIsSavingPassword(false);
    }
  };

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const openSettings = () => {
    clearFeedback();
    pushDepth("me", {
      id: "me-settings",
      kind: "bottom-sheet",
      onClose: closeSettings,
    });
    setIsSettingsOpen(true);
  };

  const handleSettingsOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      openSettings();
      return;
    }

    if (!closeDepth("me", "me-settings")) {
      setIsSettingsOpen(false);
    }
  };

  const settingsButton = (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="rounded-full px-3 text-amber-700"
      onPress={openSettings}
    >
      <IoSettingsOutline className="size-4" />
      설정
    </Button>
  );

  return (
    <>
      <MemberProfile player={player} isMe headerAction={settingsButton} />

      <BottomSheet
        isOpen={isSettingsOpen}
        onOpenChange={handleSettingsOpenChange}
        ariaLabel="프로필 설정"
        className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6"
      >
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-amber-400">
              Settings
            </p>
            <h2 className="mt-1 text-xl font-bold text-amber-950">
              프로필 설정
            </h2>
            <p className="mt-2 text-sm text-amber-700/80">
              프로필 이미지 URL과 로그인 비밀번호를 변경할 수 있어요.
            </p>
          </div>

          {(message || error) && (
            <div
              className={`rounded-2xl px-3 py-2 text-sm ${
                error
                  ? "bg-red-50 text-red-600"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {error ?? message}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Avatar
                size="sm"
                avatarUrl={avatarUrl.trim() || undefined}
                name={player?.username}
                isMe
              />
              <div>
                <h3 className="font-semibold text-amber-950">
                  프로필 이미지
                </h3>
                <p className="text-xs text-amber-700/70">
                  이미지 URL을 비우면 기본 아이콘으로 표시됩니다.
                </p>
              </div>
            </div>

            <input
              type="url"
              placeholder="https://example.com/profile.png"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              className="w-full rounded-2xl border border-amber-100 px-4 py-3 text-sm outline-none transition focus:border-[#409eff] focus:ring-2 focus:ring-[#409eff]/20"
            />

            <Button
              type="submit"
              className="rounded-2xl bg-[#409eff] text-white"
              isDisabled={isSavingProfile}
            >
              {isSavingProfile ? "저장 중..." : "프로필 이미지 저장"}
            </Button>
          </form>

          <div className="h-px bg-amber-100" />

          <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
            <div>
              <h3 className="font-semibold text-amber-950">패스워드 변경</h3>
              <p className="mt-1 text-xs text-amber-700/70">
                새 비밀번호는 6자 이상이어야 합니다.
              </p>
            </div>

            <input
              type="password"
              placeholder="새 패스워드"
              minLength={6}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-2xl border border-amber-100 px-4 py-3 text-sm outline-none transition focus:border-[#409eff] focus:ring-2 focus:ring-[#409eff]/20"
            />
            <input
              type="password"
              placeholder="새 패스워드 확인"
              minLength={6}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-2xl border border-amber-100 px-4 py-3 text-sm outline-none transition focus:border-[#409eff] focus:ring-2 focus:ring-[#409eff]/20"
            />

            <Button
              type="submit"
              className="rounded-2xl bg-[#409eff] text-white"
              isDisabled={isSavingPassword}
            >
              {isSavingPassword ? "변경 중..." : "패스워드 변경"}
            </Button>
          </form>
        </div>
      </BottomSheet>
    </>
  );
};

export default Me;
