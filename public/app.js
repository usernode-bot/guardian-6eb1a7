// Guardian app - minimal scaffold
document.addEventListener('DOMContentLoaded', () => {
  console.log('Guardian app loaded');

  // Get token from URL or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
    localStorage.setItem('usernode-token', token);
  }

  // Example API call with auth header
  async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('usernode-token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['x-usernode-token'] = token;
    }

    return fetch(url, { ...options, headers });
  }

  // Example: fetch app state
  async function loadAppState() {
    try {
      const response = await fetchWithAuth('/api/state');
      if (response.ok) {
        const data = await response.json();
        console.log('App state:', data);
      }
    } catch (err) {
      console.error('Failed to load app state:', err);
    }
  }

  loadAppState();
});
