// ============================
// RISE FROM NOTHING — WORLD v3
// Low-poly placeholder city, player movement, NPC AI
// ============================
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const COLOR_PLAYER   = 0x448aff;
const COLOR_WORKER   = 0xf0a500;
const COLOR_CUSTOMER = 0x00e676;

const BIZ_COLORS = {
  food_cart:         0xff7043,
  small_store:       0x789fe0,
  convenience_store: 0xab47bc,
  mini_market:       0xffca28,
};

const BUSINESS_POS = {
  food_cart:         { x: 14, z: -36 },
  small_store:       { x: 14, z: -14 },
  convenience_store: { x: 14, z:  12 },
  mini_market:       { x: 14, z:  36 },
};

const COLLECTION_POINT = { x: 0, z: 46 };
const PLAYER_SPAWN     = { x: 0, z: 40 };
const CUSTOMER_SPAWN   = { x: 14, z: -56 };
const CUSTOMER_END     = { x: 14, z:  56 };

let scene, camera, renderer, clock, canvasEl;
let player;
let businessMeshes = {};
let workerNPCs = {};
let customerNPCs = [];
let customerSpawnTimers = {};
let gStateRef = null;
let onInteract = null;
let lastInteract = null;

// ── Input ──────────────────────────────────────────────
const inputState = { run: false };
const keys = { f: false, b: false, l: false, r: false };
const joyVec = { x: 0, z: 0 };
const turnKeys = { left: false, right: false };
let cameraYaw = 0;
let cameraPitch = 0.6594;
const CAMERA_DIST = 11.4;
const KEY_MAP = {
  w: 'f', s: 'b', a: 'l', d: 'r',
  arrowup: 'f', arrowdown: 'b',
};

// ── Geometry helpers (low-poly placeholders) ────────────
function makeAvatar(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 0.8;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshStandardMaterial({ color })
  );
  head.position.y = 1.55;
  group.add(body, head);
  return group;
}

function makeTree(x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.25, 1.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4423 })
  );
  trunk.position.y = 0.8;
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x2e7d32 })
  );
  canopy.position.y = 2.1;
  g.add(trunk, canopy);
  g.position.set(x, 0, z);
  return g;
}

function makeStreetLight(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 3, 6),
    new THREE.MeshStandardMaterial({ color: 0x444444 })
  );
  pole.position.y = 1.5;
  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.3, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xfff3b0, emissiveIntensity: 0.6 })
  );
  lamp.position.y = 3.1;
  g.add(pole, lamp);
  g.position.set(x, 0, z);
  return g;
}

function makeBench(x, z, rotY) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.5), mat);
  seat.position.y = 0.5;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.1), mat);
  back.position.set(0, 0.75, -0.2);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), legMat);
  leg1.position.set(-0.6, 0.25, 0);
  const leg2 = leg1.clone();
  leg2.position.x = 0.6;
  g.add(seat, back, leg1, leg2);
  g.position.set(x, 0, z);
  g.rotation.y = rotY || 0;
  return g;
}

function makeTrashBin(x, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.6), new THREE.MeshStandardMaterial({ color: 0x37474f }));
  m.position.set(x, 0.4, z);
  return m;
}

function makeDumpster(x, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x33691e }));
  m.position.set(x, 0.6, z);
  return m;
}

function makeBusinessMesh(bizId, x, z) {
  const g = new THREE.Group();
  let mesh;
  const color = BIZ_COLORS[bizId];
  switch (bizId) {
    case 'food_cart':
      mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.2), new THREE.MeshStandardMaterial({ color, transparent: true }));
      mesh.position.y = 0.6;
      break;
    case 'small_store':
      mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshStandardMaterial({ color, transparent: true }));
      mesh.position.y = 1.5;
      break;
    case 'convenience_store':
      mesh = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, 5), new THREE.MeshStandardMaterial({ color, transparent: true }));
      mesh.position.y = 1.75;
      break;
    case 'mini_market':
    default:
      mesh = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), new THREE.MeshStandardMaterial({ color, transparent: true }));
      mesh.position.y = 2;
      break;
  }
  g.add(mesh);
  // Storage crate
  const crateW = mesh.geometry.parameters.width;
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0x8d6e63 }));
  crate.position.set(crateW / 2 + 0.6, 0.3, 0);
  g.add(crate);

  g.position.set(x, 0, z);
  g.userData.mainMesh = mesh;
  g.userData.bizId = bizId;
  return g;
}

// ── Environment ──────────────────────────────────────────
function buildEnvironment() {
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
  grass.rotation.x = -Math.PI / 2;
  scene.add(grass);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(12, 130), new THREE.MeshStandardMaterial({ color: 0x37474f }));
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  scene.add(road);

  [-9.5, 9.5].forEach(x => {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(5, 130), new THREE.MeshStandardMaterial({ color: 0xb0bec5 }));
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(x, 0.02, 0);
    scene.add(sw);
  });

  for (let z = -55; z <= 55; z += 15) {
    scene.add(makeTree(-16, z));
    scene.add(makeTree(20, z + 7));
    scene.add(makeStreetLight(-9.5, z + 4));
    scene.add(makeStreetLight(9.5, z - 4));
  }
  scene.add(makeBench(-9.5, 30, Math.PI / 2));
  scene.add(makeBench(9.5, -50, -Math.PI / 2));
  scene.add(makeTrashBin(11.5, -28));
  scene.add(makeTrashBin(-11.5, 20));
  scene.add(makeDumpster(12, 30));

  // Collection point — marked platform
  const cp = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xf0a500 }));
  cp.position.set(COLLECTION_POINT.x, 0.05, COLLECTION_POINT.z);
  scene.add(cp);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(20, 30, 10);
  scene.add(sun);
}

// ── Avatar base class ────────────────────────────────────
class Avatar {
  constructor(color, pos) {
    this.group = makeAvatar(color);
    this.group.position.set(pos.x, 0, pos.z);
    this.baseY = 0;
    this.state = 'idle'; // idle | walk | run
    this.bobT = Math.random() * 10;
  }
  facePoint(x, z) {
    const dx = x - this.group.position.x;
    const dz = z - this.group.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.001) this.group.rotation.y = Math.atan2(dx, dz);
  }
  updateBob(dt) {
    const speedFactor = this.state === 'run' ? 14 : this.state === 'walk' ? 7 : 2;
    const amp = this.state === 'idle' ? 0.03 : this.state === 'walk' ? 0.08 : 0.14;
    this.bobT += dt * speedFactor;
    this.group.position.y = this.baseY + Math.abs(Math.sin(this.bobT)) * amp;
  }
}

// ── Player ────────────────────────────────────────────────
class Player extends Avatar {
  constructor(pos) { super(COLOR_PLAYER, pos); this.vy = 0; this.grounded = true; }
  jump() {
    if (this.grounded) { this.vy = 5; this.grounded = false; }
  }
  update(dt) {
    let ix = (keys.l ? -1 : 0) + (keys.r ? 1 : 0) + joyVec.x;
    let iz = (keys.f ? -1 : 0) + (keys.b ? 1 : 0) + joyVec.z;
    const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
    let dx = ix * cos + iz * sin;
    let dz = -ix * sin + iz * cos;
    const len = Math.hypot(dx, dz);
    if (len > 0.05) {
      dx /= len; dz /= len;
      const speed = inputState.run ? 8 : 4;
      this.group.position.x += dx * speed * dt;
      this.group.position.z += dz * speed * dt;
      this.facePoint(this.group.position.x + dx, this.group.position.z + dz);
      this.state = inputState.run ? 'run' : 'walk';
    } else {
      this.state = 'idle';
    }
    this.group.position.x = Math.min(60, Math.max(-60, this.group.position.x));
    this.group.position.z = Math.min(62, Math.max(-62, this.group.position.z));

    if (!this.grounded || this.vy !== 0) {
      this.vy -= 14 * dt;
      this.baseY += this.vy * dt;
      if (this.baseY <= 0) { this.baseY = 0; this.vy = 0; this.grounded = true; }
    }

    this.updateBob(dt);
  }
}

// ── Worker NPC: Find Task → Complete Task → Return ──────────
class WorkerNPC extends Avatar {
  constructor(homePos) {
    super(COLOR_WORKER, { x: homePos.x + (Math.random() * 2 - 1), z: homePos.z + (Math.random() * 2 - 1) });
    this.home = homePos;
    this.task = this._newTask();
    this.phase = 'to_task'; // to_task | working | returning | waiting
    this.timer = Math.random() * 2;
  }
  _newTask() {
    return { x: this.home.x + (Math.random() * 6 - 3), z: this.home.z + (Math.random() * 6 - 3) };
  }
  update(dt) {
    const p = this.group.position;
    if (this.phase === 'to_task' || this.phase === 'returning') {
      const target = this.phase === 'to_task' ? this.task : this.home;
      const dx = target.x - p.x, dz = target.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.25) {
        if (this.phase === 'to_task') {
          this.phase = 'working'; this.timer = 1.2; this.state = 'idle';
          if (typeof playTaskComplete === 'function') playTaskComplete();
        } else {
          this.phase = 'waiting'; this.timer = 0.8; this.state = 'idle';
        }
      } else {
        const speed = 2.2;
        p.x += dx / dist * speed * dt; p.z += dz / dist * speed * dt;
        this.facePoint(target.x, target.z);
        this.state = 'walk';
      }
    } else {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.phase === 'working') this.phase = 'returning';
        else { this.phase = 'to_task'; this.task = this._newTask(); }
      }
    }
    this.updateBob(dt);
  }
}

// ── Customer NPC: Spawn → Walk → Purchase → Leave ────────────
class CustomerNPC extends Avatar {
  constructor(spawnPos, businessPos, despawnPos, bizId) {
    super(COLOR_CUSTOMER, spawnPos);
    this.target = businessPos;
    this.despawn = despawnPos;
    this.bizId = bizId;
    this.phase = 'arriving'; // arriving | purchasing | leaving
    this.timer = 0;
    this.dead = false;
  }
  update(dt) {
    const p = this.group.position;
    if (this.phase === 'arriving' || this.phase === 'leaving') {
      const target = this.phase === 'arriving' ? this.target : this.despawn;
      const dx = target.x - p.x, dz = target.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.3) {
        if (this.phase === 'arriving') {
          this.phase = 'purchasing'; this.timer = 1; this.state = 'idle';
          if (typeof playPurchase === 'function') playPurchase();
        } else {
          this.dead = true;
        }
      } else {
        const speed = 3;
        p.x += dx / dist * speed * dt; p.z += dz / dist * speed * dt;
        this.facePoint(target.x, target.z);
        this.state = 'walk';
      }
    } else if (this.phase === 'purchasing') {
      this.timer -= dt;
      if (this.timer <= 0) this.phase = 'leaving';
    }
    this.updateBob(dt);
  }
}

// ── Input setup ─────────────────────────────────────────────
function setupInput() {
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (KEY_MAP[k]) keys[KEY_MAP[k]] = true;
    if (k === 'shift') inputState.run = true;
    if (k === 'e' && typeof window.interactWithBusiness === 'function') window.interactWithBusiness();
    if (k === ' ' && player) player.jump();
    if (k === ',' || k === 'arrowleft') turnKeys.left = true;
    if (k === '.' || k === 'arrowright') turnKeys.right = true;
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (KEY_MAP[k]) keys[KEY_MAP[k]] = false;
    if (k === 'shift') inputState.run = false;
    if (k === ',' || k === 'arrowleft') turnKeys.left = false;
    if (k === '.' || k === 'arrowright') turnKeys.right = false;
  });

  const base = document.getElementById('joystick-base');
  const knob = document.getElementById('joystick-knob');
  if (base && knob) {
    const radius = 40;
    let dragging = false;
    const onMove = (cx, cy) => {
      const rect = base.getBoundingClientRect();
      let dx = cx - (rect.left + rect.width / 2);
      let dy = cy - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist > radius) { dx = dx / dist * radius; dy = dy / dist * radius; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      joyVec.x = dx / radius;
      joyVec.z = dy / radius;
    };
    const onEnd = () => {
      dragging = false;
      knob.style.transform = 'translate(-50%, -50%)';
      joyVec.x = 0; joyVec.z = 0;
    };
    base.addEventListener('pointerdown', e => { dragging = true; onMove(e.clientX, e.clientY); base.setPointerCapture(e.pointerId); });
    base.addEventListener('pointermove', e => { if (dragging) onMove(e.clientX, e.clientY); });
    base.addEventListener('pointerup', onEnd);
    base.addEventListener('pointercancel', onEnd);
  }

  const runBtn = document.getElementById('run-btn');
  if (runBtn) {
    const setRun = v => { inputState.run = v; runBtn.classList.toggle('active', v); };
    runBtn.addEventListener('pointerdown', () => setRun(true));
    runBtn.addEventListener('pointerup', () => setRun(false));
    runBtn.addEventListener('pointercancel', () => setRun(false));
    runBtn.addEventListener('pointerleave', () => setRun(false));
  }

  // Hold-and-drag look (PC + mobile)
  let looking = false, lastX = 0, lastY = 0;
  canvasEl.style.touchAction = 'none';
  canvasEl.addEventListener('pointerdown', e => { looking = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('pointermove', e => {
    if (!looking) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    cameraYaw -= dx * 0.006;
    cameraPitch = Math.min(1.4, Math.max(0.15, cameraPitch + dy * 0.006));
  });
  window.addEventListener('pointerup', () => { looking = false; });
  window.addEventListener('pointercancel', () => { looking = false; });
}

function onResize() {
  if (!renderer || !canvasEl) return;
  const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// ── Main loop ──────────────────────────────────────────────
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);

  player.update(dt);

  if (turnKeys.left) cameraYaw += 1.6 * dt;
  if (turnKeys.right) cameraYaw -= 1.6 * dt;

  const cx = player.group.position.x + CAMERA_DIST * Math.sin(cameraYaw) * Math.cos(cameraPitch);
  const cz = player.group.position.z + CAMERA_DIST * Math.cos(cameraYaw) * Math.cos(cameraPitch);
  const cy = player.group.position.y + CAMERA_DIST * Math.sin(cameraPitch) + 1;
  camera.position.set(cx, cy, cz);
  camera.lookAt(player.group.position.x, player.group.position.y + 1, player.group.position.z);

  Object.values(workerNPCs).forEach(list => list.forEach(w => w.update(dt)));

  customerNPCs.forEach(c => c.update(dt));
  customerNPCs = customerNPCs.filter(c => {
    if (c.dead) { scene.remove(c.group); return false; }
    return true;
  });

  if (gStateRef) {
    Object.keys(customerSpawnTimers).forEach(bizId => {
      if (!gStateRef.ownedBusinesses.includes(bizId)) return;
      customerSpawnTimers[bizId] -= dt;
      if (customerSpawnTimers[bizId] <= 0) {
        const inLane = customerNPCs.filter(c => c.bizId === bizId).length;
        if (inLane < 2) {
          const pos = BUSINESS_POS[bizId];
          const c = new CustomerNPC(
            { x: pos.x, z: CUSTOMER_SPAWN.z },
            pos,
            { x: pos.x, z: CUSTOMER_END.z },
            bizId
          );
          customerNPCs.push(c);
          scene.add(c.group);
        }
        customerSpawnTimers[bizId] = 4 + Math.random() * 5;
      }
    });
  }

  // Interaction proximity check
  let nearest = null, nearestDist = 6;
  Object.keys(BUSINESS_POS).forEach(bizId => {
    const pos = BUSINESS_POS[bizId];
    const d = Math.hypot(pos.x - player.group.position.x, pos.z - player.group.position.z);
    if (d < nearestDist) { nearestDist = d; nearest = bizId; }
  });
  if (nearest !== lastInteract) {
    lastInteract = nearest;
    if (onInteract) onInteract(nearest);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ── Public API ───────────────────────────────────────────────
function init(canvas, gState, businessesData, bizOrder) {
  canvasEl = canvas;
  gStateRef = gState;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0f11);
  scene.fog = new THREE.Fog(0x0d0f11, 40, 100);

  camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  buildEnvironment();

  bizOrder.forEach(bizId => {
    const pos = BUSINESS_POS[bizId];
    if (!pos) return;
    const mesh = makeBusinessMesh(bizId, pos.x, pos.z);
    businessMeshes[bizId] = mesh;
    scene.add(mesh);
    workerNPCs[bizId] = [];
    customerSpawnTimers[bizId] = 3 + Math.random() * 5;
  });

  player = new Player(PLAYER_SPAWN);
  scene.add(player.group);

  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);
  setupInput();
  updateWorld(gState, businessesData);
  requestAnimationFrame(loop);
}

function updateWorld(gState, businessesData) {
  gStateRef = gState;
  Object.keys(businessMeshes).forEach(bizId => {
    const grp = businessMeshes[bizId];
    const owned = gState.ownedBusinesses.includes(bizId);
    const mesh = grp.userData.mainMesh;
    if (mesh && mesh.material) {
      mesh.material.color.setHex(owned ? BIZ_COLORS[bizId] : 0x555555);
      mesh.material.opacity = owned ? 1 : 0.3;
    }

    const list = workerNPCs[bizId];
    const desired = Math.min(gState.workers[bizId] || 0, 3);
    while (list.length < desired) {
      const w = new WorkerNPC(BUSINESS_POS[bizId]);
      list.push(w);
      scene.add(w.group);
    }
    while (list.length > desired) {
      const w = list.pop();
      scene.remove(w.group);
    }
  });
}

function setInteractCallback(cb) { onInteract = cb; }

window.WorldAPI = { init, updateWorld, setInteractCallback };