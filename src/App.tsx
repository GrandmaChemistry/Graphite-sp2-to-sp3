/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text, Float, ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { Thermometer, Gauge, Zap, Info, Maximize2, Move, Box, Ruler } from 'lucide-react';

// --- Constants ---
const GRAPHITE_BOND = 1.42;
const GRAPHITE_LAYER_DIST = 3.35;
const DIAMOND_BOND = 1.544;
const ATOM_RADIUS = 0.2;

// --- Helper: Generate Graphite Positions ---
function generateGraphiteAtoms(rows: number, cols: number, layers: number) {
  const atoms = [];
  const a = GRAPHITE_BOND;
  const sqrt3 = Math.sqrt(3);

  for (let l = 0; l < layers; l++) {
    const offsetY = (l - (layers - 1) / 2) * GRAPHITE_LAYER_DIST;
    
    // Graphite AB stacking: Layer 1 is shifted relative to Layer 0
    const gShiftX = (l % 2 === 0) ? 0 : a * sqrt3 / 3;
    const gShiftZ = (l % 2 === 0) ? 0 : 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const baseX = (c - (cols - 1) / 2) * a * sqrt3 + (r % 2 === 0 ? 0 : a * sqrt3 / 2);
        const baseZ = (r - (rows - 1) / 2) * a * 1.5;

        // Atom 1
        atoms.push({
          id: `l${l}-r${r}-c${c}-a1`,
          graphitePos: new THREE.Vector3(baseX + gShiftX, offsetY, baseZ + gShiftZ),
          layer: l,
          type: 0 
        });

        // Atom 2
        atoms.push({
          id: `l${l}-r${r}-c${c}-a2`,
          graphitePos: new THREE.Vector3(baseX + gShiftX, offsetY, baseZ + a + gShiftZ),
          layer: l,
          type: 1
        });
      }
    }
  }
  return atoms;
}

// --- Helper: Generate Diamond Positions (Standard Tetrahedral) ---
function mapToDiamond(graphiteAtoms: any[], layers: number) {
  const d = DIAMOND_BOND;
  const buckle = d / 6; 
  const layerSpacing = d * 4 / 3; 
  const diamondProjBond = d * Math.sqrt(8) / 3;
  
  return graphiteAtoms.map((atom) => {
    const l = atom.layer;
    const type = atom.type;
    
    // 1. Vertical position (now Y) - Centered based on total layers
    const targetY_base = (l - (layers - 1) / 2) * layerSpacing; 
    const targetY = type === 0 ? targetY_base + buckle : targetY_base - buckle;
    
    // 2. Horizontal position (now X and Z)
    // To form vertical bonds between layers in (111) stacking:
    // Atom type 0 of layer L must align with Atom type 1 of layer L+1
    const shiftZ = -l * diamondProjBond;
    
    const scale = diamondProjBond / GRAPHITE_BOND;
    const gShiftX = (l % 2 === 0) ? 0 : GRAPHITE_BOND * Math.sqrt(3) / 3;
    const cleanX = atom.graphitePos.x - gShiftX;
    const cleanZ = atom.graphitePos.z;

    const targetX = cleanX * scale;
    const targetZ = cleanZ * scale + shiftZ;

    return new THREE.Vector3(targetX, targetY, targetZ);
  });
}

const Atom = ({ position, color, temp }: { position: THREE.Vector3, color: string, temp: number }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Thermal jitter
      const jitter = (temp / 3500) * 0.05;
      meshRef.current.position.x = position.x + (Math.random() - 0.5) * jitter;
      meshRef.current.position.y = position.y + (Math.random() - 0.5) * jitter;
      meshRef.current.position.z = position.z + (Math.random() - 0.5) * jitter;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[ATOM_RADIUS, 32, 32]} />
      <meshStandardMaterial 
        color={color} 
        roughness={0.1} 
        metalness={0.8} 
        emissive={temp > 2000 ? "#ff4400" : "#000"} 
        emissiveIntensity={Math.max(0, (temp - 2000) / 1500)} 
      />
    </mesh>
  );
};

const Bond = ({ start, end, progress }: { start: THREE.Vector3, end: THREE.Vector3, progress: number }) => {
  const curve = useMemo(() => new THREE.LineCurve3(start, end), [start, end]);
  const length = start.distanceTo(end);
  
  // Only show bonds if they are close enough (graphite layers don't have vertical bonds, diamond does)
  const isVisible = length < 2.5 || progress > 0.5;

  if (!isVisible) return null;

  return (
    <mesh position={start.clone().lerp(end, 0.5)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize())}>
      <cylinderGeometry args={[0.05, 0.05, length, 8]} />
      <meshStandardMaterial color={progress > 0.5 ? "#e0f2fe" : "#4b5563"} transparent opacity={0.6} />
    </mesh>
  );
};

const MeasurementLabel = ({ start, end, label, color }: { start: THREE.Vector3, end: THREE.Vector3, label: string, color: string }) => {
  const mid = start.clone().lerp(end, 0.5);
  return (
    <group>
      <line>
        <bufferGeometry attach="geometry" setFromPoints={[start, end]} />
        <lineBasicMaterial attach="material" color={color} linewidth={2} />
      </line>
      <Html position={mid} center>
        <div className="bg-black/80 text-[8px] px-1 py-0.5 rounded border border-white/20 whitespace-nowrap font-mono text-white pointer-events-none">
          {label}
        </div>
      </Html>
    </group>
  );
};

const MolecularStructure = ({ progress, temp, layers, showBondLength, showLayerDist }: { progress: number, temp: number, layers: number, showBondLength: boolean, showLayerDist: boolean }) => {
  const atoms = useMemo(() => generateGraphiteAtoms(6, 6, layers), [layers]);
  const diamondTargets = useMemo(() => mapToDiamond(atoms, layers), [atoms, layers]);
  
  const currentPositions = atoms.map((atom, i) => {
    return atom.graphitePos.clone().lerp(diamondTargets[i], progress);
  });

  // Calculate bonds
  const bonds = useMemo(() => {
    const b = [];
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const dist = currentPositions[i].distanceTo(currentPositions[j]);
        const threshold = 1.6 + progress * 0.4; 
        if (dist < threshold) {
          b.push([i, j]);
        }
      }
    }
    return b;
  }, [currentPositions, progress]);

  // Measurement points
  const measurementData = useMemo(() => {
    if (atoms.length < 2) return null;
    
    // Bond length: pick two atoms in layer 0
    const a1Idx = 0;
    let a2Idx = -1;
    for (let j = 1; j < atoms.length; j++) {
      if (atoms[j].layer === 0 && currentPositions[0].distanceTo(currentPositions[j]) < 2) {
        a2Idx = j;
        break;
      }
    }

    // Layer distance: pick one in layer 0 and one in layer 1
    let l1Idx = -1;
    let l2Idx = -1;
    if (layers >= 2) {
      for (let i = 0; i < atoms.length; i++) {
        if (atoms[i].layer === 0 && atoms[i].type === 0) l1Idx = i;
        if (atoms[i].layer === 1 && atoms[i].type === 0) l2Idx = i;
        if (l1Idx !== -1 && l2Idx !== -1) break;
      }
    }

    return { a1Idx, a2Idx, l1Idx, l2Idx };
  }, [atoms, currentPositions, layers]);

  return (
    <group position={[0, 0, 0]}>
      {currentPositions.map((pos, i) => (
        <Atom key={i} position={pos} color={progress > 0.8 ? "#bae6fd" : "#4b5563"} temp={temp} />
      ))}
      {bonds.map(([i, j]) => (
        <Bond key={`${i}-${j}`} start={currentPositions[i]} end={currentPositions[j]} progress={progress} />
      ))}

      {showBondLength && measurementData && measurementData.a2Idx !== -1 && (
        <MeasurementLabel 
          start={currentPositions[measurementData.a1Idx]} 
          end={currentPositions[measurementData.a2Idx]} 
          label={`${currentPositions[measurementData.a1Idx].distanceTo(currentPositions[measurementData.a2Idx]).toFixed(3)} Å`}
          color="#fbbf24"
        />
      )}

      {showLayerDist && layers >= 2 && measurementData && measurementData.l2Idx !== -1 && (
        <MeasurementLabel 
          start={currentPositions[measurementData.l1Idx]} 
          end={currentPositions[measurementData.l2Idx]} 
          label={`${Math.abs(currentPositions[measurementData.l1Idx].y - currentPositions[measurementData.l2Idx].y).toFixed(3)} Å`}
          color="#60a5fa"
        />
      )}
    </group>
  );
};

export default function App() {
  const [intensity, setIntensity] = useState(0); // 0 to 100
  const [layers, setLayers] = useState(5);
  const [showBondLength, setShowBondLength] = useState(false);
  const [showLayerDist, setShowLayerDist] = useState(false);
  const controlsRef = useRef<any>(null);
  
  // Derived values for display
  const temp = 25 + (intensity / 100) * 3475;
  const pressure = 1 + (intensity / 100) * 99999;
  
  // Transformation logic: Needs high intensity (>60)
  const progress = Math.min(1, Math.max(0, (intensity - 60) / 30));
  const isDiamond = progress > 0.9;

  const setView = (type: 'front' | 'top' | 'iso') => {
    if (!controlsRef.current) return;
    const cam = controlsRef.current.object;
    switch(type) {
      case 'front': cam.position.set(0, 0, 15); break;
      case 'top': cam.position.set(0, 15, 0); break;
      case 'iso': cam.position.set(10, 10, 10); break;
    }
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  return (
    <div className="relative w-full h-screen bg-[#111827] text-white font-sans overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1f2937_0%,#000_100%)]" />

      {/* Header */}
      <header className="absolute top-0 left-0 w-full p-3 z-10 flex justify-between items-start">
        <div className="space-y-0.5">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl font-bold tracking-tighter uppercase italic"
          >
            {isDiamond ? "金刚石 (Diamond)" : "石墨 (Graphite)"}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            className="text-[8px] font-mono uppercase tracking-widest"
          >
            Carbon Allotrope Transformation
          </motion.p>
        </div>
        
        <div className="flex gap-2">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-1 px-2 rounded-lg flex items-center gap-2">
            <Zap className={`w-3 h-3 ${isDiamond ? "text-blue-400" : "text-gray-500"}`} />
            <div>
              <div className="text-[6px] uppercase opacity-50 leading-none">Structure</div>
              <div className="text-[9px] font-bold">{isDiamond ? "SP3 Tetrahedral" : "SP2 Hexagonal"}</div>
            </div>
          </div>
        </div>
      </header>

      {/* 3D Scene */}
      <div className="absolute inset-0">
        <Canvas shadows>
          <PerspectiveCamera makeDefault position={[10, 10, 10]} />
          <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.05} />
          
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={2} color={isDiamond ? "#7dd3fc" : "#ffffff"} />
          <pointLight position={[-10, -10, -10]} intensity={1} color="#ffffff" />
          <spotLight position={[-10, 20, 10]} angle={0.15} penumbra={1} intensity={2.5} />

          <MolecularStructure 
            progress={progress} 
            temp={temp} 
            layers={layers} 
            showBondLength={showBondLength}
            showLayerDist={showLayerDist}
          />
          
          <ContactShadows position={[0, -6, 0]} opacity={0.4} scale={20} blur={2} far={10} />
          {temp > 1000 && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]}>
              <planeGeometry args={[50, 50]} />
              <meshStandardMaterial 
                color="#ff4400" 
                emissive="#ff2200" 
                emissiveIntensity={Math.min(2, (temp - 1000) / 1000)} 
                transparent 
                opacity={0.1} 
              />
            </mesh>
          )}
        </Canvas>
      </div>

      {/* View Controls */}
      <div className="absolute top-16 right-3 z-10 flex flex-col gap-1.5">
        {[
          { id: 'iso', label: 'ISO', icon: Box },
          { id: 'front', label: 'FRONT', icon: Maximize2 },
          { id: 'top', label: 'TOP', icon: Move },
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setView(view.id as any)}
            className="bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 p-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors group"
          >
            <view.icon className="w-3 h-3 opacity-50 group-hover:opacity-100" />
            <span className="text-[8px] font-bold tracking-tighter opacity-50 group-hover:opacity-100">{view.label}</span>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 w-full p-3 z-10 grid grid-cols-1 md:grid-cols-2 gap-3 pointer-events-none">
        <div className="space-y-3 pointer-events-auto bg-black/40 backdrop-blur-xl p-3 rounded-xl border border-white/10 max-w-xs">
          {/* Intensity Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Thermometer className="w-2.5 h-2.5 text-orange-500" />
                  <span className="text-[8px] uppercase font-bold tracking-wider opacity-70">Intensity</span>
                </div>
                <div className="flex gap-3">
                  <span className="font-mono text-[9px] opacity-60">{temp.toLocaleString()}°C</span>
                  <span className="font-mono text-[9px] opacity-60">{pressure.toLocaleString()} atm</span>
                </div>
              </div>
              <span className="font-mono text-sm font-bold">{intensity}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={intensity} 
              onChange={(e) => setIntensity(parseInt(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* Layers Selector */}
          <div className="pt-2 border-t border-white/5 space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Box className="w-2.5 h-2.5 text-blue-400" />
                <span className="text-[8px] uppercase font-bold tracking-wider opacity-70">Layers (层数)</span>
              </div>
              <span className="font-mono text-[10px] font-bold">{layers}</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => setLayers(num)}
                  className={`flex-1 py-1 rounded text-[9px] font-bold transition-colors ${
                    layers === num 
                      ? "bg-white text-black" 
                      : "bg-white/5 hover:bg-white/10 text-white/50"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Measurements (Only for 1 or 2 layers) */}
          {(layers === 1 || layers === 2) && (
            <div className="pt-2 border-t border-white/5 space-y-2">
              <div className="flex items-center gap-1.5">
                <Ruler className="w-2.5 h-2.5 text-amber-400" />
                <span className="text-[8px] uppercase font-bold tracking-wider opacity-70">Measurements (测量)</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBondLength(!showBondLength)}
                  className={`flex-1 py-1 rounded text-[8px] font-bold transition-colors border ${
                    showBondLength 
                      ? "bg-amber-500/20 border-amber-500 text-amber-200" 
                      : "bg-white/5 border-transparent text-white/40"
                  }`}
                >
                  Bond Length (键长)
                </button>
                {layers === 2 && (
                  <button
                    onClick={() => setShowLayerDist(!showLayerDist)}
                    className={`flex-1 py-1 rounded text-[8px] font-bold transition-colors border ${
                      showLayerDist 
                        ? "bg-blue-500/20 border-blue-500 text-blue-200" 
                        : "bg-white/5 border-transparent text-white/40"
                    }`}
                  >
                    Layer Dist (层间距)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-end items-end gap-1.5">
          <AnimatePresence mode="wait">
            {progress > 0 && progress < 0.9 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-orange-500/20 border border-orange-500/50 p-2 rounded-lg max-w-[200px] text-right"
              >
                <div className="flex items-center justify-end gap-1.5 mb-0.5">
                  <span className="text-[8px] font-bold uppercase">Transition</span>
                  <Zap className="w-2.5 h-2.5 text-orange-500 animate-pulse" />
                </div>
                <p className="text-[9px] leading-tight opacity-80">
                  石墨层正在发生褶皱，向金刚石结构转化。
                </p>
              </motion.div>
            )}
            {isDiamond && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-blue-500/20 border border-blue-500/50 p-2 rounded-lg max-w-[200px] text-right"
              >
                <div className="flex items-center justify-end gap-1.5 mb-0.5">
                  <span className="text-[8px] font-bold uppercase">Success</span>
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping" />
                </div>
                <p className="text-[9px] leading-tight opacity-80">
                  金刚石结构已稳定。
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-3 rounded-xl max-w-[280px] pointer-events-auto">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info className="w-2.5 h-2.5 opacity-50" />
              <span className="text-[8px] font-bold uppercase tracking-widest opacity-50">Scientific Context</span>
            </div>
            <p className="text-[9px] leading-relaxed opacity-70">
              模型展示了标准的金刚石晶体结构：键长 1.544 Å，键角 109.5°。
            </p>
          </div>
        </div>
      </div>

      {/* Overlay Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute inset-0 transition-opacity duration-1000 ${temp > 2000 ? "opacity-20" : "opacity-0"} bg-orange-500 mix-blend-overlay`} />
        <div className={`absolute inset-0 transition-opacity duration-1000 ${isDiamond ? "opacity-30" : "opacity-0"} bg-blue-400 mix-blend-soft-light`} />
      </div>
    </div>
  );
}
