'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import Header from '@/components/Header';
import { useLang } from '@/components/LangProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Play, Shield, Maximize, MousePointer2 } from 'lucide-react';

export default function TrainerPage() {
  const { t } = useLang();
  const mountRef = useRef(null);
  const [gameState, setGameState] = useState('menu');
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(60);
  const [fps, setFps] = useState(0);

  // Three.js Refs
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const targetsRef = useRef([]);
  const requestRef = useRef(null);

  // Trainer Settings (States for UI)
  const [sensitivity, setSensitivity] = useState(1);
  const [reticuleSize, setReticuleSize] = useState(1);
  const [reticuleType, setReticuleType] = useState('complex');
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [consoleLogs, setConsoleLogs] = useState(['LHC Trainer Console v1.0.0', 'Press J to toggle', 'Type commands like: profile_mouseOnFootScale -5']);
  
  // Trainer Settings (Refs for the loop)
  const sensRef = useRef(1);
  const retSizeRef = useRef(1);
  const retTypeRef = useRef('complex');
  const bindsRef = useRef({});
  const timeRef = useRef(60);
  const scoreRef = useRef(0);

  const spawnTarget = (scene) => {
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0xffffff, 
      emissive: 0xffffff,
      emissiveIntensity: 0.2,
      metalness: 0.8,
      roughness: 0.2
    });
    const sphere = new THREE.Mesh(geometry, material);

    sphere.position.x = (Math.random() - 0.5) * 30;
    sphere.position.y = (Math.random() * 8) + 1;
    sphere.position.z = -((Math.random() * 20) + 10);

    scene.add(sphere);
    targetsRef.current.push(sphere);
  };

  const handleCommand = (cmd) => {
    const cleanCmd = cmd.trim();
    const parts = cleanCmd.split(/\s+/);
    const action = parts[0].toLowerCase();
    
    setConsoleLogs(prev => [...prev, `> ${cleanCmd}`]);

    if (action === 'profile_mouseonfootscale') {
      const val = parseFloat(parts[1]);
      const newSens = 1 + (val * 0.1);
      sensRef.current = Math.max(0.01, newSens);
      setSensitivity(sensRef.current);
      setConsoleLogs(prev => [...prev, `Sensibilidad: ${sensRef.current.toFixed(2)}`]);
    } 
    else if (action === 'profile_reticulesize') {
      const val = parseFloat(parts[1]);
      const newSize = 1 + (val * 0.2);
      retSizeRef.current = Math.max(0.1, newSize);
      setReticuleSize(retSizeRef.current);
      setConsoleLogs(prev => [...prev, `Tamaño Mira: ${retSizeRef.current.toFixed(2)}`]);
    }
    else if (cleanCmd.toLowerCase().includes('toggle') && cleanCmd.toLowerCase().includes('profile_reticule')) {
      retTypeRef.current = retTypeRef.current === 'complex' ? 'simple' : 'complex';
      setReticuleType(retTypeRef.current);
      setConsoleLogs(prev => [...prev, `ESTILO DE MIRA: ${retTypeRef.current.toUpperCase()}`]);
    }
    else if (action === 'bind') {
      // More flexible regex for binds
      const match = cleanCmd.match(/bind\s+keyboard\s+"?(\w+)"?\s+"?(.+)"?/i);
      if (match) {
        const key = match[1].toLowerCase();
        const subCmd = match[2].replace(/"/g, ''); // Clean quotes from sub-command
        bindsRef.current[key] = subCmd;
        setConsoleLogs(prev => [...prev, `TECLA [${key.toUpperCase()}] BINNDEADA A: ${subCmd}`]);
      }
    }
  };

  const startGame = () => {
    scoreRef.current = 0;
    timeRef.current = 60;
    setScore(0);
    setTime(60);
    if (controlsRef.current) controlsRef.current.lock();
  };

  const consoleOpenRef = useRef(false);
  const gameStateRef = useRef('menu');

  useEffect(() => {
    if (!mountRef.current) return;

    // Timer Interval
    const timerInterval = setInterval(() => {
      if (gameStateRef.current === 'playing' && !consoleOpenRef.current) {
        if (timeRef.current > 0) {
          timeRef.current -= 1;
          setTime(timeRef.current);
        } else {
          gameStateRef.current = 'menu';
          setGameState('menu');
          if (controlsRef.current) controlsRef.current.unlock();
        }
      }
    }, 1000);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(0x050505, 0.02);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0);

    const renderer = new THREE.WebGLRenderer({ 
      antialias: false, 
      powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(1);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new PointerLockControls(camera, renderer.domElement);
    controlsRef.current = controls;

    controls.addEventListener('lock', () => {
      gameStateRef.current = 'playing';
      setGameState('playing');
      consoleOpenRef.current = false;
      setConsoleOpen(false);
    });

    controls.addEventListener('unlock', () => {
      if (!consoleOpenRef.current) {
        gameStateRef.current = 'menu';
        setGameState('menu');
      }
    });

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const mainLight = new THREE.PointLight(0xffffff, 1, 100);
    mainLight.position.set(0, 15, 0);
    scene.add(mainLight);

    // Floor and Grid
    const grid = new THREE.GridHelper(200, 50, 0x444444, 0x222222);
    scene.add(grid);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200), 
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const internalSpawn = () => {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 12, 12), 
        new THREE.MeshStandardMaterial({ 
          color: 0xffffff, 
          emissive: 0xffffff,
          emissiveIntensity: 0.5 
        })
      );
      sphere.position.set((Math.random() - 0.5) * 30, (Math.random() * 8) + 1, -((Math.random() * 20) + 10));
      scene.add(sphere);
      targetsRef.current.push(sphere);
    };
    for (let i = 0; i < 8; i++) internalSpawn();

    let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
    const velocity = new THREE.Vector3(), direction = new THREE.Vector3();

    const onKeyDown = (e) => {
      if (e.key.toLowerCase() === 'j') {
        e.preventDefault();
        const nextState = !consoleOpenRef.current;
        consoleOpenRef.current = nextState;
        setConsoleOpen(nextState);
        if (nextState) controls.unlock(); else controls.lock();
        return;
      }
      if (consoleOpenRef.current) return;
      
      const key = e.key.toLowerCase();
      if (bindsRef.current[key]) {
        e.preventDefault();
        handleCommand(bindsRef.current[key]);
      }

      switch (e.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyD': moveRight = true; break;
      }
    };
    const onKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyD': moveRight = false; break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const raycaster = new THREE.Raycaster();
    const onMouseDown = () => {
      if (!controls.isLocked || consoleOpenRef.current || gameStateRef.current !== 'playing') return;
      raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
      const intersects = raycaster.intersectObjects(targetsRef.current);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        scene.remove(hit);
        targetsRef.current = targetsRef.current.filter(t => t !== hit);
        scoreRef.current += 100;
        setScore(scoreRef.current);
        internalSpawn();
      }
    };
    window.addEventListener('mousedown', onMouseDown);

    let prevTime = performance.now(), frames = 0, lastFpsUpdate = 0;
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      const timeNow = performance.now();
      frames++;
      if (timeNow > lastFpsUpdate + 1000) {
        setFps(Math.round((frames * 1000) / (timeNow - lastFpsUpdate)));
        lastFpsUpdate = timeNow;
        frames = 0;
      }
      if (controls.isLocked && !consoleOpenRef.current) {
        const delta = (timeNow - prevTime) / 1000;
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();
        if (moveForward || moveBackward) velocity.z -= direction.z * 100.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 100.0 * delta;
        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        camera.position.x = Math.max(-45, Math.min(45, camera.position.x));
        camera.position.z = Math.max(-45, Math.min(45, camera.position.z));
      }
      prevTime = timeNow;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(timerInterval);
      cancelAnimationFrame(requestRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-sans">
      {/* FPS COUNTER */}
      <div className="absolute bottom-6 right-6 z-50 font-mono text-[10px] font-black text-white/20 select-none">
        FPS: <span className={fps > 55 ? 'text-green-500/50' : 'text-yellow-500/50'}>{fps}</span>
      </div>

      {/* 3D CANVAS MOUNT */}
      <div ref={mountRef} className="absolute inset-0 cursor-crosshair" />

      {/* F8 CONSOLE */}
      <AnimatePresence>
        {consoleOpen && (
          <motion.div 
            initial={{ y: -300, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -300, opacity: 0 }}
            className="absolute top-0 left-0 right-0 z-[100] bg-zinc-900/95 backdrop-blur-xl border-b border-white/10 shadow-2xl h-[300px] flex flex-col font-mono"
          >
            <div className="flex-1 overflow-y-auto p-4 text-[13px] space-y-1">
              {consoleLogs.map((log, i) => (
                <div key={i} className={log.startsWith('>') ? 'text-yellow-500' : 'text-zinc-400'}>
                  {log}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-white/5 flex items-center gap-3">
              <span className="text-yellow-500 font-bold">{'>'}</span>
              <input 
                autoFocus
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCommand(commandInput);
                    setCommandInput('');
                  }
                  if (e.key.toLowerCase() === 'j') {
                    setConsoleOpen(false);
                    controlsRef.current.lock();
                  }
                }}
                className="flex-1 bg-transparent border-none outline-none text-white text-sm"
                placeholder="Introducir comando..."
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OVERLAY UI */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {/* Header is always there but hidden when playing to maintain DOM stability */}
        <div className={`transition-opacity duration-500 ${gameState === 'playing' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <Header transparent />
        </div>
        
        {/* CROSSHAIR (FIVEM STYLE) */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-200"
          style={{ transform: `translate(-50%, -50%) scale(${reticuleSize})` }}
        >
          {reticuleType === 'complex' ? (
            <div className="relative flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white/60 rounded-full"></div>
              <div className="absolute w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_5px_rgba(255,255,255,0.5)]"></div>
            </div>
          ) : (
            <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_5px_rgba(255,255,255,0.8)]"></div>
          )}
        </div>

        {/* HUD */}
        <div className="absolute top-24 left-6 right-6 flex justify-between items-start">
          <div className="bg-black/40 backdrop-blur-md border border-white/10 px-6 py-4 rounded-2xl">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">SCORE</p>
            <p className="text-3xl font-black text-yellow-500 font-mono tracking-tighter">{score.toLocaleString()}</p>
          </div>
          
          <div className="bg-black/40 backdrop-blur-md border border-white/10 px-6 py-4 rounded-2xl text-right">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">TIME</p>
            <p className="text-3xl font-black text-white font-mono tracking-tighter">{time}s</p>
          </div>
        </div>
      </div>

      {/* MENU / OVERLAY */}
      <AnimatePresence>
        {gameState === 'menu' && !consoleOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <div className="max-w-md w-full p-12 text-center">
              <div className="mb-8 flex justify-center">
                <div className="w-20 h-20 bg-yellow-500/10 rounded-3xl flex items-center justify-center border border-yellow-500/20">
                  <Target size={40} className="text-yellow-500" />
                </div>
              </div>
              
              <h1 className="text-5xl font-black mb-4 tracking-tighter uppercase">
                LHC<span className="text-yellow-500">TRAINER</span>
              </h1>
              <p className="text-zinc-500 mb-12 font-medium">
                Mejora tu precisión y reflejos con el entrenador de puntería definitivo para FiveM.
              </p>

              <div className="space-y-4">
                <button 
                  onClick={startGame}
                  className="w-full btn-pill btn-gold py-4 text-sm font-black flex items-center justify-center gap-2"
                >
                  <Play size={18} fill="currentColor" /> EMPEZAR ENTRENAMIENTO
                </button>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">WASD</p>
                    <p className="text-xs font-bold">Moverse</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">J</p>
                    <p className="text-xs font-bold">Consola</p>
                  </div>
                </div>
              </div>

              <div className="mt-12 p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl flex items-center gap-3">
                <MousePointer2 size={16} className="text-yellow-500" />
                <p className="text-[10px] text-zinc-500 font-bold">Haz clic en la pantalla para capturar el ratón</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
