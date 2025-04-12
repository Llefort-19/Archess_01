import React from 'react';
import type { Vector2 } from '@archess/shared';
// import { calculateAngle } from '../utils/geometry'; // Assuming utility exists
import './MeleeSwingEffect.css'; // Import CSS for styling

interface MeleeSwingEffectProps {
  attackerPos?: Vector2;
  targetPos?: Vector2;   // Target position determines the *center* angle of the cone
  duration?: number;     // Optional duration in ms
  coneAngleDegrees?: number; // Width of the cone visual
  coneLength?: number;    // Length/range of the cone visual
  angle: number; // Angle in degrees
}

function MeleeSwingEffect({ attackerPos, targetPos, duration = 400, coneAngleDegrees = 90, coneLength = 40 }: MeleeSwingEffectProps): React.ReactElement | null {

  // Guard clause: Don't render if positions are missing
  if (!attackerPos || !targetPos) {
    return null;
  }

  // Calculate the center angle of the cone based on target direction
  const dx = targetPos.x - attackerPos.x;
  const dy = targetPos.y - attackerPos.y;
  // Use atan2 for angle in radians, relative to positive x-axis
  const centerAngleRadians = Math.atan2(dy, dx); 

  // Calculate cone properties in radians
  const coneHalfAngleRadians = (coneAngleDegrees * Math.PI / 180) / 2;

  // Calculate the coordinates of the cone's vertices relative to the attacker (0,0)
  const p1 = { x: 0, y: 0 }; // Attacker position (origin)
  const p2 = {
    x: coneLength * Math.cos(centerAngleRadians - coneHalfAngleRadians),
    y: coneLength * Math.sin(centerAngleRadians - coneHalfAngleRadians),
  };
  const p3 = {
    x: coneLength * Math.cos(centerAngleRadians + coneHalfAngleRadians),
    y: coneLength * Math.sin(centerAngleRadians + coneHalfAngleRadians),
  };

  // Format points string for SVG polygon
  const pointsString = `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;

  // Style for the SVG container (positioning)
  const svgStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${attackerPos.x}px`, // Position SVG top-left at attacker
    top: `${attackerPos.y}px`,
    // SVG size needs to encompass the cone, or use overflow visible
    width: `${coneLength * 2}px`, // Rough estimate, adjust if needed
    height: `${coneLength * 2}px`,
    overflow: 'visible', // Allow polygon to draw outside bounds
    pointerEvents: 'none',
    zIndex: 15, 
  };
  
  // Style for the polygon itself (handled mostly by CSS)
  const polygonStyle: React.CSSProperties = {
     animationDuration: `${duration}ms`, // Pass duration to CSS animation
  };

  return (
    <svg style={svgStyle}>
      <polygon 
        className="melee-swing-effect" // Apply the CSS class for fill/animation
        points={pointsString}
        style={polygonStyle}
      />
    </svg>
  );
}

export default MeleeSwingEffect; 