import React from 'react';
import type { 
    GameObjectId, 
    PlayerId, 
    UnitDefinition, 
    CombatUnitState, 
    ProjectileState, 
    AoEZoneState, 
    Vector2 
} from '@archess/shared';
import MeleeSwingEffect from './MeleeSwingEffect';

// Helper Functions (Copied from CombatView - consider moving to utils)
const calculateAngle = (x: number, y: number): number => {
  if (x === 0 && y === 0) return 0; 
  return (Math.atan2(y, x) * 180) / Math.PI;
};

// Local interface for ActiveMeleeEffect (Copied from CombatView)
interface ActiveMeleeEffect { 
  id: string;
  attackerPos: Vector2;
  targetPos: Vector2;
}

interface CombatArenaProps {
  units: CombatUnitState[];
  projectiles: ProjectileState[];
  activeAoEZones: AoEZoneState[] | undefined; // Can be undefined from combatState
  meleeEffects: ActiveMeleeEffect[];
  unitDefinitions?: Record<string, UnitDefinition>; // Optional
  playerIds: PlayerId[]; // Assuming always at least 2 in combat?
  hitUnitId: GameObjectId | null; // For hit flash effect
  arenaRef: React.RefObject<HTMLDivElement>; // Pass the ref for dimensions/positioning
  width: number;
  height: number;
}

function CombatArena({
  units,
  projectiles,
  activeAoEZones,
  meleeEffects,
  unitDefinitions,
  playerIds,
  hitUnitId,
  arenaRef,
  width,
  height,
}: CombatArenaProps): React.ReactElement {
  return (
    <div
      ref={arenaRef}
      className="combat-arena"
      style={{ width: `${width}px`, height: `${height}px` }}
      aria-label="Combat Arena Background" 
    >
      {/* Render Units */}
      {units.map((unit: CombatUnitState) => { 
        const unitDef = unitDefinitions?.[unit.definitionId];
        // Determine player based on owner ID matching the first player ID
        // Note: This assumes playerIds[0] is always one player and others are opponents.
        // Might need refinement if player order isn't guaranteed.
        const isPlayer1Unit = playerIds[0] && unit.owner === playerIds[0]; 
        const isHit = unit.id === hitUnitId;
        const angle = unit.facingDirection 
            ? calculateAngle(unit.facingDirection.x, unit.facingDirection.y)
            : 0;
         return (
          <div
            key={unit.id}
            className={`combat-unit ${isPlayer1Unit ? 'player-unit' : 'enemy-unit'} ${isHit ? 'hit-effect' : ''}`}
            style={{ 
                left: `${unit.position.x - (unitDef?.hitboxRadius ?? 10)}px`, 
                top: `${unit.position.y - (unitDef?.hitboxRadius ?? 10)}px`,
                width: `${(unitDef?.hitboxRadius ?? 10) * 2}px`,
                height: `${(unitDef?.hitboxRadius ?? 10) * 2}px`,
                transform: `rotate(${angle}deg)`
            }}
            aria-label={`Unit ${unitDef?.name ?? 'Unknown'} at ${unit.position.x}, ${unit.position.y}`}
          >
            <span className="unit-icon">{unitDef?.name?.charAt(0) ?? 'U'}</span>
            <div className="hp-bar-container">
                <div className="hp-bar" style={{ width: `${Math.max(0, (unit.currentHp / (unitDef?.maxHp ?? 100)) * 100)}%` }} />
            </div>
          </div>
        );
      })} 

      {/* Render Projectiles */}
      {projectiles.map((proj: ProjectileState) => {
          let projClass = 'projectile-default';
          if (proj.projectileType === 'aoe_projectile') {
              projClass = 'aoe-projectile';
          } 
           const projStyle: React.CSSProperties = {
              position: 'absolute',
              left: `${proj.position.x}px`,
              top: `${proj.position.y}px`,
              transform: `rotate(${calculateAngle(proj.velocity.x, proj.velocity.y)}deg)`
            };
           return <div key={proj.id} className={`projectile ${projClass}`} style={projStyle} title={`Projectile ${proj.abilityId}`}></div>;
       })} 
       
      {/* Render Melee Swing Effects */}
       {meleeEffects.map((effect: ActiveMeleeEffect) => {
            const angle = effect.attackerPos && effect.targetPos ? calculateAngle(effect.targetPos.x - effect.attackerPos.x, effect.targetPos.y - effect.attackerPos.y) : 0;
            return (
                <MeleeSwingEffect 
                   key={effect.id}
                   attackerPos={effect.attackerPos} 
                   targetPos={effect.targetPos} 
                   duration={400} 
                   angle={angle} 
               />
           );
       })} 

       {/* Render AoE Zones */}
       {activeAoEZones?.map((zone: AoEZoneState) => {
           const zoneStyle: React.CSSProperties = {
               position: 'absolute',
               left: `${zone.position.x - zone.radius}px`,
               top: `${zone.position.y - zone.radius}px`,
               width: `${zone.radius * 2}px`,
               height: `${zone.radius * 2}px`,
               borderRadius: '50%', 
               backgroundColor: 'rgba(255, 0, 0, 0.3)', 
               pointerEvents: 'none',
               zIndex: 10, 
           };
           return (
               <div 
                   key={zone.id}
                   className={`aoe-zone ${zone.visualEffectKey ?? ''}`}
                   style={zoneStyle} 
                   aria-label={`Area effect ${zone.id}`}
               />
           );
       })} 
     </div>
  );
}

export default CombatArena; 