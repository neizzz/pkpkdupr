import React from "react";
import { useNavigate } from "react-router-dom";
import PasswordChangeForm from "@/components/PasswordChangeForm";
import { useAuth } from "@/context/AuthContext";
import { PASSWORD_CHANGED_LOGIN_NOTICE } from "@/lib/authMessages";

const ProfileSettingsSheetBody: React.FC = () => {
  const { logout, player } = useAuth();
  const navigate = useNavigate();

  const handlePasswordChangeSuccess = async () => {
    logout();
    navigate("/login", {
      replace: true,
      state: { notice: PASSWORD_CHANGED_LOGIN_NOTICE },
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <h2 className="bs-text-head text-center text-pkpk-main-font">설정</h2>

      {player?.authProvider === "password" || !player?.authProvider ? (
        <PasswordChangeForm
          title="패스워드 변경"
          onSuccess={handlePasswordChangeSuccess}
        />
      ) : (
        <p className="rounded-xl bg-default-100 px-4 py-3 text-center text-sm text-default-600">
          카카오 로그인 계정은 비밀번호를 변경할 수 없습니다.
        </p>
      )}
    </div>
  );
};

export default ProfileSettingsSheetBody;
