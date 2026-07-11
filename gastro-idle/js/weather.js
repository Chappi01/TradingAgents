'use strict';
/* ============================================================
   weather.js — dynamisches Wetter mit Gameplay-Wirkung
   Sonnig / Wolkig / Regen / Hitzewelle. Regen bringt sichtbaren
   Niederschlag, dunkleren Himmel und einen Lieferdienst-Boom;
   Hitze belohnt Getränke-Betriebe. Wechsel werden erklärt.
   ============================================================ */
const WEATHER=(()=>{
  const TYPES={
    sonnig:{icon:'☀️',label:'Sonnig',      w:40,cloud:0.0,rain:0,sun:1,
      toast:null},
    wolkig:{icon:'⛅',label:'Wolkig',      w:28,cloud:0.55,rain:0,sun:0.8,
      toast:'⛅ Es zieht zu — perfektes Schlenderwetter.'},
    regen:{icon:'🌧️',label:'Regen',        w:18,cloud:1,rain:1,sun:0.55,
      toast:'🌧️ Regen! Weniger Laufkundschaft, aber der <b>Lieferdienst boomt</b>.'},
    hitze:{icon:'🥵',label:'Hitzewelle',   w:14,cloud:0.1,rain:0,sun:1.15,
      toast:'🥵 Hitzewelle! <b>Kalte Getränke</b> laufen hervorragend.'},
  };
  const DRINK_FORMS=['cafe','casino','luxury','ship','park'];
  let cur='sonnig',until=0,cloud=0,rain=0,sunMul=1;
  let rainPts=null,rainGeo=null,rainArr=null;
  const RAIN_N=420;

  function roll(){
    const keys=Object.keys(TYPES);
    const total=keys.reduce((a,k)=>a+TYPES[k].w,0);
    let r=Math.random()*total;
    for(const k of keys){r-=TYPES[k].w;if(r<=0)return k;}
    return 'sonnig';
  }
  function change(){
    let next=roll();
    if(next===cur)next=roll();
    cur=next;
    until=S.gameTime+rand(110,240);
    const t=TYPES[cur];
    if(t.toast)UI.toast(t.toast);
  }
  function initRain(){
    rainArr=new Float32Array(RAIN_N*3);
    for(let i=0;i<RAIN_N;i++)resetDrop(i,true);
    rainGeo=new THREE.BufferGeometry();
    rainGeo.setAttribute('position',new THREE.BufferAttribute(rainArr,3));
    rainPts=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:0xa8c8e8,size:0.14,transparent:true,opacity:0,depthWrite:false}));
    scene.add(rainPts);
  }
  function resetDrop(i,randY){
    rainArr[i*3]=CAM.x()+rand(-30,30);
    rainArr[i*3+1]=randY?rand(0,22):22;
    rainArr[i*3+2]=rand(-12,26);
  }
  function update(dt){
    if(until===0)until=S.gameTime+rand(90,180);
    if(S.gameTime>until)change();
    const t=TYPES[cur];
    cloud=lerp(cloud,t.cloud,Math.min(1,dt*0.5));
    rain=lerp(rain,t.rain,Math.min(1,dt*0.5));
    sunMul=lerp(sunMul,t.sun,Math.min(1,dt*0.5));
    if(!webglOk)return;
    if(!rainPts)initRain();
    rainPts.material.opacity=rain*0.75;
    if(rain>0.02){
      const density=S.reduceFx?0.4:1;
      for(let i=0;i<RAIN_N*density;i++){
        rainArr[i*3+1]-=dt*26;
        if(rainArr[i*3+1]<0)resetDrop(i,false);
      }
      rainGeo.attributes.position.needsUpdate=true;
    }
  }
  /* Einnahmen-Wirkung pro Betrieb — nachvollziehbar & nie strafend-hart */
  function mult(def){
    if(cur==='regen'){
      const lieferBoost=1+0.18*Math.min(upTier('liefer')+upTier('drohne'),5);
      return 0.9*lieferBoost;
    }
    if(cur==='hitze')return DRINK_FORMS.includes(def.form)?1.3:0.96;
    return 1;
  }
  function crowdMult(){return cur==='regen'?0.55:cur==='hitze'?0.85:1;}   // sichtbare Passanten
  function skyMod(){return {cloud,sunMul};}
  function info(){const t=TYPES[cur];return t.icon+' '+t.label;}
  function force(){until=0;change();}      // fürs Debug-Panel
  return {update,mult,crowdMult,skyMod,info,force};
})();
