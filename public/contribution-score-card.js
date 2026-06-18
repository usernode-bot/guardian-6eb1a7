function createContributionScoreCard(evolution, metrics) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-4 rounded-lg border p-4 bg-zinc-900 border-zinc-800';

  // Total score
  const scoreHeader = document.createElement('div');
  scoreHeader.className = 'flex flex-col items-center gap-1';

  const scoreLabel = document.createElement('span');
  scoreLabel.className = 'text-xs text-zinc-400';
  scoreLabel.textContent = 'Total Contribution Score';

  const scoreValue = document.createElement('span');
  scoreValue.className = 'text-3xl font-bold text-purple-400';
  scoreValue.textContent = evolution.contribution_score;

  scoreHeader.appendChild(scoreLabel);
  scoreHeader.appendChild(scoreValue);
  container.appendChild(scoreHeader);

  // Breakdown
  if (metrics) {
    const fgScore = metrics.fgHours * 40;
    const peerScore = metrics.peerCount * 20;
    const uptimeScore = metrics.uptime * 40;
    const total = fgScore + peerScore + uptimeScore;

    const breakdownLabel = document.createElement('div');
    breakdownLabel.className = 'text-xs font-semibold text-zinc-400 mt-2';
    breakdownLabel.textContent = 'Contribution Breakdown';
    container.appendChild(breakdownLabel);

    const breakdown = document.createElement('div');
    breakdown.className = 'space-y-2';

    const createBreakdownRow = (label, value, max, color) => {
      const row = document.createElement('div');
      row.className = 'flex flex-col gap-1';

      const labelRow = document.createElement('div');
      labelRow.className = 'flex justify-between items-center text-xs';

      const labelText = document.createElement('span');
      labelText.className = 'text-zinc-400';
      labelText.textContent = label;

      const valueText = document.createElement('span');
      valueText.className = 'font-semibold text-zinc-100';
      valueText.textContent = `${Math.round(value)} (${Math.round((value / max) * 100)}%)`;

      labelRow.appendChild(labelText);
      labelRow.appendChild(valueText);
      row.appendChild(labelRow);

      const barContainer = document.createElement('div');
      barContainer.className = 'w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden';

      const bar = document.createElement('div');
      bar.className = `${color} h-full rounded-full`;
      bar.style.width = `${Math.min(100, (value / max) * 100)}%`;

      barContainer.appendChild(bar);
      row.appendChild(barContainer);

      return row;
    };

    breakdown.appendChild(createBreakdownRow('FG Hours', fgScore, total, 'bg-blue-500'));
    breakdown.appendChild(createBreakdownRow('Peer Count', peerScore, total, 'bg-green-500'));
    breakdown.appendChild(createBreakdownRow('Uptime', uptimeScore, total, 'bg-orange-500'));

    container.appendChild(breakdown);
  }

  return container;
}
