import React from "react";
import DetailPageHeader from "@/components/DetailPageHeader";
import PrivacyPolicyContent from "@/components/PrivacyPolicyContent";
import RightDrawer from "@/components/RightDrawer";

interface OperatingPolicyDrawerProps {
  isOpen: boolean;
  isActive: boolean;
  onClose: () => void;
  onExited: () => void;
}

const OperatingPolicyDrawer: React.FC<OperatingPolicyDrawerProps> = ({
  isOpen,
  isActive,
  onClose,
  onExited,
}) => (
  <RightDrawer
    isOpen={isOpen}
    isActive={isActive}
    ariaLabel="운영방침"
    onExited={onExited}
    layer={50}
    className="!bg-white"
  >
    <div className="min-h-full bg-white">
      <DetailPageHeader
        title="운영방침"
        tabKey="settings"
        backgroundClassName="bg-white"
        onBack={onClose}
        rightContent={
          <p className="text-lg font-bold text-pkpk-primary-bg">운영방침</p>
        }
      />

      <div className="space-y-6 px-4 py-5">
        <section aria-labelledby="business-information-title">
          <h2
            id="business-information-title"
            className="text-xl font-bold text-pkpk-main-font"
          >
            사업자 정보
          </h2>
          <dl className="mt-3 rounded-2xl bg-pkpk-bg px-4 py-3 text-sm leading-6 text-pkpk-sub-font">
            <div className="flex items-center justify-between gap-4">
              <dt className="font-semibold text-pkpk-main-font">상호</dt>
              <dd>벌스</dd>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4 border-t border-border pt-2">
              <dt className="font-semibold text-pkpk-main-font">
                사업자등록번호
              </dt>
              <dd>163-20-01593</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="privacy-policy-title">
          <h2
            id="privacy-policy-title"
            className="text-xl font-bold text-pkpk-main-font"
          >
            개인정보 처리방침
          </h2>
          <div className="mt-3 max-h-[45dvh] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-white px-4 py-4">
            <PrivacyPolicyContent />
          </div>
        </section>
      </div>
    </div>
  </RightDrawer>
);

export default OperatingPolicyDrawer;
