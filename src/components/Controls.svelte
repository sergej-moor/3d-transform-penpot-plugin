<script lang="ts">
  import { settings } from '../stores/settings';
  import { selection } from '../stores/selection';
  import { tooltip } from '../actions/tooltip';
  import { CONSTANTS } from '../constants';
  import { drawScene } from '../utils/webgl';

  async function handleAddNewLayer(): Promise<void> {
    if (!$selection.previewImage || !$settings.canvas) return;

    try {
      selection.update((state) => ({ ...state, isUploadingFill: true }));

      const gl = $settings.canvas.getContext('webgl');
      if (!gl) return;

      const previewWidth = $settings.canvas.width;
      const previewHeight = $settings.canvas.height;

      $settings.canvas.width = previewWidth * 2;
      $settings.canvas.height = previewHeight * 2;
      gl.viewport(0, 0, previewWidth * 2, previewHeight * 2);

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

      const pixels = new Uint8Array(previewWidth * 2 * previewHeight * 2 * 4);
      gl.readPixels(
        0,
        0,
        previewWidth * 2,
        previewHeight * 2,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels
      );

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = previewWidth * 2;
      tempCanvas.height = previewHeight * 2;
      const tempCtx = tempCanvas.getContext('2d')!;
      const imageData = tempCtx.createImageData(
        previewWidth * 2,
        previewHeight * 2
      );

      for (let y = 0; y < previewHeight * 2; y++) {
        for (let x = 0; x < previewWidth * 2; x++) {
          const srcIndex =
            ((previewHeight * 2 - y - 1) * previewWidth * 2 + x) * 4;
          const dstIndex = (y * previewWidth * 2 + x) * 4;
          imageData.data[dstIndex] = pixels[srcIndex];
          imageData.data[dstIndex + 1] = pixels[srcIndex + 1];
          imageData.data[dstIndex + 2] = pixels[srcIndex + 2];
          imageData.data[dstIndex + 3] = pixels[srcIndex + 3];
        }
      }

      tempCtx.putImageData(imageData, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) =>
        tempCanvas.toBlob(resolve, 'image/png')
      );

      if (!blob) return;

      const arrayBuffer = await blob.arrayBuffer();
      const finalImageData = new Uint8Array(arrayBuffer);

      window.parent.postMessage(
        {
          type: 'add-to-penpot',
          imageData: finalImageData,
          width: previewWidth * 2,
          height: previewHeight * 2,
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

  $: isDisabled = !$selection.previewImage;
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
