import { Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Jersey, DEFAULT_ZONE_CONFIGS, type JerseyAPI, type Zone, type ZoneConfig, type PatternType, type OverlayOptions } from './Jersey'

const MODEL_PATH = `${import.meta.env.BASE_URL}football_shirt.glb`

const ALL_ZONES = Object.keys(DEFAULT_ZONE_CONFIGS) as Zone[]
const PATTERN_OPTIONS: PatternType[] = ['none', 'chevrons', 'stripes', 'dots', 'checkerboard', 'diagonal_stripes', 'houndstooth', 'gradient', 'stars', 'crosses', 'zigzag', 'argyle', 'camo']

function formatZoneLabel(zone: string): string {
  return zone.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function JerseyEditorPage() {
  const jerseyApiRef = useRef<JerseyAPI | null>(null)
  const [configs, setConfigs] = useState<Record<Zone, ZoneConfig>>(
    () => ({ ...DEFAULT_ZONE_CONFIGS }),
  )
  const [numberText, setNumberText] = useState('')
  const [numberColor, setNumberColor] = useState('#ffffff')
  const [numberScale, setNumberScale] = useState(80)

  const zoneConfigs = useMemo(() => ({ ...configs }), [configs])

  const overlays = useMemo<OverlayOptions | undefined>(() => {
    if (!numberText) return undefined
    return { number: { text: numberText, color: numberColor, zone: 'back', scale: numberScale } }
  }, [numberText, numberColor, numberScale])

  const handleJerseyReady = useCallback((api: JerseyAPI) => {
    jerseyApiRef.current = api
  }, [])

  const handleExportUVMap = useCallback(() => {
    jerseyApiRef.current?.exportDebugUVMap('jersey-uv-debug.png')
  }, [])

  const handleColorChange = useCallback((zone: Zone, value: string) => {
    setConfigs((prev) => ({ ...prev, [zone]: { ...prev[zone], color: value } }))
  }, [])

  const handlePatternChange = useCallback((zone: Zone, value: PatternType) => {
    setConfigs((prev) => ({ ...prev, [zone]: { ...prev[zone], pattern: value } }))
  }, [])

  const handlePatternColorChange = useCallback((zone: Zone, value: string) => {
    setConfigs((prev) => ({ ...prev, [zone]: { ...prev[zone], patternColor: value } }))
  }, [])

  const handlePatternScaleChange = useCallback((zone: Zone, value: number) => {
    setConfigs((prev) => ({ ...prev, [zone]: { ...prev[zone], patternScale: value } }))
  }, [])

  const handlePatternOpacityChange = useCallback((zone: Zone, value: number) => {
    setConfigs((prev) => ({ ...prev, [zone]: { ...prev[zone], patternOpacity: value } }))
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', display: 'flex' }}>
      {/* Controls panel */}
      <div
        style={{
          width: 280,
          minWidth: 280,
          height: '100%',
          overflowY: 'auto',
          background: '#121212',
          borderRight: '1px solid #222',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 10,
        }}
      >
        <h2 style={{ color: '#fff', margin: '0 0 8px', fontSize: 18 }}>Number</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={3}
            placeholder="#"
            value={numberText}
            onChange={(e) => setNumberText(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
            style={{
              flex: 1,
              fontSize: 14,
              padding: '6px 8px',
              background: '#1a1a1a',
              color: '#fff',
              border: '1px solid #333',
              borderRadius: 4,
            }}
          />
          <input
            type="color"
            value={numberColor}
            onChange={(e) => setNumberColor(e.target.value)}
            style={{ width: 36, height: 28, border: 'none', cursor: 'pointer', background: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ color: '#888', fontSize: 12 }}>Size</label>
          <input
            type="range"
            min={20}
            max={100}
            value={numberScale}
            onChange={(e) => setNumberScale(Number(e.target.value))}
            style={{ flex: 1 }}
          />
        </div>
        <h2 style={{ color: '#fff', margin: '12px 0 8px', fontSize: 18 }}>Zone Config</h2>
        {ALL_ZONES.map((zone) => (
          <div key={zone} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ color: '#ccc', fontSize: 13, fontWeight: 600 }}>{formatZoneLabel(zone)}</label>
              <input
                type="color"
                value={configs[zone].color}
                onChange={(e) => handleColorChange(zone, e.target.value)}
                style={{ width: 36, height: 28, border: 'none', cursor: 'pointer', background: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 4 }}>
              <select
                value={configs[zone].pattern ?? 'none'}
                onChange={(e) => handlePatternChange(zone, e.target.value as PatternType)}
                style={{
                  flex: 1,
                  fontSize: 12,
                  padding: '3px 4px',
                  background: '#1a1a1a',
                  color: '#ccc',
                  border: '1px solid #333',
                  borderRadius: 4,
                }}
              >
                {PATTERN_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p === 'none' ? '—' : p}</option>
                ))}
              </select>
              {configs[zone].pattern && configs[zone].pattern !== 'none' && (
                <input
                  type="color"
                  value={configs[zone].patternColor ?? '#ffffff'}
                  onChange={(e) => handlePatternColorChange(zone, e.target.value)}
                  style={{ width: 28, height: 22, border: 'none', cursor: 'pointer', background: 'none' }}
                />
              )}
            </div>
            {configs[zone].pattern && configs[zone].pattern !== 'none' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ color: '#888', fontSize: 11, width: 44 }}>Scale</label>
                  <input
                    type="range"
                    min={0.2}
                    max={3}
                    step={0.1}
                    value={configs[zone].patternScale ?? 1}
                    onChange={(e) => handlePatternScaleChange(zone, Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ color: '#888', fontSize: 11, width: 44 }}>Opacity</label>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={configs[zone].patternOpacity ?? 1}
                    onChange={(e) => handlePatternOpacityChange(zone, Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <button
            onClick={handleExportUVMap}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid #333',
              borderRadius: 8,
              background: '#1a1a1a',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Export UV Map
          </button>
        </div>
      </div>

      {/* 3D viewport */}
      <div style={{ flex: 1, height: '100%' }}>
        <Canvas
        camera={{ position: [0, 1.8, 4.8], fov: 40 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#0a0a0a'))
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.1
        }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[2, 4, 2]} intensity={1.4} />
        <directionalLight position={[-2, 1, -1]} intensity={0.45} />
        <Suspense fallback={null}>
          <Jersey modelPath={MODEL_PATH} zoneConfigs={zoneConfigs} overlays={overlays} onReady={handleJerseyReady} />
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
    </div>
  )
}
