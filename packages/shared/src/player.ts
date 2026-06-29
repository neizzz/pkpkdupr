export type PlayerStatus = "active" | "inactive";

export type PlayerCreationSource =
  | "self_register"
  | "admin_register"
  | "bootstrap";

export interface PlayerDuprDoubles {
  mixed: number;
  men: number;
  women: number;
}

export interface PlayerDupr {
  total: number;
  doubles: PlayerDuprDoubles;
  singles: number;
}

export interface Player {
  id: string;
  username: string;
  duprRating: PlayerDupr;
  gender: "M" | "F";
  status: PlayerStatus;
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

export interface PlayerCreationLog {
  id: string;
  playerId: string;
  createdByPlayerId: string | null;
  createdByUsername: string;
  creationSource: PlayerCreationSource;
  createdAt: Date;
}

export interface PlayerStatusChangeLog {
  id: string;
  playerId: string;
  previousStatus: PlayerStatus;
  nextStatus: PlayerStatus;
  changedByPlayerId: string;
  changedByUsername: string;
  changedAt: Date;
}
