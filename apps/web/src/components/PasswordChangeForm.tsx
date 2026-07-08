import React, { useState } from "react";
import { Button } from "@heroui/react";
import { useAuth } from "@/context/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface PasswordChangeFormProps {
  title?: React.ReactNode;
  submitLabel?: string;
  description?: React.ReactNode;
  requireCurrentPassword?: boolean;
  onSuccess: () => Promise<void> | void;
}

const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({
  title,
  submitLabel = "변경",
  description,
  requireCurrentPassword = true,
  onSuccess,
}) => {
  const { changePassword } = useAuth();
  const isOnline = useOnlineStatus();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPasswordValidationError, setCurrentPasswordValidationError] =
    useState<string | null>(null);
  const [passwordSubmitError, setPasswordSubmitError] = useState<string | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const newPasswordValidationError =
    newPassword.length > 0 && newPassword.length < 6
      ? "새 패스워드는 6자 이상이어야 합니다."
      : null;
  const confirmPasswordValidationError =
    confirmPassword.length > 0 && newPassword !== confirmPassword
      ? "새 패스워드 확인이 일치하지 않습니다."
      : null;
  const validationMessage =
    currentPasswordValidationError ||
    newPasswordValidationError ||
    confirmPasswordValidationError ||
    passwordSubmitError;
  const isSubmitDisabled =
    isSubmitting ||
    !isOnline ||
    (requireCurrentPassword && !currentPassword) ||
    !newPassword ||
    !confirmPassword ||
    !!currentPasswordValidationError ||
    !!newPasswordValidationError ||
    !!confirmPasswordValidationError;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordSubmitError(null);

    if (!isOnline) {
      setPasswordSubmitError(
        "오프라인에서는 패스워드를 변경할 수 없습니다. 온라인 연결이 필요합니다.",
      );
      return;
    }

    if (requireCurrentPassword && !currentPassword) {
      setCurrentPasswordValidationError("현재 패스워드를 입력해주세요.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordSubmitError("새 패스워드는 6자 이상이어야 합니다.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordSubmitError("새 패스워드 확인이 일치하지 않습니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(
        requireCurrentPassword ? currentPassword : undefined,
        newPassword,
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPasswordValidationError(null);
      setPasswordSubmitError(null);
      await onSuccess();
    } catch (err) {
      const nextError =
        err instanceof Error ? err.message : "비밀번호를 변경하지 못했습니다.";
      if (nextError.includes("현재 패스워드")) {
        setCurrentPasswordValidationError(nextError);
      } else {
        setPasswordSubmitError(nextError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {title || description ? (
        <div className="flex flex-col gap-1">
          {title ? (
            <h3 className="bs-text-title text-amber-950">{title}</h3>
          ) : null}
          {description ? (
            <p className="text-sm leading-5 text-[#666]">{description}</p>
          ) : null}
        </div>
      ) : null}

      {!isOnline ? (
        <div className="bs-text-body rounded-2xl bg-amber-50 px-3 py-2 text-amber-700">
          패스워드 변경은 온라인 연결이 필요합니다.
        </div>
      ) : null}

      {requireCurrentPassword ? (
        <input
          type="password"
          placeholder="현재 패스워드"
          value={currentPassword}
          disabled={!isOnline}
          onChange={(event) => {
            setCurrentPassword(event.target.value);
            setCurrentPasswordValidationError(null);
            setPasswordSubmitError(null);
          }}
          className="app-mobile-input w-full rounded-2xl border border-border px-4 py-3 text-base outline-none"
        />
      ) : null}

      <input
        type="password"
        placeholder="새 패스워드"
        minLength={6}
        value={newPassword}
        disabled={!isOnline}
        onChange={(event) => {
          setNewPassword(event.target.value);
          setPasswordSubmitError(null);
        }}
        className="app-mobile-input w-full rounded-2xl border border-border px-4 py-3 text-base outline-none"
      />

      <input
        type="password"
        placeholder="새 패스워드 확인"
        minLength={6}
        value={confirmPassword}
        disabled={!isOnline}
        onChange={(event) => {
          setConfirmPassword(event.target.value);
          setPasswordSubmitError(null);
        }}
        className="app-mobile-input w-full rounded-2xl border border-border px-4 py-3 text-base outline-none"
      />

      <div className="flex items-end justify-between gap-3">
        <p className="bs-text-caption min-h-4 text-error">{validationMessage}</p>
        <Button
          type="submit"
          className="app-action-button rounded-2xl bg-[#409eff] px-6 text-white"
          isDisabled={isSubmitDisabled}
        >
          {isSubmitting ? "변경 중..." : submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default PasswordChangeForm;
