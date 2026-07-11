'use strict';
/* ============================================================
   main.js — Start & Hauptschleife
   Simulation (dt × Spieltempo) und Präsentation (Kamera/UI mit
   rohem dt) sind getrennt, damit Pause/2×/4× sauber wirken.
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
if(S._restoredFromBackup){delete S._restoredFromBackup;UI.toast('💾 Sicherungskopie wiederhergestellt.');}

/* Offline-Verdienst beim Laden — mit ausführlicher Bilanz */
{
  const away=(Date.now()-S.lastSeen)/1000;
  if(!isNew&&away>60){
    const o=applyOffline(away);
    if(o.total>0)UI.showOffline(o);
  }
}
if(isNew)setTimeout(UI.showHelp,600);

document.addEventListener('pointerdown',()=>{AUDIO.ensure();AUDIO.resume();});

setInterval(save,10000);
window.addEventListener('beforeunload',save);
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});

/* ---------- Debug-/Balancing-Panel (?debug an die URL hängen) ---------- */
if(location.search.includes('debug')){
  const p=document.createElement('div');
  p.id='debugbar';
  p.innerHTML='<b>DEBUG</b>'+
    '<button onclick="S.money+=Math.max(1e3,totalRate()*600)">+Geld</button>'+
    '<button onclick="S.money*=1000">Geld ×1000</button>'+
    '<button onclick="WEATHER.force()">Wetter</button>'+
    '<button onclick="spawnEvent()">Event</button>'+
    '<button onclick="S.gameTime+=DAY_LEN/4">+¼ Tag</button>'+
    '<button onclick="UI.showOffline(applyOffline(3600))">+1 h offline</button>'+
    '<button onclick="console.log(JSON.parse(JSON.stringify(S)))">Dump</button>';
  document.body.appendChild(p);
}

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
    const o=applyOffline(dt);
    if(dt>90&&o.total>0)UI.showOffline(o);
    dt=0.05;
  }
  dt=Math.min(dt,0.5);
  const sim=dt*S.speed;                  // Spieltempo: Pause/1×/2×/4×
  if(sim>0){
    S.gameTime+=sim;
    tickEconomy(sim);
    WEATHER.update(sim);
    if(webglOk){
      ACTORS.update(sim);
      FX.update(sim);
      WORLD.update(sim);
      updateClouds(sim);
    }
  }
  if(webglOk){
    updateDayNight();
    CAM.update(dt);                      // Kamera bleibt auch in Pause weich
    renderer.render(scene,camera);
  }
  UI.frame(dt);
}
requestAnimationFrame(frame);
