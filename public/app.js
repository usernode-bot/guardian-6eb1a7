// Guardian app - bottom navigation router
document.addEventListener('DOMContentLoaded', () => {
  console.log('Guardian app loaded');

  // Get token from URL or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
    localStorage.setItem('usernode-token', token);
  }

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
      lastMessage: '📷 Staging demo photo',
      timestamp: Date.now() - 1 * 60 * 1000, // 1 minute ago
      unreadCount: 2,
      onlineStatus: true,
      archived: false,
      pinned: false,
      messages: [
        { id: 'msg_1', text: "Hey! How's it going?", timestamp: Date.now() - 5*60*1000, isOutgoing: false },
        { id: 'msg_2', text: "Great! Just finished work", timestamp: Date.now() - 4.5*60*1000, isOutgoing: true },
        { id: 'msg_3', text: "Nice! Want to grab dinner?", timestamp: Date.now() - 4*60*1000, isOutgoing: false },
        { id: 'msg_4', text: "Sure! When?", timestamp: Date.now() - 3.5*60*1000, isOutgoing: true },
        { id: 'msg_5', text: "How about 7pm?", timestamp: Date.now() - 3*60*1000, isOutgoing: false },
        { id: 'msg_6', text: "That sounds great! Let's meet up soon.", timestamp: Date.now() - 2*60*1000, isOutgoing: true },
        { id: 'msg_demo_image', text: 'Staging demo photo', imageUrl: DEMO_IMAGE_BLUE, timestamp: Date.now() - 1*60*1000, isOutgoing: false }
      ]
    },
    {
      id: 'conv_2',
      type: 'direct',
      username: 'Bob Wilson',
      avatar: 'BW',
      lastMessage: 'Did you see the latest updates?',
      timestamp: Date.now() - 60 * 60 * 1000, // 1 hour ago
      unreadCount: 0,
      onlineStatus: false,
      archived: false,
      pinned: false,
      messages: [
        { id: 'msg_1', text: "Check out the new features", timestamp: Date.now() - 2*60*60*1000, isOutgoing: false },
        { id: 'msg_2', text: "Looking good!", timestamp: Date.now() - 1.5*60*60*1000, isOutgoing: true },
        { id: 'msg_3', text: "Did you see the latest updates?", timestamp: Date.now() - 60*60*1000, isOutgoing: false }
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
      members: [
        { id: 'user_self', username: 'You' },
        { id: 'user_alice', username: 'Alice' },
        { id: 'user_bob', username: 'Bob' },
        { id: 'user_charlie', username: 'Charlie' }
      ],
      messages: [
        { id: 'msg_1', senderId: 'user_alice', senderName: 'Alice', text: 'Hey everyone!', timestamp: Date.now() - 10*60*1000, isOutgoing: false },
        { id: 'msg_2', senderId: 'user_bob', senderName: 'Bob', text: 'Welcome to the group!', timestamp: Date.now() - 9*60*1000, isOutgoing: false },
        { id: 'msg_3', senderId: 'user_self', text: 'Thanks for adding me!', timestamp: Date.now() - 8*60*1000, isOutgoing: true },
        { id: 'msg_4', senderId: 'user_charlie', senderName: 'Charlie', text: 'Great to have you here!', timestamp: Date.now() - 7*60*1000, isOutgoing: false },
        { id: 'msg_5', senderId: 'user_alice', senderName: 'Alice', text: 'Let\'s catch up soon!', timestamp: Date.now() - 6*60*1000, isOutgoing: false },
        { id: 'msg_6', senderId: 'user_self', text: 'Absolutely! Looking forward to it.', timestamp: Date.now() - 5*60*1000, isOutgoing: true },
        { id: 'msg_demo_image', senderId: 'user_alice', senderName: 'Alice', text: 'Staging demo photo', imageUrl: DEMO_IMAGE_ORANGE, timestamp: Date.now() - 4*60*1000, isOutgoing: false }
      ]
    },
    {
      id: 'group_2',
      name: 'Design Team',
      avatar: 'DT',
      description: 'Collaborate on visual designs and UI/UX',
      memberCount: 3,
      members: [
        { id: 'user_self', username: 'You' },
        { id: 'user_1', username: 'aksaranft' },
        { id: 'user_8', username: 'designpro' }
      ],
      messages: [
        { id: 'msg_1', senderId: 'user_8', senderName: 'designpro', text: 'Just posted the new mockups', timestamp: Date.now() - 30*60*1000, isOutgoing: false },
        { id: 'msg_2', senderId: 'user_self', text: 'Thanks! Reviewing now', timestamp: Date.now() - 25*60*1000, isOutgoing: true }
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
      lastMessage: '📷 Staging demo photo',
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
    }
  ]);

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
      members: [],
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
      members: [],
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
      members: [],
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
      members: [],
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
      members: [],
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
      members: [],
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
      members: [],
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
      members: [],
      isFeatured: false,
      isNew: false,
      createdAt: Date.now() - 12*24*60*60*1000
    }
  ];

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
          likes: { 'user_self': true, 'user_1': true, 'user_2': true },
          isPinned: false
        },
        {
          id: 'post_2',
          channelId: 'channel_1',
          authorId: 'user_4',
          text: 'Monthly Update: Progress Report\n\nWe\'ve completed major milestones this month. Check the roadmap for details.',
          timestamp: Date.now() - 24 * 60 * 60 * 1000,
          likes: { 'user_1': true },
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
          likes: {},
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
          likes: { 'user_1': true, 'user_2': true },
          isPinned: false
        }
      ]
    }
  ];

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
    }
  ]);

  // Active tab state
  let activeMessagesTab = 'all';
  let activeDiscoverTab = 'all';
  let searchQuery = '';
  let showMessagesSearch = false;
  let searchTimeout = null;

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

  // Helper: create a new group and associated conversation
  function createGroup(groupName, groupDescription, selectedMembers, avatarData) {
    const groupId = generateGroupId();
    const timestamp = Date.now();
    const avatarValue = avatarData || generateDefaultAvatar(groupName);

    const newGroup = {
      id: groupId,
      name: groupName,
      description: groupDescription,
      avatar: avatarValue,
      memberCount: selectedMembers.length + 1, // +1 for the user
      members: [{ id: 'user_self', username: 'You' }, ...selectedMembers],
      createdAt: timestamp,
      messages: [
        {
          id: 'msg_' + timestamp,
          senderId: 'system',
          senderName: 'System',
          text: 'Group created.',
          timestamp: timestamp,
          isOutgoing: false,
          isSystemMessage: true
        }
      ]
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
    if (!url) return msg.text || '';

    const caption = msg.text
      ? `<div class="message-caption">${msg.text}</div>`
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
          <div class="conversation-item" data-conversation-id="${item.id}" data-route-hash="${routeHash}">
            <div class="conversation-avatar">${item.avatar}</div>
            <div class="conversation-content">
              <div class="conversation-header">
                <span class="conversation-username">${displayName}</span>
                <span class="conversation-timestamp">${formatTimestamp(item.timestamp)}</span>
              </div>
              <p class="conversation-message">${item.lastMessage}</p>
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

  // Re-render whichever thread screen a message was just sent to.
  // A group/channel thread must NOT go through renderConversationPage -
  // its id isn't in `conversations`, which bounced the user to the list.
  function rerenderThread(thread) {
    if (groups.some(g => g.id === thread.id)) {
      renderGroupConversationPage(thread.id);
    } else if (channels.some(c => c.id === thread.id)) {
      renderChannelConversationPage(thread.id);
    } else {
      renderConversationPage(thread.id);
    }
  }

  // Filter discover communities by tab
  function filterDiscoverCommunities(tab) {
    let filteredGroups = discoverGroups.filter(g => !groups.some(jg => jg.id === g.id));
    let filteredChans = discoverChannels.filter(c => !channels.some(jc => jc.id === c.id));

    if (tab === 'groups') {
      return { groups: filteredGroups, channels: [] };
    } else if (tab === 'channels') {
      return { groups: [], channels: filteredChans };
    } else {
      return { groups: filteredGroups, channels: filteredChans };
    }
  }

  // Join a group from discover
  function joinDiscoverGroup(groupId) {
    const discoverGroup = discoverGroups.find(g => g.id === groupId);
    if (!discoverGroup) return;

    const newGroup = {
      id: groupId,
      name: discoverGroup.name,
      description: discoverGroup.description,
      avatar: discoverGroup.avatar,
      memberCount: discoverGroup.memberCount + 1,
      members: [{ id: 'user_self', username: 'You' }, ...discoverGroup.members],
      createdAt: Date.now(),
      messages: [
        {
          id: 'msg_' + Date.now(),
          senderId: 'system',
          senderName: 'System',
          text: 'You joined the group.',
          timestamp: Date.now(),
          isOutgoing: false,
          isSystemMessage: true
        }
      ]
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
          <h1>Discover</h1>
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
  function renderGroupDetailScreen(groupId) {
    let group = groups.find(g => g.id === groupId);
    if (!group) {
      group = discoverGroups.find(g => g.id === groupId);
    }
    if (!group) {
      window.location.hash = '/discover';
      return;
    }

    const isJoined = groups.some(g => g.id === groupId);

    pageContainer.innerHTML = `
      <div class="detail-screen">
        <div class="detail-header">
          <button class="back-button" aria-label="Back">←</button>
          <h1>Group Details</h1>
        </div>
        <div class="detail-content">
          <div class="detail-avatar">${group.avatar}</div>
          <h2>${group.name}</h2>
          <p class="detail-description">${group.description}</p>
          <div class="detail-stat">${group.memberCount} members</div>
          ${!isJoined ? `<button class="detail-button" id="join-button">Join Group</button>` : '<button class="detail-button" disabled>Already Joined</button>'}
        </div>
      </div>
    `;

    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = '/discover';
    });

    const joinBtn = document.getElementById('join-button');
    if (joinBtn) {
      joinBtn.addEventListener('click', () => {
        joinDiscoverGroup(groupId);
        window.location.hash = '/discover';
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
          <div class="conversation-item" data-conversation-id="${item.id}" data-route-hash="${routeHash}">
            <div class="conversation-avatar">${item.avatar}</div>
            <div class="conversation-content">
              <div class="conversation-header">
                <span class="conversation-username">${displayName}</span>
                <span class="conversation-timestamp">${formatTimestamp(item.timestamp)}</span>
              </div>
              <p class="conversation-message">${item.lastMessage}</p>
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

    pageContainer.innerHTML = `
      <div class="messages-page">
        <div class="messages-header">
          <h1>Messages</h1>
          <span class="search-icon">🔍</span>
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
          ${conversationsList || `<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-message">${emptyMessage}</div></div>`}
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
  // Shared composer markup for DM, group and channel threads.
  // The attach-image control sits on the LEFT of the input field.
  function composerMarkup(options = {}) {
    const disabled = options.disabled ? 'disabled' : '';
    return `
      <div class="reply-preview-bar" style="display: none;">
        <div class="reply-preview-content">
          <div class="reply-quote">
            <div class="reply-sender">Replying to: <span class="reply-sender-name"></span></div>
            <div class="reply-text"></div>
          </div>
          <button class="reply-close-button" aria-label="Cancel reply">✕</button>
        </div>
      </div>
      <div class="pending-image-bar" style="display: none;">
        <img class="pending-image-thumb" alt="Selected image preview" />
        <span class="pending-image-status">Uploading…</span>
        <button class="pending-image-remove" aria-label="Remove image">✕</button>
      </div>
      <button class="attach-image-button" type="button" aria-label="Add image" ${disabled}>📷</button>
      <input type="file" class="attach-image-input" accept="image/png,image/jpeg,image/gif,image/webp" style="display: none;" />
      <textarea class="composer-input" placeholder="Message..." rows="1" ${disabled}></textarea>
      <button class="send-button" aria-label="Send" ${disabled}>➤</button>
    `;
  }

  function renderConversationPage(conversationId) {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) {
      renderPage('messages');
      return;
    }

    const messagesList = conversation.messages.map(msg => {
      let messageHTML = `<div class="message ${msg.isOutgoing ? 'outgoing' : 'incoming'}" data-message-id="${msg.id}">`;

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

      messageHTML += `
        <div class="message-bubble${messageBubbleClass(msg)}" data-message-id="${msg.id}">${messageBodyHTML(msg)}</div>
        <div class="message-timestamp">${formatMessageTime(msg.timestamp)}</div>
      </div>`;

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
        <div class="messages-container">
          ${messagesList}
        </div>
        <div class="composer-container">
          ${composerMarkup()}
        </div>
      </div>
    `;

    // Add back button handler
    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = '/messages';
    });

    // Scroll to latest message after DOM renders
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 0);

    // Set up message long-press interactions
    setupMessageLongPress(conversation);

    // Set up image lightbox for image messages
    setupImageLightbox();

    // Set up send button and reply state management
    setupComposer(conversation);
  }

  // Setup long-press menu for messages
  function setupMessageLongPress(conversation) {
    const messageBubbles = document.querySelectorAll('.message-bubble');
    const LONG_PRESS_DURATION = 350;
    const MENU_ITEMS = [
      { icon: '↩️', label: 'Reply', action: 'reply' },
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

      // Create context menu (Delete only shown for the current user's own messages)
      const menuTargetMessage = conversation.messages.find(m => m.id === messageId);
      const canDeleteMenuTarget = !!menuTargetMessage && menuTargetMessage.isOutgoing === true;
      const visibleMenuItems = MENU_ITEMS.filter(item => item.action !== 'delete' || canDeleteMenuTarget);

      const contextMenu = document.createElement('div');
      contextMenu.className = 'context-menu';
      const menuButtons = visibleMenuItems.map(item => `
        <button class="menu-item" aria-label="${item.label}" data-action="${item.action}">
          <span class="menu-icon">${item.icon}</span>
          <span class="menu-label">${item.label}</span>
        </button>
      `).join('');
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
                : (targetMessage.senderName || conversation.username);
              const previewText = truncateText(messagePreviewText(targetMessage), 50);
              setReplyState(messageId, senderName, previewText);
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
            if (targetMessage && targetMessage.isOutgoing === true) {
              showConfirmDialog('Delete Message', 'Delete this message? This cannot be undone.', () => {
                deleteMessageFromThread(conversation, messageId);
              });
            } else {
              showToast('You can only delete your own messages', { type: 'error' });
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

      // Mouse events
      bubble.addEventListener('mousedown', (e) => {
        if (menuState.lastEventWasTouch) return;
        menuState.touchStartTime = Date.now();
        menuState.longPressTimer = setTimeout(() => {
          showMenu(messageId, bubble);
        }, LONG_PRESS_DURATION);
      });

      bubble.addEventListener('mouseup', () => {
        if (menuState.lastEventWasTouch) return;
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
  }

  // Delete a message from a conversation/group/channel thread (own messages only)
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

  // Full-screen viewer for image messages. Delegated on the thread
  // container so it survives the re-render after every send.
  function setupImageLightbox() {
    const messagesContainer = document.querySelector('.messages-container');
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

  // Map platform storage error codes onto user-facing copy. The code itself is
  // appended so a user reporting "upload failed" can tell us the actual cause
  // instead of the catch-all string.
  function uploadErrorMessage(err) {
    const code = uploadErrorCode(err);
    switch (code) {
      case 'file_too_large':
        return 'Image is too large (max 5 MB) — file_too_large';
      case 'invalid_image':
        return 'Only PNG, JPEG, GIF or WebP images are supported — invalid_image';
      case 'app_quota_exceeded':
      case 'user_quota_exceeded':
      case 'staging_quota_exceeded':
        return `Upload limit reached — try a smaller image or delete old ones (${code})`;
      case 'storage_unavailable':
        return "Image upload isn't available right now — storage_unavailable";
      default:
        break;
    }

    // Outside the platform shell the bridge rejects without a code
    const message = (err && typeof err.message === 'string') ? err.message.trim() : '';
    if (/platform shell|not available standalone/i.test(message)) {
      return "Image upload isn't available here";
    }
    if (code) return `Upload failed — ${code}`;
    if (message) return `Upload failed — ${truncateText(message, 80)}`;
    return 'Upload failed — please try again';
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

  function setupComposer(conversation) {
    const composerInput = document.querySelector('.composer-input');
    const sendButton = document.querySelector('.send-button');
    const replyCloseButton = document.querySelector('.reply-close-button');
    const attachButton = document.querySelector('.attach-image-button');
    const attachInput = document.querySelector('.attach-image-input');
    const pendingBar = document.querySelector('.pending-image-bar');
    const pendingThumb = document.querySelector('.pending-image-thumb');
    const pendingStatus = document.querySelector('.pending-image-status');
    const pendingRemove = document.querySelector('.pending-image-remove');

    // Pending-image state is per render: every send re-runs setupComposer
    let pendingImage = null;

    function clearPendingImage() {
      if (pendingImage && pendingImage.objectUrl) {
        URL.revokeObjectURL(pendingImage.objectUrl);
      }
      pendingImage = null;
      if (pendingBar) pendingBar.style.display = 'none';
      if (pendingThumb) pendingThumb.removeAttribute('src');
      if (sendButton) sendButton.disabled = false;
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
        sendButton.disabled = true;
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
          sendButton.disabled = false;
          attachButton.disabled = false;
        } catch (err) {
          // Log everything the platform gave us plus exactly what we sent, so
          // "upload failed" reports are diagnosable from the console alone
          console.error('Image upload failed:', {
            code: uploadErrorCode(err),
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
      const readyImage = pendingImage && pendingImage.status === 'ready' ? pendingImage : null;
      // An image on its own is a valid message - text is optional now
      if (!text && !readyImage) return;

      // Create new message with optional reply metadata
      const newMessage = {
        id: `msg_${Date.now()}`,
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
      clearPendingImage();

      // Update conversation last message and timestamp for All tab sorting
      updateConversationLastMessage(
        conversation.id,
        truncateText(messagePreviewText(newMessage), 100),
        newMessage.timestamp
      );

      // Re-render the thread this message belongs to (DM, group or channel)
      rerenderThread(conversation);
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
  function renderGroupConversationPage(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) {
      renderPage('messages');
      return;
    }

    const messagesList = group.messages.map(msg => {
      let messageHTML = `<div class="message ${msg.isOutgoing ? 'outgoing' : 'incoming has-avatar'}" data-message-id="${msg.id}">`;

      if (msg.isOutgoing) {
        messageHTML += `
          <div class="message-bubble${messageBubbleClass(msg)}" data-message-id="${msg.id}">${messageBodyHTML(msg)}</div>
          <div class="message-timestamp">${formatMessageTime(msg.timestamp)}</div>
        </div>`;
      } else {
        messageHTML += `
          <div class="message-avatar">${msg.senderName ? msg.senderName.charAt(0).toUpperCase() : ''}</div>
          <div class="message-content">
            <div class="message-sender-name">${msg.senderName}</div>
            <div class="message-bubble${messageBubbleClass(msg)}" data-message-id="${msg.id}">${messageBodyHTML(msg)}</div>
            <div class="message-timestamp">${formatMessageTime(msg.timestamp)}</div>
          </div>
        </div>`;
      }

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
        <div class="messages-container">
          ${messagesList}
        </div>
        <div class="composer-container">
          ${composerMarkup()}
        </div>
      </div>
    `;

    // Add back button handler
    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = '/messages';
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

    // Scroll to latest message after DOM renders
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 0);

    // Set up message long-press interactions
    setupMessageLongPress(group);

    // Set up image lightbox for image messages
    setupImageLightbox();

    // Set up send button and reply state management
    setupComposer(group);
  }

  // Show group menu with all options (members, edit description, leave)
  function showGroupMenuDialog(groupId, group) {
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
        <button class="menu-option" id="add-members-btn">
          <span class="option-icon">➕</span>
          <span class="option-label">Add Members</span>
          <span class="option-chevron">›</span>
        </button>
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

    document.getElementById('add-members-btn').addEventListener('click', () => {
      overlay.remove();
      showAddMembersSheet(groupId, group);
    });

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
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog members-sheet-dialog';

    const membersList = group.members.map(member => `
      <div class="members-sheet-item" data-member-id="${member.id}">
        <div class="member-avatar">${member.avatar || member.username.charAt(0).toUpperCase()}</div>
        <div class="member-info">
          <div class="member-name">${member.username}</div>
        </div>
        ${member.id !== 'user_self' ? `<button class="member-remove-btn" data-member-id="${member.id}">✕</button>` : ''}
      </div>
    `).join('');

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
        const response = await fetch(`/api/groups/${groupId}/members`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-usernode-token': localStorage.getItem('usernode-token')
          },
          body: JSON.stringify({ userIds: selectedMembers.map(u => u.id) })
        });

        if (!response.ok) {
          throw new Error('Failed to add members');
        }

        group.members.push(...selectedMembers);
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
        <div class="new-message-header">
          <button class="back-button" aria-label="Back to messages">←</button>
          <h1>New Message</h1>
        </div>
        <div class="search-container">
          <input type="text" class="search-field" placeholder="🔍 Search wallet, username" />
        </div>
        <div class="create-options">
          <div class="create-group-card">
            <span class="group-icon">👥</span>
            <span class="group-label">Create Group</span>
            <span class="group-chevron">></span>
          </div>
          <div class="create-channel-card" data-testid="create-channel-entry">
            <span class="channel-icon">#</span>
            <span class="channel-label">Create Channel</span>
            <span class="channel-chevron">></span>
          </div>
        </div>
        <div class="suggested-users-section">
          <div class="section-header">Suggested Users</div>
          <div class="users-list">
            ${usersList}
          </div>
        </div>
      </div>
    `;

    // Add back button handler
    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = '/messages';
    });

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
      const isMembersSelected = state.selectedMembers.length >= 2;
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
    createGroupButton.addEventListener('click', () => {
      nameError.innerHTML = '';
      membersError.innerHTML = '';

      // Validate group name
      if (!state.groupName.trim()) {
        nameError.innerHTML = 'Group name is required.';
        return;
      }

      // Validate members
      if (state.selectedMembers.length < 2) {
        membersError.innerHTML = 'Select at least 2 members.';
        return;
      }

      // Create the group
      const groupId = createGroup(
        state.groupName,
        state.groupDescription,
        state.selectedMembers,
        state.avatarPreview
      );

      // Navigate to the new group chat
      window.location.hash = `/group/${groupId}`;
    });

    // Initialize button state
    updateButtonState();
  }

  // Render Group Info page
  function renderGroupInfoPage(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) {
      window.location.hash = '/messages';
      return;
    }

    const membersList = group.members.map(member => `
      <div class="group-member-item" data-member-id="${member.id}">
        <div class="member-avatar">${member.avatar || member.username.charAt(0).toUpperCase()}</div>
        <div class="member-info">
          <div class="member-name">${member.username}</div>
        </div>
      </div>
    `).join('');

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
            <button class="add-members-button" id="add-members-button">+ Add Members</button>
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
    document.getElementById('add-members-button').addEventListener('click', () => {
      window.location.hash = `/group/${groupId}/add-members`;
    });

    // Leave group
    document.getElementById('leave-group-button').addEventListener('click', () => {
      showLeaveGroupDialog(groupId, group.name);
    });

    // Member long-press handlers
    document.querySelectorAll('.group-member-item').forEach(item => {
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const memberId = item.dataset.memberId;
        showRemoveMemberConfirmation(groupId, memberId, group.members.find(m => m.id === memberId));
      });
    });
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
        const response = await fetch(`/api/groups/${groupId}/members`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-usernode-token': localStorage.getItem('usernode-token')
          },
          body: JSON.stringify({ userIds: selectedMembers.map(u => u.id) })
        });

        if (!response.ok) {
          throw new Error('Failed to add members');
        }

        // Add members to group
        group.members.push(...selectedMembers);
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
      likes: {},
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

  // Toggle like on a post
  function toggleLikePost(postId, channelId) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;

    const post = channel.posts.find(p => p.id === postId);
    if (!post) return;

    if (post.likes['user_self']) {
      delete post.likes['user_self'];
    } else {
      post.likes['user_self'] = true;
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

  // Render Channel View page
  function renderChannelView(channelId) {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) {
      window.location.hash = '/messages';
      return;
    }

    const isOwner = channel.creatorId === 'user_self';
    const isFollowing = channel.followers['user_self'];
    const isMuted = channel.mutedByUsers['user_self'];

    // Render posts in reverse chronological order
    const postsList = channel.posts.map(post => {
      const likeCount = Object.keys(post.likes).length;
      const userLiked = post.likes['user_self'];
      return `
        <div class="post-item" data-post-id="${post.id}">
          <div class="post-timestamp">${formatMessageTime(post.timestamp)}</div>
          <div class="post-content">${post.text}</div>
          <div class="post-actions">
            <button class="post-like-button ${userLiked ? 'liked' : ''}" data-post-id="${post.id}" title="Like">
              <span class="like-icon">❤️</span>
              <span class="like-count">${likeCount}</span>
            </button>
            <button class="post-share-button" data-post-id="${post.id}" title="Share">
              <span>🔁</span>
            </button>
            <button class="post-menu-button" data-post-id="${post.id}" title="More options">⋯</button>
          </div>
        </div>
      `;
    }).join('');

    pageContainer.innerHTML = `
      <div class="conversation-page">
        <div class="conversation-page-header">
          <button class="back-button" aria-label="Back to messages">←</button>
          <div class="conversation-header-info group-header-info" id="channel-header-info-${channelId}">
            <div class="conversation-avatar-header">${channel.avatar}</div>
            <div class="header-text">
              <div class="header-username">${channel.name}</div>
              <div class="header-member-count">${channel.followerCount.toLocaleString()} Followers</div>
            </div>
          </div>
          <button class="menu-button" aria-label="More options">⋮</button>
        </div>
        <div class="messages-container">
          ${postsList || '<div class="empty-state">No posts yet</div>'}
        </div>
        <div class="channel-footer">
          ${isOwner ? `
            <div class="composer-container">
              <textarea class="composer-input" placeholder="What's happening?" rows="1"></textarea>
              <div class="composer-actions">
                <button class="image-button" aria-label="Add image">📷</button>
                <button class="publish-button" aria-label="Publish">Publish</button>
              </div>
            </div>
          ` : `
            <div class="follower-status">
              ${isFollowing ? `
                <button class="follow-button following">✓ Following</button>
              ` : `
                <button class="follow-button">Follow</button>
              `}
            </div>
          `}
        </div>
      </div>
    `;

    // Back button handler
    document.querySelector('.back-button').addEventListener('click', () => {
      window.location.hash = '/messages';
    });

    // Menu button handler
    const menuButton = document.querySelector('.menu-button');
    if (menuButton) {
      menuButton.addEventListener('click', () => {
        showChannelMenu(channelId, channel, isOwner);
      });
    }

    // Follow/Unfollow button handler
    const followButton = document.querySelector('.follow-button');
    if (followButton) {
      followButton.addEventListener('click', () => {
        if (isFollowing) {
          unfollowChannel(channelId);
          showToast('Unfollowed channel', { type: 'success' });
        } else {
          followChannel(channelId);
          showToast('Following channel', { type: 'success' });
        }
        renderChannelView(channelId);
      });
    }

    // Attach event handlers to messages container using event delegation
    const messagesContainer = document.querySelector('.messages-container');

    if (messagesContainer) {
      // Share button handler (event delegation)
      messagesContainer.addEventListener('click', (e) => {
        const shareBtn = e.target.closest('.post-share-button');
        if (shareBtn) {
          e.stopPropagation();
          const postId = shareBtn.dataset.postId;
          console.log('Share button clicked for post:', postId);
          const post = channel.posts.find(p => p.id === postId);
          if (post) {
            const shareText = `Check out this post from ${channel.name}:\n\n"${post.text}"`;
            if (navigator.share) {
              navigator.share({
                title: channel.name,
                text: shareText
              }).catch(err => console.log('Share cancelled or failed'));
            } else {
              // Fallback: copy to clipboard
              navigator.clipboard.writeText(shareText).then(() => {
                showToast('Post link copied to clipboard', { type: 'success' });
              }).catch(() => {
                showToast('Failed to copy link', { type: 'error' });
              });
            }
          }
          return false;
        }
      });

      // Post menu button handler (event delegation)
      messagesContainer.addEventListener('click', (e) => {
        const menuBtn = e.target.closest('.post-menu-button');
        if (menuBtn) {
          e.stopPropagation();
          const postId = menuBtn.dataset.postId;
          console.log('Menu button clicked for post:', postId);
          showPostMenu(channelId, postId, isOwner);
          return false;
        }
      });

      // Like button handler (event delegation)
      messagesContainer.addEventListener('click', (e) => {
        const likeBtn = e.target.closest('.post-like-button');
        if (likeBtn) {
          e.stopPropagation();
          const postId = likeBtn.dataset.postId;
          console.log('Like button clicked for post:', postId);
          toggleLikePost(postId, channelId);
          renderChannelView(channelId);
          return false;
        }
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

    // Scroll to latest post
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 0);
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
    if (!isOwner) return;

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog-content group-menu-content">
        <button class="menu-option" id="delete-post-btn">
          <span class="option-icon">🗑️</span>
          <span class="option-label">Delete Post</span>
        </button>
      </div>
    `;

    overlay.appendChild(dialog);
    pageContainer.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.getElementById('delete-post-btn').addEventListener('click', () => {
      overlay.remove();
      deletePost(channelId, postId);
      renderChannelView(channelId);
      showToast('Post deleted', { type: 'success' });
    });
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
          <div class="message-bubble" data-message-id="${msg.id}">${msg.text}</div>
          <div class="message-timestamp">${formatMessageTime(msg.timestamp)}</div>
        </div>`;
      } else {
        messageHTML += `
          <div class="message-avatar">${msg.senderName ? msg.senderName.charAt(0).toUpperCase() : ''}</div>
          <div class="message-content">
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
        <div class="composer-container" style="${composerDisplay}">
          ${viewOnlyBadge}
          ${composerMarkup({ disabled: !channel.currentUserCanSend })}
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
    setupMessageLongPress(channel);

    // Set up image lightbox for image messages
    setupImageLightbox();

    // Set up send button and reply state management (only if can send)
    if (channel.currentUserCanSend) {
      setupComposer(channel);
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
          <button class="back-button" aria-label="Back to messages">←</button>
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
      window.location.hash = '/messages';
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
          <h1>Profile</h1>
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
          <h1>${page.name}</h1>
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

      // Remove active from all nav tabs when on group screen
      navTabs.forEach(tab => tab.classList.remove('active'));
      // Hide bottom nav on group screen
      bottomNav.style.display = 'none';

      if (action === 'info') {
        renderGroupInfoPage(groupId);
      } else if (action === 'add-members') {
        renderAddMembersPage(groupId);
      } else {
        renderGroupConversationPage(groupId);
      }
    } else if (path.startsWith('channel/')) {
      const channelId = path.split('/')[1];

      // Remove active from all nav tabs when on channel screen
      navTabs.forEach(tab => tab.classList.remove('active'));
      // Hide bottom nav on channel screen
      bottomNav.style.display = 'none';
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

  // Initial render
  handleNavigation();
});
