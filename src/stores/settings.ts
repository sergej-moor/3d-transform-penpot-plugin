import { writable } from 'svelte/store';

interface Settings {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  canvas: HTMLCanvasElement | null;
}

const initialSettings: Settings = {
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  canvas: null,
};

export const settings = writable<Settings>(initialSettings);

export function setCanvas(canvas: HTMLCanvasElement): void {
  settings.update((state) => ({ ...state, canvas }));
}
