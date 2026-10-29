// Runtime state written by run-all.mjs (ports, origins, DB, generated JWT secret, seed ids) and read by every flow.
import fs from 'node:fs';

const statePath = process.env.NINJA_IT_STATE;
if (!statePath) throw new Error('NINJA_IT_STATE is not set: flows are started by integration/run-all.mjs');

/** @type {{ feOrigin: string, apiOrigin: string, cdpPort: number, psql: string, pg: { host: string, port: number, user: string, db: string }, jwtSecret: string, logDir: string, ids: Record<string, string>, seed: Record<string, string> }} */
export const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
export const ORIGIN = state.feOrigin;
export const API = state.apiOrigin;
