import { writable, get } from 'svelte/store';
import type { Fill } from '@penpot/plugin-types';
import { processImage } from '../utils/imageProcessing';
import type { SelectionState } from '../types';
import { transformImageData } from '../utils/webgl';

const initialState: SelectionState = {
  id: '',
  name: '',
  fills: [],
  isLoading: false,
  isPixelizing: false,
  isUploadingFill: false,
  isPreviewLoading: false,
  pixelSize: 1,
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
  }));
}

export async function updatePreview(rotation: {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
}): Promise<void> {
  const state = get(selection);
  if (!state.originalImage || !state.name || !state.fills || !state.id) return;

  try {
    selection.update((state) => ({
      ...state,
      isPreviewLoading: true,
      previewImage: undefined,
    }));

    const transformed = await transformImageData(
      new Uint8Array(state.originalImage.data),
      state.originalImage.width,
      state.originalImage.height,
      rotation.rotateX,
      rotation.rotateY,
      rotation.rotateZ
    );

    selection.update((state) => ({
      ...state,
      isPreviewLoading: false,
      previewImage: {
        width: transformed.width,
        height: transformed.height,
        data: Array.from(transformed.data),
      },
    }));
  } catch (error) {
    console.error('Failed to update preview:', error);
    selection.update((state) => ({
      ...state,
      isPreviewLoading: false,
      previewImage: undefined,
    }));
  }
}

export async function transformImage(
  rotation: { rotateX: number; rotateY: number; rotateZ: number },
  addNewLayer: boolean
): Promise<void> {
  const state = get(selection);
  if (!state.originalImage || !state.fills?.length || !state.name) return;

  try {
    selection.update((state) => ({ ...state, isTransforming: true }));

    const transformed = await transformImageData(
      new Uint8Array(state.originalImage.data),
      state.originalImage.width,
      state.originalImage.height,
      rotation.rotateX,
      rotation.rotateY,
      rotation.rotateZ
    );

    // Check if we still have a selection
    const currentState = get(selection);
    if (!currentState.name || !currentState.fills) {
      return;
    }

    selection.update((state) => ({ ...state, isUploadingFill: true }));

    window.parent.postMessage(
      {
        type: 'update-image-fill',
        imageData: transformed.data,
        fillIndex: 0,
        originalFill: state.fills[state.fills.length - 1],
        shouldDeleteFirst: !addNewLayer && state.fills.length >= 2,
        addNewLayer,
      },
      '*'
    );

    selection.update((state) => ({
      ...state,
      isTransforming: false,
      exportedImage: {
        width: transformed.width,
        height: transformed.height,
        data: Array.from(transformed.data),
      },
    }));
  } catch (error) {
    console.error('Failed to transform image:', error);
    selection.update((state) => ({ ...state, isTransforming: false }));
  }
}

export async function pixelateImage(
  pixelSize: number,
  addNewLayer: boolean
): Promise<void> {
  const state = get(selection);
  if (!state.originalImage || !state.fills?.length || !state.name) return;

  try {
    selection.update((state) => ({ ...state, isPixelizing: true }));

    const processed = await processImage(
      new Uint8Array(state.originalImage.data),
      state.originalImage.width,
      state.originalImage.height,
      pixelSize
    );

    // Check if we still have a selection before continuing
    const currentState = get(selection);
    if (!currentState.name || !currentState.fills) {
      return;
    }

    selection.update((state) => ({ ...state, isUploadingFill: true }));

    // Send the processed image to be uploaded
    const message = {
      type: 'update-image-fill' as const,
      imageData: processed.data,
      fillIndex: 0,
      originalFill: state.fills[state.fills.length - 1],
      shouldDeleteFirst: !addNewLayer && state.fills.length >= 2,
      addNewLayer,
    };
    window.parent.postMessage(message, '*');

    // Update the preview with the processed image
    selection.update((state) => ({
      ...state,
      pixelSize,
      isPixelizing: false,
      exportedImage: {
        width: state.originalImage!.width,
        height: state.originalImage!.height,
        data: Array.from(processed.data),
      },
    }));
  } catch (error) {
    console.error('Failed to pixelate image:', error);
    selection.update((state) => ({ ...state, isPixelizing: false }));
  }
}

export function updateExportedImage(
  imageData: number[],
  width: number,
  height: number,
  selectionId: string
): void {
  try {
    selection.update((state) => {
      // Only update if we still have the same selection
      if (!state.name || !state.fills || state.id !== selectionId) {
        return state;
      }

      return {
        ...state,
        isLoading: false,
        originalImage: {
          data: imageData,
          width,
          height,
        },
        exportedImage: {
          data: imageData,
          width,
          height,
        },
      };
    });
  } catch (error) {
    console.error('Failed to update exported image:', error);
    selection.update((state) => ({
      ...state,
      isLoading: false,
      error:
        'Failed to process image. Please try again with a different selection.',
    }));
  }
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

    // Store the actual pixel data
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
    }));

    // Clean up
    URL.revokeObjectURL(url);
  };

  img.onerror = (error) => {
    console.error('Failed to load image data:', error);
    URL.revokeObjectURL(url);
  };

  img.src = url;
}
