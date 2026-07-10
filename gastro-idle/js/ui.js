'use strict';
/* ============================================================
   ui.js — HUD, Panel mit Tabs, Karten, Modals, Toasts, Banner
   ============================================================ */
const UI=(()=>{
  const $=id=>document.getElementById(id);
  let elMoney,elRate,elSat,elStars,panelInner,modalWrap,modal,bannerEl,toastsEl;
  let dispMoney=0,cards=[],lockedCard=null,uiTimer=0,activeTab='venues',bannerEvent=null;

  function init(){
    elMoney=$('money');elRate=$('rate');elSat=$('satInfo');elStars=$('starsInfo');
    panelInner=$('panelInner');modalWrap=$('modalWrap');modal=$('modal');
    bannerEl=$('eventBanner');toastsEl=$('toasts');
    dispMoney=S.money;
    // Tabs
    document.querySelectorAll('#tabs button').forEach(b=>{
      b.addEventListener('click',()=>{setTab(b.dataset.tab);});
    });
    // Steuer-Buttons
    $('btnBuyAmt').addEventListener('click',()=>{
      const seq=[1,10,100,'max'];
      S.buyAmt=seq[(seq.indexOf(S.buyAmt)+1)%seq.length];
      $('btnBuyAmt').textContent=S.buyAmt==='max'?'Max':'×'+S.buyAmt;
      refreshAll();
    });
    $('btnBuyAmt').textContent=S.buyAmt==='max'?'Max':'×'+S.buyAmt;
    $('btnSettings').addEventListener('click',showSettings);
    $('btnHelp').addEventListener('click',showHelp);
    $('btnPrestige').addEventListener('click',showPrestige);
    modalWrap.addEventListener('click',e=>{if(e.target===modalWrap)closeModal();});
    buildPanel();
  }
  function setTab(t){
    activeTab=t;
    document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
    buildPanel();
  }

  /* ---------- Panel ---------- */
  function buildPanel(){
    panelInner.innerHTML='';cards=[];lockedCard=null;
    if(activeTab==='venues'){
      for(let i=0;i<S.venues.length;i++)panelInner.appendChild(makeCard(i));
      panelInner.appendChild(makeLockedCard());
    }else if(activeTab==='upgrades'){
      buildUpgrades();
    }else{
      buildBoni();
    }
  }
  function makeCard(i){
    const d=getDef(i),v=S.venues[i];
    const card=document.createElement('div');card.className='card';
    card.innerHTML=
      '<div class="crow"><span class="cemoji">'+d.emoji+'</span>'+
      '<div class="cinfo"><div class="cname">'+d.name+'</div><div class="csub"></div></div>'+
      '<div class="cearn"><div class="val"></div><div class="per"></div></div></div>'+
      '<div class="pbar"><div class="pfill"></div><div class="shine"></div></div>'+
      '<button class="buy"><span class="lbl"></span><span class="cost"></span></button>'+
      '<div class="staffrow">'+
        '<button class="mini staffbtn" title="Mitarbeiter einstellen (+30 % je)"></button>'+
        '<button class="mini mgrbtn" title="Manager einstellen (×2,5)"></button>'+
      '</div>'+
      '<div class="mshint"></div>';
    const refs={card,sub:card.querySelector('.csub'),val:card.querySelector('.val'),
      per:card.querySelector('.per'),fill:card.querySelector('.pfill'),
      buy:card.querySelector('.buy'),lbl:card.querySelector('.lbl'),
      cost:card.querySelector('.cost'),hint:card.querySelector('.mshint'),
      staff:card.querySelector('.staffbtn'),mgr:card.querySelector('.mgrbtn')};
    refs.buy.addEventListener('click',e=>{e.stopPropagation();tryBuyLevels(i);});
    refs.staff.addEventListener('click',e=>{e.stopPropagation();tryHireStaff(i);});
    refs.mgr.addEventListener('click',e=>{e.stopPropagation();tryHireManager(i);});
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
    // Personal & Manager
    if(v.staff>=STAFF_MAX){r.staff.textContent='👥 '+v.staff+'/'+STAFF_MAX+' ✓';r.staff.disabled=true;}
    else{
      const sc=staffCost(i,v.staff);
      r.staff.innerHTML='👥 '+v.staff+'/'+STAFF_MAX+' · <b>'+fmt(sc)+' €</b>';
      r.staff.disabled=S.money<sc;
    }
    if(v.mgr){r.mgr.textContent='🎩 Manager ✓';r.mgr.disabled=true;}
    else{
      const mc=managerCost(i);
      r.mgr.innerHTML='🎩 <b>'+fmt(mc)+' €</b>';
      r.mgr.disabled=S.money<mc;
    }
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
      const btn=card.querySelector('.buy');
      btn.addEventListener('click',()=>tryBuyUpgrade(fam.id));
      upgradeRefs.push({btn,cost});
      panelInner.appendChild(card);
    }
  }

  /* ---------- Boni-Tab (Erfolge + Statistik) ---------- */
  function buildBoni(){
    panelInner.innerHTML='';
    const stats=document.createElement('div');stats.className='card';
    stats.innerHTML='<div class="cname" style="margin-bottom:8px">📊 Dein Imperium</div>'+
      '<div class="statline">Gesamt verdient <b>'+fmt(S.lifeEarned)+' €</b></div>'+
      '<div class="statline">Dieser Durchlauf <b>'+fmt(S.runEarned)+' €</b></div>'+
      '<div class="statline">Level gesamt <b>'+fmt(totalLevels())+'</b></div>'+
      '<div class="statline">Angestellte <b>'+fmt(S.staffHired)+'</b></div>'+
      '<div class="statline">Neueröffnungen <b>'+S.prestiges+'</b></div>'+
      '<div class="statline">Globaler Multiplikator <b>×'+fmt(incomeMult())+'</b></div>';
    panelInner.appendChild(stats);
    for(const g of ACH_GROUPS){
      const n=S.ach[g.id]||0;
      const val=achValue(g),next=g.thr(n);
      const pct=clamp(val/next,0,1);
      const card=document.createElement('div');card.className='card achcard';
      card.innerHTML=
        '<div class="crow"><span class="cemoji">'+g.icon+'</span>'+
        '<div class="cinfo"><div class="cname">'+g.label+' '+(n>0?n:'')+'</div>'+
        '<div class="csub">Nächster: '+g.text(n)+' · je +'+Math.round(g.bonus*100)+' % dauerhaft</div></div>'+
        '<div class="cearn"><div class="val" style="color:var(--gold-soft)">+'+Math.round(n*g.bonus*100)+' %</div></div></div>'+
        '<div class="pbar"><div class="pfill" style="transform:scaleX('+pct+')"></div></div>';
      panelInner.appendChild(card);
    }
  }

  /* ---------- HUD je Frame ---------- */
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
      uiTimer=0.18;
      elRate.innerHTML='<b>'+fmt(totalRate())+' €</b> pro Sekunde';
      elSat.textContent=(satisfaction()>=2?'🤩':satisfaction()>=1.4?'😊':'🙂')+' '+fmtPct(satisfaction());
      let sTxt='';
      if(S.stars>0)sTxt+='★ '+fmt(S.stars);
      if(S.spoons>0)sTxt+=(sTxt?' · ':'')+'🥄 '+fmt(S.spoons);
      elStars.style.display=sTxt?'block':'none';
      elStars.textContent=sTxt;
      if(activeTab==='venues'){
        for(let i=0;i<S.venues.length;i++)refreshCard(i);
        if(lockedCard)lockedCard.btn.disabled=S.money<lockedCard.cost;
      }else if(activeTab==='upgrades'){
        for(const r of upgradeRefs)r.btn.disabled=S.money<r.cost;
      }
      const gain=starsGain(),bp=$('btnPrestige');
      bp.classList.toggle('ready',gain>=Math.max(10,S.stars*0.5));
      bp.textContent=gain>0?'⭐ +'+fmt(gain):'⭐';
      updateBanner();
    }
  }
  function refreshAll(){if(activeTab==='venues')for(let i=0;i<S.venues.length;i++)refreshCard(i);}

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

  /* ---------- Modals ---------- */
  function openModal(html){modal.innerHTML=html;modalWrap.classList.add('show');}
  function closeModal(){modalWrap.classList.remove('show');}
  function showOffline(total,secs){
    const h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60);
    const dur=h>0?h+' Std. '+m+' Min.':m>0?m+' Min.':Math.round(secs)+' Sek.';
    openModal('<h2>Willkommen zurück! 👋</h2>'+
      '<p class="center">Dein Imperium hat in deiner Abwesenheit ('+dur+') fleißig weitergearbeitet:</p>'+
      '<div class="big">+'+fmt(total)+' €</div>'+
      '<button class="mbtn primary" onclick="UI.closeModal()">Einsammeln 💰</button>');
  }
  function showPrestige(){
    const gain=starsGain(),sg=spoonsGain();
    openModal('<h2>⭐ Neueröffnung</h2>'+
      '<p>Starte neu und erhalte <b style="color:var(--gold-soft)">Michelin-Sterne</b>: je Stern dauerhaft <b>+2&nbsp;%</b> Einkommen — über alle Neustarts hinweg.</p>'+
      '<p class="center">Aktuell: ★ '+fmt(S.stars)+' (+'+fmt(S.stars*2)+' %) · 🥄 '+fmt(S.spoons)+' (×'+fmt(1+S.spoons)+')</p>'+
      '<div class="big">Jetzt: +'+fmt(gain)+' Sterne</div>'+
      (gain<1?'<p class="center">Verdiene mehr in diesem Durchlauf, um Sterne zu erhalten.</p>':'')+
      '<button class="mbtn primary" '+(gain<1?'disabled':'')+' onclick="doPrestige();UI.closeModal()">Neueröffnung! ⭐</button>'+
      '<hr class="msep">'+
      '<p>🥄 <b>Goldene Löffel</b> — die zweite Prestige-Ebene: Tausche je '+SPOON_RATE+' Sterne gegen einen Löffel. Jeder Löffel <b>verdoppelt</b> dein Einkommen dauerhaft (kumulativ), setzt aber deine Sterne fast vollständig zurück.</p>'+
      '<div class="big" style="color:var(--gold-soft)">Möglich: +'+fmt(sg)+' 🥄</div>'+
      '<button class="mbtn primary" '+(sg<1?'disabled':'')+' onclick="doSpoonPrestige();UI.closeModal()">Goldener Löffel! 🥄</button>'+
      '<button class="mbtn ghost" onclick="UI.closeModal()">Abbrechen</button>');
  }
  function showSettings(){
    openModal('<h2>⚙️ Einstellungen</h2>'+
      '<div class="setrow"><span>🔊 Soundeffekte</span><button class="mbtn ghost" onclick="S.sfx=!S.sfx;UI.showSettings()">'+(S.sfx?'An':'Aus')+'</button></div>'+
      '<div class="setrow"><span>🎵 Musik</span><button class="mbtn ghost" onclick="S.music=!S.music;AUDIO.setMusic(S.music);UI.showSettings()">'+(S.music?'An':'Aus')+'</button></div>'+
      '<hr class="msep">'+
      '<p><b>Spielstand übertragen</b> (z.&nbsp;B. auf einen anderen Rechner):</p>'+
      '<textarea id="saveIO" class="saveio" placeholder="Code hier einfügen zum Importieren…"></textarea>'+
      '<button class="mbtn ghost" onclick="document.getElementById(\'saveIO\').value=exportSave()">Exportieren</button>'+
      '<button class="mbtn ghost" onclick="if(!importSave(document.getElementById(\'saveIO\').value))alert(\'Code ungültig\')">Importieren</button>'+
      '<br><button class="mbtn primary" onclick="UI.closeModal()">Fertig</button>'+
      '<br><button class="danger" onclick="hardReset()">Spielstand komplett löschen</button>');
  }
  function showHelp(){
    openModal('<h2>🍽️ Gastro-Imperium</h2>'+
      '<p><b>Alles läuft von selbst.</b> Deine Betriebe verdienen automatisch — auch offline. Kein Echtgeld, keine Käufe, nur Spielspaß.</p>'+
      '<p>💶 <b>Ausbauen:</b> Level kaufen; bei 10/25/50/100/200… gibt es dicke Boni und die Gebäude wachsen.</p>'+
      '<p>👥 <b>Team:</b> Mitarbeiter (+30 % je) und ein Manager (×2,5) verstärken jeden Betrieb — sie stehen sichtbar vor der Tür.</p>'+
      '<p>🔬 <b>Upgrades-Tab:</b> Kochtempo, Werbung, Deko, Lieferdienst, Drohnen … alles wirkt zusammen und bringt sichtbares Leben in die Straße.</p>'+
      '<p>🏆 <b>Erfolge</b> geben dauerhafte Boni — quasi im Minutentakt kleine Erfolgserlebnisse.</p>'+
      '<p>⭐ <b>Neueröffnung</b> & 🥄 <b>Goldene Löffel:</b> zwei Prestige-Ebenen für die Ewigkeit.</p>'+
      '<p>🖱️ Ziehen dreht die Kamera, Scrollen zoomt, Klick aufs Gebäude gibt einen Schub.</p>'+
      '<button class="mbtn primary" onclick="UI.closeModal()">Los geht\'s!</button>');
  }
  return {init,buildPanel,buildUpgrades,refreshCard,frame,
    showBanner,hideBanner,toast,toastGold,
    openModal,closeModal,showOffline,showPrestige,showSettings,showHelp};
})();
function hardReset(){
  if(!confirm('Wirklich ALLES löschen? Auch Sterne und Löffel gehen verloren.'))return;
  storeDel();
  location.reload();
}
