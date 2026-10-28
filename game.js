const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const healthEl = document.getElementById("health");
const healthBarEl = document.getElementById("healthBar");
const ammoEl = document.getElementById("ammo");
const weaponEl = document.getElementById("weapon");
const waveEl = document.getElementById("wave");
const bossHud = document.getElementById("bossHud");
const bossHealthBarEl = document.getElementById("bossHealthBar");
const pauseButton = document.getElementById("pauseButton");
const overlay = document.getElementById("screenOverlay");
const overlayTitle = document.getElementById("screenTitle");
const overlayMessage = document.getElementById("screenMessage");
const overlayActions = document.getElementById("screenActions");

const keys = {};
let audioCtx = null;
let muted = false;
let nextEntityId = 0;

const world = {
  width: 3700,
  gravity: 0.52,
};

const platforms = [
  { x: 0, y: 500, w: 560, h: 40 },
  { x: 700, y: 470, w: 330, h: 70 },
  { x: 1190, y: 440, w: 330, h: 100 },
  { x: 1680, y: 500, w: 310, h: 40 },
  { x: 2160, y: 420, w: 330, h: 120 },
  { x: 2660, y: 470, w: 310, h: 70 },
  { x: 3140, y: 500, w: 540, h: 40 },
];

const goal = { x: 3540, y: 360, w: 48, h: 140 };
const wavePlan = [
  {
    triggerX: 400,
    enemies: [
      { x: 760, y: 440, minX: 720, maxX: 1000, speed: 1.25, health: 2 },
      { x: 1240, y: 410, minX: 1210, maxX: 1480, speed: 1.35, health: 2 },
      { x: 1370, y: 410, minX: 1210, maxX: 1480, speed: 1.2, health: 2 },
    ],
  },
  {
    triggerX: 1650,
    enemies: [
      { x: 1740, y: 470, minX: 1710, maxX: 1960, speed: 1.5, health: 3 },
      { x: 2200, y: 390, minX: 2190, maxX: 2460, speed: 1.45, health: 3 },
      { x: 1800, y: 470, minX: 1710, maxX: 1960, speed: 1.8, health: 2, type: "runner" },
    ],
  },
  {
    triggerX: 2600,
    enemies: [
      { x: 2720, y: 440, minX: 2690, maxX: 2940, speed: 1.6, health: 3 },
      { x: 2780, y: 440, minX: 2690, maxX: 2940, speed: 1.8, health: 3 },
      { x: 3210, y: 470, minX: 3170, maxX: 3620, speed: 2, health: 2, type: "runner" },
    ],
  },
];

const game = {
  score: 0,
  state: "start",
  cameraX: 0,
  cameraY: 0,
  shake: 0,
  waveIndex: 0,
  bossDefeated: false,
  bossIntroFrames: 0,
  kills: 0,
  titleTime: 0,
};

const player = {
  x: 90,
  y: 100,
  w: 32,
  h: 42,
  vx: 0,
  vy: 0,
  speed: 5,
  jumpStrength: 16,
  onGround: false,
  facing: 1,
  health: 100,
  maxHealth: 100,
  ammo: 72,
  maxAmmo: 120,
  weapon: "Service pistol",
  fireDelay: 14,
  pierce: 0,
  shootCooldown: 0,
  hitCooldown: 0,
};

let zombies = [];
let bullets = [];
let bossBullets = [];
let pickups = [];
let particles = [];
let boss = null;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rectsIntersect(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function ensureAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function playTone(freq, duration = 0.08, type = "square", volume = 0.03) {
  if (muted) return;
  ensureAudio();
  if (!audioCtx) return;

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = freq;
  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
}

function updateHud() {
  scoreEl.textContent = game.score;
  healthEl.textContent = Math.ceil(player.health);
  healthBarEl.style.width = `${(player.health / player.maxHealth) * 100}%`;
  healthBarEl.parentElement.setAttribute("aria-valuenow", Math.ceil(player.health));
  healthBarEl.classList.toggle("low", player.health <= 30);
  ammoEl.textContent = player.ammo;
  weaponEl.textContent = player.weapon;
  waveEl.textContent = boss
    ? "BOSS"
    : `${Math.max(1, Math.min(game.waveIndex, wavePlan.length))} / ${wavePlan.length}`;
  bossHud.hidden = !boss;
  if (boss) bossHealthBarEl.style.width = `${(boss.health / boss.maxHealth) * 100}%`;
}

function makeZombie(config) {
  const type = config.type || "walker";
  return {
    id: nextEntityId++,
    x: config.x,
    y: config.y,
    w: type === "runner" ? 30 : 34,
    h: 30,
    minX: config.minX,
    maxX: config.maxX,
    vx: config.speed,
    health: config.health,
    type,
  };
}

function makeBoss() {
  return {
    id: nextEntityId++,
    x: 3220,
    y: 380,
    w: 82,
    h: 90,
    minX: 3180,
    maxX: 3560,
    vx: 1.65,
    health: 18,
    maxHealth: 18,
    attackCooldown: 75,
  };
}

function resetGame() {
  player.x = 90;
  player.y = 100;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.facing = 1;
  player.health = player.maxHealth;
  player.ammo = 72;
  player.weapon = "Service pistol";
  player.fireDelay = 14;
  player.pierce = 0;
  player.shootCooldown = 0;
  player.hitCooldown = 0;

  game.score = 0;
  game.cameraX = 0;
  game.cameraY = 0;
  game.shake = 0;
  game.waveIndex = 0;
  game.bossDefeated = false;
  game.bossIntroFrames = 0;
  game.kills = 0;

  zombies = [];
  bullets = [];
  bossBullets = [];
  pickups = [];
  particles = [];
  boss = null;
  setScreen("playing");
}

function setScreen(state) {
  game.state = state;
  overlay.hidden = state === "playing";
  if (state === "start") {
    overlayTitle.textContent = "NIGHTFALL";
    overlayMessage.innerHTML = "The last extraction point is beyond the dead.<br>Fight through the waves. Reach the beacon.";
    setActions([["Start game", "start"]]);
  } else if (state === "paused") {
    overlayTitle.textContent = "PAUSED";
    overlayMessage.textContent = "Catch your breath. The night can wait.";
    setActions([["Resume", "resume"], ["Quit to title", "quit"]]);
  } else if (state === "gameover") {
    overlayTitle.textContent = "OVERRUN";
    overlayMessage.textContent = `Score: ${game.score} · Made it to wave ${Math.min(game.waveIndex + 1, wavePlan.length)}.`;
    setActions([["Try again", "restart"], ["Main menu", "menu"]]);
  } else if (state === "victory") {
    overlayTitle.textContent = "EXTRACTION COMPLETE";
    overlayMessage.textContent = `You made it out alive. Final score: ${game.score}.`;
    setActions([["Play again", "restart"], ["Main menu", "menu"]]);
  }
  updateHud();
}

function setActions(actions) {
  overlayActions.replaceChildren();
  for (const [label, action] of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.action = action;
    overlayActions.append(button);
  }
}

function shoot() {
  if (game.state !== "playing" || player.shootCooldown > 0) return;
  if (player.ammo <= 0) {
    playTone(150, 0.04, "square", 0.012);
    player.shootCooldown = 12;
    return;
  }

  player.ammo -= 1;
  player.shootCooldown = player.fireDelay;
  bullets.push({
    x: player.x + player.w / 2 + player.facing * 16,
    y: player.y + player.h / 2 - 3,
    w: 12,
    h: 5,
    vx: player.facing * 12,
    pierce: player.pierce,
    hitIds: new Set(),
  });
  playTone(420, 0.045, "square", 0.02);
  updateHud();
}

function spawnParticles(x, y, count, color, speed = 5) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      life: 22 + Math.random() * 24,
      maxLife: 46,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.035;
    particle.life -= 1;
    if (particle.life <= 0) particles.splice(i, 1);
  }
}

function handleInput() {
  const left = keys.a || keys.arrowleft;
  const right = keys.d || keys.arrowright;
  player.vx = 0;

  if (left) {
    player.vx = -player.speed;
    player.facing = -1;
  }
  if (right) {
    player.vx = player.speed;
    player.facing = 1;
  }
  if ((keys.w || keys.arrowup || keys[" "]) && player.onGround) {
    player.vy = -player.jumpStrength;
    player.onGround = false;
  }
  if (keys.j || keys.k || keys.l) shoot();
}

function updatePlayer() {
  if (player.hitCooldown > 0) player.hitCooldown -= 1;
  if (player.shootCooldown > 0) player.shootCooldown -= 1;

  handleInput();
  player.vy = Math.min(player.vy + world.gravity, 16);

  const prevX = player.x;
  const prevY = player.y;
  player.x += player.vx;
  for (const platform of platforms) {
    if (!rectsIntersect(player, platform)) continue;
    if (player.vx > 0 && prevX + player.w <= platform.x + 8) player.x = platform.x - player.w;
    if (player.vx < 0 && prevX >= platform.x + platform.w - 8) player.x = platform.x + platform.w;
  }

  player.y += player.vy;
  player.onGround = false;
  for (const platform of platforms) {
    if (!rectsIntersect(player, platform)) continue;
    if (player.vy > 0 && prevY + player.h <= platform.y + 24) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.onGround = true;
    } else if (player.vy < 0 && prevY >= platform.y + platform.h - 12) {
      player.y = platform.y + platform.h;
      player.vy = 0;
    }
  }

  if (player.y > canvas.height + 120) {
    damagePlayer(100);
    return;
  }
  player.x = clamp(player.x, 0, world.width - player.w);
  player.y = clamp(player.y, 0, canvas.height + 200);

  const cameraTarget = clamp(player.x - canvas.width * 0.38, 0, world.width - canvas.width);
  game.cameraX += (cameraTarget - game.cameraX) * 0.085;
  game.cameraY += (clamp(player.y - canvas.height * 0.58, -18, 30) - game.cameraY) * 0.06;
}

function damagePlayer(amount) {
  if (player.hitCooldown > 0 || game.state !== "playing") return;
  player.health = Math.max(0, player.health - amount);
  player.hitCooldown = 48;
  player.vy = -7;
  game.shake = Math.max(game.shake, 10);
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 12, "#ff7373", 7);
  playTone(115, 0.09, "sawtooth", 0.05);
  updateHud();
  if (player.health <= 0) setScreen("gameover");
}

function startNextWave() {
  if (game.waveIndex >= wavePlan.length || zombies.length > 0) return;
  const wave = wavePlan[game.waveIndex];
  if (player.x < wave.triggerX) return;

  zombies = wave.enemies.map(makeZombie);
  game.waveIndex += 1;
  spawnParticles(player.x + player.w / 2, player.y - 20, 16, "#67e8b4", 3);
  updateHud();
  playTone(260, 0.2, "triangle", 0.04);
}

function dropPickup(x, y, type) {
  pickups.push({
    x: x - 12,
    y: y - 20,
    w: 24,
    h: 24,
    type,
    vy: -2,
    life: 900,
  });
}

function defeatZombie(index) {
  const zombie = zombies[index];
  zombies.splice(index, 1);
  game.score += zombie.type === "runner" ? 15 : 10;
  game.kills += 1;
  spawnParticles(zombie.x + zombie.w / 2, zombie.y + zombie.h / 2, 12, "#9bd66f", 6);
  if (game.kills % 4 === 0) dropPickup(zombie.x, zombie.y, "health");
  else if (game.kills % 2 === 0) dropPickup(zombie.x, zombie.y, "ammo");
  else if (game.kills === 1 || game.kills === 5) {
    dropPickup(zombie.x, zombie.y, game.kills === 1 ? "rapid" : "piercing");
  }
  playTone(620, 0.06, "triangle", 0.025);
  updateHud();
}

function updateZombies() {
  startNextWave();
  for (const zombie of zombies) {
    zombie.x += zombie.vx;
    if (zombie.x <= zombie.minX || zombie.x + zombie.w >= zombie.maxX) {
      zombie.vx *= -1;
      zombie.x = clamp(zombie.x, zombie.minX, zombie.maxX - zombie.w);
    }
    if (rectsIntersect(player, zombie)) {
      damagePlayer(zombie.type === "runner" ? 18 : 14);
      if (game.state !== "playing") return;
      player.x = clamp(player.x + (player.x < zombie.x ? -20 : 20), 0, world.width - player.w);
    }
  }

  if (game.waveIndex === wavePlan.length && zombies.length === 0 && !boss && !game.bossDefeated) {
    game.bossIntroFrames += 1;
    if (game.bossIntroFrames > 70) {
      boss = makeBoss();
      game.shake = 12;
      playTone(75, 0.45, "sawtooth", 0.06);
      updateHud();
    }
  }

  if (!boss) return;
  boss.x += boss.vx;
  if (boss.x <= boss.minX || boss.x + boss.w >= boss.maxX) {
    boss.vx *= -1;
    boss.x = clamp(boss.x, boss.minX, boss.maxX - boss.w);
  }
  boss.attackCooldown -= 1;
  if (boss.attackCooldown <= 0) {
    const dx = player.x + player.w / 2 - (boss.x + boss.w / 2);
    const dy = player.y + player.h / 2 - (boss.y + boss.h / 2);
    const distance = Math.max(1, Math.hypot(dx, dy));
    bossBullets.push({
      x: boss.x + boss.w / 2 - 8,
      y: boss.y + boss.h / 2 - 7,
      w: 16,
      h: 14,
      vx: (dx / distance) * 3.8,
      vy: (dy / distance) * 3.8,
    });
    boss.attackCooldown = 82;
    playTone(180, 0.1, "sawtooth", 0.025);
  }
  if (rectsIntersect(player, boss)) {
    damagePlayer(22);
    if (game.state === "playing") player.x = clamp(player.x + (player.x < boss.x ? -28 : 28), 0, world.width - player.w);
  }
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.x += bullet.vx;
    if (bullet.x < 0 || bullet.x > world.width) {
      bullets.splice(i, 1);
      continue;
    }

    let removeBullet = false;
    for (let j = zombies.length - 1; j >= 0; j--) {
      const zombie = zombies[j];
      if (bullet.hitIds.has(zombie.id) || !rectsIntersect(bullet, zombie)) continue;
      bullet.hitIds.add(zombie.id);
      zombie.health -= 1;
      spawnParticles(bullet.x, bullet.y, 5, "#f8d66d", 4);
      if (zombie.health <= 0) defeatZombie(j);
      if (bullet.pierce > 0) bullet.pierce -= 1;
      else {
        removeBullet = true;
        break;
      }
    }

    if (!removeBullet && boss && !bullet.hitIds.has(boss.id) && rectsIntersect(bullet, boss)) {
      bullet.hitIds.add(boss.id);
      boss.health -= 1;
      spawnParticles(bullet.x, bullet.y, 7, "#f8d66d", 4);
      if (boss.health <= 0) {
        game.score += 100;
        game.bossDefeated = true;
        boss = null;
        bossBullets = [];
        game.shake = 16;
        spawnParticles(2310, 420, 36, "#ffad42", 9);
        playTone(880, 0.22, "square", 0.05);
        updateHud();
      } else {
        updateHud();
      }
      if (bullet.pierce > 0) bullet.pierce -= 1;
      else removeBullet = true;
    }
    if (removeBullet) bullets.splice(i, 1);
  }
}

function updateBossBullets() {
  for (let i = bossBullets.length - 1; i >= 0; i--) {
    const bullet = bossBullets[i];
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    if (
      bullet.x + bullet.w < game.cameraX - 100 ||
      bullet.x > game.cameraX + canvas.width + 100 ||
      bullet.y < -50 ||
      bullet.y > canvas.height + 100
    ) {
      bossBullets.splice(i, 1);
      continue;
    }
    if (rectsIntersect(player, bullet)) {
      bossBullets.splice(i, 1);
      damagePlayer(12);
      if (game.state !== "playing") return;
    }
  }
}

function applyPickup(pickup) {
  if (pickup.type === "health") {
    player.health = Math.min(player.maxHealth, player.health + 30);
    spawnParticles(pickup.x, pickup.y, 12, "#68f0a8");
    playTone(720, 0.1, "sine", 0.035);
  } else if (pickup.type === "ammo") {
    player.ammo = Math.min(player.maxAmmo, player.ammo + 28);
    spawnParticles(pickup.x, pickup.y, 10, "#f8d66d");
    playTone(520, 0.08, "triangle", 0.03);
  } else if (pickup.type === "rapid") {
    player.weapon = "Rapid fire";
    player.fireDelay = 6;
    player.pierce = 0;
    player.ammo = Math.min(player.maxAmmo, player.ammo + 18);
    spawnParticles(pickup.x, pickup.y, 16, "#6fdcff");
    playTone(780, 0.12, "triangle", 0.04);
  } else if (pickup.type === "piercing") {
    player.weapon = "Piercing rounds";
    player.fireDelay = 12;
    player.pierce = 2;
    player.ammo = Math.min(player.maxAmmo, player.ammo + 18);
    spawnParticles(pickup.x, pickup.y, 16, "#c08bff");
    playTone(680, 0.12, "triangle", 0.04);
  }
  updateHud();
}

function updatePickups() {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pickup = pickups[i];
    pickup.vy = Math.min(pickup.vy + 0.18, 5);
    pickup.y += pickup.vy;
    for (const platform of platforms) {
      if (rectsIntersect(pickup, platform) && pickup.y + pickup.h - pickup.vy <= platform.y + 8) {
        pickup.y = platform.y - pickup.h;
        pickup.vy = 0;
      }
    }
    pickup.life -= 1;
    if (pickup.life <= 0) {
      pickups.splice(i, 1);
    } else if (rectsIntersect(player, pickup)) {
      applyPickup(pickup);
      pickups.splice(i, 1);
    }
  }
}

function checkVictory() {
  if (game.bossDefeated && rectsIntersect(player, goal)) setScreen("victory");
}

function update() {
  if (game.state !== "playing") {
    game.titleTime += 1;
    updateParticles();
    game.shake *= 0.86;
    return;
  }

  updatePlayer();
  if (game.state !== "playing") return;
  updateZombies();
  updateBullets();
  updateBossBullets();
  updatePickups();
  updateParticles();
  checkVictory();
  game.shake *= 0.86;
}

function drawBackground(cameraX, cameraY) {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#091522");
  sky.addColorStop(0.55, "#121d30");
  sky.addColorStop(1, "#050b12");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#e9f6ff";
  ctx.beginPath();
  ctx.arc(150 - cameraX * 0.08, 115 - cameraY * 0.1, 42, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 60; i++) {
    const x = ((((i * 101) - cameraX * 0.18) % (canvas.width + 120)) + canvas.width + 120) % (canvas.width + 120);
    const y = ((i * 47) % 180) - cameraY * 0.12;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillRect(x, y, 2, 2);
  }

  for (let i = 0; i < 10; i++) {
    const hillX = i * 220 - cameraX * 0.35;
    ctx.fillStyle = "#152c3d";
    ctx.beginPath();
    ctx.moveTo(hillX, canvas.height);
    ctx.quadraticCurveTo(hillX + 80, 300 - cameraY * 0.3, hillX + 170, canvas.height);
    ctx.closePath();
    ctx.fill();
  }
}

function drawShadow(x, y, width) {
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.beginPath();
  ctx.ellipse(x, y, width * 0.58, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlatforms(cameraX, cameraY) {
  for (const platform of platforms) {
    const x = platform.x - cameraX;
    const y = platform.y - cameraY;
    ctx.fillStyle = "#263748";
    ctx.fillRect(x, y, platform.w, platform.h);
    ctx.fillStyle = "#52677b";
    ctx.fillRect(x, y, platform.w, 8);
    ctx.fillStyle = "rgba(0,0,0,0.24)";
    ctx.fillRect(x, y + 8, platform.w, 4);
  }

  const goalX = goal.x - cameraX;
  const pulse = 0.7 + Math.sin(game.titleTime * 0.06) * 0.2;
  ctx.shadowColor = "#67e8b4";
  ctx.shadowBlur = 18 * pulse;
  ctx.fillStyle = "#67e8b4";
  ctx.fillRect(goalX, goal.y - cameraY, goal.w, goal.h);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#dafcec";
  ctx.fillRect(goalX + 8, goal.y - cameraY, 5, goal.h);
}

function drawPlayer(cameraX, cameraY) {
  const x = player.x - cameraX;
  const y = player.y - cameraY;
  drawShadow(x + player.w / 2, y + player.h + 3, player.w);
  ctx.fillStyle = player.hitCooldown > 0 && Math.floor(player.hitCooldown / 4) % 2 ? "#ffffff" : "#d7fbe8";
  ctx.fillRect(x, y, player.w, player.h);
  ctx.fillStyle = "#91cdb0";
  ctx.fillRect(x + 5, y + 5, 22, 10);
  ctx.fillStyle = "#eefcf4";
  ctx.fillRect(player.facing === 1 ? x + player.w + 3 : x - 12, y + 17, 10, 4);
}

function drawZombies(cameraX, cameraY) {
  for (const zombie of zombies) {
    const x = zombie.x - cameraX;
    const y = zombie.y - cameraY;
    drawShadow(x + zombie.w / 2, y + zombie.h + 3, zombie.w);
    ctx.fillStyle = zombie.type === "runner" ? "#b3d64e" : "#82bc5d";
    ctx.fillRect(x, y, zombie.w, zombie.h);
    ctx.fillStyle = "#17201b";
    ctx.fillRect(x + 8, y + 8, 4, 4);
    ctx.fillRect(x + zombie.w - 12, y + 8, 4, 4);
    ctx.fillStyle = "#e59d79";
    ctx.fillRect(x + 12, y + 23, 10, 3);
  }

  if (boss) {
    const x = boss.x - cameraX;
    const y = boss.y - cameraY;
    drawShadow(x + boss.w / 2, y + boss.h + 4, boss.w);
    ctx.fillStyle = "#d97706";
    ctx.fillRect(x, y, boss.w, boss.h);
    ctx.fillStyle = "#261500";
    ctx.fillRect(x + 16, y + 18, 9, 9);
    ctx.fillRect(x + 56, y + 18, 9, 9);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(x + 18, y + 54, 46, 8);
  }
}

function drawBullets(cameraX, cameraY) {
  ctx.fillStyle = player.pierce > 0 ? "#c08bff" : "#f8d66d";
  for (const bullet of bullets) ctx.fillRect(bullet.x - cameraX, bullet.y - cameraY, bullet.w, bullet.h);

  ctx.fillStyle = "#ff675e";
  for (const bullet of bossBullets) {
    ctx.shadowColor = "#ff3f36";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(bullet.x - cameraX + bullet.w / 2, bullet.y - cameraY + bullet.h / 2, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function drawPickups(cameraX, cameraY) {
  for (const pickup of pickups) {
    const x = pickup.x - cameraX;
    const y = pickup.y - cameraY + Math.sin((game.titleTime + pickup.x) * 0.08) * 3;
    const colors = { health: "#68f0a8", ammo: "#f8d66d", rapid: "#6fdcff", piercing: "#c08bff" };
    const labels = { health: "+", ammo: "A", rapid: "R", piercing: "P" };
    ctx.fillStyle = "rgba(4,12,18,0.8)";
    ctx.fillRect(x - 2, y - 2, pickup.w + 4, pickup.h + 4);
    ctx.fillStyle = colors[pickup.type];
    ctx.fillRect(x, y, pickup.w, pickup.h);
    ctx.fillStyle = "#101923";
    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";
    ctx.fillText(labels[pickup.type], x + pickup.w / 2, y + 17);
  }
}

function drawParticles(cameraX, cameraY) {
  for (const particle of particles) {
    ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - cameraX, particle.y - cameraY, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
}

function drawScene() {
  const shakeX = game.shake > 0.5 ? (Math.random() - 0.5) * game.shake : 0;
  const shakeY = game.shake > 0.5 ? (Math.random() - 0.5) * game.shake : 0;
  const cameraX = game.cameraX - shakeX;
  const cameraY = game.cameraY - shakeY;
  drawBackground(cameraX, cameraY);
  drawPlatforms(cameraX, cameraY);
  drawPickups(cameraX, cameraY);
  drawBullets(cameraX, cameraY);
  drawZombies(cameraX, cameraY);
  drawParticles(cameraX, cameraY);
  drawPlayer(cameraX, cameraY);

  if (game.bossIntroFrames > 0 && !boss && !game.bossDefeated && game.waveIndex === wavePlan.length) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, canvas.height * 0.38, canvas.width, 72);
    ctx.fillStyle = "#ffb14d";
    ctx.textAlign = "center";
    ctx.font = "bold 28px Arial";
    ctx.fillText("SOMETHING BIG IS COMING...", canvas.width / 2, canvas.height * 0.38 + 46);
  }
}

function render() {
  drawScene();
}

function activateAction(action) {
  if (action === "start" || action === "restart") resetGame();
  else if (action === "resume") setScreen("playing");
  else if (action === "quit" || action === "menu") setScreen("start");
}

overlayActions.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (button) activateAction(button.dataset.action);
});

pauseButton.addEventListener("click", () => {
  if (game.state === "playing") setScreen("paused");
  else if (game.state === "paused") setScreen("playing");
});

canvas.addEventListener("pointerdown", (event) => {
  if (game.state !== "playing") return;
  const bounds = canvas.getBoundingClientRect();
  const pointerX = event.clientX - bounds.left;
  player.facing = pointerX + game.cameraX < player.x + player.w / 2 ? -1 : 1;
  shoot();
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === " " || event.code === "Space" || key.startsWith("arrow")) event.preventDefault();
  if (event.repeat && (key === "escape" || key === "p" || key === "m")) return;
  keys[key] = true;

  if (key === "m") {
    muted = !muted;
    return;
  }
  if ((key === "escape" || key === "p") && game.state === "playing") {
    keys[key] = false;
    setScreen("paused");
  } else if ((key === "escape" || key === "p") && game.state === "paused") {
    keys[key] = false;
    setScreen("playing");
  } else if ((game.state === "start" || game.state === "gameover" || game.state === "victory") && (key === "enter" || key === " ")) {
    resetGame();
  }
});

document.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

updateHud();
setScreen("start");
gameLoop();
