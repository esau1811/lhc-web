'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Header from '@/components/Header';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Paintbrush, Eraser, Download, RotateCcw, ChevronDown, AlertTriangle, Minus, Plus, Droplets, Wind } from 'lucide-react';

const WEAPONS = [
  { id: 'w_pi_combatpistol', name: 'Combat Pistol', cat: 'Pistola' },
  { id: 'w_pi_pistol',       name: 'Pistol',        cat: 'Pistola' },
  { id: 'w_ar_assaultrifle', name: 'Assault Rifle', cat: 'Rifle'   },
  { id: 'w_sg_pumpshotgun',  name: 'Pump Shotgun',  cat: 'Escopeta'},
  { id: 'w_sr_sniperrifle',  name: 'Sniper Rifle',  cat: 'Sniper'  },
];

const PRESETS = ['#ffffff','#000000','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#78716c','#a16207'];
const TEX = 1024;

export default function SkinForge3D() {
  const mountRef  = useRef(null);
  const rendRef   = useRef(null);
  const sceneRef  = useRef(null);
  const camRef    = useRef(null);
  const ctrlRef   = useRef(null);
  const meshRef   = useRef(null);
  const tcRef     = useRef(null);   // paint canvas
  const ttRef     = useRef(null);   // THREE.CanvasTexture
  const baseRef   = useRef(null);   // base Image
  const paintRef  = useRef(false);
  const lastUVRef = useRef(null);

  const [weapon,    setWeapon]    = useState(WEAPONS[0]);
  const [tool,      setTool]      = useState('brush');
  const [color,     setColor]     = useState('#ef4444');
  const [size,      setSize]      = useState(50);
  const [opacity,   setOpacity]   = useState(90);
  const [mode,      setMode]      = useState('paint'); // 'paint' | 'rotate'
  const [dropOpen,  setDropOpen]  = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [hasModel,  setHasModel]  = useState(false);
  const [status,    setStatus]    = useState('Cargando...');

  // Init Three.js once
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
    ctrl.enabled = false; // paint mode by default
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

  useEffect(() => { if (ctrlRef.current) ctrlRef.current.enabled = (mode === 'rotate'); }, [mode]);

  useEffect(() => { loadWeapon(weapon.id); }, [weapon.id]);

  const loadWeapon = useCallback((id) => {
    const scene = sceneRef.current; if (!scene) return;
    setLoading(true); setHasModel(false); setStatus('Cargando textura...');
    if (meshRef.current) { scene.remove(meshRef.current); meshRef.current = null; }

    const tc = tcRef.current;
    const ctx = tc.getContext('2d');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      baseRef.current = img;
      ctx.clearRect(0,0,TEX,TEX);
      ctx.drawImage(img,0,0,TEX,TEX);
      buildMesh(id, tc, ctx);
    };
    img.onerror = () => {
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(0,0,TEX,TEX);
      baseRef.current = null;
      buildMesh(id, tc, ctx);
    };
    img.src = `/weapons/${id}.png`;
  }, []);

  const buildMesh = (id, tc, ctx) => {
    const scene = sceneRef.current;
    const tt = new THREE.CanvasTexture(tc);
    tt.flipY = true;   // standard Three.js — texture Y flipped vs UV
    ttRef.current = tt;

    setStatus('Cargando modelo 3D...');
    new OBJLoader().load(
      `/models/${id}.obj`,
      (obj) => {
        obj.traverse(c => {
          if (c.isMesh) {
            c.material = new THREE.MeshStandardMaterial({
              map: tt,
              side: THREE.FrontSide, // FrontSide only — DoubleSide causa pintura en caras traseras con mismas UVs
              roughness: 0.55,
              metalness: 0.4,
            });
            c.geometry.computeVertexNormals();
          }
        });
        const box = new THREE.Box3().setFromObject(obj);
        obj.position.sub(box.getCenter(new THREE.Vector3()));
        sceneRef.current.add(obj);
        meshRef.current = obj;
        setLoading(false); setHasModel(true);
        setStatus(`${id}`);
      },
      undefined,
      () => { setLoading(false); setStatus('Sin modelo — exporta el .ydr desde CodeWalker'); }
    );
  };

  // ---- PAINTING ----
  const getUV = useCallback((clientX, clientY) => {
    const el = mountRef.current; const cam = camRef.current; const mesh = meshRef.current;
    if (!el || !cam || !mesh) return null;
    const r = el.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX-r.left)/r.width)*2-1,
      -((clientY-r.top)/r.height)*2+1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, cam);
    const hits = [];
    mesh.traverse(c => { if (c.isMesh) hits.push(...ray.intersectObject(c, false)); });
    hits.sort((a,b)=>a.distance-b.distance);
    return hits[0]?.uv ?? null;
  }, []);

  const applyPaint = useCallback((uv) => {
    const tc = tcRef.current; const tt = ttRef.current;
    if (!tc || !tt || !uv) return;
    const ctx = tc.getContext('2d');

    // UV → canvas. Three.js flipY=true: UV.y=0 = bottom of image = bottom of canvas (high y)
    const cx = uv.x * TEX;
    const cy = (1 - uv.y) * TEX;

    ctx.globalAlpha = opacity / 100;
    ctx.globalCompositeOperation = 'source-over';

    if (tool === 'eraser') {
      // Erase paint layer only, restore base texture underneath
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(cx, cy, size, 0, Math.PI*2); ctx.fill();
      if (baseRef.current) {
        ctx.globalCompositeOperation = 'destination-over';
        ctx.globalAlpha = 1;
        ctx.drawImage(baseRef.current, 0, 0, TEX, TEX);
      }
    } else if (tool === 'brush') {
      // Single dot per raycast hit — NO UV interpolation to avoid seam bleed
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
    const sr=d[idx(sx,sy)],sg=d[idx(sx,sy)+1],sb=d[idx(sx,sy)+2],sa=d[idx(sx,sy)+3];
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

  const onDown = useCallback((e) => {
    if (mode==='rotate') return;
    e.preventDefault(); paintRef.current = true;
    const uv = getUV(e.clientX, e.clientY); applyPaint(uv);
  }, [mode, getUV, applyPaint]);

  const onMove = useCallback((e) => {
    if (!paintRef.current || mode==='rotate') return;
    e.preventDefault();
    const uv = getUV(e.clientX, e.clientY); applyPaint(uv);
  }, [mode, getUV, applyPaint]);

  const onUp = useCallback(()=>{ paintRef.current=false; lastUVRef.current=null; },[]);

  const onTouchDown = useCallback((e)=>{ if(e.touches[0]) onDown({clientX:e.touches[0].clientX,clientY:e.touches[0].clientY,preventDefault:()=>{}}); },[onDown]);
  const onTouchMove = useCallback((e)=>{ e.preventDefault(); if(e.touches[0]) onMove({clientX:e.touches[0].clientX,clientY:e.touches[0].clientY,preventDefault:()=>{}}); },[onMove]);

  const resetTexture = () => {
    const tc=tcRef.current; const tt=ttRef.current; if(!tc||!tt)return;
    const ctx=tc.getContext('2d'); ctx.clearRect(0,0,TEX,TEX);
    if(baseRef.current) ctx.drawImage(baseRef.current,0,0,TEX,TEX);
    tt.needsUpdate=true;
  };

  // ---- DDS EXPORT (browser-side, no server needed) ----
  const canvasToDDS = (canvas, w, h) => {
    // Resize to target dimensions
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').drawImage(canvas, 0, 0, w, h);
    const pixels = tmp.getContext('2d').getImageData(0, 0, w, h).data; // RGBA

    const headerSize = 128; // 4 magic + 124 DDS header
    const buf = new ArrayBuffer(headerSize + w * h * 4);
    const dv = new DataView(buf);
    let o = 0;

    // Magic 'DDS '
    dv.setUint32(o, 0x20534444, true); o += 4;
    // Header
    dv.setUint32(o, 124, true);   o += 4; // dwSize
    dv.setUint32(o, 0x1007, true); o += 4; // dwFlags: CAPS|HEIGHT|WIDTH|PITCH|PIXELFORMAT
    dv.setUint32(o, h, true);     o += 4; // dwHeight
    dv.setUint32(o, w, true);     o += 4; // dwWidth
    dv.setUint32(o, w*4, true);   o += 4; // dwPitchOrLinearSize
    dv.setUint32(o, 0, true);     o += 4; // dwDepth
    dv.setUint32(o, 1, true);     o += 4; // dwMipMapCount = 1
    for (let i=0;i<11;i++){dv.setUint32(o,0,true);o+=4;} // reserved[11]
    // Pixel format (32 bytes)
    dv.setUint32(o, 32, true);         o += 4; // pf.dwSize
    dv.setUint32(o, 0x41, true);       o += 4; // pf.dwFlags: ALPHAPIXELS|RGB
    dv.setUint32(o, 0, true);          o += 4; // pf.dwFourCC (uncompressed)
    dv.setUint32(o, 32, true);         o += 4; // pf.dwRGBBitCount
    dv.setUint32(o, 0x00FF0000, true); o += 4; // pf.dwRBitMask
    dv.setUint32(o, 0x0000FF00, true); o += 4; // pf.dwGBitMask
    dv.setUint32(o, 0x000000FF, true); o += 4; // pf.dwBBitMask
    dv.setUint32(o, 0xFF000000, true); o += 4; // pf.dwAlphaBitMask
    // Caps
    dv.setUint32(o, 0x1000, true); o += 4; // TEXTURE
    dv.setUint32(o, 0, true); o += 4;
    dv.setUint32(o, 0, true); o += 4;
    dv.setUint32(o, 0, true); o += 4;
    dv.setUint32(o, 0, true); o += 4; // reserved2

    // Pixel data: DDS stores BGRA for A8R8G8B8
    for (let i = 0; i < pixels.length; i += 4) {
      dv.setUint8(o++, pixels[i+2]); // B
      dv.setUint8(o++, pixels[i+1]); // G
      dv.setUint8(o++, pixels[i]);   // R
      dv.setUint8(o++, pixels[i+3]); // A
    }
    return buf;
  };

  const exportDDS = () => {
    const tc = tcRef.current; if (!tc) return;
    // Match original texture size (512x512 for this weapon)
    const ddsData = canvasToDDS(tc, 512, 512);
    const blob = new Blob([ddsData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `${weapon.id}_custom.dds`;
    a.href = url; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportPNG = () => {
    const tc=tcRef.current; if(!tc)return;
    const a=document.createElement('a');
    a.download=`${weapon.id}_custom.png`; a.href=tc.toDataURL('image/png'); a.click();
  };

  const TOOLS = [
    {id:'brush',  icon:<Paintbrush size={15}/>, label:'Pincel'},
    {id:'spray',  icon:<Wind size={15}/>,       label:'Spray'},
    {id:'fill',   icon:<Droplets size={15}/>,   label:'Relleno'},
    {id:'eraser', icon:<Eraser size={15}/>,     label:'Borrador'},
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Header/>
      <div className="pt-16 flex-1 flex flex-col" style={{height:'calc(100vh - 64px)'}}>
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-white/8 bg-black/40 shrink-0">
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-full text-[9px] font-black text-yellow-400 uppercase">
            <AlertTriangle size={8}/> LHC SkinForge 3D
          </div>
          {/* Mode toggle */}
          <div className="flex bg-white/5 border border-white/10 rounded-lg overflow-hidden text-[10px] font-bold">
            <button onClick={()=>setMode('paint')} className={`px-3 py-1.5 ${mode==='paint'?'bg-red-500 text-white':'text-zinc-400 hover:text-white'}`}>✏️ Pintar</button>
            <button onClick={()=>setMode('rotate')} className={`px-3 py-1.5 ${mode==='rotate'?'bg-blue-500 text-white':'text-zinc-400 hover:text-white'}`}>🔄 Rotar</button>
          </div>
          {/* Weapon selector */}
          <div className="relative">
            <button onClick={()=>setDropOpen(o=>!o)}
              className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-red-500/40 rounded-lg px-3 py-1.5 text-xs font-bold">
              <span className="text-zinc-400 text-[9px]">{weapon.cat}</span>
              <span>{weapon.name}</span>
              <ChevronDown size={11} className={dropOpen?'rotate-180 text-zinc-400':'text-zinc-400'}/>
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
          <div className="text-[10px] text-zinc-600 ml-auto truncate">{status}</div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left tools */}
          <div className="flex flex-col gap-1.5 p-2 border-r border-white/8 bg-black/20 w-14 items-center shrink-0">
            {TOOLS.map(t=>(
              <button key={t.id} onClick={()=>setTool(t.id)} title={t.label}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all text-[9px] ${tool===t.id?'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]':'text-zinc-500 hover:bg-white/5'}`}>
                {t.icon}
              </button>
            ))}
            <div className="h-px w-8 bg-white/10 my-1"/>
            <button onClick={resetTexture} title="Reset" className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:bg-white/5">
              <RotateCcw size={14}/>
            </button>
            <button onClick={exportDDS} title="Exportar DDS (CodeWalker)" className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-green-500/20">
              <Download size={14}/>
            </button>
          </div>

          {/* 3D Viewport */}
          <div ref={mountRef} className={`flex-1 relative ${mode==='rotate'?'cursor-grab':'cursor-crosshair'}`}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
            onTouchStart={onTouchDown} onTouchMove={onTouchMove} onTouchEnd={onUp}>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div className="text-xs text-zinc-400 font-black uppercase tracking-widest animate-pulse bg-black/70 px-4 py-2 rounded-xl">Cargando...</div>
              </div>
            )}
            {!hasModel && !loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div className="bg-black/80 border border-white/10 rounded-2xl p-6 max-w-sm text-center space-y-2">
                  <p className="text-sm font-bold">Modelo no disponible</p>
                  <p className="text-[11px] text-zinc-400">Exporta <code className="bg-white/10 px-1 rounded">{weapon.id}.ydr</code> desde CodeWalker → Export XML, ponlo en <code className="bg-white/10 px-1 rounded">prueba/</code> y ejecuta el conversor.</p>
                </div>
              </div>
            )}
            {/* Mode hint overlay */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${mode==='paint'?'bg-red-500/20 text-red-400 border border-red-500/30':'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                {mode==='paint'?'MODO PINTURA — Click para pintar':'MODO ROTACIÓN — Arrastra para rotar'}
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="w-52 border-l border-white/8 bg-black/20 p-3 flex flex-col gap-3 overflow-y-auto shrink-0">
            {/* Color */}
            <div className="bg-white/3 border border-white/8 rounded-xl p-3">
              <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">Color</div>
              <div className="flex items-center gap-2 mb-2">
                <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="w-9 h-9 rounded-lg border-0 cursor-pointer bg-transparent"/>
                <span className="text-[10px] font-mono">{color.toUpperCase()}</span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {PRESETS.map(c=>(
                  <button key={c} onClick={()=>setColor(c)}
                    className={`w-6 h-6 rounded-md hover:scale-110 transition-all ${color===c?'ring-2 ring-white ring-offset-1 ring-offset-black':''}`}
                    style={{backgroundColor:c}}/>
                ))}
              </div>
            </div>
            {/* Size */}
            {tool!=='fill' && (
              <div className="bg-white/3 border border-white/8 rounded-xl p-3">
                <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">Tamaño</div>
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={()=>setSize(s=>Math.max(2,s-5))} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"><Minus size={11}/></button>
                  <span className="flex-1 text-center font-black">{size}<span className="text-[9px] text-zinc-600 font-normal">px</span></span>
                  <button onClick={()=>setSize(s=>Math.min(300,s+5))} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"><Plus size={11}/></button>
                </div>
                <input type="range" min={2} max={300} value={size} onChange={e=>setSize(+e.target.value)} className="w-full h-1 rounded accent-red-500"/>
              </div>
            )}
            {/* Opacity */}
            {tool!=='eraser' && (
              <div className="bg-white/3 border border-white/8 rounded-xl p-3">
                <div className="flex justify-between text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">
                  <span>Opacidad</span><span className="text-white">{opacity}%</span>
                </div>
                <input type="range" min={5} max={100} value={opacity} onChange={e=>setOpacity(+e.target.value)} className="w-full h-1 rounded accent-red-500"/>
              </div>
            )}
            {/* Import guide */}
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3 text-[10px] text-zinc-400 space-y-1.5">
              <p className="text-[9px] font-black text-green-400 uppercase">📥 Importar PNG al juego</p>
              <p>1. Exporta el PNG con el botón <b>↓</b></p>
              <p>2. Abre <b>CodeWalker</b> → RPF Explorer</p>
              <p>3. Navega a <code className="bg-white/10 px-1 rounded">weapons.rpf</code></p>
              <p>4. Abre <code className="bg-white/10 px-1 rounded">{weapon.id}.ytd</code></p>
              <p>5. Clic derecho en la textura <code className="bg-white/10 px-1 rounded">{weapon.id}</code> → <b>Import</b></p>
              <p>6. Selecciona tu PNG → Guardar</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
