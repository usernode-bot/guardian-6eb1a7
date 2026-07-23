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

    replyCloseButton.addEventListener('click', () => {
      clearReplyState();
    });

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
      console.log('Create Group tapped');
    });

    // Add user item handlers
    document.querySelectorAll('.suggested-user-item').forEach(item => {
      item.addEventListener('click', () => {
        const userId = item.dataset.userId;
        console.log('User tapped:', userId);
      });
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
