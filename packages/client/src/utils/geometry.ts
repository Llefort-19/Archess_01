/**
 * Calculates the angle in degrees between the positive x-axis and the point (dx, dy).
 * Angle is 0 degrees along the positive x-axis, increasing counter-clockwise.
 * 
 * @param dx - The difference in x-coordinates.
 * @param dy - The difference in y-coordinates.
 * @returns The angle in degrees (0 to 360).
 */
export function calculateAngle(dx: number, dy: number): number {
  // Math.atan2 returns angle in radians from -PI to PI
  // Angle = 0 is along positive x-axis
  // Angle = PI/2 (90 deg) is along positive y-axis
  // Angle = PI (180 deg) is along negative x-axis
  // Angle = -PI/2 (-90 deg) is along negative y-axis
  const radians = Math.atan2(dy, dx);
  
  // Convert radians to degrees
  let degrees = radians * (180 / Math.PI);
  
  // Normalize to 0-360 degrees
  if (degrees < 0) {
    degrees += 360;
  }
  
  return degrees;
} 