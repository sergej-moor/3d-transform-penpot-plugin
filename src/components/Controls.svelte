<script lang="ts">
  import { settings } from '../stores/settings';
  import {
    selection,
    updatePreview,
    transformImage,
  } from '../stores/selection';
  import { tooltip } from '../actions/tooltip';
  import { CONSTANTS } from '../constants';

  function handleApplyTransform(): void {
    transformImage({ rotateX, rotateY, rotateZ }, false);
  }

  function handleAddNewLayer(): void {
    transformImage({ rotateX, rotateY, rotateZ }, true);
  }

  // Check if controls should be disabled
  $: isDisabled = !$selection.exportedImage;
  $: isProcessing =
    $selection.isTransforming ||
    $selection.isUploadingFill ||
    $selection.isPreviewLoading;
</script>

<div class="flex flex-col gap-4">
  <label class="flex flex-col">
    <span class="text-sm">Rotate X: {$settings.rotateX}°</span>
    <input
      type="range"
      min="-180"
      max="180"
      bind:value={$settings.rotateX}
      class="w-full"
    />
  </label>

  <label class="flex flex-col">
    <span class="text-sm">Rotate Y: {$settings.rotateY}°</span>
    <input
      type="range"
      min="-180"
      max="180"
      bind:value={$settings.rotateY}
      class="w-full"
    />
  </label>

  <label class="flex flex-col">
    <span class="text-sm">Rotate Z: {$settings.rotateZ}°</span>
    <input
      type="range"
      min="-180"
      max="180"
      bind:value={$settings.rotateZ}
      class="w-full"
    />
  </label>

  <div class="flex flex-col gap-2">
    <button
      on:click={handleApplyTransform}
      disabled={isDisabled || isProcessing}
      data-appearance="primary"
      class="flex-1 flex justify-center gap-2 items-center"
      use:tooltip={{
        text: 'Apply the 3D transformation to the current shape',
        position: 'top',
        maxWidth: 'max-w-[300px]',
      }}
    >
      Apply to shape
    </button>

    <button
      on:click={handleAddNewLayer}
      disabled={isDisabled || isProcessing}
      data-appearance="primary"
      class="flex-1 flex justify-center gap-2 items-center"
      use:tooltip={{
        text: 'Create a new shape with the 3D transformation',
        position: 'bottom',
        maxWidth: 'max-w-[300px]',
      }}
    >
      Create new Shape
    </button>
  </div>
</div>
