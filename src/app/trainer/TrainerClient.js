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
  const [leaderboard, setLeaderboard] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [hasSaved, setHasSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
  const sensRef = useRef(1.0); // Equivalent to 0 in FiveM/GTA
  const retSizeRef = useRef(1.0);
  const retTypeRef = useRef('simple');
  const bindsRef = useRef({
    'm': 'toggle profile_reticule'
  });
  const timeRef = useRef(60);
  const scoreRef = useRef(0);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  // Load Global Leaderboard
  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      if (!data.error) setLeaderboard(data);
    } catch (err) {
      console.error('Error fetching global ranking:', err);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const saveScore = async () => {
    if (!playerName.trim() || hasSaved || isSaving) return;
    setIsSaving(true);
    console.log('Iniciando guardado de puntuación...', { name: playerName, score });
    
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName.trim(), score: score })
      });
      
      const result = await res.json();
      console.log('Respuesta del servidor:', result);

      if (res.ok) {
        setHasSaved(true);
        console.log('Puntuación guardada con éxito.');
        fetchLeaderboard(); 
      } else {
        console.error('Error del servidor:', result.error);
        alert('Error al guardar: ' + (result.error || 'Desconocido'));
      }
    } catch (err) {
      console.error('Error de conexión con la API:', err);
      alert('Error de conexión. Revisa la consola (F12).');
    } finally {
      setIsSaving(false);
    }
  };

  const startGame = () => {
    // Sync both state and ref immediately
    gameStateRef.current = 'playing';
    setGameState('playing');
    
    scoreRef.current = 0;
    timeRef.current = 60;
    setScore(0);
    setTime(60);
    setIsPaused(false);
    isPausedRef.current = false;
    setHasSaved(false);

    // CRITICAL: Clear existing targets from scene to avoid freezes/memory leaks
    if (sceneRef.current && targetsRef.current.length > 0) {
      targetsRef.current.forEach(target => {
        sceneRef.current.remove(target);
      });
      targetsRef.current = [];
    }

    // Spawn initial targets
    if (sceneRef.current) {
      for (let i = 0; i < 8; i++) {
        internalSpawnGlobal(sceneRef.current);
      }
    }

    if (controlsRef.current) controlsRef.current.lock();
  };

  const restartGame = () => {
    startGame();
  };

  const quitGame = () => {
    gameStateRef.current = 'menu';
    setGameState('menu');
    setIsPaused(false);
    isPausedRef.current = false;
    scoreRef.current = 0;
    timeRef.current = 60;
    setScore(0);
    setTime(60);
    menuLockoutRef.current = Date.now() + 1000; // 1s lockout
    if (controlsRef.current) {
      controlsRef.current.unlock();
    }
  };

  const resumeGame = () => {
    setIsPaused(false);
    isPausedRef.current = false;
    if (controlsRef.current) controlsRef.current.lock();
  };

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

    // BIND must be first to avoid matching keywords inside the sub-command
    if (action === 'bind') {
      const match = cleanCmd.match(/bind\s+keyboard\s+"?(\w+)"?\s+"?(.+)"?/i);
      if (match) {
        const key = match[1].toLowerCase();
        const subCmd = match[2].replace(/"/g, ''); 
        bindsRef.current[key] = subCmd;
        setConsoleLogs(prev => [...prev, `TECLA [${key.toUpperCase()}] ASIGNADA A: ${subCmd}`]);
      }
      return; 
    }

    if (action === 'profile_mouseonfootscale') {
      const val = parseFloat(parts[1]);
      // Standard GTA mapping: 1.0 + (val * 0.1)
      sensRef.current = 1.0 + (val * 0.1);
      setSensitivity(sensRef.current);
      setConsoleLogs(prev => [...prev, `SENSIBILIDAD FIVE M AJUSTADA: ${val}`]);
    } 
    else if (action === 'profile_reticulesize') {
      const val = parseFloat(parts[1]);
      retSizeRef.current = 1.0 + (val * 0.2);
      setReticuleSize(retSizeRef.current);
      setConsoleLogs(prev => [...prev, `TAMAÑO MIRA: ${val}`]);
    }
    else if (action === 'toggle' && cleanCmd.toLowerCase().includes('profile_reticule')) {
      retTypeRef.current = retTypeRef.current === 'complex' ? 'simple' : 'complex';
      setReticuleType(retTypeRef.current);
      setConsoleLogs(prev => [...prev, `ESTILO DE MIRA: ${retTypeRef.current.toUpperCase()}`]);
    }
  };

  const consoleOpenRef = useRef(false);
  const gameStateRef = useRef('menu');
  const menuLockoutRef = useRef(0); // Cooldown to prevent accidental re-lock

  useEffect(() => {
    if (!mountRef.current) return;

    // Timer Interval
    const timerInterval = setInterval(() => {
      if (gameStateRef.current === 'playing' && !consoleOpenRef.current && !isPausedRef.current) {
        if (timeRef.current > 0) {
          timeRef.current -= 1;
          setTime(timeRef.current);
        } else {
          gameStateRef.current = 'finished';
          setGameState('finished');
          if (controlsRef.current) controlsRef.current.unlock();
        }
      }
    }, 1000);

    const scene = new THREE.Scene();
    sceneRef.current = scene; // Save scene to ref for startGame access
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
      // Safety check: if we locked but aren't playing, unlock!
      if (gameStateRef.current !== 'playing') {
        controls.unlock();
        return;
      }
      setIsPaused(false);
      isPausedRef.current = false;
      consoleOpenRef.current = false;
      setConsoleOpen(false);
    });

    controls.addEventListener('unlock', () => {
      if (!consoleOpenRef.current) {
        setIsPaused(true);
        isPausedRef.current = true;
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

    const internalSpawnGlobal = (targetScene) => {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 12, 12), 
        new THREE.MeshStandardMaterial({ 
          color: 0xffffff, 
          emissive: 0xffffff,
          emissiveIntensity: 0.5 
        })
      );
      sphere.position.set((Math.random() - 0.5) * 30, (Math.random() * 8) + 1, -((Math.random() * 20) + 10));
      targetScene.add(sphere);
      targetsRef.current.push(sphere);
    };

    // Store in a ref so startGame can call it
    window.internalSpawn = internalSpawnGlobal;

    for (let i = 0; i < 8; i++) internalSpawnGlobal(scene);

    let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
    const velocity = new THREE.Vector3(), direction = new THREE.Vector3();

    const onKeyDown = (e) => {
      // Disable game keys if console is open, paused, or game is finished
      if (gameStateRef.current === 'finished') return;

      if (e.key.toLowerCase() === 'j') {
        const nextState = !consoleOpenRef.current;
        consoleOpenRef.current = nextState;
        setConsoleOpen(nextState);
        if (nextState) controls.unlock(); else controls.lock();
        return;
      }
      if (e.key === 'Escape') {
        if (gameStateRef.current === 'playing') {
          setIsPaused(true);
          isPausedRef.current = true;
          controls.unlock();
        }
      }
      if (consoleOpenRef.current || isPausedRef.current) return;
      
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
      if (!controls.isLocked || consoleOpenRef.current || gameStateRef.current !== 'playing' || isPausedRef.current) return;
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
    const onMouseMove = (event) => {
      if (!controls.isLocked || consoleOpenRef.current || isPausedRef.current) return;
      
      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      // Manual rotation logic with sensitivity
      const sensMultiplier = Math.pow(1.2, (sensRef.current - 1) * 2); 
      const finalSens = 0.0015 * sensMultiplier;

      const euler = new THREE.Euler(0, 0, 0, 'YXZ');
      euler.setFromQuaternion(camera.quaternion);

      euler.y -= movementX * finalSens;
      euler.x -= movementY * finalSens;

      // Clamp vertical rotation
      euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));

      camera.quaternion.setFromEuler(euler);
    };
    window.addEventListener('mousemove', onMouseMove);

    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      if (controls.isLocked && !consoleOpenRef.current && !isPausedRef.current) {
        const delta = 0.016;
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();
        if (moveForward || moveBackward) velocity.z -= direction.z * 100.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 100.0 * delta;
        
        // Manual movement calculation
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        camDir.y = 0;
        camDir.normalize();
        const camRight = new THREE.Vector3().crossVectors(camera.up, camDir);
        
        camera.position.addScaledVector(camDir, -velocity.z * delta);
        camera.position.addScaledVector(camRight, velocity.x * delta);

        camera.position.x = Math.max(-45, Math.min(45, camera.position.x));
        camera.position.z = Math.max(-45, Math.min(45, camera.position.z));
      }
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
      window.removeEventListener('mousemove', onMouseMove);
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

      {/* PAUSE MENU */}
      <AnimatePresence>
        {isPaused && gameState === 'playing' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center"
          >
            <div className="bg-zinc-900/90 p-8 rounded-2xl border border-white/10 shadow-2xl w-full max-w-md text-center space-y-6">
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Juego Pausado</h2>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={resumeGame}
                  className="w-full py-4 bg-yellow-500 text-black font-black rounded-xl hover:bg-yellow-400 transition-colors uppercase tracking-widest"
                >
                  Continuar
                </button>
                <button 
                  onClick={restartGame}
                  className="w-full py-4 bg-zinc-800 text-white font-black rounded-xl hover:bg-zinc-700 transition-colors uppercase tracking-widest"
                >
                  Reiniciar
                </button>
                <button 
                  onClick={quitGame}
                  className="w-full py-4 bg-red-500/20 text-red-500 font-black rounded-xl hover:bg-red-500/30 transition-colors uppercase tracking-widest border border-red-500/50"
                >
                  Salir al Menú
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    setConsoleOpen(false);
                    if (controlsRef.current) controlsRef.current.lock();
                  }
                  if (e.key.toLowerCase() === 'j') {
                    setConsoleOpen(false);
                    if (controlsRef.current) controlsRef.current.lock();
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
          style={{ 
            transform: `translate(-50%, -50%) scale(${reticuleSize})`,
            opacity: gameState === 'playing' && !isPaused ? 1 : 0
          }}
          className="absolute top-1/2 left-1/2 pointer-events-none z-50 transition-all duration-100"
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

      {/* RESULTS / GAME OVER */}
      <AnimatePresence>
        {gameState === 'finished' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 z-[150] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 pointer-events-auto"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <div className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-3xl p-10 text-center shadow-2xl space-y-8">
              <div className="space-y-2">
                <h2 className="text-sm font-black text-yellow-500 uppercase tracking-[0.3em]">Entrenamiento Finalizado</h2>
                <p className="text-5xl font-black text-white tabular-nums tracking-tighter">{score.toLocaleString()}</p>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Puntos Totales</p>
              </div>

              {!hasSaved ? (
                <div className="space-y-4">
                  <input 
                    type="text"
                    placeholder="Escribe tu nombre..."
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()} // Prevent J key from opening console
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white font-bold focus:border-yellow-500/50 outline-none transition-colors"
                  />
                  <button 
                    onClick={saveScore}
                    disabled={isSaving}
                    className={`w-full py-4 font-black rounded-xl transition-all uppercase tracking-widest pointer-events-auto ${
                      isSaving ? 'bg-zinc-700 text-zinc-400 cursor-wait' : 'bg-yellow-500 text-black hover:bg-yellow-400'
                    }`}
                  >
                    {isSaving ? 'Guardando...' : 'Guardar en el Ranking'}
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <p className="text-green-500 font-bold text-sm">¡Puntuación guardada correctamente!</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={startGame}
                  className="flex-1 py-4 bg-white/5 text-white font-black rounded-xl hover:bg-white/10 transition-colors uppercase tracking-widest text-xs pointer-events-auto"
                >
                  Volver a Jugar
                </button>
                <button 
                  onClick={quitGame}
                  className="flex-1 py-4 bg-zinc-800 text-zinc-400 font-black rounded-xl hover:bg-zinc-700 transition-colors uppercase tracking-widest text-xs pointer-events-auto"
                >
                  Ir al Menú
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MENU / LEADERBOARD */}
      <AnimatePresence mode="wait">
        {gameState === 'menu' && !consoleOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] flex flex-col md:flex-row items-center justify-center bg-black/80 backdrop-blur-sm p-10 gap-12 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left: Branding & Start */}
            <div className="max-w-md w-full text-center md:text-left space-y-8">
              <div>
                <div className="w-20 h-20 bg-yellow-500/10 rounded-3xl flex items-center justify-center border border-yellow-500/20 mb-6 mx-auto md:mx-0">
                  <Target size={40} className="text-yellow-500" />
                </div>
                <h1 className="text-6xl font-black tracking-tighter uppercase leading-none">
                  LHC<br/><span className="text-yellow-500">TRAINER</span>
                </h1>
                <p className="text-zinc-500 mt-4 font-medium max-w-xs">
                  Entrena como los mejores de FiveM. Precisión, velocidad y reflejos al límite.
                </p>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={startGame}
                  className="w-full btn-pill btn-gold py-5 text-sm font-black flex items-center justify-center gap-3 group pointer-events-auto"
                >
                  <Play size={20} fill="currentColor" className="group-hover:scale-125 transition-transform" /> 
                  EMPEZAR ENTRENAMIENTO
                </button>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 text-center md:text-left">MOVIMIENTO</p>
                    <p className="text-xs font-bold text-center md:text-left">WASD</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 text-center md:text-left">CONSOLA</p>
                    <p className="text-xs font-bold text-center md:text-left">TECLA J</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Leaderboard */}
            <div className="w-full max-w-sm bg-zinc-900/50 border border-white/10 rounded-3xl p-8 flex flex-col h-[500px]">
              <div className="flex items-center gap-3 mb-6">
                <Shield size={20} className="text-yellow-500" />
                <h2 className="text-lg font-black text-white uppercase tracking-tighter">Ranking Top 10</h2>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide pointer-events-auto">
                {leaderboard.length > 0 ? leaderboard.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black ${
                        i === 0 ? 'bg-yellow-500 text-black' : 
                        i === 1 ? 'bg-zinc-400 text-black' : 
                        i === 2 ? 'bg-orange-700 text-white' : 
                        'bg-zinc-800 text-zinc-500'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="text-sm font-bold text-zinc-300">{entry.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-white tabular-nums">{entry.score.toLocaleString()}</p>
                      <p className="text-[8px] text-zinc-600 font-bold uppercase">{entry.date}</p>
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-2 opacity-50">
                    <Shield size={32} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-center">No hay puntuaciones registradas</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
