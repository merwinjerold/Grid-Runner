/* ============================================================
   GRID//RUNNER — cyberpunk endless runner
   Built with basic Three.js primitive geometry (no external models)
   ============================================================ */
(function(){
"use strict";

/* ---------------- CONSTANTS ---------------- */
const LANES = [-2, 0, 2];
const TUNNEL_W = 7.6;
const TUNNEL_H = 6.0;
const FLOOR_RIDE_Y = 0.16;
const FLY_RIDE_Y = TUNNEL_H - 1.25;
const FLOOR_COLLECT_Y = 0.9;
const FLY_COLLECT_Y = TUNNEL_H - 1.6;
const SEG_LEN = 12;
const NUM_SEGMENTS = 13;
const SPAWN_FAR_Z = -(SEG_LEN * NUM_SEGMENTS - 6);
const RECYCLE_Z = 9;
const PLAYER_Z = 0;
const HIT_BAND = 0.65;
const PICK_BAND = 0.9;
const BASE_SPEED = 10.5;
const MAX_SPEED_BONUS = 15;
const JUMP_DUR = 0.52;
const JUMP_HEIGHT = 1.65;
const SLIDE_DUR = 0.42;
const FLY_TRANSITION = 0.35;

/* ---------------- DATA: BOARDS & GUNS ---------------- */
const BOARDS = [
  { id:'drift', name:'NEON DRIFT', tag:'BALANCED ALL-ROUNDER', colorDeck:0x0ad8ff, colorTrim:0xff2166, speed:1.00, handling:1.00, gravity:1.00, scoreMult:1.00 },
  { id:'reaper', name:'VOLT REAPER', tag:'OVERCLOCKED SPEED FRAME', colorDeck:0xff2166, colorTrim:0x111111, speed:1.16, handling:0.9, gravity:0.82, scoreMult:1.05 },
  { id:'phantom', name:'GLITCH PHANTOM', tag:'EXTENDED GRAV-CORE', colorDeck:0x8a2bff, colorTrim:0x39ff8c, speed:0.94, handling:1.05, gravity:1.35, scoreMult:1.1 },
  { id:'wraith', name:'SOLAR WRAITH', tag:'HIGH-YIELD SCORE RIG', colorDeck:0xffc14d, colorTrim:0xffffff, speed:0.98, handling:0.85, gravity:1.0, scoreMult:1.3 },
];
const GUNS = [
  { id:'pulse', name:'PULSE BLASTER', tag:'BALANCED SIDEARM', color:0x0ad8ff, fireRate:2.2, range:55, ammoMax:6, ammoRegen:2.6, special:'STANDARD', splash:false, pierce:false },
  { id:'lance', name:'LASER LANCE', tag:'LONG-RANGE PIERCER', color:0xff2166, fireRate:1.1, range:95, ammoMax:4, ammoRegen:3.2, special:'PIERCING SHOT', splash:false, pierce:true },
  { id:'quake', name:'QUAKE CANNON', tag:'SPLASH DEMOLITION', color:0xffb020, fireRate:0.9, range:40, ammoMax:5, ammoRegen:3.6, special:'SPLASH BLAST', splash:true, pierce:false },
];

/* ---------------- STORAGE ---------------- */
const SAVE_KEY = 'gridrunner_save_v1';
function loadSave(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(raw) return Object.assign(defaultSave(), JSON.parse(raw));
  }catch(e){}
  return defaultSave();
}
function defaultSave(){
  return {
    best:0, credits:0, board:'drift', gun:'pulse',
    settings:{ control:'swipe', gfx:'med', gravSens:100, music:true, sfx:true, shake:true }
  };
}
let SAVE = loadSave();
function persist(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); }catch(e){} }

/* ---------------- AUDIO ---------------- */
const Audio_ = (function(){
  let ctx=null, musicTimer=null, musicStep=0;
  function ensure(){
    if(!ctx){ try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
    if(ctx && ctx.state==='suspended'){ ctx.resume().catch(()=>{}); }
    return ctx;
  }
  function blip(freq, dur, type, vol, slideTo){
    if(!SAVE.settings.sfx) return;
    const c = ensure(); if(!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator(); const gain = c.createGain();
    osc.type = type||'square'; osc.frequency.setValueAtTime(freq, t0);
    if(slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20,slideTo), t0+dur);
    gain.gain.setValueAtTime((vol!=null?vol:0.18), t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t0); osc.stop(t0+dur+0.02);
  }
  function sfx(name){
    switch(name){
      case 'jump': blip(420,0.16,'square',0.15,680); break;
      case 'slide': blip(220,0.14,'sawtooth',0.12,140); break;
      case 'lane': blip(560,0.07,'square',0.10); break;
      case 'shoot': blip(900,0.09,'square',0.12,300); break;
      case 'hit': blip(140,0.28,'sawtooth',0.22,60); break;
      case 'collect': blip(980,0.10,'sine',0.16,1400); break;
      case 'ammo': blip(700,0.10,'triangle',0.14,900); break;
      case 'gravOn': blip(180,0.30,'sawtooth',0.16,720); break;
      case 'gravOff': blip(720,0.24,'sawtooth',0.14,180); break;
      case 'destroy': blip(300,0.22,'square',0.2,80); break;
      case 'click': blip(660,0.05,'square',0.10); break;
      case 'gameover': blip(300,0.5,'sawtooth',0.2,40); break;
    }
  }
  function startMusic(){
    if(musicTimer) return;
    const notes = [220,277,330,220,277,330,415,330];
    musicStep = 0;
    musicTimer = setInterval(()=>{
      if(SAVE.settings.music){
        const c = ensure();
        if(c){ blip(notes[musicStep%notes.length]/2, 0.22, 'triangle', 0.05); }
      }
      musicStep++;
    }, 260);
  }
  function stopMusic(){ if(musicTimer){ clearInterval(musicTimer); musicTimer=null; } }
  return { sfx, startMusic, stopMusic, ensure };
})();

/* ---------------- THREE SETUP ---------------- */
const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05030f);
scene.fog = new THREE.Fog(0x05030f, 26, 120);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth/window.innerHeight, 0.1, 200);
camera.position.set(0, 2.6, 6.6);
camera.lookAt(0, 1.3, -8);

function resize(){
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w/h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

/* lights */
scene.add(new THREE.AmbientLight(0x4060a0, 0.55));
const keyLight = new THREE.DirectionalLight(0x99e6ff, 0.6);
keyLight.position.set(2,6,4); scene.add(keyLight);
const magentaPoint = new THREE.PointLight(0xff2166, 1.4, 22);
magentaPoint.position.set(0,3,2); scene.add(magentaPoint);
const cyanPoint = new THREE.PointLight(0x00f0ff, 1.1, 26);
cyanPoint.position.set(0,4,-6); scene.add(cyanPoint);

/* ---------------- TEXTURES ---------------- */
function makeGridTexture(lineColor, bgColor, dense, transparentBg){
  const size = 256;
  const cnv = document.createElement('canvas'); cnv.width=size; cnv.height=size;
  const ctx = cnv.getContext('2d');
  if(!transparentBg){ ctx.fillStyle = bgColor; ctx.fillRect(0,0,size,size); }
  ctx.strokeStyle = lineColor; ctx.lineWidth = dense?2:3; ctx.globalAlpha = transparentBg?0.55:0.85;
  const step = dense? size/16 : size/6;
  for(let i=0;i<=size;i+=step){
    ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(size,i); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.strokeStyle = lineColor; ctx.lineWidth = transparentBg?3:5;
  ctx.strokeRect(2,2,size-4,size-4);
  const tex = new THREE.CanvasTexture(cnv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
function makeWindowTexture(litColor){
  const w=128,h=256;
  const cnv = document.createElement('canvas'); cnv.width=w; cnv.height=h;
  const ctx = cnv.getContext('2d');
  ctx.fillStyle='#090916'; ctx.fillRect(0,0,w,h);
  const cols=4, rows=10, pad=4;
  const cw=(w-pad*(cols+1))/cols, ch=(h-pad*(rows+1))/rows;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const lit = Math.random()<0.32;
      ctx.fillStyle = lit? litColor : '#1b1f30';
      ctx.fillRect(pad+c*(cw+pad), pad+r*(ch+pad), cw, ch);
    }
  }
  const tex = new THREE.CanvasTexture(cnv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
function makeBillboardTexture(text, glowColor){
  const w=512,h=192;
  const cnv = document.createElement('canvas'); cnv.width=w; cnv.height=h;
  const ctx = cnv.getContext('2d');
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='rgba(4,4,12,0.55)'; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle=glowColor; ctx.lineWidth=6; ctx.strokeRect(8,8,w-16,h-16);
  ctx.font='bold 64px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.shadowColor=glowColor; ctx.shadowBlur=26;
  ctx.fillStyle=glowColor;
  ctx.fillText(text, w/2, h/2);
  return new THREE.CanvasTexture(cnv);
}
const floorTex = makeGridTexture('#0ad8ff', '#070418', false, false);
floorTex.repeat.set(2, NUM_SEGMENTS*1.2);
const ceilTex = makeGridTexture('#ff2166', '#070418', false, true);
ceilTex.repeat.set(2, NUM_SEGMENTS*1.2);
const wallTex = makeGridTexture('#39ff8c', '#0a0620', true, true);
wallTex.repeat.set(1, 3);
const windowTexA = makeWindowTexture('#7fe8ff');
const windowTexB = makeWindowTexture('#ffd27f');
const windowTexC = makeWindowTexture('#ff8fd6');

/* ---------------- WORLD ROOT (everything scrolls) ---------------- */
const world = new THREE.Group();
scene.add(world);

/* track segments pool — walls/ceiling are glass-like so the city outside is visible */
const floorMat = new THREE.MeshStandardMaterial({ map:floorTex, emissive:0x0ad8ff, emissiveIntensity:0.35, roughness:0.7, metalness:0.2 });
const ceilMat = new THREE.MeshStandardMaterial({ map:ceilTex, emissive:0xff2166, emissiveIntensity:0.3, roughness:0.7, metalness:0.2, transparent:true, opacity:0.55 });
const wallMat = new THREE.MeshStandardMaterial({ map:wallTex, emissive:0x39ff8c, emissiveIntensity:0.22, roughness:0.8, metalness:0.1, side:THREE.DoubleSide, transparent:true, opacity:0.5 });
const strutMat = new THREE.MeshStandardMaterial({ color:0x0ad8ff, emissive:0x0ad8ff, emissiveIntensity:1.2 });
const archMat = new THREE.MeshStandardMaterial({ color:0x161028, roughness:0.6, metalness:0.4 });
const archLightMat = new THREE.MeshBasicMaterial({ color:0xff2166 });
const archLights = [];

const segments = [];
for(let i=0;i<NUM_SEGMENTS;i++){
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(TUNNEL_W, 0.2, SEG_LEN), floorMat);
  floor.position.y = -0.1; g.add(floor);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(TUNNEL_W, 0.2, SEG_LEN), ceilMat);
  ceil.position.y = TUNNEL_H + 0.1; g.add(ceil);
  const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.2, TUNNEL_H, SEG_LEN), wallMat);
  wallL.position.set(-TUNNEL_W/2, TUNNEL_H/2, 0); g.add(wallL);
  const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.2, TUNNEL_H, SEG_LEN), wallMat);
  wallR.position.set(TUNNEL_W/2, TUNNEL_H/2, 0); g.add(wallR);
  for(let s=-1;s<=1;s+=2){
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,SEG_LEN), strutMat);
    strut.position.set(s*TUNNEL_W/2, TUNNEL_H*0.5 + s*0, 0);
    strut.position.y = 0.02; g.add(strut.clone());
  }
  if(i%2===0){
    const archDepth = 0.3;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(TUNNEL_W+0.4, 0.32, archDepth), archMat);
    beam.position.set(0, TUNNEL_H+0.3, SEG_LEN/2-1); g.add(beam);
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.32,0.6,archDepth), archMat);
    postL.position.set(-TUNNEL_W/2-0.1, TUNNEL_H+0.05, SEG_LEN/2-1); g.add(postL);
    const postR = postL.clone(); postR.position.x = TUNNEL_W/2+0.1; g.add(postR);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(TUNNEL_W, 0.06, 0.06), archLightMat.clone());
    strip.position.set(0, TUNNEL_H+0.12, SEG_LEN/2-1); g.add(strip);
    archLights.push(strip);
  }
  g.position.z = -i*SEG_LEN;
  world.add(g);
  segments.push(g);
}

/* skyline: lit-window buildings + occasional holographic billboards */
const skylinePieces = [];
const billboardTexts = ['AXIOM CORP','NEON COLA','OVERCLOCK','NULL SECTOR','VOLT TAXI','ZENITH BANK','KAIDO RAMEN','GRID//RUNNER'];
const billboardColors = ['#00f0ff','#ff2166','#39ff8c','#ffb020'];
function makeBuilding(){
  const w = 1.6 + Math.random()*2.6, h = 4 + Math.random()*11, d = 1.6 + Math.random()*2.6;
  const geo = new THREE.BoxGeometry(w,h,d);
  const winTex = [windowTexA,windowTexB,windowTexC][Math.floor(Math.random()*3)];
  const mat = new THREE.MeshStandardMaterial({ map:winTex, emissiveMap:winTex, emissive:0xffffff, emissiveIntensity:0.8, roughness:0.85, metalness:0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: Math.random()>0.5?0x00f0ff:0xff2166 }));
  mesh.add(edges);
  mesh.userData.h = h;
  if(Math.random()<0.4){
    const txt = billboardTexts[Math.floor(Math.random()*billboardTexts.length)];
    const col = billboardColors[Math.floor(Math.random()*billboardColors.length)];
    const bbMat = new THREE.MeshBasicMaterial({ map:makeBillboardTexture(txt,col), transparent:true, side:THREE.DoubleSide });
    const bw = Math.min(w,d)*1.3, bh = bw*0.4;
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(bw,bh), bbMat);
    bb.position.set(0, h*0.22, d/2+0.02);
    mesh.add(bb);
  }
  return mesh;
}
for(let side=-1; side<=1; side+=2){
  for(let i=0;i<14;i++){
    const b = makeBuilding();
    b.position.set(side*(TUNNEL_W/2 + 3 + Math.random()*6), b.userData.h/2 - 0.1, -i*9 - Math.random()*4);
    world.add(b); skylinePieces.push(b);
  }
}

/* cyber pedestrians on the sidewalks beyond the glass tunnel walls */
const pedestrians = [];
const pedTrimColors = [0x00f0ff, 0xff2166, 0x39ff8c, 0xffb020, 0x8a2bff];
function makePedestrian(){
  const trim = pedTrimColors[Math.floor(Math.random()*pedTrimColors.length)];
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color:0xd9a679, roughness:0.6 });
  const suitMat = new THREE.MeshStandardMaterial({ color:0x14141c, emissive:trim, emissiveIntensity:0.6, roughness:0.5 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13,10,10), skinMat); head.position.y=1.0; g.add(head);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.32,0.46,0.2), suitMat); torso.position.y=0.66; g.add(torso);
  const legGeo = new THREE.BoxGeometry(0.12,0.42,0.12);
  const legL = new THREE.Mesh(legGeo, suitMat); legL.position.set(-0.09,0.22,0); g.add(legL);
  const legR = new THREE.Mesh(legGeo, suitMat); legR.position.set(0.09,0.22,0); g.add(legR);
  const armGeo = new THREE.BoxGeometry(0.09,0.38,0.09);
  const armL = new THREE.Mesh(armGeo, suitMat); armL.position.set(-0.22,0.62,0); g.add(armL);
  const armR = new THREE.Mesh(armGeo, suitMat); armR.position.set(0.22,0.62,0); g.add(armR);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.04,0.04), new THREE.MeshBasicMaterial({ color:trim }));
  visor.position.set(0,1.02,0.11); g.add(visor);
  g.userData.phase = Math.random()*Math.PI*2;
  g.userData.armL = armL; g.userData.armR = armR;
  return g;
}
for(let side=-1; side<=1; side+=2){
  for(let i=0;i<6;i++){
    const p = makePedestrian();
    p.position.set(side*(TUNNEL_W/2 + 1.6 + Math.random()*1.2), 0, -i*13 - Math.random()*6);
    world.add(p); pedestrians.push(p);
  }
}

/* flying vehicles crossing the skyline */
const flyingVehicles = [];
const vehicleColors = [0x00f0ff, 0xff2166, 0x39ff8c];
function makeVehicle(){
  const col = vehicleColors[Math.floor(Math.random()*vehicleColors.length)];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color:0x12131c, emissive:col, emissiveIntensity:0.3, roughness:0.4, metalness:0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.28,0.7), bodyMat); g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.2,0.5), new THREE.MeshBasicMaterial({ color:col })); cabin.position.set(0.1,0.2,0); g.add(cabin);
  const finGeo = new THREE.BoxGeometry(0.5,0.05,0.18);
  const finL = new THREE.Mesh(finGeo, bodyMat); finL.position.set(-0.6,0,0.4); g.add(finL);
  const finR = finL.clone(); finR.position.z=-0.4; g.add(finR);
  const engineMat = new THREE.MeshBasicMaterial({ color:col });
  const eng1 = new THREE.Mesh(new THREE.SphereGeometry(0.07,8,8), engineMat); eng1.position.set(-0.85,0,0.3); g.add(eng1);
  const eng2 = eng1.clone(); eng2.position.z=-0.3; g.add(eng2);
  return g;
}
for(let i=0;i<5;i++){
  const v = makeVehicle();
  v.userData.driftSpeed = (Math.random()-0.5)*2.4;
  v.userData.ownSpeed = 4+Math.random()*8;
  v.userData.bobPhase = Math.random()*Math.PI*2;
  v.position.set((Math.random()-0.5)*26, TUNNEL_H+5+Math.random()*9, -Math.random()*150);
  v.rotation.y = Math.random()*Math.PI*2;
  world.add(v); flyingVehicles.push(v);
}

/* ---------------- PLAYER ---------------- */
const player = new THREE.Group();
scene.add(player);

const boardGroup = new THREE.Group();
const deckGeo = new THREE.BoxGeometry(0.62, 0.07, 1.55);
const deckMat = new THREE.MeshStandardMaterial({ color:BOARDS[0].colorDeck, emissive:BOARDS[0].colorDeck, emissiveIntensity:0.4, roughness:0.4, metalness:0.5 });
const deck = new THREE.Mesh(deckGeo, deckMat); boardGroup.add(deck);
const glowGeo = new THREE.BoxGeometry(0.66, 0.03, 1.6);
const glowMat = new THREE.MeshBasicMaterial({ color:BOARDS[0].colorTrim });
const underglow = new THREE.Mesh(glowGeo, glowMat); underglow.position.y = -0.05; boardGroup.add(underglow);
const wheelGeo = new THREE.CylinderGeometry(0.09,0.09,0.09,12);
const wheelMat = new THREE.MeshStandardMaterial({ color:0x111122, emissive:0x00f0ff, emissiveIntensity:0.6 });
const wheels = [];
[[-0.26,0.55],[0.26,0.55],[-0.26,-0.55],[0.26,-0.55]].forEach(p=>{
  const wh = new THREE.Mesh(wheelGeo, wheelMat);
  wh.rotation.z = Math.PI/2; wh.position.set(p[0], -0.07, p[1]);
  boardGroup.add(wh); wheels.push(wh);
});
boardGroup.position.y = FLOOR_RIDE_Y;
player.add(boardGroup);

/* ---- character rig styled after the cyber-runner reference: white spiky
   hair, glowing cyan visor, open tactical jacket with a glowing chevron,
   armored gauntlets/knee plates, and light-up sneakers ---- */
const bodyGroup = new THREE.Group();

const skinMat = new THREE.MeshStandardMaterial({ color:0xd9a679, roughness:0.55, metalness:0.05 });
const hairMat = new THREE.MeshStandardMaterial({ color:0xeaf0f6, emissive:0x335566, emissiveIntensity:0.15, roughness:0.4 });
const jacketMat = new THREE.MeshStandardMaterial({ color:0x14151d, roughness:0.55, metalness:0.3 });
const shirtMat = new THREE.MeshStandardMaterial({ color:0x1b1d27, roughness:0.6 });
const hoodMat = new THREE.MeshStandardMaterial({ color:0xc7ccd6, roughness:0.7 });
const armorMat = new THREE.MeshStandardMaterial({ color:0x3a3f4c, roughness:0.35, metalness:0.7 });
const gloveMat = new THREE.MeshStandardMaterial({ color:0x16171e, roughness:0.6 });
const soleMat = new THREE.MeshStandardMaterial({ color:0xd8dde4, roughness:0.5, metalness:0.2 });
const visorMat = new THREE.MeshBasicMaterial({ color:0x29e0ff });
const torsoMat = new THREE.MeshBasicMaterial({ color:BOARDS[0].colorTrim }); // chest emblem, tied to board trim colour
const glowAccentMat = new THREE.MeshBasicMaterial({ color:0x29e0ff }); // suit glow seams (gauntlets/knees/shoes)

// --- head ---
const headGroup = new THREE.Group(); headGroup.position.y = 1.30;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.155,16,16), skinMat); headGroup.add(head);
const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.09,0.13), skinMat); jaw.position.set(0,-0.12,0.02); headGroup.add(jaw);
for(let i=0;i<7;i++){
  const sp = new THREE.Mesh(new THREE.ConeGeometry(0.045,0.26-Math.abs(i-3)*0.02,6), hairMat);
  const ang = (i-3)*0.26;
  sp.position.set(Math.sin(ang)*0.09, 0.16+Math.cos(ang)*0.04, -0.04-Math.abs(i-3)*0.01);
  sp.rotation.x = -0.55; sp.rotation.z = ang*0.6;
  headGroup.add(sp);
}
const visorL = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.045,0.05), visorMat);
visorL.position.set(-0.05,0.015,0.135); visorL.rotation.y = 0.25; headGroup.add(visorL);
const visorR = visorL.clone(); visorR.position.x=0.05; visorR.rotation.y=-0.25; headGroup.add(visorR);
const visorBridge = new THREE.Mesh(new THREE.BoxGeometry(0.045,0.03,0.05), new THREE.MeshStandardMaterial({ color:0x111318 }));
visorBridge.position.set(0,0.01,0.14); headGroup.add(visorBridge);
const earPiece = new THREE.Mesh(new THREE.SphereGeometry(0.022,8,8), armorMat); earPiece.position.set(0.135,-0.01,0.04); headGroup.add(earPiece);
bodyGroup.add(headGroup);

// --- torso / open jacket / chest emblem ---
const torsoY = 0.78;
const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.5,0.2), shirtMat); shirt.position.y=torsoY; bodyGroup.add(shirt);
const chev = new THREE.Group(); chev.position.set(0, torsoY+0.08, 0.105);
[[-0.045,-0.55],[0.045,0.55]].forEach(p=>{
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.16,0.02), torsoMat);
  bar.position.set(p[0]*0.5, 0, 0); bar.rotation.z = p[1]*0.55;
  chev.add(bar);
});
bodyGroup.add(chev);
const hood = new THREE.Mesh(new THREE.TorusGeometry(0.16,0.045,8,16,Math.PI*1.3), hoodMat);
hood.position.set(0, torsoY+0.34, -0.08); hood.rotation.x = Math.PI*0.42; bodyGroup.add(hood);
const lapelGeo = new THREE.BoxGeometry(0.16,0.5,0.1);
const lapelL = new THREE.Mesh(lapelGeo, jacketMat); lapelL.position.set(-0.2,torsoY,0.02); lapelL.rotation.z=0.12; bodyGroup.add(lapelL);
const lapelR = new THREE.Mesh(lapelGeo, jacketMat); lapelR.position.set(0.2,torsoY,0.02); lapelR.rotation.z=-0.12; bodyGroup.add(lapelR);
const jacketBack = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.52,0.12), jacketMat); jacketBack.position.set(0,torsoY,-0.09); bodyGroup.add(jacketBack);
const shoulderArmor = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.16,0.22), armorMat); shoulderArmor.position.set(0.3,torsoY+0.27,0); bodyGroup.add(shoulderArmor);
const shoulderEmitter = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.02,12), glowAccentMat);
shoulderEmitter.rotation.x=Math.PI/2; shoulderEmitter.position.set(0.3,torsoY+0.27,0.1); bodyGroup.add(shoulderEmitter);
const belt = new THREE.Mesh(new THREE.BoxGeometry(0.36,0.07,0.22), new THREE.MeshStandardMaterial({ color:0x101116, roughness:0.6 }));
belt.position.set(0,torsoY-0.28,0); bodyGroup.add(belt);
const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.08,0.08), armorMat); pouch.position.set(-0.14,torsoY-0.3,0.1); bodyGroup.add(pouch);
const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.04,0.02), glowAccentMat); buckle.position.set(0.05,torsoY-0.28,0.12); bodyGroup.add(buckle);

// --- arms, pivoted at the shoulder so they swing naturally ---
function buildArm(side){
  const g = new THREE.Group(); g.position.set(side*0.27, torsoY+0.18, 0);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.11,0.26,0.12), jacketMat); upper.position.y=-0.13; g.add(upper);
  const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.13,0.22,0.14), armorMat); gauntlet.position.y=-0.34; g.add(gauntlet);
  const gauntletStripe = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.16,0.02), glowAccentMat); gauntletStripe.position.set(side*0.05,-0.34,0.075); g.add(gauntletStripe);
  const glove = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.13), gloveMat); glove.position.y=-0.49; g.add(glove);
  return g;
}
const armL = buildArm(-1); bodyGroup.add(armL);
const armR = buildArm(1); bodyGroup.add(armR);

// --- legs, pivoted at the hip ---
function buildLeg(side){
  const g = new THREE.Group(); g.position.set(side*0.13, 0.46, 0);
  const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.28,0.17), jacketMat); thigh.position.y=-0.14; g.add(thigh);
  const knee = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.13,0.18), armorMat); knee.position.y=-0.30; g.add(knee);
  const kneeEmitter = new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.02,12), glowAccentMat);
  kneeEmitter.rotation.x=Math.PI/2; kneeEmitter.position.set(0,-0.30,0.09); g.add(kneeEmitter);
  const shin = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.22,0.16), jacketMat); shin.position.y=-0.45; g.add(shin);
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17,0.1,0.27), gloveMat); shoe.position.set(0,-0.585,0.04); g.add(shoe);
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.05,0.28), soleMat); sole.position.set(0,-0.635,0.04); g.add(sole);
  const shoeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.05,0.18), glowAccentMat); shoeGlow.position.set(side*0.09,-0.6,0.04); g.add(shoeGlow);
  return g;
}
const legL = buildLeg(-1); bodyGroup.add(legL);
const legR = buildLeg(1); bodyGroup.add(legR);

// --- holstered sidearm on the belt ---
const gunGroup = new THREE.Group();
const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.09,0.26), new THREE.MeshStandardMaterial({ color:0x1c1d22, emissive:GUNS[0].color, emissiveIntensity:0.8 }));
const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.16,8), new THREE.MeshStandardMaterial({ color:0x111111, emissive:GUNS[0].color, emissiveIntensity:1 }));
gunBarrel.rotation.x = Math.PI/2; gunBarrel.position.z = -0.2;
gunGroup.add(gunBody); gunGroup.add(gunBarrel);
gunGroup.position.set(0.28, torsoY-0.32, 0.14); gunGroup.rotation.z = -0.3;
bodyGroup.add(gunGroup);

player.add(bodyGroup);

/* thruster glow (visible while flying) */
const thrusterMat = new THREE.MeshBasicMaterial({ color:0x39ff8c, transparent:true, opacity:0 });
const thruster = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.5, 12), thrusterMat);
thruster.rotation.x = Math.PI/2; thruster.position.set(0,-0.06,0.5);
boardGroup.add(thruster);

/* trail */
const TRAIL_COUNT = 14;
const trailMat = new THREE.MeshBasicMaterial({ color:0x0ad8ff, transparent:true, opacity:0.5 });
const trailPool = [];
for(let i=0;i<TRAIL_COUNT;i++){
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.04,0.18), trailMat.clone());
  m.visible = false; world.add(m); trailPool.push({ mesh:m, life:0 });
}
let trailTimer = 0;

/* projectiles pool */
const PROJ_COUNT = 16;
const projMat = new THREE.MeshBasicMaterial({ color:GUNS[0].color });
const projPool = [];
for(let i=0;i<PROJ_COUNT;i++){
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.09,8,8), projMat.clone());
  m.visible = false; scene.add(m);
  projPool.push({ mesh:m, active:false, lane:0, z:0, range:0 });
}

/* ---------------- OBSTACLES / COLLECTIBLES (detailed prop groups) ---------------- */
function makeHazardTexture(colorHex){
  const s=128; const cnv=document.createElement('canvas'); cnv.width=s; cnv.height=s;
  const ctx=cnv.getContext('2d');
  ctx.fillStyle='#0c0c10'; ctx.fillRect(0,0,s,s);
  ctx.strokeStyle=colorHex; ctx.lineWidth=14;
  for(let i=-s;i<s*2;i+=28){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i+s,s); ctx.stroke(); }
  const tex = new THREE.CanvasTexture(cnv); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2,1);
  return tex;
}
const jumpBarTex = makeHazardTexture('#ff2166');
const duckBarTex = makeHazardTexture('#ffb020');
const wallFullEdgeMat = new THREE.LineBasicMaterial({ color:0xb060ff });

function buildJumpBar(){
  return new THREE.Mesh(new THREE.BoxGeometry(1.5,0.55,0.32), new THREE.MeshStandardMaterial({ map:jumpBarTex, emissive:0xff2166, emissiveIntensity:0.5, roughness:0.6 }));
}
function buildDuckBar(){
  return new THREE.Mesh(new THREE.BoxGeometry(1.5,0.5,0.32), new THREE.MeshStandardMaterial({ map:duckBarTex, emissive:0xffb020, emissiveIntensity:0.5, roughness:0.6 }));
}
function buildWallFull(){
  const geo = new THREE.BoxGeometry(1.5,TUNNEL_H-0.3,0.34);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color:0x3a1a5c, emissive:0x8a2bff, emissiveIntensity:0.45, roughness:0.5, transparent:true, opacity:0.75 }));
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), wallFullEdgeMat));
  return mesh;
}
function buildDrone(){
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.34,0), new THREE.MeshStandardMaterial({ color:0x551018, emissive:0xff3344, emissiveIntensity:0.9, roughness:0.4, metalness:0.6 })));
  const finMat = new THREE.MeshStandardMaterial({ color:0x2a2a30, emissive:0xff3344, emissiveIntensity:0.4, roughness:0.5 });
  const finGeo = new THREE.BoxGeometry(0.5,0.04,0.16);
  const finL = new THREE.Mesh(finGeo, finMat); finL.position.set(-0.36,0,0); finL.rotation.z=0.15; g.add(finL);
  const finR = finL.clone(); finR.position.x=0.36; finR.rotation.z=-0.15; g.add(finR);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07,8,8), new THREE.MeshBasicMaterial({ color:0xff0033 })); eye.position.z=0.3; g.add(eye);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.22,6), finMat); antenna.position.y=0.32; g.add(antenna);
  return g;
}
function buildCeilSpike(){
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.12,10), new THREE.MeshStandardMaterial({ color:0x2a1530, roughness:0.5, metalness:0.5 })));
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.32,0.9,8), new THREE.MeshStandardMaterial({ color:0xff2166, emissive:0xff2166, emissiveIntensity:0.7 }));
  spike.position.y=-0.5; spike.rotation.x=Math.PI; g.add(spike);
  return g;
}
const OB = {
  jumpBar: { build:buildJumpBar, y:0.32, zone:'floor' },
  duckBar: { build:buildDuckBar, y:1.55, zone:'floor' },
  wallFull:{ build:buildWallFull, y:(TUNNEL_H-0.3)/2, zone:'both' },
  droneBlock:{ build:buildDrone, y:1.35, zone:'floor' },
  ceilSpike:{ build:buildCeilSpike, y:TUNNEL_H-0.55, zone:'ceiling' },
};

function buildOrb(){
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.13,0), new THREE.MeshBasicMaterial({ color:0xbdf6ff })));
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.23,0), new THREE.MeshStandardMaterial({ color:0x0ad8ff, emissive:0x0ad8ff, emissiveIntensity:1.1, transparent:true, opacity:0.55, wireframe:true })));
  return g;
}
function buildAmmo(){
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,0.3), new THREE.MeshStandardMaterial({ color:0x3a2a10, emissive:0xffb020, emissiveIntensity:0.7, roughness:0.6 })));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.32,0.06,0.32), new THREE.MeshBasicMaterial({ color:0xffb020 })));
  return g;
}
function buildGrav(){
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.22,0.06,8,16), new THREE.MeshStandardMaterial({ color:0x39ff8c, emissive:0x39ff8c, emissiveIntensity:1.1 })));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.09,10,10), new THREE.MeshBasicMaterial({ color:0xe8fff0 })));
  return g;
}
const COL = {
  orb: { build:buildOrb },
  ammo:{ build:buildAmmo },
  grav:{ build:buildGrav },
};

let activeObstacles = [];
let activeCollectibles = [];

function spawnObstacle(type, laneIdx, z){
  const def = OB[type];
  const mesh = def.build();
  mesh.position.set(LANES[laneIdx], def.y, z);
  if(type==='droneBlock') mesh.userData.spin = 1.5+Math.random();
  world.add(mesh);
  activeObstacles.push({ mesh, type, zone:def.zone, lane:laneIdx, resolved:false, destroyed:false });
}
function spawnCollectible(type, laneIdx, z, high){
  const def = COL[type];
  const mesh = def.build();
  mesh.position.set(LANES[laneIdx], high? FLY_COLLECT_Y : FLOOR_COLLECT_Y, z);
  world.add(mesh);
  activeCollectibles.push({ mesh, type, lane:laneIdx, high:!!high, picked:false });
}

/* ---------------- GAME STATE ---------------- */
const Game = {
  state:'boot', // boot, menu, garage, settings, howto, playing, paused, gameover
  distance:0, score:0, orbsCollected:0, dronesDestroyed:0, creditsRun:0,
  speed:BASE_SPEED,
  flying:false, flyT:0,
  laneIdx:1, laneX:0,
  jumping:false, jumpT:0,
  sliding:false, slideT:0,
  hearts:3, invulnT:0,
  gravMeter:100,
  ammo:6, ammoMax:6, shootCD:0,
  board: BOARDS.find(b=>b.id===SAVE.board) || BOARDS[0],
  gun: GUNS.find(g=>g.id===SAVE.gun) || GUNS[0],
  obsTimer:0, colTimer:0,
  comboGlow:0,
};

function applyLoadout(){
  const b = Game.board, g = Game.gun;
  deckMat.color.setHex(b.colorDeck); deckMat.emissive.setHex(b.colorDeck);
  glowMat.color.setHex(b.colorTrim);
  torsoMat.color.setHex(b.colorTrim);
  gunBody.material.emissive.setHex(g.color);
  gunBarrel.material.emissive.setHex(g.color);
  projMat.color.setHex(g.color);
  Game.ammoMax = g.ammoMax; Game.ammo = g.ammoMax;
}
applyLoadout();

function resetRun(){
  Game.distance=0; Game.score=0; Game.orbsCollected=0; Game.dronesDestroyed=0; Game.creditsRun=0;
  Game.speed = BASE_SPEED * Game.board.speed;
  Game.flying=false; Game.flyT=0;
  Game.laneIdx=1; Game.laneX=LANES[1];
  Game.jumping=false; Game.jumpT=0;
  Game.sliding=false; Game.slideT=0;
  Game.hearts=3; Game.invulnT=0;
  Game.gravMeter=100;
  Game.ammo = Game.gun.ammoMax; Game.ammoMax = Game.gun.ammoMax;
  Game.obsTimer=1.2; Game.colTimer=0.6;
  activeObstacles.forEach(o=>world.remove(o.mesh)); activeObstacles=[];
  activeCollectibles.forEach(c=>world.remove(c.mesh)); activeCollectibles=[];
  segments.forEach((g,i)=> g.position.z = -i*SEG_LEN );
  skylinePieces.forEach((b,i)=> b.position.z = -((i%14)*9) - 20 );
  pedestrians.forEach((p,i)=> p.position.z = -((i%6)*13) - 20 );
  flyingVehicles.forEach(v=>{
    v.position.z = -Math.random()*150;
    v.position.x = (Math.random()-0.5)*26;
    v.position.y = TUNNEL_H+5+Math.random()*9;
  });
  player.position.set(LANES[1], FLOOR_RIDE_Y, PLAYER_Z);
  boardGroup.position.y = FLOOR_RIDE_Y;
  thrusterMat.opacity = 0;
}

/* ---------------- INPUT ---------------- */
let touchStartX=0, touchStartY=0, touchStartT=0, touchActive=false;
let tiltCooldown = 0;
function onPressStart(x,y){ touchStartX=x; touchStartY=y; touchStartT=performance.now(); touchActive=true; }
function onPressEnd(x,y){
  if(!touchActive) return; touchActive=false;
  const dx = x-touchStartX, dy = y-touchStartY;
  const adx=Math.abs(dx), ady=Math.abs(dy);
  if(Math.max(adx,ady) < 24) return;
  if(adx>ady){ changeLane(dx>0?1:-1); }
  else { if(dy<0) doJump(); else doSlide(); }
}
canvas.addEventListener('touchstart', e=>{ if(Game.state!=='playing')return; const t=e.changedTouches[0]; onPressStart(t.clientX,t.clientY); }, {passive:true});
canvas.addEventListener('touchend', e=>{ if(Game.state!=='playing')return; const t=e.changedTouches[0]; onPressEnd(t.clientX,t.clientY); }, {passive:true});
canvas.addEventListener('mousedown', e=>{ if(Game.state!=='playing')return; onPressStart(e.clientX,e.clientY); });
canvas.addEventListener('mouseup', e=>{ if(Game.state!=='playing')return; onPressEnd(e.clientX,e.clientY); });

function changeLane(dir){
  if(Game.state!=='playing') return;
  const ni = Game.laneIdx+dir;
  if(ni<0||ni>2) return;
  Game.laneIdx = ni; Audio_.sfx('lane');
}
function doJump(){
  if(Game.state!=='playing' || Game.flying || Game.sliding) return;
  if(Game.jumping) return;
  Game.jumping=true; Game.jumpT=0; Audio_.sfx('jump');
}
function doSlide(){
  if(Game.state!=='playing' || Game.flying || Game.jumping) return;
  if(Game.sliding) return;
  Game.sliding=true; Game.slideT=0; Audio_.sfx('slide');
}
function setFlying(on){
  if(Game.state!=='playing') return;
  if(on && Game.gravMeter<=2) return;
  if(Game.flying===on) return;
  Game.flying = on;
  Game.jumping=false; Game.sliding=false;
  flashGlitch();
  Audio_.sfx(on?'gravOn':'gravOff');
  document.getElementById('gravityBtn').classList.toggle('active', on);
}
function doShoot(){
  if(Game.state!=='playing') return;
  if(Game.shootCD>0 || Game.ammo<=0) return;
  Game.shootCD = 1/Game.gun.fireRate;
  Game.ammo--; Audio_.sfx('shoot');
  fireProjectile();
}
function fireProjectile(){
  const slot = projPool.find(p=>!p.active);
  if(!slot) return;
  slot.active=true; slot.visible=true; slot.mesh.visible=true;
  slot.lane = Game.laneIdx;
  slot.mesh.position.set(LANES[Game.laneIdx], Game.flying?FLY_RIDE_Y+0.3:0.9, -1.4);
  slot.z = -1.4; slot.range = Game.gun.range;
  slot.pierce = Game.gun.pierce; slot.splash = Game.gun.splash;
}

/* buttons */
function bindTap(id, fn){
  const el = document.getElementById(id);
  el.addEventListener('touchstart', e=>{ e.preventDefault(); e.stopPropagation(); fn(); }, {passive:false});
  el.addEventListener('click', e=>{ e.stopPropagation(); fn(); });
}
bindTap('laneLeftBtn', ()=>changeLane(-1));
bindTap('laneRightBtn', ()=>changeLane(1));
bindTap('shootBtn', doShoot);

const gravBtnEl = document.getElementById('gravityBtn');
gravBtnEl.addEventListener('touchstart', e=>{ e.preventDefault(); e.stopPropagation(); setFlying(true); }, {passive:false});
gravBtnEl.addEventListener('touchend', e=>{ e.preventDefault(); e.stopPropagation(); setFlying(false); }, {passive:false});
gravBtnEl.addEventListener('touchcancel', e=>{ e.preventDefault(); e.stopPropagation(); setFlying(false); }, {passive:false});
gravBtnEl.addEventListener('mousedown', e=>{ e.stopPropagation(); setFlying(true); });
gravBtnEl.addEventListener('mouseup', e=>{ e.stopPropagation(); setFlying(false); });
gravBtnEl.addEventListener('mouseleave', ()=>{ if(Game.flying) setFlying(false); });

window.addEventListener('keydown', e=>{
  if(Game.state!=='playing') return;
  if(e.code==='ArrowLeft') changeLane(-1);
  if(e.code==='ArrowRight') changeLane(1);
  if(e.code==='ArrowUp') doJump();
  if(e.code==='ArrowDown') doSlide();
  if(e.code==='Space') doShoot();
  if(e.code==='ShiftLeft'||e.code==='KeyG') setFlying(true);
});
window.addEventListener('keyup', e=>{ if(e.code==='ShiftLeft'||e.code==='KeyG') setFlying(false); });

/* tilt control */
let tiltGamma = 0;
function tiltHandler(e){ if(e.gamma!=null) tiltGamma = e.gamma; }
function enableTilt(on){
  if(on){ window.addEventListener('deviceorientation', tiltHandler); }
  else{ window.removeEventListener('deviceorientation', tiltHandler); }
}

/* glitch flash */
function flashGlitch(){
  const el = document.getElementById('flashOverlay');
  el.style.transition='none'; el.style.opacity='0.55';
  el.style.background = 'linear-gradient(180deg, rgba(0,240,255,0.45), rgba(255,33,102,0.35))';
  requestAnimationFrame(()=>{ el.style.transition='opacity .35s ease'; el.style.opacity='0'; });
}
function hitFlash(){
  const el = document.getElementById('hitFlash');
  el.style.transition='none'; el.style.opacity='0.6';
  requestAnimationFrame(()=>{ el.style.transition='opacity .4s ease'; el.style.opacity='0'; });
}

/* ---------------- UI WIRING ---------------- */
const screens = ['mainMenu','garageScreen','settingsScreen','howToScreen','pauseScreen','gameOverScreen'];
function showScreen(id){
  screens.forEach(s=> document.getElementById(s).classList.toggle('hidden', s!==id) );
  document.getElementById('hud').classList.remove('active');
}
function showHud(){ screens.forEach(s=>document.getElementById(s).classList.add('hidden')); document.getElementById('hud').classList.add('active'); }

document.getElementById('bestScoreVal').textContent = SAVE.best;
document.getElementById('creditsVal').textContent = SAVE.credits;

document.getElementById('playBtn').addEventListener('click', ()=>{ Audio_.sfx('click'); startGame(); });
document.getElementById('garageBtn').addEventListener('click', ()=>{ Audio_.sfx('click'); openGarage(); });
document.getElementById('settingsBtn').addEventListener('click', ()=>{ Audio_.sfx('click'); openSettings(); });
document.getElementById('howToBtn').addEventListener('click', ()=>{ Audio_.sfx('click'); Game.state='howto'; showScreen('howToScreen'); });
document.getElementById('howToDone').addEventListener('click', ()=>{ Game.state='menu'; showScreen('mainMenu'); });
document.getElementById('howToClose').addEventListener('click', ()=>{ Game.state='menu'; showScreen('mainMenu'); });

/* garage */
let boardIdx = Math.max(0, BOARDS.findIndex(b=>b.id===SAVE.board));
let gunIdx = Math.max(0, GUNS.findIndex(g=>g.id===SAVE.gun));
function renderBoard(){
  const b = BOARDS[boardIdx];
  document.getElementById('boardName').textContent = b.name;
  document.getElementById('boardTag').textContent = b.tag;
  document.getElementById('bs1').style.width = (b.speed/1.3*100)+'%';
  document.getElementById('bs2').style.width = (b.handling/1.1*100)+'%';
  document.getElementById('bs3').style.width = (b.gravity/1.4*100)+'%';
  document.getElementById('bs4').style.width = (b.scoreMult/1.3*100)+'%';
}
function renderGun(){
  const g = GUNS[gunIdx];
  document.getElementById('gunName').textContent = g.name;
  document.getElementById('gunTag').textContent = g.tag;
  document.getElementById('gs1').style.width = (g.fireRate/2.4*100)+'%';
  document.getElementById('gs2').style.width = (g.range/95*100)+'%';
  document.getElementById('gs3').style.width = (g.ammoMax/6*100)+'%';
  document.getElementById('gs4').style.width = '100%';
}
function openGarage(){ Game.state='garage'; showScreen('garageScreen'); renderBoard(); renderGun(); }
document.getElementById('garageClose').addEventListener('click', ()=>{ Game.state='menu'; showScreen('mainMenu'); });
document.getElementById('garageDone').addEventListener('click', ()=>{
  SAVE.board = BOARDS[boardIdx].id; SAVE.gun = GUNS[gunIdx].id; persist();
  Game.board = BOARDS[boardIdx]; Game.gun = GUNS[gunIdx];
  applyLoadout();
  Game.state='menu'; showScreen('mainMenu');
});
document.getElementById('boardPrev').addEventListener('click', ()=>{ boardIdx=(boardIdx+BOARDS.length-1)%BOARDS.length; renderBoard(); Audio_.sfx('click'); });
document.getElementById('boardNext').addEventListener('click', ()=>{ boardIdx=(boardIdx+1)%BOARDS.length; renderBoard(); Audio_.sfx('click'); });
document.getElementById('gunPrev').addEventListener('click', ()=>{ gunIdx=(gunIdx+GUNS.length-1)%GUNS.length; renderGun(); Audio_.sfx('click'); });
document.getElementById('gunNext').addEventListener('click', ()=>{ gunIdx=(gunIdx+1)%GUNS.length; renderGun(); Audio_.sfx('click'); });
document.getElementById('tabBoard').addEventListener('click', ()=>{
  document.getElementById('tabBoard').classList.add('active'); document.getElementById('tabGun').classList.remove('active');
  document.getElementById('boardPane').classList.remove('hidden'); document.getElementById('gunPane').classList.add('hidden');
});
document.getElementById('tabGun').addEventListener('click', ()=>{
  document.getElementById('tabGun').classList.add('active'); document.getElementById('tabBoard').classList.remove('active');
  document.getElementById('gunPane').classList.remove('hidden'); document.getElementById('boardPane').classList.add('hidden');
});

/* settings */
function openSettings(){
  Game.state='settings'; showScreen('settingsScreen');
  setSeg('segControl', SAVE.settings.control);
  setSeg('segGfx', SAVE.settings.gfx);
  document.getElementById('gravSens').value = SAVE.settings.gravSens;
  setToggle('toggleMusic', SAVE.settings.music);
  setToggle('toggleSfx', SAVE.settings.sfx);
  setToggle('toggleShake', SAVE.settings.shake);
}
function setSeg(id, val){
  document.querySelectorAll('#'+id+' div').forEach(d=> d.classList.toggle('active', d.dataset.v===val) );
}
function setToggle(id, on){ document.getElementById(id).classList.toggle('on', on); }
document.querySelectorAll('#segControl div').forEach(d=> d.addEventListener('click', ()=>{ SAVE.settings.control=d.dataset.v; setSeg('segControl',d.dataset.v); Audio_.sfx('click'); }) );
document.querySelectorAll('#segGfx div').forEach(d=> d.addEventListener('click', ()=>{ SAVE.settings.gfx=d.dataset.v; setSeg('segGfx',d.dataset.v); applyGfx(); Audio_.sfx('click'); }) );
document.getElementById('gravSens').addEventListener('input', e=>{ SAVE.settings.gravSens = +e.target.value; });
document.getElementById('toggleMusic').addEventListener('click', ()=>{ SAVE.settings.music=!SAVE.settings.music; setToggle('toggleMusic',SAVE.settings.music); });
document.getElementById('toggleSfx').addEventListener('click', ()=>{ SAVE.settings.sfx=!SAVE.settings.sfx; setToggle('toggleSfx',SAVE.settings.sfx); Audio_.sfx('click'); });
document.getElementById('toggleShake').addEventListener('click', ()=>{ SAVE.settings.shake=!SAVE.settings.shake; setToggle('toggleShake',SAVE.settings.shake); });
document.getElementById('settingsClose').addEventListener('click', ()=>{ Game.state='menu'; showScreen('mainMenu'); });
document.getElementById('settingsDone').addEventListener('click', ()=>{
  persist(); enableTilt(SAVE.settings.control==='tilt');
  Game.state='menu'; showScreen('mainMenu');
});
document.getElementById('resetProgress').addEventListener('click', ()=>{
  SAVE.best=0; SAVE.credits=0; persist();
  document.getElementById('bestScoreVal').textContent=0; document.getElementById('creditsVal').textContent=0;
  Audio_.sfx('click');
});
function applyGfx(){
  const g = SAVE.settings.gfx;
  renderer.shadowMap.enabled = false;
  if(g==='low'){ renderer.setPixelRatio(1); scene.fog.far = 70; }
  else if(g==='med'){ renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5)); scene.fog.far = 120; }
  else { renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)); scene.fog.far = 150; }
}
applyGfx();
enableTilt(SAVE.settings.control==='tilt');

/* pause */
document.getElementById('pauseBtn').addEventListener('click', ()=>{ if(Game.state==='playing') pauseGame(); });
document.getElementById('resumeBtn').addEventListener('click', resumeGame);
document.getElementById('restartBtn').addEventListener('click', ()=>{ showHud(); startGame(); });
document.getElementById('menuFromPauseBtn').addEventListener('click', ()=>{ Game.state='menu'; showScreen('mainMenu'); Audio_.stopMusic(); });
document.getElementById('retryBtn').addEventListener('click', startGame);
document.getElementById('menuFromGOBtn').addEventListener('click', ()=>{ Game.state='menu'; showScreen('mainMenu'); Audio_.stopMusic(); });

function pauseGame(){ Game.state='paused'; showScreen('pauseScreen'); }
function resumeGame(){ Game.state='playing'; showHud(); }

/* ---------------- GAME FLOW ---------------- */
function startGame(){
  Audio_.ensure();
  resetRun();
  Game.state='playing';
  showHud();
  Audio_.startMusic();
}
function endGame(){
  Game.state='gameover';
  Audio_.sfx('gameover'); Audio_.stopMusic();
  const finalScore = Math.floor(Game.score);
  const isNew = finalScore > SAVE.best;
  if(isNew) SAVE.best = finalScore;
  SAVE.credits += Game.creditsRun;
  persist();
  document.getElementById('finalScoreVal').textContent = finalScore;
  document.getElementById('goDistance').textContent = Math.floor(Game.distance)+'m';
  document.getElementById('goOrbs').textContent = Game.orbsCollected;
  document.getElementById('goDrones').textContent = Game.dronesDestroyed;
  document.getElementById('goCredits').textContent = Game.creditsRun;
  document.getElementById('newBestTag').classList.toggle('hidden', !isNew);
  document.getElementById('bestScoreVal').textContent = SAVE.best;
  document.getElementById('creditsVal').textContent = SAVE.credits;
  showScreen('gameOverScreen');
}

function loseHeart(){
  if(Game.invulnT>0) return;
  Game.hearts--; Game.invulnT = 1.1;
  hitFlash(); Audio_.sfx('hit');
  if(SAVE.settings.shake) shakeT = 0.25;
  if(Game.hearts<=0) endGame();
}

/* combo pop text */
function popText(text, worldPos, color){
  const v = worldPos.clone().project(camera);
  const x = (v.x*0.5+0.5)*window.innerWidth;
  const y = (-v.y*0.5+0.5)*window.innerHeight;
  const el = document.createElement('div');
  el.className='combo-pop'; el.textContent=text; el.style.left=x+'px'; el.style.top=y+'px'; el.style.color=color||'';
  document.getElementById('app').appendChild(el);
  setTimeout(()=>el.remove(), 720);
}

/* ---------------- SPAWNING LOGIC ---------------- */
function tier(){ return Game.distance<150?0 : Game.distance<400?1 : 2; }
function pickObstacleType(){
  const r = Math.random(); const t = tier();
  if(t===0){ return r<0.40?'jumpBar': r<0.70?'duckBar': r<0.90?'droneBlock':'wallFull'; }
  if(t===1){ return r<0.25?'jumpBar': r<0.50?'duckBar': r<0.75?'droneBlock': r<0.90?'wallFull':'ceilSpike'; }
  return r<0.20?'jumpBar': r<0.40?'duckBar': r<0.65?'droneBlock': r<0.80?'wallFull':'ceilSpike';
}
function updateSpawning(dt){
  Game.obsTimer -= dt; Game.colTimer -= dt;
  const obsInterval = Math.max(0.85, 1.7 - Game.distance/900);
  const colInterval = Math.max(0.9, 1.5 - Game.distance/1200);
  if(Game.obsTimer<=0){
    Game.obsTimer = obsInterval + Math.random()*0.4;
    const type = pickObstacleType();
    const lane = Math.floor(Math.random()*3);
    spawnObstacle(type, lane, SPAWN_FAR_Z);
  }
  if(Game.colTimer<=0){
    Game.colTimer = colInterval + Math.random()*0.5;
    const high = Math.random()<0.35;
    const pattern = Math.random();
    if(pattern<0.7){
      const lanes = Math.random()<0.5 ? [0,1,2] : [Math.floor(Math.random()*3)];
      lanes.forEach(l=> spawnCollectible('orb', l, SPAWN_FAR_Z-Math.random()*4, high) );
    } else if(pattern<0.87){
      spawnCollectible('ammo', Math.floor(Math.random()*3), SPAWN_FAR_Z, false);
    } else {
      spawnCollectible('grav', Math.floor(Math.random()*3), SPAWN_FAR_Z, false);
    }
  }
}

/* ---------------- UPDATE LOOP ---------------- */
let shakeT = 0;
let lastT = performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now-lastT)/1000); lastT = now;

  if(Game.state==='playing') update(dt);
  render(dt);
}

function update(dt){
  Game.distance += Game.speed*dt;
  Game.score += Game.speed*dt*Game.board.scoreMult;
  Game.speed = (BASE_SPEED + Math.min(Game.distance/45, MAX_SPEED_BONUS)) * Game.board.speed;

  if(Game.invulnT>0) Game.invulnT-=dt;
  if(Game.shootCD>0) Game.shootCD-=dt;
  if(shakeT>0) shakeT-=dt;

  /* lane lerp */
  const targetX = LANES[Game.laneIdx];
  Game.laneX += (targetX-Game.laneX) * Math.min(1, dt*8*Game.board.handling);

  /* tilt control overrides lane target softly */
  if(SAVE.settings.control==='tilt'){
    tiltCooldown -= dt;
    const sens = SAVE.settings.gravSens/100;
    const g = tiltGamma*sens;
    if(tiltCooldown<=0){
      if(g < -13 && Game.laneIdx>0){ changeLane(-1); tiltCooldown=0.32; }
      else if(g > 13 && Game.laneIdx<2){ changeLane(1); tiltCooldown=0.32; }
    }
  }

  /* jump */
  if(Game.jumping){
    Game.jumpT += dt;
    if(Game.jumpT>=JUMP_DUR){ Game.jumping=false; }
  }
  /* slide */
  if(Game.sliding){
    Game.slideT += dt;
    if(Game.slideT>=SLIDE_DUR){ Game.sliding=false; }
  }

  /* gravity meter */
  if(Game.flying){
    Game.gravMeter -= dt * (16/Game.board.gravity);
    if(Game.gravMeter<=0){ Game.gravMeter=0; setFlying(false); }
  } else {
    Game.gravMeter = Math.min(100, Game.gravMeter + dt*9);
  }
  Game.flyT += (Game.flying?1:-1)*dt/FLY_TRANSITION;
  Game.flyT = Math.max(0, Math.min(1, Game.flyT));

  /* ammo regen */
  if(Game.ammo < Game.ammoMax) Game.ammo = Math.min(Game.ammoMax, Game.ammo + dt*Game.gun.ammoRegen*0.1);

  updateSpawning(dt);
  scrollWorld(dt);
  updateFlyingVehicles(dt);
  updatePlayerVisual(dt);
  updateProjectiles(dt);
  updateObstacles(dt);
  updateCollectibles(dt);
  updateTrail(dt);
  updateEnvironment(dt);
  updateHud();
}


function scrollWorld(dt){
  const d = Game.speed*dt;
  segments.forEach(g=>{ g.position.z += d; if(g.position.z > RECYCLE_Z){ g.position.z -= NUM_SEGMENTS*SEG_LEN; } });
  skylinePieces.forEach(b=>{ b.position.z += d; if(b.position.z > 14){ b.position.z -= 14*9; b.position.x = (b.position.x>0?1:-1)*(TUNNEL_W/2+3+Math.random()*5); } });
  pedestrians.forEach(p=>{ p.position.z += d; if(p.position.z > 14){ p.position.z -= 6*13; } });
  activeObstacles.forEach(o=>{ o.mesh.position.z += d; if(o.mesh.userData.spin) o.mesh.rotation.y += dt*o.mesh.userData.spin; });
  activeCollectibles.forEach(c=>{ c.mesh.position.z += d; c.mesh.rotation.y += dt*2.2; });
  trailPool.forEach(t=>{ if(t.mesh.visible) t.mesh.position.z += d; });

  // recycle obstacles/collectibles
  activeObstacles = activeObstacles.filter(o=>{
    if(o.mesh.position.z > RECYCLE_Z){ world.remove(o.mesh); return false; }
    return true;
  });
  activeCollectibles = activeCollectibles.filter(c=>{
    if(c.mesh.position.z > RECYCLE_Z || c.picked){ world.remove(c.mesh); return false; }
    return true;
  });
}

function updateFlyingVehicles(dt){
  const d = Game.speed*dt;
  flyingVehicles.forEach(v=>{
    v.position.z += d*0.5 + v.userData.ownSpeed*dt;
    v.position.x += v.userData.driftSpeed*dt;
    v.userData.bobPhase += dt;
    v.position.y += Math.sin(v.userData.bobPhase*1.2)*0.003;
    if(v.position.z > 25 || Math.abs(v.position.x) > 28){
      v.position.z = -120 - Math.random()*40;
      v.position.x = (Math.random()-0.5)*26;
      v.position.y = TUNNEL_H+5+Math.random()*9;
      v.userData.driftSpeed = (Math.random()-0.5)*2.4;
      v.userData.ownSpeed = 4+Math.random()*8;
      v.rotation.y = Math.random()*Math.PI*2;
    }
  });
}

function updateEnvironment(dt){
  const t = performance.now()/1000;
  pedestrians.forEach(p=>{
    const ph = p.userData.phase + t*1.6;
    p.userData.armL.rotation.x = Math.sin(ph)*0.25;
    p.userData.armR.rotation.x = -Math.sin(ph)*0.25;
  });
  archLights.forEach((m,i)=>{
    const k = 0.5+0.5*Math.sin(t*2.4 + i*1.3);
    m.material.color.setRGB(1, 0.13+0.4*k, 0.4+0.3*k);
  });
}

const PROJ_SPEED = 42;
function updateProjectiles(dt){
  const d = Game.speed*dt;
  projPool.forEach(p=>{
    if(!p.active) return;
    p.mesh.position.z += d - PROJ_SPEED*dt;
    p.range -= PROJ_SPEED*dt;
    if(p.range<=0){ p.active=false; p.mesh.visible=false; return; }
    // collision vs drones
    for(const o of activeObstacles){
      if(o.destroyed || o.type!=='droneBlock') continue;
      const sameLane = p.splash ? Math.abs(o.lane-p.lane)<=1 : o.lane===p.lane;
      if(sameLane && Math.abs(o.mesh.position.z - p.mesh.position.z) < 0.7){
        destroyDrone(o);
        if(!p.pierce && !p.splash){ p.active=false; p.mesh.visible=false; break; }
      }
    }
  });
}
function destroyDrone(o){
  o.destroyed = true; o.resolved = true;
  o.mesh.visible = false;
  Game.dronesDestroyed++;
  Game.score += 75; Game.creditsRun += 3;
  Audio_.sfx('destroy');
  popText('+75', o.mesh.position, '#ff5577');
}

function updateObstacles(dt){
  activeObstacles.forEach(o=>{
    if(o.resolved || o.destroyed) return;
    const z = o.mesh.position.z;
    if(Math.abs(z-PLAYER_Z) < HIT_BAND && o.lane===Game.laneIdx){
      const dangerous = o.zone==='both' || (o.zone==='floor' && !Game.flying) || (o.zone==='ceiling' && Game.flying);
      if(!dangerous){ o.resolved=true; return; }
      let avoided = false;
      if(o.type==='jumpBar' && Game.jumping && Game.jumpT>0.12 && Game.jumpT<JUMP_DUR-0.08) avoided=true;
      if(o.type==='duckBar' && Game.sliding) avoided=true;
      o.resolved = true;
      if(!avoided) loseHeart();
    }
  });
}
function updateCollectibles(dt){
  activeCollectibles.forEach(c=>{
    if(c.picked) return;
    const z = c.mesh.position.z;
    if(Math.abs(z-PLAYER_Z) < PICK_BAND && c.lane===Game.laneIdx && c.high===Game.flying){
      c.picked = true;
      if(c.type==='orb'){ Game.score+=25; Game.creditsRun+=1; Game.orbsCollected++; Audio_.sfx('collect'); popText('+25', c.mesh.position, '#0ad8ff'); }
      if(c.type==='ammo'){ Game.ammo = Math.min(Game.ammoMax, Game.ammo+2); Audio_.sfx('ammo'); popText('+AMMO', c.mesh.position, '#ffb020'); }
      if(c.type==='grav'){ Game.gravMeter = Math.min(100, Game.gravMeter+35); Audio_.sfx('ammo'); popText('+GRAV', c.mesh.position, '#39ff8c'); }
    }
  });
}

function updatePlayerVisual(dt){
  player.position.x = Game.laneX;
  const flyEase = Game.flyT*Game.flyT*(3-2*Game.flyT);
  let baseY = FLOOR_RIDE_Y + (FLY_RIDE_Y-FLOOR_RIDE_Y)*flyEase;
  let jumpOff = 0;
  if(Game.jumping){ jumpOff = Math.sin(Math.PI*Math.min(1,Game.jumpT/JUMP_DUR))*JUMP_HEIGHT; }
  let slideScale = 1;
  if(Game.sliding){ slideScale = 0.5; }
  player.position.y = baseY + jumpOff;
  bodyGroup.scale.y = slideScale;
  bodyGroup.position.y = (1-slideScale)*-0.05;
  const t = performance.now()/1000;
  const bob = Game.flying?0: Math.sin(t*Game.speed*1.6)*0.05;
  boardGroup.position.y = bob*0.4;
  wheels.forEach(w=> w.rotation.x += dt*Game.speed*3 );
  legL.rotation.x = Math.sin(t*Game.speed*2.0)*0.5;
  legR.rotation.x = -Math.sin(t*Game.speed*2.0)*0.5;
  armL.rotation.x = -Math.sin(t*Game.speed*2.0)*0.4;
  armR.rotation.x = Math.sin(t*Game.speed*2.0)*0.4;
  player.rotation.z = (LANES[Game.laneIdx]-Game.laneX)*0.18;
  thrusterMat.opacity = flyEase*0.85;

  // invulnerability blink
  player.visible = Game.invulnT>0 ? (Math.floor(t*14)%2===0) : true;

  // camera
  const camYBase = 2.55 + flyEase*1.3;
  camera.position.x += (Game.laneX*0.4 - camera.position.x)*Math.min(1,dt*4);
  camera.position.y += (camYBase - camera.position.y)*Math.min(1,dt*4);
  let shakeX=0, shakeY=0;
  if(shakeT>0){ shakeX=(Math.random()-0.5)*0.12*shakeT*4; shakeY=(Math.random()-0.5)*0.08*shakeT*4; }
  camera.position.z = 6.6 - flyEase*0.4;
  camera.lookAt(Game.laneX*0.6+shakeX, 1.25+flyEase*0.6+shakeY, -10);
}

function updateTrail(dt){
  trailTimer -= dt;
  if(trailTimer<=0 && Game.state==='playing'){
    trailTimer = 0.045;
    const slot = trailPool.find(t=>!t.mesh.visible) || trailPool[0];
    slot.mesh.visible = true; slot.life = 0.5;
    slot.mesh.position.set(player.position.x, player.position.y-0.1, player.position.z+0.7);
    slot.mesh.material.opacity = 0.45;
    slot.mesh.material.color.setHex(Game.flying?0x39ff8c:Game.board.colorTrim);
  }
  trailPool.forEach(t=>{
    if(!t.mesh.visible) return;
    t.life -= dt;
    t.mesh.material.opacity = Math.max(0, t.life*0.9);
    t.mesh.scale.x = 1 + (0.5-t.life)*0.6;
    if(t.life<=0) t.mesh.visible=false;
  });
}

function updateHud(){
  document.getElementById('hudScore').textContent = Math.floor(Game.score);
  const hearts = document.querySelectorAll('#hudHearts .heart');
  hearts.forEach((h,i)=> h.classList.toggle('lost', i>=Game.hearts) );
  document.getElementById('gravMeterFill').style.width = Game.gravMeter+'%';
  document.getElementById('ammoLine').textContent = 'AMMO ' + Math.floor(Game.ammo) + '/' + Game.ammoMax;
}

function render(dt){
  magentaPoint.position.z = player.position.z+2;
  renderer.render(scene, camera);
}

/* ---------------- PWA SERVICE WORKER ---------------- */
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}

/* ---------------- BOOT ---------------- */
function boot(){
  let p = 0;
  const fill = document.getElementById('loaderFill');
  const iv = setInterval(()=>{
    p += 18 + Math.random()*22;
    fill.style.width = Math.min(100,p)+'%';
    if(p>=100){
      clearInterval(iv);
      document.getElementById('loadingScreen').classList.add('hidden');
      Game.state='menu';
      showScreen('mainMenu');
    }
  }, 90);
}
boot();
requestAnimationFrame(frame);
})();