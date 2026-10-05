/* PUNCTUM PREMIERE — WebGL2 renderer.
 * Scene = instanced "beads" (emissive glass dots, flat panels, ink dots) + a few textured quads.
 * Passes: mirrored reflection (half res) → main (MSAA 4×, alpha-to-coverage) → composite (floor reflection, fog, CoC)
 *         → DOF gather (half res) → bloom pyramid → final (whip blur, CA, ACES, grade, vignette, grain). */
(function () {
  const FLOATS = 16; // per instance: center.xyz,_ | U.xyz,rond | V.xyz,emission | rgb,kind

  const VS_DOT = `#version 300 es
  layout(location=0) in vec2 aCorner;
  layout(location=1) in vec4 i0; layout(location=2) in vec4 i1; layout(location=3) in vec4 i2; layout(location=4) in vec4 i3;
  uniform mat4 uVP; uniform mat4 uView; uniform float uMirror; uniform float uFloorY;
  out vec2 vQ; out vec3 vN; out vec3 vU; out vec3 vV; out vec3 vW; out vec4 vP; out vec3 vCol; flat out float vKind; out float vZ;
  void main(){
    vec3 c = i0.xyz, U = i1.xyz, V = i2.xyz;
    if (uMirror > 0.5) { c.y = 2.0*uFloorY - c.y; U.y = -U.y; V.y = -V.y; }
    vec3 w = c + U*aCorner.x + V*aCorner.y;
    vQ = aCorner; vU = normalize(U); vV = normalize(V); vN = normalize(cross(U, V)); if (uMirror > 0.5) vN = -vN;
    vW = w; vP = vec4(i1.w, i2.w, i0.w, 0.0); vCol = i3.rgb; vKind = i3.w;
    vec4 vw = uView * vec4(w,1.0); vZ = -vw.z;
    gl_Position = uVP * vec4(w, 1.0);
  }`;

  const FS_DOT = `#version 300 es
  precision highp float;
  in vec2 vQ; in vec3 vN; in vec3 vU; in vec3 vV; in vec3 vW; in vec4 vP; in vec3 vCol; flat in float vKind; in float vZ;
  uniform vec3 uCam; uniform vec3 uKey; uniform vec3 uKeyCol; uniform vec3 uAmb; uniform float uMirror; uniform float uFloorY; uniform float uEmitK;
  uniform vec3 uUnlit;
  layout(location=0) out vec4 o;
  float sdRound(vec2 q, float r){ vec2 d = abs(q) - vec2(1.0 - r); return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
  void main(){
    if (uMirror > 0.5 && vW.y > uFloorY + 0.001) discard;
    vec3 Vd = normalize(uCam - vW);
    float facing = dot(vN, Vd);
    if (facing < 0.0) discard;
    float rond = clamp(vP.x, 0.0, 1.0), E = vP.y; int kind = int(vKind + 0.5);
    float rr = kind == 1 ? rond * 0.25 : mix(0.06, 1.0, rond);
    float d = sdRound(vQ, rr);
    float aa = max(fwidth(d), 1e-4) * 0.75;
    float cov = 1.0 - smoothstep(-aa, aa, d);
    if (cov < 0.01) discard;
    float m = clamp(-d, 0.0, 1.0);                      // 0 at edge → 1 at centre
    vec3 col;
    if (kind == 1) {                                     // flat panel (albedo + optional backlight)
      float dif = max(dot(vN, uKey), 0.0);
      vec3 H = normalize(uKey + Vd);
      float sp = pow(max(dot(vN, H), 0.0), 60.0) * 0.25;
      col = vCol * (uAmb + uKeyCol * dif * 0.6) + uKeyCol * sp + vCol * E;
    } else {
      // bead normal: lens dome over the shape
      vec2 g = vQ * (1.0 - 0.35 * (1.0 - rond));
      float nz = sqrt(max(0.05, 1.0 - min(dot(g, g), 0.95)));
      vec3 n = normalize(vU * g.x * 0.85 + vV * g.y * 0.85 + vN * nz);
      vec3 R = reflect(-Vd, n);
      float sp = pow(max(dot(R, uKey), 0.0), 48.0);
      float fres = pow(1.0 - max(dot(n, Vd), 0.0), 3.0);
      if (kind == 2) {                                   // ink / LCD pixel: matte, no glow
        col = vCol * (uAmb + uKeyCol * max(dot(n, uKey), 0.0) * 0.5) + uKeyCol * sp * 0.08;
      } else {
        vec3 glass = uUnlit * (0.6 + 0.8 * m) + uKeyCol * sp * 0.55 + uAmb * fres * 0.6;
        float Ek = E * uEmitK;
        vec3 emit = vCol * Ek * (0.5 + 0.55 * m) + vec3(1.0) * Ek * 0.22 * pow(m, 3.0);
        col = glass * (1.0 / (1.0 + Ek * 2.0)) + emit;
      }
    }
    if (uMirror > 0.5) col *= 0.55;
    o = vec4(col, cov);
  }`;

  const VS_QUAD = `#version 300 es
  layout(location=0) in vec2 aCorner;
  uniform mat4 uVP; uniform vec3 uC; uniform vec3 uU; uniform vec3 uV; uniform float uMirror; uniform float uFloorY;
  out vec2 vUV; out vec3 vW;
  void main(){ vec3 c = uC, U = uU, V = uV; if (uMirror > 0.5) { c.y = 2.0*uFloorY - c.y; U.y = -U.y; V.y = -V.y; }
    vec3 w = c + U*aCorner.x + V*aCorner.y; vUV = vec2(aCorner.x*0.5+0.5, 0.5-aCorner.y*0.5); vW = w; gl_Position = uVP*vec4(w,1.0); }`;
  const FS_QUAD = `#version 300 es
  precision highp float; in vec2 vUV; in vec3 vW; uniform sampler2D uTex; uniform float uGain; uniform float uAlpha; uniform float uMirror; uniform float uFloorY;
  uniform vec4 uCrop; layout(location=0) out vec4 o;
  void main(){ if (uMirror > 0.5 && vW.y > uFloorY + 0.001) discard;
    vec2 uv = uCrop.xy + vUV * uCrop.zw; vec4 t = texture(uTex, uv);
    vec3 c = pow(t.rgb, vec3(2.2)) * uGain; float a = t.a * uAlpha; if (a < 0.02) discard;
    if (uMirror > 0.5) c *= 0.5; o = vec4(c, a); }`;

  const VS_FS = `#version 300 es
  const vec2 P[3] = vec2[3](vec2(-1,-1), vec2(3,-1), vec2(-1,3));
  out vec2 vUV; void main(){ vec2 p = P[gl_VertexID]; vUV = p*0.5+0.5; gl_Position = vec4(p,0,1); }`;

  const FS_COMP = `#version 300 es
  precision highp float; in vec2 vUV; out vec4 o;
  uniform sampler2D uScene; uniform sampler2D uDepth; uniform sampler2D uRefl;
  uniform float uNear; uniform float uFar; uniform mat4 uInvVP; uniform vec3 uCam; uniform vec3 uFwd;
  uniform float uFloorY; uniform float uReflAmt; uniform float uFog; uniform vec3 uFogCol; uniform float uFocus; uniform float uAperture; uniform float uMaxCoc;
  uniform float uFloorGlow;
  float linZ(float d){ float z = d*2.0-1.0; return 2.0*uNear*uFar/(uFar+uNear - z*(uFar-uNear)); }
  void main(){
    vec3 c = texture(uScene, vUV).rgb; float d = texture(uDepth, vUV).r; float z = d >= 0.99999 ? uFar : linZ(d);
    vec4 wp = uInvVP * vec4(vUV*2.0-1.0, 1.0, 1.0); vec3 ray = normalize(wp.xyz/wp.w - uCam);
    if (ray.y < -1e-4 && uCam.y > uFloorY) {
      float tF = (uFloorY - uCam.y) / ray.y; float zF = tF * dot(ray, uFwd);
      if (z > zF - 0.02) {
        float fres = 0.25 + 0.75 * pow(1.0 - abs(ray.y), 4.0);
        c += texture(uRefl, vUV).rgb * uReflAmt * fres * exp(-tF * 0.012);
        c += uFogCol * uFloorGlow * exp(-tF*0.05);
        z = min(z, zF);
      }
    }
    float f = 1.0 - exp(-max(z - 2.0, 0.0) * uFog);
    c = mix(c, uFogCol, f);
    float coc = uAperture * abs(z - uFocus) / max(z, 0.01);
    o = vec4(c, clamp(coc, 0.0, uMaxCoc));
  }`;

  const FS_DOF = `#version 300 es
  precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform vec2 uPx; uniform float uMaxCoc;
  void main(){
    vec4 c0 = texture(uSrc, vUV); vec3 acc = c0.rgb; float wsum = 1.0;
    float R = uMaxCoc;
    if (R < 0.5) { o = c0; return; }
    for (int i = 1; i < 72; i++) {
      float fi = float(i); float r = sqrt(fi / 72.0) * R; float a = fi * 2.39996;
      vec2 off = vec2(cos(a), sin(a)) * r;
      vec4 s = texture(uSrc, vUV + off * uPx);
      float w = smoothstep(r - 1.5, r + 0.5, s.a);
      acc += s.rgb * w; wsum += w;
    }
    o = vec4(acc / wsum, c0.a);
  }`;

  const FS_DOWN = `#version 300 es
  precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform vec2 uPx; uniform float uFirst;
  void main(){ vec3 a = texture(uSrc, vUV + uPx*vec2(-1,-1)).rgb, b = texture(uSrc, vUV + uPx*vec2(1,-1)).rgb, c = texture(uSrc, vUV + uPx*vec2(-1,1)).rgb, d = texture(uSrc, vUV + uPx*vec2(1,1)).rgb, e = texture(uSrc, vUV).rgb;
    vec3 s = (a+b+c+d)*0.125 + e*0.5; if (uFirst > 0.5) s = max(s - 0.6, 0.0) * 0.8; o = vec4(s, 1.0); }`;
  const FS_UP = `#version 300 es
  precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform vec2 uPx;
  void main(){ vec3 s = vec3(0.0);
    s += texture(uSrc, vUV + uPx*vec2(-1,-1)).rgb; s += texture(uSrc, vUV + uPx*vec2(0,-1)).rgb*2.0; s += texture(uSrc, vUV + uPx*vec2(1,-1)).rgb;
    s += texture(uSrc, vUV + uPx*vec2(-1,0)).rgb*2.0; s += texture(uSrc, vUV).rgb*4.0; s += texture(uSrc, vUV + uPx*vec2(1,0)).rgb*2.0;
    s += texture(uSrc, vUV + uPx*vec2(-1,1)).rgb; s += texture(uSrc, vUV + uPx*vec2(0,1)).rgb*2.0; s += texture(uSrc, vUV + uPx*vec2(1,1)).rgb;
    o = vec4(s/16.0, 1.0); }`;
  const FS_BLUR = `#version 300 es
  precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform vec2 uDir;
  void main(){ vec3 s = texture(uSrc, vUV).rgb * 0.2;
    for (int i = 1; i < 8; i++) { float w = exp(-float(i*i)/18.0) * 0.2; s += (texture(uSrc, vUV + uDir*float(i)).rgb + texture(uSrc, vUV - uDir*float(i)).rgb) * w; }
    o = vec4(s / 1.32, 1.0); }`;

  const FS_FINAL = `#version 300 es
  precision highp float; in vec2 vUV; out vec4 o;
  uniform sampler2D uSharp; uniform sampler2D uDof; uniform sampler2D uBloom; uniform vec2 uRes;
  uniform float uExposure; uniform float uBloomK; uniform vec2 uWhip; uniform float uFlash; uniform vec3 uGrade; uniform vec3 uLift;
  uniform float uVig; uniform float uGrain; uniform float uCA; uniform float uFrame; uniform float uFade;
  vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uFrame*0.618) * 43758.5453); }
  vec3 src(vec2 uv){ vec4 s = texture(uSharp, uv); vec3 b = texture(uDof, uv).rgb; return mix(s.rgb, b, smoothstep(0.6, 2.2, s.a)); }
  vec3 sampleAll(vec2 uv){
    vec2 dc = uv - 0.5; vec2 ca = dc * uCA;
    vec3 c = vec3(src(uv - ca).r, src(uv).g, src(uv + ca).b);
    return c + texture(uBloom, uv).rgb * uBloomK;
  }
  void main(){
    vec3 c;
    if (dot(uWhip, uWhip) > 1e-6) { c = vec3(0.0); for (int i = 0; i < 24; i++) { float k = float(i)/23.0 - 0.5; c += sampleAll(vUV + uWhip*k); } c /= 24.0; }
    else c = sampleAll(vUV);
    c *= uExposure * (1.0 + uFlash * 7.0); c += uFlash * 0.02;
    c = aces(c);
    c = pow(c, vec3(1.0/2.2));
    c = c * uGrade + uLift * (1.0 - c);
    vec2 dc = vUV - 0.5; dc.x *= uRes.x/uRes.y;
    c *= 1.0 - uVig * smoothstep(0.35, 1.05, length(dc));
    c += (h(vUV*uRes) - 0.5) * uGrain;
    c *= uFade;
    o = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`;

  function mkProg(gl, vs, fs) {
    const s = (t, src) => { const sh = gl.createShader(t); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) + "\n" + src.split("\n").map((l, i) => i + 1 + ": " + l).join("\n")); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, s(gl.VERTEX_SHADER, vs)); gl.attachShader(p, s(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }

  /* ── tiny mat4 ── */
  const M = {
    persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); },
    look(e, c, up) { let z = norm(sub(e, c)), x = norm(cross(up, z)), y = cross(z, x);
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]); },
    mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
    inv(m) { const a = m, o = new Float32Array(16);
      const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
      const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
      const det = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
      o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
      o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
      o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
      o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det; o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det;
      return o; },
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  function createRenderer(canvas, W, H) {
    const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true, alpha: false, premultipliedAlpha: false });
    if (!gl) throw new Error("no webgl2");
    if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("no EXT_color_buffer_float");
    gl.getExtension("OES_texture_float_linear");
    const P = { dot: mkProg(gl, VS_DOT, FS_DOT), quad: mkProg(gl, VS_QUAD, FS_QUAD), comp: mkProg(gl, VS_FS, FS_COMP), dof: mkProg(gl, VS_FS, FS_DOF),
      down: mkProg(gl, VS_FS, FS_DOWN), up: mkProg(gl, VS_FS, FS_UP), blur: mkProg(gl, VS_FS, FS_BLUR), fin: mkProg(gl, VS_FS, FS_FINAL) };

    const tex = (w, h, fmt = gl.RGBA16F, f = gl.LINEAR) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    const fbo = (colorTex, depthTex) => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTex, 0);
      if (depthTex) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTex, 0); return f; };
    const SAMPLES = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
    const msFbo = (w, h) => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      const c = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, c); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, SAMPLES, gl.RGBA16F, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, c);
      const d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, SAMPLES, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d); return f; };

    const hw = W >> 1, hh = H >> 1;
    const T = {
      ms: msFbo(W, H), scene: tex(W, H), depth: tex(W, H, gl.DEPTH_COMPONENT24, gl.NEAREST),
      msR: msFbo(hw, hh), refl: tex(hw, hh), reflB: tex(hw, hh), comp: tex(W, H), dof: tex(hw, hh), fin: null,
    };
    T.fScene = fbo(T.scene, T.depth); T.fRefl = fbo(T.refl); T.fReflB = fbo(T.reflB); T.fComp = fbo(T.comp); T.fDof = fbo(T.dof);
    const pyr = []; { let w = W, h = H; for (let i = 0; i < 7; i++) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); const t = tex(w, h); pyr.push({ t, f: fbo(t), w, h }); } }

    // geometry
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); let ibCap = 0;
    for (let k = 0; k < 4; k++) { gl.enableVertexAttribArray(1 + k); gl.vertexAttribPointer(1 + k, 4, gl.FLOAT, false, FLOATS * 4, k * 16); gl.vertexAttribDivisor(1 + k, 1); }
    const qvao = gl.createVertexArray(); gl.bindVertexArray(qvao); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const evao = gl.createVertexArray();
    gl.bindVertexArray(null);

    const images = {};
    function addImage(name, img) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const an = gl.getExtension("EXT_texture_filter_anisotropic"); if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, 8);
      images[name] = t; }

    function drawFull(prog, target, w, h) { gl.bindFramebuffer(gl.FRAMEBUFFER, target); gl.viewport(0, 0, w, h); gl.useProgram(prog.p); gl.bindVertexArray(evao); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    function bindTex(prog, name, t, unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(prog.u[name], unit); }

    function render(F, frameNo) {
      const cam = F.cam, asp = W / H, near = cam.near || 0.05, far = cam.far || 600;
      const up = cam.up || [Math.sin(cam.roll || 0), Math.cos(cam.roll || 0), 0];
      const V = M.look(cam.pos, cam.tgt, up), Pm = M.persp((cam.fov || 40) * Math.PI / 180, asp, near, far), VP = M.mul(Pm, V);
      const fwd = norm(sub(cam.tgt, cam.pos));
      const L = F.light || {}, key = norm(L.key || [0.3, 0.8, 0.6]), keyCol = L.keyCol || [1, 1, 1], amb = L.amb || [0.02, 0.02, 0.022];
      const floorY = F.floor ? F.floor.y : -1e5, reflAmt = F.floor ? F.floor.refl : 0;

      // instance upload
      gl.bindBuffer(gl.ARRAY_BUFFER, ib);
      const bytes = F.n * FLOATS * 4;
      if (bytes > ibCap) { ibCap = Math.max(bytes, ibCap * 2, 1 << 20); gl.bufferData(gl.ARRAY_BUFFER, ibCap, gl.DYNAMIC_DRAW); }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, F.inst, 0, F.n * FLOATS);

      const scenePass = (mirror) => {
        gl.useProgram(P.dot.p);
        gl.uniformMatrix4fv(P.dot.u.uVP, false, VP); gl.uniformMatrix4fv(P.dot.u.uView, false, V);
        gl.uniform1f(P.dot.u.uMirror, mirror); gl.uniform1f(P.dot.u.uFloorY, floorY);
        gl.uniform3fv(P.dot.u.uCam, cam.pos); gl.uniform3fv(P.dot.u.uKey, key); gl.uniform3fv(P.dot.u.uKeyCol, keyCol); gl.uniform3fv(P.dot.u.uAmb, amb);
        gl.uniform1f(P.dot.u.uEmitK, F.emitK ?? 1); gl.uniform3fv(P.dot.u.uUnlit, F.unlit || [0.03, 0.03, 0.032]);
        gl.bindVertexArray(vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, F.n);
        if (F.quads) {
          gl.useProgram(P.quad.p); gl.uniformMatrix4fv(P.quad.u.uVP, false, VP); gl.uniform1f(P.quad.u.uMirror, mirror); gl.uniform1f(P.quad.u.uFloorY, floorY);
          gl.bindVertexArray(qvao);
          for (const q of F.quads) { if (!images[q.tex]) continue;
            gl.uniform3fv(P.quad.u.uC, q.c); gl.uniform3fv(P.quad.u.uU, q.u); gl.uniform3fv(P.quad.u.uV, q.v);
            gl.uniform1f(P.quad.u.uGain, q.gain ?? 1); gl.uniform1f(P.quad.u.uAlpha, q.alpha ?? 1); gl.uniform4fv(P.quad.u.uCrop, q.crop || [0, 0, 1, 1]);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, images[q.tex]); gl.uniform1i(P.quad.u.uTex, 0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
        }
      };
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE); gl.disable(gl.BLEND);
      // reflection
      if (reflAmt > 0) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, T.msR); gl.viewport(0, 0, hw, hh); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        scenePass(1);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, T.msR); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, T.fRefl); gl.blitFramebuffer(0, 0, hw, hh, 0, 0, hw, hh, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      }
      // main
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.ms); gl.viewport(0, 0, W, H); const bg = F.bg || [0, 0, 0]; gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      scenePass(0);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, T.ms); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, T.fScene);
      gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);

      // blur reflection
      const rb = F.floor ? (F.floor.blur ?? 1.5) : 1.5;
      if (reflAmt > 0) {
        gl.useProgram(P.blur.p); bindTex(P.blur, "uSrc", T.refl, 0); gl.uniform2f(P.blur.u.uDir, rb / hw, 0); drawFull(P.blur, T.fReflB, hw, hh);
        gl.useProgram(P.blur.p); bindTex(P.blur, "uSrc", T.reflB, 0); gl.uniform2f(P.blur.u.uDir, 0, rb * 1.6 / hh); drawFull(P.blur, T.fRefl, hw, hh);
      }
      // composite
      const p = P.comp; gl.useProgram(p.p);
      bindTex(p, "uScene", T.scene, 0); bindTex(p, "uDepth", T.depth, 1); bindTex(p, "uRefl", T.refl, 2);
      gl.uniform1f(p.u.uNear, near); gl.uniform1f(p.u.uFar, far); gl.uniformMatrix4fv(p.u.uInvVP, false, M.inv(VP)); gl.uniform3fv(p.u.uCam, cam.pos); gl.uniform3fv(p.u.uFwd, fwd);
      gl.uniform1f(p.u.uFloorY, floorY); gl.uniform1f(p.u.uReflAmt, reflAmt); const fog = F.fog || {}; gl.uniform1f(p.u.uFog, fog.d ?? 0.01); gl.uniform3fv(p.u.uFogCol, fog.col || [0, 0, 0]);
      gl.uniform1f(p.u.uFloorGlow, F.floor ? (F.floor.glow || 0) : 0);
      const maxCoc = cam.maxCoc ?? 18;
      gl.uniform1f(p.u.uFocus, cam.focus ?? 10); gl.uniform1f(p.u.uAperture, cam.aperture ?? 0); gl.uniform1f(p.u.uMaxCoc, maxCoc);
      drawFull(p, T.fComp, W, H);
      // dof (half res, coc in full-res px → half-res px)
      gl.useProgram(P.dof.p); bindTex(P.dof, "uSrc", T.comp, 0); gl.uniform2f(P.dof.u.uPx, 1 / W, 1 / H); gl.uniform1f(P.dof.u.uMaxCoc, (cam.aperture ?? 0) > 0 ? maxCoc : 0);
      drawFull(P.dof, T.fDof, hw, hh);
      // bloom
      let src = T.comp, sw = W, sh = H;
      for (let i = 0; i < pyr.length; i++) { gl.useProgram(P.down.p); bindTex(P.down, "uSrc", src, 0); gl.uniform2f(P.down.u.uPx, 1 / sw, 1 / sh); gl.uniform1f(P.down.u.uFirst, i === 0 ? 1 : 0); drawFull(P.down, pyr[i].f, pyr[i].w, pyr[i].h); src = pyr[i].t; sw = pyr[i].w; sh = pyr[i].h; }
      gl.enable(gl.BLEND); gl.blendColor(0, 0, 0, 0.55); gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE);
      for (let i = pyr.length - 1; i > 0; i--) { gl.useProgram(P.up.p); bindTex(P.up, "uSrc", pyr[i].t, 0); gl.uniform2f(P.up.u.uPx, 1 / pyr[i].w, 1 / pyr[i].h); drawFull(P.up, pyr[i - 1].f, pyr[i - 1].w, pyr[i - 1].h); }
      gl.disable(gl.BLEND);
      // final
      const q = F.post || {}; const f = P.fin; gl.useProgram(f.p);
      bindTex(f, "uSharp", T.comp, 0); bindTex(f, "uDof", T.dof, 1); bindTex(f, "uBloom", pyr[0].t, 2);
      gl.uniform2f(f.u.uRes, W, H); gl.uniform1f(f.u.uExposure, q.exposure ?? 1); gl.uniform1f(f.u.uBloomK, q.bloom ?? 0.6);
      gl.uniform2fv(f.u.uWhip, q.whip || [0, 0]); gl.uniform1f(f.u.uFlash, q.flash || 0); gl.uniform3fv(f.u.uGrade, q.grade || [1, 1, 1]); gl.uniform3fv(f.u.uLift, q.lift || [0, 0, 0]);
      gl.uniform1f(f.u.uVig, q.vig ?? 0.45); gl.uniform1f(f.u.uGrain, q.grain ?? 0.012); gl.uniform1f(f.u.uCA, q.ca ?? 0.0025); gl.uniform1f(f.u.uFrame, frameNo || 0); gl.uniform1f(f.u.uFade, q.fade ?? 1);
      drawFull(f, null, W, H);
    }
    return { render, addImage, gl };
  }
  globalThis.createRenderer = createRenderer;
  globalThis.INST_FLOATS = FLOATS;
})();
