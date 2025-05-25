// src/utils/colorUtils.ts

/**
 * Maps an affinity value (-5 to +5) to a glow color (Red to White).
 * -5: Bright Red (e.g., #FF0000)
 *  0: Dim/Neutral (e.g., #808080 or transparent)
 * +5: Bright White (e.g., #FFFFFF)
 * @param affinity The affinity value, typically -5 to +5.
 * @returns An RGBA color string (e.g., "rgba(255, 0, 0, 0.8)")
 */
export function getAffinityGlowColor(affinity: number): string {
  // Clamp affinity to the valid range [-5, 5]
  affinity = Math.max(-5, Math.min(5, affinity));

  // Normalize affinity to a 0-1 scale, where 0 is -5, 0.5 is 0, 1 is +5
  const normalizedAffinity = (affinity + 5) / 10;

  let r, g, b;

  if (normalizedAffinity < 0.5) {
    // Transition from Red (0) to a Mid-Gray (0.5)
    // Red: 0 -> 0.5, Green: 0 -> 0.5, Blue: 0 -> 0.5
    const factor = normalizedAffinity * 2; // Scales 0-0.5 to 0-1
    r = 255; // Always red for negative affinities
    g = Math.round(255 * factor); // Green increases from 0 to 255
    b = Math.round(255 * factor); // Blue increases from 0 to 255
  } else {
    // Transition from Mid-Gray (0.5) to White (1)
    // Red: 0.5 -> 1, Green: 0.5 -> 1, Blue: 0.5 -> 1
    const factor = (normalizedAffinity - 0.5) * 2; // Scales 0.5-1 to 0-1
    r = Math.round(255 - (255 * (1 - factor))); // Red increases from 0 to 255
    g = Math.round(255 - (255 * (1 - factor))); // Green increases from 0 to 255
    b = 255; // Always blue for positive affinities
  }
  
  // Adjusted for a better visual scale, targeting more pure red/white and less "yellow" in middle.
  // A simpler linear interpolation between RGB values for (R,G,B) might be better
  // Red: (255,0,0) -> (128,128,128) -> (255,255,255)
  
  // Let's use a simpler RGB interpolation that leans into strong red and white:
  if (affinity < 0) {
      // Affinity -5 to 0: Red (255,0,0) to Near White (255,255,255) but with red bias initially
      // (This is a simplified example, fine-tuning colors can be complex)
      const inter = (affinity + 5) / 5; // 0 to 1 for -5 to 0
      r = 255;
      g = Math.round(255 * inter);
      b = Math.round(255 * inter);
  } else if (affinity > 0) {
      // Affinity 0 to +5: Near White (255,255,255) to Pure White (255,255,255)
      // For positive, we are mostly dealing with shades of white/light blue
      const inter = affinity / 5; // 0 to 1 for 0 to +5
      r = Math.round(255);
      g = Math.round(255);
      b = Math.round(255); // Just full white for positive for simplicity for now
  } else {
      // Affinity 0: Neutral / Faint White
      r = g = b = 150; // Dim white
  }


  // Let's refine the color interpolation using HSL for a smoother transition.
  // H: Red is 0, White is not a hue. So direct HSL may not be best.
  // Let's use a simple linear interpolation from Red (255, 0, 0) through Grey (128, 128, 128) to White (255, 255, 255).
  // This approach is more predictable.

  // Normalize affinity from [-5, 5] to [-1, 1]
  const interpValue = affinity / 5; // -1 for -5, 0 for 0, 1 for +5

  if (interpValue < 0) {
      // Negative affinity: interpolate between Red (255, 0, 0) and Mid-Gray (128, 128, 128)
      // `interpValue` goes from -1 to 0. We'll use `1 + interpValue` to go from 0 to 1.
      const factor = 1 + interpValue; // 0 for -1, 1 for 0
      r = 255; // Red stays max
      g = Math.round(128 * factor); // Green goes from 0 to 128
      b = Math.round(128 * factor); // Blue goes from 0 to 128
  } else {
      // Positive affinity: interpolate between Mid-Gray (128, 128, 128) and White (255, 255, 255)
      // `interpValue` goes from 0 to 1.
      const factor = interpValue; // 0 for 0, 1 for 1
      r = Math.round(128 + (127 * factor));
      g = Math.round(128 + (127 * factor));
      b = Math.round(128 + (127 * factor));
  }
  
  // Adjust for a stronger red and brighter white
  if (affinity === -5) return `rgba(255, 0, 0, 1)`; // Pure Red
  if (affinity === 5) return `rgba(255, 255, 255, 1)`; // Pure White
  if (affinity === 0) return `rgba(150, 150, 150, 0.7)`; // Dim Gray for neutral
  
  // For intermediate values:
  if (affinity < 0) { // -4 to -1
      // Red fades to less red, gains some green/blue
      const percent = (affinity + 5) / 5; // 0.2 for -4, 0.8 for -1
      r = 255;
      g = Math.round(255 * percent * 0.4); // Controls how quickly other colors come in
      b = Math.round(255 * percent * 0.4);
  } else { // 1 to 4
      // White with less intensity, gaining clarity towards 5
      const percent = affinity / 5; // 0.2 for 1, 0.8 for 4
      r = Math.round(255 * (0.6 + 0.4 * percent)); // Stay bright, but not full white until 5
      g = Math.round(255 * (0.6 + 0.4 * percent));
      b = Math.round(255 * (0.6 + 0.4 * percent));
  }

  // Final Refinement for Glow Color:
  // Let's use a simpler, more direct approach for the glow that ensures strong red/white/gray.
  // 1. Red from -5 to -1
  // 2. Gray at 0
  // 3. White from 1 to 5

  let alpha = 0.7; // Base opacity for the glow

  if (affinity < 0) {
      // -5 (Red) to -1 (Pale Red/Orange)
      const t = (affinity + 5) / 5; // 0 for -5, 0.8 for -1
      r = 255;
      g = Math.round(t * 100); // Max 80 for -1
      b = Math.round(t * 100); // Max 80 for -1
      alpha = 0.7 + (t * 0.3); // More opaque towards 0
  } else if (affinity > 0) {
      // +1 (Pale White/Blue) to +5 (White)
      const t = affinity / 5; // 0.2 for 1, 1 for 5
      r = Math.round(150 + (105 * t)); // Interpolate from 150 to 255
      g = Math.round(150 + (105 * t));
      b = Math.round(150 + (105 * t));
      alpha = 0.7 + (t * 0.3); // More opaque towards 5
  } else {
      // Affinity 0
      r = g = b = 150; // Neutral Gray
      alpha = 0.7;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}