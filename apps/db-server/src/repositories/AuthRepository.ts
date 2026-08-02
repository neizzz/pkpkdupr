import type { Player } from "@pkpkdupr/shared/player";
import type { RawQueryResult } from "../db/client";

export type ExternalAuthProvider = "kakao" | "kakao-mock";

export interface OAuthLoginTransaction {
  id: string;
  provider: ExternalAuthProvider;
  stateHash: string;
  handoffHash: string | null;
  registrationHash: string | null;
  providerSubject: string | null;
  expiresAt: Date;
  stateConsumedAt: Date | null;
  handoffConsumedAt: Date | null;
  registrationConsumedAt: Date | null;
  createdAt: Date;
}

interface DbClient {
  execute(statement: { sql: string; args?: unknown[] }): Promise<RawQueryResult>;
  transaction(mode?: "write"): Promise<{
    execute(statement: { sql: string; args?: unknown[] }): Promise<RawQueryResult>;
    commit(): Promise<void>;
    close(): void;
  }>;
}

const toUnixSeconds = (date: Date) => Math.floor(date.getTime() / 1000);
const toDateOrNull = (value: unknown) =>
  value == null ? null : new Date(Number(value) * 1000);

const hydrateTransaction = (record: Record<string, unknown>): OAuthLoginTransaction => ({
  id: String(record.id),
  provider: record.provider as ExternalAuthProvider,
  stateHash: String(record.stateHash),
  handoffHash: record.handoffHash == null ? null : String(record.handoffHash),
  registrationHash:
    record.registrationHash == null ? null : String(record.registrationHash),
  providerSubject:
    record.providerSubject == null ? null : String(record.providerSubject),
  expiresAt: new Date(Number(record.expiresAt) * 1000),
  stateConsumedAt: toDateOrNull(record.stateConsumedAt),
  handoffConsumedAt: toDateOrNull(record.handoffConsumedAt),
  registrationConsumedAt: toDateOrNull(record.registrationConsumedAt),
  createdAt: new Date(Number(record.createdAt) * 1000),
});

const selectTransactionColumns = `
  id,
  provider,
  state_hash AS stateHash,
  handoff_hash AS handoffHash,
  registration_hash AS registrationHash,
  provider_subject AS providerSubject,
  expires_at AS expiresAt,
  state_consumed_at AS stateConsumedAt,
  handoff_consumed_at AS handoffConsumedAt,
  registration_consumed_at AS registrationConsumedAt,
  created_at AS createdAt`;

export class AuthRepository {
  constructor(private readonly client: DbClient) {}

  async createOAuthTransaction(input: {
    id: string;
    provider: ExternalAuthProvider;
    stateHash: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<OAuthLoginTransaction> {
    await this.client.execute({
      sql: `INSERT INTO oauth_login_transactions
              (id, provider, state_hash, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        input.id,
        input.provider,
        input.stateHash,
        toUnixSeconds(input.expiresAt),
        toUnixSeconds(input.createdAt),
      ],
    });
    return {
      ...input,
      handoffHash: null,
      registrationHash: null,
      providerSubject: null,
      stateConsumedAt: null,
      handoffConsumedAt: null,
      registrationConsumedAt: null,
    };
  }

  async completeOAuthCallback(input: {
    stateHash: string;
    providerSubject: string;
    handoffHash: string;
    now: Date;
    expiresAt: Date;
  }): Promise<OAuthLoginTransaction> {
    const transaction = await this.client.transaction("write");
    let committed = false;
    try {
      const result = await transaction.execute({
        sql: `SELECT ${selectTransactionColumns}
              FROM oauth_login_transactions
              WHERE state_hash = ? FOR UPDATE`,
        args: [input.stateHash],
      });
      const record = result.rows[0] as Record<string, unknown> | undefined;
      if (!record) throw new Error("OAUTH_STATE_NOT_FOUND");
      const existing = hydrateTransaction(record);
      if (existing.stateConsumedAt || existing.expiresAt <= input.now) {
        throw new Error("OAUTH_STATE_INVALID");
      }

      await transaction.execute({
        sql: `UPDATE oauth_login_transactions
              SET provider_subject = ?, handoff_hash = ?, state_consumed_at = ?, expires_at = ?
              WHERE id = ?`,
        args: [
          input.providerSubject,
          input.handoffHash,
          toUnixSeconds(input.now),
          toUnixSeconds(input.expiresAt),
          existing.id,
        ],
      });
      await transaction.commit();
      committed = true;
      return {
        ...existing,
        providerSubject: input.providerSubject,
        handoffHash: input.handoffHash,
        stateConsumedAt: input.now,
        expiresAt: input.expiresAt,
      };
    } finally {
      if (!committed) transaction.close();
    }
  }

  async consumeOAuthHandoff(input: {
    handoffHash: string;
    registrationHash: string;
    now: Date;
  }): Promise<{ transaction: OAuthLoginTransaction; playerId: string | null }> {
    const transaction = await this.client.transaction("write");
    let committed = false;
    try {
      const result = await transaction.execute({
        sql: `SELECT ${selectTransactionColumns}
              FROM oauth_login_transactions
              WHERE handoff_hash = ? FOR UPDATE`,
        args: [input.handoffHash],
      });
      const record = result.rows[0] as Record<string, unknown> | undefined;
      if (!record) throw new Error("OAUTH_HANDOFF_NOT_FOUND");
      const existing = hydrateTransaction(record);
      if (
        existing.handoffConsumedAt ||
        existing.expiresAt <= input.now ||
        !existing.providerSubject
      ) {
        throw new Error("OAUTH_HANDOFF_INVALID");
      }

      const identityResult = await transaction.execute({
        sql: `SELECT player_id AS playerId
              FROM player_auth_identities
              WHERE provider = ? AND subject = ? FOR UPDATE`,
        args: [existing.provider, existing.providerSubject],
      });
      const playerId = identityResult.rows[0]?.playerId as string | undefined;
      await transaction.execute({
        sql: `UPDATE oauth_login_transactions
              SET handoff_consumed_at = ?, registration_hash = ?
              WHERE id = ?`,
        args: [
          toUnixSeconds(input.now),
          playerId ? null : input.registrationHash,
          existing.id,
        ],
      });
      await transaction.commit();
      committed = true;
      return {
        transaction: {
          ...existing,
          handoffConsumedAt: input.now,
          registrationHash: playerId ? null : input.registrationHash,
        },
        playerId: playerId ?? null,
      };
    } finally {
      if (!committed) transaction.close();
    }
  }

  async completeOAuthOnboarding(input: {
    registrationHash: string;
    now: Date;
    player: Player & { passwordHash: string; isFirstLogin: boolean };
    identityId: string;
    creationLogId: string;
  }): Promise<Player> {
    const transaction = await this.client.transaction("write");
    let committed = false;
    try {
      const result = await transaction.execute({
        sql: `SELECT ${selectTransactionColumns}
              FROM oauth_login_transactions
              WHERE registration_hash = ? FOR UPDATE`,
        args: [input.registrationHash],
      });
      const record = result.rows[0] as Record<string, unknown> | undefined;
      if (!record) throw new Error("OAUTH_REGISTRATION_NOT_FOUND");
      const oauth = hydrateTransaction(record);
      if (
        oauth.registrationConsumedAt ||
        oauth.expiresAt <= input.now ||
        !oauth.providerSubject
      ) {
        throw new Error("OAUTH_REGISTRATION_INVALID");
      }

      const duplicate = await transaction.execute({
        sql: "SELECT id FROM players WHERE username = ? FOR UPDATE",
        args: [input.player.username],
      });
      if (duplicate.rows.length) throw new Error("USERNAME_CONFLICT");

      const existingIdentity = await transaction.execute({
        sql: `SELECT player_id AS playerId FROM player_auth_identities
              WHERE provider = ? AND subject = ? FOR UPDATE`,
        args: [oauth.provider, oauth.providerSubject],
      });
      if (existingIdentity.rows.length) throw new Error("OAUTH_IDENTITY_EXISTS");

      const nowSeconds = toUnixSeconds(input.player.createdAt);
      await transaction.execute({
        sql: `INSERT INTO players
                (id, username, dupr_rating, gender, status, avatar_url, affiliations_json,
                 status_message, status_message_background_color, password_hash, is_first_login,
                 created_at, updated_at)
              VALUES (?, ?, NULL, ?, ?, NULL, '[]', NULL, NULL, ?, ?, ?, ?)`,
        args: [
          input.player.id,
          input.player.username,
          input.player.gender,
          input.player.status,
          input.player.passwordHash,
          input.player.isFirstLogin,
          nowSeconds,
          toUnixSeconds(input.player.updatedAt),
        ],
      });
      await transaction.execute({
        sql: `INSERT INTO player_auth_identities
                (id, player_id, provider, subject, created_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: [
          input.identityId,
          input.player.id,
          oauth.provider,
          oauth.providerSubject,
          nowSeconds,
        ],
      });
      await transaction.execute({
        sql: `INSERT INTO player_creation_logs
                (id, player_id, created_by_player_id, created_by_username, creation_source, created_at)
              VALUES (?, ?, ?, ?, 'self_register', ?)`,
        args: [
          input.creationLogId,
          input.player.id,
          input.player.id,
          input.player.username,
          nowSeconds,
        ],
      });
      await transaction.execute({
        sql: `UPDATE oauth_login_transactions
              SET registration_consumed_at = ? WHERE id = ?`,
        args: [toUnixSeconds(input.now), oauth.id],
      });
      await transaction.commit();
      committed = true;
      return input.player;
    } finally {
      if (!committed) transaction.close();
    }
  }
}
