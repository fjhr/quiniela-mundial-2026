// src/workers/montecarlo.worker.js
// Web Worker entry point — receives {N, gr, teams, koBracket} and posts back counts.

import { runSimulation } from '../services/montecarlo.js';

self.onmessage = function (e) {
  const { N, gr, teams, koBracket } = e.data;
  try {
    const counts = runSimulation(N, gr, teams, koBracket);
    self.postMessage({ ok: true, counts, N });
  } catch (err) {
    self.postMessage({ ok: false, error: err.message });
  }
};
