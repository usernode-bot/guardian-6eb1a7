class AuthConfirmationModal {
  constructor() {
    this.token = null;
    this.user = null;
    this.confirmed = false;
    this.modal = null;
    this.cancelBtn = null;
    this.confirmBtn = null;
    this.walletDisplay = null;
    this.listenersSetUp = false;
  }

  init() {
    this.modal = document.getElementById('auth-confirmation-modal');
    this.cancelBtn = document.getElementById('auth-cancel-btn');
    this.confirmBtn = document.getElementById('auth-confirm-btn');
    this.walletDisplay = document.getElementById('wallet-address-display');

    if (!this.modal || !this.cancelBtn || !this.confirmBtn || !this.walletDisplay) {
      console.error('Auth confirmation modal elements not found');
      return;
    }

    this.extractToken();

    if (this.token) {
      this.showModal();
      if (!this.listenersSetUp) {
        this.setupEventListeners();
        this.listenersSetUp = true;
      }
    }
  }

  extractToken() {
    const params = new URLSearchParams(window.location.search);
    this.token = params.get('token') || localStorage.getItem('usernode-token');
  }

  decodeToken() {
    if (!this.token) return null;

    try {
      const parts = this.token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      this.user = {
        id: payload.id,
        username: payload.username,
        usernode_pubkey: payload.usernode_pubkey
      };
      return this.user;
    } catch (err) {
      console.error('Failed to decode token:', err);
      return null;
    }
  }

  truncateAddress(address) {
    if (!address) return 'Wallet address unavailable';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  showModal() {
    this.decodeToken();

    if (!this.user) {
      this.walletDisplay.textContent = 'Wallet address unavailable';
    } else {
      const truncated = this.truncateAddress(this.user.usernode_pubkey);
      this.walletDisplay.textContent = truncated;
    }

    this.modal.classList.remove('hidden');
  }

  setupEventListeners() {
    this.cancelBtn.addEventListener('click', () => this.handleCancel());
    this.confirmBtn.addEventListener('click', () => this.handleConfirm());

    // Allow Enter key to confirm
    document.addEventListener('keydown', (e) => {
      if (this.modal && !this.modal.classList.contains('hidden') && e.key === 'Enter') {
        this.handleConfirm();
      }
    });
  }

  handleCancel() {
    localStorage.removeItem('usernode-token');
    window.location.href = 'https://social-vibecoding.usernodelabs.org';
  }

  handleConfirm() {
    this.confirmed = true;
    this.modal.classList.add('hidden');

    // Trigger profile menu initialization
    if (window.profileMenu) {
      window.profileMenu.init();
    }
  }
}

// Wait for DOM to be ready, then initialize the auth confirmation modal
document.addEventListener('DOMContentLoaded', () => {
  const authModal = new AuthConfirmationModal();
  authModal.init();

  // Store instance globally so other components can access it
  window.authConfirmationModal = authModal;
});
