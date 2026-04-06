/**
 * Property-Based Tests for Visual Renderer
 * 
 * Feature: realistic-muscle-heatmap
 * Task: 1.2 Write property test for elliptical region rendering
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  renderMuscleRegion,
  generateEllipseSVG,
  parseRotationFromTransform,
} from './VisualRenderer';
import { MuscleRegion, ALL_REGIONS } from '../data/AnatomyModel';

describe('Visual Renderer - Property-Based Tests', () => {
  /**
   * Property 1: Elliptical Region Rendering
   * 
   * **Validates: Requirements 1.2**
   * 
   * For any muscle region with non-zero activation, the rendered SVG SHALL contain
   * an ellipse element with a rotation transform matching the region's fiber direction angle.
   */
  it('Property 1: Elliptical Region Rendering', () => {
    // Arbitrary generator for muscle regions from the actual anatomy model
    const arbMuscleRegion = fc.constantFrom(...ALL_REGIONS);
    
    // Arbitrary generator for non-zero activation (0.01 to 1.0)
    // Use double() instead of float() to avoid 32-bit float constraints
    const arbNonZeroActivation = fc.double({ 
      min: 0.01, 
      max: 1.0,
      noNaN: true 
    });
    
    fc.assert(
      fc.property(
        arbMuscleRegion,
        arbNonZeroActivation,
        (region: MuscleRegion, activation: number) => {
          // Render the muscle region
          const rendered = renderMuscleRegion(region, activation);
          
          // Generate SVG string
          const svgString = generateEllipseSVG(rendered);
          
          // Verify it's an ellipse element
          expect(svgString).toContain('<ellipse');
          
          // Verify it has a transform attribute with rotation
          expect(svgString).toContain('transform="rotate(');
          
          // Extract and verify the rotation angle matches the region's fiber direction
          const transformMatch = svgString.match(/transform="([^"]+)"/);
          expect(transformMatch).not.toBeNull();
          
          if (transformMatch) {
            const transformValue = transformMatch[1];
            const rotationAngle = parseRotationFromTransform(transformValue);
            
            // The rotation angle must match the region's rotation property
            expect(rotationAngle).toBe(region.rotation);
          }
          
          // Verify the ellipse has proper center coordinates
          expect(rendered.cx).toBe(region.x + region.w / 2);
          expect(rendered.cy).toBe(region.y + region.h / 2);
          
          // Verify the ellipse has proper radii
          const expectedRx = region.rx || region.w / 2;
          expect(rendered.rx).toBe(Math.max(4, expectedRx));
          expect(rendered.ry).toBe(Math.max(4, region.h / 2));
          
          // Verify non-zero activation produces non-zero opacity
          expect(rendered.opacity).toBeGreaterThan(0);
          expect(rendered.opacity).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Zero activation should still render but with minimal opacity
   */
  it('Property: Zero activation renders with minimal opacity', () => {
    const arbMuscleRegion = fc.constantFrom(...ALL_REGIONS);
    
    fc.assert(
      fc.property(
        arbMuscleRegion,
        (region: MuscleRegion) => {
          const rendered = renderMuscleRegion(region, 0);
          
          // Even with zero activation, should have base opacity
          expect(rendered.opacity).toBe(0.05);
          
          // Should still have rotation matching fiber direction
          expect(rendered.rotation).toBe(region.rotation);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property test: Rotation transform includes center point for proper rotation origin
   */
  it('Property: Rotation transform uses ellipse center as origin', () => {
    const arbMuscleRegion = fc.constantFrom(...ALL_REGIONS);
    const arbActivation = fc.double({ min: 0, max: 1.0, noNaN: true });
    
    fc.assert(
      fc.property(
        arbMuscleRegion,
        arbActivation,
        (region: MuscleRegion, activation: number) => {
          const rendered = renderMuscleRegion(region, activation);
          const svgString = generateEllipseSVG(rendered);
          
          // Extract transform attribute
          const transformMatch = svgString.match(/transform="rotate\((-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\)"/);
          expect(transformMatch).not.toBeNull();
          
          if (transformMatch) {
            const [, angle, centerX, centerY] = transformMatch;
            
            // Verify rotation origin matches ellipse center
            expect(parseFloat(centerX)).toBe(rendered.cx);
            expect(parseFloat(centerY)).toBe(rendered.cy);
            expect(parseFloat(angle)).toBe(region.rotation);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property test: All 54+ regions can be rendered without errors
   */
  it('Property: All anatomy model regions render successfully', () => {
    const arbActivation = fc.double({ min: 0, max: 1.0, noNaN: true });
    
    fc.assert(
      fc.property(
        arbActivation,
        (activation: number) => {
          // Render all regions
          const renderedRegions = ALL_REGIONS.map(region => 
            renderMuscleRegion(region, activation)
          );
          
          // Verify we got all regions (actual count from AnatomyModel)
          expect(renderedRegions.length).toBeGreaterThanOrEqual(54);
          
          // Verify each has valid properties
          renderedRegions.forEach(rendered => {
            expect(rendered.cx).toBeGreaterThan(0);
            expect(rendered.cy).toBeGreaterThan(0);
            expect(rendered.rx).toBeGreaterThanOrEqual(4);
            expect(rendered.ry).toBeGreaterThanOrEqual(4);
            expect(rendered.opacity).toBeGreaterThanOrEqual(0);
            expect(rendered.opacity).toBeLessThanOrEqual(1);
            expect(typeof rendered.rotation).toBe('number');
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property test: Activation intensity affects opacity non-linearly
   */
  it('Property: Higher activation produces higher opacity (non-linear)', () => {
    const arbMuscleRegion = fc.constantFrom(...ALL_REGIONS);
    const arbActivation1 = fc.double({ 
      min: 0.1, 
      max: 0.5,
      noNaN: true 
    });
    const arbActivation2 = fc.double({ 
      min: 0.6, 
      max: 1.0,
      noNaN: true 
    });
    
    fc.assert(
      fc.property(
        arbMuscleRegion,
        arbActivation1,
        arbActivation2,
        (region: MuscleRegion, lowActivation: number, highActivation: number) => {
          const renderedLow = renderMuscleRegion(region, lowActivation);
          const renderedHigh = renderMuscleRegion(region, highActivation);
          
          // Higher activation should produce higher opacity
          expect(renderedHigh.opacity).toBeGreaterThan(renderedLow.opacity);
          
          // Both should use the same rotation (fiber direction)
          expect(renderedLow.rotation).toBe(region.rotation);
          expect(renderedHigh.rotation).toBe(region.rotation);
        }
      ),
      { numRuns: 100 }
    );
  });
});
