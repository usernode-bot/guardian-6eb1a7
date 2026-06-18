/**
 * @typedef {Object} FGProgress
 * @property {number} currentMinutes
 * @property {number} requiredMinutes
 */

/**
 * Creates and returns an FGProgressCard component element with mint state support.
 * @param {FGProgress} fgProgress
 * @returns {HTMLElement}
 */
function createFGProgressCard(fgProgress) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-4 rounded-lg border p-4 bg-zinc-900 border-zinc-800 mt-6';

  let isMinted = false;

  function render() {
    container.innerHTML = '';

    if (isMinted) {
      renderMintedState();
    } else {
      renderNormalState();
    }
  }

  function renderNormalState() {
    const titleRow = document.createElement('div');
    titleRow.className = 'flex flex-col items-center gap-2';

    const titleEmoji = document.createElement('span');
    titleEmoji.className = 'text-3xl';
    titleEmoji.textContent = '🥚';

    const titleText = document.createElement('span');
    titleText.className = 'text-sm font-semibold text-zinc-100';
    titleText.textContent = 'Guardian Egg';

    titleRow.appendChild(titleEmoji);
    titleRow.appendChild(titleText);
    container.appendChild(titleRow);

    const progressRow = document.createElement('div');
    progressRow.className = 'flex justify-between items-center';

    const progressLabel = document.createElement('span');
    progressLabel.className = 'text-sm text-zinc-400';
    progressLabel.textContent = 'FG Runtime';

    const timeDisplay = document.createElement('span');
    timeDisplay.className = 'text-sm font-semibold text-zinc-100';
    timeDisplay.textContent = `${fgProgress.currentMinutes}m / ${fgProgress.requiredMinutes}m`;

    progressRow.appendChild(progressLabel);
    progressRow.appendChild(timeDisplay);
    container.appendChild(progressRow);

    const barContainer = document.createElement('div');
    barContainer.className = 'w-full bg-zinc-800 rounded-full h-2 overflow-hidden';

    const barFill = document.createElement('div');
    const percentage = (fgProgress.currentMinutes / fgProgress.requiredMinutes) * 100;
    barFill.className = 'bg-green-500 h-full rounded-full transition-all duration-300';
    barFill.style.width = `${Math.min(percentage, 100)}%`;

    barContainer.appendChild(barFill);
    container.appendChild(barContainer);

    const statusRow = document.createElement('div');
    statusRow.className = 'flex justify-between items-center';

    const percentageBadge = document.createElement('div');
    percentageBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-100';
    percentageBadge.textContent = `${Math.round(percentage)}%`;

    const eligible = fgProgress.currentMinutes >= fgProgress.requiredMinutes;
    const statusBadge = document.createElement('div');
    statusBadge.className = `px-3 py-1 rounded-full text-xs font-semibold ${
      eligible ? 'bg-green-600 text-white' : 'bg-zinc-700 text-zinc-100'
    }`;
    statusBadge.textContent = eligible ? 'READY TO MINT' : 'NOT ELIGIBLE';

    statusRow.appendChild(percentageBadge);
    statusRow.appendChild(statusBadge);
    container.appendChild(statusRow);

    if (eligible) {
      const buttonRow = document.createElement('div');
      buttonRow.className = 'flex justify-center mt-2';

      const mintButton = document.createElement('button');
      mintButton.className = 'px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors';
      mintButton.textContent = 'Mint Guardian';

      mintButton.addEventListener('click', () => {
        isMinted = true;
        render();
      });

      buttonRow.appendChild(mintButton);
      container.appendChild(buttonRow);
    }
  }

  function renderMintedState() {
    const titleRow = document.createElement('div');
    titleRow.className = 'flex flex-col items-center gap-2';

    const titleEmoji = document.createElement('span');
    titleEmoji.className = 'text-3xl';
    titleEmoji.textContent = '🎭';

    const titleText = document.createElement('span');
    titleText.className = 'text-sm font-semibold text-zinc-100';
    titleText.textContent = 'Guardian Minted';

    titleRow.appendChild(titleEmoji);
    titleRow.appendChild(titleText);
    container.appendChild(titleRow);

    const successRow = document.createElement('div');
    successRow.className = 'flex justify-center items-center text-center py-2';

    const successMessage = document.createElement('span');
    successMessage.className = 'text-sm text-green-400';
    successMessage.textContent = '✓ Successfully minted!';

    successRow.appendChild(successMessage);
    container.appendChild(successRow);
  }

  render();

  return container;
}

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = createFGProgressCard;
}
