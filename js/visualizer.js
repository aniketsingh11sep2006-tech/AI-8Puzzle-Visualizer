/**
 * visualizer.js
 * Manages the step-by-step playback of a found solution
 * and renders the Search Visualization tab content.
 */

'use strict';

/* ─────────────────────────────────────
   SIMPLE BAR CHART (No library needed)
───────────────────────────────────── */

/**
 * Draw a bar chart on a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {string[]} labels
 * @param {number[]} values
 * @param {string[]} colors
 * @param {object} options
 */
function drawBarChart(canvas, labels, values, colors, options = {}) {
  const ctx = canvas.getContext('2d');
  const { title = '', maxVal } = options;
  const W = canvas.width  = canvas.offsetWidth  || 400;
  const H = canvas.height = canvas.offsetHeight || 220;

  ctx.clearRect(0, 0, W, H);

  const padL = 55, padR = 20, padT = title ? 30 : 20, padB = 50;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const max = maxVal || Math.max(...values, 1);
  const barW = Math.max(8, chartW / labels.length * 0.55);
  const gap  = chartW / labels.length;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + chartH * (1 - i/4);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + chartW, y);
    ctx.stroke();

    // Y-axis label
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    const labelVal = Math.round(max * i/4);
    ctx.fillText(labelVal > 999 ? (labelVal/1000).toFixed(1)+'k' : labelVal, padL - 5, y + 4);
  }

  // Bars
  labels.forEach((label, i) => {
    const x  = padL + gap * i + gap/2 - barW/2;
    const h  = values[i] > 0 ? Math.max(2, (values[i] / max) * chartH) : 0;
    const y  = padT + chartH - h;

    // Bar gradient
    const grad = ctx.createLinearGradient(x, y, x, padT + chartH);
    grad.addColorStop(0, colors[i]);
    grad.addColorStop(1, colors[i] + '55');
    ctx.fillStyle = grad;
    // Rounded top
    ctx.beginPath();
    const r = Math.min(4, barW/2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + barW - r, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
    ctx.lineTo(x + barW, padT + chartH);
    ctx.lineTo(x, padT + chartH);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();

    // Value label on top
    ctx.fillStyle = 'rgba(241,245,249,0.85)';
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    if (values[i] > 0) {
      const dispVal = values[i] > 999 ? (values[i]/1000).toFixed(1)+'k' : values[i];
      ctx.fillText(dispVal, x + barW/2, y - 5);
    } else {
      ctx.fillStyle = 'rgba(148,163,184,0.5)';
      ctx.fillText('N/A', x + barW/2, padT + chartH - 5);
    }

    // X-axis label
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.font = '10px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + barW/2, padT + chartH + 18);
  });

  // Title
  if (title) {
    ctx.fillStyle = 'rgba(241,245,249,0.9)';
    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, W/2, 16);
  }
}

/* ─────────────────────────────────────
   LINE CHART for search growth
───────────────────────────────────── */

function drawLineChart(canvas, series, options = {}) {
  if (!canvas) return;
  const W = canvas.width  = canvas.offsetWidth  || 600;
  const H = canvas.height = canvas.offsetHeight || 280;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  const padL = 60, padR = 25, padT = 20, padB = 40;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const maxLen = Math.max(...series.map(s => s.data.length), 1);
  const maxVal = Math.max(...series.flatMap(s => s.data), 1);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + cH*(1 - i/4);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL+cW, y); ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    const v = Math.round(maxVal * i/4);
    ctx.fillText(v>999 ? (v/1000).toFixed(1)+'k' : v, padL-5, y+4);
  }

  // Series
  series.forEach(({ data, color, label }) => {
    if (!data || data.length === 0) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 6;
    ctx.shadowColor = color;
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = padL + (i / (maxLen-1||1)) * cW;
      const y = padT + cH * (1 - v/maxVal);
      i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
  });
}

/* ─────────────────────────────────────
   PLAYBACK STATE
───────────────────────────────────── */

const Playback = {
  path: [],
  currentStep: 0,
  isPlaying: false,
  intervalId: null,
  speed: 600,
  onStep: null,  // callback(step, state, totalSteps)
  onDone: null,  // callback()
};

function playbackSetSolution(path, onStep, onDone) {
  Playback.path        = path || [];
  Playback.currentStep = 0;
  Playback.isPlaying   = false;
  Playback.onStep      = onStep;
  Playback.onDone      = onDone;
  clearInterval(Playback.intervalId);
}

function playbackPlay() {
  if (Playback.isPlaying) return;
  if (Playback.currentStep >= Playback.path.length - 1) {
    Playback.currentStep = 0;
  }
  Playback.isPlaying = true;
  Playback.intervalId = setInterval(() => {
    if (Playback.currentStep >= Playback.path.length - 1) {
      playbackPause();
      if (Playback.onDone) Playback.onDone();
      return;
    }
    Playback.currentStep++;
    if (Playback.onStep) {
      Playback.onStep(Playback.currentStep, Playback.path[Playback.currentStep], Playback.path.length);
    }
  }, Playback.speed);
}

function playbackPause() {
  clearInterval(Playback.intervalId);
  Playback.isPlaying = false;
}

function playbackNext() {
  if (Playback.currentStep < Playback.path.length - 1) {
    Playback.currentStep++;
    if (Playback.onStep) {
      Playback.onStep(Playback.currentStep, Playback.path[Playback.currentStep], Playback.path.length);
    }
  }
}

function playbackPrev() {
  if (Playback.currentStep > 0) {
    Playback.currentStep--;
    if (Playback.onStep) {
      Playback.onStep(Playback.currentStep, Playback.path[Playback.currentStep], Playback.path.length);
    }
  }
}

function playbackReset() {
  playbackPause();
  Playback.currentStep = 0;
  if (Playback.onStep && Playback.path.length > 0) {
    Playback.onStep(0, Playback.path[0], Playback.path.length);
  }
}

/* ─────────────────────────────────────
   VISUALIZATION TAB — populate
───────────────────────────────────── */

let lastResult = null; // stores last solve result for viz tab

function updateVizTab(algorithm, heuristic, result) {
  lastResult = { algorithm, heuristic, result };
  const algoNames = { bfs:'BFS', dfs:'DFS', dls:'DLS', iddls:'IDDLS', gbfs:'GBFS', astar:'A*' };
  document.getElementById('vizAlgo').textContent       = algoNames[algorithm] || algorithm;
  document.getElementById('vizHeuristic').textContent  = ['gbfs','astar'].includes(algorithm) ? heuristic : '—';
  document.getElementById('vizGenerated').textContent  = result.nodesGenerated?.toLocaleString() ?? '—';
  document.getElementById('vizExplored').textContent   = result.nodesExplored?.toLocaleString()  ?? '—';
  document.getElementById('vizFrontier').textContent   = result.maxFrontier?.toLocaleString()    ?? '—';
  document.getElementById('vizSolution').textContent   = result.solution?.length ?? '—';

  // Build search chart data (simulated growth)
  const steps = Math.min(result.nodesExplored || 0, 200);
  const exploredData = [];
  const frontierData = [];
  for (let i = 0; i <= steps; i++) {
    exploredData.push(Math.round((result.nodesExplored || 0) * (i/steps)));
    frontierData.push(Math.round((result.maxFrontier   || 0) * Math.sin((Math.PI * i)/steps)));
  }

  const canvas = document.getElementById('searchChart');
  if (canvas) {
    setTimeout(() => {
      drawLineChart(canvas, [
        { data: exploredData, color: '#6366f1', label: 'Explored' },
        { data: frontierData, color: '#a78bfa', label: 'Frontier' },
      ]);
    }, 50);
  }

  // Node explorer
  const grid  = document.getElementById('nodeGrid');
  if (grid && result.path) {
    grid.innerHTML = '';
    const limit = Math.min(result.path.length, 50);
    for (let i = 0; i < limit; i++) {
      const s = result.path[i];
      const card = document.createElement('div');
      card.className = 'node-card';
      const ng = document.createElement('div');
      ng.className = 'node-card-grid';
      s.forEach(v => {
        const c = document.createElement('div');
        c.className = 'node-cell' + (v === 0 ? ' e' : '');
        c.textContent = v || '';
        ng.appendChild(c);
      });
      card.appendChild(ng);
      const idx = document.createElement('div');
      idx.className = 'node-idx';
      idx.textContent = `#${i+1}`;
      card.appendChild(idx);
      grid.appendChild(card);
    }
  }
}

/* ─────────────────────────────────────
   EXPORT
───────────────────────────────────── */
window.Visualizer = {
  drawBarChart,
  drawLineChart,
  playbackSetSolution,
  playbackPlay,
  playbackPause,
  playbackNext,
  playbackPrev,
  playbackReset,
  updateVizTab,
  Playback,
};
