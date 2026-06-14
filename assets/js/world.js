// ============================
// RISE FROM NOTHING — WORLD v5
// Entity Collisions | Smart Pathfinding | Day-Night Cycle | Pause
// ============================
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const COLOR_PLAYER   = 0x448aff;
const COLOR_WORKER   = 0xf0a500;
const COLOR_CUSTOMER = 0x00e676;

const BIZ_COLORS = {
  food_cart:          0xff7043,
  small_store:        0x789fe0,
  convenience_store:  0xab47bc,
  mini_market:        0xffca28,
  bicycle_courier:    0x26c6da,
  motorcycle_courier: 0xef5350,
  delivery_van:       0x66bb6a,
  logistics_company:  0xffa726,
};

const VEHICLE_COLORS = {
  bicycle:    [0x26c6da, 0x00acc1, 0x006064],
  motorcycle: [0xef5350, 0xe53935, 0xb71c1c],
  van:        [0x66bb6a, 0x43a047, 0x1b5e20],
  truck:      [0xffa726, 0xfb8c00, 0xe65100],
};

const BUSINESS_POS = {
  food_cart:          { x: 14, z: -36 },
  small_store:        { x: 14, z: -14 },
  convenience_store:  { x: 14, z:  12 },
  mini_market:        { x: 14, z:  36 },
  bicycle_courier:    { x:-14, z: -36 },
  motorcycle_courier: { x:-14, z: -14 },
  delivery_van:       { x:-14, z:  12 },
  logistics_company:  { x:-14, z:  36 },
};

const COLLECTION_POINT = { x: 0, z: 46 };
const PLAYER_SPAWN     = { x: 0, z: 40 };
const CUSTOMER_SPAWN   = { x: 14, z: -56 };
const CUSTOMER_END     = { x: 14, z:  56 };

// ── Isometric Camera ───────────────────────────────────────────
const ISO_YAW   = Math.PI / 4;
const ISO_PITCH = 0.6154;
const ZOOM_MIN  = 10;
const ZOOM_MAX  = 45;
let   cameraZoom = 22;

// ── Map layout constants ───────────────────────────────────────
const LOOP_Z  = 60;
const LOOP_X  = 90;

// ── Pause State ───────────────────────────────────────────────
let _paused = false;

function isPaused() { return _paused; }

// ── Day-Night Cycle ───────────────────────────────────────────
const DAY_NIGHT_CYCLE_MS = 20 * 60 * 1000; // 20 minutes total
let _cycleTime = 0; // 0..1
let _ambientLight   = null;
let _sunLight       = null;
let _moonLight      = null;
let _skyColors = {
  day:     new THREE.Color(0x0d0f11),
  sunrise: new THREE.Color(0x1a0a00),
  sunset:  new THREE.Color(0x1a0500),
  night:   new THREE.Color(0x020308),
};

function _updateDayNight(dt) {
  if (_paused) return;
  _cycleTime = (_cycleTime + dt / (DAY_NIGHT_CYCLE_MS / 1000)) % 1;
  const t = _cycleTime;

  // t=0 sunrise, t=0.25 noon, t=0.5 sunset, t=0.75 midnight, t=1 sunrise
  const sunAngle = t * Math.PI * 2;
  const sunY     = Math.sin(sunAngle - Math.PI / 2); // -1 at midnight, +1 at noon
  const sunX     = Math.cos(sunAngle - Math.PI / 2);

  // Day fraction: how "daytime" it is (0=night, 1=full day)
  const dayFrac = Math.max(0, sunY);
  // Transition zone 0..0.15 above horizon
  const dawnDusk = Math.max(0, Math.min(1, (sunY + 0.15) / 0.15));

  // Ambient light
  const ambientDay   = 0.75;
  const ambientNight = 0.12;
  const ambientVal   = ambientNight + (ambientDay - ambientNight) * dayFrac;
  if (_ambientLight) _ambientLight.intensity = ambientVal;

  // Sun directional
  if (_sunLight) {
    _sunLight.intensity = 0.8 * Math.max(0, sunY);
    _sunLight.position.set(sunX * 40, Math.max(0.1, sunY) * 30, 10);
    // Warm sunrise/sunset tint
    const noon   = new THREE.Color(0xffffff);
    const golden = new THREE.Color(0xff9944);
    const sunColor = noon.clone().lerp(golden, Math.max(0, 1 - dayFrac * 4));
    _sunLight.color.copy(sunColor);
  }

  // Moon light (opposite to sun)
  if (_moonLight) {
    const moonY = -sunY;
    _moonLight.intensity = 0.15 * Math.max(0, moonY);
    _moonLight.position.set(-sunX * 40, Math.max(0.1, moonY) * 30, -10);
  }

  // Sky / fog color
  if (scene) {
    let skyColor;
    if (sunY > 0.15) {
      // Full day
      skyColor = new THREE.Color(0x0d0f11).lerp(new THREE.Color(0x162030), dayFrac);
    } else if (sunY > -0.15) {
      // Dawn/dusk transition
      const dawn = new THREE.Color(0x1a0a00);
      const night = new THREE.Color(0x020308);
      const dayColor = new THREE.Color(0x162030);
      const p = (sunY + 0.15) / 0.30;
      if (sunY > 0) skyColor = night.clone().lerp(dawn, 0.5).lerp(dayColor, p);
      else skyColor = night.clone().lerp(dawn, 1 - p);
    } else {
      skyColor = new THREE.Color(0x020308);
    }
    scene.background.copy(skyColor);
    scene.fog.color.copy(skyColor);
  }

  // Street lights: on at night
  if (_streetLights) {
    const lightsOn = sunY < 0.1;
    const lampIntensity = lightsOn ? Math.max(0, 1 - dayFrac * 10) : 0;
    _streetLights.forEach(m => {
      if (m.material?.emissiveIntensity !== undefined)
        m.material.emissiveIntensity = 0.1 + lampIntensity * 0.8;
    });
  }
}

// ── Collision system ───────────────────────────────────────────
const _staticColliders = []; // {minX, maxX, minZ, maxZ}
const PLAYER_RADIUS    = 0.42;
const ENTITY_RADIUS    = 0.38;

function addBoxCollider(cx, cz, hw, hd) {
  _staticColliders.push({ minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd });
}

function resolveStaticCollisions(pos, radius) {
  const r = radius || PLAYER_RADIUS;
  for (let pass = 0; pass < 2; pass++) {
    for (const box of _staticColliders) {
      if (pos.x + r > box.minX && pos.x - r < box.maxX &&
          pos.z + r > box.minZ && pos.z - r < box.maxZ) {
        const pushL = (pos.x + r) - box.minX;
        const pushR = box.maxX   - (pos.x - r);
        const pushF = (pos.z + r) - box.minZ;
        const pushB = box.maxZ   - (pos.z - r);
        const m = Math.min(pushL, pushR, pushF, pushB);
        if      (m === pushL) pos.x -= pushL;
        else if (m === pushR) pos.x += pushR;
        else if (m === pushF) pos.z -= pushF;
        else                  pos.z += pushB;
      }
    }
  }
}

// Dynamic entity collision (workers, customers vs each other)
const _dynamicEntities = []; // {pos, radius, id}

function registerDynamic(entity) {
  if (!_dynamicEntities.find(e => e === entity)) _dynamicEntities.push(entity);
}
function unregisterDynamic(entity) {
  const i = _dynamicEntities.indexOf(entity);
  if (i !== -1) _dynamicEntities.splice(i, 1);
}

function resolveDynamicCollisions(pos, radius, selfId) {
  const r = radius || ENTITY_RADIUS;
  for (const other of _dynamicEntities) {
    if (other.id === selfId) continue;
    const dx  = pos.x - other.pos.x;
    const dz  = pos.z - other.pos.z;
    const dist = Math.hypot(dx, dz);
    const minD = r + (other.radius || ENTITY_RADIUS);
    if (dist < minD && dist > 0.001) {
      const push = (minD - dist) / 2;
      pos.x += (dx / dist) * push;
      pos.z += (dz / dist) * push;
    }
  }
}

function resolveCollisions(pos, radius, selfId) {
  resolveStaticCollisions(pos, radius);
  if (selfId !== undefined) resolveDynamicCollisions(pos, radius, selfId);
}

// ── Pathfinding (grid-based A*) ───────────────────────────────
const PF_CELL   = 2.0;  // world units per cell
const PF_ORIGIN = { x: -10, z: -70 };
const PF_COLS   = 60;
const PF_ROWS   = 70;

let _pfGrid = null; // 0=free, 1=blocked

function _worldToCell(wx, wz) {
  return {
    col: Math.floor((wx - PF_ORIGIN.x) / PF_CELL),
    row: Math.floor((wz - PF_ORIGIN.z) / PF_CELL),
  };
}

function _cellToWorld(col, row) {
  return {
    x: PF_ORIGIN.x + col * PF_CELL + PF_CELL / 2,
    z: PF_ORIGIN.z + row * PF_CELL + PF_CELL / 2,
  };
}

function _buildGrid() {
  _pfGrid = new Uint8Array(PF_COLS * PF_ROWS);
  for (const box of _staticColliders) {
    const c0 = Math.max(0, Math.floor((box.minX - PF_ORIGIN.x) / PF_CELL) - 1);
    const c1 = Math.min(PF_COLS - 1, Math.ceil((box.maxX - PF_ORIGIN.x) / PF_CELL) + 1);
    const r0 = Math.max(0, Math.floor((box.minZ - PF_ORIGIN.z) / PF_CELL) - 1);
    const r1 = Math.min(PF_ROWS - 1, Math.ceil((box.maxZ - PF_ORIGIN.z) / PF_CELL) + 1);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        _pfGrid[r * PF_COLS + c] = 1;
  }
}

function _pfIdx(col, row) { return row * PF_COLS + col; }

function _aStar(sx, sz, ex, ez) {
  if (!_pfGrid) return null;
  const sc = _worldToCell(sx, sz);
  const ec = _worldToCell(ex, ez);

  sc.col = Math.max(0, Math.min(PF_COLS - 1, sc.col));
  sc.row = Math.max(0, Math.min(PF_ROWS - 1, sc.row));
  ec.col = Math.max(0, Math.min(PF_COLS - 1, ec.col));
  ec.row = Math.max(0, Math.min(PF_ROWS - 1, ec.row));

  if (_pfGrid[_pfIdx(ec.col, ec.row)] === 1) {
    // Try to find nearest free cell to target
    let found = false;
    for (let d = 1; d < 4 && !found; d++) {
      for (let dr = -d; dr <= d && !found; dr++) {
        for (let dc = -d; dc <= d && !found; dc++) {
          const nc = ec.col + dc, nr = ec.row + dr;
          if (nc >= 0 && nc < PF_COLS && nr >= 0 && nr < PF_ROWS && _pfGrid[_pfIdx(nc, nr)] === 0) {
            ec.col = nc; ec.row = nr; found = true;
          }
        }
      }
    }
    if (!found) return null;
  }

  const startIdx = _pfIdx(sc.col, sc.row);
  const endIdx   = _pfIdx(ec.col, ec.row);
  if (startIdx === endIdx) return [];

  const g = new Float32Array(PF_COLS * PF_ROWS).fill(Infinity);
  const f = new Float32Array(PF_COLS * PF_ROWS).fill(Infinity);
  const prev = new Int32Array(PF_COLS * PF_ROWS).fill(-1);
  const open = new Set();

  g[startIdx] = 0;
  f[startIdx] = Math.hypot(ec.col - sc.col, ec.row - sc.row);
  open.add(startIdx);

  const DIRS = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  const COSTS = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414];

  let iters = 0;
  while (open.size > 0 && iters++ < 4000) {
    let cur = -1, bestF = Infinity;
    for (const idx of open) { if (f[idx] < bestF) { bestF = f[idx]; cur = idx; } }
    if (cur === endIdx) break;
    open.delete(cur);

    const curRow = Math.floor(cur / PF_COLS);
    const curCol = cur % PF_COLS;

    for (let d = 0; d < DIRS.length; d++) {
      const nc = curCol + DIRS[d][0];
      const nr = curRow + DIRS[d][1];
      if (nc < 0 || nc >= PF_COLS || nr < 0 || nr >= PF_ROWS) continue;
      const ni = _pfIdx(nc, nr);
      if (_pfGrid[ni] === 1) continue;
      const ng = g[cur] + COSTS[d];
      if (ng < g[ni]) {
        g[ni] = ng; prev[ni] = cur;
        f[ni] = ng + Math.hypot(ec.col - nc, ec.row - nr);
        open.add(ni);
      }
    }
  }

  if (prev[endIdx] === -1 && startIdx !== endIdx) return null;

  const path = [];
  let cur = endIdx;
  while (cur !== -1) {
    const r = Math.floor(cur / PF_COLS), c = cur % PF_COLS;
    path.unshift(_cellToWorld(c, r));
    cur = prev[cur];
  }
  return path.length > 1 ? path : [];
}

// Path smoothing: remove waypoints that can be skipped in straight line
function _smoothPath(path, startX, startZ) {
  if (!path || path.length < 2) return path;
  const full = [{ x: startX, z: startZ }, ...path];
  const smooth = [full[0]];
  let i = 0;
  while (i < full.length - 1) {
    let j = full.length - 1;
    while (j > i + 1) {
      if (_lineOfSight(full[i].x, full[i].z, full[j].x, full[j].z)) break;
      j--;
    }
    smooth.push(full[j]);
    i = j;
  }
  return smooth.slice(1);
}

function _lineOfSight(x1, z1, x2, z2) {
  const steps = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / (PF_CELL * 0.5));
  for (let i = 1; i <= steps; i++) {
    const t  = i / steps;
    const px = x1 + (x2 - x1) * t;
    const pz = z1 + (z2 - z1) * t;
    const c  = _worldToCell(px, pz);
    if (c.col < 0 || c.col >= PF_COLS || c.row < 0 || c.row >= PF_ROWS) return false;
    if (_pfGrid[_pfIdx(c.col, c.row)] === 1) return false;
  }
  return true;
}

let scene, camera, renderer, clock, canvasEl;
let player;
let businessMeshes = {};
let workerNPCs     = {};
let vehicleNPCs    = {};
let customerNPCs   = [];
let customerSpawnTimers = {};
let gStateRef  = null;
let onInteract = null;
let lastInteract = null;
let _entityCounter = 0;
let _streetLights  = [];

// ── Input ──────────────────────────────────────────────────────
const inputState = { run: false };
const keys    = { f: false, b: false, l: false, r: false };
const joyVec  = { x: 0, z: 0 };
const KEY_MAP = {
  w: 'f', s: 'b', a: 'l', d: 'r',
  arrowup: 'f', arrowdown: 'b', arrowleft: 'l', arrowright: 'r',
};

// ── Geometry helpers ───────────────────────────────────────────
function makeAvatar(color) {
  const group = new THREE.Group();
  const body  = new THREE.Mesh(
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
  const g      = new THREE.Group();
  const trunk  = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4423 }));
  trunk.position.y = 0.8;
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
  canopy.position.y = 2.1;
  g.add(trunk, canopy);
  g.position.set(x, 0, z);
  addBoxCollider(x, z, 1.1, 1.1);
  return g;
}

function makeStreetLight(x, z) {
  const g    = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6),
    new THREE.MeshStandardMaterial({ color: 0x444444 }));
  pole.position.y = 1.5;
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xfff3b0, emissiveIntensity: 0.6 }));
  lamp.position.y = 3.1;
  _streetLights.push(lamp);
  g.add(pole, lamp);
  g.position.set(x, 0, z);
  addBoxCollider(x, z, 0.25, 0.25);
  return g;
}

function makeBench(x, z, rotY) {
  const g   = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.5), mat);
  seat.position.y = 0.5;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.1), mat);
  back.position.set(0, 0.75, -0.2);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), legMat);
  leg1.position.set(-0.6, 0.25, 0);
  const leg2 = leg1.clone(); leg2.position.x = 0.6;
  g.add(seat, back, leg1, leg2);
  g.position.set(x, 0, z);
  g.rotation.y = rotY || 0;
  const hw = rotY && Math.abs(Math.sin(rotY)) > 0.5 ? 0.35 : 0.8;
  const hd = rotY && Math.abs(Math.sin(rotY)) > 0.5 ? 0.8  : 0.35;
  addBoxCollider(x, z, hw, hd);
  return g;
}

function makeTrashBin(x, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x37474f }));
  m.position.set(x, 0.4, z);
  addBoxCollider(x, z, 0.45, 0.45);
  return m;
}

function makeDumpster(x, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x33691e }));
  m.position.set(x, 0.6, z);
  addBoxCollider(x, z, 1.2, 0.8);
  return m;
}

function makeFountain(x, z) {
  const g    = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.8, 0.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x90a4ae }));
  base.position.y = 0.2;
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.5, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x78909c, side: THREE.BackSide }));
  basin.position.y = 0.65;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: 0xb0bec5 }));
  pillar.position.y = 1.2;
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x26c6da, emissive: 0x006064, emissiveIntensity: 0.3 }));
  top.position.y = 2.2;
  g.add(base, basin, pillar, top);
  g.position.set(x, 0, z);
  addBoxCollider(x, z, 2.8, 2.8);
  return g;
}

function makeVehicleMesh(vehicleType, color) {
  const g   = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color });
  switch (vehicleType) {
    case 'bicycle': {
      const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), mat);
      frame.rotation.z = Math.PI / 4; frame.position.set(0, 0.5, 0);
      const wGeo = new THREE.TorusGeometry(0.28, 0.06, 6, 12);
      const wMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
      const wf = new THREE.Mesh(wGeo, wMat); wf.position.set( 0.4, 0.28, 0); wf.rotation.y = Math.PI/2;
      const wb = new THREE.Mesh(wGeo, wMat); wb.position.set(-0.4, 0.28, 0); wb.rotation.y = Math.PI/2;
      const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.4, 4, 6),
        new THREE.MeshStandardMaterial({ color: COLOR_WORKER }));
      rider.position.set(0, 1.05, 0);
      g.add(frame, wf, wb, rider); break;
    }
    case 'motorcycle': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.5), mat);
      body.position.y = 0.5;
      const wGeo = new THREE.TorusGeometry(0.32, 0.08, 6, 14);
      const wMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
      const wf = new THREE.Mesh(wGeo, wMat); wf.position.set( 0.55, 0.32, 0); wf.rotation.y = Math.PI/2;
      const wb = new THREE.Mesh(wGeo, wMat); wb.position.set(-0.55, 0.32, 0); wb.rotation.y = Math.PI/2;
      const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 6),
        new THREE.MeshStandardMaterial({ color: COLOR_WORKER }));
      rider.position.set(0, 1.15, 0);
      g.add(body, wf, wb, rider); break;
    }
    case 'van': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.2), mat);
      body.position.y = 0.9;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 1.1),
        new THREE.MeshStandardMaterial({ color: 0x455a64 }));
      cab.position.set(0.9, 1.7, 0);
      const wGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10);
      const wMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
      [[ 0.85, 0.55],[ 0.85,-0.55],[-0.85, 0.55],[-0.85,-0.55]].forEach(([wx,wz])=>{
        const w = new THREE.Mesh(wGeo, wMat);
        w.position.set(wx, 0.3, wz); w.rotation.z = Math.PI/2; g.add(w);
      });
      g.add(body, cab); break;
    }
    case 'truck': {
      const trailer = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.8, 1.6), mat);
      trailer.position.set(-1, 1.1, 0);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 1.5),
        new THREE.MeshStandardMaterial({ color: 0x263238 }));
      cab.position.set(1.8, 1.0, 0);
      const wGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.25, 10);
      const wMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      [[ 1.6, 0.7],[ 1.6,-0.7],[-0.5, 0.7],[-0.5,-0.7],[-1.8, 0.7],[-1.8,-0.7]].forEach(([wx,wz])=>{
        const w = new THREE.Mesh(wGeo, wMat);
        w.position.set(wx, 0.38, wz); w.rotation.z = Math.PI/2; g.add(w);
      });
      g.add(trailer, cab); break;
    }
    default: {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.6), mat);
      box.position.y = 0.4; g.add(box);
    }
  }
  return g;
}

function makeBusinessMesh(bizId, x, z) {
  const g     = new THREE.Group();
  const color = BIZ_COLORS[bizId];
  const biz   = (typeof BUSINESSES !== 'undefined') ? BUSINESSES[bizId] : null;
  const isTransport = biz?.category === 'transport';
  let mesh;

  if (isTransport) {
    const platform = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 5),
      new THREE.MeshStandardMaterial({ color: 0x37474f }));
    platform.position.y = 0.1;
    const building = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.5, 4),
      new THREE.MeshStandardMaterial({ color, transparent: true }));
    building.position.set(-1.5, 1.35, 0);
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xffffff }));
    lane.rotation.x = -Math.PI/2; lane.position.set(1, 0.21, 0);
    g.add(platform, building, lane);
    mesh = building;
    addBoxCollider(x, z, 3.4, 2.8);
  } else {
    switch (bizId) {
      case 'food_cart':
        mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.2),
          new THREE.MeshStandardMaterial({ color, transparent: true }));
        mesh.position.y = 0.6;
        addBoxCollider(x, z, 1.5, 1.0);
        break;
      case 'small_store':
        mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4),
          new THREE.MeshStandardMaterial({ color, transparent: true }));
        mesh.position.y = 1.5;
        addBoxCollider(x, z, 2.4, 2.4);
        break;
      case 'convenience_store':
        mesh = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, 5),
          new THREE.MeshStandardMaterial({ color, transparent: true }));
        mesh.position.y = 1.75;
        addBoxCollider(x, z, 2.9, 2.9);
        break;
      default:
        mesh = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6),
          new THREE.MeshStandardMaterial({ color, transparent: true }));
        mesh.position.y = 2;
        addBoxCollider(x, z, 3.4, 3.4);
    }
    g.add(mesh);
    const crateW = mesh.geometry.parameters.width;
    const crate  = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x8d6e63 }));
    crate.position.set(crateW / 2 + 0.6, 0.3, 0);
    g.add(crate);
  }

  g.position.set(x, 0, z);
  g.userData.mainMesh = mesh;
  g.userData.bizId    = bizId;
  return g;
}

// ── Road builders ──────────────────────────────────────────────
function buildWestRoad() {
  const road = new THREE.Mesh(new THREE.PlaneGeometry(12, 130),
    new THREE.MeshStandardMaterial({ color: 0x37474f }));
  road.rotation.x = -Math.PI/2; road.position.y = 0.01;
  scene.add(road);

  [-9.5, 9.5].forEach(x => {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(5, 130),
      new THREE.MeshStandardMaterial({ color: 0xb0bec5 }));
    sw.rotation.x = -Math.PI/2; sw.position.set(x, 0.02, 0);
    scene.add(sw);
  });

  const leftLane = new THREE.Mesh(new THREE.PlaneGeometry(8, 130),
    new THREE.MeshStandardMaterial({ color: 0x455a64 }));
  leftLane.rotation.x = -Math.PI/2; leftLane.position.set(-17, 0.015, 0);
  scene.add(leftLane);

  for (let z = -55; z <= 55; z += 15) {
    scene.add(makeTree(-24, z));
    scene.add(makeTree(20, z + 7));
    scene.add(makeStreetLight(-9.5, z + 4));
    scene.add(makeStreetLight(9.5,  z - 4));
  }
  scene.add(makeBench(-9.5,  30,  Math.PI / 2));
  scene.add(makeBench( 9.5, -50, -Math.PI / 2));
  scene.add(makeTrashBin( 11.5, -28));
  scene.add(makeTrashBin(-11.5,  20));
  scene.add(makeDumpster(12, 30));
}

function buildNorthRoad() {
  const len = LOOP_X, cx = LOOP_X / 2;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(len, 12),
    new THREE.MeshStandardMaterial({ color: 0x37474f }));
  road.rotation.x = -Math.PI/2; road.position.set(cx, 0.01, LOOP_Z);
  scene.add(road);
  [-1, 1].forEach(s => {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(len, 5),
      new THREE.MeshStandardMaterial({ color: 0xb0bec5 }));
    sw.rotation.x = -Math.PI/2; sw.position.set(cx, 0.02, LOOP_Z + s * 8.5);
    scene.add(sw);
  });
  for (let x = 8; x <= LOOP_X - 8; x += 15) {
    scene.add(makeTree(x, LOOP_Z + 14));
    scene.add(makeStreetLight(x + 5, LOOP_Z + 8));
    scene.add(makeStreetLight(x + 5, LOOP_Z - 8));
  }
  scene.add(makeBench(30, LOOP_Z + 10, 0));
  scene.add(makeBench(60, LOOP_Z + 10, 0));
  scene.add(makeTrashBin(45, LOOP_Z + 8));
}

function buildSouthRoad() {
  const len = LOOP_X, cx = LOOP_X / 2;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(len, 12),
    new THREE.MeshStandardMaterial({ color: 0x37474f }));
  road.rotation.x = -Math.PI/2; road.position.set(cx, 0.01, -LOOP_Z);
  scene.add(road);
  [-1, 1].forEach(s => {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(len, 5),
      new THREE.MeshStandardMaterial({ color: 0xb0bec5 }));
    sw.rotation.x = -Math.PI/2; sw.position.set(cx, 0.02, -LOOP_Z + s * 8.5);
    scene.add(sw);
  });
  for (let x = 8; x <= LOOP_X - 8; x += 15) {
    scene.add(makeTree(x, -(LOOP_Z + 14)));
    scene.add(makeStreetLight(x + 5, -(LOOP_Z + 8)));
    scene.add(makeStreetLight(x + 5, -(LOOP_Z - 8)));
  }
  scene.add(makeBench(25, -(LOOP_Z + 10), 0));
  scene.add(makeBench(65, -(LOOP_Z + 10), 0));
  scene.add(makeTrashBin(50, -(LOOP_Z + 8)));
  scene.add(makeDumpster(75, -(LOOP_Z + 9)));
}

function buildEastRoad() {
  const len = LOOP_Z * 2;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(12, len),
    new THREE.MeshStandardMaterial({ color: 0x37474f }));
  road.rotation.x = -Math.PI/2; road.position.set(LOOP_X, 0.01, 0);
  scene.add(road);
  [-1, 1].forEach(s => {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(5, len),
      new THREE.MeshStandardMaterial({ color: 0xb0bec5 }));
    sw.rotation.x = -Math.PI/2; sw.position.set(LOOP_X + s * 8.5, 0.02, 0);
    scene.add(sw);
  });
  const outerLane = new THREE.Mesh(new THREE.PlaneGeometry(8, len),
    new THREE.MeshStandardMaterial({ color: 0x455a64 }));
  outerLane.rotation.x = -Math.PI/2; outerLane.position.set(LOOP_X + 17, 0.015, 0);
  scene.add(outerLane);
  for (let z = -55; z <= 55; z += 15) {
    scene.add(makeTree(LOOP_X + 15, z));
    scene.add(makeTree(LOOP_X - 21, z + 7));
    scene.add(makeStreetLight(LOOP_X + 9.5, z + 4));
    scene.add(makeStreetLight(LOOP_X - 9.5, z - 4));
  }
  scene.add(makeBench(LOOP_X + 9.5,  20,  Math.PI/2));
  scene.add(makeBench(LOOP_X - 9.5, -30, -Math.PI/2));
  scene.add(makeTrashBin(LOOP_X - 11, 15));
  scene.add(makeDumpster(LOOP_X - 12, -20));
}

function buildPark() {
  const park = new THREE.Mesh(new THREE.PlaneGeometry(LOOP_X - 14, LOOP_Z * 2 - 14),
    new THREE.MeshStandardMaterial({ color: 0x388e3c }));
  park.rotation.x = -Math.PI/2; park.position.set(LOOP_X / 2, 0.005, 0);
  scene.add(park);
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x8d9ea8 });
  const pathH = new THREE.Mesh(new THREE.PlaneGeometry(LOOP_X - 14, 4), pathMat);
  pathH.rotation.x = -Math.PI/2; pathH.position.set(LOOP_X / 2, 0.008, 0);
  scene.add(pathH);
  const pathV = new THREE.Mesh(new THREE.PlaneGeometry(4, LOOP_Z * 2 - 14), pathMat);
  pathV.rotation.x = -Math.PI/2; pathV.position.set(LOOP_X / 2, 0.008, 0);
  scene.add(pathV);
  scene.add(makeFountain(LOOP_X / 2, 0));
  const parkTrees = [
    [20, -40],[20, 40],[70, -40],[70, 40],
    [20, -10],[20, 10],[70, -10],[70, 10],
    [45, -45],[45, 45],
  ];
  parkTrees.forEach(([x, z]) => scene.add(makeTree(x, z)));
  scene.add(makeBench(LOOP_X / 2 + 5,  4, 0));
  scene.add(makeBench(LOOP_X / 2 - 5, -4, 0));
  scene.add(makeBench(LOOP_X / 2,      5, Math.PI/2));
}

function buildCorners() {
  const cMat = new THREE.MeshStandardMaterial({ color: 0x455a64 });
  [[0, LOOP_Z], [LOOP_X, LOOP_Z], [LOOP_X, -LOOP_Z], [0, -LOOP_Z]].forEach(([x, z]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), cMat);
    m.rotation.x = -Math.PI/2; m.position.set(x, 0.012, z);
    scene.add(m);
  });
}

function buildEnvironment() {
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
  grass.rotation.x = -Math.PI/2;
  grass.position.set(LOOP_X / 2, 0, 0);
  scene.add(grass);

  buildWestRoad();
  buildNorthRoad();
  buildSouthRoad();
  buildEastRoad();
  buildPark();
  buildCorners();

  const cp = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: 0xf0a500 }));
  cp.position.set(COLLECTION_POINT.x, 0.05, COLLECTION_POINT.z);
  scene.add(cp);

  _ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(_ambientLight);

  _sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
  _sunLight.position.set(20, 30, 10);
  scene.add(_sunLight);

  _moonLight = new THREE.DirectionalLight(0x8899cc, 0.0);
  _moonLight.position.set(-20, 20, -10);
  scene.add(_moonLight);
}

// ── Worker Animation Controller ────────────────────────────────
const WorkerAnimStates = Object.freeze({
  IDLE:    'idle',
  WALK:    'walk',
  PICKUP:  'pickup',
  CARRY:   'carry',
  DROPOFF: 'dropoff',
});

const WORKER_STATE_COLORS = {
  [WorkerAnimStates.IDLE]:    0xf0a500,
  [WorkerAnimStates.WALK]:    0xffb300,
  [WorkerAnimStates.PICKUP]:  0xff5722,
  [WorkerAnimStates.CARRY]:   0xffeb3b,
  [WorkerAnimStates.DROPOFF]: 0x66bb6a,
};

const WORKER_STATE_DURATIONS = {
  [WorkerAnimStates.PICKUP]:  0.65,
  [WorkerAnimStates.DROPOFF]: 0.55,
};

class AnimationController {
  constructor(group) {
    this._group    = group;
    this._body     = group.children[0];
    this._head     = group.children[1];
    this._state    = WorkerAnimStates.IDLE;
    this._timer    = 0;
    this._onDone   = null;
    this._carryBox = this._buildCarryBox();
  }
  get state() { return this._state; }
  setState(newState, onDone) {
    if (this._state === newState) return;
    this._state  = newState;
    this._timer  = WORKER_STATE_DURATIONS[newState] || 0;
    this._onDone = onDone || null;
    this._applyVisuals(newState);
  }
  update(dt) {
    if (_paused) return;
    if (this._timer <= 0) return;
    this._timer -= dt;
    if (this._state === WorkerAnimStates.DROPOFF) {
      const total    = WORKER_STATE_DURATIONS[WorkerAnimStates.DROPOFF];
      const progress = 1 - Math.max(0, this._timer / total);
      this._carryBox.position.y = 1.7 - progress * 1.4;
      this._carryBox.rotation.z = progress * Math.PI;
    }
    if (this._timer <= 0) {
      if (this._state === WorkerAnimStates.DROPOFF) {
        this._carryBox.visible    = false;
        this._carryBox.position.y = 1.7;
        this._carryBox.rotation.z = 0;
      }
      const cb = this._onDone; this._onDone = null; if (cb) cb();
    }
  }
  _buildCarryBox() {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x8d6e63 }));
    box.position.set(0.4, 1.7, 0); box.visible = false;
    this._group.add(box);
    return box;
  }
  _applyVisuals(state) {
    const color = WORKER_STATE_COLORS[state] || COLOR_WORKER;
    if (this._body?.material) this._body.material.color.setHex(color);
    if (this._head?.material) this._head.material.color.setHex(color);
    if (state === WorkerAnimStates.PICKUP) {
      this._body.scale.set(1, 0.6, 1); this._body.position.y = 0.5;
    } else {
      this._body.scale.set(1, 1, 1);   this._body.position.y = 0.8;
    }
    this._carryBox.visible = state === WorkerAnimStates.CARRY || state === WorkerAnimStates.DROPOFF;
  }
}

// ── Base Avatar ────────────────────────────────────────────────
class Avatar {
  constructor(color, pos) {
    this.group  = makeAvatar(color);
    this.group.position.set(pos.x, 0, pos.z);
    this.baseY  = 0;
    this.state  = 'idle';
    this.bobT   = Math.random() * 10;
  }
  facePoint(x, z) {
    const dx = x - this.group.position.x;
    const dz = z - this.group.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.001) this.group.rotation.y = Math.atan2(dx, dz);
  }
  updateBob(dt) {
    const speed = this.state === 'run' ? 14 : this.state === 'walk' ? 7 : 2;
    const amp   = this.state === 'idle' ? 0.03 : this.state === 'walk' ? 0.08 : 0.14;
    this.bobT  += dt * speed;
    this.group.position.y = this.baseY + Math.abs(Math.sin(this.bobT)) * amp;
  }
}

// ── Player ─────────────────────────────────────────────────────
class Player extends Avatar {
  constructor(pos) {
    super(COLOR_PLAYER, pos);
    this.vy       = 0;
    this.grounded = true;
    this._id      = 'player';
    this._dynRef  = { pos: this.group.position, radius: PLAYER_RADIUS, id: this._id };
    registerDynamic(this._dynRef);
  }
  jump() { if (this.grounded) { this.vy = 5; this.grounded = false; } }
  update(dt) {
    if (_paused) return;
    let ix = (keys.l ? -1 : 0) + (keys.r ?  1 : 0) + joyVec.x;
    let iz = (keys.f ? -1 : 0) + (keys.b ?  1 : 0) + joyVec.z;
    const sin = Math.sin(ISO_YAW), cos = Math.cos(ISO_YAW);
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

    this.group.position.x = Math.min(LOOP_X + 8, Math.max(-8, this.group.position.x));
    this.group.position.z = Math.min(LOOP_Z + 8, Math.max(-(LOOP_Z + 8), this.group.position.z));
    resolveCollisions(this.group.position, PLAYER_RADIUS, this._id);

    if (!this.grounded || this.vy !== 0) {
      this.vy    -= 14 * dt;
      this.baseY += this.vy * dt;
      if (this.baseY <= 0) { this.baseY = 0; this.vy = 0; this.grounded = true; }
    }

    Footsteps.tick(this._id, this.state, dt);
    this.updateBob(dt);
  }
  dispose() {
    unregisterDynamic(this._dynRef);
  }
}

// ── Worker NPC ─────────────────────────────────────────────────
const WORKER_REPATH_INTERVAL = 3.0;

class WorkerNPC extends Avatar {
  constructor(homePos) {
    const jitter = () => (Math.random() * 2 - 1);
    super(COLOR_WORKER, { x: homePos.x + jitter(), z: homePos.z + jitter() });
    this.home        = homePos;
    this._id         = 'w' + (++_entityCounter);
    this._anim       = new AnimationController(this.group);
    this._task       = this._newTask();
    this._phase      = 'to_task';
    this._path       = [];
    this._wpIdx      = 0;
    this._repathTimer = 0;
    this._anim.setState(WorkerAnimStates.WALK);
    this._dynRef = { pos: this.group.position, radius: ENTITY_RADIUS, id: this._id };
    registerDynamic(this._dynRef);
    this._requestPath(this._task.x, this._task.z);
  }
  _newTask() {
    return {
      x: this.home.x + (Math.random() * 6 - 3),
      z: this.home.z + (Math.random() * 6 - 3),
    };
  }
  _requestPath(tx, tz) {
    const p = this.group.position;
    const raw = _aStar(p.x, p.z, tx, tz);
    this._path  = _smoothPath(raw, p.x, p.z) || [];
    this._wpIdx = 0;
  }
  update(dt) {
    if (_paused) return;
    this._anim.update(dt);
    this._repathTimer += dt;

    const p = this.group.position;

    if (this._phase === 'to_task' || this._phase === 'returning') {
      const target = this._phase === 'to_task' ? this._task : this.home;

      // Periodic repath
      if (this._repathTimer >= WORKER_REPATH_INTERVAL) {
        this._repathTimer = 0;
        this._requestPath(target.x, target.z);
      }

      // Follow path
      if (this._path.length > 0 && this._wpIdx < this._path.length) {
        const wp   = this._path[this._wpIdx];
        const dx   = wp.x - p.x, dz = wp.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.4) {
          this._wpIdx++;
        } else {
          const speed = 2.2;
          p.x += dx / dist * speed * dt;
          p.z += dz / dist * speed * dt;
          this.facePoint(wp.x, wp.z);
          this.state = 'walk';
          this._anim.setState(WorkerAnimStates.WALK);
          resolveStaticCollisions(p, ENTITY_RADIUS);
          resolveDynamicCollisions(p, ENTITY_RADIUS, this._id);
        }
      } else {
        // Reached destination
        const dx   = target.x - p.x, dz = target.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.5) {
          if (this._phase === 'to_task') {
            this._phase = 'at_task'; this.state = 'idle';
            this._anim.setState(WorkerAnimStates.PICKUP, () => {
              this._phase = 'returning';
              this._requestPath(this.home.x, this.home.z);
              this._anim.setState(WorkerAnimStates.CARRY);
              if (typeof playTaskComplete === 'function') playTaskComplete();
            });
          } else {
            this._phase = 'at_home'; this.state = 'idle';
            this._anim.setState(WorkerAnimStates.DROPOFF, () => {
              this._phase = 'to_task';
              this._task  = this._newTask();
              this._requestPath(this._task.x, this._task.z);
              this._anim.setState(WorkerAnimStates.WALK);
            });
          }
        } else {
          // Direct move if path empty but not at destination
          p.x += dx / dist * 2.2 * dt;
          p.z += dz / dist * 2.2 * dt;
          this.facePoint(target.x, target.z);
          this.state = 'walk';
        }
      }
    } else {
      this.state = 'idle';
    }

    Footsteps.tick(this._id, this.state, dt);
    this.updateBob(dt);
  }
  dispose() {
    unregisterDynamic(this._dynRef);
    Footsteps.remove(this._id);
  }
}

// ── Vehicle NPC ────────────────────────────────────────────────
class VehicleNPC {
  constructor(bizId, vehicleType, fleetLvl, depot, route) {
    this._id      = ++_entityCounter;
    this._bizId   = bizId;
    this._route   = route;
    this._depot   = depot;
    this._wpIndex = 0;
    this._phase   = 'loading';
    this._timer   = 1.5;
    this._speed   = (vehicleType === 'bicycle' ? 4 : vehicleType === 'motorcycle' ? 7 : vehicleType === 'van' ? 5 : 4)
                  * (1 + (fleetLvl - 1) * 0.2);
    const colors  = VEHICLE_COLORS[vehicleType] || [0x888888, 0x666666, 0x444444];
    this.group    = makeVehicleMesh(vehicleType, colors[Math.min(fleetLvl - 1, 2)]);
    this.group.position.set(depot.x, 0, depot.z);
    this.group.rotation.y = Math.PI / 2;
  }
  update(dt) {
    if (_paused) return;
    const p = this.group.position;
    if (this._phase === 'loading') {
      this._timer -= dt;
      if (this._timer <= 0) { this._phase = 'driving'; this._wpIndex = 0; }
    } else if (this._phase === 'driving') {
      const wp = this._route[this._wpIndex];
      const dx = wp.x - p.x, dz = wp.z - p.z, dist = Math.hypot(dx, dz);
      if (dist < 0.4) {
        if (++this._wpIndex >= this._route.length) { this._phase = 'unloading'; this._timer = 1.2; }
      } else {
        p.x += dx / dist * this._speed * dt;
        p.z += dz / dist * this._speed * dt;
        if (dist > 0.1) this.group.rotation.y = Math.atan2(dx, dz);
      }
    } else if (this._phase === 'unloading') {
      this._timer -= dt; if (this._timer <= 0) this._phase = 'returning';
    } else {
      const dx = this._depot.x - p.x, dz = this._depot.z - p.z, dist = Math.hypot(dx, dz);
      if (dist < 0.5) { this._phase = 'loading'; this._timer = 1.5; }
      else {
        p.x += dx / dist * this._speed * dt; p.z += dz / dist * this._speed * dt;
        if (dist > 0.1) this.group.rotation.y = Math.atan2(dx, dz);
      }
    }
  }
  dispose() {}
}

// ── Customer NPC ───────────────────────────────────────────────
class CustomerNPC extends Avatar {
  constructor(spawnPos, businessPos, despawnPos, bizId) {
    super(COLOR_CUSTOMER, spawnPos);
    this.target  = businessPos;
    this.despawn = despawnPos;
    this.bizId   = bizId;
    this.phase   = 'arriving';
    this.timer   = 0;
    this.dead    = false;
    this._id     = 'c' + (++_entityCounter);
    this._dynRef = { pos: this.group.position, radius: ENTITY_RADIUS, id: this._id };
    registerDynamic(this._dynRef);
  }
  update(dt) {
    if (_paused) return;
    const p = this.group.position;
    if (this.phase === 'arriving' || this.phase === 'leaving') {
      const target = this.phase === 'arriving' ? this.target : this.despawn;
      const dx = target.x - p.x, dz = target.z - p.z, dist = Math.hypot(dx, dz);
      if (dist < 0.3) {
        if (this.phase === 'arriving') {
          this.phase = 'purchasing'; this.timer = 1; this.state = 'idle';
          if (typeof playPurchase === 'function') playPurchase();
        } else { this.dead = true; unregisterDynamic(this._dynRef); Footsteps.remove(this._id); }
      } else {
        p.x += dx / dist * 3 * dt; p.z += dz / dist * 3 * dt;
        this.facePoint(target.x, target.z); this.state = 'walk';
        resolveStaticCollisions(p, ENTITY_RADIUS);
        resolveDynamicCollisions(p, ENTITY_RADIUS, this._id);
      }
    } else {
      this.timer -= dt; if (this.timer <= 0) this.phase = 'leaving'; this.state = 'idle';
    }
    Footsteps.tick(this._id, this.state, dt);
    this.updateBob(dt);
  }
}

// ── Input setup ────────────────────────────────────────────────
function setupInput() {
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (KEY_MAP[k]) keys[KEY_MAP[k]] = true;
    if (k === 'shift') inputState.run = true;
    if (k === 'e' && typeof window.interactWithBusiness === 'function') window.interactWithBusiness();
    if (k === ' ') { e.preventDefault(); if (player && !_paused) player.jump(); }
    if (k === 'escape' || k === 'p') { if (typeof window.togglePause === 'function') window.togglePause(); }
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (KEY_MAP[k]) keys[KEY_MAP[k]] = false;
    if (k === 'shift') inputState.run = false;
  });

  const base = document.getElementById('joystick-base');
  const knob = document.getElementById('joystick-knob');
  if (base && knob) {
    const radius = 40;
    let dragging = false;
    const onMove = (cx, cy) => {
      const rect = base.getBoundingClientRect();
      let dx = cx - (rect.left + rect.width  / 2);
      let dy = cy - (rect.top  + rect.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist > radius) { dx = dx / dist * radius; dy = dy / dist * radius; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      joyVec.x = dx / radius; joyVec.z = dy / radius;
    };
    const onEnd = () => { dragging = false; knob.style.transform = 'translate(-50%, -50%)'; joyVec.x = 0; joyVec.z = 0; };
    base.addEventListener('pointerdown',   e => { dragging = true; onMove(e.clientX, e.clientY); base.setPointerCapture(e.pointerId); });
    base.addEventListener('pointermove',   e => { if (dragging) onMove(e.clientX, e.clientY); });
    base.addEventListener('pointerup',     onEnd);
    base.addEventListener('pointercancel', onEnd);
  }

  const runBtn = document.getElementById('run-btn');
  if (runBtn) {
    const setRun = v => { inputState.run = v; runBtn.classList.toggle('active', v); };
    runBtn.addEventListener('pointerdown',  () => setRun(true));
    runBtn.addEventListener('pointerup',    () => setRun(false));
    runBtn.addEventListener('pointercancel',() => setRun(false));
    runBtn.addEventListener('pointerleave', () => setRun(false));
  }

  const jumpBtn = document.getElementById('jump-btn');
  if (jumpBtn) jumpBtn.addEventListener('pointerdown', e => { e.preventDefault(); if (player && !_paused) player.jump(); });

  const _raycaster = new THREE.Raycaster();
  const _mouse     = new THREE.Vector2();
  const INTERACT_RADIUS = 8;

  function _bizIdFromMesh(obj) {
    let cur = obj;
    while (cur) { if (cur.userData?.bizId) return cur.userData.bizId; cur = cur.parent; }
    return null;
  }
  function _getNDC(clientX, clientY) {
    const rect = canvasEl.getBoundingClientRect();
    return { x: ((clientX - rect.left) / rect.width) * 2 - 1, y: -((clientY - rect.top) / rect.height) * 2 + 1 };
  }
  function _tryInteract(clientX, clientY) {
    if (_paused) return;
    const ndc = _getNDC(clientX, clientY);
    _mouse.set(ndc.x, ndc.y);
    _raycaster.setFromCamera(_mouse, camera);
    const meshes = Object.values(businessMeshes);
    const hits   = _raycaster.intersectObjects(meshes, true);
    if (!hits.length) return;
    const bizId = _bizIdFromMesh(hits[0].object);
    if (!bizId) return;
    const pos  = BUSINESS_POS[bizId];
    const dist = Math.hypot(pos.x - player.group.position.x, pos.z - player.group.position.z);
    if (dist > INTERACT_RADIUS) return;
    if (typeof window.openBizPanel === 'function') window.openBizPanel(bizId);
  }

  let _wasDrag = false, _downX = 0, _downY = 0;
  canvasEl.addEventListener('pointerdown', e => { _wasDrag = false; _downX = e.clientX; _downY = e.clientY; });
  canvasEl.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - _downX, e.clientY - _downY) > 5) _wasDrag = true; });
  canvasEl.addEventListener('click', e => { if (!_wasDrag) _tryInteract(e.clientX, e.clientY); });
  canvasEl.addEventListener('touchend', e => {
    if (e.changedTouches.length === 1 && !_wasDrag) {
      const t = e.changedTouches[0]; _tryInteract(t.clientX, t.clientY);
    }
  });
  canvasEl.addEventListener('mousemove', e => {
    const ndc = _getNDC(e.clientX, e.clientY);
    _mouse.set(ndc.x, ndc.y);
    _raycaster.setFromCamera(_mouse, camera);
    const hits = _raycaster.intersectObjects(Object.values(businessMeshes), true);
    if (hits.length) {
      const bizId = _bizIdFromMesh(hits[0].object);
      if (bizId) {
        const pos  = BUSINESS_POS[bizId];
        const dist = Math.hypot(pos.x - player.group.position.x, pos.z - player.group.position.z);
        canvasEl.style.cursor = dist <= INTERACT_RADIUS ? 'pointer' : 'not-allowed';
        return;
      }
    }
    canvasEl.style.cursor = '';
  });

  canvasEl.addEventListener('wheel', e => {
    e.preventDefault();
    cameraZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cameraZoom + e.deltaY * 0.04));
  }, { passive: false });

  let _pinchDist = null;
  canvasEl.style.touchAction = 'none';
  canvasEl.addEventListener('touchstart', e => {
    if (e.touches.length === 2)
      _pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }, { passive: true });
  canvasEl.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && _pinchDist !== null) {
      const nd = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      cameraZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cameraZoom + (_pinchDist - nd) * 0.08));
      _pinchDist = nd;
    }
  }, { passive: true });
  canvasEl.addEventListener('touchend', () => { _pinchDist = null; });
}

function onResize() {
  if (!renderer || !canvasEl) return;
  const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// ── Main loop ──────────────────────────────────────────────────
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);

  _updateDayNight(dt);

  if (!_paused) {
    player.update(dt);
  }

  const cx = player.group.position.x + cameraZoom * Math.sin(ISO_YAW)   * Math.cos(ISO_PITCH);
  const cz = player.group.position.z + cameraZoom * Math.cos(ISO_YAW)   * Math.cos(ISO_PITCH);
  const cy = player.group.position.y + cameraZoom * Math.sin(ISO_PITCH) + 1;
  camera.position.set(cx, cy, cz);
  camera.lookAt(player.group.position.x, player.group.position.y + 1, player.group.position.z);

  if (!_paused) {
    Object.values(workerNPCs).forEach(list => list.forEach(w => w.update(dt)));
    Object.values(vehicleNPCs).forEach(list => list.forEach(v => v.update(dt)));

    customerNPCs.forEach(c => c.update(dt));
    customerNPCs = customerNPCs.filter(c => {
      if (c.dead) { scene.remove(c.group); return false; } return true;
    });

    if (gStateRef) {
      Object.keys(customerSpawnTimers).forEach(bizId => {
        if (!gStateRef.ownedBusinesses.includes(bizId)) return;
        if (typeof BUSINESSES !== 'undefined' && BUSINESSES[bizId]?.category !== 'retail') return;
        customerSpawnTimers[bizId] -= dt;
        if (customerSpawnTimers[bizId] <= 0) {
          if (customerNPCs.filter(c => c.bizId === bizId).length < 2) {
            const pos = BUSINESS_POS[bizId];
            const c = new CustomerNPC({ x: pos.x, z: CUSTOMER_SPAWN.z }, pos, { x: pos.x, z: CUSTOMER_END.z }, bizId);
            customerNPCs.push(c); scene.add(c.group);
          }
          customerSpawnTimers[bizId] = 4 + Math.random() * 5;
        }
      });
    }

    let nearest = null, nearestDist = 6;
    Object.keys(BUSINESS_POS).forEach(bizId => {
      const pos = BUSINESS_POS[bizId];
      const d   = Math.hypot(pos.x - player.group.position.x, pos.z - player.group.position.z);
      if (d < nearestDist) { nearestDist = d; nearest = bizId; }
    });
    if (nearest !== lastInteract) { lastInteract = nearest; if (onInteract) onInteract(nearest); }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ── Public API ─────────────────────────────────────────────────
function init(canvas, gState, businessesData, bizOrder) {
  canvasEl  = canvas;
  gStateRef = gState;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0f11);
  scene.fog        = new THREE.Fog(0x0d0f11, 70, 180);

  camera   = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 300);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  buildEnvironment();

  bizOrder.forEach(bizId => {
    const pos = BUSINESS_POS[bizId];
    if (!pos) return;
    businessMeshes[bizId]      = makeBusinessMesh(bizId, pos.x, pos.z);
    scene.add(businessMeshes[bizId]);
    workerNPCs[bizId]          = [];
    vehicleNPCs[bizId]         = [];
    customerSpawnTimers[bizId] = 3 + Math.random() * 5;
  });

  player = new Player(PLAYER_SPAWN);
  scene.add(player.group);

  _buildGrid();

  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);
  setupInput();
  updateWorld(gState, businessesData);
  requestAnimationFrame(loop);
}

function updateWorld(gState, businessesData) {
  gStateRef = gState;
  Object.keys(businessMeshes).forEach(bizId => {
    const grp   = businessMeshes[bizId];
    const owned = gState.ownedBusinesses.includes(bizId);
    const mesh  = grp.userData.mainMesh;
    if (mesh?.material) {
      mesh.material.color.setHex(owned ? BIZ_COLORS[bizId] : 0x555555);
      mesh.material.opacity = owned ? 1 : 0.3;
    }

    const wList   = workerNPCs[bizId];
    const desired = Math.min(gState.workers[bizId] || 0, 3);
    while (wList.length < desired) { const w = new WorkerNPC(BUSINESS_POS[bizId]); wList.push(w); scene.add(w.group); }
    while (wList.length > desired) { const w = wList.pop(); w.dispose(); scene.remove(w.group); }

    const biz = typeof BUSINESSES !== 'undefined' ? BUSINESSES[bizId] : null;
    if (biz?.category === 'transport' && owned) {
      const vList   = vehicleNPCs[bizId];
      const drivers = Math.min(gState.workers[bizId] || 0, 3);
      const fLevel  = gState.fleetLevel?.[bizId] || 1;
      const route   = (typeof DELIVERY_ROUTES !== 'undefined') ? DELIVERY_ROUTES[bizId] : null;
      const depot   = BUSINESS_POS[bizId];
      while (vList.length < drivers && route) {
        const v = new VehicleNPC(bizId, biz.vehicleType, fLevel, { x: depot.x, z: depot.z + vList.length * 2 }, route);
        vList.push(v); scene.add(v.group);
      }
      while (vList.length > drivers) { const v = vList.pop(); v.dispose(); scene.remove(v.group); }
    } else if (!owned && vehicleNPCs[bizId]?.length) {
      vehicleNPCs[bizId].forEach(v => { v.dispose(); scene.remove(v.group); });
      vehicleNPCs[bizId] = [];
    }
  });
}

function setPaused(state) {
  _paused = state;
  if (clock) {
    if (_paused) clock.stop();
    else clock.start();
  }
}

function setInteractCallback(cb) { onInteract = cb; }

window.WorldAPI = { init, updateWorld, setInteractCallback, setPaused, isPaused: () => _paused };