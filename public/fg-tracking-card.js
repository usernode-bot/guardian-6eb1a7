/**
 * @typedef {Object} FGData
 * @property {number} fgHours
 * @property {Array} sessions
 * @property {number} duration
 */

/**
 * Creates an FGTrackingCard component displaying real FG metrics.
 * @param {FGData} fgData
 * @returns {HTMLElement}
 */
function createFGTrackingCard(fgData) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-4 rounded-lg border p-4 bg-zinc-900 border-zinc-800 mt-6';

  // FG Hours row
  const hoursRow = document.createElement('div');
  hoursRow.className = 'flex justify-between items-center';

  const hoursLabel = document.createElement('span');
  hoursLabel.className = 'text-sm text-zinc-400';
  hoursLabel.textContent = 'FG Hours';

  const hoursValue = document.createElement('span');
  hoursValue.className = 'text-sm font-semibold text-zinc-100';
  hoursValue.textContent = `${fgData.fgHours.toFixed(1)}h`;

  hoursRow.appendChild(hoursLabel);
  hoursRow.appendChild(hoursValue);
  container.appendChild(hoursRow);

  // Sessions row
  const sessionsRow = document.createElement('div');
  sessionsRow.className = 'flex justify-between items-center';

  const sessionsLabel = document.createElement('span');
  sessionsLabel.className = 'text-sm text-zinc-400';
  sessionsLabel.textContent = 'Sessions';

  const sessionsValue = document.createElement('span');
  sessionsValue.className = 'text-sm font-semibold text-zinc-100';
  sessionsValue.textContent = String(fgData.sessions.length);

  sessionsRow.appendChild(sessionsLabel);
  sessionsRow.appendChild(sessionsValue);
  container.appendChild(sessionsRow);

  // Duration row
  const durationRow = document.createElement('div');
  durationRow.className = 'flex justify-between items-center';

  const durationLabel = document.createElement('span');
  durationLabel.className = 'text-sm text-zinc-400';
  durationLabel.textContent = 'Total Duration';

  const totalMinutes = fgData.duration;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const durationValue = document.createElement('span');
  durationValue.className = 'text-sm font-semibold text-zinc-100';
  durationValue.textContent = `${hours}h ${minutes}m`;

  durationRow.appendChild(durationLabel);
  durationRow.appendChild(durationValue);
  container.appendChild(durationRow);

  return container;
}

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = createFGTrackingCard;
}
