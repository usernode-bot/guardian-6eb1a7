function createTransferModal(guardianId, guardianName, token) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';

  const content = document.createElement('div');
  content.className = 'bg-zinc-900 rounded-lg border border-zinc-800 p-6 max-w-md w-full';

  let currentView = 'menu'; // menu, gift, trade
  let selectedGuardians = []; // for trade selection

  function renderMenu() {
    content.innerHTML = `
      <div class="flex flex-col gap-4">
        <button class="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100" onclick="this.closest('.fixed').remove()">✕</button>
        <h2 class="text-2xl font-bold">Share Guardian</h2>
        <p class="text-sm text-zinc-400">Choose how you'd like to share your Guardian:</p>
        <button class="w-full px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors" onclick="window.guardianTransferUI.showGiftForm()">
          🎁 Send Gift
        </button>
        <button class="w-full px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors" onclick="window.guardianTransferUI.showTradeForm()">
          🔄 Propose Trade
        </button>
      </div>
    `;
    currentView = 'menu';
  }

  function renderGiftForm() {
    content.innerHTML = `
      <div class="flex flex-col gap-4">
        <button class="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100" onclick="this.closest('.fixed').remove()">✕</button>
        <button class="text-left text-sm text-purple-400 hover:text-purple-300 mb-2" onclick="window.guardianTransferUI.showMenu()">← Back</button>
        <h2 class="text-2xl font-bold">Send Gift</h2>
        <p class="text-sm text-zinc-400">Gift your Guardian to another player.</p>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-zinc-300">Recipient Username</label>
          <input
            id="gift-recipient"
            type="text"
            placeholder="Enter username..."
            class="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
          />
        </div>

        <div class="text-xs text-zinc-500 bg-zinc-800 p-3 rounded">
          ℹ️ Gift expires in 7 days. Recipient must accept to complete the transfer.
        </div>

        <button
          class="w-full px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors"
          onclick="window.guardianTransferUI.submitGift()"
        >
          Send Gift
        </button>
      </div>
    `;
    currentView = 'gift';
  }

  function renderTradeForm() {
    content.innerHTML = `
      <div class="flex flex-col gap-4">
        <button class="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100" onclick="this.closest('.fixed').remove()">✕</button>
        <button class="text-left text-sm text-blue-400 hover:text-blue-300 mb-2" onclick="window.guardianTransferUI.showMenu()">← Back</button>
        <h2 class="text-2xl font-bold">Propose Trade</h2>
        <p class="text-sm text-zinc-400">Trade your Guardian for another player's Guardian.</p>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-zinc-300">Recipient Username</label>
          <input
            id="trade-recipient"
            type="text"
            placeholder="Enter username..."
            class="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-zinc-300">Guardian ID to Request</label>
          <input
            id="trade-guardian-id"
            type="number"
            placeholder="Enter Guardian ID..."
            class="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
          />
          <p class="text-xs text-zinc-500">Find Guardian IDs in the Gallery or Registry.</p>
        </div>

        <div class="text-xs text-zinc-500 bg-zinc-800 p-3 rounded">
          ℹ️ Both players must accept within 7 days for the trade to complete. Guardians will be swapped automatically.
        </div>

        <button
          class="w-full px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          onclick="window.guardianTransferUI.submitTrade()"
        >
          Propose Trade
        </button>
      </div>
    `;
    currentView = 'trade';
  }

  window.guardianTransferUI = {
    showMenu: renderMenu,
    showGiftForm: renderGiftForm,
    showTradeForm: renderTradeForm,

    async submitGift() {
      const recipient = document.getElementById('gift-recipient').value.trim();

      if (!recipient) {
        alert('Please enter a recipient username');
        return;
      }

      try {
        const response = await fetch('/api/guardian/transfer/propose', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-usernode-token': token
          },
          body: JSON.stringify({
            guardianId,
            recipientUsername: recipient,
            type: 'GIFT'
          })
        });

        if (!response.ok) {
          const error = await response.json();
          alert('Error: ' + (error.error || 'Failed to send gift'));
          return;
        }

        const result = await response.json();
        alert(`Gift sent to ${recipient}! They have 7 days to accept.`);
        modal.remove();
      } catch (err) {
        alert('Error sending gift: ' + err.message);
      }
    },

    async submitTrade() {
      const recipient = document.getElementById('trade-recipient').value.trim();
      const tradeGuardianId = parseInt(document.getElementById('trade-guardian-id').value);

      if (!recipient || !tradeGuardianId) {
        alert('Please enter recipient username and Guardian ID');
        return;
      }

      try {
        const response = await fetch('/api/guardian/transfer/propose', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-usernode-token': token
          },
          body: JSON.stringify({
            guardianId,
            recipientUsername: recipient,
            type: 'TRADE',
            tradeGuardianId
          })
        });

        if (!response.ok) {
          const error = await response.json();
          alert('Error: ' + (error.error || 'Failed to propose trade'));
          return;
        }

        const result = await response.json();
        alert(`Trade proposal sent to ${recipient}! They have 7 days to accept.`);
        modal.remove();
      } catch (err) {
        alert('Error proposing trade: ' + err.message);
      }
    }
  };

  content.appendChild(content);
  modal.appendChild(content);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  renderMenu();
  return modal;
}
