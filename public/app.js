// Guardian app - bottom navigation router
document.addEventListener('DOMContentLoaded', () => {
  console.log('Guardian app loaded');

  // Get token from URL or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
    localStorage.setItem('usernode-token', token);
  }

  // Screenshot-state deep links. Each boots a long, deterministic thread so
  // interaction-gated UI is reachable from a plain URL. Pure UI state — nothing
  // is persisted, and none of it is gated on the environment.
  //
  //   ?shot=scroll-fab        thread parked at the TOP    → FAB must be on screen
  //   ?shot=scroll-fab-bottom thread parked at the BOTTOM → FAB must be hidden
  //   ?shot=send-stay         sends one message on load   → thread must survive
  //   ?shot=message-deleted   forces group_1's seeded deleted messages         → placeholder must render
  //   ?shot=dm-menu           clicks the DM header's ⋮ button on load          → options menu must render
  //   ?shot=dm-cleared        clears conv_1's chat via the real Clear Chat fn  → list preview must read "No messages yet"
  //   ?shot=post-reactions    long-presses the first post card                  → reaction picker must render
  //   ?shot=forward-sheet     ⋯ menu → Forward on the first post              → target rows + enabled Send must render
  //   ?shot=post-menu         opens the first post's ⋯ menu                    → Forward / Copy text (+ owner items) must render
  //   ?shot=post-edit         opens Edit Post on the first post (owner only)   → dialog prefilled with the post text must render
  //   ?shot=create-group-public       selects Public on Create Group           → #privacy-public-btn must be active
  //   ?shot=create-group-one-member   name + exactly ONE invitee               → Create Group must be enabled
  //   ?shot=create-group-zero-members name only, then submits                  → "Select at least 1 member" must render
  //
  // The top/bottom pair matters: asserting only "the FAB is visible" would still
  // pass if the FAB were visible unconditionally, so the bottom state pins the
  // other direction.
  const SHOT = urlParams.get('shot') || '';
  const SHOT_SCROLL_FAB = SHOT === 'scroll-fab';
  const SHOT_SCROLL_FAB_BOTTOM = SHOT === 'scroll-fab-bottom';
  const SHOT_SEND_STAY = SHOT === 'send-stay';
  const SHOT_MESSAGE_DELETED = SHOT === 'message-deleted';
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
  const SHOT_LONG_THREAD = SHOT_SCROLL_FAB || SHOT_SCROLL_FAB_BOTTOM || SHOT_SEND_STAY;
  const SHOT_SEND_TEXT = 'Shot send stay check';
  const SHOT_CREATE_GROUP_NAME = 'Staging demo one-invite group';

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

  const pageContainer = document.getElementById('page-container');
  const bottomNav = document.getElementById('bottom-nav');
  const navTabs = document.querySelectorAll('.nav-tab');

  // Dummy conversations data with messages
  let conversations = [
    {
      id: 'conv_1',
      type: 'direct',
      username: 'Alice Chen',
      avatar: 'AC',
      lastMessage: 'That sounds great! Let\'s meet up soon.',
      timestamp: Date.now() - 2 * 60 * 1000, // 2 minutes ago
      unreadCount: 2,
      onlineStatus: true,
      archived: false,
      pinned: true,
      mutedByUsers: {},
      messages: [
        { id: 'msg_1', text: "Hey! How's it going?", timestamp: Date.now() - 5*60*1000, isOutgoing: false },
        { id: 'msg_2', text: "Great! Just finished work", timestamp: Date.now() - 4.5*60*1000, isOutgoing: true },
        { id: 'msg_3', text: "Nice! Want to grab dinner?", timestamp: Date.now() - 4*60*1000, isOutgoing: false, isPinned: true },
        { id: 'msg_4', text: "Sure! When?", timestamp: Date.now() - 3.5*60*1000, isOutgoing: true },
        { id: 'msg_5', text: "How about 7pm?", timestamp: Date.now() - 3*60*1000, isOutgoing: false },
        { id: 'msg_6', text: "That sounds great! Let's meet up soon.", timestamp: Date.now() - 2*60*1000, isOutgoing: true, replyTo: { messageId: 'msg_5', senderName: 'Alice Chen', previewText: 'How about 7pm?' } }
      ]
    },
    {
      id: 'conv_2',
      type: 'direct',
      username: 'Bob Wilson',
      avatar: 'BW',
      lastMessage: '↗ Mainnet Beta is Live 🚀',
      timestamp: Date.now() - 30 * 60 * 1000, // 30 minutes ago
      unreadCount: 0,
      onlineStatus: false,
      archived: false,
      pinned: false,
      mutedByUsers: {},
      messages: [
        { id: 'msg_1', text: "Check out the new features", timestamp: Date.now() - 2*60*60*1000, isOutgoing: false },
        { id: 'msg_2', text: "Looking good!", timestamp: Date.now() - 1.5*60*60*1000, isOutgoing: true },
        { id: 'msg_3', text: "Did you see the latest updates?", timestamp: Date.now() - 60*60*1000, isOutgoing: false },
        {
          id: 'msg_4',
          text: 'Mainnet Beta is Live 🚀\n\nExciting times ahead as we launch the next phase of development!',
          timestamp: Date.now() - 30*60*1000,
          isOutgoing: true,
          forwardedFrom: { channelId: 'channel_1', channelName: 'Solana Indonesia', channelAvatar: 'SI', postId: 'post_1' }
        }
      ]
    },
    {
      id: 'conv_3',
      type: 'direct',
      username: 'Carol Davis',
      avatar: 'CD',
      lastMessage: 'Thanks for the help yesterday!',
      timestamp: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago (yesterday)
      unreadCount: 1,
      onlineStatus: true,
      archived: false,
      pinned: false,
      mutedByUsers: {},
      messages: [
        { id: 'msg_1', text: "I need some help with a project", timestamp: Date.now() - 26*60*60*1000, isOutgoing: false },
        { id: 'msg_2', text: "Happy to help! What do you need?", timestamp: Date.now() - 25.5*60*60*1000, isOutgoing: true },
        { id: 'msg_3', text: "Can you review this code?", timestamp: Date.now() - 25*60*60*1000, isOutgoing: false },
        { id: 'msg_4', text: "Of course, sending notes now", timestamp: Date.now() - 24.5*60*60*1000, isOutgoing: true },
        { id: 'msg_5', text: "Thanks for the help yesterday!", timestamp: Date.now() - 24*60*60*1000, isOutgoing: false }
      ]
    },
    {
      id: 'conv_4',
      type: 'direct',
      username: 'David Lee',
      avatar: 'DL',
      lastMessage: 'Looking forward to the event next week',
      timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
      unreadCount: 0,
      onlineStatus: false,
      archived: false,
      pinned: false,
      mutedByUsers: {},
      messages: [
        { id: 'msg_1', text: "See you at the event!", timestamp: Date.now() - 3*24*60*60*1000, isOutgoing: false },
        { id: 'msg_2', text: "Definitely! Can't wait", timestamp: Date.now() - 2.5*24*60*60*1000, isOutgoing: true },
        { id: 'msg_3', text: "Looking forward to the event next week", timestamp: Date.now() - 2*24*60*60*1000, isOutgoing: false }
      ]
    }
  ];

  // Dummy suggested users data
  const suggestedUsers = [
    { id: 'user_1', username: 'aksaranft', avatar: 'AN', domain: 'aksaranft.node' },
    { id: 'user_2', username: 'cryptosmith', avatar: 'CS', domain: 'smith.crypto' },
    { id: 'user_3', username: 'nodeart', avatar: 'NA', domain: 'art.node' },
    { id: 'user_4', username: 'vibemaster', avatar: 'VM', domain: 'vibe.eth' },
    { id: 'user_5', username: 'chainwizard', avatar: 'CW', domain: 'wizard.node' },
    { id: 'user_6', username: 'nftcollector', avatar: 'NC', domain: 'collector.crypto' },
    { id: 'user_7', username: 'webbuilder', avatar: 'WB', domain: 'web.node' },
    { id: 'user_8', username: 'designpro', avatar: 'DP', domain: 'design.eth' }
  ];

  // Dummy groups data with messages
  let groups = [
    {
      id: 'group_1',
      name: 'Seeker Club',
      avatar: 'SC',
      description: 'A community of seekers and explorers',
      memberCount: 128,
      visibility: 'public',
      creatorId: 'user_self',
      members: [
        { id: 'user_self', username: 'You', role: 'owner' },
        { id: 'user_alice', username: 'Alice', role: 'admin' },
        { id: 'user_bob', username: 'Bob', role: 'member' },
        { id: 'user_charlie', username: 'Charlie', role: 'member' }
      ],
      joinRequests: [],
      messages: [
        { id: 'msg_1', senderId: 'user_alice', senderName: 'Alice', text: 'Hey everyone!', timestamp: Date.now() - 10*60*1000, isOutgoing: false },
        { id: 'msg_2', senderId: 'user_bob', senderName: 'Bob', text: 'Welcome to the group!', timestamp: Date.now() - 9*60*1000, isOutgoing: false, isDeleted: true },
        { id: 'msg_3', senderId: 'user_self', text: 'Thanks for adding me!', timestamp: Date.now() - 8*60*1000, isOutgoing: true },
        { id: 'msg_4', senderId: 'user_charlie', senderName: 'Charlie', text: 'Great to have you here!', timestamp: Date.now() - 7*60*1000, isOutgoing: false, isDeleted: true, deletedByAdmin: true },
        { id: 'msg_5', senderId: 'user_alice', senderName: 'Alice', text: 'Let\'s catch up soon!', timestamp: Date.now() - 6*60*1000, isOutgoing: false },
        { id: 'msg_6', senderId: 'user_self', text: 'Absolutely! Looking forward to it.', timestamp: Date.now() - 5*60*1000, isOutgoing: true, replyTo: { messageId: 'msg_5', senderName: 'Alice', previewText: "Let's catch up soon!" } },
        {
          id: 'msg_7',
          senderId: 'user_self',
          text: 'Mainnet Beta is Live 🚀\n\nExciting times ahead as we launch the next phase of development!',
          timestamp: Date.now() - 4*60*1000,
          isOutgoing: true,
          forwardedFrom: { channelId: 'channel_1', channelName: 'Solana Indonesia', channelAvatar: 'SI', postId: 'post_1' }
        }
      ]
    },
    {
      id: 'group_2',
      name: 'Design Team',
      avatar: 'DT',
      description: 'Collaborate on visual designs and UI/UX',
      memberCount: 3,
      visibility: 'private',
      creatorId: 'user_8',
      members: [
        { id: 'user_self', username: 'You', role: 'member' },
        { id: 'user_1', username: 'aksaranft', role: 'member' },
        { id: 'user_8', username: 'designpro', role: 'owner' }
      ],
      joinRequests: [
        { userId: 'user_join_req_1', username: 'Staging Demo User', requestedAt: Date.now() - 2*60*60*1000 },
        { userId: 'user_join_req_2', username: 'Staging Demo User 2', requestedAt: Date.now() - 45*60*1000 }
      ],
      messages: [
        { id: 'msg_1', senderId: 'user_8', senderName: 'designpro', text: 'Just posted the new mockups', timestamp: Date.now() - 30*60*1000, isOutgoing: false },
        { id: 'msg_2', senderId: 'user_self', text: 'Thanks! Reviewing now', timestamp: Date.now() - 25*60*1000, isOutgoing: true }
      ]
    },
    {
      // Admin-but-not-creator: proves the Create menu lists groups the user
      // administers, not just the ones they created.
      id: 'group_3',
      name: 'Guardian Mods',
      avatar: 'GM',
      description: 'Moderation crew for the Guardian community',
      memberCount: 12,
      visibility: 'private',
      creatorId: 'user_1',
      createdAt: Date.now() - 18*24*60*60*1000,
      members: [
        { id: 'user_1', username: 'aksaranft', role: 'owner' },
        { id: 'user_self', username: 'You', role: 'admin' },
        { id: 'user_3', username: 'nodeart', role: 'member' }
      ],
      joinRequests: [],
      messages: [
        { id: 'msg_1', senderId: 'user_1', senderName: 'aksaranft', text: 'Added you as a mod — welcome aboard!', timestamp: Date.now() - 3*60*60*1000, isOutgoing: false },
        { id: 'msg_2', senderId: 'user_self', text: 'On it. I\'ll watch the reports queue.', timestamp: Date.now() - 2.5*60*60*1000, isOutgoing: true }
      ]
    },
    {
      id: 'group_4',
      name: 'Alpha Signals',
      avatar: 'AS',
      description: 'Early calls and market chatter',
      memberCount: 42,
      visibility: 'private',
      creatorId: 'user_self',
      createdAt: Date.now() - 9*24*60*60*1000,
      members: [
        { id: 'user_self', username: 'You', role: 'owner' },
        { id: 'user_2', username: 'cryptosmith', role: 'member' }
      ],
      joinRequests: [],
      messages: [
        { id: 'msg_1', senderId: 'user_self', text: 'Room is open — drop your theses here.', timestamp: Date.now() - 6*60*60*1000, isOutgoing: true }
      ]
    },
    {
      id: 'group_5',
      name: 'Node Runners',
      avatar: 'NR',
      description: 'Validator and node operator talk',
      memberCount: 67,
      visibility: 'public',
      creatorId: 'user_self',
      createdAt: Date.now() - 21*24*60*60*1000,
      members: [
        { id: 'user_self', username: 'You', role: 'owner' },
        { id: 'user_5', username: 'chainwizard', role: 'admin' },
        { id: 'user_7', username: 'webbuilder', role: 'member' }
      ],
      joinRequests: [],
      messages: [
        { id: 'msg_1', senderId: 'user_5', senderName: 'chainwizard', text: 'Uptime is back to 100% after the patch.', timestamp: Date.now() - 8*60*60*1000, isOutgoing: false }
      ]
    }
  ];

  // Add group conversations to the conversations list
  conversations = conversations.concat([
    {
      id: 'conv_group_1',
      type: 'group',
      groupId: 'group_1',
      name: 'Seeker Club',
      avatar: 'SC',
      lastMessage: '↗ Mainnet Beta is Live 🚀',
      timestamp: Date.now() - 4*60*1000,
      unreadCount: 0,
      archived: false,
      pinned: false
    },
    {
      id: 'conv_group_2',
      type: 'group',
      groupId: 'group_2',
      name: 'Design Team',
      avatar: 'DT',
      lastMessage: 'Thanks! Reviewing now',
      timestamp: Date.now() - 25*60*1000,
      unreadCount: 0,
      archived: false,
      pinned: false
    },
    {
      id: 'conv_group_3',
      type: 'group',
      groupId: 'group_3',
      name: 'Guardian Mods',
      avatar: 'GM',
      lastMessage: 'On it. I\'ll watch the reports queue.',
      timestamp: Date.now() - 2.5*60*60*1000,
      unreadCount: 0,
      archived: false,
      pinned: false
    },
    {
      id: 'conv_group_4',
      type: 'group',
      groupId: 'group_4',
      name: 'Alpha Signals',
      avatar: 'AS',
      lastMessage: 'Room is open — drop your theses here.',
      timestamp: Date.now() - 6*60*60*1000,
      unreadCount: 0,
      archived: false,
      pinned: false
    },
    {
      id: 'conv_group_5',
      type: 'group',
      groupId: 'group_5',
      name: 'Node Runners',
      avatar: 'NR',
      lastMessage: 'Uptime is back to 100% after the patch.',
      timestamp: Date.now() - 8*60*60*1000,
      unreadCount: 0,
      archived: false,
      pinned: false
    }
  ]);

  // Screenshot-state seed: pad the demo threads so the message list actually
  // scrolls, which is what makes the scroll-to-latest FAB appear.
  if (SHOT_LONG_THREAD) {
    const directThread = conversations.find(c => c.id === 'conv_1');
    if (directThread) {
      const padded = [];
      for (let i = 0; i < 24; i++) {
        padded.push({
          id: `shot_msg_${i + 1}`,
          text: `Staging demo message #${i + 1} in this conversation.`,
          timestamp: Date.now() - (60 - i) * 60 * 1000,
          isOutgoing: i % 3 === 0
        });
      }
      directThread.messages = padded.concat(directThread.messages);
    }

    const demoGroup = groups.find(g => g.id === 'group_1');
    if (demoGroup) {
      const paddedGroup = [];
      for (let i = 0; i < 24; i++) {
        const outgoing = i % 3 === 0;
        paddedGroup.push({
          id: `shot_gmsg_${i + 1}`,
          senderId: outgoing ? 'user_self' : 'user_alice',
          senderName: outgoing ? undefined : 'Alice',
          text: `Staging demo group message #${i + 1}.`,
          timestamp: Date.now() - (60 - i) * 60 * 1000,
          isOutgoing: outgoing
        });
      }
      demoGroup.messages = paddedGroup.concat(demoGroup.messages);
    }
  }

  // Screenshot-state seed: force group_1's deleted-message placeholders to
  // exist regardless of any future edits to the base seed data above.
  if (SHOT_MESSAGE_DELETED) {
    const group1 = groups.find(g => g.id === 'group_1');
    if (group1) {
      const ownDeleted = group1.messages.find(m => m.id === 'msg_2');
      if (ownDeleted) {
        ownDeleted.isDeleted = true;
        ownDeleted.deletedByAdmin = false;
      }
      const adminDeleted = group1.messages.find(m => m.id === 'msg_4');
      if (adminDeleted) {
        adminDeleted.isDeleted = true;
        adminDeleted.deletedByAdmin = true;
      }
    }
  }

  // Screenshot-state seed: exercise the real Clear Chat function on conv_1 so
  // the deep link locks in the "list preview goes stale after clearing" fix.
  if (SHOT_DM_CLEARED) {
    clearDMChat('conv_1');
  }

  // Message requests data
  let requests = [
    {
      id: 'req_1',
      senderId: 'user_new_1',
      senderName: 'Taylor Blake',
      avatar: 'TB',
      messagePreview: 'Hi! I saw your profile and would love to connect.',
      timestamp: Date.now() - 30 * 60 * 1000
    },
    {
      id: 'req_2',
      senderId: 'user_new_2',
      senderName: 'Jordan River',
      avatar: 'JR',
      messagePreview: 'Great to see you here! Let\'s chat sometime.',
      timestamp: Date.now() - 2 * 60 * 60 * 1000
    }
  ];

  // Discover communities data
  let discoverGroups = [
    {
      id: 'discover_group_1',
      name: 'Tech Enthusiasts',
      description: 'A community for tech lovers and innovators',
      avatar: 'TE',
      memberCount: 256,
      visibility: 'public',
      members: [],
      joinRequests: [],
      isFeatured: true,
      isNew: false,
      createdAt: Date.now() - 60*24*60*60*1000
    },
    {
      id: 'discover_group_2',
      name: 'Design Community',
      description: 'Collaborate and share design ideas and projects',
      avatar: 'DC',
      memberCount: 189,
      visibility: 'private',
      members: [],
      joinRequests: [],
      isFeatured: true,
      isNew: false,
      createdAt: Date.now() - 45*24*60*60*1000
    },
    {
      id: 'discover_group_3',
      name: 'Photography Club',
      description: 'Share and discuss photography techniques',
      avatar: 'PC',
      memberCount: 412,
      visibility: 'public',
      members: [],
      joinRequests: [],
      isFeatured: false,
      isNew: false,
      createdAt: Date.now() - 30*24*60*60*1000
    },
    {
      id: 'discover_group_4',
      name: 'Book Lovers',
      description: 'Discuss books, authors, and reading experiences',
      avatar: 'BL',
      memberCount: 178,
      visibility: 'public',
      members: [],
      joinRequests: [],
      isFeatured: false,
      isNew: true,
      createdAt: Date.now() - 3*24*60*60*1000
    },
    {
      id: 'discover_group_5',
      name: 'Fitness Squad',
      description: 'Share fitness goals, workouts, and health tips',
      avatar: 'FS',
      memberCount: 334,
      visibility: 'public',
      members: [],
      joinRequests: [],
      isFeatured: false,
      isNew: false,
      createdAt: Date.now() - 20*24*60*60*1000
    },
    {
      id: 'discover_group_6',
      name: 'AI & ML Discussion',
      description: 'Deep dive into artificial intelligence and machine learning',
      avatar: 'AM',
      memberCount: 567,
      visibility: 'public',
      members: [],
      joinRequests: [],
      isFeatured: true,
      isNew: false,
      createdAt: Date.now() - 15*24*60*60*1000
    },
    {
      id: 'discover_group_7',
      name: 'Web3 Builders',
      description: 'Build and discuss decentralized applications',
      avatar: 'WB',
      memberCount: 291,
      visibility: 'public',
      members: [],
      joinRequests: [],
      isFeatured: false,
      isNew: true,
      createdAt: Date.now() - 5*24*60*60*1000
    },
    {
      id: 'discover_group_8',
      name: 'Indie Hackers',
      description: 'Connect with independent developers and entrepreneurs',
      avatar: 'IH',
      memberCount: 445,
      visibility: 'public',
      members: [],
      joinRequests: [],
      isFeatured: false,
      isNew: false,
      createdAt: Date.now() - 12*24*60*60*1000
    }
  ];

  // The hardcoded demo groups stay client-only: writing "Seeker Club" and
  // "Tech Enthusiasts" into Postgres would put obviously-fake rows in the
  // production database. Server-backed groups carry source: 'server' instead,
  // and mutation helpers use this flag to decide whether to call the API.
  groups.forEach(g => { g.source = 'local'; });
  discoverGroups.forEach(g => { g.source = 'local'; });

  let discoverChannels = [
    {
      id: 'discover_channel_1',
      name: 'Announcements',
      description: 'Important platform announcements and updates',
      avatar: 'A',
      visibility: 'public',
      memberCount: 523,
      isFeatured: true,
      isNew: false,
      createdAt: Date.now() - 90*24*60*60*1000
    },
    {
      id: 'discover_channel_2',
      name: 'Updates',
      description: 'Latest news and feature updates',
      avatar: 'U',
      visibility: 'public',
      memberCount: 412,
      isFeatured: true,
      isNew: false,
      createdAt: Date.now() - 75*24*60*60*1000
    },
    {
      id: 'discover_channel_3',
      name: '#news',
      description: 'Community news and trending topics',
      avatar: 'N',
      visibility: 'public',
      memberCount: 1245,
      isFeatured: false,
      isNew: false,
      createdAt: Date.now() - 60*24*60*60*1000
    },
    {
      id: 'discover_channel_4',
      name: '#tips',
      description: 'Useful tips, tricks, and best practices',
      avatar: 'T',
      visibility: 'public',
      memberCount: 856,
      isFeatured: false,
      isNew: false,
      createdAt: Date.now() - 50*24*60*60*1000
    },
    {
      id: 'discover_channel_5',
      name: '#events',
      description: 'Community events and gatherings',
      avatar: 'E',
      visibility: 'public',
      memberCount: 234,
      isFeatured: false,
      isNew: true,
      createdAt: Date.now() - 7*24*60*60*1000
    },
    {
      id: 'discover_channel_6',
      name: 'VIP Discussions',
      description: 'Private discussions for premium members',
      avatar: 'VD',
      visibility: 'private',
      memberCount: 45,
      isFeatured: false,
      isNew: false,
      createdAt: Date.now() - 40*24*60*60*1000
    },
    {
      id: 'discover_channel_7',
      name: 'Team Updates',
      description: 'Internal team communications and updates',
      avatar: 'TU',
      visibility: 'private',
      memberCount: 28,
      isFeatured: false,
      isNew: true,
      createdAt: Date.now() - 2*24*60*60*1000
    },
    {
      id: 'discover_channel_8',
      name: '#projects',
      description: 'Showcase and collaborate on projects',
      avatar: 'P',
      visibility: 'public',
      memberCount: 678,
      isFeatured: true,
      isNew: false,
      createdAt: Date.now() - 35*24*60*60*1000
    }
  ];

  // Broadcast channels data
  let channels = [
    {
      id: 'channel_1',
      name: 'Solana Indonesia',
      description: 'Latest news and updates about Solana ecosystem in Indonesia',
      avatar: 'SI',
      isPublic: true,
      creatorId: 'user_4',
      createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
      followerCount: 12500,
      followers: { 'user_self': true, 'user_1': true, 'user_2': true },
      mutedByUsers: {},
      posts: [
        {
          id: 'post_1',
          channelId: 'channel_1',
          authorId: 'user_4',
          text: 'Mainnet Beta is Live 🚀\n\nExciting times ahead as we launch the next phase of development!',
          timestamp: Date.now() - 2 * 60 * 1000,
          reactions: {
            '❤️': { 'user_self': true, 'user_1': true, 'user_2': true },
            '👍': { 'user_1': true, 'user_2': true },
            '🎉': { 'user_3': true }
          },
          isPinned: false
        },
        {
          id: 'post_2',
          channelId: 'channel_1',
          authorId: 'user_4',
          text: 'Monthly Update: Progress Report\n\nWe\'ve completed major milestones this month. Check the roadmap for details.',
          timestamp: Date.now() - 24 * 60 * 60 * 1000,
          reactions: { '😂': { 'user_1': true } },
          isPinned: false
        }
      ]
    },
    {
      id: 'channel_2',
      name: 'Web3 Builders',
      description: 'Community for web3 developers and creators',
      avatar: 'WB',
      isPublic: true,
      creatorId: 'user_self',
      createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
      followerCount: 245,
      followers: { 'user_self': true },
      mutedByUsers: {},
      posts: [
        {
          id: 'post_3',
          channelId: 'channel_2',
          authorId: 'user_self',
          text: 'Welcome to Web3 Builders! 👨‍💻\n\nThis is a space to share projects, learn together, and build the future of web3.',
          timestamp: Date.now() - 60 * 60 * 1000,
          reactions: {},
          isPinned: false
        }
      ]
    },
    {
      id: 'channel_3',
      name: 'Design Tips',
      description: 'Daily design inspiration and tutorials',
      avatar: 'DT',
      isPublic: true,
      creatorId: 'user_8',
      createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
      followerCount: 2000,
      followers: {},
      mutedByUsers: {},
      posts: [
        {
          id: 'post_4',
          channelId: 'channel_3',
          authorId: 'user_8',
          text: 'Tip of the day: Golden Ratio in UI Design\n\nUsing the golden ratio can create more aesthetically pleasing layouts.',
          timestamp: Date.now() - 12 * 60 * 60 * 1000,
          reactions: { '❤️': { 'user_1': true, 'user_2': true } },
          isPinned: false
        }
      ]
    },
    {
      // Second user-created channel — gives the Create menu's channel list
      // more than one row and covers the no-posts sort-key fallback.
      id: 'channel_4',
      name: 'Builder Notes',
      description: 'Short notes from things I ship',
      avatar: 'BN',
      isPublic: true,
      creatorId: 'user_self',
      createdAt: Date.now() - 36 * 60 * 60 * 1000,
      followerCount: 18,
      followers: { 'user_self': true },
      mutedByUsers: {},
      posts: []
    }
  ];

  // The fixed reaction set offered on channel posts. Single source of truth for
  // BOTH the picker order and the chip order, so chips never reshuffle as counts
  // change. Index 0 ('❤️') is what the primary like button toggles.
  const POST_REACTIONS = ['❤️', '👍', '😂', '🎉', '😮', '😢'];
  const LIKE_EMOJI = POST_REACTIONS[0];

  // Reactions live at post.reactions = { emoji: { userId: true } }. Posts used to
  // carry a flat `likes` map instead; fold any that survive into the heart bucket
  // so a stray seed (or a merge from another branch) can't break rendering.
  function normalizePostReactions() {
    channels.forEach(channel => {
      (channel.posts || []).forEach(post => {
        if (!post.reactions || typeof post.reactions !== 'object') post.reactions = {};
        if (post.likes && typeof post.likes === 'object') {
          post.reactions[LIKE_EMOJI] = Object.assign({}, post.reactions[LIKE_EMOJI], post.likes);
          delete post.likes;
        }
        // Drop any emoji bucket that ended up empty so no zero-count chip renders.
        Object.keys(post.reactions).forEach(emoji => {
          if (Object.keys(post.reactions[emoji] || {}).length === 0) delete post.reactions[emoji];
        });
      });
    });
  }
  normalizePostReactions();

  // Count / membership helpers for a post's reaction map.
  function reactionCount(post, emoji) {
    return Object.keys((post.reactions && post.reactions[emoji]) || {}).length;
  }

  function userReacted(post, emoji) {
    return !!(post.reactions && post.reactions[emoji] && post.reactions[emoji]['user_self']);
  }

  // Add channel conversations to the conversations list
  conversations = conversations.concat([
    {
      id: 'conv_channel_1',
      type: 'channel',
      channelId: 'channel_1',
      name: 'Solana Indonesia',
      avatar: 'SI',
      lastMessage: 'Mainnet Beta is Live 🚀\n\nExciting times ahead as we launch the next phase of development!',
      timestamp: Date.now() - 2 * 60 * 1000,
      unreadCount: 0,
      archived: false,
      pinned: false
    },
    {
      id: 'conv_channel_2',
      type: 'channel',
      channelId: 'channel_2',
      name: 'Web3 Builders',
      avatar: 'WB',
      lastMessage: 'Welcome to Web3 Builders! 👨‍💻\n\nThis is a space to share projects, learn together, and build the future of web3.',
      timestamp: Date.now() - 60 * 60 * 1000,
      unreadCount: 0,
      archived: false,
      pinned: false
    },
    {
      id: 'conv_channel_4',
      type: 'channel',
      channelId: 'channel_4',
      name: 'Builder Notes',
      avatar: 'BN',
      lastMessage: 'No posts yet',
      timestamp: Date.now() - 36 * 60 * 60 * 1000,
      unreadCount: 0,
      archived: false,
      pinned: false
    }
  ]);

  // Active tab state
  let activeMessagesTab = 'all';
  let activeDiscoverTab = 'all';
  let searchQuery = '';
  let showMessagesSearch = false;
  let searchTimeout = null;

  // Tracks the hash we navigated FROM, so a group/channel chat page opened
  // from the Create menu's managed lists can send its back button there
  // instead of always defaulting to the Messages list.
  let previousNavigationHash = '';
  let groupChannelBackTarget = '/messages';

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
      avatar: generateDefaultAvatar(isMe ? 'You' : member.username),
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
      avatar: serverGroup.avatar || generateDefaultAvatar(serverGroup.name),
      visibility: serverGroup.visibility === 'public' ? 'public' : 'private',
      creatorId: serverGroup.creatorId,
      memberCount: serverGroup.memberCount,
      members: (serverGroup.members || []).map(mapServerMember),
      joinRequests: [],
      createdAt: timestamp,
      source: 'server',
      // Messages are not persisted yet, so a server group's thread opens on the
      // synthetic system message only.
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
    const existingConv = conversations.find(c => c.groupId === serverGroup.id);
    if (existingConv) {
      existingConv.name = shaped.name;
      existingConv.avatar = shaped.avatar;
      existingConv.lastMessage = lastMessage ? lastMessage.text : '';
    } else {
      conversations.unshift({
        id: 'conv_' + serverGroup.id,
        type: 'group',
        groupId: serverGroup.id,
        name: shaped.name,
        avatar: shaped.avatar,
        lastMessage: lastMessage ? lastMessage.text : '',
        timestamp: lastMessage ? lastMessage.timestamp : timestamp,
        unreadCount: 0,
        archived: false,
        pinned: false
      });
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
    try {
      const [mineRes, discoverRes] = await Promise.all([
        fetch('/api/groups?scope=mine', { headers: authHeaders() }),
        fetch('/api/groups?scope=discover', { headers: authHeaders() })
      ]);

      if (mineRes.ok) {
        const payload = await mineRes.json();
        (payload.groups || []).forEach(g => addServerGroupToState(g));
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
            avatar: g.avatar || generateDefaultAvatar(g.name),
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
    if (text.length > length) {
      return text.substring(0, length) + '…';
    }
    return text;
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

  // Update only the conversations list (used during search to avoid full page re-render)
  function updateConversationsList() {
    const filteredConversations = filterConversations(activeMessagesTab, searchQuery);
    const sortedConversations = activeMessagesTab === 'requests' ? filteredConversations : sortConversations(filteredConversations);

    const conversationsList = sortedConversations.map(item => {
      if (activeMessagesTab === 'requests') {
        return `
          <div class="request-item" data-request-id="${item.id}">
            <div class="request-header">
              <div class="request-avatar">${item.avatar}</div>
              <div class="request-content">
                <div class="request-name">${item.senderName}</div>
                <div class="request-message">${truncateText(item.messagePreview, 60)}</div>
              </div>
            </div>
            <div class="request-actions">
              <button class="request-accept" data-request-id="${item.id}">Accept</button>
              <button class="request-decline" data-request-id="${item.id}">Decline</button>
            </div>
          </div>
        `;
      } else {
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

        return `
          <div class="conversation-item ${item.pinned ? 'pinned' : ''}" data-conversation-id="${item.id}" data-route-hash="${routeHash}">
            <div class="conversation-avatar">${escapeHtml(item.avatar)}</div>
            <div class="conversation-content">
              <div class="conversation-header">
                <span class="conversation-username-row">
                  ${item.pinned ? '<span class="conversation-pin-icon">📌</span>' : ''}
                  <span class="conversation-username">${escapeHtml(displayName)}</span>
                </span>
                <span class="conversation-timestamp">${formatTimestamp(item.timestamp)}</span>
              </div>
              <p class="conversation-message">${escapeHtml(item.lastMessage)}</p>
            </div>
            ${item.unreadCount > 0 ? `<div class="unread-badge" style="background-color: ${badgeColor};">${item.unreadCount > 9 ? '9+' : item.unreadCount}</div>` : ''}
          </div>
        `;
      }
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
    }
  }

  // Attach event listeners to conversation list items
  function attachConversationListeners() {
    // Conversation click handlers
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => {
        const routeHash = item.dataset.routeHash;
        const convId = item.dataset.conversationId;
        const conv = conversations.find(c => c.id === convId);
        if (conv) conv.unreadCount = 0;
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

  // Update conversation last message and timestamp
  function updateConversationLastMessage(conversationId, lastMessage, newTimestamp) {
    const conv = conversations.find(c => c.id === conversationId);
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
      .map(g => ({ ...g, type: 'group' }));
    let filteredChans = discoverChannels
      .filter(c => !channels.some(jc => jc.id === c.id))
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
  function followDiscoverChannel(channelId) {
    const discoverChannel = discoverChannels.find(c => c.id === channelId);
    if (!discoverChannel) return;

    const newChannel = {
      id: channelId,
      name: discoverChannel.name,
      description: discoverChannel.description,
      avatar: discoverChannel.avatar,
      visibility: discoverChannel.visibility,
      createdAt: Date.now(),
      creatorId: 'user_other',
      memberCount: discoverChannel.memberCount + 1,
      currentUserIsMember: true,
      currentUserIsAdmin: false,
      currentUserCanSend: true,
      members: [{ id: 'user_self', username: 'You', role: 'member', avatar: 'Y' }],
      messages: [
        {
          id: 'msg_' + Date.now(),
          senderId: 'system',
          senderName: 'System',
          text: 'You followed this channel.',
          timestamp: Date.now(),
          isOutgoing: false,
          isSystemMessage: true
        }
      ]
    };

    channels.push(newChannel);
    channelUnreadCounts[channelId] = 0;

    const newConversation = {
      id: `conv_channel_${channelId}`,
      type: 'channel',
      channelId: channelId,
      name: discoverChannel.name,
      avatar: discoverChannel.avatar,
      lastMessage: 'You followed this channel.',
      timestamp: Date.now(),
      unreadCount: 0,
      archived: false,
      pinned: false
    };

    conversations.unshift(newConversation);
    discoverChannels = discoverChannels.filter(c => c.id !== channelId);

    renderDiscoverPage(activeDiscoverTab);
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
            <div class="featured-avatar">${c.avatar}</div>
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
            <div class="community-avatar">${g.avatar}</div>
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
            <div class="community-avatar">${c.avatar}</div>
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
            <div class="community-avatar">${c.avatar}</div>
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
          window.location.hash = `/discover/group/${groupId}`;
        } else if (channelId) {
          window.location.hash = `/discover/channel/${channelId}`;
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
          window.location.hash = `/discover/group/${groupId}`;
        } else if (channelId) {
          window.location.hash = `/discover/channel/${channelId}`;
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

  // Render group detail screen
  async function renderGroupDetailScreen(groupId) {
    let group = groups.find(g => g.id === groupId);
    if (!group) {
      group = discoverGroups.find(g => g.id === groupId);
    }
    if (!group) {
      // Not in local state — it may be a server-backed group reached by URL.
      // A private group 404s here for non-members, so this never leaks one.
      try {
        const response = await fetch(`/api/groups/${groupId}`, { headers: authHeaders() });
        if (response.ok) {
          const payload = await response.json();
          if (payload.group) {
            group = {
              id: payload.group.id,
              name: payload.group.name,
              description: payload.group.description || '',
              avatar: payload.group.avatar || generateDefaultAvatar(payload.group.name),
              memberCount: payload.group.memberCount,
              visibility: payload.group.visibility,
              creatorId: payload.group.creatorId,
              members: [],
              joinRequests: [],
              createdAt: payload.group.createdAt,
              source: 'server'
            };
            if (group.visibility === 'public' && !discoverGroups.some(g => g.id === group.id)) {
              discoverGroups.push(Object.assign({ isFeatured: false, isNew: !!payload.group.isNew }, group));
            }
          }
        }
      } catch (error) {
        console.warn('Could not load group:', error);
      }
    }
    if (!group) {
      window.location.hash = '/discover';
      return;
    }

    const isJoined = groups.some(g => g.id === groupId);
    const isPrivate = group.visibility === 'private';
    const hasPendingRequest = !isJoined && isPrivate && (group.joinRequests || []).some(r => r.userId === 'user_self');

    let actionButtonHTML;
    if (isJoined) {
      actionButtonHTML = '<button class="detail-button" disabled>Already Joined</button>';
    } else if (isPrivate) {
      actionButtonHTML = hasPendingRequest
        ? '<button class="detail-button" id="request-pending-button" disabled>Request Pending</button>'
        : '<button class="detail-button" id="request-join-button">Request to Join</button>';
    } else {
      actionButtonHTML = '<button class="detail-button" id="join-button">Join Group</button>';
    }

    pageContainer.innerHTML = `
      <div class="detail-screen">
        <div class="detail-header">
          <button class="back-button" aria-label="Back">←</button>
          <h1>Group Details</h1>
        </div>
        <div class="detail-content">
          <div class="detail-avatar">${escapeHtml(group.avatar)}</div>
          <h2>${escapeHtml(group.name)}</h2>
          <div class="detail-badge">${isPrivate ? '🔒 Private' : '🌐 Public'}</div>
          <p class="detail-description">${escapeHtml(group.description)}</p>
          <div class="detail-stat">${group.memberCount} members</div>
          ${actionButtonHTML}
        </div>
      </div>
    `;

    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = '/discover';
    });

    const joinBtn = document.getElementById('join-button');
    if (joinBtn) {
      joinBtn.addEventListener('click', async () => {
        joinBtn.disabled = true;
        await joinDiscoverGroup(groupId);
        window.location.hash = '/discover';
      });
    }

    const requestJoinBtn = document.getElementById('request-join-button');
    if (requestJoinBtn) {
      requestJoinBtn.addEventListener('click', async () => {
        await requestToJoinGroup(groupId);
        renderGroupDetailScreen(groupId);
        showToast('Request sent', { type: 'success' });
      });
    }

    navTabs.forEach(tab => tab.classList.remove('active'));
  }

  // Render channel detail screen
  function renderDiscoverChannelDetailScreen(channelId) {
    let channel = channels.find(c => c.id === channelId);
    if (!channel) {
      channel = discoverChannels.find(c => c.id === channelId);
    }
    if (!channel) {
      window.location.hash = '/discover';
      return;
    }

    const isFollowed = channels.some(c => c.id === channelId);

    pageContainer.innerHTML = `
      <div class="detail-screen">
        <div class="detail-header">
          <button class="back-button" aria-label="Back">←</button>
          <h1>Channel Details</h1>
        </div>
        <div class="detail-content">
          <div class="detail-avatar">${channel.avatar}</div>
          <h2>${channel.name}</h2>
          <div class="detail-badge">${channel.visibility === 'private' ? '🔒 Private' : '🌐 Public'}</div>
          <p class="detail-description">${channel.description}</p>
          <div class="detail-stat">${channel.memberCount} followers</div>
          ${!isFollowed ? `<button class="detail-button" id="follow-button">Follow Channel</button>` : '<button class="detail-button" disabled>Already Following</button>'}
        </div>
      </div>
    `;

    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = '/discover';
    });

    const followBtn = document.getElementById('follow-button');
    if (followBtn) {
      followBtn.addEventListener('click', () => {
        followDiscoverChannel(channelId);
        window.location.hash = '/discover';
      });
    }

    navTabs.forEach(tab => tab.classList.remove('active'));
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
              <div class="request-avatar">${item.avatar}</div>
              <div class="request-content">
                <div class="request-name">${item.senderName}</div>
                <div class="request-message">${truncateText(item.messagePreview, 60)}</div>
              </div>
            </div>
            <div class="request-actions">
              <button class="request-accept" data-request-id="${item.id}">Accept</button>
              <button class="request-decline" data-request-id="${item.id}">Decline</button>
            </div>
          </div>
        `;
      } else {
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

        return `
          <div class="conversation-item ${item.pinned ? 'pinned' : ''}" data-conversation-id="${item.id}" data-route-hash="${routeHash}">
            <div class="conversation-avatar">${escapeHtml(item.avatar)}</div>
            <div class="conversation-content">
              <div class="conversation-header">
                <span class="conversation-username-row">
                  ${item.pinned ? '<span class="conversation-pin-icon">📌</span>' : ''}
                  <span class="conversation-username">${escapeHtml(displayName)}</span>
                </span>
                <span class="conversation-timestamp">${formatTimestamp(item.timestamp)}</span>
              </div>
              <p class="conversation-message">${escapeHtml(item.lastMessage)}</p>
            </div>
            ${item.unreadCount > 0 ? `<div class="unread-badge" style="background-color: ${badgeColor};">${item.unreadCount > 9 ? '9+' : item.unreadCount}</div>` : ''}
          </div>
        `;
      }
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

    pageContainer.innerHTML = `
      <div class="messages-page">
        <div class="messages-header">
          <h1>Guardian</h1>
          <div class="messages-header-actions">
            <button class="new-group-button un-touch-target" data-testid="new-group-entry" aria-label="Create a new group">+ New Group</button>
            <span class="search-icon">🔍</span>
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
        <div class="conversations-list" id="conversations-list">
          ${conversationsList || emptyStateHTML}
        </div>
      </div>
    `;

    // Tab click handlers
    document.querySelectorAll('.message-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        searchQuery = '';
        showMessagesSearch = false;
        renderMessagesPage(tab.dataset.tab);
      });
    });

    // "+ New Group" entry points (header action + Groups-tab empty state)
    document.querySelectorAll('[data-testid="new-group-entry"], [data-testid="new-group-empty"]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.location.hash = '/create-group';
      });
    });

    // Search icon handler
    document.querySelector('.search-icon').addEventListener('click', () => {
      showMessagesSearch = true;
      renderMessagesPage();
      setTimeout(() => {
        document.getElementById('messages-search-input').focus();
      }, 0);
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

    // Attach event listeners to conversation list items
    attachConversationListeners();

    // Setup long-press context menu for conversations
    setupConversationLongPress();
  }

  // Accept request and create conversation
  function acceptRequest(requestId) {
    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    const newConversation = {
      id: 'conv_' + request.senderId,
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
    };

    conversations.unshift(newConversation);
    requests = requests.filter(r => r.id !== requestId);
    renderMessagesPage();
  }

  // Decline request
  function declineRequest(requestId) {
    requests = requests.filter(r => r.id !== requestId);
    renderMessagesPage();
  }

  // Setup long-press context menu for conversation items
  function setupConversationLongPress() {
    const conversationItems = document.querySelectorAll('.conversation-item');
    const LONG_PRESS_DURATION = 350;
    const MENU_ITEMS = [
      { icon: '📌', label: 'Pin', action: 'pin' }
    ];

    let menuState = {
      selectedConvId: null,
      isMenuOpen: false,
      longPressTimer: null,
      lastEventWasTouch: false
    };

    function dismissMenu() {
      if (!menuState.isMenuOpen) return;

      const overlay = document.querySelector('.conversation-menu-overlay');
      const contextMenu = document.querySelector('.conversation-context-menu');

      if (overlay) overlay.classList.add('closing');
      if (contextMenu) contextMenu.classList.add('closing');

      setTimeout(() => {
        overlay?.remove();
        contextMenu?.remove();
        menuState.selectedConvId = null;
        menuState.isMenuOpen = false;
      }, 150);
    }

    function showMenu(convId, element) {
      if (menuState.isMenuOpen) dismissMenu();

      const conv = conversations.find(c => c.id === convId);
      if (!conv) return;

      menuState.selectedConvId = convId;
      menuState.isMenuOpen = true;

      const messagesPage = document.querySelector('.messages-page');
      if (!messagesPage) return;

      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'conversation-menu-overlay';
      overlay.addEventListener('click', dismissMenu);
      messagesPage.appendChild(overlay);

      // Create context menu
      const contextMenu = document.createElement('div');
      contextMenu.className = 'conversation-context-menu';
      const menuButtons = MENU_ITEMS.map(item => {
        const isPinned = conv.pinned && item.action === 'pin';
        const label = isPinned ? 'Unpin' : item.label;
        return `
          <button class="menu-item" aria-label="${label}" data-action="${item.action}">
            <span class="menu-icon">${item.icon}</span>
            <span class="menu-label">${label}</span>
          </button>
        `;
      }).join('');
      contextMenu.innerHTML = menuButtons;
      messagesPage.appendChild(contextMenu);

      // Position menu
      const elementRect = element.getBoundingClientRect();
      const contextMenuRect = contextMenu.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const spaceAbove = elementRect.top;
      const spaceBelow = viewportHeight - elementRect.bottom;
      const menuHeight = contextMenuRect.height;

      let menuTop;
      if (spaceAbove > menuHeight + 10) {
        menuTop = elementRect.top - menuHeight - 10;
      } else {
        menuTop = elementRect.bottom + 10;
      }

      if (menuTop < 10) menuTop = 10;
      else if (menuTop + menuHeight > viewportHeight - 10) menuTop = viewportHeight - menuHeight - 10;

      const elementCenterX = elementRect.left + elementRect.width / 2;
      let menuLeft = elementCenterX - contextMenuRect.width / 2;

      if (menuLeft < 10) menuLeft = 10;
      else if (menuLeft + contextMenuRect.width > viewportWidth - 10) menuLeft = viewportWidth - contextMenuRect.width - 10;

      contextMenu.style.position = 'fixed';
      contextMenu.style.top = Math.max(10, menuTop) + 'px';
      contextMenu.style.left = Math.max(10, menuLeft) + 'px';

      // Add event listeners to menu items
      contextMenu.querySelectorAll('.menu-item').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          btn.classList.add('tapped');

          try {
            if (action === 'pin') {
              const newPinnedState = !conv.pinned;
              const res = await fetch(`/api/conversations/${convId}/pin`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pinned: newPinnedState })
              });
              if (res.ok) {
                conv.pinned = newPinnedState;
              }
            }
          } catch (err) {
            console.error(`Failed to ${action} conversation:`, err);
          }

          setTimeout(() => dismissMenu(), 150);
          renderMessagesPage();
        });
      });
    }

    conversationItems.forEach(item => {
      const convId = item.dataset.conversationId;

      // Mouse events
      item.addEventListener('mousedown', (e) => {
        if (menuState.lastEventWasTouch) return;
        menuState.longPressTimer = setTimeout(() => {
          showMenu(convId, item);
        }, LONG_PRESS_DURATION);
      });

      item.addEventListener('mouseup', () => {
        if (menuState.longPressTimer) {
          clearTimeout(menuState.longPressTimer);
          menuState.longPressTimer = null;
        }
      });

      item.addEventListener('mouseleave', () => {
        if (menuState.longPressTimer) {
          clearTimeout(menuState.longPressTimer);
          menuState.longPressTimer = null;
        }
      });

      // Touch events
      item.addEventListener('touchstart', (e) => {
        menuState.lastEventWasTouch = true;
        menuState.longPressTimer = setTimeout(() => {
          showMenu(convId, item);
        }, LONG_PRESS_DURATION);
      });

      item.addEventListener('touchend', () => {
        if (menuState.longPressTimer) {
          clearTimeout(menuState.longPressTimer);
          menuState.longPressTimer = null;
        }
        setTimeout(() => {
          menuState.lastEventWasTouch = false;
        }, 100);
      });

      item.addEventListener('touchmove', () => {
        if (menuState.longPressTimer) {
          clearTimeout(menuState.longPressTimer);
          menuState.longPressTimer = null;
        }
      });
    });
  }

  // Render conversation screen
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

  function renderConversationPage(conversationId, renderOptions) {
    const fromSend = !!(renderOptions && renderOptions.fromSend);
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) {
      renderPage('messages');
      return;
    }

    const messagesList = conversation.messages.filter(msg => !(msg.hiddenFor && msg.hiddenFor.user_self)).map(msg => {
      let messageHTML = `<div class="message-swipe-wrapper ${msg.isOutgoing ? 'wrapper-outgoing' : 'wrapper-incoming'}" data-message-id="${msg.id}">`;
      messageHTML += `<div class="message-reply-icon" aria-hidden="true">↩️</div>`;
      messageHTML += `<div class="message ${msg.isOutgoing ? 'outgoing' : 'incoming'}" data-message-id="${msg.id}">`;

      // Add quoted message section if this is a reply
      if (msg.replyTo) {
        messageHTML += `
          <div class="message-quote" data-quoted-message-id="${msg.replyTo.messageId}">
            <div class="quote-border"></div>
            <div class="quote-content">
              <div class="quote-sender">${msg.replyTo.senderName}</div>
              <div class="quote-text">${msg.replyTo.previewText}</div>
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
        <div class="message-bubble" data-message-id="${msg.id}">${msg.text}</div>
        <div class="message-reaction-chips" data-message-id="${msg.id}">${messageReactionChipsHTML(msg)}</div>
        <div class="message-timestamp">${formatMessageTime(msg.timestamp)}</div>
      </div>`;

      messageHTML += `</div>`;

      return messageHTML;
    }).join('');

    pageContainer.innerHTML = `
      <div class="conversation-page">
        <div class="conversation-page-header">
          <button class="back-button" aria-label="Back to messages">←</button>
          <div class="conversation-header-info">
            <div class="conversation-avatar-header">${conversation.avatar}</div>
            <div class="header-text">
              <div class="header-username">${conversation.username}</div>
            </div>
          </div>
          <button class="menu-button" aria-label="More options">⋮</button>
        </div>
        <div class="messages-area">
          <div class="messages-container">
            ${messagesList}
          </div>
          ${scrollToLatestFabHTML()}
        </div>
        <div class="composer-container">
          <div class="reply-preview-bar" style="display: none;">
            <div class="reply-preview-content">
              <div class="reply-quote">
                <div class="reply-sender">Replying to: <span class="reply-sender-name"></span></div>
                <div class="reply-text"></div>
              </div>
              <button class="reply-close-button" aria-label="Cancel reply">✕</button>
            </div>
          </div>
          <textarea class="composer-input" placeholder="Message..." rows="1"></textarea>
          <button class="send-button" aria-label="Send">➤</button>
        </div>
      </div>
    `;

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
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = (SHOT_SCROLL_FAB && !fromSend)
          ? 0
          : messagesContainer.scrollHeight;
      }
    }, 0);

    // Floating "jump to newest message" button
    setupScrollToLatestFab(conversationRoot);

    // Set up message long-press interactions
    setupMessageLongPress(conversation, 'dm');
    setupMessageSwipeToReply(conversation, 'dm');
    setupForwardAttributionLinks(conversationRoot);

    // Set up send button and reply state management
    setupComposer(conversation, { isGroup: false });

    // Must stay last: the send re-renders this page underneath us.
    if (SHOT_SEND_STAY && !fromSend) sendShotMessage(conversationRoot);

    // Screenshot-state: click the real ⋮ button so the deep link exercises the
    // actual event listener wiring, not just the dialog-rendering function.
    if (SHOT_DM_MENU) menuButton?.click();
  }

  // Screenshot-state helper: drive the real composer the same way a tap does, so
  // a check can assert the thread survives sending rather than only that it
  // renders. A send that bounced the user out would leave the Messages list here.
  function sendShotMessage(root) {
    const scope = root || document;
    const input = scope.querySelector('.composer-input');
    const button = scope.querySelector('.send-button');
    if (!input || !button) return;
    input.value = SHOT_SEND_TEXT;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    button.click();
  }

  // Mute/unmute a DM conversation's notifications (client-side only, mirrors
  // toggleMuteChannel)
  function toggleMuteDM(conversationId, isMuted) {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;
    if (!conv.mutedByUsers) conv.mutedByUsers = {};

    if (isMuted) {
      conv.mutedByUsers['user_self'] = true;
    } else {
      delete conv.mutedByUsers['user_self'];
    }
  }

  // Hide every message in a DM for the current user only ("delete for me",
  // applied to the whole thread) — mirrors the per-message hiddenFor pattern.
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
        <h2>${conversation.username}</h2>
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
        const res = await fetch(`/api/conversations/${conversationId}/pin`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
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
      showConfirmDialog('Clear Chat', `Clear all messages with ${conversation.username}? This only removes them for you.`, () => {
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

  // Channels the user created. Channels have no admin role — every ownership
  // check in this file is creatorId-based — so creator is the whole predicate.
  function getManagedChannels() {
    return sortCommunitiesByRecency(channels.filter(c => c.creatorId === 'user_self'), 'channel');
  }

  // 'Owner' / 'Admin' badge text, matching the wording used on the members list.
  function getManagedGroupRoleLabel(group) {
    const role = getSelfGroupRole(group);
    if (group.creatorId === 'user_self' || role === 'owner') return 'Owner';
    return role === 'admin' ? 'Admin' : '';
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
      const roleLabel = isChannel ? 'Owner' : getManagedGroupRoleLabel(item);
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
      // Deleted placeholders (group only) can't be acted on at all
      const menuTargetMessage = conversation.messages.find(m => m.id === messageId);
      if (menuTargetMessage && menuTargetMessage.isDeleted) return;

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
      const visibleMenuItems = MENU_ITEMS.filter(item => item.action !== 'delete' || canDeleteMenuTarget);

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
              const previewText = truncateText(targetMessage.text, 50);
              setReplyState(messageId, senderName, previewText);
            }
          } else if (action === 'react') {
            if (targetMessage) {
              openMessageReactionPicker(messageId, bubbleElement);
            }
          } else if (action === 'copy') {
            if (targetMessage) {
              navigator.clipboard.writeText(targetMessage.text).then(() => {
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
                'Delete this message? It will be removed from your chat history only — the other person will still see it.',
                () => hideMessageForSelf(conversation, messageId)
              );
            } else if (threadType === 'group') {
              const isOwnMessage = targetMessage.isOutgoing === true;
              if (isOwnMessage || isCurrentUserGroupAdmin(conversation)) {
                const confirmMessage = isOwnMessage
                  ? 'Delete this message? This cannot be undone.'
                  : "Delete this member's message? This cannot be undone.";
                showConfirmDialog('Delete Message', confirmMessage, () => {
                  deleteMessageForEveryone(conversation, messageId, { byAdmin: !isOwnMessage });
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
        return !!msg && !msg.isDeleted && !msg.isSystemMessage;
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
            const previewText = truncateText(msg.text, 50);
            setReplyState(msg.id, senderName, previewText);
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

  // Delete a message from a channel thread (own messages only) — hard delete
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
      previewConversation.lastMessage = lastMessage ? truncateText(lastMessage.text, 100) : 'No messages yet';
      if (lastMessage) previewConversation.timestamp = lastMessage.timestamp;
    }

    showToast('Message deleted', { type: 'success' });
  }

  // DM "delete for me" (WhatsApp/Telegram style): hides a message from the
  // current user's own view only. The message is untouched for the other
  // participant — this is not a shared/real delete.
  function hideMessageForSelf(conversation, messageId) {
    const message = conversation.messages.find(m => m.id === messageId);
    if (!message) return;

    message.hiddenFor = message.hiddenFor || {};
    message.hiddenFor.user_self = true;

    const messageEl = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (messageEl) messageEl.remove();

    // Keep the conversation list preview in sync — skip hidden-for-self messages
    const visibleMessages = conversation.messages.filter(m => !(m.hiddenFor && m.hiddenFor.user_self));
    const lastMessage = visibleMessages[visibleMessages.length - 1];
    conversation.lastMessage = lastMessage ? truncateText(lastMessage.text, 100) : 'No messages yet';
    if (lastMessage) conversation.timestamp = lastMessage.timestamp;

    showToast('Message deleted', { type: 'success' });
  }

  // Group shared moderation delete: removes a message for every member. Members
  // may only do this to their own messages; admins/the creator may do it to
  // anyone's. The message becomes a placeholder, not repliable/copyable/deletable.
  function deleteMessageForEveryone(group, messageId, options) {
    const byAdmin = !!(options && options.byAdmin);
    const message = group.messages.find(m => m.id === messageId);
    if (!message) return;

    message.isDeleted = true;
    message.deletedByAdmin = byAdmin;
    const placeholderText = byAdmin ? 'This message was deleted by an admin' : 'Message deleted';

    const messageEl = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (messageEl) {
      const bubbleEl = messageEl.querySelector('.message-bubble');
      if (bubbleEl) {
        bubbleEl.classList.add('deleted');
        bubbleEl.textContent = placeholderText;
      }
    }

    // Keep the conversation list preview (last message) in sync
    const row = conversations.find(c => c.groupId === group.id);
    if (row) {
      const lastMessage = group.messages[group.messages.length - 1];
      if (lastMessage) {
        row.lastMessage = lastMessage.isDeleted
          ? (lastMessage.deletedByAdmin ? 'This message was deleted by an admin' : 'Message deleted')
          : truncateText(lastMessage.text, 100);
        row.timestamp = lastMessage.timestamp;
      } else {
        row.lastMessage = 'No messages yet';
      }
    }

    showToast('Message deleted', { type: 'success' });
  }

  // Reply state management
  let replyState = {
    targetMessageId: null,
    targetSenderName: null,
    targetPreviewText: null
  };

  function setReplyState(messageId, senderName, previewText) {
    replyState.targetMessageId = messageId;
    replyState.targetSenderName = senderName;
    replyState.targetPreviewText = previewText;

    // Show reply preview bar
    const replyBar = document.querySelector('.reply-preview-bar');
    const replySenderName = document.querySelector('.reply-sender-name');
    const replyText = document.querySelector('.reply-text');

    if (replyBar) {
      replySenderName.textContent = senderName;
      replyText.textContent = previewText;
      replyBar.style.display = 'flex';
    }
  }

  function clearReplyState() {
    replyState.targetMessageId = null;
    replyState.targetSenderName = null;
    replyState.targetPreviewText = null;

    const replyBar = document.querySelector('.reply-preview-bar');
    if (replyBar) {
      replyBar.style.display = 'none';
    }
  }

  // `thread` is either a direct conversation (from `conversations`) or a group
  // (from `groups`). The two live in different arrays and are drawn by different
  // renderers, so the caller says which one it is — re-rendering a group through
  // renderConversationPage() used to find nothing and bounce the user out to the
  // Messages list, losing the message they just sent.
  function setupComposer(thread, options) {
    const opts = options || {};
    const isGroup = !!opts.isGroup;
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

    if (replyCloseButton) {
      replyCloseButton.addEventListener('click', () => {
        clearReplyState();
      });
    }

    sendButton.addEventListener('click', () => {
      const text = composerInput.value.trim();
      if (!text) return;

      // Create new message with optional reply metadata
      const newMessage = {
        id: `msg_${Date.now()}`,
        text: text,
        timestamp: Date.now(),
        isOutgoing: true
      };

      // Group messages carry a sender id alongside the outgoing flag.
      if (isGroup) newMessage.senderId = 'user_self';

      // Attach reply metadata if replying
      if (replyState.targetMessageId) {
        newMessage.replyTo = {
          messageId: replyState.targetMessageId,
          senderName: replyState.targetSenderName,
          previewText: replyState.targetPreviewText
        };
      }

      // Add message to conversation
      conversation.messages.push(newMessage);
      composerInput.value = '';
      composerInput.style.height = '48px';
      clearReplyState();

      // Update conversation last message and timestamp for All tab sorting. A
      // group's row in the Messages list is keyed by groupId, not by group.id.
      updateThreadLastMessage(thread, isGroup, text.substring(0, 100), newMessage.timestamp);

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
  function renderGroupConversationPage(groupId, renderOptions) {
    const fromSend = !!(renderOptions && renderOptions.fromSend);
    const group = groups.find(g => g.id === groupId);
    if (!group) {
      renderPage('messages');
      return;
    }

    const messagesList = group.messages.map(msg => {
      let messageHTML = `<div class="message-swipe-wrapper ${msg.isOutgoing ? 'wrapper-outgoing' : 'wrapper-incoming'}" data-message-id="${msg.id}">`;
      messageHTML += `<div class="message-reply-icon" aria-hidden="true">↩️</div>`;
      messageHTML += `<div class="message ${msg.isOutgoing ? 'outgoing' : 'incoming has-avatar'}" data-message-id="${msg.id}">`;

      const bubbleText = msg.isDeleted
        ? (msg.deletedByAdmin ? 'This message was deleted by an admin' : 'Message deleted')
        : msg.text;
      const bubbleClass = msg.isDeleted ? 'message-bubble deleted' : 'message-bubble';

      const quoteHTML = msg.replyTo ? `
        <div class="message-quote" data-quoted-message-id="${msg.replyTo.messageId}">
          <div class="quote-border"></div>
          <div class="quote-content">
            <div class="quote-sender">${msg.replyTo.senderName}</div>
            <div class="quote-text">${msg.replyTo.previewText}</div>
          </div>
        </div>
      ` : '';

      // A deleted message keeps no attribution — there's nothing left to attribute.
      const forwardHTML = (msg.forwardedFrom && !msg.isDeleted) ? forwardAttributionHTML(msg.forwardedFrom) : '';

      // Deleted messages carry no reactions either — nothing left to react to.
      // (Container always renders, like .post-reaction-chips, so a later
      // refreshMessageReactions() call always has an element to patch.)
      const reactionChipsRow = msg.isDeleted ? '' : `<div class="message-reaction-chips" data-message-id="${msg.id}">${messageReactionChipsHTML(msg)}</div>`;

      if (msg.isOutgoing) {
        messageHTML += `
          ${quoteHTML}
          ${forwardHTML}
          ${renderPinBadge(msg)}
          <div class="${bubbleClass}" data-message-id="${msg.id}">${bubbleText}</div>
          ${reactionChipsRow}
          <div class="message-timestamp">${formatMessageTime(msg.timestamp)}</div>
        </div>`;
      } else {
        messageHTML += `
          <div class="message-avatar">${msg.senderName ? msg.senderName.charAt(0).toUpperCase() : ''}</div>
          <div class="message-content">
            <div class="message-sender-name">${msg.senderName}</div>
            ${quoteHTML}
            ${forwardHTML}
            ${renderPinBadge(msg)}
            <div class="${bubbleClass}" data-message-id="${msg.id}">${bubbleText}</div>
            ${reactionChipsRow}
            <div class="message-timestamp">${formatMessageTime(msg.timestamp)}</div>
          </div>
        </div>`;
      }

      messageHTML += `</div>`;

      return messageHTML;
    }).join('');

    pageContainer.innerHTML = `
      <div class="conversation-page">
        <div class="conversation-page-header">
          <button class="back-button" aria-label="Back to messages">←</button>
          <div class="conversation-header-info group-header-info" id="group-header-info-${groupId}">
            <div class="conversation-avatar-header">${group.avatar}</div>
            <div class="header-text">
              <div class="header-username">${group.name}</div>
              <div class="header-member-count">${group.memberCount} members</div>
            </div>
          </div>
          <button class="menu-button" aria-label="More options">⋮</button>
        </div>
        <div class="messages-area">
          <div class="messages-container">
            ${messagesList}
          </div>
          ${scrollToLatestFabHTML()}
        </div>
        <div class="composer-container">
          <div class="reply-preview-bar" style="display: none;">
            <div class="reply-preview-content">
              <div class="reply-quote">
                <div class="reply-sender">Replying to: <span class="reply-sender-name"></span></div>
                <div class="reply-text"></div>
              </div>
              <button class="reply-close-button" aria-label="Cancel reply">✕</button>
            </div>
          </div>
          <textarea class="composer-input" placeholder="Message..." rows="1"></textarea>
          <button class="send-button" aria-label="Send">➤</button>
        </div>
      </div>
    `;

    // Add back button handler. Returns to the Create menu when this chat was
    // opened from its managed-groups list, otherwise falls back to Messages.
    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = groupChannelBackTarget;
    });

    // Add interactive header controls for group management
    const headerInfo = document.getElementById(`group-header-info-${groupId}`);
    if (headerInfo) {
      headerInfo.style.cursor = 'pointer';
      // Tap on group name to edit
      const headerUsername = headerInfo.querySelector('.header-username');
      if (headerUsername) {
        headerUsername.addEventListener('click', (e) => {
          e.stopPropagation();
          showEditNameDialog(groupId, group.name);
        });
      }
      // Tap on avatar to change photo
      const avatar = headerInfo.querySelector('.conversation-avatar-header');
      if (avatar) {
        avatar.style.cursor = 'pointer';
        avatar.addEventListener('click', (e) => {
          e.stopPropagation();
          showAvatarPickerDialog(groupId, group);
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

    // Scroll to latest message after DOM renders. The screenshot deep link parks
    // the list at the top so the FAB is visible — but after SENDING we always
    // jump to the bottom so the user sees the message they just wrote.
    const groupRoot = pageContainer.querySelector('.conversation-page');
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = (SHOT_SCROLL_FAB && !fromSend)
          ? 0
          : messagesContainer.scrollHeight;
      }
    }, 0);

    // Floating "jump to newest message" button
    setupScrollToLatestFab(groupRoot);

    // Set up message long-press interactions
    setupMessageLongPress(group, 'group');
    setupMessageSwipeToReply(group, 'group');
    setupForwardAttributionLinks(groupRoot);

    // Set up send button and reply state management
    setupComposer(group, { isGroup: true });

    // Must stay last: the send re-renders this page underneath us.
    if (SHOT_SEND_STAY && !fromSend) sendShotMessage(groupRoot);
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
        <button class="menu-option" id="edit-description-btn">
          <span class="option-icon">📝</span>
          <span class="option-label">Edit Description</span>
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

    document.getElementById('edit-description-btn').addEventListener('click', () => {
      overlay.remove();
      showEditDescriptionDialog(groupId, group.description);
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
        <div class="member-avatar">${member.avatar || member.username.charAt(0).toUpperCase()}</div>
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

    const availableUsers = suggestedUsers.filter(u => !group.members.find(m => m.id === u.id));

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog add-members-sheet-dialog';

    const usersList = availableUsers.map(user => `
      <div class="suggested-user-item" data-user-id="${user.id}">
        <div class="user-avatar">${user.avatar}</div>
        <div class="user-content">
          <div class="user-username">${user.username}</div>
          <div class="user-domain">${user.domain}</div>
        </div>
        <div class="selection-indicator"></div>
      </div>
    `).join('');

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
          <div class="chip-avatar">${user.avatar}</div>
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
        u.username.toLowerCase().includes(query) || u.domain.toLowerCase().includes(query)
      );

      usersListEl.innerHTML = filtered.map(user => `
        <div class="suggested-user-item ${selectedMembers.find(m => m.id === user.id) ? 'selected' : ''}" data-user-id="${user.id}">
          <div class="user-avatar">${user.avatar}</div>
          <div class="user-content">
            <div class="user-username">${user.username}</div>
            <div class="user-domain">${user.domain}</div>
          </div>
          <div class="selection-indicator">${selectedMembers.find(m => m.id === user.id) ? '✓' : ''}</div>
        </div>
      `).join('');

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
  function renderNewMessagePage() {
    const usersList = suggestedUsers.length > 0
      ? suggestedUsers.map(user => `
        <div class="suggested-user-item" data-user-id="${user.id}">
          <div class="user-avatar">${user.avatar}</div>
          <div class="user-content">
            <div class="user-username">${user.username}</div>
            <div class="user-domain">${user.domain}</div>
          </div>
        </div>
      `).join('')
      : '<div class="empty-state">No suggested users.</div>';

    pageContainer.innerHTML = `
      <div class="new-message-page">
        <div class="messages-header">
          <h1>Guardian</h1>
        </div>
        <div class="search-container">
          <input type="text" class="search-field" placeholder="🔍 Search wallet, username" />
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
            <div class="section-header">Suggested Users</div>
            <div class="users-list">
              ${usersList}
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

    // Add user item handlers
    document.querySelectorAll('.suggested-user-item').forEach(item => {
      item.addEventListener('click', () => {
        const userId = item.dataset.userId;
        console.log('User tapped:', userId);
      });
    });
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
      validationError: ''
    };

    const usersList = suggestedUsers.map(user => `
      <div class="suggested-user-item" data-user-id="${user.id}">
        <div class="user-avatar">${user.avatar}</div>
        <div class="user-content">
          <div class="user-username">${user.username}</div>
          <div class="user-domain">${user.domain}</div>
        </div>
      </div>
    `).join('');

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
          <div class="section-header">Suggested Users</div>
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
    const membersChipsContainer = document.getElementById('members-chips-container');
    const createGroupButton = document.getElementById('create-group-button');
    const nameError = document.getElementById('name-error');
    const membersError = document.getElementById('members-error');

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

    // Helper function to find user by ID
    function findUserById(userId) {
      return suggestedUsers.find(u => u.id === userId);
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
          <div class="chip-avatar">${user.avatar}</div>
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

    // Helper function to filter and display users based on search
    function filterAndDisplayUsers() {
      const query = state.searchQuery.toLowerCase();
      const filteredUsers = query === ''
        ? suggestedUsers
        : suggestedUsers.filter(user =>
            user.username.toLowerCase().includes(query) ||
            user.domain.toLowerCase().includes(query)
          );

      const usersList = filteredUsers.map(user => `
        <div class="suggested-user-item" data-user-id="${user.id}">
          <div class="user-avatar">${user.avatar}</div>
          <div class="user-content">
            <div class="user-username">${user.username}</div>
            <div class="user-domain">${user.domain}</div>
          </div>
        </div>
      `).join('');

      suggestedUsersList.innerHTML = usersList;

      // Re-attach event listeners
      document.querySelectorAll('.suggested-user-item').forEach(item => {
        item.addEventListener('click', () => {
          const userId = item.dataset.userId;
          toggleUser(userId);
        });
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

    // Avatar file input handler
    avatarFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          state.avatarFile = file;
          state.avatarPreview = event.target.result;
          updateAvatarDisplay();
        };
        reader.readAsDataURL(file);
      }
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

    // Search members input handler
    searchMembersInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      filterAndDisplayUsers();
    });

    // Suggested user item handlers
    document.querySelectorAll('.suggested-user-item').forEach(item => {
      item.addEventListener('click', () => {
        const userId = item.dataset.userId;
        toggleUser(userId);
      });
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

      try {
        const response = await fetch('/api/groups', {
          method: 'POST',
          headers: authHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify({
            name: state.groupName,
            description: state.groupDescription,
            avatar: state.avatarPreview,
            visibility: state.visibility,
            members: state.selectedMembers.map(u => ({ id: u.id, username: u.username }))
          })
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          membersError.innerHTML = payload.error || 'Failed to create group.';
          createGroupButton.textContent = originalLabel;
          updateButtonState();
          return;
        }

        const shaped = addServerGroupToState(payload.group);
        window.location.hash = `/group/${shaped.id}`;
      } catch (error) {
        console.error('Failed to create group:', error);
        membersError.innerHTML = 'Failed to create group. Please try again.';
        createGroupButton.textContent = originalLabel;
        updateButtonState();
      }
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
    const pendingRequestCount = (group.joinRequests || []).length;

    const membersList = group.members.map(member => {
      const roleLabel = member.role === 'owner' ? 'Owner' : member.role === 'admin' ? 'Admin' : '';
      const showAdminToggle = myRole === 'owner' && member.id !== 'user_self' && member.role !== 'owner';
      const adminToggleLabel = member.role === 'admin' ? 'Remove Admin' : 'Make Admin';

      return `
        <div class="group-member-item" data-member-id="${member.id}">
          <div class="member-avatar">${member.avatar || member.username.charAt(0).toUpperCase()}</div>
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
            <div class="group-avatar-large" id="group-avatar-large">${group.avatar}</div>
            <button class="edit-avatar-button" id="edit-avatar-button">Change Photo</button>
          </div>

          <div class="group-details-section">
            <div class="detail-item">
              <div class="detail-label">Group Name</div>
              <div class="detail-value" id="group-name-value">${group.name}</div>
              <button class="detail-edit-button" id="edit-name-button">Edit</button>
            </div>

            <div class="detail-item">
              <div class="detail-label">Description</div>
              <div class="detail-value" id="group-description-value">${group.description || 'No description'}</div>
              <button class="detail-edit-button" id="edit-description-button">Edit</button>
            </div>
          </div>

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

    // Edit name
    document.getElementById('edit-name-button').addEventListener('click', () => {
      showEditNameDialog(groupId, group.name);
    });

    // Edit description
    document.getElementById('edit-description-button').addEventListener('click', () => {
      showEditDescriptionDialog(groupId, group.description);
    });

    // Change avatar
    document.getElementById('edit-avatar-button').addEventListener('click', () => {
      showAvatarPickerDialog(groupId, group);
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

        group.name = newName;

        // Update Messages list
        const conversation = conversations.find(c => c.groupId === groupId);
        if (conversation) {
          conversation.name = newName;
        }

        // Update header immediately without navigation
        const headerUsername = document.querySelector('.header-username');
        if (headerUsername) {
          headerUsername.textContent = newName;
        }

        overlay.remove();
        showToast('Group name updated', { type: 'success' });
        renderMessagesPage(); // Update messages list
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

        group.description = newDesc;

        overlay.remove();
        showToast('Description updated', { type: 'success' });
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
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog-header">
        <h2>Change Group Photo</h2>
      </div>
      <div class="dialog-content">
        <div id="avatar-preview" class="avatar-preview">
          <div class="avatar-placeholder-large">${groupData.avatar}</div>
        </div>
        <input type="file" id="avatar-file-picker" accept="image/*" style="display: none;" />
        <button class="button-secondary" id="select-photo-button">Select Photo</button>
        <div class="validation-error" id="avatar-error"></div>
      </div>
      <div class="dialog-footer">
        <button class="button-secondary" id="cancel-avatar">Cancel</button>
        <button class="button-primary" id="save-avatar" disabled>Use Photo</button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    let selectedFile = null;
    const filePicker = document.getElementById('avatar-file-picker');
    const preview = document.getElementById('avatar-preview');
    const selectBtn = document.getElementById('select-photo-button');
    const saveBtn = document.getElementById('save-avatar');
    const errorEl = document.getElementById('avatar-error');

    selectBtn.addEventListener('click', () => {
      filePicker.click();
    });

    filePicker.addEventListener('change', (e) => {
      const file = e.target.files[0];
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

    document.getElementById('cancel-avatar').addEventListener('click', () => {
      overlay.remove();
    });

    document.getElementById('save-avatar').addEventListener('click', async () => {
      if (!selectedFile) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result;

        try {
          const response = await fetch(`/api/groups/${groupId}/avatar`, {
            method: 'PUT',
            headers: {
              'content-type': 'application/json',
              'x-usernode-token': localStorage.getItem('usernode-token')
            },
            body: JSON.stringify({ avatar: base64 })
          });

          if (!response.ok) {
            throw new Error('Failed to update avatar');
          }

          const group = groups.find(g => g.id === groupId);
          group.avatar = base64;

          // Update Messages list
          const conversation = conversations.find(c => c.groupId === groupId);
          if (conversation) {
            conversation.avatar = base64;
          }

          // Update header avatar immediately
          const headerAvatar = document.querySelector('.conversation-avatar-header');
          if (headerAvatar) {
            headerAvatar.innerHTML = base64.includes('data:') ? `<img src="${base64}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />` : base64;
          }

          overlay.remove();
          showToast('Photo updated', { type: 'success' });
          renderMessagesPage(); // Update messages list
        } catch (error) {
          errorEl.textContent = 'Failed to update photo';
          console.error(error);
        }
      };
      reader.readAsDataURL(selectedFile);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
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
      .map(user => `
        <div class="suggested-user-item" data-user-id="${user.id}">
          <div class="user-avatar">${user.avatar}</div>
          <div class="user-content">
            <div class="user-username">${user.username}</div>
            <div class="user-domain">${user.domain}</div>
          </div>
          <div class="selection-indicator"></div>
        </div>
      `).join('');

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
          <div class="chip-avatar">${user.avatar}</div>
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
        (u.username.toLowerCase().includes(query) || u.domain.toLowerCase().includes(query))
      );

      suggestedList.innerHTML = filtered.map(user => `
        <div class="suggested-user-item ${selectedMembers.find(m => m.id === user.id) ? 'selected' : ''}" data-user-id="${user.id}">
          <div class="user-avatar">${user.avatar}</div>
          <div class="user-content">
            <div class="user-username">${user.username}</div>
            <div class="user-domain">${user.domain}</div>
          </div>
          <div class="selection-indicator">${selectedMembers.find(m => m.id === user.id) ? '✓' : ''}</div>
        </div>
      `).join('');

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
          <div class="member-avatar">${member.avatar || member.username.charAt(0).toUpperCase()}</div>
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
        const response = await fetch(`/api/groups/${groupId}/members/${memberId}`, {
          method: 'DELETE',
          headers: {
            'x-usernode-token': localStorage.getItem('usernode-token')
          }
        });

        if (!response.ok) {
          throw new Error('Failed to remove member');
        }

        const group = groups.find(g => g.id === groupId);
        group.members = group.members.filter(m => m.id !== memberId);
        group.memberCount = group.members.length;

        // Add system message
        group.messages.push({
          id: 'msg_' + Date.now(),
          senderId: 'system',
          senderName: 'System',
          text: `${member.username} was removed`,
          timestamp: Date.now(),
          isOutgoing: false,
          isSystemMessage: true
        });

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
      try {
        const response = await fetch(`/api/groups/${groupId}/leave`, {
          method: 'POST',
          headers: {
            'x-usernode-token': localStorage.getItem('usernode-token')
          }
        });

        if (!response.ok) {
          throw new Error('Failed to leave group');
        }

        const group = groups.find(g => g.id === groupId);
        group.members = group.members.filter(m => m.id !== 'user_self');
        group.memberCount = group.members.length;
        group.isLeftByUser = true;

        // Add system message
        group.messages.push({
          id: 'msg_' + Date.now(),
          senderId: 'system',
          senderName: 'System',
          text: 'You left the group',
          timestamp: Date.now(),
          isOutgoing: false,
          isSystemMessage: true
        });

        overlay.remove();
        window.location.hash = '/messages';
        showToast('You left the group', { type: 'success' });
      } catch (error) {
        console.error(error);
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

  // Create a new channel
  function createChannel(name, description, visibility, avatarData) {
    const channelId = 'channel_' + Date.now();
    const timestamp = Date.now();
    const avatarValue = avatarData || name.charAt(0).toUpperCase();

    const newChannel = {
      id: channelId,
      name: name,
      description: description,
      avatar: avatarValue,
      isPublic: visibility === 'public',
      creatorId: 'user_self',
      createdAt: timestamp,
      followerCount: 1,
      followers: { 'user_self': true },
      mutedByUsers: {},
      posts: []
    };

    channels.push(newChannel);

    const newConversation = {
      id: 'conv_channel_' + channelId,
      type: 'channel',
      channelId: channelId,
      name: name,
      avatar: avatarValue,
      lastMessage: 'No posts yet',
      timestamp: timestamp,
      unreadCount: 0,
      archived: false,
      pinned: false
    };

    conversations.unshift(newConversation);
    return channelId;
  }

  // Publish a post to a channel
  function publishPost(channelId, text, imageData) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel || channel.creatorId !== 'user_self') {
      return null;
    }

    const postId = 'post_' + Date.now();
    const timestamp = Date.now();

    const newPost = {
      id: postId,
      channelId: channelId,
      authorId: 'user_self',
      text: text,
      imageData: imageData || null,
      timestamp: timestamp,
      reactions: {},
      isPinned: false
    };

    channel.posts.unshift(newPost);

    // Update last post in conversation
    const conv = conversations.find(c => c.type === 'channel' && c.channelId === channelId);
    if (conv) {
      conv.lastMessage = text.substring(0, 100);
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
        lastMessage: channel.posts[0]?.text.substring(0, 100) || 'No posts yet',
        timestamp: channel.posts[0]?.timestamp || channel.createdAt,
        unreadCount: channel.posts.length,
        archived: false,
        pinned: false
      };
      conversations.unshift(newConversation);
    }
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
    }
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

  // Mute/unmute channel notifications
  function toggleMuteChannel(channelId, isMuted) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;

    if (isMuted) {
      channel.mutedByUsers['user_self'] = true;
    } else {
      delete channel.mutedByUsers['user_self'];
    }
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
          conv.lastMessage = channel.posts[0].text.substring(0, 100);
          conv.timestamp = channel.posts[0].timestamp;
        } else {
          conv.lastMessage = 'No posts yet';
        }
      }
    }
  }

  // Delete a channel (owner only)
  function deleteChannel(channelId) {
    const channelIndex = channels.findIndex(c => c.id === channelId);
    if (channelIndex > -1) {
      channels.splice(channelIndex, 1);
    }

    conversations = conversations.filter(c => !(c.type === 'channel' && c.channelId === channelId));
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
          <div class="post-card-avatar">${channel.avatar}</div>
          <div class="post-card-channel">${channel.name}</div>
          <div class="post-card-time">${formatTimestamp(post.timestamp)}</div>
        </div>
        <div class="post-content">${post.text}</div>
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
    if (content) content.innerHTML = post.text;
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
  function renderChannelView(channelId) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) {
      window.location.hash = '/messages';
      return;
    }

    const isOwner = channel.creatorId === 'user_self';
    const isFollowing = !!channel.followers['user_self'];

    // channel.posts is newest-first (publishPost unshifts), so the natural
    // top-of-list position already shows the latest post — no scrolling needed.
    const postsList = channel.posts.map(post => postCardHTML(channel, post)).join('');

    pageContainer.innerHTML = `
      <div class="conversation-page channel-page">
        <div class="conversation-page-header">
          <button class="back-button" aria-label="Back to messages">←</button>
          <div class="conversation-header-info group-header-info" id="channel-header-info-${channelId}">
            <div class="conversation-avatar-header">${channel.avatar}</div>
            <div class="header-text">
              <div class="header-username">${channel.name}</div>
              <div class="header-member-count">${formatFollowerCount(channel.followerCount)} followers</div>
            </div>
          </div>
          ${(!isFollowing && !isOwner) ? `<button class="channel-follow-pill" aria-label="Follow channel">Follow</button>` : ''}
          <button class="menu-button" aria-label="More options">⋮</button>
        </div>
        <div class="channel-feed">
          ${postsList || `
            <div class="empty-state channel-empty-state">
              <div class="channel-empty-icon" aria-hidden="true">📭</div>
              <div class="channel-empty-title">No posts yet</div>
              <div class="channel-empty-hint">${isOwner ? 'Publish your first post below.' : 'Check back soon for updates.'}</div>
            </div>
          `}
        </div>
        ${isOwner ? `
          <div class="channel-footer">
            <div class="composer-container">
              <textarea class="composer-input" placeholder="What's happening?" rows="1"></textarea>
              <div class="composer-actions">
                <button class="image-button" aria-label="Add image">📷</button>
                <button class="publish-button" aria-label="Publish">Publish</button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Back button handler. Returns to the Create menu when this channel was
    // opened from its managed-channels list, otherwise falls back to Messages.
    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = groupChannelBackTarget;
    });

    // Menu button handler
    const menuButton = document.querySelector('.menu-button');
    if (menuButton) {
      menuButton.addEventListener('click', () => {
        showChannelMenu(channelId, channel, isOwner);
      });
    }

    // Header Follow pill — the bottom "Following" strip is gone; Unfollow still
    // lives in the ⋮ menu, so followers need no pill at all.
    const followPill = document.querySelector('.channel-follow-pill');
    if (followPill) {
      followPill.addEventListener('click', () => {
        followChannel(channelId);
        showToast('Following channel', { type: 'success' });
        renderChannelView(channelId);
      });
    }

    const feed = document.querySelector('.channel-feed');

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

      function autoExpandTextarea() {
        composerInput.style.height = 'auto';
        const newHeight = Math.min(composerInput.scrollHeight, 120);
        composerInput.style.height = newHeight + 'px';
      }

      composerInput.addEventListener('input', autoExpandTextarea);

      publishButton.addEventListener('click', () => {
        const text = composerInput.value.trim();
        if (!text) return;

        publishPost(channelId, text);
        composerInput.value = '';
        composerInput.style.height = '40px';
        renderChannelView(channelId);
        showToast('Post published', { type: 'success' });
      });
    }

    // Screenshot-state: drive the REAL controls so the deep links exercise the
    // actual listener wiring above, not just the rendering functions.
    // Reacting is hold-only now, and a hold isn't expressible as a URL — so this
    // one enters the state the gesture would, by calling the same opener the
    // long-press timer calls.
    if (SHOT_POST_REACTIONS) {
      const firstCard = feed?.querySelector('.post-card');
      if (firstCard) openReactionPicker(firstCard.dataset.postId);
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
  }

  // Show channel menu
  function showChannelMenu(channelId, channel, isOwner) {
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

    if (isOwner) {
      menuHTML += `
        <button class="menu-option" id="edit-channel-btn">
          <span class="option-icon">✏️</span>
          <span class="option-label">Edit Channel</span>
          <span class="option-chevron">›</span>
        </button>
        <button class="menu-option leave-option" id="delete-channel-btn">
          <span class="option-icon">🗑️</span>
          <span class="option-label">Delete Channel</span>
        </button>
      `;
    } else {
      menuHTML += `
        <button class="menu-option" id="copy-link-btn">
          <span class="option-icon">🔗</span>
          <span class="option-label">Copy Link</span>
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

    menuHTML += `</div>`;
    dialog.innerHTML = menuHTML;
    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    const closeButton = dialog.querySelector('.close-dialog-button');
    closeButton.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    if (isOwner) {
      document.getElementById('delete-channel-btn')?.addEventListener('click', () => {
        overlay.remove();
        showConfirmDialog('Delete Channel', `Delete "${channel.name}"? This cannot be undone.`, () => {
          deleteChannel(channelId);
          window.location.hash = '/messages';
          showToast('Channel deleted', { type: 'success' });
        });
      });
    } else {
      document.getElementById('copy-link-btn')?.addEventListener('click', () => {
        const link = `channel/${channelId}`;
        navigator.clipboard.writeText(link).then(() => {
          overlay.remove();
          showToast('Link copied to clipboard', { type: 'success' });
        });
      });

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
          <div class="forward-preview-channel">${channel.avatar} ${channel.name}</div>
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
          <div class="user-avatar">${target.avatar}</div>
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

    const composerDisabled = !channel.currentUserCanSend ? 'disabled' : '';
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
        <div class="composer-container" style="${composerDisplay}">
          ${viewOnlyBadge}
          <div class="reply-preview-bar" style="display: none;">
            <div class="reply-preview-content">
              <div class="reply-quote">
                <div class="reply-sender">Replying to: <span class="reply-sender-name"></span></div>
                <div class="reply-text"></div>
              </div>
              <button class="reply-close-button" aria-label="Cancel reply">✕</button>
            </div>
          </div>
          <button class="emoji-button" aria-label="Emoji">😊</button>
          <textarea class="composer-input" placeholder="Message..." rows="1" ${composerDisabled}></textarea>
          <button class="send-button" aria-label="Send" ${composerDisabled}>➤</button>
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
      }
    }, 0);

    // Set up message long-press interactions
    setupMessageLongPress(channel, 'channel');

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
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          state.avatarFile = file;
          state.avatarPreview = event.target.result;
          updateAvatarDisplay();
        };
        reader.readAsDataURL(file);
      }
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

    createChannelButton.addEventListener('click', () => {
      nameError.innerHTML = '';

      if (!state.channelName.trim()) {
        nameError.innerHTML = 'Channel name is required.';
        return;
      }

      const channelId = createChannel(
        state.channelName,
        state.channelDescription,
        'public',
        state.avatarPreview
      );

      window.location.hash = `/channel/${channelId}`;
    });

    updateButtonState();
  }

  // Profile Screen Functions
  let profileState = {
    username: 'johndoe',
    bio: 'Building on Usernode',
    avatarUrl: null,
    avatarImageId: null,
    walletAddress: '0x91FA987D4DC5A4E2DDB0F3E8C7B6A5D2C8'
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
          currentUser = { id: data.user.id, username: data.user.username || 'johndoe' };
          profileState.username = data.user.username || 'johndoe';
          if (data.user.usernode_pubkey) {
            profileState.walletAddress = data.user.usernode_pubkey;
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }
  }

  function renderProfilePage() {
    const username = profileState.username;
    const bio = profileState.bio;
    const walletAddress = profileState.walletAddress;

    const shortAddress = walletAddress.substring(0, 6) + '...' + walletAddress.substring(walletAddress.length - 4);
    const initials = getInitialsFromUsername(username);

    let avatarContent = initials;
    if (profileState.avatarUrl) {
      avatarContent = `<img src="${profileState.avatarUrl}" alt="Profile avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    }

    pageContainer.innerHTML = `
      <div class="profile-page">
        <div class="messages-header">
          <h1>Guardian</h1>
        </div>

        <div class="profile-content">
          <!-- Profile Header -->
          <div class="profile-header-section">
            <div class="profile-avatar-large" id="profile-avatar-large">${avatarContent}</div>
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
              <div class="wallet-address">${shortAddress}</div>
            </div>
            <button class="wallet-copy-btn" id="wallet-copy-btn">📋</button>
          </div>
        </div>
      </div>
    `;

    // Make avatar clickable for upload
    const avatarEl = document.getElementById('profile-avatar-large');
    avatarEl.addEventListener('click', () => {
      if (window.usernode && window.usernode.uploadFile) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (file) {
            try {
              const stored = await window.usernode.uploadFile(file, { visibility: 'public' });
              profileState.avatarUrl = stored.url;
              profileState.avatarImageId = stored.id;
              renderProfilePage();
            } catch (err) {
              console.error('Avatar upload failed:', err);
            }
          }
        };
        input.click();
      } else {
        console.log('Avatar upload bridge not available');
      }
    });

    // Edit Bio menu item
    document.getElementById('edit-bio-menu-item').addEventListener('click', () => {
      window.location.hash = '/profile/edit-bio';
    });

    // Wallet copy button
    document.getElementById('wallet-copy-btn').addEventListener('click', () => {
      console.log('Copy address placeholder');
    });
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
          <textarea id="bio-textarea" class="bio-textarea" maxlength="500" placeholder="Write your bio...">${currentBio}</textarea>
          <div class="char-count"><span id="bio-char-count">${currentBio.length}</span>/500</div>
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
      renderMessagesPage();
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

      // Gate the group's chat/info/management screens to members only. Non-members
      // (or unknown group IDs) are redirected to the info/detail screen instead.
      const joinedGroup = groups.find(g => g.id === groupId);
      const isMember = !!joinedGroup && joinedGroup.members.some(m => m.id === 'user_self');

      if (!isMember) {
        window.location.hash = `/discover/group/${groupId}`;
        return;
      }

      // Add Members and Join Requests are restricted to owner/admin
      const myRole = (joinedGroup.members.find(m => m.id === 'user_self') || {}).role;
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
        groupChannelBackTarget = (priorHash === '/create') ? '/create' : '/messages';
        renderGroupConversationPage(groupId);
      }
    } else if (path.startsWith('channel/')) {
      const channelId = path.split('/')[1];

      // Remove active from all nav tabs when on channel screen
      navTabs.forEach(tab => tab.classList.remove('active'));
      // Hide bottom nav on channel screen
      bottomNav.style.display = 'none';
      groupChannelBackTarget = (priorHash === '/create') ? '/create' : '/messages';
      renderChannelView(channelId);
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
    } else if (path.startsWith('discover/group/')) {
      const groupId = path.split('/')[2];
      bottomNav.style.display = 'none';
      navTabs.forEach(tab => tab.classList.remove('active'));
      renderGroupDetailScreen(groupId);
    } else if (path.startsWith('discover/channel/')) {
      const channelId = path.split('/')[2];
      bottomNav.style.display = 'none';
      navTabs.forEach(tab => tab.classList.remove('active'));
      renderDiscoverChannelDetailScreen(channelId);
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

  // Initial render. Identity and server-backed groups are hydrated first so
  // the first paint already knows who "You" is and which groups are real.
  (async () => {
    await fetchUserData();
    await hydrateServerGroups();
    handleNavigation();
  })();
});
