/**
 * @typedef {Object} EligibilityCheck
 * @property {boolean} eligible
 * @property {string[]} reasons
 */

/**
 * Creates an EligibilityCard component showing eligibility status.
 * @param {EligibilityCheck} eligibility
 * @returns {HTMLElement}
 */
function createEligibilityCard(eligibility) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-2 rounded-lg border p-4 bg-zinc-900 border-zinc-800 mt-4';

  if (eligibility.eligible) {
    const message = document.createElement('div');
    message.className = 'text-green-400 font-semibold text-center';
    message.textContent = '✓ Eligible to mint';
    container.appendChild(message);
  } else {
    const message = document.createElement('div');
    message.className = 'text-red-400 font-semibold text-center';
    message.textContent = '✗ Not eligible';
    container.appendChild(message);

    if (eligibility.reasons.length > 0) {
      const reasons = document.createElement('div');
      reasons.className = 'text-sm text-zinc-400 text-center';
      reasons.textContent = eligibility.reasons.join(', ');
      container.appendChild(reasons);
    }
  }

  return container;
}

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = createEligibilityCard;
}
