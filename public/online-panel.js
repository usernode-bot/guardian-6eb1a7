class OnlinePanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.users = [];
    this.filteredUsers = [];
    this.searchTerm = '';
    this.init();
  }

  async init() {
    this.render();
    await this.fetchOnlineUsers();
    this.setupWebSocketListeners();
    this.startHeartbeat();
  }

  async fetchOnlineUsers() {
    try {
      const token = new URLSearchParams(window.location.search).get('token') ||
                    localStorage.getItem('usernode_token');
      const response = await fetch('/api/presence/online', {
        headers: token ? { 'x-usernode-token': token } : {}
      });

      if (!response.ok) throw new Error('Failed to fetch online users');
      const data = await response.json();
      this.users = data.users || [];
      this.updateFiltered();
      this.renderUserList();
    } catch (err) {
      console.error('Fetch online users error:', err);
    }
  }

  setupWebSocketListeners() {
    window.signalingClient.on('online', (msg) => {
      const user = {
        user_id: msg.user_id,
        username: msg.username,
        guardian_name: msg.guardian_name,
        guardian_tier: msg.guardian_tier,
        connected_at: msg.connected_at,
        last_heartbeat: new Date().toISOString()
      };
      if (!this.users.find(u => u.user_id === user.user_id)) {
        this.users.push(user);
        this.updateFiltered();
        this.renderUserList();
      }
    });

    window.signalingClient.on('offline', (msg) => {
      this.users = this.users.filter(u => u.user_id !== msg.user_id);
      this.updateFiltered();
      this.renderUserList();
    });
  }

  startHeartbeat() {
    setInterval(() => {
      window.signalingClient.sendHeartbeat();
    }, 30 * 1000);
  }

  updateFiltered() {
    this.filteredUsers = this.users.filter(u =>
      u.username.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      (u.guardian_name && u.guardian_name.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }

  setSearchTerm(term) {
    this.searchTerm = term;
    this.updateFiltered();
    this.renderUserList();
  }

  getTierColor(tier) {
    const colors = {
      COMMON: '#71717a',
      RARE: '#3b82f6',
      EPIC: '#8b5cf6',
      LEGENDARY: '#f59e0b',
      MYTHIC: '#ec4899'
    };
    return colors[tier] || '#71717a';
  }

  getTierEmoji(tier) {
    const emojis = {
      COMMON: '⚔️',
      RARE: '🗡️',
      EPIC: '⚡',
      LEGENDARY: '👑',
      MYTHIC: '🐉'
    };
    return emojis[tier] || '⚔️';
  }

  renderUserList() {
    const userListHtml = this.filteredUsers.map(user => `
      <div class="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors">
        <div class="w-10 h-10 rounded-full flex items-center justify-center text-xl" style="background: ${this.getTierColor(user.guardian_tier)}20; color: ${this.getTierColor(user.guardian_tier)}">
          ${this.getTierEmoji(user.guardian_tier)}
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm truncate">${user.username}</div>
          <div class="text-xs text-zinc-400 truncate">${user.guardian_name || 'No Guardian'} • ${user.guardian_tier}</div>
        </div>
        <div class="w-2 h-2 rounded-full bg-green-500"></div>
      </div>
    `).join('');

    const listContainer = this.container.querySelector('[data-role="user-list"]');
    if (listContainer) {
      listContainer.innerHTML = userListHtml || '<p class="text-center text-zinc-400 py-4">No online users</p>';
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="flex flex-col gap-4">
        <h2 class="text-2xl font-bold">Who's Online</h2>
        <div class="relative">
          <input
            type="text"
            placeholder="Search by username or Guardian name..."
            class="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-sm"
            data-role="search-input"
          />
          <svg class="absolute right-3 top-2.5 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
        <div class="text-xs text-zinc-400 flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-green-500"></span>
          <span>${this.users.length} online now</span>
        </div>
        <div class="flex flex-col gap-2 max-h-96 overflow-y-auto" data-role="user-list">
          <!-- Users will be rendered here -->
        </div>
      </div>
    `;

    const searchInput = this.container.querySelector('[data-role="search-input"]');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.setSearchTerm(e.target.value);
      });
    }
  }
}
