export type GuardianTier = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';

export interface Guardian {
  id: string;
  name: string;
  title: string;
  tier: GuardianTier;
  lore: string;
  image: string;
  allocated: boolean;
  owner?: string;
}

export interface GuardianMetadata {
  id: string;
  name: string;
  tier: GuardianTier;
  fgHours: number;
  peerCount: number;
  createdAt: number;
}

export interface UserNodeContext {
  fgHours: number;
  peerCount: number;
}
