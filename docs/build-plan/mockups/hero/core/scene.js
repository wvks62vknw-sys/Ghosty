// Option 1, CORE: the arc reactor rebuilt in true 3D. A machined, brushed housing; ten glowing cells under copper
// windings; a polished collar; a plasma heart under a real glass dome (refraction); two engraved glass rings
// floating in front at different depths; a slow precession so the depth reads. Radius 1, facing the camera (+z).
export function build(k) {
  const { THREE, glow, fresnelMaterial, CYAN } = k;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // ---- housing: a lathe profile turned to face the camera
  const prof = [[0.79, -0.12], [0.79, 0.05], [0.815, 0.085], [0.86, 0.095], [0.9, 0.08], [0.95, 0.1], [0.985, 0.08], [1.0, 0.03], [1.0, -0.12]].map(([r, y]) => new THREE.Vector2(r, y));
  const housingMat = new THREE.MeshStandardMaterial({ color: '#c3ccd3', metalness: 1, roughness: 0.27 });
  const housing = new THREE.Mesh(new THREE.LatheGeometry(prof, 160), housingMat);
  housing.rotation.x = Math.PI / 2;
  body.add(housing);
  // the back plate and the recess the cells sit in
  const back = new THREE.Mesh(new THREE.CircleGeometry(0.8, 96), new THREE.MeshStandardMaterial({ color: '#0d1114', metalness: 0.8, roughness: 0.6 }));
  back.position.z = -0.1;
  body.add(back);
  // engraved index ticks round the housing face
  const tickGeo = new THREE.BoxGeometry(0.006, 0.03, 0.006);
  const tickMat = new THREE.MeshStandardMaterial({ color: '#cfe9f5', emissive: CYAN, emissiveIntensity: 0.25, metalness: 0.5, roughness: 0.3 });
  const ticks = new THREE.InstancedMesh(tickGeo, tickMat, 60);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const long = i % 5 === 0;
    m4.compose(new THREE.Vector3(Math.cos(a) * 0.93, Math.sin(a) * 0.93, 0.1), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a - Math.PI / 2)), new THREE.Vector3(long ? 1.6 : 1, long ? 1.4 : 0.8, 1));
    ticks.setMatrixAt(i, m4);
  }
  body.add(ticks);

  // ---- ten cells, each under copper windings
  const cellMats = [];
  const copper = new THREE.MeshStandardMaterial({ color: '#7a4a2a', metalness: 1, roughness: 0.38 });
  const bandGeo = new THREE.BoxGeometry(0.255, 0.012, 0.02);
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * Math.PI * 2 + 0.06 + Math.PI / 2;
    const a1 = a0 + (Math.PI * 2) / 10 - 0.12;
    const sh = new THREE.Shape();
    sh.absarc(0, 0, 0.76, a0, a1, false);
    sh.absarc(0, 0, 0.5, a1, a0, true);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 2, curveSegments: 24 });
    const mat = new THREE.MeshStandardMaterial({ color: '#06202c', emissive: '#2fb4f2', emissiveIntensity: 1, metalness: 0.2, roughness: 0.3 });
    cellMats.push(mat);
    const cell = new THREE.Mesh(geo, mat);
    cell.position.z = -0.06;
    body.add(cell);
    // windings: thin copper bands across the cell's face, wrapping over its edges
    const bands = new THREE.InstancedMesh(bandGeo, copper, 7);
    for (let j = 0; j < 7; j++) {
      const a = a0 + ((j + 0.5) / 7) * (a1 - a0);
      m4.compose(new THREE.Vector3(Math.cos(a) * 0.63, Math.sin(a) * 0.63, 0.04), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a)), new THREE.Vector3(1, 1, 1));
      bands.setMatrixAt(j, m4);
    }
    body.add(bands);
  }

  // ---- the collar: polished steel
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.455, 0.042, 32, 160), new THREE.MeshStandardMaterial({ color: '#c8d2d9', metalness: 1, roughness: 0.12 }));
  collar.position.z = 0.03;
  body.add(collar);
  const collar2 = new THREE.Mesh(new THREE.TorusGeometry(0.405, 0.012, 16, 160), new THREE.MeshStandardMaterial({ color: '#59646c', metalness: 1, roughness: 0.4 }));
  collar2.position.z = 0.05;
  body.add(collar2);

  // ---- the heart: a plasma core and its inner ring, under a glass dome
  const coreMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#bfefff', emissiveIntensity: 1 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 48, 32), coreMat);
  core.scale.z = 0.6;
  body.add(core);
  const plasmaMat = new THREE.MeshStandardMaterial({ color: '#9fe8ff', emissive: '#64d2ff', emissiveIntensity: 2.2 });
  const plasma = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.018, 16, 96), plasmaMat);
  body.add(plasma);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.39, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: '#dff6ff', metalness: 0, roughness: 0.04, transmission: 1, thickness: 0.35, ior: 1.46, clearcoat: 1, clearcoatRoughness: 0.05, attenuationColor: '#7fd9ff', attenuationDistance: 1.2, transparent: true }),
  );
  dome.rotation.x = Math.PI / 2;
  dome.scale.y = 0.55;
  dome.position.z = 0.02;
  body.add(dome);
  const domeRim = new THREE.Mesh(new THREE.SphereGeometry(0.392, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), fresnelMaterial('#9fe4ff', { power: 3, strength: 0.55 }));
  domeRim.rotation.x = Math.PI / 2;
  domeRim.scale.y = 0.55;
  domeRim.position.z = 0.02;
  body.add(domeRim);

  // ---- two engraved glass rings floating in front, at different depths
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#bfeeff', metalness: 0, roughness: 0.08, transmission: 0.92, thickness: 0.06, ior: 1.5, clearcoat: 1, transparent: true, opacity: 1 });
  const ring = (r0, r1, z, n) => {
    const g = new THREE.Group();
    const sh = new THREE.Shape();
    sh.absarc(0, 0, r1, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, r0, 0, Math.PI * 2, true);
    sh.holes.push(hole);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false, curveSegments: 128 }), glassMat);
    g.add(m);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const len = i % 10 === 0 ? 0.6 : 0.3;
      const rr0 = r1 - (r1 - r0) * len;
      pts.push(new THREE.Vector3(Math.cos(a) * rr0, Math.sin(a) * rr0, 0.014), new THREE.Vector3(Math.cos(a) * r1 * 0.995, Math.sin(a) * r1 * 0.995, 0.014));
    }
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#9fe4ff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(lines);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(r1, 0.0035, 6, 160), new THREE.MeshBasicMaterial({ color: '#bdf0ff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    edge.position.z = 0.006;
    g.add(edge);
    g.position.z = z;
    return g;
  };
  const glassA = ring(0.8, 0.88, 0.2, 120);
  const glassB = ring(0.33, 0.37, 0.36, 72);
  root.add(glassA, glassB);

  // ---- light: the heart lights the coils and the collar; glow and haze make it read as light, not paint
  const light = new THREE.PointLight('#7fdcff', 3, 3, 1.6);
  light.position.set(0, 0, 0.35);
  body.add(light);
  const key = new THREE.DirectionalLight('#ffffff', 1.1);
  key.position.set(-2, 3, 4);
  root.add(key);
  const g1 = glow('#ffffff', 0.7, 0.95);
  const g2 = glow('#64d2ff', 1.7, 0.6);
  const g3 = glow('#64d2ff', 3.4, 0.22);
  g1.position.z = g2.position.z = g3.position.z = 0.3;
  root.add(g3, g2, g1);

  root.scale.setScalar(1.05);
  return {
    object: root,
    update(t, state, p) {
      const breath = 1 + 0.06 * Math.sin(t * 1.6);
      const b = p.bright * breath;
      for (let i = 0; i < 10; i++) {
        const ripple = p.ripple ? -0.45 + 1.4 * Math.pow(Math.max(0, Math.sin(t * 5 - i * 0.63)), 3) : 0;
        const pulse = p.pulse ? 0.3 * Math.sin(t * 3.2) : 0;
        cellMats[i].emissiveIntensity = 0.95 * b * (1 + ripple + pulse);
      }
      coreMat.emissiveIntensity = 0.95 * b;
      plasmaMat.emissiveIntensity = 1.6 * b;
      core.scale.setScalar(1 + 0.18 * p.open);
      core.scale.z = 0.6;
      plasma.scale.setScalar(1 + 0.12 * p.open);
      light.intensity = 3 * b;
      g1.scale.setScalar(0.26 * (1 + 0.9 * p.open) * breath);
      g2.scale.setScalar(1.5 * (1 + 0.45 * p.open) * breath);
      g3.scale.setScalar(3.4 * (1 + 0.15 * p.open));
      g2.material.opacity = 0.38 * b;
      g3.material.opacity = 0.14 * b; g1.material.opacity = Math.min(1, 0.7 * b);
      // the glass rings drift forward and apart when he listens; they turn, slowly
      glassA.position.z = 0.22 + 0.1 * p.open;
      glassB.position.z = 0.36 + 0.18 * p.open;
      glassA.rotation.z = t * 0.05 * p.speed;
      glassB.rotation.z = -t * 0.09 * p.speed;
      glassA.rotation.x = 0.1 * Math.sin(t * 0.4);
      glassB.rotation.y = 0.12 * Math.cos(t * 0.35);
      // a slow precession, so the depth reads
      root.rotation.x = -0.3 + 0.08 * Math.sin(t * 0.3);
      root.rotation.y = 0.32 * Math.cos(t * 0.25);
    },
  };
}
