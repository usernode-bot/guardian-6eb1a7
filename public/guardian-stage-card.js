const STAGE_EMOJIS = {
  INITIATE: '🌱',
  AWAKENED: '💙',
  ASCENDANT: '✨',
  GUARDIAN: '⚡',
  MYTHIC: '🔮'
};

function createGuardianStageCard(evolution) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-4 rounded-lg border p-4 bg-zinc-900 border-zinc-800';

  // Stage emoji and name
  const header = document.createElement('div');
  header.className = 'flex flex-col items-center gap-2';

  const emoji = document.createElement('span');
  emoji.className = 'text-4xl';
  emoji.textContent = STAGE_EMOJIS[evolution.stage] || '?';

  const stageName = document.createElement('span');
  stageName.className = 'text-lg font-semibold text-zinc-100';
  stageName.textContent = evolution.stage;

  header.appendChild(emoji);
  header.appendChild(stageName);
  container.appendChild(header);

  // Traits
  const traits = [
    { label: 'Aura', value: evolution.aura || 'None' },
    { label: 'Armor', value: evolution.armor_tier || 'None' },
    { label: 'Weapon', value: evolution.weapon_tier || 'None' }
  ];

  const traitsContainer = document.createElement('div');
  traitsContainer.className = 'space-y-2';

  for (const trait of traits) {
    const traitRow = document.createElement('div');
    traitRow.className = 'flex justify-between items-center px-2 py-1.5 bg-zinc-800 rounded text-xs';

    const label = document.createElement('span');
    label.className = 'text-zinc-400';
    label.textContent = trait.label;

    const value = document.createElement('span');
    value.className = 'font-semibold text-zinc-100';
    value.textContent = trait.value;

    traitRow.appendChild(label);
    traitRow.appendChild(value);
    traitsContainer.appendChild(traitRow);
  }

  container.appendChild(traitsContainer);

  return container;
}
