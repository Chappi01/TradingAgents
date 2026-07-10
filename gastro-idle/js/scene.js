'use strict';
/* ============================================================
   scene.js — Renderer, Licht, Himmel, Umgebung, Kamera
   Look: stilisiert-freundlich, ACES-Tonemapping, weiche Schatten.
   ============================================================ */
const SPACING=10;
let renderer,scene,camera,sun,hemi,fillLight,webglOk=true;
let skyCol=new THREE.Color();
const COLORS={
  night:new THREE.Color(0x141b3d),day:new THREE.Color(0x87c7f2),dawn:new THREE.Color(0xf2a05e),
  sunDay:new THREE.Color(0xfff3da),sunLow:new THREE.Color(0xff9a5e),
  grass:0x84b860,grassB:0x74a854,walk:0xcfc4ae,street:0x4a4e57,curb:0xa8a191,
};

function initThree(){
  // korrektes Farbmanagement: sRGB-Hexwerte → linear, sonst wirkt alles ausgewaschen
  if(THREE.ColorManagement)THREE.ColorManagement.legacyMode=false;
  try{renderer=new THREE.WebGLRenderer({antialias:true});}
  catch(e){webglOk=false;return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;
  document.getElementById('scene').appendChild(renderer.domElement);

  scene=new THREE.Scene();
  scene.fog=new THREE.Fog(0x87c7f2,80,220);
  camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,0.1,700);

  hemi=new THREE.HemisphereLight(0xcfe4ff,0x7a6a52,0.85);scene.add(hemi);
  sun=new THREE.DirectionalLight(0xfff3da,1.25);
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left=-55;sun.shadow.camera.right=55;
  sun.shadow.camera.top=55;sun.shadow.camera.bottom=-40;
  sun.shadow.camera.far=260;
  sun.shadow.bias=-0.0005;
  sun.shadow.radius=4;
  scene.add(sun);scene.add(sun.target);
  fillLight=new THREE.DirectionalLight(0xbcd4ff,0.25);   // weiches Gegenlicht
  fillLight.position.set(-30,40,-40);scene.add(fillLight);

  buildSkyBodies();
  buildEnvironment();
  buildStars();
  buildClouds();
  window.addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  });
}

/* ---------- Sonne/Mond als weiche Scheiben am Himmel ---------- */
let sunSprite,moonSprite;
function makeDiscTexture(inner,outer){
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d');
  const gr=g.createRadialGradient(64,64,6,64,64,62);
  gr.addColorStop(0,inner);gr.addColorStop(0.45,inner);gr.addColorStop(1,outer);
  g.fillStyle=gr;g.fillRect(0,0,128,128);
  return srgbTex(new THREE.CanvasTexture(c));
}
function buildSkyBodies(){
  sunSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:makeDiscTexture('rgba(255,244,214,1)','rgba(255,220,150,0)'),transparent:true,depthWrite:false,fog:false}));
  sunSprite.scale.set(26,26,1);scene.add(sunSprite);
  moonSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:makeDiscTexture('rgba(230,238,255,0.95)','rgba(200,215,255,0)'),transparent:true,depthWrite:false,fog:false}));
  moonSprite.scale.set(14,14,1);scene.add(moonSprite);
}

/* ---------- Umgebung: Straße, Gehwege, Park, Lampen, Deko ---------- */
let envGroup=null,envMaxX=0,envDekoTier=-1;
const lampGlows=[],lampHeads=[],stringLights=[];
function makeGlowTexture(){
  const c=document.createElement('canvas');c.width=c.height=64;
  const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,32,2,32,32,30);
  gr.addColorStop(0,'rgba(255,240,200,0.9)');gr.addColorStop(1,'rgba(255,240,200,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64);
  return srgbTex(new THREE.CanvasTexture(c));
}
function buildEnvironment(){
  const need=Math.max(4,S.venues.length+2)*SPACING;
  const deko=Math.min(upTier('deko'),3);
  if(envGroup&&need<=envMaxX&&deko===envDekoTier)return;
  if(envGroup)scene.remove(envGroup);
  lampGlows.length=0;lampHeads.length=0;stringLights.length=0;
  envMaxX=Math.max(envMaxX,need+SPACING*4);
  envDekoTier=deko;
  envGroup=new THREE.Group();
  const x0=-26,x1=envMaxX,w=x1-x0;

  const matGrass=new THREE.MeshStandardMaterial({color:COLORS.grass,roughness:1});
  const matGrassB=new THREE.MeshStandardMaterial({color:COLORS.grassB,roughness:1});
  const matWalk=new THREE.MeshStandardMaterial({color:COLORS.walk,roughness:.95});
  const matStreet=new THREE.MeshStandardMaterial({color:COLORS.street,roughness:.9});
  const matCurb=new THREE.MeshStandardMaterial({color:COLORS.curb,roughness:.9});
  function strip(z0,z1,mat,h){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h||0.3,z1-z0),mat);
    m.position.set(x0+w/2,-(h||0.3)/2+0.001,(z0+z1)/2);
    m.receiveShadow=true;envGroup.add(m);return m;
  }
  strip(-16,2.1,matGrass);
  strip(2.1,5,matWalk,0.34);                 // Gehweg minimal erhöht
  strip(5,5.35,matCurb,0.34);
  strip(5.35,11.5,matStreet);
  strip(11.5,14.5,matWalk,0.34);
  strip(14.5,38,matGrassB);

  // Mittelstreifen
  const dashMat=new THREE.MeshBasicMaterial({color:0xd8d8ce});
  for(let x=x0+2;x<x1;x+=5){
    const d=new THREE.Mesh(boxGeo(2,0.02,0.24),dashMat);
    d.position.set(x,0.02,8.4);envGroup.add(d);
  }
  // Laternen
  const poleMat=new THREE.MeshStandardMaterial({color:0x384048,roughness:.5,metalness:.4});
  const glowTex=makeGlowTexture();
  for(let x=x0+6;x<x1;x+=20){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.12,4.6,8),poleMat);
    pole.position.set(x,2.3,5.15);pole.castShadow=true;envGroup.add(pole);
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1,6),poleMat);
    arm.rotation.z=Math.PI/2;arm.position.set(x-0.45,4.55,5.15);envGroup.add(arm);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.26,12,10),
      new THREE.MeshStandardMaterial({color:0xfff2c0,emissive:0xffdf8a,emissiveIntensity:0}));
    head.position.set(x-0.9,4.5,5.15);envGroup.add(head);lampHeads.push(head);
    const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffd98a,transparent:true,opacity:0,depthWrite:false}));
    spr.scale.set(5.5,5.5,1);spr.position.set(x-0.9,4.5,5.15);envGroup.add(spr);lampGlows.push(spr);
  }
  // Park: Bäume, Büsche, Felsen, Blumen (deterministisch verteilt)
  const trunkMat=new THREE.MeshStandardMaterial({color:0x6d4c33,roughness:1});
  const leafMats=[0x559a4c,0x66aa58,0x4a8a42,0x77b862].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:1}));
  const rockMat=new THREE.MeshStandardMaterial({color:0x9aa0a8,roughness:.95});
  let seed=7;const srand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let x=x0+3;x<x1;x+=3.5+srand()*5){
    const z=16+srand()*18,r=srand();
    if(r<0.55){                                 // Baum: Stamm + 2-3 Laubkugeln
      const h=1.3+srand()*1.6;
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.2,h,7),trunkMat);
      trunk.position.set(x,h/2,z);trunk.castShadow=true;envGroup.add(trunk);
      const n=2+Math.floor(srand()*2);
      for(let j=0;j<n;j++){
        const cr=new THREE.Mesh(new THREE.IcosahedronGeometry(0.7+srand()*0.7,1),leafMats[Math.floor(srand()*4)]);
        cr.position.set(x+(srand()-0.5)*1.2,h+0.5+srand()*1.1,z+(srand()-0.5)*1.2);
        cr.castShadow=true;envGroup.add(cr);
      }
    }else if(r<0.8){                            // Busch
      const b=new THREE.Mesh(new THREE.IcosahedronGeometry(0.5+srand()*0.5,1),leafMats[Math.floor(srand()*4)]);
      b.position.set(x,0.4,z);b.scale.y=0.75;b.castShadow=true;envGroup.add(b);
    }else{                                      // Fels
      const rk=new THREE.Mesh(new THREE.IcosahedronGeometry(0.3+srand()*0.4,0),rockMat);
      rk.position.set(x,0.22,z);rk.rotation.set(srand()*3,srand()*3,0);rk.castShadow=true;envGroup.add(rk);
    }
  }
  // Blumen hinter dem Gehweg (kleine Farbtupfer)
  const flowerMats=[0xe36a8a,0xf2c14e,0xffffff,0xb08fe0].map(c=>new THREE.MeshBasicMaterial({color:c}));
  for(let x=x0+1;x<x1;x+=1.2+srand()*2){
    const f=new THREE.Mesh(new THREE.SphereGeometry(0.07,6,5),flowerMats[Math.floor(srand()*4)]);
    f.position.set(x,0.12,1.2+srand()*0.7);envGroup.add(f);
  }
  // Deko-Upgrade: Pflanzkübel + Lichterketten zwischen den Laternen
  if(deko>=1){
    const potMat=new THREE.MeshStandardMaterial({color:0xb2483f,roughness:.8});
    for(let x=x0+4;x<x1;x+=8){
      const pot=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.24,0.4,10),potMat);
      pot.position.set(x,0.36,4.6);pot.castShadow=true;envGroup.add(pot);
      const pl=new THREE.Mesh(new THREE.IcosahedronGeometry(0.28,1),leafMats[Math.floor(srand()*4)]);
      pl.position.set(x,0.72,4.6);envGroup.add(pl);
    }
  }
  if(deko>=2){
    const bulbG=new THREE.SphereGeometry(0.07,6,5);
    const cols=[0xffd98a,0x8ad9ff,0xff9ad9,0xa5ff8a];
    for(let x=x0+6;x<x1-20;x+=20){
      for(let b=0;b<12;b++){
        const t=b/11;
        const bulb=new THREE.Mesh(bulbG,new THREE.MeshStandardMaterial({color:cols[b%4],emissive:cols[b%4],emissiveIntensity:0}));
        bulb.position.set(x+t*20-0.9,4.4-Math.sin(t*Math.PI)*0.9,5.15);
        envGroup.add(bulb);stringLights.push(bulb);
      }
    }
  }
  if(deko>=3){                                  // Sonnenschirme im Park
    const shadeMats=[0xe36a8a,0x6a9ee3,0xf2c14e].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.8,side:THREE.DoubleSide}));
    for(let x=x0+10;x<x1;x+=16){
      const um=new THREE.Mesh(new THREE.ConeGeometry(1,0.5,8,1,true),shadeMats[Math.floor(srand()*3)]);
      um.position.set(x,2,17);envGroup.add(um);
      const st=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,2,6),trunkMat);
      st.position.set(x,1,17);envGroup.add(st);
    }
  }
  scene.add(envGroup);
}

/* ---------- Sterne & Wolken ---------- */
let starMat,clouds=[];
function buildStars(){
  const n=420,pos=new Float32Array(n*3);
  for(let i=0;i<n;i++){pos[i*3]=rand(-180,1000);pos[i*3+1]=rand(40,220);pos[i*3+2]=rand(-200,60);}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  starMat=new THREE.PointsMaterial({color:0xffffff,size:0.55,transparent:true,opacity:0,depthWrite:false,fog:false});
  scene.add(new THREE.Points(g,starMat));
}
function buildClouds(){
  const mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,transparent:true,opacity:.88});
  for(let i=0;i<8;i++){
    const gr=new THREE.Group();
    for(let j=0;j<4;j++){
      const m=new THREE.Mesh(new THREE.IcosahedronGeometry(rand(1,2.2),1),mat);
      m.scale.y=0.55;
      m.position.set(rand(-2.6,2.6),rand(-0.3,0.3),rand(-1,1));gr.add(m);
    }
    gr.position.set(rand(-40,160),rand(24,36),rand(-50,8));
    gr.userData.spd=rand(0.25,0.7);
    scene.add(gr);clouds.push(gr);
  }
}
function updateClouds(dt){
  for(const c of clouds){
    c.position.x+=c.userData.spd*dt;
    if(c.position.x>envMaxX+50)c.position.x=-60;
  }
}

/* ---------- Tag & Nacht ---------- */
function dayT(){return (S.gameTime%DAY_LEN)/DAY_LEN;}
function sunElev(){return Math.sin((dayT()-0.25)*Math.PI*2);}
function nightFactor(){return clamp(-sunElev()*1.6,0,1);}
const _tmpCol=new THREE.Color();
function updateDayNight(){
  const e=sunElev();
  const L=clamp(e*1.5,0,1),N=nightFactor();
  skyCol.copy(COLORS.night).lerp(COLORS.day,L);
  const dawn=clamp(1-Math.abs(e)/0.3,0,1)*0.55;
  skyCol.lerp(COLORS.dawn,dawn);
  scene.background=skyCol;
  scene.fog.color.copy(skyCol);
  const a=(dayT()-0.25)*Math.PI*2;
  const sx=CAM.x()+Math.cos(a)*80,sy=Math.sin(a)*80;
  sun.position.set(sx,Math.max(9,sy),34);
  sun.target.position.set(CAM.x(),0,4);
  sun.intensity=0.1+L*1.2;
  _tmpCol.copy(COLORS.sunLow).lerp(COLORS.sunDay,L);sun.color.copy(_tmpCol);
  hemi.intensity=0.22+L*0.62;
  fillLight.intensity=0.08+L*0.2;
  sunSprite.position.set(sx,sy,-90);sunSprite.material.opacity=clamp(e*2+0.3,0,1);
  moonSprite.position.set(CAM.x()-Math.cos(a)*80,Math.max(6,-sy),-95);moonSprite.material.opacity=N;
  starMat.opacity=N*0.9;
  const t=S.gameTime;
  for(const spr of lampGlows)spr.material.opacity=N*0.55;
  for(const h of lampHeads)h.material.emissiveIntensity=N*1.3;
  for(let i=0;i<stringLights.length;i++)
    stringLights[i].material.emissiveIntensity=N*(0.7+0.5*Math.sin(t*2.2+i*1.7));
  WORLD.updateNight(N,t);
}

/* ---------- Kamera ---------- */
const CAM=(()=>{
  let focusX=0,camX=0,theta=0.32,phi=0.44,radius=28,lastInput=0,punch=0;
  function update(dt){
    camX=lerp(camX,focusX,Math.min(1,dt*2.4));
    if(performance.now()-lastInput>8000)theta+=Math.sin(performance.now()*0.00006)*dt*0.012;
    punch=Math.max(0,punch-dt*2.2);
    const r=radius*(1-punch*0.05);
    const tx=camX,ty=2.6,tz=1.5;
    camera.position.set(
      tx+r*Math.sin(theta)*Math.cos(phi),
      ty+r*Math.sin(phi),
      tz+r*Math.cos(theta)*Math.cos(phi));
    camera.lookAt(tx,ty,tz);
  }
  function initControls(){
    const el=renderer.domElement;
    let down=false,sx=0,sy=0,moved=0,downT=0;
    el.addEventListener('pointerdown',e=>{down=true;sx=e.clientX;sy=e.clientY;moved=0;downT=performance.now();lastInput=performance.now();el.setPointerCapture(e.pointerId);});
    el.addEventListener('pointermove',e=>{
      if(!down)return;
      const dx=e.clientX-sx,dy=e.clientY-sy;sx=e.clientX;sy=e.clientY;
      moved+=Math.abs(dx)+Math.abs(dy);
      theta-=dx*0.0055;phi=clamp(phi+dy*0.004,0.18,1.15);
      lastInput=performance.now();
    });
    el.addEventListener('pointerup',e=>{
      down=false;
      if(moved<6&&performance.now()-downT<400)WORLD.tap(e);
    });
    el.addEventListener('wheel',e=>{
      radius=clamp(radius*(1+e.deltaY*0.0011),13,70);lastInput=performance.now();
    },{passive:true});
  }
  return {update,initControls,
    focus(x){focusX=x;},x(){return camX;},
    punch(v){punch=Math.max(punch,v===undefined?1:v);}};
})();
