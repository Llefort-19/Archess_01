import React from 'react'
import type { TileDefinition } from '@archess/shared'
import './Tile.css' // We'll create this next

interface TileProps {
  tileDef: TileDefinition | undefined // Could be undefined if layout ID is wrong
  x: number
  y: number
  children?: React.ReactNode; // <-- Allow children
  onClick?: (x: number, y: number) => void; // <-- Accept onClick
}

// Basic memoization to prevent unnecessary re-renders of tiles
const Tile = React.memo<TileProps>(function Tile({ tileDef, x, y, children, onClick }) {
  const tileClass = tileDef ? `tile tile-${tileDef.id}` : 'tile tile-unknown'
  // Remove unused variable
  // const tileLabel = tileDef ? tileDef.name : 'Unknown'
  // Add interactive class if onClick is provided
  const interactiveClass = onClick ? 'tile-interactive' : ''; 

  const handleClick = () => {
    onClick?.(x, y)
  }

  return (
    <button // Change div to button
      type="button" // Add type
      className={`${tileClass} ${interactiveClass}`} 
      data-x={x} 
      data-y={y}
      onClick={handleClick} // Use handler
      aria-label={`Tile ${tileDef?.name ?? 'Unknown'} at ${x}, ${y}`} // Add aria-label
    >
       {/* Render children (e.g., the Unit component) inside */} 
       {children} 
    </button> // Change closing tag
  )
})

Tile.displayName = 'Tile'; // Add display name

export default Tile 