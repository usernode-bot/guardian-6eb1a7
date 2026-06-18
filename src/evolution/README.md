# Guardian Evolution Engine

The Evolution Engine powers the dynamic progression system for Guardians based on user network contribution metrics.

## Overview

Guardians evolve through five stages as users accumulate:
- FG Hours (network participation time)
- Peer Count (network connections)
- Uptime (network availability percentage)

These metrics combine into a contribution score that drives level progression, stage evolution, title unlocks, and visual trait changes.

## Services

### score.service.ts
Calculates contribution score from metrics:
- `calculateContributionScore(metrics)` - Formula: (FG Hours × 40) + (Peer Count × 20) + (Uptime × 40)
- `recalculateScoreForGuardian(guardianId, metrics, pool)` - Updates a guardian's score in the database

### level.service.ts
Manages level progression (1-10):
- `calculateLevel(score)` - Returns level for a given score
- `getLevelThreshold(level)` - Returns min/max score range for a level
- `checkLevelProgression(oldScore, newScore)` - Detects level changes

### stages.service.ts
Manages stage progression (INITIATE → MYTHIC):
- `calculateStage(score)` - Returns stage for a given score
- `getStageThreshold(stage)` - Returns min/max score range for a stage
- `checkStageProgression(oldScore, newScore)` - Detects stage changes

### title.service.ts
Manages title unlocks based on score:
- `calculateTitle(score)` - Returns title for a given score
- `getTitleThreshold(title)` - Returns score range for a title

### traits.service.ts
Manages visual traits (aura, armor, weapon, emoji) by stage:
- `getTraitsForStage(stage)` - Returns trait configuration for a stage
- `getTraitsForScore(score)` - Returns traits for a score-derived stage

### evolution.service.ts
Main orchestration service:
- `updateEvolution(guardianId, metrics, pool)` - Full workflow: calculates score, checks level/stage/title changes, audits history
- `getEvolution(guardianId, pool)` - Fetches current evolution record

### leaderboard.service.ts
Ranking and leaderboard queries:
- `getTopContributors(limit, offset, pool)` - Fetches top N guardians
- `getLeaderboard(limit, offset, pool)` - Returns full leaderboard with metadata
- `getGuardianRank(guardianId, pool)` - Returns a guardian's rank

## Data Model

**guardian_evolution** - One record per Guardian
- contribution_score, level, stage, title
- aura, armor_tier, weapon_tier (visual traits)
- rank, last_score_recalc_at
- created_at, updated_at

**guardian_evolution_history** - Immutable audit log of stage transitions
- old_stage, new_stage, old_level, new_level
- score_at_transition, created_at

## Thresholds

### Stages (contribution score)
- INITIATE: 0-100
- AWAKENED: 101-250
- ASCENDANT: 251-500
- GUARDIAN: 501-1000
- MYTHIC: 1001+

### Levels (contribution score)
- Level 1: 0-100
- Level 2: 101-250
- ...
- Level 10: 10001+

### Titles
- Node Wanderer: 0-100
- Network Scout: 101-250
- Protocol Guardian: 251-500
- Core Defender: 501-1000
- Legend Keeper: 1001+

## Usage Example

```typescript
import { updateEvolution } from './evolution.service';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Update a guardian's evolution
const result = await updateEvolution(
  guardianId,
  { fgHours: 50, peerCount: 25, uptime: 95 },
  pool
);

console.log(`Guardian evolved from ${result.oldStage} to ${result.newStage}`);
console.log(`Score: ${result.oldScore} → ${result.newScore}`);
```

## Testing

Run tests with:
```bash
npm test -- src/evolution/__tests__
```

Tests cover:
- Score calculation and validation
- Level progression boundaries
- Stage progression boundaries
- Title unlocks
- Trait lookup by stage
- Full evolution workflow with database persistence
- Leaderboard queries and ranking
