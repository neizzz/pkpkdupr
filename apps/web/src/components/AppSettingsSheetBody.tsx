import React, { useState } from "react";
import { Button } from "@heroui/react";
import { useAppUpdate } from "@/context/AppUpdateContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const AppSettingsSheetBody: React.FC = () => {
  const isOnline = useOnlineStatus();
  const {
    appVersion,
    isUpdateAvailable,
    isCheckingForUpdate,
    isApplyingUpdate,
    checkForUpdate,
    applyUpdate,
  } = useAppUpdate();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearFeedback = () => {
    setMessage(null);
    setError(null);
  };

  const handleUpdateAction = async () => {
    clearFeedback();

    try {
      if (isUpdateAvailable) {
        await applyUpdate();
        return;
      }

      const result = await checkForUpdate();
      setMessage(
        result === "update-available"
          ? "새 버전이 있어요. 지금 업데이트할 수 있습니다."
          : "최신 버전입니다.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "업데이트 처리에 실패했습니다.",
      );
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <h2 className="bs-text-head text-center text-amber-950">앱 설정</h2>

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
          오프라인에서는 업데이트 확인이 제한됩니다.
        </div>
      ) : null}

      <section className="flex flex-col gap-4">
        <div>
          <h3 className="bs-text-title text-amber-950">앱 버전</h3>
          <p className="mt-1 text-sm font-semibold text-[#666]">{appVersion}</p>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <h3 className="bs-text-title text-amber-950">업데이트</h3>
            <p className="mt-1 text-sm text-[#666]">
              {isUpdateAvailable
                ? "새 버전이 준비되어 있어요. 업데이트 후 다시 불러옵니다."
                : "새 버전이 있는지 확인할 수 있어요."}
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              className="app-action-button rounded-2xl bg-[#409eff] px-6 text-white"
              isDisabled={isCheckingForUpdate || isApplyingUpdate}
              onPress={() => void handleUpdateAction()}
            >
              {isApplyingUpdate
                ? "업데이트 중..."
                : isCheckingForUpdate
                  ? "확인 중..."
                  : isUpdateAvailable
                    ? "지금 업데이트"
                    : "업데이트 확인"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AppSettingsSheetBody;
