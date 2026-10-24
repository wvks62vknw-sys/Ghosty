// Option 2, MIND: a hologram of Ghosty's mind. A glass-like sphere of light holding a slowly turning constellation:
// one cluster per library field, one node per 20 passages (4,186 passages -> 209 nodes), a node lit when its share
// of that field has been studied (1,312 studied -> 66 lit). Light pulses run along the links while he thinks.
// In the app the counts come from brain.library().stats; here they are the same sample numbers as route C's Home.
export const FIELDS = [
  // [field, nodes, lit]  (sample shares of 209 nodes / 66 studied)
  ['Maths', 34, 14], ['Science', 38, 12], ['English', 30, 11], ['History', 22, 6],
  ['Geography', 20, 5], ['Computing', 26, 9], ['Reading', 24, 7], ['General', 15, 2],
];

export function build(k) {
  const { THREE, glow, glowTexture, fresnelMaterial, rng, CYAN } = k;
  const root = new THREE.Group();
  const spin = new THREE.Group();
  root.add(spin);
  const rand = rng(42);
  const gauss = () => {
    let u = 0, v = 0;
    while (!u) u = rand();
    while (!v) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // ---- the shell: a sphere of light, its rim brighter (Fresnel), faint meridians and an equator scale
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), fresnelMaterial('#64d2ff', { power: 2.6, strength: 0.75 }));
  root.add(shell);
  const inner = new THREE.Mesh(new THREE.SphereGeometry(0.985, 64, 48), new THREE.MeshPhysicalMaterial({ color: '#0b1d26', transparent: true, opacity: 0.1, roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, depthWrite: false }));
  root.add(inner);
  const lineMat = new THREE.LineBasicMaterial({ color: '#64d2ff', transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false });
  const circle = (r, n = 128) => new THREE.BufferGeometry().setFromPoints(Array.from({ length: n + 1 }, (_, i) => new THREE.Vector3(Math.cos((i / n) * Math.PI * 2) * r, Math.sin((i / n) * Math.PI * 2) * r, 0)));
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Line(circle(1), lineMat);
    m.rotation.y = (i / 6) * Math.PI;
    spin.add(m);
  }
  for (const lat of [-0.6, -0.3, 0.3, 0.6]) {
    const m = new THREE.Line(circle(Math.cos(lat)), lineMat);
    m.rotation.x = Math.PI / 2;
    m.position.y = Math.sin(lat);
    spin.add(m);
  }
  // the equator: an instrument scale with ticks, just outside the sphere
  const eq = new THREE.Group();
  const eqRing = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.004, 6, 200), new THREE.MeshBasicMaterial({ color: '#9fe4ff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  eq.add(eqRing);
  const tp = [];
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const l = i % 10 === 0 ? 0.06 : 0.025;
    tp.push(new THREE.Vector3(Math.cos(a) * 1.06, Math.sin(a) * 1.06, 0), new THREE.Vector3(Math.cos(a) * (1.06 + l), Math.sin(a) * (1.06 + l), 0));
  }
  eq.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tp), new THREE.LineBasicMaterial({ color: '#9fe4ff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })));
  eq.rotation.x = Math.PI / 2 - 0.42;
  root.add(eq);

  // ---- the constellation: one cluster per field
  const hubs = [];
  const n = FIELDS.length;
  FIELDS.forEach((_, i) => {
    const y = 1 - (i + 0.5) * (2 / n);
    const r = Math.sqrt(1 - y * y);
    const th = i * Math.PI * (3 - Math.sqrt(5));
    hubs.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r).multiplyScalar(0.56));
  });
  const nodes = [];
  FIELDS.forEach(([, count, lit], f) => {
    for (let j = 0; j < count; j++) {
      const p = hubs[f].clone().add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(0.15));
      if (p.length() > 0.9) p.setLength(0.9);
      nodes.push({ p, f, lit: j < lit, phase: rand() * Math.PI * 2 });
    }
  });
  const mkPoints = (list, size, color, opacity) => {
    const g = new THREE.BufferGeometry().setFromPoints(list.map((x) => x.p));
    const m = new THREE.PointsMaterial({ map: glowTexture(), color, size, sizeAttenuation: true, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    return new THREE.Points(g, m);
  };
  const litNodes = nodes.filter((x) => x.lit);
  const dimNodes = nodes.filter((x) => !x.lit);
  const dimPts = mkPoints(dimNodes, 0.12, '#cfe3ec', 0.6);
  const litPts = mkPoints(litNodes, 0.24, '#64d2ff', 1);
  const litCore = mkPoints(litNodes, 0.07, '#ffffff', 1);
  spin.add(dimPts, litPts, litCore);

  // ---- links: each node to its two nearest in its field; field hubs to the nucleus and to their neighbours
  const seg = [], segLit = [];
  const links = [];
  nodes.forEach((a, i) => {
    const near = nodes.map((b, j) => [j, b]).filter(([j, b]) => j !== i && b.f === a.f).sort((x, y) => x[1].p.distanceTo(a.p) - y[1].p.distanceTo(a.p)).slice(0, 2);
    for (const [, b] of near) {
      (a.lit && b.lit ? segLit : seg).push(a.p, b.p);
      links.push([a.p, b.p, a.lit && b.lit]);
    }
  });
  hubs.forEach((h, i) => {
    segLit.push(new THREE.Vector3(), h);
    links.push([new THREE.Vector3(), h, true]);
    const nb = hubs[(i + 3) % n];
    seg.push(h, nb);
    links.push([h, nb, false]);
  });
  const linkMat = new THREE.LineBasicMaterial({ color: '#9fd8ee', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
  const linkLitMat = new THREE.LineBasicMaterial({ color: '#64d2ff', transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false });
  spin.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), linkMat));
  spin.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segLit), linkLitMat));

  // ---- pulses that run along links while he thinks
  const pulses = [];
  const lit = links.filter((l) => l[2]);
  for (let i = 0; i < 26; i++) {
    const s = glow('#ffffff', 0.09, 1);
    s.userData = { link: lit[Math.floor(rand() * lit.length)], off: rand(), sp: 0.6 + rand() * 0.8 };
    spin.add(s);
    pulses.push(s);
  }

  // ---- the nucleus
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.07, 32, 16), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  spin.add(nucleus);
  const n1 = glow('#ffffff', 0.28, 0.8), n2 = glow('#64d2ff', 1.0, 0.5), haze = glow('#64d2ff', 3.0, 0.16);
  root.add(haze, n2, n1);

  root.scale.setScalar(0.88);
  return {
    object: root,
    update(t, state, p) {
      const breath = 1 + 0.06 * Math.sin(t * 1.6);
      spin.rotation.y = t * 0.09 * p.speed;
      spin.rotation.x = 0.28;
      root.rotation.z = 0.08;
      eq.rotation.z = -t * 0.04;
      const open = 1 + 0.12 * p.open;
      spin.scale.setScalar(open);
      shell.material.uniforms.uStrength.value = 0.75 * p.bright * breath;
      litPts.material.size = 0.24 * (1 + 0.25 * p.open) * (p.pulse ? 1 + 0.25 * Math.sin(t * 3.2) : 1);
      litPts.material.opacity = Math.min(1, 0.9 * p.bright);
      linkLitMat.opacity = 0.38 * p.bright;
      n1.scale.setScalar(0.35 * (1 + 0.6 * p.open) * breath);
      n2.scale.setScalar(1.0 * (1 + 0.3 * p.open) * breath);
      n2.material.opacity = 0.45 * p.bright;
      haze.material.opacity = 0.14 * p.bright;
      const show = p.ripple ? 1 : p.open ? 0.35 : 0;
      for (const s of pulses) {
        const { link, off, sp } = s.userData;
        const f = (off + t * sp * 0.5) % 1;
        s.position.copy(link[0]).lerp(link[1], f);
        s.material.opacity = show * Math.sin(f * Math.PI);
      }
    },
  };
}
