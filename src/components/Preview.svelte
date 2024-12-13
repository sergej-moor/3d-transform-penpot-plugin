<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    selection,
    updatePreview,
    setPreviewCanvas,
  } from '../stores/selection';
  import { settings, setCanvas } from '../stores/settings';
  import { LOADING_MESSAGES } from '../constants';
  import LoadingSpinner from './LoadingSpinner.svelte';
  import { initWebGL, drawScene, drawPlaceholder } from '../utils/webgl';

  let canvasElement: HTMLCanvasElement;
  let gl: WebGLRenderingContext | null = null;
  let program: WebGLProgram | null = null;

  // Computed properties
  $: displayName = formatDisplayName($selection.name);
  $: loadingMessage = getLoadingMessage($selection);

  // Watch for selection or rotation changes
  $: if (gl && program) {
    if ($selection.previewImage) {
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
    } else {
      drawPlaceholder(
        gl,
        program,
        $settings.rotateX,
        $settings.rotateY,
        $settings.rotateZ
      ).catch(console.error);
    }
  }

  onMount(async () => {
    if (!canvasElement) return;

    const result = initWebGL(canvasElement);
    if (!result) {
      console.error('Failed to initialize WebGL');
      return;
    }

    gl = result.gl;
    program = result.program;
    setPreviewCanvas(canvasElement);

    // Initial draw
    if (!$selection.previewImage) {
      await drawPlaceholder(
        gl,
        program,
        $settings.rotateX,
        $settings.rotateY,
        $settings.rotateZ
      );
    }
  });

  onDestroy(() => {
    if (gl && program) {
      gl.deleteProgram(program);
      setPreviewCanvas(null);
    }
  });

  function formatDisplayName(name?: string): string {
    if (!name) return 'No selection';
    return name.length > 28 ? `${name.slice(0, 25)}...` : name;
  }

  function getLoadingMessage(state: typeof $selection): string {
    if (state.isPreviewLoading) return LOADING_MESSAGES.PREVIEW;
    if (state.isPixelizing) return LOADING_MESSAGES.PIXELIZING;
    return LOADING_MESSAGES.UPLOADING;
  }

  $: if (canvasElement) {
    setCanvas(canvasElement);
  }
</script>

<div class="rounded-lg border border-gray-200 dark:border-gray-700">
  <div class="relative w-[300px] h-[300px] min-h-[100px]">
    {#if $selection.error}
      <div class="flex items-center justify-center h-full p-4">
        <p class="text-sm text-red-600 text-center">{$selection.error}</p>
      </div>
    {:else}
      <div class="flex items-center justify-center relative w-full h-full">
        <canvas
          bind:this={canvasElement}
          width="300"
          height="300"
          class="w-[300px] h-[300px] max-w-full max-h-[300px] p-2 object-contain rounded transition-opacity"
          class:opacity-50={$selection.isPreviewLoading}
        ></canvas>

        {#if $selection.isPreviewLoading || $selection.isPixelizing || $selection.isUploadingFill}
          <div
            class="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm rounded transition-all duration-200"
          >
            <LoadingSpinner />
            <p class="text-sm text-white font-medium">{loadingMessage}</p>
          </div>
        {/if}
        {#if !$selection.previewImage}
          <div
            class="absolute inset-0 flex flex-col items-center justify-center"
          >
            <p class="text-sm text-center">
              {$selection.name
                ? LOADING_MESSAGES.INITIAL
                : LOADING_MESSAGES.NO_SELECTION}
            </p>
            {#if $selection.name}
              <p>{displayName}</p>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
