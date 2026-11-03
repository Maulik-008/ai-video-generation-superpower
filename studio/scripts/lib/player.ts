import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import type { Browser, Page } from 'puppeteer-core';
import type { Timeline } from '../../src/types.ts';
import { CACHE_DIR, STUDIO_ROOT } from './paths.ts';

/** Bundle the three.js engine into a single script next to the HTML shell and return its file:// URL. */
export async function buildPlayer(): Promise<string> {
  const outDir = path.join(CACHE_DIR, 'player');
  fs.mkdirSync(outDir, { recursive: true });
  await esbuild.build({
    entryPoints: [path.join(STUDIO_ROOT, 'src', 'engine', 'main.ts')],
    bundle: true,
    format: 'iife',
    target: 'chrome110',
    outfile: path.join(outDir, 'player.js'),
    logLevel: 'warning',
  });
  fs.copyFileSync(path.join(STUDIO_ROOT, 'src', 'player', 'index.html'), path.join(outDir, 'index.html'));
  return pathToFileURL(path.join(outDir, 'index.html')).href;
}

export async function openPlayer(browser: Browser, url: string, tl: Timeline): Promise<{ page: Page; renderer: string }> {
  const page = await browser.newPage();
  await page.setViewport({ width: tl.width, height: tl.height, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('page error:', (e as Error).message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('browser:', m.text());
  });
  await page.goto(url);
  const info = await page.evaluate((t) => window.studio.init(t as never), tl as never);
  return { page, renderer: info.renderer };
}

export async function grabFrame(page: Page, frame: number, type: 'jpeg' | 'png'): Promise<Uint8Array> {
  await page.evaluate((f) => window.studio.renderFrame(f), frame);
  return page.screenshot(type === 'jpeg' ? { type: 'jpeg', quality: 93, optimizeForSpeed: true } : { type: 'png', optimizeForSpeed: true });
}
