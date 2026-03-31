import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const STAR_COUNT = 3000
const NEBULA_COUNT = 60

// ---------- stars ----------

const starVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  varying float vPhase;
  uniform float uTime;
  void main() {
    vPhase = aPhase;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // twinkle: modulate size over time
    float twinkle = 0.6 + 0.4 * sin(uTime * (1.5 + aPhase * 3.0) + aPhase * 6.2831);
    gl_PointSize = aSize * twinkle * (200.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const starFragmentShader = /* glsl */ `
  varying float vPhase;
  uniform float uTime;
  void main() {
    // soft circle
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.15, 0.5, d);
    // colour tint
    float warm = step(0.7, vPhase);
    vec3 col = mix(vec3(0.85, 0.9, 1.0), vec3(1.0, 0.85, 0.7), warm);
    // blue-ish stars for low phase
    col = mix(col, vec3(0.7, 0.8, 1.0), step(vPhase, 0.25));
    gl_FragColor = vec4(col, alpha);
  }
`

function Stars() {
  const ref = useRef<THREE.Points>(null)
  const uniformsRef = useRef({ uTime: { value: 0 } })

  const { positions, sizes, phases } = useMemo(() => {
    const pos = new Float32Array(STAR_COUNT * 3)
    const sz = new Float32Array(STAR_COUNT)
    const ph = new Float32Array(STAR_COUNT)
    for (let i = 0; i < STAR_COUNT; i++) {
      // distribute on a sphere shell between radius 40 and 100
      const r = 40 + Math.random() * 60
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
      sz[i] = 0.5 + Math.random() * 2.5
      ph[i] = Math.random()
    }
    return { positions: pos, sizes: sz, phases: ph }
  }, [])

  useFrame((_state, delta) => {
    uniformsRef.current.uTime.value += delta
  })

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={starVertexShader}
        fragmentShader={starFragmentShader}
        uniforms={uniformsRef.current}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// ---------- nebulae / galaxies ----------

const nebulaVertexShader = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  varying vec3 vColor;
  varying float vPhase;
  uniform float uTime;
  void main() {
    vColor = aColor;
    vPhase = aPhase;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float pulse = 0.85 + 0.15 * sin(uTime * 0.4 + aPhase * 6.28);
    gl_PointSize = aSize * pulse * (200.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const nebulaFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vPhase;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float alpha = 0.22 * (1.0 - smoothstep(0.0, 0.5, d));
    gl_FragColor = vec4(vColor, alpha);
  }
`

function Nebulae() {
  const uniformsRef = useRef({ uTime: { value: 0 } })

  const { positions, sizes, colors, phases } = useMemo(() => {
    const pos = new Float32Array(NEBULA_COUNT * 3)
    const sz = new Float32Array(NEBULA_COUNT)
    const col = new Float32Array(NEBULA_COUNT * 3)
    const ph = new Float32Array(NEBULA_COUNT)

    const palettes = [
      [0.4, 0.1, 0.6],  // purple
      [0.1, 0.15, 0.5], // deep blue
      [0.6, 0.15, 0.3], // magenta
      [0.1, 0.3, 0.5],  // teal
      [0.5, 0.2, 0.1],  // warm brown/orange
    ]

    for (let i = 0; i < NEBULA_COUNT; i++) {
      const r = 50 + Math.random() * 40
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
      sz[i] = 15 + Math.random() * 30
      const p = palettes[Math.floor(Math.random() * palettes.length)]
      col[i * 3] = p[0]
      col[i * 3 + 1] = p[1]
      col[i * 3 + 2] = p[2]
      ph[i] = Math.random()
    }
    return { positions: pos, sizes: sz, colors: col, phases: ph }
  }, [])

  useFrame((_state, delta) => {
    uniformsRef.current.uTime.value += delta
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={nebulaVertexShader}
        fragmentShader={nebulaFragmentShader}
        uniforms={uniformsRef.current}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// ---------- combined ----------

export function SpaceBackground() {
  return (
    <group>
      <Stars />
      <Nebulae />
    </group>
  )
}
