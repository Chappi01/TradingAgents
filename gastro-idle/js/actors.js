'use strict';
/* ============================================================
   actors.js — ACTORS: Gäste, Personal, Lieferautos, Drohnen, Vögel
   Die kleinen Leute machen die Welt lebendig: sie laufen zu den
   Betrieben, essen, hinterlassen Trinkgeld und tanzen nachts.
   ============================================================ */
const ACTORS=(()=>{
  const PEOPLE_MAX=70;
  let people=[],cars=[],drones=[],birds=[];
  let parts=null,bodyMats,skinMats,hatMats,eyeMat;
  let rushVenue=-1,rushUntil=0,spawnCooldown=0;
  const bodyPalette=[0xe36a6a,0x6a9ee3,0x6ac98f,0xe3b56a,0xb08fe0,0xe08fc2,0x8fd3e0,0xd3e08f,0xe0a58f,0x9fb3c8,0x7fc9b0,0xc97f7f];
  const skinTones=[0xf5d0a9,0xe8b98a,0xc98d5f,0x8d5f3f];

  function init(){
    parts={
      body:new THREE.CapsuleGeometry(0.21,0.42,4,10),
      head:new THREE.SphereGeometry(0.165,12,10),
      arm:new THREE.CapsuleGeometry(0.055,0.3,3,8),
      eye:new THREE.SphereGeometry(0.03,6,6),
      hat:new THREE.CylinderGeometry(0.19,0.19,0.14,12),
      brim:new THREE.CylinderGeometry(0.27,0.27,0.035,12),
      toque:new THREE.CylinderGeometry(0.17,0.14,0.26,12),
      tray:new THREE.CylinderGeometry(0.16,0.16,0.03,12),
    };
    bodyMats=bodyPalette.map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.75}));
    skinMats=skinTones.map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.65}));
    hatMats=[0x3a3f4a,0xc9564a,0x4a7fc9,0xe0c04a].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.8}));
    eyeMat=new THREE.MeshBasicMaterial({color:0x22242c});
  }

  /* ---------- Figuren-Fabrik ---------- */
  function makeFigure(bodyMat,headMat){
    const g=new THREE.Group();
    const body=new THREE.Mesh(parts.body,bodyMat);
    body.position.y=0.52;body.castShadow=true;g.add(body);
    const head=new THREE.Mesh(parts.head,headMat);
    head.position.y=1.0;g.add(head);
    [-0.06,0.06].forEach(x=>{
      const eye=new THREE.Mesh(parts.eye,eyeMat);
      eye.position.set(x,1.03,0.148);g.add(eye);
    });
    const la=new THREE.Mesh(parts.arm,bodyMat);
    la.position.set(-0.27,0.58,0);la.rotation.z=0.22;g.add(la);
    const ra=new THREE.Mesh(parts.arm,bodyMat);
    ra.position.set(0.27,0.58,0);ra.rotation.z=-0.22;g.add(ra);
    g.userData.arms=[la,ra];
    return g;
  }
  function makeGuest(){
    const g=makeFigure(bodyMats[randI(0,bodyMats.length-1)],skinMats[randI(0,skinMats.length-1)]);
    if(Math.random()<0.33){
      const hm=hatMats[randI(0,hatMats.length-1)];
      const hat=new THREE.Mesh(parts.hat,hm);hat.position.y=1.17;g.add(hat);
      const brim=new THREE.Mesh(parts.brim,hm);brim.position.y=1.1;g.add(brim);
    }
    const s=rand(0.85,1.12);g.scale.set(s,s,s);
    scene.add(g);
    return g;
  }
  /* Personal wird von buildings.js vor die Betriebe gestellt */
  function makeStaffFigure(type){
    let g;
    if(type==='chef'){
      g=makeFigure(new THREE.MeshStandardMaterial({color:0xf5f2ea,roughness:.7}),skinMats[randI(0,3)]);
      const tq=new THREE.Mesh(parts.toque,new THREE.MeshStandardMaterial({color:0xf5f2ea,roughness:.8}));
      tq.position.y=1.24;g.add(tq);
    }else if(type==='waiter'){
      g=makeFigure(new THREE.MeshStandardMaterial({color:0x2e3140,roughness:.7}),skinMats[randI(0,3)]);
      const chest=new THREE.Mesh(boxGeo(0.2,0.3,0.06),new THREE.MeshStandardMaterial({color:0xf5f2ea,roughness:.7}));
      chest.position.set(0,0.62,0.19);g.add(chest);
      const tray=new THREE.Mesh(parts.tray,new THREE.MeshStandardMaterial({color:0xd8d8ce,metalness:.6,roughness:.3}));
      tray.position.set(0.34,0.86,0.12);g.add(tray);
      const cup=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.04,0.09,8),new THREE.MeshStandardMaterial({color:0xf5f2ea}));
      cup.position.set(0.34,0.92,0.12);g.add(cup);
    }else{ // manager
      g=makeFigure(new THREE.MeshStandardMaterial({color:0x1e2233,roughness:.6}),skinMats[randI(0,3)]);
      const tie=new THREE.Mesh(boxGeo(0.07,0.26,0.04),new THREE.MeshStandardMaterial({color:0xd4af37,metalness:.5,roughness:.4}));
      tie.position.set(0,0.66,0.2);g.add(tie);
    }
    g.rotation.y=Math.PI;                 // schaut zur Straße
    return g;
  }

  /* ---------- Gäste-Logik ---------- */
  function targetCount(){
    const base=clamp(6+S.venues.length*4+Math.floor(Math.log10(Math.max(10,S.lifeEarned))),8,PEOPLE_MAX);
    return Math.round(base*WEATHER.crowdMult());   // bei Regen weniger Laufkundschaft
  }
  function spawnGuest(){
    const owned=S.venues.length;
    let vi=randI(0,owned-1);
    if(rushUntil>S.gameTime&&Math.random()<0.6)vi=rushVenue;
    const fromLeft=Math.random()<0.5;
    const spawnX=fromLeft?-24:owned*SPACING+14;
    const doorX=vi*SPACING,sideZ=rand(3.2,4.6);
    const p={g:makeGuest(),speed:rand(1.3,2.2),state:'walk',venue:vi,
      wp:[[doorX+rand(-1.5,1.5),sideZ],[doorX+rand(-0.4,0.4),2.7]],
      timer:0,bob:Math.random()*10,exitX:Math.random()<0.5?-24:owned*SPACING+14};
    p.g.position.set(spawnX,0.17,sideZ);
    people.push(p);
  }
  function updateGuests(dt){
    spawnCooldown-=dt;
    if(people.length<targetCount()&&spawnCooldown<=0){
      spawnGuest();
      spawnCooldown=(rushUntil>S.gameTime)?rand(0.1,0.3):rand(0.25,0.9);
    }
    const night=nightFactor()>0.55;
    const wmult=walkSpeedMult();
    for(let i=people.length-1;i>=0;i--){
      const p=people[i];p.bob+=dt*9*p.speed*wmult;
      const arms=p.g.userData.arms;
      if(p.state==='walk'||p.state==='leave'){
        const wp=p.wp[0];
        if(!wp){
          if(p.state==='leave'){scene.remove(p.g);people.splice(i,1);continue;}
          const def=getDef(p.venue);
          if(night&&(def.form==='casino'||def.form==='park'||def.form==='ship')&&Math.random()<0.7){
            p.state='dance';p.timer=rand(5,14);
          }else{
            p.state='inside';p.timer=rand(3,9);p.g.visible=false;
          }
          continue;
        }
        const dx=wp[0]-p.g.position.x,dz=wp[1]-p.g.position.z;
        const dist=Math.hypot(dx,dz);
        if(dist<0.15){p.wp.shift();continue;}
        const mv=Math.min(dist,p.speed*wmult*dt);
        p.g.position.x+=dx/dist*mv;p.g.position.z+=dz/dist*mv;
        p.g.position.y=0.17+Math.abs(Math.sin(p.bob))*0.07;
        p.g.rotation.y=Math.atan2(dx,dz);
        if(arms){const sw=Math.sin(p.bob)*0.55;arms[0].rotation.x=sw;arms[1].rotation.x=-sw;}
      }else if(p.state==='inside'){
        p.timer-=dt;
        if(p.timer<=0){
          p.g.visible=true;p.state='leave';
          FX.bubble(p.g.position.x,1.7,p.g.position.z);
          guestTip(p.venue);
          p.wp=[[p.g.position.x+rand(-1,1),rand(3.2,4.6)],[p.exitX,rand(3.2,4.6)]];
        }
      }else if(p.state==='dance'){
        p.timer-=dt;
        p.g.position.y=0.17+Math.abs(Math.sin(p.bob*1.6))*0.24;
        p.g.rotation.y+=Math.sin(p.bob*0.7)*dt*2.5;
        if(arms){arms[0].rotation.z=0.9+Math.sin(p.bob*1.6)*0.5;arms[1].rotation.z=-0.9-Math.cos(p.bob*1.6)*0.5;}
        if(p.timer<=0){
          p.state='leave';
          if(arms){arms[0].rotation.z=0.22;arms[1].rotation.z=-0.22;}
          if(Math.random()<0.5)FX.bubble(p.g.position.x,1.7,p.g.position.z);
          guestTip(p.venue);
          p.wp=[[p.exitX,rand(3.2,4.6)]];
        }
      }
    }
  }

  /* ---------- Lieferautos ---------- */
  const carPalette=[0xe36a6a,0x6a9ee3,0xf2c14e,0x7ccd6a,0xb08fe0];
  function makeCar(){
    const g=new THREE.Group();
    const col=carPalette[randI(0,carPalette.length-1)];
    const body=new THREE.Mesh(roundedBoxGeo(1.9,0.55,0.95,0.2),new THREE.MeshStandardMaterial({color:col,roughness:.4,metalness:.15}));
    body.position.y=0.5;body.castShadow=true;g.add(body);
    const cab=new THREE.Mesh(roundedBoxGeo(1,0.45,0.88,0.18),new THREE.MeshStandardMaterial({color:0xd8e8f2,roughness:.2,metalness:.2}));
    cab.position.set(-0.15,0.95,0);g.add(cab);
    const boxM=new THREE.Mesh(roundedBoxGeo(0.5,0.35,0.5,0.1),new THREE.MeshStandardMaterial({color:0xf5efdd,roughness:.7}));
    boxM.position.set(0.55,1,0);g.add(boxM);
    const wheels=[];
    const wg=new THREE.CylinderGeometry(0.2,0.2,0.14,12);
    const wm=new THREE.MeshStandardMaterial({color:0x22242c,roughness:.9});
    [[-0.6,0.42],[0.6,0.42],[-0.6,-0.42],[0.6,-0.42]].forEach(pp=>{
      const w=new THREE.Mesh(wg,wm);w.rotation.x=Math.PI/2;
      w.position.set(pp[0],0.2,pp[1]);g.add(w);wheels.push(w);
    });
    const hl=new THREE.Mesh(new THREE.SphereGeometry(0.06,6,6),new THREE.MeshStandardMaterial({color:0xfff2c0,emissive:0xffe9a0,emissiveIntensity:0}));
    hl.position.set(0.95,0.5,0.28);g.add(hl);
    const hl2=hl.clone();hl2.position.z=-0.28;g.add(hl2);
    g.userData={wheels,lights:[hl.material,hl2.material]};
    scene.add(g);
    return g;
  }
  function updateCars(dt){
    const want=Math.min(1+upTier('liefer'),4);
    if(upTier('liefer')<1){for(const c of cars)scene.remove(c.g);cars=[];return;}
    while(cars.length<want){
      const dir=Math.random()<0.5?1:-1;
      const c={g:makeCar(),dir,speed:rand(5.5,8.5),
        x:rand(-20,S.venues.length*SPACING+10)};
      c.g.rotation.y=dir>0?Math.PI/2:-Math.PI/2;
      cars.push(c);
    }
    const N=nightFactor();
    const maxX=S.venues.length*SPACING+22;
    for(const c of cars){
      c.x+=c.dir*c.speed*dt;
      if(c.dir>0&&c.x>maxX)c.x=-24;
      if(c.dir<0&&c.x<-24)c.x=maxX;
      c.g.position.set(c.x,0,c.dir>0?6.7:9.9);
      for(const w of c.g.userData.wheels)w.rotation.y+=c.dir*c.speed*dt/0.2;
      for(const lm of c.g.userData.lights)lm.emissiveIntensity=N*1.4;
    }
  }

  /* ---------- Lieferdrohnen ---------- */
  function makeDrone(){
    const g=new THREE.Group();
    const core=new THREE.Mesh(roundedBoxGeo(0.4,0.16,0.4,0.07),new THREE.MeshStandardMaterial({color:0x3a4048,roughness:.5,metalness:.4}));
    g.add(core);
    const rotors=[];
    const rg=new THREE.CylinderGeometry(0.2,0.2,0.02,10);
    const rm=new THREE.MeshStandardMaterial({color:0x9aa0a8,roughness:.4,transparent:true,opacity:.7});
    [[-0.28,-0.28],[0.28,-0.28],[-0.28,0.28],[0.28,0.28]].forEach(p=>{
      const arm=new THREE.Mesh(boxGeo(0.06,0.04,0.28),new THREE.MeshStandardMaterial({color:0x3a4048}));
      arm.position.set(p[0]*0.6,0.05,p[1]*0.6);g.add(arm);
      const r=new THREE.Mesh(rg,rm);r.position.set(p[0],0.12,p[1]);g.add(r);rotors.push(r);
    });
    const pkg=new THREE.Mesh(roundedBoxGeo(0.26,0.22,0.26,0.05),new THREE.MeshStandardMaterial({color:0xc9a05f,roughness:.8}));
    pkg.position.y=-0.24;g.add(pkg);
    const light=new THREE.Mesh(new THREE.SphereGeometry(0.05,6,6),new THREE.MeshStandardMaterial({color:0xff4e4e,emissive:0xff2020,emissiveIntensity:0}));
    light.position.set(0,-0.06,0.22);g.add(light);
    g.userData={rotors,light:light.material};
    scene.add(g);
    return g;
  }
  function updateDrones(dt){
    const want=Math.min(upTier('drohne'),3);
    if(want<1){for(const d of drones)scene.remove(d.g);drones=[];return;}
    while(drones.length<want){
      drones.push({g:makeDrone(),t:rand(0,100),speed:rand(3,4.5),y:rand(8,12),ph:rand(0,6)});
    }
    const N=nightFactor();
    const maxX=S.venues.length*SPACING+20;
    for(const d of drones){
      d.t+=dt*d.speed;
      const x=(d.t*3)%(maxX+44)-22;
      d.g.position.set(x,d.y+Math.sin(d.t+d.ph)*0.8,Math.sin(d.t*0.6+d.ph)*4-1);
      d.g.rotation.z=Math.sin(d.t*1.4)*0.08;
      for(const r of d.g.userData.rotors)r.rotation.y+=dt*30;
      d.g.userData.light.emissiveIntensity=(Math.sin(S.gameTime*6)>0?1.5:0.2)*(0.2+N*0.8);
    }
  }

  /* ---------- Vögel (nur tagsüber unterwegs) ---------- */
  function makeBird(){
    const g=new THREE.Group();
    const bm=new THREE.MeshStandardMaterial({color:0x4a4e57,roughness:.8});
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.07,0.16,3,6),bm);
    body.rotation.z=Math.PI/2;g.add(body);
    const wings=[];
    [[-1],[1]].forEach(s=>{
      const w=new THREE.Mesh(new THREE.PlaneGeometry(0.4,0.16),new THREE.MeshStandardMaterial({color:0x5a5e67,side:THREE.DoubleSide,roughness:.8}));
      w.position.set(0,0.02,s[0]*0.22);w.rotation.x=Math.PI/2;
      g.add(w);wings.push(w);
    });
    g.userData={wings};
    scene.add(g);
    return g;
  }
  function updateBirds(dt){
    while(birds.length<4){
      birds.push({g:makeBird(),t:rand(0,6),cx:rand(0,80),cy:rand(9,14),cz:rand(6,20),r:rand(4,9),spd:rand(0.5,0.9)});
    }
    const day=1-nightFactor();
    for(const b of birds){
      b.t+=dt*b.spd;
      b.g.visible=day>0.3;
      b.g.position.set(b.cx+Math.cos(b.t)*b.r,b.cy+Math.sin(b.t*1.7)*0.7,b.cz+Math.sin(b.t)*b.r);
      b.g.rotation.y=-b.t+Math.PI/2;
      const flap=Math.sin(S.gameTime*10+b.t)*0.7;
      b.g.userData.wings[0].rotation.y=flap;
      b.g.userData.wings[1].rotation.y=-flap;
    }
  }

  function update(dt){
    updateGuests(dt);
    updateCars(dt);
    updateDrones(dt);
    updateBirds(dt);
  }
  function rush(vi,dur){rushVenue=vi;rushUntil=S.gameTime+dur;}
  function reset(){
    for(const p of people)scene.remove(p.g);
    people=[];rushVenue=-1;rushUntil=0;
  }
  return {init,update,rush,reset,makeStaffFigure};
})();
