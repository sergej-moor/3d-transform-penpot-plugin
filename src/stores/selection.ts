import { writable, get } from 'svelte/store';
import type { Fill } from '@penpot/plugin-types';

import type { SelectionState } from '../types';

const initialState: SelectionState = {
  id: '',
  name: '',
  fills: [],
  isLoading: false,
  isPixelizing: false,
  isUploadingFill: false,
  isPreviewLoading: false,

  error: undefined,
  isTransforming: false,
};

export const selection = writable<SelectionState>(initialState);

export function updateSelection(
  shapes: { id: string; name: string; fills: Fill[] | 'mixed' } | null
): void {
  // If no shapes or shapes is null, reset to initial state
  if (!shapes) {
    selection.set(initialState);
    return;
  }

  // Use Penpot's ID directly
  selection.update(() => ({
    ...initialState,
    id: shapes.id,
    name: shapes.name,
    fills: shapes.fills,
    isPreviewLoading: Array.isArray(shapes.fills) && shapes.fills.length > 0,
  }));
}

export function setUploadingFill(isUploading: boolean): void {
  selection.update((state) => {
    // Only update if we still have a selection
    if (!state.name || !state.fills) {
      return initialState;
    }
    return {
      ...state,
      isUploadingFill: isUploading,
    };
  });
}

export function setLoading(isLoading: boolean): void {
  selection.update((state) => {
    // If setting to false and we don't have a selection, reset to initial state
    if (!isLoading && (!state.name || !state.fills)) {
      return initialState;
    }
    return {
      ...state,
      isLoading,
    };
  });
}

export function handleLoadedImage(
  imageData: Uint8Array,
  width: number,
  height: number
): void {
  // Set preview loading to true at the start
  selection.update((state) => ({ ...state, isPreviewLoading: true }));

  // Create a blob from the image data
  const blob = new Blob([imageData], { type: 'image/png' });
  const url = URL.createObjectURL(blob);

  // Load the image
  const img = new Image();
  img.onload = () => {
    // Create a canvas to extract the pixel data
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error('Failed to get 2D context');
      return;
    }

    // Draw the image to get pixel data
    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    // Create a properly sized RGBA array
    const rgbaData = new Uint8Array(width * height * 4);
    for (let i = 0; i < imageData.data.length; i += 4) {
      rgbaData[i] = imageData.data[i]; // R
      rgbaData[i + 1] = imageData.data[i + 1]; // G
      rgbaData[i + 2] = imageData.data[i + 2]; // B
      rgbaData[i + 3] = imageData.data[i + 3]; // A
    }

    /*     console.log('Image data loaded:', {
      width,
      height,
      dataLength: rgbaData.length,
      expectedLength: width * height * 4,
      samplePixels: Array.from(rgbaData.slice(0, 16)),
    }); */

    // Update state and set isPreviewLoading to false when done
    selection.update((state) => ({
      ...state,
      originalImage: {
        data: Array.from(rgbaData),
        width,
        height,
      },
      previewImage: {
        data: Array.from(rgbaData),
        width,
        height,
      },
      isLoading: false,
      isPreviewLoading: false,
    }));

    // Clean up
    URL.revokeObjectURL(url);
  };

  img.onerror = (error) => {
    console.error('Failed to load image data:', error);
    selection.update((state) => ({ ...state, isPreviewLoading: false }));
    URL.revokeObjectURL(url);
  };

  img.src = url;
}

export function setPreviewContext(
  canvas: HTMLCanvasElement | null,
  gl: WebGLRenderingContext | null = null,
  program: WebGLProgram | null = null
): void {
  selection.update((state) => ({
    ...state,
    canvas,
    gl,
    program,
  }));
}

export function setPreviewCanvas(canvas: HTMLCanvasElement | null): void {
  selection.update((state) => ({
    ...state,
    canvas,
  }));
}
