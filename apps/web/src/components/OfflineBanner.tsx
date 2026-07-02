import React from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto max-w-[430px] px-3 pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <div className="rounded-full bg-amber-950/90 px-4 py-2 text-center text-xs font-semibold text-white shadow-lg">
        오프라인: 최근 저장된 정보를 표시 중입니다.
      </div>
    </div>
  );
};

export default OfflineBanner;
