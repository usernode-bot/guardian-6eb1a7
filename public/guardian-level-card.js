function createGuardianLevelCard(evolution) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-4 rounded-lg border p-4 bg-zinc-900 border-zinc-800';

  // Header
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between';

  const levelLabel = document.createElement('span');
  levelLabel.className = 'text-sm font-semibold text-zinc-100';
  levelLabel.textContent = `Level ${evolution.level}`;

  const scoreText = document.createElement('span');
  scoreText.className = 'text-xs text-zinc-400';
  scoreText.textContent = `${evolution.contribution_score} / ${evolution.level * 250} points`;

  header.appendChild(levelLabel);
  header.appendChild(scoreText);
  container.appendChild(header);

  // Progress bar
  const barContainer = document.createElement('div');
  barContainer.className = 'w-full bg-zinc-800 rounded-full h-2 overflow-hidden';

  const levelStart = (evolution.level - 1) * 250;
  const levelEnd = evolution.level * 250;
  const progress = Math.min(100, Math.max(0, ((evolution.contribution_score - levelStart) / (levelEnd - levelStart)) * 100));

  const barFill = document.createElement('div');
  barFill.className = 'bg-purple-500 h-full rounded-full transition-all duration-300';
  barFill.style.width = `${progress}%`;

  barContainer.appendChild(barFill);
  container.appendChild(barContainer);

  // Score breakdown
  const breakdownLabel = document.createElement('div');
  breakdownLabel.className = 'text-xs font-semibold text-zinc-400 mt-2';
  breakdownLabel.textContent = 'Score Breakdown';
  container.appendChild(breakdownLabel);

  const fgHours = Math.floor(evolution.contribution_score / 40);
  const peerCount = Math.floor((evolution.contribution_score % 40) / 20);
  const uptime = Math.floor(evolution.contribution_score % 20);

  const breakdown = document.createElement('div');
  breakdown.className = 'grid grid-cols-3 gap-2 text-xs';

  const createBreakdownItem = (label, value) => {
    const item = document.createElement('div');
    item.className = 'flex flex-col items-center p-2 bg-zinc-800 rounded';
    const valueEl = document.createElement('span');
    valueEl.className = 'font-semibold text-zinc-100';
    valueEl.textContent = value;
    const labelEl = document.createElement('span');
    labelEl.className = 'text-zinc-400 text-xs mt-1';
    labelEl.textContent = label;
    item.appendChild(valueEl);
    item.appendChild(labelEl);
    return item;
  };

  breakdown.appendChild(createBreakdownItem('FG Hours', fgHours));
  breakdown.appendChild(createBreakdownItem('Peers', peerCount));
  breakdown.appendChild(createBreakdownItem('Uptime', uptime));

  container.appendChild(breakdown);

  return container;
}
