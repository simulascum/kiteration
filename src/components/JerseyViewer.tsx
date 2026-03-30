import { useRef, useState, useCallback, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import * as THREE from 'three'
import { Jersey, type JerseyAPI, type ZoneConfig, type OverlayOptions, type PatternType } from './Jersey'

const MODEL_PATH = `${import.meta.env.BASE_URL}football_shirt.glb`
const NYC_CENTER: [number, number] = [40.758, -73.9855]

// Animated shadow disc on the ground
function ShadowDisc() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = (Math.sin(clock.getElapsedTime() * 1.2) + 1) / 2
    ref.current.scale.setScalar(1 - t * 0.15)
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity = 0.45 - t * 0.15
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <circleGeometry args={[1.1, 64]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.45} depthWrite={false} />
    </mesh>
  )
}

type Rarity = 'common' | 'rare' | 'legendary'

const RARITY_CONFIG: Record<Rarity, {
  color: string
  innerRadius: number
  outerRadius: number
  speed: number
  pulseSpeed: number
  baseOpacity: number
  pulseRange: number
  emissive: string
  emissiveIntensity: number
}> = {
  common: {
    color: '#cd7f32',
    innerRadius: 0.95,
    outerRadius: 1.05,
    speed: 0.4,
    pulseSpeed: 1.5,
    baseOpacity: 0.3,
    pulseRange: 0.1,
    emissive: '#cd7f32',
    emissiveIntensity: 0,
  },
  rare: {
    color: '#c0c0c0',
    innerRadius: 0.88,
    outerRadius: 1.12,
    speed: 0.6,
    pulseSpeed: 2.5,
    baseOpacity: 0.4,
    pulseRange: 0.2,
    emissive: '#c0c0c0',
    emissiveIntensity: 0.3,
  },
  legendary: {
    color: '#ffd700',
    innerRadius: 0.78,
    outerRadius: 1.22,
    speed: 1.0,
    pulseSpeed: 3.5,
    baseOpacity: 0.55,
    pulseRange: 0.3,
    emissive: '#ffd700',
    emissiveIntensity: 0.8,
  },
}

// Spinning rarity ring
function GroundRing({ rarity }: { rarity: Rarity }) {
  const ref = useRef<THREE.Mesh>(null)
  const cfg = RARITY_CONFIG[rarity]
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.z = clock.getElapsedTime() * cfg.speed
    const pulse = (Math.sin(clock.getElapsedTime() * cfg.pulseSpeed) + 1) / 2
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity = cfg.baseOpacity + pulse * cfg.pulseRange
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <ringGeometry args={[cfg.innerRadius, cfg.outerRadius, 64]} />
      <meshBasicMaterial color={cfg.color} transparent opacity={cfg.baseOpacity} depthWrite={false} />
    </mesh>
  )
}

// Outer particle ring for legendary — faster, thinner, more transparent
function OuterRing() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.z = -clock.getElapsedTime() * 1.8
    const pulse = (Math.sin(clock.getElapsedTime() * 5) + 1) / 2
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity = 0.15 + pulse * 0.25
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
      <ringGeometry args={[1.22, 1.35, 64]} />
      <meshBasicMaterial color="#fff8dc" transparent opacity={0.2} depthWrite={false} />
    </mesh>
  )
}

// Jersey hover/bob + slow spin animation
function FloatingGroup({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(clock.getElapsedTime() * 1.2) * 0.08 + 0.2
      ref.current.rotation.y = clock.getElapsedTime() * 0.3
    }
  })
  return <group ref={ref}>{children}</group>
}

export function JerseyViewer() {
  const jerseyApiRef = useRef<JerseyAPI | null>(null)

  const [isLoaded, setIsLoaded] = useState(false)
  const [rarity, setRarity] = useState<Rarity>('rare')
  const [frontColor, setFrontColor] = useState('#0055ff')
  const [backColor, setBackColor] = useState('#0055ff')
  const [sleeveColor, setSleeveColor] = useState('#0055ff')
  const [collarColor, setCollarColor] = useState('#ffffff')
  const [cuffColor, setCuffColor] = useState('#ffffff')
  const [hemColor, setHemColor] = useState('#0055ff')
  const [trimColor, setTrimColor] = useState('#0055ff')
  const [jerseyNumber, setJerseyNumber] = useState('10')
  const [numberColor, setNumberColor] = useState('#ffffff')
  const [decalImg, setDecalImg] = useState<HTMLImageElement | null>(null)
  const [decalColor, setDecalColor] = useState('#ffffff')
  const [decalScale, setDecalScale] = useState(40)
  const [pattern, setPattern] = useState<'none' | 'chevrons' | 'stripes' | 'dots'>('none')
  const [patternColor, setPatternColor] = useState('#ffffff')

  const handleJerseyReady = useCallback((api: JerseyAPI) => {
    jerseyApiRef.current = api
    setIsLoaded(true)
  }, [])

  const handleDecalUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => setDecalImg(img)
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }, [])

  const clearDecal = useCallback(() => setDecalImg(null), [])

  const patternZones = ['front', 'back', 'right_sleeve', 'left_sleeve']

  const zoneConfigs = useMemo<Record<string, ZoneConfig>>(() => {
    const cfg = (color: string, zone: string): ZoneConfig => ({
      color,
      pattern: (patternZones.includes(zone) ? pattern : 'none') as PatternType,
      patternColor: patternColor,
    })
    return {
      front: cfg(frontColor, 'front'),
      back: cfg(backColor, 'back'),
      right_sleeve: cfg(sleeveColor, 'right_sleeve'),
      left_sleeve: cfg(sleeveColor, 'left_sleeve'),
      right_cuff: cfg(cuffColor, 'right_cuff'),
      left_cuff: cfg(cuffColor, 'left_cuff'),
      front_hem: cfg(hemColor, 'front_hem'),
      back_hem: cfg(collarColor, 'back_hem'),
      back_collar: cfg(trimColor, 'back_collar'),
      front_collar: cfg(trimColor, 'front_collar'),
    }
  }, [frontColor, backColor, sleeveColor, collarColor, cuffColor, hemColor, trimColor, pattern, patternColor])

  const overlays = useMemo<OverlayOptions>(() => ({
    decal: decalImg ? {
      image: decalImg,
      color: decalColor,
      scale: decalScale,
      vertOffset: 0.2,
      frontIslandId: 1,
    } : undefined,
    number: jerseyNumber.trim() ? {
      text: jerseyNumber,
      color: numberColor,
      zone: 'back',
      scale: 80,
    } : undefined,
  }), [jerseyNumber, numberColor, decalImg, decalColor, decalScale])

  const resetTexture = useCallback(() => {
    jerseyApiRef.current?.reset()
  }, [])

  return (
    <div className="viewer-root">
      {!isLoaded && <div className="loading">Loading model...</div>}

      {/* Dark NYC map background */}
      <div className="map-layer">
        <MapContainer
          center={NYC_CENTER}
          zoom={17}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          keyboard={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        </MapContainer>
      </div>

      {/* 3D canvas — transparent so map shows through */}
      <div className="canvas-layer">
        <Canvas
          camera={{ position: [0, 2.2, 3.2], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.2
          }}
        >
          <ambientLight intensity={0.9} />
          <directionalLight position={[2, 4, 2]} intensity={1.5} />
          <directionalLight position={[-2, 1, -1]} intensity={0.5} />
          <Suspense fallback={null}>
            <ShadowDisc />
            <GroundRing rarity={rarity} />
            {rarity === 'legendary' && <OuterRing />}
            <FloatingGroup>
              <Jersey
                modelPath={MODEL_PATH}
                zoneConfigs={zoneConfigs}
                overlays={overlays}
                onReady={handleJerseyReady}
              />
            </FloatingGroup>
          </Suspense>
          <OrbitControls
            enableDamping
            target={[0, 1, 0]}
            minPolarAngle={Math.PI / 8}
            maxPolarAngle={Math.PI / 2.2}
            enablePan={false}
            minDistance={2}
            maxDistance={6}
          />
        </Canvas>
      </div>

      <div className="controls-panel">
        <h2>Jersey Recolor</h2>
        <div className="control-row">
          <label>Front</label>
          <input type="color" value={frontColor} onChange={(e) => setFrontColor(e.target.value)} />
        </div>
        <div className="control-row">
          <label>Back</label>
          <input type="color" value={backColor} onChange={(e) => setBackColor(e.target.value)} />
        </div>
        <div className="control-row">
          <label>Sleeves</label>
          <input type="color" value={sleeveColor} onChange={(e) => setSleeveColor(e.target.value)} />
        </div>
        <div className="control-row">
          <label>Back Hem</label>
          <input type="color" value={collarColor} onChange={(e) => setCollarColor(e.target.value)} />
        </div>
        <div className="control-row">
          <label>Cuffs</label>
          <input type="color" value={cuffColor} onChange={(e) => setCuffColor(e.target.value)} />
        </div>
        <div className="control-row">
          <label>Front Hem</label>
          <input type="color" value={hemColor} onChange={(e) => setHemColor(e.target.value)} />
        </div>
        <div className="control-row">
          <label>Collar</label>
          <input type="color" value={trimColor} onChange={(e) => setTrimColor(e.target.value)} />
        </div>

        <div className="section-divider" />
        <div className="control-row">
          <label>Number</label>
          <input
            type="text"
            maxLength={3}
            value={jerseyNumber}
            onChange={(e) => setJerseyNumber(e.target.value)}
            className="number-input"
          />
        </div>
        <div className="control-row">
          <label>Number Color</label>
          <input
            type="color"
            value={numberColor}
            onChange={(e) => setNumberColor(e.target.value)}
          />
        </div>

        <div className="section-divider" />
        <div className="pattern-section">
          <label>Pattern</label>
          <div className="pattern-options">
            {(['none', 'chevrons', 'stripes', 'dots'] as const).map((p) => (
              <button
                key={p}
                className={`pattern-btn ${pattern === p ? 'active' : ''}`}
                onClick={() => setPattern(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          {pattern !== 'none' && (
            <div className="control-row" style={{ marginTop: 8 }}>
              <label>Pattern Color</label>
              <input type="color" value={patternColor} onChange={(e) => setPatternColor(e.target.value)} />
            </div>
          )}
        </div>

        <div className="section-divider" />
        <div className="decal-section">
          <div className="control-row">
            <label>Decal (SVG)</label>
            <label className="btn-upload">
              {decalImg ? 'Change' : 'Upload'}
              <input type="file" accept=".svg,image/svg+xml" onChange={handleDecalUpload} hidden />
            </label>
          </div>
          {decalImg && (
            <>
              <div className="control-row">
                <label>Decal Color</label>
                <input type="color" value={decalColor} onChange={(e) => setDecalColor(e.target.value)} />
              </div>
              <div className="control-row">
                <label>Decal Size</label>
                <input type="range" min={10} max={100} value={decalScale} onChange={(e) => setDecalScale(Number(e.target.value))} />
              </div>
              <button className="btn-clear-decal" onClick={clearDecal}>Remove Decal</button>
            </>
          )}
        </div>

        <div className="section-divider" />
        <div className="rarity-selector">
          <label>Rarity</label>
          <div className="rarity-options">
            {(['common', 'rare', 'legendary'] as Rarity[]).map((r) => (
              <button
                key={r}
                className={`rarity-btn rarity-${r} ${rarity === r ? 'active' : ''}`}
                onClick={() => setRarity(r)}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="section-divider" />
        <button className="btn-reset" onClick={resetTexture}>
          Reset
        </button>
      </div>
    </div>
  )
}

