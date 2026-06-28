/**
 * Wallet confirmation utility - wraps fetch calls to add wallet confirmation modal
 */

/**
 * Extract wallet address from JWT token in localStorage or URL
 * @returns {Promise<string|null>} - The wallet address or null
 */
async function getWalletAddress() {
  // First try to get from localStorage (where profile-menu.js stores the decoded user)
  const token = localStorage.getItem('usernode-token');
  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.usernode_pubkey) {
          return payload.usernode_pubkey;
        }
      }
    } catch (err) {
      console.error('Failed to decode token:', err);
    }
  }

  // Fallback: fetch from /api/wallet endpoint
  try {
    const response = await fetch('/api/wallet', {
      headers: { 'x-usernode-token': token || '' }
    });
    if (response.ok) {
      const data = await response.json();
      return data.address;
    }
  } catch (err) {
    console.error('Failed to fetch wallet address:', err);
  }

  return null;
}

/**
 * Make a fetch request with wallet confirmation modal
 * @param {string} url - The fetch URL
 * @param {object} options - Fetch options (method, headers, body, etc)
 * @param {string} actionDescription - Description shown in the confirmation modal
 * @returns {Promise<Response>} - The fetch response, or a cancelled response if user cancels
 */
async function fetchWithWalletConfirmation(url, options = {}, actionDescription = 'Confirm action') {
  // Only show confirmation for POST/PUT/DELETE requests to sensitive endpoints
  const method = options.method?.toUpperCase() || 'GET';
  if (method === 'GET') {
    return fetch(url, options);
  }

  // Get wallet address
  const walletAddress = await getWalletAddress();
  if (!walletAddress) {
    console.error('Wallet address not found, proceeding without confirmation');
    return fetch(url, options);
  }

  // Show confirmation modal
  const modal = new WalletConfirmationModal();
  const confirmed = await modal.show(walletAddress, actionDescription);

  // If cancelled, return a fake response that looks like cancellation
  if (!confirmed) {
    return new Response(JSON.stringify({ cancelled: true }), {
      status: 499, // Custom "Client Closed Request" status
      statusText: 'Client Cancelled',
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // User confirmed, proceed with the actual request
  return fetch(url, options);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fetchWithWalletConfirmation, getWalletAddress };
}
