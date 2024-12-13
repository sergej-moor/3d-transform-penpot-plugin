<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { selection } from '../stores/selection';
  import { settings } from '../stores/settings';
  import { LOADING_MESSAGES } from '../constants';
  import LoadingSpinner from './LoadingSpinner.svelte';
  import { initWebGL, drawScene, drawPlaceholder } from '../utils/webgl';

  let canvas: HTMLCanvasElement;
  let gl: WebGLRenderingContext | null = null;
  let program: WebGLProgram | null = null;

  // Computed properties
  $: displayName = formatDisplayName($selection.name);
  $: loadingMessage = getLoadingMessage($selection);

  onMount(async () => {
    if (!canvas) return;

    const result = initWebGL(canvas);
    if (!result) {
      console.error('Failed to initialize WebGL');
      return;
    }

    gl = result.gl;
    program = result.program;

    // Draw placeholder if no selection
    if (!$selection.previewImage) {
      await drawPlaceholder(gl, program);
    } else {
      updatePreview($selection.previewImage);
    }
  });

  // Subscribe to selection changes and rotation settings
  $: if (gl && program) {
    if ($selection.previewImage) {
      updatePreview($selection.previewImage);
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

  function updatePreview(previewImage: {
    data: number[];
    width: number;
    height: number;
  }) {
    if (!gl || !program) return;

    try {
      drawScene(
        gl,
        program,
        previewImage.data,
        previewImage.width,
        previewImage.height
      );
    } catch (error) {
      console.error('Failed to update preview:', error);
    }
  }

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
    if (state.isPixelizing) return LOADING_MESSAGES.PIXELIZING;
    return LOADING_MESSAGES.UPLOADING;
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
          bind:this={canvas}
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
