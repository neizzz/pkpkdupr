export interface Player {
  id: string;
  username: string;
  duprRating: number;
  gender: "M" | "F";
  //   birthYear?: number;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerProfile extends Player {
  //   bio?: string;
  //   city?: string;
  //   state?: string;
  totalMatches: number;
  winRate: number;
}
