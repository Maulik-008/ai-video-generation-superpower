import type { Timeline } from '../types';
import { World } from './world';

declare global {
  interface Window {
    studio: {
      init(tl: Timeline): { renderer: string };
      renderFrame(frame: number): void;
    };
  }
}

let world: World | undefined;

window.studio = {
  init(tl) {
    const root = document.getElementById('root')!;
    root.style.width = `${tl.width}px`;
    root.style.height = `${tl.height}px`;
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    const dom = {
      cap: document.getElementById('cap')!,
      ovl: document.getElementById('ovl')!,
      fade: document.getElementById('fade')!,
    };
    world = new World(canvas, tl, dom);
    const gl = world.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    return { renderer: name };
  },
  renderFrame(frame) {
    if (!world) throw new Error('studio.init() was not called');
    world.renderFrame(frame);
  },
};
