/**
 * algorithms.js
 * All 6 AI search algorithm implementations for the 8-Puzzle.
 *
 * Each solver returns:
 *   { solution: [...moves], path: [[state],…], nodesExplored, time, maxFrontier, nodesGenerated }
 *   or null if no solution found.
 *
 * A "state" is a flat array of 9 numbers, 0 = blank.
 * A "move" is one of: 'U','D','L','R' (direction blank tile moves).
 */

'use strict';

/* ═══════════════════════════════════════
   HELPERS
═══════════════════════════════════════ */

const GOAL_DEFAULT = [1,2,3,4,5,6,7,8,0];

/** Flat index → [row, col] */
function idxToRC(i) { return [Math.floor(i/3), i%3]; }

/** [row,col] → flat index */
function rcToIdx(r,c) { return r*3+c; }

/** Clone a state array */
function cloneState(s) { return s.slice(); }

/** Stringify state for Set membership */
function key(s) { return s.join(','); }

/**
 * Generate successor states.
 * Returns array of { state, move } where move is 'U'|'D'|'L'|'R'.
 * Move describes which direction the BLANK shifts.
 */
function getSuccessors(state) {
  const blankIdx = state.indexOf(0);
  const [br, bc] = idxToRC(blankIdx);
  const dirs = [
    { dr: -1, dc: 0, move: 'U' },
    { dr:  1, dc: 0, move: 'D' },
    { dr:  0, dc:-1, move: 'L' },
    { dr:  0, dc: 1, move: 'R' },
  ];
  const result = [];
  for (const { dr, dc, move } of dirs) {
    const nr = br + dr, nc = bc + dc;
    if (nr < 0 || nr > 2 || nc < 0 || nc > 2) continue;
    const newState = cloneState(state);
    const swapIdx = rcToIdx(nr, nc);
    [newState[blankIdx], newState[swapIdx]] = [newState[swapIdx], newState[blankIdx]];
    result.push({ state: newState, move });
  }
  return result;
}

/** Reconstruct solution path from parent map */
function reconstructPath(parentMap, goalKey, startKey) {
  const path = [];
  const moves = [];
  let cur = goalKey;
  while (cur !== startKey) {
    const { state, move } = parentMap[cur];
    path.unshift(state);
    moves.unshift(move);
    cur = key(state);
    // Guard against cycles in parent map
    if (path.length > 200) break;
  }
  // Add initial state
  const startState = parentMap[startKey] ? parentMap[startKey].state : null;
  return { moves, path };
}

/* ═══════════════════════════════════════
   HEURISTICS
═══════════════════════════════════════ */

/**
 * Manhattan Distance heuristic.
 * @param {number[]} state
 * @param {number[]} goal
 */
function manhattanDistance(state, goal) {
  let dist = 0;
  const goalPos = {};
  for (let i = 0; i < 9; i++) {
    if (goal[i] !== 0) goalPos[goal[i]] = idxToRC(i);
  }
  for (let i = 0; i < 9; i++) {
    const v = state[i];
    if (v === 0) continue;
    if (!goalPos[v]) continue;
    const [gr, gc] = goalPos[v];
    const [cr, cc] = idxToRC(i);
    dist += Math.abs(cr - gr) + Math.abs(cc - gc);
  }
  return dist;
}

/**
 * Misplaced Tiles heuristic.
 * @param {number[]} state
 * @param {number[]} goal
 */
function misplacedTiles(state, goal) {
  let count = 0;
  for (let i = 0; i < 9; i++) {
    if (state[i] !== 0 && state[i] !== goal[i]) count++;
  }
  return count;
}

function getHeuristic(heuristicName) {
  return heuristicName === 'misplaced' ? misplacedTiles : manhattanDistance;
}

/* ═══════════════════════════════════════
   BFS — Breadth-First Search
═══════════════════════════════════════ */
function solveBFS(initial, goal) {
  const t0 = performance.now();
  const startKey = key(initial);
  const goalKey  = key(goal);
  if (startKey === goalKey) return { solution:[], path:[initial], nodesExplored:0, time:0, maxFrontier:1, nodesGenerated:1 };

  const visited  = new Set([startKey]);
  const parent   = {}; // key → { state (parent state), move }
  const queue    = [initial];
  let nodesExplored = 0;
  let maxFrontier = 1;
  let nodesGenerated = 1;

  // Store the path nodes (state at each key)
  const stateAt = { [startKey]: initial };

  while (queue.length > 0) {
    const current = queue.shift();
    nodesExplored++;
    const curKey = key(current);

    for (const { state: next, move } of getSuccessors(current)) {
      nodesGenerated++;
      const nk = key(next);
      if (visited.has(nk)) continue;
      visited.add(nk);
      parent[nk] = { state: current, move };
      stateAt[nk] = next;
      queue.push(next);
      maxFrontier = Math.max(maxFrontier, queue.length);

      if (nk === goalKey) {
        // Reconstruct
        const { moves, path } = buildPath(parent, stateAt, nk, startKey, initial);
        return { solution: moves, path, nodesExplored, time: performance.now()-t0, maxFrontier, nodesGenerated };
      }
    }
    if (performance.now() - t0 > 8000) return null; // timeout guard
  }
  return null;
}

/* ═══════════════════════════════════════
   DFS — Depth-First Search (with cycle detection)
═══════════════════════════════════════ */
function solveDFS(initial, goal, maxDepth = 80) {
  const t0 = performance.now();
  const startKey = key(initial);
  const goalKey  = key(goal);
  if (startKey === goalKey) return { solution:[], path:[initial], nodesExplored:0, time:0, maxFrontier:1, nodesGenerated:1 };

  const stack = [{ state: initial, depth: 0, moves: [], path: [initial] }];
  const visited = new Set();
  let nodesExplored = 0;
  let maxFrontier = 1;
  let nodesGenerated = 1;

  while (stack.length > 0) {
    const { state, depth, moves, path } = stack.pop();
    const curKey = key(state);

    if (visited.has(curKey)) continue;
    visited.add(curKey);
    nodesExplored++;

    if (curKey === goalKey) {
      return { solution: moves, path, nodesExplored, time: performance.now()-t0, maxFrontier, nodesGenerated };
    }
    if (depth >= maxDepth) continue;

    const succs = getSuccessors(state);
    for (const { state: next, move } of succs) {
      nodesGenerated++;
      const nk = key(next);
      if (!visited.has(nk)) {
        stack.push({ state: next, depth: depth+1, moves: [...moves, move], path: [...path, next] });
        maxFrontier = Math.max(maxFrontier, stack.length);
      }
    }
    if (performance.now()-t0 > 8000) return null;
  }
  return null;
}

/* ═══════════════════════════════════════
   DLS — Depth-Limited Search
═══════════════════════════════════════ */
function solveDLS(initial, goal, limit) {
  const t0 = performance.now();
  let nodesExplored = 0;
  let maxFrontier = 1;
  let nodesGenerated = 1;
  const goalKey = key(goal);

  function dls(state, depth, moves, pathSoFar, visited) {
    nodesExplored++;
    const curKey = key(state);
    if (curKey === goalKey) return { moves, path: pathSoFar };
    if (depth === 0) return 'cutoff';
    if (performance.now() - t0 > 8000) return 'timeout';

    let cutoffOccurred = false;
    for (const { state: next, move } of getSuccessors(state)) {
      nodesGenerated++;
      const nk = key(next);
      if (visited.has(nk)) continue;
      visited.add(nk);
      maxFrontier = Math.max(maxFrontier, 1);
      const result = dls(next, depth-1, [...moves, move], [...pathSoFar, next], visited);
      visited.delete(nk);
      if (result === 'cutoff') { cutoffOccurred = true; continue; }
      if (result === 'timeout') return 'timeout';
      if (result !== null) return result;
    }
    return cutoffOccurred ? 'cutoff' : null;
  }

  const visited = new Set([key(initial)]);
  const result  = dls(initial, limit, [], [initial], visited);
  const time    = performance.now() - t0;
  if (!result || result === 'cutoff' || result === 'timeout') return null;
  return { ...result, nodesExplored, time, maxFrontier, nodesGenerated };
}

/* ═══════════════════════════════════════
   IDDLS — Iterative Deepening DLS
═══════════════════════════════════════ */
function solveIDDLS(initial, goal) {
  const t0 = performance.now();
  let totalNodes = 0;
  let totalGenerated = 0;
  let maxFrontier = 1;
  const goalKey = key(goal);

  function dls(state, depth, moves, pathSoFar, visited) {
    totalNodes++;
    const curKey = key(state);
    if (curKey === goalKey) return { moves, path: pathSoFar };
    if (depth === 0) return 'cutoff';
    if (performance.now()-t0 > 10000) return 'timeout';

    let cutoff = false;
    for (const { state: next, move } of getSuccessors(state)) {
      totalGenerated++;
      const nk = key(next);
      if (visited.has(nk)) continue;
      visited.add(nk);
      const res = dls(next, depth-1, [...moves, move], [...pathSoFar, next], visited);
      visited.delete(nk);
      if (res === 'cutoff') { cutoff = true; continue; }
      if (res === 'timeout') return 'timeout';
      if (res) return res;
    }
    return cutoff ? 'cutoff' : null;
  }

  for (let limit = 0; limit <= 50; limit++) {
    const visited = new Set([key(initial)]);
    const res = dls(initial, limit, [], [initial], visited);
    if (res && res !== 'cutoff' && res !== 'timeout') {
      return { ...res, nodesExplored: totalNodes, time: performance.now()-t0, maxFrontier, nodesGenerated: totalGenerated };
    }
    if (res === 'timeout') return null;
  }
  return null;
}

/* ═══════════════════════════════════════
   GBFS — Greedy Best-First Search
═══════════════════════════════════════ */
function solveGBFS(initial, goal, heuristicName = 'manhattan') {
  const t0 = performance.now();
  const h = getHeuristic(heuristicName);
  const startKey = key(initial);
  const goalKey  = key(goal);
  if (startKey === goalKey) return { solution:[], path:[initial], nodesExplored:0, time:0, maxFrontier:1, nodesGenerated:1 };

  // Min-heap via sorted array (small enough for 8-puzzle)
  const open = [{ state: initial, g:0, f: h(initial, goal) }];
  const visited = new Set([startKey]);
  const parent  = {};
  const stateAt = { [startKey]: initial };
  let nodesExplored = 0;
  let maxFrontier = 1;
  let nodesGenerated = 1;

  while (open.length > 0) {
    open.sort((a,b) => a.f - b.f); // GBFS: only h(n)
    const { state, g } = open.shift();
    nodesExplored++;
    const curKey = key(state);

    if (curKey === goalKey) {
      const { moves, path } = buildPath(parent, stateAt, curKey, startKey, initial);
      return { solution: moves, path, nodesExplored, time: performance.now()-t0, maxFrontier, nodesGenerated };
    }

    for (const { state: next, move } of getSuccessors(state)) {
      nodesGenerated++;
      const nk = key(next);
      if (visited.has(nk)) continue;
      visited.add(nk);
      parent[nk]  = { state, move };
      stateAt[nk] = next;
      open.push({ state: next, g: g+1, f: h(next, goal) });
      maxFrontier = Math.max(maxFrontier, open.length);
    }
    if (performance.now()-t0 > 8000) return null;
  }
  return null;
}

/* ═══════════════════════════════════════
   A* — A* Search
═══════════════════════════════════════ */
function solveAstar(initial, goal, heuristicName = 'manhattan') {
  const t0 = performance.now();
  const h = getHeuristic(heuristicName);
  const startKey = key(initial);
  const goalKey  = key(goal);
  if (startKey === goalKey) return { solution:[], path:[initial], nodesExplored:0, time:0, maxFrontier:1, nodesGenerated:1 };

  const open = [{ state: initial, g:0, f: h(initial, goal) }];
  const gScore = { [startKey]: 0 };
  const parent = {};
  const stateAt = { [startKey]: initial };
  const closed = new Set();
  let nodesExplored = 0;
  let maxFrontier = 1;
  let nodesGenerated = 1;

  while (open.length > 0) {
    open.sort((a,b) => a.f - b.f);
    const { state, g } = open.shift();
    nodesExplored++;
    const curKey = key(state);
    if (closed.has(curKey)) continue;
    closed.add(curKey);

    if (curKey === goalKey) {
      const { moves, path } = buildPath(parent, stateAt, curKey, startKey, initial);
      return { solution: moves, path, nodesExplored, time: performance.now()-t0, maxFrontier, nodesGenerated };
    }

    for (const { state: next, move } of getSuccessors(state)) {
      nodesGenerated++;
      const nk = key(next);
      if (closed.has(nk)) continue;
      const ng = g + 1;
      if (gScore[nk] !== undefined && ng >= gScore[nk]) continue;
      gScore[nk] = ng;
      parent[nk]  = { state, move };
      stateAt[nk] = next;
      open.push({ state: next, g: ng, f: ng + h(next, goal) });
      maxFrontier = Math.max(maxFrontier, open.length);
    }
    if (performance.now()-t0 > 8000) return null;
  }
  return null;
}

/* ═══════════════════════════════════════
   PATH BUILDER (for BFS/GBFS/A*)
═══════════════════════════════════════ */
function buildPath(parent, stateAt, goalKey, startKey, initialState) {
  const moves = [];
  const states = [];
  let cur = goalKey;
  const limit = 500;
  let iter = 0;
  while (cur !== startKey && iter++ < limit) {
    if (!parent[cur]) break;
    const { state: parentState, move } = parent[cur];
    moves.unshift(move);
    states.unshift(stateAt[cur]);
    cur = key(parentState);
  }
  return { moves, path: [initialState, ...states] };
}

/* ═══════════════════════════════════════
   UNIFIED SOLVER INTERFACE
═══════════════════════════════════════ */
window.AI_Algorithms = {
  solve(algorithm, initial, goal, options = {}) {
    const { heuristic = 'manhattan', depthLimit = 30 } = options;
    switch (algorithm) {
      case 'bfs':   return solveBFS(initial, goal);
      case 'dfs':   return solveDFS(initial, goal);
      case 'dls':   return solveDLS(initial, goal, depthLimit);
      case 'iddls': return solveIDDLS(initial, goal);
      case 'gbfs':  return solveGBFS(initial, goal, heuristic);
      case 'astar': return solveAstar(initial, goal, heuristic);
      default: throw new Error(`Unknown algorithm: ${algorithm}`);
    }
  },

  heuristics: { manhattanDistance, misplacedTiles },
  getSuccessors,
  key,
};
