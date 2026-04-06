/**
 * VisualRenderer - SVG rendering utilities for muscle regions
 * 
 * This module provides functions to render muscle regions as SVG elements
 * with proper elliptical shapes, rotation transforms, and visual effects.
 */

import { MuscleRegion } from '../data/AnatomyModel';

export interface RenderedEllipse {
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation: number;
  fill: string;
  opacity: number;
}

/**
 * Renders a muscle region as an ellipse with rotation transform
 * 
 * @param region - The muscle region to render
 * @param activation - Activation intensity (0-1)
 * @param baseColor - Base color for the muscle
 * @returns Rendered ellipse properties
 */
export function renderMuscleRegion(
  region: MuscleRegion,
  activation: number,
  baseColor: string = '#7C6AFF'
): RenderedEllipse {
  // Calculate center point
  const cx = region.x + region.w / 2;
  const cy = region.y + region.h / 2;
  
  // Calculate radii (use rx if specified, otherwise w/2 and h/2)
  const rx = region.rx || region.w / 2;
  const ry = region.h / 2;
  
  // Calculate opacity based on activation (non-linear mapping)
  const opacity = 0.05 + Math.pow(activation, 0.7) * 0.90;
  
  return {
    id: region.id,
    cx,
    cy,
    rx: Math.max(4, rx),
    ry: Math.max(4, ry),
    rotation: region.rotation,
    fill: baseColor,
    opacity,
  };
}

/**
 * Generates SVG ellipse element string
 * 
 * @param ellipse - Rendered ellipse properties
 * @returns SVG ellipse element as string
 */
export function generateEllipseSVG(ellipse: RenderedEllipse): string {
  return `<ellipse
    id="${ellipse.id}"
    cx="${ellipse.cx}"
    cy="${ellipse.cy}"
    rx="${ellipse.rx}"
    ry="${ellipse.ry}"
    fill="${ellipse.fill}"
    opacity="${ellipse.opacity}"
    transform="rotate(${ellipse.rotation} ${ellipse.cx} ${ellipse.cy})"
  />`;
}

/**
 * Parses rotation angle from SVG transform attribute
 * 
 * @param transform - SVG transform attribute value
 * @returns Rotation angle in degrees, or null if not found
 */
export function parseRotationFromTransform(transform: string): number | null {
  const match = transform.match(/rotate\((-?\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}
