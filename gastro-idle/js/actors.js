'use strict';
/* ============================================================
   actors.js — ACTORS: Charaktere, Autos, Drohnen, Vögel
   Art-Direction Charaktere: leicht übergroßer Kopf, klare
   Silhouette, echte Beine & Arme mit Schwung-Animation,
   Gesicht (Augen + Lächeln), Frisuren, zweiteilige Outfits.
   ============================================================ */
const ACTORS=(()=>{
  const PEOPLE_MAX=56;
  let people=[],cars=[],drones=[],birds=[];
  let P=null;                       // geteilte Geometrien
  let skinMats,hairMats,shirtMats,pantsMats,shoeMat,eyeMat,mouthMat,hatMats;
  let rushVenue=-1,rushUntil=0,spawnCooldown=0;
  const SKIN=[0xf5d0a9,0xe8b98a,0xc98d5f,0x8d5f3f,0xf6dcc4];
  const HAIR=[0x2a2320,0x5a3a22,0x8a5a2a,0xd8b06a,0x9a9ba0,0xb5482f,0x3d2c3f];
  const SHIRTS=[0xe36a6a,0x6a9ee3,0x6ac98f,0xe3b56a,0xb08fe0,0xe08fc2,0x8fd3e0,0xd3e08f,0xe0a58f,0x7fc9b0,0xf0e6d4,0x4a6a8a];
  const PANTS=[0x3a4050,0x5a4a3a,0x2e3a55,0x6b6f78,0x8a4a4a,0x3f5a44,0x2a2c33];

  function init(){
    P={
      torso:new THREE.CapsuleGeometry(0.185,0.3,4,10),
      head:new THREE.SphereGeometry(0.195,14,12),
      arm:new THREE.CapsuleGeometry(0.055,0.26,3,8),
      leg:new THREE.CapsuleGeometry(0.07,0.26,3,8),
      shoe:new THREE.SphereGeometry(0.085,8,6),
      eye:new THREE.SphereGeometry(0.028,6,6),
      mouth:new THREE.TorusGeometry(0.052,0.011,5,10,Math.PI*0.75),
      hairCap:new THREE.SphereGeometry(0.205,12,8,0,Math.PI*2,0,Math.PI*0.55),
      bangs:new THREE.BoxGeometry(0.3,0.09,0.1),
      bun:new THREE.SphereGeometry(0.09,8,6),
      longHair:new THREE.CylinderGeometry(0.19,0.14,0.3,10,1,true),
      hat:new THREE.CylinderGeometry(0.19,0.19,0.13,12),
      brim:new THREE.CylinderGeometry(0.28,0.28,0.03,12),
      toque:new THREE.CylinderGeometry(0.16,0.13,0.28,12),
      toqueTop:new THREE.SphereGeometry(0.165,10,8,0,Math.PI*2,0,Math.PI*0.5),
      apron:new THREE.BoxGeometry(0.3,0.34,0.04),
      tray:new THREE.CylinderGeometry(0.15,0.15,0.025,12),
    };
    const std=(c,r)=>new THREE.MeshStandardMaterial({color:c,roughness:r===undefined?.75:r});
    skinMats=SKIN.map(c=>std(c,.6));
    hairMats=HAIR.map(c=>std(c,.85));
    shirtMats=SHIRTS.map(c=>std(c,.8));
    pantsMats=PANTS.map(c=>std(c,.85));
    shoeMat=std(0x2a2521,.6);
    eyeMat=new THREE.MeshBasicMaterial({color:0x22242c});
    mouthMat=new THREE.MeshBasicMaterial({color:0x7a3f3a});
    hatMats=[0x3a3f4a,0xc9564a,0x4a7fc9,0xe0c04a].map(c=>std(c,.8));
  }

  /* ---------- Basis-Figur: Kopf, Torso, Arme mit Gelenk, Beine mit Gelenk ---------- */
  function makeHuman(o){
    const g=new THREE.Group();
    const skin=o.skin||skinMats[randI(0,skinMats.length-1)];
    // Beine (Drehpunkt an der Hüfte)
    const mkLeg=x=>{
      const pv=new THREE.Group();pv.position.set(x,0.56,0);
      const leg=new THREE.Mesh(P.leg,o.pants);leg.position.y=-0.2;leg.castShadow=true;pv.add(leg);
      const shoe=new THREE.Mesh(P.shoe,shoeMat);shoe.scale.set(1,0.6,1.4);shoe.position.set(0,-0.38,0.04);pv.add(shoe);
      g.add(pv);return pv;
    };
    const ll=mkLeg(-0.095),rl=mkLeg(0.095);
    // Torso
    const torso=new THREE.Mesh(P.torso,o.shirt);
    torso.position.y=0.82;torso.scale.set(1,1,0.86);torso.castShadow=true;g.add(torso);
    // Arme (Drehpunkt an der Schulter)
    const mkArm=x=>{
      const pv=new THREE.Group();pv.position.set(x,0.98,0);pv.rotation.z=x>0?-0.14:0.14;
      const arm=new THREE.Mesh(P.arm,o.shirt);arm.position.y=-0.15;pv.add(arm);
      const hand=new THREE.Mesh(P.eye,skin);hand.scale.set(1.8,1.8,1.8);hand.position.y=-0.31;pv.add(hand);
      g.add(pv);return pv;
    };
    const la=mkArm(-0.245),ra=mkArm(0.245);
    // Kopf mit Gesicht
    const head=new THREE.Mesh(P.head,skin);head.position.y=1.28;head.castShadow=true;g.add(head);
    [-0.068,0.068].forEach(x=>{
      const eye=new THREE.Mesh(P.eye,eyeMat);eye.position.set(x,1.31,0.172);g.add(eye);
    });
    const mouth=new THREE.Mesh(P.mouth,mouthMat);
    mouth.position.set(0,1.235,0.183);mouth.rotation.z=Math.PI+Math.PI*0.125;
    mouth.scale.set(1,0.8,0.5);g.add(mouth);
    // Frisur / Kopfbedeckung
    const hairM=o.hairMat||hairMats[randI(0,hairMats.length-1)];
    const style=o.hair!==undefined?o.hair:randI(0,4);
    if(style<=3){
      const cap=new THREE.Mesh(P.hairCap,hairM);cap.position.y=1.305;g.add(cap);
      if(style===1){const b=new THREE.Mesh(P.bangs,hairM);b.position.set(0,1.4,0.15);b.rotation.x=0.3;g.add(b);}
      if(style===2){const b=new THREE.Mesh(P.bun,hairM);b.position.set(0,1.44,-0.13);g.add(b);}
      if(style===3){const lh=new THREE.Mesh(P.longHair,hairM);lh.position.set(0,1.2,-0.05);g.add(lh);}
    }else{
      const hm=hatMats[randI(0,hatMats.length-1)];
      const hat=new THREE.Mesh(P.hat,hm);hat.position.y=1.45;g.add(hat);
      const brim=new THREE.Mesh(P.brim,hm);brim.position.y=1.39;g.add(brim);
    }
    g.userData.parts={la,ra,ll,rl,torso,head};
    return g;
  }
  function makeGuest(){
    const g=makeHuman({
      shirt:shirtMats[randI(0,shirtMats.length-1)],
      pants:pantsMats[randI(0,pantsMats.length-1)],
    });
    const s=rand(0.8,1.08);
    g.scale.set(s,s*rand(0.94,1.06),s);
    scene.add(g);
    return g;
  }
  /* Sitzende Deko-Gäste an Außentischen (statisch, gehören zum Gebäude) */
  function makeSeated(){
    if(!P)return null;
    const g=makeHuman({
      shirt:shirtMats[randI(0,shirtMats.length-1)],
      pants:pantsMats[randI(0,pantsMats.length-1)],
    });
    const p=g.userData.parts;
    p.ll.rotation.x=p.rl.rotation.x=-1.45;      // Beine nach vorn
    p.la.rotation.x=-0.7;p.ra.rotation.x=-0.7;  // Hände Richtung Tisch
    g.position.y=-0.18;                          // aufs Hockerniveau
    g.userData.seated=true;
    return g;
  }
  /* Personal: Uniform macht die Rolle sofort erkennbar */
  function makeStaffFigure(type){
    let g;
    const white=new THREE.MeshStandardMaterial({color:0xf5f2ea,roughness:.7});
    if(type==='chef'){
      g=makeHuman({shirt:white,pants:pantsMats[6],hair:randI(0,3)});
      const tq=new THREE.Mesh(P.toque,white);tq.position.y=1.52;g.add(tq);
      const tt=new THREE.Mesh(P.toqueTop,white);tt.position.y=1.66;g.add(tt);
      [[-0.05,0.95],[0.05,0.87]].forEach(p=>{   // Knopfreihe
        const b=new THREE.Mesh(P.eye,eyeMat);b.position.set(p[0],p[1],0.17);g.add(b);
      });
    }else if(type==='waiter'){
      g=makeHuman({shirt:white,pants:pantsMats[6],hair:randI(0,3)});
      const ap=new THREE.Mesh(P.apron,new THREE.MeshStandardMaterial({color:0x3f5a44,roughness:.85}));
      ap.position.set(0,0.72,0.16);g.add(ap);
      // Tablett hängt am Arm-Gelenk → bewegt sich beim Servieren mit
      const tray=new THREE.Mesh(P.tray,new THREE.MeshStandardMaterial({color:0xd8d8ce,metalness:.6,roughness:.3}));
      tray.position.set(0.05,-0.31,0.1);
      const cup=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.038,0.08,8),white);
      cup.position.set(0.05,-0.26,0.1);
      g.userData.parts.ra.add(tray);g.userData.parts.ra.add(cup);
    }else{ // Manager: dunkler Anzug + goldene Krawatte + Klemmbrett
      g=makeHuman({shirt:new THREE.MeshStandardMaterial({color:0x232838,roughness:.6}),
        pants:pantsMats[6],hair:randI(0,2)});
      const shirtV=new THREE.Mesh(P.apron,white);shirtV.scale.set(0.55,0.7,0.6);
      shirtV.position.set(0,0.9,0.155);g.add(shirtV);
      const tie=new THREE.Mesh(boxGeo(0.06,0.22,0.03),
        new THREE.MeshStandardMaterial({color:0xd4af37,metalness:.5,roughness:.4}));
      tie.position.set(0,0.87,0.185);g.add(tie);
      const board=new THREE.Mesh(boxGeo(0.2,0.28,0.02),
        new THREE.MeshStandardMaterial({color:0xc9a05f,roughness:.8}));
      board.position.set(0,-0.28,0.09);board.rotation.x=-0.5;
      g.userData.parts.la.add(board);
    }
    g.userData.role=type;
    g.rotation.y=Math.PI;
    return g;
  }

  /* ---------- Gäste-Logik ---------- */
  function targetCount(){
    const base=clamp(6+S.venues.length*4+Math.floor(Math.log10(Math.max(10,S.lifeEarned))),8,PEOPLE_MAX);
    return Math.round(base*WEATHER.crowdMult());
  }
  function spawnGuest(){
    const owned=S.venues.length;
    let vi=randI(0,owned-1);
    if(rushUntil>S.gameTime&&Math.random()<0.6)vi=rushVenue;
    const fromLeft=Math.random()<0.5;
    const spawnX=fromLeft?-24:owned*SPACING+14;
    const doorX=vi*SPACING,sideZ=rand(3.2,4.6);
    const p={g:makeGuest(),speed:rand(1.3,2.1),state:'walk',venue:vi,
      wp:[[doorX+rand(-1.5,1.5),sideZ],[doorX+rand(-0.4,0.4),2.7]],
      timer:0,bob:Math.random()*10,exitX:Math.random()<0.5?-24:owned*SPACING+14};
    p.g.position.set(spawnX,0.17,sideZ);
    // bei Regen kommen Gäste mit buntem Schirm
    if(WEATHER.isRainy()){
      const umb=new THREE.Group();
      const top=new THREE.Mesh(new THREE.ConeGeometry(0.42,0.22,10),
        shirtMats[randI(0,shirtMats.length-1)]);
      top.position.y=0.55;umb.add(top);
      const stick=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.6,6),shoeMat);
      stick.position.y=0.28;umb.add(stick);
      umb.position.set(0.05,-0.32,0.05);umb.rotation.x=Math.PI;   // Griff in der Hand
      p.g.userData.parts.la.add(umb);
      p.umb=true;
    }
    people.push(p);
  }
  function walkPose(p,sw){
    const pr=p.g.userData.parts;
    if(p.umb)pr.la.rotation.x=-2.75;               // Schirm hoch über den Kopf
    else pr.la.rotation.x=sw*0.65;
    pr.ra.rotation.x=-sw*0.65;
    pr.ll.rotation.x=-sw*0.7;pr.rl.rotation.x=sw*0.7;
    pr.torso.rotation.z=sw*0.035;
  }
  function idlePose(p,t){
    const pr=p.g.userData.parts;
    pr.la.rotation.x=Math.sin(t*1.4)*0.06;pr.ra.rotation.x=-Math.sin(t*1.4)*0.06;
    pr.ll.rotation.x=pr.rl.rotation.x=0;
    pr.torso.rotation.z=Math.sin(t*1.1)*0.02;
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
      const p=people[i];p.bob+=dt*8.5*p.speed*wmult;
      if(p.state==='walk'||p.state==='leave'){
        const wp=p.wp[0];
        if(!wp){
          if(p.state==='leave'){scene.remove(p.g);people.splice(i,1);continue;}
          const def=getDef(p.venue);
          if(night&&(def.form==='casino'||def.form==='park'||def.form==='ship')&&Math.random()<0.7){
            p.state='dance';p.timer=rand(5,14);
          }else if(Math.random()<0.22){        // kurz vor der Tür warten/umsehen
            p.state='wait';p.timer=rand(1.5,3.5);
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
        p.g.position.y=0.17+Math.abs(Math.sin(p.bob))*0.045;
        p.g.rotation.y=Math.atan2(dx,dz);
        walkPose(p,Math.sin(p.bob));
      }else if(p.state==='wait'){
        p.timer-=dt;
        idlePose(p,S.gameTime+p.bob);
        p.g.rotation.y+=Math.sin(S.gameTime*0.8+p.bob)*dt*0.5;  // umsehen
        if(p.timer<=0){p.state='inside';p.timer=rand(3,9);p.g.visible=false;}
      }else if(p.state==='inside'){
        p.timer-=dt;
        if(p.timer<=0){
          p.g.visible=true;p.state='leave';
          FX.bubble(p.g.position.x,1.85,p.g.position.z);
          guestTip(p.venue);
          p.wp=[[p.g.position.x+rand(-1,1),rand(3.2,4.6)],[p.exitX,rand(3.2,4.6)]];
        }
      }else if(p.state==='dance'){
        p.timer-=dt;
        const pr=p.g.userData.parts;
        p.g.position.y=0.17+Math.abs(Math.sin(p.bob*1.6))*0.22;
        p.g.rotation.y+=Math.sin(p.bob*0.7)*dt*2.5;
        pr.la.rotation.z=0.9+Math.sin(p.bob*1.6)*0.5;
        pr.ra.rotation.z=-0.9-Math.cos(p.bob*1.6)*0.5;
        if(p.timer<=0){
          p.state='leave';
          pr.la.rotation.z=0.14;pr.ra.rotation.z=-0.14;
          if(Math.random()<0.5)FX.bubble(p.g.position.x,1.85,p.g.position.z);
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
  function count(){return people.length;}
  return {init,update,rush,reset,makeStaffFigure,makeSeated,count};
})();
