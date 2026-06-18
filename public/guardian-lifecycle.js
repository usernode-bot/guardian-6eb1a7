/**
 * @typedef {Object} StageInfo
 * @property {string} stage - "EGG" | "BABY" | "GUARDIAN" | "EVOLVED"
 * @property {string} emoji
 * @property {number} minHours
 * @property {number} maxHours
 */

/**
 * @typedef {Object} ProgressInfo
 * @property {string} currentStage - "EGG" | "BABY" | "GUARDIAN" | "EVOLVED"
 * @property {string} nextStage - "EGG" | "BABY" | "GUARDIAN" | "EVOLVED" | null
 * @property {number} hoursAtCurrentStage
 * @property {number} hoursUntilNextStage
 * @property {number} percentProgress
 */

const STAGE_CONFIG = [
  { stage: 'EGG', emoji: '🥚', minHours: 0, maxHours: 1 },
  { stage: 'BABY', emoji: '🤖', minHours: 1, maxHours: 10 },
  { stage: 'GUARDIAN', emoji: '🦾', minHours: 10, maxHours: 50 },
  { stage: 'EVOLVED', emoji: '⚡🤖', minHours: 50, maxHours: Infinity }
];

/**
 * Determine the Guardian's stage based on total FG hours.
 * @param {number} totalFGHours
 * @returns {"EGG" | "BABY" | "GUARDIAN" | "EVOLVED"}
 */
function getGuardianStage(totalFGHours) {
  if (totalFGHours < 1) return 'EGG';
  if (totalFGHours < 10) return 'BABY';
  if (totalFGHours < 50) return 'GUARDIAN';
  return 'EVOLVED';
}

/**
 * Get stage configuration by stage name.
 * @param {string} stage
 * @returns {StageInfo}
 */
function getStageInfo(stage) {
  const config = STAGE_CONFIG.find(s => s.stage === stage);
  if (!config) throw new Error(`Unknown stage: ${stage}`);
  return { ...config };
}

/**
 * Get progress information toward the next stage.
 * @param {number} totalFGHours
 * @returns {ProgressInfo}
 */
function getProgressToNextStage(totalFGHours) {
  const currentStage = getGuardianStage(totalFGHours);
  const currentConfig = getStageInfo(currentStage);

  let nextStage = null;
  let nextThreshold = Infinity;

  const nextConfig = STAGE_CONFIG.find(s => s.minHours > currentConfig.minHours);
  if (nextConfig) {
    nextStage = nextConfig.stage;
    nextThreshold = nextConfig.minHours;
  }

  const hoursAtCurrentStage = totalFGHours - currentConfig.minHours;
  const hoursUntilNextStage = nextThreshold === Infinity ? 0 : nextThreshold - totalFGHours;
  const percentProgress = nextThreshold === Infinity ? 100 : Math.max(0, Math.min(100, (hoursAtCurrentStage / (nextThreshold - currentConfig.minHours)) * 100));

  return {
    currentStage,
    nextStage,
    hoursAtCurrentStage,
    hoursUntilNextStage,
    percentProgress
  };
}

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getGuardianStage, getStageInfo, getProgressToNextStage };
}
