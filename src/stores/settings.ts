import { writable } from 'svelte/store';

interface Settings {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
}

const initialSettings: Settings = {
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
};

export const settings = writable<Settings>(initialSettings);
