'use strict';
/* ============================================================
   staff.js — Mitarbeiter als echte Charaktere
   Jede Kraft hat Name, Rolle, Seltenheit, Eigenschaft (mit
   Spieleffekt), Marotte (Charme), Level & Erfahrung.
   Beim Einstellen wählt der Spieler aus drei Bewerbern.
   ============================================================ */
const STAFF=(()=>{

  function pickRarity(){
    const total=RARITIES.reduce((a,r)=>a+r.w,0);
    let roll=Math.random()*total;
    for(let i=0;i<RARITIES.length;i++){roll-=RARITIES[i].w;if(roll<=0)return i;}
    return 0;
  }
  function roleFor(vi,isMgr){
    if(isMgr)return 'Manager';
    const form=getDef(vi).form;
    const kitchen=KITCHEN_FORMS.includes(form);
    const pool=kitchen?['Koch','Koch','Kellner','Konditor','Chefkoch']
                      :['Kellner','Barista','Barkeeper','Empfang','Sommelier'];
    return pool[randI(0,pool.length-1)];
  }
  function generate(vi,isMgr){
    return {
      name:EMP_FIRST[randI(0,EMP_FIRST.length-1)]+' '+EMP_LAST[randI(0,EMP_LAST.length-1)],
      role:roleFor(vi,isMgr),
      rar:pickRarity(),
      trait:randI(0,TRAITS.length-1),
      quirk:randI(0,QUIRKS.length-1),
      lvl:1,xp:0,
    };
  }
  function candidates(vi,isMgr){
    return [generate(vi,isMgr),generate(vi,isMgr),generate(vi,isMgr)];
  }

  /* ---------- Spielwirkung ---------- */
  function contrib(e){                       // Einnahmen-Beitrag eines Teammitglieds
    return CONFIG.staffBonus*RARITIES[e.rar].mult*(1+CONFIG.staffLvlBonus*(e.lvl-1));
  }
  function mult(v){                          // lokaler Einnahmen-Multiplikator des Betriebs
    let m=1;
    for(const e of v.emp)m+=contrib(e);
    if(v.mgr){                               // Manager skaliert mit Seltenheit & Level
      const e=v.mgr;
      m*=1+(CONFIG.mgrBonus-1)*RARITIES[e.rar].mult*(1+CONFIG.staffLvlBonus*(e.lvl-1));
    }
    return m;
  }
  function all(v){return v.mgr?v.emp.concat([v.mgr]):v.emp;}
  function countTrait(v,id){let c=0;for(const e of all(v))if(TRAITS[e.trait].id===id)c++;return c;}
  function speedMult(v){return Math.pow(0.96,countTrait(v,'speed'));}
  function tipMultOf(v){return Math.pow(1.10,countTrait(v,'tip'));}
  function dayNightMult(v){
    const night=(typeof nightFactor==='function')?nightFactor()>0.5:false;
    return Math.pow(1.15,countTrait(v,night?'night':'day'));
  }
  function moodBonus(){                      // fließt in die Zufriedenheit ein
    let c=0;for(const v of S.venues)c+=countTrait(v,'mood');
    return c*0.03;
  }

  /* ---------- Erfahrung & Level ---------- */
  function lvlFromXp(xp){return Math.min(50,1+Math.floor(Math.sqrt(xp/90)));}
  function xpForNext(e){return 90*Math.pow(e.lvl,2);}
  let lvlToastCd=0;
  function tickXp(dt){
    lvlToastCd-=dt;
    for(let i=0;i<S.venues.length;i++){
      const v=S.venues[i];
      for(const e of all(v)){
        e.xp+=dt*CONFIG.xpPerSec*(TRAITS[e.trait].id==='xp'?2:1);
        const nl=lvlFromXp(e.xp);
        if(nl>e.lvl){
          e.lvl=nl;
          if(lvlToastCd<=0){                 // gedrosselt, damit es nicht spammt
            lvlToastCd=20;
            UI.toast(ROLE_EMOJI[e.role]+' <b>'+e.name+'</b> erreicht Level '+nl+'! ('+getDef(i).name+')');
            WORLD.pop(i,0.5);
          }
        }
      }
    }
  }

  /* HTML-Karte eines Mitarbeiters (für Bewerber-Auswahl & Team-Album) */
  function cardHTML(e,sub){
    const r=RARITIES[e.rar],t=TRAITS[e.trait];
    return '<div class="empcard" style="border-color:'+r.col+'">'+
      '<div class="emptop"><span class="empemoji">'+(ROLE_EMOJI[e.role]||'🙂')+'</span>'+
      '<div class="empmain"><div class="empname">'+e.name+'</div>'+
      '<div class="emprole">'+e.role+' · <span style="color:'+r.col+'">'+r.name+'</span> · Lv. '+e.lvl+'</div></div></div>'+
      '<div class="emptrait">'+t.icon+' <b>'+t.name+'</b> – '+t.info+'</div>'+
      '<div class="empquirk">…'+QUIRKS[e.quirk]+'</div>'+
      (sub||'')+'</div>';
  }
  return {generate,candidates,mult,speedMult,tipMultOf,dayNightMult,moodBonus,
    tickXp,xpForNext,cardHTML,all,contrib};
})();
