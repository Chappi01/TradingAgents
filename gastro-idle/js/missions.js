'use strict';
/* ============================================================
   missions.js — Tagesaufgaben, Meilenstein-Kette, Ruf-Ränge
   Kurz-, mittel- und langfristige Ziele, die immer sichtbar
   den nächsten Schritt zeigen. Rang-Aufstiege werden gefeiert.
   ============================================================ */
const MISSIONS=(()=>{

  /* ---------- Tagesaufgaben (3 pro Kalendertag) ---------- */
  function ensureDaily(){
    const today=new Date().toDateString();
    if(S.tasks.date===today&&S.tasks.list.length)return;
    S.tasks.date=today;
    // 3 verschiedene Aufgaben deterministisch aus dem Datum würfeln
    let seed=0;for(const c of today)seed=(seed*31+c.charCodeAt(0))>>>0;
    const pick=[];
    while(pick.length<3){
      seed=(seed*1103515245+12345)>>>0;
      const idx=seed%DAILY_DEFS.length;
      if(!pick.includes(idx))pick.push(idx);
    }
    S.tasks.list=pick.map(idx=>{
      const d=DAILY_DEFS[idx];
      return {def:idx,goal:d.goal(S.rank),start:S.met[d.metric]||0,claimed:false,notified:false};
    });
  }
  function taskProgress(t){
    const d=DAILY_DEFS[t.def];
    return clamp(((S.met[d.metric]||0)-t.start)/t.goal,0,1);
  }
  function dailyReward(){return Math.max(100,totalRate()*CONFIG.dailyRewardSec);}
  function claimDaily(idx){
    const t=S.tasks.list[idx];
    if(!t||t.claimed||taskProgress(t)<1)return;
    t.claimed=true;
    const r=dailyReward();
    S.money+=r;S.runEarned+=r;S.lifeEarned+=r;
    FX.confetti(randI(0,S.venues.length-1));
    AUDIO.achieve();
    UI.toastGold('✅ Tagesaufgabe geschafft: +'+fmt(r)+' €');
    UI.buildPanel();
  }

  /* ---------- Meilenstein-Kette ---------- */
  function currentMs(){return getMilestone(S.tasks.msIdx);}
  function msReward(){return Math.max(500,totalRate()*CONFIG.msRewardSec);}
  function checkMilestone(){
    const ms=currentMs();
    if(!ms.check())return;
    const r=msReward();
    S.money+=r;S.runEarned+=r;S.lifeEarned+=r;
    S.tasks.msIdx++;
    FX.confetti(randI(0,S.venues.length-1));
    AUDIO.achieve();
    UI.toastGold(ms.icon+' <b>Meilenstein:</b> '+ms.text+' — +'+fmt(r)+' €');
    if(typeof UI.refreshMs==='function')UI.refreshMs();
  }

  /* ---------- Ruf-Punkte & Ränge ---------- */
  function pts(){
    const achTotal=ACH_GROUPS.reduce((a,g)=>a+(S.ach[g.id]||0),0);
    let staff=0;for(const v of S.venues)staff+=v.emp.length+(v.mgr?1:0);
    return Math.floor(
      S.venues.length*12+
      achTotal*6+
      Math.sqrt(Math.max(0,totalLevels()))*3+
      Math.sqrt(Math.max(0,S.met.guests))*1.2+
      staff*4+
      S.prestiges*30+
      S.spoons*60);
  }
  function rankFromPts(p){
    let r=0;
    for(let i=0;i<RANKS.length;i++)if(p>=RANKS[i].pts)r=i;
    return r;
  }
  function checkRank(){
    const nr=rankFromPts(pts());
    if(nr<=S.rank)return;
    S.rank=nr;
    const rk=RANKS[nr];
    // große Inszenierung: Konfetti über allen Betrieben, Fanfare, Kamera-Punch
    for(let i=0;i<S.venues.length;i++)FX.confetti(i);
    CAM.punch(1.4);
    AUDIO.rankUp();
    UI.toastGold(rk.icon+' <b>Neuer Ruf: '+rk.name+'!</b> +'+Math.round(CONFIG.rankBonus*100)+' % Einkommen dauerhaft');
    if(nr===2)UI.toast('⏩ <b>2×-Tempo freigeschaltet!</b> (unten links)');
    if(nr===4)UI.toast('⏩ <b>4×-Tempo freigeschaltet!</b>');
    UI.buildPanel();
  }

  let timer=0;
  function update(dt){
    timer-=dt;
    if(timer>0)return;
    timer=1;
    ensureDaily();
    checkMilestone();
    checkRank();
    // fertige, noch nicht abgeholte Tagesaufgaben einmalig melden
    for(const t of S.tasks.list){
      if(!t.claimed&&!t.notified&&taskProgress(t)>=1){
        t.notified=true;
        UI.toast('📋 Tagesaufgabe bereit zum Abholen! (Ziele-Tab)');
        AUDIO.event();
      }
    }
  }
  return {update,ensureDaily,taskProgress,claimDaily,dailyReward,currentMs,msReward,pts,rankFromPts};
})();
