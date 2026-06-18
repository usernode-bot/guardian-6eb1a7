const STAGE_EMOJIS = {
  INITIATE: '🌱',
  AWAKENED: '💙',
  ASCENDANT: '✨',
  GUARDIAN: '⚡',
  MYTHIC: '🔮'
};

function createLeaderboardTable(entries) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-4 rounded-lg border p-4 bg-zinc-900 border-zinc-800';

  // Header
  const header = document.createElement('div');
  header.className = 'text-sm font-semibold text-zinc-100';
  header.textContent = 'Top Contributors Leaderboard';
  container.appendChild(header);

  if (!entries || entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-xs text-zinc-400 py-8 text-center';
    empty.textContent = 'No leaderboard data available';
    container.appendChild(empty);
    return container;
  }

  // Table
  const table = document.createElement('div');
  table.className = 'space-y-1 overflow-x-auto';

  // Header row
  const headerRow = document.createElement('div');
  headerRow.className = 'grid grid-cols-12 gap-2 px-2 py-2 text-xs font-semibold text-zinc-400 border-b border-zinc-800';

  const headerCells = ['Rank', 'Guardian', 'Owner', 'Stage', 'Score', 'Level'];
  for (const cell of headerCells) {
    const cellEl = document.createElement('div');
    cellEl.className = cell === 'Rank' ? 'col-span-1' : cell === 'Guardian' ? 'col-span-3' : cell === 'Owner' ? 'col-span-2' : 'col-span-2';
    cellEl.textContent = cell;
    headerRow.appendChild(cellEl);
  }

  table.appendChild(headerRow);

  // Rows
  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = 'grid grid-cols-12 gap-2 px-2 py-2 text-xs text-zinc-100 hover:bg-zinc-800 rounded transition-colors';

    // Rank
    const rankCell = document.createElement('div');
    rankCell.className = 'col-span-1 font-semibold';
    rankCell.textContent = entry.rank;
    row.appendChild(rankCell);

    // Guardian
    const guardianCell = document.createElement('div');
    guardianCell.className = 'col-span-3 flex items-center gap-1';
    const guardianEmoji = document.createElement('span');
    guardianEmoji.textContent = STAGE_EMOJIS[entry.stage] || '?';
    const guardianName = document.createElement('span');
    guardianName.className = 'truncate';
    guardianName.textContent = entry.guardianName;
    guardianCell.appendChild(guardianEmoji);
    guardianCell.appendChild(guardianName);
    row.appendChild(guardianCell);

    // Owner
    const ownerCell = document.createElement('div');
    ownerCell.className = 'col-span-2 truncate text-zinc-400';
    ownerCell.textContent = entry.username || 'Unknown';
    row.appendChild(ownerCell);

    // Stage
    const stageCell = document.createElement('div');
    stageCell.className = 'col-span-2';
    stageCell.textContent = entry.stage;
    row.appendChild(stageCell);

    // Score
    const scoreCell = document.createElement('div');
    scoreCell.className = 'col-span-2 font-semibold text-purple-400';
    scoreCell.textContent = entry.contributionScore.toLocaleString();
    row.appendChild(scoreCell);

    // Level
    const levelCell = document.createElement('div');
    levelCell.className = 'col-span-2';
    levelCell.textContent = `Lvl ${entry.level}`;
    row.appendChild(levelCell);

    table.appendChild(row);
  }

  container.appendChild(table);
  return container;
}

async function loadLeaderboard(limit = 50, offset = 0) {
  try {
    const response = await fetch(`/api/evolution/leaderboard?limit=${limit}&offset=${offset}`, {
      headers: {
        'x-usernode-token': localStorage.getItem('usernode-token') || ''
      }
    });
    return await response.json();
  } catch (err) {
    console.error('Failed to load leaderboard:', err);
    return { entries: [], total: 0 };
  }
}
