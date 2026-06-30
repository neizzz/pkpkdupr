import React from "react";
import MemberProfile from "@/components/MemberProfile";
import { useAuth } from "@/context/AuthContext";

const Me: React.FC = () => {
  const { player } = useAuth();

  return <MemberProfile player={player} isMe />;
};

export default Me;
