/**
 * WalletConfirmationModal - reusable modal component for confirming sensitive actions
 * Shows user's wallet address and requires explicit confirmation before proceeding
 */
class WalletConfirmationModal {
  constructor() {
    this.modalElement = null;
    this.resolve = null;
  }

  /**
   * Show the confirmation modal
   * @param {string} walletAddress - The user's wallet address to display
   * @param {string} actionDescription - Description of the action being confirmed
   * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
   */
  show(walletAddress, actionDescription = 'Confirm action') {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.render(walletAddress, actionDescription);

      // Auto-focus confirm button for keyboard accessibility
      setTimeout(() => {
        const confirmBtn = this.modalElement?.querySelector('[data-action="confirm"]');
        if (confirmBtn) confirmBtn.focus();
      }, 50);
    });
  }

  /**
   * Render the modal DOM
   */
  render(walletAddress, actionDescription) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
    overlay.dataset.role = 'wallet-confirmation-overlay';

    // Create modal card
    const modal = document.createElement('div');
    modal.className = 'bg-zinc-900 rounded-lg border border-zinc-800 p-6 max-w-md w-full shadow-lg';

    // Title
    const title = document.createElement('h2');
    title.className = 'text-lg font-semibold text-zinc-100 mb-4';
    title.textContent = 'Confirm Action';

    // Action description
    const description = document.createElement('p');
    description.className = 'text-sm text-zinc-300 mb-6';
    description.textContent = actionDescription;

    // Wallet address section
    const walletSection = document.createElement('div');
    walletSection.className = 'bg-zinc-800 rounded-lg p-4 mb-6';

    const walletLabel = document.createElement('div');
    walletLabel.className = 'text-xs text-zinc-500 mb-2 uppercase tracking-wide';
    walletLabel.textContent = 'Your Wallet';

    const walletAddress_ = document.createElement('div');
    walletAddress_.className = 'text-sm text-zinc-100 font-mono break-all';
    walletAddress_.textContent = walletAddress;

    walletSection.appendChild(walletLabel);
    walletSection.appendChild(walletAddress_);

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex gap-3';

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'flex-1 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-100 font-semibold hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-700';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.dataset.action = 'cancel';
    cancelBtn.addEventListener('click', () => this.handleCancel());

    // Confirm button
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-700';
    confirmBtn.textContent = 'Confirm';
    confirmBtn.dataset.action = 'confirm';
    confirmBtn.addEventListener('click', () => this.handleConfirm());

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(confirmBtn);

    // Assemble modal
    modal.appendChild(title);
    modal.appendChild(description);
    modal.appendChild(walletSection);
    modal.appendChild(buttonContainer);

    // Assemble overlay
    overlay.appendChild(modal);

    // Add to DOM
    document.body.appendChild(overlay);
    this.modalElement = overlay;

    // Event listeners
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.handleCancel();
      }
    });

    document.addEventListener('keydown', this.handleKeydown.bind(this), { once: true });
  }

  /**
   * Handle Escape key to cancel
   */
  handleKeydown(e) {
    if (e.key === 'Escape') {
      this.handleCancel();
    }
  }

  /**
   * Handle confirm action
   */
  handleConfirm() {
    this.destroy();
    if (this.resolve) this.resolve(true);
  }

  /**
   * Handle cancel action
   */
  handleCancel() {
    this.destroy();
    if (this.resolve) this.resolve(false);
  }

  /**
   * Destroy the modal from DOM
   */
  destroy() {
    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WalletConfirmationModal;
}
