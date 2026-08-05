(() => {
  'use strict';

  const doc = document;
  const canvas = doc.querySelector('[data-webgl]');
  const journey = doc.querySelector('[data-journey]');
  const scenes = [...doc.querySelectorAll('[data-scene]')];
  const journeyBar = doc.querySelector('[data-journey-progress]');
  const sceneIndex = doc.querySelector('[data-scene-index]');
  const pageBar = doc.querySelector('[data-page-progress]');
  const fallback = doc.querySelector('[data-canvas-fallback]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = matchMedia('(pointer: coarse)').matches;

  const state = {
    progress: 0,
    targetProgress: 0,
    pointerX: 0,
    pointerY: 0,
    smoothPointerX: 0,
    smoothPointerY: 0,
    lastTime: performance.now(),
    running: true
  };

  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, value) => {
    const x = clamp((value - a) / Math.max(.00001, b - a));
    return x * x * (3 - 2 * x);
  };
  const easeInOut = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* ------------------------------------------------------------------
     Header, menu, global progress
  ------------------------------------------------------------------ */
  const header = doc.querySelector('[data-header]');
  const menuToggle = doc.querySelector('.menu-toggle');
  const mainNav = doc.querySelector('.main-nav');

  function updateHeader() {
    header?.classList.toggle('is-scrolled', scrollY > 30);
    const max = Math.max(1, doc.documentElement.scrollHeight - innerHeight);
    if (pageBar) pageBar.style.width = `${(scrollY / max) * 100}%`;
  }
  updateHeader();
  addEventListener('scroll', updateHeader, { passive: true });

  menuToggle?.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded', String(open));
    mainNav?.classList.toggle('is-open', open);
  });
  mainNav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    menuToggle?.setAttribute('aria-expanded', 'false');
    mainNav?.classList.remove('is-open');
  }));

  /* ------------------------------------------------------------------
     Scroll journey
  ------------------------------------------------------------------ */
  function readProgress() {
    if (!journey) return 0;
    const rect = journey.getBoundingClientRect();
    const range = Math.max(1, journey.offsetHeight - innerHeight);
    return clamp(-rect.top / range);
  }

  function applyScenes(progress) {
    const heroOpacity = 1 - smoothstep(.16, .32, progress);
    const methodOpacity = smoothstep(.24, .38, progress) * (1 - smoothstep(.59, .72, progress));
    const transitionOpacity = smoothstep(.63, .76, progress) * (1 - smoothstep(.96, 1, progress));
    const values = [heroOpacity, methodOpacity, transitionOpacity];

    scenes.forEach((scene, index) => {
      const opacity = values[index] || 0;
      scene.style.opacity = opacity.toFixed(3);
      scene.style.visibility = opacity > .025 ? 'visible' : 'hidden';
      scene.classList.toggle('is-active', opacity > .45);
      const drift = index === 0 ? -progress * 35 : index === 1 ? (progress - .46) * -28 : (progress - .8) * -25;
      scene.style.transform = `translate3d(0, ${drift}px, 0)`;
    });

    const current = progress < .31 ? 0 : progress < .68 ? 1 : 2;
    if (sceneIndex) sceneIndex.textContent = ['01 — ENTRÉE', '02 — MÉTHODOLOGIE', '03 — PROJETS'][current];
    if (journeyBar) journeyBar.style.height = `${progress * 100}%`;
    if (canvas) canvas.style.opacity = String(1 - smoothstep(.94, 1, progress) * .5);
  }

  function updateScrollTarget() {
    state.targetProgress = readProgress();
  }
  updateScrollTarget();
  addEventListener('scroll', updateScrollTarget, { passive: true });
  addEventListener('resize', updateScrollTarget, { passive: true });

  if (!coarsePointer) {
    addEventListener('pointermove', (event) => {
      state.pointerX = (event.clientX / innerWidth - .5) * 2;
      state.pointerY = (event.clientY / innerHeight - .5) * -2;
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     Minimal matrix library (column-major, WebGL compatible)
  ------------------------------------------------------------------ */
  const M4 = {
    identity() {
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    },
    multiply(a, b) {
      const out = new Float32Array(16);
      for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
          out[col * 4 + row] =
            a[0 * 4 + row] * b[col * 4 + 0] +
            a[1 * 4 + row] * b[col * 4 + 1] +
            a[2 * 4 + row] * b[col * 4 + 2] +
            a[3 * 4 + row] * b[col * 4 + 3];
        }
      }
      return out;
    },
    perspective(fov, aspect, near, far) {
      const f = 1 / Math.tan(fov / 2);
      const nf = 1 / (near - far);
      return new Float32Array([
        f / aspect,0,0,0,
        0,f,0,0,
        0,0,(far + near) * nf,-1,
        0,0,2 * far * near * nf,0
      ]);
    },
    translation(x, y, z) {
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
    },
    scale(x, y, z) {
      return new Float32Array([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]);
    },
    rotX(a) {
      const c = Math.cos(a), s = Math.sin(a);
      return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);
    },
    rotY(a) {
      const c = Math.cos(a), s = Math.sin(a);
      return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
    },
    rotZ(a) {
      const c = Math.cos(a), s = Math.sin(a);
      return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]);
    },
    compose(position, rotation, scale) {
      let m = M4.translation(position[0], position[1], position[2]);
      m = M4.multiply(m, M4.rotZ(rotation[2]));
      m = M4.multiply(m, M4.rotY(rotation[1]));
      m = M4.multiply(m, M4.rotX(rotation[0]));
      m = M4.multiply(m, M4.scale(scale[0], scale[1], scale[2]));
      return m;
    },
    lookAt(eye, target, up = [0,1,0]) {
      const sub = (a,b) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
      const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
      const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
      const normalize = (v) => { const l = Math.hypot(v[0],v[1],v[2]) || 1; return [v[0]/l,v[1]/l,v[2]/l]; };
      const z = normalize(sub(eye, target));
      const x = normalize(cross(up, z));
      const y = cross(z, x);
      return new Float32Array([
        x[0],y[0],z[0],0,
        x[1],y[1],z[1],0,
        x[2],y[2],z[2],0,
        -dot(x,eye),-dot(y,eye),-dot(z,eye),1
      ]);
    }
  };

  /* ------------------------------------------------------------------
     Geometry generators
  ------------------------------------------------------------------ */
  function roundedRectPath(width, height, radius, cornerSegments = 10) {
    const points = [];
    const hw = width / 2, hh = height / 2;
    const corners = [
      [hw - radius, hh - radius, 0, Math.PI / 2],
      [-hw + radius, hh - radius, Math.PI / 2, Math.PI],
      [-hw + radius, -hh + radius, Math.PI, Math.PI * 1.5],
      [hw - radius, -hh + radius, Math.PI * 1.5, Math.PI * 2]
    ];
    corners.forEach(([cx, cy, start, end]) => {
      for (let i = 0; i < cornerSegments; i++) {
        const t = i / cornerSegments;
        const a = lerp(start, end, t);
        points.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, 0]);
      }
    });
    return points;
  }

  function createTubeGeometry(path, tubeRadius = .12, radialSegments = 12) {
    const positions = [], normals = [], indices = [];
    const count = path.length;
    for (let i = 0; i < count; i++) {
      const prev = path[(i - 1 + count) % count];
      const next = path[(i + 1) % count];
      let tx = next[0] - prev[0], ty = next[1] - prev[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      const nx = -ty, ny = tx;
      for (let j = 0; j < radialSegments; j++) {
        const a = j / radialSegments * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        positions.push(
          path[i][0] + nx * ca * tubeRadius,
          path[i][1] + ny * ca * tubeRadius,
          path[i][2] + sa * tubeRadius
        );
        normals.push(nx * ca, ny * ca, sa);
      }
    }
    for (let i = 0; i < count; i++) {
      const ni = (i + 1) % count;
      for (let j = 0; j < radialSegments; j++) {
        const nj = (j + 1) % radialSegments;
        const a = i * radialSegments + j;
        const b = ni * radialSegments + j;
        const c = ni * radialSegments + nj;
        const d = i * radialSegments + nj;
        indices.push(a,b,d, b,c,d);
      }
    }
    return { positions, normals, indices };
  }

  function createBoxGeometry() {
    const p = [
      -1,-1,1, 1,-1,1, 1,1,1, -1,1,1,
      1,-1,-1, -1,-1,-1, -1,1,-1, 1,1,-1,
      -1,1,1, 1,1,1, 1,1,-1, -1,1,-1,
      -1,-1,-1, 1,-1,-1, 1,-1,1, -1,-1,1,
      1,-1,1, 1,-1,-1, 1,1,-1, 1,1,1,
      -1,-1,-1, -1,-1,1, -1,1,1, -1,1,-1
    ];
    const n = [
      0,0,1,0,0,1,0,0,1,0,0,1,
      0,0,-1,0,0,-1,0,0,-1,0,0,-1,
      0,1,0,0,1,0,0,1,0,0,1,0,
      0,-1,0,0,-1,0,0,-1,0,0,-1,0,
      1,0,0,1,0,0,1,0,0,1,0,0,
      -1,0,0,-1,0,0,-1,0,0,-1,0,0
    ];
    const idx = [];
    for (let f = 0; f < 6; f++) { const o = f*4; idx.push(o,o+1,o+2,o,o+2,o+3); }
    return { positions:p, normals:n, indices:idx };
  }

  function createSphereGeometry(radius = 1, lat = 14, lon = 18) {
    const positions=[], normals=[], indices=[];
    for(let y=0;y<=lat;y++){
      const v=y/lat, phi=v*Math.PI;
      for(let x=0;x<=lon;x++){
        const u=x/lon, theta=u*Math.PI*2;
        const nx=Math.sin(phi)*Math.cos(theta), ny=Math.cos(phi), nz=Math.sin(phi)*Math.sin(theta);
        positions.push(nx*radius,ny*radius,nz*radius); normals.push(nx,ny,nz);
      }
    }
    for(let y=0;y<lat;y++) for(let x=0;x<lon;x++){
      const a=y*(lon+1)+x,b=a+lon+1;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
    return {positions,normals,indices};
  }

  /* ------------------------------------------------------------------
     Raw WebGL renderer — actual meshes, camera and lighting
  ------------------------------------------------------------------ */
  class CrystalRenderer {
    constructor(canvasElement) {
      this.canvas = canvasElement;
      this.gl = canvasElement?.getContext('webgl', {
        alpha: true,
        antialias: !coarsePointer,
        depth: true,
        premultipliedAlpha: false,
        powerPreference: 'high-performance'
      });
      if (!this.gl) throw new Error('WebGL indisponible');
      this.meshProgram = this.createProgram(CrystalRenderer.meshVS, CrystalRenderer.meshFS);
      this.lineProgram = this.createProgram(CrystalRenderer.lineVS, CrystalRenderer.lineFS);
      this.pointProgram = this.createProgram(CrystalRenderer.pointVS, CrystalRenderer.pointFS);
      this.meshLocations = this.getMeshLocations();
      this.lineLocations = this.getLineLocations();
      this.pointLocations = this.getPointLocations();
      this.geometries = {};
      this.objects = [];
      this.lines = [];
      this.points = null;
      this.camera = { eye:[0,0,11], target:[0,0,0] };
      this.buildScene();
      this.resize();
      const gl = this.gl;
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.clearColor(0,0,0,0);
    }

    createShader(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader: ${error}`);
      }
      return shader;
    }

    createProgram(vs, fs) {
      const gl = this.gl;
      const program = gl.createProgram();
      gl.attachShader(program, this.createShader(gl.VERTEX_SHADER, vs));
      gl.attachShader(program, this.createShader(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      return program;
    }

    getMeshLocations() {
      const gl=this.gl,p=this.meshProgram;
      return {
        position:gl.getAttribLocation(p,'aPosition'), normal:gl.getAttribLocation(p,'aNormal'),
        model:gl.getUniformLocation(p,'uModel'), view:gl.getUniformLocation(p,'uView'), projection:gl.getUniformLocation(p,'uProjection'),
        camera:gl.getUniformLocation(p,'uCamera'), color:gl.getUniformLocation(p,'uColor'), material:gl.getUniformLocation(p,'uMaterial'),
        opacity:gl.getUniformLocation(p,'uOpacity'), time:gl.getUniformLocation(p,'uTime')
      };
    }
    getLineLocations(){const gl=this.gl,p=this.lineProgram;return{position:gl.getAttribLocation(p,'aPosition'),view:gl.getUniformLocation(p,'uView'),projection:gl.getUniformLocation(p,'uProjection'),color:gl.getUniformLocation(p,'uColor'),opacity:gl.getUniformLocation(p,'uOpacity')}}
    getPointLocations(){const gl=this.gl,p=this.pointProgram;return{position:gl.getAttribLocation(p,'aPosition'),size:gl.getAttribLocation(p,'aSize'),view:gl.getUniformLocation(p,'uView'),projection:gl.getUniformLocation(p,'uProjection'),time:gl.getUniformLocation(p,'uTime'),opacity:gl.getUniformLocation(p,'uOpacity')}}

    uploadGeometry(name, data) {
      const gl=this.gl;
      const position=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,position); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.positions),gl.STATIC_DRAW);
      const normal=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,normal); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.normals),gl.STATIC_DRAW);
      const index=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);
      const maxIndex=Math.max(...data.indices), useUint=maxIndex>65535;
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,useUint?new Uint32Array(data.indices):new Uint16Array(data.indices),gl.STATIC_DRAW);
      this.geometries[name]={position,normal,index,count:data.indices.length,type:useUint?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT};
    }

    addObject(geometry, material, position, rotation=[0,0,0], scale=[1,1,1], meta={}) {
      this.objects.push({ geometry, material, position:[...position], rotation:[...rotation], scale:[...scale], basePosition:[...position], baseRotation:[...rotation], baseScale:[...scale], meta });
    }

    buildScene() {
      const archPath = roundedRectPath(4.5, 6.3, 1.2, coarsePointer ? 8 : 12);
      this.uploadGeometry('archSilver', createTubeGeometry(archPath, .115, coarsePointer ? 8 : 14));
      this.uploadGeometry('archGlass', createTubeGeometry(archPath, .23, coarsePointer ? 8 : 16));
      this.uploadGeometry('archBlue', createTubeGeometry(archPath, .035, coarsePointer ? 6 : 10));
      this.uploadGeometry('box', createBoxGeometry());
      this.uploadGeometry('sphere', createSphereGeometry(1, coarsePointer ? 9 : 14, coarsePointer ? 12 : 18));

      const silver={kind:0,color:[.72,.79,.88],opacity:1};
      const glass={kind:1,color:[.75,.9,1],opacity:.68};
      const blue={kind:2,color:[.035,.44,1],opacity:.95};
      const white={kind:0,color:[.92,.95,.98],opacity:1};

      // Hero sculpture: several real overlapping tube meshes.
      this.addObject('archGlass',glass,[0,0,.2],[0,.02,0],[1.22,1.22,1.22],{hero:true,layer:0});
      this.addObject('archSilver',silver,[0,0,.18],[0,.02,0],[1.18,1.18,1.18],{hero:true,layer:1});
      this.addObject('archBlue',blue,[0,0,.3],[0,.02,0],[1.12,1.12,1.12],{hero:true,layer:2});
      this.addObject('archGlass',glass,[0,0,-.2],[.08,.58,.04],[.94,.94,.94],{hero:true,layer:3});
      this.addObject('archSilver',silver,[0,0,-.23],[.08,.58,.04],[.9,.9,.9],{hero:true,layer:4});
      this.addObject('archBlue',blue,[0,0,-.12],[.08,.58,.04],[.85,.85,.85],{hero:true,layer:5});
      this.addObject('archGlass',glass,[0,0,-.45],[-.12,-.52,-.03],[.72,.72,.72],{hero:true,layer:6});
      this.addObject('archSilver',silver,[0,0,-.48],[-.12,-.52,-.03],[.68,.68,.68],{hero:true,layer:7});

      // Infinite tunnel: arches are genuine geometry distributed in depth.
      const tunnelCount = coarsePointer ? 14 : 22;
      for (let i=0;i<tunnelCount;i++) {
        const z=-2.2-i*2.15;
        const wave=1+Math.sin(i*.72)*.055;
        const rot=(i%2?1:-1)*(.035+.012*Math.sin(i));
        this.addObject('archGlass',glass,[0,0,z],[0,0,rot],[wave,wave,wave],{tunnel:true,index:i,glass:true});
        this.addObject('archSilver',i%4===0?white:silver,[0,0,z-.035],[0,0,rot],[wave*.965,wave*.965,wave*.965],{tunnel:true,index:i});
        if(i%2===0) this.addObject('archBlue',blue,[0,0,z+.045],[0,0,rot],[wave*.92,wave*.92,wave*.92],{tunnel:true,index:i,blue:true});
      }

      // Reflective floor rails through the tunnel.
      for (const x of [-2.15,-1.2,0,1.2,2.15]) {
        const isCenter=Math.abs(x)<.1;
        this.addObject('box',isCenter?blue:silver,[x,-3.22,-21],[0,0,0],[isCenter?.025:.035,.025,20],{rail:true});
      }
      for(let i=0;i<18;i++){
        this.addObject('box',i%3===0?blue:white,[0,-3.16,-i*2.4-2],[0,0,0],[2.55,.018,.035],{floorStep:true,index:i});
      }

      // Data nodes in methodology area.
      const nodes=[[-2.3,1.35,-17],[2.25,1,-19],[-2.45,-1,-21],[2.1,-1.25,-23],[0,1.8,-25],[0,-1.65,-27]];
      nodes.forEach((pos,i)=>{
        this.addObject('sphere',i%2?blue:silver,pos,[0,0,0],[.13,.13,.13],{node:true,index:i});
        this.addObject('sphere',glass,pos,[0,0,0],[.25,.25,.25],{node:true,index:i,halo:true});
      });
      const linePositions=[];
      for(let i=0;i<nodes.length-1;i++) linePositions.push(...nodes[i],...nodes[i+1]);
      linePositions.push(...nodes[0],...nodes[3],...nodes[1],...nodes[4],...nodes[2],...nodes[5]);
      this.lines.push(this.uploadLine(linePositions,[.12,.52,1],.62));

      // End platform, visible before HTML projects.
      this.addObject('box',silver,[0,-2.65,-32],[0,0,0],[3.7,.12,3.7],{platform:true});
      this.addObject('box',glass,[0,-2.45,-32],[0,0,0],[3.4,.08,3.4],{platform:true,glass:true});
      this.addObject('sphere',blue,[0,-2.05,-32],[0,0,0],[.24,.24,.24],{platform:true,node:true});

      this.buildParticles();
    }

    uploadLine(positions,color,opacity){
      const gl=this.gl,buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(positions),gl.STATIC_DRAW);
      return{buffer,count:positions.length/3,color,opacity};
    }

    buildParticles(){
      const gl=this.gl,positions=[],sizes=[];
      const count=coarsePointer?280:720;
      let seed=12931;
      const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
      for(let i=0;i<count;i++){
        const a=random()*Math.PI*2,r=2.5+random()*2.7,z=5-random()*43;
        positions.push(Math.cos(a)*r,(Math.sin(a)*r)*.78,z);sizes.push(.9+random()*2.1);
      }
      const position=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,position);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(positions),gl.STATIC_DRAW);
      const size=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,size);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(sizes),gl.STATIC_DRAW);
      this.points={position,size,count};
    }

    resize(){
      const dpr=Math.min(devicePixelRatio||1,coarsePointer?1.3:1.8);
      const width=Math.max(1,Math.floor(this.canvas.clientWidth*dpr));
      const height=Math.max(1,Math.floor(this.canvas.clientHeight*dpr));
      if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;this.gl.viewport(0,0,width,height);}
      this.aspect=width/height;
    }

    updateCamera(progress){
      let z;
      if(progress<.25) z=lerp(14.0,4.8,easeInOut(progress/.25));
      else if(progress<.72) z=lerp(4.8,-20,easeInOut((progress-.25)/.47));
      else z=lerp(-20,-30.7,easeInOut((progress-.72)/.28));
      const pointerInfluence=1-smoothstep(.3,.75,progress);
      const x=Math.sin(progress*Math.PI*2.2)*.22+state.smoothPointerX*.28*pointerInfluence;
      const y=lerp(.45,0,smoothstep(0,.28,progress))+Math.sin(progress*Math.PI*3.1)*.12+state.smoothPointerY*.16*pointerInfluence;
      const targetZ=progress<.2?0:z-7.2;
      this.camera.eye=[x,y,z];
      this.camera.target=[x*.2,y*.15,targetZ];
    }

    updateObjects(time,progress){
      this.objects.forEach((obj)=>{
        obj.position[0]=obj.basePosition[0];obj.position[1]=obj.basePosition[1];obj.position[2]=obj.basePosition[2];
        obj.rotation[0]=obj.baseRotation[0];obj.rotation[1]=obj.baseRotation[1];obj.rotation[2]=obj.baseRotation[2];
        obj.scale[0]=obj.baseScale[0];obj.scale[1]=obj.baseScale[1];obj.scale[2]=obj.baseScale[2];
        if(obj.meta.hero){
          const enter=smoothstep(.12,.38,progress);
          obj.rotation[2]+=time*.035*(obj.meta.layer%2?1:-1)+enter*(obj.meta.layer%2?.7:-.6);
          obj.rotation[1]+=Math.sin(time*.32+obj.meta.layer)*.035;
          const pulse=1+Math.sin(time*.58+obj.meta.layer)*.012;
          obj.scale=obj.baseScale.map(v=>v*pulse*(1-enter*.12));
          obj.position[2]-=enter*1.7;
        }
        if(obj.meta.tunnel){
          obj.rotation[2]+=Math.sin(time*.22+obj.meta.index*.5)*.02;
          const breathing=1+Math.sin(time*.44+obj.meta.index*.72)*.012;
          obj.scale=obj.baseScale.map(v=>v*breathing);
        }
        if(obj.meta.node){
          obj.position[1]+=Math.sin(time*1.15+obj.meta.index)*.12;
          if(obj.meta.halo){const s=1+Math.sin(time*1.3+obj.meta.index)*.16;obj.scale=obj.baseScale.map(v=>v*s);}
        }
        if(obj.meta.platform){
          obj.rotation[1]+=time*.04;
        }
      });
    }

    drawMeshObject(obj,view,projection,time,pass){
      const gl=this.gl,geo=this.geometries[obj.geometry],loc=this.meshLocations,mat=obj.material;
      const isGlass=mat.kind===1,isBlue=mat.kind===2;
      if(pass==='opaque'&&(isGlass||isBlue))return;
      if(pass==='blue'&&!isBlue)return;
      if(pass==='glass'&&!isGlass)return;
      gl.useProgram(this.meshProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER,geo.position);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,geo.normal);gl.enableVertexAttribArray(loc.normal);gl.vertexAttribPointer(loc.normal,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,geo.index);
      const model=M4.compose(obj.position,obj.rotation,obj.scale);
      gl.uniformMatrix4fv(loc.model,false,model);gl.uniformMatrix4fv(loc.view,false,view);gl.uniformMatrix4fv(loc.projection,false,projection);
      gl.uniform3fv(loc.camera,new Float32Array(this.camera.eye));gl.uniform3fv(loc.color,new Float32Array(mat.color));gl.uniform1i(loc.material,mat.kind);gl.uniform1f(loc.opacity,mat.opacity);gl.uniform1f(loc.time,time);
      gl.drawElements(gl.TRIANGLES,geo.count,geo.type,0);
    }

    render(time,progress){
      this.resize();this.updateCamera(progress);this.updateObjects(time,progress);
      const gl=this.gl;gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const projection=M4.perspective((coarsePointer?49:43)*Math.PI/180,this.aspect,.08,90);
      const view=M4.lookAt(this.camera.eye,this.camera.target);

      gl.disable(gl.BLEND);gl.depthMask(true);gl.enable(gl.CULL_FACE);
      this.objects.forEach(o=>this.drawMeshObject(o,view,projection,time,'opaque'));

      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);gl.disable(gl.CULL_FACE);
      this.objects.forEach(o=>this.drawMeshObject(o,view,projection,time,'blue'));
      this.drawLines(view,projection,progress);
      this.drawPoints(view,projection,time,progress);

      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.disable(gl.CULL_FACE);
      // Back-to-front approximate sorting for glass.
      const glassObjects=this.objects.filter(o=>o.material.kind===1).sort((a,b)=>a.position[2]-b.position[2]);
      glassObjects.forEach(o=>this.drawMeshObject(o,view,projection,time,'glass'));
      gl.depthMask(true);
    }

    drawLines(view,projection,progress){
      const gl=this.gl,loc=this.lineLocations;
      gl.useProgram(this.lineProgram);gl.uniformMatrix4fv(loc.view,false,view);gl.uniformMatrix4fv(loc.projection,false,projection);
      this.lines.forEach(line=>{gl.bindBuffer(gl.ARRAY_BUFFER,line.buffer);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,0,0);gl.uniform3fv(loc.color,new Float32Array(line.color));gl.uniform1f(loc.opacity,line.opacity*smoothstep(.32,.66,progress));gl.drawArrays(gl.LINES,0,line.count);});
    }

    drawPoints(view,projection,time,progress){
      if(!this.points)return;
      const gl=this.gl,loc=this.pointLocations;gl.useProgram(this.pointProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.points.position);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.points.size);gl.enableVertexAttribArray(loc.size);gl.vertexAttribPointer(loc.size,1,gl.FLOAT,false,0,0);
      gl.uniformMatrix4fv(loc.view,false,view);gl.uniformMatrix4fv(loc.projection,false,projection);gl.uniform1f(loc.time,time);gl.uniform1f(loc.opacity,.32+.25*smoothstep(.25,.65,progress));gl.drawArrays(gl.POINTS,0,this.points.count);
    }
  }

  CrystalRenderer.meshVS=`
    attribute vec3 aPosition;attribute vec3 aNormal;
    uniform mat4 uModel,uView,uProjection;
    varying vec3 vWorld;varying vec3 vNormal;
    void main(){vec4 world=uModel*vec4(aPosition,1.0);vWorld=world.xyz;vNormal=normalize(mat3(uModel)*aNormal);gl_Position=uProjection*uView*world;}
  `;
  CrystalRenderer.meshFS=`
    precision highp float;
    varying vec3 vWorld;varying vec3 vNormal;
    uniform vec3 uCamera,uColor;uniform int uMaterial;uniform float uOpacity,uTime;
    void main(){
      vec3 n=normalize(vNormal);vec3 v=normalize(uCamera-vWorld);
      vec3 l1=normalize(vec3(-.35,.72,.58));vec3 l2=normalize(vec3(.65,-.25,.72));
      float d1=max(dot(n,l1),0.0),d2=max(dot(n,l2),0.0);
      float fres=pow(1.0-max(dot(n,v),0.0),2.35);
      float spec1=pow(max(dot(reflect(-l1,n),v),0.0),72.0);
      float spec2=pow(max(dot(reflect(-l2,n),v),0.0),34.0);
      vec3 blue=vec3(.035,.44,1.0);
      vec3 col;float alpha=uOpacity;
      if(uMaterial==0){
        col=uColor*(.4+d1*.55+d2*.25)+vec3(1.0)*(spec1*1.35+spec2*.45)+blue*fres*.32;
      }else if(uMaterial==1){
        float bands=.5+.5*sin((vWorld.z+vWorld.y*.25)*4.0-uTime*.45);
        col=mix(vec3(.82,.91,1.0),blue,.16+fres*.58)+vec3(1.0)*(spec1*1.6+spec2*.55)+blue*bands*.035;
        alpha=uOpacity*(.14+fres*.64+spec1*.22);
      }else{
        col=blue*(1.25+d1*.35)+vec3(.4,.78,1.0)*spec1+blue*fres;
        alpha=uOpacity*(.72+fres*.28);
      }
      gl_FragColor=vec4(col,clamp(alpha,0.0,1.0));
    }
  `;
  CrystalRenderer.lineVS=`attribute vec3 aPosition;uniform mat4 uView,uProjection;void main(){gl_Position=uProjection*uView*vec4(aPosition,1.0);}`;
  CrystalRenderer.lineFS=`precision mediump float;uniform vec3 uColor;uniform float uOpacity;void main(){gl_FragColor=vec4(uColor,uOpacity);}`;
  CrystalRenderer.pointVS=`attribute vec3 aPosition;attribute float aSize;uniform mat4 uView,uProjection;uniform float uTime;void main(){vec3 p=aPosition;p.y+=sin(uTime*.6+aPosition.z)*.08;vec4 mv=uView*vec4(p,1.0);gl_Position=uProjection*mv;gl_PointSize=aSize*(180.0/max(1.0,-mv.z));}`;
  CrystalRenderer.pointFS=`precision mediump float;uniform float uOpacity;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.05,d)*uOpacity;gl_FragColor=vec4(.12,.52,1.0,a);}`;

  let renderer = null;
  try {
    renderer = new CrystalRenderer(canvas);
    doc.documentElement.classList.add('webgl-ready');
  } catch (error) {
    console.error('NCR Portfolio 3D:', error);
    if (fallback) fallback.hidden = false;
    canvas?.setAttribute('hidden', '');
  }

  addEventListener('resize', () => renderer?.resize(), { passive:true });
  doc.addEventListener('visibilitychange', () => { state.running = !doc.hidden; });

  function animationFrame(now) {
    const dt = Math.min(.05, (now - state.lastTime) / 1000);
    state.lastTime = now;
    state.progress += (state.targetProgress - state.progress) * (reducedMotion ? 1 : Math.min(1, dt * 7.5));
    state.smoothPointerX += (state.pointerX - state.smoothPointerX) * Math.min(1, dt * 3.5);
    state.smoothPointerY += (state.pointerY - state.smoothPointerY) * Math.min(1, dt * 3.5);
    applyScenes(state.progress);
    if (state.running) renderer?.render(now / 1000, state.progress);
    requestAnimationFrame(animationFrame);
  }
  requestAnimationFrame(animationFrame);

  /* ------------------------------------------------------------------
     Reveal, filters and project dialog
  ------------------------------------------------------------------ */
  const revealItems=[...doc.querySelectorAll('.reveal')];
  if('IntersectionObserver' in window && !reducedMotion){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.13,rootMargin:'0px 0px -6% 0px'});
    revealItems.forEach(item=>observer.observe(item));
  }else revealItems.forEach(item=>item.classList.add('is-visible'));

  const filters=[...doc.querySelectorAll('[data-filter]')];
  const cards=[...doc.querySelectorAll('[data-category]')];
  filters.forEach(button=>button.addEventListener('click',()=>{
    const filter=button.dataset.filter;
    filters.forEach(item=>{const active=item===button;item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active));});
    cards.forEach(card=>{const cats=(card.dataset.category||'').split(' ');card.hidden=filter!=='all'&&!cats.includes(filter);});
  }));

  const projectData={
    suite:{title:'NCR Suite',lead:'Une plateforme SaaS multi-métier conçue pour réunir les opérations, les documents et le pilotage dans une expérience unique.',challenge:'Rendre lisibles des processus riches sans multiplier les outils ni noyer l’utilisateur sous les fonctionnalités.',approach:'Architecture modulaire, rôles dédiés, parcours guidés et composants réutilisables.',gallery:[['assets/portfolio/ncr-suite-dashboard.webp','Dashboard métier'],['assets/portfolio/ncr-suite-login.webp','Écran de connexion']]},
    sentinelle:{title:'Sentinelle Pro',lead:'Une PWA opérationnelle reliant les agents sur le terrain et le centre de commandement.',challenge:'Permettre l’accès rapide aux missions, alertes, sites et actions critiques dans un environnement mobile.',approach:'Priorisation visuelle, carte opérationnelle, gros points de contact et supervision temps réel.',gallery:[['assets/portfolio/sentinelle-dashboard.webp','Dashboard QG'],['assets/portfolio/sentinelle-menu.webp','Menu opérationnel']]},
    sst:{title:'Application SST NCR Solutions',lead:'Une application mobile dédiée à la formation et à la révision SST.',challenge:'Faciliter l’entraînement, la reprise de progression et les quiz depuis un smartphone.',approach:'Entrées courtes, cartes thématiques, contraste fort et expérience tactile.',gallery:[['assets/portfolio/sst-home.webp','Accueil'],['assets/portfolio/sst-modules.webp','Modules'],['assets/portfolio/sst-quiz.webp','Quiz']]},
    azzera:{title:'Sites internet Azzera',lead:'Un écosystème de sites vitrines pour Azzera Invest, Azzera Services+ et Azzera Academy.',challenge:'Donner une identité propre à chaque entité sans perdre la cohérence du groupe.',approach:'Structure éditoriale commune, palettes dédiées et composants adaptés à chaque univers.',gallery:[['assets/portfolio/azzera-invest.webp','Azzera Invest'],['assets/portfolio/azzera-services.webp','Azzera Services+'],['assets/portfolio/azzera-academy.webp','Azzera Academy']]}
  };
  const dialog=doc.querySelector('[data-project-dialog]');
  const dialogTitle=doc.querySelector('[data-dialog-title]');
  const dialogLead=doc.querySelector('[data-dialog-lead]');
  const dialogChallenge=doc.querySelector('[data-dialog-challenge]');
  const dialogApproach=doc.querySelector('[data-dialog-approach]');
  const dialogGallery=doc.querySelector('[data-dialog-gallery]');
  let lastFocus=null;
  function openDialog(key,trigger){
    const data=projectData[key];if(!dialog||!data)return;lastFocus=trigger||doc.activeElement;
    dialogTitle.textContent=data.title;dialogLead.textContent=data.lead;dialogChallenge.textContent=data.challenge;dialogApproach.textContent=data.approach;
    dialogGallery.innerHTML=data.gallery.map(([src,caption])=>`<figure><img src="${src}" alt="${caption}" loading="lazy"><figcaption>${caption}</figcaption></figure>`).join('');
    dialog.showModal();doc.body.classList.add('dialog-open');dialog.querySelector('.dialog-close')?.focus();
  }
  function closeDialog(){if(!dialog?.open)return;dialog.close();doc.body.classList.remove('dialog-open');lastFocus?.focus?.();}
  doc.querySelectorAll('[data-open-project]').forEach(button=>button.addEventListener('click',()=>openDialog(button.dataset.openProject,button)));
  doc.querySelectorAll('[data-close-dialog]').forEach(button=>button.addEventListener('click',closeDialog));
  dialog?.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
  dialog?.addEventListener('click',event=>{if(event.target===dialog)closeDialog();});
})();
