'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Paintbrush, Eraser, Type, Undo2, Download, Upload, ChevronDown, AlertTriangle, Minus, Plus, Square, Circle, Droplets, Pipette, ZoomIn, ZoomOut } from 'lucide-react';

const WEAPONS = [
  { id:'w_pi_pistol',          name:'Pistol',            cat:'Pistola',  size:'Pequeña' },
  { id:'w_pi_pistolmk2',       name:'Pistol MK2',        cat:'Pistola',  size:'Pequeña' },
  { id:'w_pi_combatpistol',    name:'Combat Pistol',     cat:'Pistola',  size:'Pequeña' },
  { id:'w_pi_appistol',        name:'AP Pistol',         cat:'Pistola',  size:'Pequeña' },
  { id:'w_pi_heavypistol',     name:'Heavy Pistol',      cat:'Pistola',  size:'Pequeña' },
  { id:'w_pi_pistol50',        name:'Pistol .50',        cat:'Pistola',  size:'Pequeña' },
  { id:'w_pi_sns_pistol',      name:'SNS Pistol',        cat:'Pistola',  size:'Pequeña' },
  { id:'w_pi_vintage_pistol',  name:'Vintage Pistol',    cat:'Pistola',  size:'Pequeña' },
  { id:'w_pi_stungun',         name:'Stun Gun',          cat:'Pistola',  size:'Pequeña' },
  { id:'w_sb_smg',             name:'SMG',               cat:'SMG',      size:'Mediana' },
  { id:'w_sb_smgmk2',          name:'SMG MK2',           cat:'SMG',      size:'Mediana' },
  { id:'w_sb_microsmg',        name:'Micro SMG',         cat:'SMG',      size:'Pequeña' },
  { id:'w_sb_assaultsmg',      name:'Assault SMG',       cat:'SMG',      size:'Mediana' },
  { id:'w_sb_gusenberg',       name:'Gusenberg Sweeper', cat:'SMG',      size:'Mediana' },
  { id:'w_ar_assaultrifle',    name:'Assault Rifle',     cat:'Rifle',    size:'Grande'  },
  { id:'w_ar_assaultriflemk2', name:'Assault Rifle MK2', cat:'Rifle',    size:'Grande'  },
  { id:'w_ar_carbinerifle',    name:'Carbine Rifle',     cat:'Rifle',    size:'Grande'  },
  { id:'w_ar_carbineriflemk2', name:'Carbine Rifle MK2', cat:'Rifle',    size:'Grande'  },
  { id:'w_ar_advancedrifle',   name:'Advanced Rifle',    cat:'Rifle',    size:'Grande'  },
  { id:'w_ar_specialcarbine',  name:'Special Carbine',   cat:'Rifle',    size:'Grande'  },
  { id:'w_ar_bullpuprifle',    name:'Bullpup Rifle',     cat:'Rifle',    size:'Grande'  },
  { id:'w_ar_musket',          name:'Musket',            cat:'Rifle',    size:'Grande'  },
  { id:'w_ar_railgun',         name:'Railgun',           cat:'Rifle',    size:'Grande'  },
  { id:'w_sg_pumpshotgun',     name:'Pump Shotgun',      cat:'Escopeta', size:'Grande'  },
  { id:'w_sg_sawnoff',         name:'Sawed-Off Shotgun', cat:'Escopeta', size:'Mediana' },
  { id:'w_sg_assaultshotgun',  name:'Assault Shotgun',   cat:'Escopeta', size:'Grande'  },
  { id:'w_sg_bullpupshotgun',  name:'Bullpup Shotgun',   cat:'Escopeta', size:'Grande'  },
  { id:'w_sg_heavyshotgun',    name:'Heavy Shotgun',     cat:'Escopeta', size:'Grande'  },
  { id:'w_mg_mg',              name:'MG',                cat:'MG',       size:'Grande'  },
  { id:'w_mg_combatmg',        name:'Combat MG',         cat:'MG',       size:'Grande'  },
  { id:'w_mg_combatmgmk2',     name:'Combat MG MK2',     cat:'MG',       size:'Grande'  },
  { id:'w_mg_minigun',         name:'Minigun',           cat:'MG',       size:'Grande'  },
  { id:'w_sr_sniperrifle',     name:'Sniper Rifle',      cat:'Sniper',   size:'Grande'  },
  { id:'w_sr_heavysniper',     name:'Heavy Sniper',      cat:'Sniper',   size:'Grande'  },
  { id:'w_sr_heavysnipermk2',  name:'Heavy Sniper MK2',  cat:'Sniper',   size:'Grande'  },
  { id:'w_sr_marksmanrifle',   name:'Marksman Rifle',    cat:'Sniper',   size:'Grande'  },
  { id:'w_lr_rpg',             name:'RPG',               cat:'Lanzador', size:'Grande'  },
  { id:'w_lr_grenadelauncher', name:'Grenade Launcher',  cat:'Lanzador', size:'Grande'  },
  { id:'w_lr_homing',          name:'Homing Launcher',   cat:'Lanzador', size:'Grande'  },
  { id:'w_me_bat',             name:'Baseball Bat',      cat:'Cuerpo',   size:'Mediana' },
  { id:'w_me_knife_01',        name:'Knife',             cat:'Cuerpo',   size:'Pequeña' },
  { id:'w_me_hammer',          name:'Hammer',            cat:'Cuerpo',   size:'Pequeña' },
  { id:'w_me_crowbar',         name:'Crowbar',           cat:'Cuerpo',   size:'Mediana' },
  { id:'w_me_dagger',          name:'Dagger',            cat:'Cuerpo',   size:'Pequeña' },
  { id:'w_me_hatchet',         name:'Hatchet',           cat:'Cuerpo',   size:'Pequeña' },
  { id:'w_ex_grenadefrag',     name:'Grenade',           cat:'Explosivo',size:'Pequeña' },
  { id:'w_ex_molotov',         name:'Molotov',           cat:'Explosivo',size:'Pequeña' },
];

const PRESET_COLORS = ['#ffffff','#000000','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#6b7280','#a16207'];
const STICKERS = ['⭐','💀','🔥','❤️','🎯','⚡','🏆','💎','🦅','🐉'];
const CATS = ['Todos', ...new Set(WEAPONS.map(w => w.cat))];

export default function WeaponSkinPage() {
  const canvasRef   = useRef(null);
  const overlayRef  = useRef(null); // shape preview overlay
  const lastPos     = useRef(null);
  const shapeStart  = useRef(null);
  const baseDataUrl = useRef(null); // locked weapon texture
  const [tool, setTool]             = useState('brush');
  const [color, setColor]           = useState('#ef4444');
  const [brushSize, setBrushSize]   = useState(8);
  const [opacity, setOpacity]       = useState(100);
  const [weapon, setWeapon]         = useState(WEAPONS[0]);
  const [catFilter, setCatFilter]   = useState('Todos');
  const [dropOpen, setDropOpen]     = useState(false);
  const [history, setHistory]       = useState([]);
  const [isDrawing, setIsDrawing]   = useState(false);
  const [textInput, setTextInput]   = useState('');
  const [showText, setShowText]     = useState(false);
  const [textPos, setTextPos]       = useState({x:0,y:0});
  const [fontSize, setFontSize]     = useState(24);
  const [loading, setLoading]       = useState(false);
  const [zoom, setZoom]             = useState(1);
  const W = 1024, H = 512;

  const saveHistory = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    setHistory(h => [...h.slice(-19), c.toDataURL()]);
  }, []);

  // Load texture when weapon changes
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    setLoading(true);
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0,0,W,H);
      ctx.drawImage(img,0,0,W,H);
      baseDataUrl.current = canvas.toDataURL();
      setLoading(false);
      saveHistory();
    };
    img.onerror = () => {
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.font='bold 16px monospace';
      ctx.fillText('Sin textura — importa PNG desde CodeWalker', 40, H/2);
      baseDataUrl.current = canvas.toDataURL();
      setLoading(false); saveHistory();
    };
    img.src = `/weapons/${weapon.id}.png`;
  }, [weapon, saveHistory]);

  // --- FLOOD FILL ---
  const floodFill = useCallback((x0, y0, fillColor) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0,0,W,H);
    const d = imgData.data;
    x0=Math.round(x0); y0=Math.round(y0);
    if(x0<0||x0>=W||y0<0||y0>=H) return;
    const idx=(y,x)=>(y*W+x)*4;
    const si=idx(y0,x0);
    const sr=d[si],sg=d[si+1],sb=d[si+2],sa=d[si+3];
    const r2=parseInt(fillColor.slice(1,3),16),g2=parseInt(fillColor.slice(3,5),16),b2=parseInt(fillColor.slice(5,7),16);
    const a2=Math.round((opacity/100)*255);
    if(sr===r2&&sg===g2&&sb===b2&&sa===a2) return;
    const match=i=>Math.abs(d[i]-sr)<32&&Math.abs(d[i+1]-sg)<32&&Math.abs(d[i+2]-sb)<32&&Math.abs(d[i+3]-sa)<32;
    const stack=[[x0,y0]];
    const visited=new Uint8Array(W*H);
    while(stack.length){
      const[x,y]=stack.pop();
      if(x<0||x>=W||y<0||y>=H) continue;
      const i=idx(y,x); if(visited[y*W+x]||!match(i)) continue;
      visited[y*W+x]=1;
      d[i]=r2;d[i+1]=g2;d[i+2]=b2;d[i+3]=a2;
      stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
    }
    ctx.putImageData(imgData,0,0);
    saveHistory();
  },[opacity,saveHistory]);

  // --- SPRAY ---
  const sprayRef = useRef(null);
  const startSpray = (pos) => {
    const doSpray=()=>{
      const ctx=canvasRef.current.getContext('2d');
      const a=opacity/100;
      for(let i=0;i<20;i++){
        const angle=Math.random()*Math.PI*2;
        const r=Math.random()*brushSize*2;
        ctx.globalAlpha=Math.random()*a;
        ctx.fillStyle=color;
        ctx.beginPath(); ctx.arc(pos.x+Math.cos(angle)*r,pos.y+Math.sin(angle)*r,1,0,Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha=1;
    };
    doSpray();
    sprayRef.current=setInterval(doSpray,30);
  };
  const stopSpray=()=>{ clearInterval(sprayRef.current); sprayRef.current=null; };

  const undo = () => {
    if (history.length < 2) return;
    const img = new Image(); img.src = history[history.length-2];
    img.onload = () => { const ctx = canvasRef.current.getContext('2d'); ctx.clearRect(0,0,W,H); ctx.drawImage(img,0,0); };
    setHistory(h => h.slice(0,-1));
  };

  const getPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const cx = e.touches?.[0]?.clientX ?? e.clientX;
    const cy = e.touches?.[0]?.clientY ?? e.clientY;
    return { x:(cx-r.left)*(W/r.width), y:(cy-r.top)*(H/r.height) };
  };

  const onDown = (e) => {
    e.preventDefault();
    const pos = getPos(e);
    if (tool==='text')  { setTextPos(pos); setShowText(true); return; }
    if (tool==='fill')  { floodFill(pos.x, pos.y, color); return; }
    if (tool==='spray') { setIsDrawing(true); lastPos.current=pos; startSpray(pos); return; }
    if (tool==='rect'||tool==='circle') { setIsDrawing(true); shapeStart.current=pos; lastPos.current=pos; return; }
    setIsDrawing(true); lastPos.current=pos;
    const ctx = canvasRef.current.getContext('2d');
    ctx.globalAlpha = tool==='eraser'?1:opacity/100;
    ctx.globalCompositeOperation = tool==='eraser'?'destination-out':'source-over';
    ctx.beginPath(); ctx.arc(pos.x,pos.y,(tool==='eraser'?brushSize*2:brushSize)/2,0,Math.PI*2);
    ctx.fillStyle = tool==='eraser'?'rgba(0,0,0,1)':color; ctx.fill();
    ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
  };

  const onMove = (e) => {
    e.preventDefault(); if (!isDrawing) return;
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    if (tool==='spray') { lastPos.current=pos; return; }
    if (tool==='rect'||tool==='circle') {
      // Preview on overlay canvas
      const oc = overlayRef.current; if(!oc) return;
      const octx = oc.getContext('2d');
      octx.clearRect(0,0,W,H);
      const s=shapeStart.current;
      octx.strokeStyle=color; octx.lineWidth=brushSize; octx.globalAlpha=opacity/100;
      if(tool==='rect'){
        octx.strokeRect(s.x,s.y,pos.x-s.x,pos.y-s.y);
      } else {
        const rx=Math.abs(pos.x-s.x)/2, ry=Math.abs(pos.y-s.y)/2;
        const cx=(s.x+pos.x)/2, cy=(s.y+pos.y)/2;
        octx.beginPath(); octx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); octx.stroke();
      }
      octx.globalAlpha=1;
      lastPos.current=pos; return;
    }
    ctx.globalAlpha = tool==='eraser'?1:opacity/100;
    ctx.globalCompositeOperation = tool==='eraser'?'destination-out':'source-over';
    ctx.strokeStyle = tool==='eraser'?'rgba(0,0,0,1)':color;
    ctx.lineWidth = tool==='eraser'?brushSize*2:brushSize;
    ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath(); ctx.moveTo(lastPos.current.x,lastPos.current.y); ctx.lineTo(pos.x,pos.y); ctx.stroke();
    ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
    lastPos.current=pos;
  };

  const onUp = () => {
    if (!isDrawing) return;
    if (tool==='spray') { stopSpray(); setIsDrawing(false); saveHistory(); return; }
    if (tool==='rect'||tool==='circle') {
      const oc=overlayRef.current; const ctx=canvasRef.current.getContext('2d');
      const s=shapeStart.current, pos=lastPos.current;
      ctx.strokeStyle=color; ctx.lineWidth=brushSize; ctx.globalAlpha=opacity/100;
      if(tool==='rect'){
        ctx.strokeRect(s.x,s.y,pos.x-s.x,pos.y-s.y);
      } else {
        const rx=Math.abs(pos.x-s.x)/2,ry=Math.abs(pos.y-s.y)/2,cx=(s.x+pos.x)/2,cy=(s.y+pos.y)/2;
        ctx.beginPath(); ctx.ellipse(cx,cy,Math.max(1,rx),Math.max(1,ry),0,0,Math.PI*2); ctx.stroke();
      }
      ctx.globalAlpha=1;
      if(oc){ const octx=oc.getContext('2d'); octx.clearRect(0,0,W,H); }
      setIsDrawing(false); saveHistory(); return;
    }
    setIsDrawing(false); saveHistory();
  };

  const placeText = () => {
    if (!textInput.trim()) { setShowText(false); return; }
    const ctx = canvasRef.current.getContext('2d');
    ctx.font=`bold ${fontSize}px monospace`; ctx.fillStyle=color;
    ctx.fillText(textInput,textPos.x,textPos.y);
    setTextInput(''); setShowText(false); saveHistory();
  };

  const placeSticker = (s) => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.font='48px serif'; ctx.fillText(s,W/2-24,H/2+16); saveHistory();
  };

  const resetToBase = () => {
    const e = {type:'weaponchange'}; weapon.id && (setWeapon({...weapon}));
  };

  const importPNG = (e) => {
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader(); r.onload=ev=>{
      const img=new Image(); img.onload=()=>{
        const ctx=canvasRef.current.getContext('2d');
        ctx.clearRect(0,0,W,H); ctx.drawImage(img,0,0,W,H); saveHistory();
      }; img.src=ev.target.result;
    }; r.readAsDataURL(f); e.target.value='';
  };

  const exportPNG = () => {
    const a=document.createElement('a'); a.download=`${weapon.id}_custom.png`;
    a.href=canvasRef.current.toDataURL('image/png'); a.click();
  };

  const filtered = catFilter==='Todos' ? WEAPONS : WEAPONS.filter(w=>w.cat===catFilter);
  const TOOLS = [
    {id:'brush', icon:<Paintbrush size={16}/>, label:'Pincel'},
    {id:'eraser',icon:<Eraser size={16}/>,     label:'Borrador'},
    {id:'fill',  icon:<Droplets size={16}/>,   label:'Relleno'},
    {id:'spray', icon:<Pipette size={16}/>,    label:'Spray'},
    {id:'rect',  icon:<Square size={16}/>,     label:'Rectángulo'},
    {id:'circle',icon:<Circle size={16}/>,     label:'Círculo'},
    {id:'text',  icon:<Type size={16}/>,       label:'Texto'},
  ];

  const gridBg = {
    backgroundColor:'#111',
    backgroundImage:`linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)`,
    backgroundSize:'64px 64px',
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Header/>
      <main className="max-w-[1400px] mx-auto px-4 pt-28 pb-16">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full text-[9px] font-black text-yellow-400 uppercase tracking-widest mb-2">
              <AlertTriangle size={10}/> Mantenimiento — Solo pruebas internas
            </div>
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">LHC <span className="text-red-500">SkinForge</span></h1>
            <p className="text-zinc-500 text-xs mt-1">Editor de texturas 2D · {WEAPONS.length} armas disponibles</p>
          </div>
          {/* Weapon selector */}
          <div className="relative">
            <button onClick={()=>setDropOpen(o=>!o)}
              className="flex items-center gap-3 bg-white/5 border border-white/10 hover:border-red-500/40 rounded-xl px-4 py-3 text-sm font-bold min-w-[240px]">
              <div className="flex-1 text-left">
                <div className="text-[9px] text-zinc-500 uppercase tracking-widest">{weapon.cat} · {weapon.size}</div>
                <div>{weapon.name}</div>
              </div>
              <ChevronDown size={14} className={`text-zinc-400 transition-transform ${dropOpen?'rotate-180':''}`}/>
            </button>
            {dropOpen && (
              <div className="absolute top-full mt-2 right-0 bg-[#111] border border-white/10 rounded-xl overflow-hidden z-50 w-[280px] shadow-2xl max-h-[400px] overflow-y-auto">
                {/* Category filter */}
                <div className="flex flex-wrap gap-1 p-2 border-b border-white/5">
                  {CATS.map(c=>(
                    <button key={c} onClick={()=>setCatFilter(c)}
                      className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${catFilter===c?'bg-red-500 text-white':'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>
                      {c}
                    </button>
                  ))}
                </div>
                {filtered.map(w=>(
                  <button key={w.id} onClick={()=>{setWeapon(w);setDropOpen(false);}}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-white/5 ${weapon.id===w.id?'text-red-400 bg-red-500/5':'text-zinc-300'}`}>
                    <div className="flex-1">
                      <div className="font-bold text-xs">{w.name}</div>
                      <div className="text-[9px] text-zinc-500">{w.cat} · {w.size}</div>
                    </div>
                    {weapon.id===w.id && <div className="w-1.5 h-1.5 rounded-full bg-red-500"/>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left tools */}
          <div className="flex lg:flex-col gap-2 lg:w-14">
            <div className="flex lg:flex-col gap-1 bg-white/3 border border-white/8 rounded-2xl p-2">
              {TOOLS.map(t=>(
                <button key={t.id} onClick={()=>setTool(t.id)} title={t.label}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${tool===t.id?'bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]':'text-zinc-400 hover:bg-white/5'}`}>
                  {t.icon}
                </button>
              ))}
            </div>
            <button onClick={undo} title="Deshacer"
              className="w-10 h-10 rounded-xl bg-white/3 border border-white/8 flex items-center justify-center text-zinc-400 hover:text-white">
              <Undo2 size={16}/>
            </button>
          </div>

          {/* Canvas */}
          <div className="flex-1">
            <div className="rounded-2xl overflow-hidden border border-white/10 relative shadow-2xl" style={gridBg}>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/60">
                  <div className="text-xs text-zinc-400 font-black uppercase tracking-widest animate-pulse">Cargando textura...</div>
                </div>
              )}
              <canvas ref={canvasRef} width={W} height={H}
                className="w-full block cursor-crosshair touch-none relative z-20"
                style={{background:'transparent'}}
                onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
                onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}/>
              {showText && (
                <div className="absolute z-30"
                  style={{left:`${(textPos.x/W)*100}%`,top:`${(textPos.y/H)*100}%`,transform:'translate(-50%,-50%)'}}>
                  <input autoFocus value={textInput} onChange={e=>setTextInput(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter')placeText();if(e.key==='Escape')setShowText(false);}}
                    placeholder="Escribe..." className="bg-black/90 border border-red-500/60 text-white px-3 py-2 rounded-lg text-sm outline-none" style={{color}}/>
                  <button onClick={placeText} className="ml-2 bg-red-500 text-white px-3 py-2 rounded-lg text-xs font-black">OK</button>
                </div>
              )}
              {/* Overlay canvas for shape preview */}
              <canvas ref={overlayRef} width={W} height={H}
                className="absolute inset-0 w-full h-full z-25 pointer-events-none"
                style={{pointerEvents:'none'}}/>
            </div>
            <div className="flex justify-between mt-2 px-1">
              <span className="text-[10px] text-zinc-600 font-mono">{W}×{H}px · {weapon.name}</span>
              <span className="text-[10px] text-zinc-600 font-mono">Tool: {TOOLS.find(t=>t.id===tool)?.label}</span>
            </div>
          </div>

          {/* Right panel */}
          <div className="lg:w-60 flex flex-col gap-3">
            {/* Size + Opacity — visible for all drawing tools */}
            {tool!=='text' && tool!=='fill' && (
              <div className="bg-white/3 border border-white/8 rounded-2xl p-4 space-y-3">
                <div>
                  <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">Tamaño</div>
                  <div className="flex items-center gap-3">
                    <button onClick={()=>setBrushSize(s=>Math.max(1,s-2))} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"><Minus size={12}/></button>
                    <div className="flex-1 text-center font-black text-xl">{tool==='eraser'?brushSize*2:brushSize}<span className="text-[9px] text-zinc-600 font-normal">px</span></div>
                    <button onClick={()=>setBrushSize(s=>Math.min(120,s+2))} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"><Plus size={12}/></button>
                  </div>
                </div>
                {tool!=='eraser' && (
                  <div>
                    <div className="flex justify-between text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">
                      <span>Opacidad</span><span className="text-white font-black">{opacity}%</span>
                    </div>
                    <input type="range" min={5} max={100} value={opacity} onChange={e=>setOpacity(+e.target.value)}
                      className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-red-500"/>
                  </div>
                )}
              </div>
            )}
            {tool==='text' && (
              <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
                <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">Tamaño texto</div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>setFontSize(s=>Math.max(10,s-4))} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"><Minus size={12}/></button>
                  <span className="flex-1 text-center font-black">{fontSize}px</span>
                  <button onClick={()=>setFontSize(s=>Math.min(120,s+4))} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"><Plus size={12}/></button>
                </div>
                <p className="text-[9px] text-zinc-500 mt-2">Haz clic en el canvas.</p>
              </div>
            )}
            {/* Color */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
              <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-3">Color</div>
              <div className="flex items-center gap-2 mb-3">
                <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="w-10 h-10 rounded-xl border-0 cursor-pointer bg-transparent"/>
                <div className="text-xs font-mono font-bold">{color.toUpperCase()}</div>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {PRESET_COLORS.map(c=>(
                  <button key={c} onClick={()=>setColor(c)}
                    className={`w-8 h-8 rounded-lg hover:scale-110 transition-all ${color===c?'ring-2 ring-white ring-offset-1 ring-offset-black':''}`}
                    style={{backgroundColor:c}}/>
                ))}
              </div>
            </div>
            {/* Stickers */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
              <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-3">Stickers</div>
              <div className="grid grid-cols-5 gap-1">
                {STICKERS.map(s=>(
                  <button key={s} onClick={()=>placeSticker(s)}
                    className="w-9 h-9 text-xl rounded-lg hover:bg-white/10 flex items-center justify-center">{s}</button>
                ))}
              </div>
            </div>
            {/* Archivo */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-4 flex flex-col gap-2">
              <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Archivo</div>
              <label className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl px-3 py-2.5 cursor-pointer text-xs font-bold">
                <Upload size={14} className="text-zinc-400"/> Importar PNG base
                <input type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={importPNG}/>
              </label>
              <button onClick={exportPNG}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-400 rounded-xl px-3 py-2.5 text-xs font-black shadow-[0_0_16px_rgba(239,68,68,0.3)]">
                <Download size={14}/> Exportar PNG
              </button>
              <button onClick={resetToBase}
                className="flex items-center gap-2 bg-white/3 hover:bg-white/8 border border-white/8 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-400">
                <Eraser size={14}/> Restaurar textura base
              </button>
            </div>
            {/* Info */}
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4 text-[10px] text-zinc-400 space-y-1">
              <div className="text-[9px] text-yellow-400 font-black uppercase mb-2">⚠ Flujo de trabajo</div>
              <p>1. Selecciona el arma → textura carga automáticamente</p>
              <p>2. Pinta encima</p>
              <p>3. Exporta PNG y reimportalo en CodeWalker → YTD</p>
            </div>
          </div>
        </div>
      </main>
      <Footer/>
    </div>
  );
}
