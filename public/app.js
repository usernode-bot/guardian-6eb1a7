// Guardian app - bottom navigation router
document.addEventListener('DOMContentLoaded', () => {
  console.log('Guardian app loaded');

  // Get token from URL or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
    localStorage.setItem('usernode-token', token);
  }

  // Shared-group deep link. A copied "Share Group" link is `<origin>/?group=<id>`
  // (a real query param, since HTTP requests never see the URL fragment) --
  // translate it into this app's own hash route before the router runs.
  const sharedGroupId = urlParams.get('group');
  if (sharedGroupId) {
    window.location.hash = `/group/${sharedGroupId}`;
  }

  // Shared-channel deep link. Same idea as ?group= above, for `<origin>/?channel=<id>`.
  const sharedChannelId = urlParams.get('channel');
  if (sharedChannelId) {
    window.location.hash = `/channel/${sharedChannelId}`;
  }

  // Screenshot-state deep links. Each boots a long, deterministic thread so
  // interaction-gated UI is reachable from a plain URL. Pure UI state — nothing
  // is persisted, and none of it is gated on the environment. Whichever real/
  // staging-seeded conversation, group or channel the path opens is padded/
  // mutated client-side only, so these work against any real thread, not a
  // specific hardcoded id.
  //
  //   ?shot=scroll-fab        thread padded + parked at the TOP    → FAB must be on screen
  //   ?shot=scroll-fab-bottom thread padded + parked at the BOTTOM → FAB must be hidden
  //   ?shot=send-stay         sends one message on load   → thread must survive
  //   ?shot=channel-send-stay publishes one post on load (owned channel only) → post must render
  //   ?shot=message-deleted   marks the open group's last message deleted    → placeholder must render
  //   ?shot=dm-menu           clicks the DM header's ⋮ button on load          → options menu must render
  //   ?shot=dm-cleared        clears the first real DM's chat via the real Clear Chat fn → list preview must read "No messages yet"
  //   ?shot=post-reactions    long-presses the first post card                  → reaction picker must render
  //   ?shot=forward-sheet     ⋯ menu → Forward on the first post              → target rows + enabled Send must render
  //   ?shot=post-menu         opens the first post's ⋯ menu                    → Forward / Copy text (+ owner items) must render
  //   ?shot=post-edit         opens Edit Post on the first post (owner only)   → dialog prefilled with the post text must render
  //   ?shot=create-group-public       selects Public on Create Group           → #privacy-public-btn must be active
  //   ?shot=create-group-one-member   name + exactly ONE invitee               → Create Group must be enabled
  //   ?shot=create-group-zero-members name only, then submits                  → "Select at least 1 member" must render
  //   ?shot=search-users             runs a real /api/users/search query        → matching staging-demo user must render
  //   ?shot=requests-tab             opens Messages straight into the Requests tab → seeded pending request must render
  //   ?shot=dc-preview                sends a real DM to a staging peer on load  → Messages list preview must show its text, not be blank
  //   ?shot=channel-admin            seeds one client-only admin on the open owned channel → Channel Info must list them
  //   ?shot=dm-no-dup                 messages a fixture peer with an existing pending request → total Messages+Requests references to that peer must stay at 1, not 2
  //   ?shot=dm-reload-lo              sends a DM to a peer id sorting below any real id  → history must survive a plain reload
  //   ?shot=dm-reload-hi              sends a DM to a peer id sorting above any real id  → history must survive a plain reload
  //   ?shot=dm-username-dup           messages two different peer ids sharing one username → Messages list must show that username only once
  //   ?shot=channel-send-fail         publishes one post that deterministically fails (owned channel only) → "Failed to send" + retry must render
  //   ?shot=session-expired           simulates a 401 on load                                  → session-expired banner must render, polling halted
  //   ?shot=messages-select           enters multi-select on the first Messages row on load     → selection toolbar + selected row must render
  //   ?shot=messages-muted            mutes the first DM on load                                 → muted row indicator must render
  //   ?shot=messages-actions          opens the long-press action sheet on the first Messages row → Select/Pin/Mute labels must render
  //   ?shot=typing-demo               forces a synthetic "typing…" state on the opened DM/group thread → typing-indicator-bar must render
  //
  // The top/bottom pair matters: asserting only "the FAB is visible" would still
  // pass if the FAB were visible unconditionally, so the bottom state pins the
  // other direction.
  const SHOT = urlParams.get('shot') || '';
  const SHOT_SCROLL_FAB = SHOT === 'scroll-fab';
  const SHOT_SCROLL_FAB_BOTTOM = SHOT === 'scroll-fab-bottom';
  const SHOT_SEND_STAY = SHOT === 'send-stay';
  const SHOT_CHANNEL_SEND_STAY = SHOT === 'channel-send-stay';
  const SHOT_DM_MENU = SHOT === 'dm-menu';
  const SHOT_DM_CLEARED = SHOT === 'dm-cleared';
  const SHOT_POST_REACTIONS = SHOT === 'post-reactions';
  const SHOT_FORWARD_SHEET = SHOT === 'forward-sheet';
  const SHOT_MESSAGE_REACTIONS = SHOT === 'message-reactions';
  const SHOT_POST_MENU = SHOT === 'post-menu';
  const SHOT_POST_EDIT = SHOT === 'post-edit';
  const SHOT_CREATE_GROUP_PUBLIC = SHOT === 'create-group-public';
  const SHOT_CREATE_GROUP_ONE_MEMBER = SHOT === 'create-group-one-member';
  const SHOT_CREATE_GROUP_ZERO_MEMBERS = SHOT === 'create-group-zero-members';
  const SHOT_ADMIN_TOGGLE = SHOT === 'admin-toggle';
  let shotAdminToggleFired = false;
  const SHOT_DESC_EDIT = SHOT === 'desc-edit';
  let shotDescEditFired = false;
  const SHOT_SEARCH_USERS = SHOT === 'search-users';
  const SHOT_CREATE_SEARCH_MODAL = SHOT === 'create-search-modal';
  const SHOT_REQUESTS_TAB = SHOT === 'requests-tab';
  const SHOT_DC_PREVIEW = SHOT === 'dc-preview';
  const SHOT_CHANNEL_ADMIN = SHOT === 'channel-admin';
  const SHOT_SEND_FAIL = SHOT === 'send-fail';
  const SHOT_CHANNEL_SEND_FAIL = SHOT === 'channel-send-fail';
  const SHOT_SESSION_EXPIRED = SHOT === 'session-expired';
  const SHOT_STALE_VERSION = SHOT === 'stale-version';
  const SHOT_NOTIFICATIONS_SHEET = SHOT === 'notifications-sheet';
  const SHOT_GROUPS_TAB = SHOT === 'groups-tab';
  const SHOT_MESSAGES_SELECT = SHOT === 'messages-select';
  const SHOT_MESSAGES_MUTED = SHOT === 'messages-muted';
  const SHOT_MESSAGES_ACTIONS = SHOT === 'messages-actions';
  // Forces the typing-indicator bar on without waiting on a second real
  // session to type -- skips the real GET /api/typing/* poll entirely and
  // renders a fixed synthetic name against whichever staging DM/group fixture
  // the deep link opens.
  const SHOT_TYPING_DEMO = SHOT === 'typing-demo';
  const SHOT_LONG_THREAD = SHOT_SCROLL_FAB || SHOT_SCROLL_FAB_BOTTOM || SHOT_SEND_STAY;
  const SHOT_SEND_TEXT = 'Shot send stay check';
  const SHOT_CREATE_GROUP_NAME = 'Staging demo one-invite group';
  const SHOT_SEARCH_QUERY = 'citra';
  // Any staging-seeded user works as the DM peer here -- seedStagingUsers()
  // always creates this one regardless of which account the test itself runs as.
  const SHOT_DC_PREVIEW_PEER_ID = 'staging-demo-user-7';
  const SHOT_DC_PREVIEW_TEXT = 'Shot dc preview check';
  const SHOT_DM_NO_DUP = SHOT === 'dm-no-dup';
  // staging-demo-user-4 already has a pending request seeded TO 'user_self'
  // (dm_staging_pending_1) -- regression check for getOrCreateDirectConversation
  // creating a second, duplicate direct_conversations row instead of reusing
  // that one when the caller messages the same peer first.
  const SHOT_DM_NO_DUP_PEER_ID = 'staging-demo-user-4';
  const SHOT_DM_NO_DUP_TEXT = 'Shot no-dup check';
  // Regression check for GET /api/messages/direct/:peerId's history query only
  // matching one alphabetical ordering of (caller id, peer id) -- the stored
  // direct_conversations row is always sorted, so the peer id here is picked
  // to sit at an extreme end of sort order (below/above any realistic real
  // user id), guaranteeing the pair lands on whichever ordering direction the
  // old unsorted query missed, regardless of what the real caller's id is.
  const SHOT_DM_RELOAD_LO = SHOT === 'dm-reload-lo';
  const SHOT_DM_RELOAD_HI = SHOT === 'dm-reload-hi';
  const SHOT_DM_RELOAD_LO_PEER_ID = '0000-reload-order-lo';
  const SHOT_DM_RELOAD_HI_PEER_ID = 'zzzz-reload-order-hi';
  const SHOT_DM_RELOAD_TEXT = 'Shot reload order check';
  // Regression check for the "same contact appears twice" bug: messages TWO
  // DIFFERENT staging fixture ids that share the same username, one after
  // the other. getOrCreateDirectConversation's username-based reuse check
  // should fold the second message into the conversation the first one
  // created, so the Messages list only ever shows ONE row for this username.
  const SHOT_DM_USERNAME_DUP = SHOT === 'dm-username-dup';
  const SHOT_DM_USERNAME_DUP_PEER_ID_1 = 'staging-demo-user-10';
  const SHOT_DM_USERNAME_DUP_PEER_ID_2 = 'staging-demo-user-11';
  const SHOT_DM_USERNAME_DUP_USERNAME = 'staging-demo-dup-name';
  // Distinct per message so a later fetch can tell which one(s) came back --
  // used to prove the reused row's *history* is intact under BOTH ids, not
  // just that the inbox stops double-listing the contact.
  const SHOT_DM_USERNAME_DUP_TEXT_1 = 'Shot username dup check one';
  const SHOT_DM_USERNAME_DUP_TEXT_2 = 'Shot username dup check two';
  // Regression check for "delete for me" not persisting: send a message to a
  // fixed fixture peer, then immediately hide it via the real endpoint (not
  // just the client-only mutation), so a later plain reload of the same
  // conversation proves the hide survived server-side, not just this tab's
  // in-memory state.
  const SHOT_DM_DELETE = SHOT === 'dm-delete';
  const SHOT_DM_DELETE_PEER_ID = 'staging-demo-delete-peer';
  const SHOT_DM_DELETE_TEXT = 'Shot delete check';
  const SHOT_DM_DELETE_MSG_ID = 'shot_delete_fixed_msg';
  // Regression check for deleted DMs / left groups / unfollowed channels
  // reappearing in the Messages list after the app is closed and reopened.
  // Creates a real group+channel+DM under the current tester's own account,
  // removes them via the same endpoints the UI uses, then simulates a
  // restart by wiping local state and re-running the real hydration
  // functions -- so this proves the removal was actually persisted server
  // side, not just hidden client side until the next reload.
  const SHOT_PERSIST_REMOVAL = SHOT === 'persist-removal';
  const SHOT_PERSIST_REMOVAL_PEER_ID = 'staging-demo-user-6';
  const SHOT_PERSIST_REMOVAL_TEXT = 'Shot persist removal check';
  // Regression check for the reply-target leak bug: simulates having tapped
  // "reply" on a message in a DIFFERENT conversation (SOURCE) right before
  // this deep link opens a completely unrelated one (TARGET, the one this
  // path actually deep-links into), then sends a plain message there. A
  // fixed implementation must not attach SOURCE's reply target to it.
  const SHOT_REPLY_LEAK = SHOT === 'reply-leak';
  const SHOT_REPLY_LEAK_SOURCE_CONVERSATION_ID = 'conv_staging-demo-user-5';
  const SHOT_REPLY_LEAK_TARGET_PEER_ID = 'staging-demo-user-12';
  // Regression check for the "DM between two users not showing up" bug
  // report: hiding a DM (performDeleteDirectConversation) only ever set
  // hidden_from_inbox = true and nothing cleared it back, so once either
  // side hid the thread it stayed filtered out of their Messages list
  // forever even as new messages kept arriving in it. This hides a DM
  // through the real endpoint, sends another message into it (the fixed
  // send route now clears hidden_from_inbox for both participants), then
  // simulates an app restart to prove the conversation reappears server
  // side, not just in this tab's in-memory state.
  const SHOT_DM_UNHIDE_ON_MESSAGE = SHOT === 'dm-unhide-on-message';
  const SHOT_DM_UNHIDE_PEER_ID = 'staging-demo-unhide-peer';
  const SHOT_DM_UNHIDE_TEXT_BEFORE_HIDE = 'Shot unhide check: before hide';
  const SHOT_DM_UNHIDE_TEXT_AFTER_HIDE = 'Shot unhide check: after hide';

  // The signed-in Usernode user, hydrated from /api/state at boot. Server rows
  // for this id are mapped onto the app's long-standing 'user_self' sentinel so
  // every existing role check keeps working untouched.
  let currentUser = null;

  // Escape untrusted text before it goes into innerHTML. Group names, member
  // usernames and descriptions now originate from OTHER users via the server,
  // so interpolating them raw would be a stored-XSS hole.
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function authHeaders(extra) {
    const headers = Object.assign({}, extra || {});
    const token = localStorage.getItem('usernode-token');
    if (token) headers['x-usernode-token'] = token;
    return headers;
  }

  // Once the token's rejected server-side there's nothing more polling/hydrating
  // can do -- every subsequent request would just 401 again -- so this latches
  // permanently for the rest of the tab's lifetime rather than re-checking.
  let sessionExpired = false;

  function showSessionExpiredBanner() {
    if (document.querySelector('.session-expired-banner')) return;
    const banner = document.createElement('div');
    banner.className = 'session-expired-banner';
    banner.textContent = 'Your session expired — tap to reload';
    banner.addEventListener('click', () => window.location.reload());
    document.body.appendChild(banner);
  }

  // Halts both polling loops so no further request can retrigger this, then
  // surfaces the banner. stopThreadPolling/stopMessagesListPolling are declared
  // later in this same scope but hoisted, so calling them from here is safe.
  function handleSessionExpired() {
    if (sessionExpired) return;
    sessionExpired = true;
    stopThreadPolling();
    stopTypingPolling();
    stopMessagesListPolling();
    showSessionExpiredBanner();
  }

  // Captured from the first /api/state response in fetchUserData(). A tab
  // that's been open since before a deploy keeps running the old app.js in
  // memory -- checkServerVersion() below is how it finds out a newer one
  // shipped and prompts a reload instead of silently misbehaving forever.
  let bootServerVersion = null;
  let updateAvailable = false;

  function showUpdateAvailableBanner() {
    if (document.querySelector('.update-available-banner')) return;
    const banner = document.createElement('div');
    banner.className = 'update-available-banner';
    banner.textContent = 'A new version of Guardian is available — tap to refresh';
    banner.addEventListener('click', () => window.location.reload());
    document.body.appendChild(banner);
  }

  // Re-checked opportunistically on the same foreground/reconnect hooks that
  // already drive resyncActiveScreen() -- no new polling loop. Yields to the
  // session-expired banner (that one means the tab can't do anything useful
  // at all) and never fires before bootServerVersion has a baseline.
  async function checkServerVersion() {
    if (sessionExpired || updateAvailable || bootServerVersion === null) return;
    if (SHOT_STALE_VERSION) {
      updateAvailable = true;
      showUpdateAvailableBanner();
      return;
    }
    try {
      const response = await fetch('/api/state', { headers: authHeaders() });
      if (!response.ok) return;
      const data = await response.json();
      if (data.serverVersion && data.serverVersion !== bootServerVersion) {
        updateAvailable = true;
        showUpdateAvailableBanner();
      }
    } catch (err) {
      // Network hiccup -- the next foreground/reconnect resync retries.
    }
  }

  // Drop-in replacement for fetch() used by every hydrate/deliver call site --
  // detects an expired/invalid token (401) in one place instead of each caller
  // separately checking for it, since none of them currently do.
  async function authFetch(url, options) {
    // Screenshot-state: force the banner deterministically instead of actually
    // invalidating the token, so dapp.json can assert it renders on demand.
    if (SHOT_SESSION_EXPIRED) {
      handleSessionExpired();
      return new Response(null, { status: 401 });
    }
    const response = await fetch(url, options);
    if (response.status === 401) handleSessionExpired();
    return response;
  }

  // Helper copy shown under the Create Group privacy toggle.
  const PRIVACY_HELP = {
    private: 'Private — invite only. This group won’t be listed in Discover.',
    public: 'Public — listed in Discover. Anyone can join with one tap.'
  };

  // Page definitions
  const pages = {
    messages: { title: 'Messages', name: 'Messages' },
    create: { title: 'New Message', name: 'New Message' },
    discover: { title: 'Discover', name: 'Discover' },
    profile: { title: 'Profile', name: 'Profile' }
  };

  // Tiny inline placeholder images for the seeded demo image messages.
  // Platform-stored files are NOT cloned into staging, so seeded rows must
  // carry a data URI rather than a real /app-files/ URL.
  const DEMO_IMAGE_BLUE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='200'%3E%3Crect width='320' height='200' fill='%234a90d9'/%3E%3Ctext x='160' y='115' font-family='sans-serif' font-size='40' fill='white' text-anchor='middle'%3EDEMO%3C/text%3E%3C/svg%3E";
  const DEMO_IMAGE_ORANGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='200'%3E%3Crect width='320' height='200' fill='%23e07a3f'/%3E%3Ctext x='160' y='115' font-family='sans-serif' font-size='40' fill='white' text-anchor='middle'%3EDEMO%3C/text%3E%3C/svg%3E";
  const DEMO_IMAGE_GREEN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='200'%3E%3Crect width='320' height='200' fill='%233fa15e'/%3E%3Ctext x='160' y='115' font-family='sans-serif' font-size='40' fill='white' text-anchor='middle'%3EDEMO%3C/text%3E%3C/svg%3E";

  const pageContainer = document.getElementById('page-container');
  const bottomNav = document.getElementById('bottom-nav');
  const navTabs = document.querySelectorAll('.nav-tab');

  // Conversations are hydrated from the server (see hydrateServerGroups,
  // hydrateServerChannels, hydrateServerDirectConversations) instead of being
  // seeded here -- this app now shows only real users' real conversations.
  let conversations = [];

  // Suggested users, hydrated from the real `users` directory on the server
  // (GET /api/users/suggested) instead of these fixtures. Populated by
  // fetchSuggestedUsers(), called at boot and again whenever a screen that
  // lists users (New Message, Create Group, Add Members) is opened.
  let suggestedUsers = [];

  // Matches the wallet-address formatting already used on the Profile screen.
  function formatShortAddress(address) {
    if (!address) return null;
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }

  function shapeDirectoryUser(user) {
    return {
      id: user.id,
      username: user.username,
      walletAddress: user.walletAddress || null,
      avatar: getInitialsFromUsername(user.username)
    };
  }

  async function fetchSuggestedUsers() {
    try {
      const response = await fetch('/api/users/suggested', { headers: authHeaders() });
      if (!response.ok) return;
      const data = await response.json();
      suggestedUsers = (data.users || []).map(shapeDirectoryUser);
    } catch (err) {
      console.error('Failed to fetch suggested users:', err);
    }
  }

  async function searchUsers(query) {
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, { headers: authHeaders() });
      if (!response.ok) return [];
      const data = await response.json();
      return (data.users || []).map(shapeDirectoryUser);
    } catch (err) {
      console.error('Failed to search users:', err);
      return [];
    }
  }

  // Shared row renderer for suggested/search users: shortened wallet address,
  // or the address line omitted entirely when the user has no wallet linked.
  // `selectable` adds a selection-indicator dot (Create Group / Add Members);
  // New Message omits it since tapping a row opens a DM directly.
  function renderUserListItemHtml(user, options) {
    const opts = options || {};
    const shortAddress = formatShortAddress(user.walletAddress);
    const isSelected = !!opts.selected;
    return `
      <div class="suggested-user-item${opts.selectable && isSelected ? ' selected' : ''}" data-user-id="${escapeHtml(user.id)}">
        <div class="user-avatar">${escapeHtml(user.avatar)}</div>
        <div class="user-content">
          <div class="user-username">${escapeHtml(user.username)}</div>
          ${shortAddress ? `<div class="user-domain">${escapeHtml(shortAddress)}</div>` : ''}
        </div>
        ${opts.selectable ? `<div class="selection-indicator">${isSelected ? '✓' : ''}</div>` : ''}
      </div>
    `;
  }

  // Opens (or starts) a direct-message conversation with a directory user
  // tapped from Suggested Users / search results on the New Message screen.
  function startConversationWith(user) {
    const convId = 'conv_' + user.id;
    let conv = conversations.find(c => c.id === convId);
    if (!conv) {
      conv = {
        id: convId,
        type: 'direct',
        username: user.username,
        avatar: user.avatar,
        lastMessage: '',
        timestamp: Date.now(),
        unreadCount: 0,
        onlineStatus: false,
        archived: false,
        pinned: false,
        mutedByUsers: {},
        messages: []
      };
      conversations.unshift(conv);
    }
    window.location.hash = `/conversation/${convId}`;
  }

  // Groups, channels, and requests are hydrated from the server (see
  // hydrateServerGroups, hydrateServerChannels below, and
  // hydrateMessageRequests below) instead of being seeded here -- this app
  // now shows only real users' real groups/channels.
  let groups = [];
  let requests = [];
  let discoverGroups = [];
  let discoverChannels = [];
  let channels = [];

  // Message requests: incoming DMs from someone the user hasn't accepted yet.
  // Hydrated from GET /api/message-requests by hydrateMessageRequests() below
  // instead of these fixtures.

  // Id of the direct conversation whose thread is currently on screen (null
  // otherwise), so a concurrent Messages-list poll doesn't clobber a local
  // "just marked read" state before the server-side markRead PUT lands.
  let currentOpenConversationId = null;

  // The DM/group whose composer last sent a typing ping (or null). Lets
  // handleNavigation below fire a best-effort "stopped typing" DELETE when
  // the user leaves a thread mid-keystroke, without setupComposer needing to
  // register its own navigation listener that would just leak on re-render.
  let activeTypingTarget = null;

  function typingApiPath(target) {
    return `/api/typing/${target.type}/${encodeURIComponent(target.id)}`;
  }

  // Fire-and-forget: a failed ping/clear just means the indicator is stale or
  // absent for a few seconds, never worth surfacing to the typer.
  function pingTyping(target) {
    activeTypingTarget = target;
    authFetch(typingApiPath(target), { method: 'POST', headers: authHeaders() }).catch(() => {});
  }

  function clearTyping(target) {
    if (activeTypingTarget && activeTypingTarget.type === target.type && activeTypingTarget.id === target.id) {
      activeTypingTarget = null;
    }
    authFetch(typingApiPath(target), { method: 'DELETE', headers: authHeaders() }).catch(() => {});
  }

  // Best-effort: called when navigating away from whichever thread's
  // composer last pinged, so the peer's indicator doesn't sit on for the
  // full TYPING_TTL_MS server-side timeout after the user leaves.
  function clearActiveTypingBestEffort() {
    if (!activeTypingTarget) return;
    clearTyping(activeTypingTarget);
  }

  async function hydrateMessageRequests() {
    try {
      const response = await authFetch('/api/message-requests', { headers: authHeaders() });
      if (!response.ok) return false;
      const data = await response.json();
      const nextRequests = (data.requests || []).map(r => ({
        id: r.id,
        senderId: r.senderId,
        senderName: r.senderUsername,
        avatar: getInitialsFromUsername(r.senderUsername),
        messagePreview: r.messagePreview || '',
        timestamp: r.timestamp
      }));
      const changed = JSON.stringify(nextRequests) !== JSON.stringify(requests);
      requests = nextRequests;
      return changed;
    } catch (err) {
      console.error('Failed to fetch message requests:', err);
      return false;
    }
  }

  // The fixed reaction set offered on channel posts. Single source of truth for
  // BOTH the picker order and the chip order, so chips never reshuffle as counts
  // change. Index 0 ('❤️') is what the primary like button toggles.
  const POST_REACTIONS = ['❤️', '👍', '😂', '🎉', '😮', '😢'];
  const LIKE_EMOJI = POST_REACTIONS[0];

  // Count / membership helpers for a post's reaction map.
  function reactionCount(post, emoji) {
    return Object.keys((post.reactions && post.reactions[emoji]) || {}).length;
  }

  function userReacted(post, emoji) {
    return !!(post.reactions && post.reactions[emoji] && post.reactions[emoji]['user_self']);
  }

  // Active tab state
  let activeMessagesTab = 'all';
  let activeDiscoverTab = 'all';
  let searchQuery = '';
  let showMessagesSearch = false;
  let searchTimeout = null;

  // WhatsApp/Telegram-style multi-select on the Messages list: a long-press
  // enters selection mode and selects that row; further taps toggle other
  // rows instead of navigating.
  let messagesSelectionMode = false;
  let selectedConversationIds = new Set();
  // Set for a short window right after a long-press fires selection so the
  // trailing click event (mouseup/touchend synthesizing "click") doesn't
  // immediately toggle the same row back off.
  let suppressNextConversationClick = false;

  // Tracks the hash we navigated FROM, so a group/channel chat page opened
  // from the Create menu's managed lists can send its back button there
  // instead of always defaulting to the Messages list.
  let previousNavigationHash = '';
  let groupChannelBackTarget = '/messages';

  // Where should the back button on a group/channel conversation screen return
  // to? Discover when we got here from a Discover card tap, or from the
  // ?group=/?channel= invite-link translation (priorHash is '' the very first
  // time handleNavigation runs, which only happens for that boot-time
  // redirect or a direct deep link -- both are "came from outside", so treat
  // them the same as Discover); the Create menu when opened from there;
  // Messages otherwise (e.g. from within an existing conversation).
  function computeGroupChannelBackTarget(priorHash) {
    if (priorHash === '' || priorHash === '/discover' || priorHash.startsWith('/discover?')) {
      return '/discover';
    }
    if (priorHash === '/create') {
      return '/create';
    }
    return '/messages';
  }

  // Helper: generate unique group ID
  function generateGroupId() {
    return 'group_' + Date.now();
  }

  // Helper: generate default avatar from first letter of group/channel name
  function generateDefaultAvatar(name) {
    if (!name || name.length === 0) return '';
    const words = name.split(' ');
    if (words.length > 1) {
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  }

  // Helper: build a system message for a freshly created/joined group thread
  function groupSystemMessage(text, timestamp) {
    return {
      id: 'msg_' + timestamp,
      senderId: 'system',
      senderName: 'System',
      text: text,
      timestamp: timestamp,
      isOutgoing: false,
      isSystemMessage: true
    };
  }

  // Map a server member row onto the app's identity model. Every role check in
  // this file compares against the 'user_self' sentinel, so the signed-in user's
  // own row has to become that sentinel rather than a raw platform id.
  function mapServerMember(member) {
    const isMe = currentUser && member.id === currentUser.id;
    return {
      id: isMe ? 'user_self' : member.id,
      username: isMe ? 'You' : member.username,
      avatar: member.avatarUrl || generateDefaultAvatar(isMe ? 'You' : member.username),
      role: member.role || 'member'
    };
  }

  // Insert a server-returned group (plus its conversation row) into local state.
  // Shared by the create-group flow and the boot-time hydration so both produce
  // exactly the same shape.
  function addServerGroupToState(serverGroup, systemMessageText) {
    const timestamp = serverGroup.createdAt || Date.now();
    const existing = groups.find(g => g.id === serverGroup.id);
    const shaped = {
      id: serverGroup.id,
      name: serverGroup.name,
      description: serverGroup.description || '',
      avatar: serverGroup.avatarUrl || serverGroup.avatar || generateDefaultAvatar(serverGroup.name),
      avatarImageId: serverGroup.avatarImageId || null,
      visibility: serverGroup.visibility === 'public' ? 'public' : 'private',
      creatorId: (currentUser && serverGroup.creatorId === currentUser.id) ? 'user_self' : serverGroup.creatorId,
      memberCount: serverGroup.memberCount,
      members: (serverGroup.members || []).map(mapServerMember),
      joinRequests: [],
      createdAt: timestamp,
      source: 'server',
      // Real history is hydrated from the server when the thread is opened
      // (see hydrateThreadMessages) -- this local seed just gives a
      // brand-new group's thread a system message before that first fetch.
      messages: existing
        ? existing.messages
        : [groupSystemMessage(systemMessageText || 'Group created.', timestamp)]
    };

    if (existing) {
      Object.assign(existing, shaped);
    } else {
      groups.push(shaped);
    }

    const lastMessage = shaped.messages[shaped.messages.length - 1];
    let existingConv = conversations.find(c => c.groupId === serverGroup.id);
    if (existingConv) {
      existingConv.name = shaped.name;
      existingConv.avatar = shaped.avatar;
    } else {
      existingConv = {
        id: 'conv_' + serverGroup.id,
        type: 'group',
        groupId: serverGroup.id,
        name: shaped.name,
        avatar: shaped.avatar,
        lastMessage: lastMessage ? lastMessage.text : '',
        timestamp: lastMessage ? lastMessage.timestamp : timestamp,
        // See the matching field in hydrateServerDirectConversations: only
        // ever set from server-provided lastMessageAt values, never from a
        // locally-stamped Date.now(), so the gate below can't get stuck
        // comparing across two different clocks.
        serverLastMessageAt: 0,
        unreadCount: 0,
        archived: false,
        pinned: false
      };
      conversations.unshift(existingConv);
    }

    // Prefer the server's real last message over the local "Group created."
    // placeholder once the thread actually has history -- mirrors how direct
    // conversations sync their preview text in hydrateServerDirectConversations,
    // and is what keeps the inbox preview showing e.g. "X was removed from the
    // group" instead of going stale while the Messages list just sits open.
    // Gated on serverLastMessageAt (server clock only), not timestamp (which
    // also gets bumped optimistically by the local clock on send) -- mixing
    // those two clocks is what let a local optimistic send permanently freeze
    // this preview once the local clock ran ahead of the server's.
    if (serverGroup.lastMessage !== undefined && serverGroup.lastMessage !== null
        && (serverGroup.lastMessageAt || 0) >= (existingConv.serverLastMessageAt || 0)) {
      existingConv.lastMessage = truncateText(serverGroup.lastMessage, 100);
      existingConv.timestamp = serverGroup.lastMessageAt || existingConv.timestamp;
      existingConv.serverLastMessageAt = serverGroup.lastMessageAt || existingConv.serverLastMessageAt;
    }

    // Server is the source of truth for unread count (see GET /api/groups),
    // mirroring hydrateServerDirectConversations below -- this used to be
    // hardcoded to 0 on every hydrate, which is why a group's unread badge
    // never appeared no matter how many unread messages it had.
    if (serverGroup.unreadCount !== undefined) {
      existingConv.unreadCount = serverGroup.unreadCount;
    }

    // A group you're now a member of must not linger in the Discover feed.
    discoverGroups = discoverGroups.filter(g => g.id !== serverGroup.id);

    return shaped;
  }

  // Helper: create a new group and associated conversation (local demo groups)
  function createGroup(groupName, groupDescription, selectedMembers, avatarData, visibility) {
    const groupId = generateGroupId();
    const timestamp = Date.now();
    const avatarValue = avatarData || generateDefaultAvatar(groupName);
    const groupVisibility = visibility === 'public' ? 'public' : 'private';

    const newGroup = {
      id: groupId,
      name: groupName,
      description: groupDescription,
      avatar: avatarValue,
      visibility: groupVisibility,
      creatorId: 'user_self',
      memberCount: selectedMembers.length + 1, // +1 for the user
      members: [
        { id: 'user_self', username: 'You', role: 'owner' },
        ...selectedMembers.map(m => ({ ...m, role: m.role || 'member' }))
      ],
      joinRequests: [],
      createdAt: timestamp,
      source: 'local',
      messages: [groupSystemMessage('Group created.', timestamp)]
    };

    groups.push(newGroup);

    const newConversation = {
      id: 'conv_' + groupId,
      type: 'group',
      groupId: groupId,
      name: groupName,
      avatar: avatarValue,
      lastMessage: 'Group created.',
      timestamp: timestamp,
      unreadCount: 0
    };

    conversations.unshift(newConversation);

    console.log('Group created:', newGroup);
    return groupId;
  }

  // Hydrate server-backed groups: the caller's own groups, and the public groups
  // they haven't joined (the Discover feed). Non-fatal — the hardcoded demo
  // fixtures still render if the network or the DB is unavailable.
  async function hydrateServerGroups() {
    let changed = false;
    try {
      const [mineRes, discoverRes] = await Promise.all([
        fetch('/api/groups?scope=mine', { headers: authHeaders() }),
        fetch('/api/groups?scope=discover', { headers: authHeaders() })
      ]);

      if (mineRes.ok) {
        const payload = await mineRes.json();
        // One malformed group must not poison the rest of the list -- a
        // single bad entry throwing here used to abort the whole forEach,
        // silently dropping every group after it (including brand-new ones).
        (payload.groups || []).forEach(g => {
          try {
            const before = conversations.find(c => c.groupId === g.id);
            const prevLastMessage = before ? before.lastMessage : undefined;
            const prevTimestamp = before ? before.timestamp : undefined;
            addServerGroupToState(g);
            const after = conversations.find(c => c.groupId === g.id);
            if (!before || (after && (after.lastMessage !== prevLastMessage || after.timestamp !== prevTimestamp))) {
              changed = true;
            }
          } catch (error) {
            console.error('Failed to hydrate group ' + g.id + ':', error);
          }
        });
      }

      if (discoverRes.ok) {
        const payload = await discoverRes.json();
        (payload.groups || []).forEach(g => {
          if (groups.some(existing => existing.id === g.id)) return;
          if (discoverGroups.some(existing => existing.id === g.id)) return;
          discoverGroups.push({
            id: g.id,
            name: g.name,
            description: g.description || '',
            avatar: g.avatarUrl || g.avatar || generateDefaultAvatar(g.name),
            memberCount: g.memberCount,
            visibility: 'public',
            creatorId: g.creatorId,
            members: [],
            joinRequests: [],
            isFeatured: false,
            isNew: !!g.isNew,
            createdAt: g.createdAt || Date.now(),
            source: 'server'
          });
        });
      }
    } catch (error) {
      console.warn('Could not load server groups:', error);
    }
    return changed;
  }

  // Insert a server-returned channel (plus its conversation row) into local
  // state. Shared by the create-channel flow, follow/unfollow, and boot-time
  // hydration so all produce exactly the same shape.
  //
  // Channels have no members array (unlike groups), so ownership elsewhere in
  // this file is checked directly via channel.creatorId === 'user_self' --
  // that means the sentinel translation groups get for free from
  // mapServerMember has to happen explicitly here instead.
  function addServerChannelToState(serverChannel) {
    const isMe = currentUser && serverChannel.creatorId === currentUser.id;
    const existing = channels.find(c => c.id === serverChannel.id);
    const shaped = {
      id: serverChannel.id,
      name: serverChannel.name,
      description: serverChannel.description || '',
      avatar: serverChannel.avatarUrl || serverChannel.avatar || generateDefaultAvatar(serverChannel.name),
      avatarImageId: serverChannel.avatarImageId || null,
      isPublic: true,
      creatorId: isMe ? 'user_self' : serverChannel.creatorId,
      createdAt: serverChannel.createdAt || Date.now(),
      followerCount: serverChannel.followerCount || 0,
      followers: Object.assign({}, existing && existing.followers, serverChannel.isFollowing ? { user_self: true } : {}),
      mutedByUsers: (existing && existing.mutedByUsers) || {},
      admins: (existing && existing.admins) || [],
      // Real history is hydrated lazily when the channel is opened (see
      // hydrateChannelPosts) -- keep whatever posts are already loaded.
      posts: (existing && existing.posts) || [],
      source: 'server'
    };

    if (existing) {
      Object.assign(existing, shaped);
    } else {
      channels.push(shaped);
    }

    const lastPost = shaped.posts[0];
    const existingConv = conversations.find(c => c.type === 'channel' && c.channelId === serverChannel.id);
    if (existingConv) {
      existingConv.name = shaped.name;
      existingConv.avatar = shaped.avatar;
    } else if (shaped.followers['user_self']) {
      conversations.unshift({
        id: 'conv_channel_' + serverChannel.id,
        type: 'channel',
        channelId: serverChannel.id,
        name: shaped.name,
        avatar: shaped.avatar,
        lastMessage: lastPost ? truncateText(messagePreviewText(lastPost), 100) : 'No posts yet',
        timestamp: lastPost ? lastPost.timestamp : shaped.createdAt,
        unreadCount: 0,
        archived: false,
        pinned: false
      });
    }

    // A channel you now follow must not linger in the Discover feed.
    discoverChannels = discoverChannels.filter(c => c.id !== serverChannel.id);

    return shaped;
  }

  // Hydrate server-backed channels: the caller's own/followed channels, and
  // the public channels they haven't followed yet (the Discover feed).
  // Non-fatal -- a network or DB hiccup just leaves the lists empty.
  async function hydrateServerChannels() {
    try {
      const [mineRes, discoverRes] = await Promise.all([
        fetch('/api/channels?scope=mine', { headers: authHeaders() }),
        fetch('/api/channels?scope=discover', { headers: authHeaders() })
      ]);

      if (mineRes.ok) {
        const payload = await mineRes.json();
        (payload.channels || []).forEach(c => addServerChannelToState(c));
      }

      if (discoverRes.ok) {
        const payload = await discoverRes.json();
        (payload.channels || []).forEach(c => {
          if (channels.some(existing => existing.id === c.id)) return;
          if (discoverChannels.some(existing => existing.id === c.id)) return;
          discoverChannels.push({
            id: c.id,
            name: c.name,
            description: c.description || '',
            avatar: c.avatarUrl || c.avatar || generateDefaultAvatar(c.name),
            visibility: 'public',
            memberCount: c.followerCount || 0,
            creatorId: c.creatorId,
            isFeatured: false,
            isNew: !!c.isNew,
            createdAt: c.createdAt || Date.now(),
            source: 'server'
          });
        });
      }
    } catch (error) {
      console.warn('Could not load server channels:', error);
    }
  }

  // Hydrate the inbox with real DM conversations the caller has actually sent
  // or received a message in. Without this, a real conv_<peerId> conversation
  // -- created purely in-memory by startConversationWith -- vanishes from the
  // Messages list the moment the page reloads, even though the messages
  // themselves are now persisted server-side.
  async function hydrateServerDirectConversations() {
    let changed = false;
    try {
      const response = await authFetch('/api/direct-conversations', { headers: authHeaders() });
      if (!response.ok) return false;
      const payload = await response.json();
      (payload.conversations || []).forEach(dc => {
        const convId = 'conv_' + dc.peerId;
        let conv = conversations.find(c => c.id === convId);
        if (!conv) {
          conv = {
            id: convId,
            type: 'direct',
            username: dc.peerUsername,
            avatar: generateDefaultAvatar(dc.peerUsername),
            lastMessage: '',
            // 0, not Date.now() -- the check below only applies dc.lastMessage
            // when it's newer than what's already known. A freshly-created
            // conv has no "known" activity yet, so seeding this with the
            // current time would make every real dc.lastMessageAt (always in
            // the past) lose that comparison and the preview/timestamp would
            // never populate.
            timestamp: 0,
            // Tracks the latest lastMessageAt this client has actually seen
            // FROM THE SERVER, kept separate from `timestamp` (below) which
            // also gets bumped optimistically with the local clock the instant
            // a message is sent (see updateConversationLastMessage). Gating
            // this poll on `timestamp` used to compare a local Date.now()
            // against the server's created_at -- once the local clock ran
            // ahead (even by a little), every future server response looked
            // "older" and the row froze forever, showing a stale preview here
            // while the chat view (which reads messages live) kept working.
            // Comparing only server-vs-server values keeps this monotonic.
            serverLastMessageAt: 0,
            unreadCount: 0,
            onlineStatus: false,
            archived: false,
            pinned: false,
            hiddenFromInbox: false,
            mutedByUsers: {},
            messages: []
          };
          conversations.unshift(conv);
          changed = true;
        }
        if (dc.lastMessage !== null && (dc.lastMessageAt || 0) >= (conv.serverLastMessageAt || 0)) {
          if (conv.lastMessage !== truncateText(dc.lastMessage, 100) || conv.timestamp !== (dc.lastMessageAt || conv.timestamp)) changed = true;
          conv.lastMessage = truncateText(dc.lastMessage, 100);
          conv.timestamp = dc.lastMessageAt || conv.timestamp;
          conv.serverLastMessageAt = dc.lastMessageAt || conv.serverLastMessageAt;
        }
        // 'pending_sent' means the caller started this thread and the other
        // side hasn't accepted yet -- renderConversationPage shows a banner.
        if (conv.requestStatus !== dc.requestStatus) changed = true;
        conv.requestStatus = dc.requestStatus;
        if (conv.pinned !== dc.pinned) changed = true;
        conv.pinned = dc.pinned;
        if (conv.hiddenFromInbox !== dc.hiddenFromInbox) changed = true;
        conv.hiddenFromInbox = dc.hiddenFromInbox;
        // Server is the source of truth for unread count, except while this
        // conversation's thread is the one currently open -- a poll response
        // in flight before the markRead PUT lands shouldn't flip it back to
        // unread out from under the user who is actively reading it.
        if (currentOpenConversationId !== convId) {
          if (conv.unreadCount !== dc.unreadCount) changed = true;
          conv.unreadCount = dc.unreadCount;
        }
      });
      return changed;
    } catch (error) {
      console.warn('Could not load direct conversations:', error);
      return false;
    }
  }

  // Bulk read-back of the caller's own pin/unread/hidden overrides, applied
  // onto whichever conversations are already in state. Must run after the
  // group/channel/direct hydrations above so every conv this account has a
  // real override for already exists in `conversations` to match against --
  // otherwise the override would have nothing to attach to and be dropped.
  async function hydrateConversationUserState() {
    try {
      const response = await authFetch('/api/conversations/state', { headers: authHeaders() });
      if (!response.ok) return;
      const payload = await response.json();
      const states = payload.states || {};
      Object.keys(states).forEach(convId => {
        const conv = conversations.find(c => c.id === convId);
        if (!conv) return;
        const state = states[convId];
        conv.pinned = !!state.pinned;
        conv.manuallyMarkedUnread = !!state.manuallyMarkedUnread;
        if (state.hiddenFromInbox) conv.hiddenFromInbox = true;

        // Channels keep their mute flag on the channel entity itself (shared
        // with the per-follower unread-suppression check); DMs and groups
        // keep it on the conversation row. See isConversationMuted.
        if (conv.type === 'channel') {
          const channel = channels.find(c => c.id === conv.channelId);
          if (channel) {
            if (!channel.mutedByUsers) channel.mutedByUsers = {};
            if (state.muted) {
              channel.mutedByUsers['user_self'] = true;
            } else {
              delete channel.mutedByUsers['user_self'];
            }
          }
        } else {
          if (!conv.mutedByUsers) conv.mutedByUsers = {};
          if (state.muted) {
            conv.mutedByUsers['user_self'] = true;
          } else {
            delete conv.mutedByUsers['user_self'];
          }
        }
      });
    } catch (error) {
      console.warn('Could not load conversation state:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Message delivery (DM / group / channel) -- fetch + poll on top of the
  // existing local-only optimistic send. Any fetch/poll failure (401 when
  // unauthenticated, network error, etc.) is swallowed and falls back to
  // whatever's already rendered locally, same as fetchSuggestedUsers/
  // hydrateServerGroups above -- so screenshot/test deep links that never
  // carry a real token keep behaving exactly as before.
  // ---------------------------------------------------------------------------

  // A DM conversation's id is always `conv_<peerId>` (see startConversationWith
  // above), for both real and mock/fixture conversations alike -- the server
  // just won't find a real peer or a real conversation row for a mock id, so
  // the fetch below harmlessly resolves to an empty thread.
  function directPeerId(conversationId) {
    return typeof conversationId === 'string' && conversationId.startsWith('conv_')
      ? conversationId.slice('conv_'.length)
      : null;
  }

  function shapeIncomingMessage(serverMsg) {
    const msg = {
      id: serverMsg.id,
      senderId: serverMsg.senderId,
      senderName: serverMsg.senderName,
      text: serverMsg.text || '',
      timestamp: serverMsg.timestamp,
      isOutgoing: !!(currentUser && serverMsg.senderId === currentUser.id)
    };
    if (serverMsg.isSystemMessage) {
      msg.isSystemMessage = true;
    }
    if (serverMsg.imageUrl) {
      msg.imageUrl = serverMsg.imageUrl;
      msg.imageId = serverMsg.imageId;
    }
    if (serverMsg.replyToMessageId) {
      msg.replyTo = {
        messageId: serverMsg.replyToMessageId,
        senderName: serverMsg.replyToSenderName,
        previewText: serverMsg.replyToPreviewText
      };
    }
    return msg;
  }

  // Merge server history into a DM/group thread's local `.messages` array.
  // Dedupes by id -- an outgoing message's id is client-chosen (see
  // setupComposer) and echoed back unchanged, so the optimistic bubble never
  // doubles up once the poll below sees it land. Returns whether anything new
  // was merged, so callers know whether a re-render is worth doing.
  //
  // Also drops any local message the server no longer returns -- that's how a
  // message deleted by any participant disappears from every other open
  // client on its next poll tick, with no notification. A message is only
  // ever dropped this way once it's been `.confirmed` present in a previous
  // server response; an optimistic send still in flight (or one that failed)
  // is never `.confirmed`, so it can't be wiped out by a poll that simply
  // raced ahead of its own delivery POST.
  async function hydrateThreadMessages(type, id, thread) {
    if (!id) return false;
    try {
      const response = await authFetch(`/api/messages/${type}/${encodeURIComponent(id)}`, { headers: authHeaders() });
      if (!response.ok) return false;
      const payload = await response.json();
      const serverMessages = payload.messages || [];
      const serverIds = new Set(serverMessages.map(m => m.id));
      let changed = false;
      serverMessages.forEach(serverMsg => {
        const existing = thread.messages.find(m => m.id === serverMsg.id);
        if (existing) {
          existing.confirmed = true;
          return;
        }
        const msg = shapeIncomingMessage(serverMsg);
        msg.confirmed = true;
        thread.messages.push(msg);
        changed = true;
      });
      const stillPresent = thread.messages.filter(m => m.confirmed !== true || serverIds.has(m.id));
      if (stillPresent.length !== thread.messages.length) {
        thread.messages.length = 0;
        thread.messages.push(...stillPresent);
        changed = true;
      }
      if (changed) thread.messages.sort((a, b) => a.timestamp - b.timestamp);
      return changed;
    } catch (error) {
      console.warn(`Could not load ${type} messages:`, error);
      return false;
    }
  }

  // Same idea as hydrateThreadMessages (including the same "drop what the
  // server no longer returns" reconciliation and .confirmed safety guard),
  // but into a channel's `.posts` (newest first, since publishPost unshifts)
  // rather than a chat thread's `.messages`.
  async function hydrateChannelPosts(channelId, channel) {
    try {
      const response = await authFetch(`/api/messages/channel/${encodeURIComponent(channelId)}`, { headers: authHeaders() });
      if (!response.ok) return false;
      const payload = await response.json();
      const serverMessages = payload.messages || [];
      const serverIds = new Set(serverMessages.map(m => m.id));
      let changed = false;
      serverMessages.forEach(serverMsg => {
        const existing = channel.posts.find(p => p.id === serverMsg.id);
        if (existing) {
          existing.confirmed = true;
          return;
        }
        const post = {
          id: serverMsg.id,
          channelId: channelId,
          authorId: serverMsg.senderId,
          text: serverMsg.text || '',
          timestamp: serverMsg.timestamp,
          reactions: {},
          isPinned: false,
          confirmed: true
        };
        if (serverMsg.imageUrl) {
          post.imageUrl = serverMsg.imageUrl;
          post.imageId = serverMsg.imageId;
        }
        channel.posts.push(post);
        changed = true;
      });
      const stillPresent = channel.posts.filter(p => p.confirmed !== true || serverIds.has(p.id));
      if (stillPresent.length !== channel.posts.length) {
        channel.posts.length = 0;
        channel.posts.push(...stillPresent);
        changed = true;
      }
      if (changed) channel.posts.sort((a, b) => b.timestamp - a.timestamp);
      return changed;
    } catch (error) {
      console.warn('Could not load channel posts:', error);
      return false;
    }
  }

  // Screenshot-state helper: pad a real (possibly short) thread/feed with
  // synthetic, client-only filler so there is enough scrollable height for the
  // scroll-fab tests to mean anything. Never sent to the server -- exists only
  // for the lifetime of this render, on whichever thread the deep link opened.
  const SHOT_LONG_THREAD_TARGET_COUNT = 30;
  function padForShotLongThread(items, sortAscending, makeFiller) {
    if (!SHOT_LONG_THREAD) return;
    if (items.length >= SHOT_LONG_THREAD_TARGET_COUNT) return;
    const timestamps = items.map(i => i.timestamp).filter(t => typeof t === 'number');
    const oldest = timestamps.length ? Math.min(...timestamps) : Date.now();
    const needed = SHOT_LONG_THREAD_TARGET_COUNT - items.length;
    for (let i = needed; i >= 1; i--) {
      items.push(makeFiller(oldest - i * 60000, needed - i + 1));
    }
    items.sort((a, b) => sortAscending ? a.timestamp - b.timestamp : b.timestamp - a.timestamp);
  }

  // "Someone is typing…" -- fetch the list of other participants currently
  // typing (DM: at most one; group: any member), and render it into the
  // thread's indicator bar. SHOT_TYPING_DEMO short-circuits the real fetch so
  // the bar is reachable from a plain deep link for screenshots.
  async function fetchTypingUsers(type, id) {
    if (SHOT_TYPING_DEMO) return ['staging-demo-ana'];
    if (!id) return [];
    try {
      const response = await authFetch(`/api/typing/${type}/${encodeURIComponent(id)}`, { headers: authHeaders() });
      if (!response.ok) return [];
      const payload = await response.json();
      return payload.typing || [];
    } catch (error) {
      console.warn(`Could not load ${type} typing status:`, error);
      return [];
    }
  }

  // Patches the indicator bar's text/visibility in place -- never a full
  // thread re-render, so it can't clobber an in-progress composer draft or
  // scroll position. `isGroup` selects the name-formatting rule: DMs only
  // ever have one other participant, so they get a fixed "Typing…"; groups
  // name who's typing since there can be more than one.
  function renderTypingIndicator(barEl, isGroup, names) {
    if (!barEl) return;
    if (!names || names.length === 0) {
      barEl.textContent = '';
      barEl.classList.remove('is-visible');
      return;
    }
    let text;
    if (!isGroup) {
      text = 'Typing…';
    } else if (names.length === 1) {
      text = `${names[0]} is typing…`;
    } else if (names.length === 2) {
      text = `${names[0]} and ${names[1]} are typing…`;
    } else {
      text = `${names[0]} and ${names.length - 1} others are typing…`;
    }
    barEl.textContent = text;
    barEl.classList.add('is-visible');
  }

  // At most one thread polls at a time -- only one conversation/group/channel
  // screen is ever open at once, so there's nothing to key this by.
  let activeThreadPollTimer = null;
  const THREAD_POLL_INTERVAL_MS = 4000;

  // Whichever screen's polling is currently active (a thread or the Messages
  // list -- never both, since the two poll loops are mutually exclusive)
  // registers its own "re-fetch and retry" closure here. The visibilitychange/
  // online listeners below call this instead of tracking per-screen state
  // themselves, so a tab regaining focus/connectivity immediately re-syncs
  // whatever's actually on screen.
  let activeScreenResync = null;

  function stopThreadPolling() {
    if (activeThreadPollTimer) {
      clearInterval(activeThreadPollTimer);
      activeThreadPollTimer = null;
    }
    activeScreenResync = null;
  }

  // retryFailed is optional: called only during a foreground/reconnect resync
  // (never on the regular interval poll below), so a flaky connection doesn't
  // spam retries every 4s -- only once when the tab actually comes back.
  function startThreadPolling(hydrateFn, onChanged, retryFailed) {
    stopThreadPolling();
    if (sessionExpired) return;
    activeScreenResync = async () => {
      const changed = await hydrateFn();
      if (changed) onChanged();
      if (typeof retryFailed === 'function' && retryFailed()) onChanged();
    };
    // Immediate on-entry refresh only re-hydrates -- it must NOT also invoke
    // retryFailed, or a still-failing send re-renders this screen (to show the
    // updated failure state), which calls startThreadPolling again, whose
    // immediate refresh would retry again, forever, hammering the server as
    // fast as the retries fail. retryFailed only runs from resyncActiveScreen
    // (foreground/reconnect), matching the comment above.
    hydrateFn().then(changed => { if (changed) onChanged(); });
    activeThreadPollTimer = setInterval(async () => {
      const changed = await hydrateFn();
      if (changed) onChanged();
    }, THREAD_POLL_INTERVAL_MS);
  }

  // Separate, shorter-interval lifecycle from the thread-history poll above
  // (2.5s vs 4s) since "someone started typing" needs to appear/disappear
  // snappier than message history does. Always started/stopped in lockstep
  // with startThreadPolling/stopThreadPolling at both the DM and group call
  // sites, but kept as its own timer so patching the indicator bar never
  // triggers (or waits on) the message-history re-render path.
  let activeTypingPollTimer = null;
  const TYPING_POLL_INTERVAL_MS = 2500;

  function stopTypingPolling() {
    if (activeTypingPollTimer) {
      clearInterval(activeTypingPollTimer);
      activeTypingPollTimer = null;
    }
  }

  function startTypingPolling(fetchFn, patchFn) {
    stopTypingPolling();
    if (sessionExpired) return;
    const tick = async () => patchFn(await fetchFn());
    tick();
    activeTypingPollTimer = setInterval(tick, TYPING_POLL_INTERVAL_MS);
  }

  // Keep the Messages list / Requests tab live too -- without this, a newly
  // received DM (or an incoming request) only shows up after the user leaves
  // and re-opens the Messages screen, since nothing else refetches those two
  // endpoints while this screen is just sitting open.
  let messagesListPollTimer = null;
  const MESSAGES_LIST_POLL_INTERVAL_MS = 7000;

  function stopMessagesListPolling() {
    if (messagesListPollTimer) {
      clearInterval(messagesListPollTimer);
      messagesListPollTimer = null;
    }
    activeScreenResync = null;
  }

  function startMessagesListPolling() {
    stopMessagesListPolling();
    if (sessionExpired) return;
    activeScreenResync = async () => {
      const [conversationsChanged, requestsChanged, groupsChanged] = await Promise.all([
        hydrateServerDirectConversations(),
        hydrateMessageRequests(),
        hydrateServerGroups()
      ]);
      if (conversationsChanged || requestsChanged || groupsChanged) renderMessagesPage();
    };
    activeScreenResync();
    messagesListPollTimer = setInterval(async () => {
      const [conversationsChanged, requestsChanged, groupsChanged] = await Promise.all([
        hydrateServerDirectConversations(),
        hydrateMessageRequests(),
        hydrateServerGroups()
      ]);
      if (conversationsChanged || requestsChanged || groupsChanged) renderMessagesPage();
    }, MESSAGES_LIST_POLL_INTERVAL_MS);
  }

  // Foreground/reconnect resync: a tab coming back into view, or the network
  // coming back online, is exactly when the 4-7s poll interval is most likely
  // to have just missed something (or to have been suspended entirely, which
  // background tabs commonly do to throttled timers) -- so re-run whatever
  // screen's hydrate is currently active right away instead of waiting out
  // the rest of that interval.
  async function resyncActiveScreen() {
    if (sessionExpired || !activeScreenResync) return;
    try {
      await activeScreenResync();
    } catch (error) {
      console.warn('Foreground resync failed:', error);
    }
  }

  // Best-effort delivery of an already-optimistically-rendered DM/group
  // message. The bubble is already on screen from the local push in
  // setupComposer -- this just makes the OTHER participant actually see it
  // too (and lets it survive a reload), instead of it living only in this
  // tab's JS heap.
  function deliverThreadMessage(type, id, message, onFailure) {
    if (!id) return;
    delete message.failed;
    // Screenshot-state: simulate a delivery failure deterministically instead
    // of actually breaking the network, so dapp.json can assert the "Failed
    // to send" indicator renders.
    if (SHOT_SEND_FAIL) {
      message.failed = true;
      if (typeof onFailure === 'function') onFailure();
      return;
    }
    authFetch(`/api/messages/${type}/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        id: message.id,
        text: message.text,
        imageUrl: message.imageUrl,
        imageId: message.imageId,
        replyTo: message.replyTo
      })
    }).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }).then(payload => {
      // The client stamped this bubble with its own clock when it was pushed
      // optimistically -- swap in the server's timestamp (and id, defensively)
      // now that we know them, so the bubble sorts correctly against messages
      // that arrive from the other participant with a server-issued clock.
      const serverMessage = payload && payload.message;
      if (!serverMessage) return;
      if (typeof serverMessage.timestamp === 'number') message.timestamp = serverMessage.timestamp;
      if (serverMessage.id) message.id = serverMessage.id;
      if (typeof onFailure === 'function') onFailure();
    }).catch(error => {
      console.warn(`Could not deliver ${type} message:`, error);
      message.failed = true;
      if (typeof onFailure === 'function') onFailure();
    });
  }

  // Persist "caller has read up to now" for a conversation server-side, so
  // unreadCount computed by GET /api/direct-conversations reflects reality on
  // the next hydrate/poll instead of only resetting in this tab's memory.
  function markConversationRead(conversationId) {
    fetch(`/api/conversations/${encodeURIComponent(conversationId)}/state`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ markRead: true })
    }).catch(error => console.warn('Could not mark conversation read:', error));
  }

  // Format relative timestamp for conversation list
  function formatTimestamp(timestamp) {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMin = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMin < 1) return 'Now';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d`;

    // For dates older than 7 days, format as "Mon DD"
    const date = new Date(timestamp);
    const monthAbbr = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${monthAbbr} ${day}`;
  }

  // Format time for message timestamps (e.g., "2:34 PM")
  function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  // Small pin badge shown above a pinned message's bubble
  function renderPinBadge(msg) {
    if (!msg.isPinned) return '';
    return `<div class="message-pin-badge"><span class="message-pin-icon">📌</span>Pinned</div>`;
  }

  // Truncate text to 50 characters with ellipsis
  function truncateText(text, length = 50) {
    const value = text == null ? '' : String(text);
    if (value.length > length) {
      return value.substring(0, length) + '…';
    }
    return value;
  }

  // Escape a value for safe interpolation into an HTML attribute
  function escapeAttr(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Turn http(s):// and www.-prefixed URLs in plain message text into clickable
  // links. Runs on the ORIGINAL (unescaped) string so it can split cleanly on
  // real URL boundaries, then escapes each side of the split independently -
  // a URL containing HTML-special characters can never break out of the
  // surrounding markup this way. This also closes the escaping gap the plain
  // text branch of messageBodyHTML() used to have (message text went into
  // innerHTML unescaped), since every caller now routes through here.
  const LINK_PATTERN = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

  function linkifyHTML(text) {
    const value = text == null ? '' : String(text);
    let result = '';
    let lastIndex = 0;
    let match;
    LINK_PATTERN.lastIndex = 0;
    while ((match = LINK_PATTERN.exec(value)) !== null) {
      result += escapeHtml(value.slice(lastIndex, match.index));

      // Trailing punctuation is almost never part of the URL itself, so
      // "see https://example.com." links to example.com, not example.com.
      let url = match[0];
      let trailing = '';
      const trailingMatch = url.match(/[).,!?:;]+$/);
      if (trailingMatch) {
        trailing = trailingMatch[0];
        url = url.slice(0, -trailing.length);
      }

      if (url) {
        const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        result += `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer" class="message-link">${escapeHtml(url)}</a>`;
      }
      result += escapeHtml(trailing);

      lastIndex = match.index + match[0].length;
    }
    result += escapeHtml(value.slice(lastIndex));
    return result;
  }

  // Only allow platform-hosted https URLs or inline image data URIs
  function safeImageUrl(url) {
    if (typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (/^https:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed)) {
      return trimmed;
    }
    return null;
  }

  // Preview text used in the conversation list, reply quotes and toasts.
  // Image messages have no (or optional) text, so they get a 📷 prefix.
  function messagePreviewText(msg) {
    if (!msg) return '';
    if (msg.imageUrl) {
      return msg.text ? `📷 ${msg.text}` : '📷 Photo';
    }
    return msg.text || '';
  }

  // Body of a message bubble - plain text, or an image with optional caption
  function messageBodyHTML(msg) {
    const url = msg.imageUrl ? safeImageUrl(msg.imageUrl) : null;
    if (!url) return linkifyHTML(msg.text);

    const caption = msg.text
      ? `<div class="message-caption">${linkifyHTML(msg.text)}</div>`
      : '';
    return `
      <img class="message-image" src="${escapeAttr(url)}" alt="Photo" loading="lazy"
           data-message-id="${escapeAttr(msg.id)}"
           onerror="this.classList.add('message-image-missing');" />
      ${caption}
    `;
  }

  // Extra class for bubbles that hold an image (removes bubble padding)
  function messageBubbleClass(msg) {
    return msg && msg.imageUrl && safeImageUrl(msg.imageUrl) ? ' has-image' : '';
  }

  // Filter conversations by tab and search query
  function filterConversations(tab, query) {
    let filtered = [];

    if (tab === 'all') {
      filtered = conversations;
    } else if (tab === 'dm') {
      filtered = conversations.filter(c => c.type === 'direct');
    } else if (tab === 'groups') {
      filtered = conversations.filter(c => c.type === 'group');
    } else if (tab === 'channels') {
      filtered = conversations.filter(c => c.type === 'channel');
    } else if (tab === 'requests') {
      filtered = requests;
    }

    // Deleted/left/unfollowed conversations stay in the array (so their
    // messages survive) but must disappear from every inbox tab.
    if (tab !== 'requests') {
      filtered = filtered.filter(c => !c.hiddenFromInbox);
    }

    // Deduplication: keep only the first occurrence of each conversation ID
    const seen = new Set();
    filtered = filtered.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(item => {
        const searchText = (item.senderName || item.username || item.name || '').toLowerCase() +
                          ' ' + (item.messagePreview || item.lastMessage || '').toLowerCase();
        return searchText.includes(q);
      });
    }

    return filtered;
  }

  // Sort conversations (pinned first, then by timestamp)
  function sortConversations(convs) {
    return convs.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.timestamp - a.timestamp;
    });
  }

  // Markup for a single conversation row, shared by the full page render and
  // the search-debounced partial re-render. Includes the selection indicator
  // used by the WhatsApp/Telegram-style multi-select mode.
  function conversationItemHTML(item) {
    let displayName, routeHash;
    if (item.type === 'group') {
      displayName = item.name;
      routeHash = `/group/${item.groupId}`;
    } else if (item.type === 'channel') {
      displayName = item.name;
      routeHash = `/channel/${item.channelId}`;
    } else {
      displayName = item.username;
      routeHash = `/conversation/${item.id}`;
    }
    const badgeColor = item.type === 'channel' ? '#FF6B6B' : '#007AFF';
    const isSelected = selectedConversationIds.has(item.id);
    const isMuted = isConversationMuted(item);

    return `
      <div class="conversation-item ${item.pinned ? 'pinned' : ''} ${messagesSelectionMode ? 'selection-mode' : ''} ${isSelected ? 'selected' : ''}" data-conversation-id="${item.id}" data-route-hash="${routeHash}">
        ${messagesSelectionMode ? `<div class="conversation-select-indicator ${isSelected ? 'checked' : ''}">${isSelected ? '✓' : ''}</div>` : ''}
        <div class="conversation-avatar">${escapeHtml(item.avatar)}</div>
        <div class="conversation-content">
          <div class="conversation-header">
            <span class="conversation-username-row">
              ${item.pinned ? '<span class="conversation-pin-icon">📌</span>' : ''}
              <span class="conversation-username">${escapeHtml(displayName)}</span>
              ${isMuted ? '<span class="conversation-mute-icon">🔕</span>' : ''}
            </span>
            <span class="conversation-timestamp">${formatTimestamp(item.timestamp)}</span>
          </div>
          <p class="conversation-message">${escapeHtml(item.lastMessage)}</p>
        </div>
        ${item.unreadCount > 0
          ? `<div class="unread-badge" style="background-color: ${badgeColor};">${item.unreadCount > 9 ? '9+' : item.unreadCount}</div>`
          : (item.manuallyMarkedUnread ? `<div class="unread-badge unread-dot" style="background-color: ${badgeColor};"></div>` : '')}
      </div>
    `;
  }

  // Update only the conversations list (used during search to avoid full page re-render)
  function updateConversationsList() {
    const filteredConversations = filterConversations(activeMessagesTab, searchQuery);
    const sortedConversations = activeMessagesTab === 'requests' ? filteredConversations : sortConversations(filteredConversations);

    const conversationsList = sortedConversations.map(item => {
      if (activeMessagesTab === 'requests') {
        return `
          <div class="request-item" data-request-id="${item.id}">
            <div class="request-header">
              <div class="request-avatar">${escapeHtml(item.avatar)}</div>
              <div class="request-content">
                <div class="request-name">${escapeHtml(item.senderName)}</div>
                <div class="request-message">${escapeHtml(truncateText(item.messagePreview, 60))}</div>
              </div>
            </div>
            <div class="request-actions">
              <button class="request-accept" data-request-id="${item.id}">Accept</button>
              <button class="request-decline" data-request-id="${item.id}">Decline</button>
            </div>
          </div>
        `;
      }
      return conversationItemHTML(item);
    }).join('');

    const emptyMessage = {
      all: 'No conversations yet',
      dm: 'No direct messages',
      groups: 'No groups',
      channels: 'No channels',
      requests: 'No pending requests'
    }[activeMessagesTab];

    const listEl = document.getElementById('conversations-list');
    if (listEl) {
      listEl.innerHTML = conversationsList || `<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-message">${emptyMessage}</div></div>`;
      attachConversationListeners();
      setupConversationSelection();
    }
  }

  // Attach event listeners to conversation list items
  function attachConversationListeners() {
    // Conversation click handlers
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => {
        if (suppressNextConversationClick) {
          suppressNextConversationClick = false;
          return;
        }

        const convId = item.dataset.conversationId;

        if (messagesSelectionMode) {
          toggleConversationSelection(convId);
          return;
        }

        const routeHash = item.dataset.routeHash;
        const conv = conversations.find(c => c.id === convId);
        if (conv) {
          conv.unreadCount = 0;
          conv.manuallyMarkedUnread = false;
          markConversationRead(convId);
        }
        window.location.hash = routeHash;
      });
    });

    // Request accept/decline handlers
    document.querySelectorAll('.request-accept').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const requestId = btn.dataset.requestId;
        acceptRequest(requestId);
      });
    });

    document.querySelectorAll('.request-decline').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const requestId = btn.dataset.requestId;
        declineRequest(requestId);
      });
    });
  }

  // Enter multi-select mode with a single conversation pre-selected (fired by
  // a long-press on a conversation row).
  function startConversationSelection(convId) {
    messagesSelectionMode = true;
    selectedConversationIds = new Set([convId]);
    renderMessagesPage();
  }

  // Toggle a row's selection; dropping the last selected row exits selection
  // mode entirely, same as WhatsApp/Telegram.
  function toggleConversationSelection(convId) {
    if (selectedConversationIds.has(convId)) {
      selectedConversationIds.delete(convId);
    } else {
      selectedConversationIds.add(convId);
    }

    if (selectedConversationIds.size === 0) {
      exitMessagesSelectionMode();
      return;
    }

    renderMessagesPage();
  }

  function exitMessagesSelectionMode() {
    messagesSelectionMode = false;
    selectedConversationIds = new Set();
    renderMessagesPage();
  }

  // Update conversation last message and timestamp
  function updateConversationLastMessage(conversationId, lastMessage, newTimestamp) {
    // Group/channel threads are keyed by their own id in the list rows
    // (conv_group_1 -> groupId: group_1), so match on all three.
    const conv = conversations.find(c =>
      c.id === conversationId || c.groupId === conversationId || c.channelId === conversationId
    );
    if (conv) {
      conv.lastMessage = lastMessage;
      conv.timestamp = newTimestamp || Date.now();
    }
  }

  // Update the Messages-list row for a thread. Direct conversations ARE rows in
  // `conversations`; a group is a separate object whose row is linked by groupId.
  function updateThreadLastMessage(thread, isGroup, lastMessage, newTimestamp) {
    const row = isGroup
      ? conversations.find(c => c.groupId === thread.id)
      : conversations.find(c => c.id === thread.id);
    if (row) {
      row.lastMessage = lastMessage;
      row.timestamp = newTimestamp || Date.now();
    }
  }

  // Filter discover communities by tab
  function filterDiscoverCommunities(tab) {
    let filteredGroups = discoverGroups
      .filter(g => !groups.some(jg => jg.id === g.id))
      .filter(g => g.visibility !== 'private')
      .map(g => ({ ...g, type: 'group' }));
    let filteredChans = discoverChannels
      .filter(c => !channels.some(jc => jc.id === c.id))
      .filter(c => c.visibility !== 'private')
      .map(c => ({ ...c, type: 'channel' }));

    if (tab === 'groups') {
      return { groups: filteredGroups, channels: [] };
    } else if (tab === 'channels') {
      return { groups: [], channels: filteredChans };
    } else {
      return { groups: filteredGroups, channels: filteredChans };
    }
  }

  // Join a group from discover (public groups only — private groups go through requestToJoinGroup)
  async function joinDiscoverGroup(groupId) {
    const discoverGroup = discoverGroups.find(g => g.id === groupId);
    if (!discoverGroup || discoverGroup.visibility === 'private') return;

    // Server-backed public groups join for real; only mutate local state once
    // the server has actually recorded the membership.
    if (discoverGroup.source === 'server') {
      try {
        const response = await fetch(`/api/groups/${groupId}/join`, {
          method: 'POST',
          headers: authHeaders({ 'content-type': 'application/json' })
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to join group');
        }
        const payload = await response.json();
        addServerGroupToState(payload.group, 'You joined the group.');
        renderDiscoverPage(activeDiscoverTab);
        showToast('Joined group', { type: 'success' });
      } catch (error) {
        console.error(error);
        showToast(error.message || 'Failed to join group', { type: 'error' });
      }
      return;
    }

    const newGroup = {
      id: groupId,
      name: discoverGroup.name,
      description: discoverGroup.description,
      avatar: discoverGroup.avatar,
      visibility: discoverGroup.visibility || 'public',
      creatorId: discoverGroup.creatorId || (discoverGroup.members[0] && discoverGroup.members[0].id) || null,
      memberCount: discoverGroup.memberCount + 1,
      members: [
        { id: 'user_self', username: 'You', role: 'member' },
        ...discoverGroup.members.map(m => ({ ...m, role: m.role || 'member' }))
      ],
      joinRequests: [],
      createdAt: Date.now(),
      source: 'local',
      messages: [groupSystemMessage('You joined the group.', Date.now())]
    };

    groups.push(newGroup);

    const newConversation = {
      id: 'conv_' + groupId,
      type: 'group',
      groupId: groupId,
      name: discoverGroup.name,
      avatar: discoverGroup.avatar,
      lastMessage: 'You joined the group.',
      timestamp: Date.now(),
      unreadCount: 0,
      archived: false,
      pinned: false
    };

    conversations.unshift(newConversation);
    discoverGroups = discoverGroups.filter(g => g.id !== groupId);

    renderDiscoverPage(activeDiscoverTab);
  }

  // Request to join a private group from discover
  async function requestToJoinGroup(groupId) {
    const discoverGroup = discoverGroups.find(g => g.id === groupId);
    if (!discoverGroup) return;
    if (!discoverGroup.joinRequests) discoverGroup.joinRequests = [];
    if (discoverGroup.joinRequests.some(r => r.userId === 'user_self')) return;

    try {
      const response = await fetch(`/api/groups/${groupId}/join-requests`, {
        method: 'POST',
        headers: {
          'x-usernode-token': localStorage.getItem('usernode-token')
        }
      });

      if (!response.ok) {
        throw new Error('Failed to send join request');
      }

      discoverGroup.joinRequests.push({
        userId: 'user_self',
        username: 'You',
        requestedAt: Date.now()
      });
    } catch (error) {
      console.error(error);
      showToast('Failed to send join request', { type: 'error' });
    }
  }

  // Follow a channel from discover
  async function followDiscoverChannel(channelId) {
    const discoverChannel = discoverChannels.find(c => c.id === channelId);
    if (!discoverChannel) return;

    try {
      const response = await fetch(`/api/channels/${encodeURIComponent(channelId)}/follow`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to follow channel');
      }
      const payload = await response.json();
      addServerChannelToState(payload.channel);
      renderDiscoverPage(activeDiscoverTab);
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Failed to follow channel', { type: 'error' });
    }
  }

  // Render discover page
  function renderDiscoverPage(tab = null) {
    if (tab) activeDiscoverTab = tab;

    const filtered = filterDiscoverCommunities(activeDiscoverTab);
    const allCommunities = [...filtered.groups, ...filtered.channels];

    // Featured
    const featured = allCommunities.filter(c => c.isFeatured);
    const featuredHtml = featured.length > 0 ? `
      <div class="featured-carousel">
        ${featured.map(c => `
          <div class="featured-card" data-${c.type === 'group' ? 'group' : 'channel'}-id="${c.id}">
            <div class="featured-avatar">${renderCommunityAvatar(c.avatar, c.name)}</div>
            <div class="featured-info">
              <div class="featured-name">${c.name}</div>
              <div class="featured-type">${c.type === 'group' ? 'Group' : 'Channel'}</div>
              <div class="featured-count">${c.memberCount} ${c.type === 'group' ? 'members' : 'followers'}</div>
            </div>
            <button class="featured-button" data-${c.type === 'group' ? 'group' : 'channel'}-id="${c.id}">
              ${c.type === 'group' ? 'Join' : 'Follow'}
            </button>
          </div>
        `).join('')}
      </div>
    ` : '';

    // Trending groups
    const trendingGroups = filtered.groups.filter(g => !g.isNew).sort((a, b) => b.memberCount - a.memberCount);
    const trendingGroupsHtml = trendingGroups.length > 0 ? `
      <div class="trending-section">
        <h2>Trending Groups</h2>
        ${trendingGroups.map(g => `
          <div class="community-card" data-group-id="${g.id}">
            <div class="community-avatar">${renderCommunityAvatar(g.avatar, g.name)}</div>
            <div class="community-info">
              <div class="community-name">${g.name}</div>
              <div class="community-description">${truncateText(g.description, 60)}</div>
              <div class="community-count">${g.memberCount} members</div>
            </div>
            <button class="community-button" data-group-id="${g.id}">Join</button>
          </div>
        `).join('')}
      </div>
    ` : '';

    // Trending channels
    const trendingChannels = filtered.channels.filter(c => !c.isNew).sort((a, b) => b.memberCount - a.memberCount);
    const trendingChannelsHtml = trendingChannels.length > 0 ? `
      <div class="trending-section">
        <h2>Trending Channels</h2>
        ${trendingChannels.map(c => `
          <div class="community-card" data-channel-id="${c.id}">
            <div class="community-avatar">${renderCommunityAvatar(c.avatar, c.name)}</div>
            <div class="community-info">
              <div class="community-name">${c.name}</div>
              <div class="community-description">${truncateText(c.description, 60)}</div>
              <div class="community-count">${c.memberCount} followers</div>
            </div>
            <button class="community-button" data-channel-id="${c.id}">Follow</button>
          </div>
        `).join('')}
      </div>
    ` : '';

    // New communities
    const newGroups = filtered.groups.filter(g => g.isNew).sort((a, b) => b.createdAt - a.createdAt);
    const newChannels = filtered.channels.filter(c => c.isNew).sort((a, b) => b.createdAt - a.createdAt);
    const newComs = [...newGroups, ...newChannels];
    const newComsHtml = newComs.length > 0 ? `
      <div class="trending-section">
        <h2>New Communities</h2>
        ${newComs.map(c => `
          <div class="community-card" data-${c.type === 'group' ? 'group' : 'channel'}-id="${c.id}">
            <div class="community-avatar">${renderCommunityAvatar(c.avatar, c.name)}</div>
            <div class="community-info">
              <div class="community-name">${c.name}</div>
              <div class="community-description">${truncateText(c.description, 60)}</div>
              <div class="community-count">${c.memberCount} ${c.type === 'group' ? 'members' : 'followers'}</div>
            </div>
            <button class="community-button" data-${c.type === 'group' ? 'group' : 'channel'}-id="${c.id}">
              ${c.type === 'group' ? 'Join' : 'Follow'}
            </button>
          </div>
        `).join('')}
      </div>
    ` : '';

    const emptyHtml = allCommunities.length === 0 ? '<div class="empty-state">No communities available</div>' : '';
    const contentHtml = allCommunities.length === 0 ? emptyHtml : (featuredHtml + trendingGroupsHtml + trendingChannelsHtml + newComsHtml);

    pageContainer.innerHTML = `
      <div class="discover-page">
        <div class="messages-header">
          <h1>Guardian</h1>
        </div>
        <div class="discover-tabs">
          <button class="discover-tab ${activeDiscoverTab === 'all' ? 'active' : ''}" data-tab="all">All</button>
          <button class="discover-tab ${activeDiscoverTab === 'groups' ? 'active' : ''}" data-tab="groups">Groups</button>
          <button class="discover-tab ${activeDiscoverTab === 'channels' ? 'active' : ''}" data-tab="channels">Channels</button>
        </div>
        <div class="discover-content">
          ${contentHtml}
        </div>
      </div>
    `;

    // Tab click handlers
    document.querySelectorAll('.discover-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        renderDiscoverPage(tab.dataset.tab);
      });
    });

    // Featured card handlers
    document.querySelectorAll('.featured-card').forEach(card => {
      card.addEventListener('click', () => {
        const groupId = card.dataset.groupId;
        const channelId = card.dataset.channelId;
        if (groupId) {
          window.location.hash = `/group/${groupId}`;
        } else if (channelId) {
          window.location.hash = `/channel/${channelId}`;
        }
      });
    });

    // Featured button handlers
    document.querySelectorAll('.featured-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const groupId = btn.dataset.groupId;
        const channelId = btn.dataset.channelId;
        if (groupId) {
          joinDiscoverGroup(groupId);
        } else if (channelId) {
          followDiscoverChannel(channelId);
        }
      });
    });

    // Community card handlers
    document.querySelectorAll('.community-card').forEach(card => {
      card.addEventListener('click', () => {
        const groupId = card.dataset.groupId;
        const channelId = card.dataset.channelId;
        if (groupId) {
          window.location.hash = `/group/${groupId}`;
        } else if (channelId) {
          window.location.hash = `/channel/${channelId}`;
        }
      });
    });

    // Community button handlers
    document.querySelectorAll('.community-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const groupId = btn.dataset.groupId;
        const channelId = btn.dataset.channelId;
        if (groupId) {
          joinDiscoverGroup(groupId);
        } else if (channelId) {
          followDiscoverChannel(channelId);
        }
      });
    });

    // Update active nav tab
    navTabs.forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.page === 'discover') {
        tab.classList.add('active');
      }
    });
  }

  // Render messages page with tabs
  function renderMessagesPage(tab = null) {
    if (tab) activeMessagesTab = tab;

    const filteredConversations = filterConversations(activeMessagesTab, searchQuery);
    const sortedConversations = activeMessagesTab === 'requests' ? filteredConversations : sortConversations(filteredConversations);

    const conversationsList = sortedConversations.map(item => {
      if (activeMessagesTab === 'requests') {
        return `
          <div class="request-item" data-request-id="${item.id}">
            <div class="request-header">
              <div class="request-avatar">${escapeHtml(item.avatar)}</div>
              <div class="request-content">
                <div class="request-name">${escapeHtml(item.senderName)}</div>
                <div class="request-message">${escapeHtml(truncateText(item.messagePreview, 60))}</div>
              </div>
            </div>
            <div class="request-actions">
              <button class="request-accept" data-request-id="${item.id}">Accept</button>
              <button class="request-decline" data-request-id="${item.id}">Decline</button>
            </div>
          </div>
        `;
      }
      return conversationItemHTML(item);
    }).join('');

    const emptyMessage = {
      all: 'No conversations yet',
      dm: 'No direct messages',
      groups: 'No groups',
      channels: 'No channels',
      requests: 'No pending requests'
    }[activeMessagesTab];

    const requestsCount = requests.length;
    const requestsBadge = requestsCount > 0 ? `<span class="tab-badge">${requestsCount}</span>` : '';

    // The Groups tab's empty state gets the same entry point, so "I have no
    // groups yet" leads straight into creating one.
    const emptyStateHTML = activeMessagesTab === 'groups'
      ? `<div class="empty-state">
           <div class="empty-icon">💬</div>
           <div class="empty-message">${emptyMessage}</div>
           <button class="empty-state-action" data-testid="new-group-empty">+ New Group</button>
         </div>`
      : `<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-message">${emptyMessage}</div></div>`;

    // While selecting, the normal header/search/tabs are replaced by a
    // WhatsApp/Telegram-style selection toolbar (cancel, count, bulk delete).
    const headerHTML = messagesSelectionMode ? `
        <div class="messages-selection-toolbar">
          <button class="selection-cancel-btn un-touch-target" aria-label="Cancel selection" data-testid="selection-cancel-btn">✕</button>
          <span class="selection-count">${selectedConversationIds.size} selected</span>
          <button class="selection-delete-btn un-touch-target" aria-label="Delete selected conversations" data-testid="selection-delete-btn">🗑</button>
        </div>
      ` : `
        <div class="messages-header">
          <h1>Guardian</h1>
          <div class="messages-header-actions">
            <span class="search-icon un-touch-target">🔍</span>
          </div>
        </div>
        <div class="messages-search" id="messages-search" style="display: ${showMessagesSearch ? 'flex' : 'none'};">
          <input type="text" class="search-input" id="messages-search-input" placeholder="🔍 Search..." value="${searchQuery}" />
          <button class="search-close">✕</button>
        </div>
        <div class="messages-tabs">
          <button class="message-tab ${activeMessagesTab === 'all' ? 'active' : ''}" data-tab="all">All</button>
          <button class="message-tab ${activeMessagesTab === 'dm' ? 'active' : ''}" data-tab="dm">DM</button>
          <button class="message-tab ${activeMessagesTab === 'groups' ? 'active' : ''}" data-tab="groups">Groups</button>
          <button class="message-tab ${activeMessagesTab === 'channels' ? 'active' : ''}" data-tab="channels">Channels</button>
          <button class="message-tab ${activeMessagesTab === 'requests' ? 'active' : ''}" data-tab="requests">Requests ${requestsBadge}</button>
        </div>
      `;

    pageContainer.innerHTML = `
      <div class="messages-page">
        ${headerHTML}
        <div class="conversations-list" id="conversations-list">
          ${conversationsList || emptyStateHTML}
        </div>
      </div>
    `;

    if (messagesSelectionMode) {
      document.querySelector('.selection-cancel-btn')?.addEventListener('click', () => {
        exitMessagesSelectionMode();
      });

      document.querySelector('.selection-delete-btn')?.addEventListener('click', () => {
        bulkDeleteSelectedConversations();
      });
    } else {
      // Tab click handlers
      document.querySelectorAll('.message-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          searchQuery = '';
          showMessagesSearch = false;
          renderMessagesPage(tab.dataset.tab);
        });
      });

      // "+ New Group" entry point (Groups-tab empty state; the header action was
      // removed — group creation still lives in the Create menu at /#/create)
      document.querySelectorAll('[data-testid="new-group-empty"]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.location.hash = '/create-group';
        });
      });

      // Search icon handler
      document.querySelector('.search-icon')?.addEventListener('click', () => {
        showMessagesSearch = true;
        renderMessagesPage();
        setTimeout(() => {
          document.getElementById('messages-search-input').focus();
        }, 0);
      });

      // Notification bell handler (only rendered on the Groups tab)
      document.getElementById('notification-bell-btn')?.addEventListener('click', () => {
        openNotificationsSheet();
      });

      // Search input handler
      const searchInput = document.getElementById('messages-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          searchQuery = e.target.value;

          // Clear previous timeout
          if (searchTimeout) clearTimeout(searchTimeout);

          // Debounce: update only the conversations list after 300ms of no typing
          searchTimeout = setTimeout(() => {
            updateConversationsList();
          }, 300);
        });

        // Search close button
        document.querySelector('.search-close').addEventListener('click', () => {
          searchQuery = '';
          showMessagesSearch = false;
          renderMessagesPage();
        });
      }

      // Screenshot-state: walk the same tap the user makes (open the bell) so
      // dapp.json can assert on the notifications sheet deterministically.
      if (SHOT_NOTIFICATIONS_SHEET) {
        document.getElementById('notification-bell-btn')?.click();
      }
    }

    // Attach event listeners to conversation list items
    attachConversationListeners();

    // Long-press a conversation row to open the Select/Pin/Mute
    // action sheet (replaces the old per-row context menu); once in
    // selection mode, taps toggle rows.
    setupConversationSelection();

    // Poll while this screen stays open so a new incoming DM or request shows
    // up without the user having to leave and come back.
    startMessagesListPolling();
  }

  // Accept request and create conversation
  async function acceptRequest(requestId) {
    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    try {
      const response = await fetch(`/api/message-requests/${requestId}/accept`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (!response.ok) return;
    } catch (err) {
      console.error('Failed to accept message request:', err);
      return;
    }

    const convId = 'conv_' + request.senderId;
    if (!conversations.find(c => c.id === convId)) {
      conversations.unshift({
        id: convId,
        type: 'direct',
        username: request.senderName,
        avatar: request.avatar,
        lastMessage: request.messagePreview,
        timestamp: request.timestamp,
        unreadCount: 0,
        archived: false,
        pinned: false,
        onlineStatus: false,
        mutedByUsers: {},
        messages: []
      });
    }
    requests = requests.filter(r => r.id !== requestId);
    renderMessagesPage();
  }

  // Decline request
  async function declineRequest(requestId) {
    try {
      const response = await fetch(`/api/message-requests/${requestId}/decline`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (!response.ok) return;
    } catch (err) {
      console.error('Failed to decline message request:', err);
      return;
    }

    requests = requests.filter(r => r.id !== requestId);
    renderMessagesPage();
  }

  // Leaves a group: shared by the Leave Group dialog and bulk delete from the
  // Messages list selection toolbar. Returns whether it succeeded.
  async function performLeaveGroup(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return false;

    try {
      if (group.source === 'server') {
        const response = await fetch(`/api/groups/${groupId}/leave`, {
          method: 'POST',
          headers: {
            'x-usernode-token': localStorage.getItem('usernode-token')
          }
        });
        if (!response.ok) throw new Error('Failed to leave group');
      }

      group.members = group.members.filter(m => m.id !== 'user_self');
      group.memberCount = group.members.length;
      group.isLeftByUser = true;

      const conv = conversations.find(c => c.type === 'group' && c.groupId === groupId);
      if (conv) conv.hiddenFromInbox = true;

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  // Hides a DM from this user's inbox only (the other side keeps their
  // copy). Shared by the single-chat delete flow and bulk delete.
  async function performDeleteDirectConversation(conv) {
    conv.hiddenFromInbox = true;
    try {
      await fetch(`/api/conversations/${conv.id}/state`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ hiddenFromInbox: true })
      });
      return true;
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      return false;
    }
  }

  // Type-aware "delete" for a single conversation row: a DM is hidden from
  // this user's inbox only, a group delete is really "Leave Group", a
  // channel delete is "Unfollow".
  async function performConversationDelete(conv) {
    if (conv.type === 'group') return performLeaveGroup(conv.groupId);
    if (conv.type === 'channel') {
      unfollowChannel(conv.channelId);
      return true;
    }
    return performDeleteDirectConversation(conv);
  }

  // Bulk-delete every conversation currently selected in the Messages list's
  // multi-select mode (WhatsApp/Telegram-style), after one confirmation.
  function bulkDeleteSelectedConversations() {
    const targets = Array.from(selectedConversationIds)
      .map(id => conversations.find(c => c.id === id))
      .filter(Boolean);
    if (targets.length === 0) return;

    showConfirmDialog(
      'Delete Conversations',
      `Delete ${targets.length} selected conversation${targets.length > 1 ? 's' : ''}? Direct messages are only removed from your inbox, group chats will be left, and channels will be unfollowed.`,
      async () => {
        await Promise.all(targets.map(conv => performConversationDelete(conv)));
        exitMessagesSelectionMode();
        showToast('Conversations deleted', { type: 'success' });
      }
    );
  }

  // Long-press a conversation row to open the Select/Pin/Mute action
  // sheet (see openConversationActionSheet); while multi-select is already
  // active, a long-press instead toggles that row's selection, same as a tap
  // (handled in attachConversationListeners).
  function setupConversationSelection() {
    const LONG_PRESS_DURATION = 350;
    let longPressTimer = null;
    let lastEventWasTouch = false;

    function clearLongPressTimer() {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    function handleLongPress(convId, rowEl) {
      // Swallow the click that follows this long-press (mouseup/touchend)
      // so it doesn't immediately toggle the row's selection back off.
      suppressNextConversationClick = true;
      setTimeout(() => { suppressNextConversationClick = false; }, 400);

      if (!messagesSelectionMode) {
        openConversationActionSheet(convId, rowEl);
      } else {
        toggleConversationSelection(convId);
      }
    }

    document.querySelectorAll('.conversation-item').forEach(item => {
      const convId = item.dataset.conversationId;

      // Mouse events
      item.addEventListener('mousedown', () => {
        if (lastEventWasTouch) return;
        longPressTimer = setTimeout(() => handleLongPress(convId, item), LONG_PRESS_DURATION);
      });
      item.addEventListener('mouseup', clearLongPressTimer);
      item.addEventListener('mouseleave', clearLongPressTimer);

      // Touch events
      item.addEventListener('touchstart', () => {
        lastEventWasTouch = true;
        longPressTimer = setTimeout(() => handleLongPress(convId, item), LONG_PRESS_DURATION);
      });
      item.addEventListener('touchend', () => {
        clearLongPressTimer();
        setTimeout(() => { lastEventWasTouch = false; }, 100);
      });
      item.addEventListener('touchmove', clearLongPressTimer);
    });
  }

  // Long-press action sheet for a Messages-list row: Select (mark - enters
  // multi-select with this row selected, the old direct long-press
  // behavior), Pin, Mute, in that fixed order. Replaces the earlier
  // swipe-to-reveal tray, which read as an accidental gesture to some users
  // and fought with the multi-select long-press on the same row.
  function openConversationActionSheet(convId, rowEl) {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;

    if (!window.unNative || typeof unNative.menu !== 'function') {
      // No kit available -- fall back to the original direct behavior
      // rather than leaving the long-press a dead end.
      startConversationSelection(convId);
      return;
    }

    const isPinned = !!conv.pinned;
    const isMuted = isConversationMuted(conv);

    unNative.menu({
      anchorEl: rowEl,
      items: [
        { label: 'Select', handler: () => startConversationSelection(convId) },
        { label: isPinned ? 'Unpin' : 'Pin', handler: () => togglePinFromList(conv) },
        { label: isMuted ? 'Unmute' : 'Mute', handler: () => toggleMuteFromList(conv) }
      ]
    });
  }

  // Render conversation screen
  // Shared composer markup for DM, group and channel threads.
  // The attach-image control sits INSIDE the input pill, pinned to its
  // bottom-right corner next to the send button.
  function composerMarkup(options = {}) {
    const disabled = options.disabled ? 'disabled' : '';
    // The reply bar's visible state must come from THIS conversation's reply
    // target, not just whatever the last-focused thread left behind -- this
    // markup is regenerated from scratch on every render (including
    // poll-triggered re-renders), so a stale hidden/shown default here is
    // what let a reply target leak into (or vanish from) the wrong thread.
    const activeReply = options.conversationId ? getReplyState(options.conversationId) : null;
    const replyBarStyle = activeReply ? 'display: flex;' : 'display: none;';
    const replySenderName = activeReply ? escapeHtml(activeReply.targetSenderName || '') : '';
    const replyPreviewText = activeReply ? escapeHtml(activeReply.targetPreviewText || '') : '';
    return `
      <div class="reply-preview-bar" style="${replyBarStyle}">
        <div class="reply-preview-content">
          <div class="reply-quote">
            <div class="reply-sender">Replying to: <span class="reply-sender-name">${replySenderName}</span></div>
            <div class="reply-text">${replyPreviewText}</div>
          </div>
          <button class="reply-close-button" aria-label="Cancel reply">✕</button>
        </div>
      </div>
      <div class="pending-image-bar" style="display: none;">
        <img class="pending-image-thumb" alt="Selected image preview" />
        <span class="pending-image-status">Uploading…</span>
        <button class="pending-image-remove" aria-label="Remove image">✕</button>
      </div>
      <div class="composer-input-shell">
        <textarea class="composer-input" placeholder="Message" rows="1" ${disabled}></textarea>
        <button class="attach-image-button" type="button" aria-label="Add image" ${disabled}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21.44 11.05l-9.19 9.19a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.19 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.49"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <input type="file" class="attach-image-input" accept="image/png,image/jpeg,image/gif,image/webp" style="display: none;" />
      </div>
      <button class="send-button" aria-label="Send" ${disabled}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="currentColor"/>
        </svg>
      </button>
    `;
  }

  // Markup for the floating "jump to newest message" button. It lives inside
  // .messages-area so it is pinned to the bottom-right of the scrolling list
  // and can never overlap the composer, which sits below that area.
  function scrollToLatestFabHTML() {
    return `
      <button
        class="scroll-to-latest-fab un-touch-target"
        data-testid="scroll-to-latest-fab"
        type="button"
        aria-label="Scroll to latest message"
        aria-hidden="true"
        tabindex="-1"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.2"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    `;
  }

  // Minimum scroll-up distance before the FAB appears. This is deliberately a
  // small absolute value, NOT a fraction of the list height: an earlier version
  // used `clientHeight * 0.9` (~640px on a phone), which a normal thread can
  // never reach — the list simply isn't that much taller than the viewport, so
  // the FAB stayed hidden even scrolled all the way to the top.
  const SCROLL_FAB_THRESHOLD_PX = 120;

  // Observers/listeners from the previous render, torn down on the next one so
  // re-rendering a thread (e.g. after sending) never stacks duplicate watchers.
  let scrollFabTeardown = null;

  // Wire the FAB to the message list: fade in once the user has scrolled up past
  // the threshold, hide again near the bottom, smooth-scroll on tap.
  function setupScrollToLatestFab(root) {
    if (scrollFabTeardown) {
      scrollFabTeardown();
      scrollFabTeardown = null;
    }

    // Scope the lookup to the page we just rendered so we can never bind to a
    // stale container left over from a previous screen.
    const scope = root || document;
    const messagesContainer = scope.querySelector('.messages-container');
    const fab = scope.querySelector('.scroll-to-latest-fab');
    if (!messagesContainer || !fab) return;

    function distanceFromBottom() {
      return messagesContainer.scrollHeight
        - messagesContainer.scrollTop
        - messagesContainer.clientHeight;
    }

    // Reflect whether the button is genuinely painted on screen (not just
    // class-toggled) so the dapp.json checks assert real visibility instead of
    // passing on a hidden element. Measured after the fade so opacity settles.
    function reportOnScreen(shouldShow) {
      let onScreen = false;
      if (shouldShow) {
        const cs = window.getComputedStyle(fab);
        const r = fab.getBoundingClientRect();
        onScreen = cs.visibility === 'visible'
          && cs.display !== 'none'
          && parseFloat(cs.opacity || '0') > 0.5
          && r.width > 0 && r.height > 0
          && r.bottom <= window.innerHeight + 1 && r.top >= -1
          && r.right <= window.innerWidth + 1 && r.left >= -1;
      }
      fab.setAttribute('data-fab-onscreen', onScreen ? 'true' : 'false');
    }

    function updateVisibility() {
      const shouldShow = distanceFromBottom() > SCROLL_FAB_THRESHOLD_PX;
      fab.classList.toggle('is-visible', shouldShow);
      fab.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
      fab.tabIndex = shouldShow ? 0 : -1;
      reportOnScreen(shouldShow);
      // Re-measure once the opacity transition has finished.
      setTimeout(() => reportOnScreen(
        distanceFromBottom() > SCROLL_FAB_THRESHOLD_PX
      ), 240);
    }

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        updateVisibility();
      });
    }

    messagesContainer.addEventListener('scroll', onScroll, { passive: true });
    fab.addEventListener('transitionend', () => reportOnScreen(
      distanceFromBottom() > SCROLL_FAB_THRESHOLD_PX
    ));

    const observers = [];

    // The list box changes height when the composer grows / the keyboard opens.
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => updateVisibility());
      ro.observe(messagesContainer);
      observers.push(ro);
    }

    // The box height staying the same while its CONTENT grows (a message
    // arrives, an image finally lays out) changes scrollHeight without firing
    // either scroll or resize — so watch the content too.
    if (typeof MutationObserver === 'function') {
      const mo = new MutationObserver(() => updateVisibility());
      mo.observe(messagesContainer, { childList: true, subtree: true });
      observers.push(mo);
    }

    window.addEventListener('resize', updateVisibility);
    window.addEventListener('orientationchange', updateVisibility);

    fab.addEventListener('click', () => {
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: 'smooth'
      });
    });

    scrollFabTeardown = () => {
      observers.forEach(o => o.disconnect());
      messagesContainer.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateVisibility);
      window.removeEventListener('orientationchange', updateVisibility);
    };

    // Evaluate after the initial scroll-to-bottom has been applied, and again
    // once layout has settled (fonts/bubble wrapping can change scrollHeight).
    setTimeout(updateVisibility, 0);
    requestAnimationFrame(updateVisibility);
    setTimeout(updateVisibility, 120);
    setTimeout(updateVisibility, 350);
    setTimeout(updateVisibility, 700);
  }

  // A message <img> occupies no height until it decodes, so a thread containing
  // a photo keeps growing AFTER the render's scroll-to-bottom has already run.
  // Left alone that strands the list a few hundred pixels short of the end: the
  // reader lands on a thread that looks like it will not scroll all the way
  // down, and the scroll-to-latest FAB fades in on a thread nobody scrolled.
  //
  // Two halves to keeping that still. `data-loaded` lets the CSS hold a
  // placeholder box open until the bytes land (cleared on load so a short,
  // wide photo is not cropped to the placeholder's shape), and each image that
  // lands re-pins the list to the bottom - but only while we are still parked
  // there, since a reader who has scrolled up into history must not be yanked
  // back down by a photo finishing somewhere below them.
  function keepThreadPinnedThroughImageLoads(messagesContainer, parkedAtBottom) {
    if (!messagesContainer) return;

    let pinned = parkedAtBottom !== false;

    function distanceFromBottom() {
      return messagesContainer.scrollHeight
        - messagesContainer.scrollTop
        - messagesContainer.clientHeight;
    }

    // Only a real scroll gesture fires this - content growing underneath does
    // not - so it is a faithful read of whether the reader has moved away.
    messagesContainer.addEventListener('scroll', () => {
      pinned = distanceFromBottom() <= SCROLL_FAB_THRESHOLD_PX;
    }, { passive: true });

    messagesContainer.querySelectorAll('.message-image').forEach(img => {
      // Cached images are already decoded and never fire `load`, so they have
      // to be released from the placeholder here or their box stays oversized.
      if (img.complete) {
        img.dataset.loaded = 'true';
        return;
      }
      const settle = () => {
        img.dataset.loaded = 'true';
        if (pinned) messagesContainer.scrollTop = messagesContainer.scrollHeight;
      };
      img.addEventListener('load', settle, { once: true });
      img.addEventListener('error', settle, { once: true });
    });
  }

  // Attribution line shown above a forwarded message's bubble, outside it, so the
  // bubble keeps looking like an ordinary message in both colour schemes.
  function forwardAttributionHTML(forwardedFrom) {
    return `
      <div class="forward-attribution" data-channel-id="${forwardedFrom.channelId}" role="link" tabindex="0" title="Open ${forwardedFrom.channelName}">
        <span class="forward-attribution-icon" aria-hidden="true">↗</span>
        <span class="forward-attribution-text">Forwarded from ${forwardedFrom.channelName}</span>
      </div>
    `;
  }

  // Tapping the attribution jumps to the source channel.
  function setupForwardAttributionLinks(container) {
    if (!container) return;
    container.addEventListener('click', (e) => {
      const attribution = e.target.closest('.forward-attribution');
      if (!attribution) return;
      e.stopPropagation();
      window.location.hash = '/channel/' + attribution.dataset.channelId;
    });
  }

  async function renderConversationPage(conversationId, renderOptions) {
    const fromSend = !!(renderOptions && renderOptions.fromSend);
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) {
      renderPage('messages');
      return;
    }

    conversation.unreadCount = 0;
    conversation.manuallyMarkedUnread = false;
    markConversationRead(conversationId);
    currentOpenConversationId = conversationId;

    const peerId = directPeerId(conversationId);
    await hydrateThreadMessages('direct', peerId, conversation);
    padForShotLongThread(conversation.messages, true, (ts, n) => ({
      id: `shot-pad-dm-${n}`, senderId: peerId, senderName: conversation.username,
      text: `Filler message ${n}`, timestamp: ts, isOutgoing: false
    }));
    // Refresh requestStatus too, so re-opening this thread right after sending
    // the first message (or after the peer accepts/replies) shows an accurate
    // pending banner instead of a stale one from boot-time hydration.
    if (peerId) await hydrateServerDirectConversations();

    const messagesList = conversation.messages.filter(msg => !(msg.hiddenFor && msg.hiddenFor.user_self)).map(msg => {
      let messageHTML = `<div class="message-swipe-wrapper ${msg.isOutgoing ? 'wrapper-outgoing' : 'wrapper-incoming'}" data-message-id="${msg.id}">`;
      messageHTML += `<div class="message-reply-icon" aria-hidden="true">↩️</div>`;
      messageHTML += `<div class="message ${msg.isOutgoing ? 'outgoing' : 'incoming'}" data-message-id="${msg.id}">`;

      // Add quoted message section if this is a reply
      if (msg.replyTo) {
        messageHTML += `
          <div class="message-quote" data-quoted-message-id="${escapeAttr(msg.replyTo.messageId)}">
            <div class="quote-border"></div>
            <div class="quote-content">
              <div class="quote-sender">${escapeHtml(msg.replyTo.senderName)}</div>
              <div class="quote-text">${escapeHtml(msg.replyTo.previewText)}</div>
            </div>
          </div>
        `;
      }

      // Forwarded posts carry their origin channel above the bubble, tappable
      // to jump to the source channel.
      if (msg.forwardedFrom) {
        messageHTML += forwardAttributionHTML(msg.forwardedFrom);
      }

      messageHTML += `
        ${renderPinBadge(msg)}
        <div class="message-bubble${messageBubbleClass(msg)}" data-message-id="${msg.id}">${messageBodyHTML(msg)}</div>
        <div class="message-reaction-chips" data-message-id="${msg.id}">${messageReactionChipsHTML(msg)}</div>
        ${msg.failed
          ? `<div class="message-timestamp message-failed" data-retry-message-id="${msg.id}">⚠️ Failed to send · Tap to retry</div>`
          : `<div class="message-timestamp">${formatMessageTime(msg.timestamp)}</div>`}
      </div>`;

      messageHTML += `</div>`;

      return messageHTML;
    }).join('');

    // A poll-triggered re-render (immediate resync, interval tick, or the
    // onChanged fired when a new message lands) rebuilds this whole screen
    // from scratch, including the composer -- without this, whatever the user
    // was mid-typing when someone else's message arrived got silently wiped,
    // and a Send click landing right after read an empty textarea and no-oped.
    const existingComposerInput = pageContainer.querySelector('.conversation-page')?.dataset.conversationId === conversationId
      ? pageContainer.querySelector('.composer-input')
      : null;
    const preservedDraft = existingComposerInput ? existingComposerInput.value : '';
    const hadFocus = existingComposerInput === document.activeElement;

    pageContainer.innerHTML = `
      <div class="conversation-page" data-conversation-id="${escapeAttr(conversationId)}">
        <div class="conversation-page-header">
          <button class="back-button" aria-label="Back to messages">←</button>
          <div class="conversation-header-info">
            <div class="conversation-avatar-header">${renderCommunityAvatar(conversation.avatar, conversation.username)}</div>
            <div class="header-text">
              <div class="header-username">${escapeHtml(conversation.username)}</div>
            </div>
          </div>
          <button class="menu-button" aria-label="More options">⋮</button>
        </div>
        ${conversation.requestStatus === 'pending_sent'
          ? `<div class="pending-request-banner">Request sent · waiting for them to accept</div>`
          : ''}
        <div class="messages-area">
          <div class="messages-container">
            ${messagesList}
          </div>
          ${scrollToLatestFabHTML()}
        </div>
        <div class="typing-indicator-bar" aria-live="polite"></div>
        <div class="composer-container chat-composer">
          ${composerMarkup({ conversationId: conversation.id })}
        </div>
      </div>
    `;

    if (preservedDraft) {
      const newComposerInput = pageContainer.querySelector('.composer-input');
      if (newComposerInput) {
        newComposerInput.value = preservedDraft;
        newComposerInput.style.height = Math.min(newComposerInput.scrollHeight, 120) + 'px';
        if (hadFocus) {
          newComposerInput.focus();
          newComposerInput.selectionStart = newComposerInput.selectionEnd = preservedDraft.length;
        }
      }
    }

    // Add back button handler
    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = '/messages';
    });

    // Add DM menu button for more options (pin, mute, clear chat)
    const menuButton = document.querySelector('.menu-button');
    if (menuButton) {
      menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        showDMMenuDialog(conversationId, conversation);
      });
    }

    // Scroll to latest message after DOM renders. The screenshot deep link parks
    // the list at the top so the FAB is visible — but after SENDING we always
    // jump to the bottom so the user sees the message they just wrote.
    const conversationRoot = pageContainer.querySelector('.conversation-page');
    const parkedAtBottom = !(SHOT_SCROLL_FAB && !fromSend);
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = parkedAtBottom
          ? messagesContainer.scrollHeight
          : 0;
        // Photos in the thread decode after this point and would otherwise
        // push the end of the list back out of reach.
        keepThreadPinnedThroughImageLoads(messagesContainer, parkedAtBottom);
      }
    }, 0);

    // Floating "jump to newest message" button
    setupScrollToLatestFab(conversationRoot);

    // Set up message long-press interactions
    setupMessageLongPress(conversation, 'dm');
    setupMessageSwipeToReply(conversation, 'dm');
    setupForwardAttributionLinks(conversationRoot);

    // Set up image lightbox for image messages
    setupImageLightbox();

    // Set up send button and reply state management
    setupComposer(conversation, { isGroup: false, typingTarget: peerId ? { type: 'direct', id: peerId } : null });

    // Tap a "Failed to send" label to retry delivering that message.
    conversationRoot.querySelectorAll('[data-retry-message-id]').forEach(el => {
      el.addEventListener('click', () => {
        const msg = conversation.messages.find(m => m.id === el.dataset.retryMessageId);
        if (!msg) return;
        deliverThreadMessage('direct', peerId, msg, () => renderConversationPage(conversationId));
        renderConversationPage(conversationId);
      });
    });

    // Poll for messages the other participant sends while this thread stays
    // open -- there's no websocket/push infra in this app, so this is the
    // only way an incoming message ever shows up without a manual reload.
    startThreadPolling(
      () => hydrateThreadMessages('direct', peerId, conversation),
      () => renderConversationPage(conversationId),
      () => {
        const failed = conversation.messages.filter(m => m.failed);
        if (!failed.length) return false;
        failed.forEach(msg => deliverThreadMessage('direct', peerId, msg, () => renderConversationPage(conversationId)));
        return true;
      }
    );

    // Separate lifecycle from message polling above -- see startTypingPolling.
    startTypingPolling(
      () => fetchTypingUsers('direct', peerId),
      (names) => renderTypingIndicator(conversationRoot.querySelector('.typing-indicator-bar'), false, names)
    );

    // Must stay last: the send re-renders this page underneath us.
    if (SHOT_SEND_STAY && !fromSend) sendShotMessage(conversationRoot);
    if (SHOT_SEND_FAIL && !fromSend) sendShotMessage(conversationRoot);
    if (SHOT_REPLY_LEAK && peerId === SHOT_REPLY_LEAK_TARGET_PEER_ID && !fromSend) sendShotMessage(conversationRoot);

    // Screenshot-state: click the real ⋮ button so the deep link exercises the
    // actual event listener wiring, not just the dialog-rendering function.
    if (SHOT_DM_MENU) menuButton?.click();

    // Regression marker for the "delete for me" persistence check: reflects
    // whether the fixed shot-delete message is (still) rendered in this
    // thread. Always computed when viewing this fixture peer -- not gated on
    // SHOT_DM_DELETE -- so the *plain* reload test (no shot param) can assert
    // on it too, proving the hide survived server-side rather than only
    // living in this tab's in-memory state.
    if (peerId === SHOT_DM_DELETE_PEER_ID) {
      const stillPresent = !!document.querySelector(`[data-message-id="${SHOT_DM_DELETE_MSG_ID}"]`);
      const marker = document.querySelector('[data-testid="dm-delete-check"]') || document.body.appendChild(document.createElement('div'));
      marker.setAttribute('data-testid', 'dm-delete-check');
      marker.setAttribute('data-hidden', stillPresent ? 'false' : 'true');
      marker.style.display = 'none';
    }

    // Regression marker for the cross-conversation reply leak: after the
    // shot-triggered send above completes, the just-sent message must NOT
    // carry the replyTo that was planted on the unrelated SOURCE conversation.
    if (SHOT_REPLY_LEAK && peerId === SHOT_REPLY_LEAK_TARGET_PEER_ID && fromSend) {
      const sent = conversation.messages[conversation.messages.length - 1];
      const leaked = !!(sent && sent.replyTo);
      const marker = document.querySelector('[data-testid="reply-leak-check"]') || document.body.appendChild(document.createElement('div'));
      marker.setAttribute('data-testid', 'reply-leak-check');
      marker.setAttribute('data-leaked', leaked ? 'true' : 'false');
      marker.style.display = 'none';
    }
  }

  // Screenshot-state helper: drive the real composer the same way a tap does, so
  // a check can assert the thread survives sending rather than only that it
  // renders. A send that bounced the user out would leave the Messages list here.
  function sendShotMessage(root, buttonSelector) {
    const scope = root || document;
    const input = scope.querySelector('.composer-input');
    const button = scope.querySelector(buttonSelector || '.send-button');
    if (!input || !button) return;
    input.value = SHOT_SEND_TEXT;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    button.click();
  }

  // Shared PUT for the caller's own conversation_user_state row (pin/mute/
  // etc). The local state is expected to already be updated
  // optimistically by the caller before this fires.
  async function persistConversationState(conversationId, patch) {
    try {
      await fetch(`/api/conversations/${conversationId}/state`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(patch)
      });
    } catch (error) {
      console.error('Failed to persist conversation state:', error);
    }
  }

  // Whether the given conversation's notifications are muted for the current
  // user. DMs and groups keep their mute flag on the conversation row itself;
  // channels keep theirs on the channel entity (see toggleMuteChannel), so
  // that's the one to read for a channel-type row.
  function isConversationMuted(conv) {
    if (!conv) return false;
    if (conv.type === 'channel') {
      const channel = channels.find(c => c.id === conv.channelId);
      return !!(channel && channel.mutedByUsers && channel.mutedByUsers['user_self']);
    }
    return !!(conv.mutedByUsers && conv.mutedByUsers['user_self']);
  }

  // Mute/unmute a DM or group conversation's notifications; persists per-user
  // so it survives reload. Channels use toggleMuteChannel instead, since their
  // mute flag also lives on the channel entity itself.
  function toggleMuteConversationRow(conversationId, isMuted) {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;
    if (!conv.mutedByUsers) conv.mutedByUsers = {};

    if (isMuted) {
      conv.mutedByUsers['user_self'] = true;
    } else {
      delete conv.mutedByUsers['user_self'];
    }
    persistConversationState(conversationId, { muted: isMuted });
  }

  // Mute/unmute a DM conversation's notifications (persists; mirrors
  // toggleMuteChannel)
  function toggleMuteDM(conversationId, isMuted) {
    toggleMuteConversationRow(conversationId, isMuted);
  }

  // Pin/unpin any conversation row (DM, group, or channel) -- shared by the DM
  // ⋮ menu's Pin option and the Messages list long-press action sheet.
  async function togglePinFromList(conv) {
    const newPinnedState = !conv.pinned;
    try {
      const res = await fetch(`/api/conversations/${conv.id}/state`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ pinned: newPinnedState })
      });
      if (res.ok) conv.pinned = newPinnedState;
    } catch (error) {
      console.error('Failed to pin conversation:', error);
    }
    renderMessagesPage();
    showToast(newPinnedState ? 'Conversation pinned' : 'Conversation unpinned', { type: 'success' });
  }

  // Mute/unmute any conversation row from the Messages list action sheet.
  function toggleMuteFromList(conv) {
    const wasMuted = isConversationMuted(conv);
    if (conv.type === 'channel') {
      toggleMuteChannel(conv.channelId, !wasMuted);
    } else {
      toggleMuteConversationRow(conv.id, !wasMuted);
    }
    renderMessagesPage();
    showToast(wasMuted ? 'Notifications unmuted' : 'Notifications muted', { type: 'success' });
  }

  // Hide every message in a DM for the current user only ("delete for me",
  // applied to the whole thread) — mirrors the per-message hiddenFor pattern.
  // Also persists server-side, otherwise the next poll/reload re-hydrates the
  // "cleared" messages from the server and they reappear.
  function clearDMChat(conversationId) {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;

    conv.messages.forEach(msg => {
      if (!msg.hiddenFor) msg.hiddenFor = {};
      msg.hiddenFor.user_self = true;
    });

    // Keep the conversation list preview in sync — every message is now
    // hidden for this user, so the list should read as empty.
    conv.lastMessage = 'No messages yet';

    const peerId = directPeerId(conv.id);
    if (peerId) {
      authFetch(`/api/messages/direct/${encodeURIComponent(peerId)}/clear`, {
        method: 'POST',
        headers: authHeaders()
      }).catch(error => {
        console.warn('Could not persist chat clear:', error);
      });
    }
  }

  // Show the DM conversation's ⋮ menu with pin, mute, and clear-chat options
  function showDMMenuDialog(conversationId, conversation) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog group-menu-dialog';

    const isPinned = !!conversation.pinned;
    const isMuted = !!(conversation.mutedByUsers && conversation.mutedByUsers['user_self']);

    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>${escapeHtml(conversation.username)}</h2>
        <button class="close-dialog-button">✕</button>
      </div>
      <div class="dialog-content group-menu-content">
        <button class="menu-option" id="pin-conversation-btn">
          <span class="option-icon">📌</span>
          <span class="option-label">${isPinned ? 'Unpin' : 'Pin'} Conversation</span>
          <span class="option-chevron">›</span>
        </button>
        <button class="menu-option" id="mute-dm-btn">
          <span class="option-icon">🔔</span>
          <span class="option-label">${isMuted ? 'Unmute' : 'Mute'} Notifications</span>
          <span class="option-chevron">›</span>
        </button>
        <button class="menu-option leave-option" id="clear-dm-chat-btn">
          <span class="option-icon">🗑️</span>
          <span class="option-label">Clear Chat</span>
        </button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    const closeButton = dialog.querySelector('.close-dialog-button');
    closeButton.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.getElementById('pin-conversation-btn')?.addEventListener('click', async () => {
      const newPinnedState = !conversation.pinned;
      try {
        const res = await fetch(`/api/conversations/${conversationId}/state`, {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ pinned: newPinnedState })
        });
        if (res.ok) {
          conversation.pinned = newPinnedState;
        }
      } catch (err) {
        console.error('Failed to pin conversation:', err);
      }
      overlay.remove();
      showToast(newPinnedState ? 'Conversation pinned' : 'Conversation unpinned', { type: 'success' });
    });

    document.getElementById('mute-dm-btn')?.addEventListener('click', () => {
      toggleMuteDM(conversationId, !isMuted);
      overlay.remove();
      showToast(isMuted ? 'Notifications unmuted' : 'Notifications muted', { type: 'success' });
    });

    document.getElementById('clear-dm-chat-btn')?.addEventListener('click', () => {
      overlay.remove();
      showConfirmDialog('Clear Chat', `Clear all messages with ${escapeHtml(conversation.username)}? This only removes them for you.`, () => {
        clearDMChat(conversationId);
        renderConversationPage(conversationId);
        showToast('Chat cleared', { type: 'success' });
      });
    });
  }

  // Whether 'user_self' is an admin or the creator of the given group
  function isCurrentUserGroupAdmin(group) {
    if (!group) return false;
    if (group.creatorId === 'user_self') return true;
    const member = group.members && group.members.find(m => m.id === 'user_self');
    return !!member && member.role === 'admin';
  }

  // The current user's role inside a group, or null when they aren't a member.
  function getSelfGroupRole(group) {
    if (!group || !group.members) return null;
    const member = group.members.find(m => m.id === 'user_self');
    return member ? (member.role || 'member') : null;
  }

  // Whether the current user MANAGES this group — i.e. still a member AND
  // either its creator or holding the owner/admin role. Deliberately stricter
  // than isCurrentUserGroupAdmin(), which ignores membership: a group the user
  // created and then left keeps its creatorId, but its chat route is gated to
  // members, so it must not be offered as a destination.
  function isCurrentUserGroupManager(group) {
    if (!group || group.isLeftByUser) return false;
    const role = getSelfGroupRole(group);
    if (!role) return false;
    return group.creatorId === 'user_self' || role === 'owner' || role === 'admin';
  }

  // Best-available recency timestamp for a group/channel. createdAt when it
  // exists (only groups made in-session carry one), else the newest
  // message/post, else the linked conversation row, else 0.
  function getCommunitySortKey(entity, kind) {
    if (!entity) return 0;
    if (typeof entity.createdAt === 'number') return entity.createdAt;

    const items = kind === 'channel' ? entity.posts : entity.messages;
    if (items && items.length > 0) {
      return items.reduce((newest, item) => Math.max(newest, item.timestamp || 0), 0);
    }

    const conv = conversations.find(c => kind === 'channel'
      ? (c.type === 'channel' && c.channelId === entity.id)
      : (c.type === 'group' && c.groupId === entity.id));
    return (conv && conv.timestamp) || 0;
  }

  // Newest-first, name A→Z as the tie-break.
  function sortCommunitiesByRecency(list, kind) {
    return list.slice().sort((a, b) => {
      const diff = getCommunitySortKey(b, kind) - getCommunitySortKey(a, kind);
      if (diff !== 0) return diff;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  // Groups the user created or administers (never merely joined).
  function getManagedGroups() {
    return sortCommunitiesByRecency(groups.filter(isCurrentUserGroupManager), 'group');
  }

  // Whether 'user_self' is the creator or an admin of the given channel.
  function isCurrentUserChannelAdmin(channel) {
    if (!channel) return false;
    if (channel.creatorId === 'user_self') return true;
    return !!(channel.admins && channel.admins.some(a => a.id === 'user_self'));
  }

  // Channels the user created or administers.
  function getManagedChannels() {
    return sortCommunitiesByRecency(channels.filter(isCurrentUserChannelAdmin), 'channel');
  }

  // 'Owner' / 'Admin' badge text, matching the wording used on the members list.
  function getManagedGroupRoleLabel(group) {
    const role = getSelfGroupRole(group);
    if (group.creatorId === 'user_self' || role === 'owner') return 'Owner';
    return role === 'admin' ? 'Admin' : '';
  }

  // 'Owner' / 'Admin' badge text for the managed-channels list.
  function getManagedChannelRoleLabel(channel) {
    if (channel.creatorId === 'user_self') return 'Owner';
    return isCurrentUserChannelAdmin(channel) ? 'Admin' : '';
  }

  // Avatars are either two-letter initials (seeded data) or a data-URL from
  // the avatar picker — render each appropriately instead of printing base64.
  function renderCommunityAvatar(avatar, name) {
    const value = avatar || generateDefaultAvatar(name || '');
    const isImage = typeof value === 'string' && (value.startsWith('data:') || value.startsWith('http'));
    return isImage
      ? `<img src="${value}" alt="" />`
      : value;
  }

  // Number of managed rows shown before the "Show all (N)" expander kicks in.
  const MANAGED_LIST_PREVIEW_COUNT = 3;

  // Renders one "Your Groups" / "Your Channels" list for the Create menu.
  function renderManagedListHtml(kind) {
    const isChannel = kind === 'channel';
    const items = isChannel ? getManagedChannels() : getManagedGroups();
    const testId = isChannel ? 'managed-channels-list' : 'managed-groups-list';

    if (items.length === 0) {
      return `
        <div class="managed-list" data-testid="${testId}">
          <div class="managed-list-empty">You don't manage any ${isChannel ? 'channels' : 'groups'} yet.</div>
        </div>
      `;
    }

    const rows = items.map((item, index) => {
      const hidden = index >= MANAGED_LIST_PREVIEW_COUNT ? ' is-hidden' : '';
      const roleLabel = isChannel ? getManagedChannelRoleLabel(item) : getManagedGroupRoleLabel(item);
      const meta = isChannel
        ? `${(item.followerCount || 0).toLocaleString()} followers`
        : `${item.memberCount || 0} members`;
      const idAttr = isChannel ? `data-channel-id="${item.id}"` : `data-group-id="${item.id}"`;

      return `
        <div class="managed-list-item${hidden}" ${idAttr}>
          <div class="managed-list-avatar">${renderCommunityAvatar(item.avatar, item.name)}</div>
          <div class="managed-list-content">
            <div class="managed-list-title">
              <span class="managed-list-name">${item.name}</span>
              ${roleLabel ? `<span class="managed-role-badge">${roleLabel}</span>` : ''}
            </div>
            <div class="managed-list-meta">${meta}</div>
          </div>
          <span class="managed-list-chevron">></span>
        </div>
      `;
    }).join('');

    const showAll = items.length > MANAGED_LIST_PREVIEW_COUNT
      ? `<button class="managed-show-all" data-target="${kind}" data-count="${items.length}">Show all (${items.length})</button>`
      : '';

    return `
      <div class="managed-list" data-testid="${testId}">
        ${rows}
        ${showAll}
      </div>
    `;
  }

  // Wires row taps and the "Show all (N)" expander for both managed lists.
  function attachManagedListListeners() {
    document.querySelectorAll('.managed-list-item').forEach(row => {
      row.addEventListener('click', () => {
        const groupId = row.dataset.groupId;
        const channelId = row.dataset.channelId;
        if (groupId) {
          window.location.hash = `/group/${groupId}`;
        } else if (channelId) {
          window.location.hash = `/channel/${channelId}`;
        }
      });
    });

    document.querySelectorAll('.managed-show-all').forEach(btn => {
      btn.addEventListener('click', () => {
        const list = btn.closest('.managed-list');
        if (!list) return;
        const expanded = list.classList.toggle('is-expanded');
        btn.textContent = expanded ? 'Show less' : `Show all (${btn.dataset.count})`;
      });
    });
  }

  // Setup long-press menu for messages. threadType is 'dm', 'group', or 'channel' —
  // each has different delete permissions:
  //   dm      - either participant may delete (hide) ANY message, but only from
  //             their own view (WhatsApp/Telegram "delete for me")
  //   group   - members may delete only their own messages; admins/the creator
  //             may delete anyone's message, removing it for the whole group
  //   channel - unchanged: a member may delete only their own message
  function setupMessageLongPress(conversation, threadType) {
    const messageBubbles = document.querySelectorAll('.message-bubble');
    const LONG_PRESS_DURATION = 350;
    const MENU_ITEMS = [
      { icon: '↩️', label: 'Reply', action: 'reply' },
      { icon: '😊', label: 'React', action: 'react' },
      { icon: '📌', label: 'Pin', action: 'pin' },
      { icon: '📋', label: 'Copy', action: 'copy' },
      { icon: '🗑️', label: 'Delete', action: 'delete' }
    ];

    let menuState = {
      selectedMessageId: null,
      isMenuOpen: false,
      longPressTimer: null,
      touchStartTime: 0,
      lastEventWasTouch: false,
      scrollHandler: null
    };

    // Reaction picker for message bubbles — same emoji set and look as the
    // channel-post picker, but fixed-positioned next to the pressed bubble
    // (a bubble isn't a stable anchor the way a post card is, since the
    // thread can scroll under it) instead of anchored inside it.
    let messageReactionPickerHandlers = null;

    function closeMessageReactionPicker() {
      const existing = document.querySelector('.message-reaction-picker');
      if (existing) existing.remove();
      if (messageReactionPickerHandlers) {
        document.removeEventListener('click', messageReactionPickerHandlers.onDocClick, true);
        document.removeEventListener('keydown', messageReactionPickerHandlers.onKeyDown);
        messageReactionPickerHandlers = null;
      }
    }

    function openMessageReactionPicker(messageId, bubbleElement) {
      closeMessageReactionPicker();
      const conversationPage = document.querySelector('.conversation-page');
      if (!conversationPage || !bubbleElement) return;

      const picker = document.createElement('div');
      picker.className = 'message-reaction-picker';
      picker.setAttribute('role', 'menu');
      picker.innerHTML = POST_REACTIONS.map(emoji => `
        <button class="reaction-picker-option" data-message-id="${messageId}" data-emoji="${emoji}" role="menuitem" aria-label="React with ${emoji}">${emoji}</button>
      `).join('');
      conversationPage.appendChild(picker);

      const bubbleRect = bubbleElement.getBoundingClientRect();
      const pickerRect = picker.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let top = bubbleRect.top - pickerRect.height - 10;
      if (top < 10) top = bubbleRect.bottom + 10;
      if (top + pickerRect.height > viewportHeight - 10) top = viewportHeight - pickerRect.height - 10;

      let left = bubbleRect.left + bubbleRect.width / 2 - pickerRect.width / 2;
      if (left < 10) left = 10;
      if (left + pickerRect.width > viewportWidth - 10) left = viewportWidth - pickerRect.width - 10;

      picker.style.position = 'fixed';
      picker.style.top = Math.max(10, top) + 'px';
      picker.style.left = Math.max(10, left) + 'px';

      picker.querySelectorAll('.reaction-picker-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleMessageReaction(conversation, messageId, btn.dataset.emoji);
          refreshMessageReactions(conversation, messageId);
          closeMessageReactionPicker();
        });
      });

      const onDocClick = (e) => {
        if (e.target.closest('.message-reaction-picker')) return;
        closeMessageReactionPicker();
      };
      const onKeyDown = (e) => {
        if (e.key === 'Escape') closeMessageReactionPicker();
      };
      messageReactionPickerHandlers = { onDocClick, onKeyDown };
      // Registered async so the click/menu-tap that opened the picker doesn't
      // immediately close it via the same event bubbling to document.
      setTimeout(() => {
        if (!messageReactionPickerHandlers) return;
        document.addEventListener('click', onDocClick, true);
        document.addEventListener('keydown', onKeyDown);
      }, 0);
    }

    function dismissMenu() {
      if (!menuState.isMenuOpen) return;

      const overlay = document.querySelector('.message-menu-overlay');
      const contextMenu = document.querySelector('.context-menu');
      const messagesContainer = document.querySelector('.messages-container');

      if (overlay) overlay.classList.add('closing');
      if (contextMenu) contextMenu.classList.add('closing');

      // Remove scroll listener
      if (menuState.scrollHandler && messagesContainer) {
        messagesContainer.removeEventListener('scroll', menuState.scrollHandler);
        menuState.scrollHandler = null;
      }

      setTimeout(() => {
        overlay?.remove();
        contextMenu?.remove();

        const selectedBubble = document.querySelector(`[data-message-id="${menuState.selectedMessageId}"]`);
        if (selectedBubble) {
          selectedBubble.classList.remove('selected');
        }

        menuState.selectedMessageId = null;
        menuState.isMenuOpen = false;
      }, 150);
    }

    function showMenu(messageId, bubbleElement) {
      const menuTargetMessage = conversation.messages.find(m => m.id === messageId);

      if (menuState.isMenuOpen) dismissMenu();

      menuState.selectedMessageId = messageId;
      menuState.isMenuOpen = true;
      bubbleElement.classList.add('selected');

      const conversationPage = document.querySelector('.conversation-page');
      const messagesContainer = document.querySelector('.messages-container');

      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'message-menu-overlay';
      overlay.addEventListener('click', dismissMenu);
      conversationPage.appendChild(overlay);

      // Create context menu. DM: delete always offered (delete-for-me). Group:
      // own messages, or any message if the current user is an admin/creator.
      // Channel: own messages only (unchanged).
      const canDeleteMenuTarget = !!menuTargetMessage && (
        threadType === 'dm'
          ? true
          : threadType === 'group'
            ? (menuTargetMessage.isOutgoing === true || isCurrentUserGroupAdmin(conversation))
            : menuTargetMessage.isOutgoing === true
      );
      const visibleMenuItems = MENU_ITEMS.filter(item => item.action !== 'delete' || canDeleteMenuTarget)
        .filter(item => item.action !== 'pin' || threadType === 'channel');

      const contextMenu = document.createElement('div');
      contextMenu.className = 'context-menu';
      const menuButtons = visibleMenuItems.map(item => {
        const label = (item.action === 'pin' && menuTargetMessage?.isPinned) ? 'Unpin' : item.label;
        return `
        <button class="menu-item" aria-label="${label}" data-action="${item.action}">
          <span class="menu-icon">${item.icon}</span>
          <span class="menu-label">${label}</span>
        </button>
      `;
      }).join('');
      contextMenu.innerHTML = menuButtons;
      conversationPage.appendChild(contextMenu);

      // Position menu with viewport bounds checking
      const contextMenuRect = contextMenu.getBoundingClientRect();
      const bubbleViewportRect = bubbleElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Calculate space available above and below the message
      const spaceAbove = bubbleViewportRect.top;
      const spaceBelow = viewportHeight - bubbleViewportRect.bottom;
      const menuHeight = contextMenuRect.height;

      // Determine if menu should go above or below
      let menuTop;
      if (spaceAbove > menuHeight + 10) {
        // Position above the message
        menuTop = bubbleViewportRect.top - menuHeight - 10;
      } else {
        // Position below the message
        menuTop = bubbleViewportRect.bottom + 10;
      }

      // Ensure menu doesn't go off top or bottom
      if (menuTop < 10) {
        menuTop = 10;
      } else if (menuTop + menuHeight > viewportHeight - 10) {
        menuTop = viewportHeight - menuHeight - 10;
      }

      // Calculate horizontal position (center on message, adjust for viewport)
      const bubbleCenterX = bubbleViewportRect.left + bubbleViewportRect.width / 2;
      let menuLeft = bubbleCenterX - contextMenuRect.width / 2;

      // Ensure menu doesn't overflow viewport edges
      if (menuLeft < 10) {
        menuLeft = 10;
      } else if (menuLeft + contextMenuRect.width > viewportWidth - 10) {
        menuLeft = viewportWidth - contextMenuRect.width - 10;
      }

      // Apply fixed positioning relative to viewport
      contextMenu.style.position = 'fixed';
      contextMenu.style.top = Math.max(10, menuTop) + 'px';
      contextMenu.style.left = Math.max(10, menuLeft) + 'px';

      // Add event listeners to menu items
      contextMenu.querySelectorAll('.menu-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          console.log('Action:', action);
          btn.classList.add('tapped');

          const targetMessage = conversation.messages.find(m => m.id === messageId);

          if (action === 'reply') {
            if (targetMessage) {
              const senderName = targetMessage.isOutgoing
                ? 'You'
                : (threadType === 'group' ? targetMessage.senderName : conversation.username);
              const previewText = truncateText(messagePreviewText(targetMessage), 50);
              setReplyState(conversation.id, messageId, senderName, previewText);
            }
          } else if (action === 'react') {
            if (targetMessage) {
              openMessageReactionPicker(messageId, bubbleElement);
            }
          } else if (action === 'copy') {
            if (targetMessage) {
              const copyValue = targetMessage.imageUrl || targetMessage.text || '';
              navigator.clipboard.writeText(copyValue).then(() => {
                showToast('Message copied', { type: 'success' });
              }).catch(() => {
                showToast('Failed to copy message', { type: 'error' });
              });
            }
          } else if (action === 'delete') {
            if (!targetMessage) {
              // no-op
            } else if (threadType === 'dm') {
              showConfirmDialog(
                'Delete Message',
                'Delete this message? This cannot be undone.',
                () => deleteDirectMessageForEveryone(conversation, messageId)
              );
            } else if (threadType === 'group') {
              const isOwnMessage = targetMessage.isOutgoing === true;
              if (isOwnMessage || isCurrentUserGroupAdmin(conversation)) {
                const confirmMessage = isOwnMessage
                  ? 'Delete this message? This cannot be undone.'
                  : "Delete this member's message? This cannot be undone.";
                showConfirmDialog('Delete Message', confirmMessage, () => {
                  deleteMessageForEveryone(conversation, messageId);
                });
              } else {
                showToast('You can only delete your own messages', { type: 'error' });
              }
            } else if (targetMessage.isOutgoing === true) {
              showConfirmDialog('Delete Message', 'Delete this message? This cannot be undone.', () => {
                deleteMessageFromThread(conversation, messageId);
              });
            } else {
              showToast('You can only delete your own messages', { type: 'error' });
            }
          }

          // Handle pin action - toggle pin state and update the badge in place
          if (action === 'pin') {
            const targetMessage = conversation.messages.find(m => m.id === messageId);
            if (targetMessage) {
              targetMessage.isPinned = !targetMessage.isPinned;
              const parent = bubbleElement.parentNode;
              const existingBadge = parent.querySelector('.message-pin-badge');
              if (targetMessage.isPinned) {
                if (!existingBadge) {
                  const badge = document.createElement('div');
                  badge.className = 'message-pin-badge';
                  badge.innerHTML = '<span class="message-pin-icon">📌</span>Pinned';
                  parent.insertBefore(badge, bubbleElement);
                }
              } else if (existingBadge) {
                existingBadge.remove();
              }
            }
          }

          setTimeout(() => dismissMenu(), 150);
        });
      });

      // Dismiss on scroll
      menuState.scrollHandler = () => dismissMenu();
      messagesContainer.addEventListener('scroll', menuState.scrollHandler);
    }

    messageBubbles.forEach(bubble => {
      const messageId = bubble.dataset.messageId;
      let mouseDownPos = null;

      // Mouse events
      bubble.addEventListener('mousedown', (e) => {
        if (menuState.lastEventWasTouch) return;
        mouseDownPos = { x: e.clientX, y: e.clientY };
        menuState.touchStartTime = Date.now();
        menuState.longPressTimer = setTimeout(() => {
          showMenu(messageId, bubble);
        }, LONG_PRESS_DURATION);
      });

      bubble.addEventListener('mousemove', (e) => {
        if (!menuState.longPressTimer || !mouseDownPos) return;
        const dx = e.clientX - mouseDownPos.x;
        const dy = e.clientY - mouseDownPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 8) {
          clearTimeout(menuState.longPressTimer);
          menuState.longPressTimer = null;
        }
      });

      bubble.addEventListener('mouseup', () => {
        if (menuState.lastEventWasTouch) return;
        mouseDownPos = null;
        if (menuState.longPressTimer) {
          clearTimeout(menuState.longPressTimer);
          menuState.longPressTimer = null;
        }
      });

      bubble.addEventListener('mouseleave', () => {
        if (menuState.longPressTimer) {
          clearTimeout(menuState.longPressTimer);
          menuState.longPressTimer = null;
        }
      });

      // Touch events
      bubble.addEventListener('touchstart', (e) => {
        menuState.lastEventWasTouch = true;
        menuState.touchStartTime = Date.now();
        menuState.longPressTimer = setTimeout(() => {
          showMenu(messageId, bubble);
        }, LONG_PRESS_DURATION);
      });

      bubble.addEventListener('touchend', (e) => {
        if (menuState.longPressTimer) {
          clearTimeout(menuState.longPressTimer);
          menuState.longPressTimer = null;
        }
        setTimeout(() => {
          menuState.lastEventWasTouch = false;
        }, 100);
      });

      bubble.addEventListener('touchmove', () => {
        if (menuState.longPressTimer) {
          clearTimeout(menuState.longPressTimer);
          menuState.longPressTimer = null;
        }
      });

      // Prevent text selection during long-press
      bubble.style.userSelect = 'none';
    });

    // Tapping an already-attached chip toggles it directly — no need to
    // long-press again once a reaction is visible on the bubble.
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.message-reaction-chip');
        if (!chip) return;
        e.stopPropagation();
        toggleMessageReaction(conversation, chip.dataset.messageId, chip.dataset.emoji);
        refreshMessageReactions(conversation, chip.dataset.messageId);
      });
    }

    // Screenshot-state: put a reaction on the first message and open the
    // picker via the real long-press menu action, exercising both the
    // persisted-chip path and the picker UI, not just the render function.
    if (SHOT_MESSAGE_REACTIONS) {
      const firstBubble = document.querySelector('.message-bubble');
      if (firstBubble) {
        const firstMessageId = firstBubble.dataset.messageId;
        toggleMessageReaction(conversation, firstMessageId, POST_REACTIONS[0]);
        refreshMessageReactions(conversation, firstMessageId);
        openMessageReactionPicker(firstMessageId, firstBubble);
      }
    }
  }

  // Swipe-to-reply gesture: incoming messages swipe right, outgoing messages swipe left.
  function setupMessageSwipeToReply(thread, threadType) {
    const AXIS_LOCK_DISTANCE = 8;
    const SWIPE_MAX_OFFSET = 64;
    const SWIPE_COMMIT_THRESHOLD = 40;
    const SWIPE_FLICK_VELOCITY = 0.5; // px/ms

    const wrappers = pageContainer.querySelectorAll('.message-swipe-wrapper');

    wrappers.forEach(wrapper => {
      const messageId = wrapper.dataset.messageId;
      const messageEl = wrapper.querySelector('.message');
      const iconEl = wrapper.querySelector('.message-reply-icon');
      if (!messageEl) return;

      function getMessage() {
        return thread.messages.find(m => m.id === messageId);
      }

      function isSwipeable() {
        const msg = getMessage();
        return !!msg && !msg.isSystemMessage;
      }

      // Incoming messages only swipe right (+1), outgoing only swipe left (-1)
      function directionSign() {
        const msg = getMessage();
        return msg && msg.isOutgoing ? -1 : 1;
      }

      function clampOffset(rawAbs, sign) {
        const abs = Math.min(rawAbs, SWIPE_MAX_OFFSET * 1.4);
        const eased = abs <= SWIPE_MAX_OFFSET
          ? abs
          : SWIPE_MAX_OFFSET + (abs - SWIPE_MAX_OFFSET) * 0.35;
        return eased * sign;
      }

      function updateVisual(offset) {
        const progress = Math.min(Math.abs(offset) / SWIPE_COMMIT_THRESHOLD, 1);
        messageEl.style.transform = `translateX(${offset}px)`;
        if (iconEl) {
          iconEl.style.opacity = String(progress);
          iconEl.style.transform = `translateY(-50%) scale(${0.6 + 0.4 * progress})`;
        }
      }

      function resetVisual() {
        messageEl.classList.remove('swiping');
        messageEl.style.transform = '';
        if (iconEl) {
          iconEl.style.opacity = '';
          iconEl.style.transform = '';
        }
      }

      let state = null;

      function beginDrag(x, y) {
        if (!isSwipeable()) return null;
        return {
          startX: x,
          startY: y,
          offset: 0,
          velocity: 0,
          lastTime: Date.now(),
          axisLocked: false,
          horizontal: false
        };
      }

      function handleMove(x, y, evt) {
        if (!state) return;
        const dx = x - state.startX;
        const dy = y - state.startY;

        if (!state.axisLocked) {
          if (Math.abs(dx) < AXIS_LOCK_DISTANCE && Math.abs(dy) < AXIS_LOCK_DISTANCE) return;
          state.axisLocked = true;
          state.horizontal = Math.abs(dx) > Math.abs(dy);
          if (!state.horizontal) {
            state = null;
            return;
          }
          messageEl.classList.add('swiping');
        }
        if (!state.horizontal) return;

        const sign = directionSign();
        const rawInAllowedDir = sign > 0 ? Math.max(dx, 0) : Math.max(-dx, 0);
        const clamped = clampOffset(rawInAllowedDir, sign);

        if (clamped !== 0 && evt && evt.cancelable) evt.preventDefault();

        const now = Date.now();
        const dt = now - state.lastTime;
        if (dt > 0) state.velocity = (clamped - state.offset) / dt;
        state.lastTime = now;
        state.offset = clamped;

        updateVisual(clamped);
      }

      function handleEnd() {
        if (!state) return;
        const wasHorizontal = state.horizontal;
        const offset = state.offset;
        const velocity = state.velocity;
        state = null;

        if (!wasHorizontal) return;

        const committed = Math.abs(offset) >= SWIPE_COMMIT_THRESHOLD ||
          Math.abs(velocity) >= SWIPE_FLICK_VELOCITY;

        resetVisual();

        if (committed) {
          const msg = getMessage();
          if (msg) {
            const senderName = msg.isOutgoing
              ? 'You'
              : (threadType === 'group' ? msg.senderName : thread.username);
            const previewText = truncateText(messagePreviewText(msg), 50);
            setReplyState(thread.id, msg.id, senderName, previewText);
            if (navigator.vibrate) navigator.vibrate(10);
            const composerInput = pageContainer.querySelector('.composer-input');
            if (composerInput) composerInput.focus();
          }
        }
      }

      // Touch events
      wrapper.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        state = beginDrag(touch.clientX, touch.clientY);
      }, { passive: true });

      wrapper.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY, e);
      }, { passive: false });

      wrapper.addEventListener('touchend', () => {
        handleEnd();
      });

      wrapper.addEventListener('touchcancel', () => {
        state = null;
        resetVisual();
      });

      // Mouse events (desktop testing)
      let mouseIsDown = false;
      wrapper.addEventListener('mousedown', (e) => {
        mouseIsDown = true;
        state = beginDrag(e.clientX, e.clientY);
      });

      wrapper.addEventListener('mousemove', (e) => {
        if (!mouseIsDown) return;
        handleMove(e.clientX, e.clientY, e);
      });

      wrapper.addEventListener('mouseup', () => {
        mouseIsDown = false;
        handleEnd();
      });

      wrapper.addEventListener('mouseleave', () => {
        if (mouseIsDown) {
          mouseIsDown = false;
          handleEnd();
        }
      });
    });
  }

  // Delete a message from a channel thread (own messages only) — hard delete,
  // persisted server-side so the post is gone for every follower's client,
  // not just removed from this tab. No toast/placeholder: it just disappears.
  function deleteMessageFromThread(thread, messageId) {
    const messageIndex = thread.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    thread.messages.splice(messageIndex, 1);

    const messageEl = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (messageEl) messageEl.remove();

    // Keep the conversation list preview (last message) in sync
    const previewConversation = conversations.find(c =>
      c.id === thread.id || c.groupId === thread.id || c.channelId === thread.id
    );
    if (previewConversation) {
      const lastMessage = thread.messages[thread.messages.length - 1];
      previewConversation.lastMessage = lastMessage
        ? truncateText(messagePreviewText(lastMessage), 100)
        : 'No messages yet';
      if (lastMessage) previewConversation.timestamp = lastMessage.timestamp;
    }

    authFetch(`/api/messages/channel/${encodeURIComponent(thread.id)}/${encodeURIComponent(messageId)}/delete`, {
      method: 'POST',
      headers: authHeaders()
    }).catch(error => {
      console.warn('Could not persist message delete:', error);
    });
  }

  // DM "delete for everyone": permanently removes the message so neither
  // participant is ever served it again. Persisted server-side (fire-and-forget,
  // matching deliverThreadMessage/markConversationRead) so it stays gone after
  // a reload. No toast/placeholder: it just disappears from the thread.
  function deleteDirectMessageForEveryone(conversation, messageId) {
    const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    conversation.messages.splice(messageIndex, 1);

    const wrapperEl = document.querySelector(`.message-swipe-wrapper[data-message-id="${messageId}"]`);
    if (wrapperEl) wrapperEl.remove();

    // Keep the conversation list preview in sync
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    conversation.lastMessage = lastMessage ? truncateText(messagePreviewText(lastMessage), 100) : 'No messages yet';
    if (lastMessage) conversation.timestamp = lastMessage.timestamp;

    const peerId = directPeerId(conversation.id);
    if (peerId) {
      authFetch(`/api/messages/direct/${encodeURIComponent(peerId)}/${encodeURIComponent(messageId)}/delete`, {
        method: 'POST',
        headers: authHeaders()
      }).catch(error => {
        console.warn('Could not persist message delete:', error);
      });
    }
  }

  // Group shared moderation delete: permanently removes a message for every
  // member. Members may only do this to their own messages; admins/the
  // creator may do it to anyone's. No toast/placeholder: it just disappears.
  function deleteMessageForEveryone(group, messageId) {
    const messageIndex = group.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    group.messages.splice(messageIndex, 1);

    const messageEl = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (messageEl) messageEl.remove();

    // Keep the conversation list preview (last message) in sync
    const row = conversations.find(c => c.groupId === group.id);
    if (row) {
      const lastMessage = group.messages[group.messages.length - 1];
      row.lastMessage = lastMessage ? truncateText(messagePreviewText(lastMessage), 100) : 'No messages yet';
      if (lastMessage) row.timestamp = lastMessage.timestamp;
    }

    authFetch(`/api/messages/group/${encodeURIComponent(group.id)}/${encodeURIComponent(messageId)}/delete`, {
      method: 'POST',
      headers: authHeaders()
    }).catch(error => {
      console.warn('Could not persist message delete:', error);
    });
  }

  // Reply state management -- keyed per conversation/group/channel id so a
  // reply target set while viewing thread A can never leak into whatever
  // gets typed after navigating to thread B (they used to share one
  // module-level object, so switching threads without cancelling the reply
  // silently attached the wrong quote to the next message sent anywhere).
  const replyStateByConversation = new Map();

  function getReplyState(conversationId) {
    return conversationId ? (replyStateByConversation.get(conversationId) || null) : null;
  }

  function setReplyState(conversationId, messageId, senderName, previewText) {
    if (!conversationId) return;
    replyStateByConversation.set(conversationId, {
      targetMessageId: messageId,
      targetSenderName: senderName,
      targetPreviewText: previewText
    });

    // Show reply preview bar (only meaningful while conversationId's thread
    // is the one currently mounted, which is the only time this is called).
    const replyBar = document.querySelector('.reply-preview-bar');
    const replySenderName = document.querySelector('.reply-sender-name');
    const replyText = document.querySelector('.reply-text');

    if (replyBar) {
      replySenderName.textContent = senderName;
      replyText.textContent = previewText;
      replyBar.style.display = 'flex';
    }
  }

  function clearReplyState(conversationId) {
    if (conversationId) replyStateByConversation.delete(conversationId);

    const replyBar = document.querySelector('.reply-preview-bar');
    if (replyBar) {
      replyBar.style.display = 'none';
    }
  }

  // Full-screen viewer for image messages. Delegated on the thread
  // container so it survives the re-render after every send.
  function setupImageLightbox(containerSelector) {
    const messagesContainer = document.querySelector(containerSelector || '.messages-container');
    if (!messagesContainer) return;

    messagesContainer.addEventListener('click', (e) => {
      const image = e.target.closest('.message-image');
      if (!image) return;
      // A long-press opens the context menu instead - don't stack a viewer on it
      if (document.querySelector('.context-menu')) return;
      if (image.classList.contains('message-image-missing')) return;
      e.stopPropagation();
      openImageLightbox(image.getAttribute('src'));
    });
  }

  function openImageLightbox(src) {
    const url = safeImageUrl(src);
    if (!url) return;

    const overlay = document.createElement('div');
    overlay.className = 'image-lightbox-overlay';
    overlay.innerHTML = `
      <button class="image-lightbox-close" aria-label="Close image">✕</button>
      <img class="image-lightbox-image" src="${escapeAttr(url)}" alt="Photo" />
    `;

    function dismiss() {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
    }

    function onKeydown(e) {
      if (e.key === 'Escape') dismiss();
    }

    overlay.addEventListener('click', (e) => {
      // Backdrop and the close button dismiss; the image itself does not
      if (e.target === overlay || e.target.closest('.image-lightbox-close')) {
        dismiss();
      }
    });
    document.addEventListener('keydown', onKeydown);

    document.body.appendChild(overlay);
  }

  const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const DECODE_LIMIT_BYTES = 32 * 1024 * 1024;
  const MAX_IMAGE_DIMENSION = 1600;
  const SKIP_DOWNSCALE_BELOW_BYTES = 400 * 1024;

  const STORAGE_ERROR_CODES = [
    'file_too_large',
    'invalid_image',
    'app_quota_exceeded',
    'user_quota_exceeded',
    'staging_quota_exceeded',
    'storage_unavailable'
  ];

  // The bridge surfaces the platform's structured code in a few different
  // shapes depending on how the rejection travelled back through postMessage.
  function uploadErrorCode(err) {
    if (!err) return null;
    const direct = err.code
      || err.errorCode
      || (err.data && err.data.code)
      || (err.error && err.error.code)
      || (err.cause && err.cause.code);
    if (typeof direct === 'string' && direct) return direct;

    const message = typeof err.message === 'string' ? err.message : '';
    return STORAGE_ERROR_CODES.find(code => message.includes(code)) || null;
  }

  // Some rejections come back as prose with no structured code at all - the
  // staging preview surfaces "File storage is unavailable right now" that way.
  // Classify those onto the documented codes so the user still gets the right
  // copy instead of the platform's raw internal wording.
  const STORAGE_ERROR_MESSAGE_PATTERNS = [
    [/storage\s+(?:is\s+)?(?:currently\s+|temporarily\s+)?(?:unavailable|offline|down)|unable to reach\s+(?:file\s+)?storage/i, 'storage_unavailable'],
    [/quota|limit reached|out of space|no space left/i, 'user_quota_exceeded'],
    [/too large|exceeds the (?:maximum|size)/i, 'file_too_large'],
    [/(?:not a|unsupported|invalid)\s+(?:valid\s+)?image|unsupported (?:file )?type/i, 'invalid_image']
  ];

  function inferUploadErrorCode(err) {
    const message = (err && typeof err.message === 'string') ? err.message : '';
    if (!message) return null;
    const match = STORAGE_ERROR_MESSAGE_PATTERNS.find(([pattern]) => pattern.test(message));
    return match ? match[1] : null;
  }

  // Map platform storage error codes onto user-facing copy. A known code
  // already names the cause, so it keeps its plain string; anything we can't
  // classify surfaces the platform's own code/message instead of the catch-all,
  // so a user reporting "upload failed" tells us something actionable.
  function uploadErrorMessage(err) {
    const message = (err && typeof err.message === 'string') ? err.message.trim() : '';

    // Outside the platform shell the bridge rejects without a code. Check this
    // before classifying prose, so "no shell" never reads as "storage is down".
    if (!uploadErrorCode(err) && /platform shell|not available standalone|only works inside/i.test(message)) {
      return "Image upload isn't available here";
    }

    const code = uploadErrorCode(err) || inferUploadErrorCode(err);
    switch (code) {
      case 'file_too_large':
        return 'Image is too large (max 5 MB)';
      case 'invalid_image':
        return 'Only PNG, JPEG, GIF or WebP images are supported';
      case 'app_quota_exceeded':
      case 'user_quota_exceeded':
      case 'staging_quota_exceeded':
        return 'Upload limit reached — try a smaller image or delete old ones';
      case 'storage_unavailable':
        // Platform-side outage: retrying is the only useful advice, and the
        // attach button is live again by the time this toast shows.
        return 'Image storage is down right now — tap 📷 to try again';
      default:
        break;
    }

    if (code) return `Upload failed (${code}) — tap 📷 to try again`;
    if (message) return `Upload failed — ${truncateText(message, 80)}`;
    return 'Upload failed — tap 📷 to try again';
  }

  const EXTENSION_FOR_IMAGE_TYPE = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp'
  };

  // The platform sniffs the bytes and rejects a file whose extension doesn't
  // match them, so trust the bytes rather than the picker's reported MIME
  // type (WebViews routinely guess it from the filename).
  function sniffImageType(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const b = new Uint8Array(reader.result || new ArrayBuffer(0));
        if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
          resolve('image/png');
        } else if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
          resolve('image/jpeg');
        } else if (b.length >= 3 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
          resolve('image/gif');
        } else if (b.length >= 12
          && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
          && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
          resolve('image/webp');
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      try {
        reader.readAsArrayBuffer(blob.slice(0, 12));
      } catch (err) {
        resolve(null);
      }
    });
  }

  // Strip any path and extension off the picked filename, leaving a safe stem
  function imageFileStem(name) {
    const withoutPath = String(name || '').split(/[\\/]/).pop() || '';
    const stem = withoutPath
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 60);
    return stem || 'photo';
  }

  // canvas.toBlob() returns a BARE BLOB - no filename at all - and re-encodes
  // to JPEG, so a downscaled photo.png has to be uploaded as photo.jpg. The
  // platform requires the extension to match the sniffed bytes, so always
  // rebuild a File whose name, extension and type agree with the content.
  function toUploadFile(blob, originalName, contentType) {
    const type = contentType || blob.type || '';
    const extension = EXTENSION_FOR_IMAGE_TYPE[type];
    const stem = imageFileStem(originalName);
    const filename = extension ? `${stem}.${extension}` : stem;

    // Nothing was re-encoded and the picked file's own name already agrees with
    // its bytes - hand the original File straight through rather than copying
    // several megabytes to produce an identical one.
    if (extension
      && typeof File === 'function'
      && blob instanceof File
      && blob.type === type
      && new RegExp(`\\.${extension}$`, 'i').test(blob.name || '')) {
      return blob;
    }

    if (typeof File === 'function') {
      try {
        return new File([blob], filename, { type: type || undefined });
      } catch (err) {
        console.warn('File constructor unavailable, uploading a named Blob', err);
      }
    }

    // Fallback for WebViews without a File constructor
    const named = blob.slice(0, blob.size, type || blob.type);
    try {
      Object.defineProperty(named, 'name', { value: filename });
    } catch (err) {
      // Best effort - the bridge will fall back to its own default name
    }
    return named;
  }

  // Downscale oversized camera photos client-side (the platform does no
  // server-side resizing). GIFs are left alone so animation survives.
  function downscaleImage(file, contentType) {
    return new Promise((resolve) => {
      const type = contentType || file.type;
      if (type === 'image/gif' || file.size < SKIP_DOWNSCALE_BELOW_BYTES) {
        resolve(file);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        const longest = Math.max(img.naturalWidth, img.naturalHeight);
        if (!longest || longest <= MAX_IMAGE_DIMENSION) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }

        const scale = MAX_IMAGE_DIMENSION / longest;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);

        canvas.toBlob((blob) => {
          resolve(blob || file);
        }, 'image/jpeg', 0.85);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };

      img.src = objectUrl;
    });
  }

  // Unified avatar upload, used identically by profile, group, and channel
  // avatar pickers -- same validation/downscale/error-mapping as the chat
  // image-attach flow above, so "photo too large" reads the same everywhere.
  async function uploadAvatarPhoto(file) {
    if (!file) throw new Error('No file selected.');
    if (!(window.usernode && window.usernode.uploadFile)) {
      throw new Error("Photo upload isn't available here");
    }

    const sourceType = (await sniffImageType(file)) || file.type;
    if (ALLOWED_IMAGE_TYPES.indexOf(sourceType) === -1) {
      throw new Error('Only PNG, JPEG, GIF or WebP images are supported');
    }
    if (file.size > DECODE_LIMIT_BYTES) {
      throw new Error('Image is too large (max 5 MB)');
    }

    const downscaled = await downscaleImage(file, sourceType);
    const uploadType = (await sniffImageType(downscaled)) || downscaled.type || sourceType;
    const blob = toUploadFile(downscaled, file.name, uploadType);

    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error('Image is too large (max 5 MB)');
    }

    try {
      const stored = await window.usernode.uploadFile(blob, { visibility: 'public' });
      return { url: stored.url, id: stored.id };
    } catch (err) {
      console.error('Avatar upload failed:', err);
      throw new Error(uploadErrorMessage(err));
    }
  }

  // Shared Select Photo -> Preview -> Use Photo dialog for profile/group/channel
  // avatar edits. The caller only supplies what varies: the dialog title, the
  // avatar markup to show before a new photo is picked, and an onSave(file)
  // that uploads + persists + re-renders. Throw inside onSave to surface a
  // visible error in the dialog instead of failing silently.
  function showAvatarUploadDialog({ title, currentAvatarHtml, onSave }) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>${title}</h2>
      </div>
      <div class="dialog-content">
        <div id="avatar-upload-preview" class="avatar-preview">
          <div class="avatar-placeholder-large">${currentAvatarHtml}</div>
        </div>
        <input type="file" id="avatar-upload-file-picker" accept="image/*" style="display: none;" />
        <button class="button-secondary" id="avatar-upload-select-button">Select Photo</button>
        <div class="validation-error" id="avatar-upload-error"></div>
      </div>
      <div class="dialog-footer">
        <button class="button-secondary" id="avatar-upload-cancel">Cancel</button>
        <button class="button-primary" id="avatar-upload-save" disabled>Use Photo</button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    let selectedFile = null;
    const filePicker = dialog.querySelector('#avatar-upload-file-picker');
    const preview = dialog.querySelector('#avatar-upload-preview');
    const selectBtn = dialog.querySelector('#avatar-upload-select-button');
    const cancelBtn = dialog.querySelector('#avatar-upload-cancel');
    const saveBtn = dialog.querySelector('#avatar-upload-save');
    const errorEl = dialog.querySelector('#avatar-upload-error');

    selectBtn.addEventListener('click', () => filePicker.click());

    filePicker.addEventListener('change', (e) => {
      const file = e.target.files[0];
      errorEl.textContent = '';
      if (file) {
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
          preview.innerHTML = `<img src="${event.target.result}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
          saveBtn.disabled = false;
        };
        reader.readAsDataURL(file);
      }
    });

    cancelBtn.addEventListener('click', () => overlay.remove());

    saveBtn.addEventListener('click', async () => {
      if (!selectedFile) return;
      errorEl.textContent = '';
      saveBtn.disabled = true;
      selectBtn.disabled = true;
      const originalLabel = saveBtn.textContent;
      saveBtn.textContent = 'Saving…';

      try {
        await onSave(selectedFile);
        overlay.remove();
      } catch (error) {
        errorEl.textContent = (error && error.message) || 'Failed to update photo.';
        saveBtn.disabled = false;
        selectBtn.disabled = false;
        saveBtn.textContent = originalLabel;
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // `thread` is either a direct conversation (from `conversations`) or a group
  // (from `groups`). The two live in different arrays and are drawn by different
  // renderers, so the caller says which one it is — re-rendering a group through
  // renderConversationPage() used to find nothing and bounce the user out to the
  // Messages list, losing the message they just sent.
  // Wires the image-attach button/input pipeline (sniff -> downscale -> upload)
  // that every composer shares - DM, group and channel alike. `actionButton`
  // is whichever button submits the composer (Send or Publish); it's disabled
  // while an upload is in flight so nothing can be sent half-uploaded.
  // Returns an accessor for the currently-uploaded image plus a way to clear
  // it after a successful send/publish.
  function setupImageAttachment(els) {
    const { attachButton, attachInput, pendingBar, pendingThumb, pendingStatus, pendingRemove, actionButton } = els;

    // Pending-image state is per render: every send/publish re-runs this setup
    let pendingImage = null;

    function clearPendingImage() {
      if (pendingImage && pendingImage.objectUrl) {
        URL.revokeObjectURL(pendingImage.objectUrl);
      }
      pendingImage = null;
      if (pendingBar) pendingBar.style.display = 'none';
      if (pendingThumb) pendingThumb.removeAttribute('src');
      if (actionButton) actionButton.disabled = false;
      if (attachButton) attachButton.disabled = false;
      if (attachInput) attachInput.value = '';
    }

    if (attachButton && attachInput) {
      attachButton.addEventListener('click', () => {
        // The bridge is only present inside the platform shell. Keep the
        // button visible everywhere so the feature set never differs.
        if (!(window.usernode && window.usernode.uploadFile)) {
          showToast("Image upload isn't available here", { type: 'error' });
          return;
        }
        attachInput.click();
      });

      attachInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        // Sniff the bytes rather than trusting the picker's MIME type - the
        // platform sniffs too, and rejects anything whose extension disagrees
        const sourceType = (await sniffImageType(file)) || file.type;
        if (ALLOWED_IMAGE_TYPES.indexOf(sourceType) === -1) {
          showToast('Only PNG, JPEG, GIF or WebP images are supported', { type: 'error' });
          attachInput.value = '';
          return;
        }
        // Bail before decoding something pathological, but leave the real
        // 5 MB check until after downscaling - phone camera photos routinely
        // arrive at 6-12 MB and shrink well under the limit
        if (file.size > DECODE_LIMIT_BYTES) {
          showToast('Image is too large (max 5 MB)', { type: 'error' });
          attachInput.value = '';
          return;
        }

        const downscaled = await downscaleImage(file, sourceType);
        // Re-sniff: the canvas path re-encodes to JPEG, so the content type
        // (and therefore the required extension) can differ from the source
        const uploadType = (await sniffImageType(downscaled)) || downscaled.type || sourceType;
        const blob = toUploadFile(downscaled, file.name, uploadType);

        if (blob.size > MAX_IMAGE_BYTES) {
          showToast('Image is too large (max 5 MB)', { type: 'error' });
          attachInput.value = '';
          return;
        }
        const objectUrl = URL.createObjectURL(blob);

        pendingImage = { blob, objectUrl, url: null, id: null, status: 'uploading' };

        if (pendingThumb) pendingThumb.src = objectUrl;
        if (pendingStatus) pendingStatus.textContent = 'Uploading…';
        if (pendingBar) pendingBar.style.display = 'flex';
        if (actionButton) actionButton.disabled = true;
        attachButton.disabled = true;

        const uploadingFor = pendingImage;
        try {
          const stored = await window.usernode.uploadFile(blob, { visibility: 'public' });
          // The user may have cancelled while the upload was in flight
          if (pendingImage !== uploadingFor) return;

          pendingImage.url = stored.url;
          pendingImage.id = stored.id;
          pendingImage.status = 'ready';
          if (pendingStatus) pendingStatus.textContent = 'Ready to send';
          if (actionButton) actionButton.disabled = false;
          attachButton.disabled = false;
        } catch (err) {
          // Log everything the platform gave us plus exactly what we sent, so
          // "upload failed" reports are diagnosable from the console alone
          console.error('Image upload failed:', {
            code: uploadErrorCode(err),
            inferredCode: uploadErrorCode(err) ? null : inferUploadErrorCode(err),
            name: err && err.name,
            message: err && err.message,
            status: err && (err.status || err.statusCode),
            sentFilename: blob && blob.name,
            sentContentType: blob && blob.type,
            sentSizeBytes: blob && blob.size,
            sourceFilename: file.name,
            sourceContentType: file.type,
            sniffedContentType: sourceType
          }, err);
          if (pendingImage === uploadingFor) {
            clearPendingImage();
          }
          showToast(uploadErrorMessage(err), { type: 'error' });
        } finally {
          attachInput.value = '';
        }
      });
    }

    if (pendingRemove) {
      pendingRemove.addEventListener('click', () => {
        clearPendingImage();
      });
    }

    return {
      clearPendingImage,
      getReadyImage: () => (pendingImage && pendingImage.status === 'ready' ? pendingImage : null)
    };
  }

  function setupComposer(thread, options) {
    const opts = options || {};
    const isGroup = !!opts.isGroup;
    const typingTarget = opts.typingTarget || null;
    // How to redraw the screen we're on after a send. Defaults to the direct
    // conversation renderer; group and channel views pass their own.
    const rerender = typeof opts.rerender === 'function'
      ? opts.rerender
      : (isGroup
        ? () => renderGroupConversationPage(thread.id, { fromSend: true })
        : () => renderConversationPage(thread.id, { fromSend: true }));
    const conversation = thread;
    const composerInput = document.querySelector('.composer-input');
    const sendButton = document.querySelector('.send-button');
    const replyCloseButton = document.querySelector('.reply-close-button');
    const attachButton = document.querySelector('.attach-image-button');
    const attachInput = document.querySelector('.attach-image-input');
    const pendingBar = document.querySelector('.pending-image-bar');
    const pendingThumb = document.querySelector('.pending-image-thumb');
    const pendingStatus = document.querySelector('.pending-image-status');
    const pendingRemove = document.querySelector('.pending-image-remove');

    const imageAttachment = setupImageAttachment({
      attachButton, attachInput, pendingBar, pendingThumb, pendingStatus, pendingRemove,
      actionButton: sendButton
    });

    // Auto-expand textarea functionality
    function autoExpandTextarea() {
      // Reset height to calculate scrollHeight
      composerInput.style.height = 'auto';
      // Set height based on scrollHeight, but respect max-height (120px)
      const newHeight = Math.min(composerInput.scrollHeight, 120);
      composerInput.style.height = newHeight + 'px';
    }

    composerInput.addEventListener('input', autoExpandTextarea);

    // Collapse when empty
    const originalValue = composerInput.value;
    composerInput.addEventListener('input', () => {
      if (composerInput.value.trim() === '') {
        composerInput.style.height = '48px';
      }
    });

    // Typing ping: only wired for DM/group (typingTarget is null for the
    // channel composer, which never gets one -- publishing a post isn't
    // "typing at" anyone). Pings are throttled to at most one every 3s so a
    // fast typist doesn't hammer the endpoint on every keystroke; going idle
    // for 3s (or emptying the box, or sending) clears the status right away
    // rather than waiting out the server's TTL fallback.
    if (typingTarget) {
      const TYPING_PING_THROTTLE_MS = 3000;
      const TYPING_IDLE_MS = 3000;
      let lastTypingPingAt = 0;
      let typingIdleTimer = null;
      composerInput.addEventListener('input', () => {
        if (typingIdleTimer) {
          clearTimeout(typingIdleTimer);
          typingIdleTimer = null;
        }
        if (composerInput.value.trim() === '') {
          clearTyping(typingTarget);
          return;
        }
        const now = Date.now();
        if (now - lastTypingPingAt >= TYPING_PING_THROTTLE_MS) {
          lastTypingPingAt = now;
          pingTyping(typingTarget);
        }
        typingIdleTimer = setTimeout(() => clearTyping(typingTarget), TYPING_IDLE_MS);
      });
    }

    if (replyCloseButton) {
      replyCloseButton.addEventListener('click', () => {
        clearReplyState(conversation.id);
      });
    }

    sendButton.addEventListener('click', () => {
      const text = composerInput.value.trim();
      const readyImage = imageAttachment.getReadyImage();
      // An image on its own is a valid message - text is optional now
      if (!text && !readyImage) return;

      // Create new message with optional reply metadata
      const newMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        senderId: 'user_self',
        text: text,
        timestamp: Date.now(),
        isOutgoing: true
      };

      if (readyImage) {
        newMessage.imageUrl = readyImage.url;
        newMessage.imageId = readyImage.id;
      }

      // Attach reply metadata if replying
      const activeReply = getReplyState(conversation.id);
      if (activeReply && activeReply.targetMessageId) {
        newMessage.replyTo = {
          messageId: activeReply.targetMessageId,
          senderName: activeReply.targetSenderName,
          previewText: activeReply.targetPreviewText
        };
      }

      // Add message to conversation
      conversation.messages.push(newMessage);
      composerInput.value = '';
      composerInput.style.height = '48px';
      clearReplyState(conversation.id);
      imageAttachment.clearPendingImage();
      if (typingTarget) clearTyping(typingTarget);

      // Update conversation last message and timestamp for All tab sorting. A
      // group's row in the Messages list is keyed by groupId (a channel's by
      // channelId), not by the thread's own id - so match on all three. An
      // image-only message previews as "📷 Photo" rather than empty text.
      updateConversationLastMessage(
        conversation.id,
        truncateText(messagePreviewText(newMessage), 100),
        newMessage.timestamp
      );

      // Deliver to the server so the other participant actually receives it
      // (and so it survives a reload) -- best-effort, the bubble above is
      // already shown regardless of whether this succeeds.
      if (isGroup) {
        deliverThreadMessage('group', conversation.id, newMessage, rerender);
      } else {
        deliverThreadMessage('direct', directPeerId(conversation.id), newMessage, rerender);
      }

      // Re-render the SAME screen we're on, so the user stays in the thread.
      rerender();
    });

    // Set up quoted message click handlers for scrolling and highlighting
    const quotedMessages = document.querySelectorAll('.message-quote');
    quotedMessages.forEach(quote => {
      quote.style.cursor = 'pointer';
      quote.addEventListener('click', (e) => {
        e.stopPropagation();
        const quotedMessageId = quote.dataset.quotedMessageId;
        const messagesContainer = document.querySelector('.messages-container');
        const targetBubble = document.querySelector(`[data-message-id="${quotedMessageId}"].message-bubble`);

        if (targetBubble && messagesContainer) {
          // Scroll to the target message
          targetBubble.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Add highlight animation
          targetBubble.classList.add('highlight-pulse');
          setTimeout(() => {
            targetBubble.classList.remove('highlight-pulse');
          }, 1500);
        }
      });
    });
  }

  // Render group conversation screen
  async function renderGroupConversationPage(groupId, renderOptions) {
    const fromSend = !!(renderOptions && renderOptions.fromSend);
    let group = groups.find(g => g.id === groupId);
    const isMember = !!group;

    if (!group) {
      group = discoverGroups.find(g => g.id === groupId);
    }
    if (!group) {
      // Not in local state -- reached via a Discover click or an invite link.
      // A private group still resolves by exact id here (see the relaxed
      // GET /api/groups/:groupId on the server) -- possessing the id is
      // itself the authorization -- it just comes back with no member list.
      try {
        const response = await fetch(`/api/groups/${groupId}`, { headers: authHeaders() });
        if (response.ok) {
          const payload = await response.json();
          if (payload.group) {
            group = {
              id: payload.group.id,
              name: payload.group.name,
              description: payload.group.description || '',
              avatar: payload.group.avatarUrl || payload.group.avatar || generateDefaultAvatar(payload.group.name),
              avatarImageId: payload.group.avatarImageId || null,
              memberCount: payload.group.memberCount,
              visibility: payload.group.visibility,
              creatorId: payload.group.creatorId,
              members: (payload.group.members || []).map(mapServerMember),
              joinRequests: [],
              createdAt: payload.group.createdAt,
              source: 'server'
            };
            // Cache it locally so Join/Request to Join keep working from this
            // screen without another round trip. This is a "known groups"
            // cache, not the Discover listing itself -- filterDiscoverCommunities
            // still keeps private groups out of the visible Discover feed.
            if (!discoverGroups.some(g => g.id === group.id)) {
              discoverGroups.push(Object.assign({ isFeatured: false, isNew: !!payload.group.isNew }, group));
            }
          }
        }
      } catch (error) {
        console.warn('Could not load group:', error);
      }
    }
    if (!group) {
      renderPage('messages');
      return;
    }

    const isPrivate = group.visibility === 'private';
    const hasPendingRequest = !isMember && isPrivate && (group.joinRequests || []).some(r => r.userId === 'user_self');
    group.messages = group.messages || [];
    await hydrateThreadMessages('group', groupId, group);
    padForShotLongThread(group.messages, true, (ts, n) => ({
      id: `shot-pad-group-${n}`, senderId: 'staging-demo-user-2', senderName: 'staging-demo-ana',
      text: `Filler message ${n}`, timestamp: ts, isOutgoing: false
    }));
    const messages = group.messages;

    const messagesList = messages.map(msg => {
      if (msg.isSystemMessage) {
        return `<div class="message-system" data-message-id="${msg.id}">${escapeHtml(msg.text)}</div>`;
      }
      let messageHTML = `<div class="message-swipe-wrapper ${msg.isOutgoing ? 'wrapper-outgoing' : 'wrapper-incoming'}" data-message-id="${msg.id}">`;
      messageHTML += `<div class="message-reply-icon" aria-hidden="true">↩️</div>`;
      messageHTML += `<div class="message ${msg.isOutgoing ? 'outgoing' : 'incoming has-avatar'}" data-message-id="${msg.id}">`;

      const bubbleBody = messageBodyHTML(msg);
      const bubbleClass = `message-bubble${messageBubbleClass(msg)}`;

      const quoteHTML = msg.replyTo ? `
        <div class="message-quote" data-quoted-message-id="${escapeAttr(msg.replyTo.messageId)}">
          <div class="quote-border"></div>
          <div class="quote-content">
            <div class="quote-sender">${escapeHtml(msg.replyTo.senderName)}</div>
            <div class="quote-text">${escapeHtml(msg.replyTo.previewText)}</div>
          </div>
        </div>
      ` : '';

      const forwardHTML = msg.forwardedFrom ? forwardAttributionHTML(msg.forwardedFrom) : '';

      // Container always renders, like .post-reaction-chips, so a later
      // refreshMessageReactions() call always has an element to patch.
      const reactionChipsRow = `<div class="message-reaction-chips" data-message-id="${msg.id}">${messageReactionChipsHTML(msg)}</div>`;

      if (msg.isOutgoing) {
        messageHTML += `
          ${quoteHTML}
          ${forwardHTML}
          ${renderPinBadge(msg)}
          <div class="${bubbleClass}" data-message-id="${msg.id}">${bubbleBody}</div>
          ${reactionChipsRow}
          ${msg.failed
            ? `<div class="message-timestamp message-failed" data-retry-message-id="${msg.id}">⚠️ Failed to send · Tap to retry</div>`
            : `<div class="message-timestamp">${formatMessageTime(msg.timestamp)}</div>`}
        </div>`;
      } else {
        messageHTML += `
          <div class="message-avatar">${renderCommunityAvatar((group.members.find(m => m.id === msg.senderId) || {}).avatar, msg.senderName)}</div>
          <div class="message-content">
            <div class="message-sender-name">${escapeHtml(msg.senderName)}</div>
            ${quoteHTML}
            ${forwardHTML}
            ${renderPinBadge(msg)}
            <div class="${bubbleClass}" data-message-id="${msg.id}">${bubbleBody}</div>
            ${reactionChipsRow}
            <div class="message-timestamp">${formatMessageTime(msg.timestamp)}</div>
          </div>
        </div>`;
      }

      messageHTML += `</div>`;

      return messageHTML;
    }).join('');

    let actionAreaHTML;
    if (isMember) {
      actionAreaHTML = composerMarkup({ conversationId: group.id });
    } else if (hasPendingRequest) {
      actionAreaHTML = `<button class="group-preview-action-button" id="group-join-action-btn" disabled>Request Pending</button>`;
    } else if (isPrivate) {
      actionAreaHTML = `<button class="group-preview-action-button" id="group-join-action-btn">Request to Join</button>`;
    } else {
      actionAreaHTML = `<button class="group-preview-action-button" id="group-join-action-btn">Join Group</button>`;
    }

    // See renderConversationPage's identical guard: a poll-triggered
    // re-render must not wipe an in-progress composer draft out from under
    // the user typing it.
    const existingGroupComposerInput = pageContainer.querySelector('.conversation-page')?.dataset.conversationId === groupId
      ? pageContainer.querySelector('.composer-input')
      : null;
    const preservedGroupDraft = existingGroupComposerInput ? existingGroupComposerInput.value : '';
    const hadGroupFocus = existingGroupComposerInput === document.activeElement;

    pageContainer.innerHTML = `
      <div class="conversation-page" data-conversation-id="${escapeAttr(groupId)}">
        <div class="conversation-page-header">
          <button class="back-button" aria-label="Back to messages">←</button>
          <div class="conversation-header-info group-header-info" id="group-header-info-${groupId}">
            <div class="conversation-avatar-header">${renderCommunityAvatar(group.avatar, group.name)}</div>
            <div class="header-text">
              <div class="header-username">${group.name}</div>
              <div class="header-member-count">${group.memberCount} members</div>
            </div>
          </div>
          ${isMember ? `<button class="menu-button" aria-label="More options">⋮</button>` : ''}
        </div>
        <div class="messages-area">
          <div class="messages-container">
            ${messagesList}
          </div>
          ${scrollToLatestFabHTML()}
        </div>
        <div class="typing-indicator-bar" aria-live="polite"></div>
        <div class="composer-container chat-composer">
          ${actionAreaHTML}
        </div>
      </div>
    `;

    if (preservedGroupDraft) {
      const newGroupComposerInput = pageContainer.querySelector('.composer-input');
      if (newGroupComposerInput) {
        newGroupComposerInput.value = preservedGroupDraft;
        newGroupComposerInput.style.height = Math.min(newGroupComposerInput.scrollHeight, 120) + 'px';
        if (hadGroupFocus) {
          newGroupComposerInput.focus();
          newGroupComposerInput.selectionStart = newGroupComposerInput.selectionEnd = preservedGroupDraft.length;
        }
      }
    }

    // Add back button handler. Returns to Discover when this chat was opened
    // from a Discover card (or an invite link), the Create menu when opened
    // from its managed-groups list, otherwise falls back to Messages.
    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = groupChannelBackTarget;
    });

    // Add interactive header controls for group management. Not applicable
    // for a non-member preview — there's no Group Info/edit surface to jump to.
    const headerInfo = document.getElementById(`group-header-info-${groupId}`);
    if (headerInfo && isMember) {
      headerInfo.style.cursor = 'pointer';
      // Admins/owners get a quick edit shortcut on tap; everyone else is
      // taken to the Group Info screen (view-only for them, and where
      // Share Group lives) instead of the edit dialog directly opening.
      const isHeaderAdmin = isCurrentUserGroupAdmin(group);
      // Tap on group name to edit
      const headerUsername = headerInfo.querySelector('.header-username');
      if (headerUsername) {
        headerUsername.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isHeaderAdmin) {
            showEditNameDialog(groupId, group.name);
          } else {
            window.location.hash = `/group/${groupId}/info`;
          }
        });
      }
      // Tap on avatar to change photo
      const avatar = headerInfo.querySelector('.conversation-avatar-header');
      if (avatar) {
        avatar.style.cursor = 'pointer';
        avatar.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isHeaderAdmin) {
            showAvatarPickerDialog(groupId, group);
          } else {
            window.location.hash = `/group/${groupId}/info`;
          }
        });
      }
    }

    // Add group menu button for more options (members, leave, edit description)
    const menuButton = document.querySelector('.menu-button');
    if (menuButton) {
      menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        showGroupMenuDialog(groupId, group);
      });
    }

    // Wire the Join/Request action button shown in place of the composer
    // for a non-member. Re-renders this same page in place on success so
    // the user lands straight in the conversation instead of bouncing to
    // Discover (joinDiscoverGroup/requestToJoinGroup both internally call
    // renderDiscoverPage(), but nothing awaits between that DOM write and
    // this one, so there's no visible flicker).
    const joinActionButton = document.getElementById('group-join-action-btn');
    if (joinActionButton && !hasPendingRequest) {
      joinActionButton.addEventListener('click', async () => {
        joinActionButton.disabled = true;
        if (isPrivate) {
          await requestToJoinGroup(groupId);
        } else {
          await joinDiscoverGroup(groupId);
        }
        renderGroupConversationPage(groupId);
      });
    }

    // Scroll to latest message after DOM renders. The screenshot deep link parks
    // the list at the top so the FAB is visible — but after SENDING we always
    // jump to the bottom so the user sees the message they just wrote.
    const groupRoot = pageContainer.querySelector('.conversation-page');
    const parkedAtBottom = !(SHOT_SCROLL_FAB && !fromSend);
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = parkedAtBottom
          ? messagesContainer.scrollHeight
          : 0;
        // Photos in the thread decode after this point and would otherwise
        // push the end of the list back out of reach.
        keepThreadPinnedThroughImageLoads(messagesContainer, parkedAtBottom);
      }
    }, 0);

    // Floating "jump to newest message" button
    setupScrollToLatestFab(groupRoot);

    // Set up message long-press interactions (no-op for a non-member preview,
    // which has no editable messages, but harmless to skip explicitly)
    if (isMember) {
      setupMessageLongPress(group, 'group');
      setupMessageSwipeToReply(group, 'group');
    }
    setupForwardAttributionLinks(groupRoot);

    // Set up image lightbox for image messages
    setupImageLightbox();

    // Set up send button and reply state management -- only relevant once
    // the viewer is actually a member; non-members see the Join/Request
    // button wired above instead.
    if (isMember) {
      setupComposer(group, { isGroup: true, typingTarget: { type: 'group', id: groupId } });

      // Tap a "Failed to send" label to retry delivering that message.
      groupRoot.querySelectorAll('[data-retry-message-id]').forEach(el => {
        el.addEventListener('click', () => {
          const msg = group.messages.find(m => m.id === el.dataset.retryMessageId);
          if (!msg) return;
          deliverThreadMessage('group', groupId, msg, () => renderGroupConversationPage(groupId));
          renderGroupConversationPage(groupId);
        });
      });

      startThreadPolling(
        () => hydrateThreadMessages('group', groupId, group),
        () => renderGroupConversationPage(groupId),
        () => {
          const failed = group.messages.filter(m => m.failed);
          if (!failed.length) return false;
          failed.forEach(msg => deliverThreadMessage('group', groupId, msg, () => renderGroupConversationPage(groupId)));
          return true;
        }
      );

      startTypingPolling(
        () => fetchTypingUsers('group', groupId),
        (names) => renderTypingIndicator(groupRoot.querySelector('.typing-indicator-bar'), true, names)
      );
    }

    // Must stay last: the send re-renders this page underneath us.
    if (isMember && SHOT_SEND_STAY && !fromSend) sendShotMessage(groupRoot);
    if (isMember && SHOT_SEND_FAIL && !fromSend) sendShotMessage(groupRoot);
  }

  // Show group menu with all options (members, edit description, leave)
  function showGroupMenuDialog(groupId, group) {
    const myRole = (group.members.find(m => m.id === 'user_self') || {}).role;
    const canManageMembers = myRole === 'owner' || myRole === 'admin';

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog group-menu-dialog';
    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>${group.name}</h2>
        <button class="close-dialog-button">✕</button>
      </div>
      <div class="dialog-content group-menu-content">
        <button class="menu-option" id="view-members-btn">
          <span class="option-icon">👥</span>
          <span class="option-label">Members (${group.memberCount})</span>
          <span class="option-chevron">›</span>
        </button>
        <button class="menu-option" id="group-info-btn">
          <span class="option-icon">ℹ️</span>
          <span class="option-label">Group Info</span>
          <span class="option-chevron">›</span>
        </button>
        ${canManageMembers ? `
        <button class="menu-option" id="add-members-btn">
          <span class="option-icon">➕</span>
          <span class="option-label">Add Members</span>
          <span class="option-chevron">›</span>
        </button>` : ''}
        <button class="menu-option leave-option" id="leave-group-btn">
          <span class="option-icon">🚪</span>
          <span class="option-label">Leave Group</span>
        </button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    const closeBtn = dialog.querySelector('.close-dialog-button');
    closeBtn.addEventListener('click', () => {
      overlay.remove();
    });

    document.getElementById('view-members-btn').addEventListener('click', () => {
      overlay.remove();
      showMembersSheet(groupId, group);
    });

    document.getElementById('group-info-btn').addEventListener('click', () => {
      overlay.remove();
      window.location.hash = `/group/${groupId}/info`;
    });

    const addMembersBtn = document.getElementById('add-members-btn');
    if (addMembersBtn) {
      addMembersBtn.addEventListener('click', () => {
        overlay.remove();
        showAddMembersSheet(groupId, group);
      });
    }

    document.getElementById('leave-group-btn').addEventListener('click', () => {
      overlay.remove();
      showLeaveGroupDialog(groupId, group.name);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  // Show members list in a sheet/modal
  function showMembersSheet(groupId, group) {
    const myRole = (group.members.find(m => m.id === 'user_self') || {}).role;
    const canManageMembers = myRole === 'owner' || myRole === 'admin';

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog members-sheet-dialog';

    const membersList = group.members.map(member => {
      const roleLabel = member.role === 'owner' ? 'Owner' : member.role === 'admin' ? 'Admin' : '';
      return `
      <div class="members-sheet-item" data-member-id="${member.id}">
        <div class="member-avatar">${renderCommunityAvatar(member.avatar, member.username)}</div>
        <div class="member-info">
          <div class="member-name">${member.username}</div>
          ${roleLabel ? `<div class="member-role-badge">${roleLabel}</div>` : ''}
        </div>
        ${(canManageMembers && member.id !== 'user_self') ? `<button class="member-remove-btn" data-member-id="${member.id}">✕</button>` : ''}
      </div>
    `;
    }).join('');

    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>Members (${group.memberCount})</h2>
        <button class="close-dialog-button">✕</button>
      </div>
      <div class="dialog-content members-list-container">
        ${membersList}
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    const closeBtn = dialog.querySelector('.close-dialog-button');
    closeBtn.addEventListener('click', () => {
      overlay.remove();
    });

    // Long-press or click remove button to remove member
    document.querySelectorAll('.member-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const memberId = btn.dataset.memberId;
        const member = group.members.find(m => m.id === memberId);
        overlay.remove();
        showRemoveMemberConfirmation(groupId, memberId, member);
      });
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  // Show add members sheet
  function showAddMembersSheet(groupId, group) {
    let selectedMembers = [];

    let availableUsers = suggestedUsers.filter(u => !group.members.find(m => m.id === u.id));

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog add-members-sheet-dialog';

    const usersList = availableUsers.map(user => renderUserListItemHtml(user, { selectable: true })).join('');

    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>Add Members</h2>
        <button class="close-dialog-button">✕</button>
      </div>
      <div class="dialog-content">
        <input type="text" class="form-input search-members-add-sheet" placeholder="🔍 Search username" id="search-members-add-sheet" />
        <div class="members-chips-container" id="members-chips-container-sheet"></div>
        <div class="users-list add-members-sheet-list" id="add-members-sheet-list">
          ${usersList}
        </div>
        <div class="validation-error" id="add-members-error"></div>
      </div>
      <div class="dialog-footer">
        <button class="button-secondary" id="cancel-add-members-sheet">Cancel</button>
        <button class="button-primary" id="save-add-members-sheet">Add Members</button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    const closeBtn = dialog.querySelector('.close-dialog-button');
    closeBtn.addEventListener('click', () => {
      overlay.remove();
    });

    const searchInput = document.getElementById('search-members-add-sheet');
    const membersChipsContainer = document.getElementById('members-chips-container-sheet');
    const usersListEl = document.getElementById('add-members-sheet-list');
    const errorEl = document.getElementById('add-members-error');

    function renderChips() {
      if (selectedMembers.length === 0) {
        membersChipsContainer.innerHTML = '';
        return;
      }

      membersChipsContainer.innerHTML = selectedMembers.map(user => `
        <div class="member-chip">
          <div class="chip-avatar">${renderCommunityAvatar(user.avatar, user.username)}</div>
          <span>${user.username}</span>
          <button class="chip-remove" data-user-id="${user.id}" aria-label="Remove ${user.username}">×</button>
        </div>
      `).join('');

      document.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const userId = btn.dataset.userId;
          selectedMembers = selectedMembers.filter(u => u.id !== userId);
          renderChips();
          filterAndDisplay();
        });
      });
    }

    function toggleUser(userId) {
      const user = availableUsers.find(u => u.id === userId);
      if (!user || group.members.find(m => m.id === userId)) return;

      if (selectedMembers.find(u => u.id === userId)) {
        selectedMembers = selectedMembers.filter(u => u.id !== userId);
      } else {
        selectedMembers.push(user);
      }

      renderChips();
      filterAndDisplay();
      errorEl.innerHTML = '';
    }

    function filterAndDisplay() {
      const query = searchInput.value.toLowerCase();
      const filtered = availableUsers.filter(u =>
        u.username.toLowerCase().includes(query) ||
        (u.walletAddress && u.walletAddress.toLowerCase().includes(query))
      );

      usersListEl.innerHTML = filtered.map(user => renderUserListItemHtml(user, {
        selectable: true,
        selected: !!selectedMembers.find(m => m.id === user.id)
      })).join('');

      document.querySelectorAll('.suggested-user-item').forEach(item => {
        item.addEventListener('click', () => {
          const userId = item.dataset.userId;
          toggleUser(userId);
        });
      });
    }

    searchInput.addEventListener('input', filterAndDisplay);

    document.querySelectorAll('.suggested-user-item').forEach(item => {
      item.addEventListener('click', () => {
        const userId = item.dataset.userId;
        toggleUser(userId);
      });
    });

    // Refresh the directory each time this sheet opens.
    fetchSuggestedUsers().then(() => {
      availableUsers = suggestedUsers.filter(u => !group.members.find(m => m.id === u.id));
      filterAndDisplay();
    });

    document.getElementById('cancel-add-members-sheet').addEventListener('click', () => {
      overlay.remove();
    });

    document.getElementById('save-add-members-sheet').addEventListener('click', async () => {
      if (selectedMembers.length === 0) {
        errorEl.textContent = 'Select at least 1 member';
        return;
      }

      try {
        // Fixture (demo) groups aren't in the database, so only server-backed
        // groups make the real membership call — fixtures stay optimistic/local.
        if (group.source === 'server') {
          const response = await fetch(`/api/groups/${groupId}/members`, {
            method: 'POST',
            headers: authHeaders({ 'content-type': 'application/json' }),
            body: JSON.stringify({ members: selectedMembers.map(u => ({ id: u.id, username: u.username })) })
          });

          if (!response.ok) {
            throw new Error('Failed to add members');
          }
        }

        group.members.push(...selectedMembers.map(member => ({ ...member, role: 'member' })));
        group.memberCount = group.members.length;

        // Update conversation
        const conversation = conversations.find(c => c.groupId === groupId);
        if (conversation) {
          conversation.memberCount = group.memberCount;
        }

        overlay.remove();
        renderGroupConversationPage(groupId);
        showToast(`Added ${selectedMembers.length} member(s)`, { type: 'success' });
      } catch (error) {
        errorEl.textContent = 'Failed to add members';
        console.error(error);
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  // Render new message page
  // Search modal opened from the Create screen's wallet/username trigger
  // field. Mirrors showAddMembersSheet's shell, but has no footer since
  // tapping a row acts immediately (starts the DM and closes the modal)
  // instead of accumulating a selection to confirm.
  function showUserSearchModal(initialQuery) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog user-search-modal-dialog';
    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>Search wallet, username</h2>
        <button class="close-dialog-button">✕</button>
      </div>
      <div class="dialog-content">
        <input type="text" class="form-input" id="user-search-modal-input" placeholder="🔍 Search wallet, username" />
        <div class="users-list" id="user-search-modal-list"></div>
      </div>
    `;
    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    const searchInput = dialog.querySelector('#user-search-modal-input');
    const usersListEl = dialog.querySelector('#user-search-modal-list');
    let searchTimeout = null;
    let currentResults = suggestedUsers;

    function renderResults(results, emptyMessage) {
      currentResults = results;
      usersListEl.innerHTML = results.length > 0
        ? results.map(user => renderUserListItemHtml(user)).join('')
        : `<div class="empty-state">${emptyMessage}</div>`;
      usersListEl.querySelectorAll('.suggested-user-item').forEach(item => {
        item.addEventListener('click', () => {
          const userId = item.dataset.userId;
          const user = currentResults.find(u => u.id === userId);
          if (user) {
            overlay.remove();
            startConversationWith(user);
          }
        });
      });
    }

    async function runSearch(query) {
      if (!query) {
        renderResults(suggestedUsers, 'No suggested users.');
        return;
      }
      const results = await searchUsers(query);
      if (searchInput.value.trim() !== query) return; // stale response, a newer query has since landed
      renderResults(results, 'No users found.');
    }

    renderResults(suggestedUsers, 'No suggested users.');

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => runSearch(query), 300);
    });

    dialog.querySelector('.close-dialog-button').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    if (initialQuery) {
      searchInput.value = initialQuery;
      runSearch(initialQuery);
    } else {
      searchInput.focus();
    }
  }

  function renderNewMessagePage() {
    function usersListHtml(list) {
      return list.length > 0
        ? list.map(user => renderUserListItemHtml(user)).join('')
        : '<div class="empty-state">No suggested users.</div>';
    }

    pageContainer.innerHTML = `
      <div class="new-message-page">
        <div class="messages-header">
          <h1>Guardian</h1>
        </div>
        <div class="search-container">
          <input type="text" class="search-field" id="new-message-search-field" placeholder="🔍 Search wallet, username" readonly />
        </div>
        <div class="create-scroll">
          <div class="create-options">
            <div class="create-section create-section-group">
              <div class="create-group-card">
                <span class="group-icon">👥</span>
                <span class="group-label">Create Group</span>
                <span class="group-chevron">></span>
              </div>
              ${renderManagedListHtml('group')}
            </div>
            <div class="create-section create-section-channel">
              <div class="create-channel-card" data-testid="create-channel-entry">
                <span class="channel-icon">#</span>
                <span class="channel-label">Create Channel</span>
                <span class="channel-chevron">></span>
              </div>
              ${renderManagedListHtml('channel')}
            </div>
          </div>
          <div class="suggested-users-section">
            <div class="section-header" id="new-message-users-header">Suggested Users</div>
            <div class="users-list" id="new-message-users-list">
              ${usersListHtml(suggestedUsers)}
            </div>
          </div>
        </div>
      </div>
    `;

    // Add create group card handler
    document.querySelector('.create-group-card').addEventListener('click', () => {
      window.location.hash = '/create-group';
    });

    // Add create channel card handler — exactly one entry point lives here
    const createChannelEntries = document.querySelectorAll('[data-testid="create-channel-entry"]');
    if (createChannelEntries.length !== 1) {
      console.error(`Expected exactly 1 create-channel entry point, found ${createChannelEntries.length}`);
    }
    createChannelEntries[0].addEventListener('click', () => {
      window.location.hash = '/create-channel';
    });

    // Managed group/channel rows sitting under each create card
    attachManagedListListeners();

    const usersListEl = document.getElementById('new-message-users-list');
    const searchField = document.getElementById('new-message-search-field');

    // Tapping a suggested user opens (or starts) a DM with them.
    function attachUserItemHandlers() {
      usersListEl.querySelectorAll('.suggested-user-item').forEach(item => {
        item.addEventListener('click', () => {
          const userId = item.dataset.userId;
          const user = suggestedUsers.find(u => u.id === userId);
          if (user) startConversationWith(user);
        });
      });
    }
    attachUserItemHandlers();

    // Tapping/focusing the (readonly) search field opens the search modal
    // instead of typing inline. Blur immediately so the on-screen keyboard
    // never opens against this trigger, only against the modal's own
    // input, and so the field can be re-focused to reopen the modal later.
    searchField.addEventListener('focus', () => {
      searchField.blur();
      showUserSearchModal();
    });

    // Refresh Suggested Users with the latest directory each time this screen opens.
    fetchSuggestedUsers().then(() => {
      usersListEl.innerHTML = usersListHtml(suggestedUsers);
      attachUserItemHandlers();
    });

    // Screenshot-state deep link: open the search modal pre-filled with a
    // real query against the staging seed data, so the wallet/username
    // search results are reachable for a screenshot without needing to
    // type into the field by hand.
    if (SHOT_SEARCH_USERS) {
      showUserSearchModal(SHOT_SEARCH_QUERY);
    } else if (SHOT_CREATE_SEARCH_MODAL) {
      // Screenshot-state deep link: open the search modal empty, since the
      // modal itself is otherwise only reachable by tapping the trigger field.
      showUserSearchModal();
    }
  }

  // Render Create Group Page
  function renderCreateGroupPage() {
    const state = {
      groupName: '',
      groupDescription: '',
      visibility: 'private',
      selectedMembers: [],
      searchQuery: '',
      avatarFile: null,
      avatarPreview: null,
      avatarUrl: null,
      avatarImageId: null,
      avatarUploadPromise: null,
      validationError: ''
    };

    const usersList = suggestedUsers.map(user => renderUserListItemHtml(user, { selectable: true })).join('');

    pageContainer.innerHTML = `
      <div class="create-group-page">
        <div class="create-group-header">
          <button class="back-button" aria-label="Back to new message">←</button>
          <h1>Create Group</h1>
        </div>

        <div class="group-avatar-section">
          <div class="avatar-placeholder" id="avatar-placeholder">
            <div class="avatar-placeholder-text">+ Add Photo</div>
          </div>
          <input type="file" id="avatar-file-input" accept="image/*" style="display: none;" />
        </div>

        <div class="form-section">
          <div>
            <input type="text" class="form-input" placeholder="Group name" id="group-name-input" maxlength="50" />
            <div class="validation-error" id="name-error"></div>
          </div>
          <input type="text" class="form-input" placeholder="Add a description (optional)" id="group-description-input" maxlength="250" />
        </div>

        <div class="form-section privacy-section">
          <div class="section-header">Privacy</div>
          <div class="privacy-toggle" id="privacy-toggle">
            <button type="button" class="privacy-option active" data-visibility="private" id="privacy-private-btn">🔒 Private</button>
            <button type="button" class="privacy-option" data-visibility="public" id="privacy-public-btn">🌐 Public</button>
          </div>
          <div class="privacy-help" id="privacy-help">${PRIVACY_HELP.private}</div>
        </div>

        <div class="form-section">
          <input type="text" class="form-input" placeholder="🔍 Search username" id="search-members-input" />
        </div>

        <div class="members-chips-container" id="members-chips-container"></div>

        <div class="suggested-users-section-create">
          <div class="section-header" id="suggested-users-header">Suggested Users</div>
          <div class="users-list" id="suggested-users-list">
            ${usersList}
          </div>
        </div>

        <div class="validation-error" id="members-error"></div>

        <button class="create-group-button" id="create-group-button">Create Group</button>
      </div>
    `;

    // Cache DOM references
    const backButton = document.querySelector('.back-button');
    const groupNameInput = document.getElementById('group-name-input');
    const groupDescriptionInput = document.getElementById('group-description-input');
    const searchMembersInput = document.getElementById('search-members-input');
    const avatarPlaceholder = document.getElementById('avatar-placeholder');
    const avatarFileInput = document.getElementById('avatar-file-input');
    const suggestedUsersList = document.getElementById('suggested-users-list');
    const usersSectionHeader = document.getElementById('suggested-users-header');
    const membersChipsContainer = document.getElementById('members-chips-container');
    const createGroupButton = document.getElementById('create-group-button');
    const nameError = document.getElementById('name-error');
    const membersError = document.getElementById('members-error');

    let searchTimeout = null;
    let currentResults = suggestedUsers;

    // Helper function to update avatar display
    function updateAvatarDisplay() {
      if (state.avatarPreview) {
        const img = document.createElement('img');
        img.src = state.avatarPreview;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.borderRadius = '50%';
        img.style.objectFit = 'cover';
        avatarPlaceholder.innerHTML = '';
        avatarPlaceholder.appendChild(img);
      } else if (state.groupName.trim()) {
        const initials = generateDefaultAvatar(state.groupName);
        avatarPlaceholder.innerHTML = `<div style="font-size: 48px; color: #fff; font-weight: 600;">${initials}</div>`;
      } else {
        avatarPlaceholder.innerHTML = '<div class="avatar-placeholder-text">+ Add Photo</div>';
      }
    }

    // Helper function to check if button should be disabled
    function updateButtonState() {
      const isNameFilled = state.groupName.trim().length > 0;
      const isMembersSelected = state.selectedMembers.length >= 1;
      const isDisabled = !(isNameFilled && isMembersSelected);
      createGroupButton.disabled = isDisabled;
    }

    // Helper function to find user by ID — checks the currently displayed
    // (suggested or live search) results first, then already-selected members
    // so a chip can still be removed after the search results change underneath it.
    function findUserById(userId) {
      return currentResults.find(u => u.id === userId) ||
        suggestedUsers.find(u => u.id === userId) ||
        state.selectedMembers.find(u => u.id === userId);
    }

    // Helper function to check if user is selected
    function isUserSelected(userId) {
      return state.selectedMembers.some(u => u.id === userId);
    }

    // Helper function to toggle user in selected members
    function toggleUser(userId) {
      const user = findUserById(userId);
      if (!user) return;

      if (isUserSelected(userId)) {
        state.selectedMembers = state.selectedMembers.filter(u => u.id !== userId);
      } else {
        state.selectedMembers.push(user);
      }

      renderMemberChips();
      updateButtonState();
      membersError.innerHTML = '';
    }

    // Helper function to render member chips
    function renderMemberChips() {
      if (state.selectedMembers.length === 0) {
        membersChipsContainer.innerHTML = '';
        return;
      }

      const chipsHTML = state.selectedMembers.map(user => `
        <div class="member-chip">
          <div class="chip-avatar">${renderCommunityAvatar(user.avatar, user.username)}</div>
          <span>${user.username}</span>
          <button class="chip-remove" data-user-id="${user.id}" aria-label="Remove ${user.username}">×</button>
        </div>
      `).join('');

      membersChipsContainer.innerHTML = chipsHTML;

      // Add event listeners to remove buttons
      document.querySelectorAll('.chip-remove').forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const userId = button.dataset.userId;
          toggleUser(userId);
        });
      });
    }

    // Renders a list of users into the users-list panel and (re)attaches
    // click-to-toggle handlers.
    function renderUsersList(users) {
      suggestedUsersList.innerHTML = users.length > 0
        ? users.map(user => renderUserListItemHtml(user, {
            selectable: true,
            selected: isUserSelected(user.id)
          })).join('')
        : '<div class="empty-state">No users found.</div>';

      document.querySelectorAll('.suggested-user-item').forEach(item => {
        item.addEventListener('click', () => {
          const userId = item.dataset.userId;
          toggleUser(userId);
        });
      });
    }

    // Helper function to filter and display users based on search — queries the
    // real directory (GET /api/users/search, matching username or usernode
    // address, case-insensitive) instead of only filtering the locally cached
    // "suggested" list, so an admin can find any real user, not just the 20
    // most-recently-active ones.
    function filterAndDisplayUsers() {
      const query = state.searchQuery.trim();
      if (!query) {
        currentResults = suggestedUsers;
        usersSectionHeader.textContent = 'Suggested Users';
        renderUsersList(currentResults);
        return;
      }
      searchUsers(query).then(results => {
        if (state.searchQuery.trim() !== query) return; // stale response, a newer query has since landed
        currentResults = results;
        usersSectionHeader.textContent = 'Search Results';
        renderUsersList(currentResults);
        if (results.length === 0) {
          showAlertDialog('No Results', 'User tidak ditemukan');
        }
      });
    }

    // Privacy toggle handlers
    const privacyPrivateBtn = document.getElementById('privacy-private-btn');
    const privacyPublicBtn = document.getElementById('privacy-public-btn');
    const privacyHelp = document.getElementById('privacy-help');
    privacyPrivateBtn.addEventListener('click', () => {
      state.visibility = 'private';
      privacyPrivateBtn.classList.add('active');
      privacyPublicBtn.classList.remove('active');
      privacyHelp.textContent = PRIVACY_HELP.private;
    });
    privacyPublicBtn.addEventListener('click', () => {
      state.visibility = 'public';
      privacyPublicBtn.classList.add('active');
      privacyPrivateBtn.classList.remove('active');
      privacyHelp.textContent = PRIVACY_HELP.public;
    });

    // Back button handler
    backButton.addEventListener('click', () => {
      window.location.hash = '/create';
    });

    // Avatar placeholder handler - opens file picker
    avatarPlaceholder.addEventListener('click', () => {
      avatarFileInput.click();
    });

    // Avatar file input handler — preview immediately from the local file,
    // then upload in the background; submitCreateGroup awaits avatarUploadPromise
    // so the create request never races an in-flight upload.
    avatarFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        state.avatarFile = file;
        state.avatarPreview = event.target.result;
        updateAvatarDisplay();
      };
      reader.readAsDataURL(file);

      state.avatarUrl = null;
      state.avatarImageId = null;
      state.avatarUploadPromise = uploadAvatarPhoto(file).then((uploaded) => {
        state.avatarUrl = uploaded.url;
        state.avatarImageId = uploaded.id;
      }).catch((error) => {
        state.avatarPreview = null;
        updateAvatarDisplay();
        showToast(error.message || 'Failed to upload photo.', { type: 'error' });
      });
    });

    // Group name input handler
    groupNameInput.addEventListener('input', (e) => {
      state.groupName = e.target.value.substring(0, 50);
      e.target.value = state.groupName;
      updateAvatarDisplay();
      updateButtonState();
      nameError.innerHTML = '';
    });

    // Group description input handler
    groupDescriptionInput.addEventListener('input', (e) => {
      state.groupDescription = e.target.value.substring(0, 250);
      e.target.value = state.groupDescription;
    });

    // Search members input handler — debounced, backed by the real directory search.
    searchMembersInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(filterAndDisplayUsers, 300);
    });

    // Initial render + click handlers for the suggested users list already in the page
    renderUsersList(currentResults);

    // Refresh Suggested Users with the latest directory each time this screen opens.
    fetchSuggestedUsers().then(() => {
      if (state.searchQuery.trim()) return; // a search is already in progress; don't clobber it
      currentResults = suggestedUsers;
      renderUsersList(currentResults);
    });

    // Create Group button handler
    async function submitCreateGroup() {
      nameError.innerHTML = '';
      membersError.innerHTML = '';

      // Validate group name
      if (!state.groupName.trim()) {
        nameError.innerHTML = 'Group name is required.';
        return;
      }

      // Validate members
      if (state.selectedMembers.length < 1) {
        membersError.innerHTML = 'Select at least 1 member.';
        return;
      }

      createGroupButton.disabled = true;
      const originalLabel = createGroupButton.textContent;
      createGroupButton.textContent = 'Creating…';

      // A still-in-flight avatar upload must not race group creation -- wait
      // for it (uploadAvatarPhoto already surfaced any failure as a toast).
      if (state.avatarUploadPromise) {
        await state.avatarUploadPromise;
      }

      let payload;
      try {
        const response = await fetch('/api/groups', {
          method: 'POST',
          headers: authHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify({
            name: state.groupName,
            description: state.groupDescription,
            avatarUrl: state.avatarUrl,
            avatarImageId: state.avatarImageId,
            visibility: state.visibility,
            members: state.selectedMembers.map(u => ({ id: u.id, username: u.username }))
          })
        });

        payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          membersError.innerHTML = payload.error || 'Failed to create group.';
          createGroupButton.textContent = originalLabel;
          updateButtonState();
          return;
        }
      } catch (error) {
        console.error('Failed to create group:', error);
        membersError.innerHTML = 'Failed to create group. Please try again.';
        createGroupButton.textContent = originalLabel;
        updateButtonState();
        return;
      }

      // The group is already committed server-side at this point -- a problem
      // shaping/merging it into local state must never surface as "failed to
      // create" (the group would then be invisible in every list until the
      // next full reload even though it exists). Navigate to it regardless.
      let groupId = payload.group && payload.group.id;
      try {
        const shaped = addServerGroupToState(payload.group);
        groupId = shaped.id;
      } catch (error) {
        console.error('Group created but failed to merge into local state:', error);
      }
      window.location.hash = `/group/${groupId}`;
    }

    createGroupButton.addEventListener('click', submitCreateGroup);

    // Initialize button state
    updateButtonState();

    // Screenshot-state deep links: deterministic setup for otherwise-unreachable
    // Create Group states, used for before/after screenshots and dapp.json tests.
    if (SHOT_CREATE_GROUP_PUBLIC) {
      privacyPublicBtn.click();
    }
    if (SHOT_CREATE_GROUP_ONE_MEMBER) {
      groupNameInput.value = SHOT_CREATE_GROUP_NAME;
      groupNameInput.dispatchEvent(new Event('input'));
      const firstUser = document.querySelector('.suggested-user-item');
      if (firstUser) firstUser.click();
    }
    if (SHOT_CREATE_GROUP_ZERO_MEMBERS) {
      groupNameInput.value = SHOT_CREATE_GROUP_NAME;
      groupNameInput.dispatchEvent(new Event('input'));
      // The button is disabled with zero members, so a real click never fires —
      // invoke the submit handler directly to surface the blocked-submit error.
      submitCreateGroup();
    }
  }

  // Render Group Info page
  function renderGroupInfoPage(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) {
      window.location.hash = '/messages';
      return;
    }

    const myRole = (group.members.find(m => m.id === 'user_self') || {}).role;
    const canManageMembers = myRole === 'owner' || myRole === 'admin';
    const isAdmin = isCurrentUserGroupAdmin(group);
    const pendingRequestCount = (group.joinRequests || []).length;

    const membersList = group.members.map(member => {
      const roleLabel = member.role === 'owner' ? 'Owner' : member.role === 'admin' ? 'Admin' : '';
      const showAdminToggle = myRole === 'owner' && member.id !== 'user_self' && member.role !== 'owner';
      const adminToggleLabel = member.role === 'admin' ? 'Remove Admin' : 'Make Admin';

      return `
        <div class="group-member-item" data-member-id="${member.id}">
          <div class="member-avatar">${renderCommunityAvatar(member.avatar, member.username)}</div>
          <div class="member-info">
            <div class="member-name">${member.username}</div>
            ${roleLabel ? `<div class="member-role-badge">${roleLabel}</div>` : ''}
          </div>
          ${showAdminToggle ? `<button class="member-admin-toggle-btn" data-member-id="${member.id}">${adminToggleLabel}</button>` : ''}
        </div>
      `;
    }).join('');

    pageContainer.innerHTML = `
      <div class="group-info-page">
        <div class="group-info-header">
          <button class="back-button" aria-label="Back to group">←</button>
          <h1>Group Info</h1>
          <div style="width: 32px;"></div>
        </div>

        <div class="group-info-content">
          <div class="group-avatar-section">
            <div class="group-avatar-large" id="group-avatar-large">${renderCommunityAvatar(group.avatar, group.name)}</div>
            ${isAdmin ? `<button class="edit-avatar-button" id="edit-avatar-button">Change Photo</button>` : ''}
          </div>

          <div class="group-details-section">
            <div class="detail-item">
              <div class="detail-label">Group Name</div>
              <div class="detail-value" id="group-name-value">${group.name}</div>
              ${isAdmin ? `<button class="detail-edit-button" id="edit-name-button">Edit</button>` : ''}
            </div>

            <div class="detail-item">
              <div class="detail-label">Description</div>
              <div class="detail-value" id="group-description-value">${group.description || 'No description'}</div>
              ${isAdmin ? `<button class="detail-edit-button" id="edit-description-button">Edit</button>` : ''}
            </div>
          </div>

          <button class="share-group-button" id="share-group-button">Share Group</button>

          <div class="members-section">
            <div class="section-title">Members (${group.memberCount})</div>
            ${canManageMembers ? `<button class="add-members-button" id="add-members-button">+ Add Members</button>` : ''}
            ${(group.visibility === 'private' && canManageMembers) ? `<button class="join-requests-button" id="join-requests-button">Join Requests${pendingRequestCount > 0 ? ` (${pendingRequestCount})` : ''}</button>` : ''}
            <div class="members-list" id="members-list">
              ${membersList}
            </div>
          </div>

          <button class="leave-group-button" id="leave-group-button">Leave Group</button>
        </div>
      </div>
    `;

    // Back button
    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = `/group/${groupId}`;
    });

    // Edit name (admin/owner only)
    const editNameButton = document.getElementById('edit-name-button');
    if (editNameButton) {
      editNameButton.addEventListener('click', () => {
        showEditNameDialog(groupId, group.name);
      });
    }

    // Edit description (admin/owner only)
    const editDescriptionButton = document.getElementById('edit-description-button');
    if (editDescriptionButton) {
      editDescriptionButton.addEventListener('click', () => {
        showEditDescriptionDialog(groupId, group.description);
      });
    }

    // Change avatar (admin/owner only)
    const editAvatarButton = document.getElementById('edit-avatar-button');
    if (editAvatarButton) {
      editAvatarButton.addEventListener('click', () => {
        showAvatarPickerDialog(groupId, group);
      });
    }

    // Share Group (all members)
    document.getElementById('share-group-button').addEventListener('click', () => {
      shareLink(group.name, `${window.location.origin}/?group=${groupId}`);
    });

    // Add members
    const addMembersButton = document.getElementById('add-members-button');
    if (addMembersButton) {
      addMembersButton.addEventListener('click', () => {
        window.location.hash = `/group/${groupId}/add-members`;
      });
    }

    // Join Requests
    const joinRequestsButton = document.getElementById('join-requests-button');
    if (joinRequestsButton) {
      joinRequestsButton.addEventListener('click', () => {
        window.location.hash = `/group/${groupId}/join-requests`;
      });
    }

    // Leave group
    document.getElementById('leave-group-button').addEventListener('click', () => {
      showLeaveGroupDialog(groupId, group.name);
    });

    // Make Admin / Remove Admin (owner only)
    document.querySelectorAll('.member-admin-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const memberId = btn.dataset.memberId;
        toggleGroupAdmin(groupId, memberId);
      });
    });

    // Member long-press handlers (owner/admin only)
    if (canManageMembers) {
      document.querySelectorAll('.group-member-item').forEach(item => {
        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const memberId = item.dataset.memberId;
          showRemoveMemberConfirmation(groupId, memberId, group.members.find(m => m.id === memberId));
        });
      });
    }

    if (SHOT_ADMIN_TOGGLE && !shotAdminToggleFired) {
      shotAdminToggleFired = true;
      const toggleBtn = document.querySelector('.member-admin-toggle-btn');
      if (toggleBtn) toggleBtn.click();
    }

    if (SHOT_DESC_EDIT && !shotDescEditFired) {
      shotDescEditFired = true;
      const editBtn = document.getElementById('edit-description-button');
      if (editBtn) {
        editBtn.click();
        const textarea = document.getElementById('edit-desc-input');
        if (textarea) {
          textarea.value = 'Shot desc edit check';
          document.getElementById('save-edit-desc').click();
        }
      }
    }
  }

  // Promote/demote a member between 'member' and 'admin' (owner only)
  async function toggleGroupAdmin(groupId, memberId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const myRole = (group.members.find(m => m.id === 'user_self') || {}).role;
    if (myRole !== 'owner') return;

    const member = group.members.find(m => m.id === memberId);
    if (!member || member.role === 'owner') return;

    const newRole = member.role === 'admin' ? 'member' : 'admin';

    try {
      if (group.source === 'server') {
        const response = await fetch(`/api/groups/${groupId}/members/${memberId}/role`, {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            'x-usernode-token': localStorage.getItem('usernode-token')
          },
          body: JSON.stringify({ role: newRole })
        });

        if (!response.ok) {
          throw new Error('Failed to update member role');
        }
      }

      member.role = newRole;
      renderGroupInfoPage(groupId);
      showToast(
        newRole === 'admin' ? `${member.username} is now an admin` : `${member.username} is no longer an admin`,
        { type: 'success' }
      );
    } catch (error) {
      console.error(error);
      showToast('Failed to update member role', { type: 'error' });
    }
  }

  // Show edit name dialog - stays on chat page
  function showEditNameDialog(groupId, currentName) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>Edit Group Name</h2>
      </div>
      <div class="dialog-content">
        <input type="text" id="edit-name-input" class="form-input" value="${currentName}" maxlength="50" />
        <div class="char-count"><span id="name-char-count">0</span>/50</div>
        <div class="validation-error" id="edit-name-error"></div>
      </div>
      <div class="dialog-footer">
        <button class="button-secondary" id="cancel-edit-name">Cancel</button>
        <button class="button-primary" id="save-edit-name">Save</button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    const input = document.getElementById('edit-name-input');
    const charCount = document.getElementById('name-char-count');
    const errorEl = document.getElementById('edit-name-error');

    input.addEventListener('input', () => {
      charCount.textContent = input.value.length;
    });

    charCount.textContent = currentName.length;

    document.getElementById('cancel-edit-name').addEventListener('click', () => {
      overlay.remove();
    });

    document.getElementById('save-edit-name').addEventListener('click', async () => {
      const newName = input.value.trim();
      if (!newName) {
        errorEl.textContent = 'Group name is required';
        return;
      }

      try {
        if (group.source === 'server') {
          const response = await fetch(`/api/groups/${groupId}/name`, {
            method: 'PUT',
            headers: {
              'content-type': 'application/json',
              'x-usernode-token': localStorage.getItem('usernode-token')
            },
            body: JSON.stringify({ name: newName })
          });

          if (!response.ok) {
            const error = await response.json();
            errorEl.textContent = error.error || 'Failed to update group name';
            return;
          }
        }

        group.name = newName;

        // Update Messages list data
        const conversation = conversations.find(c => c.groupId === groupId);
        if (conversation) {
          conversation.name = newName;
        }

        overlay.remove();
        showToast('Group name updated', { type: 'success' });

        if (document.querySelector('.group-info-page')) {
          renderGroupInfoPage(groupId);
        } else {
          // Update header immediately without navigation
          const headerUsername = document.querySelector('.header-username');
          if (headerUsername) {
            headerUsername.textContent = newName;
          }
        }
        if (document.querySelector('.messages-page')) {
          renderMessagesPage(); // Update messages list preview
        }
      } catch (error) {
        errorEl.textContent = 'Failed to update group name';
        console.error(error);
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    input.focus();
  }

  // Show edit description dialog - stays on chat page
  function showEditDescriptionDialog(groupId, currentDescription) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>Edit Description</h2>
      </div>
      <div class="dialog-content">
        <textarea id="edit-desc-input" class="form-input" maxlength="250" placeholder="Add a description...">${currentDescription || ''}</textarea>
        <div class="char-count"><span id="desc-char-count">0</span>/250</div>
        <div class="validation-error" id="edit-desc-error"></div>
      </div>
      <div class="dialog-footer">
        <button class="button-secondary" id="cancel-edit-desc">Cancel</button>
        <button class="button-primary" id="save-edit-desc">Save</button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    const textarea = document.getElementById('edit-desc-input');
    const charCount = document.getElementById('desc-char-count');

    textarea.addEventListener('input', () => {
      charCount.textContent = textarea.value.length;
    });

    charCount.textContent = (currentDescription || '').length;

    document.getElementById('cancel-edit-desc').addEventListener('click', () => {
      overlay.remove();
    });

    document.getElementById('save-edit-desc').addEventListener('click', async () => {
      const newDesc = textarea.value.trim();

      try {
        if (group.source === 'server') {
          const response = await fetch(`/api/groups/${groupId}/description`, {
            method: 'PUT',
            headers: {
              'content-type': 'application/json',
              'x-usernode-token': localStorage.getItem('usernode-token')
            },
            body: JSON.stringify({ description: newDesc })
          });

          if (!response.ok) {
            throw new Error('Failed to update description');
          }
        }

        group.description = newDesc;

        overlay.remove();
        showToast('Description updated', { type: 'success' });

        if (document.querySelector('.group-info-page')) {
          renderGroupInfoPage(groupId);
        }
      } catch (error) {
        document.getElementById('edit-desc-error').textContent = 'Failed to update description';
        console.error(error);
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    textarea.focus();
  }

  // Show avatar picker dialog - stays on chat page
  function showAvatarPickerDialog(groupId, groupData) {
    showAvatarUploadDialog({
      title: 'Change Group Photo',
      currentAvatarHtml: renderCommunityAvatar(groupData.avatar, groupData.name),
      onSave: async (file) => {
        const uploaded = await uploadAvatarPhoto(file);
        const group = groups.find(g => g.id === groupId);
        if (!group) throw new Error('Group not found.');
        const oldImageId = group.avatarImageId || null;

        if (group.source === 'server') {
          const response = await fetch(`/api/groups/${groupId}/avatar`, {
            method: 'PUT',
            headers: authHeaders({ 'content-type': 'application/json' }),
            body: JSON.stringify({ avatarUrl: uploaded.url, avatarImageId: uploaded.id })
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || 'Failed to update avatar.');
          }
        }

        group.avatar = uploaded.url;
        group.avatarImageId = uploaded.id;

        // Update Messages list data
        const conversation = conversations.find(c => c.groupId === groupId);
        if (conversation) {
          conversation.avatar = uploaded.url;
        }

        showToast('Photo updated', { type: 'success' });

        if (document.querySelector('.group-info-page')) {
          renderGroupInfoPage(groupId);
        } else {
          // Update header avatar immediately without navigation
          const headerAvatar = document.querySelector('.conversation-avatar-header');
          if (headerAvatar) {
            headerAvatar.innerHTML = renderCommunityAvatar(uploaded.url, group.name);
          }
        }
        if (document.querySelector('.messages-page')) {
          renderMessagesPage(); // Update messages list preview
        }

        if (oldImageId && window.usernode && window.usernode.deleteFile) {
          window.usernode.deleteFile(oldImageId).catch(() => {});
        }
      }
    });
  }

  // Show add members screen
  function renderAddMembersPage(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) {
      window.location.hash = '/messages';
      return;
    }

    let selectedMembers = [];

    const usersList = suggestedUsers.filter(u => !group.members.find(m => m.id === u.id))
      .map(user => renderUserListItemHtml(user, { selectable: true })).join('');

    pageContainer.innerHTML = `
      <div class="add-members-page">
        <div class="create-group-header">
          <button class="back-button" aria-label="Back to group info">←</button>
          <h1>Add Members</h1>
        </div>

        <div class="form-section">
          <input type="text" class="form-input" placeholder="🔍 Search username" id="search-members-add" />
        </div>

        <div class="members-chips-container" id="members-chips-container-add"></div>

        <div class="suggested-users-section-create">
          <div class="section-header">Available Users</div>
          <div class="users-list" id="suggested-users-list-add">
            ${usersList}
          </div>
        </div>

        <div class="validation-error" id="add-members-error"></div>

        <button class="create-group-button" id="add-members-button">Add Members</button>
      </div>
    `;

    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = `/group/${groupId}/info`;
    });

    const searchInput = document.getElementById('search-members-add');
    const membersChipsContainer = document.getElementById('members-chips-container-add');
    const suggestedList = document.getElementById('suggested-users-list-add');
    const addBtn = document.getElementById('add-members-button');
    const errorEl = document.getElementById('add-members-error');

    function renderChips() {
      if (selectedMembers.length === 0) {
        membersChipsContainer.innerHTML = '';
        return;
      }

      membersChipsContainer.innerHTML = selectedMembers.map(user => `
        <div class="member-chip">
          <div class="chip-avatar">${renderCommunityAvatar(user.avatar, user.username)}</div>
          <span>${user.username}</span>
          <button class="chip-remove" data-user-id="${user.id}" aria-label="Remove ${user.username}">×</button>
        </div>
      `).join('');

      document.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const userId = btn.dataset.userId;
          selectedMembers = selectedMembers.filter(u => u.id !== userId);
          renderChips();
          filterAndDisplay();
        });
      });
    }

    function toggleUser(userId) {
      const user = suggestedUsers.find(u => u.id === userId);
      if (!user) return;

      if (selectedMembers.find(u => u.id === userId)) {
        selectedMembers = selectedMembers.filter(u => u.id !== userId);
      } else {
        selectedMembers.push(user);
      }

      renderChips();
      filterAndDisplay();
      errorEl.innerHTML = '';
    }

    function filterAndDisplay() {
      const query = searchInput.value.toLowerCase();
      const filtered = suggestedUsers.filter(u =>
        !group.members.find(m => m.id === u.id) &&
        (u.username.toLowerCase().includes(query) || (u.walletAddress && u.walletAddress.toLowerCase().includes(query)))
      );

      suggestedList.innerHTML = filtered.map(user => renderUserListItemHtml(user, {
        selectable: true,
        selected: !!selectedMembers.find(m => m.id === user.id)
      })).join('');

      document.querySelectorAll('.suggested-user-item').forEach(item => {
        item.addEventListener('click', () => {
          const userId = item.dataset.userId;
          toggleUser(userId);
        });
      });
    }

    searchInput.addEventListener('input', filterAndDisplay);

    document.querySelectorAll('.suggested-user-item').forEach(item => {
      item.addEventListener('click', () => {
        const userId = item.dataset.userId;
        toggleUser(userId);
      });
    });

    // Refresh the directory each time this screen opens.
    fetchSuggestedUsers().then(filterAndDisplay);

    addBtn.addEventListener('click', async () => {
      if (selectedMembers.length === 0) {
        errorEl.textContent = 'Select at least 1 member';
        return;
      }

      try {
        // Fixture (demo) groups aren't in the database, so only server-backed
        // groups make the real membership call — fixtures stay optimistic/local.
        if (group.source === 'server') {
          const response = await fetch(`/api/groups/${groupId}/members`, {
            method: 'POST',
            headers: authHeaders({ 'content-type': 'application/json' }),
            body: JSON.stringify({ members: selectedMembers.map(u => ({ id: u.id, username: u.username })) })
          });

          if (!response.ok) {
            throw new Error('Failed to add members');
          }
        }

        // Add members to group
        group.members.push(...selectedMembers.map(member => ({ ...member, role: 'member' })));
        group.memberCount = group.members.length;

        window.location.hash = `/group/${groupId}/info`;
        showToast(`Added ${selectedMembers.length} member(s)`, { type: 'success' });
      } catch (error) {
        errorEl.textContent = 'Failed to add members';
        console.error(error);
      }
    });
  }

  // Show remove member confirmation - stays on chat page
  function showRemoveMemberConfirmation(groupId, memberId, member) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>Remove Member</h2>
      </div>
      <div class="dialog-content">
        <div class="member-confirm-card">
          <div class="member-avatar">${renderCommunityAvatar(member.avatar, member.username)}</div>
          <div class="member-confirm-info">
            <div class="member-name">${member.username}</div>
            <div class="member-text">Remove ${member.username}? They can rejoin with an invite link.</div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="button-secondary" id="cancel-remove">Cancel</button>
        <button class="button-danger" id="confirm-remove">Remove</button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    document.getElementById('cancel-remove').addEventListener('click', () => {
      overlay.remove();
    });

    document.getElementById('confirm-remove').addEventListener('click', async () => {
      try {
        const group = groups.find(g => g.id === groupId);

        if (group.source === 'server') {
          const response = await fetch(`/api/groups/${groupId}/members/${memberId}`, {
            method: 'DELETE',
            headers: {
              'x-usernode-token': localStorage.getItem('usernode-token')
            }
          });

          if (!response.ok) {
            throw new Error('Failed to remove member');
          }
        }

        group.members = group.members.filter(m => m.id !== memberId);
        group.memberCount = group.members.length;

        // Update header member count
        const headerMemberCount = document.querySelector('.header-member-count');
        if (headerMemberCount) {
          headerMemberCount.textContent = `${group.memberCount} members`;
        }

        overlay.remove();
        showToast(`${member.username} removed`, { type: 'success' });
        renderGroupConversationPage(groupId); // Re-render to show system message
      } catch (error) {
        console.error(error);
        showToast('Failed to remove member', { type: 'error' });
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  // Show leave group confirmation - navigates back to messages
  function showLeaveGroupDialog(groupId, groupName) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>Leave Group</h2>
      </div>
      <div class="dialog-content">
        <p>Leave ${groupName}? You can rejoin with an invite link.</p>
      </div>
      <div class="dialog-footer">
        <button class="button-secondary" id="cancel-leave">Cancel</button>
        <button class="button-danger" id="confirm-leave">Leave</button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    document.getElementById('cancel-leave').addEventListener('click', () => {
      overlay.remove();
    });

    document.getElementById('confirm-leave').addEventListener('click', async () => {
      const success = await performLeaveGroup(groupId);
      if (success) {
        overlay.remove();
        // Setting an unchanged hash doesn't fire 'hashchange' (e.g. leaving
        // while already on the Messages list), so render directly rather
        // than relying on the navigation listener.
        const alreadyOnMessages = window.location.hash === '#/messages' || window.location.hash === '';
        window.location.hash = '/messages';
        if (alreadyOnMessages) renderMessagesPage();
        showToast('You left the group', { type: 'success' });
      } else {
        showToast('Failed to leave group', { type: 'error' });
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  // Render Join Requests page (owner/admin only)
  function renderJoinRequestsPage(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) {
      window.location.hash = '/messages';
      return;
    }

    const myRole = (group.members.find(m => m.id === 'user_self') || {}).role;
    if (myRole !== 'owner' && myRole !== 'admin') {
      window.location.hash = `/group/${groupId}/info`;
      return;
    }

    const joinRequests = group.joinRequests || [];
    const requestsList = joinRequests.length > 0 ? joinRequests.map(req => `
      <div class="join-request-item" data-request-user-id="${req.userId}">
        <div class="member-avatar">${req.username.charAt(0).toUpperCase()}</div>
        <div class="member-info">
          <div class="member-name">${req.username}</div>
        </div>
        <div class="join-request-actions">
          <button class="button-primary join-request-approve" data-request-user-id="${req.userId}">Approve</button>
          <button class="button-secondary join-request-deny" data-request-user-id="${req.userId}">Deny</button>
        </div>
      </div>
    `).join('') : '<div class="empty-state"><div class="empty-message">No pending requests</div></div>';

    pageContainer.innerHTML = `
      <div class="join-requests-page">
        <div class="group-info-header">
          <button class="back-button" aria-label="Back to group info">←</button>
          <h1>Join Requests</h1>
          <div style="width: 32px;"></div>
        </div>
        <div class="join-requests-list">
          ${requestsList}
        </div>
      </div>
    `;

    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = `/group/${groupId}/info`;
    });

    document.querySelectorAll('.join-request-approve').forEach(btn => {
      btn.addEventListener('click', () => {
        approveJoinRequest(groupId, btn.dataset.requestUserId);
      });
    });

    document.querySelectorAll('.join-request-deny').forEach(btn => {
      btn.addEventListener('click', () => {
        denyJoinRequest(groupId, btn.dataset.requestUserId);
      });
    });
  }

  // Approve a pending join request - adds the requester as a member
  async function approveJoinRequest(groupId, userId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const request = (group.joinRequests || []).find(r => r.userId === userId);
    if (!request) return;

    try {
      const response = await fetch(`/api/groups/${groupId}/join-requests/${userId}/approve`, {
        method: 'POST',
        headers: {
          'x-usernode-token': localStorage.getItem('usernode-token')
        }
      });

      if (!response.ok) {
        throw new Error('Failed to approve request');
      }

      group.members.push({ id: request.userId, username: request.username, role: 'member' });
      group.memberCount = group.members.length;
      group.joinRequests = group.joinRequests.filter(r => r.userId !== userId);

      group.messages.push({
        id: 'msg_' + Date.now(),
        senderId: 'system',
        senderName: 'System',
        text: `${request.username} joined the group.`,
        timestamp: Date.now(),
        isOutgoing: false,
        isSystemMessage: true
      });

      showToast(`${request.username} approved`, { type: 'success' });
      renderJoinRequestsPage(groupId);
    } catch (error) {
      console.error(error);
      showToast('Failed to approve request', { type: 'error' });
    }
  }

  // Deny a pending join request - just clears it
  async function denyJoinRequest(groupId, userId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const request = (group.joinRequests || []).find(r => r.userId === userId);
    if (!request) return;

    try {
      const response = await fetch(`/api/groups/${groupId}/join-requests/${userId}/deny`, {
        method: 'POST',
        headers: {
          'x-usernode-token': localStorage.getItem('usernode-token')
        }
      });

      if (!response.ok) {
        throw new Error('Failed to deny request');
      }

      group.joinRequests = group.joinRequests.filter(r => r.userId !== userId);

      showToast(`Request from ${request.username} denied`, { type: 'success' });
      renderJoinRequestsPage(groupId);
    } catch (error) {
      console.error(error);
      showToast('Failed to deny request', { type: 'error' });
    }
  }

  // Best-effort delivery of an already-optimistically-rendered channel post.
  // The card is already on screen from the local unshift in publishPost --
  // this just makes it actually reach the server (and survive a reload),
  // mirroring deliverThreadMessage's DM/group shape.
  function deliverPost(channelId, post, onFailure) {
    delete post.failed;
    // Screenshot-state: simulate a delivery failure deterministically instead
    // of actually breaking the network, so dapp.json can assert the "Failed
    // to send" indicator renders.
    if (SHOT_CHANNEL_SEND_FAIL) {
      post.failed = true;
      if (typeof onFailure === 'function') onFailure();
      return;
    }
    authFetch(`/api/messages/channel/${encodeURIComponent(channelId)}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id: post.id, text: post.text, imageUrl: post.imageUrl, imageId: post.imageId })
    }).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }).catch(error => {
      console.warn('Could not deliver channel post:', error);
      post.failed = true;
      if (typeof onFailure === 'function') onFailure();
    });
  }

  // Create a new channel
  // Publish a post to a channel
  function publishPost(channelId, text, image, onFailure) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel || channel.creatorId !== 'user_self') {
      return null;
    }

    const postId = 'post_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const timestamp = Date.now();

    const newPost = {
      id: postId,
      channelId: channelId,
      authorId: 'user_self',
      text: text,
      timestamp: timestamp,
      reactions: {},
      isPinned: false
    };

    if (image) {
      newPost.imageUrl = image.url;
      newPost.imageId = image.id;
    }

    channel.posts.unshift(newPost);

    deliverPost(channelId, newPost, onFailure);

    // Update last post in conversation
    const conv = conversations.find(c => c.type === 'channel' && c.channelId === channelId);
    if (conv) {
      conv.lastMessage = truncateText(messagePreviewText(newPost), 100);
      conv.timestamp = timestamp;
    }

    // Increment unread for followers (unless muted)
    Object.keys(channel.followers).forEach(userId => {
      if (userId !== 'user_self' && !channel.mutedByUsers[userId]) {
        const followerConv = conversations.find(c => c.type === 'channel' && c.channelId === channelId);
        if (followerConv) {
          followerConv.unreadCount++;
        }
      }
    });

    return postId;
  }

  // Follow a channel
  function followChannel(channelId) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;

    channel.followers['user_self'] = true;
    channel.followerCount++;

    const existingConv = conversations.find(c => c.type === 'channel' && c.channelId === channelId);
    if (!existingConv) {
      const newConversation = {
        id: 'conv_channel_' + channelId,
        type: 'channel',
        channelId: channelId,
        name: channel.name,
        avatar: channel.avatar,
        lastMessage: channel.posts[0] ? truncateText(messagePreviewText(channel.posts[0]), 100) : 'No posts yet',
        timestamp: channel.posts[0]?.timestamp || channel.createdAt,
        unreadCount: channel.posts.length,
        archived: false,
        pinned: false
      };
      conversations.unshift(newConversation);
    }

    // Best-effort, matching the optimistic-then-deliver pattern used by
    // publishPost -- the UI above already reflects the follow regardless.
    fetch(`/api/channels/${encodeURIComponent(channelId)}/follow`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' })
    }).catch(error => console.warn('Could not deliver channel follow:', error));
  }

  // Unfollow a channel
  function unfollowChannel(channelId) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;

    delete channel.followers['user_self'];
    channel.followerCount--;

    const conv = conversations.find(c => c.type === 'channel' && c.channelId === channelId);
    if (conv) {
      conv.archived = true;
      conv.hiddenFromInbox = true;
    }

    fetch(`/api/channels/${encodeURIComponent(channelId)}/follow`, {
      method: 'DELETE',
      headers: authHeaders()
    }).catch(error => console.warn('Could not deliver channel unfollow:', error));
  }

  // Toggle one emoji reaction on a post for the current user. Each emoji toggles
  // INDEPENDENTLY — a user can hold ❤️ and 🎉 on the same post at once — so the
  // heart button and the emoji picker never clobber each other's state.
  // Available to every viewer, follower or owner alike: no permission gate.
  function togglePostReaction(channelId, postId, emoji) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;

    const post = channel.posts.find(p => p.id === postId);
    if (!post) return;

    if (!post.reactions) post.reactions = {};
    if (!post.reactions[emoji]) post.reactions[emoji] = {};

    if (post.reactions[emoji]['user_self']) {
      delete post.reactions[emoji]['user_self'];
    } else {
      post.reactions[emoji]['user_self'] = true;
    }

    // A bucket that dropped to zero must not leave a "0" chip behind.
    if (Object.keys(post.reactions[emoji]).length === 0) {
      delete post.reactions[emoji];
    }
  }

  // Mute/unmute channel notifications; persists via the channel's own
  // conversation-list row so it survives reload.
  function toggleMuteChannel(channelId, isMuted) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;

    if (isMuted) {
      channel.mutedByUsers['user_self'] = true;
    } else {
      delete channel.mutedByUsers['user_self'];
    }

    const conv = conversations.find(c => c.type === 'channel' && c.channelId === channelId);
    if (conv) persistConversationState(conv.id, { muted: isMuted });
  }

  // Delete a post (owner only)
  function deletePost(channelId, postId) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel || channel.creatorId !== 'user_self') return;

    const postIndex = channel.posts.findIndex(p => p.id === postId);
    if (postIndex > -1) {
      channel.posts.splice(postIndex, 1);

      // Update conversation last message
      const conv = conversations.find(c => c.type === 'channel' && c.channelId === channelId);
      if (conv) {
        if (channel.posts.length > 0) {
          conv.lastMessage = truncateText(messagePreviewText(channel.posts[0]), 100);
          conv.timestamp = channel.posts[0].timestamp;
        } else {
          conv.lastMessage = 'No posts yet';
        }
      }
    }
  }

  // Delete a channel (owner only)
  async function deleteChannel(channelId) {
    const channelIndex = channels.findIndex(c => c.id === channelId);
    if (channelIndex > -1) {
      channels.splice(channelIndex, 1);
    }

    conversations = conversations.filter(c => !(c.type === 'channel' && c.channelId === channelId));

    try {
      const response = await fetch(`/api/channels/${encodeURIComponent(channelId)}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to delete channel');
      }
    } catch (error) {
      console.warn('Could not delete channel on server:', error);
    }
  }

  // Compact follower counts for the channel header: 12500 → "12.5K", 2000 → "2K".
  function formatFollowerCount(count) {
    const n = Number(count) || 0;
    if (n < 1000) return String(n);
    if (n < 1000000) {
      const thousands = n / 1000;
      const rounded = Math.round(thousands * 10) / 10;
      return (rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)) + 'K';
    }
    const millions = Math.round((n / 1000000) * 10) / 10;
    return (millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)) + 'M';
  }

  // The reaction chip strip for one post. Chips follow POST_REACTIONS order so
  // they hold still as counts change; an emoji with no reactions gets no chip.
  function postReactionChipsHTML(post) {
    return POST_REACTIONS.filter(emoji => reactionCount(post, emoji) > 0).map(emoji => {
      const mine = userReacted(post, emoji);
      return `
        <button class="post-reaction-chip ${mine ? 'is-mine' : ''}" data-post-id="${post.id}" data-emoji="${emoji}" aria-pressed="${mine ? 'true' : 'false'}" title="React with ${emoji}">
          <span class="chip-emoji">${emoji}</span><span class="chip-count">${reactionCount(post, emoji)}</span>
        </button>
      `;
    }).join('');
  }

  // The action row for one post: the ⋯ overflow menu and nothing else. Reacting
  // is a hold gesture on the card itself (see the long-press wiring in
  // renderChannelView) plus the chip strip above this row, and Forward lives
  // inside the ⋯ menu — so the row carries exactly one tap target.
  function postActionsHTML(post) {
    return `
      <button class="post-menu-button" data-post-id="${post.id}" title="More options" aria-label="More options">⋯</button>
    `;
  }

  // One post card: channel identity + relative time, the text, chips, actions.
  function postCardHTML(channel, post) {
    return `
      <article class="post-card" data-post-id="${post.id}">
        <div class="post-card-head">
          <div class="post-card-avatar">${renderCommunityAvatar(channel.avatar, channel.name)}</div>
          <div class="post-card-channel">${channel.name}</div>
          ${post.failed
            ? `<div class="post-card-time post-failed" data-retry-post-id="${post.id}">⚠️ Failed to send · Tap to retry</div>`
            : `<div class="post-card-time">${formatTimestamp(post.timestamp)}</div>`}
        </div>
        <div class="post-content${messageBubbleClass(post)}">${messageBodyHTML(post)}</div>
        <div class="post-reaction-chips">${postReactionChipsHTML(post)}</div>
        <div class="post-actions">${postActionsHTML(post)}</div>
      </article>
    `;
  }

  // Patch ONE card's reaction UI in place. A full renderChannelView() here would
  // rebuild the page and throw away scroll position on every tap, so reactions
  // deliberately never re-render the feed.
  function refreshPostReactions(channelId, postId) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;
    const post = channel.posts.find(p => p.id === postId);
    if (!post) return;

    const card = pageContainer.querySelector(`.post-card[data-post-id="${postId}"]`);
    if (!card) return;

    // Only the chip strip reflects reaction state now — the action row is a
    // fixed Forward + ⋯ pair, so it never needs repainting.
    const chips = card.querySelector('.post-reaction-chips');
    if (chips) chips.innerHTML = postReactionChipsHTML(post);
  }

  // Patch one card's text after an in-place edit, same in-place philosophy as
  // refreshPostReactions: no full re-render, no lost scroll position.
  function refreshPostContent(channelId, postId) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;
    const post = channel.posts.find(p => p.id === postId);
    if (!post) return;

    const card = pageContainer.querySelector(`.post-card[data-post-id="${postId}"]`);
    if (!card) return;

    const content = card.querySelector('.post-content');
    if (content) {
      content.innerHTML = messageBodyHTML(post);
      content.className = `post-content${messageBubbleClass(post)}`;
    }
  }

  // Message-level reactions reuse POST_REACTIONS/reactionCount/userReacted so
  // long-pressing a chat bubble feels like the same feature as reacting to a
  // post, not a parallel system with its own emoji set.
  function toggleMessageReaction(thread, messageId, emoji) {
    const msg = thread && thread.messages && thread.messages.find(m => m.id === messageId);
    if (!msg) return;

    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[emoji]) msg.reactions[emoji] = {};

    if (msg.reactions[emoji]['user_self']) {
      delete msg.reactions[emoji]['user_self'];
    } else {
      msg.reactions[emoji]['user_self'] = true;
    }

    if (Object.keys(msg.reactions[emoji]).length === 0) {
      delete msg.reactions[emoji];
    }
  }

  function messageReactionChipsHTML(msg) {
    return POST_REACTIONS.filter(emoji => reactionCount(msg, emoji) > 0).map(emoji => {
      const mine = userReacted(msg, emoji);
      return `
        <button class="message-reaction-chip ${mine ? 'is-mine' : ''}" data-message-id="${msg.id}" data-emoji="${emoji}" aria-pressed="${mine ? 'true' : 'false'}" title="React with ${emoji}">
          <span class="chip-emoji">${emoji}</span><span class="chip-count">${reactionCount(msg, emoji)}</span>
        </button>
      `;
    }).join('');
  }

  // Patch one message's reaction chip strip in place (mirrors refreshPostReactions)
  // so reacting never disturbs scroll position or an open picker/context menu.
  function refreshMessageReactions(thread, messageId) {
    const msg = thread && thread.messages && thread.messages.find(m => m.id === messageId);
    if (!msg) return;
    const chipsContainer = document.querySelector(`.message-reaction-chips[data-message-id="${messageId}"]`);
    if (chipsContainer) chipsContainer.innerHTML = messageReactionChipsHTML(msg);
  }

  // Render Channel View page
  async function renderChannelView(channelId, renderOptions) {
    const fromPublish = !!(renderOptions && renderOptions.fromPublish);
    const fromSend = !!(renderOptions && renderOptions.fromSend);
    let channel = channels.find(c => c.id === channelId);

    if (!channel) {
      // Not followed yet -- reached via a Discover click. discoverChannels
      // items only carry `memberCount`; normalize the fields the rest of
      // this view (and postCardHTML) expect from a real `channels` entry.
      const discoverChannel = discoverChannels.find(c => c.id === channelId);
      if (discoverChannel) {
        channel = Object.assign({
          followers: {},
          followerCount: discoverChannel.memberCount || 0,
          posts: [],
          creatorId: null,
          mutedByUsers: {},
          admins: []
        }, discoverChannel);
      }
    }
    if (!channel) {
      window.location.hash = '/messages';
      return;
    }

    await hydrateChannelPosts(channelId, channel);
    padForShotLongThread(channel.posts, false, (ts, n) => ({
      id: `shot-pad-channel-${n}`, channelId: channelId, authorId: channel.creatorId,
      text: `Filler post ${n}`, timestamp: ts, reactions: {}, isPinned: false
    }));

    const isOwner = channel.creatorId === 'user_self';
    const isAdmin = isCurrentUserChannelAdmin(channel);
    const isFollowing = !!channel.followers['user_self'];
    // A menu with Copy Link/Mute/Unfollow only makes sense once the viewer
    // actually has a relationship to the channel (owns it or follows it) --
    // a bare Discover preview has neither.
    const canShowMenu = isOwner || isAdmin || isFollowing;

    // channel.posts is newest-first in storage (publishPost unshifts, and the
    // lastMessage/unread logic elsewhere reads posts[0] as "the newest") — but
    // the feed now DISPLAYS oldest-first, same chronological order as DM/group
    // chat, so the newest post lands at the bottom like a chat thread.
    const postsList = channel.posts.slice().reverse().map(post => postCardHTML(channel, post)).join('');

    pageContainer.innerHTML = `
      <div class="conversation-page channel-page">
        <div class="conversation-page-header">
          <button class="back-button" aria-label="Back to messages">←</button>
          <div class="conversation-header-info group-header-info" id="channel-header-info-${channelId}">
            <div class="conversation-avatar-header">${renderCommunityAvatar(channel.avatar, channel.name)}</div>
            <div class="header-text">
              <div class="header-username">${channel.name}</div>
              <div class="header-member-count">${formatFollowerCount(channel.followerCount)} followers</div>
            </div>
          </div>
          ${(!isFollowing && !isOwner) ? `<button class="channel-follow-pill" aria-label="Follow channel">Follow</button>` : ''}
          ${canShowMenu ? `<button class="menu-button" aria-label="More options">⋮</button>` : ''}
        </div>
        <div class="messages-area">
          <div class="channel-feed messages-container">
            ${postsList || `
              <div class="empty-state channel-empty-state">
                <div class="channel-empty-icon" aria-hidden="true">📭</div>
                <div class="channel-empty-title">No posts yet</div>
                <div class="channel-empty-hint">${isOwner ? 'Publish your first post below.' : 'Check back soon for updates.'}</div>
              </div>
            `}
          </div>
          ${scrollToLatestFabHTML()}
        </div>
        ${isOwner ? `
          <div class="channel-footer">
            <div class="composer-container chat-composer">
              <div class="pending-image-bar" style="display: none;">
                <img class="pending-image-thumb" alt="Selected image preview" />
                <span class="pending-image-status">Uploading…</span>
                <button class="pending-image-remove" aria-label="Remove image">✕</button>
              </div>
              <div class="composer-input-shell">
                <textarea class="composer-input" placeholder="What's happening?" rows="1"></textarea>
                <button class="attach-image-button" type="button" aria-label="Add image">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M21.44 11.05l-9.19 9.19a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.19 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.49"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <input type="file" class="attach-image-input" accept="image/png,image/jpeg,image/gif,image/webp" style="display: none;" />
              </div>
              <button class="publish-button" type="button" aria-label="Publish">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="currentColor"/>
                </svg>
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Back button handler. Returns to Discover when this channel was opened
    // from a Discover card (or an invite link), the Create menu when opened
    // from its managed-channels list, otherwise falls back to Messages.
    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = groupChannelBackTarget;
    });

    // Menu button handler
    const menuButton = document.querySelector('.menu-button');
    if (menuButton) {
      menuButton.addEventListener('click', () => {
        showChannelMenu(channelId, channel, isOwner, isAdmin);
      });
    }

    // Header Follow pill — the bottom "Following" strip is gone; Unfollow still
    // lives in the ⋮ menu, so followers need no pill at all.
    const followPill = document.querySelector('.channel-follow-pill');
    if (followPill) {
      followPill.addEventListener('click', () => {
        if (channels.some(c => c.id === channelId)) {
          followChannel(channelId);
        } else {
          followDiscoverChannel(channelId);
        }
        showToast('Following channel', { type: 'success' });
        renderChannelView(channelId);
      });
    }

    const feed = document.querySelector('.channel-feed');

    // Scroll to the latest post on open, and keep the feed pinned there while
    // any post images are still decoding — same behavior as DM/group threads.
    // The screenshot deep link parks the feed at the top so the FAB is visible —
    // but after PUBLISHING we always jump to the bottom so the owner sees the
    // post they just wrote.
    const channelRoot = pageContainer.querySelector('.conversation-page');
    const parkedAtBottom = !(SHOT_SCROLL_FAB && !fromPublish);
    setTimeout(() => {
      if (feed) {
        feed.scrollTop = parkedAtBottom ? feed.scrollHeight : 0;
        keepThreadPinnedThroughImageLoads(feed, parkedAtBottom);
      }
    }, 0);

    // Floating "jump to newest post" button — reuses the same FAB component
    // and scroll logic as the DM/group chat views.
    setupScrollToLatestFab(channelRoot);

    // Emoji picker state — at most one open at a time, scoped to this render.
    let openPickerPostId = null;
    let pickerDismissHandlers = null;

    function closeReactionPicker() {
      const existing = feed && feed.querySelector('.reaction-picker');
      if (existing) existing.remove();
      openPickerPostId = null;
      if (pickerDismissHandlers) {
        document.removeEventListener('click', pickerDismissHandlers.onDocClick, true);
        document.removeEventListener('keydown', pickerDismissHandlers.onKeyDown);
        pickerDismissHandlers = null;
      }
    }

    // Commit one emoji from the picker. Shared by the touch and the mouse paths
    // so both do exactly the same thing in the same order.
    function commitPickerReaction(postId, emoji) {
      togglePostReaction(channelId, postId, emoji);
      closeReactionPicker();
      refreshPostReactions(channelId, postId);
    }

    function openReactionPicker(postId) {
      if (openPickerPostId === postId) {
        closeReactionPicker();
        return;
      }
      closeReactionPicker();

      const card = feed && feed.querySelector(`.post-card[data-post-id="${postId}"]`);
      if (!card) return;

      const picker = document.createElement('div');
      picker.className = 'reaction-picker';
      picker.setAttribute('role', 'menu');
      picker.innerHTML = POST_REACTIONS.map(emoji => `
        <button class="reaction-picker-option" data-post-id="${postId}" data-emoji="${emoji}" role="menuitem" aria-label="React with ${emoji}">${emoji}</button>
      `).join('');
      card.appendChild(picker);
      openPickerPostId = postId;

      // React on touchstart, not on the click that a browser only synthesises
      // after touchend (and after its own tap-delay heuristics). Waiting for
      // that click is what made picking an emoji feel laggy, and any browser
      // that decided the touch was part of a scroll swallowed it outright, so
      // some taps did nothing at all. preventDefault() suppresses the trailing
      // click so the mouse path below can't double-toggle.
      picker.addEventListener('touchstart', (e) => {
        const option = e.target.closest('.reaction-picker-option');
        if (!option) return;
        e.preventDefault();
        e.stopPropagation();
        commitPickerReaction(option.dataset.postId, option.dataset.emoji);
      }, { passive: false });

      const onDocClick = (e) => {
        // Ignore clicks anywhere on the card that owns this picker. Releasing
        // the long-press that opened it fires a trailing click right there, and
        // treating that as "clicked outside" would slam the picker shut the
        // instant the finger lifted.
        if (e.target.closest(`.post-card[data-post-id="${postId}"]`)) return;
        closeReactionPicker();
      };
      const onKeyDown = (e) => {
        if (e.key === 'Escape') closeReactionPicker();
      };
      pickerDismissHandlers = { onDocClick, onKeyDown };
      // Registered async so the click that opened the picker doesn't close it.
      setTimeout(() => {
        if (!pickerDismissHandlers) return;
        document.addEventListener('click', onDocClick, true);
        document.addEventListener('keydown', onKeyDown);
      }, 0);
    }

    // One delegated listener for every post-level action.
    if (feed) {
      feed.addEventListener('click', (e) => {
        const chip = e.target.closest('.post-reaction-chip');
        if (chip) {
          e.stopPropagation();
          togglePostReaction(channelId, chip.dataset.postId, chip.dataset.emoji);
          refreshPostReactions(channelId, chip.dataset.postId);
          return;
        }

        const pickerOption = e.target.closest('.reaction-picker-option');
        if (pickerOption) {
          e.stopPropagation();
          commitPickerReaction(pickerOption.dataset.postId, pickerOption.dataset.emoji);
          return;
        }

        const menuBtn = e.target.closest('.post-menu-button');
        if (menuBtn) {
          e.stopPropagation();
          closeReactionPicker();
          showPostMenu(channelId, menuBtn.dataset.postId, isOwner);
          return;
        }

        const retryEl = e.target.closest('[data-retry-post-id]');
        if (retryEl) {
          e.stopPropagation();
          const post = channel.posts.find(p => p.id === retryEl.dataset.retryPostId);
          if (!post) return;
          deliverPost(channelId, post, () => renderChannelView(channelId));
          renderChannelView(channelId);
          return;
        }
      });

      // Long-press a post card to open the reaction picker. This is now the ONLY
      // way to add a reaction (the action row holds just Forward and ⋯), and it
      // mirrors setupMessageLongPress's hold-to-act gesture on DM/group bubbles,
      // so the whole app reacts to a hold the same way.
      // Shorter than the 350ms used on chat bubbles: reacting to a post is now
      // hold-only, so the hold is the whole interaction and it needs to feel
      // immediate. The 8px move threshold below still keeps a scroll from
      // reading as a hold.
      const POST_LONG_PRESS_DURATION = 280;
      feed.querySelectorAll('.post-card').forEach(card => {
        const cardPostId = card.dataset.postId;
        let longPressTimer = null;
        let startPos = null;
        let lastWasTouch = false;

        const isOnOwnControl = (target) => !!target.closest('.post-actions, .reaction-picker, .post-reaction-chips');

        const startPress = (x, y) => {
          startPos = { x, y };
          longPressTimer = setTimeout(() => {
            longPressTimer = null;
            // The trailing click from releasing the hold is handled by
            // openReactionPicker's dismiss listener, which ignores clicks on
            // the card that owns the picker. Nothing is swallowed at document
            // level here: an armed one-shot click-eater would go on to eat the
            // user's NEXT real tap (an emoji, the ⋯ button) whenever the
            // release click never arrived.
            openReactionPicker(cardPostId);
          }, POST_LONG_PRESS_DURATION);
        };
        const cancelPress = () => {
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        };
        const trackMove = (x, y) => {
          if (!longPressTimer || !startPos) return;
          const dx = x - startPos.x;
          const dy = y - startPos.y;
          if (Math.sqrt(dx * dx + dy * dy) > 8) cancelPress();
        };

        card.addEventListener('mousedown', (e) => {
          if (lastWasTouch || isOnOwnControl(e.target)) return;
          startPress(e.clientX, e.clientY);
        });
        card.addEventListener('mousemove', (e) => trackMove(e.clientX, e.clientY));
        card.addEventListener('mouseup', cancelPress);
        card.addEventListener('mouseleave', cancelPress);

        card.addEventListener('touchstart', (e) => {
          lastWasTouch = true;
          if (isOnOwnControl(e.target)) return;
          const touch = e.touches[0];
          if (touch) startPress(touch.clientX, touch.clientY);
        });
        card.addEventListener('touchmove', (e) => {
          const touch = e.touches[0];
          if (touch) trackMove(touch.clientX, touch.clientY);
        });
        card.addEventListener('touchend', () => {
          cancelPress();
          setTimeout(() => { lastWasTouch = false; }, 100);
        });
      });
    }

    // Composer handlers (owner only)
    if (isOwner) {
      const composerInput = document.querySelector('.composer-input');
      const publishButton = document.querySelector('.publish-button');
      const attachButton = document.querySelector('.attach-image-button');
      const attachInput = document.querySelector('.attach-image-input');
      const pendingBar = document.querySelector('.pending-image-bar');
      const pendingThumb = document.querySelector('.pending-image-thumb');
      const pendingStatus = document.querySelector('.pending-image-status');
      const pendingRemove = document.querySelector('.pending-image-remove');

      const imageAttachment = setupImageAttachment({
        attachButton, attachInput, pendingBar, pendingThumb, pendingStatus, pendingRemove,
        actionButton: publishButton
      });

      function autoExpandTextarea() {
        composerInput.style.height = 'auto';
        const newHeight = Math.min(composerInput.scrollHeight, 120);
        composerInput.style.height = newHeight + 'px';
      }

      composerInput.addEventListener('input', autoExpandTextarea);

      publishButton.addEventListener('click', () => {
        const text = composerInput.value.trim();
        const readyImage = imageAttachment.getReadyImage();
        // An image on its own is a valid post - text is optional, same as DMs/groups
        if (!text && !readyImage) return;

        publishPost(channelId, text, readyImage, () => renderChannelView(channelId));
        composerInput.value = '';
        composerInput.style.height = '40px';
        imageAttachment.clearPendingImage();
        renderChannelView(channelId, { fromPublish: true, fromSend: true });
        showToast('Post published', { type: 'success' });
      });

      // Must stay last: the publish click above re-renders this page underneath us.
      if (SHOT_CHANNEL_SEND_STAY && !fromSend) sendShotMessage(document, '.publish-button');
      if (SHOT_CHANNEL_SEND_FAIL && !fromSend) sendShotMessage(document, '.publish-button');
    }

    // Image lightbox for post images - the feed is the channel's own scroll
    // container, not the DM/group `.messages-container`.
    setupImageLightbox('.channel-feed');

    // Screenshot-state: drive the REAL controls so the deep links exercise the
    // actual listener wiring above, not just the rendering functions.
    // Reacting is hold-only now, and a hold isn't expressible as a URL — so this
    // one enters the state the gesture would, by calling the same opener the
    // long-press timer calls.
    if (SHOT_POST_REACTIONS) {
      const firstCard = feed?.querySelector('.post-card');
      if (firstCard) {
        const postId = firstCard.dataset.postId;
        togglePostReaction(channelId, postId, POST_REACTIONS[0]);
        refreshPostReactions(channelId, postId);
        openReactionPicker(postId);
      }
    }
    // Forward moved into the ⋯ menu, so the deep link now walks the same two
    // taps a user does: open the menu, then pick Forward.
    if (SHOT_FORWARD_SHEET) {
      feed?.querySelector('.post-card .post-menu-button')?.click();
      document.getElementById('forward-post-btn')?.click();
    }
    if (SHOT_POST_MENU) {
      feed?.querySelector('.post-card .post-menu-button')?.click();
    }
    if (SHOT_POST_EDIT) {
      feed?.querySelector('.post-card .post-menu-button')?.click();
      document.getElementById('edit-post-btn')?.click();
    }

    // Poll for new posts while this channel stays open -- owners AND
    // followers both need this, since a follower is exactly who's waiting to
    // see the owner's next post show up without a manual reload.
    startThreadPolling(
      () => hydrateChannelPosts(channelId, channel),
      () => renderChannelView(channelId),
      () => {
        const failed = channel.posts.filter(p => p.failed);
        if (!failed.length) return false;
        failed.forEach(post => deliverPost(channelId, post, () => renderChannelView(channelId)));
        return true;
      }
    );
  }

  // Show channel menu
  function showChannelMenu(channelId, channel, isOwner, isAdmin) {
    const canManage = isOwner || isAdmin;
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog group-menu-dialog';

    let menuHTML = `
      <div class="dialog-header">
        <h2>${channel.name}</h2>
        <button class="close-dialog-button">✕</button>
      </div>
      <div class="dialog-content group-menu-content">
    `;

    if (canManage) {
      menuHTML += `
        <button class="menu-option" id="edit-channel-btn">
          <span class="option-icon">✏️</span>
          <span class="option-label">Edit Channel</span>
          <span class="option-chevron">›</span>
        </button>
        <button class="menu-option" id="share-channel-btn">
          <span class="option-icon">🔗</span>
          <span class="option-label">Share Channel</span>
          <span class="option-chevron">›</span>
        </button>
      `;
    } else {
      menuHTML += `
        <button class="menu-option" id="share-channel-btn">
          <span class="option-icon">🔗</span>
          <span class="option-label">Share Channel</span>
          <span class="option-chevron">›</span>
        </button>
        <button class="menu-option" id="mute-notifications-btn">
          <span class="option-icon">🔔</span>
          <span class="option-label">${channel.mutedByUsers['user_self'] ? 'Unmute' : 'Mute'} Notifications</span>
          <span class="option-chevron">›</span>
        </button>
        <button class="menu-option leave-option" id="unfollow-btn">
          <span class="option-icon">👋</span>
          <span class="option-label">Unfollow</span>
        </button>
      `;
    }

    if (isOwner) {
      menuHTML += `
        <button class="menu-option leave-option" id="delete-channel-btn">
          <span class="option-icon">🗑️</span>
          <span class="option-label">Delete Channel</span>
        </button>
      `;
    }

    menuHTML += `</div>`;
    dialog.innerHTML = menuHTML;
    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    const closeButton = dialog.querySelector('.close-dialog-button');
    closeButton.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.getElementById('share-channel-btn')?.addEventListener('click', () => {
      overlay.remove();
      shareLink(channel.name, `${window.location.origin}/?channel=${channelId}`);
    });

    if (canManage) {
      document.getElementById('edit-channel-btn')?.addEventListener('click', () => {
        overlay.remove();
        window.location.hash = `/channel/${channelId}/info`;
      });
    } else {
      document.getElementById('mute-notifications-btn')?.addEventListener('click', () => {
        const isMuted = channel.mutedByUsers['user_self'];
        toggleMuteChannel(channelId, !isMuted);
        overlay.remove();
        renderChannelView(channelId);
        showToast(isMuted ? 'Notifications unmuted' : 'Notifications muted', { type: 'success' });
      });

      document.getElementById('unfollow-btn')?.addEventListener('click', () => {
        overlay.remove();
        unfollowChannel(channelId);
        window.location.hash = '/messages';
        showToast('Unfollowed channel', { type: 'success' });
      });
    }

    if (isOwner) {
      document.getElementById('delete-channel-btn')?.addEventListener('click', () => {
        overlay.remove();
        showConfirmDialog('Delete Channel', `Delete "${channel.name}"? This cannot be undone.`, () => {
          deleteChannel(channelId);
          window.location.hash = '/messages';
          showToast('Channel deleted', { type: 'success' });
        });
      });
    }
  }

  // Show post menu
  function showPostMenu(channelId, postId, isOwner) {
    const channel = channels.find(c => c.id === channelId);
    const post = channel && channel.posts.find(p => p.id === postId);
    if (!post) return;

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    // Forward and Copy text are available to every viewer; only the channel
    // owner sees Edit Post and Delete Post.
    dialog.innerHTML = `
      <div class="dialog-content group-menu-content">
        <button class="menu-option" id="forward-post-btn">
          <span class="option-icon">↗</span>
          <span class="option-label">Forward</span>
        </button>
        <button class="menu-option" id="copy-post-btn">
          <span class="option-icon">📋</span>
          <span class="option-label">Copy text</span>
        </button>
        ${isOwner ? `
          <button class="menu-option" id="edit-post-btn">
            <span class="option-icon">✏️</span>
            <span class="option-label">Edit Post</span>
          </button>
          <button class="menu-option" id="delete-post-btn">
            <span class="option-icon">🗑️</span>
            <span class="option-label">Delete Post</span>
          </button>
        ` : ''}
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.getElementById('forward-post-btn').addEventListener('click', () => {
      overlay.remove();
      showForwardSheet(channelId, postId);
    });

    document.getElementById('copy-post-btn').addEventListener('click', () => {
      overlay.remove();
      const copy = navigator.clipboard && navigator.clipboard.writeText(post.text);
      if (copy && typeof copy.then === 'function') {
        copy.then(() => {
          showToast('Post text copied', { type: 'success' });
        }).catch(() => {
          showToast('Failed to copy text', { type: 'error' });
        });
      } else {
        showToast('Failed to copy text', { type: 'error' });
      }
    });

    const editBtn = document.getElementById('edit-post-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        overlay.remove();
        showEditPostDialog(channelId, postId);
      });
    }

    const deleteBtn = document.getElementById('delete-post-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        overlay.remove();
        deletePost(channelId, postId);
        renderChannelView(channelId);
        showToast('Post deleted', { type: 'success' });
      });
    }
  }

  // Edit an existing post's text in place. Owner-only — the caller (showPostMenu)
  // only renders the entry point when `isOwner`, and this re-checks the channel's
  // creator so the dialog can't be driven onto someone else's channel.
  function showEditPostDialog(channelId, postId) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel || channel.creatorId !== 'user_self') return;
    const post = channel.posts.find(p => p.id === postId);
    if (!post) return;

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog edit-post-dialog';
    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>Edit Post</h2>
        <button class="close-dialog-button" id="edit-post-close">✕</button>
      </div>
      <div class="dialog-content">
        <textarea class="edit-post-input" id="edit-post-input" rows="6" placeholder="Post text">${post.text}</textarea>
      </div>
      <div class="dialog-footer">
        <button class="button-secondary" id="edit-post-cancel">Cancel</button>
        <button class="button-primary" id="edit-post-save">Save</button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    const input = document.getElementById('edit-post-input');
    const saveBtn = document.getElementById('edit-post-save');

    const syncSaveState = () => {
      saveBtn.disabled = !input.value.trim();
    };
    syncSaveState();
    input.addEventListener('input', syncSaveState);
    input.focus();

    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.getElementById('edit-post-close').addEventListener('click', close);
    document.getElementById('edit-post-cancel').addEventListener('click', close);

    saveBtn.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;
      post.text = text;
      post.editedAt = Date.now();
      close();
      refreshPostContent(channelId, postId);
      showToast('Post updated', { type: 'success' });
    });
  }

  // Where a post can be forwarded: 1:1 DMs and the groups the user is actually a
  // member of. Channel rows live in `conversations` too (type 'channel') and are
  // deliberately excluded — you follow a channel, you don't chat into it.
  function getForwardTargets() {
    const dms = conversations
      .filter(c => c.type === 'direct' && !c.archived)
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(c => ({
        kind: 'dm',
        id: c.id,
        name: c.username,
        avatar: c.avatar,
        subtitle: 'Direct message'
      }));

    const joinedGroups = groups
      .filter(g => !g.isLeftByUser && (g.members || []).some(m => m.id === 'user_self'))
      .map(g => ({
        kind: 'group',
        id: g.id,
        name: g.name,
        avatar: g.avatar,
        subtitle: `${(g.members || []).length} members`
      }));

    return { dms, groups: joinedGroups };
  }

  // Deliver one post to every selected target. Each forwarded message carries
  // `forwardedFrom` so the DM/group renderers can show the attribution line.
  // Returns the number of chats written to, for the toast.
  function forwardPostToTargets(channel, post, targets, note) {
    const baseTimestamp = Date.now();
    const trimmedNote = (note || '').trim();
    let delivered = 0;

    targets.forEach((target, index) => {
      // Offset by index so two targets in the same millisecond can't collide.
      const timestamp = baseTimestamp + index;
      const forwardedFrom = {
        channelId: channel.id,
        channelName: channel.name,
        channelAvatar: channel.avatar,
        postId: post.id
      };

      if (target.kind === 'dm') {
        const conversation = conversations.find(c => c.id === target.id);
        if (!conversation) return;
        if (!conversation.messages) conversation.messages = [];

        conversation.messages.push({
          id: `msg_fwd_${timestamp}_${index}`,
          text: post.text,
          timestamp,
          isOutgoing: true,
          forwardedFrom
        });

        if (trimmedNote) {
          conversation.messages.push({
            id: `msg_fwd_note_${timestamp}_${index}`,
            text: trimmedNote,
            timestamp: timestamp + 1,
            isOutgoing: true
          });
        }

        updateThreadLastMessage(
          conversation,
          false,
          '↗ ' + (trimmedNote || post.text).substring(0, 100),
          trimmedNote ? timestamp + 1 : timestamp
        );
        delivered++;
        return;
      }

      const group = groups.find(g => g.id === target.id);
      if (!group) return;
      if (!group.messages) group.messages = [];

      group.messages.push({
        id: `msg_fwd_${timestamp}_${index}`,
        senderId: 'user_self',
        text: post.text,
        timestamp,
        isOutgoing: true,
        forwardedFrom
      });

      if (trimmedNote) {
        group.messages.push({
          id: `msg_fwd_note_${timestamp}_${index}`,
          senderId: 'user_self',
          text: trimmedNote,
          timestamp: timestamp + 1,
          isOutgoing: true
        });
      }

      updateThreadLastMessage(
        group,
        true,
        '↗ ' + (trimmedNote || post.text).substring(0, 100),
        trimmedNote ? timestamp + 1 : timestamp
      );
      delivered++;
    });

    return delivered;
  }

  // "Forward to" sheet — pick any number of DMs and joined groups, optionally add
  // a note, then Send. Stays on the channel so the user can keep reading.
  function showForwardSheet(channelId, postId) {
    const channel = channels.find(c => c.id === channelId);
    const post = channel && channel.posts.find(p => p.id === postId);
    if (!post) return;

    const { dms, groups: joinedGroups } = getForwardTargets();
    const allTargets = dms.concat(joinedGroups);
    const selected = new Map();

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog forward-sheet-dialog';
    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>Forward to</h2>
        <button class="close-dialog-button" aria-label="Close">×</button>
      </div>
      <div class="dialog-content">
        <div class="forward-post-preview">
          <div class="forward-preview-channel">${renderCommunityAvatar(channel.avatar, channel.name)} ${channel.name}</div>
          <div class="forward-preview-text">${post.text.substring(0, 140)}${post.text.length > 140 ? '…' : ''}</div>
        </div>
        <input type="text" class="form-input search-forward-targets" placeholder="Search chats and groups" aria-label="Search chats and groups">
        <div class="forward-targets-list"></div>
        <textarea class="form-input forward-note-input" rows="2" placeholder="Add a note (optional)" aria-label="Add a note"></textarea>
      </div>
      <div class="dialog-footer">
        <button class="button-secondary" id="forward-cancel-btn">Cancel</button>
        <button class="button-primary" id="forward-send-btn" disabled>Send</button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    const targetsList = dialog.querySelector('.forward-targets-list');
    const searchInput = dialog.querySelector('.search-forward-targets');
    const noteInput = dialog.querySelector('.forward-note-input');
    const sendButton = dialog.querySelector('#forward-send-btn');

    function targetRowHTML(target) {
      const isSelected = selected.has(`${target.kind}:${target.id}`);
      return `
        <button class="forward-target-item ${isSelected ? 'selected' : ''}" data-kind="${target.kind}" data-target-id="${target.id}" aria-pressed="${isSelected ? 'true' : 'false'}">
          <div class="user-avatar">${renderCommunityAvatar(target.avatar, target.name)}</div>
          <div class="user-content">
            <div class="user-name">${target.name}</div>
            <div class="user-subtitle">${target.subtitle}</div>
          </div>
          <div class="selection-indicator ${isSelected ? 'selected' : ''}">${isSelected ? '✓' : ''}</div>
        </button>
      `;
    }

    function renderTargets() {
      const query = searchInput.value.trim().toLowerCase();
      const matches = (list) => list.filter(t => !query || t.name.toLowerCase().includes(query));
      const matchingDms = matches(dms);
      const matchingGroups = matches(joinedGroups);

      if (!matchingDms.length && !matchingGroups.length) {
        targetsList.innerHTML = '<div class="empty-state">No chats found</div>';
        return;
      }

      targetsList.innerHTML = `
        ${matchingDms.length ? `
          <div class="forward-section-label">Recent chats</div>
          ${matchingDms.map(targetRowHTML).join('')}
        ` : ''}
        ${matchingGroups.length ? `
          <div class="forward-section-label">Groups</div>
          ${matchingGroups.map(targetRowHTML).join('')}
        ` : ''}
      `;
    }

    function updateSendButton() {
      const count = selected.size;
      sendButton.disabled = count === 0;
      sendButton.textContent = count > 1 ? `Send (${count})` : 'Send';
    }

    function closeSheet() {
      overlay.remove();
    }

    renderTargets();
    updateSendButton();

    searchInput.addEventListener('input', renderTargets);

    targetsList.addEventListener('click', (e) => {
      const row = e.target.closest('.forward-target-item');
      if (!row) return;
      const key = `${row.dataset.kind}:${row.dataset.targetId}`;
      if (selected.has(key)) {
        selected.delete(key);
      } else {
        const target = allTargets.find(t => t.kind === row.dataset.kind && t.id === row.dataset.targetId);
        if (target) selected.set(key, target);
      }
      renderTargets();
      updateSendButton();
    });

    dialog.querySelector('.close-dialog-button').addEventListener('click', closeSheet);
    dialog.querySelector('#forward-cancel-btn').addEventListener('click', closeSheet);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeSheet();
    });

    sendButton.addEventListener('click', () => {
      if (!selected.size) return;
      const targets = Array.from(selected.values());
      const count = forwardPostToTargets(channel, post, targets, noteInput.value);
      closeSheet();
      const label = count === 1 ? targets[0].name : `${count} chats`;
      showToast(`Forwarded to ${label}`, { type: 'success' });
    });

    // Screenshot-state: pre-select the first two targets so the deep link lands
    // on an enabled Send button rather than the disabled empty state.
    if (SHOT_FORWARD_SHEET) {
      // Each click re-renders the list, so re-query between clicks — a stale
      // NodeList entry is detached and its click never reaches the delegate.
      for (let i = 0; i < 2; i++) {
        const rows = targetsList.querySelectorAll('.forward-target-item:not(.selected)');
        if (rows[0]) rows[0].click();
      }
    }
  }

  // Show confirm dialog
  function showConfirmDialog(title, message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>${title}</h2>
      </div>
      <div class="dialog-content">
        <p>${message}</p>
      </div>
      <div class="dialog-footer">
        <button class="button-secondary" id="cancel-btn">Cancel</button>
        <button class="button-danger" id="confirm-btn">Confirm</button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    document.getElementById('cancel-btn').addEventListener('click', () => overlay.remove());
    document.getElementById('confirm-btn').addEventListener('click', () => {
      overlay.remove();
      onConfirm();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // Centered modal popup with a single OK/dismiss button — same
  // .dialog-overlay/.dialog shell as showConfirmDialog, minus the cancel
  // button, with the centered layout variant instead of the bottom-sheet
  // default. Blurring the active element first dismisses any open mobile
  // keyboard (e.g. a search field the user was just typing into) so the
  // dialog isn't rendered behind it.
  function showAlertDialog(title, message) {
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay dialog-overlay-centered';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>${title}</h2>
      </div>
      <div class="dialog-content">
        <p>${message}</p>
      </div>
      <div class="dialog-footer">
        <button class="button-primary" id="alert-ok-btn">OK</button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    document.getElementById('alert-ok-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // Share a link via the native share sheet, falling back to clipboard, then
  // a copy-friendly textarea, then a plain prompt if nothing else works.
  function shareLink(title, link) {
    const copyFallback = () => {
      const textarea = document.createElement('textarea');
      textarea.value = link;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch (err) {
        copied = false;
      }
      document.body.removeChild(textarea);

      if (copied) {
        showToast('Link copied to clipboard', { type: 'success' });
      } else {
        window.prompt('Copy this link to share:', link);
      }
    };

    if (navigator.share) {
      navigator.share({ title, url: link }).catch(err => console.log('Share cancelled or failed'));
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(() => {
        showToast('Link copied to clipboard', { type: 'success' });
      }).catch(() => {
        copyFallback();
      });
    } else {
      copyFallback();
    }
  }

  // Show toast notification
  function showToast(message, options = {}) {
    const toast = document.createElement('div');
    toast.className = `toast ${options.type || 'info'}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Render Channel Info page — avatar/name/description editing plus the
  // Admins list, for owners and admins. Members with by role, mirroring
  // renderGroupInfoPage, but built against the real channel shape (no
  // `channel.members` roster exists — see isCurrentUserChannelAdmin).
  function renderChannelInfoPage(channelId) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) {
      window.location.hash = '/messages';
      return;
    }

    const isOwner = channel.creatorId === 'user_self';
    const isAdmin = isCurrentUserChannelAdmin(channel);
    if (!isOwner && !isAdmin) {
      window.location.hash = `/channel/${channelId}`;
      return;
    }

    // Screenshot-state: channel.admins is a local-only roster (Add Admins never
    // persists to the server), so a plain deep link to Channel Info never has
    // anyone to list. Seed one client-only admin on whichever owned channel
    // this is, the same real staging follower used elsewhere as a stand-in
    // second person.
    if (SHOT_CHANNEL_ADMIN && !(channel.admins && channel.admins.length)) {
      channel.admins = [{
        id: 'staging-demo-user-2',
        username: 'staging-demo-ana',
        avatar: generateDefaultAvatar('staging-demo-ana'),
        walletAddress: null
      }];
    }

    const adminRows = (channel.admins || []).map(admin => `
      <div class="channel-member-item" data-admin-id="${admin.id}">
        <div class="member-avatar">${renderCommunityAvatar(admin.avatar, admin.username)}</div>
        <div class="member-info">
          <div class="member-name">${admin.username}</div>
          <div class="member-role-badge">Admin</div>
        </div>
        ${isOwner ? `<button class="member-admin-toggle-btn" data-admin-id="${admin.id}">Remove</button>` : ''}
      </div>
    `).join('');

    pageContainer.innerHTML = `
      <div class="channel-info-page">
        <div class="channel-info-header">
          <button class="back-button" aria-label="Back to channel">←</button>
          <h1>Channel Info</h1>
          <div style="width: 32px;"></div>
        </div>

        <div class="channel-info-content">
          <div class="channel-avatar-section">
            <div class="channel-avatar-large" id="channel-avatar-large">${renderCommunityAvatar(channel.avatar, channel.name)}</div>
            ${isOwner ? `<button class="edit-avatar-button" id="edit-channel-avatar-button">Change Photo</button>` : ''}
          </div>

          <div class="channel-details-section">
            <div class="detail-item">
              <div class="detail-label">Channel Name</div>
              <div class="detail-value" id="channel-name-value">${channel.name}</div>
              <button class="detail-edit-button" id="edit-channel-name-button">Edit</button>
            </div>

            <div class="detail-item">
              <div class="detail-label">Description</div>
              <div class="detail-value" id="channel-description-value">${channel.description || 'No description'}</div>
              <button class="detail-edit-button" id="edit-channel-description-button">Edit</button>
            </div>

            <div class="detail-item">
              <div class="detail-label">Visibility</div>
              <div class="view-only-badge">${channel.isPublic ? 'Public' : 'Private'}</div>
            </div>
          </div>

          <div class="members-section">
            <div class="section-title">Admins (${(channel.admins || []).length + 1})</div>
            <button class="add-members-button" id="add-channel-admins-button">+ Add Admins</button>
            <div class="members-list" id="channel-admins-list">
              <div class="channel-member-item">
                <div class="member-avatar">👑</div>
                <div class="member-info">
                  <div class="member-name">You${isOwner ? '' : ' (Owner)'}</div>
                  <div class="member-role-badge">Owner</div>
                </div>
              </div>
              ${adminRows}
            </div>
          </div>
        </div>
      </div>
    `;

    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = `/channel/${channelId}`;
    });

    document.getElementById('edit-channel-name-button').addEventListener('click', () => {
      showEditChannelNameDialog(channelId, channel.name);
    });

    document.getElementById('edit-channel-description-button').addEventListener('click', () => {
      showEditChannelDescriptionDialog(channelId, channel.description);
    });

    const editChannelAvatarButton = document.getElementById('edit-channel-avatar-button');
    if (editChannelAvatarButton) {
      editChannelAvatarButton.addEventListener('click', () => {
        showEditChannelAvatarDialog(channelId, channel);
      });
    }

    document.getElementById('add-channel-admins-button').addEventListener('click', () => {
      window.location.hash = `/channel/${channelId}/add-admins`;
    });

    document.querySelectorAll('#channel-admins-list .member-admin-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeChannelAdmin(channelId, btn.dataset.adminId);
      });
    });
  }

  // Remove an existing admin from a channel (owner only).
  function removeChannelAdmin(channelId, adminId) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel || channel.creatorId !== 'user_self') return;

    const admin = (channel.admins || []).find(a => a.id === adminId);
    if (!admin) return;

    channel.admins = channel.admins.filter(a => a.id !== adminId);
    renderChannelInfoPage(channelId);
    showToast(`${admin.username} is no longer an admin`, { type: 'success' });
  }

  // Show edit channel name dialog - stays on the Channel Info page
  function showEditChannelNameDialog(channelId, currentName) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>Edit Channel Name</h2>
      </div>
      <div class="dialog-content">
        <input type="text" id="edit-channel-name-input" class="form-input" value="${currentName}" maxlength="50" />
        <div class="char-count"><span id="channel-name-char-count">0</span>/50</div>
        <div class="validation-error" id="edit-channel-name-error"></div>
      </div>
      <div class="dialog-footer">
        <button class="button-secondary" id="cancel-edit-channel-name">Cancel</button>
        <button class="button-primary" id="save-edit-channel-name">Save</button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    const input = document.getElementById('edit-channel-name-input');
    const charCount = document.getElementById('channel-name-char-count');
    const errorEl = document.getElementById('edit-channel-name-error');

    input.addEventListener('input', () => {
      charCount.textContent = input.value.length;
    });
    charCount.textContent = currentName.length;

    document.getElementById('cancel-edit-channel-name').addEventListener('click', () => {
      overlay.remove();
    });

    document.getElementById('save-edit-channel-name').addEventListener('click', () => {
      const newName = input.value.trim();
      if (!newName) {
        errorEl.textContent = 'Channel name is required';
        return;
      }

      channel.name = newName;

      const conversation = conversations.find(c => c.channelId === channelId);
      if (conversation) conversation.name = newName;

      overlay.remove();
      showToast('Channel name updated', { type: 'success' });
      renderChannelInfoPage(channelId);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    input.focus();
  }

  // Show edit channel description dialog - stays on the Channel Info page
  function showEditChannelDescriptionDialog(channelId, currentDescription) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>Edit Description</h2>
      </div>
      <div class="dialog-content">
        <textarea id="edit-channel-desc-input" class="form-input" maxlength="250" placeholder="Add a description...">${currentDescription || ''}</textarea>
        <div class="char-count"><span id="channel-desc-char-count">0</span>/250</div>
      </div>
      <div class="dialog-footer">
        <button class="button-secondary" id="cancel-edit-channel-desc">Cancel</button>
        <button class="button-primary" id="save-edit-channel-desc">Save</button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    const textarea = document.getElementById('edit-channel-desc-input');
    const charCount = document.getElementById('channel-desc-char-count');

    textarea.addEventListener('input', () => {
      charCount.textContent = textarea.value.length;
    });
    charCount.textContent = (currentDescription || '').length;

    document.getElementById('cancel-edit-channel-desc').addEventListener('click', () => {
      overlay.remove();
    });

    document.getElementById('save-edit-channel-desc').addEventListener('click', () => {
      channel.description = textarea.value.trim();
      overlay.remove();
      showToast('Description updated', { type: 'success' });
      renderChannelInfoPage(channelId);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    textarea.focus();
  }

  // Show change channel photo dialog - stays on the Channel Info page
  function showEditChannelAvatarDialog(channelId, channelData) {
    showAvatarUploadDialog({
      title: 'Change Channel Photo',
      currentAvatarHtml: renderCommunityAvatar(channelData.avatar, channelData.name),
      onSave: async (file) => {
        const uploaded = await uploadAvatarPhoto(file);
        const channel = channels.find(c => c.id === channelId);
        if (!channel) throw new Error('Channel not found.');
        const oldImageId = channel.avatarImageId || null;

        if (channel.source === 'server') {
          const response = await fetch(`/api/channels/${channelId}/avatar`, {
            method: 'PUT',
            headers: authHeaders({ 'content-type': 'application/json' }),
            body: JSON.stringify({ avatarUrl: uploaded.url, avatarImageId: uploaded.id })
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || 'Failed to update avatar.');
          }
        }

        channel.avatar = uploaded.url;
        channel.avatarImageId = uploaded.id;

        const conversation = conversations.find(c => c.channelId === channelId);
        if (conversation) conversation.avatar = uploaded.url;

        showToast('Photo updated', { type: 'success' });
        renderChannelInfoPage(channelId);

        if (oldImageId && window.usernode && window.usernode.deleteFile) {
          window.usernode.deleteFile(oldImageId).catch(() => {});
        }
      }
    });
  }

  // Show Add Admins screen — search/select from the real user directory,
  // same pattern as renderAddMembersPage. Channels have no server backing,
  // so this is a pure in-memory mutation of channel.admins.
  function renderChannelAddAdminsPage(channelId) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) {
      window.location.hash = '/messages';
      return;
    }

    const isOwner = channel.creatorId === 'user_self';
    const isAdmin = isCurrentUserChannelAdmin(channel);
    if (!isOwner && !isAdmin) {
      window.location.hash = `/channel/${channelId}`;
      return;
    }

    let selectedAdmins = [];

    const isAlreadyManaging = (userId) => userId === channel.creatorId ||
      (channel.admins || []).some(a => a.id === userId);

    const usersList = suggestedUsers.filter(u => !isAlreadyManaging(u.id))
      .map(user => renderUserListItemHtml(user, { selectable: true })).join('');

    pageContainer.innerHTML = `
      <div class="add-members-page">
        <div class="create-group-header">
          <button class="back-button" aria-label="Back to channel info">←</button>
          <h1>Add Admins</h1>
        </div>

        <div class="form-section">
          <input type="text" class="form-input" placeholder="🔍 Search username" id="search-channel-admins-add" />
        </div>

        <div class="members-chips-container" id="channel-admins-chips-container"></div>

        <div class="suggested-users-section-create">
          <div class="section-header">Available Users</div>
          <div class="users-list" id="suggested-channel-admins-list">
            ${usersList}
          </div>
        </div>

        <div class="validation-error" id="add-channel-admins-error"></div>

        <button class="create-group-button" id="add-channel-admins-button">Add Admins</button>
      </div>
    `;

    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = `/channel/${channelId}/info`;
    });

    const searchInput = document.getElementById('search-channel-admins-add');
    const chipsContainer = document.getElementById('channel-admins-chips-container');
    const suggestedList = document.getElementById('suggested-channel-admins-list');
    const addBtn = document.getElementById('add-channel-admins-button');
    const errorEl = document.getElementById('add-channel-admins-error');

    function renderChips() {
      if (selectedAdmins.length === 0) {
        chipsContainer.innerHTML = '';
        return;
      }

      chipsContainer.innerHTML = selectedAdmins.map(user => `
        <div class="member-chip">
          <div class="chip-avatar">${renderCommunityAvatar(user.avatar, user.username)}</div>
          <span>${user.username}</span>
          <button class="chip-remove" data-user-id="${user.id}" aria-label="Remove ${user.username}">×</button>
        </div>
      `).join('');

      document.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const userId = btn.dataset.userId;
          selectedAdmins = selectedAdmins.filter(u => u.id !== userId);
          renderChips();
          filterAndDisplay();
        });
      });
    }

    function toggleUser(userId) {
      const user = suggestedUsers.find(u => u.id === userId);
      if (!user) return;

      if (selectedAdmins.find(u => u.id === userId)) {
        selectedAdmins = selectedAdmins.filter(u => u.id !== userId);
      } else {
        selectedAdmins.push(user);
      }

      renderChips();
      filterAndDisplay();
      errorEl.innerHTML = '';
    }

    function filterAndDisplay() {
      const query = searchInput.value.toLowerCase();
      const filtered = suggestedUsers.filter(u =>
        !isAlreadyManaging(u.id) &&
        (u.username.toLowerCase().includes(query) || (u.walletAddress && u.walletAddress.toLowerCase().includes(query)))
      );

      suggestedList.innerHTML = filtered.map(user => renderUserListItemHtml(user, {
        selectable: true,
        selected: !!selectedAdmins.find(a => a.id === user.id)
      })).join('');

      document.querySelectorAll('.suggested-user-item').forEach(item => {
        item.addEventListener('click', () => {
          toggleUser(item.dataset.userId);
        });
      });
    }

    searchInput.addEventListener('input', filterAndDisplay);

    document.querySelectorAll('.suggested-user-item').forEach(item => {
      item.addEventListener('click', () => {
        toggleUser(item.dataset.userId);
      });
    });

    // Refresh the directory each time this screen opens.
    fetchSuggestedUsers().then(filterAndDisplay);

    addBtn.addEventListener('click', () => {
      if (selectedAdmins.length === 0) {
        errorEl.textContent = 'Select at least 1 person';
        return;
      }

      channel.admins = (channel.admins || []).concat(selectedAdmins.map(u => ({
        id: u.id,
        username: u.username,
        avatar: u.avatar,
        walletAddress: u.walletAddress || null
      })));

      window.location.hash = `/channel/${channelId}/info`;
      showToast(`Added ${selectedAdmins.length} admin(s)`, { type: 'success' });
    });
  }

  // Render channel conversation screen
  function renderChannelConversationPage(channelId) {
    const channel = channels.find(ch => ch.id === channelId);
    if (!channel) {
      window.location.hash = '/messages';
      return;
    }

    const messagesList = channel.messages.map(msg => {
      let messageHTML = `<div class="message ${msg.isOutgoing ? 'outgoing' : 'incoming has-avatar'}" data-message-id="${msg.id}">`;

      if (msg.isOutgoing) {
        messageHTML += `
          ${renderPinBadge(msg)}
          <div class="message-bubble" data-message-id="${msg.id}">${msg.text}</div>
          <div class="message-timestamp">${formatMessageTime(msg.timestamp)}</div>
        </div>`;
      } else {
        messageHTML += `
          <div class="message-avatar">${msg.senderName ? msg.senderName.charAt(0).toUpperCase() : ''}</div>
          <div class="message-content">
            ${renderPinBadge(msg)}
            <div class="message-bubble" data-message-id="${msg.id}">${msg.text}</div>
            <div class="message-timestamp">${formatMessageTime(msg.timestamp)}</div>
          </div>
        </div>`;
      }

      return messageHTML;
    }).join('');

    const viewOnlyBadge = !channel.currentUserCanSend ? '<div class="view-only-badge">View only</div>' : '';
    const composerDisplay = channel.currentUserIsAdmin ? '' : 'display: none;';

    pageContainer.innerHTML = `
      <div class="conversation-page">
        <div class="conversation-page-header">
          <button class="back-button" aria-label="Back to messages">←</button>
          <div class="conversation-header-info channel-header-info" id="channel-header-info-${channelId}">
            <div class="conversation-avatar-header">${channel.avatar}</div>
            <div class="header-text">
              <div class="header-username">${channel.name}</div>
              <div class="header-member-count">${channel.memberCount} members</div>
            </div>
          </div>
          <button class="menu-button" aria-label="More options">⋮</button>
        </div>
        <div class="messages-container">
          ${messagesList}
        </div>
        <div class="composer-container chat-composer" style="${composerDisplay}">
          ${viewOnlyBadge}
          ${composerMarkup({ disabled: !channel.currentUserCanSend, conversationId: channel.id })}
        </div>
      </div>
    `;

    // Add back button handler
    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = '/messages';
    });

    // Add channel header handlers
    const headerInfo = document.getElementById(`channel-header-info-${channelId}`);
    if (headerInfo) {
      headerInfo.style.cursor = 'pointer';
      headerInfo.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.hash = `/channel/${channelId}/info`;
      });
    }

    // Add menu button for channel options
    const menuButton = document.querySelector('.menu-button');
    if (menuButton) {
      menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.hash = `/channel/${channelId}/info`;
      });
    }

    // Scroll to latest message
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        keepThreadPinnedThroughImageLoads(messagesContainer, true);
      }
    }, 0);

    // Set up message long-press interactions
    setupMessageLongPress(channel, 'channel');

    // Set up image lightbox for image messages
    setupImageLightbox();

    // Set up send button and reply state management (only if can send).
    // Channels live in their own array, so they redraw with their own renderer —
    // routing through renderConversationPage() would bounce the user out.
    if (channel.currentUserCanSend) {
      setupComposer(channel, { rerender: () => renderChannelView(channelId) });
    }
  }

  // Render channel info modal
  function renderChannelInfoModal(channelId) {
    const channel = channels.find(ch => ch.id === channelId);
    if (!channel) {
      window.location.hash = '/messages';
      return;
    }

    const membersList = channel.members.map(member => `
      <div class="channel-member-item" data-member-id="${member.id}">
        <div class="member-avatar">${member.avatar || member.username.charAt(0).toUpperCase()}</div>
        <div class="member-info">
          <div class="member-name">${member.username}</div>
        </div>
      </div>
    `).join('');

    pageContainer.innerHTML = `
      <div class="channel-info-page">
        <div class="channel-info-header">
          <button class="back-button" aria-label="Back to channel">←</button>
          <h1>Channel Info</h1>
          <div style="width: 32px;"></div>
        </div>

        <div class="channel-info-content">
          <div class="channel-avatar-section">
            <div class="channel-avatar-large" id="channel-avatar-large">${channel.avatar}</div>
          </div>

          <div class="channel-details-section">
            <div class="detail-item">
              <div class="detail-label">Channel Name</div>
              <div class="detail-value" id="channel-name-value">${channel.name}</div>
            </div>

            <div class="detail-item">
              <div class="detail-label">Description</div>
              <div class="detail-value" id="channel-description-value">${channel.description || 'No description'}</div>
            </div>

            <div class="detail-item">
              <div class="detail-label">Visibility</div>
              <div class="detail-value">${channel.visibility === 'public' ? '🌐 Public' : '🔒 Private'}</div>
            </div>

            <div class="detail-item">
              <div class="detail-label">Members</div>
              <div class="detail-value">${channel.memberCount}</div>
            </div>
          </div>

          <div class="members-section">
            <div class="section-title">Members (${channel.memberCount})</div>
            <div class="members-list" id="members-list">
              ${membersList}
            </div>
          </div>

          <button class="leave-channel-button" id="leave-channel-button">Leave Channel</button>
        </div>
      </div>
    `;

    // Back button
    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = `/channel/${channelId}`;
    });

    // Leave channel
    document.getElementById('leave-channel-button').addEventListener('click', () => {
      showLeaveChannelDialog(channelId, channel.name);
    });
  }

  // Show leave channel confirmation dialog
  function showLeaveChannelDialog(channelId, channelName) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>Leave Channel</h2>
      </div>
      <div class="dialog-content">
        <p>Are you sure you want to leave <strong>${channelName}</strong>?</p>
      </div>
      <div class="dialog-footer">
        <button class="button-secondary" id="cancel-leave-channel">Cancel</button>
        <button class="button-danger" id="confirm-leave-channel">Leave</button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    document.getElementById('cancel-leave-channel').addEventListener('click', () => {
      overlay.remove();
    });

    document.getElementById('confirm-leave-channel').addEventListener('click', () => {
      const channel = channels.find(ch => ch.id === channelId);
      if (channel) {
        channel.currentUserIsMember = false;
        channel.members = channel.members.filter(m => m.id !== 'user_self');
        channel.memberCount--;

        conversations = conversations.filter(c => c.channelId !== channelId);

        overlay.remove();
        window.location.hash = '/messages';
        showToast(`Left ${channelName}`, { type: 'success' });
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  // Render Create Channel Page
  function renderCreateChannelPage() {
    const state = {
      channelName: '',
      channelDescription: '',
      avatarFile: null,
      avatarPreview: null,
      avatarUrl: null,
      avatarImageId: null,
      avatarUploadPromise: null,
      validationError: ''
    };

    pageContainer.innerHTML = `
      <div class="create-channel-page">
        <div class="create-channel-header">
          <button class="back-button" aria-label="Back to new message">←</button>
          <h1>Create Channel</h1>
        </div>

        <div class="channel-avatar-section">
          <div class="avatar-placeholder" id="avatar-placeholder">
            <div class="avatar-placeholder-text">+ Add Photo</div>
          </div>
          <input type="file" id="avatar-file-input" accept="image/*" style="display: none;" />
        </div>

        <div class="form-section">
          <div>
            <input type="text" class="form-input" placeholder="Channel name" id="channel-name-input" maxlength="50" />
            <div class="validation-error" id="name-error"></div>
          </div>
          <input type="text" class="form-input" placeholder="Add a description (optional)" id="channel-description-input" maxlength="250" />
        </div>

        <button class="create-channel-button" id="create-channel-button">Create Channel</button>
      </div>
    `;

    const backButton = document.querySelector('.back-button');
    const channelNameInput = document.getElementById('channel-name-input');
    const channelDescriptionInput = document.getElementById('channel-description-input');
    const avatarPlaceholder = document.getElementById('avatar-placeholder');
    const avatarFileInput = document.getElementById('avatar-file-input');
    const createChannelButton = document.getElementById('create-channel-button');
    const nameError = document.getElementById('name-error');

    function updateAvatarDisplay() {
      if (state.avatarPreview) {
        const img = document.createElement('img');
        img.src = state.avatarPreview;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.borderRadius = '50%';
        img.style.objectFit = 'cover';
        avatarPlaceholder.innerHTML = '';
        avatarPlaceholder.appendChild(img);
      } else if (state.channelName.trim()) {
        const initials = generateDefaultAvatar(state.channelName);
        avatarPlaceholder.innerHTML = `<div style="font-size: 48px; color: #fff; font-weight: 600;">${initials}</div>`;
      } else {
        avatarPlaceholder.innerHTML = '<div class="avatar-placeholder-text">+ Add Photo</div>';
      }
    }

    function updateButtonState() {
      const isNameFilled = state.channelName.trim().length > 0;
      const isDisabled = !isNameFilled;
      createChannelButton.disabled = isDisabled;
    }

    backButton.addEventListener('click', () => {
      window.location.hash = '/create';
    });

    avatarPlaceholder.addEventListener('click', () => {
      avatarFileInput.click();
    });

    avatarFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        state.avatarFile = file;
        state.avatarPreview = event.target.result;
        updateAvatarDisplay();
      };
      reader.readAsDataURL(file);

      state.avatarUrl = null;
      state.avatarImageId = null;
      state.avatarUploadPromise = uploadAvatarPhoto(file).then((uploaded) => {
        state.avatarUrl = uploaded.url;
        state.avatarImageId = uploaded.id;
      }).catch((error) => {
        state.avatarPreview = null;
        updateAvatarDisplay();
        showToast(error.message || 'Failed to upload photo.', { type: 'error' });
      });
    });

    channelNameInput.addEventListener('input', (e) => {
      state.channelName = e.target.value.substring(0, 50);
      e.target.value = state.channelName;
      updateAvatarDisplay();
      updateButtonState();
      nameError.innerHTML = '';
    });

    channelDescriptionInput.addEventListener('input', (e) => {
      state.channelDescription = e.target.value.substring(0, 250);
      e.target.value = state.channelDescription;
    });

    async function submitCreateChannel() {
      nameError.innerHTML = '';

      if (!state.channelName.trim()) {
        nameError.innerHTML = 'Channel name is required.';
        return;
      }

      createChannelButton.disabled = true;
      const originalLabel = createChannelButton.textContent;
      createChannelButton.textContent = 'Creating…';

      if (state.avatarUploadPromise) {
        await state.avatarUploadPromise;
      }

      try {
        const response = await fetch('/api/channels', {
          method: 'POST',
          headers: authHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify({
            name: state.channelName,
            description: state.channelDescription,
            avatarUrl: state.avatarUrl,
            avatarImageId: state.avatarImageId
          })
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          nameError.innerHTML = payload.error || 'Failed to create channel.';
          createChannelButton.textContent = originalLabel;
          updateButtonState();
          return;
        }

        const shaped = addServerChannelToState(payload.channel);
        window.location.hash = `/channel/${shaped.id}`;
      } catch (error) {
        console.error('Failed to create channel:', error);
        nameError.innerHTML = 'Failed to create channel. Please try again.';
        createChannelButton.textContent = originalLabel;
        updateButtonState();
      }
    }

    createChannelButton.addEventListener('click', submitCreateChannel);

    updateButtonState();
  }

  // Profile Screen Functions
  let profileState = {
    username: 'johndoe',
    bio: 'Building on Usernode',
    avatarUrl: null,
    avatarImageId: null,
    walletAddress: null
  };

  function getInitialsFromUsername(username) {
    const parts = username.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return username.substring(0, 2).toUpperCase();
  }

  async function fetchUserData() {
    try {
      const token = localStorage.getItem('usernode-token');
      const response = await fetch('/api/state', {
        headers: token ? { 'x-usernode-token': token } : {}
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          // Coerce defensively -- server ids are TEXT columns, so comparisons
          // like `serverGroup.creatorId === currentUser.id` must not silently
          // fail a string/number mismatch (see addServerGroupToState).
          currentUser = { id: String(data.user.id), username: data.user.username || 'johndoe' };
          profileState.username = data.user.username || 'johndoe';
          profileState.walletAddress = data.user.usernode_pubkey || null;
        }
        if (bootServerVersion === null && data.serverVersion) {
          bootServerVersion = data.serverVersion;
        }
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }

    try {
      const profileResponse = await fetch('/api/profile', { headers: authHeaders() });
      if (profileResponse.ok) {
        const data = await profileResponse.json();
        if (data.profile) {
          profileState.bio = data.profile.bio || '';
          profileState.avatarUrl = data.profile.avatarUrl || null;
          profileState.avatarImageId = data.profile.avatarImageId || null;
          if (data.profile.walletAddress) profileState.walletAddress = data.profile.walletAddress;
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile data:', err);
    }
  }

  function renderProfilePage() {
    const username = profileState.username;
    const bio = profileState.bio;
    const walletAddress = profileState.walletAddress;

    const shortAddress = walletAddress
      ? walletAddress.substring(0, 6) + '...' + walletAddress.substring(walletAddress.length - 4)
      : null;
    const initials = getInitialsFromUsername(username);

    const avatarContent = profileState.avatarUrl
      ? renderCommunityAvatar(profileState.avatarUrl, username)
      : `<div class="avatar-placeholder-text">+ Add Photo</div>`;

    pageContainer.innerHTML = `
      <div class="profile-page">
        <div class="messages-header">
          <h1>Guardian</h1>
        </div>

        <div class="profile-content">
          <!-- Profile Header -->
          <div class="profile-header-section">
            <div class="profile-avatar-large" id="profile-avatar-large">${avatarContent}</div>
            <button class="edit-avatar-button" id="edit-profile-avatar-button">${profileState.avatarUrl ? 'Change Photo' : '+ Add Photo'}</button>
            <div class="profile-username">${username}</div>
            <div class="profile-bio">${bio}</div>
          </div>

          <!-- Edit Bio Menu Item -->
          <div class="profile-menu-item" id="edit-bio-menu-item">
            <span class="menu-icon">✏️</span>
            <span class="menu-label">Edit Bio</span>
            <span class="menu-chevron">›</span>
          </div>

          <!-- Wallet Card -->
          <div class="profile-wallet-card">
            <div class="wallet-info">
              <div class="wallet-label">Usernode Address</div>
              <div class="wallet-address">${walletAddress ? shortAddress : 'No wallet linked yet'}</div>
            </div>
            ${walletAddress ? '<button class="wallet-copy-btn" id="wallet-copy-btn" aria-label="Copy address">📋</button>' : ''}
          </div>
        </div>
      </div>
    `;

    // Change/Add Photo button - Select Photo -> Preview -> Use Photo dialog,
    // same flow and same shared upload helper as group/channel avatars.
    document.getElementById('edit-profile-avatar-button').addEventListener('click', () => {
      showAvatarUploadDialog({
        title: 'Change Profile Photo',
        currentAvatarHtml: profileState.avatarUrl ? renderCommunityAvatar(profileState.avatarUrl, username) : initials,
        onSave: async (file) => {
          const uploaded = await uploadAvatarPhoto(file);
          const oldImageId = profileState.avatarImageId || null;

          const response = await fetch('/api/profile', {
            method: 'PUT',
            headers: authHeaders({ 'content-type': 'application/json' }),
            body: JSON.stringify({ avatarUrl: uploaded.url, avatarImageId: uploaded.id })
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || 'Failed to update avatar.');
          }

          profileState.avatarUrl = uploaded.url;
          profileState.avatarImageId = uploaded.id;
          renderProfilePage();
          showToast('Photo updated', { type: 'success' });

          if (oldImageId && window.usernode && window.usernode.deleteFile) {
            window.usernode.deleteFile(oldImageId).catch(() => {});
          }
        }
      });
    });

    // Edit Bio menu item
    document.getElementById('edit-bio-menu-item').addEventListener('click', () => {
      window.location.hash = '/profile/edit-bio';
    });

    // Wallet copy button (only present when a wallet is linked)
    const walletCopyBtn = document.getElementById('wallet-copy-btn');
    if (walletCopyBtn) {
      walletCopyBtn.addEventListener('click', () => {
        const copyFallback = () => {
          const textarea = document.createElement('textarea');
          textarea.value = walletAddress;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();

          let copied = false;
          try {
            copied = document.execCommand('copy');
          } catch (err) {
            copied = false;
          }
          document.body.removeChild(textarea);

          if (copied) {
            showToast('Address copied', { type: 'success' });
          } else {
            window.prompt('Copy this address:', walletAddress);
          }
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(walletAddress).then(() => {
            showToast('Address copied', { type: 'success' });
          }).catch(() => {
            copyFallback();
          });
        } else {
          copyFallback();
        }
      });
    }
  }

  function renderProfileEditBioPage() {
    const currentBio = profileState.bio;

    pageContainer.innerHTML = `
      <div class="profile-edit-bio-page">
        <div class="edit-bio-header">
          <button class="back-button" id="edit-bio-back-btn" aria-label="Back to profile">←</button>
          <h1>Edit Bio</h1>
          <div style="width: 32px;"></div>
        </div>

        <div class="edit-bio-content">
          <textarea id="bio-textarea" class="bio-textarea" maxlength="50" placeholder="Write your bio...">${currentBio}</textarea>
          <div class="char-count"><span id="bio-char-count">${currentBio.length}</span>/50</div>
        </div>

        <div class="edit-bio-footer">
          <button class="button-secondary" id="edit-bio-cancel-btn">Cancel</button>
          <button class="button-primary" id="edit-bio-save-btn">Save</button>
        </div>
      </div>
    `;

    // Back button
    document.getElementById('edit-bio-back-btn').addEventListener('click', () => {
      window.location.hash = '/profile';
    });

    // Character count update
    const textarea = document.getElementById('bio-textarea');
    const charCount = document.getElementById('bio-char-count');
    textarea.addEventListener('input', () => {
      charCount.textContent = textarea.value.length;
    });

    // Cancel button
    document.getElementById('edit-bio-cancel-btn').addEventListener('click', () => {
      window.location.hash = '/profile';
    });

    // Save button
    document.getElementById('edit-bio-save-btn').addEventListener('click', () => {
      profileState.bio = textarea.value;
      window.location.hash = '/profile';
      fetch('/api/profile', {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ bio: profileState.bio })
      }).catch(err => console.warn('Could not save bio to profile:', err));
    });

    // Auto-focus textarea
    textarea.focus();
  }

  // Render a placeholder page
  function renderPage(pageName) {
    const page = pages[pageName];
    if (!page) {
      renderPage('messages');
      return;
    }

    // Special handling for messages page
    if (pageName === 'messages') {
      // Screenshot-state: mute the first DM the same way the long-press
      // action sheet's Mute option would, so dapp.json can assert the muted
      // indicator renders deterministically (a long-press gesture itself
      // can't be driven by a plain navigation).
      if (SHOT_MESSAGES_MUTED) {
        const target = conversations.find(c => c.type === 'direct' && !c.hiddenFromInbox);
        if (target) {
          if (!target.mutedByUsers) target.mutedByUsers = {};
          target.mutedByUsers['user_self'] = true;
        }
      }
      renderMessagesPage(
        SHOT_REQUESTS_TAB ? 'requests' :
        ((SHOT_GROUPS_TAB || SHOT_NOTIFICATIONS_SHEET) ? 'groups' : null)
      );
      // Screenshot-state: walk the same long-press the user makes (select the
      // first row) so dapp.json can assert on the selection toolbar deterministically.
      if (SHOT_MESSAGES_SELECT) {
        const firstConv = filterConversations('all', '')[0];
        if (firstConv) startConversationSelection(firstConv.id);
      }
      // Screenshot-state: open the long-press action sheet on the first row
      // (a long-press itself can't be driven by a plain navigation) so
      // dapp.json can assert the Select/Pin/Mute labels render.
      if (SHOT_MESSAGES_ACTIONS) {
        const firstConv = filterConversations('all', '')[0];
        const rowEl = firstConv ? document.querySelector(`.conversation-item[data-conversation-id="${firstConv.id}"]`) : null;
        if (firstConv) openConversationActionSheet(firstConv.id, rowEl);
      }
    } else if (pageName === 'create') {
      renderNewMessagePage();
    } else if (pageName === 'discover') {
      renderDiscoverPage();
    } else if (pageName === 'profile') {
      fetchUserData().then(() => renderProfilePage());
    } else {
      pageContainer.innerHTML = `
        <div class="page">
          <h1>Guardian</h1>
        </div>
      `;
    }

    // Update active tab
    navTabs.forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.page === pageName) {
        tab.classList.add('active');
      }
    });
  }

  // Handle navigation via hash
  function handleNavigation() {
    // Any navigation leaves whatever thread was polling -- the destination
    // page starts its own polling if it's itself a conversation/group/channel
    // screen. Without this, an old thread's poll would keep firing and its
    // onChanged callback would yank the user back into that thread's render
    // out from under whatever screen they navigated to.
    stopThreadPolling();
    stopTypingPolling();
    clearActiveTypingBestEffort();
    stopMessagesListPolling();
    // Defense-in-depth: a reply target left set on the thread we're leaving
    // should not still be sitting there if the user comes back to it later
    // expecting a clean composer. The per-conversation keying above already
    // stops it from leaking into whatever thread we're navigating TO.
    if (currentOpenConversationId) clearReplyState(currentOpenConversationId);
    currentOpenConversationId = null;

    const hash = window.location.hash.slice(1) || 'messages';
    const path = hash.startsWith('/') ? hash.slice(1) : hash;
    const priorHash = previousNavigationHash;
    previousNavigationHash = hash;

    // Parse conversation routes like "conversation/conv_1"
    if (path.startsWith('conversation/')) {
      const conversationId = path.split('/')[1];
      // Remove active from all nav tabs when on conversation screen
      navTabs.forEach(tab => tab.classList.remove('active'));
      // Hide bottom nav on conversation screen
      bottomNav.style.display = 'none';
      renderConversationPage(conversationId);
    } else if (path.startsWith('group/')) {
      const parts = path.split('/');
      const groupId = parts[1];
      const action = parts[2];

      // The info/add-members/join-requests screens are still member/admin-only.
      // The base chat route below renders for non-members too (Discover clicks
      // and invite links both land there), showing a Join/Request action bar
      // in place of the composer.
      const joinedGroup = groups.find(g => g.id === groupId);
      const isMember = !!joinedGroup && joinedGroup.members.some(m => m.id === 'user_self');

      if (action && !isMember) {
        window.location.hash = `/group/${groupId}`;
        return;
      }

      // Add Members and Join Requests are restricted to owner/admin
      const myRole = isMember ? (joinedGroup.members.find(m => m.id === 'user_self') || {}).role : null;
      const canManageMembers = myRole === 'owner' || myRole === 'admin';

      // Remove active from all nav tabs when on group screen
      navTabs.forEach(tab => tab.classList.remove('active'));
      // Hide bottom nav on group screen
      bottomNav.style.display = 'none';

      if (action === 'info') {
        renderGroupInfoPage(groupId);
      } else if (action === 'add-members') {
        if (!canManageMembers) {
          window.location.hash = `/group/${groupId}/info`;
          return;
        }
        renderAddMembersPage(groupId);
      } else if (action === 'join-requests') {
        renderJoinRequestsPage(groupId);
      } else {
        groupChannelBackTarget = computeGroupChannelBackTarget(priorHash);
        renderGroupConversationPage(groupId);
      }
    } else if (path.startsWith('channel/')) {
      const parts = path.split('/');
      const channelId = parts[1];
      const action = parts[2];

      // The info/add-admins screens are owner/admin-only. The base view route
      // below stays open to everyone (Discover clicks and follow/mute all
      // happen there).
      const targetChannel = channels.find(c => c.id === channelId);
      const canManageChannel = isCurrentUserChannelAdmin(targetChannel);

      if (action && !canManageChannel) {
        window.location.hash = `/channel/${channelId}`;
        return;
      }

      // Remove active from all nav tabs when on channel screen
      navTabs.forEach(tab => tab.classList.remove('active'));
      // Hide bottom nav on channel screen
      bottomNav.style.display = 'none';

      if (action === 'info') {
        renderChannelInfoPage(channelId);
      } else if (action === 'add-admins') {
        renderChannelAddAdminsPage(channelId);
      } else {
        groupChannelBackTarget = computeGroupChannelBackTarget(priorHash);
        renderChannelView(channelId);
      }
    } else if (path === 'create-group') {
      // Hide bottom nav on create group screen
      bottomNav.style.display = 'none';
      // Remove active from all nav tabs
      navTabs.forEach(tab => tab.classList.remove('active'));
      renderCreateGroupPage();
    } else if (path === 'create-channel') {
      // Hide bottom nav on create channel screen
      bottomNav.style.display = 'none';
      // Remove active from all nav tabs
      navTabs.forEach(tab => tab.classList.remove('active'));
      renderCreateChannelPage();
    } else if (path === 'profile/edit-bio') {
      // Hide bottom nav on edit bio screen
      bottomNav.style.display = 'none';
      // Remove active from all nav tabs
      navTabs.forEach(tab => tab.classList.remove('active'));
      renderProfileEditBioPage();
    } else if (path === 'discover' || path.startsWith('discover?')) {
      bottomNav.style.display = 'flex';
      renderDiscoverPage();
    } else {
      // Show bottom nav on all other screens
      bottomNav.style.display = 'flex';
      renderPage(path);
    }
  }

  // Set up nav tab click handlers
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const pageName = tab.dataset.page;
      window.location.hash = `/${pageName}`;
    });
  });

  // Listen for hash changes
  window.addEventListener('hashchange', handleNavigation);

  // Re-sync whatever's on screen when the tab regains focus or the network
  // comes back -- see resyncActiveScreen above.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      resyncActiveScreen();
      checkServerVersion();
    }
  });
  window.addEventListener('online', () => {
    resyncActiveScreen();
    checkServerVersion();
  });

  // Initial render. Identity is hydrated first so the first paint already
  // knows who "You" is (groups/channels tag ownership off currentUser).
  // Everything after that has no cross-dependency except "the SHOT_* delivery
  // fetches must land before hydrateServerDirectConversations reads them" and
  // "hydrateConversationUserState must run after conversations/groups/channels
  // are populated" (it only attaches overrides onto entries that already
  // exist) -- so those are the only two serialization points kept. On a real
  // (non-loopback) staging deploy, this cuts the boot-to-first-render chain
  // from ~7 sequential round trips down to 3, which matters because
  // handleNavigation() (the actual page render) doesn't run until this whole
  // async function resolves.
  (async () => {
    await fetchUserData();

    // Screenshot-state: the real trigger is a version mismatch discovered on
    // a later foreground/reconnect check (see checkServerVersion), which the
    // dapp.json test harness can't simulate by firing a synthetic event --
    // it can only navigate. Force the check once, right after boot, so the
    // banner is deterministically present for a plain page load.
    if (SHOT_STALE_VERSION) checkServerVersion();

    let shotPersistRemovalGroupId = null;
    let shotPersistRemovalChannelId = null;
    if (SHOT_PERSIST_REMOVAL) {
      // Screenshot-state: create a real group and channel owned by the current
      // tester, and message a fixture peer, BEFORE the first hydration below --
      // so this shot's own leave/unfollow/hide actions have something real to
      // remove, rather than racing hydrateServerGroups/hydrateServerChannels.
      try {
        const groupRes = await fetch('/api/groups', {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ name: 'Shot persist removal group', members: [SHOT_PERSIST_REMOVAL_PEER_ID] })
        });
        const groupPayload = await groupRes.json();
        shotPersistRemovalGroupId = groupPayload.group && groupPayload.group.id;

        const channelRes = await fetch('/api/channels', {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ name: 'Shot persist removal channel' })
        });
        const channelPayload = await channelRes.json();
        shotPersistRemovalChannelId = channelPayload.channel && channelPayload.channel.id;

        await fetch(`/api/messages/direct/${SHOT_PERSIST_REMOVAL_PEER_ID}`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ id: `shot_persist_removal_${Date.now()}`, text: SHOT_PERSIST_REMOVAL_TEXT })
        });
      } catch (error) {
        console.warn('Could not set up shot persist-removal fixtures:', error);
      }
    }

    if (SHOT_DM_UNHIDE_ON_MESSAGE) {
      // Screenshot-state: message a fixture peer, then hide the resulting DM
      // through the real Delete Chat endpoint -- BEFORE the first hydration
      // below -- so the "send unhides it" check further down starts from a
      // thread that's genuinely hidden server side, not just client state.
      try {
        await fetch(`/api/messages/direct/${SHOT_DM_UNHIDE_PEER_ID}`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ id: `shot_unhide_before_${Date.now()}`, text: SHOT_DM_UNHIDE_TEXT_BEFORE_HIDE })
        });
        await fetch(`/api/conversations/conv_${SHOT_DM_UNHIDE_PEER_ID}/state`, {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ hiddenFromInbox: true })
        });
      } catch (error) {
        console.warn('Could not set up shot dm-unhide-on-message fixtures:', error);
      }
    }

    await Promise.all([
      fetchSuggestedUsers(),
      hydrateServerGroups(),
      hydrateServerChannels(),
      (async () => {
        // Screenshot-state: deliver a real DM before hydrating, so the Messages
        // list's server-backed preview/timestamp pick it up on first paint --
        // regression check for a bug where a freshly-hydrated conversation's
        // preview stayed blank forever.
        if (SHOT_DC_PREVIEW) {
          try {
            await fetch(`/api/messages/direct/${SHOT_DC_PREVIEW_PEER_ID}`, {
              method: 'POST',
              headers: authHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({ id: `shot_dc_${Date.now()}`, text: SHOT_DC_PREVIEW_TEXT })
            });
          } catch (error) {
            console.warn('Could not deliver shot dc-preview message:', error);
          }
        }
        // Screenshot-state: message a fixture peer that already has a pending
        // request seeded against 'user_self' (see SHOT_DM_NO_DUP_PEER_ID above).
        // Regression check for getOrCreateDirectConversation's sentinel-matching
        // bug: it used to compare the fixture's counterpart only against the
        // alphabetically-later of the two ids, so it missed the existing pending
        // row whenever the caller's real id sorted after the fixture's, and
        // created a second, duplicate direct_conversations row underneath it.
        if (SHOT_DM_NO_DUP) {
          try {
            await fetch(`/api/messages/direct/${SHOT_DM_NO_DUP_PEER_ID}`, {
              method: 'POST',
              headers: authHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({ id: `shot_nodup_${Date.now()}`, text: SHOT_DM_NO_DUP_TEXT })
            });
          } catch (error) {
            console.warn('Could not deliver shot dm-no-dup message:', error);
          }
        }
        if (SHOT_DM_RELOAD_LO || SHOT_DM_RELOAD_HI) {
          const peerId = SHOT_DM_RELOAD_LO ? SHOT_DM_RELOAD_LO_PEER_ID : SHOT_DM_RELOAD_HI_PEER_ID;
          try {
            await fetch(`/api/messages/direct/${peerId}`, {
              method: 'POST',
              headers: authHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({ id: `shot_reload_${Date.now()}`, text: SHOT_DM_RELOAD_TEXT })
            });
          } catch (error) {
            console.warn('Could not deliver shot dm-reload message:', error);
          }
        }
        if (SHOT_DM_USERNAME_DUP) {
          try {
            await fetch(`/api/messages/direct/${SHOT_DM_USERNAME_DUP_PEER_ID_1}`, {
              method: 'POST',
              headers: authHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({ id: `shot_userdup_1_${Date.now()}`, text: SHOT_DM_USERNAME_DUP_TEXT_1 })
            });
            await fetch(`/api/messages/direct/${SHOT_DM_USERNAME_DUP_PEER_ID_2}`, {
              method: 'POST',
              headers: authHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({ id: `shot_userdup_2_${Date.now()}`, text: SHOT_DM_USERNAME_DUP_TEXT_2 })
            });
          } catch (error) {
            console.warn('Could not deliver shot dm-username-dup messages:', error);
          }
        }
        if (SHOT_DM_DELETE) {
          try {
            await fetch(`/api/messages/direct/${SHOT_DM_DELETE_PEER_ID}`, {
              method: 'POST',
              headers: authHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({ id: SHOT_DM_DELETE_MSG_ID, text: SHOT_DM_DELETE_TEXT })
            });
            await fetch(`/api/messages/direct/${SHOT_DM_DELETE_PEER_ID}/${SHOT_DM_DELETE_MSG_ID}/delete`, {
              method: 'POST',
              headers: authHeaders()
            });
          } catch (error) {
            console.warn('Could not deliver/delete shot dm-delete message:', error);
          }
        }
        await Promise.all([
          hydrateServerDirectConversations(),
          hydrateMessageRequests()
        ]);
      })()
    ]);
    await hydrateConversationUserState();

    if (SHOT_PERSIST_REMOVAL) {
      // Leave the group, unfollow the channel, and hide the DM through the
      // same real endpoints the Leave/Unfollow/Delete Chat UI actions call.
      try {
        if (shotPersistRemovalGroupId) {
          await fetch(`/api/groups/${shotPersistRemovalGroupId}/leave`, { method: 'POST', headers: authHeaders() });
        }
        if (shotPersistRemovalChannelId) {
          await fetch(`/api/channels/${shotPersistRemovalChannelId}/follow`, { method: 'DELETE', headers: authHeaders() });
        }
        await fetch(`/api/conversations/conv_${SHOT_PERSIST_REMOVAL_PEER_ID}/state`, {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ hiddenFromInbox: true })
        });
      } catch (error) {
        console.warn('Could not remove shot persist-removal fixtures:', error);
      }

      // Simulate closing and reopening the app: wipe the in-memory lists (they
      // normally start empty on every page load, see the `let conversations =
      // []` etc. declarations above) and re-run the exact hydration the real
      // boot sequence uses. If the removals above didn't actually persist
      // server side, one or more of these would reappear right here.
      conversations.length = 0;
      groups.length = 0;
      channels.length = 0;
      discoverGroups.length = 0;
      discoverChannels.length = 0;
      await Promise.all([
        hydrateServerGroups(),
        hydrateServerChannels(),
        hydrateServerDirectConversations()
      ]);
      await hydrateConversationUserState();

      const stillPresent =
        (shotPersistRemovalGroupId && conversations.some(c => c.type === 'group' && c.groupId === shotPersistRemovalGroupId) ? 1 : 0) +
        (shotPersistRemovalChannelId && conversations.some(c => c.type === 'channel' && c.channelId === shotPersistRemovalChannelId) ? 1 : 0) +
        (conversations.some(c => c.type === 'direct' && c.id === 'conv_' + SHOT_PERSIST_REMOVAL_PEER_ID && !c.hiddenFromInbox) ? 1 : 0);

      const marker = document.createElement('div');
      marker.setAttribute('data-testid', 'persist-removal-count');
      marker.setAttribute('data-count', String(stillPresent));
      marker.style.display = 'none';
      marker.textContent = 'StillPresent:' + stillPresent;
      document.body.appendChild(marker);
    }

    if (SHOT_DM_UNHIDE_ON_MESSAGE) {
      // The DM was hidden through the real endpoint before hydration above --
      // hydration still loads the row (hiding only affects Messages-list
      // rendering), but its hiddenFromInbox flag must be true here.
      const hiddenAfterSetup = conversations.some(c => c.type === 'direct' && c.id === 'conv_' + SHOT_DM_UNHIDE_PEER_ID && c.hiddenFromInbox);

      // Send another message into the hidden thread -- the fixed send route
      // should clear hidden_from_inbox for this side as part of handling it.
      try {
        await fetch(`/api/messages/direct/${SHOT_DM_UNHIDE_PEER_ID}`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ id: `shot_unhide_after_${Date.now()}`, text: SHOT_DM_UNHIDE_TEXT_AFTER_HIDE })
        });
      } catch (error) {
        console.warn('Could not deliver shot dm-unhide-on-message follow-up:', error);
      }

      // Simulate closing and reopening the app so this proves the unhide was
      // persisted server side, not just applied to this tab's in-memory list.
      conversations.length = 0;
      await hydrateServerDirectConversations();
      await hydrateConversationUserState();

      const visibleAfterMessage =
        conversations.some(c => c.type === 'direct' && c.id === 'conv_' + SHOT_DM_UNHIDE_PEER_ID && !c.hiddenFromInbox);

      const marker = document.createElement('div');
      marker.setAttribute('data-testid', 'unhide-on-message-result');
      marker.setAttribute('data-hidden-after-setup', String(hiddenAfterSetup));
      marker.setAttribute('data-visible-after-message', String(visibleAfterMessage));
      marker.style.display = 'none';
      marker.textContent = 'HiddenAfterSetup:' + hiddenAfterSetup + ' VisibleAfterMessage:' + visibleAfterMessage;
      document.body.appendChild(marker);
    }

    // Screenshot-state: clear the first real DM's chat via the real Clear Chat
    // function, so "no messages yet" is reachable from a plain deep link on
    // whichever real/staging-seeded DM this account has, not a fixture id.
    if (SHOT_DM_CLEARED) {
      const target = conversations.find(c => c.type === 'direct');
      if (target) clearDMChat(target.id);
    }

    if (SHOT_DM_NO_DUP) {
      // A duplicate direct_conversations row for the same peer would surface
      // as this peer being reachable through BOTH the Messages list (a
      // freshly-created pending_sent conversation) and the Requests tab (the
      // original seeded incoming request) -- two separate references to what
      // should be a single conversation. Correct behavior reuses the existing
      // row, so the caller's message just joins the pending incoming request
      // and this total stays at 1.
      const refCount =
        conversations.filter(c => c.id === 'conv_' + SHOT_DM_NO_DUP_PEER_ID).length +
        requests.filter(r => r.senderId === SHOT_DM_NO_DUP_PEER_ID).length;
      const marker = document.createElement('div');
      marker.setAttribute('data-testid', 'dm-no-dup-count');
      marker.setAttribute('data-count', String(refCount));
      marker.style.display = 'none';
      marker.textContent = 'DupRefs:' + refCount;
      document.body.appendChild(marker);
    }
    if (SHOT_DM_USERNAME_DUP) {
      // Two different peer ids share the same username here -- a correctly
      // deduped inbox shows exactly ONE conversation entry for that username,
      // no matter which of the two ids it ends up keyed under.
      const refCount = conversations.filter(
        c => (c.username || '').toLowerCase() === SHOT_DM_USERNAME_DUP_USERNAME
      ).length;
      const marker = document.createElement('div');
      marker.setAttribute('data-testid', 'dm-username-dup-count');
      marker.setAttribute('data-count', String(refCount));
      marker.style.display = 'none';
      marker.textContent = 'UsernameDupRefs:' + refCount;
      document.body.appendChild(marker);

      // Regression check for GET /api/messages/direct/:peerId only matching
      // an exact stored id: messaging PEER_ID_2 above reuses PEER_ID_1's row
      // and reconciles its stored user_id_a/user_id_b to the caller+PEER_ID_2
      // pair (see getOrCreateDirectConversation), so PEER_ID_1 is now a
      // *stale* id for that same conversation. Fetching history by that
      // stale id directly (bypassing the inbox, which by now only ever
      // references PEER_ID_2) must still return both messages via the
      // peer-username fallback, not an empty thread.
      let staleHistoryCount = 0;
      try {
        const staleRes = await fetch(`/api/messages/direct/${SHOT_DM_USERNAME_DUP_PEER_ID_1}`, {
          headers: authHeaders()
        });
        const staleData = await staleRes.json();
        const staleTexts = (staleData.messages || []).map(m => m.text);
        staleHistoryCount =
          (staleTexts.includes(SHOT_DM_USERNAME_DUP_TEXT_1) ? 1 : 0) +
          (staleTexts.includes(SHOT_DM_USERNAME_DUP_TEXT_2) ? 1 : 0);
      } catch (error) {
        console.warn('Could not fetch shot dm-username-dup stale history:', error);
      }
      const staleMarker = document.createElement('div');
      staleMarker.setAttribute('data-testid', 'dm-username-dup-stale-history-count');
      staleMarker.setAttribute('data-count', String(staleHistoryCount));
      staleMarker.style.display = 'none';
      staleMarker.textContent = 'StaleHistoryMessages:' + staleHistoryCount;
      document.body.appendChild(staleMarker);
    }
    // Screenshot-state: force the session-expired banner on boot via the real
    // authFetch 401-handling path, rather than just rendering the banner markup
    // directly, so the deep link exercises the actual detection code.
    if (SHOT_SESSION_EXPIRED) {
      handleSessionExpired();
    }
    // Screenshot-state: plant a reply target on SOURCE before handleNavigation
    // below opens TARGET, simulating a user who tapped "reply" in one thread
    // and then switched to another without cancelling it.
    if (SHOT_REPLY_LEAK) {
      setReplyState(SHOT_REPLY_LEAK_SOURCE_CONVERSATION_ID, 'shot_reply_leak_src_msg', 'staging-demo-dedi', 'Message from a different conversation');
    }
    handleNavigation();
  })();
});
