// ============================================================
// Axolittle — Coral Code Mini Game
// Mastermind-inspired reef decoding puzzle
// Stat reward: Intellect
// ============================================================
import { completeMiniGame } from '../engine/actions.js';

const SYMBOLS = [
  { id: 'pink-coral', icon: '🪸', name: 'Pink Coral' },
  { id: 'teal-shell', icon: '🐚', name: 'Teal Shell' },
  { id: 'amber-star', icon: '⭐', name: 'Amber Star' },
  { id: 'violet-anemone', icon: '🪻', name: 'Violet Anemone' },
  { id: 'moon-pearl', icon: '⚪', name: 'Moon Pearl' },
];

const DIFFICULTIES = {
  easy: {
    label: 'Lagoon (Easy)',
    codeLength: 3,
    maxAttempts: 10,
    symbolCount: 4,
    allowsDuplicates: false,
  },
  normal: {
    label: 'Reef (Normal)',
    codeLength: 4,
    maxAttempts: 10,
    symbolCount: 5,
    allowsDuplicates: false,
  },
  hard: {
    label: 'Abyss (Hard)',
    codeLength: 4,
    maxAttempts: 8,
    symbolCount: 5,
    allowsDuplicates: true,
  },
};

export function renderCoralCode(container) {
  container.innerHTML = `
    <div class="minigame-screen">
      <div class="minigame-header">
        <button class="back-btn">← Back</button>
        <h3>🪸 Coral Code</h3>
        <div class="game-score">Tries: <span id="coral-attempts-left">0</span></div>
      </div>
      <div class="coral-code-area">
        <p class="coral-subtitle">Decode Axolittle's reef signal. 🫧</p>
        <div id="coral-difficulty-badge" class="coral-difficulty-badge">Difficulty: Lagoon (Easy)</div>
        <div id="coral-current-row" class="coral-current-row"></div>
        <div id="coral-palette" class="coral-palette"></div>
        <div class="coral-actions">
          <button id="coral-clear" class="quit-btn">Clear Row</button>
          <button id="coral-submit" class="start-btn">Send Pulse</button>
        </div>
        <div id="coral-feedback" class="coral-status-text"></div>
        <div id="coral-history" class="coral-history"></div>
      </div>
      <div id="coral-overlay" class="game-overlay">
        <div class="overlay-content">
          <h2>🪸 Coral Code</h2>
          <p>
            Choose your depth, then crack the hidden reef pattern.<br>
            <strong>🫧 Bubble</strong> = right symbol, wrong spot.<br>
            <strong>⚪ Pearl</strong> = right symbol, right spot.
          </p>
          <div class="coral-difficulty-picker">
            <button class="difficulty-btn selected" data-difficulty="easy">Lagoon (Easy)</button>
            <button class="difficulty-btn" data-difficulty="normal">Reef (Normal)</button>
            <button class="difficulty-btn" data-difficulty="hard">Abyss (Hard)</button>
          </div>
          <p id="coral-difficulty-description" class="coral-difficulty-description"></p>
          <button id="coral-start" class="start-btn">Start</button>
        </div>
      </div>
      <nav class="bottom-nav">
        <button class="nav-btn" data-screen="aquarium">🏠</button>
        <button class="nav-btn" data-screen="stats">📊</button>
        <button class="nav-btn active" data-screen="play">🎮</button>
        <button class="nav-btn" data-screen="shop">🛒</button>
      </nav>
    </div>
  `;

  const overlay = container.querySelector('#coral-overlay');
  const startBtn = container.querySelector('#coral-start');
  const attemptsLeftEl = container.querySelector('#coral-attempts-left');
  const difficultyBadgeEl = container.querySelector('#coral-difficulty-badge');
  const currentRowEl = container.querySelector('#coral-current-row');
  const paletteEl = container.querySelector('#coral-palette');
  const historyEl = container.querySelector('#coral-history');
  const feedbackEl = container.querySelector('#coral-feedback');
  const submitBtn = container.querySelector('#coral-submit');
  const clearBtn = container.querySelector('#coral-clear');

  let active = false;
  let selectedDifficulty = 'easy';
  let settings = DIFFICULTIES[selectedDifficulty];
  let availableSymbols = SYMBOLS.slice(0, settings.symbolCount);
  let secret = [];
  let guess = new Array(settings.codeLength).fill(null);
  let selectedSymbol = availableSymbols[0].id;
  let attemptsUsed = 0;

  function getDifficultyDescription(key) {
    const config = DIFFICULTIES[key];
    if (!config) return '';
    const duplicateRule = config.allowsDuplicates ? 'Duplicates allowed' : 'No duplicates';
    return `${config.codeLength} slots \u2022 ${config.maxAttempts} tries \u2022 ${config.symbolCount} symbols \u2022 ${duplicateRule}`;
  }

  function applyDifficulty(key) {
    selectedDifficulty = DIFFICULTIES[key] ? key : 'easy';
    settings = DIFFICULTIES[selectedDifficulty];
    availableSymbols = SYMBOLS.slice(0, settings.symbolCount);
    selectedSymbol = availableSymbols[0].id;
    difficultyBadgeEl.textContent = `Difficulty: ${settings.label}`;
    attemptsLeftEl.textContent = `${settings.maxAttempts}`;
    currentRowEl.style.gridTemplateColumns = `repeat(${settings.codeLength}, 1fr)`;

    container.querySelectorAll('.difficulty-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.difficulty === selectedDifficulty);
    });
    const difficultyDescriptionEl = container.querySelector('#coral-difficulty-description');
    if (difficultyDescriptionEl) {
      difficultyDescriptionEl.textContent = getDifficultyDescription(selectedDifficulty);
    }
  }

  function generateSecretCode() {
    const pool = [...availableSymbols];
    const code = [];
    while (code.length < settings.codeLength) {
      const idx = Math.floor(Math.random() * pool.length);
      code.push(pool[idx].id);
      if (!settings.allowsDuplicates) {
        pool.splice(idx, 1);
      }
    }
    return code;
  }

  function evaluateGuess(secretCode, playerGuess) {
    const unmatchedSecret = [];
    const unmatchedGuess = [];
    let exact = 0;
    for (let i = 0; i < secretCode.length; i++) {
      if (secretCode[i] === playerGuess[i]) {
        exact++;
      } else {
        unmatchedSecret.push(secretCode[i]);
        unmatchedGuess.push(playerGuess[i]);
      }
    }
    let partial = 0;
    for (const symbol of unmatchedGuess) {
      const secretIndex = unmatchedSecret.indexOf(symbol);
      if (secretIndex >= 0) {
        partial++;
        unmatchedSecret.splice(secretIndex, 1);
      }
    }
    return { exact, partial };
  }

  function renderCurrentRow() {
    currentRowEl.innerHTML = '';
    for (let i = 0; i < settings.codeLength; i++) {
      const symbol = SYMBOLS.find(s => s.id === guess[i]);
      const slot = document.createElement('button');
      slot.className = 'coral-slot';
      slot.innerHTML = symbol ? `${symbol.icon}<span>${symbol.name}</span>` : '\u2022';
      slot.addEventListener('click', () => {
        if (!active) return;
        guess[i] = selectedSymbol;
        renderCurrentRow();
      });
      currentRowEl.appendChild(slot);
    }
  }

  function renderPalette() {
    paletteEl.innerHTML = '';
    for (const symbol of availableSymbols) {
      const btn = document.createElement('button');
      btn.className = `coral-token ${selectedSymbol === symbol.id ? 'selected' : ''}`;
      btn.innerHTML = `${symbol.icon}<span>${symbol.name}</span>`;
      btn.addEventListener('click', () => {
        if (!active) return;
        selectedSymbol = symbol.id;
        renderPalette();
      });
      paletteEl.appendChild(btn);
    }
  }

  function appendHistoryRow(rowGuess, result) {
    const row = document.createElement('div');
    row.className = 'coral-history-row';

    const guessDisplay = document.createElement('div');
    guessDisplay.className = 'coral-history-guess';
    for (const symbolId of rowGuess) {
      const symbol = SYMBOLS.find(s => s.id === symbolId);
      const chip = document.createElement('div');
      chip.className = 'coral-chip';
      chip.textContent = symbol?.icon || '\u2022';
      guessDisplay.appendChild(chip);
    }

    const clues = document.createElement('div');
    clues.className = 'coral-history-clues';
    for (let i = 0; i < result.exact; i++) {
      const clue = document.createElement('div');
      clue.className = 'coral-clue pearl';
      clue.textContent = '\u26AA';
      clues.appendChild(clue);
    }
    for (let i = 0; i < result.partial; i++) {
      const clue = document.createElement('div');
      clue.className = 'coral-clue bubble';
      clue.textContent = '\uD83E\uDEE7';
      clues.appendChild(clue);
    }

    row.appendChild(guessDisplay);
    row.appendChild(clues);
    historyEl.prepend(row);
  }

  function endGame(win) {
    active = false;
    if (win) {
      const attemptsLeft = settings.maxAttempts - attemptsUsed;
      const remainingRatio = attemptsLeft / settings.maxAttempts;
      let tier = 'normal';
      if (remainingRatio >= 0.6) tier = 'exceptional';
      else if (remainingRatio >= 0.3) tier = 'good';

      const result = completeMiniGame('intellect', tier);

      overlay.style.display = 'flex';
      overlay.querySelector('.overlay-content').innerHTML = `
        <h2>Decoded!</h2>
        <p>You cracked the whisper current in ${attemptsUsed} ${attemptsUsed === 1 ? 'try' : 'tries'}.</p>
        <p>Tier: ${tier.toUpperCase()} \u00b7 ${settings.label}</p>
        <p class="reward-text">+Intellect \u00b7 +${result?.bubbles || 0} \uD83D\uDCA7</p>
        <button id="coral-start" class="start-btn">Play Again</button>
        <button id="coral-quit" class="quit-btn">Back to Games</button>
      `;
    } else {
      const reveal = secret
        .map(symbolId => SYMBOLS.find(s => s.id === symbolId)?.icon || '\u2022')
        .join(' ');

      overlay.style.display = 'flex';
      overlay.querySelector('.overlay-content').innerHTML = `
        <h2>Current Lost</h2>
        <p>The reef signal was <strong>${reveal}</strong>.</p>
        <p>Try a different deduction path next round.</p>
        <button id="coral-start" class="start-btn">Retry</button>
        <button id="coral-quit" class="quit-btn">Back to Games</button>
      `;
    }

    container.querySelector('#coral-start')?.addEventListener('click', startGame);
    container.querySelector('#coral-quit')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'play' }));
    });
  }

  function submitGuess() {
    if (!active) return;
    if (guess.some(v => !v)) {
      feedbackEl.textContent = `Fill all ${settings.codeLength} slots before sending a pulse.`;
      return;
    }
    attemptsUsed++;
    attemptsLeftEl.textContent = `${Math.max(0, settings.maxAttempts - attemptsUsed)}`;

    const result = evaluateGuess(secret, guess);
    appendHistoryRow([...guess], result);

    if (result.exact === settings.codeLength) {
      feedbackEl.textContent = 'Signal decoded!';
      endGame(true);
      return;
    }
    if (attemptsUsed >= settings.maxAttempts) {
      feedbackEl.textContent = 'No pulses left.';
      endGame(false);
      return;
    }

    feedbackEl.textContent = `Clues: ${result.exact} pearl, ${result.partial} bubble`;
    guess = new Array(settings.codeLength).fill(null);
    renderCurrentRow();
  }

  function startGame() {
    secret = generateSecretCode();
    guess = new Array(settings.codeLength).fill(null);
    attemptsUsed = 0;
    active = true;
    attemptsLeftEl.textContent = `${settings.maxAttempts}`;
    feedbackEl.textContent = '';
    historyEl.innerHTML = '';
    overlay.style.display = 'none';
    renderPalette();
    renderCurrentRow();
  }

  container.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (active) return;
      applyDifficulty(btn.dataset.difficulty);
    });
  });

  submitBtn.addEventListener('click', submitGuess);
  clearBtn.addEventListener('click', () => {
    if (!active) return;
    guess = new Array(settings.codeLength).fill(null);
    renderCurrentRow();
  });

  startBtn.addEventListener('click', startGame);

  container.querySelector('.back-btn').addEventListener('click', () => {
    active = false;
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'play' }));
  });
  container.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      active = false;
      window.dispatchEvent(new CustomEvent('navigate', { detail: btn.dataset.screen }));
    });
  });

  applyDifficulty('easy');
  renderPalette();
  renderCurrentRow();
}
