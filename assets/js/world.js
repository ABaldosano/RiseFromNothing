// ============================
// RISE FROM NOTHING — WORLD v4.5
// CAMERA REFACTOR: Fixed Isometric
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

// ── Isometric Camera Constants ─────────────────────────────────
const ISO_YAW    = Math.PI / 4;   // 45° azimuth — fixed, never changes
const ISO_PITCH  = 0.6154;         // ~35.26° elevation — true isometric
const ZOOM_MIN   = 10;
const ZOOM_MAX   = 40;
let   cameraZoom = 20;             // current distance, adjustable

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
  const trunk  = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x6b4423 }));
  trunk.position.y = 0.8;
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
  canopy.position.y = 2.1;
  g.add(trunk, canopy);
  g.position.set(x, 0, z);
  return g;
}

function makeStreetLight(x, z) {
  const g    = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), new THREE.MeshStandardMaterial({ color: 0x444444 }));
  pole.position.y = 1.5;
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xfff3b0, emissiveIntensity: 0.6 }));
  lamp.position.y = 3.1;
  g.add(pole, lamp);
  g.position.set(x, 0, z);
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

// ── Vehicle meshes ─────────────────────────────────────────────
function makeVehicleMesh(vehicleType, color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color });

  switch (vehicleType) {
    case 'bicycle': {
      const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), mat);
      frame.rotation.z = Math.PI / 4;
      frame.position.set(0, 0.5, 0);
      const wheelGeo = new THREE.TorusGeometry(0.28, 0.06, 6, 12);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
      const wf = new THREE.Mesh(wheelGeo, wheelMat); wf.position.set(0.4, 0.28, 0); wf.rotation.y = Math.PI / 2;
      const wb = new THREE.Mesh(wheelGeo, wheelMat); wb.position.set(-0.4, 0.28, 0); wb.rotation.y = Math.PI / 2;
      const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.4, 4, 6), new THREE.MeshStandardMaterial({ color: COLOR_WORKER }));
      rider.position.set(0, 1.05, 0);
      g.add(frame, wf, wb, rider);
      break;
    }
    case 'motorcycle': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.5), mat);
      body.position.y = 0.5;
      const wheelGeo = new THREE.TorusGeometry(0.32, 0.08, 6, 14);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
      const wf = new THREE.Mesh(wheelGeo, wheelMat); wf.position.set(0.55, 0.32, 0); wf.rotation.y = Math.PI / 2;
      const wb = new THREE.Mesh(wheelGeo, wheelMat); wb.position.set(-0.55, 0.32, 0); wb.rotation.y = Math.PI / 2;
      const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 6), new THREE.MeshStandardMaterial({ color: COLOR_WORKER }));
      rider.position.set(0, 1.15, 0);
      g.add(body, wf, wb, rider);
      break;
    }
    case 'van': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.2), mat);
      body.position.y = 0.9;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 1.1), new THREE.MeshStandardMaterial({ color: 0x455a64 }));
      cab.position.set(0.9, 1.7, 0);
      const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
      [[ 0.85,  0.55], [ 0.85, -0.55], [-0.85,  0.55], [-0.85, -0.55]].forEach(([wx, wz]) => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(wx, 0.3, wz); w.rotation.z = Math.PI / 2;
        g.add(w);
      });
      g.add(body, cab);
      break;
    }
    case 'truck': {
      const trailer = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.8, 1.6), mat);
      trailer.position.set(-1, 1.1, 0);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 1.5), new THREE.MeshStandardMaterial({ color: 0x263238 }));
      cab.position.set(1.8, 1.0, 0);
      const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.25, 10);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      [[ 1.6,  0.7], [ 1.6, -0.7], [-0.5,  0.7], [-0.5, -0.7], [-1.8,  0.7], [-1.8, -0.7]].forEach(([wx, wz]) => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(wx, 0.38, wz); w.rotation.z = Math.PI / 2;
        g.add(w);
      });
      g.add(trailer, cab);
      break;
    }
    default: {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.6), mat);
      box.position.y = 0.4;
      g.add(box);
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
    const platform = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 5), new THREE.MeshStandardMaterial({ color: 0x37474f }));
    platform.position.y = 0.1;
    const building = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.5, 4), new THREE.MeshStandardMaterial({ color, transparent: true }));
    building.position.set(-1.5, 1.35, 0);
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.1), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    lane.rotation.x = -Math.PI / 2; lane.position.set(1, 0.21, 0);
    g.add(platform, building, lane);
    mesh = building;
  } else {
    switch (bizId) {
      case 'food_cart':
        mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.2), new THREE.MeshStandardMaterial({ color, transparent: true }));
        mesh.position.y = 0.6; break;
      case 'small_store':
        mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshStandardMaterial({ color, transparent: true }));
        mesh.position.y = 1.5; break;
      case 'convenience_store':
        mesh = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, 5), new THREE.MeshStandardMaterial({ color, transparent: true }));
        mesh.position.y = 1.75; break;
      default:
        mesh = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), new THREE.MeshStandardMaterial({ color, transparent: true }));
        mesh.position.y = 2;
    }
    g.add(mesh);
    const crateW = mesh.geometry.parameters.width;
    const crate  = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0x8d6e63 }));
    crate.position.set(crateW / 2 + 0.6, 0.3, 0);
    g.add(crate);
  }

  g.position.set(x, 0, z);
  g.userData.mainMesh = mesh;
  g.userData.bizId    = bizId;
  return g;
}

// ── Environment ────────────────────────────────────────────────
function buildEnvironment() {
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
  grass.rotation.x = -Math.PI / 2;
  scene.add(grass);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(12, 130), new THREE.MeshStandardMaterial({ color: 0x37474f }));
  road.rotation.x = -Math.PI / 2; road.position.y = 0.01;
  scene.add(road);

  [-9.5, 9.5].forEach(x => {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(5, 130), new THREE.MeshStandardMaterial({ color: 0xb0bec5 }));
    sw.rotation.x = -Math.PI / 2; sw.position.set(x, 0.02, 0);
    scene.add(sw);
  });

  const leftLane = new THREE.Mesh(new THREE.PlaneGeometry(8, 130), new THREE.MeshStandardMaterial({ color: 0x455a64 }));
  leftLane.rotation.x = -Math.PI / 2; leftLane.position.set(-17, 0.015, 0);
  scene.add(leftLane);

  for (let z = -55; z <= 55; z += 15) {
    scene.add(makeTree(-24, z));
    scene.add(makeTree(20, z + 7));
    scene.add(makeStreetLight(-9.5, z + 4));
    scene.add(makeStreetLight(9.5,  z - 4));
  }
  scene.add(makeBench(-9.5, 30, Math.PI / 2));
  scene.add(makeBench(9.5, -50, -Math.PI / 2));
  scene.add(makeTrashBin(11.5, -28));
  scene.add(makeTrashBin(-11.5, 20));
  scene.add(makeDumpster(12, 30));

  const cp = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xf0a500 }));
  cp.position.set(COLLECTION_POINT.x, 0.05, COLLECTION_POINT.z);
  scene.add(cp);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(20, 30, 10);
  scene.add(sun);
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
    this._mixer    = null;
    this._clips    = null;
  }

  get state() { return this._state; }

  setState(newState, onDone) {
    if (this._state === newState) return;
    this._state  = newState;
    this._timer  = WORKER_STATE_DURATIONS[newState] || 0;
    this._onDone = onDone || null;
    this._applyVisuals(newState);
    this._applyGLB(newState);
  }

  setGLBMixer(mixer, clips) {
    this._mixer = mixer;
    this._clips = clips;
    this._applyGLB(this._state);
  }

  update(dt) {
    if (this._mixer) this._mixer.update(dt);
    if (this._timer <= 0) return;
    this._timer -= dt;

    if (this._state === WorkerAnimStates.DROPOFF) {
      const total    = WORKER_STATE_DURATIONS[WorkerAnimStates.DROPOFF];
      const progress = 1 - Math.max(0, this._timer / total);
      this._carryBox.position.y  = 1.7 - progress * 1.4;
      this._carryBox.rotation.z  = progress * Math.PI;
    }

    if (this._timer <= 0) {
      if (this._state === WorkerAnimStates.DROPOFF) {
        this._carryBox.visible    = false;
        this._carryBox.position.y = 1.7;
        this._carryBox.rotation.z = 0;
      }
      const cb = this._onDone;
      this._onDone = null;
      if (cb) cb();
    }
  }

  _buildCarryBox() {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x8d6e63 })
    );
    box.position.set(0.4, 1.7, 0);
    box.visible = false;
    this._group.add(box);
    return box;
  }

  _applyVisuals(state) {
    const color = WORKER_STATE_COLORS[state] || COLOR_WORKER;
    if (this._body?.material) this._body.material.color.setHex(color);
    if (this._head?.material) this._head.material.color.setHex(color);
    if (state === WorkerAnimStates.PICKUP) {
      this._body.scale.set(1, 0.6, 1);
      this._body.position.y = 0.5;
    } else {
      this._body.scale.set(1, 1, 1);
      this._body.position.y = 0.8;
    }
    this._carryBox.visible =
      state === WorkerAnimStates.CARRY ||
      state === WorkerAnimStates.DROPOFF;
  }

  _applyGLB(state) {
    if (!this._mixer || !this._clips) return;
    this._mixer.stopAllAction();
    const clip = this._clips[state];
    if (clip) this._mixer.clipAction(clip).play();
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
    this.bobT += dt * speed;
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
  }
  jump() { if (this.grounded) { this.vy = 5; this.grounded = false; } }
  update(dt) {
    // Isometric movement: input mapped relative to fixed ISO_YAW
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
    this.group.position.x = Math.min(60, Math.max(-60, this.group.position.x));
    this.group.position.z = Math.min(62, Math.max(-62, this.group.position.z));

    if (!this.grounded || this.vy !== 0) {
      this.vy    -= 14 * dt;
      this.baseY += this.vy * dt;
      if (this.baseY <= 0) { this.baseY = 0; this.vy = 0; this.grounded = true; }
    }

    Footsteps.tick(this._id, this.state, dt);
    this.updateBob(dt);
  }
}

// ── Worker NPC ─────────────────────────────────────────────────
class WorkerNPC extends Avatar {
  constructor(homePos) {
    const jitter = () => (Math.random() * 2 - 1);
    super(COLOR_WORKER, { x: homePos.x + jitter(), z: homePos.z + jitter() });
    this.home  = homePos;
    this._id   = ++_entityCounter;
    this._anim = new AnimationController(this.group);
    this._task  = this._newTask();
    this._phase = 'to_task';
    this._anim.setState(WorkerAnimStates.WALK);
  }

  _newTask() {
    return {
      x: this.home.x + (Math.random() * 6 - 3),
      z: this.home.z + (Math.random() * 6 - 3),
    };
  }

  update(dt) {
    this._anim.update(dt);
    const p = this.group.position;

    if (this._phase === 'to_task') {
      const dx = this._task.x - p.x, dz = this._task.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.25) {
        this._phase = 'at_task';
        this.state  = 'idle';
        this._anim.setState(WorkerAnimStates.PICKUP, () => {
          this._phase = 'returning';
          this._anim.setState(WorkerAnimStates.CARRY);
          if (typeof playTaskComplete === 'function') playTaskComplete();
        });
      } else {
        const speed = 2.2;
        p.x += dx / dist * speed * dt;
        p.z += dz / dist * speed * dt;
        this.facePoint(this._task.x, this._task.z);
        this.state = 'walk';
        this._anim.setState(WorkerAnimStates.WALK);
      }

    } else if (this._phase === 'returning') {
      const dx = this.home.x - p.x, dz = this.home.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.25) {
        this._phase = 'at_home';
        this.state  = 'idle';
        this._anim.setState(WorkerAnimStates.DROPOFF, () => {
          this._phase = 'to_task';
          this._task  = this._newTask();
          this._anim.setState(WorkerAnimStates.WALK);
        });
      } else {
        const speed = 2.2;
        p.x += dx / dist * speed * dt;
        p.z += dz / dist * speed * dt;
        this.facePoint(this.home.x, this.home.z);
        this.state = 'walk';
      }

    } else {
      this.state = 'idle';
    }

    Footsteps.tick('w' + this._id, this.state, dt);
    this.updateBob(dt);
  }

  dispose() { Footsteps.remove('w' + this._id); }
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
    this._timer   = 0;
    this._speed   = vehicleType === 'bicycle'    ? 4
                  : vehicleType === 'motorcycle' ? 7
                  : vehicleType === 'van'        ? 5
                  : 4;
    this._speed  *= 1 + (fleetLvl - 1) * 0.2;

    const colors = VEHICLE_COLORS[vehicleType] || [0x888888, 0x666666, 0x444444];
    const color  = colors[Math.min(fleetLvl - 1, 2)];
    this.group   = makeVehicleMesh(vehicleType, color);
    this.group.position.set(depot.x, 0, depot.z);
    this.group.rotation.y = Math.PI / 2;
    this._timer  = 1.5;
  }

  update(dt) {
    const p = this.group.position;
    if (this._phase === 'loading') {
      this._timer -= dt;
      if (this._timer <= 0) { this._phase = 'driving'; this._wpIndex = 0; }
    } else if (this._phase === 'driving') {
      const wp   = this._route[this._wpIndex];
      const dx   = wp.x - p.x, dz = wp.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.4) {
        this._wpIndex++;
        if (this._wpIndex >= this._route.length) { this._phase = 'unloading'; this._timer = 1.2; }
      } else {
        p.x += dx / dist * this._speed * dt;
        p.z += dz / dist * this._speed * dt;
        if (dist > 0.1) this.group.rotation.y = Math.atan2(dx, dz);
      }
    } else if (this._phase === 'unloading') {
      this._timer -= dt;
      if (this._timer <= 0) this._phase = 'returning';
    } else if (this._phase === 'returning') {
      const dx   = this._depot.x - p.x, dz = this._depot.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.5) { this._phase = 'loading'; this._timer = 1.5; }
      else {
        p.x += dx / dist * this._speed * dt;
        p.z += dz / dist * this._speed * dt;
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
    this._id     = ++_entityCounter;
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
          Footsteps.remove('c' + this._id);
        }
      } else {
        const speed = 3;
        p.x += dx / dist * speed * dt;
        p.z += dz / dist * speed * dt;
        this.facePoint(target.x, target.z);
        this.state = 'walk';
      }
    } else {
      this.timer -= dt;
      if (this.timer <= 0) this.phase = 'leaving';
      this.state = 'idle';
    }
    Footsteps.tick('c' + this._id, this.state, dt);
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
    if (k === ' ') { e.preventDefault(); if (player) player.jump(); }
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (KEY_MAP[k]) keys[KEY_MAP[k]] = false;
    if (k === 'shift') inputState.run = false;
  });

  // ── Joystick ──
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
      joyVec.x = dx / radius;
      joyVec.z = dy / radius;
    };
    const onEnd = () => {
      dragging = false;
      knob.style.transform = 'translate(-50%, -50%)';
      joyVec.x = 0; joyVec.z = 0;
    };
    base.addEventListener('pointerdown',  e => { dragging = true; onMove(e.clientX, e.clientY); base.setPointerCapture(e.pointerId); });
    base.addEventListener('pointermove',  e => { if (dragging) onMove(e.clientX, e.clientY); });
    base.addEventListener('pointerup',    onEnd);
    base.addEventListener('pointercancel',onEnd);
  }

  // ── Run button ──
  const runBtn = document.getElementById('run-btn');
  if (runBtn) {
    const setRun = v => { inputState.run = v; runBtn.classList.toggle('active', v); };
    runBtn.addEventListener('pointerdown',  () => setRun(true));
    runBtn.addEventListener('pointerup',    () => setRun(false));
    runBtn.addEventListener('pointercancel',() => setRun(false));
    runBtn.addEventListener('pointerleave', () => setRun(false));
  }

  // ── Jump button ──
  const jumpBtn = document.getElementById('jump-btn');
  if (jumpBtn) {
    jumpBtn.addEventListener('pointerdown', e => { e.preventDefault(); if (player) player.jump(); });
  }

  // ── Zoom: scroll wheel ──
  canvasEl.addEventListener('wheel', e => {
    e.preventDefault();
    cameraZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cameraZoom + e.deltaY * 0.04));
  }, { passive: false });

  // ── Zoom: pinch ──
  let _pinchDist = null;
  canvasEl.style.touchAction = 'none';
  canvasEl.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      _pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });
  canvasEl.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && _pinchDist !== null) {
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = (_pinchDist - newDist) * 0.08;
      cameraZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cameraZoom + delta));
      _pinchDist = newDist;
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

  player.update(dt);

  // Fixed isometric camera — follows player, no rotation
  const cx = player.group.position.x + cameraZoom * Math.sin(ISO_YAW)   * Math.cos(ISO_PITCH);
  const cz = player.group.position.z + cameraZoom * Math.cos(ISO_YAW)   * Math.cos(ISO_PITCH);
  const cy = player.group.position.y + cameraZoom * Math.sin(ISO_PITCH) + 1;
  camera.position.set(cx, cy, cz);
  camera.lookAt(player.group.position.x, player.group.position.y + 1, player.group.position.z);

  Object.values(workerNPCs).forEach(list => list.forEach(w => w.update(dt)));
  Object.values(vehicleNPCs).forEach(list => list.forEach(v => v.update(dt)));

  customerNPCs.forEach(c => c.update(dt));
  customerNPCs = customerNPCs.filter(c => {
    if (c.dead) { scene.remove(c.group); return false; }
    return true;
  });

  if (gStateRef) {
    Object.keys(customerSpawnTimers).forEach(bizId => {
      if (!gStateRef.ownedBusinesses.includes(bizId)) return;
      if (typeof BUSINESSES !== 'undefined' && BUSINESSES[bizId]?.category !== 'retail') return;
      customerSpawnTimers[bizId] -= dt;
      if (customerSpawnTimers[bizId] <= 0) {
        const inLane = customerNPCs.filter(c => c.bizId === bizId).length;
        if (inLane < 2) {
          const pos = BUSINESS_POS[bizId];
          const c   = new CustomerNPC(
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

  // Interact proximity
  let nearest = null, nearestDist = 6;
  Object.keys(BUSINESS_POS).forEach(bizId => {
    const pos = BUSINESS_POS[bizId];
    const d   = Math.hypot(pos.x - player.group.position.x, pos.z - player.group.position.z);
    if (d < nearestDist) { nearestDist = d; nearest = bizId; }
  });
  if (nearest !== lastInteract) {
    lastInteract = nearest;
    if (onInteract) onInteract(nearest);
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
  scene.fog        = new THREE.Fog(0x0d0f11, 40, 100);

  camera   = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  buildEnvironment();

  bizOrder.forEach(bizId => {
    const pos = BUSINESS_POS[bizId];
    if (!pos) return;
    businessMeshes[bizId]          = makeBusinessMesh(bizId, pos.x, pos.z);
    scene.add(businessMeshes[bizId]);
    workerNPCs[bizId]              = [];
    vehicleNPCs[bizId]             = [];
    customerSpawnTimers[bizId]     = 3 + Math.random() * 5;
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
    const grp   = businessMeshes[bizId];
    const owned = gState.ownedBusinesses.includes(bizId);
    const mesh  = grp.userData.mainMesh;
    if (mesh?.material) {
      mesh.material.color.setHex(owned ? BIZ_COLORS[bizId] : 0x555555);
      mesh.material.opacity = owned ? 1 : 0.3;
    }

    const wList   = workerNPCs[bizId];
    const desired = Math.min(gState.workers[bizId] || 0, 3);
    while (wList.length < desired) {
      const w = new WorkerNPC(BUSINESS_POS[bizId]);
      wList.push(w);
      scene.add(w.group);
    }
    while (wList.length > desired) {
      const w = wList.pop();
      w.dispose();
      scene.remove(w.group);
    }

    const biz = typeof BUSINESSES !== 'undefined' ? BUSINESSES[bizId] : null;
    if (biz?.category === 'transport' && owned) {
      const vList   = vehicleNPCs[bizId];
      const drivers = Math.min(gState.workers[bizId] || 0, 3);
      const fLevel  = gState.fleetLevel?.[bizId] || 1;
      const route   = (typeof DELIVERY_ROUTES !== 'undefined') ? DELIVERY_ROUTES[bizId] : null;
      const depot   = BUSINESS_POS[bizId];
      while (vList.length < drivers && route) {
        const offset   = vList.length * 2;
        const spawnPos = { x: depot.x, z: depot.z + offset };
        const v = new VehicleNPC(bizId, biz.vehicleType, fLevel, spawnPos, route);
        vList.push(v);
        scene.add(v.group);
      }
      while (vList.length > drivers) {
        const v = vList.pop();
        v.dispose();
        scene.remove(v.group);
      }
    } else if (!owned && vehicleNPCs[bizId]?.length) {
      vehicleNPCs[bizId].forEach(v => { v.dispose(); scene.remove(v.group); });
      vehicleNPCs[bizId] = [];
    }
  });
}

function setInteractCallback(cb) { onInteract = cb; }

window.WorldAPI = { init, updateWorld, setInteractCallback };