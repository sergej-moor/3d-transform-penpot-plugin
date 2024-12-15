<script lang="ts">
  import { settings } from '../stores/settings';
  import { selection } from '../stores/selection';
  import { tooltip } from '../actions/tooltip';
  import { CONSTANTS } from '../constants';
  import { drawScene } from '../utils/webgl';
  import { RotateCcw } from 'lucide-svelte';
  import { RotateCw } from 'lucide-svelte';

  async function handleAddNewLayer(): Promise<void> {
    if (!$selection.previewImage || !$settings.canvas) return;

    try {
      selection.update((state) => ({ ...state, isUploadingFill: true }));

      const gl = $settings.canvas.getContext('webgl');
      if (!gl) return;

      const previewWidth = $settings.canvas.width;
      const previewHeight = $settings.canvas.height;

      const exportScale = 4;
      const exportWidth = previewWidth * exportScale;
      const exportHeight = previewHeight * exportScale;

      const maxDimension = 4096 * 3;
      const resolutionMultiplier = 4;
      const scale = Math.min(
        maxDimension / exportWidth,
        maxDimension / exportHeight,
        resolutionMultiplier
      );

      const finalWidth = Math.round(exportWidth * scale);
      const finalHeight = Math.round(exportHeight * scale);

      $settings.canvas.width = finalWidth;
      $settings.canvas.height = finalHeight;
      gl.viewport(0, 0, finalWidth, finalHeight);

      drawScene(
        gl,
        $settings.program!,
        $selection.previewImage.data,
        $selection.previewImage.width,
        $selection.previewImage.height,
        $settings.rotateX,
        $settings.rotateY,
        $settings.rotateZ
      );

      const pixels = new Uint8Array(finalWidth * finalHeight * 4);
      gl.readPixels(
        0,
        0,
        finalWidth,
        finalHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels
      );

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = finalWidth;
      tempCanvas.height = finalHeight;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.imageSmoothingEnabled = true;
      tempCtx.imageSmoothingQuality = 'high';
      const imageData = tempCtx.createImageData(finalWidth, finalHeight);

      for (let y = 0; y < finalHeight; y++) {
        for (let x = 0; x < finalWidth; x++) {
          const srcIndex = ((finalHeight - y - 1) * finalWidth + x) * 4;
          const dstIndex = (y * finalWidth + x) * 4;
          imageData.data[dstIndex] = pixels[srcIndex];
          imageData.data[dstIndex + 1] = pixels[srcIndex + 1];
          imageData.data[dstIndex + 2] = pixels[srcIndex + 2];
          imageData.data[dstIndex + 3] = pixels[srcIndex + 3];
        }
      }

      tempCtx.putImageData(imageData, 0, 0);

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = finalWidth;
      exportCanvas.height = finalHeight;
      const ctx = exportCanvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tempCanvas, 0, 0, finalWidth, finalHeight);

      const blob = await new Promise<Blob | null>((resolve) =>
        exportCanvas.toBlob(resolve, 'image/png')
      );

      if (!blob) return;

      const arrayBuffer = await blob.arrayBuffer();
      const finalImageData = new Uint8Array(arrayBuffer);

      window.parent.postMessage(
        {
          type: 'add-to-penpot',
          imageData: finalImageData,
          width: finalWidth,
          height: finalHeight,
          originalFill: $selection.fills[$selection.fills.length - 1],
        },
        '*'
      );

      $settings.canvas.width = previewWidth;
      $settings.canvas.height = previewHeight;
      gl.viewport(0, 0, previewWidth, previewHeight);
      drawScene(
        gl,
        $settings.program!,
        $selection.previewImage.data,
        $selection.previewImage.width,
        $selection.previewImage.height,
        $settings.rotateX,
        $settings.rotateY,
        $settings.rotateZ
      );
    } catch (error) {
      console.error('Error exporting image:', error);
      selection.update((state) => ({ ...state, isUploadingFill: false }));
    }
  }

  function findImageBounds(
    imageData: Uint8Array,
    width: number,
    height: number,
    rotateX: number
  ) {
    let left = width;
    let right = 0;
    let top = height;
    let bottom = 0;

    const radX = (rotateX * Math.PI) / 180;
    const cosX = Math.abs(Math.cos(radX));
    const sinX = Math.abs(Math.sin(radX));

    const perspectiveScale = Math.min(1, cosX + 0.3);

    const yOffsetMultiplier = rotateX >= 0 ? 0.2 : -0.2;
    const yOffset = Math.round(height * sinX * yOffsetMultiplier);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = imageData[(y * width + x) * 4 + 3];
        if (alpha > 0) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          const adjustedY = y - yOffset;
          top = Math.min(top, adjustedY);
          bottom = Math.max(bottom, adjustedY);
        }
      }
    }

    const basePadding = 4;
    const rotationPadding = Math.round(Math.abs(rotateX) / 45) * 2;
    const padding = basePadding + rotationPadding;

    left = Math.max(0, left - padding);
    top = Math.max(0, Math.round(top) - padding);
    right = Math.min(width - 1, right + padding);
    bottom = Math.min(height - 1, Math.round(bottom) + padding);

    const rawHeight = bottom - top + 1;
    const adjustedHeight = Math.round(rawHeight / perspectiveScale);

    return {
      left,
      right,
      top: Math.max(0, top),
      bottom: Math.min(height - 1, bottom),
      width: right - left + 1,
      height: adjustedHeight,
    };
  }

  function handleReset(): void {
    $settings.rotateX = 0;
    $settings.rotateY = 0;
    $settings.rotateZ = 0;
  }

  function rotate(axis: 'x' | 'y' | 'z', amount: number): void {
    switch (axis) {
      case 'x':
        $settings.rotateX = ($settings.rotateX + amount) % 360;
        break;
      case 'y':
        $settings.rotateY = ($settings.rotateY + amount) % 360;
        break;
      case 'z':
        $settings.rotateZ = ($settings.rotateZ + amount) % 360;
        break;
    }
  }

  $: isDisabled = !$selection.previewImage;
  $: isProcessing =
    $selection.isTransforming ||
    $selection.isUploadingFill ||
    $selection.isPreviewLoading;
</script>

<div class="flex flex-col gap-2">
  <div class="flex flex-col mb-4">
    <h4>Presets</h4>
    <div class="flex justify-between">
      <button
        type="button"
        data-appearance="secondary"
        on:click={() => {
          $settings.rotateX = -60;
          $settings.rotateY = 0;
          $settings.rotateZ = -45;
        }}
        use:tooltip={{
          text: 'X: -60, Z: -45',
          position: 'bottom',
          maxWidth: 'max-w-[60px]',
        }}
      >
        1
      </button>
      <button
        type="button"
        data-appearance="secondary"
        on:click={() => {
          $settings.rotateX = -60;
          $settings.rotateY = 0;
          $settings.rotateZ = 45;
        }}
        use:tooltip={{
          text: 'X: -60, Z: 45',
          position: 'bottom',
          maxWidth: 'max-w-[60px]',
        }}
      >
        2
      </button>
      <button
        type="button"
        data-appearance="secondary"
        on:click={() => {
          $settings.rotateX = -60;
          $settings.rotateY = 0;
          $settings.rotateZ = 0;
        }}
        use:tooltip={{
          text: 'X: -60',
          position: 'bottom',
          maxWidth: 'max-w-[60px]',
        }}
      >
        3
      </button>
      <button
        type="button"
        data-appearance="secondary"
        on:click={() => {
          $settings.rotateY = 45;
          $settings.rotateX = 0;
          $settings.rotateZ = 0;
        }}
        use:tooltip={{
          text: 'Y: 45',
          position: 'bottom',
          maxWidth: 'max-w-[60px]',
        }}
      >
        4
      </button>
      <button
        type="button"
        data-appearance="secondary"
        on:click={() => {
          $settings.rotateY = -45;
          $settings.rotateX = 0;
          $settings.rotateZ = 0;
        }}
        use:tooltip={{
          text: 'Y: -45',
          position: 'bottom',
          maxWidth: 'max-w-[60px]',
        }}
      >
        5
      </button>
      <button
        type="button"
        data-appearance="secondary"
        on:click={() => {
          $settings.rotateY = 60;
          $settings.rotateX = 0;
          $settings.rotateZ = 0;
        }}
        use:tooltip={{
          text: 'Y: 60',
          position: 'bottom',
          maxWidth: 'max-w-[60px]',
        }}
      >
        6
      </button>
      <button
        type="button"
        data-appearance="secondary"
        on:click={() => {
          $settings.rotateX = -45;
          $settings.rotateY = 0;
          $settings.rotateZ = 45;
        }}
        use:tooltip={{
          text: 'X: -45, Z: 45',
          position: 'bottom',
          maxWidth: 'max-w-[60px]',
        }}
      >
        7
      </button>
      <button
        type="button"
        data-appearance="secondary"
        on:click={() => {
          $settings.rotateX = -45;
          $settings.rotateY = 0;
          $settings.rotateZ = 0;
        }}
        use:tooltip={{
          text: 'X: -45',
          position: 'bottom',
          maxWidth: 'max-w-[60px]',
        }}
      >
        8
      </button>
    </div>
  </div>

  <label class="flex flex-col">
    <span class="text-sm">Rotate X: {$settings.rotateX}°</span>
    <div class="flex items-center">
      <input
        type="range"
        min="-85"
        max="85"
        step="5"
        bind:value={$settings.rotateX}
        class="w-full flex-1"
      />
      <button
        type="button"
        data-appearance="secondary"
        on:click={() => ($settings.rotateX = 0)}
        use:tooltip={{
          text: 'Reset X',
          position: 'bottom',
          maxWidth: 'max-w-[60px]',
        }}
      >
        <RotateCcw class="w-4 h-4" />
      </button>
    </div>
  </label>

  <label class="flex flex-col">
    <span class="text-sm">Rotate Y: {$settings.rotateY}°</span>
    <div class="flex items-center">
      <input
        type="range"
        min="-85"
        max="85"
        step="5"
        bind:value={$settings.rotateY}
        class="w-full flex-1"
      />
      <button
        type="button"
        data-appearance="secondary"
        on:click={() => ($settings.rotateY = 0)}
        use:tooltip={{
          text: 'Reset XY',
          position: 'bottom',
          maxWidth: 'max-w-[60px]',
        }}
      >
        <RotateCcw class="w-4 h-4" />
      </button>
    </div>
  </label>

  <label class="flex flex-col">
    <span class="text-sm">Rotate Z: {$settings.rotateZ}°</span>
    <div class="flex items-center">
      <input
        type="range"
        min="-85"
        max="85"
        step="5"
        bind:value={$settings.rotateZ}
        class="w-full flex-1"
      />
      <button
        type="button"
        data-appearance="secondary"
        on:click={() => ($settings.rotateZ = 0)}
        use:tooltip={{
          text: 'Reset Z',
          position: 'bottom',
          maxWidth: 'max-w-[60px]',
        }}
      >
        <RotateCcw class="w-4 h-4" />
      </button>
    </div>
  </label>
  <button
    type="button"
    data-appearance="secondary"
    on:click={handleReset}
    disabled={isDisabled}
    class="flex-1 flex justify-center gap-2 items-center normal-case mt-2"
    use:tooltip={{
      text: 'Reset all rotation values to 0',
      position: 'bottom',
      maxWidth: 'max-w-[300px]',
    }}
  >
    Reset Rotations
  </button>

  <div class="flex flex-col gap-2 mt-3">
    <button
      on:click={handleAddNewLayer}
      disabled={isDisabled || isProcessing}
      type="button"
      data-appearance="primary"
      class="flex-1 flex justify-center gap-2 items-center py-2"
      use:tooltip={{
        text: 'Create a new shape with the 3D transformation',
        position: 'bottom',
        maxWidth: 'max-w-[300px]',
      }}
    >
      Add to Canvas
    </button>
  </div>
</div>
