// Pure zoom math for the evidence photo lightbox (unit-tested, no DOM).

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 6;
export const ZOOM_STEP = 1.4;
export const ZOOM_TOGGLE = 2.5;

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return ZOOM_MIN;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale));
}

/** Discrete zoom in/out (buttons, wheel, keyboard +/−). */
export function stepScale(current: number, dir: 1 | -1): number {
  return clampScale(current * (dir === 1 ? ZOOM_STEP : 1 / ZOOM_STEP));
}

/** Double-click / double-tap: jump between fit and ZOOM_TOGGLE. */
export function toggleScale(current: number): number {
  return current > ZOOM_MIN + 0.01 ? ZOOM_MIN : ZOOM_TOGGLE;
}

/** Continuous pinch zoom: apply a ratio between finger distances. */
export function pinchScale(current: number, ratio: number): number {
  return clampScale(current * ratio);
}

export function isZoomed(scale: number): boolean {
  return scale > ZOOM_MIN + 0.01;
}
