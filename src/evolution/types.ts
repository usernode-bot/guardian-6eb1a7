export type EvolutionStage = 'INITIATE' | 'AWAKENED' | 'ASCENDANT' | 'GUARDIAN' | 'MYTHIC';

export interface ContributionMetrics {
  fgHours: number;
  peerCount: number;
  uptime: number;
}

export interface GuardianEvolution {
  id: number;
  guardian_id: number;
  contribution_score: number;
  level: number;
  stage: EvolutionStage;
  title: string | null;
  aura: string | null;
  armor_tier: string | null;
  weapon_tier: string | null;
  rank: number | null;
  last_score_recalc_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuardianEvolutionHistory {
  id: number;
  guardian_id: number;
  old_stage: EvolutionStage;
  new_stage: EvolutionStage;
  old_level: number;
  new_level: number;
  score_at_transition: number;
  created_at: string;
}

export interface StageThreshold {
  stage: EvolutionStage;
  minScore: number;
  maxScore: number;
}

export interface TitleThreshold {
  title: string;
  minScore: number;
  maxScore: number;
}

export interface TraitConfig {
  stage: EvolutionStage;
  aura: string;
  armorTier: string;
  weaponTier: string;
  emoji: string;
}

export interface EvolutionUpdateResult {
  guardianId: number;
  oldScore: number;
  newScore: number;
  oldLevel: number;
  newLevel: number;
  oldStage: EvolutionStage;
  newStage: EvolutionStage;
  oldTitle: string;
  newTitle: string;
  levelChanged: boolean;
  stageChanged: boolean;
  titleChanged: boolean;
  updatedAt: Date;
}

export interface TopContributorEntry {
  rank: number;
  guardianId: number;
  guardianName: string;
  guardianTier: string;
  stage: EvolutionStage;
  contributionScore: number;
  level: number;
  title: string;
  username: string;
  walletAddress: string;
}

export interface LeaderboardResponse {
  entries: TopContributorEntry[];
  total: number;
  limit: number;
  offset: number;
}
