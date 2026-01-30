import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';

import { startWorker } from './workers/worker.js'


if (cluster.isPrimary) {
  const cpus = availableParallelism();
  console.log(`Primary ${process.pid} active, fork ${cpus} workers`)
  for (let i = 0; i < cpus; i++) {
    cluster.fork();
  }
  console.log(`Primary ${process.pid} active...`);
} else {
    startWorker();
} 

