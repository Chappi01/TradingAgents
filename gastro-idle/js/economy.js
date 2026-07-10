'use strict';
/* ============================================================
   economy.js — Werte, Tick, Käufe, Events, Erfolge, Prestige
   ============================================================ */

/* ---------- Multiplikatoren ---------- */
function upTier(id){return S.upgrades[id]||0;}
function incomeMult(){                       // globaler Einkommens-Multiplikator
  let m=1;
  for(const f of UPGRADE_FAMILIES){
    const t=upTier(f.id);
    if(!t)continue;
    if(f.effect==='income')m*=Math.pow(f.val,t);
    else if(f.effect==='walk')m*=Math.pow(f.val,t);
  }
  m*=satisfaction();
  m*=1+0.02*S.stars;                         // Michelin-Sterne
  m*=1+S.spoons;                             // Goldene Löffel: +100 % je Löffel
  m*=achMult();
  return m;
}
function speedMult(){                        // globale Umlaufzeit (kleiner = schneller)
  return Math.max(0.3,Math.pow(0.92,upTier('koch')));
}
function satisfaction(){                     // Gästezufriedenheit (Anzeige + Multiplikator)
  let staff=0;for(const v of S.venues)staff+=v.staff+(v.mgr?1:0);
  return clamp(1+upTier('deko')*0.08+Math.min(staff,60)*0.01,1,3.5);
}
function walkSpeedMult(){return Math.min(2.2,Math.pow(1.15,upTier('lauf')));}
function achMult(){
  let m=1;
  for(const g of ACH_GROUPS)m+= (S.ach[g.id]||0)*g.bonus;
  return m;
}
function tipMult(){return Math.pow(1.12,upTier('tip'));}

/* ---------- Werte pro Betrieb ---------- */
function venueStats(i){
  const d=getDef(i),v=S.venues[i];
  const ms=msCount(v.lvl);
  const baseTime=d.time*speedMult();
  const maxSpeed=Math.max(0,Math.floor(Math.log2(baseTime/0.25)));
  const k=Math.min(ms,maxSpeed);
  const time=baseTime/Math.pow(2,k);
  const local=(1+STAFF_BONUS*v.staff)*(v.mgr?MGR_BONUS:1);
  const rev=d.rev*v.lvl*Math.pow(2,ms-k)*local*incomeMult()*eventMult(i);
  return {time,rev,rate:rev/time,continuous:time<=0.27};
}
function totalRate(){let r=0;for(let i=0;i<S.venues.length;i++)r+=venueStats(i).rate;return r;}
function totalLevels(){let l=0;for(const v of S.venues)l+=v.lvl;return l;}

/* ---------- Kosten ---------- */
function levelCost(i,count){
  const d=getDef(i),g=d.growth,c0=d.cost*Math.pow(g,S.venues[i].lvl);
  return c0*(Math.pow(g,count)-1)/(g-1);
}
function maxAffordable(i){
  const d=getDef(i),g=d.growth,c0=d.cost*Math.pow(g,S.venues[i].lvl);
  if(S.money<c0)return 0;
  return Math.floor(Math.log(S.money*(g-1)/c0+1)/Math.log(g));
}
function buyCount(i){return S.buyAmt==='max'?Math.max(1,maxAffordable(i)):S.buyAmt;}

/* ---------- Verdienen & Tick ---------- */
function earn(amount,vi,burst){
  S.money+=amount;S.runEarned+=amount;S.lifeEarned+=amount;
  if(burst){FX.money(vi);if(Math.random()<0.35)AUDIO.cash();}
}
function tickEconomy(dt){
  for(let i=0;i<S.venues.length;i++){
    const v=S.venues[i];
    const st=venueStats(i);
    if(st.continuous){
      earn(st.rate*dt,i,false);
      v.prog=(v.prog+dt/Math.max(st.time,0.05))%1;
      if(Math.random()<dt*1.4)FX.money(i);
    }else{
      v.prog+=dt/st.time;
      if(v.prog>=1){
        const cycles=Math.floor(v.prog);
        v.prog-=cycles;
        earn(st.rev*cycles,i,true);
      }
    }
  }
  updateEvents();
  achTimer-=dt;
  if(achTimer<=0){achTimer=1;checkAchievements();}
}

/* ---------- Offline-Einnahmen ---------- */
function applyOffline(seconds){
  const s=Math.min(seconds,86400);
  events=[];UI.hideBanner();
  let total=0;
  for(let i=0;i<S.venues.length;i++){
    const v=S.venues[i],st=venueStats(i);
    if(st.continuous){total+=st.rate*s;}
    else{
      const elapsed=v.prog*st.time+s;
      const cycles=Math.floor(elapsed/st.time);
      v.prog=(elapsed-cycles*st.time)/st.time;
      total+=cycles*st.rev;
    }
  }
  if(total>0){S.money+=total;S.runEarned+=total;S.lifeEarned+=total;}
  return total;
}

/* ---------- Käufe ---------- */
function tryBuyLevels(i){
  const v=S.venues[i];if(!v)return;
  let n=buyCount(i),cost=levelCost(i,n);
  if(S.money<cost){
    if(S.buyAmt!=='max')return;
    n=maxAffordable(i);if(n<1)return;
    cost=levelCost(i,n);
  }
  const before=msCount(v.lvl);
  S.money-=cost;v.lvl+=n;
  AUDIO.buy();
  if(msCount(v.lvl)>before)celebrateMilestone(i);
  else WORLD.pop(i,0.5);
  UI.refreshCard(i);
}
function celebrateMilestone(i){
  const d=getDef(i),v=S.venues[i];
  WORLD.milestone(i);
  FX.confetti(i);
  CAM.punch();
  AUDIO.milestone();
  const st=venueStats(i);
  UI.toast(d.emoji+' <b>'+d.name+'</b> Level '+fmt(v.lvl)+' – Bonus! '+(st.continuous?'Läuft jetzt durchgehend!':'×2!'));
}
function tryUnlock(){
  const i=S.venues.length,d=getDef(i);
  if(S.money<d.cost)return;
  S.money-=d.cost;
  S.venues.push(freshVenue());
  WORLD.addVenue(i);
  AUDIO.unlock();
  UI.toast(d.emoji+' <b>'+d.name+'</b> eröffnet!');
  UI.buildPanel();
}
function tryHireStaff(i){
  const v=S.venues[i];
  if(v.staff>=STAFF_MAX)return;
  const c=staffCost(i,v.staff);
  if(S.money<c)return;
  S.money-=c;v.staff++;S.staffHired++;
  WORLD.refreshStaff(i);
  AUDIO.buy();
  UI.toast('👥 Neue Verstärkung für <b>'+getDef(i).name+'</b>! (+'+Math.round(STAFF_BONUS*100)+' %)');
  UI.refreshCard(i);
}
function tryHireManager(i){
  const v=S.venues[i];
  if(v.mgr)return;
  const c=managerCost(i);
  if(S.money<c)return;
  S.money-=c;v.mgr=true;S.staffHired++;
  WORLD.refreshStaff(i);
  AUDIO.milestone();
  UI.toast('🎩 Manager übernimmt <b>'+getDef(i).name+'</b>: ×'+MGR_BONUS.toLocaleString('de-DE')+'!');
  UI.refreshCard(i);
}
function tryBuyUpgrade(famId){
  const fam=UPGRADE_FAMILIES.find(f=>f.id===famId);
  const tier=upTier(famId),c=upgradeCost(fam,tier);
  if(S.money<c)return;
  S.money-=c;
  S.upgrades[famId]=tier+1;
  AUDIO.unlock();
  UI.toast(fam.icon+' <b>'+upgradeName(fam,tier)+'</b> erforscht!');
  if(famId==='deko')WORLD.refreshDeko();
  UI.buildUpgrades();
}

/* ---------- Klick-Boost (aktives Eingreifen) ---------- */
function clickBoost(vi){
  const v=S.venues[vi];if(!v)return;
  const st=venueStats(vi);
  if(st.continuous)earn(st.rate*1.2,vi,true);
  else v.prog=Math.min(v.prog+0.22,1.6);
  WORLD.pop(vi,0.65);
  FX.money(vi);
  AUDIO.cash();
}

/* ---------- Trinkgeld beim Gäste-Abschied (kleine, stetige Belohnung) ---------- */
function guestTip(vi){
  const st=venueStats(vi);
  const tip=st.rev*0.02*tipMult();
  S.money+=tip;S.runEarned+=tip;S.lifeEarned+=tip;
  FX.coin(vi);
}

/* ---------- Events ---------- */
let events=[],nextEventAt=0,achTimer=1;
function eventMult(i){
  let m=1;
  for(const e of events)if(e.until>S.gameTime&&(e.venue<0||e.venue===i))m*=e.mult;
  return m;
}
function updateEvents(){
  events=events.filter(e=>e.until>S.gameTime);
  if(S.venues.length>=2&&S.gameTime>nextEventAt){
    if(nextEventAt===0)nextEventAt=S.gameTime+75;
    else{spawnEvent();nextEventAt=S.gameTime+rand(130,300);}
  }
}
function spawnEvent(){
  const vi=randI(0,S.venues.length-1),vd=getDef(vi);
  const pool=[
    {venue:vi,mult:5,dur:30,text:'🧐 Ein Foodkritiker schwärmt: „'+vd.name+'“! Einnahmen ×5'},
    {venue:-1,mult:2,dur:35,text:'🚌 Ein Reisebus voller Gäste hält an! Alle Betriebe ×2'},
    {venue:vi,mult:4,dur:25,text:'📸 Influencer-Story über „'+vd.name+'“ geht viral! ×4'},
    {venue:-1,mult:3,dur:20,text:'🍻 Happy Hour in der ganzen Straße! Alles ×3'},
    {venue:vi,mult:6,dur:18,text:'🏆 „'+vd.name+'“ gewinnt einen Gastro-Preis! ×6'},
  ];
  const e=pool[randI(0,pool.length-1)];
  e.until=S.gameTime+e.dur;
  events.push(e);
  UI.showBanner(e);
  AUDIO.event();
  ACTORS.rush(e.venue>=0?e.venue:randI(0,S.venues.length-1),e.dur);
}

/* ---------- Erfolge ---------- */
function achValue(g){
  switch(g.id){
    case 'earned':return S.lifeEarned;
    case 'venues':return S.venues.length;
    case 'levels':return totalLevels();
    case 'staff':return S.staffHired;
    case 'prestige':return S.prestiges;
  }
  return 0;
}
function checkAchievements(){
  for(const g of ACH_GROUPS){
    let n=S.ach[g.id]||0;
    while(achValue(g)>=g.thr(n)){
      n++;S.ach[g.id]=n;
      UI.toastGold(g.icon+' <b>Erfolg: '+g.label+' '+n+'</b> – '+g.text(n-1)+' (+'+Math.round(g.bonus*100)+' % für immer)');
      AUDIO.achieve();
      CAM.punch(0.4);
    }
  }
}

/* ---------- Prestige (2 Ebenen) ---------- */
function starsGain(){return Math.floor(Math.pow(S.runEarned/1e10,0.5));}
function doPrestige(){
  const gain=starsGain();
  if(gain<1)return;
  S.stars+=gain;S.prestiges++;
  resetRun();
  UI.toast('⭐ Neueröffnung! +'+fmt(gain)+' Michelin-Sterne — Einkommen wächst für immer.');
}
const SPOON_RATE=250;              // Sterne je Goldenem Löffel
function spoonsGain(){return Math.floor((S.stars+starsGain())/SPOON_RATE);}
function doSpoonPrestige(){
  const g=spoonsGain();
  if(g<1)return;
  S.stars=(S.stars+starsGain())%SPOON_RATE;
  S.spoons+=g;S.prestiges++;
  resetRun();
  UI.toast('🥄 <b>Goldener Löffel!</b> +'+fmt(g)+' — Einkommen ×'+fmt(1+S.spoons)+' für immer.');
}
function resetRun(){
  S.money=0;S.runEarned=0;
  S.venues=[freshVenue()];
  events=[];nextEventAt=0;UI.hideBanner();
  WORLD.rebuildAll();
  ACTORS.reset();
  UI.buildPanel();UI.closeModal();
  AUDIO.unlock();
  save();
}
