import React from "react";
import { useNavigate } from "react-router-dom";
import PasswordChangeForm from "@/components/PasswordChangeForm";
import { useAuth } from "@/context/AuthContext";
import { PASSWORD_CHANGED_LOGIN_NOTICE } from "@/lib/authMessages";

const ProfileSettingsSheetBody: React.FC = () => {
  const { logout } = useAuth();
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

      <PasswordChangeForm
        title="패스워드 변경"
        onSuccess={handlePasswordChangeSuccess}
      />
    </div>
  );
};

export default ProfileSettingsSheetBody;
