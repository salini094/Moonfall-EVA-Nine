export type GameState =
  | 'title'
  | 'briefing'
  | 'playing'
  | 'paused'
  | 'victory'
  | 'oxygen-failure'
  | 'suit-failure'
  | 'nightfall-failure';

export type Direction = 'up' | 'down' | 'left' | 'right';
export type PickupKind = 'oxygen' | 'repair';

export interface Point {
  x: number;
  y: number;
}

export interface Hazard extends Point {
  id: number;
  radius: number;
  pattern: 'horizontal' | 'vertical' | 'orbit' | 'diagonal';
  anchor: Point;
  range: number;
  speed: number;
  phase: number;
  angle: number;
  spin: number;
  x: number;
  y: number;
}

export interface Pickup extends Point {
  id: number;
  kind: PickupKind;
  collected: boolean;
  phase: number;
}

export interface Relay extends Point {
  id: number;
  activated: boolean;
}

export interface Particle extends Point {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Player extends Point {
  vx: number;
  vy: number;
  facing: number;
}

export interface GameModel {
  state: GameState;
  player: Player;
  hazards: Hazard[];
  pickups: Pickup[];
  relays: Relay[];
  particles: Particle[];
  oxygen: number;
  suit: number;
  seconds: number;
  elapsed: number;
  worldTime: number;
  invulnerable: number;
  dashCooldown: number;
  dashTime: number;
  dashDirection: Point;
  shake: number;
  damageFlash: number;
  notification: string;
  notificationTime: number;
  muted: boolean;
  camera: Point;
}

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 1600;
export const PLAYER_RADIUS = 17;

export const RELAY_LOCATIONS: Point[] = [
  { x: 610, y: 390 },
  { x: 1200, y: 1210 },
  { x: 1710, y: 400 },
];

export const EXTRACTION: Point = { x: 2240, y: 800 };

export const SOLID_ROCKS: Array<Point & { radius: number }> = [
  { x: 340, y: 475, radius: 34 },
  { x: 835, y: 830, radius: 40 },
  { x: 940, y: 420, radius: 29 },
  { x: 1460, y: 970, radius: 43 },
  { x: 1850, y: 720, radius: 35 },
  { x: 2030, y: 1080, radius: 30 },
  { x: 1530, y: 280, radius: 26 },
  { x: 720, y: 1260, radius: 32 },
];

export function createGameModel(muted = false): GameModel {
  return {
    state: 'title',
    player: { x: 160, y: 800, vx: 0, vy: 0, facing: 0 },
    hazards: [
      makeHazard(0, 440, 670, 76, 'horizontal', 170, 0.82, 0.4),
      makeHazard(1, 880, 1090, 67, 'vertical', 190, 0.72, 2.1),
      makeHazard(2, 1390, 570, 81, 'orbit', 126, 0.77, 4.1),
      makeHazard(3, 1620, 1050, 72, 'diagonal', 145, 0.68, 0.9),
      makeHazard(4, 1970, 450, 75, 'horizontal', 155, 0.91, 2.8),
      makeHazard(5, 730, 270, 62, 'orbit', 95, 0.95, 1.7),
      makeHazard(6, 1850, 1320, 70, 'vertical', 130, 0.76, 5.2),
    ],
    pickups: [
      { id: 0, x: 390, y: 820, kind: 'oxygen', collected: false, phase: 0.2 },
      { id: 1, x: 865, y: 690, kind: 'repair', collected: false, phase: 1.4 },
      { id: 2, x: 1090, y: 1420, kind: 'oxygen', collected: false, phase: 2.1 },
      { id: 3, x: 1420, y: 760, kind: 'oxygen', collected: false, phase: 3.5 },
      { id: 4, x: 1880, y: 900, kind: 'repair', collected: false, phase: 4.3 },
      { id: 5, x: 2010, y: 270, kind: 'oxygen', collected: false, phase: 5.2 },
      { id: 6, x: 1570, y: 1370, kind: 'repair', collected: false, phase: 0.8 },
    ],
    relays: RELAY_LOCATIONS.map((point, id) => ({
      ...point,
      id,
      activated: false,
    })),
    particles: [],
    oxygen: 100,
    suit: 100,
    seconds: 90,
    elapsed: 0,
    worldTime: 0,
    invulnerable: 0,
    dashCooldown: 0,
    dashTime: 0,
    dashDirection: { x: 1, y: 0 },
    shake: 0,
    damageFlash: 0,
    notification: '',
    notificationTime: 0,
    muted,
    camera: { x: 0, y: 0 },
  };
}

function makeHazard(
  id: number,
  x: number,
  y: number,
  radius: number,
  pattern: Hazard['pattern'],
  range: number,
  speed: number,
  phase: number,
): Hazard {
  return {
    id,
    x,
    y,
    anchor: { x, y },
    radius,
    pattern,
    range,
    speed,
    phase,
    angle: phase,
    spin: id % 2 === 0 ? 1 : -1,
  };
}

export function activateMission(model: GameModel): void {
  const fresh = createGameModel(model.muted);
  Object.assign(model, fresh, { state: 'playing' as const });
}

export function updateGame(
  model: GameModel,
  dt: number,
  directions: Set<Direction>,
  dashPressed: boolean,
): void {
  if (model.state === 'paused') return;
  model.worldTime += dt;
  model.damageFlash = Math.max(0, model.damageFlash - dt * 2.8);
  model.shake = Math.max(0, model.shake - dt * 22);
  model.notificationTime = Math.max(0, model.notificationTime - dt);
  updateParticles(model, dt);

  if (model.state !== 'playing') {
    updateHazards(model, dt);
    return;
  }

  model.elapsed += dt;
  model.seconds = Math.max(0, model.seconds - dt);
  model.oxygen = Math.max(0, model.oxygen - dt * 0.47);
  model.invulnerable = Math.max(0, model.invulnerable - dt);
  model.dashCooldown = Math.max(0, model.dashCooldown - dt);
  model.dashTime = Math.max(0, model.dashTime - dt);

  const input = directionVector(directions);
  if (input.x || input.y) model.player.facing = Math.atan2(input.y, input.x);

  if (dashPressed && model.dashCooldown <= 0) {
    if (input.x || input.y) {
      model.dashDirection = input;
    } else {
      model.dashDirection = {
        x: Math.cos(model.player.facing),
        y: Math.sin(model.player.facing),
      };
    }
    model.dashTime = 0.23;
    model.dashCooldown = 1.55;
    model.invulnerable = Math.max(model.invulnerable, 0.42);
    burst(model, model.player.x, model.player.y, '#8eeeff', 9);
  }

  const dashSpeed = model.dashTime > 0 ? 690 : 248;
  const acceleration = model.dashTime > 0 ? 2200 : 1320;
  model.player.vx += input.x * acceleration * dt;
  model.player.vy += input.y * acceleration * dt;

  if (input.x === 0) model.player.vx *= Math.exp(-6.8 * dt);
  if (input.y === 0) model.player.vy *= Math.exp(-6.8 * dt);

  const velocityLength = Math.hypot(model.player.vx, model.player.vy);
  if (velocityLength > dashSpeed) {
    model.player.vx = (model.player.vx / velocityLength) * dashSpeed;
    model.player.vy = (model.player.vy / velocityLength) * dashSpeed;
  }

  movePlayer(model, dt);
  updateHazards(model, dt);
  checkPickups(model);
  checkRelays(model);
  checkHazards(model);
  updateCamera(model, dt);

  if (model.relays.every((relay) => relay.activated)) {
    const distance = Math.hypot(
      model.player.x - EXTRACTION.x,
      model.player.y - EXTRACTION.y,
    );
    if (distance < 55) {
      model.state = 'victory';
      model.notification = 'EXTRACTION CONFIRMED';
      model.notificationTime = 4;
      burst(model, EXTRACTION.x, EXTRACTION.y, '#8effd2', 42);
    }
  }

  if (model.oxygen <= 0) model.state = 'oxygen-failure';
  else if (model.suit <= 0) model.state = 'suit-failure';
  else if (model.seconds <= 0) model.state = 'nightfall-failure';
}

function directionVector(directions: Set<Direction>): Point {
  const x =
    (directions.has('right') ? 1 : 0) - (directions.has('left') ? 1 : 0);
  const y =
    (directions.has('down') ? 1 : 0) - (directions.has('up') ? 1 : 0);
  const length = Math.hypot(x, y);
  return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

function movePlayer(model: GameModel, dt: number): void {
  const player = model.player;
  const nextX = clamp(
    player.x + player.vx * dt,
    PLAYER_RADIUS,
    WORLD_WIDTH - PLAYER_RADIUS,
  );
  if (!hitsRock(nextX, player.y)) player.x = nextX;
  else player.vx = 0;

  const nextY = clamp(
    player.y + player.vy * dt,
    PLAYER_RADIUS,
    WORLD_HEIGHT - PLAYER_RADIUS,
  );
  if (!hitsRock(player.x, nextY)) player.y = nextY;
  else player.vy = 0;
}

function hitsRock(x: number, y: number): boolean {
  return SOLID_ROCKS.some(
    (rock) =>
      Math.hypot(x - rock.x, y - rock.y) < rock.radius + PLAYER_RADIUS - 2,
  );
}

function updateHazards(model: GameModel, _dt: number): void {
  const t = model.worldTime;
  const stormPressure =
    model.state === 'playing'
      ? Math.max(0, (30 - model.seconds) / 30) * 0.42
      : 0;
  for (const hazard of model.hazards) {
    const phase = t * hazard.speed * (1 + stormPressure) + hazard.phase;
    if (hazard.pattern === 'horizontal') {
      hazard.x = hazard.anchor.x + Math.sin(phase) * hazard.range;
      hazard.y = hazard.anchor.y + Math.sin(phase * 1.8) * 30;
    } else if (hazard.pattern === 'vertical') {
      hazard.x = hazard.anchor.x + Math.sin(phase * 0.9) * 38;
      hazard.y = hazard.anchor.y + Math.cos(phase) * hazard.range;
    } else if (hazard.pattern === 'orbit') {
      hazard.angle = phase;
      hazard.x = hazard.anchor.x + Math.cos(phase) * hazard.range;
      hazard.y = hazard.anchor.y + Math.sin(phase) * hazard.range * 0.67;
    } else {
      hazard.x = hazard.anchor.x + Math.sin(phase) * hazard.range;
      hazard.y =
        hazard.anchor.y + Math.sin(phase + Math.PI / 2) * hazard.range * 0.72;
    }
  }
}

function checkPickups(model: GameModel): void {
  for (const pickup of model.pickups) {
    if (pickup.collected) continue;
    if (
      Math.hypot(model.player.x - pickup.x, model.player.y - pickup.y) < 37
    ) {
      pickup.collected = true;
      if (pickup.kind === 'oxygen') {
        model.oxygen = Math.min(100, model.oxygen + 28);
        model.notification = 'OXYGEN CANISTER +28%';
        burst(model, pickup.x, pickup.y, '#61eaff', 18);
      } else {
        model.suit = Math.min(100, model.suit + 34);
        model.notification = 'SUIT REPAIRED +34%';
        burst(model, pickup.x, pickup.y, '#ffc96b', 18);
      }
      model.notificationTime = 2.3;
    }
  }
}

function checkRelays(model: GameModel): void {
  for (const relay of model.relays) {
    if (relay.activated) continue;
    if (Math.hypot(model.player.x - relay.x, model.player.y - relay.y) < 54) {
      relay.activated = true;
      const count = model.relays.filter((item) => item.activated).length;
      model.notification =
        count === 3 ? 'ALL RELAYS ONLINE — EXTRACTION OPEN' : `RELAY ${count} ONLINE`;
      model.notificationTime = 3.8;
      burst(model, relay.x, relay.y, '#70f1ff', 32);
    }
  }
}

function checkHazards(model: GameModel): void {
  if (model.invulnerable > 0) return;
  const hit = model.hazards.find(
    (hazard) =>
      Math.hypot(model.player.x - hazard.x, model.player.y - hazard.y) <
      hazard.radius * 0.48 + PLAYER_RADIUS,
  );
  if (!hit) return;

  const dx = model.player.x - hit.x;
  const dy = model.player.y - hit.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  model.player.vx += (dx / length) * 290;
  model.player.vy += (dy / length) * 290;
  model.suit = Math.max(0, model.suit - 17);
  model.oxygen = Math.max(0, model.oxygen - 14);
  model.invulnerable = 1.1;
  model.damageFlash = 0.9;
  model.shake = 10;
  model.notification = 'IMPACT — SUIT -17% · OXYGEN -14%';
  model.notificationTime = 2.1;
  burst(model, model.player.x, model.player.y, '#ff6575', 17);
}

function updateCamera(model: GameModel, dt: number): void {
  const targetX = clamp(model.player.x - 800, 0, WORLD_WIDTH - 1600);
  const targetY = clamp(model.player.y - 450, 0, WORLD_HEIGHT - 900);
  const ease = 1 - Math.exp(-5 * dt);
  model.camera.x += (targetX - model.camera.x) * ease;
  model.camera.y += (targetY - model.camera.y) * ease;
}

function updateParticles(model: GameModel, dt: number): void {
  for (const particle of model.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= Math.exp(-1.8 * dt);
    particle.vy *= Math.exp(-1.8 * dt);
    particle.life -= dt;
  }
  model.particles = model.particles.filter((particle) => particle.life > 0);
}

function burst(
  model: GameModel,
  x: number,
  y: number,
  color: string,
  count: number,
): void {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = 28 + Math.random() * 135;
    const life = 0.45 + Math.random() * 0.65;
    model.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      color,
      size: 1.5 + Math.random() * 4,
    });
  }
}

export function drawWorld(
  canvas: HTMLCanvasElement,
  model: GameModel,
): void {
  const context = canvas.getContext('2d');
  if (!context) return;

  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#080d16';
  context.fillRect(0, 0, width, height);

  const scale = Math.min(width / 1600, height / 900);
  const offsetX = (width - 1600 * scale) / 2;
  const offsetY = (height - 900 * scale) / 2;
  context.save();
  context.translate(offsetX, offsetY);
  context.scale(scale, scale);

  const shakeX = model.shake ? (Math.random() - 0.5) * model.shake : 0;
  const shakeY = model.shake ? (Math.random() - 0.5) * model.shake : 0;
  context.translate(shakeX, shakeY);
  drawSky(context, model.worldTime);

  context.save();
  context.beginPath();
  context.rect(0, 0, 1600, 900);
  context.clip();
  context.translate(-model.camera.x, -model.camera.y);
  drawLunarSurface(context, model.worldTime);
  drawLandmarks(context, model.worldTime);
  drawExtraction(context, model);
  drawRelays(context, model);
  drawPickups(context, model);
  drawHazards(context, model);
  drawParticles(context, model.particles);
  drawAstronaut(context, model);
  drawStorm(context, model);
  context.restore();
  drawCompass(context, model);
  if (model.damageFlash > 0) {
    context.fillStyle = `rgba(255, 54, 76, ${model.damageFlash * 0.2})`;
    context.fillRect(0, 0, 1600, 900);
  }
  if (model.notificationTime > 0 && model.notification) {
    const alpha = Math.min(1, model.notificationTime * 2);
    context.save();
    context.globalAlpha = alpha;
    context.textAlign = 'center';
    context.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillStyle = '#081016';
    roundedRect(context, 560, 94, 480, 40, 9);
    context.fill();
    context.strokeStyle = 'rgba(117, 225, 246, 0.44)';
    context.stroke();
    context.fillStyle = '#9ff5ff';
    context.fillText(model.notification, 800, 119);
    context.restore();
  }
  context.restore();
}

function drawSky(context: CanvasRenderingContext2D, time: number): void {
  const gradient = context.createLinearGradient(0, 0, 0, 900);
  gradient.addColorStop(0, '#050a13');
  gradient.addColorStop(0.57, '#101b2b');
  gradient.addColorStop(1, '#1e2836');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1600, 900);

  for (let i = 0; i < 150; i += 1) {
    const x = seeded(i * 7 + 13) * 1600;
    const y = seeded(i * 17 + 41) * 690;
    const twinkle = 0.45 + Math.sin(time * 1.4 + i) * 0.24;
    context.globalAlpha = twinkle;
    context.fillStyle = i % 7 === 0 ? '#a7e5ff' : '#dce7f7';
    context.fillRect(x, y, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
  }
  context.globalAlpha = 1;

  const earthGlow = context.createRadialGradient(1230, 200, 8, 1230, 200, 150);
  earthGlow.addColorStop(0, 'rgba(102, 183, 255, 0.28)');
  earthGlow.addColorStop(0.42, 'rgba(48, 126, 190, 0.12)');
  earthGlow.addColorStop(1, 'rgba(48, 126, 190, 0)');
  context.fillStyle = earthGlow;
  context.beginPath();
  context.arc(1230, 200, 150, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#8ed1ff';
  context.globalAlpha = 0.9;
  context.beginPath();
  context.arc(1230, 200, 47, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 0.3;
  context.fillStyle = '#e8f5ff';
  context.beginPath();
  context.arc(1215, 185, 43, -0.9, 1.1);
  context.fill();
  context.globalAlpha = 1;
}

function drawLunarSurface(context: CanvasRenderingContext2D, time: number): void {
  context.fillStyle = '#a1a4a8';
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  const terrain = context.createLinearGradient(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  terrain.addColorStop(0, 'rgba(193, 194, 194, 0.42)');
  terrain.addColorStop(0.48, 'rgba(133, 140, 148, 0.08)');
  terrain.addColorStop(1, 'rgba(53, 64, 78, 0.5)');
  context.fillStyle = terrain;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  for (let i = 0; i < 230; i += 1) {
    const x = seeded(i * 5 + 3) * WORLD_WIDTH;
    const y = seeded(i * 9 + 73) * WORLD_HEIGHT;
    const radius = 14 + seeded(i * 13 + 101) * 75;
    drawCrater(context, x, y, radius, i % 2 === 0);
  }

  for (let i = 0; i < 350; i += 1) {
    const x = seeded(i * 19 + 229) * WORLD_WIDTH;
    const y = seeded(i * 23 + 47) * WORLD_HEIGHT;
    const size = 1 + seeded(i * 31 + 11) * 4;
    context.fillStyle = i % 3 ? 'rgba(37, 46, 56, 0.16)' : 'rgba(244, 237, 217, 0.2)';
    context.beginPath();
    context.ellipse(x, y, size * 1.8, size, 0.2, 0, Math.PI * 2);
    context.fill();
  }

  context.strokeStyle = 'rgba(239, 218, 177, 0.12)';
  context.lineWidth = 3;
  context.setLineDash([11, 13]);
  context.beginPath();
  context.moveTo(120, 800);
  context.bezierCurveTo(580, 640, 930, 900, 1190, 1210);
  context.bezierCurveTo(1400, 1260, 1440, 600, 1710, 400);
  context.bezierCurveTo(1910, 270, 2080, 770, 2240, 800);
  context.stroke();
  context.setLineDash([]);
  context.globalAlpha = 0.08 + Math.sin(time * 0.12) * 0.02;
  const haze = context.createRadialGradient(1250, 800, 20, 1250, 800, 1200);
  haze.addColorStop(0, '#7ba3bd');
  haze.addColorStop(1, 'rgba(123, 163, 189, 0)');
  context.fillStyle = haze;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  context.globalAlpha = 1;

  SOLID_ROCKS.forEach((rock, i) => drawBoulder(context, rock.x, rock.y, rock.radius, i));
}

function drawCrater(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  raised: boolean,
): void {
  const gradient = context.createRadialGradient(
    x - radius * 0.24,
    y - radius * 0.25,
    radius * 0.04,
    x,
    y,
    radius,
  );
  gradient.addColorStop(0, raised ? 'rgba(211, 211, 205, 0.12)' : 'rgba(34, 44, 55, 0.31)');
  gradient.addColorStop(0.72, raised ? 'rgba(83, 94, 104, 0.16)' : 'rgba(54, 61, 69, 0.22)');
  gradient.addColorStop(1, raised ? 'rgba(230, 223, 204, 0.27)' : 'rgba(216, 208, 191, 0.3)');
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(x, y, radius, radius * 0.68, 0.08, 0, Math.PI * 2);
  context.fill();
}

function drawBoulder(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  seed: number,
): void {
  context.save();
  context.translate(x, y);
  context.rotate(seeded(seed * 91 + 1) * 2);
  context.fillStyle = 'rgba(38, 44, 52, 0.35)';
  context.beginPath();
  context.ellipse(7, radius * 0.6, radius * 1.3, radius * 0.55, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#616c75';
  context.beginPath();
  context.moveTo(-radius, radius * 0.42);
  context.lineTo(-radius * 0.7, -radius * 0.44);
  context.lineTo(-radius * 0.07, -radius);
  context.lineTo(radius * 0.62, -radius * 0.72);
  context.lineTo(radius, radius * 0.35);
  context.closePath();
  context.fill();
  context.strokeStyle = 'rgba(217, 222, 215, 0.28)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-radius * 0.66, -radius * 0.4);
  context.lineTo(-radius * 0.08, -radius * 0.9);
  context.lineTo(radius * 0.55, -radius * 0.64);
  context.stroke();
  context.restore();
}

function drawLandmarks(context: CanvasRenderingContext2D, time: number): void {
  drawCrashSite(context, 225, 820);
  drawAntenna(context, 1010, 300);
  drawAntenna(context, 1370, 1340);
  drawWreckage(context, 1900, 1200);
  context.save();
  context.globalAlpha = 0.42;
  context.strokeStyle = '#e8d3a7';
  context.setLineDash([6, 12]);
  context.lineWidth = 2;
  context.beginPath();
  context.arc(1195, 1190, 95 + Math.sin(time * 0.7) * 5, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawCrashSite(context: CanvasRenderingContext2D, x: number, y: number): void {
  context.save();
  context.translate(x, y);
  context.rotate(-0.12);
  context.fillStyle = '#55616b';
  roundedRect(context, -72, -31, 139, 58, 12);
  context.fill();
  context.fillStyle = '#dcae5f';
  context.fillRect(-42, -46, 76, 15);
  context.fillStyle = '#8c979d';
  context.fillRect(-89, 23, 174, 8);
  context.strokeStyle = '#d66d56';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(-76, -4);
  context.lineTo(-99, 26);
  context.moveTo(60, -12);
  context.lineTo(82, -35);
  context.stroke();
  context.restore();
}

function drawAntenna(context: CanvasRenderingContext2D, x: number, y: number): void {
  context.save();
  context.translate(x, y);
  context.strokeStyle = '#9ba8b2';
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(0, 25);
  context.lineTo(0, -45);
  context.moveTo(-23, 25);
  context.lineTo(23, 25);
  context.stroke();
  context.strokeStyle = '#d9e1e5';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, -48, 18, -2.5, 2.5);
  context.stroke();
  context.fillStyle = '#d56c64';
  context.beginPath();
  context.arc(0, -46, 5, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawWreckage(context: CanvasRenderingContext2D, x: number, y: number): void {
  context.save();
  context.translate(x, y);
  context.fillStyle = '#5b6570';
  context.beginPath();
  context.moveTo(-40, 18);
  context.lineTo(-24, -23);
  context.lineTo(23, -25);
  context.lineTo(45, 7);
  context.lineTo(29, 22);
  context.closePath();
  context.fill();
  context.strokeStyle = '#c2a66c';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-17, -8);
  context.lineTo(15, -12);
  context.moveTo(-16, 8);
  context.lineTo(21, 6);
  context.stroke();
  context.restore();
}

function drawExtraction(context: CanvasRenderingContext2D, model: GameModel): void {
  const unlocked = model.relays.every((relay) => relay.activated);
  const pulse = 0.5 + Math.sin(model.worldTime * 2.8) * 0.5;
  const x = EXTRACTION.x;
  const y = EXTRACTION.y;
  context.save();
  context.translate(x, y);
  context.shadowBlur = unlocked ? 36 : 18;
  context.shadowColor = unlocked ? '#71ffcd' : '#ff6f76';
  context.strokeStyle = unlocked ? `rgba(118,255,211,${0.62 + pulse * 0.36})` : '#e17779';
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(-49, 34);
  context.lineTo(-49, -45);
  context.quadraticCurveTo(0, -105, 49, -45);
  context.lineTo(49, 34);
  context.stroke();
  context.strokeStyle = unlocked ? 'rgba(123,255,215,0.42)' : 'rgba(238,136,142,0.35)';
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(0, 38, 79, 19, 0, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = unlocked ? '#a4ffdf' : '#ffd3ce';
  context.font = '700 12px ui-monospace, monospace';
  context.textAlign = 'center';
  context.fillText(unlocked ? 'EXTRACTION OPEN' : 'LOCKED · RELAYS REQUIRED', 0, 67);
  context.restore();
}

function drawRelays(context: CanvasRenderingContext2D, model: GameModel): void {
  for (const relay of model.relays) {
    const pulse = 0.5 + Math.sin(model.worldTime * 3 + relay.id) * 0.5;
    context.save();
    context.translate(relay.x, relay.y);
    context.strokeStyle = relay.activated ? '#85f6dc' : '#67e9ff';
    context.globalAlpha = relay.activated ? 0.65 : 0.35 + pulse * 0.32;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, relay.activated ? 42 : 43 + pulse * 8, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
    context.shadowBlur = relay.activated ? 16 : 26;
    context.shadowColor = relay.activated ? '#79f4c4' : '#53eaff';
    context.fillStyle = relay.activated ? '#9affe0' : '#c5fbff';
    roundedRect(context, -14, -29, 28, 58, 5);
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = relay.activated ? '#36bb9a' : '#3e8796';
    context.fillRect(-7, -20, 14, 29);
    context.fillStyle = relay.activated ? '#ffffff' : '#b6faff';
    context.beginPath();
    context.arc(0, -10, relay.activated ? 5 : 3 + pulse * 2, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#a9b3b7';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-21, 30);
    context.lineTo(21, 30);
    context.stroke();
    context.fillStyle = '#e4f4f6';
    context.textAlign = 'center';
    context.font = '700 11px ui-monospace, monospace';
    context.fillText(`RELAY 0${relay.id + 1}`, 0, 56);
    context.restore();
  }
}

function drawPickups(context: CanvasRenderingContext2D, model: GameModel): void {
  for (const pickup of model.pickups) {
    if (pickup.collected) continue;
    const pulse = 0.5 + Math.sin(model.worldTime * 3 + pickup.phase) * 0.5;
    context.save();
    context.translate(pickup.x, pickup.y - pulse * 4);
    context.shadowBlur = 18 + pulse * 12;
    context.shadowColor = pickup.kind === 'oxygen' ? '#4de8ff' : '#ffc86a';
    context.fillStyle = pickup.kind === 'oxygen' ? '#51dbef' : '#f5bd57';
    context.beginPath();
    context.arc(0, 0, 13, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = '#f4f7f4';
    context.lineWidth = 2;
    if (pickup.kind === 'oxygen') {
      context.beginPath();
      context.moveTo(-4, 0);
      context.lineTo(4, 0);
      context.moveTo(0, -5);
      context.lineTo(0, 5);
      context.stroke();
    } else {
      context.beginPath();
      context.moveTo(-4, 0);
      context.lineTo(4, 0);
      context.moveTo(0, -4);
      context.lineTo(0, 4);
      context.stroke();
    }
    context.restore();
  }
}

function drawHazards(context: CanvasRenderingContext2D, model: GameModel): void {
  for (const hazard of model.hazards) {
    context.save();
    context.translate(hazard.x, hazard.y);
    const rotation = model.worldTime * hazard.spin * 0.8;
    context.rotate(rotation);
    context.shadowColor = '#ff716c';
    context.shadowBlur = 17;
    context.fillStyle = '#555965';
    context.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      const radius = hazard.radius * (i % 2 ? 0.73 : 1);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.74;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = '#d76869';
    context.lineWidth = 3;
    context.stroke();
    context.strokeStyle = 'rgba(255, 203, 158, 0.45)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-hazard.radius * 0.38, -hazard.radius * 0.1);
    context.lineTo(hazard.radius * 0.34, hazard.radius * 0.18);
    context.moveTo(hazard.radius * 0.08, -hazard.radius * 0.49);
    context.lineTo(-hazard.radius * 0.12, hazard.radius * 0.44);
    context.stroke();
    context.restore();
  }
}

function drawAstronaut(context: CanvasRenderingContext2D, model: GameModel): void {
  const player = model.player;
  context.save();
  context.translate(player.x, player.y);
  context.rotate(player.facing + Math.PI / 2);

  if (model.invulnerable > 0 && Math.floor(model.worldTime * 18) % 2 === 0) {
    context.globalAlpha = 0.48;
  }
  if (model.dashTime > 0) {
    context.globalAlpha = 0.48;
    context.fillStyle = '#86efff';
    context.beginPath();
    context.ellipse(0, 22, 14, 38, 0, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  }

  context.fillStyle = 'rgba(18, 27, 38, 0.5)';
  context.beginPath();
  context.ellipse(2, 13, 25, 28, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#b48a4d';
  roundedRect(context, -18, -2, 36, 40, 7);
  context.fill();
  context.fillStyle = '#d2d9d8';
  roundedRect(context, -19, -14, 38, 38, 11);
  context.fill();
  context.strokeStyle = '#f2e4bd';
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = '#86949a';
  roundedRect(context, -12, -11, 24, 19, 8);
  context.fill();
  context.shadowBlur = 15;
  context.shadowColor = '#73dfff';
  context.fillStyle = '#83dafa';
  context.beginPath();
  context.ellipse(0, -24, 20, 21, 0, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = '#e0f7fc';
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = 'rgba(9, 25, 41, 0.75)';
  context.beginPath();
  context.ellipse(1, -24, 14, 14, 0.15, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(184, 237, 255, 0.85)';
  context.beginPath();
  context.ellipse(-4, -30, 4, 8, -0.4, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#dae2df';
  context.lineWidth = 7;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(-17, 2);
  context.lineTo(-23, 16);
  context.moveTo(17, 2);
  context.lineTo(23, 16);
  context.moveTo(-9, 34);
  context.lineTo(-11, 45);
  context.moveTo(9, 34);
  context.lineTo(11, 45);
  context.stroke();
  context.restore();
}

function drawParticles(
  context: CanvasRenderingContext2D,
  particles: Particle[],
): void {
  for (const particle of particles) {
    context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    context.fillStyle = particle.color;
    context.shadowColor = particle.color;
    context.shadowBlur = 10;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
  context.shadowBlur = 0;
}

function drawStorm(context: CanvasRenderingContext2D, model: GameModel): void {
  const intensity = Math.max(0, (30 - model.seconds) / 30);
  if (!intensity) return;
  context.save();
  context.globalAlpha = intensity * 0.16;
  const gradient = context.createLinearGradient(0, 0, 1600, 0);
  gradient.addColorStop(0, 'rgba(220, 92, 74, 0)');
  gradient.addColorStop(0.65, 'rgba(218, 99, 77, 0.4)');
  gradient.addColorStop(1, 'rgba(234, 118, 82, 0.62)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1600, 900);
  context.globalAlpha = intensity * 0.52;
  for (let i = 0; i < 40; i += 1) {
    const x = (seeded(i * 9 + Math.floor(model.worldTime * 7)) * 1600 + model.worldTime * (70 + i % 9 * 7)) % 1600;
    const y = seeded(i * 41 + 12) * 900;
    context.strokeStyle = '#e2b89a';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - 27, y + 8);
    context.stroke();
  }
  context.restore();
}

function drawCompass(context: CanvasRenderingContext2D, model: GameModel): void {
  const goal =
    model.relays.find((relay) => !relay.activated) ?? EXTRACTION;
  const dx = goal.x - model.player.x;
  const dy = goal.y - model.player.y;
  const angle = Math.atan2(dy, dx);
  const label = goal === EXTRACTION ? 'EXTRACTION' : 'RELAY';
  context.save();
  context.translate(800, 54);
  context.fillStyle = 'rgba(7, 12, 19, 0.78)';
  roundedRect(context, -90, -23, 180, 46, 23);
  context.fill();
  context.strokeStyle = 'rgba(124, 214, 232, 0.35)';
  context.stroke();
  context.translate(-58, 0);
  context.rotate(angle);
  context.fillStyle = '#9df4ff';
  context.beginPath();
  context.moveTo(12, 0);
  context.lineTo(-6, -7);
  context.lineTo(-2, 0);
  context.lineTo(-6, 7);
  context.closePath();
  context.fill();
  context.restore();
  context.save();
  context.fillStyle = '#b4c8d0';
  context.textAlign = 'left';
  context.font = '700 10px ui-monospace, monospace';
  context.fillText(`${label}  ·  ${Math.round(Math.hypot(dx, dy))} M`, 771, 58);
  context.restore();
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function seeded(value: number): number {
  const sin = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return sin - Math.floor(sin);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
