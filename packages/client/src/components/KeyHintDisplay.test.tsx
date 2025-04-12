import '../setupTests' // Explicitly import setup file for types
import { render, screen, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import KeyHintDisplay from './KeyHintDisplay'
import type { AbilityDefinition } from '@archess/shared'

// Mock data for abilities (Corrected Structure)
const mockAbilities: AbilityDefinition[] = [
  {
    id: 'sword_swing', 
    name: 'Swing', 
    type: 'attack', // Added required property
    description: 'A basic melee swing', // Added required property
    attackType: 'melee', 
    range: 1, 
    damage: 10, 
    cooldown: 1 
  },
  {
    id: 'throw_knife', 
    name: 'Throw', 
    type: 'attack', // Added required property
    description: 'Throws a knife', // Added required property
    attackType: 'direct_projectile', 
    range: 5, 
    damage: 5, 
    cooldown: 2 
  },
  {
    id: 'holy_grenade', 
    name: 'Grenade', 
    type: 'attack', // Added required property
    description: 'Lobs a holy grenade', // Added required property
    attackType: 'aoe_projectile', 
    range: 4, 
    damage: 15, 
    cooldown: 5, 
    aoeRadius: 2 // Replaced areaOfEffect 
  },
]

const keyOrder = ['u', 'i', 'o']

describe('KeyHintDisplay Component', () => {
  it('renders key hints correctly based on props', () => {
    render(<KeyHintDisplay lastKeyPressed={null} keyOrder={keyOrder} unitAbilities={mockAbilities} />)

    // Find hints by ability name (more robust)
    const swingHint = screen.getByText('Swing').closest('.key-hint')
    const throwHint = screen.getByText('Throw').closest('.key-hint')
    const grenadeHint = screen.getByText('Grenade').closest('.key-hint')

    expect(swingHint).toBeInTheDocument()
    expect(throwHint).toBeInTheDocument()
    expect(grenadeHint).toBeInTheDocument()

    // Check key character within each hint (with type assertion)
    expect(within(swingHint! as HTMLElement).getByText('U')).toBeInTheDocument() 
    expect(within(throwHint! as HTMLElement).getByText('I')).toBeInTheDocument()
    expect(within(grenadeHint! as HTMLElement).getByText('O')).toBeInTheDocument()
    
    // Check ability names are rendered (already implicitly checked by finding the hint)
    // Check no hint is active initially
    expect(swingHint).not.toHaveClass('active')
    expect(throwHint).not.toHaveClass('active')
    expect(grenadeHint).not.toHaveClass('active')
  })

  it('highlights the correct key hint when lastKeyPressed is set', () => {
    render(<KeyHintDisplay lastKeyPressed={'i'} keyOrder={keyOrder} unitAbilities={mockAbilities} />)

    const swingHint = screen.getByText('Swing').closest('.key-hint')
    const throwHint = screen.getByText('Throw').closest('.key-hint')
    const grenadeHint = screen.getByText('Grenade').closest('.key-hint')

    // Check 'i' hint (Throw) is active
    expect(throwHint).toHaveClass('active')

    // Check others are not active
    expect(swingHint).not.toHaveClass('active')
    expect(grenadeHint).not.toHaveClass('active')
  })

  it('does not render hints for keys exceeding the number of abilities', () => {
    // Ensure shorterAbilities is correctly typed
    const shorterAbilities: AbilityDefinition[] = [mockAbilities[0]!]; // Use non-null assertion
    const longerKeyOrder = ['u', 'i'] // Two keys
    render(<KeyHintDisplay lastKeyPressed={null} keyOrder={longerKeyOrder} unitAbilities={shorterAbilities} />)

    // Check 'u' (Swing) is rendered
    const swingHint = screen.getByText('Swing').closest('.key-hint')
    expect(swingHint).toBeInTheDocument()
    // Check key character within hint (with type assertion)
    expect(within(swingHint! as HTMLElement).getByText('U')).toBeInTheDocument()

    // Check 'i' (Throw) ability name is NOT rendered because there's no ability at index 1
    expect(screen.queryByText('Throw')).not.toBeInTheDocument()
  })
}) 