import type { Player } from "@pkpkdupr/shared/player";
import type { RawQueryResult } from "../db/client";

export type ExternalAuthProvider = "kakao" | "kakao-mock";

export interface OAuthLoginTransaction {
  id: string;
  provider: ExternalAuthProvider;
  stateHash: string;
  persistentSessionRequested: boolean;
  privacyPolicyVersion: string | null;
  privacyPolicyAgreedAt: Date | null;
  profileDisclosureAgreedAt: Date | null;
  handoffHash: string | null;
  registrationHash: string | null;
  providerSubject: string | null;
  legalName: string | null;
  legalGender: "M" | "F" | null;
  legalBirthDate: string | null;
  expiresAt: Date;
  stateConsumedAt: Date | null;
  handoffConsumedAt: Date | null;
  registrationConsumedAt: Date | null;
  createdAt: Date;
}

export interface PlayerDeviceSession {
  id: string;
  playerId: string;
  tokenHash: string;
  provider: ExternalAuthProvider;
  isPersistent: boolean;
  expiresAt: Date;
  revokedAt: Date | null;
  lastSeenAt: Date;
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
  persistentSessionRequested: Boolean(record.persistentSessionRequested),
  privacyPolicyVersion:
    record.privacyPolicyVersion == null ? null : String(record.privacyPolicyVersion),
  privacyPolicyAgreedAt: toDateOrNull(record.privacyPolicyAgreedAt),
  profileDisclosureAgreedAt: toDateOrNull(record.profileDisclosureAgreedAt),
  handoffHash: record.handoffHash == null ? null : String(record.handoffHash),
  registrationHash:
    record.registrationHash == null ? null : String(record.registrationHash),
  providerSubject:
    record.providerSubject == null ? null : String(record.providerSubject),
  legalName: record.legalName == null ? null : String(record.legalName),
  legalGender:
    record.legalGender === "M" || record.legalGender === "F"
      ? record.legalGender
      : null,
  legalBirthDate:
    record.legalBirthDate == null ? null : String(record.legalBirthDate),
  expiresAt: new Date(Number(record.expiresAt) * 1000),
  stateConsumedAt: toDateOrNull(record.stateConsumedAt),
  handoffConsumedAt: toDateOrNull(record.handoffConsumedAt),
  registrationConsumedAt: toDateOrNull(record.registrationConsumedAt),
  createdAt: new Date(Number(record.createdAt) * 1000),
});

const hydrateDeviceSession = (
  record: Record<string, unknown>,
): PlayerDeviceSession => ({
  id: String(record.id),
  playerId: String(record.playerId),
  tokenHash: String(record.tokenHash),
  provider: record.provider as ExternalAuthProvider,
  isPersistent: Boolean(record.isPersistent),
  expiresAt: new Date(Number(record.expiresAt) * 1000),
  revokedAt: toDateOrNull(record.revokedAt),
  lastSeenAt: new Date(Number(record.lastSeenAt) * 1000),
  createdAt: new Date(Number(record.createdAt) * 1000),
});

const selectTransactionColumns = `
  id,
  provider,
  state_hash AS stateHash,
  persistent_session_requested AS persistentSessionRequested,
  privacy_policy_version AS privacyPolicyVersion,
  privacy_policy_agreed_at AS privacyPolicyAgreedAt,
  profile_disclosure_agreed_at AS profileDisclosureAgreedAt,
  handoff_hash AS handoffHash,
  registration_hash AS registrationHash,
  provider_subject AS providerSubject,
  legal_name AS legalName,
  legal_gender AS legalGender,
  legal_birth_date AS legalBirthDate,
  expires_at AS expiresAt,
  state_consumed_at AS stateConsumedAt,
  handoff_consumed_at AS handoffConsumedAt,
  registration_consumed_at AS registrationConsumedAt,
  created_at AS createdAt`;

const selectDeviceSessionColumns = `
  id,
  player_id AS playerId,
  token_hash AS tokenHash,
  provider,
  is_persistent AS isPersistent,
  expires_at AS expiresAt,
  revoked_at AS revokedAt,
  last_seen_at AS lastSeenAt,
  created_at AS createdAt`;

export class AuthRepository {
  constructor(private readonly client: DbClient) {}

  async createOAuthTransaction(input: {
    id: string;
    provider: ExternalAuthProvider;
    stateHash: string;
    persistentSessionRequested?: boolean;
    privacyPolicyVersion?: string;
    privacyPolicyAgreedAt?: Date;
    profileDisclosureAgreedAt?: Date;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<OAuthLoginTransaction> {
    await this.client.execute({
      sql: `INSERT INTO oauth_login_transactions
              (id, provider, state_hash, persistent_session_requested, privacy_policy_version,
               privacy_policy_agreed_at, profile_disclosure_agreed_at, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        input.id,
        input.provider,
        input.stateHash,
        input.persistentSessionRequested === true,
        input.privacyPolicyVersion ?? null,
        input.privacyPolicyAgreedAt
          ? toUnixSeconds(input.privacyPolicyAgreedAt)
          : null,
        input.profileDisclosureAgreedAt
          ? toUnixSeconds(input.profileDisclosureAgreedAt)
          : null,
        toUnixSeconds(input.expiresAt),
        toUnixSeconds(input.createdAt),
      ],
    });
    return {
      ...input,
      persistentSessionRequested: input.persistentSessionRequested === true,
      privacyPolicyVersion: input.privacyPolicyVersion ?? null,
      privacyPolicyAgreedAt: input.privacyPolicyAgreedAt ?? null,
      profileDisclosureAgreedAt: input.profileDisclosureAgreedAt ?? null,
      handoffHash: null,
      registrationHash: null,
      providerSubject: null,
      legalName: null,
      legalGender: null,
      legalBirthDate: null,
      stateConsumedAt: null,
      handoffConsumedAt: null,
      registrationConsumedAt: null,
    };
  }

  async createDeviceSession(input: {
    id: string;
    playerId: string;
    tokenHash: string;
    provider: ExternalAuthProvider;
    isPersistent: boolean;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<PlayerDeviceSession> {
    const transaction = await this.client.transaction("write");
    let committed = false;
    try {
      await transaction.execute({
        sql: "SELECT id FROM players WHERE id = ? FOR UPDATE",
        args: [input.playerId],
      });
      if (input.isPersistent) {
        await transaction.execute({
          sql: `UPDATE player_device_sessions
                SET revoked_at = ?
                WHERE player_id = ? AND is_persistent = TRUE AND revoked_at IS NULL`,
          args: [toUnixSeconds(input.createdAt), input.playerId],
        });
      }
      await transaction.execute({
        sql: `INSERT INTO player_device_sessions
                (id, player_id, token_hash, provider, is_persistent, expires_at, revoked_at, last_seen_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        args: [
          input.id,
          input.playerId,
          input.tokenHash,
          input.provider,
          input.isPersistent,
          toUnixSeconds(input.expiresAt),
          toUnixSeconds(input.createdAt),
          toUnixSeconds(input.createdAt),
        ],
      });
      await transaction.commit();
      committed = true;
      return { ...input, revokedAt: null, lastSeenAt: input.createdAt };
    } finally {
      if (!committed) transaction.close();
    }
  }

  async findActiveDeviceSession(tokenHash: string, now: Date) {
    const result = await this.client.execute({
      sql: `SELECT ${selectDeviceSessionColumns}
            FROM player_device_sessions
            WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
      args: [tokenHash, toUnixSeconds(now)],
    });
    const record = result.rows[0] as Record<string, unknown> | undefined;
    if (!record) return null;
    await this.client.execute({
      sql: "UPDATE player_device_sessions SET last_seen_at = ? WHERE token_hash = ?",
      args: [toUnixSeconds(now), tokenHash],
    });
    return { ...hydrateDeviceSession(record), lastSeenAt: now };
  }

  async revokeDeviceSession(tokenHash: string, now: Date): Promise<boolean> {
    const result = await this.client.execute({
      sql: `UPDATE player_device_sessions
            SET revoked_at = ?
            WHERE token_hash = ? AND revoked_at IS NULL`,
      args: [toUnixSeconds(now), tokenHash],
    });
    return Number(result.rowsAffected ?? 0) > 0;
  }

  async completeOAuthCallback(input: {
    stateHash: string;
    providerSubject: string;
    legalName?: string;
    legalGender?: "M" | "F";
    legalBirthDate?: string;
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
              SET provider_subject = ?, legal_name = ?, legal_gender = ?, legal_birth_date = ?,
                  handoff_hash = ?, state_consumed_at = ?, expires_at = ?
              WHERE id = ?`,
        args: [
          input.providerSubject,
          input.legalName ?? null,
          input.legalGender ?? null,
          input.legalBirthDate ?? null,
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
        legalName: input.legalName ?? null,
        legalGender: input.legalGender ?? null,
        legalBirthDate: input.legalBirthDate ?? null,
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
      if (
        !playerId &&
        (!existing.legalName ||
          !existing.legalGender ||
          !existing.legalBirthDate)
      ) {
        throw new Error("OAUTH_VERIFIED_PROFILE_REQUIRED");
      }
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
    consentId: string;
  }): Promise<{
    player: Player;
    provider: ExternalAuthProvider;
    persistentSessionRequested: boolean;
  }> {
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
        !oauth.providerSubject ||
        !oauth.legalName ||
        !oauth.legalGender ||
        !oauth.legalBirthDate
      ) {
        throw new Error("OAUTH_REGISTRATION_INVALID");
      }

      if (
        input.player.username !== oauth.legalName ||
        input.player.gender !== oauth.legalGender ||
        input.player.birthDate !== oauth.legalBirthDate
      ) {
        throw new Error("OAUTH_VERIFIED_PROFILE_MISMATCH");
      }

      const existingIdentity = await transaction.execute({
        sql: `SELECT player_id AS playerId FROM player_auth_identities
              WHERE provider = ? AND subject = ? FOR UPDATE`,
        args: [oauth.provider, oauth.providerSubject],
      });
      if (existingIdentity.rows.length) throw new Error("OAUTH_IDENTITY_EXISTS");

      const nowSeconds = toUnixSeconds(input.player.createdAt);
      await transaction.execute({
        sql: `INSERT INTO players
                (id, username, dupr_rating, gender, birth_date, status, avatar_url, affiliations_json,
                 status_message, status_message_background_color, password_hash, is_first_login, identity_verified_at,
                 created_at, updated_at)
              VALUES (?, ?, NULL, ?, ?, ?, NULL, '[]', NULL, NULL, ?, ?, ?, ?, ?)`,
        args: [
          input.player.id,
          input.player.username,
          input.player.gender,
          input.player.birthDate ?? null,
          input.player.status,
          input.player.passwordHash,
          input.player.isFirstLogin,
          toUnixSeconds(input.now),
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
      if (oauth.privacyPolicyVersion && oauth.privacyPolicyAgreedAt) {
        await transaction.execute({
          sql: `INSERT INTO player_privacy_policy_consents
                  (id, player_id, policy_version, agreed_at)
                VALUES (?, ?, ?, ?)`,
          args: [
            input.consentId,
            input.player.id,
            oauth.privacyPolicyVersion,
            toUnixSeconds(oauth.privacyPolicyAgreedAt),
          ],
        });
      }
      await transaction.execute({
        sql: `UPDATE oauth_login_transactions
              SET registration_consumed_at = ?, legal_name = NULL, legal_gender = NULL,
                  legal_birth_date = NULL WHERE id = ?`,
        args: [toUnixSeconds(input.now), oauth.id],
      });
      await transaction.commit();
      committed = true;
      return {
        player: input.player,
        provider: oauth.provider,
        persistentSessionRequested: oauth.persistentSessionRequested,
      };
    } finally {
      if (!committed) transaction.close();
    }
  }
}
