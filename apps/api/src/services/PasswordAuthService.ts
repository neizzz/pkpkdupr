import type { Player } from "@pkpkdupr/shared/player";
import { AuthService, type UserCredentials } from "./AuthService";

export class PasswordAuthService {
  constructor(private readonly accounts: AuthService) {}

  async register(credentials: UserCredentials) {
    return await this.accounts.register(credentials);
  }

  async login(username: string, password: string, rememberMe = false) {
    return await this.accounts.login(username, password, rememberMe);
  }

  async loginAdmin(username: string, password: string) {
    const result = await this.accounts.login(username, password, true);
    if (!result.isAdmin) {
      throw new Error("관리자 권한이 필요합니다.");
    }
    return result;
  }

  async changePassword(
    playerId: string,
    currentPassword: string | undefined,
    newPassword: string,
  ) {
    await this.accounts.changePassword(playerId, currentPassword, newPassword);
  }

  async initAdmin(): Promise<Player> {
    return await this.accounts.initAdmin();
  }
}
