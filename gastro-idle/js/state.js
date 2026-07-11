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

function freshVenue(){return {lvl:1,prog:0,emp:[],mgr:null};}
function freshState(){
  return {v:3,money:0,runEarned:0,lifeEarned:0,stars:0,spoons:0,prestiges:0,
    gameTime:DAY_LEN*0.3,lastSeen:Date.now(),buyAmt:1,
    volSfx:0.6,volMusic:0.5,numFmt:'kurz',reduceFx:false,speed:1,
    venues:[freshVenue()],
    upgrades:{},                   // familyId → gekaufte Stufen
    ach:{},                        // groupId → erreichte Stufen
    staffHired:0,
    rank:0,                        // Ruf-Rang (Index in RANKS)
    met:{guests:0,dishes:0,tips:0,clicks:0,levels:0,hires:0},   // Lebenszeit-Metriken
    tasks:{date:'',list:[],msIdx:0}};                            // Tagesaufgaben + Meilenstein
}
function storeGet(){try{return localStorage.getItem(SAVE_KEY);}catch(e){return null;}}
function storeSet(v){try{localStorage.setItem(SAVE_KEY,v);}catch(e){}}
function storeDel(){try{localStorage.removeItem(SAVE_KEY);localStorage.removeItem(SAVE_KEY+'.bak');}catch(e){}}

/* Speichern mit Sicherungskopie: der letzte funktionierende Stand bleibt erhalten */
function save(){
  S.lastSeen=Date.now();
  const prev=storeGet();
  if(prev)try{localStorage.setItem(SAVE_KEY+'.bak',prev);}catch(e){}
  storeSet(JSON.stringify(S));
}
function load(){
  const tryParse=raw=>{
    if(!raw)return null;
    try{
      let s=JSON.parse(raw);
      if(!s.venues||!s.venues.length)return null;
      return Object.assign(freshState(),migrate(s));
    }catch(e){return null;}
  };
  let s=tryParse(storeGet());
  if(s)return s;
  try{s=tryParse(localStorage.getItem(SAVE_KEY+'.bak'));}catch(e){}
  if(s){s._restoredFromBackup=true;return s;}
  return freshState();
}
/* Migrationen: v1 → v2 → v3 (alte Spielstände bleiben immer gültig) */
function migrate(s){
  if(!s.v||s.v<2){
    s.v=2;
    s.spoons=0;s.upgrades={};s.ach={};s.staffHired=0;
    s.sfx=!s.muted;s.music=!s.muted;delete s.muted;
    s.venues=s.venues.map(v=>({lvl:v.lvl||1,prog:v.prog||0,staff:0,mgr:false}));
  }
  if(s.v<3){
    s.v=3;
    s.volSfx=s.sfx===false?0:0.6;
    s.volMusic=s.music===false?0:0.5;
    delete s.sfx;delete s.music;
    s.numFmt='kurz';s.reduceFx=false;s.speed=1;s.rank=0;
    s.met={guests:0,dishes:0,tips:0,clicks:0,levels:0,hires:0};
    s.tasks={date:'',list:[],msIdx:0};
    // anonyme Zähler → echte Mitarbeiter-Charaktere
    s.venues=s.venues.map((v,i)=>{
      const nv={lvl:v.lvl||1,prog:v.prog||0,emp:[],mgr:null};
      const n=v.staff||0;
      for(let k=0;k<n;k++)nv.emp.push(STAFF.generate(i,false));
      if(v.mgr)nv.mgr=STAFF.generate(i,true);
      return nv;
    });
  }
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
