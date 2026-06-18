class ProfileMenu {
  constructor() {
    this.token = null;
    this.user = null;
    this.walletData = null;
    this.menuOpen = false;
    this.init();
  }

  init() {
    this.extractToken();
    this.setupEventListeners();
    this.loadProfileData();
  }

  extractToken() {
    const params = new URLSearchParams(window.location.search);
    this.token = params.get('token') || localStorage.getItem('usernode-token');

    if (this.token) {
      this.decodeToken();
    }
  }

  decodeToken() {
    try {
      const parts = this.token.split('.');
      if (parts.length !== 3) return;

      const payload = JSON.parse(atob(parts[1]));
      this.user = {
        id: payload.id,
        username: payload.username,
        usernode_pubkey: payload.usernode_pubkey
      };
    } catch (err) {
      console.error('Failed to decode token:', err);
    }
  }

  async loadProfileData() {
    if (!this.token) {
      this.renderProfile();
      return;
    }

    try {
      const response = await fetch('/api/wallet', {
        headers: { 'x-usernode-token': this.token }
      });

      if (response.ok) {
        this.walletData = await response.json();
      } else {
        console.error('Failed to fetch wallet data:', response.status);
      }
    } catch (err) {
      console.error('Error fetching wallet data:', err);
    }

    this.renderProfile();
  }

  truncateAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  renderProfile() {
    const menuContent = document.getElementById('profile-menu-content');
    if (!menuContent) return;

    if (!this.token) {
      menuContent.innerHTML = `
        <div class="px-4 py-3 text-sm text-zinc-400">
          <p>Not authenticated</p>
          <p class="text-xs text-zinc-500 mt-2">Please access this app through Usernode</p>
        </div>
      `;
      return;
    }

    if (!this.user) {
      menuContent.innerHTML = `
        <div class="px-4 py-3 text-sm text-zinc-400">
          <p>Invalid token</p>
        </div>
      `;
      return;
    }

    const address = this.walletData?.address;
    const balance = this.walletData?.balance || '0 UT';

    let walletSection = '';
    if (address) {
      walletSection = `
        <div class="border-t border-zinc-700 px-4 py-3">
          <div class="text-xs text-zinc-500 mb-1">Wallet</div>
          <div class="text-sm text-zinc-200 font-mono mb-2">${this.truncateAddress(address)}</div>
          <div class="text-xs text-zinc-400">Balance: <span class="text-zinc-200">${balance}</span></div>
        </div>
      `;
    } else {
      walletSection = `
        <div class="border-t border-zinc-700 px-4 py-3">
          <div class="text-xs text-zinc-500 mb-1">Wallet</div>
          <div class="text-sm text-zinc-400">Not linked</div>
        </div>
      `;
    }

    menuContent.innerHTML = `
      <div class="px-4 py-3 border-b border-zinc-700">
        <div class="text-xs text-zinc-500 mb-1">Username</div>
        <div class="text-sm font-semibold text-zinc-100">${this.escapeHtml(this.user.username)}</div>
      </div>
      ${walletSection}
      <div class="px-4 py-3 border-t border-zinc-700">
        <button
          id="signout-btn"
          class="w-full px-3 py-2 text-sm font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 rounded transition-colors"
        >
          Sign Out
        </button>
      </div>
    `;

    const signoutBtn = document.getElementById('signout-btn');
    if (signoutBtn) {
      signoutBtn.addEventListener('click', () => this.signOut());
    }
  }

  setupEventListeners() {
    const profileBtn = document.getElementById('profile-btn');
    const profileMenu = document.getElementById('profile-menu');

    if (profileBtn) {
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMenu();
      });
    }

    document.addEventListener('click', (e) => {
      if (profileMenu && !profileMenu.contains(e.target) && e.target !== profileBtn) {
        this.closeMenu();
      }
    });

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        this.closeMenu();
      });
    });
  }

  toggleMenu() {
    const profileMenu = document.getElementById('profile-menu');
    if (!profileMenu) return;

    if (this.menuOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  openMenu() {
    const profileMenu = document.getElementById('profile-menu');
    if (!profileMenu) return;

    profileMenu.classList.remove('hidden');
    this.menuOpen = true;
  }

  closeMenu() {
    const profileMenu = document.getElementById('profile-menu');
    if (!profileMenu) return;

    profileMenu.classList.add('hidden');
    this.menuOpen = false;
  }

  signOut() {
    localStorage.removeItem('usernode-token');
    localStorage.removeItem('usernode_token');
    window.location.href = 'https://social-vibecoding.usernodelabs.org';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const profileMenu = new ProfileMenu();
  window.profileMenu = profileMenu;

  // If auth confirmation modal is not needed (no token), initialize immediately
  // Otherwise, initialization will be triggered by auth confirmation modal
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || localStorage.getItem('usernode-token');
  if (!token) {
    profileMenu.init();
  }
});
