const STAGE_EMOJIS = {
  INITIATE: '🌱',
  AWAKENED: '💙',
  ASCENDANT: '✨',
  GUARDIAN: '⚡',
  MYTHIC: '🔮'
};

class ProfileView {
  constructor() {
    this.token = null;
    this.user = null;
    this.profileData = null;
    this.isOwner = false;
    this.editMode = false;
    this.init();
  }

  init() {
    this.extractTokenAndUsername();
    this.loadProfile();
  }

  extractTokenAndUsername() {
    const params = new URLSearchParams(window.location.search);
    this.token = params.get('token') || localStorage.getItem('usernode-token');

    if (this.token) {
      this.decodeToken();
    }

    if (window.PROFILE_USERNAME) {
      this.profileUsername = window.PROFILE_USERNAME;
    } else {
      const pathParts = window.location.pathname.split('/');
      this.profileUsername = pathParts[pathParts.length - 1];
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

  async loadProfile() {
    try {
      const response = await fetch(`/api/profile/${this.profileUsername}`, {
        headers: this.token ? { 'x-usernode-token': this.token } : {}
      });

      if (!response.ok) {
        if (response.status === 404) {
          this.renderNotFound();
        } else {
          this.renderError('Failed to load profile');
        }
        return;
      }

      this.profileData = await response.json();
      this.isOwner = this.user && this.user.username.toLowerCase() === this.profileData.username.toLowerCase();
      this.render();
    } catch (err) {
      console.error('Error loading profile:', err);
      this.renderError('Failed to load profile');
    }
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  renderNotFound() {
    const container = document.getElementById('profile-container');
    container.innerHTML = `
      <div class="min-h-screen flex items-center justify-center px-4">
        <div class="text-center">
          <h1 class="text-3xl font-bold text-zinc-100 mb-2">User Not Found</h1>
          <p class="text-zinc-400 mb-6">The profile you're looking for doesn't exist.</p>
          <a href="/" class="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors">
            Back Home
          </a>
        </div>
      </div>
    `;
  }

  renderError(message) {
    const container = document.getElementById('profile-container');
    container.innerHTML = `
      <div class="min-h-screen flex items-center justify-center px-4">
        <div class="text-center">
          <h1 class="text-3xl font-bold text-zinc-100 mb-2">Error</h1>
          <p class="text-zinc-400 mb-6">${this.escapeHtml(message)}</p>
          <a href="/" class="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors">
            Back Home
          </a>
        </div>
      </div>
    `;
  }

  render() {
    const container = document.getElementById('profile-container');
    const { username, joinedAt, bio, avatarUrl, guardianName, guardianTier, guardianImage, contributionScore, level, stage, fgHours, peerCount, uptime } = this.profileData;

    const joinDate = this.formatDate(joinedAt);
    const stageEmoji = STAGE_EMOJIS[stage] || '?';
    const avatar = avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(username);

    container.innerHTML = `
      <div class="max-w-2xl mx-auto px-4 py-8">
        <!-- Profile Header -->
        <div class="flex items-start justify-between mb-8">
          <div class="flex items-start gap-4">
            <img src="${this.escapeHtml(avatar)}" alt="${this.escapeHtml(username)}" class="w-20 h-20 rounded-full object-cover border-2 border-zinc-700">
            <div>
              <h1 class="text-3xl font-bold text-zinc-100">${this.escapeHtml(username)}</h1>
              <p class="text-sm text-zinc-400 mt-1">Joined ${joinDate}</p>
            </div>
          </div>
          ${this.isOwner ? `
            <button
              id="edit-profile-btn"
              class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded transition-colors"
            >
              Edit Profile
            </button>
          ` : ''}
        </div>

        <!-- Guardian Card -->
        <div class="mb-8 p-6 border border-zinc-800 rounded-lg bg-zinc-900">
          <div class="flex items-center gap-4">
            <img src="${this.escapeHtml(guardianImage)}" alt="${this.escapeHtml(guardianName)}" class="w-24 h-24 object-cover rounded">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="text-2xl">${stageEmoji}</span>
                <h2 class="text-xl font-bold text-zinc-100">${this.escapeHtml(guardianName)}</h2>
              </div>
              <p class="text-sm text-zinc-400">Tier: <span class="text-zinc-200">${this.escapeHtml(guardianTier)}</span></p>
              <p class="text-sm text-zinc-400">Stage: <span class="text-zinc-200">${this.escapeHtml(stage)}</span></p>
            </div>
          </div>
        </div>

        <!-- Stats Grid -->
        <div class="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 border border-zinc-800 rounded-lg bg-zinc-900">
            <p class="text-xs text-zinc-400 mb-1">Contribution Score</p>
            <p class="text-2xl font-bold text-purple-400">${contributionScore.toLocaleString()}</p>
          </div>
          <div class="p-4 border border-zinc-800 rounded-lg bg-zinc-900">
            <p class="text-xs text-zinc-400 mb-1">Level</p>
            <p class="text-2xl font-bold text-zinc-100">Level ${level}</p>
          </div>
          <div class="p-4 border border-zinc-800 rounded-lg bg-zinc-900">
            <p class="text-xs text-zinc-400 mb-1">Stage</p>
            <p class="text-2xl font-bold text-zinc-100">${this.escapeHtml(stage)}</p>
          </div>
          <div class="p-4 border border-zinc-800 rounded-lg bg-zinc-900">
            <p class="text-xs text-zinc-400 mb-1">FG Hours</p>
            <p class="text-2xl font-bold text-zinc-100">${fgHours}</p>
          </div>
          <div class="p-4 border border-zinc-800 rounded-lg bg-zinc-900">
            <p class="text-xs text-zinc-400 mb-1">Peer Count</p>
            <p class="text-2xl font-bold text-zinc-100">${peerCount}</p>
          </div>
          <div class="p-4 border border-zinc-800 rounded-lg bg-zinc-900">
            <p class="text-xs text-zinc-400 mb-1">Uptime</p>
            <p class="text-2xl font-bold text-zinc-100">${uptime.toFixed(1)}%</p>
          </div>
        </div>

        <!-- Bio Section -->
        <div class="p-6 border border-zinc-800 rounded-lg bg-zinc-900">
          <h3 class="text-sm font-semibold text-zinc-400 mb-2">Bio</h3>
          <p class="text-zinc-200">${bio ? this.escapeHtml(bio) : '<em class="text-zinc-500">No bio yet</em>'}</p>
        </div>

        <!-- Edit Form (Hidden by default) -->
        <div id="edit-form" class="hidden mt-8 p-6 border border-zinc-700 rounded-lg bg-zinc-900">
          <h2 class="text-xl font-bold text-zinc-100 mb-4">Edit Profile</h2>
          <form id="profile-form">
            <div class="mb-4">
              <label class="block text-sm font-semibold text-zinc-400 mb-2">Bio</label>
              <textarea
                id="bio-input"
                maxlength="500"
                placeholder="Tell other players about yourself"
                class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                rows="4"
              >${bio ? this.escapeHtml(bio) : ''}</textarea>
              <p class="text-xs text-zinc-500 mt-1"><span id="char-count">0</span>/500</p>
            </div>

            <div class="mb-6">
              <label class="block text-sm font-semibold text-zinc-400 mb-2">Avatar URL</label>
              <input
                id="avatar-url-input"
                type="text"
                placeholder="https://example.com/avatar.jpg"
                class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                value="${avatarUrl || ''}"
              />
              <p class="text-xs text-zinc-500 mt-1">Paste a direct image URL (PNG, JPG)</p>
            </div>

            <div class="flex gap-3">
              <button
                type="submit"
                class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded transition-colors"
              >
                Save Changes
              </button>
              <button
                type="button"
                id="cancel-edit-btn"
                class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
          <div id="success-message" class="hidden mt-4 p-3 bg-green-900 border border-green-700 rounded text-green-200 text-sm">
            Profile updated successfully!
          </div>
        </div>
      </div>
    `;

    if (this.isOwner) {
      this.setupEventListeners();
    }
  }

  setupEventListeners() {
    const editBtn = document.getElementById('edit-profile-btn');
    const editForm = document.getElementById('edit-form');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const form = document.getElementById('profile-form');
    const bioInput = document.getElementById('bio-input');
    const charCount = document.getElementById('char-count');

    if (bioInput) {
      bioInput.addEventListener('input', () => {
        charCount.textContent = bioInput.value.length;
      });
      charCount.textContent = bioInput.value.length;
    }

    if (editBtn) {
      editBtn.addEventListener('click', () => {
        this.editMode = !this.editMode;
        editForm.classList.toggle('hidden');
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.editMode = false;
        editForm.classList.add('hidden');
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveProfile();
      });
    }
  }

  async saveProfile() {
    const bioInput = document.getElementById('bio-input');
    const avatarUrlInput = document.getElementById('avatar-url-input');
    const successMessage = document.getElementById('success-message');

    try {
      const response = await fetch('/api/profile/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-usernode-token': this.token
        },
        body: JSON.stringify({
          bio: bioInput.value || null,
          avatarUrl: avatarUrlInput.value || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        alert('Error: ' + (error.error || 'Failed to save profile'));
        return;
      }

      successMessage.classList.remove('hidden');
      setTimeout(() => {
        successMessage.classList.add('hidden');
      }, 3000);

      await this.loadProfile();
      this.editMode = false;
      document.getElementById('edit-form').classList.add('hidden');
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Error: Failed to save profile');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ProfileView();
});
