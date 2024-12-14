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

      // Calculate Z rotation effect
      const cosZ = Math.abs(Math.cos(radZ));
      const sinZ = Math.abs(Math.sin(radZ));

      // Calculate X rotation effect
      const cosX = Math.abs(Math.cos(radX));

      // Calculate rotated dimensions including X rotation perspective
      const rotatedWidth =
        $selection.previewImage.width * cosZ +
        $selection.previewImage.height * sinZ;
      const rotatedHeight =
        ($selection.previewImage.width * sinZ +
          $selection.previewImage.height * cosZ) *
        cosX;

      // Calculate export dimensions with high resolution
      const exportWidth = Math.round(rotatedWidth);
      const exportHeight = Math.round(rotatedHeight);

      // Apply resolution multiplier with maximum dimension limit
      const maxDimension = 4096;
      const resolutionMultiplier = 4;
      const scale = Math.min(
        (maxDimension / exportWidth) * resolutionMultiplier,
        (maxDimension / exportHeight) * resolutionMultiplier,
        4
      );

      // Calculate final dimensions while maintaining aspect ratio
      const finalWidth = Math.round(rotatedWidth * scale);
      const finalHeight = Math.round(rotatedHeight * scale);

      // Set canvas size and viewport
      $settings.canvas.width = finalWidth;
      $settings.canvas.height = finalHeight;
      gl.viewport(0, 0, finalWidth, finalHeight);

      // Redraw scene at high resolution
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

      // Find bounds of non-transparent pixels
      const bounds = findImageBounds(
        pixels,
        finalWidth,
        finalHeight,
        $settings.rotateX
      );

      // Create temporary canvas for Y-axis flip
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = finalWidth;
      tempCanvas.height = finalHeight;
      const tempCtx = tempCanvas.getContext('2d')!;
      const imageData = tempCtx.createImageData(finalWidth, finalHeight);

      // Flip Y-axis and copy pixels
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

      // Create canvas for final export with cropped dimensions
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = bounds.width / 2;
      exportCanvas.height = bounds.height / 2;
      const ctx = exportCanvas.getContext('2d')!;

      // Draw the cropped region with smooth scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        tempCanvas,
        bounds.left,
        bounds.top,
        bounds.width,
        bounds.height, // Source rectangle
        0,
        0,
        bounds.width / 2,
        bounds.height / 2 // Destination rectangle (scaled down)
      );

      // Get final image data
      const blob = await new Promise<Blob | null>((resolve) =>
        exportCanvas.toBlob(resolve, 'image/png')
      );

      if (!blob) return;

      const arrayBuffer = await blob.arrayBuffer();
      const finalImageData = new Uint8Array(arrayBuffer);

      // Send message to create new layer with cropped dimensions
      window.parent.postMessage(
        {
          type: 'add-to-penpot',
          imageData: finalImageData,
          width: bounds.width / 2,
          height: bounds.height / 2,
          originalFill: $selection.fills[$selection.fills.length - 1],
        },
        '*'
      );

      // Restore preview dimensions
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

    // Calculate X rotation effect
    const radX = (rotateX * Math.PI) / 180;
    const cosX = Math.abs(Math.cos(radX));
    const sinX = Math.abs(Math.sin(radX));

    // Reduce the perspective effect to prevent excessive height reduction
    const perspectiveScale = Math.min(1, cosX + 0.3);

    // Calculate y-offset based on rotation direction
    // Use different multipliers for positive and negative rotations
    const yOffsetMultiplier = rotateX >= 0 ? 0.2 : -0.2; // Increased negative multiplier
    const yOffset = Math.round(height * sinX * yOffsetMultiplier);

    // Scan through all pixels to find the bounds of non-transparent pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = imageData[(y * width + x) * 4 + 3];
        if (alpha > 0) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          // Adjust Y position based on rotation direction and compensation
          const adjustedY = y - yOffset;
          top = Math.min(top, adjustedY);
          bottom = Math.max(bottom, adjustedY);
        }
      }
    }

    // Add padding and ensure bounds are within image
    const basePadding = 4;
    const rotationPadding = Math.round(Math.abs(rotateX) / 45) * 2; // Additional padding based on rotation angle
    const padding = basePadding + rotationPadding;

    left = Math.max(0, left - padding);
    top = Math.max(0, Math.round(top) - padding);
    right = Math.min(width - 1, right + padding);
    bottom = Math.min(height - 1, Math.round(bottom) + padding);

    // Calculate height with less aggressive perspective scaling
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
