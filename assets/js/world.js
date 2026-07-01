// ============================
// RISE FROM NOTHING — WORLD v5
// Entity Collisions | Smart Pathfinding | Day-Night Cycle | Pause | Pedestrians | Mouse Interact
// ============================
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const COLOR_PLAYER      = 0x448aff;
const COLOR_WORKER      = 0xf0a500;
const COLOR_CUSTOMER    = 0x00e676;
const COLOR_PEDESTRIAN  = 0xb0bec5;

const BIZ_COLORS = {
  food_cart:          0xff7043,
  small_store:        0x789fe0,
  convenience_store:  0xab47bc,
  mini_market:        0xffca28,
  bicycle_courier:    0x26c6da,
  motorcycle_courier: 0xef5350,
  delivery_van:       0x66bb6a,
  logistics_company:  0xffa726,
  boarding_house:     0x8d6e63,
  apartment:          0x5c6bc0,
  commercial_unit:    0x26a69a,
  office_building:    0x78909c,
  restaurant:          0xe64980,
  convenience_chain:   0xfab005,
  grocery_chain:       0x40c057,
  supermarket:         0x228be6,
};

const VEHICLE_COLORS = {
  bicycle:    [0x26c6da, 0x00acc1, 0x006064],
  motorcycle: [0xef5350, 0xe53935, 0xb71c1c],
  van:        [0x66bb6a, 0x43a047, 0x1b5e20],
  truck:      [0xffa726, 0xfb8c00, 0xe65100],
};

// ── Quadrant tiling (2x2 grid = 4x map) ─────────────────────────
const BLOCK_W = 130; // LOOP_X(90) + 40 gap
const BLOCK_H = 160; // LOOP_Z*2(120) + 40 gap
const QUAD_OFFSETS = [
  { x: 0,        z: 0        }, // Q00 — home quadrant (businesses, spawn, park systems)
  { x: -BLOCK_W, z: 0        }, // west expansion
  { x: 0,        z: -BLOCK_H }, // south expansion
  { x: -BLOCK_W, z: -BLOCK_H }, // both
];

const BUSINESS_POS = {
  food_cart:          { x: 14, z: -36 },
  small_store:        { x: 14, z: -14 },
  convenience_store:  { x: 14, z:  12 },
  mini_market:        { x: 14, z:  36 },
  bicycle_courier:    { x:-14, z: -36 },
  motorcycle_courier: { x:-14, z: -14 },
  delivery_van:       { x:-14, z:  12 },
  logistics_company:  { x:-14, z:  36 },
  boarding_house:     { x: BLOCK_W - 14, z: -36 },
  apartment:          { x: BLOCK_W - 14, z: -14 },
  commercial_unit:    { x: BLOCK_W - 14, z:  12 },
  office_building:    { x: BLOCK_W - 14, z:  36 },
  restaurant:          { x: 32, z: -52 },
  convenience_chain:   { x: 32, z: -26 },
  grocery_chain:       { x: 32, z:  26 },
  supermarket:         { x: 32, z:  52 },
};

const COLLECTION_POINT = { x: 0, z: 46 };
const PLAYER_SPAWN     = { x: 0, z: 40 };
const CUSTOMER_SPAWN   = { x: 14, z: -56 };
const CUSTOMER_END     = { x: 14, z:  56 };

// ── Beggar Targets ────────────────────────────────────────────
const BEG_INTERACT_RADIUS = 2.4;
const BEG_COOLDOWN        = 15;
const BEG_GLOBAL_COOLDOWN = 0.6;
const BEG_TARGET_COUNT    = 52;
const BEG_MIN_SPACING     = 7;
const BEG_ACTION_TYPES    = ['collect_bottles', 'collect_scrap']; // ask_change handled by walking NPCs

// ── Street Sweeper Zones ──────────────────────────────────────
const TRASH_COLLECT_RADIUS = 1.4;
const SWEEP_BIN_RADIUS     = 2.4;

const SWEEP_ZONES = {
  sweep_block:  { center: { x: 0,  z: -25 }, radius: 8,  bin: { x: 0,  z: -35 } },
  sweep_market: { center: { x: 45, z: 22 },  radius: 16, bin: { x: 45, z: 6  } },
};

// ── Pedestrian system ─────────────────────────────────────────
const PEDESTRIAN_COUNT      = 64;
const PEDESTRIAN_SPEED      = 1.6;
const PEDESTRIAN_REPATH     = 8.0;
const PEDESTRIAN_IDLE_TIME  = 2.5;
const STUCK_CHECK_INTERVAL  = 1.6;
const STUCK_MIN_MOVE        = 0.35;

// Pedestrian waypoint zones: sidewalks, park paths, park interior
// These are world-space rectangular zones pedestrians pick goals from
const PEDESTRIAN_ZONES = [
  // West sidewalk (both sides)
  { xMin: -12, xMax: -8,  zMin: -55, zMax:  55 },
  { xMin:   8, xMax:  12, zMin: -55, zMax:  55 },
  // North sidewalk
  { xMin:   2, xMax:  88, zMin:  63, zMax:  67 },
  // South sidewalk
  { xMin:   2, xMax:  88, zMin: -67, zMax: -63 },
  // East sidewalk
  { xMin:  84, xMax:  88, zMin: -55, zMax:  55 },
  // Park horizontal path
  { xMin:  18, xMax:  72, zMin:  -2, zMax:   2 },
  // Park vertical path
  { xMin:  43, xMax:  47, zMin: -52, zMax:  52 },
  // Park interior (green areas)
  { xMin:  20, xMax:  43, zMin: -52, zMax:  -4 },
  { xMin:  47, xMax:  70, zMin: -52, zMax:  -4 },
  { xMin:  20, xMax:  43, zMin:   4, zMax:  52 },
  { xMin:  47, xMax:  70, zMin:   4, zMax:  52 },
];

// Same zones repeated across all 4 quadrants of the tiled map
const ALL_PEDESTRIAN_ZONES = QUAD_OFFSETS.flatMap(q =>
  PEDESTRIAN_ZONES.map(z => ({ xMin: z.xMin + q.x, xMax: z.xMax + q.x, zMin: z.zMin + q.z, zMax: z.zMax + q.z }))
);

// ── Isometric Camera ───────────────────────────────────────────
const ISO_YAW   = Math.PI / 4;
const ISO_PITCH = 0.6154;
const ZOOM_MIN  = 10;
const ZOOM_MAX  = 45;
let   cameraZoom = 22;

// ── Map layout constants ───────────────────────────────────────
const LOOP_Z  = 60;
const LOOP_X  = 90;

// ── Road tarmac zones (block pedestrian pathfinding — foot traffic
// must use sidewalks and only cross at marked crosswalks) ─────────
// Local (per-block, unshifted) rectangles. cx/cz = center, w = x-extent, h = z-extent.
const ROAD_TARMAC_ZONES = [
  // West road: main lane + outer lane (sidewalks at x -12..-7 / 7..12 stay open)
  { cx: 0,  cz: 0, w: 14, h: 130 },
  { cx: -17, cz: 0, w: 10, h: 130 },
  // East road: main lane + outer lane
  { cx: LOOP_X,      cz: 0, w: 14, h: 130 },
  { cx: LOOP_X + 17, cz: 0, w: 10, h: 130 },
  // North / South roads (sidewalks already flush, no extra outer lane)
  { cx: LOOP_X / 2, cz:  LOOP_Z, w: 96, h: 12 },
  { cx: LOOP_X / 2, cz: -LOOP_Z, w: 96, h: 12 },
];

// Crosswalk gaps cut through the tarmac zones above — pedestrians may
// only cross here. Rendered as zebra stripes in buildCrosswalks().
const CROSSWALK_ZONES = [
  { cx: -5,          cz: 0,   w: 34, h: 6, dir: 'z' },
  { cx: -5,          cz: -40, w: 34, h: 6, dir: 'z' },
  { cx: -5,          cz:  40, w: 34, h: 6, dir: 'z' },
  { cx: LOOP_X + 7.5, cz: 0,   w: 30, h: 6, dir: 'z' },
  { cx: LOOP_X + 7.5, cz: -40, w: 30, h: 6, dir: 'z' },
  { cx: LOOP_X + 7.5, cz:  40, w: 30, h: 6, dir: 'z' },
  { cx: 25, cz:  LOOP_Z, w: 6, h: 12, dir: 'x' },
  { cx: 65, cz:  LOOP_Z, w: 6, h: 12, dir: 'x' },
  { cx: 25, cz: -LOOP_Z, w: 6, h: 12, dir: 'x' },
  { cx: 65, cz: -LOOP_Z, w: 6, h: 12, dir: 'x' },
];

// Inter-quadrant connector bridges (also tarmac — pedestrians don't cross
// these; they have no sidewalks). Defined once, in absolute world space,
// linking every pair of adjacent quadrants so the 2x2 map has no dead seams.
const CONNECTOR_W = BLOCK_W - LOOP_X + 20;
const CONNECTOR_H = BLOCK_H - LOOP_Z * 2 + 20;
const QUAD_CONNECTORS = [
  { cx: -(LOOP_X + CONNECTOR_W / 2), cz: 0,           w: CONNECTOR_W, h: 10, axis: 'x' }, // home ↔ west
  { cx: LOOP_X / 2, cz: -(LOOP_Z + CONNECTOR_H / 2),  w: 10, h: CONNECTOR_H, axis: 'z' }, // home ↔ south
  { cx: -(LOOP_X + CONNECTOR_W / 2) - BLOCK_W, cz: 0, w: CONNECTOR_W, h: 10, axis: 'x' }, // south ↔ both
  { cx: LOOP_X / 2, cz: -(LOOP_Z + CONNECTOR_H / 2) - BLOCK_H, w: 10, h: CONNECTOR_H, axis: 'z' }, // west ↔ both
];

// ── Pause State ───────────────────────────────────────────────
let _paused = false;

function isPaused() { return _paused; }

// ── Day-Night Cycle ───────────────────────────────────────────
// Day = 11.5 min, Night = 8.5 min (3 min shorter), total = 20 min
const DAY_NIGHT_CYCLE_MS = 20 * 60 * 1000;
const _DAY_FRAC          = 11.5 / 20; // 0.575 — fraction of cycle that is day
// _cycleTime = 0.2875 → noon (midpoint of day phase, _DAY_FRAC / 2)
let _cycleTime = 0.2875;
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

  // Remap _cycleTime so day occupies _DAY_FRAC of the cycle:
  //   [0, _DAY_FRAC)  → natural [0.25, 0.75]  (sun above horizon)
  //   [_DAY_FRAC, 1)  → natural [0.75, 1.25]  (sun below horizon, wraps mod 1)
  let naturalT;
  if (_cycleTime < _DAY_FRAC) {
    naturalT = 0.25 + (_cycleTime / _DAY_FRAC) * 0.5;
  } else {
    const nt = (_cycleTime - _DAY_FRAC) / (1 - _DAY_FRAC);
    naturalT = (0.75 + nt * 0.5) % 1;
  }

  const sunAngle = naturalT * Math.PI * 2;
  const sunY     = Math.sin(sunAngle - Math.PI / 2);
  const sunX     = Math.cos(sunAngle - Math.PI / 2);

  const dayFrac  = Math.max(0, sunY);
  const dawnDusk = Math.max(0, Math.min(1, (sunY + 0.15) / 0.15));

  const ambientDay   = 0.75;
  const ambientNight = 0.12;
  const ambientVal   = ambientNight + (ambientDay - ambientNight) * dayFrac;
  if (_ambientLight) _ambientLight.intensity = ambientVal;

  if (_sunLight) {
    _sunLight.intensity = 0.8 * Math.max(0, sunY);
    _sunLight.position.set(sunX * 40, Math.max(0.1, sunY) * 30, 10);
    const noon   = new THREE.Color(0xffffff);
    const golden = new THREE.Color(0xff9944);
    const sunColor = noon.clone().lerp(golden, Math.max(0, 1 - dayFrac * 4));
    _sunLight.color.copy(sunColor);
  }

  if (_moonLight) {
    const moonY = -sunY;
    _moonLight.intensity = 0.15 * Math.max(0, moonY);
    _moonLight.position.set(-sunX * 40, Math.max(0.1, moonY) * 30, -10);
  }

  if (scene) {
    let skyColor;
    if (sunY > 0.15) {
      skyColor = new THREE.Color(0x0d0f11).lerp(new THREE.Color(0x162030), dayFrac);
    } else if (sunY > -0.15) {
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

  if (_streetLights) {
    const lightsOn = sunY < 0.1;
    const lampIntensity = lightsOn ? Math.max(0, 1 - dayFrac * 10) : 0;
    _streetLights.forEach(m => {
      if (m.material?.emissiveIntensity !== undefined)
        m.material.emissiveIntensity = 0.1 + lampIntensity * 0.8;
    });
    const winIntensity = 0.08 + lampIntensity * 0.7;
    _buildingWindowMats.forEach(m => { m.emissiveIntensity = winIntensity; });
  }
}

// ── Collision system ───────────────────────────────────────────
const _staticColliders = [];
const PLAYER_RADIUS    = 0.42;
const ENTITY_RADIUS    = 0.38;

// ── Static distance culling (perf optimization for 4x map) ─────
// Three.js already frustum-culls every Mesh by default; this adds
// a distance cutoff so far-quadrant decorative props skip rendering
// entirely, cutting draw calls when the player is on the other side
// of the map.
const _staticCullables = [];
const CULL_DIST_SQ = 100 * 100;
let _cullFrame = 0;
function _updateStaticCulling() {
  _cullFrame = (_cullFrame + 1) % 4;
  if (_cullFrame !== 0 || !player) return;
  const px = player.group.position.x, pz = player.group.position.z;
  for (const obj of _staticCullables) {
    const dx = obj.position.x - px, dz = obj.position.z - pz;
    obj.visible = (dx * dx + dz * dz) <= CULL_DIST_SQ;
  }
}

function _updateEntityCulling() {
  if (!player) return;
  const px = player.group.position.x, pz = player.group.position.z;
  const cullGroup = (grp) => {
    if (!grp) return;
    const dx = grp.position.x - px, dz = grp.position.z - pz;
    grp.visible = (dx * dx + dz * dz) <= CULL_DIST_SQ;
  };
  Object.values(workerNPCs).forEach(list => list.forEach(w => cullGroup(w.group)));
  Object.values(vehicleNPCs).forEach(list => list.forEach(v => cullGroup(v.group)));
  customerNPCs.forEach(c => cullGroup(c.group));
  pedestrianNPCs.forEach(p => cullGroup(p.group));
}

function addBoxCollider(cx, cz, hw, hd, opts) {
  _staticColliders.push({
    minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd,
    steppable: !!(opts && opts.steppable),
  });
}

// Low curbs/islands (roundabouts, the central park) the player can hop
// onto — still solid ground for NPC pathfinding, but not a wall for the
// player once airborne or already standing on top of them.
function addSteppableCollider(cx, cz, hw, hd) {
  addBoxCollider(cx, cz, hw, hd, { steppable: true });
}

function resolveStaticCollisions(pos, radius, playerMode) {
  const r = radius || PLAYER_RADIUS;
  for (let pass = 0; pass < 2; pass++) {
    for (const box of _staticColliders) {
      if (playerMode && box.steppable && !playerMode.grounded) continue; // jumping clears it
      if (pos.x + r > box.minX && pos.x - r < box.maxX &&
          pos.z + r > box.minZ && pos.z - r < box.maxZ) {
        if (playerMode && box.steppable && playerMode.onTop) continue; // already standing on it
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

const _dynamicEntities = [];

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

function resolveCollisions(pos, radius, selfId, playerMode) {
  resolveStaticCollisions(pos, radius, playerMode);
  if (selfId !== undefined) resolveDynamicCollisions(pos, radius, selfId);
}

// ── Pathfinding (grid-based A*) ───────────────────────────────
const PF_CELL   = 2.0;
const PF_ORIGIN = { x: -155, z: -235 };
const PF_COLS   = 140;
const PF_ROWS   = 170;

let _pfGrid = null;

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

function _markGridRect(cx, cz, w, h, value) {
  const minX = cx - w / 2, maxX = cx + w / 2;
  const minZ = cz - h / 2, maxZ = cz + h / 2;
  const c0 = Math.max(0, Math.floor((minX - PF_ORIGIN.x) / PF_CELL));
  const c1 = Math.min(PF_COLS - 1, Math.ceil((maxX - PF_ORIGIN.x) / PF_CELL));
  const r0 = Math.max(0, Math.floor((minZ - PF_ORIGIN.z) / PF_CELL));
  const r1 = Math.min(PF_ROWS - 1, Math.ceil((maxZ - PF_ORIGIN.z) / PF_CELL));
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++)
      _pfGrid[r * PF_COLS + c] = value;
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

  // Block road tarmac in every quadrant, then reopen marked crosswalks
  // so pedestrians only cross roads at legal crossing points.
  QUAD_OFFSETS.forEach(q => {
    ROAD_TARMAC_ZONES.forEach(z => _markGridRect(z.cx + q.x, z.cz + q.z, z.w, z.h, 1));
  });
  QUAD_CONNECTORS.forEach(c => _markGridRect(c.cx, c.cz, c.w, c.h, 1));
  QUAD_OFFSETS.forEach(q => {
    CROSSWALK_ZONES.forEach(z => _markGridRect(z.cx + q.x, z.cz + q.z, z.w, z.h, 0));
  });
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

  const DIRS  = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  const COSTS = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414];

  let iters = 0;
  while (open.size > 0 && iters++ < 7000) {
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

function _pickFreeTrashSpot(center, radius) {
  for (let i = 0; i < 60; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r   = 1.5 + Math.random() * (radius - 1.5);
    const x   = center.x + Math.cos(ang) * r;
    const z   = center.z + Math.sin(ang) * r;
    const c   = _worldToCell(x, z);
    if (c.col < 0 || c.col >= PF_COLS || c.row < 0 || c.row >= PF_ROWS) continue;
    if (_pfGrid && _pfGrid[_pfIdx(c.col, c.row)] === 0) return { x, z };
  }
  return { x: center.x + (Math.random() - 0.5) * radius, z: center.z + (Math.random() - 0.5) * radius };
}

function _randomFreeSpot(xMin, xMax, zMin, zMax) {
  for (let i = 0; i < 40; i++) {
    const x = xMin + Math.random() * (xMax - xMin);
    const z = zMin + Math.random() * (zMax - zMin);
    const c = _worldToCell(x, z);
    if (c.col < 0 || c.col >= PF_COLS || c.row < 0 || c.row >= PF_ROWS) continue;
    if (_pfGrid && _pfGrid[_pfIdx(c.col, c.row)] === 0) return { x, z };
  }
  return null;
}

// Pick a random goal from pedestrian walkable zones
function _randomPedestrianGoal() {
  const zone = ALL_PEDESTRIAN_ZONES[Math.floor(Math.random() * ALL_PEDESTRIAN_ZONES.length)];
  for (let i = 0; i < 20; i++) {
    const x = zone.xMin + Math.random() * (zone.xMax - zone.xMin);
    const z = zone.zMin + Math.random() * (zone.zMax - zone.zMin);
    const c = _worldToCell(x, z);
    if (c.col < 0 || c.col >= PF_COLS || c.row < 0 || c.row >= PF_ROWS) continue;
    if (_pfGrid && _pfGrid[_pfIdx(c.col, c.row)] === 0) return { x, z };
  }
  // fallback: center of zone
  return { x: (zone.xMin + zone.xMax) / 2, z: (zone.zMin + zone.zMax) / 2 };
}

// Pick a spawn point from pedestrian zones
function _randomPedestrianSpawn() {
  return _randomPedestrianGoal();
}

let scene, camera, renderer, clock, canvasEl;
let player;
let businessMeshes = {};
let workerNPCs     = {};
let vehicleNPCs    = {};
let customerNPCs   = [];
let pedestrianNPCs = [];
let customerSpawnTimers = {};
let gStateRef  = null;
let onInteract = null;
let lastInteract = null;
let _entityCounter = 0;
let _streetLights  = [];
let _buildingOccluders  = [];
let _buildingWindowMats = [];

// ── Beggar / Street Sweeper state ─────────────────────────────
let _begTargets   = {};
let _begGlobalCooldown = 0;
let _trashItems   = [];
let _sweepBinMesh = null;
let _sweepZone    = null;
let _carryStack   = [];
let _depositAnims = [];

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

// ── City Skyline Buildings ──────────────────────────────────────
const BUILDING_PALETTE = [0x37414d, 0x3e4a52, 0x455563, 0x2f3a44, 0x4a4038, 0x394a3d, 0x3c3348];
// Avatar stands ~1.9 units tall (capsule + head). A floor needs headroom
// above that, so each storey is scaled up from the avatar's height.
const AVATAR_HEIGHT = 1.9;
const FLOOR_HEIGHT   = AVATAR_HEIGHT * 1.8;

function _makeWindowTexture() {
  const w = 48, h = 96;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#12141a';
  ctx.fillRect(0, 0, w, h);
  const cols = 5, rows = 10;
  const cw = w / cols, ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      if (Math.random() < 0.3) continue;
      const lit = Math.random() < 0.5;
      ctx.fillStyle = lit ? '#ffdf8a' : '#20262f';
      ctx.fillRect(col * cw + 2, r * ch + 2, cw - 4, ch - 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeCityBuilding(x, z, maxW, maxD, hMin, hMax) {
  maxW = maxW ?? 10; maxD = maxD ?? 10; hMin = hMin ?? 7; hMax = hMax ?? 16;
  const width  = maxW * (0.55 + Math.random() * 0.45);
  const depth  = maxD * (0.55 + Math.random() * 0.45);
  const height = hMin + Math.random() * (hMax - hMin);
  const color  = BUILDING_PALETTE[Math.floor(Math.random() * BUILDING_PALETTE.length)];

  const tex = _makeWindowTexture();
  tex.repeat.set(Math.max(1, Math.round(width / 3)), Math.max(1, Math.round(height / FLOOR_HEIGHT)));

  const mat = new THREE.MeshStandardMaterial({
    color,
    map: tex,
    emissive: 0xffdf8a,
    emissiveMap: tex,
    emissiveIntensity: 0.08,
    transparent: false,
    opacity: 1,
  });

  const g    = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
  body.position.y = height / 2;
  g.add(body);

  const roofMat = new THREE.MeshStandardMaterial({ color: 0x22262c, transparent: false, opacity: 1 });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.4, depth * 0.9), roofMat);
  roof.position.y = height + 0.2;
  g.add(roof);

  const materials = [mat, roofMat];

  if (Math.random() < 0.55) {
    const antMat = new THREE.MeshStandardMaterial({ color: 0x888888, transparent: false, opacity: 1 });
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2 + Math.random() * 2, 6), antMat);
    antenna.position.set((Math.random() - 0.5) * width * 0.4, height + 1.2, (Math.random() - 0.5) * depth * 0.4);
    g.add(antenna);
    materials.push(antMat);
  }

  g.position.set(x, 0, z);
  g.userData._opacity = 1;

  addBoxCollider(x, z, width / 2, depth / 2);
  _buildingWindowMats.push(mat);
  _buildingOccluders.push({
    mesh: g,
    materials,
    radius: Math.max(width, depth) / 2,
    height,
    baseY: 0,
  });

  return g;
}

function _buildCityscape() {
  // Fixed grid, inside the road loop, in the park's east half where no
  // business plots sit. Height is driven by floor count (avatar-scaled),
  // footprint is bigger too, gaps between cells stay tight walkable alleys.
  const cols = [55, 71];
  const rows = [-44, -28, -12, 12, 28, 44];
  const minFloors = 6, maxFloors = 14;

  cols.forEach(cx => {
    rows.forEach(cz => {
      scene.add(makeCityBuilding(cx, cz, 14, 14, minFloors * FLOOR_HEIGHT, maxFloors * FLOOR_HEIGHT));
    });
  });
}

function makeBegTarget(actionId, x, z) {
  let g;
  if (actionId === 'ask_change') {
    g = makeAvatar(0x9e9e9e);
    g.scale.set(0.8, 0.8, 0.8);
  } else if (actionId === 'collect_bottles') {
    g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x4caf50, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 6), mat);
      b.position.set((i - 1) * 0.25, 0.2, (i % 2 === 0 ? 0.1 : -0.1));
      g.add(b);
    }
  } else {
    g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x78909c });
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.35), mat);
      b.position.set((i - 1) * 0.15, 0.1 + i * 0.16, (i % 2 === 0 ? 0.1 : -0.1));
      b.rotation.y = i * 0.6;
      g.add(b);
    }
  }
  g.position.set(x, 0, z);
  return g;
}

function makeTrashItem(x, z) {
  // Vary trash appearance for visual diversity
  const types = [0x8d6e63, 0x546e7a, 0x795548, 0x607d8b, 0x4e342e];
  const color = types[Math.floor(Math.random() * types.length)];
  const sizeX = 0.2 + Math.random() * 0.22;
  const sizeY = 0.18 + Math.random() * 0.18;
  const sizeZ = 0.2 + Math.random() * 0.22;
  const m = new THREE.Mesh(new THREE.BoxGeometry(sizeX, sizeY, sizeZ),
    new THREE.MeshStandardMaterial({ color }));
  m.position.set(x, sizeY / 2, z);
  m.rotation.y = Math.random() * Math.PI * 2;
  m.rotation.z = (Math.random() - 0.5) * 0.4;
  return m;
}

function makeSweepBin(x, z) {
  const g    = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x00e676, emissive: 0x00e676, emissiveIntensity: 0.18 }));
  body.position.y = 0.6;
  g.add(body);
  g.position.set(x, 0, z);
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

  const isFranchise = biz?.category === 'franchise';

  if (isFranchise) {
    const lotSize = bizId === 'supermarket' ? 8 : bizId === 'grocery_chain' ? 7 : 6;
    const height  = bizId === 'supermarket' ? 4.5 : bizId === 'grocery_chain' ? 4 : 3.2;
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(lotSize + 2, lotSize + 1),
      new THREE.MeshStandardMaterial({ color: 0x37474f }));
    lot.rotation.x = -Math.PI / 2; lot.position.y = 0.09;
    const building = new THREE.Mesh(new THREE.BoxGeometry(lotSize, height, lotSize - 1),
      new THREE.MeshStandardMaterial({ color, transparent: true }));
    building.position.y = height / 2;
    const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x333333 }));
    signPole.position.set(0, 1.1, lotSize / 2 + 0.6);
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.1),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 }));
    signBoard.position.set(0, 2.4, lotSize / 2 + 0.6);
    g.add(lot, building, signPole, signBoard);
    mesh = building;
    addBoxCollider(x, z, lotSize / 2 + 0.3, lotSize / 2 + 0.3);
    g.position.set(x, 0, z);
    g.userData.mainMesh = mesh;
    g.userData.bizId    = bizId;
    return g;
  }

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
  } else if (biz?.category === 'property') {
    const parking = new THREE.Mesh(new THREE.PlaneGeometry(7, 6),
      new THREE.MeshStandardMaterial({ color: 0x37474f }));
    parking.rotation.x = -Math.PI / 2; parking.position.y = 0.08;
    const height = biz.propertyType === 'office' ? 6 : biz.propertyType === 'apartment' ? 4.5 : 3;
    const building = new THREE.Mesh(new THREE.BoxGeometry(4, height, 4),
      new THREE.MeshStandardMaterial({ color, transparent: true }));
    building.position.set(-1, height / 2, 0);
    const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x333333 }));
    signPole.position.set(2.2, 0.8, 1.8);
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.08),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15 }));
    signBoard.position.set(2.2, 1.7, 1.8);
    g.add(parking, building, signPole, signBoard);
    mesh = building;
    addBoxCollider(x, z, 3.6, 3.0);
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
  const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 130),
    new THREE.MeshStandardMaterial({ color: 0x37474f }));
  road.rotation.x = -Math.PI/2; road.position.y = 0.01;
  scene.add(road);

  [-9.5, 9.5].forEach(x => {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(5, 130),
      new THREE.MeshStandardMaterial({ color: 0xb0bec5 }));
    sw.rotation.x = -Math.PI/2; sw.position.set(x, 0.02, 0);
    scene.add(sw);
  });

  const leftLane = new THREE.Mesh(new THREE.PlaneGeometry(10, 130),
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
  const road = new THREE.Mesh(new THREE.PlaneGeometry(14, len),
    new THREE.MeshStandardMaterial({ color: 0x37474f }));
  road.rotation.x = -Math.PI/2; road.position.set(LOOP_X, 0.01, 0);
  scene.add(road);
  [-1, 1].forEach(s => {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(5, len),
      new THREE.MeshStandardMaterial({ color: 0xb0bec5 }));
    sw.rotation.x = -Math.PI/2; sw.position.set(LOOP_X + s * 8.5, 0.02, 0);
    scene.add(sw);
  });
  const outerLane = new THREE.Mesh(new THREE.PlaneGeometry(10, len),
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
    [20, -40],[20, 40],
    [20, -10],[20, 10],
    [45, -45],[45, 45],
  ];
  parkTrees.forEach(([x, z]) => scene.add(makeTree(x, z)));
  scene.add(makeBench(LOOP_X / 2 + 5,  4, 0));
  scene.add(makeBench(LOOP_X / 2 - 5, -4, 0));
  scene.add(makeBench(LOOP_X / 2,      5, Math.PI/2));
}

const ROUNDABOUT_RADIUS = 19;
const ROUNDABOUT_ISLAND = 6;
const ROUNDABOUT_CENTERS = [[0, LOOP_Z], [LOOP_X, LOOP_Z], [LOOP_X, -LOOP_Z], [0, -LOOP_Z]];

function makeRoundabout(x, z) {
  const g = new THREE.Group();

  // Paved plaza covering the full intersection footprint
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(ROUNDABOUT_RADIUS, 32),
    new THREE.MeshStandardMaterial({ color: 0x37474f }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.012;
  g.add(plaza);

  // Lane-divider ring around the island
  const ring = new THREE.Mesh(new THREE.RingGeometry(ROUNDABOUT_ISLAND + 0.15, ROUNDABOUT_ISLAND + 0.55, 32),
    new THREE.MeshStandardMaterial({ color: 0xe8eaed }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.018;
  g.add(ring);

  // Raised curb + grass island
  const curb = new THREE.Mesh(new THREE.CylinderGeometry(ROUNDABOUT_ISLAND, ROUNDABOUT_ISLAND, 0.22, 24),
    new THREE.MeshStandardMaterial({ color: 0xb0bec5 }));
  curb.position.y = 0.11;
  g.add(curb);
  const island = new THREE.Mesh(new THREE.CylinderGeometry(ROUNDABOUT_ISLAND - 0.4, ROUNDABOUT_ISLAND - 0.4, 0.08, 24),
    new THREE.MeshStandardMaterial({ color: 0x388e3c }));
  island.position.y = 0.26;
  g.add(island);

  const bush = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
  bush.position.set(x - 2.4, 1.15, z + 2.4);
  scene.add(bush);

  scene.add(makeTree(x + 0.9, z - 0.6));
  scene.add(makeStreetLight(x, z + ROUNDABOUT_ISLAND - 1.2));

  g.position.set(x, 0, z);
  addSteppableCollider(x, z, ROUNDABOUT_ISLAND, ROUNDABOUT_ISLAND);
  return g;
}

function buildCorners() {
  ROUNDABOUT_CENTERS.forEach(([x, z]) => scene.add(makeRoundabout(x, z)));
}

function buildCrosswalks() {
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xe8eaed });
  CROSSWALK_ZONES.forEach(cw => {
    const stripeCount = 5;
    if (cw.dir === 'z') {
      const stripeW = cw.w / (stripeCount * 2 - 1);
      for (let i = 0; i < stripeCount; i++) {
        const sx = cw.cx - cw.w / 2 + stripeW * (2 * i + 0.5);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(stripeW, cw.h * 0.8), stripeMat);
        m.rotation.x = -Math.PI / 2; m.position.set(sx, 0.022, cw.cz);
        scene.add(m);
      }
    } else {
      const stripeH = cw.h / (stripeCount * 2 - 1);
      for (let i = 0; i < stripeCount; i++) {
        const sz = cw.cz - cw.h / 2 + stripeH * (2 * i + 0.5);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(cw.w * 0.8, stripeH), stripeMat);
        m.rotation.x = -Math.PI / 2; m.position.set(cw.cx, 0.022, sz);
        scene.add(m);
      }
    }
  });
}

function _buildBlock(ox, oz) {
  // Offset-inject every mesh/collider added by the shared builder
  // functions so one set of builders can stamp out N map copies.
  const realAdd      = scene.add.bind(scene);
  const realCollider = addBoxCollider;
  scene.add = (obj) => {
    if (obj.position) { obj.position.x += ox; obj.position.z += oz; }
    _staticCullables.push(obj);
    realAdd(obj);
  };
  addBoxCollider = (cx, cz, hw, hd) => realCollider(cx + ox, cz + oz, hw, hd);

  buildWestRoad();
  buildNorthRoad();
  buildSouthRoad();
  buildEastRoad();
  buildPark();
  buildCorners();
  buildCrosswalks();
  _buildCityscape();

  scene.add      = realAdd;
  addBoxCollider = realCollider;
}

// Connects every pair of adjacent quadrants (2x2 map) so there are no
// dead / disconnected seams between blocks.
function _buildQuadConnectors() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x455a64 });
  QUAD_CONNECTORS.forEach(c => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(c.w, c.h), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(c.cx, 0.015, c.cz);
    scene.add(m);
  });
}

// ── Central Hub Park ─────────────────────────────────────────────
// The single point where all 4 quadrants' nearest corners converge.
// Built once, in absolute world space (not tiled per-quadrant).
const HUB_CENTER = { x: -20, z: -80 };
const HUB_PLAZA_RADIUS  = 26;
const HUB_PARK_RADIUS   = 11;

function buildCentralHubPark() {
  const hx = HUB_CENTER.x, hz = HUB_CENTER.z;

  // Paved hub plaza — overlaps all 4 corner roundabouts so every quadrant
  // road connects through cleanly with no gaps.
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(HUB_PLAZA_RADIUS, 40),
    new THREE.MeshStandardMaterial({ color: 0x37474f }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(hx, 0.011, hz);
  scene.add(plaza);

  // Divider ring around the park island
  const ring = new THREE.Mesh(new THREE.RingGeometry(HUB_PARK_RADIUS + 0.2, HUB_PARK_RADIUS + 0.7, 40),
    new THREE.MeshStandardMaterial({ color: 0xe8eaed }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(hx, 0.018, hz);
  scene.add(ring);

  // Raised curb
  const curb = new THREE.Mesh(new THREE.CylinderGeometry(HUB_PARK_RADIUS, HUB_PARK_RADIUS, 0.22, 32),
    new THREE.MeshStandardMaterial({ color: 0xb0bec5 }));
  curb.position.set(hx, 0.11, hz);
  scene.add(curb);

  // Small park: grass island, cross paths, fountain, trees, benches
  const grassIsland = new THREE.Mesh(new THREE.CylinderGeometry(HUB_PARK_RADIUS - 0.4, HUB_PARK_RADIUS - 0.4, 0.08, 32),
    new THREE.MeshStandardMaterial({ color: 0x388e3c }));
  grassIsland.position.set(hx, 0.26, hz);
  scene.add(grassIsland);

  const pathMat = new THREE.MeshStandardMaterial({ color: 0x8d9ea8 });
  const pathA = new THREE.Mesh(new THREE.PlaneGeometry((HUB_PARK_RADIUS - 0.4) * 2, 2.4), pathMat);
  pathA.rotation.x = -Math.PI / 2; pathA.position.set(hx, 0.30, hz);
  scene.add(pathA);
  const pathB = new THREE.Mesh(new THREE.PlaneGeometry(2.4, (HUB_PARK_RADIUS - 0.4) * 2), pathMat);
  pathB.rotation.x = -Math.PI / 2; pathB.position.set(hx, 0.30, hz);
  scene.add(pathB);

  scene.add(makeFountain(hx, hz));

  [[-6, -6], [6, -6], [-6, 6], [6, 6]].forEach(([dx, dz]) => scene.add(makeTree(hx + dx, hz + dz)));
  scene.add(makeBench(hx - 3.5, hz + 2, Math.PI / 2));
  scene.add(makeBench(hx + 3.5, hz - 2, -Math.PI / 2));

  addSteppableCollider(hx, hz, HUB_PARK_RADIUS, HUB_PARK_RADIUS);
}

// ── World Border Wall ────────────────────────────────────────
const WORLD_MIN_X = -(BLOCK_W + 8);
const WORLD_MAX_X = LOOP_X + 8;
const WORLD_MIN_Z = -(BLOCK_H + LOOP_Z + 8);
const WORLD_MAX_Z = LOOP_Z + 8;
const BORDER_HEIGHT = 1.6;
const BORDER_THICK  = 1.0;

function _buildBorderSegment(cx, cz, w, d) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a2f36 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, BORDER_HEIGHT, d), mat);
  wall.position.set(cx, BORDER_HEIGHT / 2, cz);
  scene.add(wall);
  const capMat = new THREE.MeshStandardMaterial({ color: 0xf0a500, emissive: 0xf0a500, emissiveIntensity: 0.25 });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), capMat);
  cap.position.set(cx, BORDER_HEIGHT + 0.06, cz);
  scene.add(cap);
  addBoxCollider(cx, cz, w / 2, d / 2);
}

function buildWorldBorder() {
  const fullW = WORLD_MAX_X - WORLD_MIN_X;
  const fullD = WORLD_MAX_Z - WORLD_MIN_Z;
  const cx    = (WORLD_MIN_X + WORLD_MAX_X) / 2;
  const cz    = (WORLD_MIN_Z + WORLD_MAX_Z) / 2;
  _buildBorderSegment(cx, WORLD_MIN_Z - BORDER_THICK / 2, fullW + BORDER_THICK * 2, BORDER_THICK);
  _buildBorderSegment(cx, WORLD_MAX_Z + BORDER_THICK / 2, fullW + BORDER_THICK * 2, BORDER_THICK);
  _buildBorderSegment(WORLD_MIN_X - BORDER_THICK / 2, cz, BORDER_THICK, fullD + BORDER_THICK * 2);
  _buildBorderSegment(WORLD_MAX_X + BORDER_THICK / 2, cz, BORDER_THICK, fullD + BORDER_THICK * 2);
}

function buildEnvironment() {
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(520, 520),
    new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
  grass.rotation.x = -Math.PI/2;
  grass.position.set(-BLOCK_W / 2 + LOOP_X / 2, 0, -BLOCK_H / 2);
  scene.add(grass);

  QUAD_OFFSETS.forEach(q => _buildBlock(q.x, q.z));
  _buildQuadConnectors();
  buildCentralHubPark();
  buildWorldBorder();

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

    this.group.position.x = Math.min(WORLD_MAX_X - 1, Math.max(WORLD_MIN_X + 1, this.group.position.x));
    this.group.position.z = Math.min(WORLD_MAX_Z - 1, Math.max(WORLD_MIN_Z + 1, this.group.position.z));
    resolveCollisions(this.group.position, PLAYER_RADIUS, this._id, { grounded: this.grounded, onTop: this.baseY > 0.05 });

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
    this._stuckTimer = 0;
    this._lastCheckPos = { x: this.group.position.x, z: this.group.position.z };
    this._requestPath(this._task.x, this._task.z);
  }
  _newTask() {
    const spot = _randomFreeSpot(this.home.x - 4, this.home.x + 4, this.home.z - 4, this.home.z + 4);
    return spot || { x: this.home.x, z: this.home.z };
  }
  _checkStuck(dt) {
    this._stuckTimer += dt;
    if (this._stuckTimer < STUCK_CHECK_INTERVAL) return false;
    const p = this.group.position;
    const moved = Math.hypot(p.x - this._lastCheckPos.x, p.z - this._lastCheckPos.z);
    this._stuckTimer = 0;
    this._lastCheckPos = { x: p.x, z: p.z };
    return moved < STUCK_MIN_MOVE;
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

      if (this._repathTimer >= WORKER_REPATH_INTERVAL) {
        this._repathTimer = 0;
        this._requestPath(target.x, target.z);
      }

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
          if (this._checkStuck(dt)) this._requestPath(target.x, target.z);
        }
      } else {
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
          p.x += dx / dist * 2.2 * dt;
          p.z += dz / dist * 2.2 * dt;
          this.facePoint(target.x, target.z);
          this.state = 'walk';
          resolveStaticCollisions(p, ENTITY_RADIUS);
          resolveDynamicCollisions(p, ENTITY_RADIUS, this._id);
          if (this._checkStuck(dt)) this._requestPath(target.x, target.z);
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
    this.dead       = false;
    this.begCooldown = 0;
    this._id     = 'c' + (++_entityCounter);
    this._dynRef = { pos: this.group.position, radius: ENTITY_RADIUS, id: this._id };
    registerDynamic(this._dynRef);
    this._path = []; this._wpIdx = 0; this._repathTimer = 0;
    this._stuckTimer = 0;
    this._lastCheckPos = { x: spawnPos.x, z: spawnPos.z };
    this._requestPath(businessPos.x, businessPos.z);
  }
  _checkStuck(dt) {
    this._stuckTimer += dt;
    if (this._stuckTimer < STUCK_CHECK_INTERVAL) return false;
    const p = this.group.position;
    const moved = Math.hypot(p.x - this._lastCheckPos.x, p.z - this._lastCheckPos.z);
    this._stuckTimer = 0;
    this._lastCheckPos = { x: p.x, z: p.z };
    return moved < STUCK_MIN_MOVE;
  }
  _requestPath(tx, tz) {
    const p = this.group.position;
    const raw = _aStar(p.x, p.z, tx, tz);
    this._path  = _smoothPath(raw, p.x, p.z) || [];
    this._wpIdx = 0;
    this._repathTimer = 0;
  }
  update(dt) {
    if (_paused) return;
    const p = this.group.position;
    if (this.phase === 'arriving' || this.phase === 'leaving') {
      const target = this.phase === 'arriving' ? this.target : this.despawn;
      this._repathTimer += dt;
      if (this._repathTimer >= 4 && this._wpIdx >= this._path.length) this._requestPath(target.x, target.z);

      let goX = target.x, goZ = target.z, atFinal = true;
      if (this._path.length > 0 && this._wpIdx < this._path.length) {
        const wp = this._path[this._wpIdx];
        goX = wp.x; goZ = wp.z; atFinal = false;
      }
      const dx = goX - p.x, dz = goZ - p.z, dist = Math.hypot(dx, dz);
      if (!atFinal && dist < 0.4) {
        this._wpIdx++;
      } else if (atFinal && dist < 0.3) {
        if (this.phase === 'arriving') {
          this.phase = 'purchasing'; this.timer = 1; this.state = 'idle';
          if (typeof playPurchase === 'function') playPurchase();
        } else { this.dead = true; unregisterDynamic(this._dynRef); Footsteps.remove(this._id); }
      } else {
        p.x += dx / dist * 3 * dt; p.z += dz / dist * 3 * dt;
        this.facePoint(goX, goZ); this.state = 'walk';
        resolveStaticCollisions(p, ENTITY_RADIUS);
        resolveDynamicCollisions(p, ENTITY_RADIUS, this._id);
        if (this._checkStuck(dt)) this._requestPath(target.x, target.z);
      }
    } else {
      this.timer -= dt;
      if (this.timer <= 0) { this.phase = 'leaving'; this._requestPath(this.despawn.x, this.despawn.z); }
      this.state = 'idle';
    }
    Footsteps.tick(this._id, this.state, dt);
    this.updateBob(dt);
  }
}

// ── Pedestrian NPC ─────────────────────────────────────────────
class PedestrianNPC extends Avatar {
  constructor() {
    const spawn = _randomPedestrianSpawn() || { x: 9.5, z: 0 };
    // Vary pedestrian color slightly for visual diversity
    const colors = [0xb0bec5, 0x90a4ae, 0xbdbdbd, 0xa1887f, 0x80cbc4, 0xce93d8];
    super(colors[Math.floor(Math.random() * colors.length)], spawn);
    this.group.scale.setScalar(0.82 + Math.random() * 0.18);
    this._id         = 'ped' + (++_entityCounter);
    this.begCooldown = 0;
    this._goal       = _randomPedestrianGoal();
    this._path       = [];
    this._wpIdx      = 0;
    this._idleTimer  = 0;
    this._idle       = false;
    this._repathTimer = 0;
    this._speed      = PEDESTRIAN_SPEED * (0.8 + Math.random() * 0.4);
    this._requestPath();
    this._dynRef = { pos: this.group.position, radius: ENTITY_RADIUS * 0.7, id: this._id };
    registerDynamic(this._dynRef);
    this._stuckTimer = 0;
    this._lastCheckPos = { x: spawn.x, z: spawn.z };
  }

  _checkStuck(dt) {
    this._stuckTimer += dt;
    if (this._stuckTimer < STUCK_CHECK_INTERVAL) return false;
    const p = this.group.position;
    const moved = Math.hypot(p.x - this._lastCheckPos.x, p.z - this._lastCheckPos.z);
    this._stuckTimer = 0;
    this._lastCheckPos = { x: p.x, z: p.z };
    return moved < STUCK_MIN_MOVE;
  }

  _requestPath() {
    const p = this.group.position;
    const raw = _aStar(p.x, p.z, this._goal.x, this._goal.z);
    this._path  = _smoothPath(raw, p.x, p.z) || [];
    this._wpIdx = 0;
    this._repathTimer = 0;
  }

  update(dt) {
    if (_paused) return;

    if (this._idle) {
      this._idleTimer -= dt;
      this.state = 'idle';
      this.updateBob(dt);
      if (this._idleTimer <= 0) {
        this._idle = false;
        this._goal = _randomPedestrianGoal();
        this._requestPath();
      }
      return;
    }

    this._repathTimer += dt;
    if (this._repathTimer >= PEDESTRIAN_REPATH) {
      this._goal = _randomPedestrianGoal();
      this._requestPath();
    }

    const p = this.group.position;

    if (this._path.length > 0 && this._wpIdx < this._path.length) {
      const wp   = this._path[this._wpIdx];
      const dx   = wp.x - p.x, dz = wp.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.5) {
        this._wpIdx++;
      } else {
        p.x += dx / dist * this._speed * dt;
        p.z += dz / dist * this._speed * dt;
        this.facePoint(wp.x, wp.z);
        this.state = 'walk';
        resolveStaticCollisions(p, ENTITY_RADIUS * 0.7);
        resolveDynamicCollisions(p, ENTITY_RADIUS * 0.7, this._id);
        if (this._checkStuck(dt)) { this._goal = _randomPedestrianGoal(); this._requestPath(); }
      }
    } else {
      // Reached goal — idle briefly, then pick new goal
      const dx   = this._goal.x - p.x, dz = this._goal.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.2) {
        this._idle      = true;
        this._idleTimer = PEDESTRIAN_IDLE_TIME * (0.5 + Math.random());
        this.state = 'idle';
      } else {
        // Path failed or exhausted — direct nudge, then repath
        p.x += dx / dist * this._speed * dt;
        p.z += dz / dist * this._speed * dt;
        this.facePoint(this._goal.x, this._goal.z);
        this.state = 'walk';
        if (this._repathTimer > 1.0) {
          this._goal = _randomPedestrianGoal();
          this._requestPath();
        }
      }
    }

    this.updateBob(dt);
  }
}

// ── Pedestrian pool spawn ─────────────────────────────────────
function _spawnPedestrians() {
  // Stagger spawn: build _pfGrid must be called first
  const count = PEDESTRIAN_COUNT;
  for (let i = 0; i < count; i++) {
    // Small delay offset via staggered repath timers
    const ped = new PedestrianNPC();
    ped._repathTimer = Math.random() * PEDESTRIAN_REPATH;
    pedestrianNPCs.push(ped);
    scene.add(ped.group);
  }
}

// ── Beggar Targets ─────────────────────────────────────────────
function _buildBegTargets() {
  let placed = 0, attempts = 0;
  const maxAttempts = BEG_TARGET_COUNT * 30;
  while (placed < BEG_TARGET_COUNT && attempts < maxAttempts) {
    attempts++;
    const spot = _randomFreeSpot(-(BLOCK_W + 8), LOOP_X + 8, -(BLOCK_H + LOOP_Z + 8), LOOP_Z + 8);
    if (!spot) continue;

    if (Math.hypot(spot.x - PLAYER_SPAWN.x, spot.z - PLAYER_SPAWN.z) < 4) continue;

    let tooClose = false;
    for (const id in _begTargets) {
      const t = _begTargets[id];
      if (Math.hypot(t.pos.x - spot.x, t.pos.z - spot.z) < BEG_MIN_SPACING) { tooClose = true; break; }
    }
    if (tooClose) continue;

    const actionId = BEG_ACTION_TYPES[placed % BEG_ACTION_TYPES.length];
    const mesh = makeBegTarget(actionId, spot.x, spot.z);
    scene.add(mesh);
    const id = 'beg' + placed;
    _begTargets[id] = { mesh, pos: { x: spot.x, z: spot.z }, actionId, cooldown: 0 };
    placed++;
  }
}


function setBegTargetCooldown(targetId) {
  // Static targets (bottles, scrap)
  if (_begTargets[targetId]) {
    const t = _begTargets[targetId];
    t.cooldown = BEG_COOLDOWN;
    t.mesh.visible = false;
    _begGlobalCooldown = BEG_GLOBAL_COOLDOWN;
    return;
  }
  // Walking NPCs (pedestrians + customers)
  const ped = pedestrianNPCs.find(p => p._id === targetId);
  if (ped) { ped.begCooldown = BEG_COOLDOWN; _begGlobalCooldown = BEG_GLOBAL_COOLDOWN; return; }
  const cust = customerNPCs.find(c => c._id === targetId);
  if (cust) { cust.begCooldown = BEG_COOLDOWN; _begGlobalCooldown = BEG_GLOBAL_COOLDOWN; }
}

// ── Street Sweeper ─────────────────────────────────────────────
function startSweepArea(actionId) {
  clearSweepArea();
  const zone = SWEEP_ZONES[actionId];
  if (!zone) return;
  _sweepZone = zone;

  const job    = (typeof JOBS !== 'undefined') ? JOBS.street_sweeper : null;
  const action = job?.actions.find(a => a.id === actionId);
  const count  = action?.trashCount || 18;

  for (let i = 0; i < count; i++) {
    const spot = _pickFreeTrashSpot(zone.center, zone.radius);
    const mesh = makeTrashItem(spot.x, spot.z);
    scene.add(mesh);
    _trashItems.push({ mesh, x: spot.x, z: spot.z });
  }

  _sweepBinMesh = makeSweepBin(zone.bin.x, zone.bin.z);
  scene.add(_sweepBinMesh);
}

function clearSweepArea() {
  _trashItems.forEach(t => scene.remove(t.mesh));
  _trashItems = [];
  if (_sweepBinMesh) { scene.remove(_sweepBinMesh); _sweepBinMesh = null; }
  _depositAnims.forEach(a => scene.remove(a.mesh));
  _depositAnims = [];
  _carryStack.forEach(box => player.group.remove(box));
  _carryStack = [];
  _sweepZone = null;
}

function setCarryCount(count) {
  while (_carryStack.length < count) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x8d6e63 }));
    const idx = _carryStack.length;
    box.position.set(0, 1.05 + idx * 0.34, -0.42);
    player.group.add(box);
    _carryStack.push(box);
  }
  while (_carryStack.length > count) {
    const box = _carryStack.pop();
    player.group.remove(box);
    if (_sweepZone) _animateDeposit(box);
  }
}

function _animateDeposit(box) {
  const rot = player.group.rotation.y;
  const lp  = box.position;
  const wx  = player.group.position.x + lp.x * Math.cos(rot) + lp.z * Math.sin(rot);
  const wz  = player.group.position.z - lp.x * Math.sin(rot) + lp.z * Math.cos(rot);
  const wy  = player.group.position.y + lp.y;
  box.position.set(wx, wy, wz);
  scene.add(box);
  _depositAnims.push({
    mesh: box, t: 0, duration: 0.35,
    from: new THREE.Vector3(wx, wy, wz),
    to:   new THREE.Vector3(_sweepZone.bin.x, 0.6, _sweepZone.bin.z),
  });
}

function _updateDepositAnims(dt) {
  for (let i = _depositAnims.length - 1; i >= 0; i--) {
    const a = _depositAnims[i];
    a.t += dt / a.duration;
    if (a.t >= 1) { scene.remove(a.mesh); _depositAnims.splice(i, 1); continue; }
    a.mesh.position.lerpVectors(a.from, a.to, a.t);
    const s = 1 - a.t * 0.6;
    a.mesh.scale.setScalar(s);
  }
}

// ── Input setup ────────────────────────────────────────────────
function setupInput() {
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (KEY_MAP[k]) keys[KEY_MAP[k]] = true;
    if (k === 'shift') inputState.run = true;
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
    base.addEventListener('pointerdown',   e => { e.preventDefault(); dragging = true; onMove(e.clientX, e.clientY); base.setPointerCapture(e.pointerId); });
    base.addEventListener('pointermove',   e => { if (dragging) onMove(e.clientX, e.clientY); });
    base.addEventListener('pointerup',     onEnd);
    base.addEventListener('pointercancel', onEnd);
  }

  const runBtn = document.getElementById('run-btn');
  if (runBtn) {
    const setRun = v => { inputState.run = v; runBtn.classList.toggle('active', v); };
    runBtn.addEventListener('pointerdown',  e => { e.preventDefault(); setRun(true); });
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

  // Build raycaster mesh lists for beg targets and trash items
  function _getBegMeshList() {
    return Object.values(_begTargets)
      .filter(t => t.mesh.visible && t.cooldown <= 0)
      .map(t => ({ mesh: t.mesh, id: Object.keys(_begTargets).find(k => _begTargets[k] === t) }));
  }

  function _tryInteract(clientX, clientY) {
    if (_paused) return;
    const ndc = _getNDC(clientX, clientY);
    _mouse.set(ndc.x, ndc.y);
    _raycaster.setFromCamera(_mouse, camera);

    // ── 1. Business click ──
    const bizMeshes = Object.values(businessMeshes);
    const bizHits   = _raycaster.intersectObjects(bizMeshes, true);
    if (bizHits.length) {
      const bizId = _bizIdFromMesh(bizHits[0].object);
      if (bizId) {
        const pos  = BUSINESS_POS[bizId];
        const dist = Math.hypot(pos.x - player.group.position.x, pos.z - player.group.position.z);
        if (dist <= INTERACT_RADIUS) {
          if (typeof window.openBizPanel === 'function') window.openBizPanel(bizId);
        }
        return;
      }
    }

    // ── 2. Beg target click ──
    if (gStateRef?.activeJob === 'beggar' && _begGlobalCooldown <= 0) {
      const begMeshes = Object.values(_begTargets)
        .filter(t => t.mesh.visible && t.cooldown <= 0)
        .map(t => t.mesh);
      if (begMeshes.length) {
        const begHits = _raycaster.intersectObjects(begMeshes, true);
        if (begHits.length) {
          // Find which target was hit
          for (const id in _begTargets) {
            const t = _begTargets[id];
            if (!t.mesh.visible || t.cooldown > 0) continue;
            if (begHits[0].object === t.mesh || begHits[0].object.parent === t.mesh) {
              const d = Math.hypot(t.pos.x - player.group.position.x, t.pos.z - player.group.position.z);
              if (d <= BEG_INTERACT_RADIUS) {
                if (typeof window.interactWithBusiness === 'function') {
                  // Trigger beg interaction via existing handler
                  const payload = { type: 'beg', actionId: t.actionId, targetId: id };
                  if (onInteract) onInteract(payload);
                  if (typeof window.handleBegInteract === 'function') window.handleBegInteract(t.actionId, id);
                }
              }
              return;
            }
          }
        }
      }
    }

    // ── 3. Trash item click ──
    if (_trashItems.length && gStateRef && gStateRef.activeJob === 'street_sweeper') {
      if ((gStateRef.sweepCarry || 0) < (gStateRef.sweepCapacity || 5)) {
        const trashMeshes = _trashItems.map(t => t.mesh);
        const trashHits   = _raycaster.intersectObjects(trashMeshes, false);
        if (trashHits.length) {
          const hitMesh = trashHits[0].object;
          const idx = _trashItems.findIndex(t => t.mesh === hitMesh);
          if (idx !== -1) {
            const t = _trashItems[idx];
            const d = Math.hypot(t.x - player.group.position.x, t.z - player.group.position.z);
            if (d <= TRASH_COLLECT_RADIUS) {
              scene.remove(t.mesh);
              _trashItems.splice(idx, 1);
              if (typeof window.onTrashCollected === 'function') window.onTrashCollected();
            }
          }
          return;
        }
      }
    }
  }

  let _wasDrag = false, _downX = 0, _downY = 0, _touchHandled = false;
  canvasEl.addEventListener('pointerdown', e => { _wasDrag = false; _downX = e.clientX; _downY = e.clientY; });
  canvasEl.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - _downX, e.clientY - _downY) > 5) _wasDrag = true; });
  canvasEl.addEventListener('click', e => {
    // Skip: this tap was already handled by touchend just above (avoids
    // the browser's synthetic ~300ms ghost click firing the same action twice).
    if (_touchHandled) { _touchHandled = false; return; }
    if (!_wasDrag) _tryInteract(e.clientX, e.clientY);
  });
  canvasEl.addEventListener('touchend', e => {
    if (e.changedTouches.length === 1 && !_wasDrag) {
      _touchHandled = true;
      const t = e.changedTouches[0]; _tryInteract(t.clientX, t.clientY);
    }
  });

  // ── Hover cursor for businesses, beg targets, trash ──
  canvasEl.addEventListener('mousemove', e => {
    const ndc = _getNDC(e.clientX, e.clientY);
    _mouse.set(ndc.x, ndc.y);
    _raycaster.setFromCamera(_mouse, camera);

    // Business hover
    const bizHits = _raycaster.intersectObjects(Object.values(businessMeshes), true);
    if (bizHits.length) {
      const bizId = _bizIdFromMesh(bizHits[0].object);
      if (bizId) {
        const pos  = BUSINESS_POS[bizId];
        const dist = Math.hypot(pos.x - player.group.position.x, pos.z - player.group.position.z);
        canvasEl.style.cursor = dist <= INTERACT_RADIUS ? 'pointer' : 'not-allowed';
        return;
      }
    }

    // Beg target hover
    if (gStateRef?.activeJob === 'beggar' && _begGlobalCooldown <= 0) {
      const activeBegMeshes = Object.values(_begTargets)
        .filter(t => t.mesh.visible && t.cooldown <= 0)
        .map(t => t.mesh);
      if (activeBegMeshes.length) {
        const begHits = _raycaster.intersectObjects(activeBegMeshes, true);
        if (begHits.length) {
          for (const id in _begTargets) {
            const t = _begTargets[id];
            if (!t.mesh.visible || t.cooldown > 0) continue;
            if (begHits[0].object === t.mesh || begHits[0].object.parent === t.mesh) {
              const d = Math.hypot(t.pos.x - player.group.position.x, t.pos.z - player.group.position.z);
              canvasEl.style.cursor = d <= BEG_INTERACT_RADIUS ? 'pointer' : 'not-allowed';
              return;
            }
          }
        }
      }
    }

    // Trash hover
    if (_trashItems.length && gStateRef?.activeJob === 'street_sweeper') {
      const trashHits = _raycaster.intersectObjects(_trashItems.map(t => t.mesh), false);
      if (trashHits.length) {
        const hitMesh = trashHits[0].object;
        const t = _trashItems.find(ti => ti.mesh === hitMesh);
        if (t) {
          const d = Math.hypot(t.x - player.group.position.x, t.z - player.group.position.z);
          canvasEl.style.cursor = d <= TRASH_COLLECT_RADIUS ? 'pointer' : 'not-allowed';
          return;
        }
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

// ── Pedestrian batch update — throttled to every 2nd frame ────
let _pedFrameSkip = 0;

// ── Building Occlusion (fade, not hide, when blocking the view) ─
function _updateBuildingOcclusion() {
  if (!player || !camera) return;
  const px = player.group.position.x, pz = player.group.position.z, py = player.group.position.y + 1;
  const dx = camera.position.x - px, dz = camera.position.z - pz, dy = camera.position.y - py;
  const lenXZSq = dx * dx + dz * dz;
  if (lenXZSq < 0.0001) return;

  for (const b of _buildingOccluders) {
    if (!b.mesh.visible) continue;
    const bx = b.mesh.position.x - px, bz = b.mesh.position.z - pz;
    const t  = (bx * dx + bz * dz) / lenXZSq;

    let occluding = false;
    if (t > 0.04 && t < 0.97) {
      const perpX = bx - dx * t, perpZ = bz - dz * t;
      const perpDist = Math.hypot(perpX, perpZ);
      if (perpDist < b.radius + 1.4) {
        const sightY = py + dy * t;
        if (sightY >= b.baseY - 0.5 && sightY <= b.baseY + b.height + 0.5) occluding = true;
      }
    }

    const target = occluding ? 0.16 : 1;
    b.mesh.userData._opacity = THREE.MathUtils.lerp(b.mesh.userData._opacity, target, 0.18);
    const op = b.mesh.userData._opacity;
    for (const m of b.materials) {
      m.opacity      = op;
      m.transparent  = op < 0.995;
      m.depthWrite   = op > 0.5;
    }
  }
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

  _updateStaticCulling();
  _updateEntityCulling();
  _updateBuildingOcclusion();

  if (!_paused) {
    Object.values(workerNPCs).forEach(list => list.forEach(w => w.update(dt)));
    Object.values(vehicleNPCs).forEach(list => list.forEach(v => v.update(dt)));

    customerNPCs.forEach(c => c.update(dt));
    customerNPCs = customerNPCs.filter(c => {
      if (c.dead) { scene.remove(c.group); return false; } return true;
    });

    // Pedestrians: update every other frame for performance
    _pedFrameSkip = (_pedFrameSkip + 1) % 2;
    if (_pedFrameSkip === 0) {
      const pedDt = dt * 2;
      pedestrianNPCs.forEach(p => p.update(pedDt));
    }

    if (gStateRef) {
      Object.keys(customerSpawnTimers).forEach(bizId => {
        if (!gStateRef.ownedBusinesses.includes(bizId)) return;
        const bizDef = typeof BUSINESSES !== 'undefined' ? BUSINESSES[bizId] : null;
        const isTrafficBiz = bizDef?.category === 'retail' || bizDef?.category === 'franchise';
        if (!isTrafficBiz) return;
        customerSpawnTimers[bizId] -= dt;
        if (customerSpawnTimers[bizId] <= 0) {
          // v6: reputation raises the concurrent customer-traffic cap for franchises
          const repBonus = bizDef?.category === 'franchise'
            ? Math.min(Math.floor((gStateRef.reputation || 0) / 100), REPUTATION_TRAFFIC_CAP)
            : 0;
          const maxConcurrent = 2 + repBonus;
          if (customerNPCs.filter(c => c.bizId === bizId).length < maxConcurrent) {
            const pos = BUSINESS_POS[bizId];
            const c = new CustomerNPC({ x: pos.x, z: CUSTOMER_SPAWN.z }, pos, { x: pos.x, z: CUSTOMER_END.z }, bizId);
            customerNPCs.push(c); scene.add(c.group);
          }
          customerSpawnTimers[bizId] = Math.max(1.5, (4 + Math.random() * 5) - repBonus);
        }
      });
    }

    // ── Beggar target cooldowns ──
    if (_begGlobalCooldown > 0) _begGlobalCooldown -= dt;
    for (const id in _begTargets) {
      const t = _begTargets[id];
      if (t.cooldown > 0) {
        t.cooldown -= dt;
        if (t.cooldown <= 0) { t.cooldown = 0; t.mesh.visible = true; }
      }
    }
    pedestrianNPCs.forEach(p => { if (p.begCooldown > 0) p.begCooldown -= dt; });
    customerNPCs.forEach(c => { if (c.begCooldown > 0) c.begCooldown -= dt; });

    // ── Trash collection (proximity auto) ──
    if (_trashItems.length && gStateRef) {
      for (let i = _trashItems.length - 1; i >= 0; i--) {
        if ((gStateRef.sweepCarry || 0) >= (gStateRef.sweepCapacity || 5)) break;
        const t = _trashItems[i];
        const d = Math.hypot(t.x - player.group.position.x, t.z - player.group.position.z);
        if (d <= TRASH_COLLECT_RADIUS) {
          scene.remove(t.mesh);
          _trashItems.splice(i, 1);
          if (typeof window.onTrashCollected === 'function') window.onTrashCollected();
        }
      }
    }

    _updateDepositAnims(dt);

    // ── Interactable detection (beg targets > sweep bin > businesses) ──
    let interactPayload = null;
    let interactKey     = null;

    if (gStateRef?.activeJob === 'beggar' && _begGlobalCooldown <= 0) {
      const px = player.group.position.x, pz = player.group.position.z;
      // Walking NPCs (pedestrians + customers) — ask_change
      outer: for (const pool of [pedestrianNPCs, customerNPCs]) {
        for (const npc of pool) {
          if (npc.begCooldown > 0) continue;
          const d = Math.hypot(npc.group.position.x - px, npc.group.position.z - pz);
          if (d <= BEG_INTERACT_RADIUS) {
            interactPayload = { type: 'beg', actionId: 'ask_change', targetId: npc._id };
            interactKey = 'beg:' + npc._id;
            break outer;
          }
        }
      }
      // Static targets (bottles, scrap)
      if (!interactPayload) {
        for (const id in _begTargets) {
          const t = _begTargets[id];
          if (t.cooldown > 0) continue;
          const d = Math.hypot(t.pos.x - px, t.pos.z - pz);
          if (d <= BEG_INTERACT_RADIUS) {
            interactPayload = { type: 'beg', actionId: t.actionId, targetId: id };
            interactKey = 'beg:' + id;
            break;
          }
        }
      }
    }

    if (!interactPayload && _sweepZone && (gStateRef?.sweepCarry || 0) > 0) {
      const bin = _sweepZone.bin;
      const d = Math.hypot(bin.x - player.group.position.x, bin.z - player.group.position.z);
      if (d <= SWEEP_BIN_RADIUS) {
        interactPayload = { type: 'sweep_bin' };
        interactKey = 'sweep_bin';
      }
    }

    if (!interactPayload) {
      let nearest = null, nearestDist = 6;
      Object.keys(BUSINESS_POS).forEach(bizId => {
        const pos = BUSINESS_POS[bizId];
        const d   = Math.hypot(pos.x - player.group.position.x, pos.z - player.group.position.z);
        if (d < nearestDist) { nearestDist = d; nearest = bizId; }
      });
      if (nearest) { interactPayload = { type: 'business', bizId: nearest }; interactKey = 'biz:' + nearest; }
    }

    if (interactKey !== lastInteract) {
      lastInteract = interactKey;
      if (onInteract) onInteract(interactPayload);
    }
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
  scene.fog        = new THREE.Fog(0x0d0f11, 70, 220);

  camera   = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 420);
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
  _buildBegTargets();
  _spawnPedestrians();

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

window.WorldAPI = {
  init, updateWorld, setInteractCallback, setPaused, isPaused: () => _paused,
  setBegTargetCooldown, startSweepArea, clearSweepArea, setCarryCount,
};