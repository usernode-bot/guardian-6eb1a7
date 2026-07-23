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
  const conversations = [
    {
      id: 'conv_1',
      username: 'Alice Chen',
      avatar: 'AC',
      lastMessage: 'That sounds great! Let\'s meet up soon.',
      timestamp: Date.now() - 2 * 60 * 1000, // 2 minutes ago
      unreadCount: 2,
      onlineStatus: true,
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
      username: 'Bob Wilson',
      avatar: 'BW',
      lastMessage: 'Did you see the latest updates?',
      timestamp: Date.now() - 60 * 60 * 1000, // 1 hour ago
      unreadCount: 0,
      onlineStatus: false,
      messages: [
        { id: 'msg_1', text: "Check out the new features", timestamp: Date.now() - 2*60*60*1000, isOutgoing: false },
        { id: 'msg_2', text: "Looking good!", timestamp: Date.now() - 1.5*60*60*1000, isOutgoing: true },
        { id: 'msg_3', text: "Did you see the latest updates?", timestamp: Date.now() - 60*60*1000, isOutgoing: false }
      ]
    },
    {
      id: 'conv_3',
      username: 'Carol Davis',
      avatar: 'CD',
      lastMessage: 'Thanks for the help yesterday!',
      timestamp: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago (yesterday)
      unreadCount: 1,
      onlineStatus: true,
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
      username: 'David Lee',
      avatar: 'DL',
      lastMessage: 'Looking forward to the event next week',
      timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
      unreadCount: 0,
      onlineStatus: false,
      messages: [
        { id: 'msg_1', text: "See you at the event!", timestamp: Date.now() - 3*24*60*60*1000, isOutgoing: false },
        { id: 'msg_2', text: "Definitely! Can't wait", timestamp: Date.now() - 2.5*24*60*60*1000, isOutgoing: true },
        { id: 'msg_3', text: "Looking forward to the event next week", timestamp: Date.now() - 2*24*60*60*1000, isOutgoing: false }
      ]
    }
  ];

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

  // Render messages page with conversation list
  function renderMessagesPage() {
    const conversationsList = conversations.map(conv => `
      <div class="conversation-item" data-conversation-id="${conv.id}">
        <div class="conversation-avatar">${conv.avatar}</div>
        <div class="conversation-content">
          <div class="conversation-header">
            <span class="conversation-username">${conv.username}</span>
            <span class="conversation-timestamp">${formatTimestamp(conv.timestamp)}</span>
          </div>
          <p class="conversation-message">${conv.lastMessage}</p>
        </div>
        ${conv.unreadCount > 0 ? `<div class="unread-badge">${conv.unreadCount}</div>` : ''}
      </div>
    `).join('');

    pageContainer.innerHTML = `
      <div class="messages-page">
        <div class="messages-header">
          <h1>Messages</h1>
          <span class="search-icon">🔍</span>
        </div>
        <div class="conversations-list">
          ${conversationsList}
        </div>
      </div>
    `;

    // Add click handlers for conversation items
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => {
        const convId = item.dataset.conversationId;
        window.location.hash = `/conversation/${convId}`;
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

    const messagesList = conversation.messages.map(msg => `
      <div class="message ${msg.isOutgoing ? 'outgoing' : 'incoming'}" data-message-id="${msg.id}">
        <div class="message-bubble" data-message-id="${msg.id}">${msg.text}</div>
        <div class="message-timestamp">${formatMessageTime(msg.timestamp)}</div>
      </div>
    `).join('');

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
          <button class="emoji-button" aria-label="Emoji">😊</button>
          <input type="text" class="composer-input" placeholder="Message...">
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
    setupMessageLongPress();
  }

  // Setup long-press menu for messages
  function setupMessageLongPress() {
    const messageBubbles = document.querySelectorAll('.message-bubble');
    const LONG_PRESS_DURATION = 350;
    const EMOJIS = ['❤️', '👍', '👎', '😂', '🔥', '🚀', '➕'];
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
      const emojiBar = document.querySelector('.emoji-reaction-bar');
      const contextMenu = document.querySelector('.context-menu');
      const messagesContainer = document.querySelector('.messages-container');

      if (overlay) overlay.classList.add('closing');
      if (emojiBar) emojiBar.classList.add('closing');
      if (contextMenu) contextMenu.classList.add('closing');

      // Remove scroll listener
      if (menuState.scrollHandler && messagesContainer) {
        messagesContainer.removeEventListener('scroll', menuState.scrollHandler);
        menuState.scrollHandler = null;
      }

      setTimeout(() => {
        overlay?.remove();
        emojiBar?.remove();
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

      // Create emoji reaction bar
      const emojiBar = document.createElement('div');
      emojiBar.className = 'emoji-reaction-bar';
      const emojiButtons = EMOJIS.map(emoji => `
        <button class="emoji-button-item" aria-label="React with ${emoji}" data-emoji="${emoji}">
          ${emoji}
        </button>
      `).join('');
      emojiBar.innerHTML = emojiButtons;
      conversationPage.appendChild(emojiBar);

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
      // Temporarily append to get dimensions
      conversationPage.appendChild(emojiBar);
      conversationPage.appendChild(contextMenu);

      const emojiBarRect = emojiBar.getBoundingClientRect();
      const contextMenuRect = contextMenu.getBoundingClientRect();
      const bubbleViewportRect = bubbleElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Calculate space available above and below the message
      const spaceAbove = bubbleViewportRect.top;
      const spaceBelow = viewportHeight - bubbleViewportRect.bottom;

      // Total menu height (emoji bar + context menu + gaps)
      const totalMenuHeight = emojiBarRect.height + contextMenuRect.height + 20;

      // Determine if menu should go above or below
      let menuAboveMessage = true;
      if (spaceAbove < totalMenuHeight && spaceBelow > totalMenuHeight) {
        menuAboveMessage = false;
      }

      // Calculate vertical position
      let emojiBarTop, contextMenuTop;
      if (menuAboveMessage) {
        // Position above: emoji bar first, context menu below it
        emojiBarTop = bubbleViewportRect.top - emojiBarRect.height - 10;
        contextMenuTop = emojiBarTop - contextMenuRect.height - 8;

        // If context menu goes off top, shift everything down
        if (contextMenuTop < 10) {
          const shift = Math.abs(contextMenuTop) + 10;
          contextMenuTop += shift;
          emojiBarTop += shift;
        }
      } else {
        // Position below: emoji bar first, context menu below it
        emojiBarTop = bubbleViewportRect.bottom + 10;
        contextMenuTop = emojiBarTop + emojiBarRect.height + 8;

        // If context menu goes off bottom, shift everything up
        if (contextMenuTop + contextMenuRect.height > viewportHeight - 10) {
          const shift = (contextMenuTop + contextMenuRect.height) - (viewportHeight - 10);
          contextMenuTop -= shift;
          emojiBarTop -= shift;
        }
      }

      // Calculate horizontal position (center on message, adjust for viewport)
      const bubbleCenterX = bubbleViewportRect.left + bubbleViewportRect.width / 2;

      // Center emoji bar on message
      let emojiBarLeft = bubbleCenterX - emojiBarRect.width / 2;
      if (emojiBarLeft < 10) {
        emojiBarLeft = 10;
      } else if (emojiBarLeft + emojiBarRect.width > viewportWidth - 10) {
        emojiBarLeft = viewportWidth - emojiBarRect.width - 10;
      }

      // Center context menu on message
      let contextMenuLeft = bubbleCenterX - contextMenuRect.width / 2;
      if (contextMenuLeft < 10) {
        contextMenuLeft = 10;
      } else if (contextMenuLeft + contextMenuRect.width > viewportWidth - 10) {
        contextMenuLeft = viewportWidth - contextMenuRect.width - 10;
      }

      // Apply fixed positioning relative to viewport
      emojiBar.style.position = 'fixed';
      emojiBar.style.top = Math.max(10, emojiBarTop) + 'px';
      emojiBar.style.left = Math.max(10, emojiBarLeft) + 'px';

      contextMenu.style.position = 'fixed';
      contextMenu.style.top = Math.max(10, contextMenuTop) + 'px';
      contextMenu.style.left = Math.max(10, contextMenuLeft) + 'px';

      // Add event listeners to emoji buttons
      emojiBar.querySelectorAll('.emoji-button-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          console.log('User tapped emoji:', btn.dataset.emoji);
          btn.classList.add('tapped');
          setTimeout(() => btn.classList.remove('tapped'), 200);
        });
      });

      // Add event listeners to menu items
      contextMenu.querySelectorAll('.menu-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          console.log('Action:', action);
          btn.classList.add('tapped');
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
