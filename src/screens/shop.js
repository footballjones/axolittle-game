// ============================================================
// Axolittle — Shop Screen
// Treatment items, filters, and ghost shrimp
// ============================================================

import { gameState } from '../engine/state.js';
import { useTreatment, upgradeFilter } from '../engine/actions.js';
import { TREATMENTS, FILTERS, GHOST_SHRIMP_CONFIG } from '../data/config.js';

function getActiveShrimpCount() {
  const aquarium = gameState.activeAquarium;
  if (!aquarium.ghostShrimp || !aquarium.ghostShrimp.batches) return 0;
  const now = Date.now();
  let total = 0;
  for (const batch of aquarium.ghostShrimp.batches) {
    const durationMs = (batch.count / 10) * GHOST_SHRIMP_CONFIG.durationHoursPer10 * 60 * 60 * 1000;
    const elapsed = now - batch.addedAt;
    if (elapsed < durationMs) {
      const remaining = Math.max(0, Math.round(batch.count * (1 - elapsed / durationMs)));
      total += remaining;
    }
  }
  return total;
}

function buyGhostShrimp(qty) {
  const opalCost = (qty / 10) * GHOST_SHRIMP_CONFIG.costPer10;
  if (gameState.opals < opalCost) {
    return { success: false, reason: 'Not enough Opals' };
  }

  const current = getActiveShrimpCount();
  if (current + qty > GHOST_SHRIMP_CONFIG.maxInTank) {
    return { success: false, reason: `Max ${GHOST_SHRIMP_CONFIG.maxInTank} shrimp in tank` };
  }

  const aquarium = gameState.activeAquarium;
  if (!aquarium.ghostShrimp) aquarium.ghostShrimp = { batches: [] };

  gameState.opals -= opalCost;
  aquarium.ghostShrimp.batches.push({ count: qty, addedAt: Date.now() });

  gameState.notify();
  gameState.save();
  return { success: true };
}

export function renderShop(container) {
  const activeShrimp = getActiveShrimpCount();
  const currentFilter = gameState.activeAquarium.filterTier;

  container.innerHTML = `
    <div class="shop-screen">
      <h2>🛒 Shop</h2>
      <div class="currency-bar">
        <span class="bubble-count">💧 ${gameState.bubbles}</span>
        <span class="opal-count">🔮 ${gameState.opals}</span>
      </div>

      <h3>Treatment Items</h3>
      <div class="shop-grid">
        <div class="shop-item" data-item="bloodworms">
          <div class="item-icon">🪱</div>
          <div class="item-name">Bloodworms</div>
          <div class="item-desc">Restores Hunger</div>
          <div class="item-cost">20 💧</div>
        </div>
        <div class="shop-item" data-item="tankCleaner">
          <div class="item-icon">🧹</div>
          <div class="item-name">Tank Cleaner</div>
          <div class="item-desc">Restores Cleanliness</div>
          <div class="item-cost">20 💧</div>
        </div>
        <div class="shop-item" data-item="playToy">
          <div class="item-icon">🎾</div>
          <div class="item-name">Play Toy</div>
          <div class="item-desc">Restores Happiness</div>
          <div class="item-cost">20 💧</div>
        </div>
        <div class="shop-item" data-item="waterTreatment">
          <div class="item-icon">💧</div>
          <div class="item-name">Water Treatment</div>
          <div class="item-desc">Restores Water Quality</div>
          <div class="item-cost">20 💧</div>
        </div>
        <div class="shop-item" data-item="miracleTreatment">
          <div class="item-icon">✨</div>
          <div class="item-name">Miracle Treatment</div>
          <div class="item-desc">Restores All (partial)</div>
          <div class="item-cost">25 🔮</div>
        </div>
      </div>

      <h3>🦐 Ghost Shrimp <span class="shrimp-count">(${activeShrimp}/${GHOST_SHRIMP_CONFIG.maxInTank} in tank)</span></h3>
      <p class="shop-desc">Live shrimp that clean poop and reduce hunger decay. Last ${GHOST_SHRIMP_CONFIG.durationHoursPer10}hrs per 10 shrimp.</p>
      <div class="shop-grid shrimp-grid">
        <div class="shop-item shrimp-buy" data-shrimp-qty="10">
          <div class="item-icon">🦐</div>
          <div class="item-name">10 Shrimp</div>
          <div class="item-cost">${GHOST_SHRIMP_CONFIG.costPer10} 🔮</div>
        </div>
        <div class="shop-item shrimp-buy" data-shrimp-qty="20">
          <div class="item-icon">🦐🦐</div>
          <div class="item-name">20 Shrimp</div>
          <div class="item-cost">${GHOST_SHRIMP_CONFIG.costPer10 * 2} 🔮</div>
        </div>
        <div class="shop-item shrimp-buy" data-shrimp-qty="30">
          <div class="item-icon">🦐🦐🦐</div>
          <div class="item-name">30 Shrimp</div>
          <div class="item-cost">${GHOST_SHRIMP_CONFIG.costPer10 * 3} 🔮</div>
        </div>
      </div>

      <h3>Filters ${currentFilter !== 'basic' ? `(Current: ${FILTERS[currentFilter].label})` : ''}</h3>
      <div class="shop-grid">
        <div class="shop-item filter-item ${currentFilter === 'advanced' || currentFilter === 'premium' ? 'owned' : ''}" data-filter="advanced">
          <div class="item-icon">⚙️</div>
          <div class="item-name">Advanced Filter</div>
          <div class="item-desc">-40% water decay</div>
          <div class="item-cost">${currentFilter === 'advanced' || currentFilter === 'premium' ? 'Owned' : '7,500 💧'}</div>
        </div>
        <div class="shop-item filter-item ${currentFilter === 'premium' ? 'owned' : ''}" data-filter="premium">
          <div class="item-icon">⚙️</div>
          <div class="item-name">Premium Filter</div>
          <div class="item-desc">-70% water decay</div>
          <div class="item-cost">${currentFilter === 'premium' ? 'Owned' : '15,000 💧'}</div>
        </div>
      </div>

      <nav class="bottom-nav">
        <button class="nav-btn" data-screen="aquarium">🏠</button>
        <button class="nav-btn" data-screen="stats">📊</button>
        <button class="nav-btn" data-screen="play">🎮</button>
        <button class="nav-btn active" data-screen="shop">🛒</button>
      </nav>
    </div>
  `;

  function showToast(msg) {
    const existing = container.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 1500);
  }

  // Bind treatment items
  container.querySelectorAll('.shop-item[data-item]').forEach(item => {
    item.addEventListener('click', () => {
      const key = item.dataset.item;
      const result = useTreatment(key);
      if (!result.success) {
        showToast(result.reason);
      } else {
        showToast(`Used ${key}!`);
        renderShop(container);
      }
    });
  });

  // Bind ghost shrimp buy buttons
  container.querySelectorAll('.shrimp-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      const qty = parseInt(btn.dataset.shrimpQty);
      const result = buyGhostShrimp(qty);
      if (!result.success) {
        showToast(result.reason);
      } else {
        showToast(`Added ${qty} shrimp to tank!`);
        renderShop(container);
      }
    });
  });

  // Bind filter upgrades
  container.querySelectorAll('.filter-item:not(.owned)').forEach(item => {
    item.addEventListener('click', () => {
      const tier = item.dataset.filter;
      const result = upgradeFilter(tier);
      if (!result.success) {
        showToast(result.reason || 'Cannot upgrade');
      } else {
        showToast(`Upgraded to ${FILTERS[tier].label}!`);
        renderShop(container);
      }
    });
  });

  // Bind nav
  container.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: btn.dataset.screen }));
    });
  });
}
