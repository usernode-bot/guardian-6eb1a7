async function getUser(token) {
  // In production, this would verify and decode the JWT token
  // For now, return a mock user for testing
  if (!token) {
    return null;
  }

  return {
    id: '-1',
    username: 'demo-user',
    usernode_pubkey: 'ut1demo',
  };
}

async function validateWallet(userContext) {
  // Check if wallet is connected
  return userContext.usernode_pubkey !== null;
}

async function validateAccount(userContext) {
  // Check if account is valid
  return userContext.id !== null && userContext.username !== null;
}

module.exports = {
  getUser,
  validateWallet,
  validateAccount
};
