import { type PointerEvent, type ReactNode } from 'react';
import type { RefObject } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AudioLines,
  Headphones,
  Pause,
  Play,
  RotateCcw,
  Signal,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import './GameShell.css';

export type GameShellProps = {
  state:
    | 'title'
    | 'briefing'
    | 'playing'
    | 'paused'
    | 'victory'
    | 'oxygen-failure'
    | 'suit-failure'
    | 'nightfall-failure';
  canvasRef: RefObject<HTMLCanvasElement | null>;
  oxygen: number;
  suit: number;
  seconds: number;
  elapsed: number;
  relays: number;
  dashCooldown: number;
  objective: string;
  muted: boolean;
  onPlay: () => void;
  onBegin: () => void;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
  onTitle: () => void;
  onToggleMute: () => void;
  onMove: (direction: 'up' | 'down' | 'left' | 'right', pressed: boolean) => void;
  onDash: () => void;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function Meter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'oxygen' | 'suit';
}) {
  const amount = clamp(value);
  return (
      <div className={`mf-meter mf-meter--${tone}${tone === 'oxygen' && amount <= 25 ? ' is-low' : ''}`}>
      <div className="mf-meter__heading">
        <span>{label}</span>
        <strong>{Math.round(amount)}<small>%</small></strong>
      </div>
      <div
        className="mf-meter__track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(amount)}
      >
        <span style={{ width: `${amount}%` }} />
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  variant = 'primary',
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <button className={`mf-action mf-action--${variant}`} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function Dpad({
  onMove,
  onDash,
  dashCooldown,
}: Pick<GameShellProps, 'onMove' | 'onDash' | 'dashCooldown'>) {
  const hold = (direction: 'up' | 'down' | 'left' | 'right') =>
    (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      onMove(direction, true);
    };
  const release = (direction: 'up' | 'down' | 'left' | 'right') =>
    (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      onMove(direction, false);
    };
  const directions = [
    { direction: 'up' as const, icon: <ArrowUp />, label: 'Move up', position: 'top' },
    { direction: 'left' as const, icon: <ArrowLeft />, label: 'Move left', position: 'left' },
    { direction: 'right' as const, icon: <ArrowRight />, label: 'Move right', position: 'right' },
    { direction: 'down' as const, icon: <ArrowDown />, label: 'Move down', position: 'bottom' },
  ];
  const dashReady = dashCooldown <= 0;

  return (
    <div className="mf-touch-controls" aria-label="Touch movement controls">
      <div className="mf-dpad">
        {directions.map(({ direction, icon, label, position }) => (
          <button
            className={`mf-dpad__key mf-dpad__key--${position}`}
            key={direction}
            type="button"
            aria-label={label}
            onPointerDown={hold(direction)}
            onPointerUp={release(direction)}
            onPointerCancel={release(direction)}
            onLostPointerCapture={() => onMove(direction, false)}
          >
            {icon}
          </button>
        ))}
        <span className="mf-dpad__core" aria-hidden="true" />
      </div>
      <button
        className={`mf-dash ${dashReady ? 'is-ready' : ''}`}
        type="button"
        onClick={onDash}
        disabled={!dashReady}
        aria-label={dashReady ? 'Dash, ready' : `Dash, ${Math.ceil(dashCooldown)} seconds remaining`}
      >
        <span className="mf-dash__ring"><Wind size={21} /></span>
        <span className="mf-dash__label">Dash</span>
        <span className="mf-dash__state">{dashReady ? 'READY' : `${Math.ceil(dashCooldown)}s`}</span>
      </button>
    </div>
  );
}

const endStates = ['victory', 'oxygen-failure', 'suit-failure', 'nightfall-failure'] as const;

export default function GameShell(props: GameShellProps) {
  const {
    state,
    canvasRef,
    oxygen,
    suit,
    seconds,
    elapsed,
    relays,
    dashCooldown,
    objective,
    muted,
    onPlay,
    onBegin,
    onPause,
    onResume,
    onRetry,
    onTitle,
    onToggleMute,
    onMove,
    onDash,
  } = props;
  const isPlaying = state === 'playing';
  const isEnding = endStates.includes(state as (typeof endStates)[number]);
  const endingCopy = {
    victory: {
      eyebrow: 'MISSION COMPLETE',
      title: 'Signal restored.',
      detail: 'The relay is transmitting. Someone is coming home.',
    },
    'oxygen-failure': {
      eyebrow: 'LIFE SUPPORT CRITICAL',
      title: 'Oxygen depleted.',
      detail: 'The moon kept the silence.',
    },
    'suit-failure': {
      eyebrow: 'PRESSURE LOST',
      title: 'Suit integrity failed.',
      detail: 'An EVA suit can only take so much.',
    },
    'nightfall-failure': {
      eyebrow: 'LUNAR NIGHT',
      title: 'The light is gone.',
      detail: 'The surface disappeared before the signal could leave.',
    },
  } as const;
  const ending = isEnding
    ? endingCopy[state as keyof typeof endingCopy]
    : null;

  return (
    <main className={`moonfall ${isPlaying ? 'is-playing' : ''}`} data-state={state}>
      <canvas ref={canvasRef} className="moonfall__canvas" aria-label="Lunar survival game world" />
      <div className="moonfall__grain" aria-hidden="true" />

      {isPlaying && (
        <>
          <header className="mf-hud">
            <div className="mf-hud__identity">
              <span className="mf-mark">E9</span>
              <div>
                <span className="mf-overline">MOONFALL / EVA-9</span>
                <strong>FIELD SYSTEMS</strong>
              </div>
            </div>
            <div className="mf-hud__readouts">
              <Meter label={oxygen <= 25 ? 'Oxygen · LOW' : 'Oxygen'} value={oxygen} tone="oxygen" />
              <Meter label="Suit integrity" value={suit} tone="suit" />
              <div className="mf-readout mf-readout--time">
                <span className="mf-overline">NIGHTFALL</span>
                <strong>{formatTime(seconds)}</strong>
              </div>
              <div className="mf-readout mf-readout--relay">
                <span className="mf-overline">UPLINK RELAYS</span>
                <strong><Signal size={15} /> {relays}<small> / 3</small></strong>
              </div>
            </div>
            <div className="mf-hud__actions">
              <button className="mf-icon-button" type="button" onClick={onToggleMute} aria-label={muted ? 'Turn sound on' : 'Mute sound'}>
                {muted ? <VolumeX size={17} /> : <AudioLines size={17} />}
                <span>{muted ? 'SOUND OFF' : 'SOUND ON'}</span>
              </button>
              <button className="mf-icon-button mf-icon-button--pause" type="button" onClick={onPause} aria-label="Pause mission">
                <Pause size={17} />
                <span>PAUSE <kbd>ESC</kbd></span>
              </button>
            </div>
          </header>

          <div className="mf-objective">
            <span className="mf-objective__index">CURRENT DIRECTIVE</span>
            <p>{objective}</p>
            <span className="mf-objective__line" />
          </div>

          <div className="mf-desktop-controls" aria-label="Keyboard controls">
            <span className="mf-overline">MOVEMENT</span>
            <div className="mf-key-row"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>MOVE</span></div>
            <div className="mf-key-row"><kbd>SPACE</kbd><span>BOOST</span><b className={dashCooldown <= 0 ? 'is-ready' : ''}>{dashCooldown <= 0 ? 'READY' : `${dashCooldown.toFixed(1)}s`}</b></div>
            <div className="mf-key-row"><kbd>M</kbd><span>AUDIO</span></div>
          </div>

          <Dpad onMove={onMove} onDash={onDash} dashCooldown={dashCooldown} />
        </>
      )}

      {state === 'title' && (
        <section className="mf-screen mf-screen--title" aria-label="MOONFALL EVA-9 title screen">
          <div className="mf-topline">
            <span>FIELD LOG 09.17.28</span><span>CRATER / SOUTHERN HIGHLANDS</span><span>COMMS: LOST</span>
          </div>
          <div className="mf-title-layout">
            <div className="mf-title-copy">
              <div className="mf-kicker"><span className="mf-status-dot" /> INDEPENDENT SURVIVAL SIMULATION</div>
              <h1>MOON<span>FALL</span><sup>®</sup></h1>
              <div className="mf-subtitle"><span className="mf-rule" /> EVA-9 <span className="mf-subtitle__sep">/</span> THE LONG WAY HOME</div>
              <p className="mf-title-description">One astronaut. Three relays.<br />A horizon that will not wait.</p>
              <ActionButton onClick={onPlay}><span>Open mission file</span><Play size={16} fill="currentColor" /></ActionButton>
              <p className="mf-enter-hint">A short-form lunar survival experience</p>
            </div>
            <div className="mf-title-signal" aria-hidden="true">
              <div className="mf-orbit mf-orbit--one" />
              <div className="mf-orbit mf-orbit--two" />
              <div className="mf-signal-cross mf-signal-cross--one" />
              <div className="mf-signal-cross mf-signal-cross--two" />
              <div className="mf-title-coordinates">41° 38' S<br />12° 19' E</div>
              <div className="mf-signal-tag">SOUTHERN HIGHLANDS <span>•</span> 04:18:22 UTC</div>
              <div className="mf-signal-core"><span /></div>
            </div>
          </div>
          <footer className="mf-title-footer">
            <div className="mf-footer-brand"><span className="mf-mini-mark">MF</span><span>MISSION ARCHIVE <b>09 / 01</b></span></div>
            <div className="mf-title-note">NO CONTACT. NO EXTRACTION WINDOW.<br /><strong>MOVE BEFORE THE SHADOW.</strong></div>
            <button className="mf-sound-toggle" type="button" onClick={onToggleMute}>
              {muted ? <VolumeX size={15} /> : <Headphones size={15} />}
              {muted ? 'AUDIO MUTED' : 'AUDIO ENABLED'}
            </button>
          </footer>
          <p className="mf-disclaimer">Educational practice simulation. Not affiliated with, endorsed by, or representative of NASA.</p>
        </section>
      )}

      {state === 'briefing' && (
        <section className="mf-screen mf-screen--modal" aria-label="Mission briefing">
          <div className="mf-panel mf-panel--briefing">
            <div className="mf-panel__top"><span>MISSION DOSSIER / EVA-09</span><span>CLASSIFICATION: FIELD</span></div>
            <div className="mf-panel__body">
              <div className="mf-panel__eyebrow"><span className="mf-status-dot" /> LAST TRANSMISSION RECEIVED 04:18 UTC</div>
              <h2>Mission<br /><em>briefing.</em></h2>
              <p className="mf-brief-lead">Your lander is dark. The relay network is the only way to call for extraction.</p>
              <div className="mf-brief-grid">
                <div><span>01 / OBJECTIVE</span><p>Reach the uplink stations and restore the signal.</p></div>
                <div><span>02 / SURVIVAL</span><p>Watch oxygen and suit integrity. The lunar night is closing in.</p></div>
                <div><span>03 / MOVEMENT</span><p>Use <b>W A S D</b> or the touch pad. <b>SPACE</b> triggers a dash.</p></div>
              </div>
              <ActionButton onClick={onBegin}><span>Begin EVA</span><Play size={16} fill="currentColor" /></ActionButton>
              <button className="mf-text-button" type="button" onClick={onTitle}><X size={14} /> Abort and return</button>
            </div>
            <div className="mf-panel__bottom"><span>FIELD PRACTICE SIMULATION</span><span>NOT A FLIGHT INSTRUMENT</span></div>
          </div>
          <p className="mf-disclaimer">Educational practice simulation. Not affiliated with, endorsed by, or representative of NASA.</p>
        </section>
      )}

      {state === 'paused' && (
        <section className="mf-screen mf-screen--modal" aria-label="Mission paused">
          <div className="mf-panel mf-panel--compact">
            <div className="mf-panel__top"><span>FIELD LOG / {formatTime(seconds)}</span><span>MISSION SUSPENDED</span></div>
            <div className="mf-panel__body">
              <div className="mf-panel__eyebrow"><span className="mf-status-dot is-muted" /> ALL SYSTEMS HOLDING</div>
              <h2>Take a<br /><em>breath.</em></h2>
              <p className="mf-brief-lead">The surface is still there when you are ready.</p>
              <ActionButton onClick={onResume}><span>Resume mission</span><Play size={16} fill="currentColor" /></ActionButton>
              <button className="mf-text-button" type="button" onClick={onTitle}><X size={14} /> Return to title</button>
            </div>
            <div className="mf-panel__bottom"><span>MOONFALL / EVA-9</span><span>PAUSED</span></div>
          </div>
          <p className="mf-disclaimer">Educational practice simulation. Not affiliated with, endorsed by, or representative of NASA.</p>
        </section>
      )}

      {isEnding && (
        <section className="mf-screen mf-screen--modal" aria-label="Mission report">
          <div className={`mf-panel mf-panel--compact mf-panel--report ${state === 'victory' ? 'is-victory' : ''}`}>
            <div className="mf-panel__top"><span>MISSION REPORT / EVA-09</span><span>{state === 'victory' ? 'TRANSMISSION RECEIVED' : 'SIGNAL LOST'}</span></div>
            <div className="mf-panel__body">
              <div className="mf-panel__eyebrow"><span className={`mf-status-dot ${state === 'victory' ? '' : 'is-alert'}`} /> {ending?.eyebrow}</div>
              <h2>{ending?.title}</h2>
              <p className="mf-brief-lead">{ending?.detail}</p>
              <div className="mf-report-stats">
                <div><span>SURVIVAL TIME</span><strong>{formatTime(elapsed)}</strong></div>
                <div><span>RELAYS RESTORED</span><strong>{relays}<small> / 3</small></strong></div>
                <div><span>OXYGEN REMAINING</span><strong>{Math.round(oxygen)}<small>%</small></strong></div>
                <div><span>SUIT INTEGRITY</span><strong>{Math.round(suit)}<small>%</small></strong></div>
              </div>
              <ActionButton onClick={onRetry}><span>Retry mission</span><RotateCcw size={16} /></ActionButton>
              <button className="mf-text-button" type="button" onClick={onTitle}><X size={14} /> Return to title</button>
            </div>
            <div className="mf-panel__bottom"><span>EDUCATIONAL PRACTICE SIMULATION</span><span>NOT AFFILIATED WITH NASA</span></div>
          </div>
          <p className="mf-disclaimer">Educational practice simulation. Not affiliated with, endorsed by, or representative of NASA.</p>
        </section>
      )}
    </main>
  );
}
