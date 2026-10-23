/**
 * app.js
 * Main application orchestrator.
 * Handles tab navigation, solver UI, input grids, playback, comparison, and events.
 */

'use strict';

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let currentTab = 'home';
let solveResult   = null;  // last solve result
let currentInitial = [1,2,3,4,5,6,7,8,0]; // default (already solved) — user changes these
let currentGoal    = [1,2,3,4,5,6,7,8,0];

/* ══════════════════════════════════════
   TAB NAVIGATION
══════════════════════════════════════ */
function switchTab(tabId) {
  // Hide all
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  // Show target
  const section = document.getElementById('tab-' + tabId);
  const btn = document.getElementById('nav-' + tabId);
  if (section) section.classList.add('active');
  if (btn) btn.classList.add('active');
  currentTab = tabId;

  // Trigger tab-specific init
  if (tabId === 'visualization' && solveResult) {
    setTimeout(refreshVizCharts, 50);
  }
  if (tabId === 'comparison') {
    // Re-render charts if results exist
    setTimeout(() => {
      const wrap = document.getElementById('compChartsCard');
      if (wrap && wrap.style.display !== 'none') {
        // Redraw charts on resize
        setTimeout(() => {
          if (window._lastCompResults) {
            window.Comparison.populateCompCharts(window._lastCompResults);
          }
        }, 50);
      }
    }, 50);
  }
  // Close mobile menu
  document.getElementById('navLinks')?.classList.remove('open');
}
window.switchTab = switchTab;

/* ══════════════════════════════════════
   INPUT GRID SETUP
══════════════════════════════════════ */
function buildInputGrid(containerId, values, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  values.forEach((val, idx) => {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.maxLength = 1;
    inp.value = val === 0 ? '' : val;
    inp.dataset.idx = idx;
    inp.id = `${containerId}_cell_${idx}`;
    inp.addEventListener('input', () => {
      const v = parseInt(inp.value) || 0;
      values[idx] = v;
      inp.value = v === 0 ? '' : v;
      if (onChange) onChange();
    });
    // Auto-advance focus
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && inp.value === '') {
        if (idx > 0) container.children[idx - 1].focus();
      }
    });
    inp.addEventListener('keyup', () => {
      if (inp.value.length >= 1 && idx < 8) {
        container.children[idx + 1].focus();
      }
    });
    container.appendChild(inp);
  });
}

function readInputGrid(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  const vals = [];
  Array.from(container.children).forEach(inp => {
    const v = parseInt(inp.value) || 0;
    vals.push(v);
  });
  return vals;
}

function writeInputGrid(containerId, values) {
  const container = document.getElementById(containerId);
  if (!container) return;
  Array.from(container.children).forEach((inp, i) => {
    inp.value = values[i] === 0 ? '' : values[i];
  });
}

/* ══════════════════════════════════════
   SOLVABILITY CHECK & INDICATOR
══════════════════════════════════════ */
function checkAndIndicateSolvability() {
  const initial = readInputGrid('initialInput');
  const goal    = readInputGrid('goalInput');
  if (!initial || !goal) return;

  // Validate: must contain digits 0-8 exactly once
  const sortedI = [...initial].sort((a,b)=>a-b).join(',');
  const sortedG = [...goal  ].sort((a,b)=>a-b).join(',');
  const expected = '0,1,2,3,4,5,6,7,8';
  const indEl = document.getElementById('sIndicator');
  const txtEl = document.getElementById('solvabilityText');

  if (sortedI !== expected || sortedG !== expected) {
    indEl.className = 's-indicator unknown';
    txtEl.textContent = 'Enter digits 0–8 (each once)';
    return;
  }
  if (window.Puzzle.isSolvable(initial, goal)) {
    indEl.className = 's-indicator solvable';
    txtEl.textContent = '✓ Puzzle is solvable';
  } else {
    indEl.className = 's-indicator unsolvable';
    txtEl.textContent = '✗ Not solvable from initial → goal';
  }
  currentInitial = initial;
  currentGoal    = goal;
}

/* ══════════════════════════════════════
   SOLVER CONTROLS
══════════════════════════════════════ */
function getAlgorithmOptions() {
  return {
    algorithm: document.getElementById('algorithmSelect')?.value || 'astar',
    heuristic: document.querySelector('input[name="heuristic"]:checked')?.value || 'manhattan',
    depthLimit: parseInt(document.getElementById('depthLimit')?.value) || 30,
  };
}

async function handleSolve() {
  const initial = readInputGrid('initialInput');
  const goal    = readInputGrid('goalInput');

  if (!initial || !goal) { showStatus('Could not read puzzle inputs.', 'error'); return; }

  // Validate
  const sortedI = [...initial].sort((a,b)=>a-b).join(',');
  const sortedG = [...goal  ].sort((a,b)=>a-b).join(',');
  if (sortedI !== '0,1,2,3,4,5,6,7,8' || sortedG !== '0,1,2,3,4,5,6,7,8') {
    showStatus('Each grid must contain digits 0–8 exactly once.', 'error'); return;
  }
  if (!window.Puzzle.isSolvable(initial, goal)) {
    showStatus('This puzzle configuration is not solvable. Try a different initial state.', 'error'); return;
  }

  const { algorithm, heuristic, depthLimit } = getAlgorithmOptions();
  currentInitial = initial;
  currentGoal    = goal;

  // Show loading state
  const btn = document.getElementById('solveBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Solving…';
  showStatus('', '');

  // Yield to paint
  await new Promise(r => setTimeout(r, 10));

  let result = null;
  try {
    result = window.AI_Algorithms.solve(algorithm, initial, goal, { heuristic, depthLimit });
  } catch (e) {
    console.error(e);
  }

  btn.disabled = false;
  btn.innerHTML = `
    <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/></svg>
    Solve Puzzle`;

  if (!result) {
    showStatus(`No solution found by ${algorithm.toUpperCase()}. Try a different algorithm or check the depth limit.`, 'error');
    solveResult = null;
    clearPlayback();
    return;
  }

  solveResult = result;

  // Update stats
  document.getElementById('statNodes').textContent = result.nodesExplored?.toLocaleString() ?? '—';
  document.getElementById('statDepth').textContent = result.solution?.length ?? '—';
  document.getElementById('statTime').textContent  = result.time?.toFixed(2) ?? '—';
  document.getElementById('statMoves').textContent = result.solution?.length ?? '—';

  // Show controls
  document.getElementById('progressRow').style.display = 'flex';
  document.getElementById('movelistCard').style.display = 'block';

  // Render move list chips
  renderMoveChips(result.solution, result.path);

  // Initialize playback
  initPlayback(result.path);

  // Update viz tab data
  window.Visualizer.updateVizTab(algorithm, heuristic, result);

  showStatus(`✓ Solved in ${result.solution.length} moves — ${result.nodesExplored} nodes explored in ${result.time.toFixed(2)}ms`, 'success');

  // Animate goal display
  window.Puzzle.renderPuzzleGrid(document.getElementById('goalPuzzle'), goal);
}

/* ══════════════════════════════════════
   MOVE CHIPS
══════════════════════════════════════ */
function renderMoveChips(moves, path) {
  const list = document.getElementById('moveList');
  if (!list) return;
  list.innerHTML = '';

  const arrows = { U:'↑', D:'↓', L:'←', R:'→' };

  moves.forEach((m, i) => {
    const chip = document.createElement('span');
    chip.className = 'move-chip';
    chip.dataset.step = i + 1;
    chip.innerHTML = `<span class="move-num">${i+1}.</span> ${arrows[m]||m}`;
    chip.addEventListener('click', () => {
      window.Visualizer.Playback.currentStep = i + 1;
      onPlaybackStep(i + 1, path[i + 1], path.length);
    });
    list.appendChild(chip);
  });
}

function updateActiveChip(step) {
  const list = document.getElementById('moveList');
  if (!list) return;
  Array.from(list.children).forEach(c => {
    c.classList.toggle('active', parseInt(c.dataset.step) === step);
  });
  // Scroll active into view
  const active = list.querySelector('.active');
  if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ══════════════════════════════════════
   PLAYBACK INIT & CALLBACKS
══════════════════════════════════════ */
function initPlayback(path) {
  window.Visualizer.playbackSetSolution(path, onPlaybackStep, onPlaybackDone);
  // Render initial state
  window.Puzzle.renderPuzzleGrid(document.getElementById('mainPuzzle'), path[0]);
  updatePlaybackUI(false);
  updateProgress(0, path.length);
  document.getElementById('stepCounter').textContent = `0 / ${path.length - 1}`;
  updateActiveChip(0);
}

function onPlaybackStep(step, state, total) {
  const prev = window.Visualizer.Playback.path[step - 1];
  window.Puzzle.animateMove(document.getElementById('mainPuzzle'), prev, state);
  updateProgress(step, total);
  document.getElementById('stepCounter').textContent = `${step} / ${total - 1}`;
  updateActiveChip(step);
}

function onPlaybackDone() {
  updatePlaybackUI(false);
  // Flash success
  document.getElementById('mainPuzzle')?.classList.add('success-flash');
  setTimeout(() => document.getElementById('mainPuzzle')?.classList.remove('success-flash'), 800);
}

function updatePlaybackUI(playing) {
  const playIcon  = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  if (playing) {
    playIcon.style.display  = 'none';
    pauseIcon.style.display = '';
  } else {
    playIcon.style.display  = '';
    pauseIcon.style.display = 'none';
  }
  document.getElementById('prevBtn').disabled = window.Visualizer.Playback.currentStep === 0;
  document.getElementById('nextBtn').disabled = window.Visualizer.Playback.currentStep >= window.Visualizer.Playback.path.length - 1;
}

function updateProgress(step, total) {
  const pct = total > 1 ? (step / (total - 1)) * 100 : 0;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressText').textContent = `Step ${step} / ${total - 1}`;
}

function clearPlayback() {
  document.getElementById('progressRow').style.display    = 'none';
  document.getElementById('movelistCard').style.display  = 'none';
  window.Puzzle.renderPuzzleGrid(document.getElementById('mainPuzzle'), currentInitial);
  document.getElementById('stepCounter').textContent = '—';
}

/* ══════════════════════════════════════
   STATUS
══════════════════════════════════════ */
function showStatus(msg, type) {
  const el = document.getElementById('statusMessage');
  if (!el) return;
  el.textContent = msg;
  el.className = 'status-message ' + (msg ? type : '');
}

/* ══════════════════════════════════════
   VIZ TAB: refresh charts
══════════════════════════════════════ */
function refreshVizCharts() {
  const canvas = document.getElementById('searchChart');
  if (canvas && solveResult) {
    const steps = Math.min(solveResult.nodesExplored || 0, 200);
    const exploredData = [];
    const frontierData = [];
    for (let i = 0; i <= steps; i++) {
      exploredData.push(Math.round((solveResult.nodesExplored || 0) * (i/steps)));
      frontierData.push(Math.round((solveResult.maxFrontier   || 0) * Math.sin((Math.PI * i)/Math.max(steps,1))));
    }
    window.Visualizer.drawLineChart(canvas, [
      { data: exploredData, color: '#6366f1', label: 'Explored' },
      { data: frontierData, color: '#a78bfa', label: 'Frontier' },
    ]);
  }
}

/* ══════════════════════════════════════
   ALGORITHM SELECT: show/hide options
══════════════════════════════════════ */
function updateAlgoOptions() {
  const algo  = document.getElementById('algorithmSelect')?.value;
  const dlsCfg = document.getElementById('dlsConfig');
  const hCfg   = document.getElementById('heuristicConfig');

  dlsCfg.style.display = algo === 'dls' ? 'block' : 'none';
  hCfg.style.display   = ['gbfs', 'astar'].includes(algo) ? 'block' : 'none';
}

/* ══════════════════════════════════════
   COMPARISON TAB
══════════════════════════════════════ */
async function handleRunComparison() {
  const initial = readInputGrid('initialInput') || currentInitial;
  const goal    = readInputGrid('goalInput')    || currentGoal;
  const heuristic = document.querySelector('input[name="compHeuristic"]:checked')?.value || 'manhattan';

  const sortedI = [...initial].sort((a,b)=>a-b).join(',');
  const expected = '0,1,2,3,4,5,6,7,8';
  if (sortedI !== expected) {
    alert('Please configure a valid puzzle in the Solver tab first.'); return;
  }

  const btn = document.getElementById('runComparisonBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Running…';

  await new Promise(r => setTimeout(r, 10));

  let results;
  try {
    results = await window.Comparison.runComparison(initial, goal, heuristic);
  } catch(e) {
    console.error(e);
    btn.disabled = false;
    btn.textContent = 'Run All Algorithms';
    return;
  }

  window._lastCompResults = results;

  // Show table + charts
  document.getElementById('compTableWrap').style.display  = 'block';
  document.getElementById('compChartsCard').style.display = 'block';

  window.Comparison.populateCompTable(results);
  setTimeout(() => window.Comparison.populateCompCharts(results), 50);

  btn.disabled = false;
  btn.innerHTML = `
    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h5a1 1 0 000-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM13 16a1 1 0 102 0v-5.586l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 101.414 1.414L13 10.414V16z"/></svg>
    Run All Algorithms`;
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  /* ── Nav ── */
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.getElementById('hamburger')?.addEventListener('click', () => {
    document.getElementById('navLinks')?.classList.toggle('open');
  });

  /* ── Build input grids ── */
  currentInitial = [1,2,3,4,0,6,7,5,8]; // interesting default
  currentGoal    = [1,2,3,4,5,6,7,8,0];
  buildInputGrid('initialInput', [...currentInitial], checkAndIndicateSolvability);
  buildInputGrid('goalInput',    [...currentGoal],    checkAndIndicateSolvability);
  checkAndIndicateSolvability();

  /* ── Render puzzle displays ── */
  window.Puzzle.renderPuzzleGrid(document.getElementById('mainPuzzle'), currentInitial);
  window.Puzzle.renderPuzzleGrid(document.getElementById('goalPuzzle'), currentGoal);

  /* ── Random button ── */
  document.getElementById('randomBtn')?.addEventListener('click', () => {
    const goal = readInputGrid('goalInput') || currentGoal;
    const sorted = [...goal].sort((a,b)=>a-b).join(',');
    const g = sorted === '0,1,2,3,4,5,6,7,8' ? goal : [1,2,3,4,5,6,7,8,0];
    const rand = window.Puzzle.generateSolvable(g);
    currentInitial = rand;
    writeInputGrid('initialInput', rand);
    window.Puzzle.renderPuzzleGrid(document.getElementById('mainPuzzle'), rand);
    checkAndIndicateSolvability();
  });

  /* ── Clear button ── */
  document.getElementById('clearBtn')?.addEventListener('click', () => {
    currentInitial = [0,0,0,0,0,0,0,0,0];
    writeInputGrid('initialInput', currentInitial);
    document.getElementById('sIndicator').className = 's-indicator unknown';
    document.getElementById('solvabilityText').textContent = 'Enter a puzzle to check';
  });

  /* ── Default goal button ── */
  document.getElementById('defaultGoalBtn')?.addEventListener('click', () => {
    currentGoal = [1,2,3,4,5,6,7,8,0];
    writeInputGrid('goalInput', currentGoal);
    checkAndIndicateSolvability();
  });

  /* ── Algorithm select ── */
  document.getElementById('algorithmSelect')?.addEventListener('change', updateAlgoOptions);
  updateAlgoOptions();

  /* ── Solve button ── */
  document.getElementById('solveBtn')?.addEventListener('click', handleSolve);

  /* ── Playback controls ── */
  document.getElementById('playPauseBtn')?.addEventListener('click', () => {
    if (!solveResult) return;
    if (window.Visualizer.Playback.isPlaying) {
      window.Visualizer.playbackPause();
      updatePlaybackUI(false);
    } else {
      window.Visualizer.Playback.speed = 1600 - parseInt(document.getElementById('speedSlider')?.value || 600);
      window.Visualizer.playbackPlay();
      updatePlaybackUI(true);

      // update UI on each step
      window.Visualizer.Playback.onStep = (step, state, total) => {
        onPlaybackStep(step, state, total);
        updatePlaybackUI(true);
      };
      window.Visualizer.Playback.onDone = () => {
        onPlaybackDone();
        updatePlaybackUI(false);
      };
    }
  });

  document.getElementById('nextBtn')?.addEventListener('click', () => {
    if (!solveResult) return;
    window.Visualizer.playbackNext();
    updatePlaybackUI(false);
  });

  document.getElementById('prevBtn')?.addEventListener('click', () => {
    if (!solveResult) return;
    window.Visualizer.playbackPrev();
    updatePlaybackUI(false);
  });

  document.getElementById('resetBtn')?.addEventListener('click', () => {
    if (!solveResult) return;
    window.Visualizer.playbackPause();
    window.Visualizer.playbackReset();
    updatePlaybackUI(false);
  });

  document.getElementById('speedSlider')?.addEventListener('input', () => {
    window.Visualizer.Playback.speed = 1600 - parseInt(document.getElementById('speedSlider').value);
    if (window.Visualizer.Playback.isPlaying) {
      // Restart interval with new speed
      window.Visualizer.playbackPause();
      window.Visualizer.playbackPlay();
      updatePlaybackUI(true);
    }
  });

  /* ── Comparison ── */
  document.getElementById('runComparisonBtn')?.addEventListener('click', handleRunComparison);

  /* ── Demo puzzle ── */
  window.Puzzle.initDemoPuzzle();

  /* ── Resize: redraw charts ── */
  window.addEventListener('resize', () => {
    if (currentTab === 'visualization') refreshVizCharts();
    if (currentTab === 'comparison' && window._lastCompResults) {
      setTimeout(() => window.Comparison.populateCompCharts(window._lastCompResults), 100);
    }
  });
});
