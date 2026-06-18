/**
 * @typedef {Object} Guardian
 * @property {string} id
 * @property {string} name
 * @property {number} totalFGHours
 * @property {string} [stage]
 * @property {string} [status]
 * @property {number} [level]
 * @property {number} [contributionScore]
 * @property {string} [title]
 * @property {string} [aura]
 */

// Store references to guardian hero components for realtime updates
const heroComponents = new Map();

/**
 * Creates and returns a GuardianHero component element.
 * @param {Guardian} guardian
 * @returns {HTMLElement}
 */
function createGuardianHero(guardian) {
  const container = document.createElement('div');
  container.className = 'flex flex-col items-center justify-center gap-6 py-12 px-4 transition-all duration-300';
  container.id = `hero-guardian-${guardian.id}`;

  // Name
  const name = document.createElement('h2');
  name.className = 'text-3xl font-bold text-zinc-100';
  name.textContent = guardian.name;
  name.id = `hero-name-${guardian.id}`;

  container.appendChild(name);

  // Stage badge (if available)
  if (guardian.stage) {
    const stageBadge = document.createElement('div');
    stageBadge.className = 'px-3 py-1 bg-purple-900 text-purple-100 rounded-full text-sm font-semibold';
    stageBadge.id = `hero-stage-${guardian.id}`;
    stageBadge.textContent = guardian.stage;
    container.appendChild(stageBadge);
  }

  // Level and score (if available)
  if (guardian.level || guardian.contributionScore) {
    const statsDiv = document.createElement('div');
    statsDiv.className = 'flex gap-4 justify-center text-sm text-zinc-400';
    statsDiv.id = `hero-stats-${guardian.id}`;

    if (guardian.level) {
      const levelSpan = document.createElement('span');
      levelSpan.textContent = `Level ${guardian.level}`;
      statsDiv.appendChild(levelSpan);
    }

    if (guardian.contributionScore !== undefined) {
      const scoreSpan = document.createElement('span');
      scoreSpan.textContent = `Score: ${guardian.contributionScore}`;
      statsDiv.appendChild(scoreSpan);
    }

    container.appendChild(statsDiv);
  }

  // Store reference for updates
  heroComponents.set(guardian.id, {
    container,
    guardian,
    updateGuardianHero: (newGuardian) => {
      // Update name
      const nameEl = document.getElementById(`hero-name-${guardian.id}`);
      if (nameEl) nameEl.textContent = newGuardian.name || guardian.name;

      // Update stage badge
      const stageEl = document.getElementById(`hero-stage-${guardian.id}`);
      if (stageEl && newGuardian.stage) {
        stageEl.textContent = newGuardian.stage;
        stageEl.classList.add('animate-pulse');
        setTimeout(() => stageEl.classList.remove('animate-pulse'), 1000);
      }

      // Update stats
      const statsEl = document.getElementById(`hero-stats-${guardian.id}`);
      if (statsEl) {
        statsEl.innerHTML = '';
        if (newGuardian.level) {
          const levelSpan = document.createElement('span');
          levelSpan.textContent = `Level ${newGuardian.level}`;
          statsEl.appendChild(levelSpan);
        }
        if (newGuardian.contributionScore !== undefined) {
          const scoreSpan = document.createElement('span');
          scoreSpan.textContent = `Score: ${newGuardian.contributionScore}`;
          statsEl.appendChild(scoreSpan);
        }
      }

      // Pulse the container to highlight change
      container.classList.add('opacity-75');
      setTimeout(() => container.classList.remove('opacity-75'), 500);
    }
  });

  // Set up WebSocket listener for realtime updates
  if (window.signalingClient && typeof window.signalingClient.on === 'function') {
    window.signalingClient.on('guardian_status_update', async (msg) => {
      // Only update if this is for the guardian we're showing
      if (msg.guardianId === parseInt(guardian.id)) {
        try {
          // Fetch the latest guardian data
          const token = localStorage.getItem('usernode-token');
          const headers = token ? { 'x-usernode-token': token } : {};
          const response = await fetch('/api/guardian/current', { headers });
          if (response.ok) {
            const data = await response.json();
            if (data.guardian) {
              // Extract evolution data
              const evolutionResponse = await fetch(`/api/evolution/guardian/${guardian.id}`, { headers });
              if (evolutionResponse.ok) {
                const evoData = await evolutionResponse.json();
                const updatedGuardian = {
                  ...data.guardian,
                  stage: evoData.stage,
                  level: evoData.level,
                  contributionScore: evoData.contribution_score,
                  title: evoData.title,
                  aura: evoData.aura
                };
                const heroRef = heroComponents.get(guardian.id);
                if (heroRef && heroRef.updateGuardianHero) {
                  heroRef.updateGuardianHero(updatedGuardian);
                }
              }
            }
          }
        } catch (err) {
          console.error('Error updating guardian hero:', err);
        }
      }
    });
  }

  return container;
}

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = createGuardianHero;
}
