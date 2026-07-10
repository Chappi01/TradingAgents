'use strict';
/* ============================================================
   fx.js — Partikel: Geld, Münzen, Konfetti, Sprechblasen, Dampf
   Alles gepoolt, keine Allokationen im laufenden Betrieb.
   ============================================================ */
const FX=(()=>{
  let moneySprites=[],coins=[],confettiPool=[],bubbles=[],steams=[];
  let bubbleTex={};
  const lastMoney={},lastCoin={};

  function init(){
    const moneyTex=makeTextTexture('+€',72,'#7ede97');
    for(let i=0;i<36;i++){
      const s=new THREE.Sprite(new THREE.SpriteMaterial({map:moneyTex,transparent:true,opacity:0,depthWrite:false}));
      s.scale.set(1.1,1.1,1);s.userData.life=-1;scene.add(s);moneySprites.push(s);
    }
    // Münzen: goldene Scheiben, springen auf und fallen
    const coinGeo=new THREE.CylinderGeometry(0.16,0.16,0.05,12);
    const coinMat=new THREE.MeshStandardMaterial({color:0xf2c14e,metalness:.7,roughness:.3,emissive:0x8a6a1a,emissiveIntensity:.2});
    for(let i=0;i<20;i++){
      const m=new THREE.Mesh(coinGeo,coinMat);
      m.visible=false;m.userData={life:-1};scene.add(m);coins.push(m);
    }
    const confGeo=new THREE.PlaneGeometry(0.2,0.13);
    const confMats=[0xe8b84b,0x6fd58a,0x6a9ee3,0xe36a6a,0xb08fe0,0xf5f0e0].map(c=>
      new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide,transparent:true}));
    for(let i=0;i<110;i++){
      const m=new THREE.Mesh(confGeo,confMats[i%confMats.length]);
      m.visible=false;m.userData={life:-1};scene.add(m);confettiPool.push(m);
    }
    ['🍕','❤️','🍹','🎉','😋','👍','🥨','🍷','⭐','🍰'].forEach(e=>{bubbleTex[e]=makeTextTexture(e,80);});
    for(let i=0;i<18;i++){
      const s=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,opacity:0,depthWrite:false}));
      s.scale.set(0.9,0.9,1);s.userData.life=-1;scene.add(s);bubbles.push(s);
    }
  }

  /* Dampf-Emitter: Gebäude registrieren eine Position, FX animiert die Wölkchen */
  function addSteam(parent,x,y,z,scale,color){
    const mat=new THREE.MeshStandardMaterial({color:color||0xf2f2f2,transparent:true,opacity:.5,roughness:1});
    const puffs=[];
    for(let s=0;s<4;s++){
      const p=new THREE.Mesh(new THREE.SphereGeometry(0.22*(scale||1),8,6),mat.clone());
      p.position.set(x,y,z);
      p.userData={t:s/4,baseY:y,sc:scale||1};
      parent.add(p);puffs.push(p);
    }
    steams.push({puffs});
    return puffs;
  }
  function isDescendant(obj,root){let p=obj;while(p){if(p===root)return true;p=p.parent;}return false;}
  function clearSteamOf(root){
    steams=steams.filter(st=>!isDescendant(st.puffs[0],root));
  }

  function money(vi){
    const now=S.gameTime;
    if(lastMoney[vi]&&now-lastMoney[vi]<0.55)return;
    lastMoney[vi]=now;
    const s=moneySprites.find(x=>x.userData.life<0);if(!s)return;
    s.position.set(vi*SPACING+rand(-1,1),3.4+rand(0,1),3);
    s.userData.life=1.3;s.material.opacity=1;
  }
  function coin(vi){
    const now=S.gameTime;
    if(lastCoin[vi]&&now-lastCoin[vi]<0.4)return;
    lastCoin[vi]=now;
    const m=coins.find(x=>x.userData.life<0);if(!m)return;
    m.visible=true;
    m.position.set(vi*SPACING+rand(-1.5,1.5),1,3.4);
    m.userData={life:1.1,vy:rand(3.5,4.5),vx:rand(-0.8,0.8)};
    AUDIO.coin();
  }
  function bubble(x,y,z){
    const s=bubbles.find(b=>b.userData.life<0);if(!s)return;
    const keys=Object.keys(bubbleTex);
    s.material.map=bubbleTex[keys[randI(0,keys.length-1)]];
    s.material.needsUpdate=true;
    s.position.set(x,y,z);s.userData.life=1.4;s.material.opacity=1;
  }
  function confetti(vi){
    const bx=vi*SPACING,topY=WORLD.topOf(vi)+1;
    let n=0;
    for(const m of confettiPool){
      if(m.userData.life>=0)continue;
      m.visible=true;
      m.position.set(bx+rand(-2.5,2.5),topY+rand(0,1.5),rand(0.5,3.5));
      m.userData={life:rand(1.8,2.8),vx:rand(-1.5,1.5),vy:rand(2,5),vz:rand(-0.5,1.5),rx:rand(-4,4),rz:rand(-4,4)};
      if(++n>=70)break;
    }
  }
  function update(dt){
    for(const s of moneySprites){
      if(s.userData.life<0)continue;
      s.userData.life-=dt;s.position.y+=dt*1.6;
      s.material.opacity=clamp(s.userData.life/0.6,0,1);
      if(s.userData.life<0)s.material.opacity=0;
    }
    for(const s of bubbles){
      if(s.userData.life<0)continue;
      s.userData.life-=dt;s.position.y+=dt*1.1;
      s.material.opacity=clamp(s.userData.life/0.5,0,1);
      if(s.userData.life<0)s.material.opacity=0;
    }
    for(const m of coins){
      if(m.userData.life<0)continue;
      const u=m.userData;u.life-=dt;
      if(u.life<0){m.visible=false;continue;}
      u.vy-=dt*10;
      m.position.y+=u.vy*dt;m.position.x+=u.vx*dt;
      m.rotation.x+=dt*9;m.rotation.z+=dt*5;
      if(m.position.y<0.15){m.position.y=0.15;u.vy*=-0.35;}
    }
    for(const m of confettiPool){
      if(m.userData.life<0)continue;
      const u=m.userData;u.life-=dt;
      if(u.life<0){m.visible=false;continue;}
      u.vy-=dt*6;
      m.position.x+=u.vx*dt;m.position.y+=u.vy*dt;m.position.z+=u.vz*dt;
      if(m.position.y<0.1){m.position.y=0.1;u.vy=0;u.vx*=0.9;u.vz*=0.9;}
      m.rotation.x+=u.rx*dt;m.rotation.z+=u.rz*dt;
      m.material.opacity=clamp(u.life,0,1);
    }
    for(const st of steams){
      for(const p of st.puffs){
        p.userData.t+=dt*0.3;
        if(p.userData.t>1)p.userData.t-=1;
        const pt=p.userData.t;
        p.position.y=p.userData.baseY+pt*2.4*p.userData.sc;
        p.material.opacity=0.45*(1-pt);
        const sc=(0.7+pt*1.4)*p.userData.sc;p.scale.set(sc,sc,sc);
      }
    }
  }
  return {init,update,money,coin,bubble,confetti,addSteam,clearSteamOf};
})();
