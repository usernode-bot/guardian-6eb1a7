export type GuardianTier = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';
export type GuardianStatus = 'AVAILABLE' | 'RESERVED' | 'MINTED' | 'EXPIRED';
export type AuditEvent = 'ASSIGNED' | 'RESERVED' | 'MINTED' | 'EXPIRED' | 'RELEASED';

export interface Guardian {
  id: number;
  name: string;
  title: string;
  tier: GuardianTier;
  lore: string;
  image: string;
  status: GuardianStatus;
  created_at: string;
}

export interface GuardianOwnership {
  id: number;
  guardian_id: number;
  wallet_address: string;
  user_id: number;
  username: string;
  minted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuardianReservation {
  id: number;
  guardian_id: number;
  wallet_address: string;
  user_id: number;
  username: string;
  expires_at: string;
  created_at: string;
}

export interface GuardianAuditLog {
  id: number;
  guardian_id: number;
  wallet_address: string;
  user_id: number;
  username: string;
  event: AuditEvent;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface AllocationStrategy {
  selectGuardian(availableGuardians: Guardian[]): Guardian | null;
}

export interface SupplyStats {
  total: number;
  available: number;
  reserved: number;
  minted: number;
  byTier: Record<GuardianTier, {
    available: number;
    reserved: number;
    minted: number;
  }>;
}

export interface AssignGuardianResult {
  guardian: Guardian;
  reservation: GuardianReservation;
}

export interface CurrentGuardianResponse {
  guardian: Guardian | null;
  status: GuardianStatus | null;
  reservation: {
    expiresAt: string;
    expiresIn: number;
  } | null;
  ownership: GuardianOwnership | null;
}
