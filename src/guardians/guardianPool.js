const { getTierByIndex, getTierEmoji } = require('./rarity.js');
const { getGuardianName } = require('../data/guardianNames.js');

const loreTitles = {
  COMMON: [
    'of the Forge',
    'of the Valley',
    'the Stalwart',
    'the Bold',
    'the Faithful',
    'the Keen',
  ],
  RARE: [
    'the Sage',
    'the Ascendant',
    'the Mystic',
    'of the Stars',
    'the Wise',
    'the Eternal',
  ],
  EPIC: [
    'the Sovereign',
    'the Infinite',
    'the Arcane',
    'the Celestial',
    'the Eternal Guardian',
    'the Radiant',
  ],
  LEGENDARY: [
    'the Immortal',
    'the Supreme',
    'the Transcendent',
    'the Void Wielder',
    'the Chronicle Keeper',
  ],
  MYTHIC: [
    'the Primordial',
    'the Cosmic Architect',
  ],
};

const loreSnippets = {
  COMMON: [
    'A steadfast protector of the network nodes.',
    'A reliable sentinel guarding the ledgers.',
    'A devoted keeper of the transaction flow.',
    'A tireless warden of the blockchain peace.',
    'A noble guardian of distributed harmony.',
    'A stalwart defender of peer consensus.',
  ],
  RARE: [
    'An ancient guardian blessed with cryptographic sight.',
    'A master of the consensus algorithm.',
    'A keeper of the sacred verification rituals.',
    'A guardian who commands respect across all nodes.',
    'An oracle of the distributed ledger.',
    'A sage who balances all network forces.',
  ],
  EPIC: [
    'A legendary guardian forged in the dawn of cryptography.',
    'A wielder of infinite computational power.',
    'A sentinel born from the stars of the blockchain realm.',
    'An eternal keeper of the most ancient protocols.',
    'A guardian whose presence stabilizes entire networks.',
    'A cosmic force of immutable truth and justice.',
  ],
  LEGENDARY: [
    'An immortal being transcending all network boundaries.',
    'The supreme guardian of all peer-to-peer realms.',
    'A transcendent force dwelling beyond mortal computation.',
    'The void wielder commanding the darkest cryptography.',
    'The keeper of all network chronicles and histories.',
  ],
  MYTHIC: [
    'The primordial force from which all networks were born.',
    'The cosmic architect who designed the ledger itself.',
  ],
};

function getTitle(tier, index) {
  const titles = loreTitles[tier];
  return `Guardian ${titles[index % titles.length]}`;
}

function getLore(tier, index) {
  const snippets = loreSnippets[tier];
  return snippets[index % snippets.length];
}

let guardianPool = null;

function generateGuardianPool() {
  if (guardianPool) {
    return guardianPool;
  }

  guardianPool = [];

  for (let i = 0; i < 500; i++) {
    const tier = getTierByIndex(i);
    const id = String(i + 1).padStart(3, '0');
    const name = getGuardianName(i);
    const title = getTitle(tier, i);
    const lore = getLore(tier, i);
    const image = getTierEmoji(tier);

    guardianPool.push({
      id,
      name,
      title,
      tier,
      lore,
      image,
      allocated: false,
    });
  }

  return guardianPool;
}

function getGuardian(id) {
  const pool = generateGuardianPool();
  return pool.find((g) => g.id === id) || null;
}

function getAllGuardians() {
  return generateGuardianPool();
}

function getGuardiansByTier(tier) {
  const pool = generateGuardianPool();
  return pool.filter((g) => g.tier === tier);
}

function getUnallocatedGuardians() {
  const pool = generateGuardianPool();
  return pool.filter((g) => !g.allocated);
}

function getUnallocatedGuardiansByTier(tier) {
  const pool = generateGuardianPool();
  return pool.filter((g) => g.tier === tier && !g.allocated);
}

module.exports = {
  generateGuardianPool,
  getGuardian,
  getAllGuardians,
  getGuardiansByTier,
  getUnallocatedGuardians,
  getUnallocatedGuardiansByTier
};
