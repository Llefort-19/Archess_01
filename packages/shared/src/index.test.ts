import { describe, it, expect } from 'vitest'
import { COMBAT_STATE_UPDATE, MELEE_HIT, PROJECTILE_HIT, COMBAT_END, COMBAT_ACTION, COMBAT_STARTED } from './index'

describe('shared/index exports', () => {
  it('should export event constants correctly', () => {
    expect(COMBAT_STATE_UPDATE).toBe('combatStateUpdate')
    expect(MELEE_HIT).toBe('meleeHit')
    expect(PROJECTILE_HIT).toBe('projectileHit')
    expect(COMBAT_END).toBe('combatEnd')
    expect(COMBAT_ACTION).toBe('combatAction')
    expect(COMBAT_STARTED).toBe('combatStarted')
  })

  // Add more tests here for other exports if needed
}) 