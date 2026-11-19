import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc8d2);
scene.fog = new THREE.Fog(0x9cc8d2, 45, 105);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 180);
camera.position.set(0, 1.65, 10);

const clock = new THREE.Clock();
const keys = {};
let yaw = 0;
let pitch = 0;
let playing = false;
let reloading = false;
let shootCooldown = 0;
let lastShot = 0;
let health = 100;
let kills = 0;
let wave = 1;
let ammo = 24;
let reserve = 144;
let muzzleVisible = 0;

const ui = {
  health: document.getElementById("health"),
  healthBar: document.getElementById("healthBar"),
  ammo: document.getElementById("ammo"),
  reserve: document.getElementById("reserve"),
  kills: document.getElementById("kills"),
  wave: document.getElementById("wave"),
  menu: document.getElementById("menu"),
  gameOver: document.getElementById("gameOver"),
  damage: document.getElementById("damageFlash"),
  hit: document.getElementById("hitMarker")
};

scene.add(new THREE.HemisphereLight(0xe4f6ff, 0x86785a, 2));
const sun = new THREE.DirectionalLight(0xffedcc, 2.5);
sun.position.set(-18, 30, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(70, 70),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const textureLoader = new THREE.TextureLoader();
textureLoader.load("assets/map.jpg", (mapTexture) => {
  mapTexture.colorSpace = THREE.SRGBColorSpace;
  mapTexture.wrapS = THREE.RepeatWrapping;
  mapTexture.wrapT = THREE.RepeatWrapping;
  mapTexture.repeat.set(3.5, 3.5);
  mapTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  floor.material.map = mapTexture;
  floor.material.color.set(0xffffff);
  floor.material.needsUpdate = true;
});

const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x788589, roughness: .8, metalness: .12 });
const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x34454a, roughness: .65, metalness: .35 });
const crateMaterial = new THREE.MeshStandardMaterial({ color: 0x987449, roughness: .86 });
const cyanMaterial = new THREE.MeshBasicMaterial({ color: 0x42daf1 });
const redMaterial = new THREE.MeshBasicMaterial({ color: 0xff3b50 });

function box(w, h, d, x, y, z, material = wallMaterial) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  obstacles.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  return mesh;
}

const obstacles = [];
box(70, 2.6, 1.2, 0, 1.3, -34, wallMaterial);
box(70, 2.6, 1.2, 0, 1.3, 34, wallMaterial);
box(1.2, 2.6, 70, -34, 1.3, 0, wallMaterial);
box(1.2, 2.6, 70, 34, 1.3, 0, wallMaterial);

// Low cover and supply crates keep the coastal yard open and navigable.
box(7, 2.4, 3, -15, 1.2, -12, darkMaterial);
box(7, 2.4, 3, 15, 1.2, 12, darkMaterial);
box(4, 1.25, 1, -8, .625, 3, wallMaterial);
box(4, 1.25, 1, 8, .625, -3, wallMaterial);
box(2.2, 1.35, 2.2, -20, .675, 8, crateMaterial);
box(2.2, 1.35, 2.2, 20, .675, -8, crateMaterial);
box(2.2, 1.35, 2.2, 9, .675, 19, crateMaterial);
box(2.2, 1.35, 2.2, -9, .675, -19, crateMaterial);

for (let i = -2; i <= 2; i++) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 1.8, 8), darkMaterial);
  post.position.set(i * 5, .9, -29);
  post.castShadow = true;
  scene.add(post);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(.3, .12, .3), i % 2 ? cyanMaterial : redMaterial);
  lamp.position.set(i * 5, 1.85, -29);
  scene.add(lamp);
}

const weapon = new THREE.Group();
const gunMetal = new THREE.MeshStandardMaterial({ color: 0x263238, metalness: .78, roughness: .28 });
const gunPolymer = new THREE.MeshStandardMaterial({ color: 0x11191c, metalness: .22, roughness: .62 });
const gunAccent = new THREE.MeshStandardMaterial({ color: 0xd95332, metalness: .3, roughness: .4 });
function gunPart(geometry, material, x, y, z, rotationX = 0) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(x, y, z);
  part.rotation.x = rotationX;
  part.castShadow = true;
  weapon.add(part);
  return part;
}

// The barrel's local -Z axis matches the camera's forward direction.
gunPart(new THREE.BoxGeometry(.2, .17, .45), gunMetal, .29, -.25, -.37);
gunPart(new THREE.CylinderGeometry(.045, .06, .48, 12), gunMetal, .29, -.22, -.79, Math.PI / 2);
gunPart(new THREE.CylinderGeometry(.068, .068, .09, 12), gunAccent, .29, -.22, -1.02, Math.PI / 2);
gunPart(new THREE.BoxGeometry(.12, .08, .38), gunPolymer, .29, -.12, -.46);
gunPart(new THREE.BoxGeometry(.16, .29, .19), gunPolymer, .29, -.45, -.31, -.18);
gunPart(new THREE.BoxGeometry(.13, .33, .22), gunMetal, .29, -.49, -.48, -.12);
gunPart(new THREE.BoxGeometry(.22, .11, .38), gunPolymer, .29, -.21, .03);
gunPart(new THREE.BoxGeometry(.16, .12, .13), gunAccent, .29, -.25, -.1);
const muzzleFlash = new THREE.Mesh(
  new THREE.ConeGeometry(.12, .34, 8),
  new THREE.MeshBasicMaterial({ color: 0xffd27a })
);
muzzleFlash.rotation.x = Math.PI / 2;
muzzleFlash.position.set(.29, -.22, -1.19);
muzzleFlash.visible = false;
weapon.add(muzzleFlash);
weapon.scale.setScalar(.68);
weapon.position.set(.03, -.08, -.2);
camera.add(weapon);
scene.add(camera);

const enemies = [];
const enemyGeometry = new THREE.BoxGeometry(.9, 1.5, .75);
const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0x5d171e, roughness: .45, metalness: .35 });

function spawnEnemy() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(enemyGeometry, enemyMaterial);
  body.position.y = 1.25;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(.62, .52, .62), new THREE.MeshStandardMaterial({ color: 0x242c30, metalness: .7 }));
  head.position.y = 2.28;
  head.castShadow = true;
  group.add(head);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(.42, .07, .04), redMaterial);
  eye.position.set(0, 2.28, -.32);
  group.add(eye);

  let angle = Math.random() * Math.PI * 2;
  let radius = 14 + Math.random() * 12;
  group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  scene.add(group);
  enemies.push({ group, hp: 3 + Math.floor(wave / 3), speed: 1.7 + wave * .08, cooldown: Math.random() * 1.5, hit: 0 });
}

function resetGame() {
  enemies.forAll?.();
  while (enemies.length) scene.remove(enemies.pop().group);
  health = 100;
  kills = 0;
  wave = 1;
  ammo = 24;
  reserve = 144;
  reloading = false;
  camera.position.set(0, 1.65, 10);
  yaw = 0;
  pitch = 0;
  for (let i = 0; i < 5; i++) spawnEnemy();
  updateHud();
}

function updateHud() {
  ui.health.textContent = Math.max(0, Math.ceil(health));
  ui.healthBar.style.width = `${Math.max(0, health)}%`;
  ui.healthBar.style.background = health > 35 ? "var(--cyan)" : "var(--red)";
  ui.ammo.textContent = ammo;
  ui.reserve.textContent = reserve;
  ui.kills.textContent = kills;
  ui.wave.textContent = `第 ${wave} 波`;
}

function blocked(x, z) {
  for (const o of obstacles) {
    if (x > o.minX - .35 && x < o.maxX + .35 && z > o.minZ - .35 && z < o.maxZ + .35) return true;
  }
  return   x < -32.8 || x > 32.8 || z < -32.8 || z > 32.8;
}

function shoot() {
  if (!playing || reloading || shootCooldown > 0) return;
  if (ammo <= 0) {
    reload();
    return;
  }
  ammo--;
  shootCooldown = .11;
  muzzleVisible = .035;
  updateHud();

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const targets = [];
  for (const enemy of enemies) targets.push(enemy.group);
  const intersections = raycaster.intersectObjects(targets, true);
  if (intersections.length) {
    let hitGroup = intersections[0].object;
    while (hitGroup.parent && hitGroup.parent !== scene) hitGroup = hitGroup.parent;
    const enemy = enemies.find(e => e.group === hitGroup);
    if (enemy) {
      enemy.hp--;
      enemy.hit = .12;
      ui.hit.style.opacity = "1";
      ui.hit.style.transform = "translate(-50%, -50%) scale(1)";
      setTimeout(() => {
        ui.hit.style.opacity = "0";
        ui.hit.style.transform = "translate(-50%, -50%) scale(.5)";
      }, 70);
      if (enemy.hp <= 0) {
        scene.remove(enemy.group);
        enemies.splice(enemies.indexOf(enemy), 1);
        kills++;
        updateHud();
        if (enemies.length === 0) nextWave();
      }
    }
  }
}

function reload() {
  if (!playing || reloading || ammo === 24 || reserve <= 0) return;
  reloading = true;
  setTimeout(() => {
    const needed = 24 - ammo;
    const loaded = Math.min(needed, reserve);
    ammo += loaded;
    reserve -= loaded;
    reloading = false;
    updateHud();
  }, 1100);
}

function nextWave() {
  wave++;
  reserve = Math.min(192, reserve + 36);
  setTimeout(() => {
    for (let i = 0; i < 4 + wave; i++) spawnEnemy();
    updateHud();
  }, 1400);
  updateHud();
}

document.getElementById("startButton").addEventListener("click", () => {
  ui.menu.classList.add("hidden");
  playing = true;
  try {
    canvas.requestPointerLock();
  } catch (_) {
    // The game remains playable if the browser disallows pointer lock.
  }
});

document.getElementById("restartButton").addEventListener("click", () => {
  ui.gameOver.classList.add("hidden");
  resetGame();
  playing = true;
  try {
    canvas.requestPointerLock();
  } catch (_) {
    // The game remains playable if the browser disallows pointer lock.
  }
});

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === canvas) {
    playing = true;
  } else if (playing && !ui.gameOver.classList.contains("hidden") === false) {
    playing = false;
  }
});

document.addEventListener("mousemove", (event) => {
  if (!playing || document.pointerLockElement !== canvas) return;
  yaw -= event.movementX * .0021;
  pitch -= event.movementY * .0021;
  pitch = Math.max(-1.35, Math.min(1.35, pitch));
});

document.addEventListener("mousedown", () => shoot());
document.addEventListener("keydown", (event) => {
  const code = {
    ArrowUp: "KeyW",
    ArrowDown: "KeyS",
    ArrowLeft: "KeyA",
    ArrowRight: "KeyD"
  }[event.code] || event.code;
  keys[code] = true;
  if (event.code === "KeyR") reload();
});
document.addEventListener("keyup", (event) => {
  const code = {
    ArrowUp: "KeyW",
    ArrowDown: "KeyS",
    ArrowLeft: "KeyA",
    ArrowRight: "KeyD"
  }[event.code] || event.code;
  keys[code] = false;
});

document.querySelectorAll("[data-key]").forEach((button) => {
  const code = button.dataset.key;
  const press = (event) => {
    event.preventDefault();
    keys[code] = true;
  };
  const release = (event) => {
    event.preventDefault();
    keys[code] = false;
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

function updatePlayer(dt) {
  if (!playing) return;
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const move = new THREE.Vector3();
  if (keys.KeyW) move.add(forward);
  if (keys.KeyS) move.sub(forward);
  if (keys.KeyD) move.add(right);
  if (keys.KeyA) move.sub(right);
  if (move.lengthSq()) {
    move.normalize();
    const speed = keys.ShiftLeft || keys.ShiftRight ? 7.5 : 4.5;
    const nextX = camera.position.x + move.x * speed * dt;
    const nextZ = camera.position.z + move.z * speed * dt;
    if (!blocked(nextX, camera.position.z)) camera.position.x = nextX;
    if (!blocked(camera.position.x, nextZ)) camera.position.z = nextZ;
  }
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

function updateEnemies(dt) {
  for (const enemy of enemies) {
    enemy.hit = Math.max(0, enemy.hit - dt);
    const dx = camera.position.x - enemy.group.position.x;
    const dz = camera.position.z - enemy.group.position.z;
    const dist = Math.hypot(dx, dz);
    enemy.group.rotation.y = Math.atan2(dx, dz);

    if (dist > 3.5) {
      const nx = dx / dist;
      const nz = dz / dist;
      const nextX = enemy.group.position.x + nx * enemy.speed * dt;
      const nextZ = enemy.group.position.z + nz * enemy.speed * dt;
      if (!blocked(nextX, enemy.group.position.z)) enemy.group.position.x = nextX;
      if (!blocked(enemy.group.position.x, nextZ)) enemy.group.position.z = nextZ;
    } else if (playing) {
      enemy.cooldown -= dt;
      if (enemy.cooldown <= 0) {
        health -= 7 + wave;
        enemy.cooldown = 1;
        ui.damage.style.opacity = ".75";
        setTimeout(() => ui.damage.style.opacity = "0", 90);
        updateHud();
        if (health <= 0) gameOver();
      }
    }
  }
}

function gameOver() {
  playing = false;
  document.exitPointerLock();
  document.getElementById("finalKills").textContent = kills;
  ui.gameOver.classList.remove("hidden");
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05);
  shootCooldown = Math.max(0, shootCooldown - dt);
  muzzleVisible = Math.max(0, muzzleVisible - dt);
  muzzleFlash.visible = muzzleVisible > 0;
  weapon.position.y = Math.sin(performance.now() * .004) * .003;
  updatePlayer(dt);
  updateEnemies(dt);
  renderer.render(scene, camera);
}

resetGame();
playing = false;
animate();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
