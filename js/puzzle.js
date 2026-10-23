/**
 * puzzle.js
 * Puzzle state management: solvability check, random generation,
 * and rendering the main puzzle grids.
 */

'use strict';

/* ─────────────────────────────────────
   SOLVABILITY
───────────────────────────────────── */

/**
 * Count inversions in the flat puzzle array (ignoring 0).
 * An inversion is when a larger number appears before a smaller one.
 */
function countInversions(arr) {
  const flat = arr.filter(v => v !== 0);
  let inv = 0;
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[i] > flat[j]) inv++;
    }
  }
  return inv;
}

/**
 * Check if a puzzle is solvable given the goal state.
 * For a 3×3 grid, a state is solvable ↔ (inversions parity == goal inversions parity).
 */
function isSolvable(initial, goal) {
  // If initial == goal, trivially solvable
  const initInv = countInversions(initial);
  const goalInv = countInversions(goal);
  return (initInv % 2) === (goalInv % 2);
}

/* ─────────────────────────────────────
   RANDOM PUZZLE GENERATION
───────────────────────────────────── */

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate a random solvable puzzle for the given goal.
 */
function generateSolvable(goal = [1,2,3,4,5,6,7,8,0]) {
  let state;
  do {
    state = shuffle([0,1,2,3,4,5,6,7,8]);
  } while (!isSolvable(state, goal) || state.join(',') === goal.join(','));
  return state;
}

/* ─────────────────────────────────────
   PUZZLE GRID RENDERING
───────────────────────────────────── */

/**
 * Render a puzzle state into a .puzzle-grid element.
 * @param {HTMLElement} container
 * @param {number[]} state
 * @param {number[]} [highlightTiles=[]] — indices to highlight
 */
function renderPuzzleGrid(container, state, highlightTiles = []) {
  container.innerHTML = '';
  state.forEach((val, idx) => {
    const tile = document.createElement('div');
    tile.className = 'puzzle-tile' + (val === 0 ? ' empty' : '');
    tile.textContent = val === 0 ? '' : val;
    tile.dataset.idx = idx;
    tile.dataset.val = val;
    if (highlightTiles.includes(idx)) tile.classList.add('moved');
    container.appendChild(tile);
  });
}

/**
 * Animate a move: highlight the tile that moved.
 * @param {HTMLElement} container
 * @param {number[]} prevState
 * @param {number[]} nextState
 */
function animateMove(container, prevState, nextState) {
  // Find the tile that changed position (other than blank)
  let movedIdx = -1;
  for (let i = 0; i < 9; i++) {
    if (prevState[i] !== nextState[i] && nextState[i] !== 0) {
      movedIdx = i;
      break;
    }
  }
  renderPuzzleGrid(container, nextState, movedIdx >= 0 ? [movedIdx] : []);

  // Trigger animation
  if (movedIdx >= 0) {
    const tile = container.children[movedIdx];
    if (tile) {
      tile.classList.add('tile-animate');
      setTimeout(() => tile.classList.remove('tile-animate'), 400);
    }
  }
}

/* ─────────────────────────────────────
   DEMO PUZZLE ANIMATION (Home tab)
───────────────────────────────────── */

let demoState = [1,2,3,4,0,6,7,5,8];
let demoGoal  = [1,2,3,4,5,6,7,8,0];
let demoTimer = null;
let demoPath  = null;
let demoCur   = 0;

function initDemoPuzzle() {
  const grid = document.getElementById('demoGrid');
  if (!grid) return;
  renderDemoGrid(grid, demoState);

  // Pre-solve with A*
  try {
    const result = window.AI_Algorithms.solve('astar', demoState, demoGoal);
    if (result && result.path && result.path.length > 1) {
      demoPath = result.path;
      demoCur  = 0;
      startDemoAnimation(grid);
    } else {
      // Fallback: random transitions
      startDemoFallback(grid);
    }
  } catch(e) {
    startDemoFallback(grid);
  }
}

function renderDemoGrid(grid, state) {
  grid.innerHTML = '';
  state.forEach(val => {
    const tile = document.createElement('div');
    tile.className = 'demo-tile' + (val === 0 ? ' empty' : '');
    tile.textContent = val === 0 ? '' : val;
    grid.appendChild(tile);
  });
}

function startDemoAnimation(grid) {
  clearInterval(demoTimer);
  demoTimer = setInterval(() => {
    demoCur++;
    if (demoCur >= demoPath.length) {
      demoCur = 0;
      // Pause then restart
      clearInterval(demoTimer);
      setTimeout(() => {
        demoState = [1,2,3,4,0,6,7,5,8]; // reset
        const r2 = window.AI_Algorithms.solve('astar', demoState, demoGoal);
        if (r2 && r2.path) { demoPath = r2.path; demoCur = 0; startDemoAnimation(grid); }
      }, 2000);
      return;
    }
    renderDemoGrid(grid, demoPath[demoCur]);
  }, 900);
}

function startDemoFallback(grid) {
  clearInterval(demoTimer);
  demoTimer = setInterval(() => {
    const succs = window.AI_Algorithms.getSuccessors(demoState);
    if (succs.length > 0) {
      demoState = succs[Math.floor(Math.random() * succs.length)].state;
      renderDemoGrid(grid, demoState);
    }
  }, 900);
}

/* ─────────────────────────────────────
   EXPORT
───────────────────────────────────── */
window.Puzzle = {
  isSolvable,
  generateSolvable,
  renderPuzzleGrid,
  animateMove,
  initDemoPuzzle,
  countInversions,
};
