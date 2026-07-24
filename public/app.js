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
      pinned: false,
      messages: [
        { id: 'msg_1', text: "Hey! How's it going?", timestamp: Date.now() - 5*60*1000, isOutgoing: false },
        { id: 'msg_2', text: "Great! Just finished work", timestamp: Date.now() - 4.5*60*1000, isOutgoing: true },
        { id: 'msg_3', text: "Nice! Want to grab dinner?", timestamp: Date.now() - 4*60*1000, isOutgoing: false },
        { id: 'msg_4', text: "Sure! When?", timestamp: Date.now() - 3.5*60*1000, isOutgoing: true },
        { id: 'msg_5', text: "How about 7pm?", timestamp: Date.now() - 3*60*1000, isOutgoing: false },
        { id: 'msg_6', text: "That sounds great! Let's meet up soon.", timestamp: Date.now() - 2*60*1000, isOutgoing: true }
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
        { id: 'msg_6', senderId: 'user_self', text: 'Absolutely! Looking forward to it.', timestamp: Date.now() - 5*60*1000, isOutgoing: true }
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
      lastMessage: 'Let\'s catch up soon!',
      timestamp: Date.now() - 5*60*1000,
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

  // Active tab state
  let activeMessagesTab = 'all';
  let searchQuery = '';
  let swipeState = {
    element: null,
    startX: 0,
    currentX: 0,
    threshold: 80
  };

  // Helper: generate unique group ID
  function generateGroupId() {
    return 'group_' + Date.now();
  }

  // Helper: generate default avatar from first letter of group name
  function generateDefaultAvatar(groupName) {
    if (!groupName || groupName.length === 0) return '';
    return groupName.charAt(0).toUpperCase();
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
    if (text.length > length) {
      return text.substring(0, length) + '…';
    }
    return text;
  }

  // Filter conversations by tab and search query
  function filterConversations(tab, query) {
    let filtered = [];

    if (tab === 'all') {
      filtered = conversations.filter(c => !c.archived);
    } else if (tab === 'dm') {
      filtered = conversations.filter(c => c.type === 'direct' && !c.archived);
    } else if (tab === 'groups') {
      filtered = conversations.filter(c => c.type === 'group' && !c.archived);
    } else if (tab === 'channels') {
      filtered = [];
    } else if (tab === 'requests') {
      filtered = requests;
    }

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
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.timestamp - a.timestamp;
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
        const displayName = item.type === 'group' ? item.name : item.username;
        const routeHash = item.type === 'group' ? `/group/${item.groupId}` : `/conversation/${item.id}`;

        return `
          <div class="swipe-container" data-conversation-id="${item.id}">
            <div class="swipe-actions">
              <button class="swipe-action archive-action" data-action="archive" data-conversation-id="${item.id}">Archive</button>
              <button class="swipe-action pin-action" data-action="pin" data-conversation-id="${item.id}">${item.pinned ? 'Unpin' : 'Pin'}</button>
            </div>
            <div class="conversation-item" data-conversation-id="${item.id}" data-route-hash="${routeHash}">
              <div class="conversation-avatar">${item.avatar}</div>
              <div class="conversation-content">
                <div class="conversation-header">
                  <span class="conversation-username">${displayName}</span>
                  <span class="conversation-timestamp">${formatTimestamp(item.timestamp)}</span>
                </div>
                <p class="conversation-message">${item.lastMessage}</p>
              </div>
              ${item.unreadCount > 0 ? `<div class="unread-badge">${item.unreadCount}</div>` : ''}
            </div>
          </div>
        `;
      }
    }).join('');

    const emptyMessage = {
      all: 'No messages yet',
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
        <div class="messages-search" id="messages-search" style="display: none;">
          <input type="text" class="search-input" id="messages-search-input" placeholder="🔍 Search..." />
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
          ${conversationsList || `<div class="empty-state">${emptyMessage}</div>`}
        </div>
      </div>
    `;

    // Tab click handlers
    document.querySelectorAll('.message-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        searchQuery = '';
        renderMessagesPage(tab.dataset.tab);
      });
    });

    // Search icon handler
    document.querySelector('.search-icon').addEventListener('click', () => {
      const searchContainer = document.getElementById('messages-search');
      searchContainer.style.display = 'flex';
      document.getElementById('messages-search-input').focus();
    });

    // Search input handler
    const searchInput = document.getElementById('messages-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderMessagesPage();
      });

      // Search close button
      document.querySelector('.search-close').addEventListener('click', () => {
        searchQuery = '';
        document.getElementById('messages-search').style.display = 'none';
        renderMessagesPage();
      });
    }

    // Conversation click handlers
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => {
        const routeHash = item.dataset.routeHash;
        const convId = item.dataset.conversationId;
        // Clear unread badge
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

    // Swipe action handlers
    document.querySelectorAll('.swipe-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const convId = btn.dataset.conversationId;
        const conv = conversations.find(c => c.id === convId);

        if (action === 'archive' && conv) {
          conv.archived = true;
          renderMessagesPage();
        } else if (action === 'pin' && conv) {
          conv.pinned = !conv.pinned;
          renderMessagesPage();
        } else if (action === 'delete' && conv) {
          const idx = conversations.findIndex(c => c.id === convId);
          if (idx >= 0) conversations.splice(idx, 1);
          renderMessagesPage();
        }
      });
    });

    // Swipe touch handlers
    setupSwipeHandlers();
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

  // Setup swipe handlers for conversation items
  function setupSwipeHandlers() {
    const containers = document.querySelectorAll('.swipe-container');

    containers.forEach(container => {
      const item = container.querySelector('.conversation-item');
      let startX = 0;
      let currentX = 0;
      let isDragging = false;

      container.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        currentX = startX;
        isDragging = true;
        swipeState.element = container;
      });

      container.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        const scale = Math.max(-150, Math.min(150, diff));
        item.style.transform = `translateX(${scale}px)`;
      });

      container.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        const diff = currentX - startX;

        if (diff < -swipeState.threshold) {
          item.style.transform = 'translateX(-150px)';
          container.querySelector('.swipe-actions').style.visibility = 'visible';
        } else if (diff > swipeState.threshold) {
          item.style.transform = 'translateX(150px)';
        } else {
          item.style.transform = 'translateX(0)';
          container.querySelector('.swipe-actions').style.visibility = 'hidden';
        }
      });
    });
  }

  // Render conversation screen
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
        <div class="message-bubble" data-message-id="${msg.id}">${msg.text}</div>
        <div class="message-timestamp">${formatMessageTime(msg.timestamp)}</div>
      </div>`;

      return messageHTML;
    }).join('');

    pageContainer.innerHTML = `
      <div class="conversation-page">
        <div class="conversation-header">
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
          <textarea class="composer-input" placeholder="Message..." rows="1"></textarea>
          <button class="send-button" aria-label="Send">➤</button>
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
      { icon: '📤', label: 'Forward', action: 'forward' },
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

      // Create context menu
      const contextMenu = document.createElement('div');
      contextMenu.className = 'context-menu';
      const menuButtons = MENU_ITEMS.map(item => `
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

          // Handle reply action
          if (action === 'reply') {
            const targetMessage = conversation.messages.find(m => m.id === messageId);
            if (targetMessage) {
              const senderName = targetMessage.isOutgoing ? 'You' : conversation.username;
              const previewText = truncateText(targetMessage.text, 50);
              setReplyState(messageId, senderName, previewText);
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

  function setupComposer(conversation) {
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
        composerInput.style.height = '40px';
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
      composerInput.style.height = '40px';
      clearReplyState();

      // Re-render conversation to show new message
      renderConversationPage(conversation.id);
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
      let messageHTML = `<div class="message ${msg.isOutgoing ? 'outgoing' : 'incoming'}" data-message-id="${msg.id}">`;

      if (msg.isOutgoing) {
        messageHTML += `
          <div class="message-bubble" data-message-id="${msg.id}">${msg.text}</div>
          <div class="message-timestamp">${formatMessageTime(msg.timestamp)}</div>
        </div>`;
      } else {
        messageHTML += `
          <div class="message-avatar">${msg.senderName ? msg.senderName.charAt(0).toUpperCase() : ''}</div>
          <div class="message-content">
            <div class="message-sender-name">${msg.senderName}</div>
            <div class="message-bubble" data-message-id="${msg.id}">${msg.text}</div>
            <div class="message-timestamp">${formatMessageTime(msg.timestamp)}</div>
          </div>
        </div>`;
      }

      return messageHTML;
    }).join('');

    pageContainer.innerHTML = `
      <div class="conversation-page">
        <div class="conversation-header">
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
          <textarea class="composer-input" placeholder="Message..." rows="1"></textarea>
          <button class="send-button" aria-label="Send">➤</button>
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
        <div class="create-group-card">
          <span class="group-icon">👥</span>
          <span class="group-label">Create Group</span>
          <span class="group-chevron">></span>
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
    } else if (path === 'create-group') {
      // Hide bottom nav on create group screen
      bottomNav.style.display = 'none';
      // Remove active from all nav tabs
      navTabs.forEach(tab => tab.classList.remove('active'));
      renderCreateGroupPage();
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
