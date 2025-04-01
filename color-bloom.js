const CANVAS_WRAPPER_ID = "color-bloom-canvas-wrapper";
const blooms = new Map();

function generateHueMutation() {
  return Math.random() * Math.random() * 100;
}

function generateStartingHue() {
  return Math.floor(Math.random() * 360);
}

/**
 * Converts a 6-digit hex string such as '#ffffff' to an object with h, s, and l values,
 * representing the hue, saturation, and lightness of the hex color in HSL color space
 * @param {string} hex
 * @returns An object with h, s, and l values
 */
export function hex2hsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return rgb2hsl(r, g, b);
}

/**
 * Converts a color in the form of r, g, and b values from 0 to 255 into an object with h, s, and l values,
 * representing the hue, saturation, and lightness of the color in HSL color space
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns An object with h, s, and l values
 */
export function rgb2hsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  // Find min and max values
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }

    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s,
    l,
  };
}

function debounce(func, wait) {
  let timeout;

  return function() {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, arguments), wait);
  };
}

function randomEl(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function removeEl(arr, el) {
  return arr.splice(arr.indexOf(el), 1)[0];
}

function pluckRandomEl(arr) {
  const index = Math.floor(Math.random() * arr.length);
  return arr.splice(index, 1)[0];
}

function step(speed = 1) {
  return new Promise(resolve => {
    speed < 0.5 ? requestAnimationFrame(resolve) : setTimeout(resolve);
  });
}

function getColorString(h, s, l, a = 1) {
  let colorString = `hsla(${h}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, ${a})`;
  return colorString;
}

function drawPixel(canvas, pixel) {
  let context = canvas.getContext("2d");
  context.fillStyle = getColorString(pixel.h, pixel.s, pixel.l, pixel.a);
  context.fillRect(pixel.x, pixel.y, 1, 1);
}

function addPixel(spawningElement, branch, x, y, h, s, l, a = 1) {
  const {canvas, pixelGrid} = blooms.get(spawningElement);
  const pixel = {x, y, h, s, l, a};
  pixelGrid[x][y] = pixel;
  branch.push(pixel);
  drawPixel(canvas, pixel);
}

function clearPixel(canvas, pixel) {
  let context = canvas.getContext("2d");
  context.clearRect(pixel.x, pixel.y, 1, 1);
}

function erasePixel(spawningElement, branch, x, y) {
  const {canvas, pixelGrid} = blooms.get(spawningElement);
  const pixel = {x, y};
  pixelGrid[x][y] = undefined;
  branch.push(pixel);
  clearPixel(canvas, pixel);
}

function mutateHue(h, hueVariance) {
  let actualMutation = hueVariance * 0.1;

  if (h >= 23 && h <= 27) {
    // Not enough orange
    actualMutation *= 0.5;
  } else if (h >= 100 && h <= 120) {
    // Too much green
    actualMutation *= 2;
  } else if (h >= 192 && h <= 198) {
    // Not enough light blue
    actualMutation *= 0.5;
  } else if (h >= 265 && h <= 275) {
    // Not enough purple
    if (h >= 269 && h <= 271) {
      actualMutation *= 0.25;
    } else {
      actualMutation *= 0.5;
    }
  }

  return (Math.random() * actualMutation * 2 - actualMutation + h + 360) % 360;
}

function mutateSaturation(s, saturationVariance) {
  const actualMutation = saturationVariance * 0.05;
  return Math.max(Math.min((Math.random() * (actualMutation * 2)) - actualMutation + s, 1), 0);
}

function mutateLightness(l, s, lightnessVariance, startingLightness) {
  const actualMutation = lightnessVariance * 0.05;
  const newValue = (Math.random() * (actualMutation * 2)) - actualMutation + l;

  // Use max lightness value of 0.6 when starting lightness is 0.5 and saturation is 1,
  // and let max lightness go to 1 as these values go to 0/1 and 0 respectively
  const maxLightness = 1 - ((1 - 0.6) * s * (1 - (2 * Math.abs(0.5 - startingLightness))));
  return Math.max(Math.min(newValue, maxLightness), 0);
}

function eraseBranch(spawningElement, branch, startingX, startingY, maxRadius) {
  const {canvas, branches, pixelGrid} = blooms.get(spawningElement);
  const randBranchPixel = randomEl(branch);

  const neighbors = [
    {x: randBranchPixel.x - 1, y: randBranchPixel.y},
    {x: randBranchPixel.x + 1, y: randBranchPixel.y},
    {x: randBranchPixel.x, y: randBranchPixel.y - 1},
    {x: randBranchPixel.x, y: randBranchPixel.y + 1},
  ];

  const squaredRadius = isNaN(maxRadius) ? 0 : maxRadius ** 2;

  while (neighbors.length) {
    const neighbor = pluckRandomEl(neighbors);
    if (neighbor.x >= 0 && neighbor.x < canvas.width
        && neighbor.y >= 0 && neighbor.y < canvas.height) {
      if (pixelGrid[neighbor.x][neighbor.y]) {
        if (!isNaN(maxRadius)
            && ((startingX - neighbor.x) ** 2 + (startingY - neighbor.y) ** 2) > squaredRadius) {
          branch.splice(0);
          branches.splice(branches.indexOf(branch), 1);
          return;
        }

        erasePixel(
          spawningElement,
          branch,
          neighbor.x,
          neighbor.y,
        );
      }
    }
  };

  if (!neighbors.length) {
    removeEl(branch, randBranchPixel);
    if (!branch.length) {
      branches.splice(branches.indexOf(branch), 1);
    }
  }
}

function growImageBranch(spawningElement, branch, startingX, startingY, maxRadius) {
  const {canvas, branches, pixelGrid} = blooms.get(spawningElement);
  const randBranchPixel = randomEl(branch);

  const neighbors = [
    {x: randBranchPixel.x - 1, y: randBranchPixel.y},
    {x: randBranchPixel.x + 1, y: randBranchPixel.y},
    {x: randBranchPixel.x, y: randBranchPixel.y - 1},
    {x: randBranchPixel.x, y: randBranchPixel.y + 1},
  ];

  const squaredRadius = isNaN(maxRadius) ? 0 : maxRadius ** 2;

  while (neighbors.length) {
    const neighbor = pluckRandomEl(neighbors);
    if (neighbor.x >= 0 && neighbor.x < canvas.width
        && neighbor.y >= 0 && neighbor.y < canvas.height) {
      if (pixelGrid[neighbor.x]?.[neighbor.y]?.imageDataToBeShown) {
        if (!isNaN(maxRadius)
            && ((startingX - neighbor.x) ** 2 + (startingY - neighbor.y) ** 2) > squaredRadius) {
          branch.splice(0);
          branches.splice(branches.indexOf(branch), 1);
          return;
        }

        const {h, s, l, a} = pixelGrid[neighbor.x][neighbor.y];

        addPixel(
          spawningElement,
          branch,
          neighbor.x,
          neighbor.y,
          h,
          s,
          l,
          a,
        );
      }
    }
  };

  if (!neighbors.length) {
    removeEl(branch, randBranchPixel);
    if (!branch.length) {
      branches.splice(branches.indexOf(branch), 1);
    }
  }
}

function growBranch(spawningElement, branch, hueVariance, saturationVariance, lightnessVariance,
    startingX, startingY, maxRadius) {
  const {canvas, branches, pixelGrid, startingColor} = blooms.get(spawningElement);
  const randBranchPixel = randomEl(branch);

  const neighbors = [
    {x: randBranchPixel.x - 1, y: randBranchPixel.y},
    {x: randBranchPixel.x + 1, y: randBranchPixel.y},
    {x: randBranchPixel.x, y: randBranchPixel.y - 1},
    {x: randBranchPixel.x, y: randBranchPixel.y + 1},
  ];

  const squaredRadius = isNaN(maxRadius) ? 0 : maxRadius ** 2;

  while (neighbors.length) {
    const neighbor = pluckRandomEl(neighbors);
    if (neighbor.x >= 0 && neighbor.x < canvas.width
        && neighbor.y >= 0 && neighbor.y < canvas.height) {
      if (!pixelGrid[neighbor.x][neighbor.y]) {
        if (!isNaN(maxRadius)
            && ((startingX - neighbor.x) ** 2 + (startingY - neighbor.y) ** 2) > squaredRadius) {
          branch.splice(0);
          branches.splice(branches.indexOf(branch), 1);
          return;
        }

        addPixel(
          spawningElement,
          branch,
          neighbor.x,
          neighbor.y,
          mutateHue(randBranchPixel.h, hueVariance),
          mutateSaturation(randBranchPixel.s, saturationVariance),
          mutateLightness(randBranchPixel.l, randBranchPixel.s, lightnessVariance, startingColor.l),
        );
      }
    }
  };

  if (!neighbors.length) {
    removeEl(branch, randBranchPixel);
    if (!branch.length) {
      branches.splice(branches.indexOf(branch), 1);
    }
  }
}

async function erase(spawningElement, x, y, maxRadius, speed) {
  const {branches, pixelGrid} = blooms.get(spawningElement);

  if (x < 0 || y < 0 || x >= pixelGrid.length || y >= pixelGrid[0].length) {
    return;
  }

  if (!pixelGrid[x][y]) {
    return;
  }

  const branch = [];
  branches.push(branch);

  erasePixel(spawningElement, branch, x, y);

  const delayThreshold = isNaN(speed) ? 1000 : Math.round(999 * Math.max(Math.min(speed ** 2, 1), 0) + 1);
  let erasures = 1;

  while (branch.length) {
    eraseBranch(spawningElement, branch, x, y, maxRadius);

    if (erasures % delayThreshold === 0) {
      await step(speed);
    }

    erasures++;
  }
}

async function growImage(spawningElement, x, y, maxRadius, speed) {
  const {branches, pixelGrid} = blooms.get(spawningElement);

  if (x < 0 || y < 0 || x >= pixelGrid.length || y >= pixelGrid[0].length) {
    return;
  }

  if (!pixelGrid[x][y] || !pixelGrid[x][y].imageDataToBeShown) {
    return;
  }

  const {h, s, l} = pixelGrid[x][y];
  const branch = [];
  branches.push(branch);

  addPixel(spawningElement, branch, x, y, h, s, l);

  const delayThreshold = isNaN(speed) ? 1000 : Math.round(999 * Math.max(Math.min(speed ** 2, 1), 0) + 1);
  let growths = 1;

  while (branch.length) {
    growImageBranch(spawningElement, branch, x, y, maxRadius);

    if (growths % delayThreshold === 0) {
      await step(speed);
    }

    growths++;
  }
}

async function grow(spawningElement, x, y, h, s, l, hueVariance, saturationVariance, lightnessVariance, maxRadius, speed) {
  const {branches, pixelGrid} = blooms.get(spawningElement);

  if (x < 0 || y < 0 || x >= pixelGrid.length || y >= pixelGrid[0].length) {
    return;
  }

  if (pixelGrid[x][y]) {
    return;
  }

  const branch = [];
  branches.push(branch);

  blooms.get(spawningElement).startingColor = {h, s, l};

  addPixel(spawningElement, branch, x, y, h, s, l);

  const delayThreshold = isNaN(speed) ? 1000 : Math.round(999 * Math.max(Math.min(speed ** 2, 1), 0) + 1);
  let growths = 1;

  while (branch.length) {
    growBranch(spawningElement, branch, hueVariance, saturationVariance, lightnessVariance, x, y, maxRadius);

    if (growths % delayThreshold === 0) {
      await step(speed);
    }

    growths++;
  }
}

/**
 * Entirely removes the general canvas or the one for the spawning element if specified,
 * preventing any potential retriggers from screen size changes
 * @param {HTMLElement} spawningElement
 */
export function removeCanvas(spawningElement = null) {
  if (blooms.has(spawningElement)) {
    const canvas = blooms.get(spawningElement).canvas;

    if (canvas) {
      if (spawningElement.contains(canvas)) {
        spawningElement.removeChild(canvas.parentElement);
      } else {
        canvas.remove();
      }
    }

    window.removeEventListener("resize", blooms.get(spawningElement).resizeListener);
    blooms.delete(spawningElement);
  }
}

/**
 * Clears the general canvas or the one for the spawning element if specified
 * @param {HTMLElement} spawningElement
 */
export function clearCanvas(spawningElement = null) {
  stopBlooming(spawningElement);
  stopErasing(spawningElement);

  const canvas = blooms.get(spawningElement)?.canvas;

  if (canvas) {
    blooms.get(spawningElement).startingColor = {};
    blooms.get(spawningElement).pixelGrid = undefined;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/**
 * Checks if the general canvas or the one for the spawning element is currently blooming
 * @param {HTMLElement} spawningElement
 * @returns boolean
 */
export function isBlooming(spawningElement = null) {
  if (!blooms.has(spawningElement)) {
    return false;
  }

  const {branches, isErasing} = blooms.get(spawningElement);

  return !isErasing && branches?.length > 0;
}

/**
 * Checks if the general canvas or the one for the spawning element is currently erasing
 * @param {HTMLElement} spawningElement
 * @returns boolean
 */
export function isErasing(spawningElement = null) {
  if (!blooms.has(spawningElement)) {
    return false;
  }

  const {branches, isErasing} = blooms.get(spawningElement);

  return isErasing && branches?.length > 0;
}

/**
 * Stops any ongoing blooming for the general canvas or the one for the spawning element if specified
 * @param {HTMLElement} spawningElement
 */
export function stopBlooming(spawningElement = null) {
  if (!blooms.has(spawningElement)) {
    return false;
  }

  const {branches, isErasing} = blooms.get(spawningElement);

  if (!isErasing && branches?.length) {
    for (const branch of branches) {
      branch.splice(0);
    }

    branches.splice(0);
  }
}

/**
 * Stops any ongoing erasing for the general canvas or the one for the spawning element if specified
 * @param {HTMLElement} spawningElement
 */
export function stopErasing(spawningElement = null) {
  if (!blooms.has(spawningElement)) {
    return false;
  }

  const {branches, isErasing} = blooms.get(spawningElement);

  if (isErasing && branches?.length) {
    for (const branch of branches) {
      branch.splice(0);
    }

    branches.splice(0);
  }
}

/**
 * Erases from the canvas in the same way as bloomColor colors the canvas
 * @param {
 *  x?: number,
 *  y?: number,
 *  spawningElement?: HTMLElement,
 *  maxRadius?: number
 *  speed?: number
 * } options Config options
 * - x: Will be the center of the canvas or aligned with the center of a specified spawning element by default.
 * If you want to erase at mouse coordinates, use `MouseEvent.clientX - spawningElement.getBoundingClientRect().x`
 * if confineToSpawningElement is true, otherwise `(window.screen.width - window.innerWidth) / 2 + MouseEvent.clientX`.
 * - y: Will be the center of the canvas or aligned with the center of a specified spawning element by default.
 * If you want to erase at mouse coordinates, use `MouseEvent.clientY - spawningElement.getBoundingClientRect().y`
 * if confineToSpawningElement is true, otherwise `(window.screen.height - window.innerHeight) / 2 + MouseEvent.clientY`.
 * - spawningElement: The HTML element to spawn the erasure from.  Defaults to `document.body`.
 * - maxRadius: If specified, stops the erasure once any part of it reaches the specified radius.
 * - speed: The speed of the erasure, as a value from 0 to 1.  Defaults to full speed.
 */
export function bloomErase({
  x: bloomX = NaN,
  y: bloomY = NaN,
  spawningElement = document.body,
  maxRadius = NaN,
  speed = NaN,
} = {}) {
  if (!blooms.has(spawningElement) || isBlooming(spawningElement)) {
    return;
  }

  const {x, y, width, height} = spawningElement.getBoundingClientRect();

  const {canvas} = blooms.get(spawningElement);
  const confineToSpawningElement = spawningElement.contains(canvas);

  const spawningElementIsBody = spawningElement === document.body;

  if (isNaN(bloomX)) {
    if (confineToSpawningElement) {
      bloomX = width / 2;
    } else {
      bloomX = (window.screen.width - window.innerWidth) / 2 + (spawningElementIsBody ? 0 : x)
          + (spawningElementIsBody ? window.innerWidth : width) / 2;
    }
  }

  if (isNaN(bloomY)) {
    if (confineToSpawningElement) {
      bloomY = height / 2;
    } else {
      bloomY = (window.screen.height - window.innerHeight) / 2 + (spawningElementIsBody ? 0 : y)
          + (spawningElementIsBody ? window.innerHeight : height) / 2;
    }
  }

  blooms.get(spawningElement).isErasing = true;

  erase(spawningElement, Math.round(bloomX), Math.round(bloomY), maxRadius, speed);
}

/**
 * Downloads the corresponding canvas as an image file
 * @param {HTMLElement} spawningElement
 */
export function saveAsImage(spawningElement = null) {
  const canvas = blooms.get(spawningElement)?.canvas;

  if (canvas) {
    const link = document.createElement('a');
    link.download = 'color-bloom.webp';
    link.href = canvas.toDataURL('image/webp');
    link.click();
    link.remove();
  }
}

function loadImage(src) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = src;

  // return the image once it's loaded
  return new Promise(resolve => {
    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      resolve(null);
    };
  });
}

function imageTo2dArray(loadedImage, widthOverride, heightOverride, canvasWidth, canvasHeight, bloomX, bloomY, imageX, imageY) {
  if (!loadedImage) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = widthOverride || loadedImage.width;
  canvas.height = heightOverride || loadedImage.height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);
  const {data} = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let imageLeft = Math.round(imageX - canvas.width / 2);
  let imageTop = Math.round(imageY - canvas.height / 2);

  const pixelGrid = Array.from({length: canvasWidth}, () => Array.from({length: canvasHeight}));

  for (let i = 0; i < canvas.width; i++) {
    for (let j = 0; j < canvas.height; j++) {
      const x = i + imageLeft;
      const y = j + imageTop;

      if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) {
        continue;
      }

      const index = (j * canvas.width + i) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const a = data[index + 3] / 255;

      let {h, s, l} = rgb2hsl(r, g, b);

      const pixel = {x, y, h, s, l, a, imageDataToBeShown: true};
      pixelGrid[x][y] = pixel;
    }
  }

  return pixelGrid;
}

/**
 * Generates a bloom effect to fill in an image on an HTML canvas
 * @param {{
 *  x?: number,
 *  y?: number,
 *  zIndex?: number,
 *  imageX?: number,
 *  imageY?: number,
 *  widthOverride?: number,
 *  heightOverride?: number,
 *  spawningElement?: HTMLElement,
 *  src: string,
 *  maxRadius?: number
 *  speed?: number
 *  triggerOnLoad?: boolean
 *  retriggerOnScreenSizeChange?: boolean
 *  confineToSpawningElement?: boolean
 * }} options Config options
 * - x: Will be the center of the canvas or aligned with the center of a specified spawning element by default.
 * If you want to bloom at mouse coordinates, use `MouseEvent.clientX - spawningElement.getBoundingClientRect().x`
 * if confineToSpawningElement is true, otherwise `(window.screen.width - window.innerWidth) / 2 + MouseEvent.clientX`.
 * - y: Will be the center of the canvas or aligned with the center of a specified spawning element by default.
 * If you want to bloom at mouse coordinates, use `MouseEvent.clientY - spawningElement.getBoundingClientRect().y`
 * if confineToSpawningElement is true, otherwise `(window.screen.height - window.innerHeight) / 2 + MouseEvent.clientY`.
 * - zIndex: The z-index of the canvas.  Defaults to -1.  Changing this will only really be relevant
 * when confineToSpawningElement is true.
 * - imageX: Will be the center of the canvas or aligned with the center of a specified spawning element by default.
 * If you want the image at mouse coordinates, use `MouseEvent.clientX - spawningElement.getBoundingClientRect().x`
 * if confineToSpawningElement is true, otherwise `(window.screen.width - window.innerWidth) / 2 + MouseEvent.clientX`.
 * - imageY: Will be the center of the canvas or aligned with the center of a specified spawning element by default.
 * If you want the image at mouse coordinates, use `MouseEvent.clientY - spawningElement.getBoundingClientRect().y`
 * if confineToSpawningElement is true, otherwise `(window.screen.height - window.innerHeight) / 2 + MouseEvent.clientY`.
 * - widthOverride: Override the width of the image.  If not provided, the image file's inherent width will be used.
 * To size the image to the spawning element, use `spawningElement.getBoundingClientRect().width`.
 * - heightOverride: Override the height of the image.  If not provided, the image file's inherent height will be used.
 * To size the image to the spawning element, use `spawningElement.getBoundingClientRect().height`.
 * - spawningElement: The HTML element to spawn the bloom from.  Defaults to `document.body`.
 * - src: The URL of the image to bloom.
 * - maxRadius: If specified, stops the bloom once any part of it reaches the specified radius.
 * - speed: The speed of the bloom, as a value from 0 to 1.  Defaults to full speed.
 * - triggerOnLoad: If true, waits until the document loads, if it hasn't already.  For convenience.
 * - retriggerOnScreenSizeChange: On window resize, blooms are automatically cleared if the screen size or container size changes
 * (thus invalidating the generated canvas size).  Set this to true to then retrigger the bloom in such instances.
 * - confineToSpawningElement: If true, the bloom canvas will be contained within the of the spawning element,
 * and the bloom won't extend beyond its bounds.  Will automatically set the spawning element's position style to 'relative'.
 */
export async function bloomImage({
  x: bloomX = NaN,
  y: bloomY = NaN,
  zIndex = -1,
  imageX = NaN,
  imageY = NaN,
  widthOverride = NaN,
  heightOverride = NaN,
  spawningElement = document.body,
  src,
  maxRadius = NaN,
  speed = NaN,
  triggerOnLoad = false,
  retriggerOnScreenSizeChange = false,
  confineToSpawningElement = false,
} = {}) {
  const {x, y, width, height} = spawningElement.getBoundingClientRect();

  if (blooms.has(spawningElement)) {
    if (isErasing(spawningElement)) {
      return;
    }
  } else {
    blooms.set(spawningElement, {branches: []});
  }

  if (confineToSpawningElement) {
    widthOverride = widthOverride || width;
    heightOverride = heightOverride || height;
  }

  let canvas = blooms.get(spawningElement).canvas;

  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = window.screen.width;
    canvas.height = window.screen.height;
    canvas.style.pointerEvents = "none";
    canvas.style.position = "absolute";

    if (confineToSpawningElement) {
      canvas.width = width;
      canvas.height = height;
    }

    blooms.get(spawningElement).canvas = canvas;

    let canvasWrapper = document.getElementById(CANVAS_WRAPPER_ID);

    if (!canvasWrapper || confineToSpawningElement) {
      canvasWrapper = document.createElement("div");

      if (!confineToSpawningElement) {
        canvasWrapper.id = CANVAS_WRAPPER_ID;
      }

      Object.assign(canvasWrapper.style, {
        position: confineToSpawningElement ? "absolute" : "fixed",
        top: "0",
        left: "0",
        zIndex,
        width: confineToSpawningElement ? "100%" : "100vw",
        height: confineToSpawningElement ? "100%" : "100dvh",
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
      });

      if (confineToSpawningElement) {
        spawningElement.style.position = "relative";
        spawningElement.insertBefore(canvasWrapper, spawningElement.firstChild);
      } else {
        document.body.insertBefore(canvasWrapper, document.body.firstChild);
      }
    }

    canvasWrapper.appendChild(canvas);

    blooms.get(spawningElement).resizeListener = debounce(() => {
      let expectedWidth = window.screen.width;
      let expectedHeight = window.screen.height;

      if (confineToSpawningElement) {
        const {width: newWidth, height: newHeight} = spawningElement.getBoundingClientRect();
        expectedWidth = newWidth;
        expectedHeight = newHeight;
      }

      if (canvas.width === expectedWidth && canvas.height === expectedHeight) {
        return;
      }

      canvas.width = expectedWidth;
      canvas.height = expectedHeight;
      clearCanvas(spawningElement);

      if (retriggerOnScreenSizeChange) {
        setTimeout(() => bloomImage(...arguments), 50);
      }
    }, 50);
    window.addEventListener('resize', blooms.get(spawningElement).resizeListener);

    if (triggerOnLoad) {
      // If body not yet loaded, wait for the onload trigger
      if (document.readyState !== "complete") {
        document.body.onload = () => {
          bloomImage(...arguments);
        }

        return;
      }
    }
  }

  const spawningElementIsBody = spawningElement === document.body;

  if (isNaN(bloomX)) {
    if (confineToSpawningElement) {
      bloomX = width / 2;
    } else {
      bloomX = (window.screen.width - window.innerWidth) / 2 + (spawningElementIsBody ? 0 : x)
          + (spawningElementIsBody ? window.innerWidth : width) / 2;
    }
  }

  if (isNaN(imageX)) {
    if (confineToSpawningElement) {
      imageX = width / 2;
    } else {
      imageX = (window.screen.width - window.innerWidth) / 2 + (spawningElementIsBody ? 0 : x)
          + (spawningElementIsBody ? window.innerWidth : width) / 2;
    }
  }

  if (isNaN(bloomY)) {
    if (confineToSpawningElement) {
      bloomY = height / 2;
    } else {
      bloomY = (window.screen.height - window.innerHeight) / 2 + (spawningElementIsBody ? 0 : y)
          + (spawningElementIsBody ? window.innerHeight : height) / 2;
    }
  }

  if (isNaN(imageY)) {
    if (confineToSpawningElement) {
      imageY = height / 2;
    } else {
      imageY = (window.screen.height - window.innerHeight) / 2 + (spawningElementIsBody ? 0 : y)
          + (spawningElementIsBody ? window.innerHeight : height) / 2;
    }
  }

  if (!blooms.get(spawningElement).pixelGrid) {
    const loadedImage = await loadImage(src);

    if (!loadedImage) {
      return;
    }

    blooms.get(spawningElement).pixelGrid =
        imageTo2dArray(loadedImage, widthOverride, heightOverride, canvas.width, canvas.height, bloomX, bloomY, imageX, imageY);
  }

  blooms.get(spawningElement).isErasing = false;

  growImage(spawningElement, Math.round(bloomX), Math.round(bloomY), maxRadius, speed);
}

/**
 * Generates a bloom of color on an HTML canvas
 * @param {{
 *  x?: number,
 *  y?: number,
 *  zIndex?: number,
 *  spawningElement?: HTMLElement,
 *  color?: {h?: number, s?: number, l?: number},
 *  hueVariance?: number,
 *  saturationVariance?: number,
 *  lightnessVariance?: number
 *  maxRadius?: number
 *  speed?: number
 *  triggerOnLoad?: boolean
 *  retriggerOnScreenSizeChange?: boolean
 *  confineToSpawningElement?: boolean
 * }} options Config options
 * - x: Will be the center of the canvas or aligned with the center of a specified spawning element by default.
 * If you want to bloom at mouse coordinates, use `MouseEvent.clientX - spawningElement.getBoundingClientRect().x`
 * if confineToSpawningElement is true, otherwise `(window.screen.width - window.innerWidth) / 2 + MouseEvent.clientX`.
 * - y: Will be the center of the canvas or aligned with the center of a specified spawning element by default.
 * If you want to bloom at mouse coordinates, use `MouseEvent.clientY - spawningElement.getBoundingClientRect().y`
 * if confineToSpawningElement is true, otherwise `(window.screen.height - window.innerHeight) / 2 + MouseEvent.clientY`.
 * - zIndex: The z-index of the canvas.  Defaults to -1.  Changing this will only really be relevant
 * when confineToSpawningElement is true.
 * - spawningElement: The HTML element to spawn the bloom from.  Defaults to `document.body`.
 * - color: The starting color in HSL color space.  Defaults to a random hue, full saturation, and mid lightness.
 * - hueVariance: The amount to mutate the hue by, as a value from 0 to 1.  Defaults to a random value, skewing low.
 * - saturationVariance: The amount to mutate the saturation by, as a value from 0 to 1.  Defaults to 0.1.
 * - lightnessVariance: The amount to mutate the lightness by, as a value from 0 to 1.  Defaults to 0.5.
 * - maxRadius: If specified, stops the bloom once any part of it reaches the specified radius.
 * - speed: The speed of the bloom, as a value from 0 to 1.  Defaults to full speed.
 * - triggerOnLoad: If true, waits until the document loads, if it hasn't already.  For convenience.
 * - retriggerOnScreenSizeChange: On window resize, blooms are automatically cleared if the screen size or container size changes
 * (thus invalidating the generated canvas size).  Set this to true to then retrigger the bloom in such instances.
 * - confineToSpawningElement: If true, the bloom canvas will be contained within the of the spawning element,
 * and the bloom won't extend beyond its bounds.  Will automatically set the spawning element's position style to 'relative'.
 */
export function bloomColor({
  x: bloomX = NaN,
  y: bloomY = NaN,
  zIndex = -1,
  spawningElement = document.body,
  color = {},
  hueVariance = generateHueMutation(),
  saturationVariance = 0.1,
  lightnessVariance = 0.5,
  maxRadius = NaN,
  speed = NaN,
  triggerOnLoad = false,
  retriggerOnScreenSizeChange = false,
  confineToSpawningElement = false,
} = {}) {
  let hue = color.h ?? generateStartingHue();
  let saturation = color.s ?? 1;
  let lightness = color.l ?? 0.5;
  const {x, y, width, height} = spawningElement.getBoundingClientRect();

  if (blooms.has(spawningElement)) {
    if (isErasing(spawningElement)) {
      return;
    }

    if (isBlooming(spawningElement) && blooms.get(spawningElement).startingColor) {
      const {startingColor} = blooms.get(spawningElement);
      if (startingColor.h) {
        hue = startingColor.h;
      }

      if (startingColor.s) {
        saturation = startingColor.s;
      }

      if (startingColor.l) {
        lightness = startingColor.l;
      }
    }
  } else {
    blooms.set(spawningElement, {branches: []});
  }

  let canvas = blooms.get(spawningElement).canvas;

  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = window.screen.width;
    canvas.height = window.screen.height;
    canvas.style.pointerEvents = "none";
    canvas.style.position = "absolute";

    if (confineToSpawningElement) {
      canvas.width = width;
      canvas.height = height;
    }

    blooms.get(spawningElement).canvas = canvas;

    let canvasWrapper = document.getElementById(CANVAS_WRAPPER_ID);

    if (!canvasWrapper || confineToSpawningElement) {
      canvasWrapper = document.createElement("div");

      if (!confineToSpawningElement) {
        canvasWrapper.id = CANVAS_WRAPPER_ID;
      }

      Object.assign(canvasWrapper.style, {
        position: confineToSpawningElement ? "absolute" : "fixed",
        top: "0",
        left: "0",
        zIndex,
        width: confineToSpawningElement ? "100%" : "100vw",
        height: confineToSpawningElement ? "100%" : "100dvh",
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
      });

      if (confineToSpawningElement) {
        spawningElement.style.position = "relative";
        spawningElement.insertBefore(canvasWrapper, spawningElement.firstChild);
      } else {
        document.body.insertBefore(canvasWrapper, document.body.firstChild);
      }
    }

    canvasWrapper.appendChild(canvas);

    blooms.get(spawningElement).resizeListener = debounce(() => {
      let expectedWidth = window.screen.width;
      let expectedHeight = window.screen.height;

      if (confineToSpawningElement) {
        const {width: newWidth, height: newHeight} = spawningElement.getBoundingClientRect();
        expectedWidth = newWidth;
        expectedHeight = newHeight;
      }

      if (canvas.width === expectedWidth && canvas.height === expectedHeight) {
        return;
      }

      canvas.width = expectedWidth;
      canvas.height = expectedHeight;
      clearCanvas(spawningElement);

      if (retriggerOnScreenSizeChange) {
        setTimeout(() => bloomColor(...arguments), 50);
      }
    }, 50);
    window.addEventListener('resize', blooms.get(spawningElement).resizeListener);

    if (triggerOnLoad) {
      // If body not yet loaded, wait for the onload trigger
      if (document.readyState !== "complete") {
        document.body.onload = () => {
          bloomColor(...arguments);
        }

        return;
      }
    }
  }

  if (!blooms.get(spawningElement).pixelGrid) {
    blooms.get(spawningElement).pixelGrid = Array.from({length: canvas.width}, () => Array.from({length: canvas.height}));
  }

  const spawningElementIsBody = spawningElement === document.body;

  if (isNaN(bloomX)) {
    if (confineToSpawningElement) {
      bloomX = width / 2;
    } else {
      bloomX = (window.screen.width - window.innerWidth) / 2 + (spawningElementIsBody ? 0 : x)
          + (spawningElementIsBody ? window.innerWidth : width) / 2;
    }
  }

  if (isNaN(bloomY)) {
    if (confineToSpawningElement) {
      bloomY = height / 2;
    } else {
      bloomY = (window.screen.height - window.innerHeight) / 2 + (spawningElementIsBody ? 0 : y)
          + (spawningElementIsBody ? window.innerHeight : height) / 2;
    }
  }

  blooms.get(spawningElement).isErasing = false;

  grow(spawningElement, Math.round(bloomX), Math.round(bloomY), hue, saturation, lightness,
      hueVariance, saturationVariance, lightnessVariance, maxRadius, speed);
}
