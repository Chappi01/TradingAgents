'use strict';
/* ============================================================
   state.js — Spielstand, Speichern/Laden, Migration, Offline
   Cloud-Anbindung vorbereitet: alle Zugriffe laufen über
   storeGet/storeSet — ein Backend müsste nur diese zwei
   Funktionen ersetzen. Export/Import gibt es in den Settings.
   ============================================================ */

const SAVE_KEY='gastroImperiumSave';
const DAY_LEN=300;                 // Sekunden pro Tag/Nacht-Zyklus
let S=null;

function freshVenue(){return {lvl:1,prog:0,staff:0,mgr:false};}
function freshState(){
  return {v:2,money:0,runEarned:0,lifeEarned:0,stars:0,spoons:0,prestiges:0,
    gameTime:DAY_LEN*0.3,lastSeen:Date.now(),sfx:true,music:true,buyAmt:1,
    venues:[freshVenue()],
    upgrades:{},                   // familyId → gekaufte Stufen
    ach:{},                        // groupId → erreichte Stufen
    staffHired:0};
}
function storeGet(){try{return localStorage.getItem(SAVE_KEY);}catch(e){return null;}}
function storeSet(v){try{localStorage.setItem(SAVE_KEY,v);}catch(e){}}
function storeDel(){try{localStorage.removeItem(SAVE_KEY);}catch(e){}}

function save(){S.lastSeen=Date.now();storeSet(JSON.stringify(S));}
function load(){
  try{
    const raw=storeGet();
    if(!raw)return freshState();
    let s=JSON.parse(raw);
    if(!s.venues||!s.venues.length)return freshState();
    s=migrate(s);
    return Object.assign(freshState(),s);
  }catch(e){return freshState();}
}
/* v1 → v2: Personal/Manager/Upgrades ergänzen, muted → sfx/music */
function migrate(s){
  if(s.v>=2)return s;
  s.v=2;
  s.spoons=0;s.upgrades={};s.ach={};s.staffHired=0;
  s.sfx=!s.muted;s.music=!s.muted;delete s.muted;
  s.venues=s.venues.map(v=>({lvl:v.lvl||1,prog:v.prog||0,staff:0,mgr:false}));
  return s;
}
function exportSave(){save();return btoa(unescape(encodeURIComponent(JSON.stringify(S))));}
function importSave(code){
  try{
    const s=JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if(!s.venues)return false;
    storeSet(JSON.stringify(migrate(s)));
    location.reload();
    return true;
  }catch(e){return false;}
}
