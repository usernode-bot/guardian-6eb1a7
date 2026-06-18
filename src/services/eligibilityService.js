const { getUserFGHours } = require('./fgService.js');

async function checkEligibility(userId) {
  const reasons = [];

  // Rule 1: FG hours >= 1
  const fgHours = await getUserFGHours(userId);
  if (fgHours < 1) {
    reasons.push('FG hours must be at least 1 hour');
  }

  // Rule 2: Wallet connected (mock: always true for now)
  // In production, check req.user.usernode_pubkey
  const walletConnected = true;
  if (!walletConnected) {
    reasons.push('Wallet must be connected');
  }

  // Rule 3: Account valid (mock: always true for now)
  // In production, check user account status
  const accountValid = true;
  if (!accountValid) {
    reasons.push('Account must be valid');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

module.exports = {
  checkEligibility
};
