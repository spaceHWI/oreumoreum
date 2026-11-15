import * as THREE from 'three';

// 레트로(SULFUR 풍) 렌더링: 저해상도로 그린 뒤 픽셀이 보이게 확대. 가장자리는 MSAA로 부드럽게(계단현상 완화),
// 색은 단계 수를 줄이고 바이어 디더로 포스터 느낌.
export function createRetro(renderer) {
  const target = new THREE.WebGLRenderTarget(320, 180, { samples: renderer.capabilities.isWebGL2 ? 4 : 0, depthBuffer: true });
  target.depthTexture = new THREE.DepthTexture(320, 180); target.depthTexture.type = THREE.UnsignedIntType;
  target.texture.minFilter = THREE.NearestFilter; target.texture.magFilter = THREE.NearestFilter;
  const mat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: target.texture }, tDepth: { value: target.depthTexture }, uNear: { value: 0.5 }, uFar: { value: 14000 }, uOutline: { value: 0.55 }, uEdgePx: { value: 1.0 }, uRes: { value: new THREE.Vector2(320, 180) }, uLevels: { value: 20 }, uDither: { value: 0.4 }, uSat: { value: 1.12 } },
    depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 uRes; uniform float uLevels; uniform float uDither; uniform float uSat; uniform float uNear; uniform float uFar; uniform float uOutline; uniform float uEdgePx;
      float linD(vec2 uv) { float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
      varying vec2 vUv;
      float bayer4(vec2 p) {
        int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
        int i = x + y * 4;
        int m[16]; m[0]=0;m[1]=8;m[2]=2;m[3]=10;m[4]=12;m[5]=4;m[6]=14;m[7]=6;m[8]=3;m[9]=11;m[10]=1;m[11]=9;m[12]=15;m[13]=7;m[14]=13;m[15]=5;
        for (int k = 0; k < 16; k++) if (k == i) return (float(m[k]) + 0.5) / 16.0;
        return 0.5;
      }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        // 깊이 차이로 1픽셀 윤곽선: 가까운 물체일수록 선명, 먼 곳은 희미하게 (지형 결은 선이 안 생기게 상대 깊이 기준)
        vec2 px1 = uEdgePx / uRes;
        float d0 = linD(vUv);
        float dd = max(max(abs(linD(vUv + vec2(px1.x, 0.0)) - d0), abs(linD(vUv - vec2(px1.x, 0.0)) - d0)), max(abs(linD(vUv + vec2(0.0, px1.y)) - d0), abs(linD(vUv - vec2(0.0, px1.y)) - d0)));
        float edge = smoothstep(0.045, 0.12, dd / max(d0, 1.0)) * (1.0 - smoothstep(60.0, 220.0, d0)) * uOutline;
        c = toneMapping(c);
        c = linearToOutputTexel(vec4(c, 1.0)).rgb;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, uSat);
        vec2 px = floor(vUv * uRes);
        float d = (bayer4(px) - 0.5) * uDither / uLevels;
        c = floor((c + d) * uLevels + 0.5) / uLevels;
        c = mix(c, c * vec3(0.35, 0.33, 0.38), edge);
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const qScene = new THREE.Scene(); qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let on = false, mode = 'toon', curW = 320, curH = 180;
  // mode: 'toon' = 원래 해상도 + 색 단계 축소 + 윤곽선 (SULFUR 풍 카툰, 픽셀 없음) / 'retro' = 저해상도 픽셀
  function setMode(m) {
    mode = m;
    if (m === 'retro') { mat.uniforms.uLevels.value = 20; mat.uniforms.uDither.value = 0.4; mat.uniforms.uSat.value = 1.12; mat.uniforms.uOutline.value = 0.55; mat.uniforms.uEdgePx.value = 1.0; }
    else { mat.uniforms.uLevels.value = 14; mat.uniforms.uDither.value = 0.0; mat.uniforms.uSat.value = 1.1; mat.uniforms.uOutline.value = 0.7; mat.uniforms.uEdgePx.value = 1.6; }
    setSize(curW, curH);
  }
  function setSize(w, h) {
    curW = w; curH = h;
    let tw, th;
    if (mode === 'retro') { th = Math.round(Math.min(420, Math.max(300, h / 2.5))); tw = Math.round(th * (w / h)); }
    else { tw = Math.round(w); th = Math.round(h); }
    target.setSize(tw, th); mat.uniforms.uRes.value.set(tw, th);
  }
  function render(scene, camera) {
    if (!on) { renderer.render(scene, camera); return; }
    mat.uniforms.uNear.value = camera.near; mat.uniforms.uFar.value = camera.far;
    renderer.setRenderTarget(target); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(qScene, qCam);
  }
  return { setSize, setMode, render, set on(v) { on = !!v; }, get on() { return on; }, get mode() { return mode; }, uniforms: mat.uniforms };
}
