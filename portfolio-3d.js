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
  const robotStage = doc.querySelector('[data-robot-stage]');
  const robotScreen = doc.querySelector('[data-robot-screen]');
  const showroomCards = [...doc.querySelectorAll('[data-showroom-step]')];
  const showroomRailItems = [...doc.querySelectorAll('.showroom-rail span')];
  const revealCards = [...doc.querySelectorAll('[data-reveal-project]')];
  const revealDots = [...doc.querySelectorAll('.reveal-dots i')];
  const passageTags = [...doc.querySelectorAll('.passage-tags span')];
  const skillsMarquee = doc.querySelector('.skills-marquee');
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
    running: true,
    journeyVisible: true,
    lastClipProgress: -1,
    qualityScale: 1,
    slowFrames: 0,
    lastRenderNow: 0,
    snapAnimating: false,
    snapProgrammatic: false,
    wheelAccumulator: 0,
    scrollIdleTimer: 0,
    touchStartY: 0,
    touchStartProgress: 0
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

  function applyRobotDive(progress) {
    if (!robotStage || !robotScreen || !canvas) return;

    /*
      Trois temps distincts :
      1. le robot rejoint calmement l'axe de lecture ;
      2. son écran vient précisément au centre de la fenêtre ;
      3. seul le portail s'étend, le robot n'est plus sur-zoomé.
    */
    const settle = smoothstep(.045, .135, progress);
    const focus = smoothstep(.12, .245, progress);
    const portal = smoothstep(.215, .355, progress);
    const disappear = smoothstep(.265, .34, progress);
    const idle = 1 - focus;

    const stageWidth = robotStage.offsetWidth || 400;
    const stageHeight = robotStage.offsetHeight || 626;
    const screenCenterX = .321 + .442 / 2;
    const screenCenterY = .5845 + .1835 / 2;
    const centeredShiftX = -(screenCenterX - .5) * stageWidth;
    const centeredShiftY = -(screenCenterY - .5) * stageHeight;

    const initialShiftX = innerWidth < 640 ? 0 : Math.min(innerWidth * .23, 330);
    const initialShiftY = innerWidth < 640 ? innerHeight * .01 : innerHeight * .04;
    const settleShiftX = lerp(initialShiftX, initialShiftX * .34, easeInOut(settle));
    const settleShiftY = lerp(initialShiftY, initialShiftY * .22, easeInOut(settle));
    const shiftX = lerp(settleShiftX, centeredShiftX, easeInOut(focus));
    const shiftY = lerp(settleShiftY, centeredShiftY, easeInOut(focus));

    const focusScale = innerWidth < 560 ? 2.02 : innerWidth < 900 ? 1.88 : 1.72;
    const scale = lerp(1, 1.18, easeInOut(settle)) * lerp(1, focusScale / 1.18, easeInOut(focus));
    const tiltX = state.smoothPointerY * .85 * idle;
    const tiltY = state.smoothPointerX * 1.05 * idle;

    robotStage.style.setProperty('--robot-scale', scale.toFixed(4));
    robotStage.style.setProperty('--robot-rx', `${tiltX.toFixed(3)}deg`);
    robotStage.style.setProperty('--robot-ry', `${tiltY.toFixed(3)}deg`);
    robotStage.style.setProperty('--robot-opacity', String(1 - disappear));
    robotStage.style.setProperty('--robot-shift-x', `${shiftX.toFixed(2)}px`);
    robotStage.style.setProperty('--robot-shift-y', `${shiftY.toFixed(2)}px`);
    robotStage.style.setProperty('--screen-enter', focus.toFixed(4));

    if (Math.abs(progress - state.lastClipProgress) > .0002 || state.lastClipProgress < 0) {
      const rect = robotScreen.getBoundingClientRect();
      const top = lerp(clamp(rect.top, 0, innerHeight), 0, portal);
      const right = lerp(clamp(innerWidth - rect.right, 0, innerWidth), 0, portal);
      const bottom = lerp(clamp(innerHeight - rect.bottom, 0, innerHeight), 0, portal);
      const left = lerp(clamp(rect.left, 0, innerWidth), 0, portal);
      const radius = lerp(Math.min(rect.width, rect.height) * .055, 0, portal);
      canvas.style.clipPath = `inset(${top.toFixed(2)}px ${right.toFixed(2)}px ${bottom.toFixed(2)}px ${left.toFixed(2)}px round ${radius.toFixed(2)}px)`;
      canvas.style.opacity = String(smoothstep(.06, .18, progress) * (1 - smoothstep(.985, 1, progress) * .84));
      state.lastClipProgress = progress;
    }
  }

  function applyScenes(progress) {
    const heroOpacity = 1 - smoothstep(.12, .255, progress);
    const passageOpacity = smoothstep(.255, .325, progress) * (1 - smoothstep(.445, .505, progress));
    const showroomOpacity = smoothstep(.455, .515, progress) * (1 - smoothstep(.785, .825, progress));
    const revealOpacity = smoothstep(.775, .825, progress) * (1 - smoothstep(.997, 1, progress));
    const values = [heroOpacity, passageOpacity, showroomOpacity, revealOpacity];

    scenes.forEach((scene, index) => {
      const opacity = values[index] || 0;
      scene.style.opacity = opacity.toFixed(3);
      scene.style.visibility = opacity > .02 ? 'visible' : 'hidden';
      scene.classList.toggle('is-active', opacity > .42);
      const anchors = [.10, .36, .64, .89];
      const drift = (progress - anchors[index]) * -24;
      scene.style.transform = `translate3d(0, ${drift.toFixed(2)}px, 0)`;
    });

    passageTags.forEach((tag, index) => {
      const local = smoothstep(.30 + index * .018, .365 + index * .018, progress) * (1 - smoothstep(.43, .49, progress));
      tag.style.opacity = local.toFixed(3);
      tag.style.transform = `translate3d(0, ${(1-local)*10}px, 0)`;
    });

    /* Quatre stations : chaque point d'arrêt correspond au centre d'une carte. */
    const showroomWindow = smoothstep(.46,.515,progress) * (1-smoothstep(.79,.83,progress));
    const showroomFlow = clamp((progress-.515)/.27);
    const showroomFloat = showroomFlow * Math.max(1, showroomCards.length - 1);
    const showroomActive = Math.min(showroomCards.length-1, Math.round(showroomFloat));
    showroomCards.forEach((card,index)=>{
      const active=index===showroomActive;
      const direction=index<showroomActive?-1:1;
      const opacity=active?showroomWindow:0;
      card.style.opacity=opacity.toFixed(3);
      card.style.visibility=opacity>.025?'visible':'hidden';
      card.style.zIndex=active?'10':'1';
      card.style.transform=active?'translate3d(0,0,0) scale(1)'
        :`translate3d(${direction*34}px,20px,0) scale(.94)`;
      card.classList.toggle('is-focus',active);
    });
    showroomRailItems.forEach((item,index)=>item.classList.toggle('is-active',index===showroomActive));

    /* Les projets disposent maintenant d'une vraie plage d'exposition. */
    const revealWindow=smoothstep(.78,.825,progress)*(1-smoothstep(.997,1,progress));
    const revealFlow=clamp((progress-.815)/.175);
    const revealFloat=revealFlow*Math.max(1,revealCards.length-1);
    const revealActive=Math.min(revealCards.length-1,Math.round(revealFloat));
    revealCards.forEach((card,index)=>{
      const active=index===revealActive;
      const direction=index<revealActive?-1:1;
      const opacity=active?revealWindow:0;
      card.style.opacity=opacity.toFixed(3);
      card.style.visibility=opacity>.02?'visible':'hidden';
      card.style.zIndex=active?'20':'1';
      card.style.transform=active?'translate3d(0,0,0) scale(1)'
        :`translate3d(${direction*26}%,20px,0) scale(.93)`;
      card.classList.toggle('is-focus',active);
    });
    revealDots.forEach((dot,index)=>dot.classList.toggle('is-active',index===revealActive));

    applyRobotDive(progress);

    const chapterStops = [
      { p:0, label:'01 — ENTRÉE' },
      { p:.36, label:'02 — PASSAGE' },
      { p:.535, label:'03 — OBSERVER' },
      { p:.62, label:'04 — STRUCTURER' },
      { p:.705, label:'05 — CONSTRUIRE' },
      { p:.785, label:'06 — AFFINER' },
      { p:.825, label:'07 — NCR SUITE' },
      { p:.88, label:'08 — SENTINELLE' },
      { p:.935, label:'09 — SST' },
      { p:.985, label:'10 — AZZERA' }
    ];
    let currentChapter = chapterStops[0];
    chapterStops.forEach((chapter) => { if (progress >= chapter.p - .018) currentChapter = chapter; });
    if (sceneIndex) sceneIndex.textContent = currentChapter.label;
    if (journeyBar) journeyBar.style.height = `${progress * 100}%`;
    header?.classList.toggle('is-immersive', progress > .13 && progress < .93);
    header?.classList.toggle('is-deep', progress > .255 && progress < .79);
    if (skillsMarquee) {
      const quiet = smoothstep(.13,.22,progress) * (1 - smoothstep(.80,.91,progress));
      skillsMarquee.style.setProperty('--marquee-opacity', String(1-quiet));
      skillsMarquee.style.opacity = String(1-quiet);
      skillsMarquee.style.transform = `translateY(${(quiet*18).toFixed(2)}px)`;
      skillsMarquee.style.visibility = quiet>.96?'hidden':'visible';
    }
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
     Chapitrage du scroll
     - molette / trackpad : un geste = un chapitre
     - tactile : repositionnement doux après le geste
     - clavier : flèches, espace et PageUp/PageDown
  ------------------------------------------------------------------ */
  const journeyStops = [0, .36, .535, .62, .705, .785, .825, .88, .935, .985, 1];

  function journeyMetrics() {
    if (!journey) return null;
    const top = journey.getBoundingClientRect().top + scrollY;
    const range = Math.max(1, journey.offsetHeight - innerHeight);
    return { top, range, bottom: top + range };
  }

  function isJourneyScrollActive() {
    const metrics = journeyMetrics();
    if (!metrics) return false;
    return scrollY >= metrics.top - 2 && scrollY <= metrics.bottom + 2;
  }

  function nearestStopIndex(progress) {
    let best = 0;
    let distance = Infinity;
    journeyStops.forEach((stop,index)=>{
      const d=Math.abs(stop-progress);
      if(d<distance){distance=d;best=index;}
    });
    return best;
  }

  function scrollToJourneyProgress(targetProgress, duration = 820) {
    const metrics = journeyMetrics();
    if (!metrics || state.snapAnimating) return;
    const startY = scrollY;
    const targetY = metrics.top + clamp(targetProgress) * metrics.range;
    const distance = Math.abs(targetY - startY);
    if (distance < 2) return;
    const start = performance.now();
    const resolvedDuration = clamp(duration + distance * .025, 620, 1080);
    state.snapAnimating = true;
    state.snapProgrammatic = true;

    const tick = (now) => {
      const t = clamp((now-start)/resolvedDuration);
      const eased = t < .5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
      scrollTo(0, lerp(startY,targetY,eased));
      if(t<1){requestAnimationFrame(tick);return;}
      scrollTo(0,targetY);
      state.snapAnimating=false;
      requestAnimationFrame(()=>{state.snapProgrammatic=false;updateScrollTarget();});
    };
    requestAnimationFrame(tick);
  }

  function moveJourneyChapter(direction) {
    if (!isJourneyScrollActive() || state.snapAnimating) return false;
    const progress = readProgress();
    const epsilon = .012;
    let targetIndex = -1;
    if (direction > 0) targetIndex = journeyStops.findIndex((stop) => stop > progress + epsilon);
    else {
      for (let i=journeyStops.length-1;i>=0;i--) {
        if (journeyStops[i] < progress - epsilon) { targetIndex=i; break; }
      }
    }
    if (targetIndex < 0) return false;
    scrollToJourneyProgress(journeyStops[targetIndex], direction > 0 ? 820 : 760);
    return true;
  }

  addEventListener('wheel',(event)=>{
    if(reducedMotion || !isJourneyScrollActive() || event.ctrlKey || event.metaKey) return;
    const progress=readProgress();
    const direction=Math.sign(event.deltaY);
    if((direction<0 && progress<=.002) || (direction>0 && progress>=.998)) return;
    event.preventDefault();
    if(state.snapAnimating) return;
    state.wheelAccumulator += event.deltaY;
    const threshold = event.deltaMode===1 ? 3 : 34;
    if(Math.abs(state.wheelAccumulator)<threshold) return;
    const moveDirection=Math.sign(state.wheelAccumulator);
    state.wheelAccumulator=0;
    moveJourneyChapter(moveDirection);
  },{passive:false});

  addEventListener('keydown',(event)=>{
    if(!isJourneyScrollActive() || state.snapAnimating || /INPUT|TEXTAREA|SELECT/.test(doc.activeElement?.tagName||'')) return;
    let direction=0;
    if(['ArrowDown','PageDown'].includes(event.key) || (event.key===' '&&!event.shiftKey)) direction=1;
    if(['ArrowUp','PageUp'].includes(event.key) || (event.key===' '&&event.shiftKey)) direction=-1;
    if(!direction) return;
    if(moveJourneyChapter(direction)) event.preventDefault();
  });

  addEventListener('touchstart',(event)=>{
    if(!isJourneyScrollActive() || !event.touches?.length) return;
    state.touchStartY=event.touches[0].clientY;
    state.touchStartProgress=readProgress();
  },{passive:true});

  addEventListener('touchend',(event)=>{
    if(!isJourneyScrollActive() || state.snapAnimating || !event.changedTouches?.length) return;
    const delta=state.touchStartY-event.changedTouches[0].clientY;
    if(Math.abs(delta)<28) return;
    const startIndex=nearestStopIndex(state.touchStartProgress);
    const targetIndex=clamp(startIndex+(delta>0?1:-1),0,journeyStops.length-1);
    setTimeout(()=>scrollToJourneyProgress(journeyStops[targetIndex],780),35);
  },{passive:true});

  /* Sur les navigateurs sans geste intercepté, le scroll se recale au repos. */
  addEventListener('scroll',()=>{
    if(reducedMotion || state.snapAnimating || state.snapProgrammatic || !isJourneyScrollActive()) return;
    clearTimeout(state.scrollIdleTimer);
    state.scrollIdleTimer=setTimeout(()=>{
      if(state.snapAnimating || !isJourneyScrollActive()) return;
      const progress=readProgress();
      if(progress<.006 || progress>.994) return;
      const index=nearestStopIndex(progress);
      if(Math.abs(journeyStops[index]-progress)>.012) scrollToJourneyProgress(journeyStops[index],650);
    },coarsePointer?190:135);
  },{passive:true});

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

  function ellipsePath(width, height, segments = 56) {
    const points = [];
    const rx = width / 2, ry = height / 2;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push([Math.cos(angle) * rx, Math.sin(angle) * ry, 0]);
    }
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
      const qualitySegments = coarsePointer ? 7 : 9;
      const screenPath = roundedRectPath(5.4, 3.35, .58, qualitySegments);
      const archPath = roundedRectPath(7.2, 4.45, 1.28, qualitySegments);
      const ellipse = ellipsePath(5.6, 3.35, coarsePointer ? 34 : 46);

      this.uploadGeometry('screenSilver', createTubeGeometry(screenPath, .075, qualitySegments));
      this.uploadGeometry('screenGlass', createTubeGeometry(screenPath, .16, qualitySegments));
      this.uploadGeometry('screenBlue', createTubeGeometry(screenPath, .022, coarsePointer ? 6 : 7));
      this.uploadGeometry('archSilver', createTubeGeometry(archPath, .028, qualitySegments));
      this.uploadGeometry('archGlass', createTubeGeometry(archPath, .060, qualitySegments));
      this.uploadGeometry('ellipseSilver', createTubeGeometry(ellipse, .042, qualitySegments));
      this.uploadGeometry('ellipseGlass', createTubeGeometry(ellipse, .086, qualitySegments));
      this.uploadGeometry('ellipseBlue', createTubeGeometry(ellipse, .022, coarsePointer ? 6 : 7));
      this.uploadGeometry('box', createBoxGeometry());
      this.uploadGeometry('sphere', createSphereGeometry(1, coarsePointer ? 7 : 9, coarsePointer ? 10 : 13));

      const silver={kind:0,color:[.93,.95,.975],opacity:.36};
      const glass={kind:1,color:[.93,.982,1],opacity:.105};
      const blue={kind:2,color:[.035,.44,1],opacity:.17};
      const white={kind:0,color:[.995,.997,1],opacity:.54};

      // 1. The first three frames preserve the exact landscape shape of the belly screen.
      for (let i=0;i<2;i++) {
        const z=-.85-i*1.55;
        const scale=1+i*.018;
        const range=[.08,.325];
        this.addObject('screenGlass',{kind:1,color:[.94,.985,1],opacity:.055},[0,0,z],[0,0,0],[scale,scale,scale],{portal:true,index:i,range});
        this.addObject('screenBlue',{kind:2,color:[.035,.44,1],opacity:.11},[0,0,z+.03],[0,0,0],[scale*.925,scale*.925,scale*.925],{portal:true,index:i,range});
      }

      // 2. A short, wide architectural corridor: fine glass, large spacing, no cyber clutter.
      const archCount=coarsePointer?3:5;
      for(let i=0;i<archCount;i++){
        const z=-6.4-i*3.15;
        const scale=.96+i*.008;
        const range=[.245,.62];
        this.addObject('archGlass',glass,[0,.02,z],[0,0,0],[scale,scale,scale],{tunnel:true,index:i,range});
        this.addObject('archSilver',i===0?white:silver,[0,.02,z-.04],[0,0,0],[scale*.982,scale*.982,scale*.982],{tunnel:true,index:i,range});
      }

      // Satin floor, only visible during the passage and showroom.
      this.addObject('box',white,[0,-2.30,-15.0],[0,0,0],[4.05,.018,10.8],{floor:true,range:[.25,.84]});
      this.addObject('box',glass,[0,-2.26,-15.0],[0,0,0],[3.88,.012,10.6],{floor:true,range:[.25,.84]});

      // Architectural glass fins: sparse, slightly angled, and never neon-heavy.
      const finCount=coarsePointer?2:3;
      for(let i=0;i<finCount;i++){
        const z=-8.8-i*4.0;
        const range=[.31,.72];
        this.addObject('box',glass,[-3.68,.02,z],[0,.08,0],[.018,1.95,.42],{fin:true,index:i,range});
        this.addObject('box',glass,[3.68,.02,z],[0,-.08,0],[.018,1.95,.42],{fin:true,index:i+finCount,range});
      }

      // 3. A calm showroom: one distant glass frame and four understated plinth stations.
      for(let i=0;i<2;i++){
        const z=-22.8-i*.65;
        const scale=1+i*.045;
        const range=[.48,.86];
        this.addObject('ellipseGlass',glass,[1.15,.05,z],[0,0,0],[scale,scale,scale],{showroom:true,index:i,range});
        this.addObject('ellipseSilver',i===0?white:silver,[1.15,.05,z-.04],[0,0,0],[scale*.98,scale*.98,scale*.98],{showroom:true,index:i,range});
      }

      const plinths=[[-1.75,-2.10,-23.9],[-.05,-2.06,-24.45],[1.65,-2.06,-24.45],[3.35,-2.10,-23.9]];
      plinths.forEach((position,index)=>{
        const range=[.51,.86];
        this.addObject('sphere',index===1||index===2?white:silver,position,[0,0,0],[.68,.09,.68],{plinth:true,index,range});
        this.addObject('sphere',glass,[position[0],position[1]+.055,position[2]],[0,0,0],[.59,.06,.59],{plinth:true,index:index+4,range});
      });
      this.addObject('sphere',blue,[1.15,-.72,-24.45],[0,0,0],[.10,.10,.10],{node:true,index:1,range:[.55,.86]});
      this.addObject('sphere',glass,[1.15,-.72,-24.45],[0,0,0],[.25,.25,.25],{node:true,index:2,halo:true,range:[.55,.86]});

      // 4. Calm exit platform that visually hands the story to real HTML project cards.
      this.addObject('ellipseSilver',silver,[0,-2.2,-30.2],[1.46,0,0],[1.02,.82,1],{platform:true,range:[.72,1]});
      this.addObject('ellipseGlass',glass,[0,-2.14,-30.15],[1.46,0,0],[.90,.70,1],{platform:true,range:[.72,1]});
      this.addObject('ellipseBlue',blue,[0,-2.08,-30.10],[1.46,0,0],[.72,.54,1],{platform:true,range:[.76,1]});
      this.addObject('sphere',blue,[0,-1.92,-30.1],[0,0,0],[.11,.11,.11],{platform:true,node:true,index:8,range:[.76,1]});

      const railPositions=[
        -2.35,-2.72,-4.8, -2.35,-2.72,-29.5,
         2.35,-2.72,-4.8,  2.35,-2.72,-29.5,
         0,-2.70,-5.0, 0,-2.70,-29.2
      ];
      this.lines.push(this.uploadLine(railPositions,[.12,.52,1],.22,[.25,.91]));
      this.buildParticles();
      this.glassObjects=this.objects.filter(o=>o.material.kind===1).sort((a,b)=>a.basePosition[2]-b.basePosition[2]);
    }

    uploadLine(positions,color,opacity,range=[0,1]){
      const gl=this.gl,buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(positions),gl.STATIC_DRAW);
      return{buffer,count:positions.length/3,color,opacity,range};
    }

    buildParticles(){
      const gl=this.gl,positions=[],sizes=[];
      const count=coarsePointer?12:28;
      let seed=12931;
      const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
      for(let i=0;i<count;i++){
        const a=random()*Math.PI*2,r=2.75+random()*1.95,z=2-random()*34;
        positions.push(Math.cos(a)*r,(Math.sin(a)*r)*.68,z);sizes.push(.75+random()*1.45);
      }
      const position=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,position);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(positions),gl.STATIC_DRAW);
      const size=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,size);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(sizes),gl.STATIC_DRAW);
      this.points={position,size,count};
    }

    resize(){
      const dpr=Math.min(devicePixelRatio||1,(coarsePointer?.92:1.12)*state.qualityScale);
      const width=Math.max(1,Math.floor(this.canvas.clientWidth*dpr));
      const height=Math.max(1,Math.floor(this.canvas.clientHeight*dpr));
      if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;this.gl.viewport(0,0,width,height);}
      this.aspect=width/height;
    }

    updateCamera(progress){
      let z;
      if(progress<.16) z=11.35;
      else if(progress<.31) z=lerp(11.35,2.3,easeInOut((progress-.16)/.15));
      else if(progress<.53) z=lerp(2.3,-10.7,easeInOut((progress-.31)/.22));
      else if(progress<.78) z=lerp(-10.7,-18.0,easeInOut((progress-.53)/.25));
      else z=lerp(-18.0,-29.15,easeInOut((progress-.78)/.22));

      const pointerInfluence=1-smoothstep(.17,.38,progress);
      const showroomCurve=smoothstep(.52,.68,progress)*(1-smoothstep(.76,.86,progress));
      const x=.26*showroomCurve+state.smoothPointerX*.12*pointerInfluence;
      const y=.04*showroomCurve+state.smoothPointerY*.07*pointerInfluence;
      const targetZ=progress<.17?0:z-7.2;
      this.camera.eye=[x,y,z];
      this.camera.target=[x*.06,y*.06,targetZ];
    }

    updateObjects(time,progress){
      this.objects.forEach((obj)=>{
        obj.position[0]=obj.basePosition[0];obj.position[1]=obj.basePosition[1];obj.position[2]=obj.basePosition[2];
        obj.rotation[0]=obj.baseRotation[0];obj.rotation[1]=obj.baseRotation[1];obj.rotation[2]=obj.baseRotation[2];
        obj.scale[0]=obj.baseScale[0];obj.scale[1]=obj.baseScale[1];obj.scale[2]=obj.baseScale[2];
        if(obj.meta.portal){
          const pulse=1+Math.sin(time*.42+obj.meta.index*.7)*.0025;
          obj.scale=obj.baseScale.map(v=>v*pulse);
        }
        if(obj.meta.tunnel){
          obj.position[1]+=Math.sin(time*.28+obj.meta.index*.55)*.012;
        }
        if(obj.meta.showroom){
          obj.position[1]+=Math.sin(time*.24+obj.meta.index*.8)*.018;
        }
        if(obj.meta.node){
          obj.position[1]+=Math.sin(time*.75+obj.meta.index)*.045;
          if(obj.meta.halo){const s=1+Math.sin(time*.8+obj.meta.index)*.06;obj.scale=obj.baseScale.map(v=>v*s);}
        }
      });
    }

    visibilityFor(meta,progress){
      const range=meta?.range||[0,1];
      const fade=Math.min(.085,Math.max(.035,(range[1]-range[0])*.22));
      return smoothstep(range[0],range[0]+fade,progress)*(1-smoothstep(range[1]-fade,range[1],progress));
    }

    drawMeshObject(obj,view,projection,time,pass,progress){
      const gl=this.gl,geo=this.geometries[obj.geometry],loc=this.meshLocations,mat=obj.material;
      const visibility=this.visibilityFor(obj.meta,progress);
      if(visibility<.002)return;
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
      gl.uniform3fv(loc.camera,new Float32Array(this.camera.eye));gl.uniform3fv(loc.color,new Float32Array(mat.color));gl.uniform1i(loc.material,mat.kind);gl.uniform1f(loc.opacity,mat.opacity*visibility);gl.uniform1f(loc.time,time);
      gl.drawElements(gl.TRIANGLES,geo.count,geo.type,0);
    }

    render(time,progress){
      this.resize();this.updateCamera(progress);this.updateObjects(time,progress);
      const gl=this.gl;gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const projection=M4.perspective((coarsePointer?49:43)*Math.PI/180,this.aspect,.08,90);
      const view=M4.lookAt(this.camera.eye,this.camera.target);

      gl.disable(gl.BLEND);gl.depthMask(true);gl.enable(gl.CULL_FACE);
      this.objects.forEach(o=>this.drawMeshObject(o,view,projection,time,'opaque',progress));

      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);gl.disable(gl.CULL_FACE);
      this.objects.forEach(o=>this.drawMeshObject(o,view,projection,time,'blue',progress));
      this.drawLines(view,projection,progress);
      this.drawPoints(view,projection,time,progress);

      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.disable(gl.CULL_FACE);
      (this.glassObjects||this.objects.filter(o=>o.material.kind===1)).forEach(o=>this.drawMeshObject(o,view,projection,time,'glass',progress));
      gl.depthMask(true);
    }

    drawLines(view,projection,progress){
      const gl=this.gl,loc=this.lineLocations;
      gl.useProgram(this.lineProgram);gl.uniformMatrix4fv(loc.view,false,view);gl.uniformMatrix4fv(loc.projection,false,projection);
      this.lines.forEach(line=>{
        const range=line.range||[0,1];
        const visibility=smoothstep(range[0],range[0]+.08,progress)*(1-smoothstep(range[1]-.08,range[1],progress));
        if(visibility<.002)return;
        gl.bindBuffer(gl.ARRAY_BUFFER,line.buffer);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,0,0);gl.uniform3fv(loc.color,new Float32Array(line.color));gl.uniform1f(loc.opacity,line.opacity*visibility);gl.drawArrays(gl.LINES,0,line.count);
      });
    }

    drawPoints(view,projection,time,progress){
      if(!this.points)return;
      const visibility=smoothstep(.28,.42,progress)*(1-smoothstep(.91,.99,progress));
      if(visibility<.002)return;
      const gl=this.gl,loc=this.pointLocations;gl.useProgram(this.pointProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.points.position);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.points.size);gl.enableVertexAttribArray(loc.size);gl.vertexAttribPointer(loc.size,1,gl.FLOAT,false,0,0);
      gl.uniformMatrix4fv(loc.view,false,view);gl.uniformMatrix4fv(loc.projection,false,projection);gl.uniform1f(loc.time,time);gl.uniform1f(loc.opacity,.065*visibility);gl.drawArrays(gl.POINTS,0,this.points.count);
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
      vec3 l1=normalize(vec3(-.28,.78,.55));vec3 l2=normalize(vec3(.72,-.14,.62));
      float d1=max(dot(n,l1),0.0),d2=max(dot(n,l2),0.0);
      float fres=pow(1.0-max(dot(n,v),0.0),2.55);
      float spec1=pow(max(dot(reflect(-l1,n),v),0.0),82.0);
      float spec2=pow(max(dot(reflect(-l2,n),v),0.0),40.0);
      vec3 blue=vec3(.035,.44,1.0);
      vec3 col;float alpha=uOpacity;
      if(uMaterial==0){
        col=uColor*(.80+d1*.16+d2*.06)+vec3(1.0)*(spec1*.72+spec2*.18)+blue*fres*.055;
      }else if(uMaterial==1){
        col=mix(vec3(.96,.98,1.0),blue,.025+fres*.13)+vec3(1.0)*(spec1*.82+spec2*.20);
        alpha=uOpacity*(.06+fres*.42+spec1*.11);
      }else{
        col=mix(blue,vec3(.42,.73,1.0),.22)*(1.05+d1*.22)+vec3(.72,.9,1.0)*spec1;
        alpha=uOpacity*(.58+fres*.26);
      }
      gl_FragColor=vec4(col,clamp(alpha,0.0,1.0));
    }
  `;
  CrystalRenderer.lineVS=`attribute vec3 aPosition;uniform mat4 uView,uProjection;void main(){gl_Position=uProjection*uView*vec4(aPosition,1.0);}`;
  CrystalRenderer.lineFS=`precision mediump float;uniform vec3 uColor;uniform float uOpacity;void main(){gl_FragColor=vec4(uColor,uOpacity);}`;
  CrystalRenderer.pointVS=`attribute vec3 aPosition;attribute float aSize;uniform mat4 uView,uProjection;uniform float uTime;void main(){vec3 p=aPosition;p.y+=sin(uTime*.6+aPosition.z)*.08;vec4 mv=uView*vec4(p,1.0);gl_Position=uProjection*mv;gl_PointSize=aSize*(180.0/max(1.0,-mv.z));}`;
  CrystalRenderer.pointFS=`precision mediump float;uniform float uOpacity;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.08,d)*uOpacity;gl_FragColor=vec4(.38,.68,1.0,a);}`;

  let renderer = null;
  try {
    renderer = new CrystalRenderer(canvas);
    doc.documentElement.classList.add('webgl-ready');
  } catch (error) {
    console.error('NCR Portfolio 3D:', error);
    if (fallback) fallback.hidden = false;
    canvas?.setAttribute('hidden', '');
  }

  addEventListener('resize', () => { state.lastClipProgress=-1; renderer?.resize(); }, { passive:true });
  doc.addEventListener('visibilitychange', () => { state.running = !doc.hidden; });
  if ('IntersectionObserver' in window && journey) {
    const journeyObserver = new IntersectionObserver(([entry]) => { state.journeyVisible = entry.isIntersecting; }, { rootMargin:'120px 0px' });
    journeyObserver.observe(journey);
  }


  function animationFrame(now) {
    const rawDt = (now - state.lastTime) / 1000;
    const dt = Math.min(.05, rawDt);
    state.lastTime = now;
    state.progress += (state.targetProgress - state.progress) * (reducedMotion ? 1 : Math.min(1, dt * 8.5));
    state.smoothPointerX += (state.pointerX - state.smoothPointerX) * Math.min(1, dt * 3.2);
    state.smoothPointerY += (state.pointerY - state.smoothPointerY) * Math.min(1, dt * 3.2);
    applyScenes(state.progress);

    if (state.running && state.journeyVisible) {
      const renderInterval = coarsePointer ? 1000 / 36 : state.qualityScale < .8 ? 1000 / 45 : 0;
      if (!renderInterval || now - state.lastRenderNow >= renderInterval) {
        renderer?.render(now / 1000, state.progress);
        state.lastRenderNow = now;
      }
      // Automatic quality fallback on slower machines, without changing layout.
      if (rawDt > .027) state.slowFrames++; else state.slowFrames=Math.max(0,state.slowFrames-2);
      if (state.slowFrames > 50 && state.qualityScale > .76) {
        state.qualityScale=.72;
        state.slowFrames=0;
        renderer?.resize();
        doc.documentElement.classList.add('reduced-webgl-quality');
      }
    }
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
    suite:{title:'NCR Suite',lead:'Une plateforme SaaS multi-métier conçue pour centraliser pilotage, documents et parcours opérationnels.',challenge:'Rassembler des logiques métier différentes dans un produit unique sans perdre en clarté, en lisibilité ni en efficacité.',approach:'Architecture modulaire, design system cohérent, rôles dédiés et parcours guidés selon les usages.',value:'Une base solide pour structurer la production documentaire, le suivi d’activité et l’expérience utilisateur dans un même environnement.',tags:['SaaS','Plateforme métier','Dashboard','Documents','Formation'],gallery:[['assets/portfolio/ncr-suite-dashboard-real.png','Dashboard métier'],['assets/portfolio/ncr-suite-login-real.png','Écran de connexion']]},
    sentinelle:{title:'Sentinelle Pro',lead:'Une PWA opérationnelle pensée pour relier le QG, les missions et les agents de terrain.',challenge:'Offrir un accès rapide aux actions critiques tout en gardant une vue d’ensemble exploitable pour la supervision.',approach:'Priorisation visuelle, carte opérationnelle, navigation directe et interface sombre conçue pour l’usage métier.',value:'Une expérience métier plus directe pour surveiller, décider et agir sans friction dans un contexte opérationnel.',tags:['PWA','Sécurité','QG','Terrain','Supervision'],gallery:[['assets/portfolio/sentinelle-dashboard-real.png','Dashboard QG'],['assets/portfolio/sentinelle-menu-real.png','Menu opérationnel']]},
    sst:{title:'Application SST NCR Solutions',lead:'Une application mobile dédiée à la formation, à la révision et à l’entraînement SST.',challenge:'Rendre les contenus utiles et consultables rapidement sur mobile sans alourdir l’expérience.',approach:'Navigation simple, cartes thématiques, progression claire et quiz interactifs adaptés à l’usage tactile.',value:'Une solution compacte, pédagogique et utile pour garder les bons réflexes à portée de main.',tags:['Application mobile','SST','Quiz','Révision'],gallery:[['assets/portfolio/sst-home.webp','Accueil'],['assets/portfolio/sst-modules.webp','Modules'],['assets/portfolio/sst-quiz.webp','Quiz']]},
    azzera:{title:'Sites internet Azzera',lead:'Un écosystème de sites vitrines premium pour Azzera Invest, Azzera Services+ et Azzera Academy.',challenge:'Créer une cohérence de groupe tout en laissant à chaque entité sa personnalité, sa couleur et sa promesse.',approach:'Structure commune, palettes dédiées, hiérarchie éditoriale claire et composants ajustés selon chaque univers.',value:'Une présence digitale homogène à l’échelle du groupe, avec des identités distinctes et immédiatement lisibles.',tags:['Web','Groupe','Identité','Vitrine premium'],gallery:[['assets/portfolio/azzera-invest-real.png','Azzera Invest'],['assets/portfolio/azzera-services-real.png','Azzera Services+'],['assets/portfolio/azzera-academy-real.png','Azzera Academy']]}
  };
  const dialog=doc.querySelector('[data-project-dialog]');
  const dialogTitle=doc.querySelector('[data-dialog-title]');
  const dialogLead=doc.querySelector('[data-dialog-lead]');
  const dialogChallenge=doc.querySelector('[data-dialog-challenge]');
  const dialogApproach=doc.querySelector('[data-dialog-approach]');
  const dialogValue=doc.querySelector('[data-dialog-value]');
  const dialogTags=doc.querySelector('[data-dialog-tags]');
  const dialogGallery=doc.querySelector('[data-dialog-gallery]');
  let lastFocus=null;
  function openDialog(key,trigger){
    const data=projectData[key];if(!dialog||!data)return;lastFocus=trigger||doc.activeElement;
    dialogTitle.textContent=data.title;dialogLead.textContent=data.lead;dialogChallenge.textContent=data.challenge;dialogApproach.textContent=data.approach;
    if(dialogValue)dialogValue.textContent=data.value||'';
    if(dialogTags)dialogTags.innerHTML=(data.tags||[]).map(tag=>`<span>${tag}</span>`).join('');
    dialogGallery.innerHTML=data.gallery.map(([src,caption])=>`<figure><img src="${src}" alt="${caption}" loading="lazy"><figcaption>${caption}</figcaption></figure>`).join('');
    dialog.showModal();doc.body.classList.add('dialog-open');dialog.querySelector('.dialog-close')?.focus();
  }
  function closeDialog(){if(!dialog?.open)return;dialog.close();doc.body.classList.remove('dialog-open');lastFocus?.focus?.();}
  doc.querySelectorAll('[data-open-project]').forEach(button=>button.addEventListener('click',()=>openDialog(button.dataset.openProject,button)));
  doc.querySelectorAll('[data-close-dialog]').forEach(button=>button.addEventListener('click',closeDialog));
  dialog?.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
  dialog?.addEventListener('click',event=>{if(event.target===dialog)closeDialog();});
})();
