import { parentPort, workerData } from 'node:worker_threads';
import type { GenConfig } from '../gen-config';
import { generateLevel, recomputeRow, type MetaRow, type RecomputeField } from './gen-level';

export type WorkerJob =
  | { kind: 'generate'; id: number }
  | { kind: 'recompute'; row: MetaRow; fields: RecomputeField[] };

export type WorkerReply = { ok: true; row: MetaRow } | { ok: false; id: number; error: string };

export interface WorkerInit {
  cfg: GenConfig;
}

// One job at a time: the main thread sends the next job after each reply.
if (parentPort) {
  const port = parentPort;
  const { cfg } = workerData as WorkerInit;
  port.on('message', (job: WorkerJob) => {
    const id = job.kind === 'generate' ? job.id : job.row.id;
    let reply: WorkerReply;
    try {
      const row = job.kind === 'generate' ? generateLevel(id, cfg) : recomputeRow(job.row, job.fields, cfg);
      reply = { ok: true, row };
    } catch (e) {
      reply = { ok: false, id, error: (e as Error).message };
    }
    port.postMessage(reply);
  });
}
