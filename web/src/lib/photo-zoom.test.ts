import { describe, it, expect } from "vitest";
import {
  clampScale,
  stepScale,
  toggleScale,
  pinchScale,
  isZoomed,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_TOGGLE,
} from "./photo-zoom";

describe("photo zoom math", () => {
  it("clamps below minimum back to fit", () => {
    expect(clampScale(0.4)).toBe(ZOOM_MIN);
    expect(clampScale(Number.NaN)).toBe(ZOOM_MIN);
    expect(clampScale(-3)).toBe(ZOOM_MIN);
  });

  it("clamps above maximum", () => {
    expect(clampScale(99)).toBe(ZOOM_MAX);
  });

  it("steps up and down by the zoom factor", () => {
    expect(stepScale(1, 1)).toBeCloseTo(1.4, 5);
    expect(stepScale(1.4, -1)).toBeCloseTo(1, 5);
    expect(stepScale(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
    expect(stepScale(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
  });

  it("toggles between fit and ZOOM_TOGGLE", () => {
    expect(toggleScale(1)).toBe(ZOOM_TOGGLE);
    expect(toggleScale(ZOOM_TOGGLE)).toBe(ZOOM_MIN);
    expect(toggleScale(4)).toBe(ZOOM_MIN);
  });

  it("applies pinch ratios and stays in range", () => {
    expect(pinchScale(2, 1.5)).toBe(3);
    expect(pinchScale(2, 0.5)).toBe(1);
    expect(pinchScale(ZOOM_MAX, 2)).toBe(ZOOM_MAX);
  });

  it("reports zoomed state just above fit", () => {
    expect(isZoomed(1)).toBe(false);
    expect(isZoomed(1.05)).toBe(true);
  });
});
