/* N.C.R Solutions — portfolio immersif WebGL + GSAP, avec secours natif. */
(() => {
  'use strict';

  const doc = document;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const canvas = doc.querySelector('[data-webgl-canvas]');
  const fallback = doc.querySelector('[data-webgl-fallback]');
  const journey = doc.querySelector('.journey');
  const stage = doc.querySelector('[data-journey-stage]');
  const pageProgress = doc.querySelector('[data-page-progress]');
  const journeyProgress = doc.querySelector('[data-journey-progress]');
  const sceneLabel = doc.querySelector('[data-scene-label]');
  const scenes = [...doc.querySelectorAll('[data-scene]')];
  const state = { progress: 0, pointerX: 0, pointerY: 0, smoothX: 0, smoothY: 0 };

  /* Navigation */
  const header = doc.querySelector('[data-header]');
  const navToggle = doc.querySelector('.nav-toggle');
  const nav = doc.querySelector('.main-nav');
  const closeNav = () => {
    navToggle?.setAttribute('aria-expanded', 'false');
    navToggle?.setAttribute('aria-label', 'Ouvrir le menu');
    nav?.classList.remove('is-open');
  };
  navToggle?.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') !== 'true';
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    nav?.classList.toggle('is-open', open);
  });
  nav?.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeNav));

  /* Page progress */
  const updateGlobalProgress = () => {
    const max = Math.max(1, doc.documentElement.scrollHeight - innerHeight);
    const value = Math.min(1, Math.max(0, scrollY / max));
    if (pageProgress) pageProgress.style.width = `${value * 100}%`;
    header?.classList.toggle('is-scrolled', scrollY > 20);
  };

  /* Project data and dialog */
  const projectData = {
    suite: {
      title: 'NCR Suite',
      lead: 'Une plateforme métier modulaire qui rassemble les opérations, les documents et les parcours de plusieurs activités dans une expérience unifiée.',
      challenge: 'Rendre lisibles des processus riches, répartis entre plusieurs rôles, sans transformer l’outil en catalogue de fonctionnalités.',
      approach: 'Architecture modulaire, design system transversal, tableaux de bord ciblés et parcours guidés selon le métier et le profil.',
      gallery: [
        ['assets/portfolio/ncr-suite-login.webp', 'Écran de connexion NCR Suite'],
        ['assets/portfolio/ncr-suite-dashboard.webp', 'Tableau de bord du module Formation']
      ]
    },
    sentinelle: {
      title: 'Sentinelle Pro',
      lead: 'Une PWA pensée pour connecter les agents de sécurité sur le terrain et le centre opérationnel en temps réel.',
      challenge: 'Donner accès aux fonctions critiques en quelques gestes et rendre la situation opérationnelle immédiatement compréhensible.',
      approach: 'Hiérarchie par criticité, carte temps réel, états explicites, interfaces tactiles et continuité d’usage sur mobile.',
      gallery: [
        ['assets/portfolio/sentinelle-dashboard.webp', 'Vue QG et carte opérationnelle'],
        ['assets/portfolio/sentinelle-menu.webp', 'Navigation du centre opérationnel']
      ]
    },
    sst: {
      title: 'Application SST NCR Solutions',
      lead: 'Une expérience mobile dédiée à la formation et à la révision SST, avec sessions live, modules, progression et quiz.',
      challenge: 'Faire de la révision une action simple à reprendre sur smartphone, sans perdre les repères pédagogiques essentiels.',
      approach: 'Gros points de contact, entrées courtes, cartes de modules et quiz visuels dans une interface sombre et très contrastée.',
      gallery: [
        ['assets/portfolio/sst-home.webp', 'Accueil et choix du mode'],
        ['assets/portfolio/sst-modules.webp', 'Parcours de révision'],
        ['assets/portfolio/sst-quiz.webp', 'Quiz interactif']
      ]
    },
    azzera: {
      title: 'Sites internet Azzera',
      lead: 'Un écosystème de sites vitrines pour Azzera Invest, Azzera Services+ et Azzera Academy.',
      challenge: 'Donner une identité propre à chaque entité tout en conservant une cohérence de groupe et des parcours très lisibles.',
      approach: 'Structures éditoriales communes, palettes dédiées, typographies fortes et composants adaptables selon l’univers métier.',
      gallery: [
        ['assets/portfolio/azzera-invest.webp', 'Azzera Invest'],
        ['assets/portfolio/azzera-services.webp', 'Azzera Services+'],
        ['assets/portfolio/azzera-academy.webp', 'Azzera Academy']
      ]
    }
  };
  const dialog = doc.querySelector('[data-project-dialog]');
  const dialogTitle = doc.querySelector('[data-dialog-title]');
  const dialogLead = doc.querySelector('[data-dialog-lead]');
  const dialogChallenge = doc.querySelector('[data-dialog-challenge]');
  const dialogApproach = doc.querySelector('[data-dialog-approach]');
  const dialogGallery = doc.querySelector('[data-dialog-gallery]');
  let lastFocus = null;
  function openProject(key, trigger) {
    const data = projectData[key];
    if (!dialog || !data) return;
    lastFocus = trigger || doc.activeElement;
    dialogTitle.textContent = data.title;
    dialogLead.textContent = data.lead;
    dialogChallenge.textContent = data.challenge;
    dialogApproach.textContent = data.approach;
    dialogGallery.innerHTML = data.gallery.map(([src, caption]) => `<figure><img src="${src}" alt="${caption}" loading="lazy"><figcaption>${caption}</figcaption></figure>`).join('');
    dialog.showModal();
    doc.body.classList.add('dialog-open');
    dialog.querySelector('.dialog-close')?.focus();
  }
  function closeDialog() {
    if (!dialog?.open) return;
    dialog.close();
    doc.body.classList.remove('dialog-open');
    lastFocus?.focus?.();
  }
  doc.querySelectorAll('[data-open-project]').forEach((btn) => btn.addEventListener('click', () => openProject(btn.dataset.openProject, btn)));
  doc.querySelectorAll('[data-close-dialog]').forEach((btn) => btn.addEventListener('click', closeDialog));
  dialog?.addEventListener('cancel', (e) => { e.preventDefault(); closeDialog(); });
  dialog?.addEventListener('click', (e) => { if (e.target === dialog) closeDialog(); });

  /* Filters */
  const filterButtons = [...doc.querySelectorAll('[data-filter]')];
  const projectCards = [...doc.querySelectorAll('[data-category]')];
  filterButtons.forEach((button) => button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    filterButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    projectCards.forEach((card) => {
      const categories = (card.dataset.category || '').split(' ');
      card.hidden = filter !== 'all' && !categories.includes(filter);
    });
  }));

  /* Scroll and scene states */
  function setScene(progress) {
    let index = 0;
    if (progress >= 0.31 && progress < 0.65) index = 1;
    if (progress >= 0.65) index = 2;
    scenes.forEach((scene, i) => scene.classList.toggle('is-active', i === index));
    if (sceneLabel) sceneLabel.textContent = ['01 — Entrée', '02 — Méthodologie', '03 — Projets'][index];
    if (journeyProgress) journeyProgress.style.width = `${progress * 100}%`;
  }

  function computeNativeProgress() {
    if (!journey) return 0;
    const rect = journey.getBoundingClientRect();
    const range = Math.max(1, journey.offsetHeight - innerHeight);
    return Math.min(1, Math.max(0, -rect.top / range));
  }

  /* Shader: portal cristallin et tunnel infini. Shared between THREE and raw WebGL. */
  const vertexShader = `
    attribute vec3 position;
    void main(){ gl_Position = vec4(position,1.0); }
  `;
  const fragmentShader = `
    precision highp float;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uScroll;
    uniform vec2 uPointer;

    #define MAX_STEPS 96
    #define MAX_DIST 48.0
    #define SURF_DIST .0018

    float sdRing(vec3 p, float majorR, float minorR){
      vec2 q = vec2(length(p.xy)-majorR,p.z);
      return length(q)-minorR;
    }
    float sdBox(vec3 p, vec3 b){
      vec3 q=abs(p)-b;
      return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);
    }
    mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}

    float sceneSDF(vec3 p){
      float dive=smoothstep(.18,.72,uScroll);
      float travel=uScroll*31.0;
      float repeatZ=mod(p.z+travel+2.15,4.3)-2.15;
      float ringRadius=mix(2.35,1.88+.13*sin(floor((p.z+travel)/4.3)*1.7),dive);
      float ringThickness=mix(.22,.105,dive);
      float tunnel=sdRing(vec3(p.xy,repeatZ),ringRadius,ringThickness);

      vec3 heroP=p;
      heroP.xy*=rot(.08*sin(uTime*.35));
      vec3 heroAForm=heroP;
      heroAForm.xz*=rot(.16*sin(uTime*.22));
      float heroA=sdRing(heroAForm-vec3(0.0,0.0,0.12),2.42,.23);
      vec3 heroB=heroP;
      heroB.xz*=rot(.72+.08*sin(uTime*.28));
      heroB.yz*=rot(.18);
      heroB.z+=.12;
      float heroRingB=sdRing(heroB,2.02,.17);
      vec3 heroC=heroP;
      heroC.yz*=rot(-.68+.06*cos(uTime*.25));
      heroC.xz*=rot(.24);
      heroC.z-=.16;
      float heroRingC=sdRing(heroC,1.58,.12);
      float hero=min(heroA,min(heroRingB,heroRingC));

      float ribs=1e4;
      for(int i=0;i<6;i++){
        float a=float(i)*1.0472+uTime*.03;
        vec3 q=p;
        q.xy*=rot(a);
        q.x-=2.05;
        ribs=min(ribs,sdBox(q,vec3(.055,.12,2.0)));
      }
      ribs+=.02*sin(p.z*6.0+uTime);
      float methodShape=min(tunnel,ribs);
      float blend=smoothstep(.08,.42,uScroll);
      return mix(hero,methodShape,blend);
    }

    vec3 getNormal(vec3 p){
      vec2 e=vec2(.002,0.0);
      float d=sceneSDF(p);
      return normalize(d-vec3(sceneSDF(p-e.xyy),sceneSDF(p-e.yxy),sceneSDF(p-e.yyx)));
    }
    float rayMarch(vec3 ro,vec3 rd){
      float dO=0.0;
      for(int i=0;i<MAX_STEPS;i++){
        vec3 p=ro+rd*dO;
        float dS=sceneSDF(p);
        dO+=dS*.72;
        if(dO>MAX_DIST||abs(dS)<SURF_DIST)break;
      }
      return dO;
    }
    float glowField(vec3 ro,vec3 rd){
      float total=0.0,t=0.0;
      for(int i=0;i<34;i++){
        vec3 p=ro+rd*t;
        float d=abs(sceneSDF(p));
        total+=.014/(.035+d*d*8.0);
        t+=.22;
      }
      return total;
    }
    float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}

    void main(){
      vec2 frag=gl_FragCoord.xy;
      vec2 uv=(frag-.5*uResolution.xy)/uResolution.y;
      uv.x+=uPointer.x*.055;
      uv.y+=uPointer.y*.035;

      float dive=smoothstep(.14,.76,uScroll);
      float aspect=uResolution.x/uResolution.y;
      float portrait=1.0-smoothstep(.68,.95,aspect);
      uv*=mix(1.0,.70,portrait);
      vec3 ro=vec3(0.0,0.0,mix(7.85,2.35,dive));
      ro.z-=portrait*1.55;
      ro.z-=uScroll*5.2;
      ro.x+=uPointer.x*.18;
      ro.y+=uPointer.y*.10;
      vec3 target=vec3(0.0,0.0,mix(0.0,-5.0,dive));
      vec3 f=normalize(target-ro);
      vec3 r=normalize(cross(vec3(0.0,1.0,0.0),f));
      vec3 up=cross(f,r);
      vec3 rd=normalize(f+uv.x*r+uv.y*up);

      float d=rayMarch(ro,rd);
      float glow=glowField(ro,rd);
      vec3 color=vec3(0.0);
      float alpha=0.0;
      if(d<MAX_DIST){
        vec3 p=ro+rd*d;
        vec3 n=getNormal(p);
        vec3 lightDir=normalize(vec3(-.35,.6,.8));
        float diff=max(dot(n,lightDir),0.0);
        float fres=pow(1.0-max(dot(n,-rd),0.0),2.2);
        float spec=pow(max(dot(reflect(-lightDir,n),-rd),0.0),34.0);
        vec3 silver=vec3(.46,.61,.80)*(0.66+diff*.66)+spec*1.45;
        vec3 blue=vec3(.02,.42,.98)*(fres*2.58+glow*.20);
        color=silver+blue+vec3(.24)*fres;
        alpha=clamp(.72+fres*.24+spec*.24,0.0,.99);
      }
      color+=vec3(.03,.45,1.0)*glow*.10;
      alpha=max(alpha,clamp(glow*.035,0.0,.42));

      float particle=step(.9973,hash21(floor((uv+uTime*.006)*vec2(220.0,130.0))));
      color+=vec3(.18,.55,1.0)*particle*.32;
      alpha=max(alpha,particle*.28);
      gl_FragColor=vec4(color,alpha);
    }
  `;

  let render3D = () => {};
  let resize3D = () => {};
  let dispose3D = () => {};

  function setupThree() {
    if (!window.THREE || !canvas) return false;
    try {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !coarsePointer, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarsePointer ? 1.35 : 1.8));
      const scene = new THREE.Scene();
      const camera = new THREE.Camera();
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),3));
      const uniforms = {
        uResolution: { value: new THREE.Vector2(innerWidth,innerHeight) },
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uPointer: { value: new THREE.Vector2() }
      };
      const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthTest: false, depthWrite: false });
      scene.add(new THREE.Mesh(geometry,material));
      resize3D = () => {
        const w=innerWidth,h=innerHeight;
        renderer.setSize(w,h,false);
        uniforms.uResolution.value.set(w*renderer.getPixelRatio(),h*renderer.getPixelRatio());
      };
      render3D = (time) => {
        uniforms.uTime.value=time;
        uniforms.uScroll.value=state.progress;
        uniforms.uPointer.value.set(state.smoothX,state.smoothY);
        renderer.render(scene,camera);
      };
      dispose3D = () => { geometry.dispose();material.dispose();renderer.dispose(); };
      resize3D();
      return true;
    } catch (error) {
      console.warn('Three.js indisponible, activation du moteur WebGL natif.', error);
      return false;
    }
  }

  function setupRawWebGL() {
    if (!canvas) return false;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false }) || canvas.getContext('experimental-webgl');
    if (!gl) return false;
    const compile = (type, source) => {
      const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    try {
      const program=gl.createProgram();
      gl.attachShader(program,compile(gl.VERTEX_SHADER,vertexShader));
      gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragmentShader));
      gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      const locRes=gl.getUniformLocation(program,'uResolution'),locTime=gl.getUniformLocation(program,'uTime'),locScroll=gl.getUniformLocation(program,'uScroll'),locPointer=gl.getUniformLocation(program,'uPointer');
      resize3D=()=>{
        const ratio=Math.min(devicePixelRatio||1,coarsePointer?1.25:1.65);canvas.width=Math.floor(innerWidth*ratio);canvas.height=Math.floor(innerHeight*ratio);canvas.style.width=`${innerWidth}px`;canvas.style.height=`${innerHeight}px`;gl.viewport(0,0,canvas.width,canvas.height);
      };
      render3D=(time)=>{gl.useProgram(program);gl.uniform2f(locRes,canvas.width,canvas.height);gl.uniform1f(locTime,time);gl.uniform1f(locScroll,state.progress);gl.uniform2f(locPointer,state.smoothX,state.smoothY);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);};
      dispose3D=()=>{gl.deleteBuffer(buffer);gl.deleteProgram(program)};
      resize3D();return true;
    } catch(error){console.warn('WebGL natif indisponible.',error);return false;}
  }

  const hasWebGL = reducedMotion ? false : (setupThree() || setupRawWebGL());
  if (!hasWebGL) fallback?.classList.add('is-visible');

  /* GSAP timeline when available */
  function setupGsap() {
    if (!window.gsap || !window.ScrollTrigger || reducedMotion || !journey) return false;
    gsap.registerPlugin(ScrollTrigger);
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: journey,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.05,
        invalidateOnRefresh: true,
        onUpdate: (self) => { state.progress=self.progress;setScene(self.progress); }
      }
    });
    tl
      .to('.scene-hero .hero-heading',{yPercent:-25,opacity:0,duration:.16},.15)
      .to('.scene-hero [data-float-card]',{y:(i)=>i%2?-120:120,x:(i)=>i===1?-120:120,rotation:(i)=>i%2?-8:8,opacity:0,duration:.17},.13)
      .to('.scene-hero .scroll-hint',{opacity:0,duration:.08},.11)
      .fromTo('.scene-method .method-copy',{x:-90,opacity:0},{x:0,opacity:1,duration:.16},.29)
      .fromTo('.scene-method .process-card',{x:110,scale:.92,opacity:0},{x:0,scale:1,opacity:1,duration:.18},.31)
      .fromTo('.scene-method .method-orbit--one',{y:80,opacity:0},{y:0,opacity:1,duration:.12},.38)
      .fromTo('.scene-method .method-orbit--two',{y:-80,opacity:0},{y:0,opacity:1,duration:.12},.39)
      .to('.scene-method',{opacity:0,duration:.12},.57)
      .fromTo('.scene-project-preview .preview-copy',{x:-80,opacity:0},{x:0,opacity:1,duration:.14},.64)
      .fromTo('.preview-plate--suite',{x:180,y:-80,rotation:12,opacity:0},{x:0,y:0,rotation:3,opacity:1,duration:.16},.63)
      .fromTo('.preview-plate--sentinelle',{x:170,y:110,rotation:-12,opacity:0},{x:0,y:0,rotation:-3,opacity:1,duration:.16},.68)
      .fromTo('.preview-plate--sst',{x:70,y:150,rotation:-14,opacity:0},{x:0,y:0,rotation:-5,opacity:1,duration:.14},.72)
      .to('.scene-project-preview',{opacity:0,yPercent:-10,duration:.12},.90);

    gsap.to('[data-float-card]',{y:'+=10',duration:2.8,repeat:-1,yoyo:true,ease:'sine.inOut',stagger:.35});
    gsap.to('.preview-plate',{y:'-=8',duration:3.4,repeat:-1,yoyo:true,ease:'sine.inOut',stagger:.4});
    gsap.to('[data-marquee-track]',{xPercent:-50,duration:25,repeat:-1,ease:'none'});
    gsap.utils.toArray('.project-card,.value-grid article,.cta-card').forEach((el)=>{
      gsap.from(el,{y:55,opacity:0,duration:.8,ease:'power2.out',scrollTrigger:{trigger:el,start:'top 88%',once:true}});
    });
    return true;
  }
  const hasGsap = setupGsap();

  /*
   * Secours intégral sans GSAP.
   * Le double-clic sur portfolio.html conserve ainsi une transition continue,
   * et pas seulement un changement brutal de scène.
   */
  const smoothstep = (a, b, value) => {
    const x = Math.min(1, Math.max(0, (value - a) / Math.max(.0001, b - a)));
    return x * x * (3 - 2 * x);
  };
  const setTransform = (element, value) => { if (element) element.style.transform = value; };
  const heroScene = doc.querySelector('.scene-hero');
  const methodScene = doc.querySelector('.scene-method');
  const previewScene = doc.querySelector('.scene-project-preview');
  const heroHeading = doc.querySelector('.hero-heading');
  const scrollHint = doc.querySelector('.scroll-hint');
  const floatCards = [...doc.querySelectorAll('[data-float-card]')];
  const methodCopy = doc.querySelector('.method-copy');
  const processCard = doc.querySelector('.process-card');
  const methodOrbitOne = doc.querySelector('.method-orbit--one');
  const methodOrbitTwo = doc.querySelector('.method-orbit--two');
  const previewCopy = doc.querySelector('.preview-copy');
  const previewSuite = doc.querySelector('.preview-plate--suite');
  const previewSentinelle = doc.querySelector('.preview-plate--sentinelle');
  const previewSst = doc.querySelector('.preview-plate--sst');

  function applyNativeJourney(progress) {
    if (hasGsap || reducedMotion) return;

    const heroExit = smoothstep(.12, .34, progress);
    const methodIn = smoothstep(.24, .37, progress);
    const methodOut = smoothstep(.54, .66, progress);
    const methodOpacity = methodIn * (1 - methodOut);
    const previewIn = smoothstep(.59, .72, progress);
    const previewOut = smoothstep(.88, .99, progress);
    const previewOpacity = previewIn * (1 - previewOut);

    if (heroScene) {
      heroScene.style.opacity = String(1 - heroExit);
      heroScene.style.visibility = heroExit < .995 ? 'visible' : 'hidden';
      heroScene.style.pointerEvents = heroExit < .86 ? 'auto' : 'none';
    }
    if (heroHeading) {
      heroHeading.style.transform = `translateX(-50%) translateY(${-heroExit * 118}px) scale(${1 - heroExit * .075})`;
      heroHeading.style.filter = `blur(${heroExit * 2.4}px)`;
    }
    if (scrollHint) {
      scrollHint.style.opacity = String(1 - smoothstep(.06, .19, progress));
      scrollHint.style.transform = `translateX(-50%) translateY(${-smoothstep(.06,.19,progress) * 28}px)`;
    }
    floatCards.forEach((card, index) => {
      const t = heroExit;
      const signX = index === 0 ? -1 : 1;
      const signY = index === 1 ? -1 : 1;
      const x = signX * (82 + index * 26) * t;
      const y = signY * (70 + index * 18) * t;
      card.style.opacity = String(1 - t);
      card.style.transform = `translate3d(${x}px,${y}px,0) rotate(${signX * (5 + index * 2) * t}deg) scale(${1 - t * .06})`;
    });

    if (methodScene) {
      methodScene.style.opacity = String(methodOpacity);
      methodScene.style.visibility = methodOpacity > .012 ? 'visible' : 'hidden';
      methodScene.style.pointerEvents = methodOpacity > .55 ? 'auto' : 'none';
    }
    const methodLocal = Math.min(1, Math.max(0, (progress - .25) / .34));
    setTransform(methodCopy, `translate3d(${(1 - methodIn) * -92}px,${methodOut * -38}px,0)`);
    setTransform(processCard, `translate3d(${(1 - methodIn) * 115}px,${methodOut * -44}px,0) scale(${.92 + methodIn * .08})`);
    if (methodOrbitOne) {
      methodOrbitOne.style.opacity = String(methodOpacity * smoothstep(.30,.43,progress));
      setTransform(methodOrbitOne, `translateY(${(1 - smoothstep(.30,.43,progress)) * 72}px)`);
    }
    if (methodOrbitTwo) {
      methodOrbitTwo.style.opacity = String(methodOpacity * smoothstep(.31,.44,progress));
      setTransform(methodOrbitTwo, `translateY(${(1 - smoothstep(.31,.44,progress)) * -72}px)`);
    }

    if (previewScene) {
      previewScene.style.opacity = String(previewOpacity);
      previewScene.style.visibility = previewOpacity > .012 ? 'visible' : 'hidden';
      previewScene.style.pointerEvents = previewOpacity > .55 ? 'auto' : 'none';
    }
    setTransform(previewCopy, `translate3d(${(1 - previewIn) * -86}px,${previewOut * -32}px,0)`);
    const plateEase = smoothstep(.62,.78,progress);
    if (previewSuite) {
      previewSuite.style.opacity = String(previewOpacity);
      setTransform(previewSuite, `translate3d(${(1 - plateEase) * 175}px,${(1 - plateEase) * -78}px,0) rotate(${12 - plateEase * 9}deg)`);
    }
    if (previewSentinelle) {
      previewSentinelle.style.opacity = String(previewOpacity);
      setTransform(previewSentinelle, `translate3d(${(1 - plateEase) * 165}px,${(1 - plateEase) * 105}px,0) rotate(${-12 + plateEase * 9}deg)`);
    }
    if (previewSst) {
      previewSst.style.opacity = String(previewOpacity);
      setTransform(previewSst, `translate3d(${(1 - plateEase) * 66}px,${(1 - plateEase) * 145}px,0) rotate(${-14 + plateEase * 9}deg)`);
    }
  }

  if (!hasGsap && !reducedMotion) {
    doc.documentElement.classList.add('native-motion');
    const track=doc.querySelector('[data-marquee-track]');
    if(track) track.animate([{transform:'translate3d(0,0,0)'},{transform:'translate3d(-50%,0,0)'}],{duration:25000,iterations:Infinity,easing:'linear'});

    const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.animate([
          { opacity: 0, transform: 'translate3d(0,52px,0) scale(.985)' },
          { opacity: 1, transform: 'translate3d(0,0,0) scale(1)' }
        ], { duration: 760, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
        observer.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -7% 0px' }) : null;
    revealObserver && doc.querySelectorAll('.project-card,.value-grid article,.cta-card').forEach((el) => revealObserver.observe(el));
  }

  /* Pointer parallax */
  if (!coarsePointer && !reducedMotion) {
    addEventListener('pointermove',(e)=>{state.pointerX=(e.clientX/innerWidth-.5)*2;state.pointerY=(.5-e.clientY/innerHeight)*2;},{passive:true});
  }

  /* Main frame */
  let lastTime=performance.now();
  function frame(now){
    const seconds=now*.001;
    state.smoothX+=(state.pointerX-state.smoothX)*.045;
    state.smoothY+=(state.pointerY-state.smoothY)*.045;
    if(!hasGsap){state.progress=computeNativeProgress();setScene(state.progress);applyNativeJourney(state.progress);}
    if(hasWebGL)render3D(seconds);
    lastTime=now;requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  addEventListener('scroll',updateGlobalProgress,{passive:true});
  addEventListener('resize',()=>{resize3D();if(innerWidth>820)closeNav();},{passive:true});
  updateGlobalProgress();setScene(0);

  /* Pause resource-heavy drawing when hidden */
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden){state.pointerX=state.pointerY=0;}});
  addEventListener('beforeunload',dispose3D,{once:true});
})();
