// Optional: downloads a private copy of Chrome for Testing into studio/.browsers (about 170 MB), for developers who do not want to
// depend on a Chrome or Edge installed on the machine. Run by the setup wizard only when that was chosen.
import path from 'node:path';
import { Browser, detectBrowserPlatform, install, resolveBuildId } from '@puppeteer/browsers';
import { STUDIO_ROOT } from './lib/paths.ts';

const platform = detectBrowserPlatform();
if (!platform) {
  console.error('This platform is not supported by the Chrome for Testing downloads. Install Chrome or Edge instead.');
  process.exit(2);
}
const cacheDir = path.join(STUDIO_ROOT, '.browsers');
console.log(`Resolving the latest stable Chrome for ${platform} ...`);
const buildId = await resolveBuildId(Browser.CHROME, platform, 'stable');
let last = -1;
const installed = await install({
  browser: Browser.CHROME,
  buildId,
  cacheDir,
  downloadProgressCallback: (done, total) => {
    const pct = total ? Math.floor((done / total) * 10) * 10 : 0;
    if (pct !== last) {
      last = pct;
      console.log(`  ${pct}%  (${(done / 1e6).toFixed(0)} of ${(total / 1e6).toFixed(0)} MB)`);
    }
  },
});
console.log(`EXECUTABLE ${installed.executablePath}`);
