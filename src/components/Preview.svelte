<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { selection } from '../stores/selection';
  import { settings, setCanvas, setWebGLContext } from '../stores/settings';
  import { LOADING_MESSAGES } from '../constants';
  import LoadingSpinner from './LoadingSpinner.svelte';
  import { initWebGL, drawScene } from '../utils/webgl';
  import type { SelectionState } from '../types';

  let canvasElement: HTMLCanvasElement;
  let gl: WebGLRenderingContext | null = null;
  let program: WebGLProgram | null = null;

  // Computed properties
  $: displayName = formatDisplayName($selection.name);
  $: loadingMessage = getLoadingMessage($selection);
  $: isLoading =
    $selection.isPreviewLoading ||
    $selection.isPixelizing ||
    $selection.isUploadingFill;

  // Watch for selection or rotation changes
  $: if (gl && program && $selection.previewImage) {
    drawScene(
      gl,
      program,
      $selection.previewImage.data,
      $selection.previewImage.width,
      $selection.previewImage.height,
      $settings.rotateX,
      $settings.rotateY,
      $settings.rotateZ
    );
  }

  onMount(() => {
    if (!canvasElement) return;

    const result = initWebGL(canvasElement);
    if (!result) {
      console.error('Failed to initialize WebGL');
      return;
    }

    gl = result.gl;
    program = result.program;
    setWebGLContext(canvasElement, program);
  });

  onDestroy(() => {
    if (gl && program) {
      gl.deleteProgram(program);
    }
  });

  function formatDisplayName(name?: string): string {
    if (!name) return 'No selection';
    return name.length > 28 ? `${name.slice(0, 25)}...` : name;
  }

  function getLoadingMessage(state: SelectionState): string {
    if (state.isPreviewLoading) return LOADING_MESSAGES.PREVIEW;
    if (state.isPixelizing) return 'arbeitet';
    return LOADING_MESSAGES.UPLOADING;
  }

  function getDebugState(state: SelectionState): string {
    return `
      isPreviewLoading: ${state.isPreviewLoading}
      isPixelizing: ${state.isPixelizing}
      isUploadingFill: ${state.isUploadingFill}
      hasPreviewImage: ${Boolean(state.previewImage)}
      name: ${state.name || 'none'}
    `;
  }

  $: if (canvasElement) {
    setCanvas(canvasElement);
  }
</script>

<!-- Debug state display -->
<!-- <div
  class="p-2 mb-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono whitespace-pre"
>
  {getDebugState($selection)}
</div> -->

<div class="rounded-lg border border-gray-200 dark:border-gray-700">
  <div class="relative w-[300px] h-[300px] min-h-[100px]">
    <div class="flex items-center justify-center relative w-full h-full">
      <canvas
        bind:this={canvasElement}
        width="300"
        height="300"
        class="w-[300px] h-[300px] max-w-full max-h-[300px] p-2 object-contain rounded transition-opacity"
        class:opacity-50={isLoading}
        class:hidden={$selection.isPreviewLoading}
      >
      </canvas>
      {#if $selection.error || isLoading || (!$selection.previewImage && !$selection.name)}
        <div
          class="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm rounded transition-all duration-200"
        >
          {#if $selection.error}
            <p class="text-sm text-red-600 text-center">{$selection.error}</p>
          {:else if isLoading}
            <LoadingSpinner />
            <p class="text-sm text-white font-medium">{loadingMessage}</p>
            {#if $selection.isPreviewLoading}
              {displayName}
            {/if}
          {/if}
          {#if !$selection.previewImage && !$selection.name}
            <p class="text-sm text-center">
              {LOADING_MESSAGES.NO_SELECTION}
            </p>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
