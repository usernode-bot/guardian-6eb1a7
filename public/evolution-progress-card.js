/**
 * Creates and returns an EvolutionProgressCard component element.
 * @param {number} totalFGHours
 * @returns {HTMLElement}
 */
function createEvolutionProgressCard(totalFGHours) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-4 rounded-lg border p-4 bg-zinc-900 border-zinc-800 mt-6';

  // Get progress info
  const progress = getProgressToNextStage(totalFGHours);
  const currentStageInfo = getStageInfo(progress.currentStage);
  const nextStageInfo = progress.nextStage ? getStageInfo(progress.nextStage) : null;

  // Current Stage Header
  const headerRow = document.createElement('div');
  headerRow.className = 'flex flex-col items-center gap-2';

  const stageEmoji = document.createElement('span');
  stageEmoji.className = 'text-3xl';
  stageEmoji.textContent = currentStageInfo.emoji;

  const stageLabel = document.createElement('span');
  stageLabel.className = 'text-sm font-semibold text-zinc-100';
  stageLabel.textContent = `${progress.currentStage} Guardian`;

  headerRow.appendChild(stageEmoji);
  headerRow.appendChild(stageLabel);
  container.appendChild(headerRow);

  // Progress Bar
  const barContainer = document.createElement('div');
  barContainer.className = 'w-full bg-zinc-800 rounded-full h-2 overflow-hidden';

  const barFill = document.createElement('div');
  barFill.className = 'bg-green-500 h-full rounded-full transition-all duration-300';
  barFill.style.width = `${Math.min(progress.percentProgress, 100)}%`;

  barContainer.appendChild(barFill);
  container.appendChild(barContainer);

  // Progress Text and Badge Row
  const progressRow = document.createElement('div');
  progressRow.className = 'flex justify-between items-center';

  const progressText = document.createElement('span');
  progressText.className = 'text-sm text-zinc-400';
  if (progress.nextStage) {
    progressText.textContent = `${Math.ceil(progress.hoursUntilNextStage)} / ${nextStageInfo.maxHours - currentStageInfo.maxHours} hours until next stage`;
  } else {
    progressText.textContent = 'Max stage reached';
  }

  const percentageBadge = document.createElement('div');
  percentageBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-100';
  percentageBadge.textContent = `${Math.round(progress.percentProgress)}%`;

  progressRow.appendChild(progressText);
  progressRow.appendChild(percentageBadge);
  container.appendChild(progressRow);

  // Next Stage Preview
  if (nextStageInfo) {
    const nextRow = document.createElement('div');
    nextRow.className = 'flex flex-col items-center gap-1 pt-2';

    const nextLabel = document.createElement('span');
    nextLabel.className = 'text-xs text-zinc-400';
    nextLabel.textContent = 'Next Stage';

    const nextStage = document.createElement('span');
    nextStage.className = 'text-sm font-semibold text-zinc-100';
    nextStage.textContent = `${nextStageInfo.emoji} ${nextStageInfo.stage}`;

    nextRow.appendChild(nextLabel);
    nextRow.appendChild(nextStage);
    container.appendChild(nextRow);
  }

  return container;
}

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = createEvolutionProgressCard;
}
