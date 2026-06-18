class SignalingClient {
  constructor() {
    this.ws = null;
    this.userId = null;
    this.callbacks = {
      online: [],
      offline: [],
      peer_offer: [],
      peer_answer: [],
      ice_candidate: [],
      registered: [],
      error: []
    };
  }

  connect(token, guardianId, guardianName, guardianTier) {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/signaling`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({
          type: 'register',
          token,
          guardian_id: guardianId,
          guardian_name: guardianName,
          guardian_tier: guardianTier
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'registered') {
            this.userId = msg.user_id;
            this.callbacks.registered.forEach(cb => cb(msg));
            resolve(msg);
          } else if (msg.type === 'online') {
            this.callbacks.online.forEach(cb => cb(msg));
          } else if (msg.type === 'offline') {
            this.callbacks.offline.forEach(cb => cb(msg));
          } else if (msg.type === 'peer_offer') {
            this.callbacks.peer_offer.forEach(cb => cb(msg));
          } else if (msg.type === 'peer_answer') {
            this.callbacks.peer_answer.forEach(cb => cb(msg));
          } else if (msg.type === 'ice_candidate') {
            this.callbacks.ice_candidate.forEach(cb => cb(msg));
          } else if (msg.type === 'error') {
            this.callbacks.error.forEach(cb => cb(msg));
          }
        } catch (err) {
          console.error('Signaling client message error:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        this.callbacks.error.forEach(cb => cb({ error: err.message }));
        reject(err);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
      };
    });
  }

  on(eventType, callback) {
    if (this.callbacks[eventType]) {
      this.callbacks[eventType].push(callback);
    }
  }

  off(eventType, callback) {
    if (this.callbacks[eventType]) {
      this.callbacks[eventType] = this.callbacks[eventType].filter(cb => cb !== callback);
    }
  }

  sendHeartbeat() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'heartbeat' }));
    }
  }

  unregister() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unregister' }));
      this.ws.close();
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Global instance
window.signalingClient = new SignalingClient();
