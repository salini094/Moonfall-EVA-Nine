import { useCallback, useEffect, useRef, useState } from 'react';
import {
  activateMission,
  createGameModel,
  drawWorld,
  EXTRACTION,
  type Direction,
  type GameModel,
  type GameState,
  updateGame,
} from './engine';

export interface GameSnapshot {
  state: GameState;
  oxygen: number;
  suit: number;
  seconds: number;
  relays: number;
  dashCooldown: number;
  elapsed: number;
  muted: boolean;
  notification: string;
  notificationTime: number;
}

const DIRECTIONS: Record<string, Direction> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

export function useMoonfallGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<GameModel>(createGameModel());
  const heldDirections = useRef<Set<Direction>>(new Set());
  const dashRequested = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() =>
    toSnapshot(modelRef.current),
  );

  const refreshSnapshot = useCallback(() => {
    setSnapshot(toSnapshot(modelRef.current));
  }, []);

  const playTone = useCallback(
    (frequency: number, duration = 0.12, type: OscillatorType = 'sine') => {
      const model = modelRef.current;
      if (model.muted || typeof window === 'undefined') return;
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextClass) return;
        const context = audioContext.current ?? new AudioContextClass();
        audioContext.current = context;
        if (context.state === 'suspended') void context.resume();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, context.currentTime);
        gain.gain.setValueAtTime(0.045, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          context.currentTime + duration,
        );
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + duration);
      } catch {
        // Audio is optional; gameplay continues if browser audio is unavailable.
      }
    },
    [],
  );

  const onPlay = useCallback(() => {
    modelRef.current.state = 'briefing';
    refreshSnapshot();
    playTone(520, 0.16);
  }, [playTone, refreshSnapshot]);

  const onBegin = useCallback(() => {
    activateMission(modelRef.current);
    heldDirections.current.clear();
    dashRequested.current = false;
    refreshSnapshot();
    playTone(660, 0.16);
  }, [playTone, refreshSnapshot]);

  const onPause = useCallback(() => {
    if (modelRef.current.state !== 'playing') return;
    modelRef.current.state = 'paused';
    heldDirections.current.clear();
    refreshSnapshot();
  }, [refreshSnapshot]);

  const onResume = useCallback(() => {
    if (modelRef.current.state !== 'paused') return;
    modelRef.current.state = 'playing';
    refreshSnapshot();
  }, [refreshSnapshot]);

  const onRetry = useCallback(() => {
    activateMission(modelRef.current);
    heldDirections.current.clear();
    dashRequested.current = false;
    refreshSnapshot();
    playTone(660, 0.16);
  }, [playTone, refreshSnapshot]);

  const onTitle = useCallback(() => {
    modelRef.current = createGameModel(modelRef.current.muted);
    heldDirections.current.clear();
    dashRequested.current = false;
    refreshSnapshot();
  }, [refreshSnapshot]);

  const onToggleMute = useCallback(() => {
    modelRef.current.muted = !modelRef.current.muted;
    if (!modelRef.current.muted) playTone(540, 0.1);
    refreshSnapshot();
  }, [playTone, refreshSnapshot]);

  const onMove = useCallback((direction: Direction, pressed: boolean) => {
    if (pressed) heldDirections.current.add(direction);
    else heldDirections.current.delete(direction);
  }, []);

  const onDash = useCallback(() => {
    dashRequested.current = true;
  }, []);

  useEffect(() => {
    let frame = 0;
    let lastTime = performance.now();
    let snapshotTime = 0;
    let previousNotification = '';
    let previousRelayCount = 0;
    let previousOxygen = modelRef.current.oxygen;
    let previousSuit = modelRef.current.suit;

    const animate = (now: number) => {
      const dt = Math.min(0.033, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      const model = modelRef.current;
      const previousState = model.state;
      updateGame(model, dt, heldDirections.current, dashRequested.current);
      dashRequested.current = false;

      const relayCount = model.relays.filter((relay) => relay.activated).length;
      if (model.notification && model.notification !== previousNotification) {
        if (model.notification.includes('IMPACT')) playTone(110, 0.23, 'sawtooth');
        else if (model.notification.includes('RELAY')) {
          playTone(790, 0.12);
          window.setTimeout(() => playTone(1040, 0.18), 100);
        } else if (model.notification.includes('OXYGEN')) playTone(930, 0.16);
        else if (model.notification.includes('REPAIRED')) playTone(620, 0.22);
        else if (model.notification.includes('EXTRACTION')) playTone(1040, 0.3);
        previousNotification = model.notification;
      }
      if (relayCount !== previousRelayCount) previousRelayCount = relayCount;
      if (previousOxygen > 25 && model.oxygen <= 25) playTone(150, 0.24, 'triangle');
      if (previousSuit > 25 && model.suit <= 25) playTone(130, 0.24, 'triangle');
      previousOxygen = model.oxygen;
      previousSuit = model.suit;
      if (previousState !== model.state && model.state === 'victory') {
        playTone(620, 0.28);
        window.setTimeout(() => playTone(820, 0.34), 220);
      }

      if (canvasRef.current) drawWorld(canvasRef.current, model);
      snapshotTime += dt;
      if (snapshotTime >= 0.12) {
        snapshotTime = 0;
        setSnapshot(toSnapshot(model));
      }
      frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [playTone]);

  useEffect(() => {
    const ignoreTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (ignoreTarget(event.target)) return;
      const direction = DIRECTIONS[event.code];
      if (direction) {
        heldDirections.current.add(direction);
        event.preventDefault();
      }
      if (event.code === 'Space') {
        if (event.target instanceof HTMLButtonElement) return;
        event.preventDefault();
        if (!event.repeat) dashRequested.current = true;
      }
      if (event.code === 'Escape' && !event.repeat) {
        const model = modelRef.current;
        if (model.state === 'playing') model.state = 'paused';
        else if (model.state === 'paused') model.state = 'playing';
        heldDirections.current.clear();
        refreshSnapshot();
      }
      if (event.code === 'KeyM' && !event.repeat) {
        modelRef.current.muted = !modelRef.current.muted;
        refreshSnapshot();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const direction = DIRECTIONS[event.code];
      if (direction) heldDirections.current.delete(direction);
    };

    const clearInput = () => {
      heldDirections.current.clear();
      dashRequested.current = false;
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearInput);
    document.addEventListener('visibilitychange', clearInput);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearInput);
      document.removeEventListener('visibilitychange', clearInput);
    };
  }, [refreshSnapshot]);

  const nextRelay = modelRef.current.relays.find((relay) => !relay.activated);
  const objective = nextRelay
    ? `Activate rescue relay ${modelRef.current.relays.filter((relay) => relay.activated).length + 1} of 3`
    : `Reach extraction · ${Math.round(
        Math.hypot(
          modelRef.current.player.x - EXTRACTION.x,
          modelRef.current.player.y - EXTRACTION.y,
        ),
      )} m`;

  return {
    canvasRef,
    state: snapshot.state,
    oxygen: snapshot.oxygen,
    suit: snapshot.suit,
    seconds: snapshot.seconds,
    relays: snapshot.relays,
    dashCooldown: snapshot.dashCooldown,
    elapsed: snapshot.elapsed,
    muted: snapshot.muted,
    notification: snapshot.notification,
    notificationTime: snapshot.notificationTime,
    objective,
    onPlay,
    onBegin,
    onPause,
    onResume,
    onRetry,
    onTitle,
    onToggleMute,
    onMove,
    onDash,
  };
}

function toSnapshot(model: GameModel): GameSnapshot {
  return {
    state: model.state,
    oxygen: model.oxygen,
    suit: model.suit,
    seconds: model.seconds,
    relays: model.relays.filter((relay) => relay.activated).length,
    dashCooldown: model.dashCooldown,
    elapsed: model.elapsed,
    muted: model.muted,
    notification: model.notification,
    notificationTime: model.notificationTime,
  };
}
