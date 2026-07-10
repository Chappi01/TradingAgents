'use strict';
/* ============================================================
   main.js — Start & Hauptschleife
   Reihenfolge: Spielstand → 3D-Welt → Akteure → UI → Loop
   ============================================================ */
S=load();
const isNew=!storeGet();

initThree();
if(webglOk){
  FX.init();
  ACTORS.init();
  for(let i=0;i<S.venues.length;i++)WORLD.build(i);
  buildEnvironment();
  CAM.focus(Math.max(0,(S.venues.length-1))*SPACING*0.5);
  CAM.initControls();
}else{
  document.getElementById('scene').innerHTML=
    '<div style="padding:100px 30px;text-align:center;color:#889">3D wird von diesem Browser nicht unterstützt – das Spiel läuft trotzdem weiter!</div>';
}
UI.init();

/* Offline-Verdienst beim Laden */
{
  const away=(Date.now()-S.lastSeen)/1000;
  if(!isNew&&away>60){
    const total=applyOffline(away);
    if(total>0)UI.showOffline(total,away);
  }
}
if(isNew)setTimeout(UI.showHelp,600);

/* Audio erst nach erster Interaktion (Browser-Vorgabe) */
document.addEventListener('pointerdown',()=>{AUDIO.ensure();AUDIO.resume();});

setInterval(save,10000);
window.addEventListener('beforeunload',save);
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});

/* ---------- Hauptschleife ---------- */
let last=performance.now(),perfT=0,perfF=0,perfDone=false;
function frame(now){
  requestAnimationFrame(frame);
  let dt=(now-last)/1000;last=now;
  if(webglOk&&!perfDone&&dt<5){          // adaptive Qualität für schwache GPUs
    perfF++;perfT+=dt;
    if(perfT>6){
      perfDone=true;
      if(perfF/perfT<24){
        renderer.setPixelRatio(1);
        sun.castShadow=false;
        renderer.shadowMap.autoUpdate=false;
      }
    }
  }
  if(dt>15){                             // Tab war lange im Hintergrund
    const total=applyOffline(dt);
    if(dt>90&&total>0)UI.showOffline(total,dt);
    dt=0.05;
  }
  dt=Math.min(dt,0.5);
  S.gameTime+=dt;
  tickEconomy(dt);
  if(webglOk){
    ACTORS.update(dt);
    FX.update(dt);
    WORLD.update(dt);
    updateClouds(dt);
    updateDayNight();
    CAM.update(dt);
    renderer.render(scene,camera);
  }
  UI.frame(dt);
}
requestAnimationFrame(frame);
