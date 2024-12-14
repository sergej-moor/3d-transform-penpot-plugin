<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { selection } from '../stores/selection';
  import { settings, setCanvas, setWebGLContext } from '../stores/settings';
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
    } /* else {
      drawPlaceholder(
        gl,
        program,
        $settings.rotateX,
        $settings.rotateY,
        $settings.rotateZ
      ).catch(console.error);
    } */
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
    setWebGLContext(canvasElement, program);

    // Initial draw
    /*     if (!$selection.previewImage) {
      await drawPlaceholder(
        gl,
        program,
        $settings.rotateX,
        $settings.rotateY,
        $settings.rotateZ
      );
    } */
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

  function getLoadingMessage(state: typeof $selection): string {
    if (state.isPreviewLoading) return LOADING_MESSAGES.PREVIEW;
    if (state.isPixelizing) return 'arbeitet';
    return LOADING_MESSAGES.UPLOADING;
  }

  $: if (canvasElement) {
    setCanvas(canvasElement);
  }

  // Add debug state helper
  function getDebugState($selection: typeof $selection): string {
    return `
      isPreviewLoading: ${$selection.isPreviewLoading}
      isPixelizing: ${$selection.isPixelizing}
      isUploadingFill: ${$selection.isUploadingFill}
      hasPreviewImage: ${Boolean($selection.previewImage)}
      name: ${$selection.name || 'none'}
    `;
  }
</script>

<!-- Add debug state display -->

<div
  class="p-2 mb-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono whitespace-pre"
>
  {getDebugState($selection)}
</div>

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
          class:opacity-50={$selection.isPreviewLoading ||
            $selection.isPixelizing ||
            $selection.isUploadingFill}
        ></canvas>

        {#if $selection.isPreviewLoading || $selection.isPixelizing || $selection.isUploadingFill}
          <div
            class="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm rounded transition-all duration-200"
          >
            <LoadingSpinner />
            <p class="text-sm text-white font-medium">{loadingMessage}</p>
            {#if $selection.isPreviewLoading}
              {displayName}
            {/if}
          </div>
        {/if}
        {#if !$selection.previewImage && !$selection.name}
          <div
            class="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm rounded transition-all duration-200"
          >
            <p class="text-sm text-center">
              {LOADING_MESSAGES.NO_SELECTION}
            </p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
