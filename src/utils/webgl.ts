import { mat4 } from 'gl-matrix';
import type { SelectionState } from '../types';

// Keep track of active contexts and programs
const activeContexts: WebGLRenderingContext[] = [];
const MAX_CONTEXTS = 16;

// Shader sources
const vsSource = `
  attribute vec4 aVertexPosition;
  attribute vec2 aTextureCoord;
  uniform mat4 uModelViewMatrix;
  uniform mat4 uProjectionMatrix;
  varying vec2 vTextureCoord;
  
  void main() {
    gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    vTextureCoord = aTextureCoord;
  }
`;

const fsSource = `
  precision mediump float;
  varying vec2 vTextureCoord;
  uniform sampler2D uSampler;
  
  void main() {
    gl_FragColor = texture2D(uSampler, vTextureCoord);
  }
`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export async function transformImageData(
  imageData: Uint8Array,
  width: number,
  height: number,
  rotateX: number,
  rotateY: number,
  rotateZ: number
): Promise<{ data: Uint8Array; width: number; height: number }> {
  // For now, just return the original data
  // We'll implement the actual transformation later
  return {
    data: imageData,
    width,
    height,
  };
}

export function initWebGL(canvas: HTMLCanvasElement): {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
} | null {
  const gl = canvas.getContext('webgl');
  if (!gl) return null;

  const program = createProgram(gl, vsSource, fsSource);
  if (!program) return null;

  gl.useProgram(program);
  setupBuffers(gl, program);

  return { gl, program };
}

export async function drawPlaceholder(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0
): Promise<void> {
  try {
    const image = await loadImage('/placeholder.png');

    // Calculate scaling to maintain aspect ratio
    const imageAspect = image.width / image.height;
    const canvasAspect = gl.canvas.width / gl.canvas.height;

    let scaleX = 1;
    let scaleY = 1;

    if (imageAspect > canvasAspect) {
      // Image is wider than canvas
      scaleY = canvasAspect / imageAspect;
    } else {
      // Image is taller than canvas
      scaleX = imageAspect / canvasAspect;
    }

    // Update vertex positions to maintain aspect ratio
    const positions = new Float32Array([
      -scaleX,
      -scaleY, // Bottom left
      scaleX,
      -scaleY, // Bottom right
      -scaleX,
      scaleY, // Top left
      scaleX,
      scaleY, // Top right
    ]);

    // Update position buffer
    const positionLocation = gl.getAttribLocation(program, 'aVertexPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Create and set up the texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Upload the image into the texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // Create and set transformation matrices
    const { modelViewMatrix, projectionMatrix } = createMatrices(
      gl,
      rotateX,
      rotateY,
      rotateZ
    );

    const modelViewLocation = gl.getUniformLocation(
      program,
      'uModelViewMatrix'
    );
    const projectionLocation = gl.getUniformLocation(
      program,
      'uProjectionMatrix'
    );

    gl.uniformMatrix4fv(modelViewLocation, false, modelViewMatrix);
    gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);

    // Clear and draw
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  } catch (error) {
    console.error('Failed to load placeholder:', error);
  }
}

function setupBuffers(gl: WebGLRenderingContext, program: WebGLProgram): void {
  // Create a square (two triangles) to show the image
  const positions = new Float32Array([
    -1.0,
    -1.0, // Bottom left
    1.0,
    -1.0, // Bottom right
    -1.0,
    1.0, // Top left
    1.0,
    1.0, // Top right
  ]);

  const textureCoords = new Float32Array([
    0.0,
    1.0, // Bottom left
    1.0,
    1.0, // Bottom right
    0.0,
    0.0, // Top left
    1.0,
    0.0, // Top right
  ]);

  // Set up position buffer
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  const positionLocation = gl.getAttribLocation(program, 'aVertexPosition');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // Set up texture coordinate buffer
  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.STATIC_DRAW);
  const texCoordLocation = gl.getAttribLocation(program, 'aTextureCoord');
  gl.enableVertexAttribArray(texCoordLocation);
  gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
}

function createProgram(
  gl: WebGLRenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram | null {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);

  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Failed to link program:', gl.getProgramInfoLog(program));
    return null;
  }

  return program;
}

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Failed to compile shader:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

export function drawScene(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  imageData: number[],
  width: number,
  height: number
): void {
  gl.useProgram(program);

  // Create and set up the texture
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // Convert number[] to Uint8Array and upload to texture
  const data = new Uint8Array(imageData);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    data
  );

  // Clear and draw
  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Draw the textured quad
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// Add function to create transformation matrices
function createMatrices(
  gl: WebGLRenderingContext,
  rotateX: number,
  rotateY: number,
  rotateZ: number
): { modelViewMatrix: mat4; projectionMatrix: mat4 } {
  const modelViewMatrix = mat4.create();
  const projectionMatrix = mat4.create();

  // Set up perspective projection
  mat4.perspective(
    projectionMatrix,
    (45 * Math.PI) / 180,
    gl.canvas.width / gl.canvas.height,
    0.1,
    100.0
  );

  // Move the camera back a bit
  mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, -4.0]);

  // Apply rotations
  mat4.rotateX(modelViewMatrix, modelViewMatrix, (rotateX * Math.PI) / 180);
  mat4.rotateY(modelViewMatrix, modelViewMatrix, (rotateY * Math.PI) / 180);
  mat4.rotateZ(modelViewMatrix, modelViewMatrix, (rotateZ * Math.PI) / 180);

  return { modelViewMatrix, projectionMatrix };
}
