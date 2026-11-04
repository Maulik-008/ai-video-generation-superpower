// The developer's setup choices, written by `setup.mjs` (or the setup-video-studio skill) to studio/.studio-setup.json.
// Everything has a sensible default, so a repo that was never set up still works exactly as before. Environment variables win over the file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { STUDIO_ROOT } from './paths.ts';

export type StudioConfig = {
  version?: number;
  packageManager?: 'npm' | 'pnpm' | 'yarn';
  ffmpeg?: { mode?: 'bundled' | 'system' | 'custom'; path?: string };
  browser?: { mode?: 'system' | 'private' | 'custom'; path?: string };
  voices?: { dir?: string; python?: string; kokoro?: boolean; chatterbox?: boolean; speechCheck?: boolean };
  outputDir?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const CONFIG_PATH = path.join(STUDIO_ROOT, '.studio-setup.json');

let cached: StudioConfig | undefined;
export function loadConfig(): StudioConfig {
  if (cached) return cached;
  try {
    cached = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as StudioConfig;
  } catch {
    cached = {};
  }
  return cached;
}

/** Where the Python environments (.venv-*) and the models (.models) live. Default: inside studio/. */
export function voiceHome(): string {
  return path.resolve(process.env.VIDEO_STUDIO_VOICE_DIR || loadConfig().voices?.dir || STUDIO_ROOT);
}

/** Where finished videos are copied. Default: the Videos folder, as before. */
export function outputRoot(): string {
  return path.resolve(process.env.VIDEO_STUDIO_OUTPUT_DIR || loadConfig().outputDir || path.join(os.homedir(), 'Videos', 'VideoStudio'));
}

/** The speech check (Whisper) that makes Chatterbox listen to its own output. On unless switched off in setup or by environment. */
export function speechCheckEnabled(): boolean {
  if (process.env.VIDEO_STUDIO_NO_VERIFY === '1') return false;
  return loadConfig().voices?.speechCheck !== false;
}
