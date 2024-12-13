<script lang="ts">
  import { settings } from '../stores/settings';
  import {
    selection,
    updatePreview,
    transformImage,
  } from '../stores/selection';
  import { tooltip } from '../actions/tooltip';
  import { CONSTANTS } from '../constants';
  import { drawScene } from '../utils/webgl';

  async function handleAddNewLayer(): Promise<void> {
    if (!$selection.previewImage || !$settings.canvas) return;

    const gl = $settings.canvas.getContext('webgl');
    if (!gl) return;

    try {
      // Store original dimensions
      const previewWidth = $settings.canvas.width;
      const previewHeight = $settings.canvas.height;

      // Calculate dimensions after rotation
      const radX = ($settings.rotateX * Math.PI) / 180;
      const radY = ($settings.rotateY * Math.PI) / 180;
      const radZ = ($settings.rotateZ * Math.PI) / 180;

      const cosZ = Math.abs(Math.cos(radZ));
      const sinZ = Math.abs(Math.sin(radZ));
      const rotatedWidth =
        $selection.previewImage.width * cosZ +
        $selection.previewImage.height * sinZ;
      const rotatedHeight =
        $selection.previewImage.width * sinZ +
        $selection.previewImage.height * cosZ;

      // Calculate export dimensions with high resolution
      const exportWidth = Math.round(
        Math.max($selection.previewImage.width, rotatedWidth)
      );
      const exportHeight = Math.round(
        Math.max($selection.previewImage.height, rotatedHeight)
      );

      // Apply resolution multiplier with maximum dimension limit
      const maxDimension = 4096;
      const resolutionMultiplier = 4;
      const scale = Math.min(
        (maxDimension / exportWidth) * resolutionMultiplier,
        (maxDimension / exportHeight) * resolutionMultiplier,
        4
      );

      const finalWidth = Math.round(exportWidth * scale);
      const finalHeight = Math.round(exportHeight * scale);

      // Resize WebGL canvas and viewport
      $settings.canvas.width = finalWidth;
      $settings.canvas.height = finalHeight;
      gl.viewport(0, 0, finalWidth, finalHeight);

      // Redraw scene at high resolution
      drawScene(
        gl,
        gl.getParameter(gl.CURRENT_PROGRAM),
        $selection.previewImage.data,
        $selection.previewImage.width,
        $selection.previewImage.height,
        $settings.rotateX,
        $settings.rotateY,
        $settings.rotateZ
      );

      // Read pixels from WebGL context
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

      // Create canvas for final export
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = finalWidth / 2;
      exportCanvas.height = finalHeight / 2;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      // Create temporary canvas for full-size image
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = finalWidth;
      tempCanvas.height = finalHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      const imageData = tempCtx.createImageData(finalWidth, finalHeight);

      // Flip Y-axis and copy pixels
      for (let y = 0; y < finalHeight; y++) {
        for (let x = 0; x < finalWidth; x++) {
          const srcIndex = ((finalHeight - y - 1) * finalWidth + x) * 4;
          const dstIndex = (y * finalWidth + x) * 4;
          imageData.data[dstIndex] = pixels[srcIndex]; // R
          imageData.data[dstIndex + 1] = pixels[srcIndex + 1]; // G
          imageData.data[dstIndex + 2] = pixels[srcIndex + 2]; // B
          imageData.data[dstIndex + 3] = pixels[srcIndex + 3]; // A
        }
      }

      tempCtx.putImageData(imageData, 0, 0);

      // Scale down with smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tempCanvas, 0, 0, finalWidth / 2, finalHeight / 2);

      // Get final image data and send to Penpot
      const blob = await new Promise<Blob | null>((resolve) =>
        exportCanvas.toBlob(resolve, 'image/png')
      );

      if (!blob) return;

      const arrayBuffer = await blob.arrayBuffer();
      const finalImageData = new Uint8Array(arrayBuffer);

      // Send message to create new layer
      window.parent.postMessage(
        {
          type: 'add-to-penpot',
          imageData: finalImageData,
          width: finalWidth / 2, // Using the scaled dimensions
          height: finalHeight / 2,
          originalFill: $selection.fills[$selection.fills.length - 1],
        },
        '*'
      );

      // After restoring canvas size, redraw again
      $settings.canvas.width = previewWidth;
      $settings.canvas.height = previewHeight;
      gl.viewport(0, 0, previewWidth, previewHeight);
      drawScene(
        gl,
        gl.getParameter(gl.CURRENT_PROGRAM),
        $selection.previewImage.data,
        $selection.previewImage.width,
        $selection.previewImage.height,
        $settings.rotateX,
        $settings.rotateY,
        $settings.rotateZ
      );
    } catch (error) {
      console.error('Error exporting image:', error);
    }
  }

  // Check if controls should be disabled
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
