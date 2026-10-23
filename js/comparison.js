/**
 * comparison.js
 * Runs all 6 algorithms on the current puzzle and populates
 * the comparison table + bar charts.
 */

'use strict';

const ALGO_LIST = [
  { id: 'bfs',   label: 'BFS',   optimal: true,  complete: true  },
  { id: 'dfs',   label: 'DFS',   optimal: false, complete: false },
  { id: 'dls',   label: 'DLS',   optimal: false, complete: null  },
  { id: 'iddls', label: 'IDDLS', optimal: true,  complete: true  },
  { id: 'gbfs',  label: 'GBFS',  optimal: false, complete: null  },
  { id: 'astar', label: 'A*',    optimal: true,  complete: true  },
];

const ALGO_COLORS = {
  bfs:   '#3b82f6',
  dfs:   '#8b5cf6',
  dls:   '#f59e0b',
  iddls: '#f97316',
  gbfs:  '#10b981',
  astar: '#ec4899',
};

async function runComparison(initial, goal, heuristic = 'manhattan') {
  const results = [];
  for (const algo of ALGO_LIST) {
    await new Promise(resolve => setTimeout(resolve, 0)); // yield to UI
    let res = null;
    try {
      res = window.AI_Algorithms.solve(algo.id, initial, goal, {
        heuristic,
        depthLimit: 30,
      });
    } catch (e) {
      res = null;
    }
    results.push({ ...algo, res });
  }
  return results;
}

function populateCompTable(results) {
  const tbody = document.getElementById('compTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Find bests
  const nodes   = results.map(r => r.res?.nodesExplored ?? Infinity);
  const lengths = results.map(r => r.res?.solution?.length ?? Infinity);
  const times   = results.map(r => r.res?.time ?? Infinity);
  const minNodes  = Math.min(...nodes.filter(v => v < Infinity));
  const minLength = Math.min(...lengths.filter(v => v < Infinity));
  const minTime   = Math.min(...times.filter(v => v < Infinity));

  results.forEach(({ label, optimal, complete, res }) => {
    const tr = document.createElement('tr');
    const nodesVal  = res?.nodesExplored ?? null;
    const lenVal    = res?.solution?.length ?? null;
    const timeVal   = res?.time ?? null;
    const memVal    = res?.maxFrontier ?? null;

    const bestNode = nodesVal === minNodes ? ' best' : '';
    const bestLen  = lenVal   === minLength ? ' best' : '';
    const bestTime = timeVal  === minTime   ? ' best' : '';

    const formatOpt = v => v === true ? '<span class="yes-badge">✓ Yes</span>' : v === false ? '<span class="no-badge">✗ No</span>' : '<span class="yes-badge">~ Cond.</span>';
    const compBadge = complete === true ? '<span class="yes-badge">✓ Yes</span>' : complete === false ? '<span class="no-badge">✗ No</span>' : '<span class="yes-badge">~ Cond.</span>';

    tr.innerHTML = `
      <td class="algo-name">${label}</td>
      <td class="${bestNode}">${nodesVal !== null ? nodesVal.toLocaleString() : '<span style="color:var(--text-muted)">No solution</span>'}</td>
      <td class="${bestLen}">${lenVal !== null ? lenVal : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="${bestTime}">${timeVal !== null ? timeVal.toFixed(2) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>${memVal !== null ? memVal.toLocaleString() : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>${formatOpt(optimal)}</td>
      <td>${compBadge}</td>
    `;
    tbody.appendChild(tr);
  });
}

function populateCompCharts(results) {
  const labels = results.map(r => r.label);
  const colors = results.map(r => ALGO_COLORS[r.id]);

  const nodesData  = results.map(r => r.res?.nodesExplored ?? 0);
  const lenData    = results.map(r => r.res?.solution?.length ?? 0);
  const timeData   = results.map(r => r.res ? parseFloat(r.res.time.toFixed(2)) : 0);

  const nodesCanvas = document.getElementById('compNodesChart');
  const lenCanvas   = document.getElementById('compLenChart');
  const timeCanvas  = document.getElementById('compTimeChart');

  if (nodesCanvas) {
    nodesCanvas.width = nodesCanvas.offsetWidth || 300;
    nodesCanvas.height = 220;
    window.Visualizer.drawBarChart(nodesCanvas, labels, nodesData, colors, { title: '' });
  }
  if (lenCanvas) {
    lenCanvas.width = lenCanvas.offsetWidth || 300;
    lenCanvas.height = 220;
    window.Visualizer.drawBarChart(lenCanvas, labels, lenData, colors, { title: '' });
  }
  if (timeCanvas) {
    timeCanvas.width = timeCanvas.offsetWidth || 300;
    timeCanvas.height = 220;
    window.Visualizer.drawBarChart(timeCanvas, labels, timeData, colors, { title: '' });
  }
}

window.Comparison = {
  runComparison,
  populateCompTable,
  populateCompCharts,
  ALGO_COLORS,
};
