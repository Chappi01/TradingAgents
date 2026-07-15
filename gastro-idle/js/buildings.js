'use strict';
/* ============================================================
   buildings.js — WORLD: alle Gebäude, ihre Animationen & Picking
   Jeder Betriebstyp hat einen eigenen Bauplan (form) mit
   charakteristischer Silhouette und animierten Details.
   ============================================================ */
const WORLD=(()=>{
  let buildings=[];        // Index → rec
  let pickMeshes=[];
  let neonLightCount=0;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();

  /* ---------- Material-Helfer ---------- */
  function mat(c,o){return new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.72},o));}
  function gold(){return mat(0xd4af37,{metalness:.75,roughness:.32});}
  function glassMat(){return mat(0xa8d4e8,{roughness:.15,metalness:.25});}
  function darker(c,f){return new THREE.Color(c).multiplyScalar(f||0.55).getHex();}

  function makeSignTexture(def){
    const c=document.createElement('canvas');c.width=256;c.height=88;
    const g=c.getContext('2d');
    const ac='#'+new THREE.Color(def.accent).getHexString();
    g.fillStyle='rgba(20,17,26,0.94)';roundRectPath(g,2,2,252,84,16);g.fill();
    g.strokeStyle=ac;g.lineWidth=4;roundRectPath(g,5,5,246,78,13);g.stroke();
    g.font='40px sans-serif';g.textBaseline='middle';g.fillText(def.emoji,14,48);
    g.fillStyle=ac;
    let fs=30;g.font='bold '+fs+'px sans-serif';
    while(g.measureText(def.name).width>182&&fs>12){fs-=2;g.font='bold '+fs+'px sans-serif';}
    g.fillText(def.name,62,48);
    const t=srgbTex(new THREE.CanvasTexture(c));t.anisotropy=4;return t;
  }
  function makeStripeTexture(c1,c2){
    const c=document.createElement('canvas');c.width=128;c.height=64;
    const g=c.getContext('2d');
    for(let i=0;i<8;i++){g.fillStyle=i%2?'#'+new THREE.Color(c1).getHexString():'#'+new THREE.Color(c2).getHexString();g.fillRect(i*16,0,16,64);}
    return srgbTex(new THREE.CanvasTexture(c));
  }
  /* Fensterraster als Textur für Hochhäuser: color- und emissiveMap zugleich */
  function makeWindowGridTexture(cols,rows,base){
    const c=document.createElement('canvas');c.width=cols*24;c.height=rows*24;
    const g=c.getContext('2d');
    g.fillStyle='#'+new THREE.Color(base).getHexString();g.fillRect(0,0,c.width,c.height);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      g.fillStyle=Math.random()<0.72?'#ffd98a':'#2a3448';
      g.fillRect(x*24+5,y*24+5,14,14);
    }
    return srgbTex(new THREE.CanvasTexture(c));
  }
  function makePizzaTexture(){
    const c=document.createElement('canvas');c.width=c.height=128;
    const g=c.getContext('2d');
    g.fillStyle='#e8b84b';g.beginPath();g.arc(64,64,60,0,7);g.fill();
    g.fillStyle='#d4522f';g.beginPath();g.arc(64,64,50,0,7);g.fill();
    g.fillStyle='#f2e28a';g.beginPath();g.arc(64,64,48,0,7);g.fill();
    g.fillStyle='#c9564a';
    for(let i=0;i<7;i++){const a=i*0.9,r=14+Math.random()*26;g.beginPath();g.arc(64+Math.cos(a)*r,64+Math.sin(a)*r,7,0,7);g.fill();}
    g.fillStyle='#5e9e50';
    for(let i=0;i<9;i++){const a=i*0.7+0.4,r=10+Math.random()*32;g.fillRect(64+Math.cos(a)*r,64+Math.sin(a)*r,5,3);}
    return srgbTex(new THREE.CanvasTexture(c));
  }
  function makeGlobeTexture(gcol,ocol){
    const c=document.createElement('canvas');c.width=128;c.height=64;
    const g=c.getContext('2d');
    g.fillStyle='#'+new THREE.Color(ocol).getHexString();g.fillRect(0,0,128,64);
    g.fillStyle='#'+new THREE.Color(gcol).getHexString();
    for(let i=0;i<9;i++){const x=Math.random()*128,y=8+Math.random()*48,r=6+Math.random()*12;
      g.beginPath();g.ellipse(x,y,r,r*0.6,Math.random()*3,0,7);g.fill();}
    return srgbTex(new THREE.CanvasTexture(c));
  }

  /* ---------- Bau-Bausteine ---------- */
  let _extra=0;   // aktuelle Ausbaustufe des Gebäudes → sichtbare Renovierung
  function block(g,w,h,d,color,r,y,z,x){
    const m=new THREE.Mesh(roundedBoxGeo(w,h,d,r===undefined?0.28:r),mat(wornColor(color,_extra)));
    m.position.set(x||0,(y||0),z||0);
    m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
  }
  function addSign(g,rec,def,y,z,w){
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(w||3.2,(w||3.2)*0.345),
      new THREE.MeshBasicMaterial({map:makeSignTexture(def),transparent:true}));
    sign.position.set(0,y,z);g.add(sign);rec.signMesh=sign;
  }
  function addDoor(g,w,h,z,color){
    const door=new THREE.Mesh(roundedBoxGeo(w,h,0.14,0.06),mat(color||0x3a2e28));
    door.position.set(0,h/2,z);g.add(door);return door;
  }
  function addWindows(g,rec,floors,W,D,FH,perFloor,skipGround){
    rec.winMat=mat(0xa8cfe8,{emissive:0xffc66b,emissiveIntensity:0,roughness:.25});
    rec.facade={W,D,FH,floors};
    const frameMat=mat(0xf2eee2,{roughness:.7});
    const trimMat=mat(0xe8e2d2,{roughness:.8});
    // Sockel + Geschossgesimse: Fassade bekommt Gliederung statt flacher Wand
    const plinth=new THREE.Mesh(roundedBoxGeo(W+0.18,0.4,D+0.18,0.12),mat(0x8a8478,{roughness:.9}));
    plinth.position.y=0.2;plinth.receiveShadow=true;g.add(plinth);
    for(let f=1;f<floors;f++){
      const cor=new THREE.Mesh(boxGeo(W+0.14,0.1,D+0.14),trimMat);
      cor.position.y=f*FH;g.add(cor);
    }
    rec.groundWins=[];
    for(let f=0;f<floors;f++){
      const y=f*FH+FH*0.6;
      for(let wx=0;wx<perFloor;wx++){
        const px=(wx-(perFloor-1)/2)*(W/(perFloor+0.4));
        if(f===0&&skipGround&&Math.abs(px)<0.9)continue;
        const frame=new THREE.Mesh(roundedBoxGeo(0.86,1.06,0.07,0.05),frameMat);
        frame.position.set(px,y,D/2+0.02);g.add(frame);
        const win=new THREE.Mesh(roundedBoxGeo(0.72,0.92,0.1,0.08),rec.winMat);
        win.position.set(px,y,D/2+0.04);g.add(win);
        const sill=new THREE.Mesh(boxGeo(0.92,0.06,0.16),trimMat);
        sill.position.set(px,y-0.56,D/2+0.08);g.add(sill);
        if(f===0)rec.groundWins.push(px);
      }
    }
  }
  /* Renovierungs-Deko: mit jeder Ausbaustufe wird der Betrieb sichtbar schöner */
  const GASTRO_FORMS=['cafe','pizza','burger','sushi','steak','hotel','luxury','casino'];
  function addRenovationDeco(g,rec,def){
    if(!rec.facade)return;
    const {W,D}=rec.facade;
    // Stufe 1+: Blumenkästen unter den Erdgeschossfenstern
    if(rec.extra>=1&&rec.groundWins){
      const boxMat=mat(0x7a4a30,{roughness:.85});
      const fls=[0xe36a8a,0xf2c14e,0xffffff,0xb08fe0];
      for(const px of rec.groundWins){
        const fb=new THREE.Mesh(roundedBoxGeo(0.8,0.18,0.22,0.05),boxMat);
        fb.position.set(px,0.85,D/2+0.16);g.add(fb);
        for(let k=0;k<3;k++){
          const fl=new THREE.Mesh(new THREE.SphereGeometry(0.055,6,5),
            new THREE.MeshBasicMaterial({color:fls[(k+Math.abs(px*7)|0)%4]}));
          fl.position.set(px-0.22+k*0.22,0.98,D/2+0.16);g.add(fl);
        }
      }
    }
    // Stufe 2+: Lichterkette über der Front (leuchtet nachts)
    if(rec.extra>=2){
      rec.bulbs=[];
      const cols=[0xffd98a,0x8ad9ff,0xff9ad9,0xa5ff8a];
      for(let b=0;b<9;b++){
        const t=b/8;
        const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.06,6,5),
          new THREE.MeshStandardMaterial({color:cols[b%4],emissive:cols[b%4],emissiveIntensity:0}));
        bulb.position.set(-W/2+t*W,rec.facade.FH*1.06-Math.sin(t*Math.PI)*0.35,D/2+0.3);
        g.add(bulb);rec.bulbs.push(bulb.material);
      }
    }
    // Stufe 3: Kübelpflanzen flankieren den Eingang
    if(rec.extra>=3){
      [[-1.1],[1.1]].forEach(p=>{
        const pot=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.17,0.34,10),mat(0x9a5b4a));
        pot.position.set(p[0],0.17,D/2+0.6);pot.castShadow=true;g.add(pot);
        const pl=new THREE.Mesh(new THREE.IcosahedronGeometry(0.26,1),mat(0x559a4c,{roughness:1}));
        pl.position.set(p[0],0.52,D/2+0.6);g.add(pl);
      });
    }
    // Schaufenster-Vitrine mit Speise-Auslage (links neben der Tür)
    if(GASTRO_FORMS.includes(def.form)&&def.form!=='casino')addShopfront(g,rec,def);
    // Kreidetafel mit Tagesangebot (Gastro-Charme, immer)
    if(GASTRO_FORMS.includes(def.form)&&def.form!=='casino'){
      const bt=makeChalkboardTexture(def);
      [[-0.12],[0.12]].forEach((p,side)=>{
        const b=new THREE.Mesh(new THREE.PlaneGeometry(0.62,0.82),
          side===0?new THREE.MeshStandardMaterial({map:bt,roughness:.9})
                  :new THREE.MeshStandardMaterial({color:0x2e2a26,roughness:.9}));
        b.position.set(W/2+0.9,0.45,D/2+1.1+p[0]*2);
        b.rotation.x=side===0?-0.22:0.22;
        b.rotation.y=side===0?0:Math.PI;
        g.add(b);
      });
    }
  }
  /* Schaufenster-Vorbau: warm beleuchtete Vitrine, in der die Speisen
     des Betriebs appetitlich ausliegen — nachts glüht sie gemütlich. */
  function addShopfront(g,rec,def){
    const {W,D}=rec.facade;
    const vw=Math.max(1.6,W/2-1.1),vh=1.05,vd=0.72;
    const cx=-W/4-0.35,cz=D/2+vd/2;
    const woodM=mat(0x4a3b2e,{roughness:.6});
    // Sockel, Deckel, Innenboden
    const base=new THREE.Mesh(roundedBoxGeo(vw+0.18,0.52,vd+0.14,0.07),woodM);
    base.position.set(cx,0.26,cz);base.castShadow=true;g.add(base);
    const top=new THREE.Mesh(roundedBoxGeo(vw+0.22,0.1,vd+0.18,0.05),woodM);
    top.position.set(cx,0.52+vh+0.05,cz);top.castShadow=true;g.add(top);
    // warm glühende Rückwand (nachts an)
    rec.vitrineGlow=new THREE.MeshStandardMaterial({color:0xf5e2c0,emissive:0xffc66b,emissiveIntensity:0.1,roughness:.8});
    const back=new THREE.Mesh(boxGeo(vw,vh,0.05),rec.vitrineGlow);
    back.position.set(cx,0.52+vh/2,cz-vd/2+0.03);g.add(back);
    // Glas vorn + Seiten
    const glassM=new THREE.MeshStandardMaterial({color:0xcfe6f2,roughness:.08,metalness:.2,transparent:true,opacity:.24});
    const gf=new THREE.Mesh(boxGeo(vw,vh,0.03),glassM);
    gf.position.set(cx,0.52+vh/2,cz+vd/2);g.add(gf);
    [[-1],[1]].forEach(s=>{
      const gs=new THREE.Mesh(boxGeo(0.03,vh,vd),glassM);
      gs.position.set(cx+s[0]*vw/2,0.52+vh/2,cz);g.add(gs);
    });
    // Auslage: stilisierte Speisen passend zum Betriebstyp
    const shelfY=0.56;
    const put=(m,dx,dy,dz)=>{m.position.set(cx+dx,shelfY+(dy||0),cz+(dz||0));g.add(m);return m;};
    const f=def.form;
    if(f==='cafe'){          // Torten & Tasse
      const cake=(c,x)=>{
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.12,14),mat(c,{roughness:.7})),x,0.06);
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.07,12),mat(0xf5e6d8,{roughness:.7})),x,0.16);
        put(new THREE.Mesh(new THREE.SphereGeometry(0.035,8,6),mat(0xc9302f,{roughness:.4})),x,0.22);
      };
      cake(0xd98aa5,-vw/4);cake(0x8a5a3a,vw/5);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.05,0.09,10),mat(0xf5f2ea,{roughness:.5})),vw/2.6,0.05);
    }else if(f==='pizza'){   // liegende + lehnende Pizza
      const pm=new THREE.MeshStandardMaterial({map:makePizzaTexture(),roughness:.7});
      const p1=put(new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.24,0.035,18),pm),-vw/5,0.02);
      const p2=put(new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.035,18),pm),vw/4,0.2,-0.12);
      p2.rotation.x=-1.15;
    }else if(f==='burger'){  // zwei Mini-Burger
      const bun=(x,r)=>{
        put(new THREE.Mesh(new THREE.CylinderGeometry(r,r*0.92,0.07,12),mat(0xe8b878,{roughness:.8})),x,0.03);
        put(new THREE.Mesh(new THREE.CylinderGeometry(r*1.05,r*1.05,0.05,12),mat(0x6a4a2e)),x,0.09);
        put(new THREE.Mesh(boxGeo(r*1.9,0.02,r*1.9),mat(0xf2c14e)),x,0.125);
        put(new THREE.Mesh(new THREE.SphereGeometry(r,12,8,0,Math.PI*2,0,Math.PI/2),mat(0xe8b878,{roughness:.8})),x,0.14);
      };
      bun(-vw/5,0.13);bun(vw/4,0.1);
    }else if(f==='sushi'){   // Sushi-Brett mit Rollen
      put(new THREE.Mesh(boxGeo(0.7,0.04,0.3),mat(0x8a6a4a,{roughness:.8})),0,0.01);
      for(let k=0;k<4;k++){
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.09,10),mat(0xf5f2ea,{roughness:.6})),-0.24+k*0.16,0.075);
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.02,8),
          mat([0xe36a5a,0xf2a05e,0x7ccd6a,0xd98aa5][k],{roughness:.4})),-0.24+k*0.16,0.13);
      }
    }else if(f==='steak'){   // Steaks auf dem Brett
      put(new THREE.Mesh(boxGeo(0.66,0.04,0.34),mat(0x8a6a4a,{roughness:.8})),0,0.01);
      [[-0.15,0.6],[0.16,-0.4]].forEach(p=>{
        const st=put(new THREE.Mesh(roundedBoxGeo(0.26,0.07,0.19,0.05),mat(0x9e3f36,{roughness:.55})),p[0],0.075);
        st.rotation.y=p[1];
      });
    }else{                   // Hotel/Luxus: Flaschen & Gläser
      [[-0.2,0x3f6a4a],[0,0x7a4a30],[0.2,0xd4af37]].forEach(p=>{
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.055,0.3,10),
          mat(p[1],{roughness:.25,metalness:.3})),p[0],0.15);
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.09,8),mat(p[1])),p[0],0.34);
      });
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.03,0.12,10),
        new THREE.MeshStandardMaterial({color:0xcfe6f2,roughness:.1,transparent:true,opacity:.5})),0.38,0.06);
    }
  }
  function makeChalkboardTexture(def){
    const c=document.createElement('canvas');c.width=96;c.height=128;
    const g=c.getContext('2d');
    g.fillStyle='#2e2a26';g.fillRect(0,0,96,128);
    g.strokeStyle='#8a7a5a';g.lineWidth=5;g.strokeRect(3,3,90,122);
    g.fillStyle='#e8e2d2';g.font='bold 15px sans-serif';g.textAlign='center';
    g.fillText('HEUTE',48,30);
    g.font='22px sans-serif';g.fillText(def.emoji,48,62);
    g.strokeStyle='#cfc8b4';g.lineWidth=2;
    [80,94,108].forEach((y,i)=>{g.beginPath();g.moveTo(18,y);g.lineTo(18+[58,44,50][i],y);g.stroke();});
    return srgbTex(new THREE.CanvasTexture(c));
  }
  /* geschwungene Markise: halber Zylindermantel */
  function addAwning(g,def,y,z,w){
    const tex=makeStripeTexture(def.accent,0xf4efe4);
    const aw=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,w||3,12,1,true,0,Math.PI*0.52),
      new THREE.MeshStandardMaterial({map:tex,side:THREE.DoubleSide,roughness:.85}));
    aw.rotation.z=Math.PI/2;aw.rotation.y=Math.PI*0.74;
    aw.position.set(0,y,z);aw.castShadow=true;g.add(aw);
  }
  function addTables(g,def,D){
    const topMat=mat(0xf0e8d4,{roughness:.7});
    const legMat=mat(0x4a4a4a,{metalness:.5,roughness:.5});
    [[-1.9,D/2+1.4],[1.9,D/2+1.4]].forEach(p=>{
      const top=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.07,14),topMat);
      top.position.set(p[0],0.78,p[1]);top.castShadow=true;g.add(top);
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.08,0.78,8),legMat);
      leg.position.set(p[0],0.39,p[1]);g.add(leg);
      const um=new THREE.Mesh(new THREE.ConeGeometry(0.9,0.42,8,1,true),
        new THREE.MeshStandardMaterial({map:makeStripeTexture(def.accent,0xf4efe4),side:THREE.DoubleSide,roughness:.85}));
      um.position.set(p[0],1.9,p[1]);g.add(um);
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.5,6),legMat);
      pole.position.set(p[0],1.1,p[1]);g.add(pole);
      for(let st=0;st<2;st++){
        const sx=p[0]+(st?0.78:-0.78),sz=p[1]+rand(-0.15,0.15);
        const stool=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.17,0.44,10),legMat);
        stool.position.set(sx,0.22,sz);g.add(stool);
        // Teller & Tasse auf dem Tisch — kleine glaubwürdige Details
        if(st===0){
          const plate=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,0.02,12),topMat);
          plate.position.set(p[0]+rand(-0.2,0.2),0.83,p[1]+rand(-0.2,0.2));g.add(plate);
          const cup=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.04,0.09,8),
            mat(0xf5f2ea,{roughness:.5}));
          cup.position.set(p[0]+rand(-0.3,0.3),0.87,p[1]+rand(-0.3,0.3));g.add(cup);
        }
        // sitzende Gäste (statische Deko, ~55 % Belegung)
        if(Math.random()<0.55&&typeof ACTORS!=='undefined'){
          const guest=ACTORS.makeSeated();
          if(guest){
            guest.position.set(sx,0.28,sz);
            guest.rotation.y=Math.atan2(p[0]-sx,p[1]-sz);
            guest.scale.multiplyScalar(0.92);
            g.add(guest);
          }
        }
      }
    });
  }
  function addNeonStrips(g,rec,W,H,D,color){
    const nm=new THREE.MeshBasicMaterial({color});
    rec.neonMats.push(nm);
    [[-W/2-0.08,D/2+0.04],[W/2+0.08,D/2+0.04]].forEach(p=>{
      const strip=new THREE.Mesh(boxGeo(0.13,H,0.13),nm);
      strip.position.set(p[0],H/2,p[1]);g.add(strip);
    });
    const topStrip=new THREE.Mesh(boxGeo(W+0.34,0.13,0.13),nm);
    topStrip.position.set(0,H+0.28,D/2+0.04);g.add(topStrip);
    if(neonLightCount<5){
      rec.light=new THREE.PointLight(color,0,17,2);
      rec.light.position.set(0,3,D/2+2.2);g.add(rec.light);
      neonLightCount++;
    }
  }
  function addChimney(g,x,y,z,color){
    const ch=new THREE.Mesh(roundedBoxGeo(0.5,0.9,0.5,0.1),mat(color||0x9a5b4a));
    ch.position.set(x,y+0.45,z);ch.castShadow=true;g.add(ch);
    FX.addSteam(g,x,y+1,z,1);
  }
  function anim(rec,part){rec.anims.push(part);}

  /* ---------- Bauplan je Betriebstyp ----------
     Jede Funktion baut in Gruppe g und liefert die Gesamthöhe. */
  const FORMS={
    cart(g,def,extra,rec){
      const b=block(g,4.4,1.9,2.4,def.base,0.34,1.35,0.5);
      block(g,4.6,0.16,2.6,darker(def.base),0.08,2.4,0.5);
      const wheelG=new THREE.CylinderGeometry(0.45,0.45,0.28,14);
      const wheelM=mat(0x2a2c33,{roughness:.9});
      [[-1.5],[1.5]].forEach(p=>{
        const w=new THREE.Mesh(wheelG,wheelM);w.rotation.x=Math.PI/2;
        w.position.set(p[0],0.45,0.5);g.add(w);
        const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,0.3,10),mat(0xd8d8ce));
        hub.rotation.x=Math.PI/2;hub.position.set(p[0],0.45,0.5);g.add(hub);
      });
      // Verkaufsklappe + Tresen
      rec.winMat=mat(0xbfe8ff,{emissive:0xffc66b,emissiveIntensity:0,roughness:.25});
      const hatch=new THREE.Mesh(roundedBoxGeo(2.6,0.95,0.1,0.1),rec.winMat);
      hatch.position.set(0,1.75,1.75);g.add(hatch);
      const counter=new THREE.Mesh(roundedBoxGeo(3,0.14,0.5,0.06),mat(0xf0e8d4));
      counter.position.set(0,1.2,1.95);g.add(counter);
      // Schirm
      const um=new THREE.Mesh(new THREE.ConeGeometry(1.7,0.8,10,1,true),
        new THREE.MeshStandardMaterial({map:makeStripeTexture(def.accent,0xf4efe4),side:THREE.DoubleSide,roughness:.85}));
      um.position.set(-1.2,3.5,1.4);g.add(um);
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2.6,6),mat(0x8a8a8a));
      pole.position.set(-1.2,2.2,1.4);g.add(pole);
      FX.addSteam(g,1.4,2.6,0.4,0.8);
      addSign(g,rec,def,3.3,1.3,2.8);
      return 3.6;
    },
    cafe(g,def,extra,rec){
      const floors=1+extra,FH=2.4,H=floors*FH,W=5,D=4.4;
      block(g,W,H,D,def.base,0.3,H/2);
      block(g,W+0.5,0.3,D+0.5,def.roof,0.14,H+0.15);
      addDoor(g,1.15,1.8,D/2+0.06);
      addWindows(g,rec,floors,W,D,FH,3,true);
      addAwning(g,def,2.1,D/2+0.5,3.2);
      addSign(g,rec,def,H+0.75,D/2-0.4,3);
      addTables(g,def,D);
      FX.addSteam(g,W/2-0.7,H+0.4,-D/2+0.8,0.7);
      return H+1.2;
    },
    pizza(g,def,extra,rec){
      const floors=1+extra,FH=2.4,H=Math.max(2.6,floors*FH),W=5,D=4.4;
      block(g,W,H,D,def.base,0.3,H/2);
      block(g,W+0.5,0.3,D+0.5,def.roof,0.14,H+0.15);
      addDoor(g,1.15,1.8,D/2+0.06,0x5a3a28);
      addWindows(g,rec,floors,W,D,FH,3,true);
      addAwning(g,def,2.1,D/2+0.5,3.2);
      // Steinofen-Kuppel mit Schornstein
      const dome=new THREE.Mesh(new THREE.SphereGeometry(1,14,10,0,Math.PI*2,0,Math.PI/2),mat(0xc9b8a0,{roughness:.95}));
      dome.position.set(W/2+0.9,0.9,0.4);dome.castShadow=true;g.add(dome);
      block(g,1.9,0.9,1.9,0xb8a68c,0.2,0.45,0.4,W/2+0.9);
      addChimney(g,W/2+0.9,1.7,0.4,0x8a6a55);
      // rotierendes Pizza-Schild
      const pz=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,0.12,20),
        new THREE.MeshStandardMaterial({map:makePizzaTexture(),roughness:.7}));
      pz.rotation.x=Math.PI/2;
      const holder=new THREE.Group();holder.add(pz);
      holder.position.set(-W/2-0.6,H+1,0.5);g.add(holder);
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,1.6,6),mat(0x4a4a4a,{metalness:.5}));
      pole.position.set(-W/2-0.6,H+0.2,0.5);g.add(pole);
      anim(rec,{kind:'spin',m:holder,axis:'z',spd:0.8});
      addSign(g,rec,def,H+0.75,D/2-0.4,3);
      return H+2;
    },
    burger(g,def,extra,rec){
      const floors=1+extra,FH=2.4,H=floors*FH,W=5.2,D=4.4;
      block(g,W,H,D,def.base,0.34,H/2);
      block(g,W+0.5,0.34,D+0.5,def.roof,0.16,H+0.17);
      addDoor(g,1.3,1.85,D/2+0.06,0x6a2a24);
      addWindows(g,rec,floors,W,D,FH,3,true);
      // Riesen-Burger auf dem Dach (dreht langsam)
      const bg=new THREE.Group();
      const bun=(r,h,y,c)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r*0.94,h,18),mat(c,{roughness:.8}));m.position.y=y;m.castShadow=true;bg.add(m);};
      bun(1.15,0.36,0.18,0xe8b878);                       // Unterseite
      bun(1.2,0.3,0.5,0x6a4a2e);                          // Patty
      const cheese=new THREE.Mesh(boxGeo(1.9,0.1,1.9),mat(0xf2c14e,{roughness:.6}));
      cheese.position.y=0.7;cheese.rotation.y=0.6;bg.add(cheese);
      bun(1.14,0.26,0.88,0x7ccd6a);                       // Salat
      const top=new THREE.Mesh(new THREE.SphereGeometry(1.2,18,12,0,Math.PI*2,0,Math.PI/2),mat(0xe8b878,{roughness:.8}));
      top.position.y=1;top.castShadow=true;bg.add(top);
      for(let i=0;i<7;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(0.045,5,4),mat(0xfff2d8));
        const a=rand(0,6.3),r=rand(0.2,0.9);s.position.set(Math.cos(a)*r,1+Math.sqrt(Math.max(0,1.4-r*r))*0.85,Math.sin(a)*r);bg.add(s);}
      bg.position.set(0,H+0.35,0);g.add(bg);
      anim(rec,{kind:'spin',m:bg,axis:'y',spd:0.4});
      addSign(g,rec,def,1.4,D/2+0.09,2.6);
      FX.addSteam(g,W/2-0.7,H+0.4,-D/2+0.8,0.8);
      return H+2.6;
    },
    sushi(g,def,extra,rec){
      const floors=1+extra,FH=2.4,H=floors*FH,W=5,D=4.4;
      block(g,W,H,D,def.base,0.26,H/2);
      const roof=new THREE.Mesh(roundedBoxGeo(W+0.9,0.34,D+0.9,0.16),mat(def.roof));
      roof.position.y=H+0.17;roof.castShadow=true;g.add(roof);
      addDoor(g,1.3,1.85,D/2+0.06,0x1e2028);
      addWindows(g,rec,floors,W,D,FH,3,true);
      // Torii-Rahmen vor der Tür
      const tm=mat(def.roof,{roughness:.6});
      [[-1.1],[1.1]].forEach(p=>{
        const post=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.13,2.6,10),tm);
        post.position.set(p[0],1.3,D/2+0.75);post.castShadow=true;g.add(post);
      });
      const bar1=new THREE.Mesh(roundedBoxGeo(3,0.18,0.3,0.08),tm);
      bar1.position.set(0,2.65,D/2+0.75);g.add(bar1);
      const bar2=new THREE.Mesh(roundedBoxGeo(2.5,0.14,0.26,0.06),tm);
      bar2.position.set(0,2.3,D/2+0.75);g.add(bar2);
      // schwingende Papierlaternen
      rec.neonMats=rec.neonMats||[];
      [[-1.7],[1.7]].forEach((p,j)=>{
        const holder=new THREE.Group();
        const lm=new THREE.MeshStandardMaterial({color:0xffe8d0,emissive:0xffb14e,emissiveIntensity:0});
        const lan=new THREE.Mesh(new THREE.SphereGeometry(0.26,10,10),lm);
        lan.scale.y=1.3;lan.position.y=-0.35;holder.add(lan);
        rec.lanterns=rec.lanterns||[];rec.lanterns.push(lm);
        holder.position.set(p[0],2.55,D/2+0.75);g.add(holder);
        anim(rec,{kind:'swing',m:holder,amp:0.25,spd:1.2+j*0.3});
      });
      addSign(g,rec,def,H+0.85,D/2-0.4,3);
      return H+1.3;
    },
    steak(g,def,extra,rec){
      const floors=1+extra,FH=2.5,H=floors*FH,W=5.4,D=4.6;
      block(g,W,H,D,def.base,0.22,H/2);
      // Holzlattenoptik: horizontale Balken
      for(let b=0;b<floors*3;b++){
        const beam=new THREE.Mesh(boxGeo(W+0.06,0.09,D+0.06),mat(darker(def.base,0.72)));
        beam.position.y=0.5+b*0.8;g.add(beam);
      }
      block(g,W+0.6,0.36,D+0.6,def.roof,0.14,H+0.18);
      addDoor(g,1.4,1.9,D/2+0.06,0x2a1e16);
      addWindows(g,rec,floors,W,D,FH,3,true);
      addChimney(g,W/2-0.8,H+0.36,-D/2+0.9,0x5a4636);
      // Grill vor der Tür mit Glut
      const grill=new THREE.Mesh(roundedBoxGeo(1.1,0.5,0.6,0.1),mat(0x2a2c33,{metalness:.6,roughness:.5}));
      grill.position.set(1.9,0.65,D/2+1.2);g.add(grill);
      const ember=new THREE.Mesh(boxGeo(0.9,0.08,0.44),new THREE.MeshStandardMaterial({color:0xff6a2a,emissive:0xff4e1a,emissiveIntensity:.8}));
      ember.position.set(1.9,0.93,D/2+1.2);g.add(ember);
      FX.addSteam(g,1.9,1.1,D/2+1.2,0.6,0xb8b8b8);
      addSign(g,rec,def,H+0.85,D/2-0.4,3.1);
      return H+1.4;
    },
    hotel(g,def,extra,rec){
      const floors=4+extra,FH=2.1,H=floors*FH,W=5.6,D=4.8;
      block(g,W,H,D,def.base,0.26,H/2);
      const mans=new THREE.Mesh(roundedBoxGeo(W+0.7,1.1,D+0.7,0.4),mat(def.roof));
      mans.position.y=H+0.55;mans.castShadow=true;g.add(mans);
      addWindows(g,rec,floors,W,D,FH,4,true);
      addDoor(g,1.5,2,D/2+0.06,0x3a2e28);
      // goldenes Vordach + Fahne
      const canopy=new THREE.Mesh(roundedBoxGeo(2.2,0.14,1.2,0.07),gold());
      canopy.position.set(0,2.2,D/2+0.6);canopy.castShadow=true;g.add(canopy);
      const fp=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,2.4,6),mat(0xb8b8b8,{metalness:.7}));
      fp.position.set(0,H+2.2,0);g.add(fp);
      const flag=new THREE.Mesh(new THREE.PlaneGeometry(1.2,0.7),
        new THREE.MeshStandardMaterial({color:def.accent,side:THREE.DoubleSide,roughness:.8}));
      flag.position.set(0.62,H+3,0);g.add(flag);
      anim(rec,{kind:'flag',m:flag});
      addSign(g,rec,def,2.9,D/2+0.09,2.9);
      return H+3.4;
    },
    luxury(g,def,extra,rec){
      const floors=2+extra,FH=2.6,H=floors*FH,W=5.4,D=4.6;
      block(g,W,H,D,def.base,0.3,H/2);
      // Goldkanten
      const gm=gold();
      [[-W/2-0.06],[W/2+0.06]].forEach(p=>{
        const strip=new THREE.Mesh(boxGeo(0.12,H,0.12),gm);
        strip.position.set(p[0],H/2,D/2+0.02);g.add(strip);
      });
      const crown=new THREE.Mesh(roundedBoxGeo(W+0.6,0.4,D+0.6,0.18),gm);
      crown.position.y=H+0.2;crown.castShadow=true;g.add(crown);
      addWindows(g,rec,floors,W,D,FH,3,true);
      addDoor(g,1.5,2.1,D/2+0.06,0x1c1a24);
      // roter Teppich + Absperrpfosten
      const carpet=new THREE.Mesh(boxGeo(1.6,0.05,2.6),mat(0xb2303f,{roughness:.9}));
      carpet.position.set(0,0.03,D/2+1.4);carpet.receiveShadow=true;g.add(carpet);
      [[-1,-0.5],[1,-0.5],[-1,1],[1,1]].forEach(p=>{
        const post=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,0.9,8),gm);
        post.position.set(p[0],0.45,D/2+1.4+p[1]);g.add(post);
        const ball=new THREE.Mesh(new THREE.SphereGeometry(0.09,8,8),gm);
        ball.position.set(p[0],0.95,D/2+1.4+p[1]);g.add(ball);
      });
      // Springbrunnen
      const basin=new THREE.Mesh(new THREE.CylinderGeometry(0.9,1,0.4,16),mat(0xdcd8cc));
      basin.position.set(-2.9,0.2,D/2+1.6);basin.castShadow=true;g.add(basin);
      const water=new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.75,0.1,16),mat(0x7fc4e8,{roughness:.2}));
      water.position.set(-2.9,0.42,D/2+1.6);g.add(water);
      FX.addSteam(g,-2.9,0.6,D/2+1.6,0.45,0xdff2ff);
      addSign(g,rec,def,H+0.9,D/2-0.4,3.1);
      return H+1.4;
    },
    ship(g,def,extra,rec){
      // Wasserbecken + Rumpf + Decks + Schornsteine, sanft schaukelnd
      const water=new THREE.Mesh(roundedBoxGeo(9,0.3,7,0.8),mat(0x4a9ed4,{roughness:.25}));
      water.position.set(0,0.02,-0.4);water.receiveShadow=true;g.add(water);
      const shipG=new THREE.Group();
      const hull=new THREE.Mesh(roundedBoxGeo(8,1.5,3.4,0.7),mat(0x2e3644,{roughness:.6}));
      hull.position.y=1;hull.castShadow=true;shipG.add(hull);
      const deck1=new THREE.Mesh(roundedBoxGeo(7,1.1,2.9,0.4),mat(def.base));deck1.position.y=2.2;deck1.castShadow=true;shipG.add(deck1);
      const deck2=new THREE.Mesh(roundedBoxGeo(5.4,1,2.4,0.35),mat(def.base));deck2.position.y=3.25;deck2.castShadow=true;shipG.add(deck2);
      const deck3=new THREE.Mesh(roundedBoxGeo(3.6,0.9,2,0.3),mat(def.base));deck3.position.y=4.2;deck3.castShadow=true;shipG.add(deck3);
      // Bullaugen
      rec.winMat=mat(0xa8cfe8,{emissive:0xffc66b,emissiveIntensity:0,roughness:.25});
      for(let i=0;i<7;i++){
        const p=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,0.06,10),rec.winMat);
        p.rotation.x=Math.PI/2;p.position.set(-2.7+i*0.9,2.2,1.5);shipG.add(p);
      }
      // Schornsteine mit Dampf
      [[-1],[0.8]].forEach(p=>{
        const fun=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.42,1.3,12),mat(def.roof));
        fun.position.set(p[0],5.2,0);fun.castShadow=true;shipG.add(fun);
        const ring=new THREE.Mesh(new THREE.CylinderGeometry(0.36,0.36,0.22,12),mat(0x2e3644));
        ring.position.set(p[0],5.75,0);shipG.add(ring);
        FX.addSteam(shipG,p[0],5.9,0,0.9);
      });
      g.add(shipG);
      anim(rec,{kind:'boat',m:shipG});
      addSign(g,rec,def,1.1,3.3,2.8);
      return 7;
    },
    park(g,def,extra,rec){
      // Eingangstor
      const tm=mat(def.roof);
      [[-2.2],[2.2]].forEach(p=>{
        const post=new THREE.Mesh(roundedBoxGeo(0.6,3.4,0.6,0.2),tm);
        post.position.set(p[0],1.7,2.2);post.castShadow=true;g.add(post);
        const ball=new THREE.Mesh(new THREE.SphereGeometry(0.34,12,10),mat(def.accent));
        ball.position.set(p[0],3.7,2.2);g.add(ball);
      });
      const arch=new THREE.Mesh(roundedBoxGeo(5.2,0.8,0.7,0.3),tm);
      arch.position.set(0,3.4,2.2);arch.castShadow=true;g.add(arch);
      addSign(g,rec,def,3.4,2.6,3);
      // Kassenhäuschen
      block(g,1.8,1.8,1.5,def.base,0.2,0.9,1.6,-2.9);
      block(g,2,0.2,1.7,def.accent,0.1,1.9,1.6,-2.9);
      // Riesenrad!
      const wheel=new THREE.Group();
      const rim=new THREE.Mesh(new THREE.TorusGeometry(2.6,0.09,10,40),mat(def.accent,{metalness:.4}));
      wheel.add(rim);
      const gondCols=[0xe36a8a,0xf2c14e,0x6a9ee3,0x7ccd6a,0xb08fe0,0xff8fa5,0x4ef2e0,0xffb14e];
      rec.gondolas=[];
      for(let i=0;i<8;i++){
        const a=i/8*Math.PI*2;
        const spoke=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,2.6,6),mat(0xb8bcc4,{metalness:.5}));
        spoke.position.set(Math.cos(a)*1.3,Math.sin(a)*1.3,0);
        spoke.rotation.z=a+Math.PI/2;wheel.add(spoke);
        const gond=new THREE.Mesh(roundedBoxGeo(0.6,0.55,0.5,0.16),mat(gondCols[i]));
        gond.position.set(Math.cos(a)*2.6,Math.sin(a)*2.6,0);
        wheel.add(gond);rec.gondolas.push(gond);
      }
      wheel.position.set(0.4,3.4,-1.6);g.add(wheel);
      anim(rec,{kind:'wheel',m:wheel,spd:0.25});
      // Stützen
      [[-1],[1.8]].forEach(p=>{
        const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.12,3.6,8),mat(0xb8bcc4,{metalness:.5}));
        leg.position.set(0.4+p[0]*0.8,1.7,-1.6);leg.rotation.z=p[0]*0.3;g.add(leg);
      });
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,0.5,10),gold());
      hub.rotation.x=Math.PI/2;hub.position.set(0.4,3.4,-1.6);g.add(hub);
      return 6.6;
    },
    casino(g,def,extra,rec){
      const floors=2+extra,FH=2.6,H=floors*FH,W=5.6,D=4.6;
      block(g,W,H,D,def.base,0.3,H/2);
      const band=new THREE.Mesh(roundedBoxGeo(W+0.5,0.5,D+0.5,0.2),gold());
      band.position.y=H+0.25;band.castShadow=true;g.add(band);
      addWindows(g,rec,floors,W,D,FH,3,true);
      addDoor(g,1.6,2.1,D/2+0.06,0x14101c);
      addNeonStrips(g,rec,W,H,D,def.accent);
      // rotierender Riesen-Würfel
      const dice=new THREE.Group();
      const cube=new THREE.Mesh(roundedBoxGeo(1.5,1.5,1.5,0.28),mat(0xf5f2ea,{roughness:.4}));
      cube.castShadow=true;dice.add(cube);
      const dot=new THREE.SphereGeometry(0.13,8,8);
      const dm=mat(0x1c1a24);
      [[0,0.72,0],                                        // oben: 1
       [-0.3,0.3,0.72],[0.3,-0.3,0.72],                   // vorn: 2
       [0.72,0.3,0.3],[0.72,0,0],[0.72,-0.3,-0.3]         // rechts: 3
      ].forEach(p=>{
        const d0=new THREE.Mesh(dot,dm);d0.position.set(p[0],p[1],p[2]);cube.add(d0);
      });
      dice.position.set(0,H+1.4,0);g.add(dice);
      anim(rec,{kind:'spin',m:dice,axis:'y',spd:0.5});
      anim(rec,{kind:'spin',m:cube,axis:'x',spd:0.2});
      addSign(g,rec,def,2.95,D/2+0.09,3);
      return H+2.4;
    },
    airport(g,def,extra,rec){
      // Terminal mit Glasfront
      const W=7,D=4.6,H=2.6+extra*0.8;
      block(g,W,H,D,def.base,0.4,H/2);
      rec.winMat=mat(0xa8d4e8,{emissive:0xffc66b,emissiveIntensity:0,roughness:.15,metalness:.2});
      const glass=new THREE.Mesh(roundedBoxGeo(W-0.8,H*0.55,0.12,0.1),rec.winMat);
      glass.position.set(0,H*0.5,D/2+0.05);g.add(glass);
      const roof=new THREE.Mesh(roundedBoxGeo(W+0.8,0.3,D+0.8,0.4),mat(def.roof));
      roof.position.y=H+0.15;roof.castShadow=true;g.add(roof);
      // Tower
      const tw=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.65,4.6,12),mat(0xe8e4da));
      tw.position.set(-2.4,2.3,-1.4);tw.castShadow=true;g.add(tw);
      const cab=new THREE.Mesh(new THREE.CylinderGeometry(1,0.8,0.9,12),glassMat());
      cab.position.set(-2.4,5,-1.4);cab.castShadow=true;g.add(cab);
      const cap=new THREE.Mesh(new THREE.ConeGeometry(1.05,0.5,12),mat(def.roof));
      cap.position.set(-2.4,5.7,-1.4);g.add(cap);
      // Radar dreht
      const radar=new THREE.Group();
      const dish=new THREE.Mesh(roundedBoxGeo(1,0.5,0.08,0.05),mat(0xd8d8ce));
      dish.position.x=0.3;radar.add(dish);
      radar.position.set(-2.4,6.1,-1.4);g.add(radar);
      anim(rec,{kind:'spin',m:radar,axis:'y',spd:1.6});
      // kreisendes Flugzeug
      const plane=new THREE.Group();
      const fus=new THREE.Mesh(new THREE.CapsuleGeometry(0.22,1.3,4,10),mat(0xf2f0ea));
      fus.rotation.z=Math.PI/2;plane.add(fus);
      const wing=new THREE.Mesh(boxGeo(0.7,0.06,2.4),mat(def.accent));plane.add(wing);
      const tail=new THREE.Mesh(boxGeo(0.34,0.5,0.08),mat(def.accent));
      tail.position.set(-0.8,0.25,0);plane.add(tail);
      g.add(plane);
      anim(rec,{kind:'orbit',m:plane,cx:0,cy:H+5.5,cz:-1,r:6.5,spd:0.5,t:rand(0,6)});
      addSign(g,rec,def,H+0.8,D/2-0.3,3.2);
      return H+7;
    },
    tower(g,def,extra,rec){
      const H=9+extra*1.4,W=4.6,D=4.2;
      const tex=makeWindowGridTexture(6,12,def.base);
      const bodyMat=new THREE.MeshStandardMaterial({map:tex,emissiveMap:tex,emissive:0xffffff,emissiveIntensity:0,roughness:.6});
      rec.towerMat=bodyMat;
      const body=new THREE.Mesh(roundedBoxGeo(W,H,D,0.3),bodyMat);
      body.position.y=H/2;body.castShadow=true;body.receiveShadow=true;g.add(body);
      const crown=new THREE.Mesh(roundedBoxGeo(W-1,1,D-1,0.24),mat(def.roof));
      crown.position.y=H+0.5;crown.castShadow=true;g.add(crown);
      // Helipad + blinkende Antenne
      const pad=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,0.14,16),mat(0x3a4048));
      pad.position.y=H+1.05;g.add(pad);
      const hMark=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.9),
        new THREE.MeshBasicMaterial({map:makeTextTexture('H',80,'#f2f0ea'),transparent:true}));
      hMark.rotation.x=-Math.PI/2;hMark.position.y=H+1.13;g.add(hMark);
      const ant=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,1.8,6),mat(0xb8b8b8,{metalness:.7}));
      ant.position.set(1.4,H+1.9,0);g.add(ant);
      const beacon=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,8),
        new THREE.MeshStandardMaterial({color:0xff4e4e,emissive:0xff2020,emissiveIntensity:0}));
      beacon.position.set(1.4,H+2.85,0);g.add(beacon);
      rec.beacon=beacon.material;
      const entry=new THREE.Mesh(roundedBoxGeo(2.4,1.8,0.6,0.2),gold());
      entry.position.set(0,0.9,D/2+0.2);entry.castShadow=true;g.add(entry);
      addSign(g,rec,def,2.6,D/2+0.55,3);
      return H+3;
    },
    hq(g,def,extra,rec){
      const H=7.5+extra,W=2.6,D=3.4;
      const tex=makeWindowGridTexture(4,10,def.base);
      rec.towerMat=new THREE.MeshStandardMaterial({map:tex,emissiveMap:tex,emissive:0xffffff,emissiveIntensity:0,roughness:.6});
      [[-1.9],[1.9]].forEach(p=>{
        const t=new THREE.Mesh(roundedBoxGeo(W,H,D,0.26),rec.towerMat);
        t.position.set(p[0],H/2,0);t.castShadow=true;g.add(t);
        const c=new THREE.Mesh(roundedBoxGeo(W-0.5,0.6,D-0.5,0.2),mat(def.roof));
        c.position.set(p[0],H+0.3,0);g.add(c);
      });
      // Skybridge
      const bridge=new THREE.Mesh(roundedBoxGeo(2.4,0.9,1.6,0.2),glassMat());
      bridge.position.set(0,H*0.62,0);bridge.castShadow=true;g.add(bridge);
      // rotierender Marken-Globus
      const globe=new THREE.Mesh(new THREE.SphereGeometry(0.95,20,16),
        new THREE.MeshStandardMaterial({map:makeGlobeTexture(0x5e9e50,0x4a90c2),roughness:.4}));
      globe.position.set(0,2.2,1.6);globe.castShadow=true;g.add(globe);
      anim(rec,{kind:'spin',m:globe,axis:'y',spd:0.5});
      const plinth=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.55,1.4,12),mat(0xdcd8cc));
      plinth.position.set(0,0.7,1.6);g.add(plinth);
      addSign(g,rec,def,H+1.1,0.4,3.2);
      return H+1.8;
    },
    world(g,def,extra,rec){
      // Marmorsockel + goldener Globus + Orbit-Ring
      const ped=new THREE.Mesh(new THREE.CylinderGeometry(1.6,2.1,1.6,18),mat(0xece8dc,{roughness:.4}));
      ped.position.y=0.8;ped.castShadow=true;g.add(ped);
      const step=new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.9,0.5,18),mat(0xdcd8cc));
      step.position.y=0.25;step.receiveShadow=true;g.add(step);
      const globe=new THREE.Mesh(new THREE.SphereGeometry(1.9,24,18),
        new THREE.MeshStandardMaterial({color:0xd4af37,metalness:.8,roughness:.28,emissive:0x8a6a1a,emissiveIntensity:.12}));
      globe.position.y=3.6;globe.castShadow=true;g.add(globe);
      anim(rec,{kind:'spin',m:globe,axis:'y',spd:0.3});
      // Breitengrad-Ringe
      [[0.4,1.85],[0,2.02],[-0.4,1.85]].forEach(p=>{
        const ring=new THREE.Mesh(new THREE.TorusGeometry(p[1]*0.92,0.03,8,40),gold());
        ring.rotation.x=Math.PI/2;ring.position.y=3.6+p[0]*1.6;g.add(ring);
      });
      const orbit=new THREE.Group();
      const oRing=new THREE.Mesh(new THREE.TorusGeometry(2.9,0.05,8,60),mat(def.accent,{metalness:.5}));
      orbit.add(oRing);
      const sat=new THREE.Mesh(new THREE.SphereGeometry(0.2,10,8),mat(0xf2f0ea));
      sat.position.x=2.9;orbit.add(sat);
      orbit.rotation.x=Math.PI/2.6;orbit.position.y=3.6;g.add(orbit);
      anim(rec,{kind:'spin',m:orbit,axis:'z',spd:0.7});
      addSign(g,rec,def,1.15,2.6,3);
      FX.addSteam(g,0,5.7,0,0.5,0xfff2d0);
      return 6.6;
    },
  };

  /* ---------- Gebäude bauen/verwalten ---------- */
  function build(i){
    const def=getDef(i);
    const extra=Math.min(msCount(S.venues[i].lvl),3);
    const g=new THREE.Group();
    g.position.set(i*SPACING,0,0);
    const rec={group:g,def,winMat:null,neonMats:[],light:null,extra,anims:[],
      smoke:[],pop:0,anim:null,height:5,staffGroup:null,lanterns:null,towerMat:null,beacon:null};
    // Plaza-Sockel unter jedem Betrieb
    const plaza=new THREE.Mesh(roundedBoxGeo(8.4,0.26,7.6,0.9),
      new THREE.MeshStandardMaterial({color:0xd8d0bc,roughness:.95}));
    plaza.position.set(0,0.02,-0.6);plaza.receiveShadow=true;g.add(plaza);
    _extra=extra;                          // Renovierungsgrad für block()-Farben
    rec.height=FORMS[def.form](g,def,extra,rec)||5;
    addRenovationDeco(g,rec,def);
    g.traverse(o=>{if(o.isMesh)o.userData.venue=i;});
    pickMeshes.push(g);
    scene.add(g);
    buildings[i]=rec;
    refreshStaff(i);
    return rec;
  }
  function remove(i){
    const rec=buildings[i];
    if(!rec)return;
    FX.clearSteamOf(rec.group);
    scene.remove(rec.group);
    if(rec.light)neonLightCount--;
    const idx=pickMeshes.indexOf(rec.group);
    if(idx>=0)pickMeshes.splice(idx,1);
    buildings[i]=null;
  }
  function addVenue(i){
    buildEnvironment();
    const rec=build(i);
    rec.anim={t:0};
    rec.group.scale.set(0.01,0.01,0.01);
    CAM.focus(i*SPACING);
    UI.cinema(2600);                       // kleine Eröffnungs-Inszenierung
  }
  function milestone(i){
    const rec=buildings[i];
    const extra=Math.min(msCount(S.venues[i].lvl),3);
    if(rec&&extra!==rec.extra){remove(i);const nr=build(i);nr.pop=1;}
    else if(rec)rec.pop=1;
  }
  function rebuildAll(){
    for(let i=0;i<buildings.length;i++)remove(i);
    buildings=[];pickMeshes=[];neonLightCount=0;
    for(let i=0;i<S.venues.length;i++)build(i);
    buildEnvironment();
    CAM.focus(Math.max(0,(S.venues.length-1))*SPACING*0.5);
  }
  function refreshDeko(){buildEnvironment();}
  function topOf(i){const rec=buildings[i];return rec?rec.height:5;}
  function pop(i,v){const rec=buildings[i];if(rec)rec.pop=Math.max(rec.pop,v);}

  /* Personal-Figuren vor dem Betrieb — Figur passend zur Rolle des Charakters */
  const CHEF_ROLES=['Koch','Chefkoch','Konditor'];
  function refreshStaff(i){
    const rec=buildings[i];if(!rec)return;
    if(rec.staffGroup)rec.group.remove(rec.staffGroup);
    const v=S.venues[i];
    const sg=new THREE.Group();
    let hasChef=false;
    v.emp.slice(0,3).forEach((e,k)=>{
      const type=CHEF_ROLES.includes(e.role)?'chef':'waiter';
      if(type==='chef')hasChef=true;
      const fig=ACTORS.makeStaffFigure(type);
      fig.position.set(-1.6+k*1.1,0,3.1);
      fig.userData.bobOff=k*1.3;
      fig.userData.baseX=fig.position.x;
      sg.add(fig);
    });
    if(v.mgr){
      const m=ACTORS.makeStaffFigure('manager');
      m.position.set(2.1,0,3.1);
      m.userData.bobOff=9;m.userData.baseX=2.1;
      sg.add(m);
    }
    // Vorbereitungstisch fürs Küchenpersonal: Brett, Tomaten, Messer-Andeutung
    if(hasChef){
      const tbl=new THREE.Mesh(roundedBoxGeo(0.9,0.08,0.5,0.04),mat(0xdcd4c2,{roughness:.6}));
      tbl.position.set(-1.6,0.72,3.55);sg.add(tbl);
      const leg=new THREE.Mesh(boxGeo(0.08,0.7,0.08),mat(0x8a8478));
      leg.position.set(-1.6,0.36,3.55);sg.add(leg);
      const board=new THREE.Mesh(boxGeo(0.4,0.03,0.28),mat(0x9a7a52,{roughness:.8}));
      board.position.set(-1.7,0.78,3.55);sg.add(board);
      for(let k=0;k<3;k++){
        const tom=new THREE.Mesh(new THREE.SphereGeometry(0.045,8,6),mat(0xd0453c,{roughness:.4}));
        tom.position.set(-1.42+k*0.09,0.79,3.5);sg.add(tom);
      }
    }
    rec.staffGroup=sg;
    rec.group.add(sg);
  }

  /* ---------- Animation & Nacht ---------- */
  function update(dt){
    const t=S.gameTime;
    for(const rec of buildings){
      if(!rec)continue;
      if(rec.anim){                       // Aus-dem-Boden-Wachsen
        rec.anim.t+=dt*1.4;
        const at=rec.anim.t;
        if(at>=1){rec.group.scale.set(1,1,1);rec.anim=null;}
        else{
          const s=1+Math.sin(at*Math.PI)*0.06;
          const ease=easeOut(Math.min(1,at/0.7));
          rec.group.scale.set(ease*s,ease,ease*s);
        }
      }
      if(rec.pop>0){
        rec.pop=Math.max(0,rec.pop-dt*2.4);
        const s=1+Math.sin(rec.pop*Math.PI)*0.07;
        if(!rec.anim)rec.group.scale.set(s,2-s,s);
      }
      for(const a of rec.anims){
        if(a.kind==='spin')a.m.rotation[a.axis]+=a.spd*dt;
        else if(a.kind==='wheel'){
          a.m.rotation.z+=a.spd*dt;
          if(rec.gondolas)for(const gd of rec.gondolas)gd.rotation.z=-a.m.rotation.z;
        }
        else if(a.kind==='swing')a.m.rotation.x=Math.sin(t*a.spd)*a.amp;
        else if(a.kind==='flag'){a.m.rotation.y=Math.sin(t*3)*0.35;a.m.rotation.z=Math.sin(t*5)*0.06;}
        else if(a.kind==='boat'){a.m.position.y=Math.sin(t*0.9)*0.08;a.m.rotation.z=Math.sin(t*0.7)*0.02;}
        else if(a.kind==='orbit'){
          a.t+=a.spd*dt;
          a.m.position.set(a.cx+Math.cos(a.t)*a.r,a.cy+Math.sin(a.t*2.3)*0.4,a.cz+Math.sin(a.t)*a.r);
          a.m.rotation.y=-a.t;
        }
      }
      if(rec.staffGroup){                 // Personal arbeitet sichtbar an seiner Rolle
        for(const f of rec.staffGroup.children){
          const parts=f.userData.parts;
          if(!parts)continue;             // Requisiten (Tisch, Brett …) überspringen
          const off=f.userData.bobOff||0;
          if(f.userData.role==='chef'){   // hackt rhythmisch auf dem Brett
            f.position.y=0;
            parts.ra.rotation.x=-0.85+Math.abs(Math.sin(t*6.5+off))*0.55;
            parts.la.rotation.x=-0.5;
            parts.torso.rotation.z=Math.sin(t*6.5+off)*0.02;
          }else if(f.userData.role==='waiter'){ // Patrouille mit Tablett
            const ph=t*0.8+off;
            f.position.x=f.userData.baseX+Math.sin(ph)*1.15;
            const mv=Math.cos(ph);
            f.rotation.y=mv>0?Math.PI*0.5:-Math.PI*0.5;
            const sw=Math.sin(t*7+off)*Math.min(1,Math.abs(mv)*1.8);
            parts.ll.rotation.x=-sw*0.55;parts.rl.rotation.x=sw*0.55;
            parts.la.rotation.x=sw*0.35;
            parts.ra.rotation.x=-1.15;    // Tablett-Arm bleibt oben
            f.position.y=Math.abs(Math.sin(t*7+off))*0.035;
          }else if(f.userData.role==='manager'){ // prüft Klemmbrett, nickt
            f.position.y=0;
            parts.la.rotation.x=-0.85;
            parts.head.rotation.x=0.25+Math.sin(t*1.6+off)*0.08;
            parts.head.rotation.y=Math.sin(t*0.7+off)*0.35;
          }else{
            f.position.y=Math.abs(Math.sin(t*4+off))*0.06;
          }
        }
      }
    }
  }
  function updateNight(N,t){
    for(const rec of buildings){
      if(!rec)continue;
      if(rec.winMat)rec.winMat.emissiveIntensity=N*(0.75+0.2*Math.sin(t*0.7+rec.group.position.x));
      if(rec.towerMat)rec.towerMat.emissiveIntensity=N*0.85;
      if(rec.lanterns)for(const lm of rec.lanterns)lm.emissiveIntensity=0.15+N*(0.8+0.2*Math.sin(t*2));
      if(rec.bulbs)for(let i=0;i<rec.bulbs.length;i++)
        rec.bulbs[i].emissiveIntensity=N*(0.7+0.5*Math.sin(t*2.2+i*1.7));
      if(rec.beacon)rec.beacon.emissiveIntensity=(Math.sin(t*4)>0.4?1.6:0.1)*(0.3+N*0.7);
      for(const nm of rec.neonMats){
        const pulse=0.55+0.45*Math.sin(t*3.2+rec.group.position.x*0.7);
        _tmpCol.set(rec.def.accent).multiplyScalar(0.25+N*pulse*0.95);
        nm.color.copy(_tmpCol);
      }
      if(rec.light)rec.light.intensity=N*(1.1+0.8*Math.sin(t*3.2+rec.group.position.x*0.7));
    }
  }

  /* ---------- Picking ---------- */
  function tap(e){
    pointer.x=(e.clientX/innerWidth)*2-1;
    pointer.y=-(e.clientY/innerHeight)*2+1;
    raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(pickMeshes,true);
    for(const h of hits){
      const vi=h.object.userData.venue;
      if(vi===undefined)continue;
      clickBoost(vi);
      return;
    }
  }
  return {buildings:()=>buildings,build,addVenue,milestone,rebuildAll,refreshDeko,
    refreshStaff,topOf,pop,update,updateNight,tap};
})();
