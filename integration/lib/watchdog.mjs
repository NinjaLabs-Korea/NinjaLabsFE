// Detached watchdog: polls the harness pid and, if it dies without having removed its temp dir (SIGKILL, tool timeout),
// runs the same teardown as `--reap`. Exits quietly once the dir is gone or the harness cleaned up after itself.
// usage: node watchdog.mjs <harnessPid> <tmpDir> [keep]
import fs from 'node:fs';
import { alive, stopServices } from './reaper.mjs';

const [pidArg, dir, keep] = process.argv.slice(2);
const harnessPid = Number(pidArg);
if (!harnessPid || !dir) process.exit(2);

const timer = setInterval(() => {
  if (!fs.existsSync(dir)) process.exit(0);
  if (alive(harnessPid)) return;
  clearInterval(timer);
  // Give a harness that is exiting normally a moment to finish its own cleanup first.
  setTimeout(() => {
    if (keep !== '1' && fs.existsSync(dir)) {
      stopServices(dir);
      fs.rmSync(dir, { recursive: true, force: true });
    } else if (fs.existsSync(dir)) stopServices(dir);
    process.exit(0);
  }, 3000);
}, 1000);
