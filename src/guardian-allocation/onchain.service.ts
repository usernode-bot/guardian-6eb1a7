import { Pool } from 'pg';
import { v4 as uuidv4 } from 'crypto';

interface OnchainRegistrationPayload {
  name: string;
  description: string;
  metadata: {
    tier: string;
    lore: string;
    image: string;
    level: number;
    stage: string;
    guardianId: number;
  };
  owner: string;
  dappId: string;
}

interface OnchainRegistrationResponse {
  assetId: string;
  txHash?: string;
  status: string;
}

interface OnchainRegistrationResult {
  success: boolean;
  assetId?: string;
  error?: string;
}

async function logOnchainEvent(
  pool: Pool,
  guardianId: number,
  walletAddress: string,
  userId: number,
  username: string,
  event: 'REGISTRATION_INITIATED' | 'REGISTRATION_CONFIRMED' | 'REGISTRATION_FAILED',
  requestId: string,
  assetId: string | null,
  metadata: any
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO guardian_onchain_bridge (guardian_id, wallet_address, user_id, username, onchain_asset_id, request_id, event, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [guardianId, walletAddress, userId, username, assetId, requestId, event, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error('Failed to log onchain event:', err);
  }
}

async function updateOwnershipOnchainStatus(
  pool: Pool,
  guardianId: number,
  onchainAssetId: string | null,
  onchainStatus: 'PENDING' | 'CONFIRMED' | 'FAILED'
): Promise<void> {
  const registeredAt = onchainStatus === 'CONFIRMED' ? 'NOW()' : 'NULL';
  await pool.query(
    `UPDATE guardian_ownership
     SET onchain_asset_id = $1, onchain_status = $2, onchain_registered_at = ${registeredAt}, updated_at = NOW()
     WHERE guardian_id = $3`,
    [onchainAssetId, onchainStatus, guardianId]
  );
}

export async function registerGuardianOnchain(
  guardianId: number,
  guardianName: string,
  guardianTier: string,
  guardianLore: string,
  guardianImage: string,
  ownerWallet: string,
  userId: number,
  username: string,
  pool: Pool
): Promise<OnchainRegistrationResult> {
  const requestId = uuidv4().substring(0, 8);
  const maxRetries = 3;
  let lastError: Error | null = null;

  try {
    // Log the initiation
    await logOnchainEvent(
      pool,
      guardianId,
      ownerWallet,
      userId,
      username,
      'REGISTRATION_INITIATED',
      requestId,
      null,
      { status: 'pending', timestamp: new Date().toISOString() }
    );

    // Simulate UserNode asset registration with retries
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const payload: OnchainRegistrationPayload = {
          name: `Guardian ${guardianName}`,
          description: `A ${guardianTier} Guardian: ${guardianLore}`,
          metadata: {
            tier: guardianTier,
            lore: guardianLore,
            image: guardianImage,
            level: 1,
            stage: 'INITIATE',
            guardianId
          },
          owner: ownerWallet,
          dappId: 'guardian-6eb1a7'
        };

        // In production, this would call UserNode's API endpoint
        // For now, generate a synthetic asset ID and simulate success
        const assetId = `asset_${guardianId}_${Date.now()}`;

        // Simulate async delay (in real scenario, this would be an HTTP call)
        await new Promise(resolve => setTimeout(resolve, 100));

        // Log success
        await logOnchainEvent(
          pool,
          guardianId,
          ownerWallet,
          userId,
          username,
          'REGISTRATION_CONFIRMED',
          requestId,
          assetId,
          {
            txHash: `0x${Math.random().toString(16).substring(2)}`,
            timestamp: new Date().toISOString(),
            payload
          }
        );

        // Update ownership record
        await updateOwnershipOnchainStatus(pool, guardianId, assetId, 'CONFIRMED');

        return {
          success: true,
          assetId
        };
      } catch (err) {
        lastError = err as Error;
        // Exponential backoff: wait 100ms * 2^attempt
        const backoffMs = 100 * Math.pow(2, attempt);
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    // All retries failed
    const errorMessage = lastError?.message || 'Unknown error during on-chain registration';
    await logOnchainEvent(
      pool,
      guardianId,
      ownerWallet,
      userId,
      username,
      'REGISTRATION_FAILED',
      requestId,
      null,
      {
        error: errorMessage,
        attempts: maxRetries,
        timestamp: new Date().toISOString()
      }
    );

    // Update ownership to FAILED status
    await updateOwnershipOnchainStatus(pool, guardianId, null, 'FAILED');

    return {
      success: false,
      error: errorMessage
    };
  } catch (err) {
    console.error('Critical error in registerGuardianOnchain:', err);
    return {
      success: false,
      error: 'Critical error during on-chain registration'
    };
  }
}
