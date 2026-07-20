import React from "react";
import { Button } from "@heroui/react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getCompositeDoublesRating,
  getCompositeSinglesRating,
} from "../utils/dupr";

const formatRating = (rating?: number | null) => rating?.toFixed(3) ?? "NR";

const Home: React.FC = () => {
  const { player, logout } = useAuth();
  const navigate = useNavigate();
  const singlesRating = getCompositeSinglesRating(player?.duprRating);
  const doublesRating = getCompositeDoublesRating(player?.duprRating);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app-safe-bottom-pad flex h-full w-full items-center justify-center overflow-hidden bg-gray-100 px-3 pt-6">
      <div className="app-scroll-area max-h-full w-full text-center">
        <h1 className="mb-4 text-4xl font-bold text-[#409eff]">PKELO</h1>
        <p className="mb-8 text-lg text-gray-700">
          Pickleball DUPR System에 오신 것을 환영합니다!
        </p>

        {player ? (
          <div className="mx-auto mb-6 w-full max-w-[320px] rounded-xl bg-white p-4 shadow-sm">
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">이름</span>
                <span className="font-semibold">{player.username || player.id}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Singles</span>
                <span>{formatRating(singlesRating)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Doubles</span>
                <span>{formatRating(doublesRating)}</span>
              </div>
              {player.gender && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">성별</span>
                  <span>{player.gender === "M" ? "🙋‍♂️ Male" : "🙋‍♀️ Female"}</span>
                </div>
              )}
            </div>

            <Button
              onPress={handleLogout}
              className="app-action-button mt-4 w-full bg-default-200 text-default-700"
              fullWidth
            >
              로그아웃
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Link
              to="/login"
              className="app-action-button mx-auto flex w-full max-w-[320px] items-center justify-center rounded-lg bg-[#409eff] py-3 font-semibold text-white transition-colors hover:bg-[#409eff]/90"
            >
              로그인
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
