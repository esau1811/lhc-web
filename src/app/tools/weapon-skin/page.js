'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Header from '@/components/Header';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Paintbrush, Eraser, Download, RotateCcw, Undo2, ChevronDown, AlertTriangle, Minus, Plus, Droplets, Wind } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';

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

const SWATCHES = ['#ffffff','#000000','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#78716c'];
const TEX = 1024;

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
  const paintRef   = useRef(false);
  const lastUVRef  = useRef(null);
  const historyRef = useRef([]);

  const [weapon,    setWeapon]    = useState(WEAPONS[0]);
  const [tool,      setTool]      = useState('brush');
  const [color,     setColor]     = useState('#ef4444');
  const [size,      setSize]      = useState(50);
  const [opacity,   setOpacity]   = useState(90);
  const [mode,      setMode]      = useState('paint');  // 'paint' | 'rotate' (3D only)
  const [viewMode,  setViewMode]  = useState('3d');     // '3d' | '2d'
  const [dropOpen,  setDropOpen]  = useState(false);
  const [dropPos,   setDropPos]   = useState({ top: 0, left: 0 });
  const [loading,   setLoading]   = useState(true);
  const [hasModel,  setHasModel]  = useState(false);
  const [status,    setStatus]    = useState('Cargando...');
  const [exporting, setExporting] = useState(false);

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

    const onResize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      cam.aspect = el.clientWidth/el.clientHeight;
      cam.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); renderer.dispose(); el.innerHTML=''; };
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
        setLoading(false); setHasModel(true);
        setStatus(id);
      },
      undefined,
      () => { setLoading(false); setStatus('Sin modelo 3D — usa modo UV 2D para pintar'); }
    );
  };

  // ---- PAINT CORE ----
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
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    tt.needsUpdate = true;
  }, [tool, color, size, opacity]);

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
  const getUV3D = useCallback((clientX, clientY) => {
    const el = mountRef.current; const cam = camRef.current; const mesh = meshRef.current;
    if (!el || !cam || !mesh) return null;
    const r = el.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX-r.left)/r.width)*2-1, -((clientY-r.top)/r.height)*2+1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, cam);
    const camDir = new THREE.Vector3(); cam.getWorldDirection(camDir);
    const hits = []; let closestDist = Infinity;
    mesh.traverse(c => {
      if (!c.isMesh) return;
      for (const hit of ray.intersectObject(c, false)) {
        if (!hit.face) { hits.push(hit); continue; }
        const wn = hit.face.normal.clone().transformDirection(c.matrixWorld);
        if (wn.dot(camDir) < 0) {
          if (hit.distance < closestDist) { closestDist = hit.distance; hits.length = 0; hits.push(hit); }
          else if (Math.abs(hit.distance - closestDist) < 0.05) hits.push(hit);
        }
      }
    });
    return hits[0]?.uv ?? null;
  }, []);

  const on3DDown = useCallback((e) => {
    if (mode==='rotate') return;
    e.preventDefault(); saveHistory(); paintRef.current = true;
    applyPaint(getUV3D(e.clientX, e.clientY));
  }, [mode, getUV3D, applyPaint]);

  const on3DMove = useCallback((e) => {
    if (!paintRef.current || mode==='rotate') return;
    e.preventDefault(); applyPaint(getUV3D(e.clientX, e.clientY));
  }, [mode, getUV3D, applyPaint]);

  const onUp = useCallback(() => { paintRef.current = false; lastUVRef.current = null; }, []);

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
    e.preventDefault(); saveHistory(); paintRef.current = true;
    applyPaint(getUV2D(e.clientX, e.clientY));
    syncUV2D();
  }, [getUV2D, applyPaint, syncUV2D]);

  const on2DMove = useCallback((e) => {
    if (!paintRef.current) return;
    e.preventDefault(); applyPaint(getUV2D(e.clientX, e.clientY)); syncUV2D();
  }, [getUV2D, applyPaint, syncUV2D]);

  const onTouch2DDown = useCallback((e) => { if(e.touches[0]) on2DDown({clientX:e.touches[0].clientX,clientY:e.touches[0].clientY,preventDefault:()=>{}}); }, [on2DDown]);
  const onTouch2DMove = useCallback((e) => { e.preventDefault(); if(e.touches[0]) on2DMove({clientX:e.touches[0].clientX,clientY:e.touches[0].clientY,preventDefault:()=>{}}); }, [on2DMove]);

  // ---- RESET ----
  const resetTexture = () => {
    const tc=tcRef.current; const tt=ttRef.current; if(!tc||!tt)return;
    const ctx=tc.getContext('2d'); ctx.clearRect(0,0,TEX,TEX);
    if(baseRef.current) ctx.drawImage(baseRef.current,0,0,TEX,TEX);
    tt.needsUpdate=true; syncUV2D();
  };

  // ---- EXPORT RPF ----
  const exportRPF = async () => {
    const tc = tcRef.current; if (!tc || exporting) return;
    setExporting(true); setStatus('Generando RPF...');
    try {
      const W = weapon.texW || 512, H = weapon.texH || 512;
      const tmp = document.createElement('canvas');
      tmp.width = W; tmp.height = H;
      tmp.getContext('2d').drawImage(tc, 0, 0, W, H);
      const imgData = tmp.getContext('2d').getImageData(0, 0, W, H);
      let binary = '';
      const bytes = imgData.data;
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK)
        binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
      const b64 = btoa(binary);
      const res = await fetch('/api/generate-rpf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weaponName: weapon.id, width: W, height: H, pixels: b64 }),
      });
      if (!res.ok) { const err = await res.json(); setStatus('Error: ' + (err.error || res.statusText)); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = `${weapon.id}_skin.zip`; a.href = url; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus('ZIP descargado — extrae en FiveM.app/');
    } catch(e) {
      setStatus('Error: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  const TOOLS = [
    { id:'brush',  icon:<Paintbrush size={15}/>, label:'Pincel'   },
    { id:'spray',  icon:<Wind size={15}/>,       label:'Spray'    },
    { id:'fill',   icon:<Droplets size={15}/>,   label:'Relleno'  },
    { id:'eraser', icon:<Eraser size={15}/>,     label:'Borrador' },
  ];

  // Group weapons by category for dropdown
  const cats = [...new Set(WEAPONS.map(w => w.cat))];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
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
                          onClick={() => { setWeapon(w); setDropOpen(false); }}
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
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* ── LEFT TOOLS ── */}
          <div className="flex flex-col gap-1.5 p-2 border-r border-white/8 bg-black/20 w-14 items-center shrink-0">
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
              className={`absolute inset-0 ${mode==='rotate'?'cursor-grab':'cursor-crosshair'}`}
              style={{display: viewMode==='3d' ? 'block' : 'none'}}
              onMouseDown={on3DDown} onMouseMove={on3DMove} onMouseUp={onUp} onMouseLeave={onUp}
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
                <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${mode==='paint'?'bg-red-500/20 text-red-400 border border-red-500/30':'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                  {mode==='paint'?'MODO PINTURA — Click para pintar':'MODO ROTACIÓN — Arrastra para rotar'}
                </div>
              </div>
            </div>

            {/* 2D UV Canvas */}
            {viewMode === '2d' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]"
                style={{backgroundImage:'repeating-conic-gradient(#1a1a1a 0% 25%, #111 0% 50%)', backgroundSize:'20px 20px'}}>
                <canvas
                  ref={uv2DRef}
                  width={TEX}
                  height={TEX}
                  style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain', cursor:'crosshair', imageRendering:'pixelated', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 0 40px rgba(0,0,0,0.8)'}}
                  onMouseDown={on2DDown} onMouseMove={on2DMove} onMouseUp={onUp} onMouseLeave={onUp}
                  onTouchStart={onTouch2DDown} onTouchMove={onTouch2DMove} onTouchEnd={onUp}
                />
                <div className="mt-2 text-[10px] text-purple-400/70 font-black uppercase tracking-widest">UV MAP — pinta directamente sobre la textura</div>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="w-52 border-l border-white/8 bg-black/20 p-3 flex flex-col gap-3 overflow-y-auto shrink-0">
            {/* Color */}
            <div className="bg-white/3 border border-white/8 rounded-xl p-3">
              <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">Color</div>
              <HexColorPicker color={color} onChange={setColor} style={{width:'100%', height:140}}/>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-6 h-6 rounded-md border border-white/20 shrink-0" style={{backgroundColor:color}}/>
                <span className="text-[10px] font-mono text-zinc-400">{color.toUpperCase()}</span>
              </div>
              <div className="grid grid-cols-5 gap-1 mt-2">
                {SWATCHES.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    className={`h-5 rounded hover:scale-110 transition-all ${color===c?'ring-2 ring-white ring-offset-1 ring-offset-black':''}`}
                    style={{backgroundColor:c}}/>
                ))}
              </div>
            </div>
            {/* Size */}
            {tool!=='fill' && (
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
            {/* Opacity */}
            {tool!=='eraser' && (
              <div className="bg-white/3 border border-white/8 rounded-xl p-3">
                <div className="flex justify-between text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">
                  <span>Opacidad</span><span className="text-white">{opacity}%</span>
                </div>
                <input type="range" min={5} max={100} value={opacity} onChange={e => setOpacity(+e.target.value)} className="w-full h-1 rounded accent-red-500"/>
              </div>
            )}
            {/* Install guide */}
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3 text-[10px] text-zinc-400 space-y-1.5">
              <p className="text-[9px] font-black text-green-400 uppercase">📥 Instalar en FiveM</p>
              <p>1. Descarga el ZIP con el botón <b>↓</b></p>
              <p>2. Extrae en tu carpeta <code className="bg-white/10 px-1 rounded">FiveM.app\</code></p>
              <p className="font-mono text-[9px] break-all text-zinc-500">FiveM.app\mods\{weapon.id}.rpf</p>
              <p>3. Reinicia FiveM</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
