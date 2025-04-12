import React from 'react';
import type { MatchId } from '@archess/shared';

interface WaitingViewProps {
  matchId: MatchId;
}

function WaitingView({ matchId }: WaitingViewProps): React.ReactElement {
  return (
    <div>
      <h3>Match Created: {matchId}</h3>
      <p>Waiting for opponent to join...</p>
    </div>
  );
}

export default WaitingView; 