const STAGE_EMOJIS = {
  INITIATE: '🌱',
  AWAKENED: '💙',
  ASCENDANT: '✨',
  GUARDIAN: '⚡',
  MYTHIC: '🔮'
};

function createEvolutionTimeline(history) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-4 rounded-lg border p-4 bg-zinc-900 border-zinc-800';

  // Header
  const header = document.createElement('div');
  header.className = 'text-sm font-semibold text-zinc-100';
  header.textContent = 'Evolution History';
  container.appendChild(header);

  if (!history || history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-xs text-zinc-400 py-4 text-center';
    empty.textContent = 'No evolution history yet';
    container.appendChild(empty);
    return container;
  }

  // Timeline items
  const timeline = document.createElement('div');
  timeline.className = 'space-y-3';

  for (const entry of history) {
    const item = document.createElement('div');
    item.className = 'flex gap-3 pb-3 border-b border-zinc-800 last:border-b-0';

    // Timeline dot
    const dot = document.createElement('div');
    dot.className = 'flex flex-col items-center';

    const dotCircle = document.createElement('div');
    dotCircle.className = 'w-3 h-3 rounded-full bg-purple-500 mt-1';

    dot.appendChild(dotCircle);
    item.appendChild(dot);

    // Content
    const content = document.createElement('div');
    content.className = 'flex-1 text-xs';

    const stageRow = document.createElement('div');
    stageRow.className = 'flex items-center gap-2';

    const oldStageEmoji = document.createElement('span');
    oldStageEmoji.textContent = STAGE_EMOJIS[entry.old_stage] || '?';

    const arrow = document.createElement('span');
    arrow.className = 'text-zinc-500';
    arrow.textContent = '→';

    const newStageEmoji = document.createElement('span');
    newStageEmoji.textContent = STAGE_EMOJIS[entry.new_stage] || '?';

    const stageLabel = document.createElement('span');
    stageLabel.className = 'font-semibold text-zinc-100';
    stageLabel.textContent = `${entry.old_stage} → ${entry.new_stage}`;

    stageRow.appendChild(oldStageEmoji);
    stageRow.appendChild(arrow);
    stageRow.appendChild(newStageEmoji);
    stageRow.appendChild(stageLabel);
    content.appendChild(stageRow);

    const detailsRow = document.createElement('div');
    detailsRow.className = 'text-zinc-400 mt-1';

    const levelChange = document.createElement('span');
    levelChange.textContent = `Level ${entry.old_level} → ${entry.new_level}`;

    const separator = document.createElement('span');
    separator.className = 'mx-2 text-zinc-600';
    separator.textContent = '•';

    const score = document.createElement('span');
    score.textContent = `Score: ${entry.score_at_transition}`;

    detailsRow.appendChild(levelChange);
    detailsRow.appendChild(separator);
    detailsRow.appendChild(score);
    content.appendChild(detailsRow);

    const dateRow = document.createElement('div');
    dateRow.className = 'text-zinc-500 text-xs mt-1';
    const date = new Date(entry.created_at);
    dateRow.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    content.appendChild(dateRow);

    item.appendChild(content);
    timeline.appendChild(item);
  }

  container.appendChild(timeline);
  return container;
}
