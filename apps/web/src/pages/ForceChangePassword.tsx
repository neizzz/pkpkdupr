import React from "react";
import { useNavigate } from "react-router-dom";
import PasswordChangeForm from "@/components/PasswordChangeForm";
import { useAuth } from "@/context/AuthContext";
import { PASSWORD_CHANGED_LOGIN_NOTICE } from "@/lib/authMessages";

const ForceChangePassword: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleSuccess = async () => {
    logout();
    navigate("/login", {
      replace: true,
      state: { notice: PASSWORD_CHANGED_LOGIN_NOTICE },
    });
  };

  return (
    <div className="app-safe-bottom-pad flex h-full w-full items-center justify-center overflow-hidden">
      <div className="app-scroll-area flex max-h-full w-full flex-col justify-center px-4 py-6">
        <p className="mb-6 text-sm leading-6 text-[#666]">
          초기 비밀번호여서 비밀번호 변경이 필요합니다.
        </p>

        <PasswordChangeForm
          submitLabel="변경 후 로그인"
          requireCurrentPassword={false}
          onSuccess={handleSuccess}
        />
      </div>
    </div>
  );
};

export default ForceChangePassword;
