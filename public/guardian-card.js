/**
 * @typedef {Object} Guardian
 * @property {string} id
 * @property {string} name
 * @property {string} title
 * @property {string} tier
 * @property {string} lore
 * @property {string} image
 * @property {boolean} allocated
 */

/**
 * Creates a GuardianCard component.
 * @param {Guardian} guardian
 * @param {boolean} allocated
 * @param {() => void} [onClick]
 * @returns {HTMLElement}
 */
function createGuardianCard(guardian, allocated, onClick) {
  const container = document.createElement('div');
  container.className = `
    flex flex-col gap-3 rounded-lg border p-4 bg-zinc-900 border-zinc-800
    ${allocated ? 'opacity-50' : 'hover:border-purple-600 cursor-pointer'}
    transition-all
  `;

  if (onClick && !allocated) {
    container.addEventListener('click', onClick);
  }

  // Avatar
  const avatar = document.createElement('div');
  avatar.className = 'text-4xl text-center';
  avatar.textContent = guardian.image;
  container.appendChild(avatar);

  // Name
  const name = document.createElement('h3');
  name.className = 'text-sm font-semibold text-zinc-100 text-center';
  name.textContent = guardian.name;
  container.appendChild(name);

  // Title
  const title = document.createElement('p');
  title.className = 'text-xs text-zinc-400 text-center';
  title.textContent = guardian.title;
  container.appendChild(title);

  // Tier badge
  const tierBadge = document.createElement('div');
  tierBadge.className = 'flex justify-center mt-2';

  const badge = createTierBadge(guardian.tier);
  tierBadge.appendChild(badge);
  container.appendChild(tierBadge);

  // Lore
  const lore = document.createElement('p');
  lore.className = 'text-xs text-zinc-500 italic text-center mt-2';
  lore.textContent = guardian.lore;
  container.appendChild(lore);

  // Allocated indicator
  if (allocated) {
    const indicator = document.createElement('div');
    indicator.className = 'flex justify-center mt-2';
    indicator.textContent = '✓ Allocated';
    indicator.style.fontSize = '0.75rem';
    indicator.style.color = '#22c55e';
    container.appendChild(indicator);
  }

  return container;
}

/**
 * Creates a tier badge element.
 * @param {string} tier
 * @returns {HTMLElement}
 */
function createTierBadge(tier) {
  const tierColors = {
    COMMON: 'bg-zinc-700 text-zinc-100',
    RARE: 'bg-blue-600 text-blue-100',
    EPIC: 'bg-purple-600 text-purple-100',
    LEGENDARY: 'bg-yellow-600 text-yellow-100',
    MYTHIC: 'bg-gradient-to-r from-pink-600 to-purple-600 text-white',
  };

  const tierEmojis = {
    COMMON: '⚔️',
    RARE: '🗡️',
    EPIC: '⚡',
    LEGENDARY: '👑',
    MYTHIC: '🐉',
  };

  const tierPercentages = {
    COMMON: '60%',
    RARE: '24%',
    EPIC: '12%',
    LEGENDARY: '3.6%',
    MYTHIC: '0.4%',
  };

  const badge = document.createElement('span');
  const colorClass = tierColors[tier] || tierColors.COMMON;
  badge.className = `px-2 py-1 rounded-full text-xs font-semibold ${colorClass}`;
  badge.textContent = `${tierEmojis[tier]} ${tier} (${tierPercentages[tier]})`;

  return badge;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createGuardianCard, createTierBadge };
}
