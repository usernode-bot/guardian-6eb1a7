const { generateGuardianPool, getUnallocatedGuardians: getUnallocatedFromPool } = require('../guardians/guardianPool.js');

function getAllGuardians() {
  return generateGuardianPool();
}

function getGuardian(id) {
  const pool = generateGuardianPool();
  return pool.find((g) => g.id === id) || null;
}

function getGuardiansByTier(tier) {
  const pool = generateGuardianPool();
  return pool.filter((g) => g.tier === tier);
}

function getUnallocatedGuardians() {
  return getUnallocatedFromPool();
}

function allocateGuardian(userId, preferredTier) {
  let candidates;

  if (preferredTier) {
    candidates = getGuardiansByTier(preferredTier).filter((g) => !g.allocated);
  } else {
    candidates = getUnallocatedGuardians();
  }

  if (candidates.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  const selected = candidates[randomIndex];

  selected.allocated = true;

  return selected;
}

function getAllocatedGuardians() {
  const pool = generateGuardianPool();
  return pool.filter((g) => g.allocated);
}

module.exports = {
  getAllGuardians,
  getGuardian,
  getGuardiansByTier,
  getUnallocatedGuardians,
  allocateGuardian,
  getAllocatedGuardians
};
