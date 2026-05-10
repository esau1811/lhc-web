'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Header from '@/components/Header';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Paintbrush, Eraser, Download, RotateCcw, ChevronDown, AlertTriangle, Minus, Plus } from 'lucide-react';

const WEAPONS = [
  { id: 'w_pi_combatpistol', name: 'Combat Pistol', cat: 'Pistola' },
  { id: 'w_pi_pistol',       name: 'Pistol',         cat: 'Pistola' },
  { id: 'w_pi_pistolmk2',    name: 'Pistol MK2',     cat: 'Pistola' },
  { id: 'w_ar_assaultrifle', name: 'Assault Rifle',  cat: 'Rifle'   },
  { id: 'w_ar_carbinerifle', name: 'Carbine Rifle',  cat: 'Rifle'   },
  { id: 'w_sg_pumpshotgun',  name: 'Pump Shotgun',   cat: 'Escopeta'},
  { id: 'w_sr_sniperrifle',  name: 'Sniper Rifle',   cat: 'Sniper'  },
  { id: 'w_mg_combatmg',     name: 'Combat MG',      cat: 'MG'      },
];

const PRESET_COLORS = ['#ffffff','#000000','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];
const TEX_SIZE = 1024;

export default function SkinForge3D() {
  const mountRef   = useRef(null);
  const rendRef    = useRef(null);
  const sceneRef   = useRef(null);
  const camRef     = useRef(null);
  const ctrlRef    = useRef(null);
  const meshRef    = useRef(null);  // current weapon mesh
  const texCanRef  = useRef(null);  // offscreen paint canvas
  const threeTexRef= useRef(null);  // THREE.CanvasTexture
  const baseImgRef = useRef(null);  // base weapon PNG
  const paintingRef= useRef(false);
  const rafRef     = useRef(null);

  const [weapon,    setWeapon]    = useState(WEAPONS[0]);
  const [tool,      setTool]      = useState('brush');
  const [color,     setColor]     = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(24);
  const [opacity,   setOpacity]   = useState(90);
  const [dropOpen,  setDropOpen]  = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [hasModel,  setHasModel]  = useState(false);
  const [status,    setStatus]    = useState('Iniciando...');

  // Init Three.js once
  useEffect(() => {
    const el = mountRef.current; if (!el) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);
    rendRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    sceneRef.current = scene;

    // Grid
    const grid = new THREE.GridHelper(1, 20, 0x333333, 0x222222);
    grid.position.y = -0.1;
    scene.add(grid);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dir1.position.set(1, 2, 2);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0x8888ff, 0.3);
    dir2.position.set(-1, -1, -1);
    scene.add(dir2);

    // Camera
    const cam = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.001, 100);
    cam.position.set(0, 0.05, 0.35);
    camRef.current = cam;

    // Controls
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 0.05;
    controls.maxDistance = 2;
    ctrlRef.current = controls;

    // Offscreen paint canvas
    const texCanvas = document.createElement('canvas');
    texCanvas.width = TEX_SIZE; texCanvas.height = TEX_SIZE;
    texCanRef.current = texCanvas;

    // Render loop
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, cam);
    };
    animate();

    // Resize
    const onResize = () => {
      if (!el) return;
      renderer.setSize(el.clientWidth, el.clientHeight);
      cam.aspect = el.clientWidth / el.clientHeight;
      cam.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  // Load weapon when changed
  useEffect(() => {
    loadWeapon(weapon.id);
  }, [weapon]);

  const loadWeapon = useCallback((id) => {
    const scene = sceneRef.current; if (!scene) return;
    setLoading(true); setHasModel(false);

    // Remove old mesh
    if (meshRef.current) { scene.remove(meshRef.current); meshRef.current = null; }

    // Load base texture PNG first
    const texCanvas = texCanRef.current;
    const ctx = texCanvas.getContext('2d');

    const baseImg = new Image();
    baseImg.onload = () => {
      baseImgRef.current = baseImg;
      ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
      ctx.drawImage(baseImg, 0, 0, TEX_SIZE, TEX_SIZE);

      const threeTex = new THREE.CanvasTexture(texCanvas);
      threeTex.flipY = false;
      threeTexRef.current = threeTex;

      // Load OBJ
      const loader = new OBJLoader();
      setStatus('Cargando modelo 3D...');
      loader.load(
        `/models/${id}.obj`,
        (obj) => {
          obj.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material = new THREE.MeshStandardMaterial({
                map: threeTex,
                roughness: 0.6,
                metalness: 0.4,
              });
            }
          });
          // Center + scale
          const box = new THREE.Box3().setFromObject(obj);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          obj.position.sub(center);
          scene.add(obj);
          meshRef.current = obj;
          setLoading(false); setHasModel(true);
          setStatus(`${id} — ${Math.round(maxDim*100)}cm`);
        },
        undefined,
        (err) => {
          setLoading(false);
          setStatus('Modelo 3D no disponible — exporta el .ydr desde CodeWalker');
          // Still show texture-only mode
          drawFallback(ctx, id);
          const t = new THREE.CanvasTexture(texCanvas); t.flipY=false;
          threeTexRef.current = t;
        }
      );
    };
    baseImg.onerror = () => {
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(0,0,TEX_SIZE,TEX_SIZE);
      baseImgRef.current = null;
      setLoading(false);
      setStatus('Sin textura base');
    };
    baseImg.crossOrigin = 'anonymous';
    baseImg.src = `/weapons/${id}.png`;
  }, []);

  const drawFallback = (ctx, id) => {
    ctx.fillStyle='#1a1a1a'; ctx.fillRect(0,0,TEX_SIZE,TEX_SIZE);
    ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.font='bold 20px monospace';
    ctx.fillText(`${id} — exporta .ydr desde CodeWalker`, 40, TEX_SIZE/2);
  };

  // 3D painting via raycasting
  const paintAt3D = useCallback((clientX, clientY) => {
    const el = mountRef.current;
    const cam = camRef.current;
    const mesh = meshRef.current;
    const renderer = rendRef.current;
    const texCanvas = texCanRef.current;
    const threeTex = threeTexRef.current;
    if (!el || !cam || !mesh || !renderer || !texCanvas || !threeTex) return;

    const rect = el.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width)  *  2 - 1;
    const ndcY = ((clientY - rect.top)  / rect.height) * -2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);

    const hits = [];
    mesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const res = raycaster.intersectObject(child, false);
        hits.push(...res);
      }
    });

    if (hits.length === 0) return;
    const hit = hits.sort((a,b) => a.distance - b.distance)[0];
    if (!hit.uv) return;

    const u = hit.uv.x;
    const v = 1 - hit.uv.y; // flip Y for canvas

    const px = u * TEX_SIZE;
    const py = v * TEX_SIZE;

    const ctx = texCanvas.getContext('2d');
    ctx.globalAlpha = opacity / 100;
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';

    if (tool === 'eraser') {
      // Restore base texture under eraser
      if (baseImgRef.current) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.beginPath();
        ctx.arc(px, py, brushSize, 0, Math.PI * 2);
        ctx.fill();
        // Redraw base
        ctx.globalCompositeOperation = 'destination-over';
        ctx.drawImage(baseImgRef.current, 0, 0, TEX_SIZE, TEX_SIZE);
        ctx.globalCompositeOperation = 'source-over';
      }
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    threeTex.needsUpdate = true;
  }, [tool, color, brushSize, opacity]);

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    paintingRef.current = true;
    paintAt3D(e.clientX, e.clientY);
  }, [paintAt3D]);

  const onMouseMove = useCallback((e) => {
    if (!paintingRef.current) return;
    paintAt3D(e.clientX, e.clientY);
  }, [paintAt3D]);

  const onMouseUp = useCallback(() => { paintingRef.current = false; }, []);

  const onTouchStart = useCallback((e) => {
    paintingRef.current = true;
    paintAt3D(e.touches[0].clientX, e.touches[0].clientY);
  }, [paintAt3D]);

  const onTouchMove = useCallback((e) => {
    if (!paintingRef.current) return;
    e.preventDefault();
    paintAt3D(e.touches[0].clientX, e.touches[0].clientY);
  }, [paintAt3D]);

  const resetTexture = useCallback(() => {
    const texCanvas = texCanRef.current;
    const threeTex = threeTexRef.current;
    if (!texCanvas || !threeTex) return;
    const ctx = texCanvas.getContext('2d');
    ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
    if (baseImgRef.current) ctx.drawImage(baseImgRef.current, 0, 0, TEX_SIZE, TEX_SIZE);
    threeTex.needsUpdate = true;
  }, []);

  const exportPNG = useCallback(() => {
    const texCanvas = texCanRef.current; if (!texCanvas) return;
    const a = document.createElement('a');
    a.download = `${weapon.id}_custom.png`;
    a.href = texCanvas.toDataURL('image/png');
    a.click();
  }, [weapon]);

  // Toggle paint vs orbit: hold Alt for orbit
  const [altDown, setAltDown] = useState(false);
  useEffect(() => {
    const kd = (e) => { if (e.key === 'Alt') setAltDown(true); };
    const ku = (e) => { if (e.key === 'Alt') setAltDown(false); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  // Enable/disable OrbitControls based on Alt key
  useEffect(() => {
    if (ctrlRef.current) ctrlRef.current.enabled = altDown;
  }, [altDown]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Header/>
      <div className="pt-16 flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-white/8 bg-black/40">
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full text-[9px] font-black text-yellow-400 uppercase">
            <AlertTriangle size={9}/> Mantén ALT para rotar · Click para pintar
          </div>
          {/* Weapon selector */}
          <div className="relative ml-2">
            <button onClick={()=>setDropOpen(o=>!o)}
              className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-red-500/40 rounded-lg px-3 py-1.5 text-xs font-bold">
              <span className="text-zinc-400 text-[9px]">{weapon.cat}</span>
              <span>{weapon.name}</span>
              <ChevronDown size={12} className={dropOpen?'rotate-180 text-zinc-400':'text-zinc-400'}/>
            </button>
            {dropOpen && (
              <div className="absolute top-full mt-1 left-0 bg-[#111] border border-white/10 rounded-xl z-50 w-52 shadow-2xl overflow-hidden">
                {WEAPONS.map(w=>(
                  <button key={w.id} onClick={()=>{setWeapon(w);setDropOpen(false);}}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 ${weapon.id===w.id?'text-red-400':''}`}>
                    <span className="text-zinc-500 text-[9px] mr-1">{w.cat}</span>{w.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="text-[10px] text-zinc-600 ml-auto">{status}</div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left toolbar */}
          <div className="flex flex-col gap-2 p-2 border-r border-white/8 bg-black/20 w-14 items-center">
            {[{id:'brush',icon:<Paintbrush size={16}/>},{id:'eraser',icon:<Eraser size={16}/>}].map(t=>(
              <button key={t.id} onClick={()=>setTool(t.id)} title={t.id}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${tool===t.id?'bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]':'text-zinc-500 hover:bg-white/5'}`}>
                {t.icon}
              </button>
            ))}
            <div className="h-px w-8 bg-white/10 my-1"/>
            <button onClick={resetTexture} title="Reset" className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:bg-white/5">
              <RotateCcw size={15}/>
            </button>
            <button onClick={exportPNG} title="Export" className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-red-500/20">
              <Download size={15}/>
            </button>
          </div>

          {/* 3D viewport */}
          <div
            ref={mountRef}
            className={`flex-1 relative ${altDown?'cursor-grab':'cursor-crosshair'}`}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onMouseUp}
          >
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div className="text-xs text-zinc-400 font-black uppercase tracking-widest animate-pulse bg-black/60 px-4 py-2 rounded-xl">
                  Cargando...
                </div>
              </div>
            )}
            {!hasModel && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                <div className="bg-black/80 border border-white/10 rounded-2xl p-6 max-w-sm text-center space-y-3">
                  <div className="text-2xl">🔫</div>
                  <p className="text-sm font-bold">Modelo 3D no disponible</p>
                  <p className="text-[11px] text-zinc-400">Exporta <code className="bg-white/10 px-1 rounded">{weapon.id}.ydr</code> desde CodeWalker → Export XML y ponlo en la carpeta <code className="bg-white/10 px-1 rounded">prueba/</code></p>
                </div>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="w-52 border-l border-white/8 bg-black/20 p-3 flex flex-col gap-3 overflow-y-auto">
            {/* Color */}
            <div className="bg-white/3 border border-white/8 rounded-xl p-3">
              <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">Color</div>
              <div className="flex items-center gap-2 mb-2">
                <input type="color" value={color} onChange={e=>setColor(e.target.value)}
                  className="w-9 h-9 rounded-lg border-0 cursor-pointer bg-transparent"/>
                <span className="text-[10px] font-mono">{color.toUpperCase()}</span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {PRESET_COLORS.map(c=>(
                  <button key={c} onClick={()=>setColor(c)}
                    className={`w-8 h-8 rounded-lg hover:scale-110 transition-all ${color===c?'ring-2 ring-white ring-offset-1 ring-offset-black':''}`}
                    style={{backgroundColor:c}}/>
                ))}
              </div>
            </div>
            {/* Brush size */}
            <div className="bg-white/3 border border-white/8 rounded-xl p-3">
              <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">Tamaño pincel</div>
              <div className="flex items-center gap-2">
                <button onClick={()=>setBrushSize(s=>Math.max(2,s-4))} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"><Minus size={11}/></button>
                <span className="flex-1 text-center font-black text-lg">{brushSize}<span className="text-[9px] text-zinc-600 font-normal">px</span></span>
                <button onClick={()=>setBrushSize(s=>Math.min(200,s+4))} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"><Plus size={11}/></button>
              </div>
              <input type="range" min={2} max={200} value={brushSize} onChange={e=>setBrushSize(+e.target.value)}
                className="w-full mt-2 h-1 rounded accent-red-500"/>
            </div>
            {/* Opacity */}
            <div className="bg-white/3 border border-white/8 rounded-xl p-3">
              <div className="flex justify-between text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">
                <span>Opacidad</span><span className="text-white">{opacity}%</span>
              </div>
              <input type="range" min={5} max={100} value={opacity} onChange={e=>setOpacity(+e.target.value)}
                className="w-full h-1 rounded accent-red-500"/>
            </div>
            {/* Instructions */}
            <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-[10px] text-zinc-400 space-y-1.5">
              <p className="text-[9px] font-black text-zinc-300 uppercase">Cómo usar</p>
              <p>🖱️ <b>Click + arrastrar</b> → pintar</p>
              <p>⌨️ <b>Alt + arrastrar</b> → rotar</p>
              <p>🖱️ <b>Scroll</b> → zoom</p>
              <p>💾 <b>Export</b> → PNG listo para CodeWalker</p>
            </div>
            {/* Export more weapons */}
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-[10px] text-zinc-400">
              <p className="text-[9px] font-black text-blue-400 uppercase mb-1.5">Añadir más armas</p>
              <p>En CodeWalker: abre <b>.ydr</b> → Export XML → guarda en <code className="bg-white/10 px-1 rounded">prueba/</code></p>
              <p className="mt-1">Ejecuta el conversor y recarga.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
