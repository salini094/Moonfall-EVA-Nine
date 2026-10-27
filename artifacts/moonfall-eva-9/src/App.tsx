import GameShell from '@/components/GameShell';
import { useMoonfallGame } from '@/game/useMoonfallGame';

export default function App() {
  const game = useMoonfallGame();

  return (
    <GameShell
      canvasRef={game.canvasRef}
      state={game.state}
      oxygen={game.oxygen}
      suit={game.suit}
      seconds={game.seconds}
      elapsed={game.elapsed}
      relays={game.relays}
      dashCooldown={game.dashCooldown}
      objective={game.objective}
      muted={game.muted}
      onPlay={game.onPlay}
      onBegin={game.onBegin}
      onPause={game.onPause}
      onResume={game.onResume}
      onRetry={game.onRetry}
      onTitle={game.onTitle}
      onToggleMute={game.onToggleMute}
      onMove={game.onMove}
      onDash={game.onDash}
    />
  );
}
