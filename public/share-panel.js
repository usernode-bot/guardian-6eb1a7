class SharePanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.peerConnection = null;
    this.dataChannel = null;
    this.peerId = null;
    this.peerUsername = null;
    this.connectionState = 'idle'; // idle, connecting, connected, error
    this.init();
  }

  init() {
    this.render();
    this.setupEventListeners();
    this.setupSignalingListeners();
  }

  setupEventListeners() {
    const connectBtn = this.container.querySelector('[data-action="connect"]');
    const usernameInput = this.container.querySelector('[data-role="username-input"]');
    const fileInput = this.container.querySelector('[data-role="file-input"]');
    const uploadBtn = this.container.querySelector('[data-action="upload-file"]');

    if (connectBtn) {
      connectBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        if (username) {
          this.initiateConnection(username);
        }
      });
    }

    if (usernameInput) {
      usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const username = usernameInput.value.trim();
          if (username) {
            this.initiateConnection(username);
          }
        }
      });
    }

    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.sendFile(e.target.files[0]);
        }
      });
    }
  }

  setupSignalingListeners() {
    window.signalingClient.on('peer_offer', async (msg) => {
      console.log('Received offer from', msg.from_username);
      if (this.connectionState === 'idle' || this.connectionState === 'connecting') {
        this.peerId = msg.from_user_id;
        this.peerUsername = msg.from_username;
        await this.acceptConnection(msg.offer);
      }
    });

    window.signalingClient.on('peer_answer', async (msg) => {
      console.log('Received answer from', msg.from_username);
      if (this.peerConnection) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.answer));
      }
    });

    window.signalingClient.on('ice_candidate', (msg) => {
      if (this.peerConnection && msg.candidate) {
        this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(err => {
          console.error('Error adding ICE candidate:', err);
        });
      }
    });
  }

  async initiateConnection(username) {
    try {
      this.setConnectionState('connecting');
      this.updateStatusDisplay();

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
        ]
      });

      // Set up ICE candidate handling
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          fetch('/api/signaling/ice-candidate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-usernode-token': this.getToken()
            },
            body: JSON.stringify({
              to_user_id: this.peerId,
              candidate: event.candidate
            })
          }).catch(err => console.error('Error sending ICE candidate:', err));
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', this.peerConnection.connectionState);
        if (this.peerConnection.connectionState === 'connected') {
          this.setConnectionState('connected');
          this.updateStatusDisplay();
        } else if (this.peerConnection.connectionState === 'failed' || this.peerConnection.connectionState === 'disconnected') {
          this.setConnectionState('error');
          this.updateStatusDisplay();
        }
      };

      // Create data channel (initiator)
      this.dataChannel = this.peerConnection.createDataChannel('file-transfer');
      this.setupDataChannel();

      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Look up peer user ID
      const response = await fetch('/api/presence/online', {
        headers: { 'x-usernode-token': this.getToken() }
      });
      const onlineUsers = await response.json();
      const peer = onlineUsers.users.find(u => u.username === username);

      if (!peer) {
        throw new Error(`User ${username} is not online`);
      }

      this.peerId = peer.user_id;
      this.peerUsername = peer.username;

      // Send offer via signaling server
      const offerResponse = await fetch('/api/signaling/offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-usernode-token': this.getToken()
        },
        body: JSON.stringify({
          to_user_id: this.peerId,
          offer: offer
        })
      });

      if (!offerResponse.ok) {
        throw new Error('Failed to send offer to peer');
      }

      this.peerUsername = username;
      this.updateStatusDisplay();
    } catch (err) {
      console.error('Connection error:', err);
      this.setConnectionState('error');
      this.updateStatusDisplay();
    }
  }

  async acceptConnection(offer) {
    try {
      if (!this.peerConnection) {
        this.peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
          ]
        });

        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            fetch('/api/signaling/ice-candidate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-usernode-token': this.getToken()
              },
              body: JSON.stringify({
                to_user_id: this.peerId,
                candidate: event.candidate
              })
            }).catch(err => console.error('Error sending ICE candidate:', err));
          }
        };

        this.peerConnection.onconnectionstatechange = () => {
          console.log('Connection state:', this.peerConnection.connectionState);
          if (this.peerConnection.connectionState === 'connected') {
            this.setConnectionState('connected');
            this.updateStatusDisplay();
          }
        };

        this.peerConnection.ondatachannel = (event) => {
          this.dataChannel = event.channel;
          this.setupDataChannel();
        };
      }

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Send answer via signaling server
      await fetch('/api/signaling/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-usernode-token': this.getToken()
        },
        body: JSON.stringify({
          to_user_id: this.peerId,
          answer: answer
        })
      });

      this.setConnectionState('connecting');
      this.updateStatusDisplay();
    } catch (err) {
      console.error('Accept connection error:', err);
      this.setConnectionState('error');
      this.updateStatusDisplay();
    }
  }

  setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('Data channel opened');
      this.setConnectionState('connected');
      this.updateStatusDisplay();
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel closed');
      this.setConnectionState('idle');
      this.updateStatusDisplay();
    };

    this.dataChannel.onerror = (err) => {
      console.error('Data channel error:', err);
      this.setConnectionState('error');
      this.updateStatusDisplay();
    };

    this.dataChannel.onmessage = (event) => {
      console.log('Received message:', event.data);
    };
  }

  async sendFile(file) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('Data channel not open');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const data = {
          type: 'file',
          name: file.name,
          size: file.size,
          mimeType: file.type,
          data: reader.result
        };
        this.dataChannel.send(JSON.stringify(data));
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error('Error sending file:', err);
    }
  }

  setConnectionState(state) {
    this.connectionState = state;
  }

  getToken() {
    return new URLSearchParams(window.location.search).get('token') ||
           localStorage.getItem('usernode_token') || '';
  }

  updateStatusDisplay() {
    const statusDisplay = this.container.querySelector('[data-role="status"]');
    if (!statusDisplay) return;

    const statusMessages = {
      idle: 'Ready to connect',
      connecting: `Connecting to ${this.peerUsername}...`,
      connected: `Connected to ${this.peerUsername}`,
      error: 'Connection failed'
    };

    statusDisplay.innerHTML = `
      <div class="text-sm font-semibold ${
        this.connectionState === 'connected' ? 'text-green-400' :
        this.connectionState === 'error' ? 'text-red-400' :
        this.connectionState === 'connecting' ? 'text-yellow-400' :
        'text-zinc-400'
      }">
        ${statusMessages[this.connectionState]}
      </div>
    `;

    const uploadSection = this.container.querySelector('[data-role="upload-section"]');
    if (uploadSection) {
      uploadSection.style.display = this.connectionState === 'connected' ? 'block' : 'none';
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="flex flex-col gap-4">
        <h2 class="text-2xl font-bold">P2P Share</h2>
        <div class="flex gap-2">
          <input
            type="text"
            placeholder="Enter username to connect..."
            class="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-sm"
            data-role="username-input"
          />
          <button
            data-action="connect"
            class="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-colors"
          >
            Connect
          </button>
        </div>
        <div data-role="status" class="text-sm text-zinc-400">Ready to connect</div>
        <div data-role="upload-section" style="display: none;" class="flex flex-col gap-2">
          <input type="file" data-role="file-input" style="display: none;" />
          <button
            data-action="upload-file"
            class="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors"
          >
            📁 Select file to share
          </button>
          <p class="text-xs text-zinc-500">File transfers happen peer-to-peer, directly to the other user</p>
        </div>
      </div>
    `;
  }
}
