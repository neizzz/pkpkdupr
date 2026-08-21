import type { RawQueryResult } from "../db/client";

export interface PrivacyPolicyConsent {
  id: string;
  playerId: string;
  policyVersion: string;
  agreedAt: Date;
}

interface DbClient {
  execute(statement: { sql: string; args?: unknown[] }): Promise<RawQueryResult>;
}

const toUnixSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

const hydrateConsent = (
  record: Record<string, unknown>,
): PrivacyPolicyConsent => ({
  id: String(record.id),
  playerId: String(record.playerId),
  policyVersion: String(record.policyVersion),
  agreedAt: new Date(Number(record.agreedAt) * 1000),
});

export class PrivacyPolicyConsentRepository {
  constructor(private readonly client: DbClient) {}

  async findByPlayerAndVersion(
    playerId: string,
    policyVersion: string,
  ): Promise<PrivacyPolicyConsent | null> {
    const result = await this.client.execute({
      sql: `SELECT id,
                   player_id AS playerId,
                   policy_version AS policyVersion,
                   agreed_at AS agreedAt
            FROM player_privacy_policy_consents
            WHERE player_id = ? AND policy_version = ?
            LIMIT 1`,
      args: [playerId, policyVersion],
    });
    const record = result.rows[0] as Record<string, unknown> | undefined;
    return record ? hydrateConsent(record) : null;
  }

  async createIfMissing(input: PrivacyPolicyConsent): Promise<PrivacyPolicyConsent> {
    await this.client.execute({
      sql: `INSERT INTO player_privacy_policy_consents
              (id, player_id, policy_version, agreed_at)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE id = id`,
      args: [
        input.id,
        input.playerId,
        input.policyVersion,
        toUnixSeconds(input.agreedAt),
      ],
    });

    const consent = await this.findByPlayerAndVersion(
      input.playerId,
      input.policyVersion,
    );
    if (!consent) {
      throw new Error("개인정보 처리방침 동의 기록을 저장하지 못했습니다.");
    }
    return consent;
  }
}
