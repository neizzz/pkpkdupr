import React from "react";
import { useNavigate } from "react-router-dom";
import PasswordChangeForm from "@/components/PasswordChangeForm";
import { useAuth } from "@/context/AuthContext";
import { PASSWORD_CHANGED_LOGIN_NOTICE } from "@/lib/authMessages";
import BottomSheet from "./BottomSheet";

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
    <BottomSheet.Body>
      <h2 className="bs-text-head text-left text-pkpk-main-font">설정</h2>

      <PasswordChangeForm
        title="패스워드 변경"
        onSuccess={handlePasswordChangeSuccess}
      />
    </BottomSheet.Body>
  );
};

export default ProfileSettingsSheetBody;
