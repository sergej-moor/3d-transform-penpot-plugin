import { writable } from 'svelte/store';

interface Settings {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  canvas: HTMLCanvasElement | null;
  program: WebGLProgram | null;
}

const initialSettings: Settings = {
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  canvas: null,
  program: null,
};

export const settings = writable<Settings>(initialSettings);

export function setCanvas(canvas: HTMLCanvasElement): void {
  settings.update((state) => ({ ...state, canvas }));
}

export function setWebGLContext(
  canvas: HTMLCanvasElement,
  program: WebGLProgram
): void {
  settings.update((state) => ({ ...state, canvas, program }));
}
