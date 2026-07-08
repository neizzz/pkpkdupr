import React, { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import Avatar from "@/components/Avatar";
import PasswordChangeForm from "@/components/PasswordChangeForm";
import { useAuth } from "@/context/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { PASSWORD_CHANGED_LOGIN_NOTICE } from "@/lib/authMessages";

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

const ProfileSettingsSheetBody: React.FC = () => {
  const { player, uploadAvatar, deleteAvatar, logout } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(
    player?.avatarUrl ?? "",
  );
  const [selectedAvatarDataUrl, setSelectedAvatarDataUrl] = useState<
    string | null
  >(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
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
      setMessage("이미지를 선택했습니다.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "프로필 이미지를 처리하지 못했습니다.",
      );
    }
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();

    if (!isOnline) {
      setError("오프라인에서는 프로필 이미지를 변경할 수 없습니다. 온라인 연결이 필요합니다.");
      return;
    }

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

    if (!isOnline) {
      setError("오프라인에서는 프로필 이미지를 삭제할 수 없습니다. 온라인 연결이 필요합니다.");
      return;
    }

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

  const handlePasswordChangeSuccess = async () => {
    logout();
    navigate("/login", {
      replace: true,
      state: { notice: PASSWORD_CHANGED_LOGIN_NOTICE },
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <h2 className="bs-text-head text-amber-950">프로필 설정</h2>

      {(message || error) && (
        <div
          className={`bs-text-body rounded-2xl px-3 py-2 ${
            error ? "bg-error/10 text-error" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {error ?? message}
        </div>
      )}

      {!isOnline ? (
        <div className="bs-text-body rounded-2xl bg-amber-50 px-3 py-2 text-amber-700">
          프로필 이미지 변경은 온라인 연결이 필요합니다.
        </div>
      ) : null}

      <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h3 className="bs-text-title text-amber-950">프로필 이미지 변경</h3>
        </div>

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          onChange={handleSelectAvatar}
          className="hidden"
        />

        <div className="flex  gap-2">
          <Avatar
            size="sm"
            avatarUrl={avatarPreviewUrl || undefined}
            name={player?.username}
            isMe
          />
          <Button
            type="button"
            variant="secondary"
            className="rounded-2xl text-amber-800"
            onPress={() => avatarInputRef.current?.click()}
            isDisabled={isSavingProfile || !isOnline}
          >
            갤러리에서 선택
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="rounded-2xl text-red-600"
            onPress={handleDeleteAvatar}
            isDisabled={
              isSavingProfile ||
              !isOnline ||
              (!player?.avatarUrl && !selectedAvatarDataUrl)
            }
          >
            이미지 제거
          </Button>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            className="rounded-2xl bg-[#409eff] px-6 text-white"
            isDisabled={isSavingProfile || !isOnline || !selectedAvatarDataUrl}
          >
            {isSavingProfile ? "저장 중..." : "저장"}
          </Button>
        </div>
      </form>

      <div className="h-px bg-divider" />

      <PasswordChangeForm
        title="패스워드 변경"
        onSuccess={handlePasswordChangeSuccess}
      />
    </div>
  );
};

export default ProfileSettingsSheetBody;
