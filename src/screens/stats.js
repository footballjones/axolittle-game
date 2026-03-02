// ============================================================
// Axolittle — Stats Screen
// Growth stats, XP bar, life stage info
// ============================================================

import { gameState } from '../engine/state.js';
import { XP_CONFIG, GROWTH_CAPS, LIFE_STAGES } from '../data/config.js';
import { checkStageProgression, progressStage } from '../engine/actions.js';

export function renderStats(container) {
  const axo = gameState.activeAxolotl;
  const g = axo.growth;
  const cap = GROWTH_CAPS[axo.lifeStage] || 100;
  const stageCheck = checkStageProgression();

  const xpPercent = axo.lifeStage === LIFE_STAGES.ADULT
    ? (axo.xp / XP_CONFIG.maxXP) * 100
    : 0;

  container.innerHTML = `
    <div class="stats-screen">
      <h2>📊 ${axo.name}'s Growth</h2>
      <div class="stage-info">
        Stage: <strong>${axo.lifeStage}</strong> · Generation ${axo.generation}
        ${stageCheck.canProgress && stageCheck.nextStage !== 'rebirth'
          ? `<button class="progress-btn">Evolve to ${stageCheck.nextStage} →</button>`
          : ''}
      </div>

      ${axo.lifeStage === LIFE_STAGES.ADULT ? `
        <div class="xp-section">
          <div class="stat-label">XP to Elder</div>
          <div class="xp-bar">
            <div class="xp-fill" style="width:${xpPercent}%"></div>
          </div>
          <div class="xp-text">${axo.xp} / ${XP_CONFIG.maxXP}</div>
        </div>
      ` : ''}

      <div class="growth-stats">
        <div class="growth-row">
          <span>⚡ Stamina</span>
          <div class="stat-bar"><div class="stat-fill stamina" style="width:${(g.stamina / cap) * 100}%"></div></div>
          <span>${Math.round(g.stamina)} / ${cap}</span>
        </div>
        <div class="growth-row">
          <span>💪 Strength</span>
          <div class="stat-bar"><div class="stat-fill strength" style="width:${(g.strength / cap) * 100}%"></div></div>
          <span>${Math.round(g.strength)} / ${cap}</span>
        </div>
        <div class="growth-row">
          <span>🏃 Speed</span>
          <div class="stat-bar"><div class="stat-fill speed" style="width:${(g.speed / cap) * 100}%"></div></div>
          <span>${Math.round(g.speed)} / ${cap}</span>
        </div>
        <div class="growth-row">
          <span>🧠 Intellect</span>
          <div class="stat-bar"><div class="stat-fill intellect" style="width:${(g.intellect / cap) * 100}%"></div></div>
          <span>${Math.round(g.intellect)} / ${cap}</span>
        </div>
      </div>

      <nav class="bottom-nav">
        <button class="nav-btn" data-screen="aquarium">🏠</button>
        <button class="nav-btn active" data-screen="stats">📊</button>
        <button class="nav-btn" data-screen="play">🎮</button>
        <button class="nav-btn" data-screen="shop">🛒</button>
      </nav>
    </div>
  `;

  // Bind stage progression
  const progressBtn = container.querySelector('.progress-btn');
  if (progressBtn) {
    progressBtn.addEventListener('click', () => {
      progressStage();
      renderStats(container);
    });
  }

  // Bind nav
  container.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: btn.dataset.screen }));
    });
  });
}
