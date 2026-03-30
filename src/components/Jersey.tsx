import { useRef, useEffect, useCallback } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { detectUVIslands, type UVIslandData } from '../lib/uvIslands.ts'
import { TexturePainter } from '../lib/texturePainter'

export type { UVIslandData } from '../lib/uvIslands.ts'
export type { NumberOptions, DecalOptions } from '../lib/texturePainter'

import type { PatternType } from '../lib/patterns'
export type { PatternType } from '../lib/patterns'

export interface ZoneConfig {
  color: string
  pattern?: PatternType
  patternColor?: string
  patternScale?: number
  patternOpacity?: number
}

const ZONE_DEFS = [
  [0, 'back',         '#f2255c'],
  [1, 'front',        '#66d36e'],
  [2, 'front_hem',    '#f5e642'],
  [3, 'back_hem',     '#4e68e3'],
  [4, 'right_sleeve', '#f39c34'],
  [5, 'left_sleeve',  '#8f40c8'],
  [6, 'left_cuff',    '#66d9ef'],
  [7, 'right_cuff',   '#d84ee9'],
  [8, 'back_collar',  '#b8e04f'],
  [9, 'front_collar', '#e8b9d8'],
] as const

export type Zone = (typeof ZONE_DEFS)[number][1]

const ISLAND_TO_ZONE = Object.fromEntries(
  ZONE_DEFS.map(([id, zone]) => [id, zone]),
) as Record<number, Zone>

export const DEBUG_ISLAND_COLORS = Object.fromEntries(
  ZONE_DEFS.map(([id, , color]) => [id, color]),
) as Record<number, string>

export const DEFAULT_ZONE_CONFIGS = Object.fromEntries(
  ZONE_DEFS.map(([, zone, color]) => [
    zone,
    { color, pattern: 'none' as PatternType, patternColor: '#ffffff' },
  ]),
) as Record<Zone, ZoneConfig>

export interface JerseyAPI {
  reset: () => void
  exportDebugUVMap: (filename?: string) => void
}

export interface OverlayOptions {
  number?: import('../lib/texturePainter').NumberOptions
  decal?: import('../lib/texturePainter').DecalOptions
}

interface JerseyProps {
  modelPath: string
  zoneConfigs: Record<string, ZoneConfig>
  overlays?: OverlayOptions
  onReady?: (api: JerseyAPI) => void
}

export function Jersey({ modelPath, zoneConfigs, overlays, onReady }: JerseyProps) {
  const { scene } = useGLTF(modelPath)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const islandDataRef = useRef<UVIslandData | null>(null)
  const painterRef = useRef<TexturePainter | null>(null)
  const canvasTexRef = useRef<THREE.CanvasTexture | null>(null)
  const readyRef = useRef(false)

  // Repaint whenever colors or options change
  useEffect(() => {
    const mesh = meshRef.current
    const data = islandDataRef.current
    const painter = painterRef.current
    const ct = canvasTexRef.current
    if (!mesh || !data || !painter || !ct || !readyRef.current) return

    painter.paint(data, ISLAND_TO_ZONE, zoneConfigs, overlays)
    ;(mesh.material as THREE.MeshStandardMaterial).map = ct
    ct.needsUpdate = true
  }, [zoneConfigs, overlays])

  const paintDebugBaseline = useCallback(() => {
    const mesh = meshRef.current
    const data = islandDataRef.current
    const painter = painterRef.current
    const ct = canvasTexRef.current
    if (!mesh || !data || !painter || !ct) return

    painter.paintDebug(data)
    ;(mesh.material as THREE.MeshStandardMaterial).map = ct
    ct.needsUpdate = true
  }, [])

  const reset = useCallback(() => {
    paintDebugBaseline()
  }, [paintDebugBaseline])

  const exportDebugUVMap = useCallback((filename = 'uv-debug-map.png') => {
    const data = islandDataRef.current
    const painter = painterRef.current
    if (!data || !painter) return

    painter.downloadDebugMap(data, filename)
  }, [])

  useEffect(() => {
    let found: THREE.Mesh | null = null

    scene.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh && !found) {
        found = mesh
        const mat = Array.isArray(mesh.material)
          ? (mesh.material[0] as THREE.MeshStandardMaterial)
          : (mesh.material as THREE.MeshStandardMaterial)
        mesh.material = new THREE.MeshStandardMaterial({
          map: mat.map,
          roughness: 0.8,
          metalness: 0.0,
        })
      }
    })

    // Reset cached transforms before measuring
    scene.scale.set(1, 1, 1)
    scene.position.set(0, 0, 0)
    scene.updateWorldMatrix(true, true)

    // Scale so largest dimension = 3
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    scene.scale.setScalar(3 / maxDim)
    scene.updateWorldMatrix(true, true)

    // Center X/Z, place bottom at y=0
    const scaled = new THREE.Box3().setFromObject(scene)
    const center = scaled.getCenter(new THREE.Vector3())
    scene.position.set(-center.x, -scaled.min.y, -center.z)

    meshRef.current = found

    // Compute UV islands
    if (found) {
      islandDataRef.current = detectUVIslands((found as THREE.Mesh).geometry)
    }

    // Set up painter + canvas texture
    const painter = new TexturePainter()
    painterRef.current = painter
    const ct = new THREE.CanvasTexture(painter.canvas)
    ct.flipY = false
    canvasTexRef.current = ct

    readyRef.current = true

    // Default render starts in UV debug colors.
    paintDebugBaseline()

    // Notify parent
    onReady?.({ reset, exportDebugUVMap })
  }, [scene, onReady, paintDebugBaseline, reset, exportDebugUVMap])

  return <primitive object={scene} />
}
