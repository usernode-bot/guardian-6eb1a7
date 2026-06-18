/**
 * @typedef {Object} Guardian
 * @property {string} id
 * @property {string} name
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

  // Name
  const name = document.createElement('h2');
  name.className = 'text-3xl font-bold text-zinc-100';
  name.textContent = guardian.name;

  container.appendChild(name);

  return container;
}

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = createGuardianHero;
}
