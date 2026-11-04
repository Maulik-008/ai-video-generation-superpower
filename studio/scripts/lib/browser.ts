import fs from 'node:fs';
import puppeteer, { type Browser } from 'puppeteer-core';
import { loadConfig } from './config.ts';

/** Any installed Chromium-based browser works. Set CHROME_PATH to override. */
export function findBrowser(): string {
  const env = process.env.CHROME_PATH;
  if (env && fs.existsSync(env)) return env;
  const chosen = loadConfig().browser?.path; // set by setup: a private Chrome download or a custom path
  if (chosen && fs.existsSync(chosen)) return chosen;
  const local = process.env.LOCALAPPDATA ?? '';
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          `${local}\\Google\\Chrome\\Application\\chrome.exe`,
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        ]
      : process.platform === 'darwin'
        ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
        : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('No Chrome/Edge found. Install Google Chrome or set CHROME_PATH to a Chromium-based browser.');
  return found;
}

export async function launch(software = false): Promise<Browser> {
  const args = [
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--hide-scrollbars',
    '--mute-audio',
    '--force-color-profile=srgb',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
  ];
  if (software) args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  return puppeteer.launch({ executablePath: findBrowser(), headless: true, args, defaultViewport: null, protocolTimeout: 120_000 });
}
