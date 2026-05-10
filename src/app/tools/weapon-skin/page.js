'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Paintbrush, Eraser, Type, Undo2, Download, Upload,
  ChevronDown, AlertTriangle, Minus, Plus, Pipette, Square, Circle
} from 'lucide-react';

const WEAPONS = [
  { id: 'w_pi_pistolmk2',       name: 'Pistol MK2',          category: 'Pistola',  size: 'Pequeña' },
  { id: 'w_sb_smgmk2',          name: 'SMG MK2',             category: 'SMG',      size: 'Mediana' },
  { id: 'w_ar_assaultriflemk2', name: 'Assault Rifle MK2',   category: 'Rifle',    size: 'Grande'  },
  { id: 'w_ar_carbineriflemk2', name: 'Carbine Rifle MK2',   category: 'Rifle',    size: 'Grande'  },
  { id: 'w_mg_combatmgmk2',    name: 'Combat MG MK2',        category: 'MG',       size: 'Grande'  },
  { id: 'w_sr_heavysnipermk2', name: 'Heavy Sniper MK2',     category: 'Sniper',   size: 'Grande'  },
];

const PRESET_COLORS = [
  '#ffffff','#000000','#ef4444','#f97316','#eab308',
  '#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6',
  '#6b7280','#a16207','#1e3a5f','#7f1d1d','#064e3b',
];

const STICKERS = ['⭐','💀','🔥','❤️','🎯','⚡','🏆','💎','🦅','🐉'];

export default function WeaponSkinPage() {
  const canvasRef     = useRef(null);
  const overlayRef    = useRef(null);
  const [tool, setTool]         = useState('brush');
  const [color, setColor]       = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(8);
  const [weapon, setWeapon]     = useState(WEAPONS[0]);
  const [weaponOpen, setWeaponOpen] = useState(false);
  const [history, setHistory]   = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showTextBox, setShowTextBox] = useState(false);
  const [textPos, setTextPos]   = useState({ x: 0, y: 0 });
  const [fontSize, setFontSize] = useState(24);
  const lastPos = useRef(null);

  const CANVAS_W = 1024;
  const CANVAS_H = 512;

  // Init canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawGrid(ctx);
    saveHistory();
  }, []);

  const drawGrid = (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= CANVAS_W; x += 64) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x, CANVAS_H); ctx.stroke(); }
    for (let y = 0; y <= CANVAS_H; y += 64) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CANVAS_W, y); ctx.stroke(); }
    // Center guides
    ctx.strokeStyle = 'rgba(239,68,68,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(CANVAS_W/2,0); ctx.lineTo(CANVAS_W/2,CANVAS_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,CANVAS_H/2); ctx.lineTo(CANVAS_W,CANVAS_H/2); ctx.stroke();
    ctx.setLineDash([]);
  };

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL();
    setHistory(h => [...h.slice(-19), data]);
  }, []);

  const undo = () => {
    if (history.length < 2) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const prev = history[history.length - 2];
    const img = new Image();
    img.src = prev;
    img.onload = () => { ctx.clearRect(0,0,CANVAS_W,CANVAS_H); ctx.drawImage(img,0,0); };
    setHistory(h => h.slice(0,-1));
  };

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const fill = (x, y, fillColor) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const data = imageData.data;
    const idx = (Math.round(y) * CANVAS_W + Math.round(x)) * 4;
    const targetR = data[idx], targetG = data[idx+1], targetB = data[idx+2], targetA = data[idx+3];
    const fr = parseInt(fillColor.slice(1,3),16);
    const fg = parseInt(fillColor.slice(3,5),16);
    const fb = parseInt(fillColor.slice(5,7),16);
    if (targetR===fr && targetG===fg && targetB===fb) return;
    const stack = [[Math.round(x), Math.round(y)]];
    const visited = new Set();
    const check = (r,g,b,a) => Math.abs(r-targetR)<30 && Math.abs(g-targetG)<30 && Math.abs(b-targetB)<30 && Math.abs(a-targetA)<30;
    while (stack.length) {
      const [px,py] = stack.pop();
      if (px<0||px>=CANVAS_W||py<0||py>=CANVAS_H) continue;
      const key = py*CANVAS_W+px;
      if (visited.has(key)) continue;
      visited.add(key);
      const i = key*4;
      if (!check(data[i],data[i+1],data[i+2],data[i+3])) continue;
      data[i]=fr; data[i+1]=fg; data[i+2]=fb; data[i+3]=255;
      stack.push([px+1,py],[px-1,py],[px,py+1],[px,py-1]);
    }
    ctx.putImageData(imageData,0,0);
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    const pos = getPos(e);
    if (tool === 'text') {
      setTextPos(pos);
      setShowTextBox(true);
      return;
    }
    if (tool === 'fill') { saveHistory(); fill(pos.x, pos.y, color); return; }
    setIsDrawing(true);
    lastPos.current = pos;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, (tool==='eraser'?brushSize*2:brushSize)/2, 0, Math.PI*2);
    ctx.fillStyle = tool==='eraser' ? '#1a1a1a' : color;
    ctx.fill();
  };

  const onPointerMove = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = tool==='eraser' ? '#1a1a1a' : color;
    ctx.lineWidth = tool==='eraser' ? brushSize*2 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const onPointerUp = () => {
    if (isDrawing) { setIsDrawing(false); saveHistory(); }
  };

  const placeText = () => {
    if (!textInput.trim()) { setShowTextBox(false); return; }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.font = `bold ${fontSize}px 'Geist Mono', monospace`;
    ctx.fillStyle = color;
    ctx.fillText(textInput, textPos.x, textPos.y);
    setTextInput('');
    setShowTextBox(false);
    saveHistory();
  };

  const placeSticker = (emoji) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.font = '48px serif';
    ctx.fillText(emoji, CANVAS_W/2 - 24, CANVAS_H/2 + 16);
    saveHistory();
  };

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawGrid(ctx);
    saveHistory();
  };

  const importTexture = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
        saveHistory();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const exportTexture = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `${weapon.id}_custom.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const TOOLS = [
    { id:'brush',  icon:<Paintbrush size={18}/>, label:'Pincel' },
    { id:'eraser', icon:<Eraser size={18}/>,     label:'Borrador' },
    { id:'fill',   icon:<Square size={18}/>,     label:'Relleno' },
    { id:'text',   icon:<Type size={18}/>,       label:'Texto' },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-red-500/30">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 pt-28 pb-16">

        {/* Top bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full text-[9px] font-black text-yellow-400 uppercase tracking-widest mb-2">
              <AlertTriangle size={10} /> Mantenimiento — Solo para pruebas internas
            </div>
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none">
              LHC <span className="text-red-500">SkinForge</span>
            </h1>
            <p className="text-zinc-500 text-xs mt-1 font-medium">Editor de texturas 2D para armas MK2 · Fase 1</p>
          </div>

          {/* Weapon selector */}
          <div className="relative">
            <button
              onClick={() => setWeaponOpen(o => !o)}
              className="flex items-center gap-3 bg-white/5 border border-white/10 hover:border-red-500/40 rounded-xl px-4 py-3 text-sm font-bold transition-all min-w-[220px]"
            >
              <div className="flex-1 text-left">
                <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">{weapon.category} · {weapon.size}</div>
                <div>{weapon.name}</div>
              </div>
              <ChevronDown size={14} className={`text-zinc-400 transition-transform ${weaponOpen ? 'rotate-180' : ''}`} />
            </button>
            {weaponOpen && (
              <div className="absolute top-full mt-2 right-0 bg-[#111] border border-white/10 rounded-xl overflow-hidden z-50 min-w-[260px] shadow-2xl">
                {WEAPONS.map(w => (
                  <button
                    key={w.id}
                    onClick={() => { setWeapon(w); setWeaponOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-white/5 transition-colors ${weapon.id===w.id ? 'text-red-400 bg-red-500/5' : 'text-zinc-300'}`}
                  >
                    <div className="flex-1">
                      <div className="font-bold">{w.name}</div>
                      <div className="text-[9px] text-zinc-500 uppercase">{w.category} · {w.size}</div>
                    </div>
                    {weapon.id===w.id && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Editor layout */}
        <div className="flex flex-col lg:flex-row gap-4">

          {/* Left toolbar */}
          <div className="flex lg:flex-col gap-2 lg:w-16">
            {/* Tools */}
            <div className="flex lg:flex-col gap-1 bg-white/3 border border-white/8 rounded-2xl p-2">
              {TOOLS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  title={t.label}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${tool===t.id ? 'bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
                >
                  {t.icon}
                </button>
              ))}
            </div>

            {/* Undo */}
            <button
              onClick={undo}
              title="Deshacer"
              className="w-10 h-10 rounded-xl bg-white/3 border border-white/8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/8 transition-all"
            >
              <Undo2 size={16} />
            </button>
          </div>

          {/* Canvas */}
          <div className="flex-1 relative">
            <div className="rounded-2xl overflow-hidden border border-white/10 relative bg-[#111] shadow-2xl">
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="w-full block cursor-crosshair touch-none"
                style={{ imageRendering: 'pixelated' }}
                onMouseDown={onPointerDown}
                onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}
                onMouseLeave={onPointerUp}
                onTouchStart={onPointerDown}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
              />
              {/* Text input overlay */}
              {showTextBox && (
                <div
                  className="absolute"
                  style={{
                    left: `${(textPos.x / CANVAS_W) * 100}%`,
                    top: `${(textPos.y / CANVAS_H) * 100}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <input
                    autoFocus
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter') placeText(); if(e.key==='Escape') setShowTextBox(false); }}
                    placeholder="Escribe aquí..."
                    className="bg-black/80 border border-red-500/50 text-white px-3 py-2 rounded-lg text-sm outline-none backdrop-blur-sm"
                    style={{ color, fontSize: `${Math.max(10, fontSize/3)}px` }}
                  />
                  <button onClick={placeText} className="ml-2 bg-red-500 text-white px-3 py-2 rounded-lg text-xs font-bold">OK</button>
                </div>
              )}
            </div>

            {/* Canvas info bar */}
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-[10px] text-zinc-600 font-mono">{CANVAS_W}×{CANVAS_H}px · {weapon.name}</span>
              <span className="text-[10px] text-zinc-600 font-mono">Herramienta: {TOOLS.find(t2=>t2.id===tool)?.label}</span>
            </div>
          </div>

          {/* Right panel */}
          <div className="lg:w-64 flex flex-col gap-3">

            {/* Brush size */}
            {(tool==='brush'||tool==='eraser') && (
              <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
                <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-3">Tamaño</div>
                <div className="flex items-center gap-3">
                  <button onClick={()=>setBrushSize(s=>Math.max(1,s-2))} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"><Minus size={12}/></button>
                  <div className="flex-1 text-center">
                    <div className="text-xl font-black">{tool==='eraser'?brushSize*2:brushSize}</div>
                    <div className="text-[8px] text-zinc-600">px</div>
                  </div>
                  <button onClick={()=>setBrushSize(s=>Math.min(60,s+2))} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"><Plus size={12}/></button>
                </div>
                <div className="mt-3 flex justify-center">
                  <div
                    className="rounded-full bg-white"
                    style={{
                      width: Math.min(48, (tool==='eraser'?brushSize*2:brushSize)*1.5),
                      height: Math.min(48, (tool==='eraser'?brushSize*2:brushSize)*1.5),
                      backgroundColor: tool==='eraser' ? '#444' : color
                    }}
                  />
                </div>
              </div>
            )}

            {/* Text options */}
            {tool==='text' && (
              <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
                <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-3">Texto</div>
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={()=>setFontSize(s=>Math.max(10,s-4))} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"><Minus size={12}/></button>
                  <span className="flex-1 text-center text-sm font-black">{fontSize}px</span>
                  <button onClick={()=>setFontSize(s=>Math.min(120,s+4))} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"><Plus size={12}/></button>
                </div>
                <p className="text-[9px] text-zinc-500">Haz clic en el canvas para colocar el texto.</p>
              </div>
            )}

            {/* Color */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
              <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-3">Color</div>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-10 h-10 rounded-xl border-0 cursor-pointer bg-transparent"
                />
                <div className="flex-1">
                  <div className="text-xs font-mono font-bold">{color.toUpperCase()}</div>
                  <div className="text-[9px] text-zinc-500">Color activo</div>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-lg transition-all hover:scale-110 ${color===c ? 'ring-2 ring-white ring-offset-1 ring-offset-black scale-110' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Stickers */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
              <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-3">Stickers</div>
              <div className="grid grid-cols-5 gap-1">
                {STICKERS.map(s => (
                  <button
                    key={s}
                    onClick={() => placeSticker(s)}
                    className="w-9 h-9 text-xl rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center"
                    title={`Colocar ${s} en el centro`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-zinc-600 mt-2">Se coloca en el centro. Muévelo con el pincel.</p>
            </div>

            {/* Actions */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-4 flex flex-col gap-2">
              <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Archivo</div>

              <label className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl px-3 py-2.5 cursor-pointer transition-all text-xs font-bold">
                <Upload size={14} className="text-zinc-400" />
                <span>Importar textura PNG</span>
                <input type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={importTexture} />
              </label>

              <button
                onClick={exportTexture}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-400 rounded-xl px-3 py-2.5 transition-all text-xs font-black shadow-[0_0_16px_rgba(239,68,68,0.3)]"
              >
                <Download size={14} />
                Exportar PNG
              </button>

              <button
                onClick={resetCanvas}
                className="flex items-center gap-2 bg-white/3 hover:bg-white/8 border border-white/8 rounded-xl px-3 py-2.5 transition-all text-xs font-bold text-zinc-400"
              >
                <Eraser size={14} /> Limpiar canvas
              </button>
            </div>

            {/* Info */}
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4">
              <div className="text-[9px] text-yellow-400 font-black uppercase tracking-widest mb-2">⚠ Cómo usar</div>
              <ol className="text-[10px] text-zinc-400 space-y-1 list-decimal list-inside leading-relaxed">
                <li>Exporta la textura del arma desde <b className="text-white">CodeWalker</b> como PNG</li>
                <li>Impórtala con <b className="text-white">"Importar textura PNG"</b></li>
                <li>Pinta encima</li>
                <li>Exporta el resultado</li>
                <li>Reimporta el PNG en CodeWalker → YTD</li>
              </ol>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
