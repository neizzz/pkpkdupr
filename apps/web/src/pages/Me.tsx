import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { IoSettingsOutline } from "react-icons/io5";
import Avatar from "@/components/Avatar";
import BottomSheet from "@/components/BottomSheet";
import MemberProfile from "@/components/MemberProfile";
import { useAuth } from "@/context/AuthContext";
import { useTabNavigation } from "@/context/TabNavigationContext";

const MAX_AVATAR_SIZE = 512;
const AVATAR_JPEG_QUALITY = 0.85;

const readImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    image.src = src;
  });

const resizeAvatarImage = async (file: File) => {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 선택할 수 있습니다.");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await readImage(objectUrl);
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    if (!sourceSize) {
      throw new Error("이미지 크기를 확인하지 못했습니다.");
    }

    const outputSize = Math.min(MAX_AVATAR_SIZE, sourceSize);
    const sourceX = Math.floor((image.naturalWidth - sourceSize) / 2);
    const sourceY = Math.floor((image.naturalHeight - sourceSize) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("이미지를 처리하지 못했습니다.");
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize,
    );

    return canvas.toDataURL("image/jpeg", AVATAR_JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const Me: React.FC = () => {
  const { player, token, uploadAvatar, deleteAvatar } = useAuth();
  const { closeDepth, pushDepth } = useTabNavigation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(
    player?.avatarUrl ?? "",
  );
  const [selectedAvatarDataUrl, setSelectedAvatarDataUrl] = useState<
    string | null
  >(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selectedAvatarDataUrl) {
      setAvatarPreviewUrl(player?.avatarUrl ?? "");
    }
  }, [player?.avatarUrl, selectedAvatarDataUrl]);

  const clearFeedback = () => {
    setMessage(null);
    setError(null);
  };

  const handleSelectAvatar = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    clearFeedback();

    try {
      const nextAvatarDataUrl = await resizeAvatarImage(file);
      setSelectedAvatarDataUrl(nextAvatarDataUrl);
      setAvatarPreviewUrl(nextAvatarDataUrl);
      setMessage("이미지를 선택했습니다. 저장 버튼을 눌러 적용해주세요.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "프로필 이미지를 처리하지 못했습니다.",
      );
    }
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();

    if (!selectedAvatarDataUrl) {
      setError("먼저 갤러리에서 이미지를 선택해주세요.");
      return;
    }

    setIsSavingProfile(true);

    try {
      await uploadAvatar(selectedAvatarDataUrl);
      setSelectedAvatarDataUrl(null);
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

  const handleDeleteAvatar = async () => {
    clearFeedback();
    setIsSavingProfile(true);

    try {
      await deleteAvatar();
      setSelectedAvatarDataUrl(null);
      setAvatarPreviewUrl("");
      setMessage("프로필 이미지가 삭제되었습니다.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "프로필 이미지를 삭제하지 못했습니다.",
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
            <p className="bs-text-caption font-medium uppercase tracking-wide text-amber-400">
              Settings
            </p>
            <h2 className="bs-text-head mt-1 text-amber-950">
              프로필 설정
            </h2>
            <p className="bs-text-body mt-2 text-amber-700/80">
              모바일 갤러리에서 프로필 이미지를 선택하고 로그인 비밀번호를
              변경할 수 있어요.
            </p>
          </div>

          {(message || error) && (
            <div
              className={`bs-text-body rounded-2xl px-3 py-2 ${
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
                avatarUrl={avatarPreviewUrl || undefined}
                name={player?.username}
                isMe
              />
              <div>
                <h3 className="bs-text-title text-amber-950">
                  프로필 이미지
                </h3>
                <p className="bs-text-caption text-amber-700/70">
                  갤러리에서 선택한 이미지는 정사각형으로 잘라 저장됩니다.
                </p>
              </div>
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleSelectAvatar}
              className="hidden"
            />

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                className="rounded-2xl text-amber-800"
                onPress={() => avatarInputRef.current?.click()}
                isDisabled={isSavingProfile}
              >
                갤러리에서 선택
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="rounded-2xl text-red-600"
                onPress={handleDeleteAvatar}
                isDisabled={
                  isSavingProfile || (!player?.avatarUrl && !selectedAvatarDataUrl)
                }
              >
                이미지 제거
              </Button>
            </div>

            <Button
              type="submit"
              className="rounded-2xl bg-[#409eff] text-white"
              isDisabled={isSavingProfile || !selectedAvatarDataUrl}
            >
              {isSavingProfile ? "저장 중..." : "프로필 이미지 저장"}
            </Button>
          </form>

          <div className="h-px bg-amber-100" />

          <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
            <div>
              <h3 className="bs-text-title text-amber-950">패스워드 변경</h3>
              <p className="bs-text-caption mt-1 text-amber-700/70">
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
