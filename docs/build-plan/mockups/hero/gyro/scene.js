// Option 3, GYRO: a machined instrument. Four nested gimbal rings, each turning on its own axis round a small bright
// core, like a gyroscope or an astrolabe: titanium and gunmetal bands, engraved scales, one cyan inlay, real pivots.
// Speed and glow show his state. Radius 1.
export function build(k) {
  const { THREE, glow, fresnelMaterial } = k;
  const root = new THREE.Group();

  const ti = new THREE.MeshStandardMaterial({ color: '#d5dbe0', metalness: 1, roughness: 0.2 });
  const gun = new THREE.MeshStandardMaterial({ color: '#5d666e', metalness: 1, roughness: 0.3 });
  const inlay = new THREE.MeshBasicMaterial({ color: '#64d2ff' });
  const tickMat = new THREE.MeshStandardMaterial({ color: '#20262b', metalness: 0.6, roughness: 0.5 });

  /** A flat machined band (a rectangle turned round the axis), its face toward +z. */
  function band(r, w, depth, mat) {
    const pr = [[r - w / 2, -depth / 2], [r + w / 2, -depth / 2], [r + w / 2, depth / 2], [r - w / 2, depth / 2], [r - w / 2, -depth / 2]].map(([x, y]) => new THREE.Vector2(x, y));
    const m = new THREE.Mesh(new THREE.LatheGeometry(pr, 200), mat);
    m.rotation.x = Math.PI / 2;
    return m;
  }
  /** Engraved ticks on a band's face. */
  function scale(r, n, len, z) {
    const geo = new THREE.BoxGeometry(0.0055, 1, 0.004);
    const im = new THREE.InstancedMesh(geo, tickMat, n);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const l = i % 10 === 0 ? len : len * 0.5;
      m4.compose(new THREE.Vector3(Math.cos(a) * (r - len / 2 + l / 2), Math.sin(a) * (r - len / 2 + l / 2), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a - Math.PI / 2)), new THREE.Vector3(1, l, 1));
      im.setMatrixAt(i, m4);
    }
    return im;
  }
  /** A pivot pin joining a ring to the one inside it, on the inner ring's axis. */
  function pins(r, axis, mat) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 24), mat);
      if (axis === 'x') { c.rotation.z = Math.PI / 2; c.position.x = s * r; } else { c.position.y = s * r; }
      g.add(c);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.026, 20, 12), mat);
      cap.position.copy(c.position).multiplyScalar(1.04);
      g.add(cap);
    }
    return g;
  }

  // the gimbal: each ring is a child of the one outside it, turning on its own axis
  const r0 = new THREE.Group(), r1 = new THREE.Group(), r2 = new THREE.Group(), r3 = new THREE.Group();
  r0.add(band(0.985, 0.1, 0.045, ti), scale(0.985, 120, 0.06, 0.0235));
  const in0 = new THREE.Mesh(new THREE.TorusGeometry(0.955, 0.007, 8, 240), inlay);
  in0.position.z = 0.0235;
  r0.add(in0);
  r1.add(band(0.83, 0.075, 0.05, gun), pins(0.905, 'y', ti));
  r2.add(band(0.68, 0.07, 0.045, ti), scale(0.68, 72, 0.045, 0.023), pins(0.79, 'x', gun));
  r3.add(band(0.54, 0.06, 0.045, gun), pins(0.645, 'y', ti));
  const in3 = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.007, 8, 200), inlay);
  in3.position.z = 0.0235;
  r3.add(in3);
  for (const [g, r, z] of [[r1, 0.83, 0.026], [r2, 0.68, 0.0235]]) {
    const il = new THREE.Mesh(new THREE.TorusGeometry(r, 0.007, 8, 200), inlay);
    il.position.z = z;
    g.add(il);
  }
  r1.add(scale(0.83, 96, 0.04, 0.026));
  root.add(r0);
  r0.add(r1);
  r1.add(r2);
  r2.add(r3);

  // the core: a small bright sphere in a glass shell, on a fine axle
  const coreMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#d4f5ff', emissiveIntensity: 2.4 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.085, 48, 32), coreMat);
  r3.add(core);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 48, 32), new THREE.MeshPhysicalMaterial({ color: '#e6f7ff', roughness: 0.03, transmission: 1, thickness: 0.2, ior: 1.5, clearcoat: 1, transparent: true }));
  r3.add(shell);
  const rim = new THREE.Mesh(new THREE.SphereGeometry(0.202, 48, 32), fresnelMaterial('#9fe4ff', { power: 2.5, strength: 0.6 }));
  r3.add(rim);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.06, 12), ti);
  r3.add(axle);

  const light = new THREE.PointLight('#7fdcff', 2.4, 3, 1.5);
  root.add(light);
  const key = new THREE.DirectionalLight('#ffffff', 1.4);
  key.position.set(-2, 3, 4);
  root.add(key);
  const fill = new THREE.DirectionalLight('#9fdcff', 0.5);
  fill.position.set(3, -2, 2);
  root.add(fill);
  const g1 = glow('#ffffff', 0.24, 0.8), g2 = glow('#64d2ff', 0.95, 0.5), g3 = glow('#64d2ff', 2.6, 0.14);
  root.add(g3, g2, g1);

  root.scale.setScalar(0.9);
  return {
    object: root,
    update(t, state, p) {
      const breath = 1 + 0.06 * Math.sin(t * 1.6);
      const sp = p.speed;
      // a calm, readable pose: the outer ring nearly faces you, the inner ones turn through it
      r0.rotation.set(-0.42, 0.3 + 0.05 * Math.sin(t * 0.2), 0.06);
      r1.rotation.set(0, t * 0.22 * sp + 0.9 + p.open * 0.5, 0);
      r2.rotation.set(t * 0.31 * sp + 1.2 + p.open * 0.6, 0, 0);
      r3.rotation.set(0, t * 0.45 * sp + 0.4, t * 0.1);
      inlay.color.set('#64d2ff').multiplyScalar(Math.min(1.6, 0.95 * p.bright * breath * (p.pulse ? 1 + 0.3 * Math.sin(t * 3.2) : 1) * (p.ripple ? 1 + 0.4 * Math.max(0, Math.sin(t * 6)) : 1)));
      coreMat.emissiveIntensity = 2.4 * p.bright * breath;
      core.scale.setScalar(1 + 0.3 * p.open);
      light.intensity = 2.4 * p.bright;
      g1.scale.setScalar(0.24 * (1 + 0.6 * p.open) * breath);
      g2.scale.setScalar(0.95 * (1 + 0.35 * p.open) * breath);
      g2.material.opacity = 0.45 * p.bright;
      g3.material.opacity = 0.13 * p.bright;
    },
  };
}
