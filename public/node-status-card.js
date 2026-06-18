/**
 * @typedef {Object} NodeStatus
 * @property {number} peers
 * @property {string} uptime
 * @property {boolean} fgActive
 */

/**
 * Creates and returns a NodeStatusCard component element.
 * @param {NodeStatus} nodeStatus
 * @returns {HTMLElement}
 */
function createNodeStatusCard(nodeStatus) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-4 rounded-lg border p-4 bg-zinc-900 border-zinc-800 mt-6';

  // Peers row
  const peersRow = document.createElement('div');
  peersRow.className = 'flex justify-between items-center';

  const peersLabel = document.createElement('span');
  peersLabel.className = 'text-sm text-zinc-400';
  peersLabel.textContent = 'Peers';

  const peersValue = document.createElement('span');
  peersValue.className = 'text-sm font-semibold text-zinc-100';
  peersValue.textContent = nodeStatus.peers;

  peersRow.appendChild(peersLabel);
  peersRow.appendChild(peersValue);

  // Uptime row
  const uptimeRow = document.createElement('div');
  uptimeRow.className = 'flex justify-between items-center';

  const uptimeLabel = document.createElement('span');
  uptimeLabel.className = 'text-sm text-zinc-400';
  uptimeLabel.textContent = 'Uptime';

  const uptimeValue = document.createElement('span');
  uptimeValue.className = 'text-sm font-semibold text-zinc-100';
  uptimeValue.textContent = nodeStatus.uptime;

  uptimeRow.appendChild(uptimeLabel);
  uptimeRow.appendChild(uptimeValue);

  // FG Status row
  const fgRow = document.createElement('div');
  fgRow.className = 'flex justify-between items-center';

  const fgLabel = document.createElement('span');
  fgLabel.className = 'text-sm text-zinc-400';
  fgLabel.textContent = 'Foreground Status';

  const fgBadge = document.createElement('div');
  const isActive = nodeStatus.fgActive;
  fgBadge.className = `px-3 py-1 rounded-full text-xs font-semibold ${
    isActive ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
  }`;
  fgBadge.textContent = isActive ? 'Active' : 'Inactive';

  fgRow.appendChild(fgLabel);
  fgRow.appendChild(fgBadge);

  container.appendChild(peersRow);
  container.appendChild(uptimeRow);
  container.appendChild(fgRow);

  return container;
}

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = createNodeStatusCard;
}
