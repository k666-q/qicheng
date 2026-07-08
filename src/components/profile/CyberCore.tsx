"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * 赛博朋克全息「数字核心」：
 * 三维粒子球（呼吸脉动）+ 三条倾斜粒子光环 + 内部线框多面体，
 * 鼠标移动带视差，青色/品红霓虹配色，加色混合发光。
 */
export function CyberCore({ className }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth;
    let height = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.z = 7.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const cyan = new THREE.Color("#22d3ee");
    const magenta = new THREE.Color("#e879f9");
    const indigo = new THREE.Color("#818cf8");

    // ---- 粒子球体（斐波那契均匀分布） ----
    const SPHERE_COUNT = 2800;
    const R = 2.1;
    const positions = new Float32Array(SPHERE_COUNT * 3);
    const colors = new Float32Array(SPHERE_COUNT * 3);
    const seeds = new Float32Array(SPHERE_COUNT);
    const golden = Math.PI * (1 + Math.sqrt(5));
    const tmp = new THREE.Color();
    for (let i = 0; i < SPHERE_COUNT; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / SPHERE_COUNT);
      const theta = golden * i;
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      positions[i * 3] = x * R;
      positions[i * 3 + 1] = y * R;
      positions[i * 3 + 2] = z * R;
      // 上下渐变：顶部青色 → 底部品红，混入少量靛蓝
      tmp.copy(cyan).lerp(magenta, (1 - y) / 2);
      if (i % 7 === 0) tmp.lerp(indigo, 0.6);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
      seeds[i] = Math.random();
    }
    const sphereGeo = new THREE.BufferGeometry();
    sphereGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    sphereGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    sphereGeo.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));

    const sphereMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float seed;
        varying vec3 vColor;
        varying float vSeed;
        uniform float uTime;
        void main() {
          vColor = color;
          vSeed = seed;
          vec3 p = position;
          // 沿法线方向呼吸脉动，每个粒子相位不同
          float pulse = sin(uTime * 1.6 + seed * 6.2831) * 0.09;
          p += normalize(position) * pulse;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (2.2 + seed * 2.4) * (7.5 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vSeed;
        uniform float uTime;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          // 随机闪烁
          float flicker = 0.75 + 0.25 * sin(uTime * 3.0 + vSeed * 40.0);
          gl_FragColor = vec4(vColor, a * flicker);
        }
      `,
      vertexColors: true,
    });
    const spherePoints = new THREE.Points(sphereGeo, sphereMat);
    group.add(spherePoints);

    // ---- 内部线框多面体 ----
    const wireGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.15, 1));
    const wireMat = new THREE.LineBasicMaterial({
      color: cyan,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
    });
    const wire = new THREE.LineSegments(wireGeo, wireMat);
    group.add(wire);

    const coreGeo = new THREE.IcosahedronGeometry(0.5, 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: magenta,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      wireframe: true,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // ---- 三条倾斜粒子光环 ----
    const rings: THREE.Points[] = [];
    const ringConfigs = [
      { radius: 2.9, count: 220, color: cyan, tiltX: Math.PI / 2.6, tiltZ: 0.2, speed: 0.35 },
      { radius: 3.3, count: 260, color: magenta, tiltX: Math.PI / 2.2, tiltZ: -0.5, speed: -0.22 },
      { radius: 3.7, count: 180, color: indigo, tiltX: Math.PI / 3.2, tiltZ: 0.9, speed: 0.14 },
    ];
    for (const cfg of ringConfigs) {
      const pos = new Float32Array(cfg.count * 3);
      for (let i = 0; i < cfg.count; i++) {
        const a = (i / cfg.count) * Math.PI * 2;
        // 少量径向抖动让环有厚度
        const r = cfg.radius + (Math.random() - 0.5) * 0.12;
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 0.06;
        pos[i * 3 + 2] = Math.sin(a) * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: cfg.color,
        size: 0.035,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Points(geo, mat);
      ring.rotation.x = cfg.tiltX;
      ring.rotation.z = cfg.tiltZ;
      ring.userData.speed = cfg.speed;
      group.add(ring);
      rings.push(ring);
    }

    // ---- 漂浮尘埃 ----
    const DUST_COUNT = 320;
    const dustPos = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      const r = 3.2 + Math.random() * 2.8;
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      dustPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      dustPos[i * 3 + 1] = r * Math.cos(phi);
      dustPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: cyan,
      size: 0.02,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    // ---- 鼠标视差 ----
    let targetRotX = 0;
    let targetRotY = 0;
    function onPointerMove(e: PointerEvent) {
      const rect = mount!.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      targetRotY = nx * 0.45;
      targetRotX = ny * 0.3;
    }
    window.addEventListener("pointermove", onPointerMove);

    // ---- 自适应尺寸 ----
    const resizeObserver = new ResizeObserver(() => {
      width = mount.clientWidth;
      height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(mount);

    // ---- 渲染循环 ----
    const clock = new THREE.Clock();
    let frameId = 0;
    function animate() {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      sphereMat.uniforms.uTime.value = t;

      spherePoints.rotation.y = t * 0.12;
      wire.rotation.y = -t * 0.2;
      wire.rotation.x = t * 0.08;
      core.rotation.y = t * 0.5;
      core.rotation.z = t * 0.3;
      const coreScale = 1 + Math.sin(t * 2.2) * 0.12;
      core.scale.setScalar(coreScale);

      for (const ring of rings) {
        ring.rotation.y += ring.userData.speed * 0.008;
      }
      dust.rotation.y = t * 0.02;

      // 视差平滑跟随
      group.rotation.y += (targetRotY - group.rotation.y) * 0.04;
      group.rotation.x += (targetRotX * 0.6 - group.rotation.x) * 0.04;

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      sphereGeo.dispose();
      sphereMat.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      for (const ring of rings) {
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      }
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className={className} />;
}
