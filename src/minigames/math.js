// ============================================================
// Axolittle — Math Rush Mini Game
// Answer math questions before the timer runs out.
// Stat reward: Intellect
// ============================================================

import { completeMiniGame } from '../engine/actions.js';

const THEMES = [
  { emoji: '🦐', name: 'ghost shrimp' },
  { emoji: '🐚', name: 'shells' },
  { emoji: '💎', name: 'gems' },
  { emoji: '🫧', name: 'bubbles' },
];

export function renderMath(container) {
  container.innerHTML = `
    <div class="minigame-screen">
      <div class="minigame-header">
        <button class="back-btn">← Back</button>
        <h3>🔢 Math Rush</h3>
        <div class="game-score">Score: <span id="math-score">0</span></div>
      </div>
      <div id="math-area" class="math-area">
        <div id="math-timer-bar" class="math-timer-bar"><div id="math-timer-fill" class="math-timer-fill"></div></div>
        <div id="math-theme-emoji" class="math-theme-emoji"></div>
        <div id="math-question" class="math-question"></div>
        <div id="math-answers" class="math-answers"></div>
        <div id="math-feedback" class="math-feedback"></div>
      </div>
      <div id="math-overlay" class="game-overlay">
        <div class="overlay-content">
          <h2>🔢 Math Rush</h2>
          <p>Solve equations before time runs out!<br>Each correct answer speeds up the timer.</p>
          <button id="math-start" class="start-btn">Start</button>
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

  const overlay = document.getElementById('math-overlay');
  const scoreDisplay = document.getElementById('math-score');
  const questionEl = document.getElementById('math-question');
  const answersEl = document.getElementById('math-answers');
  const feedbackEl = document.getElementById('math-feedback');
  const timerFill = document.getElementById('math-timer-fill');
  const themeEmoji = document.getElementById('math-theme-emoji');

  let running = false;
  let score = 0;
  let timerMax = 6000; // ms
  let timerLeft = timerMax;
  let lastTime = 0;
  let animFrame = null;
  let correctAnswer = 0;
  let waitingForNext = false;

  function generateQuestion() {
    const level = Math.min(Math.floor(score / 3), 4);
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    let a, b, op, answer, questionText;

    if (level < 1) {
      // Addition only
      a = 1 + Math.floor(Math.random() * 10);
      b = 1 + Math.floor(Math.random() * 10);
      op = '+';
      answer = a + b;
      questionText = `${a} ${theme.emoji} + ${b} ${theme.emoji} = ?`;
    } else if (level < 2) {
      // Addition & subtraction
      if (Math.random() < 0.5) {
        a = 2 + Math.floor(Math.random() * 15);
        b = 1 + Math.floor(Math.random() * a);
        op = '-';
        answer = a - b;
        questionText = `${a} ${theme.emoji} − ${b} ${theme.emoji} = ?`;
      } else {
        a = 1 + Math.floor(Math.random() * 15);
        b = 1 + Math.floor(Math.random() * 15);
        op = '+';
        answer = a + b;
        questionText = `${a} ${theme.emoji} + ${b} ${theme.emoji} = ?`;
      }
    } else if (level < 3) {
      // Multiplication
      a = 2 + Math.floor(Math.random() * 8);
      b = 2 + Math.floor(Math.random() * 8);
      op = '×';
      answer = a * b;
      questionText = `${a} × ${b} ${theme.emoji} = ?`;
    } else {
      // Mixed including division
      const ops = ['+', '-', '×', '÷'];
      op = ops[Math.floor(Math.random() * ops.length)];
      if (op === '÷') {
        b = 2 + Math.floor(Math.random() * 8);
        answer = 2 + Math.floor(Math.random() * 8);
        a = b * answer;
        questionText = `${a} ${theme.emoji} ÷ ${b} = ?`;
      } else if (op === '×') {
        a = 2 + Math.floor(Math.random() * 10);
        b = 2 + Math.floor(Math.random() * 10);
        answer = a * b;
        questionText = `${a} × ${b} ${theme.emoji} = ?`;
      } else if (op === '-') {
        a = 5 + Math.floor(Math.random() * 20);
        b = 1 + Math.floor(Math.random() * a);
        answer = a - b;
        questionText = `${a} ${theme.emoji} − ${b} ${theme.emoji} = ?`;
      } else {
        a = 1 + Math.floor(Math.random() * 20);
        b = 1 + Math.floor(Math.random() * 20);
        answer = a + b;
        questionText = `${a} ${theme.emoji} + ${b} ${theme.emoji} = ?`;
      }
    }

    correctAnswer = answer;

    // Generate wrong answers
    const wrongSet = new Set();
    while (wrongSet.size < 3) {
      let wrong = answer + (Math.floor(Math.random() * 7) - 3);
      if (wrong !== answer && wrong >= 0) wrongSet.add(wrong);
    }

    const options = [answer, ...wrongSet];
    // Shuffle
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    themeEmoji.textContent = theme.emoji;
    questionEl.textContent = questionText;
    answersEl.innerHTML = '';
    feedbackEl.textContent = '';

    for (const opt of options) {
      const btn = document.createElement('button');
      btn.className = 'math-answer-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => selectAnswer(opt, btn));
      answersEl.appendChild(btn);
    }

    // Reset timer — gets faster
    timerMax = Math.max(2500, 6000 - score * 200);
    timerLeft = timerMax;
    waitingForNext = false;
  }

  function selectAnswer(val, btn) {
    if (waitingForNext || !running) return;
    waitingForNext = true;

    const buttons = answersEl.querySelectorAll('.math-answer-btn');
    buttons.forEach(b => b.style.pointerEvents = 'none');

    if (val === correctAnswer) {
      btn.classList.add('correct');
      feedbackEl.textContent = '✓ Correct!';
      feedbackEl.className = 'math-feedback correct';
      score++;
      scoreDisplay.textContent = score;
      setTimeout(() => {
        if (running) generateQuestion();
      }, 500);
    } else {
      btn.classList.add('wrong');
      // Highlight correct
      buttons.forEach(b => {
        if (parseInt(b.textContent) === correctAnswer) b.classList.add('correct');
      });
      feedbackEl.textContent = '✗ Wrong!';
      feedbackEl.className = 'math-feedback wrong';
      setTimeout(() => endGame(), 800);
    }
  }

  function update(now) {
    if (!running || waitingForNext) return;
    const dt = now - lastTime;
    lastTime = now;

    timerLeft -= dt;
    const pct = Math.max(0, timerLeft / timerMax) * 100;
    timerFill.style.width = `${pct}%`;
    timerFill.style.background = pct > 30 ? '#4fc3f7' : '#ef5350';

    if (timerLeft <= 0) {
      feedbackEl.textContent = '⏰ Time\'s up!';
      feedbackEl.className = 'math-feedback wrong';
      endGame();
    }
  }

  function loop(now) {
    if (!running) return;
    update(now);
    animFrame = requestAnimationFrame(loop);
  }

  function startGame() {
    score = 0;
    scoreDisplay.textContent = '0';
    overlay.style.display = 'none';
    running = true;
    lastTime = performance.now();
    generateQuestion();
    animFrame = requestAnimationFrame(loop);
  }

  function endGame() {
    running = false;
    if (animFrame) cancelAnimationFrame(animFrame);

    let tier = 'normal';
    if (score >= 15) tier = 'exceptional';
    else if (score >= 8) tier = 'good';

    const result = completeMiniGame('intellect', tier);

    overlay.style.display = 'flex';
    overlay.querySelector('.overlay-content').innerHTML = `
      <h2>Game Over!</h2>
      <p>${score} correct answers</p>
      <p>Tier: ${tier.toUpperCase()}</p>
      <p class="reward-text">+Intellect  ·  +${result?.bubbles || 0} 💧</p>
      <button id="math-start" class="start-btn">Play Again</button>
      <button id="math-quit" class="quit-btn">Back to Games</button>
    `;
    document.getElementById('math-start').addEventListener('click', startGame);
    document.getElementById('math-quit').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'play' }));
    });
  }

  document.getElementById('math-start').addEventListener('click', startGame);

  container.querySelector('.back-btn').addEventListener('click', () => {
    running = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'play' }));
  });
  container.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      running = false;
      if (animFrame) cancelAnimationFrame(animFrame);
      window.dispatchEvent(new CustomEvent('navigate', { detail: btn.dataset.screen }));
    });
  });
}
