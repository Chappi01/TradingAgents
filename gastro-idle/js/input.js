'use strict';
/* ============================================================
   input.js — INPUT: Gamepad-Unterstützung (Konsolen-Bedienung)
   Linker Stick: Kamera drehen · rechter Stick (vertikal): Zoom
   ✕ auswählen · ○ zurück · L1/R1 Tabs · Steuerkreuz: Fokus
   Options: Einstellungen. Eingabeart wird automatisch erkannt:
   Gamepad-Aktivität blendet die Tastenhinweise ein, Maus wieder aus.
   ============================================================ */
const INPUT=(()=>{
  let prev=[],focusIdx=-1,focusEl=null;

  function pad(){
    const gs=navigator.getGamepads?navigator.getGamepads():[];
    for(const g of gs)if(g&&g.connected)return g;
    return null;
  }
  function markPad(){document.body.classList.add('gamepad');}
  document.addEventListener('pointerdown',()=>{
    document.body.classList.remove('gamepad');
    clearFocus();
  });

  /* ---------- Fokusführung durch die sichtbaren Buttons ---------- */
  function focusables(){
    return [...document.querySelectorAll(
      '#modalWrap.show #modal button:not(:disabled), '+
      '#panelInner button:not(:disabled), #tabs button, #speedbar button, #controls .ctl'
    )].filter(b=>b.offsetParent);
  }
  function clearFocus(){
    if(focusEl)focusEl.classList.remove('gpfocus');
    focusEl=null;focusIdx=-1;
  }
  function moveFocus(dir){
    const els=focusables();
    if(!els.length)return;
    const cur=focusEl?els.indexOf(focusEl):-1;
    focusIdx=cur<0?(dir>0?0:els.length-1):(cur+dir+els.length)%els.length;
    if(focusEl)focusEl.classList.remove('gpfocus');
    focusEl=els[focusIdx];
    focusEl.classList.add('gpfocus');
    focusEl.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function activate(){
    const title=document.getElementById('title');
    if(title&&!title.classList.contains('hide')){UI.closeTitle();return;}
    if(focusEl){focusEl.click();setTimeout(()=>{if(focusEl&&!focusEl.offsetParent)clearFocus();},50);return;}
    // ohne Fokus: den Betrieb in Bildmitte anfeuern
    const vi=clamp(Math.round(CAM.x()/SPACING),0,S.venues.length-1);
    clickBoost(vi);
  }

  /* ---------- Poll-Schleife (Gamepad-API liefert keine Events für Achsen) ---------- */
  function update(dt){
    const g=pad();
    if(!g)return;
    const dz=v=>Math.abs(v)>0.18?v:0;
    const lx=dz(g.axes[0]||0),ly=dz(g.axes[1]||0),ry=dz(g.axes[3]||0);
    if(lx||ly){CAM.orbit(-lx*dt*2.4,ly*dt*1.6);markPad();}
    if(ry){CAM.zoom(1+ry*dt*1.6);markPad();}
    const down=i=>!!(g.buttons[i]&&g.buttons[i].pressed);
    const once=i=>down(i)&&!prev[i];
    if(once(0)){markPad();activate();}                       // ✕
    if(once(1)){markPad();UI.closeModal();clearFocus();}     // ○
    if(once(4)){markPad();UI.cycleTab(-1);clearFocus();}     // L1
    if(once(5)){markPad();UI.cycleTab(1);clearFocus();}      // R1
    if(once(12)||once(14)){markPad();moveFocus(-1);}         // Steuerkreuz ↑/←
    if(once(13)||once(15)){markPad();moveFocus(1);}          // Steuerkreuz ↓/→
    if(once(9)){markPad();UI.showSettings();}                // Options
    prev=g.buttons.map(b=>b.pressed);
  }
  window.addEventListener('gamepadconnected',()=>{markPad();UI.toast('🎮 Controller verbunden!');});

  /* ---------- Tastatur-Komfort (PC): Leertaste Pause, 1–4 Tabs ---------- */
  let lastSpeed=1;
  document.addEventListener('keydown',e=>{
    if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT')return;
    const title=document.getElementById('title');
    if(title&&!title.classList.contains('hide'))return;   // Titel hat eigene Tasten
    if(e.key===' '){
      e.preventDefault();
      if(S.speed===0)S.speed=lastSpeed;
      else{lastSpeed=S.speed;S.speed=0;}
      UI.updateSpeedBar();
    }
    if(e.key>='1'&&e.key<='4')UI.cycleTabTo(+e.key-1);
  });
  return {update};
})();
