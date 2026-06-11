'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Header from '@/components/Header';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Paintbrush, Eraser, Download, RotateCcw, Undo2, ChevronDown, AlertTriangle, Minus, Plus, Droplets, Wind, Square, Circle, Slash, LayoutGrid } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { extractFilenames, extractFromFilename } from '@/lib/rpfParser';
import { detectWeaponFromFilenames } from '@/lib/weapons';

const WEAPONS = [
  // Pistolas
  { id: 'w_pi_combatpistol',    name: 'Combat Pistol',       cat: 'Pistola'  },
  { id: 'w_pi_pistol',          name: 'Pistol',              cat: 'Pistola'  },
  { id: 'w_pi_pistolmk2',       name: 'Pistol Mk II',        cat: 'Pistola'  },
  { id: 'w_pi_appistol',        name: 'AP Pistol',           cat: 'Pistola'  },
  { id: 'w_pi_heavypistol',     name: 'Heavy Pistol',        cat: 'Pistola'  },
  { id: 'w_pi_vintage_pistol',  name: 'Vintage Pistol',      cat: 'Pistola'  },
  // SMG
  { id: 'w_sb_microsmg',        name: 'Micro SMG',           cat: 'SMG'      },
  { id: 'w_sb_smg',             name: 'SMG',                 cat: 'SMG'      },
  { id: 'w_sb_assaultsmg',      name: 'Assault SMG',         cat: 'SMG'      },
  { id: 'w_sb_smgmk2',          name: 'SMG Mk II',           cat: 'SMG'      },
  // Rifles
  { id: 'w_ar_assaultrifle',    name: 'Assault Rifle',       cat: 'Rifle'    },
  { id: 'w_ar_assaultriflemk2', name: 'Assault Rifle Mk II', cat: 'Rifle'    },
  { id: 'w_ar_carbinerifle',    name: 'Carbine Rifle',       cat: 'Rifle'    },
  { id: 'w_ar_carbineriflemk2', name: 'Carbine Rifle Mk II', cat: 'Rifle'    },
  { id: 'w_ar_advancedrifle',   name: 'Advanced Rifle',      cat: 'Rifle'    },
  { id: 'w_ar_specialcarbine',  name: 'Special Carbine',     cat: 'Rifle'    },
  { id: 'w_ar_bullpuprifle',    name: 'Bullpup Rifle',       cat: 'Rifle'    },
  // MG
  { id: 'w_mg_combatmg',        name: 'Combat MG',           cat: 'MG'       },
  { id: 'w_mg_combatmgmk2',     name: 'Combat MG Mk II',     cat: 'MG'       },
  { id: 'w_mg_mg',              name: 'MG',                  cat: 'MG'       },
  { id: 'w_mg_minigun',         name: 'Minigun',             cat: 'MG'       },
  // Escopetas
  { id: 'w_sg_pumpshotgun',     name: 'Pump Shotgun',        cat: 'Escopeta' },
  { id: 'w_sg_assaultshotgun',  name: 'Assault Shotgun',     cat: 'Escopeta' },
  { id: 'w_sg_bullpupshotgun',  name: 'Bullpup Shotgun',     cat: 'Escopeta' },
  { id: 'w_sg_heavyshotgun',    name: 'Heavy Shotgun',       cat: 'Escopeta' },
  { id: 'w_sg_sawnoff',         name: 'Sawed-Off Shotgun',   cat: 'Escopeta' },
  // Sniper
  { id: 'w_sr_sniperrifle',     name: 'Sniper Rifle',        cat: 'Sniper'   },
  { id: 'w_sr_heavysniper',     name: 'Heavy Sniper',        cat: 'Sniper'   },
  { id: 'w_sr_heavysnipermk2',  name: 'Heavy Sniper Mk II',  cat: 'Sniper'   },
  { id: 'w_sr_marksmanrifle',   name: 'Marksman Rifle',      cat: 'Sniper'   },
  // Heavy
  { id: 'w_lr_rpg',             name: 'RPG',                 cat: 'Heavy'    },
  { id: 'w_lr_grenadelauncher', name: 'Grenade Launcher',    cat: 'Heavy'    },
];

// Suppressor mapping: weapon prefix → available suppressor models
const SUPP_MAP = {
  'w_pi_': ['w_at_pi_supp',   'w_at_pi_supp_2'],
  'w_sb_': ['w_at_ar_supp',   'w_at_ar_supp_02'],
  'w_ar_': ['w_at_ar_supp',   'w_at_ar_supp_02'],
  'w_sr_': ['w_at_sr_supp',   'w_at_sr_supp_2'],
};

function getSuppOptions(weaponId) {
  for (const [prefix, opts] of Object.entries(SUPP_MAP)) {
    if (weaponId.startsWith(prefix)) return opts;
  }
  return null; // no suppressor for this category
}

const SWATCHES      = ['#ffffff','#000000','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#78716c'];
const MATTE_COLORS  = ['#1a1a1a','#2e2e2e','#4a4a4a','#6e6e6e','#8c1515','#1a4a1a','#1a2a4a','#4a2a0a','#2d3a15','#7a5c3a'];
const NEON_COLORS   = ['#ff0033','#ff6600','#ffff00','#00ff88','#00ffff','#0066ff','#cc00ff','#ff00aa','#ff4400','#88ff00'];
const TEX = 1024;
const SUPP_W = 1024, SUPP_H = 256;

// Creates a small repeatable tile canvas for use as a pattern brush
function createPatternTile(patType, col) {
  const S = 100;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  
  if (patType === 'tiger') {
    ctx.fillStyle = '#c07018'; ctx.fillRect(0,0,S,S); ctx.fillStyle = '#0a0a0a';
    for (let i=-S; i<S*2; i+=50) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i+20,0); ctx.lineTo(i+20+S,S); ctx.lineTo(i+S,S); ctx.closePath(); ctx.fill(); }
  } else if (patType === 'camo') {
    ctx.fillStyle='#3a5a22'; ctx.fillRect(0,0,S,S);
    ['#1a2a10','#5a7a30','#2a3a18','#8a9a50'].forEach((bc,i)=>{ ctx.fillStyle=bc; ctx.beginPath(); ctx.ellipse((i%2?25:75),(i<2?30:70),18+i*4,(12+i*3),i*0.7,0,Math.PI*2); ctx.fill(); });
  } else if (patType === 'camo_desert') {
    ctx.fillStyle='#d2b48c'; ctx.fillRect(0,0,S,S);
    ['#8b5a2b','#cd853f','#f4a460','#a0522d'].forEach((bc,i)=>{ ctx.fillStyle=bc; ctx.beginPath(); ctx.ellipse((i%2?30:80),(i<2?20:60),20+i*3,(15+i*4),i*1.2,0,Math.PI*2); ctx.fill(); });
  } else if (patType === 'camo_winter') {
    ctx.fillStyle='#e0e0e0'; ctx.fillRect(0,0,S,S);
    ['#ffffff','#a0a0a0','#b0c4de','#708090'].forEach((bc,i)=>{ ctx.fillStyle=bc; ctx.beginPath(); ctx.ellipse((i%2?40:90),(i<2?40:80),15+i*5,(20+i*2),i*0.5,0,Math.PI*2); ctx.fill(); });
  } else if (patType === 'camo_digital') {
    ctx.fillStyle='#4b5320'; ctx.fillRect(0,0,S,S);
    const cols = ['#2e3b32','#708238','#3b4d28'];
    for(let i=0;i<40;i++) { ctx.fillStyle=cols[i%cols.length]; ctx.fillRect(Math.random()*S, Math.random()*S, 10 + Math.random()*10, 10 + Math.random()*10); }
  } else if (patType === 'leopard') {
    ctx.fillStyle='#f5deb3'; ctx.fillRect(0,0,S,S);
    for(let i=0;i<12;i++) { 
      const x=Math.random()*S, y=Math.random()*S;
      ctx.fillStyle='#d2691e'; ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#000'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*1.5); ctx.stroke();
    }
  } else if (patType === 'zebra') {
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,S,S); ctx.fillStyle='#000';
    for(let y=0;y<S;y+=25) { ctx.beginPath(); ctx.moveTo(0,y); ctx.quadraticCurveTo(S/2,y+15,S,y); ctx.lineTo(S,y+8); ctx.quadraticCurveTo(S/2,y+23,0,y+8); ctx.fill(); }
  } else if (patType === 'galaxy') {
    const gr=ctx.createLinearGradient(0,0,S,S); gr.addColorStop(0,'#0b001a'); gr.addColorStop(0.5,'#1a0033'); gr.addColorStop(1,'#001133');
    ctx.fillStyle=gr; ctx.fillRect(0,0,S,S);
    for(let i=0;i<30;i++) { ctx.fillStyle='#fff'; ctx.globalAlpha=Math.random(); ctx.beginPath(); ctx.arc(Math.random()*S,Math.random()*S,Math.random()*1.5,0,Math.PI*2); ctx.fill(); }
    ctx.globalAlpha=0.3; ctx.fillStyle='#ff00ff'; ctx.beginPath(); ctx.arc(S*0.3,S*0.7,30,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#00ffff'; ctx.beginPath(); ctx.arc(S*0.8,S*0.2,40,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  } else if (patType === 'stripes_h') {
    for (let y=0; y<S; y+=20) { ctx.fillStyle=(Math.floor(y/20)%2===0)?col:'#000000'; ctx.fillRect(0,y,S,20); }
  } else if (patType === 'stripes_v') {
    for (let x=0; x<S; x+=20) { ctx.fillStyle=(Math.floor(x/20)%2===0)?col:'#000000'; ctx.fillRect(x,0,20,S); }
  } else if (patType === 'stripes_d') {
    ctx.fillStyle='#000'; ctx.fillRect(0,0,S,S); ctx.fillStyle=col;
    for (let i=-S; i<S*2; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i+18,0); ctx.lineTo(i+18+S,S); ctx.lineTo(i+S,S); ctx.closePath(); ctx.fill(); }
  } else if (patType === 'crosshatch') {
    ctx.fillStyle='#000'; ctx.fillRect(0,0,S,S); ctx.strokeStyle=col; ctx.lineWidth=2;
    for (let i=-S; i<S*2; i+=15) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i+S,S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i+S,0); ctx.lineTo(i,S); ctx.stroke(); }
  } else if (patType === 'carbon') {
    const g=10; ctx.fillStyle='#111'; ctx.fillRect(0,0,S,S);
    for (let x=0;x<S;x+=g) for (let y=0;y<S;y+=g) {
      const off=((Math.floor(x/g)+Math.floor(y/g))%2)*g/2;
      const gr=ctx.createLinearGradient(x,y+off,x+g,y+off+g/2);
      gr.addColorStop(0,'#333'); gr.addColorStop(0.5,'#1e1e1e'); gr.addColorStop(1,'#2a2a2a'); ctx.fillStyle=gr; ctx.fillRect(x,y+off,g,g/2);
    }
  } else if (patType === 'dots') {
    ctx.fillStyle='#111'; ctx.fillRect(0,0,S,S); ctx.fillStyle=col; ctx.beginPath(); ctx.arc(S/2,S/2,10,0,Math.PI*2); ctx.fill();
  } else if (patType === 'hex') {
    ctx.fillStyle='#0a0a0a'; ctx.fillRect(0,0,S,S); ctx.strokeStyle=col; ctx.lineWidth=2; const R=18;
    for (let row=0;row<3;row++) for (let col2=0;col2<3;col2++) {
      const hx=col2*R*Math.sqrt(3)+(row%2)*R*Math.sqrt(3)/2, hy=row*R*1.5;
      ctx.beginPath(); for (let a=0;a<6;a++){const ang=Math.PI/180*(60*a-30);a===0?ctx.moveTo(hx+R*Math.cos(ang),hy+R*Math.sin(ang)):ctx.lineTo(hx+R*Math.cos(ang),hy+R*Math.sin(ang));}
      ctx.closePath(); ctx.stroke();
    }
  } else if (patType === 'grid') {
    ctx.fillStyle='#000'; ctx.fillRect(0,0,S,S); ctx.strokeStyle=col; ctx.lineWidth=1;
    for(let i=0;i<=S;i+=10){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(S,i); ctx.stroke(); }
  } else if (patType === 'zig_zag') {
    ctx.fillStyle='#000'; ctx.fillRect(0,0,S,S); ctx.strokeStyle=col; ctx.lineWidth=4;
    for(let y=10;y<=S+10;y+=20){ ctx.beginPath(); ctx.moveTo(0,y); for(let x=0;x<=S;x+=10){ ctx.lineTo(x, y + (x%20===0?-10:10)); } ctx.stroke(); }
  } else if (patType === 'waves') {
    ctx.fillStyle='#000'; ctx.fillRect(0,0,S,S); ctx.strokeStyle=col; ctx.lineWidth=3;
    for(let y=10;y<=S+10;y+=20){ ctx.beginPath(); ctx.moveTo(0,y); for(let x=0;x<=S;x+=20){ ctx.quadraticCurveTo(x+10,y-15,x+20,y); } ctx.stroke(); }
  } else if (patType === 'bricks') {
    ctx.fillStyle='#8b0000'; ctx.fillRect(0,0,S,S); ctx.strokeStyle='#d3d3d3'; ctx.lineWidth=2;
    for(let y=0;y<=S;y+=20){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(S,y); ctx.stroke(); const off=(y/20)%2===0?0:25; for(let x=off;x<=S;x+=50){ ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+20); ctx.stroke(); } }
  } else if (patType === 'scales') {
    ctx.fillStyle='#000'; ctx.fillRect(0,0,S,S); ctx.strokeStyle=col; ctx.lineWidth=2;
    for(let y=0;y<=S+20;y+=15){ const off=(y/15)%2===0?0:15; for(let x=off-15;x<=S;x+=30){ ctx.beginPath(); ctx.arc(x+15,y,15,0,Math.PI); ctx.stroke(); } }
  } else if (patType === 'stars') {
    ctx.fillStyle='#000'; ctx.fillRect(0,0,S,S); ctx.fillStyle=col;
    const drawStar = (cx,cy,spikes,outerRadius,innerRadius) => {
      let rot=Math.PI/2*3, x=cx, y=cy, step=Math.PI/spikes; ctx.beginPath(); ctx.moveTo(cx,cy-outerRadius);
      for(let i=0;i<spikes;i++){ x=cx+Math.cos(rot)*outerRadius; y=cy+Math.sin(rot)*outerRadius; ctx.lineTo(x,y); rot+=step; x=cx+Math.cos(rot)*innerRadius; y=cy+Math.sin(rot)*innerRadius; ctx.lineTo(x,y); rot+=step; }
      ctx.lineTo(cx,cy-outerRadius); ctx.closePath(); ctx.fill();
    };
    drawStar(25,25,5,15,7); drawStar(75,75,5,15,7); drawStar(25,75,5,8,4); drawStar(75,25,5,8,4);
  } else if (patType === 'hearts') {
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,S,S); ctx.fillStyle=col;
    const drawHeart = (x,y,w,h) => { ctx.save(); ctx.translate(x,y); ctx.beginPath(); ctx.moveTo(0,h/4); ctx.quadraticCurveTo(0,0,w/4,0); ctx.quadraticCurveTo(w/2,0,w/2,h/4); ctx.quadraticCurveTo(w/2,0,w*3/4,0); ctx.quadraticCurveTo(w,0,w,h/4); ctx.quadraticCurveTo(w,h/2,w/2,h); ctx.quadraticCurveTo(0,h/2,0,h/4); ctx.fill(); ctx.restore(); };
    drawHeart(10,10,30,30); drawHeart(60,60,30,30);
  } else if (patType === 'checkers') {
    for (let x=0;x<S;x+=25) for (let y=0;y<S;y+=25) { ctx.fillStyle=((x/25+y/25)%2===0)?col:'#000'; ctx.fillRect(x,y,25,25); }
  } else if (patType === 'circuit') {
    ctx.fillStyle='#002200'; ctx.fillRect(0,0,S,S); ctx.strokeStyle=col; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(10,10); ctx.lineTo(40,10); ctx.lineTo(60,30); ctx.lineTo(90,30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10,90); ctx.lineTo(30,70); ctx.lineTo(30,40); ctx.lineTo(60,10); ctx.stroke();
    ctx.fillStyle=col; ctx.beginPath(); ctx.arc(10,10,4,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(90,30,4,0,Math.PI*2); ctx.fill();
  } else if (patType === 'wood') {
    ctx.fillStyle='#8b5a2b'; ctx.fillRect(0,0,S,S); ctx.strokeStyle='#5c3a21'; ctx.lineWidth=2;
    for(let y=5;y<S;y+=15){ ctx.beginPath(); ctx.moveTo(0,y); for(let x=0;x<=S;x+=10){ ctx.lineTo(x, y+Math.sin(x/10)*5); } ctx.stroke(); }
  } else if (patType === 'marble') {
    ctx.fillStyle='#f0f0f0'; ctx.fillRect(0,0,S,S); ctx.strokeStyle='#d0d0d0'; ctx.lineWidth=2;
    for(let i=0;i<5;i++){ ctx.beginPath(); ctx.moveTo(Math.random()*S,0); for(let y=0;y<=S;y+=20){ ctx.lineTo(Math.random()*S, y); } ctx.stroke(); }
  } else if (patType === 'splatter') {
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,S,S); ctx.fillStyle=col;
    for(let i=0;i<40;i++) { ctx.beginPath(); ctx.arc(Math.random()*S,Math.random()*S,Math.random()*5,0,Math.PI*2); ctx.fill(); }
  } else if (patType === 'gradient') {
    const gr=ctx.createLinearGradient(0,0,S,S); gr.addColorStop(0,col); gr.addColorStop(1,'#000000'); ctx.fillStyle=gr; ctx.fillRect(0,0,S,S);
  }
  return c;
}

export default function SkinForge3D() {
  const mountRef   = useRef(null);
  const rendRef    = useRef(null);
  const sceneRef   = useRef(null);
  const camRef     = useRef(null);
  const ctrlRef    = useRef(null);
  const meshRef    = useRef(null);
  const tcRef      = useRef(null);  // paint canvas (Three.js texture source)
  const ttRef      = useRef(null);  // THREE.CanvasTexture
  const baseRef    = useRef(null);  // base Image
  const uv2DRef    = useRef(null);  // display canvas for 2D UV mode
  const dropBtnRef = useRef(null);  // weapon selector button ref
  const paintRef       = useRef(false);
  const lastUVRef      = useRef(null);
  const historyRef     = useRef([]);
  const shapeStartRef  = useRef(null);   // {x,y} UV coords where shape drag began
  const shapeSnapRef   = useRef(null);   // ImageData snapshot before shape preview

  const [weapon,      setWeapon]    = useState(WEAPONS[0]);
  const [tool,        setTool]      = useState('brush');
  const [color,       setColor]     = useState('#ef4444');
  const [size,        setSize]      = useState(50);
  const [opacity,     setOpacity]   = useState(90);
  const [mode,        setMode]      = useState('paint');  // 'paint' | 'rotate' (3D only)
  const [viewMode,    setViewMode]  = useState('3d');     // '3d' | '2d'
  const [colorTab,    setColorTab]  = useState('palette'); // 'palette'|'matte'|'neon'
  const [patternType, setPatternType] = useState('tiger');
  const [shapeFilled, setShapeFilled] = useState(false);
  const [dropOpen,  setDropOpen]  = useState(false);
  const [dropPos,   setDropPos]   = useState({ top: 0, left: 0 });
  const [loading,   setLoading]   = useState(true);
  const [hasModel,  setHasModel]  = useState(false);
  const [status,    setStatus]    = useState('Cargando...');
  const [exporting, setExporting] = useState(false);

  // Custom weapon upload state (OBJ)
  const customObjInputRef  = useRef(null);
  const customPngInputRef  = useRef(null);
  const [customModalOpen,  setCustomModalOpen]  = useState(false);
  const [customObjFile,    setCustomObjFile]    = useState(null);
  const [customPngFile,    setCustomPngFile]    = useState(null);
  const [customWeaponName, setCustomWeaponName] = useState('');

  // RPF custom upload state
  const rpfInputRef           = useRef(null);
  const [rpfModalOpen,        setRpfModalOpen]     = useState(false);
  const [rpfFile,             setRpfFile]          = useState(null);
  const [rpfDetected,         setRpfDetected]      = useState(null); // { id, name } or null
  const [rpfCustomName,       setRpfCustomName]    = useState('');
  const [rpfParsing,          setRpfParsing]       = useState(false);
  const [rpfParseError,       setRpfParseError]    = useState('');
  // Persisted across modal close so exportRPF can use them
  const customRpfFileRef      = useRef(null); // the original File object
  const customRpfWeaponIdRef  = useRef(null); // base weapon id detected (e.g. 'w_pi_combatpistol')
  const customRpfNameRef      = useRef(null); // display name (for ZIP filename)
  const customRpfYtdNameRef   = useRef(null); // actual YTD name found inside the RPF

  // Suppressor state
  const suppCanvasRef  = useRef(null);
  const suppPaintRef   = useRef(false);
  const suppMesh3DRef  = useRef(null);
  const suppTt3DRef    = useRef(null);
  const [suppEnabled,  setSuppEnabled]  = useState(false);
  const [suppStyle,    setSuppStyle]    = useState(0);    // 0 or 1
  const [suppColor,    setSuppColor]    = useState('#888888');
  const [suppPainted,  setSuppPainted]  = useState(false);
  const [weaponPainted, setWeaponPainted] = useState(false);
  const [paintTarget,  setPaintTarget]  = useState('weapon');

  // Sticker state
  const stickerImgRef      = useRef(null);
  const stickerPlaneMeshRef= useRef(null);   // THREE.Mesh plane preview in scene
  const stickerHitRef      = useRef(null);   // last raycast hit {uv, point, face, object}
  const stickerDraggingRef = useRef(false);
  const stickerInputRef    = useRef(null);
  const [stickerSrc,       setStickerSrc]      = useState(null);
  const [stickerScale,     setStickerScale]    = useState(0.15);  // fraction of weapon length
  const [stickerRotation,  setStickerRotation] = useState(0);     // degrees, around normal
  const [stickerActive,    setStickerActive]   = useState(false);

  // ---- THREE.JS INIT ----
  useEffect(() => {
    const el = mountRef.current; if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);
    rendRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0d0d);
    sceneRef.current = scene;

    const grid = new THREE.GridHelper(2, 30, 0x2a2a2a, 0x1a1a1a);
    grid.position.y = -0.12;
    scene.add(grid);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.9); d1.position.set(2,3,2); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0x6688ff, 0.3); d2.position.set(-2,-1,-2); scene.add(d2);

    const cam = new THREE.PerspectiveCamera(45, el.clientWidth/el.clientHeight, 0.001, 100);
    cam.position.set(0, 0.04, 0.32);
    camRef.current = cam;

    const ctrl = new OrbitControls(cam, renderer.domElement);
    ctrl.enableDamping = true; ctrl.dampingFactor = 0.08;
    ctrl.minDistance = 0.05; ctrl.maxDistance = 3;
    ctrl.enabled = false;
    ctrlRef.current = ctrl;

    const tc = document.createElement('canvas');
    tc.width = TEX; tc.height = TEX;
    tcRef.current = tc;

    let raf;
    const animate = () => { raf = requestAnimationFrame(animate); ctrl.update(); renderer.render(scene, cam); };
    animate();

    let resizeTimeout;
    const resizeObserver = new ResizeObserver(entries => {
      cancelAnimationFrame(resizeTimeout);
      resizeTimeout = requestAnimationFrame(() => {
        for (let entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            renderer.setSize(width, height);
            cam.aspect = width / height;
            cam.updateProjectionMatrix();
          }
        }
      });
    });
    resizeObserver.observe(el);

    return () => { 
      resizeObserver.disconnect();
      cancelAnimationFrame(resizeTimeout);
      cancelAnimationFrame(raf); 
      renderer.dispose(); 
      el.innerHTML=''; 
    };
  }, []);

  // ---- 2D CANVAS SYNC ----
  const syncUV2D = useCallback(() => {
    const display = uv2DRef.current;
    const source  = tcRef.current;
    if (!display || !source) return;
    display.getContext('2d').drawImage(source, 0, 0);
  }, []);

  useEffect(() => { if (viewMode === '2d') syncUV2D(); }, [viewMode, syncUV2D]);

  // ---- HISTORY ----
  const saveHistory = () => {
    const tc = tcRef.current; if (!tc) return;
    const snap = tc.getContext('2d').getImageData(0, 0, TEX, TEX);
    const h = historyRef.current;
    historyRef.current = h.length >= 20 ? [...h.slice(1), snap] : [...h, snap];
  };

  const undo = useCallback(() => {
    const h = historyRef.current; if (h.length === 0) return;
    const tc = tcRef.current; const tt = ttRef.current; if (!tc || !tt) return;
    historyRef.current = h.slice(0, -1);
    tc.getContext('2d').putImageData(h[h.length - 1], 0, 0);
    tt.needsUpdate = true;
    const display = uv2DRef.current;
    if (display) display.getContext('2d').drawImage(tc, 0, 0);
  }, []);

  // ---- KEYBOARD ----
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'KeyE' && !e.repeat) setMode('rotate');
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    };
    const onKeyUp = (e) => { if (e.code === 'KeyE') setMode('paint'); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [undo]);

  useEffect(() => { if (ctrlRef.current) ctrlRef.current.enabled = (mode === 'rotate' && viewMode === '3d'); }, [mode, viewMode]);
  useEffect(() => { if (viewMode === '2d') syncUV2D(); }, [viewMode, syncUV2D]);
  useEffect(() => { loadWeapon(weapon.id); }, [weapon.id]);

  // ---- LOAD WEAPON ----
  const loadWeapon = useCallback((id) => {
    const scene = sceneRef.current; if (!scene) return;
    setLoading(true); setHasModel(false); setStatus('Cargando textura...');
    if (meshRef.current) { scene.remove(meshRef.current); meshRef.current = null; }
    historyRef.current = [];

    const tc = tcRef.current;
    const ctx = tc.getContext('2d');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      baseRef.current = img;
      ctx.clearRect(0,0,TEX,TEX);
      ctx.drawImage(img,0,0,TEX,TEX);
      syncUV2D();
      buildMesh(id, tc);
    };
    img.onerror = () => {
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(0,0,TEX,TEX);
      baseRef.current = null;
      syncUV2D();
      buildMesh(id, tc);
    };
    img.src = `/weapons/${id}.png`;
  }, [syncUV2D]);

  const buildMesh = (id, tc) => {
    const tt = new THREE.CanvasTexture(tc);
    tt.flipY = false;  // GTA5 OBJ: DX convention (V=0 at top)
    tt.colorSpace = THREE.SRGBColorSpace;
    ttRef.current = tt;

    setStatus('Cargando modelo 3D...');
    new OBJLoader().load(
      `/models/${id}.obj`,
      (obj) => {
        obj.traverse(c => {
          if (c.isMesh) {
            c.material = new THREE.MeshStandardMaterial({ map: tt, side: THREE.FrontSide, roughness: 0.55, metalness: 0.4 });
            c.geometry.computeVertexNormals();
          }
        });
        const box = new THREE.Box3().setFromObject(obj);
        obj.position.sub(box.getCenter(new THREE.Vector3()));
        sceneRef.current.add(obj);
        meshRef.current = obj;

        // Auto-fit camera to bounding sphere
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        const cam = camRef.current;
        const ctrl = ctrlRef.current;
        if (cam && ctrl) {
          const dist = sphere.radius / Math.sin((cam.fov * Math.PI / 180) / 2) * 0.85;
          cam.position.set(0, sphere.radius * 0.15, dist);
          cam.near = dist * 0.001;
          cam.far  = dist * 100;
          cam.updateProjectionMatrix();
          ctrl.minDistance = dist * 0.1;
          ctrl.maxDistance = dist * 10;
          ctrl.update();
        }

        setLoading(false); setHasModel(true);
        setStatus(id);
      },
      undefined,
      () => { setLoading(false); setStatus('Sin modelo 3D — usa modo UV 2D para pintar'); }
    );
  };

  // ---- LOAD CUSTOM WEAPON (user-supplied OBJ + optional PNG) ----
  const loadCustomWeapon = useCallback((objFile, pngFile, name) => {
    const scene = sceneRef.current; if (!scene) return;
    setLoading(true); setHasModel(false); setStatus('Cargando arma personalizada...');
    if (meshRef.current) { scene.remove(meshRef.current); meshRef.current = null; }
    historyRef.current = [];

    const tc = tcRef.current;
    const ctx = tc.getContext('2d');
    const objUrl = URL.createObjectURL(objFile);

    const doLoad = () => {
      const tt = new THREE.CanvasTexture(tc);
      tt.flipY = false;
      tt.colorSpace = THREE.SRGBColorSpace;
      ttRef.current = tt;

      setStatus('Cargando modelo 3D personalizado...');
      new OBJLoader().load(
        objUrl,
        (obj) => {
          obj.traverse(c => {
            if (c.isMesh) {
              c.material = new THREE.MeshStandardMaterial({ map: tt, side: THREE.FrontSide, roughness: 0.55, metalness: 0.4 });
              c.geometry.computeVertexNormals();
            }
          });
          const box = new THREE.Box3().setFromObject(obj);
          obj.position.sub(box.getCenter(new THREE.Vector3()));
          sceneRef.current.add(obj);
          meshRef.current = obj;

          const sphere = box.getBoundingSphere(new THREE.Sphere());
          const cam = camRef.current;
          const ctrl = ctrlRef.current;
          if (cam && ctrl) {
            const dist = sphere.radius / Math.sin((cam.fov * Math.PI / 180) / 2) * 0.85;
            cam.position.set(0, sphere.radius * 0.15, dist);
            cam.near = dist * 0.001;
            cam.far  = dist * 100;
            cam.updateProjectionMatrix();
            ctrl.minDistance = dist * 0.1;
            ctrl.maxDistance = dist * 10;
            ctrl.update();
          }

          setLoading(false); setHasModel(true);
          setStatus(`🎨 ${name || objFile.name}`);
          URL.revokeObjectURL(objUrl);
        },
        undefined,
        () => {
          setLoading(false);
          setStatus('❌ Error al cargar el OBJ — verifica que sea un archivo válido');
          URL.revokeObjectURL(objUrl);
        }
      );
    };

    if (pngFile) {
      const pngUrl = URL.createObjectURL(pngFile);
      const img = new Image();
      img.onload = () => {
        baseRef.current = img;
        ctx.clearRect(0, 0, TEX, TEX);
        ctx.drawImage(img, 0, 0, TEX, TEX);
        syncUV2D();
        URL.revokeObjectURL(pngUrl);
        doLoad();
      };
      img.onerror = () => {
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, TEX, TEX);
        baseRef.current = null;
        syncUV2D();
        URL.revokeObjectURL(pngUrl);
        doLoad();
      };
      img.src = pngUrl;
    } else {
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, TEX, TEX);
      baseRef.current = null;
      syncUV2D();
      doLoad();
    }
  }, [syncUV2D]);

  // ---- LOAD CUSTOM RPF (user-supplied RPF → 2D paint mode) ----
  const handleRpfFileSelect = useCallback(async (file) => {
    if (!file) return;
    setRpfFile(file);
    setRpfDetected(null);
    setRpfParseError('');
    setRpfParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const u8 = new Uint8Array(arrayBuffer);
      const internalNames = extractFilenames(u8);
      const filenameHints = extractFromFilename(file.name);
      const allNames = [...internalNames, ...filenameHints];
      const detected = detectWeaponFromFilenames(allNames);
      setRpfDetected(detected);

      // Find the actual YTD name inside the RPF (the real texture file name)
      const ytdInternal = internalNames.find(n => n.toLowerCase().endsWith('.ytd'));
      // Store it so loadCustomRPF can pass it to the export
      file._ytdName = ytdInternal ? ytdInternal.replace(/\.ytd$/i, '') : null;

      if (detected) {
        setRpfCustomName(detected.name);
      } else {
        const fallbackName = file.name.replace(/\.rpf$/i, '').replace(/_/g, ' ');
        setRpfCustomName(fallbackName);
      }
    } catch (err) {
      console.error('RPF parse error:', err);
      setRpfParseError('No se pudo analizar el RPF. Verifica que sea un archivo válido.');
      const fallbackName = file.name.replace(/\.rpf$/i, '').replace(/_/g, ' ');
      setRpfCustomName(fallbackName);
    } finally {
      setRpfParsing(false);
    }
  }, []);

  const loadCustomRPF = useCallback((nameOverride, detectedWeaponId, originalFile) => {
    // Store refs so exportRPF can send the original RPF to /api/patch-rpf
    customRpfFileRef.current     = originalFile || null;
    customRpfWeaponIdRef.current = detectedWeaponId || null;
    customRpfNameRef.current     = nameOverride || null;
    // Also store the actual YTD name found inside the RPF
    customRpfYtdNameRef.current  = originalFile?._ytdName || detectedWeaponId || null;
    // Open the 2D paint mode. If a known weapon was detected, load its original texture.
    const scene = sceneRef.current;
    if (!scene) return;
    setLoading(true); setHasModel(false); setStatus('Cargando RPF custom...');
    if (meshRef.current) { scene.remove(meshRef.current); meshRef.current = null; }
    historyRef.current = [];

    const tc = tcRef.current;
    const ctx = tc.getContext('2d');

    const finishLoad = () => {
      // Build a THREE texture so paint sync works
      const tt = new THREE.CanvasTexture(tc);
      tt.flipY = false;
      tt.colorSpace = THREE.SRGBColorSpace;
      ttRef.current = tt;
      setLoading(false);
      setViewMode('2d');  // Auto-switch to 2D — no 3D model from RPF
      setStatus(`🎨 RPF Custom: ${nameOverride || 'desconocido'} — Modo UV 2D`);
      setWeaponPainted(false);
      syncUV2D();
    };

    if (detectedWeaponId) {
      // Load the original weapon PNG texture as the base — same as selecting from the list
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        baseRef.current = img;
        ctx.clearRect(0, 0, TEX, TEX);
        ctx.drawImage(img, 0, 0, TEX, TEX);
        finishLoad();
      };
      img.onerror = () => {
        // Texture not found — fall back to blank canvas with watermark
        baseRef.current = null;
        ctx.clearRect(0, 0, TEX, TEX);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, TEX, TEX);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(nameOverride || 'CUSTOM RPF', TEX / 2, TEX / 2);
        finishLoad();
      };
      img.src = `/weapons/${detectedWeaponId}.png`;
    } else {
      // Unknown weapon — blank dark canvas with name watermark
      baseRef.current = null;
      ctx.clearRect(0, 0, TEX, TEX);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, TEX, TEX);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= TEX; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, TEX); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(TEX, i); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(nameOverride || 'CUSTOM RPF', TEX / 2, TEX / 2);
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillText('Pinta aquí tu skin — LHC SkinForge', TEX / 2, TEX / 2 + 60);
      finishLoad();
    }
  }, [syncUV2D]);


  useEffect(() => {
    const scene = sceneRef.current;
    const parentMesh = meshRef.current;
    if (!scene) return;

    // Remove existing suppressor mesh if any
    if (suppMesh3DRef.current) {
      scene.remove(suppMesh3DRef.current);
      suppMesh3DRef.current.traverse(c => {
        if (c.isMesh) {
          if (c.geometry) c.geometry.dispose();
          if (c.material) c.material.dispose();
        }
      });
      suppMesh3DRef.current = null;
    }

    if (!suppEnabled || !parentMesh || !hasModel) return;

    // Construct CanvasTexture for suppressor Live Painting
    let tt = suppTt3DRef.current;
    if (!tt && suppCanvasRef.current) {
      tt = new THREE.CanvasTexture(suppCanvasRef.current);
      tt.flipY = false;
      tt.colorSpace = THREE.SRGBColorSpace;
      suppTt3DRef.current = tt;
    } else if (tt) {
      tt.needsUpdate = true;
    }

    const opts = getSuppOptions(weapon.id);
    const suppId = opts ? opts[suppStyle] : null;
    if (!suppId) return;

    // Measure weapon to attach perfectly at the muzzle tip
    const box = new THREE.Box3().setFromObject(parentMesh);
    const length = box.max.x - box.min.x;
    const height = box.max.y - box.min.y;

    new OBJLoader().load(
      `/models/${suppId}.obj`,
      (suppObj) => {
        // If disabled or cleared while loading asynchronously, abort adding
        if (!suppEnabled) return;

        suppObj.traverse(c => {
          if (c.isMesh) {
            c.material = new THREE.MeshStandardMaterial({
              map: suppPainted ? tt : null,
              color: suppPainted ? 0xffffff : (suppStyle === 1 ? 0x222222 : 0x333333),
              roughness: suppPainted ? 0.4 : 0.5,
              metalness: suppPainted ? 0.6 : 0.7,
              side: THREE.DoubleSide,
            });
            c.geometry.computeVertexNormals();
          }
        });

        // --- Precise two-pass bounding box alignment ---
        const weaponBox = new THREE.Box3().setFromObject(parentMesh);
        const wHeight   = weaponBox.max.y - weaponBox.min.y;

        // Barrel height varies by weapon category.
        // Pistols: barrel is near the top of the slide (~20% from top)
        // Rifles/SMGs/etc: barrel runs through roughly the upper third (~25% from top)
        const isPistol = weapon.id.startsWith('w_pi_');
        const isShotgun = weapon.id.startsWith('w_sg_');
        const barrelFrac = isPistol ? 0.20 : isShotgun ? 0.30 : 0.25;

        const muzzleX = weaponBox.max.x;                            // front tip of barrel
        const muzzleY = weaponBox.max.y - wHeight * barrelFrac;     // barrel axis height
        const muzzleZ = (weaponBox.max.z + weaponBox.min.z) / 2;    // lateral center

        // Measure suppressor's own box to find its entry face (left side since it points right)
        suppObj.rotation.y = 0;
        suppObj.position.set(0, 0, 0);
        suppObj.updateMatrixWorld(true);
        const suppBox = new THREE.Box3().setFromObject(suppObj);

        // Prevent WebGL NaN crashes if the OBJ file is missing/empty and returns 404 HTML
        if (suppBox.isEmpty()) {
          console.warn(`Suppressor OBJ ${suppId} is empty or missing.`);
          return;
        }

        const entryOffset = suppBox.min.x;

        // Align suppressor entry face to muzzle tip, centered on barrel axis
        suppObj.position.set(
          muzzleX - entryOffset,
          muzzleY - (suppBox.max.y + suppBox.min.y) / 2,
          muzzleZ - (suppBox.max.z + suppBox.min.z) / 2
        );

        scene.add(suppObj);
        suppMesh3DRef.current = suppObj;
      },
      undefined,
      (err) => console.log('Error loading suppressor OBJ:', err)
    );

  }, [suppEnabled, suppStyle, hasModel, weapon.id, suppPainted]);

  // ---- PAINT CORE (brush / spray / fill / eraser / pattern-brush) ----
  const applyPaint = useCallback((uv) => {
    const tc = tcRef.current; const tt = ttRef.current;
    if (!tc || !tt || !uv) return;
    const ctx = tc.getContext('2d');
    const cx = uv.x * TEX;
    const cy = uv.y * TEX;

    ctx.globalAlpha = opacity / 100;
    ctx.globalCompositeOperation = 'source-over';

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(cx, cy, size, 0, Math.PI*2); ctx.fill();
      if (baseRef.current) {
        ctx.globalCompositeOperation = 'destination-over';
        ctx.globalAlpha = 1;
        ctx.drawImage(baseRef.current, 0, 0, TEX, TEX);
      }
    } else if (tool === 'brush') {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(cx, cy, size/2, 0, Math.PI*2); ctx.fill();
    } else if (tool === 'spray') {
      ctx.fillStyle = color;
      const r = size; const dots = Math.floor(r * 1.2);
      for (let i = 0; i < dots; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * r;
        ctx.globalAlpha = (opacity / 100) * (0.2 + Math.random() * 0.5);
        ctx.beginPath(); ctx.arc(cx + Math.cos(a)*d, cy + Math.sin(a)*d, 1.5, 0, Math.PI*2); ctx.fill();
      }
    } else if (tool === 'fill') {
      floodFill(ctx, cx|0, cy|0, color);
    } else if (tool === 'pattern') {
      // Paint with pattern tile as brush — only covers area under cursor
      const tile = createPatternTile(patternType, color);
      const pat = ctx.createPattern(tile, 'repeat');
      ctx.fillStyle = pat;
      ctx.beginPath(); ctx.arc(cx, cy, size/2, 0, Math.PI*2); ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    tt.needsUpdate = true;
    setWeaponPainted(true);
  }, [tool, color, size, opacity, patternType]);

  // ---- SHAPE TOOLS (line / rect / ellipse) ----
  const SHAPE_TOOLS = ['line','rect','ellipse'];

  const beginShape = useCallback((uv) => {
    if (!uv) return;
    const tc = tcRef.current;
    if (tc) shapeSnapRef.current = tc.getContext('2d').getImageData(0, 0, TEX, TEX);
    shapeStartRef.current = uv;
  }, []);

  const previewShape = useCallback((uv) => {
    const start = shapeStartRef.current;
    if (!start || !uv) return;
    const tc = tcRef.current; const tt = ttRef.current;
    if (!tc || !tt) return;
    if (shapeSnapRef.current) tc.getContext('2d').putImageData(shapeSnapRef.current, 0, 0);
    const ctx = tc.getContext('2d');
    const x1 = start.x * TEX, y1 = start.y * TEX;
    const x2 = uv.x * TEX,    y2 = uv.y * TEX;
    ctx.save();
    ctx.globalAlpha = opacity / 100;
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, size / 5);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (tool === 'line') {
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    } else if (tool === 'rect') {
      if (shapeFilled) ctx.fillRect(x1, y1, x2-x1, y2-y1);
      else ctx.strokeRect(x1, y1, x2-x1, y2-y1);
    } else if (tool === 'ellipse') {
      const rx = Math.abs(x2-x1)/2, ry = Math.abs(y2-y1)/2;
      const cx = Math.min(x1,x2)+rx, cy = Math.min(y1,y2)+ry;
      ctx.ellipse(cx, cy, Math.max(1,rx), Math.max(1,ry), 0, 0, Math.PI*2);
      if (shapeFilled) ctx.fill(); else ctx.stroke();
    }
    ctx.restore();
    tt.needsUpdate = true;
  }, [tool, color, size, opacity, shapeFilled]);

  const endShape = useCallback(() => {
    shapeStartRef.current = null;
    shapeSnapRef.current = null;
    const tt = ttRef.current; if (tt) tt.needsUpdate = true;
    setWeaponPainted(true);
    syncUV2D();
  }, [syncUV2D]);

  // ---- PATTERN FILL ----
  const applyPattern = useCallback((patType) => {
    const tc = tcRef.current; const tt = ttRef.current;
    if (!tc || !tt) return;
    saveHistory();
    const ctx = tc.getContext('2d');
    const W = TEX, H = TEX;
    ctx.save();
    
    const tile = createPatternTile(patType, color);
    const pat = ctx.createPattern(tile, 'repeat');
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    
    ctx.restore();
    tt.needsUpdate = true;
    setWeaponPainted(true);
    syncUV2D();
  }, [color, syncUV2D]);


  const floodFill = (ctx, sx, sy, fillColor) => {
    const img = ctx.getImageData(0,0,TEX,TEX);
    const d = img.data;
    const idx = (x,y) => (y*TEX+x)*4;
    const sr=d[idx(sx,sy)],sg=d[idx(sx,sy)+1],sb=d[idx(sx,sy)+2];
    const fr=parseInt(fillColor.slice(1,3),16), fg=parseInt(fillColor.slice(3,5),16), fb=parseInt(fillColor.slice(5,7),16);
    if (sr===fr&&sg===fg&&sb===fb) return;
    const tol=40, stack=[[sx,sy]];
    const match=(x,y)=>{const i=idx(x,y);return Math.abs(d[i]-sr)<tol&&Math.abs(d[i+1]-sg)<tol&&Math.abs(d[i+2]-sb)<tol&&d[i+3]>10;};
    const fill=(x,y)=>{const i=idx(x,y);d[i]=fr;d[i+1]=fg;d[i+2]=fb;d[i+3]=255;};
    while(stack.length){
      const [x,y]=stack.pop();
      if(x<0||x>=TEX||y<0||y>=TEX||!match(x,y))continue;
      fill(x,y);
      stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
    }
    ctx.putImageData(img,0,0);
  };

  // ---- 3D PAINT HANDLERS ----
  const getUVs3D = useCallback((clientX, clientY) => {
    const el = mountRef.current; const cam = camRef.current; const mesh = meshRef.current;
    if (!el || !cam || !mesh) return [];
    const r = el.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX-r.left)/r.width)*2-1, -((clientY-r.top)/r.height)*2+1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, cam);
    const hits = ray.intersectObject(mesh, true);
    if (hits.length === 0) return [];
    
    // Solo devolvemos la primera capa (la visible frontalmente) para evitar que
    // el rayo atraviese el arma y pinte el lado opuesto como si fuera un espejo.
    return hits[0].uv ? [hits[0].uv] : [];
  }, []);

  const on3DDown = useCallback((e) => {
    if (mode==='rotate') return;
    e.preventDefault();
    const uvs = getUVs3D(e.clientX, e.clientY);
    if (SHAPE_TOOLS.includes(tool)) {
      if (uvs.length > 0) { saveHistory(); paintRef.current = true; beginShape(uvs[0]); }
    } else {
      saveHistory(); paintRef.current = true;
      uvs.forEach(uv => applyPaint(uv));
    }
  }, [mode, tool, getUVs3D, applyPaint, beginShape]);

  const on3DMove = useCallback((e) => {
    if (!paintRef.current || mode==='rotate') return;
    e.preventDefault();
    const uvs = getUVs3D(e.clientX, e.clientY);
    if (SHAPE_TOOLS.includes(tool)) { if (uvs.length > 0) { previewShape(uvs[0]); syncUV2D(); } }
    else uvs.forEach(uv => applyPaint(uv));
  }, [mode, tool, getUVs3D, applyPaint, previewShape, syncUV2D]);

  const onUp = useCallback(() => {
    paintRef.current = false; lastUVRef.current = null;
    if (SHAPE_TOOLS.includes(tool)) endShape();
    syncUV2D();
  }, [tool, endShape, syncUV2D]);

  const onTouch3DDown = useCallback((e) => { if(e.touches[0]) on3DDown({clientX:e.touches[0].clientX,clientY:e.touches[0].clientY,preventDefault:()=>{}}); }, [on3DDown]);
  const onTouch3DMove = useCallback((e) => { e.preventDefault(); if(e.touches[0]) on3DMove({clientX:e.touches[0].clientX,clientY:e.touches[0].clientY,preventDefault:()=>{}}); }, [on3DMove]);

  // ---- 2D PAINT HANDLERS ----
  const getUV2D = useCallback((clientX, clientY) => {
    const el = uv2DRef.current; if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  }, []);

  const on2DDown = useCallback((e) => {
    e.preventDefault();
    const uv = getUV2D(e.clientX, e.clientY);
    if (SHAPE_TOOLS.includes(tool)) {
      if (uv) { saveHistory(); paintRef.current = true; beginShape(uv); }
    } else {
      saveHistory(); paintRef.current = true; applyPaint(uv); syncUV2D();
    }
  }, [getUV2D, applyPaint, syncUV2D, beginShape, tool]);

  const on2DMove = useCallback((e) => {
    if (!paintRef.current) return;
    e.preventDefault();
    const uv = getUV2D(e.clientX, e.clientY);
    if (SHAPE_TOOLS.includes(tool)) { if (uv) { previewShape(uv); syncUV2D(); } }
    else { applyPaint(uv); syncUV2D(); }
  }, [getUV2D, applyPaint, syncUV2D, previewShape, tool]);

  const onTouch2DDown = useCallback((e) => { if(e.touches[0]) on2DDown({clientX:e.touches[0].clientX,clientY:e.touches[0].clientY,preventDefault:()=>{}}); }, [on2DDown]);
  const onTouch2DMove = useCallback((e) => { e.preventDefault(); if(e.touches[0]) on2DMove({clientX:e.touches[0].clientX,clientY:e.touches[0].clientY,preventDefault:()=>{}}); }, [on2DMove]);

  // ---- RESET ----
  const resetTexture = () => {
    const tc=tcRef.current; const tt=ttRef.current; if(!tc||!tt)return;
    const ctx=tc.getContext('2d'); ctx.clearRect(0,0,TEX,TEX);
    if(baseRef.current) ctx.drawImage(baseRef.current,0,0,TEX,TEX);
    tt.needsUpdate=true; syncUV2D();
    setWeaponPainted(false);
  };

  // Helper: canvas → base64 pixels
  const canvasToB64 = (canvas, w, h) => {
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').drawImage(canvas, 0, 0, w, h);
    const imgData = tmp.getContext('2d').getImageData(0, 0, w, h);
    const bytes = imgData.data;
    const CHUNK = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK)
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
    return btoa(binary);
  };

  // ---- EXPORT RPF ----
  const exportRPF = async () => {
    const tc = tcRef.current; if (!tc || exporting) return;
    setExporting(true);

    // ── Custom RPF mode ───────────────────────────────────────────────────────
    if (customRpfFileRef.current) {
      setStatus('Inyectando skin en tu RPF...');
      try {
        const W = 512, H = 512;
        const b64 = canvasToB64(tc, W, H);
        const ytdName = customRpfYtdNameRef.current
          || customRpfWeaponIdRef.current
          || 'w_pi_combatpistol';

        const fd = new FormData();
        fd.append('rpf',     customRpfFileRef.current);
        fd.append('pixels',  b64);
        fd.append('width',   String(W));
        fd.append('height',  String(H));
        fd.append('ytdName', ytdName);

        const res = await fetch('/api/patch-rpf', { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          setStatus('Error: ' + (err.error || res.statusText));
          return;
        }
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.download = customRpfFileRef.current.name; // same filename as original
        a.href = url; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setStatus('✅ RPF descargado — reemplaza el original en tu carpeta mods/');
      } catch (e) {
        setStatus('Error: ' + e.message);
      } finally {
        setExporting(false);
      }
      return;
    }


    // ── Standard weapon mode (sin cambios) ──────────────────────────────────
    setStatus('Generando RPF...');
    try {
      const W = weapon.texW || 512, H = weapon.texH || 512;
      const b64 = canvasToB64(tc, W, H);

      // Suppressor
      const suppOpts = getSuppOptions(weapon.id);
      const activeSuppName = suppEnabled && suppOpts ? suppOpts[suppStyle] : null;
      let suppPixels = null;
      if (activeSuppName && suppPainted && suppCanvasRef.current) {
        suppPixels = canvasToB64(suppCanvasRef.current, SUPP_W, SUPP_H);
      }

      const res = await fetch('/api/generate-rpf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weaponName: weapon.id,
          width: W, height: H, pixels: b64,
          ...(activeSuppName && {
            suppName:   activeSuppName,
            suppPixels: suppPixels,
            suppWidth:  SUPP_W,
            suppHeight: SUPP_H,
          }),
        }),
      });
      if (!res.ok) { const err = await res.json(); setStatus('Error: ' + (err.error || res.statusText)); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.download = `${weapon.id}_skin.zip`; a.href = url; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus('ZIP descargado — extrae en FiveM.app/');
    } catch(e) {
      setStatus('Error: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  // ---- SUPPRESSOR CANVAS PAINT ----
  const suppPaint = useCallback((e) => {
    const canvas = suppCanvasRef.current; if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width)  * SUPP_W;
    const y = ((e.clientY - r.top)  / r.height) * SUPP_H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = suppColor;
    ctx.globalAlpha = opacity / 100;
    ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    setSuppPainted(true);
    if (suppTt3DRef.current) suppTt3DRef.current.needsUpdate = true;
  }, [suppColor, size, opacity]);

  const onSuppDown = useCallback((e) => {
    e.preventDefault(); suppPaintRef.current = true; suppPaint(e);
  }, [suppPaint]);
  const onSuppMove = useCallback((e) => {
    if (!suppPaintRef.current) return; e.preventDefault(); suppPaint(e);
  }, [suppPaint]);
  const onSuppUp = useCallback(() => { suppPaintRef.current = false; }, []);

  const resetSuppCanvas = useCallback(() => {
    if (!suppCanvasRef.current) return;
    const canvas = suppCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#222222';
    ctx.fillRect(0, 0, SUPP_W, SUPP_H);

    ctx.fillStyle = '#2a2a2a';
    for (let x = 0; x < SUPP_W; x += 40) {
      ctx.fillRect(x, 0, 20, SUPP_H);
    }

    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, 20, SUPP_H);
    ctx.fillRect(SUPP_W - 20, 0, 20, SUPP_H);

    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LIENZO SILENCIADOR (PINTA AQUÍ)', SUPP_W / 2, SUPP_H / 2);

    setSuppPainted(false);
    if (suppTt3DRef.current) suppTt3DRef.current.needsUpdate = true;
  }, []);

  // Initialise suppressor canvas when enabled
  useEffect(() => {
    if (suppEnabled) resetSuppCanvas();
  }, [suppEnabled, resetSuppCanvas]);

  // ---- STICKER LOGIC ----

  // Helper: dispose current sticker plane
  const disposeSticker = useCallback(() => {
    const pl = stickerPlaneMeshRef.current;
    if (pl) {
      sceneRef.current?.remove(pl);
      pl.geometry.dispose();
      if (Array.isArray(pl.material)) pl.material.forEach(m => m.dispose());
      else pl.material.dispose();
      stickerPlaneMeshRef.current = null;
    }
    stickerHitRef.current = null;
    stickerDraggingRef.current = false;
  }, []);

  // Place / move sticker plane to the surface point under mouse
  const moveStickerToSurface = useCallback((clientX, clientY) => {
    const el = mountRef.current; const cam = camRef.current; const mesh = meshRef.current;
    const plane = stickerPlaneMeshRef.current;
    if (!el || !cam || !mesh || !plane) return;

    let hit = null;
    if (clientX !== undefined && clientY !== undefined) {
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - r.left) / r.width)  * 2 - 1,
        -((clientY - r.top)  / r.height) * 2 + 1
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, cam);
      const hits = ray.intersectObject(mesh, true);
      if (hits.length > 0) {
        hit = hits[0];
        stickerHitRef.current = hit;
      }
    } else {
      hit = stickerHitRef.current;
    }

    if (!hit) return;

    // Orient plane: face normal, upright to camera
    plane.position.copy(hit.point);
    const camDir = new THREE.Vector3().subVectors(cam.position, hit.point).normalize();
    const wn = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
    const facing = wn.dot(camDir) > 0 ? wn : wn.negate();
    const tgt = hit.point.clone().add(facing);
    plane.lookAt(tgt);
    // Apply user rotation around normal
    plane.rotateZ(stickerRotation * Math.PI / 180);
    plane.position.copy(hit.point).addScaledVector(facing, 0.0005); // tiny offset to avoid z-fight
  }, [stickerRotation]);

  const loadSticker = useCallback((file) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      stickerImgRef.current = img;
      setStickerSrc(url);
      setStickerActive(true);
      setStickerRotation(0);
      setViewMode('3d');

      // Build Three.js plane preview
      disposeSticker();
      new THREE.TextureLoader().load(url, (tex) => {
        tex.needsUpdate = true;
        tex.colorSpace = THREE.SRGBColorSpace;
        const aspect = img.naturalHeight / img.naturalWidth;
        const geom = new THREE.PlaneGeometry(1, aspect);
        // Use MeshStandardMaterial with identical roughness/metalness so the preview shading perfectly matches the weapon lighting
        const mat = new THREE.MeshStandardMaterial({
          map: tex, transparent: true, depthTest: true, side: THREE.DoubleSide,
          roughness: 0.55, metalness: 0.4
        });
        const pl = new THREE.Mesh(geom, mat);
        pl.renderOrder = 999;
        // Initial scale: 15% of weapon length
        const box = meshRef.current ? new THREE.Box3().setFromObject(meshRef.current) : null;
        const weaponLen = box ? (box.max.x - box.min.x) : 0.2;
        pl.scale.set(stickerScale * weaponLen, stickerScale * weaponLen * aspect, 1);
        // Place at weapon center initially
        if (meshRef.current) {
          const c = box.getCenter(new THREE.Vector3());
          pl.position.copy(c);
          pl.lookAt(camRef.current?.position ?? new THREE.Vector3(0, 0, 5));
        }
        sceneRef.current?.add(pl);
        stickerPlaneMeshRef.current = pl;
      });
    };
    img.src = url;
  }, [stickerScale, disposeSticker]);

  // Sync plane scale & rotation whenever sliders change
  useEffect(() => {
    const pl = stickerPlaneMeshRef.current;
    const img = stickerImgRef.current;
    const mesh = meshRef.current;
    if (!pl || !img) return;
    const aspect = img.naturalHeight / img.naturalWidth;
    const box = mesh ? new THREE.Box3().setFromObject(mesh) : null;
    const weaponLen = box ? (box.max.x - box.min.x) : 0.2;
    pl.scale.set(stickerScale * weaponLen, stickerScale * weaponLen * aspect, 1);
    // Re-apply rotation using stored hit without triggering new raycast
    moveStickerToSurface();
  }, [stickerScale, stickerRotation, moveStickerToSurface]);

  // Mouse handlers for sticker viewport dragging
  const onStickerViewportDown = useCallback((e) => {
    if (!stickerActive) return false;
    e.stopPropagation();
    stickerDraggingRef.current = true;
    moveStickerToSurface(e.clientX, e.clientY);
    return true;
  }, [stickerActive, moveStickerToSurface]);

  const onStickerViewportMove = useCallback((e) => {
    if (!stickerActive || !stickerDraggingRef.current) return;
    moveStickerToSurface(e.clientX, e.clientY);
  }, [stickerActive, moveStickerToSurface]);

  const onStickerViewportUp = useCallback(() => {
    stickerDraggingRef.current = false;
  }, []);

  // Stamp: true 3D Mesh Decal Volume Projection rasterization loop
  // Maps the sticker pixels directly onto every covered 3D triangle's UV space perfectly seamlessly
  const stampSticker = useCallback(() => {
    const tc = tcRef.current; const tt = ttRef.current;
    const img = stickerImgRef.current;
    const pl = stickerPlaneMeshRef.current;
    const hit = stickerHitRef.current;
    if (!tc || !tt || !img || !pl || !hit || !hit.object) {
      alert('Coloca el sticker sobre la superficie del arma antes de sellar.');
      return;
    }

    const geom = hit.object.geometry;
    if (!geom || !geom.attributes.position || !geom.attributes.uv) return;

    saveHistory();

    // Extract raw RGBA pixels of the source sticker image
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = srcW; tmpCanvas.height = srcH;
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.drawImage(img, 0, 0);
    const srcPixels = tmpCtx.getImageData(0, 0, srcW, srcH).data;

    // Get direct target texture ImageData array for high-performance blending
    const ctx = tc.getContext('2d');
    const targetData = ctx.getImageData(0, 0, TEX, TEX);
    const targetPixels = targetData.data;

    // Collect ALL meshes of the weapon so the sticker projects onto every submesh it overlaps
    const allMeshes = [];
    if (meshRef.current) meshRef.current.traverse(c => { if (c.isMesh) allMeshes.push(c); });
    if (!allMeshes.includes(hit.object)) allMeshes.push(hit.object);

    // Sticker plane coordinate frame in world space (shared across all meshes)
    const pCenter = pl.position.clone();
    const hw = pl.scale.x * 0.5;
    const hh = pl.scale.y * 0.5;
    const pRight  = new THREE.Vector3(1, 0, 0).applyQuaternion(pl.quaternion);
    const pUp     = new THREE.Vector3(0, 1, 0).applyQuaternion(pl.quaternion);
    const pNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(pl.quaternion);

    const getDecalCoords = (pos) => {
      const dx = pos.x - pCenter.x, dy = pos.y - pCenter.y, dz = pos.z - pCenter.z;
      return {
        x: (dx * pRight.x  + dy * pRight.y  + dz * pRight.z)  / hw,
        y: (dx * pUp.x     + dy * pUp.y     + dz * pUp.z)     / hh,
        z:  dx * pNormal.x + dy * pNormal.y + dz * pNormal.z
      };
    };

    for (const targetMesh of allMeshes) {
      const geomM     = targetMesh.geometry;
      if (!geomM || !geomM.attributes.position || !geomM.attributes.uv) continue;

      const posAttr   = geomM.attributes.position;
      const uvAttr    = geomM.attributes.uv;
      const indexAttr = geomM.index;
      const objMat    = targetMesh.matrixWorld;
      const totalTriangles = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

      const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
      const uvA = new THREE.Vector2(), uvB = new THREE.Vector2(), uvC = new THREE.Vector2();
      const dP1 = new THREE.Vector3(), dP2 = new THREE.Vector3(), faceNormal = new THREE.Vector3();

      for (let i = 0; i < totalTriangles; i++) {
        let aIdx, bIdx, cIdx;
        if (indexAttr) {
          aIdx = indexAttr.getX(i * 3); bIdx = indexAttr.getX(i * 3 + 1); cIdx = indexAttr.getX(i * 3 + 2);
        } else {
          aIdx = i * 3; bIdx = i * 3 + 1; cIdx = i * 3 + 2;
        }

        vA.fromBufferAttribute(posAttr, aIdx).applyMatrix4(objMat);
        vB.fromBufferAttribute(posAttr, bIdx).applyMatrix4(objMat);
        vC.fromBufferAttribute(posAttr, cIdx).applyMatrix4(objMat);

        const dA = getDecalCoords(vA), dB = getDecalCoords(vB), dC = getDecalCoords(vC);

        if (Math.max(dA.x, dB.x, dC.x) < -1.0 || Math.min(dA.x, dB.x, dC.x) > 1.0) continue;
        if (Math.max(dA.y, dB.y, dC.y) < -1.0 || Math.min(dA.y, dB.y, dC.y) > 1.0) continue;
        // Relaxed depth: covers thick weapon bodies without clipping
        if (Math.max(dA.z, dB.z, dC.z) < -0.5  || Math.min(dA.z, dB.z, dC.z) > 0.5)  continue;

        // Accept front-facing and near-perpendicular triangles; reject only clearly back-facing ones
        dP1.subVectors(vB, vA); dP2.subVectors(vC, vA);
        faceNormal.crossVectors(dP1, dP2).normalize();
        if (faceNormal.dot(pNormal) <= -0.3) continue;

        uvA.fromBufferAttribute(uvAttr, aIdx);
        uvB.fromBufferAttribute(uvAttr, bIdx);
        uvC.fromBufferAttribute(uvAttr, cIdx);

        const pAx = uvA.x * TEX, pAy = uvA.y * TEX;
        const pBx = uvB.x * TEX, pBy = uvB.y * TEX;
        const pCx = uvC.x * TEX, pCy = uvC.y * TEX;

        const xMin = Math.max(0, Math.floor(Math.min(pAx, pBx, pCx)));
        const xMax = Math.min(TEX - 1, Math.ceil(Math.max(pAx, pBx, pCx)));
        const yMin = Math.max(0, Math.floor(Math.min(pAy, pBy, pCy)));
        const yMax = Math.min(TEX - 1, Math.ceil(Math.max(pAy, pBy, pCy)));

        const v0x = pBx - pAx, v0y = pBy - pAy;
        const v1x = pCx - pAx, v1y = pCy - pAy;
        const d00 = v0x*v0x + v0y*v0y, d01 = v0x*v1x + v0y*v1y, d11 = v1x*v1x + v1y*v1y;
        const denom = d00*d11 - d01*d01;
        if (Math.abs(denom) < 1e-8) continue;
        const invDenom = 1.0 / denom;

        for (let py = yMin; py <= yMax; py++) {
          for (let px = xMin; px <= xMax; px++) {
            const v2x = (px+0.5)-pAx, v2y = (py+0.5)-pAy;
            const d20 = v2x*v0x + v2y*v0y, d21 = v2x*v1x + v2y*v1y;
            const bv = (d11*d20 - d01*d21)*invDenom;
            const bw = (d00*d21 - d01*d20)*invDenom;
            const bu = 1.0 - bv - bw;

            if (bu >= -0.002 && bv >= -0.002 && bw >= -0.002) {
              const wx = bu*vA.x + bv*vB.x + bw*vC.x;
              const wy = bu*vA.y + bv*vB.y + bw*vC.y;
              const wz = bu*vA.z + bv*vB.z + bw*vC.z;

              const dx = wx-pCenter.x, dy = wy-pCenter.y, dz = wz-pCenter.z;
              const decX = (dx*pRight.x + dy*pRight.y + dz*pRight.z) / hw;
              const decY = (dx*pUp.x    + dy*pUp.y    + dz*pUp.z)    / hh;

              if (decX >= -1.0 && decX <= 1.0 && decY >= -1.0 && decY <= 1.0) {
                const sx = Math.min(srcW-1, Math.max(0, Math.floor((decX+1.0)*0.5*srcW)));
                const sy = Math.min(srcH-1, Math.max(0, Math.floor((1.0-decY)*0.5*srcH)));
                const sIdx = (sy*srcW + sx)*4;
                const sAlpha = srcPixels[sIdx+3] / 255.0;
                if (sAlpha > 0.01) {
                  const tIdx  = (py*TEX + px)*4;
                  const baseR = targetPixels[tIdx], baseG = targetPixels[tIdx+1], baseB = targetPixels[tIdx+2];
                  const baseA = targetPixels[tIdx+3] / 255.0;
                  const outAlpha = sAlpha + baseA*(1.0-sAlpha);
                  if (outAlpha > 0.001) {
                    targetPixels[tIdx]   = Math.min(255, (srcPixels[sIdx]  *sAlpha + baseR*baseA*(1.0-sAlpha))/outAlpha) | 0;
                    targetPixels[tIdx+1] = Math.min(255, (srcPixels[sIdx+1]*sAlpha + baseG*baseA*(1.0-sAlpha))/outAlpha) | 0;
                    targetPixels[tIdx+2] = Math.min(255, (srcPixels[sIdx+2]*sAlpha + baseB*baseA*(1.0-sAlpha))/outAlpha) | 0;
                    targetPixels[tIdx+3] = Math.min(255, outAlpha*255) | 0;
                  }
                }
              }
            }
          }
        }
      }
    }

    // Flush blended pixel data back to the GPU texture
    ctx.putImageData(targetData, 0, 0);
    tt.needsUpdate = true;
    syncUV2D();
    setWeaponPainted(true);
    disposeSticker();
    setStickerActive(false);
    setStickerSrc(null);
    setMode('paint');
  }, [syncUV2D, saveHistory, disposeSticker]);

  const cancelSticker = useCallback(() => {
    disposeSticker();
    setStickerActive(false);
    setStickerSrc(null);
  }, [disposeSticker]);

  const TOOLS = [
    { id:'brush',   icon:<Paintbrush size={14}/>, label:'Pincel'        },
    { id:'spray',   icon:<Wind size={14}/>,        label:'Spray'         },
    { id:'line',    icon:<Slash size={14}/>,       label:'Línea recta'   },
    { id:'rect',    icon:<Square size={14}/>,      label:'Rectángulo'    },
    { id:'ellipse', icon:<Circle size={14}/>,      label:'Elipse/Círculo'},
    { id:'fill',    icon:<Droplets size={14}/>,    label:'Relleno'       },
    { id:'pattern', icon:<LayoutGrid size={14}/>,  label:'Patrón'        },
    { id:'eraser',  icon:<Eraser size={14}/>,      label:'Borrador'      },
  ];

  const PATTERNS = [
    { id:'tiger',       label:'🐯 Tigre' },
    { id:'camo',        label:'🌿 Camuflaje' },
    { id:'camo_desert', label:'🏜️ Camo Desierto' },
    { id:'camo_winter', label:'❄️ Camo Nieve' },
    { id:'camo_digital',label:'🟩 Camo Digital' },
    { id:'leopard',     label:'🐆 Leopardo' },
    { id:'zebra',       label:'🦓 Cebra' },
    { id:'galaxy',      label:'🌌 Galaxia' },
    { id:'stripes_h',   label:'━ Rayas H' },
    { id:'stripes_v',   label:'║ Rayas V' },
    { id:'stripes_d',   label:'╲ Diagonal' },
    { id:'crosshatch',  label:'✖️ Rejilla' },
    { id:'carbon',      label:'⬛ Carbono' },
    { id:'dots',        label:'● Puntos' },
    { id:'hex',         label:'⬡ Hexágono' },
    { id:'grid',        label:'▦ Cuadrícula' },
    { id:'zig_zag',     label:'〰️ Zig-Zag' },
    { id:'waves',       label:'🌊 Ondas' },
    { id:'bricks',      label:'🧱 Ladrillos' },
    { id:'scales',      label:'🐟 Escamas' },
    { id:'stars',       label:'⭐ Estrellas' },
    { id:'hearts',      label:'❤️ Corazones' },
    { id:'checkers',    label:'🏁 Ajedrez' },
    { id:'circuit',     label:'🔌 Circuito' },
    { id:'wood',        label:'🪵 Madera' },
    { id:'marble',      label:'🏛️ Mármol' },
    { id:'splatter',    label:'🎨 Salpicadura' },
    { id:'gradient',    label:'◧ Gradiente' },
  ];

  // Group weapons by category for dropdown
  const cats = [...new Set(WEAPONS.map(w => w.cat))];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative z-20">
      <Header/>
      <div className="pt-16 flex-1 flex flex-col" style={{height:'calc(100vh - 64px)'}}>

        {/* ── TOP BAR ── */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-white/8 bg-black/40 shrink-0 relative" style={{zIndex:60}}>
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-full text-[9px] font-black text-yellow-400 uppercase shrink-0">
            <AlertTriangle size={8}/> LHC SkinForge 3D
          </div>

          {/* View toggle: 3D / UV 2D */}
          <div className="flex rounded-lg border border-white/10 text-xs font-black select-none shrink-0">
            <button type="button"
              onClick={() => setViewMode('3d')}
              className={`flex items-center justify-center gap-1 px-3 py-2 rounded-l-lg cursor-pointer transition-colors ${viewMode==='3d'?'bg-red-500 text-white':'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}>
              🎮 3D
            </button>
            <div className="w-px bg-white/10"/>
            <button type="button"
              onClick={() => setViewMode('2d')}
              className={`flex items-center justify-center gap-1 px-3 py-2 rounded-r-lg cursor-pointer transition-colors ${viewMode==='2d'?'bg-purple-500 text-white':'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}>
              🗺️ UV 2D
            </button>
          </div>

          {/* Mode toggle — only in 3D view */}
          {viewMode === '3d' && (
            <div className="flex rounded-lg border border-white/10 text-xs font-black select-none shrink-0">
              <button type="button"
                onClick={() => setMode('paint')}
                className={`flex items-center justify-center gap-1 px-3 py-2 rounded-l-lg cursor-pointer transition-colors ${mode==='paint'?'bg-red-500/80 text-white':'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}>
                ✏️ Pintar
              </button>
              <div className="w-px bg-white/10"/>
              <button type="button"
                onClick={() => setMode('rotate')}
                className={`flex items-center justify-center gap-1 px-3 py-2 rounded-r-lg cursor-pointer transition-colors ${mode==='rotate'?'bg-blue-500/80 text-white':'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}>
                🔄 Rotar <span className="text-[9px] opacity-50 ml-1">[E]</span>
              </button>
            </div>
          )}

          {/* Weapon selector */}
          <div className="shrink-0">
            <button
              ref={dropBtnRef}
              onClick={() => {
                if (dropBtnRef.current) {
                  const r = dropBtnRef.current.getBoundingClientRect();
                  setDropPos({ top: r.bottom + 4, left: r.left });
                }
                setDropOpen(o => !o);
              }}
              style={{display:'flex', alignItems:'center', gap:8, padding:'5px 12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, cursor:'pointer', userSelect:'none', color:'white', minWidth:150, outline:'none'}}>
              <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', flex:1, gap:1}}>
                <span style={{fontSize:9, color:'#737373', lineHeight:1}}>{weapon.cat}</span>
                <span style={{fontSize:12, color:'#e5e5e5', fontWeight:700}}>{weapon.name}</span>
              </div>
              <ChevronDown size={12} style={{color:'#737373', transform:dropOpen?'rotate(180deg)':'none', transition:'transform 0.15s', flexShrink:0}}/>
            </button>

            {dropOpen && (
              <>
                <div onClick={() => setDropOpen(false)} style={{position:'fixed', inset:0, zIndex:9998}}/>
                <div style={{position:'fixed', top:dropPos.top, left:dropPos.left, minWidth:200, maxHeight:340, overflowY:'auto', background:'#111', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, zIndex:9999, boxShadow:'0 8px 32px rgba(0,0,0,0.9)'}}>
                  {cats.map(cat => (
                    <div key={cat}>
                      <div style={{padding:'6px 12px 2px', fontSize:9, color:'#555', fontWeight:900, textTransform:'uppercase', letterSpacing:2, borderTop:'1px solid rgba(255,255,255,0.06)'}}>{cat}</div>
                      {WEAPONS.filter(w => w.cat === cat).map(w => (
                        <button key={w.id}
                          onClick={() => { setWeapon(w); setDropOpen(false); customRpfFileRef.current = null; customRpfWeaponIdRef.current = null; customRpfNameRef.current = null; }}
                          style={{display:'block', width:'100%', textAlign:'left', padding:'7px 12px 7px 16px', fontSize:12, cursor:'pointer', background:weapon.id===w.id?'rgba(239,68,68,0.1)':'transparent', color:weapon.id===w.id?'#f87171':'#d4d4d4', userSelect:'none', border:'none', outline:'none'}}>
                          {w.name}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="text-[10px] text-zinc-600 ml-auto truncate shrink-0">{status}</div>

          {/* Custom OBJ weapon upload button */}
          <button
            onClick={() => setCustomModalOpen(true)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/15 hover:bg-purple-500/30 border border-purple-500/30 hover:border-purple-500/60 text-purple-400 hover:text-purple-300 rounded-lg text-[10px] font-black transition-all"
          >
            📂 OBJ Custom
          </button>

          {/* RPF Custom weapon upload button */}
          <button
            onClick={() => { setRpfModalOpen(true); setRpfFile(null); setRpfDetected(null); setRpfCustomName(''); setRpfParseError(''); }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 hover:bg-orange-500/30 border border-orange-500/30 hover:border-orange-500/60 text-orange-400 hover:text-orange-300 rounded-lg text-[10px] font-black transition-all"
          >
            📦 RPF Custom
          </button>
        </div>

        {/* ── CUSTOM WEAPON MODAL (OBJ) ── */}
        {customModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setCustomModalOpen(false)}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"/>
            <div
              className="relative bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🎮</span>
                <div>
                  <div className="font-black text-white text-sm">Subir Arma Personalizada (OBJ)</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Sube el .obj de tu arma modificada y pinta encima</div>
                </div>
              </div>

              {/* OBJ file */}
              <div className="mb-3">
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Modelo 3D (.obj) <span className="text-red-400">*</span></div>
                <label className="flex items-center gap-2 p-3 bg-white/5 hover:bg-white/8 border border-dashed border-white/20 hover:border-purple-500/50 rounded-xl cursor-pointer transition-all">
                  <span className="text-lg">📦</span>
                  <div className="flex-1 min-w-0">
                    {customObjFile
                      ? <span className="text-[11px] text-purple-300 font-bold truncate block">{customObjFile.name}</span>
                      : <span className="text-[11px] text-zinc-500">Seleccionar archivo .obj...</span>
                    }
                  </div>
                  <input ref={customObjInputRef} type="file" accept=".obj" className="hidden"
                    onChange={e => { if(e.target.files[0]) setCustomObjFile(e.target.files[0]); }}
                  />
                </label>
              </div>

              {/* PNG file (optional) */}
              <div className="mb-3">
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Textura base (.png) <span className="text-zinc-600">— opcional</span></div>
                <label className="flex items-center gap-2 p-3 bg-white/5 hover:bg-white/8 border border-dashed border-white/20 hover:border-blue-500/50 rounded-xl cursor-pointer transition-all">
                  <span className="text-lg">🖼️</span>
                  <div className="flex-1 min-w-0">
                    {customPngFile
                      ? <span className="text-[11px] text-blue-300 font-bold truncate block">{customPngFile.name}</span>
                      : <span className="text-[11px] text-zinc-500">Seleccionar textura existente...</span>
                    }
                  </div>
                  <input ref={customPngInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { if(e.target.files[0]) setCustomPngFile(e.target.files[0]); }}
                  />
                </label>
                <div className="text-[9px] text-zinc-600 mt-1 leading-tight">Si tienes ya una skin pintada en el arma, súbela aquí y podrás pintarla encima conservando lo que tiene.</div>
              </div>

              {/* Weapon name */}
              <div className="mb-4">
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Nombre identificador <span className="text-zinc-600">— opcional</span></div>
                <input
                  type="text"
                  placeholder="Ej: ak47_custom_javi"
                  value={customWeaponName}
                  onChange={e => setCustomWeaponName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white placeholder:text-zinc-600 outline-none focus:border-purple-500/60"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!customObjFile) return;
                    loadCustomWeapon(customObjFile, customPngFile, customWeaponName);
                    setCustomModalOpen(false);
                    setCustomObjFile(null);
                    setCustomPngFile(null);
                    setCustomWeaponName('');
                    setViewMode('3d');
                  }}
                  disabled={!customObjFile}
                  className="flex-1 py-2.5 bg-purple-500 hover:bg-purple-400 disabled:bg-white/5 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-black rounded-xl text-[11px] transition-all"
                >
                  🚀 Cargar y Pintar
                </button>
                <button
                  onClick={() => { setCustomModalOpen(false); setCustomObjFile(null); setCustomPngFile(null); setCustomWeaponName(''); }}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-400 font-black rounded-xl text-[11px] transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── RPF CUSTOM MODAL ── */}
        {rpfModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setRpfModalOpen(false)}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"/>
            <div
              className="relative bg-[#111] border border-orange-500/20 rounded-2xl p-6 w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-xl border border-orange-500/20">📦</div>
                <div>
                  <div className="font-black text-white text-sm">Arma Modificada (RPF)</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Sube tu RPF custom y pinta en 2D igual que las armas originales</div>
                </div>
              </div>

              {/* RPF file drop zone */}
              <div className="mb-4">
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Archivo RPF <span className="text-orange-400">*</span></div>
                <div
                  className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all select-none ${
                    rpfFile
                      ? 'border-orange-500/60 bg-orange-500/5'
                      : 'border-white/15 hover:border-orange-500/40 bg-white/3'
                  }`}
                  onClick={() => rpfInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                  onDragEnter={e => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const f = e.dataTransfer.files?.[0];
                    if (f && f.name.toLowerCase().endsWith('.rpf')) handleRpfFileSelect(f);
                  }}
                >
                  {rpfFile ? (
                    <>
                      <span className="text-3xl">✅</span>
                      <div className="text-center">
                        <div className="text-[12px] text-orange-300 font-black truncate max-w-[280px]">{rpfFile.name}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{(rpfFile.size / 1024 / 1024).toFixed(2)} MB</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl">📦</span>
                      <div className="text-center">
                        <div className="text-[12px] text-zinc-400 font-bold">Arrastra tu RPF aquí</div>
                        <div className="text-[10px] text-zinc-600">o haz click para seleccionar</div>
                      </div>
                    </>
                  )}
                  <input
                    ref={rpfInputRef}
                    type="file"
                    accept=".rpf"
                    className="hidden"
                    onChange={e => { if (e.target.files[0]) handleRpfFileSelect(e.target.files[0]); }}
                  />
                </div>
              </div>

              {/* Parse status */}
              {rpfParsing && (
                <div className="mb-4 flex items-center gap-2 p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                  <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin shrink-0"/>
                  <span className="text-[11px] text-orange-300 font-bold">Analizando archivos internos del RPF...</span>
                </div>
              )}

              {/* Detection result */}
              {!rpfParsing && rpfFile && (
                <div className={`mb-4 p-3 rounded-xl border ${
                  rpfDetected
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-zinc-800/60 border-white/10'
                }`}>
                  <div className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{color: rpfDetected ? '#86efac' : '#737373'}}>
                    {rpfDetected ? '✅ Arma detectada automáticamente' : '🔍 Arma no reconocida — nombre manual'}
                  </div>
                  {rpfDetected && (
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-black text-white">{rpfDetected.name}</span>
                      <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-black">AUTO</span>
                      <span className="text-[9px] text-zinc-600 font-mono">{rpfDetected.id}</span>
                    </div>
                  )}
                  {!rpfDetected && (
                    <div className="text-[10px] text-zinc-500 leading-tight">No se encontraron armas conocidas en el RPF. Puedes darle un nombre personalizado abajo.</div>
                  )}
                </div>
              )}

              {/* Parse error */}
              {rpfParseError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <div className="text-[11px] text-red-400 font-bold">{rpfParseError}</div>
                </div>
              )}

              {/* Custom name */}
              {rpfFile && !rpfParsing && (
                <div className="mb-5">
                  <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">
                    Nombre del arma <span className="text-zinc-600">— editable</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Ej: AK47 Custom de Javi"
                    value={rpfCustomName}
                    onChange={e => setRpfCustomName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white placeholder:text-zinc-600 outline-none focus:border-orange-500/60"
                  />
                  <div className="text-[9px] text-zinc-600 mt-1">Este nombre aparecerá en el editor. El arma se pintará en modo UV 2D.</div>
                </div>
              )}

              {/* Info box */}
              <div className="mb-5 p-3 bg-blue-500/5 border border-blue-500/15 rounded-xl">
                <div className="text-[9px] text-blue-400 font-black uppercase tracking-widest mb-1">ℹ️ ¿Cómo funciona?</div>
                <div className="text-[10px] text-zinc-500 leading-relaxed">
                  El RPF se analiza en tu navegador para detectar el arma. Se abre el editor en <span className="text-purple-400 font-bold">modo UV 2D</span> con un lienzo en blanco sobre el que puedes pintar exactamente igual que con las armas originales del juego.
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!rpfFile) return;
                    const finalName = rpfCustomName || (rpfDetected?.name) || rpfFile.name.replace(/\.rpf$/i, '');
                    loadCustomRPF(finalName, rpfDetected?.id || null, rpfFile);
                    setRpfModalOpen(false);
                    setRpfFile(null);
                    setRpfDetected(null);
                    setRpfCustomName('');
                  }}
                  disabled={!rpfFile || rpfParsing}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-400 disabled:bg-white/5 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-black rounded-xl text-[11px] transition-all flex items-center justify-center gap-2"
                >
                  🎨 Abrir en Editor 2D
                </button>
                <button
                  onClick={() => { setRpfModalOpen(false); setRpfFile(null); setRpfDetected(null); setRpfCustomName(''); setRpfParseError(''); }}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 text-zinc-400 font-black rounded-xl text-[11px] transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden relative z-20 bg-[#050505]">
          {/* ── LEFT TOOLS ── */}
          <div className="flex flex-col gap-1.5 p-2 border-r border-white/8 bg-[#0a0a0a] w-14 items-center shrink-0 relative z-30">
            {TOOLS.map(t => (
              <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${tool===t.id?'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]':'text-zinc-500 hover:bg-white/5'}`}>
                {t.icon}
              </button>
            ))}
            <div className="h-px w-8 bg-white/10 my-1"/>
            <button onClick={undo} title="Deshacer (Ctrl+Z)" className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:bg-white/5 hover:text-white">
              <Undo2 size={14}/>
            </button>
            <button onClick={resetTexture} title="Reiniciar textura" className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:bg-white/5">
              <RotateCcw size={14}/>
            </button>
            <button onClick={exportRPF} disabled={exporting} title="Descargar RPF para FiveM mods/"
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${exporting?'text-yellow-400 bg-yellow-500/10 animate-pulse cursor-wait':'text-zinc-500 hover:text-white hover:bg-green-500/20'}`}>
              <Download size={14}/>
            </button>
          </div>

          {/* ── VIEWPORT AREA ── */}
          <div className="flex-1 relative overflow-hidden">

            {/* 3D Viewport — always in DOM, hidden in 2D mode */}
            <div
              ref={mountRef}
              className={`absolute inset-0 ${stickerActive ? 'cursor-crosshair' : mode==='rotate' ? 'cursor-grab' : 'cursor-crosshair'}`}
              style={{display: viewMode==='3d' ? 'block' : 'none'}}
              onMouseDown={stickerActive ? onStickerViewportDown : on3DDown}
              onMouseMove={stickerActive ? onStickerViewportMove : on3DMove}
              onMouseUp={stickerActive ? onStickerViewportUp : onUp}
              onMouseLeave={stickerActive ? onStickerViewportUp : onUp}
              onTouchStart={onTouch3DDown} onTouchMove={onTouch3DMove} onTouchEnd={onUp}>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <div className="text-xs text-zinc-400 font-black uppercase tracking-widest animate-pulse bg-black/70 px-4 py-2 rounded-xl">Cargando...</div>
                </div>
              )}
              {!hasModel && !loading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <div className="bg-black/80 border border-white/10 rounded-2xl p-6 max-w-sm text-center space-y-2">
                    <p className="text-sm font-bold">Sin modelo 3D</p>
                    <p className="text-[11px] text-zinc-400">Usa <span className="text-purple-400 font-bold">🗺️ UV 2D</span> para pintar sin modelo.<br/>Para 3D, exporta <code className="bg-white/10 px-1 rounded">{weapon.id}.ydr</code> desde CodeWalker como OBJ y ponlo en <code className="bg-white/10 px-1 rounded">public/models/</code></p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                  stickerActive ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                  : mode==='paint' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {stickerActive
                    ? '🖼️ Arrastra el sticker sobre el arma · Gira cámara con OrbitControls · Ajusta tamaño · ✅ Sellar'
                    : mode==='paint' ? 'MODO PINTURA — Click para pintar' : 'MODO ROTACIÓN — Arrastra para rotar'}
                </div>
              </div>
            </div>

            {/* 2D UV Canvas */}
            {viewMode === '2d' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]"
                style={{backgroundImage:'repeating-conic-gradient(#1a1a1a 0% 25%, #111 0% 50%)', backgroundSize:'20px 20px'}}>
                {/* Wrapper sized to the canvas so sticker overlay aligns 1:1 with UV coords */}
                <div style={{position:'relative', display:'inline-block', lineHeight:0}}>
                  <canvas
                    ref={uv2DRef}
                    width={TEX}
                    height={TEX}
                    style={{maxWidth:'100%', maxHeight:'calc(100vh - 180px)', display:'block', cursor: stickerActive ? 'default' : 'crosshair', imageRendering:'pixelated', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 0 40px rgba(0,0,0,0.8)'}}
                    onMouseDown={stickerActive ? undefined : on2DDown}
                    onMouseMove={stickerActive ? undefined : on2DMove}
                    onMouseUp={onUp} onMouseLeave={onUp}
                    onTouchStart={stickerActive ? undefined : onTouch2DDown}
                    onTouchMove={stickerActive ? undefined : onTouch2DMove}
                    onTouchEnd={onUp}
                  />
                  {/* Sticker overlay — draggable, positioned in UV % coords */}
                  {stickerActive && stickerSrc && (
                    <img
                      src={stickerSrc}
                      alt="sticker"
                      draggable={false}
                      onMouseDown={onStickerPointerDown}
                      style={{
                        position: 'absolute',
                        left: `${stickerX * 100}%`,
                        top:  `${stickerY * 100}%`,
                        width: `${stickerScale * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        cursor: 'grab',
                        userSelect: 'none',
                        outline: '2px dashed rgba(255,255,255,0.7)',
                        outlineOffset: 2,
                        borderRadius: 2,
                        pointerEvents: 'all',
                        imageRendering: 'auto',
                      }}
                    />
                  )}
                </div>
                <div className="mt-2 text-[10px] font-black uppercase tracking-widest" style={{color: stickerActive ? '#facc15' : 'rgba(192,132,252,0.7)' }}>
                  {stickerActive ? '🖼️ ARRASTRA EL STICKER — ajusta tamaño en el panel derecho — pulsa ✅ SELLAR' : 'UV MAP — pinta directamente sobre la textura'}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="w-52 border-l border-white/8 bg-[#0a0a0a] p-3 flex flex-col gap-3 overflow-y-auto shrink-0 relative z-30">

            {/* suppressor section removed */}
            {false && (
              <div className={`border rounded-xl p-3 transition-all ${suppEnabled ? 'bg-zinc-800/60 border-zinc-500/40' : 'bg-white/3 border-white/8'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Crosshair size={11} className={suppEnabled ? 'text-zinc-300' : 'text-zinc-600'}/>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Silenciador</span>
                  </div>
                  <button
                    onClick={() => setSuppEnabled(v => !v)}
                    className={`w-8 h-4 rounded-full transition-all relative ${suppEnabled ? 'bg-zinc-400' : 'bg-white/10'}`}>
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${suppEnabled ? 'left-[18px]' : 'left-0.5'}`}/>
                  </button>
                </div>

                {suppEnabled && (() => {
                  const opts = getSuppOptions(weapon.id);
                  return (
                    <>
                      {/* Style selector */}
                      <div className="flex gap-1 mb-2">
                        {opts.map((name, i) => (
                          <button key={i} onClick={() => setSuppStyle(i)}
                            className={`flex-1 py-1 text-[9px] font-black rounded-lg transition-all ${
                              suppStyle === i ? 'bg-zinc-500 text-white' : 'bg-white/5 text-zinc-500 hover:bg-white/10'
                            }`}>
                            Estilo {i + 1}
                          </button>
                        ))}
                      </div>

                      {/* Suppressor mini-canvas */}
                      <div className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mb-1">Pintar silenciador</div>
                      <canvas
                        ref={suppCanvasRef}
                        width={SUPP_W}
                        height={SUPP_H}
                        style={{
                          width: '100%',
                          height: 130,
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.2)',
                          cursor: 'crosshair',
                          imageRendering: 'pixelated',
                          background: '#222',
                        }}
                        onMouseDown={onSuppDown}
                        onMouseMove={onSuppMove}
                        onMouseUp={onSuppUp}
                        onMouseLeave={onSuppUp}
                      />

                      {/* Suppressor color swatches */}
                      <div className="grid grid-cols-5 gap-1 mt-1.5">
                        {['#888','#555','#333','#c0a060','#2a4a2a','#1a1a1a','#8b0000','#001830','#d4d4d4','#000'].map(c => (
                          <button key={c} onClick={() => setSuppColor(c)}
                            className={`h-4 rounded hover:scale-110 transition-all ${suppColor===c?'ring-2 ring-white ring-offset-1 ring-offset-black':''}`}
                            style={{backgroundColor:c}}/>
                        ))}
                      </div>
                      <div className="text-[9px] text-zinc-600 mt-1">Color: usa los de arriba o el selector de arma</div>

                      {/* Status indicator */}
                      <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[9px]">
                          <span className="text-zinc-500">Textura activa:</span>
                          <span className={`font-black ${suppPainted ? 'text-yellow-400' : 'text-green-400'}`}>
                            {suppPainted ? '🎨 PINTADA MANUAL' : '✨ ORIGINAL NATIVA'}
                          </span>
                        </div>
                        {suppPainted && (
                          <button onClick={resetSuppCanvas}
                            className="w-full py-1 bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 rounded text-[9px] font-bold transition-all flex items-center justify-center gap-1">
                            🧹 Limpiar y usar Original
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Sticker / Image */}
            <div className="bg-white/3 border border-white/8 rounded-xl p-3">
              <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">🖼️ Sticker / Imagen</div>
              <label className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 hover:border-white/40 rounded-lg cursor-pointer transition-all text-[10px] text-zinc-400 hover:text-white">
                <span>📂 Subir PNG / Sticker</span>
                <input ref={stickerInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files[0]) loadSticker(e.target.files[0]); e.target.value = ''; }} />
              </label>
              {stickerActive && (
                <>
                  <div className="mt-2 text-[9px] text-zinc-500 font-black uppercase tracking-widest">Tamaño</div>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="range" min={0.03} max={0.6} step={0.01} value={stickerScale}
                      onChange={e => setStickerScale(+e.target.value)}
                      className="flex-1 h-1 rounded accent-yellow-400" />
                    <span className="text-[9px] font-black text-yellow-400 w-8 text-right">{Math.round(stickerScale * 100)}%</span>
                  </div>
                  <div className="mt-2 text-[9px] text-zinc-500 font-black uppercase tracking-widest">Rotación</div>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="range" min={0} max={360} step={1} value={stickerRotation}
                      onChange={e => setStickerRotation(+e.target.value)}
                      className="flex-1 h-1 rounded accent-orange-400" />
                    <span className="text-[9px] font-black text-orange-400 w-8 text-right">{stickerRotation}°</span>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <button onClick={stampSticker}
                      className="flex-1 py-1.5 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-lg text-[10px] font-black transition-all border border-green-500/30">
                      ✅ Sellar
                    </button>
                    <button onClick={cancelSticker}
                      className="flex-1 py-1.5 bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded-lg text-[10px] font-black transition-all">
                      ❌ Cancelar
                    </button>
                  </div>
                  <div className="text-[9px] text-zinc-600 mt-1.5 leading-tight">Arrastra el sticker sobre el arma en el visor 3D. El plano 3D se pega a la superficie y rota con la cámara.</div>
                </>
              )}
            </div>

            {/* Color */}
            <div className="bg-white/3 border border-white/8 rounded-xl p-3">
              <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">Color</div>
              <HexColorPicker color={color} onChange={setColor} style={{width:'100%', height:120}}/>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-6 h-6 rounded-md border border-white/20 shrink-0" style={{backgroundColor:color}}/>
                <span className="text-[10px] font-mono text-zinc-400">{color.toUpperCase()}</span>
              </div>
              {/* Tab selector */}
              <div className="flex rounded-lg border border-white/10 text-[9px] font-black mt-2">
                {[['palette','🎨'],['matte','🪨'],['neon','⚡']].map(([id,icon]) => (
                  <button key={id} onClick={() => setColorTab(id)}
                    className={`flex-1 py-1 transition-colors rounded-lg ${
                      colorTab===id ? 'bg-red-500 text-white' : 'text-zinc-500 hover:text-white'
                    }`}>{icon} {id}</button>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1 mt-2">
                {(colorTab==='matte' ? MATTE_COLORS : colorTab==='neon' ? NEON_COLORS : SWATCHES).map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    className={`h-5 rounded hover:scale-110 transition-all ${color===c?'ring-2 ring-white ring-offset-1 ring-offset-black':''}`}
                    style={{backgroundColor:c}}/>
                ))}
              </div>
            </div>
            {/* Size — hidden for fill */}
            {tool !== 'fill' && (
              <div className="bg-white/3 border border-white/8 rounded-xl p-3">
                <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">Tamaño</div>
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={() => setSize(s => Math.max(2,s-5))} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"><Minus size={11}/></button>
                  <span className="flex-1 text-center font-black">{size}<span className="text-[9px] text-zinc-600 font-normal">px</span></span>
                  <button onClick={() => setSize(s => Math.min(300,s+5))} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"><Plus size={11}/></button>
                </div>
                <input type="range" min={2} max={300} value={size} onChange={e => setSize(+e.target.value)} className="w-full h-1 rounded accent-red-500"/>
              </div>
            )}
            {/* Shape filled toggle */}
            {['rect','ellipse'].includes(tool) && (
              <div className="bg-white/3 border border-white/8 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Relleno</span>
                  <button onClick={() => setShapeFilled(v => !v)}
                    className={`w-8 h-4 rounded-full transition-all relative ${shapeFilled ? 'bg-red-500' : 'bg-white/10'}`}>
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${shapeFilled ? 'left-[18px]' : 'left-0.5'}`}/>
                  </button>
                </div>
              </div>
            )}
            {/* Pattern picker */}
            {tool === 'pattern' && (
              <div className="bg-white/3 border border-white/8 rounded-xl p-3">
                <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Patrón</div>
                <div className="text-[9px] text-zinc-600 mb-2 leading-tight">Arrastra sobre el arma para pintar con el patrón</div>
                <div className="grid grid-cols-2 gap-1 overflow-y-auto pr-1" style={{maxHeight: '160px'}}>
                  {PATTERNS.map(p => (
                    <button key={p.id}
                      onClick={() => setPatternType(p.id)}
                      className={`text-left px-2 py-1.5 rounded-lg text-[9px] transition-all flex items-center justify-between truncate ${
                        patternType===p.id ? 'bg-red-500 text-white font-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                      }`}>
                      <span className="truncate">{p.label}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => applyPattern(patternType)}
                  className="mt-2 w-full py-1.5 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 rounded-lg text-[9px] font-black transition-all">
                  🖨️ Rellenar todo el arma
                </button>
              </div>
            )}
            {/* Opacity */}
            {tool!=='eraser' && (
              <div className="bg-white/3 border border-white/8 rounded-xl p-3">
                <div className="flex justify-between text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">
                  <span>Opacidad</span><span className="text-white">{opacity}%</span>
                </div>
                <input type="range" min={5} max={100} value={opacity} onChange={e => setOpacity(+e.target.value)} className="w-full h-1 rounded accent-red-500"/>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
