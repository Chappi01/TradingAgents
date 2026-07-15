'use strict';
/* ============================================================
   ui.js — HUD, Panel (4 Tabs), Bewerber-Auswahl, Modals, Toasts
   Tabs: Betriebe · Upgrades · Ziele · Boni
   ============================================================ */
const UI=(()=>{
  const $=id=>document.getElementById(id);
  let elMoney,elRate,elSat,elStars,elRank,elWeather,panelInner,modalWrap,modal,bannerEl,toastsEl;
  let dispMoney=0,cards=[],lockedCard=null,uiTimer=0,activeTab='venues',bannerEvent=null;
  let taskRefs=[],msRef=null,speedBtns=[];

  function init(){
    elMoney=$('money');elRate=$('rate');elSat=$('satInfo');elStars=$('starsInfo');
    elRank=$('rankInfo');elWeather=$('weatherInfo');
    panelInner=$('panelInner');modalWrap=$('modalWrap');modal=$('modal');
    bannerEl=$('eventBanner');toastsEl=$('toasts');
    dispMoney=S.money;
    document.querySelectorAll('#tabs button').forEach(b=>{
      b.addEventListener('click',()=>setTab(b.dataset.tab));
    });
    $('btnBuyAmt').addEventListener('click',()=>{
      const seq=[1,10,25,100,'max'];
      S.buyAmt=seq[(seq.indexOf(S.buyAmt)+1)%seq.length];
      $('btnBuyAmt').textContent=S.buyAmt==='max'?'Max':'×'+S.buyAmt;
      refreshAll();
    });
    $('btnBuyAmt').textContent=S.buyAmt==='max'?'Max':'×'+S.buyAmt;
    $('btnSettings').addEventListener('click',showSettings);
    $('btnHelp').addEventListener('click',showHelp);
    $('btnPrestige').addEventListener('click',showPrestige);
    modalWrap.addEventListener('click',e=>{if(e.target===modalWrap)closeModal();});
    // Spieltempo (Pause / 1× / 2× / 4×)
    speedBtns=[...document.querySelectorAll('#speedbar button')];
    speedBtns.forEach(b=>{
      b.addEventListener('click',()=>{
        const sp=b.dataset.sp==='p'?0:+b.dataset.sp;
        if(sp===2&&S.rank<2){toast('🔒 2×-Tempo ab Ruf „Beliebtes Lokal“ (Rang 2)');return;}
        if(sp===4&&S.rank<4){toast('🔒 4×-Tempo ab Ruf „Ausgezeichnetes Haus“ (Rang 4)');return;}
        S.speed=sp;
        updateSpeedBar();
      });
    });
    updateSpeedBar();
    buildPanel();
  }
  function updateSpeedBar(){
    speedBtns.forEach(b=>{
      const sp=b.dataset.sp==='p'?0:+b.dataset.sp;
      b.classList.toggle('active',S.speed===sp);
      const locked=(sp===2&&S.rank<2)||(sp===4&&S.rank<4);
      b.classList.toggle('locked',locked);
    });
  }
  function setTab(t){
    activeTab=t;
    document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
    buildPanel();
  }
  const TAB_ORDER=['venues','upgrades','ziele','boni'];
  function cycleTab(dir){
    const i=(TAB_ORDER.indexOf(activeTab)+dir+TAB_ORDER.length)%TAB_ORDER.length;
    setTab(TAB_ORDER[i]);
  }
  function cycleTabTo(i){setTab(TAB_ORDER[clamp(i,0,3)]);}

  /* ---------- Titelbildschirm & Letterbox-Inszenierung ---------- */
  let titleCb=null,cineTimer=null;
  function showTitle(hasSave,onClose){
    titleCb=onClose||null;
    $('titleStart').textContent=hasSave?'Weiterspielen':'Neues Spiel';
    document.body.classList.add('title-open');
    $('title').classList.remove('hide');
    $('titleStart').onclick=closeTitle;
    const key=e=>{if(e.key==='Enter'||e.key===' '){closeTitle();}};
    document.addEventListener('keydown',key,{once:true});
  }
  function closeTitle(){
    const t=$('title');
    if(t.classList.contains('hide'))return;
    t.classList.add('hide');
    document.body.classList.remove('title-open');
    AUDIO.ensure();AUDIO.resume();AUDIO.unlock();
    if(titleCb){const cb=titleCb;titleCb=null;setTimeout(cb,500);}
  }
  function cinema(ms){                     // Letterbox-Kamerafahrt, überspringbar
    if(document.body.classList.contains('title-open'))return;
    document.body.classList.add('cine');
    CAM.punch(0.9);
    clearTimeout(cineTimer);
    const end=()=>{document.body.classList.remove('cine');document.removeEventListener('pointerdown',end);};
    cineTimer=setTimeout(end,ms||2400);
    document.addEventListener('pointerdown',end,{once:true});
  }

  /* ================= Panel ================= */
  function buildPanel(){
    panelInner.innerHTML='';cards=[];lockedCard=null;taskRefs=[];msRef=null;
    if(activeTab==='venues'){
      for(let i=0;i<S.venues.length;i++)panelInner.appendChild(makeCard(i));
      panelInner.appendChild(makeLockedCard());
    }
    else if(activeTab==='upgrades')buildUpgrades();
    else if(activeTab==='ziele')buildZiele();
    else buildBoni();
  }

  /* ---------- Betriebe-Karten ---------- */
  function teamChips(i){
    const v=S.venues[i];
    let html='';
    for(const e of v.emp)
      html+='<span class="chip" style="border-color:'+RARITIES[e.rar].col+'" title="'+e.name+' · '+e.role+' · '+RARITIES[e.rar].name+'\n'+TRAITS[e.trait].icon+' '+TRAITS[e.trait].info+'\n…'+QUIRKS[e.quirk]+'">'+(ROLE_EMOJI[e.role]||'🙂')+'<i>'+e.lvl+'</i></span>';
    if(v.mgr){
      const e=v.mgr;
      html+='<span class="chip mgr" style="border-color:'+RARITIES[e.rar].col+'" title="'+e.name+' · Manager · '+RARITIES[e.rar].name+'\n'+TRAITS[e.trait].icon+' '+TRAITS[e.trait].info+'">🎩<i>'+e.lvl+'</i></span>';
    }
    return html;
  }
  function makeCard(i){
    const d=getDef(i);
    const card=document.createElement('div');card.className='card';
    card.innerHTML=
      '<div class="crow"><span class="cemoji">'+d.emoji+'</span>'+
      '<div class="cinfo"><div class="cname">'+d.name+'</div><div class="csub"></div></div>'+
      '<div class="cearn"><div class="val"></div><div class="per"></div></div></div>'+
      '<div class="pbar"><div class="pfill"></div><div class="shine"></div></div>'+
      '<button class="buy"><span class="lbl"></span><span class="cost"></span></button>'+
      '<div class="staffrow">'+
        '<button class="mini staffbtn" title="Bewerber ansehen & Teammitglied einstellen"></button>'+
        '<button class="mini mgrbtn" title="Manager-Kandidaten ansehen"></button>'+
      '</div>'+
      '<div class="teamrow"></div>'+
      '<div class="mshint"></div>';
    const refs={card,sub:card.querySelector('.csub'),val:card.querySelector('.val'),
      per:card.querySelector('.per'),fill:card.querySelector('.pfill'),
      buy:card.querySelector('.buy'),lbl:card.querySelector('.lbl'),
      cost:card.querySelector('.cost'),hint:card.querySelector('.mshint'),
      staff:card.querySelector('.staffbtn'),mgr:card.querySelector('.mgrbtn'),
      team:card.querySelector('.teamrow')};
    refs.buy.addEventListener('click',e=>{e.stopPropagation();tryBuyLevels(i);});
    refs.staff.addEventListener('click',e=>{e.stopPropagation();showHire(i,false);});
    refs.mgr.addEventListener('click',e=>{e.stopPropagation();showHire(i,true);});
    card.addEventListener('click',()=>{CAM.focus(i*SPACING);});
    cards[i]=refs;
    refreshCard(i);
    return card;
  }
  function refreshCard(i){
    const r=cards[i];if(!r)return;
    const d=getDef(i),v=S.venues[i],st=venueStats(i);
    r.sub.textContent='Level '+v.lvl.toLocaleString('de-DE');
    if(st.continuous){
      r.val.textContent=fmt(st.rate)+' €';r.per.textContent='pro Sekunde';
      r.fill.classList.add('continuous');
    }else{
      r.val.textContent=fmt(st.rev)+' €';r.per.textContent='alle '+fmtT(st.time);
      r.fill.classList.remove('continuous');
    }
    const n=buyCount(i),cost=levelCost(i,Math.max(1,n));
    r.lbl.textContent='Ausbauen'+(S.buyAmt==='max'?' Max':(n>1?' ×'+n:''));
    r.cost.textContent=fmt(cost)+' €';
    r.buy.disabled=S.money<levelCost(i,S.buyAmt==='max'?1:n);
    if(v.emp.length>=STAFF_MAX){r.staff.textContent='👥 '+v.emp.length+'/'+STAFF_MAX+' ✓';r.staff.disabled=true;}
    else{
      const sc=staffCost(i,v.emp.length);
      r.staff.innerHTML='👥 '+v.emp.length+'/'+STAFF_MAX+' · <b>'+fmt(sc)+' €</b>';
      r.staff.disabled=S.money<sc;
    }
    if(v.mgr){r.mgr.textContent='🎩 '+v.mgr.name.split(' ')[0]+' ✓';r.mgr.disabled=true;}
    else{
      r.mgr.innerHTML='🎩 <b>'+fmt(managerCost(i))+' €</b>';
      r.mgr.disabled=S.money<managerCost(i);
    }
    r.team.innerHTML=teamChips(i);
    const nm=nextMs(v.lvl);
    r.hint.innerHTML='Nächster Bonus bei Level <b>'+nm.toLocaleString('de-DE')+'</b> ('+(nm-v.lvl).toLocaleString('de-DE')+' fehlen)';
  }
  function makeLockedCard(){
    const i=S.venues.length,d=getDef(i);
    const card=document.createElement('div');card.className='card locked';
    card.innerHTML=
      '<div class="crow"><span class="cemoji">'+d.emoji+'</span>'+
      '<div class="cinfo"><div class="cname">'+d.name+'</div><div class="csub">'+d.desc+'</div></div></div>'+
      '<button class="buy unlock"><span>Eröffnen</span><span class="cost">'+fmt(d.cost)+' €</span></button>';
    const btn=card.querySelector('.buy');
    btn.addEventListener('click',e=>{e.stopPropagation();tryUnlock();});
    lockedCard={btn,cost:d.cost};
    return card;
  }

  /* ---------- Bewerber-Auswahl (Entscheidung beim Einstellen) ---------- */
  let hireCands=null,hireVi=0,hireMgr=false;
  function showHire(i,isMgr){
    const v=S.venues[i];
    if(isMgr&&v.mgr)return;
    if(!isMgr&&v.emp.length>=STAFF_MAX)return;
    hireCands=STAFF.candidates(i,isMgr);hireVi=i;hireMgr=isMgr;
    const cost=isMgr?managerCost(i):staffCost(i,v.emp.length);
    let html='<h2>'+(isMgr?'🎩 Manager gesucht':'👥 Bewerbungsgespräche')+'</h2>'+
      '<p class="center">'+getDef(i).name+' · Kosten: <b>'+fmt(cost)+' €</b> — wähle eine Person:</p>';
    hireCands.forEach((c,k)=>{
      html+=STAFF.cardHTML(c,
        '<button class="mbtn primary hirebtn" '+(S.money<cost?'disabled':'')+' onclick="UI.doHire('+k+')">Einstellen</button>');
    });
    html+='<button class="mbtn ghost" onclick="UI.closeModal()">Später</button>';
    openModal(html);
  }
  function doHire(k){
    if(!hireCands)return;
    if(hireEmployee(hireVi,hireCands[k],hireMgr)){hireCands=null;closeModal();}
  }

  /* ---------- Upgrades-Tab ---------- */
  let upgradeRefs=[];
  function buildUpgrades(){
    if(activeTab!=='upgrades')return;
    panelInner.innerHTML='';upgradeRefs=[];
    for(const fam of UPGRADE_FAMILIES){
      const tier=upTier(fam.id),cost=upgradeCost(fam,tier);
      const card=document.createElement('div');card.className='card upcard';
      card.innerHTML=
        '<div class="crow"><span class="cemoji">'+fam.icon+'</span>'+
        '<div class="cinfo"><div class="cname">'+upgradeName(fam,tier)+'</div>'+
        '<div class="csub">'+fam.info+' · Stufe '+(tier+1)+'</div></div></div>'+
        '<button class="buy unlock"><span>Erforschen</span><span class="cost">'+fmt(cost)+' €</span></button>';
      card.querySelector('.buy').addEventListener('click',()=>tryBuyUpgrade(fam.id));
      upgradeRefs.push({btn:card.querySelector('.buy'),cost});
      panelInner.appendChild(card);
    }
  }

  /* ---------- Ziele-Tab: Tagesaufgaben + Meilenstein ---------- */
  function buildZiele(){
    panelInner.innerHTML='';taskRefs=[];
    MISSIONS.ensureDaily();
    // aktueller Meilenstein
    const ms=MISSIONS.currentMs();
    const msCard=document.createElement('div');msCard.className='card mscard';
    msCard.innerHTML=
      '<div class="csub" style="margin-bottom:4px">🗺️ Meilenstein '+(S.tasks.msIdx+1)+' deiner Karriere</div>'+
      '<div class="crow"><span class="cemoji">'+ms.icon+'</span>'+
      '<div class="cinfo"><div class="cname" style="white-space:normal">'+ms.text+'</div>'+
      '<div class="csub">Belohnung: ≈ '+fmt(MISSIONS.msReward())+' €</div></div></div>';
    panelInner.appendChild(msCard);msRef=msCard;
    // Ausblick
    const nx=getMilestone(S.tasks.msIdx+1);
    const nxCard=document.createElement('div');nxCard.className='card next';
    nxCard.innerHTML='<div class="csub">Danach: '+nx.icon+' '+nx.text+'</div>';
    panelInner.appendChild(nxCard);
    // Tagesaufgaben
    const head=document.createElement('div');head.className='card';
    head.innerHTML='<div class="cname">📋 Tagesaufgaben</div><div class="csub">Jeden Tag drei neue — Belohnung: ≈ '+fmt(MISSIONS.dailyReward())+' € je Aufgabe</div>';
    panelInner.appendChild(head);
    S.tasks.list.forEach((t,idx)=>{
      const d=DAILY_DEFS[t.def];
      const card=document.createElement('div');card.className='card taskcard';
      card.innerHTML=
        '<div class="crow"><span class="cemoji">'+d.icon+'</span>'+
        '<div class="cinfo"><div class="cname" style="white-space:normal">'+d.text(t.goal)+'</div></div>'+
        '<div class="cearn"><div class="val taskpct"></div></div></div>'+
        '<div class="pbar"><div class="pfill"></div></div>'+
        '<button class="buy unlock claim">Abholen 🎁</button>';
      const refs={t,fill:card.querySelector('.pfill'),pct:card.querySelector('.taskpct'),
        claim:card.querySelector('.claim')};
      refs.claim.addEventListener('click',()=>MISSIONS.claimDaily(idx));
      taskRefs.push(refs);
      panelInner.appendChild(card);
      refreshTask(refs);
    });
  }
  function refreshTask(r){
    const p=MISSIONS.taskProgress(r.t);
    r.fill.style.transform='scaleX('+p+')';
    if(r.t.claimed){r.pct.textContent='✅';r.claim.style.display='none';}
    else{
      r.pct.textContent=Math.floor(p*100)+' %';
      r.claim.style.display=p>=1?'flex':'none';
    }
  }

  /* ---------- Boni-Tab: Ruf, Statistik, Erfolge, Team-Album ---------- */
  function buildBoni(){
    panelInner.innerHTML='';
    // Ruf-Karte
    const p=MISSIONS.pts(),r=S.rank;
    const next=RANKS[Math.min(r+1,RANKS.length-1)];
    const isMax=r>=RANKS.length-1;
    const prog=isMax?1:clamp((p-RANKS[r].pts)/(next.pts-RANKS[r].pts),0,1);
    const rankCard=document.createElement('div');rankCard.className='card rankcard';
    rankCard.innerHTML=
      '<div class="crow"><span class="cemoji">'+RANKS[r].icon+'</span>'+
      '<div class="cinfo"><div class="cname">'+RANKS[r].name+'</div>'+
      '<div class="csub">Ruf-Rang '+(r+1)+'/'+RANKS.length+' · +'+Math.round(S.rank*CONFIG.rankBonus*100)+' % Einkommen</div></div></div>'+
      '<div class="pbar"><div class="pfill" style="transform:scaleX('+prog+')"></div></div>'+
      '<div class="csub" style="text-align:center">'+(isMax?'Höchster Rang erreicht! 👑':
        next.icon+' '+next.name+': '+fmt(p)+' / '+fmt(next.pts)+' Ruf-Punkte')+'</div>'+
      '<div class="mshint">Ruf wächst durch Betriebe, Team, Erfolge, Gäste & Prestige</div>';
    panelInner.appendChild(rankCard);
    // Statistik
    const stats=document.createElement('div');stats.className='card';
    stats.innerHTML='<div class="cname" style="margin-bottom:8px">📊 Dein Imperium</div>'+
      '<div class="statline">Gesamt verdient <b>'+fmt(S.lifeEarned)+' €</b></div>'+
      '<div class="statline">Bediente Gäste <b>'+fmt(S.met.guests)+'</b></div>'+
      '<div class="statline">Verkaufte Gerichte <b>'+fmt(S.met.dishes)+'</b></div>'+
      '<div class="statline">Level gesamt <b>'+fmt(totalLevels())+'</b></div>'+
      '<div class="statline">Team eingestellt <b>'+fmt(S.staffHired)+'</b></div>'+
      '<div class="statline">Neueröffnungen <b>'+S.prestiges+'</b></div>'+
      '<div class="statline">Globaler Multiplikator <b>×'+fmt(incomeMult())+'</b></div>';
    panelInner.appendChild(stats);
    // Erfolge
    for(const g of ACH_GROUPS){
      const n=S.ach[g.id]||0;
      const val=achValue(g),nextT=g.thr(n);
      const pct=clamp(val/nextT,0,1);
      const card=document.createElement('div');card.className='card achcard';
      card.innerHTML=
        '<div class="crow"><span class="cemoji">'+g.icon+'</span>'+
        '<div class="cinfo"><div class="cname">'+g.label+' '+(n>0?n:'')+'</div>'+
        '<div class="csub">Nächster: '+g.text(n)+' · je +'+Math.round(g.bonus*100)+' %</div></div>'+
        '<div class="cearn"><div class="val" style="color:var(--gold-soft)">+'+Math.round(n*g.bonus*100)+' %</div></div></div>'+
        '<div class="pbar"><div class="pfill" style="transform:scaleX('+pct+')"></div></div>';
      panelInner.appendChild(card);
    }
    // Team-Album
    const th=document.createElement('div');th.className='card';
    th.innerHTML='<div class="cname">👥 Team-Album</div><div class="csub">Alle Charaktere deines Imperiums</div>';
    panelInner.appendChild(th);
    let any=false;
    S.venues.forEach((v,i)=>{
      for(const e of STAFF.all(v)){
        any=true;
        const wrap=document.createElement('div');
        wrap.innerHTML=STAFF.cardHTML(e,'<div class="empquirk">Arbeitet in: '+getDef(i).emoji+' '+getDef(i).name+'</div>');
        panelInner.appendChild(wrap.firstChild);
      }
    });
    if(!any){
      const e=document.createElement('div');e.className='card';
      e.innerHTML='<div class="csub">Noch niemand eingestellt — schau dir bei deinen Betrieben die Bewerber an!</div>';
      panelInner.appendChild(e);
    }
  }

  /* ================= HUD je Frame ================= */
  function frame(dt){
    const diff=S.money-dispMoney;
    dispMoney=Math.abs(diff)<Math.max(1,S.money*1e-6)?S.money:dispMoney+diff*Math.min(1,dt*7);
    elMoney.textContent=fmt(dispMoney)+' €';
    if(activeTab==='venues')
      for(let i=0;i<S.venues.length;i++){
        const r=cards[i];if(!r)continue;
        if(!r.fill.classList.contains('continuous'))
          r.fill.style.transform='scaleX('+clamp(S.venues[i].prog,0,1)+')';
      }
    uiTimer-=dt;
    if(uiTimer<=0){
      uiTimer=0.2;
      elRate.innerHTML='<b>'+fmt(totalRate())+' €</b> pro Sekunde';
      elSat.textContent=(satisfaction()>=2?'🤩':satisfaction()>=1.4?'😊':'🙂')+' '+fmtPct(satisfaction());
      elRank.textContent=RANKS[S.rank].icon+' '+RANKS[S.rank].name;
      elWeather.textContent=WEATHER.info();
      let sTxt='';
      if(S.stars>0)sTxt+='★ '+fmt(S.stars);
      if(S.spoons>0)sTxt+=(sTxt?' · ':'')+'🥄 '+fmt(S.spoons);
      elStars.style.display=sTxt?'inline':'none';
      elStars.textContent=sTxt;
      if(activeTab==='venues'){
        for(let i=0;i<S.venues.length;i++)refreshCard(i);
        if(lockedCard)lockedCard.btn.disabled=S.money<lockedCard.cost;
      }else if(activeTab==='upgrades'){
        for(const r of upgradeRefs)r.btn.disabled=S.money<r.cost;
      }else if(activeTab==='ziele'){
        for(const r of taskRefs)refreshTask(r);
      }
      const gain=starsGain(),bp=$('btnPrestige');
      bp.classList.toggle('ready',gain>=Math.max(10,S.stars*0.5));
      $('prestigeLbl').textContent=gain>0?'+'+fmt(gain):'';
      updateSpeedBar();
      updateBanner();
    }
  }
  function refreshAll(){if(activeTab==='venues')for(let i=0;i<S.venues.length;i++)refreshCard(i);}
  function refreshMs(){if(activeTab==='ziele')buildPanel();}

  /* ---------- Banner / Toasts ---------- */
  function showBanner(e){bannerEvent=e;bannerEl.classList.add('show');}
  function hideBanner(){bannerEvent=null;bannerEl.classList.remove('show');}
  function updateBanner(){
    if(!bannerEvent)return;
    const left=bannerEvent.until-S.gameTime;
    if(left<=0)hideBanner();
    else bannerEl.innerHTML=bannerEvent.text+'<small>noch '+Math.ceil(left)+' s</small>';
  }
  function toast(msg,gold){
    const t=document.createElement('div');t.className='toast'+(gold?' gold':'');t.innerHTML=msg;
    toastsEl.appendChild(t);
    setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),600);},4500);
    while(toastsEl.children.length>4)toastsEl.firstChild.remove();
  }
  function toastGold(msg){toast(msg,true);}

  /* ================= Modals ================= */
  function openModal(html){modal.innerHTML=html;modalWrap.classList.add('show');}
  function closeModal(){modalWrap.classList.remove('show');}
  function showOffline(o){
    const secs=o.secs;
    const h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60);
    const dur=h>0?h+' Std. '+m+' Min.':m>0?m+' Min.':Math.round(secs)+' Sek.';
    openModal('<h2>Willkommen zurück! 👋</h2>'+
      '<p class="center">Dein Imperium hat '+dur+' ohne dich weitergearbeitet:</p>'+
      '<div class="big">+'+fmt(o.total)+' €</div>'+
      '<div class="offgrid">'+
      '<div class="statline">🍽️ Verkaufte Gerichte <b>'+fmt(o.dishes)+'</b></div>'+
      '<div class="statline">🧑‍🤝‍🧑 Bediente Gäste <b>'+fmt(o.guests)+'</b></div>'+
      '<div class="statline">🏆 Bester Betrieb <b>'+getDef(o.bestI).emoji+' '+getDef(o.bestI).name+'</b></div>'+
      (o.lvlUps>0?'<div class="statline">📚 Team-Level-Aufstiege <b>+'+fmt(o.lvlUps)+'</b></div>':'')+
      '</div>'+
      '<button class="mbtn primary" onclick="UI.closeModal()">Einsammeln 💰</button>');
  }
  function showPrestige(){
    const gain=starsGain(),sg=spoonsGain();
    openModal('<h2>⭐ Neueröffnung</h2>'+
      '<p>Übergib dein Imperium und starte mit frischem Ruhm neu: <b style="color:var(--gold-soft)">Michelin-Sterne</b> bringen je <b>+2&nbsp;%</b> Einkommen — für immer. Ruf-Rang, Erfolge, Statistiken und Upgrades bleiben erhalten.</p>'+
      '<p class="center">Aktuell: ★ '+fmt(S.stars)+' (+'+fmt(S.stars*2)+' %) · 🥄 '+fmt(S.spoons)+' (×'+fmt(1+S.spoons)+')</p>'+
      '<div class="big">Jetzt: +'+fmt(gain)+' Sterne</div>'+
      (gain<1?'<p class="center">Verdiene mehr in diesem Durchlauf, um Sterne zu erhalten.</p>':'')+
      '<button class="mbtn primary" '+(gain<1?'disabled':'')+' onclick="doPrestige();UI.closeModal()">Neueröffnung! ⭐</button>'+
      '<hr class="msep">'+
      '<p>🥄 <b>Goldene Löffel</b> — die zweite Ebene: je '+SPOON_RATE+' Sterne werden zu einem Löffel, der dein Einkommen dauerhaft <b>verdoppelt</b> (kumulativ).</p>'+
      '<div class="big" style="color:var(--gold-soft)">Möglich: +'+fmt(sg)+' 🥄</div>'+
      '<button class="mbtn primary" '+(sg<1?'disabled':'')+' onclick="doSpoonPrestige();UI.closeModal()">Goldener Löffel! 🥄</button>'+
      '<button class="mbtn ghost" onclick="UI.closeModal()">Abbrechen</button>');
  }
  function showSettings(){
    openModal('<h2>⚙️ Einstellungen</h2>'+
      '<div class="setrow"><span>🔊 Soundeffekte</span><input type="range" min="0" max="1" step="0.05" value="'+S.volSfx+'" oninput="S.volSfx=+this.value;AUDIO.applyVolumes()"></div>'+
      '<div class="setrow"><span>🎵 Musik</span><input type="range" min="0" max="1" step="0.05" value="'+S.volMusic+'" oninput="S.volMusic=+this.value;AUDIO.applyVolumes()"></div>'+
      '<div class="setrow"><span>🔢 Zahlenformat</span><span>'+
        ['kurz','lang','sci'].map(f=>'<button class="mbtn ghost small'+(S.numFmt===f?' sel':'')+'" onclick="S.numFmt=\''+f+'\';UI.showSettings()">'+(f==='kurz'?'1,2 Mrd.':f==='lang'?'Milliarden':'1,2e9')+'</button>').join('')+
      '</span></div>'+
      '<div class="setrow"><span>✨ Reduzierte Effekte</span><button class="mbtn ghost" onclick="S.reduceFx=!S.reduceFx;UI.showSettings()">'+(S.reduceFx?'An':'Aus')+'</button></div>'+
      '<hr class="msep">'+
      '<p><b>Spielstand übertragen</b> (Backup wird automatisch mitgeführt):</p>'+
      '<textarea id="saveIO" class="saveio" placeholder="Code hier einfügen zum Importieren…"></textarea>'+
      '<button class="mbtn ghost" onclick="document.getElementById(\'saveIO\').value=exportSave()">Exportieren</button>'+
      '<button class="mbtn ghost" onclick="if(!importSave(document.getElementById(\'saveIO\').value))alert(\'Code ungültig\')">Importieren</button>'+
      '<br><button class="mbtn primary" onclick="UI.closeModal()">Fertig</button>'+
      '<br><button class="danger" onclick="hardReset()">Spielstand komplett löschen</button>');
  }
  function showHelp(){
    openModal('<h2>🍽️ Gastro-Imperium</h2>'+
      '<p><b>Alles läuft von selbst</b> — auch offline. Kein Echtgeld, keine Werbung, nur Spielspaß.</p>'+
      '<p>💶 <b>Ausbauen:</b> Level kaufen; bei 10/25/50/100/200… gibt es dicke Boni und die Gebäude wachsen sichtbar.</p>'+
      '<p>👥 <b>Team:</b> Wähle beim Einstellen aus drei Bewerbern — jeder Charakter hat Seltenheit, Spezialfähigkeit und Marotte, sammelt Erfahrung und steigt im Level.</p>'+
      '<p>🎯 <b>Ziele-Tab:</b> Tagesaufgaben und deine Karriere-Meilensteine mit Belohnungen.</p>'+
      '<p>'+RANKS[1].icon+' <b>Ruf:</b> Vom Straßenstand zum legendären Imperium — Rang-Aufstiege geben dauerhafte Boni und schalten 2×/4×-Tempo frei.</p>'+
      '<p>🌦️ <b>Wetter:</b> Regen stärkt den Lieferdienst, Hitze die Getränke-Betriebe.</p>'+
      '<p>⭐🥄 <b>Prestige:</b> zwei Ebenen für die Ewigkeit (Sterne & Goldene Löffel).</p>'+
      '<p>🖱️ Ziehen dreht die Kamera, Scrollen zoomt, Klick aufs Gebäude gibt einen Schub. Unten links: Pause/Tempo.</p>'+
      '<button class="mbtn primary" onclick="UI.closeModal()">Los geht\'s!</button>');
  }
  return {init,buildPanel,buildUpgrades,refreshCard,refreshMs,frame,
    showBanner,hideBanner,toast,toastGold,showHire,doHire,
    openModal,closeModal,showOffline,showPrestige,showSettings,showHelp,updateSpeedBar,
    showTitle,closeTitle,cinema,cycleTab,cycleTabTo};
})();
function hardReset(){
  if(!confirm('Wirklich ALLES löschen? Auch Sterne, Löffel und Ruf gehen verloren.'))return;
  storeDel();
  location.reload();
}
