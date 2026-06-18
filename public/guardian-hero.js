/**
 * @typedef {Object} Guardian
 * @property {string} id
 * @property {string} name
 * @property {"ONLINE" | "OFFLINE"} status
 * @property {number} totalFGHours
 */

/**
 * Creates and returns a GuardianHero component element.
 * @param {Guardian} guardian
 * @returns {HTMLElement}
 */
function createGuardianHero(guardian) {
  const container = document.createElement('div');
  container.className = 'flex flex-col items-center justify-center gap-6 py-12 px-4';

  // Calculate stage and get avatar emoji
  const stage = getGuardianStage(guardian.totalFGHours);
  const stageInfo = getStageInfo(stage);

  // Avatar (dynamic emoji based on stage)
  const avatar = document.createElement('div');
  avatar.className = 'text-8xl';
  avatar.textContent = stageInfo.emoji;

  // Name
  const name = document.createElement('h2');
  name.className = 'text-3xl font-bold text-zinc-100';
  name.textContent = guardian.name;

  // Status badge
  const statusBadge = document.createElement('div');
  const isOnline = guardian.status === 'ONLINE';
  statusBadge.className = `px-4 py-2 rounded-full text-sm font-semibold ${
    isOnline ? 'bg-green-600 text-white' : 'bg-zinc-700 text-zinc-100'
  }`;
  statusBadge.textContent = guardian.status;

  // Stage badge
  const stageBadge = document.createElement('div');
  stageBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-100';
  stageBadge.textContent = `Stage: ${stage}`;

  container.appendChild(avatar);
  container.appendChild(name);
  container.appendChild(statusBadge);
  container.appendChild(stageBadge);

  return container;
}

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = createGuardianHero;
}
