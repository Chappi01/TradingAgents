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

  buildSkyDome();
  buildSkyBodies();
  buildEnvironment();
  buildSkyline();
  buildStars();
  buildClouds();
  window.addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  });
}

/* ---------- Himmelskuppel mit vertikalem Farbverlauf ----------
   Ersetzt den flachen Hintergrund: Zenit dunkler, Horizont heller —
   sofort mehr Tiefe. Der Verlauf wird alle ~0,3 s neu gezeichnet. */
let skyDome,skyCanvas,skyCtx,skyTex,skyTimer=0;
const _skyTop=new THREE.Color(),_skyHor=new THREE.Color();
function buildSkyDome(){
  skyCanvas=document.createElement('canvas');skyCanvas.width=2;skyCanvas.height=256;
  skyCtx=skyCanvas.getContext('2d');
  skyTex=srgbTex(new THREE.CanvasTexture(skyCanvas));
  skyDome=new THREE.Mesh(new THREE.SphereGeometry(420,24,14),
    new THREE.MeshBasicMaterial({map:skyTex,side:THREE.BackSide,fog:false,depthWrite:false}));
  scene.add(skyDome);
}
function updateSkyDome(dt){
  skyTimer-=dt;
  skyDome.position.x=CAM.x();
  if(skyTimer>0)return;
  skyTimer=0.3;
  _skyTop.copy(skyCol).multiplyScalar(0.52);
  _skyHor.copy(skyCol).lerp(new THREE.Color(0xfff2e0),0.18);
  const g=skyCtx.createLinearGradient(0,0,0,256);
  g.addColorStop(0,'#'+_skyTop.getHexString());
  g.addColorStop(0.55,'#'+skyCol.getHexString());
  g.addColorStop(1,'#'+_skyHor.getHexString());
  skyCtx.fillStyle=g;skyCtx.fillRect(0,0,2,256);
  skyTex.needsUpdate=true;
}

/* ---------- Stadtsilhouette im Hintergrund (Tiefe statt Leere) ---------- */
function buildSkyline(){
  const g=new THREE.Group();
  const mats=[0x8a95a8,0x95a0b2,0x808ca0,0x9aa6b8].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.95}));
  const farMat=new THREE.MeshStandardMaterial({color:0x7d8aa0,roughness:1});
  let seed=13;const sr=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let x=-40;x<400;x+=7+sr()*5){        // Nachbarschaft: niedrige Häuserzeile
    const h=3.5+sr()*5,w=4.5+sr()*3;
    const m=new THREE.Mesh(boxGeo(1,1,1),mats[Math.floor(sr()*4)]);
    m.scale.set(w,h,4);m.position.set(x,h/2,-30-sr()*4);
    g.add(m);
    const roof=new THREE.Mesh(boxGeo(1,1,1),farMat);
    roof.scale.set(w*0.96,0.4,3.8);roof.position.set(x,h+0.2,-30);g.add(roof);
  }
  for(let x=-50;x<410;x+=10+sr()*7){       // ferne Hochhaus-Silhouette (vom Nebel gemildert)
    const h=8+sr()*14,w=6+sr()*4;
    const m=new THREE.Mesh(boxGeo(1,1,1),farMat);
    m.scale.set(w,h,4);m.position.set(x,h/2,-44-sr()*6);
    g.add(m);
  }
  scene.add(g);
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
let matStreetRef=null,matWalkRef=null,puddles=[];   // für den Nass-Effekt bei Regen
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

  /* Materialpass: echte Oberflächen statt flacher Farbflächen */
  function surf(tex,rx,rz){const t=tex;t.repeat.set(rx,rz);return new THREE.MeshStandardMaterial({map:t,roughness:1});}
  const matGrass=surf(texNoise('#79b356','#548c3e',70),w/5,4);
  const matGrassB=surf(texNoise('#6da84e','#4e8a3c',70),w/5,6);
  const matWalk=surf(texPavers('#c6bcaa','rgba(90,80,66,0.35)'),w/3.2,1);
  const matStreet=surf(texAsphalt(),w/7,1);matStreet.roughness=.92;
  matStreetRef=matStreet;matWalkRef=matWalk;
  const matCurb=new THREE.MeshStandardMaterial({color:COLORS.curb,roughness:.9});
  function strip(z0,z1,mat,h){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h||0.3,z1-z0),mat);
    m.position.set(x0+w/2,-(h||0.3)/2+0.001,(z0+z1)/2);
    m.receiveShadow=true;envGroup.add(m);return m;
  }
  strip(-42,2.1,matGrass);
  strip(2.1,5,matWalk,0.34);                 // Gehweg minimal erhöht
  strip(5,5.35,matCurb,0.34);
  strip(5.35,11.5,matStreet);
  strip(11.5,14.5,matWalk,0.34);
  strip(14.5,38,matGrassB);

  // Mittelstreifen + Zebrastreifen + Gullydeckel
  const dashMat=new THREE.MeshBasicMaterial({color:0xd8d8ce});
  for(let x=x0+2;x<x1;x+=5){
    const d=new THREE.Mesh(boxGeo(2,0.02,0.24),dashMat);
    d.position.set(x,0.02,8.4);envGroup.add(d);
  }
  const zebraMat=new THREE.MeshStandardMaterial({color:0xe8e6dc,roughness:.85});
  for(let x=x0+16;x<x1;x+=46){
    for(let s=0;s<5;s++){
      const z=new THREE.Mesh(boxGeo(1.4,0.025,0.55),zebraMat);
      z.position.set(x,0.02,6+s*1.15);envGroup.add(z);
    }
  }
  const manholeMat=new THREE.MeshStandardMaterial({color:0x33363c,roughness:.7,metalness:.4});
  for(let x=x0+9;x<x1;x+=23){
    const mh=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,0.03,14),manholeMat);
    mh.position.set(x,0.02,7.2+((x/23|0)%2)*2.4);envGroup.add(mh);
  }
  // Pfützen: erscheinen weich, wenn es regnet, und spiegeln das Licht
  puddles=[];
  const pudMat=()=>new THREE.MeshStandardMaterial({color:0x8ea4b8,metalness:.85,roughness:.12,transparent:true,opacity:0});
  for(let x=x0+7;x<x1;x+=17){
    const pd=new THREE.Mesh(new THREE.CircleGeometry(rand(0.5,0.9),12),pudMat());
    pd.rotation.x=-Math.PI/2;
    pd.scale.x=rand(1.2,1.9);
    pd.position.set(x+rand(-3,3),0.03,rand(6.2,10.6));
    envGroup.add(pd);puddles.push(pd);
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
  // Straßenmobiliar: Bänke, Mülleimer, Hydranten (Rhythmus zwischen den Laternen)
  const woodMat=new THREE.MeshStandardMaterial({color:0x8a5c38,roughness:.8});
  const ironMat=new THREE.MeshStandardMaterial({color:0x3a3f46,roughness:.55,metalness:.5});
  for(let x=x0+14;x<x1;x+=20){
    const kind=(x/20|0)%3;
    if(kind===0){                           // Parkbank am gegenüberliegenden Gehweg
      for(let s=0;s<3;s++){
        const slat=new THREE.Mesh(boxGeo(1.5,0.07,0.14),woodMat);
        slat.position.set(x,0.62+s*0.02,13.1+s*0.17);slat.castShadow=true;envGroup.add(slat);
      }
      const back=new THREE.Mesh(boxGeo(1.5,0.5,0.07),woodMat);
      back.position.set(x,0.95,13.62);back.rotation.x=-0.2;envGroup.add(back);
      [[-0.6],[0.6]].forEach(p=>{
        const leg=new THREE.Mesh(boxGeo(0.09,0.6,0.5),ironMat);
        leg.position.set(x+p[0],0.32,13.3);envGroup.add(leg);
      });
    }else if(kind===1){                     // Mülleimer
      const bin=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.2,0.62,10),
        new THREE.MeshStandardMaterial({color:0x3f6a4a,roughness:.6,metalness:.2}));
      bin.position.set(x,0.48,4.5);bin.castShadow=true;envGroup.add(bin);
      const rim=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.26,0.06,10),ironMat);
      rim.position.set(x,0.8,4.5);envGroup.add(rim);
    }else{                                  // Hydrant
      const hy=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.16,0.5,10),
        new THREE.MeshStandardMaterial({color:0xc9564a,roughness:.5,metalness:.2}));
      hy.position.set(x,0.42,4.55);hy.castShadow=true;envGroup.add(hy);
      const cap=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,6),hy.material);
      cap.position.set(x,0.7,4.55);envGroup.add(cap);
    }
  }
  // Bushaltestelle (ein Wahrzeichen der Straße)
  {
    const bx=x0+34;
    const roof=new THREE.Mesh(roundedBoxGeo(2.6,0.12,1.1,0.06),
      new THREE.MeshStandardMaterial({color:0x2e6a5a,roughness:.5}));
    roof.position.set(bx,2.25,12.9);roof.castShadow=true;envGroup.add(roof);
    [[-1.1],[1.1]].forEach(p=>{
      const post=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2.2,8),ironMat);
      post.position.set(bx+p[0],1.1,12.9);envGroup.add(post);
    });
    const glass=new THREE.Mesh(boxGeo(2.4,1.5,0.05),
      new THREE.MeshStandardMaterial({color:0xa8d4e8,roughness:.15,transparent:true,opacity:.4}));
    glass.position.set(bx,1.25,13.35);envGroup.add(glass);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.5),
      new THREE.MeshBasicMaterial({map:makeTextTexture('H',72,'#f2f0ea'),transparent:true}));
    sign.position.set(bx+1.4,2.5,12.9);envGroup.add(sign);
    const signBg=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.04,14),
      new THREE.MeshStandardMaterial({color:0x2e6a5a}));
    signBg.rotation.x=Math.PI/2;signBg.position.set(bx+1.4,2.5,12.88);envGroup.add(signBg);
    const pole2=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,2.6,8),ironMat);
    pole2.position.set(bx+1.4,1.3,12.9);envGroup.add(pole2);
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
const _tmpCol=new THREE.Color(),_greyCol=new THREE.Color(0x9aa4b2),_greyNight=new THREE.Color(0x1a2030);
function updateDayNight(){
  const e=sunElev();
  const L=clamp(e*1.5,0,1),N=nightFactor();
  const wx=WEATHER.skyMod();
  skyCol.copy(COLORS.night).lerp(COLORS.day,L);
  const dawn=clamp(1-Math.abs(e)/0.3,0,1)*0.55*(1-wx.cloud*0.8);
  skyCol.lerp(COLORS.dawn,dawn);
  // Bewölkung graut den Himmel ab
  _tmpCol.copy(_greyNight).lerp(_greyCol,L);
  skyCol.lerp(_tmpCol,wx.cloud*0.75);
  scene.background=skyCol;
  scene.fog.color.copy(skyCol);
  const a=(dayT()-0.25)*Math.PI*2;
  const sx=CAM.x()+Math.cos(a)*80,sy=Math.sin(a)*80;
  sun.position.set(sx,Math.max(9,sy),34);
  sun.target.position.set(CAM.x(),0,4);
  sun.intensity=(0.1+L*1.2)*wx.sunMul*(1-wx.cloud*0.45);
  _tmpCol.copy(COLORS.sunLow).lerp(COLORS.sunDay,L);sun.color.copy(_tmpCol);
  hemi.intensity=(0.22+L*0.62)*(1-wx.cloud*0.25);
  fillLight.intensity=0.08+L*0.2;
  sunSprite.position.set(sx,sy,-90);sunSprite.material.opacity=clamp(e*2+0.3,0,1)*(1-wx.cloud*0.85);
  moonSprite.position.set(CAM.x()-Math.cos(a)*80,Math.max(6,-sy),-95);moonSprite.material.opacity=N;
  starMat.opacity=N*0.9;
  updateSkyDome(1/60);
  // Regen macht die Straße sichtbar nass: dunkler, glänzend, Pfützen spiegeln
  const wet=WEATHER.wetness();
  if(matStreetRef){
    matStreetRef.roughness=0.92-wet*0.62;
    matStreetRef.metalness=wet*0.32;
    matWalkRef.roughness=0.95-wet*0.4;
  }
  for(const pd of puddles)pd.material.opacity=wet*0.8;
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
    punch(v){punch=Math.max(punch,v===undefined?1:v);},
    orbit(dT,dP){theta+=dT;phi=clamp(phi+dP,0.18,1.15);lastInput=performance.now();},
    zoom(f){radius=clamp(radius*f,13,70);lastInput=performance.now();}};
})();
