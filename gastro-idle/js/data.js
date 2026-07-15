'use strict';
/* ============================================================
   data.js — Spieldaten: Betriebe, Upgrades, Erfolge
   Alles rein datengetrieben, damit Balancing an einer Stelle liegt.
   ============================================================ */

/* ---------- Betriebe (handgefertigte Kette, danach prozedural unendlich) ----------
   form  → welcher Gebäude-Bauplan in buildings.js verwendet wird
   cost  → Eröffnungspreis, rev → Einnahme/Umlauf bei Level 1, time → Umlaufzeit s */
const VENUES=[
 {name:'Imbisswagen',    emoji:'🌭',desc:'Wo alles beginnt: Currywurst mit Herz',        cost:4,      rev:5,     time:2,  form:'cart',   base:0xd9824f,roof:0xf2e4c8,accent:0xf2c14e},
 {name:'Café',           emoji:'☕',desc:'Kaffee, Kuchen & Katzenjammer-Kur',            cost:60,     rev:35,    time:4,  form:'cafe',   base:0xc99e72,roof:0x8a5a3b,accent:0x7ccdb8},
 {name:'Pizzeria',       emoji:'🍕',desc:'Holzofen, Herz und Basilikum',                 cost:900,    rev:340,   time:6,  form:'pizza',  base:0xe8dcc3,roof:0xb2483f,accent:0x5e9e50},
 {name:'Burgerladen',    emoji:'🍔',desc:'Smash it till you make it',                    cost:12e3,   rev:3400,  time:8,  form:'burger', base:0xe8524a,roof:0xf5efdd,accent:0xf2c14e},
 {name:'Sushi-Bar',      emoji:'🍣',desc:'Omakase — der Chef entscheidet',               cost:160e3,  rev:33e3,  time:11, form:'sushi',  base:0x2e3140,roof:0xc9564a,accent:0xff8fa5},
 {name:'Steakhaus',      emoji:'🥩',desc:'Dry aged, medium rare, maximal zufrieden',     cost:2.1e6,  rev:330e3, time:15, form:'steak',  base:0x6d4a33,roof:0x3d2f24,accent:0xe0a04a},
 {name:'Hotelrestaurant',emoji:'🏨',desc:'Halbpension war gestern',                      cost:28e6,   rev:3.4e6, time:20, form:'hotel',  base:0xf0e6d4,roof:0x4a6a8a,accent:0xd4a52f},
 {name:'Luxusrestaurant',emoji:'💎',desc:'Sieben Gänge, weiße Handschuhe',               cost:370e6,  rev:35e6,  time:26, form:'luxury', base:0x2b2d3a,roof:0xd4af37,accent:0xd4af37},
 {name:'Kreuzfahrtschiff',emoji:'🛳️',desc:'Buffet auf hoher See, 24/7',                  cost:4.8e9,  rev:360e6, time:34, form:'ship',   base:0xf2f0ea,roof:0xc9564a,accent:0x4a90c2},
 {name:'Freizeitpark',   emoji:'🎡',desc:'Zuckerwatte, Churros, Adrenalin',              cost:63e9,   rev:3.7e9, time:44, form:'park',   base:0xf5efdd,roof:0xe36a8a,accent:0x6a9ee3},
 {name:'Casino',         emoji:'🎰',desc:'Das Buffet gewinnt immer',                     cost:820e9,  rev:38e9,  time:56, form:'casino', base:0x1e1b2e,roof:0xd4af37,accent:0xff4e9e},
 {name:'Flughafen',      emoji:'✈️',desc:'Gate 7: Gourmet-Terminal',                     cost:10.7e12,rev:390e9, time:70, form:'airport',base:0xdde4ea,roof:0x4a6a8a,accent:0xffb14e},
 {name:'Megacity-Foodhall',emoji:'🌆',desc:'40 Etagen Appetit',                          cost:139e12, rev:4e12,  time:88, form:'tower',  base:0x3a4a6a,roof:0x8ab4d8,accent:0x4ef2e0},
 {name:'Internationale Kette',emoji:'🌍',desc:'Ein Logo, tausend Städte',                cost:1.8e15, rev:42e12, time:110,form:'hq',     base:0x2e4a5e,roof:0xf2f0ea,accent:0xe8b84b},
 {name:'Weltweite Gastronomie',emoji:'🌐',desc:'Die ganze Welt zu Tisch',                cost:23e15,  rev:430e12,time:140,form:'world',  base:0xf0ead8,roof:0xd4af37,accent:0xd4af37},
];
/* prozedurale Expansion ab Index 15 */
const EXP_PRE=['Orbital','Tiefsee','Wüsten','Polar','Vulkan','Wolken','Kristall','Dschungel','Nebel','Sternen'];
const EXP_BASE=['Resort','Kolonie','Metropole','Archipel','Raumhafen','Oase','Zitadelle','Karawane','Riviera','Dimension'];
const EXP_EMOJI=['🚀','🌊','🏜️','❄️','🌋','☁️','💠','🌴','🌫️','✨'];
const EXP_FORMS=['tower','hq','casino','park','luxury','world'];
const _defCache=[];
function getDef(i){
  if(_defCache[i])return _defCache[i];
  let d;
  if(i<VENUES.length){d=Object.assign({},VENUES[i]);}
  else{
    const k=i-VENUES.length,gen=Math.floor(k/100);
    const hue=((i*47)%360)/360;
    d={name:EXP_PRE[(i*7)%10]+'-'+EXP_BASE[i%10]+(gen>0?' '+(gen+1)+'.0':''),
       emoji:EXP_EMOJI[i%10],desc:'Unendliche Expansion — Stufe '+(k+1),
       cost:23e15*Math.pow(14,k+1),rev:0,time:140+(k%6)*15,
       form:EXP_FORMS[i%EXP_FORMS.length],
       base:new THREE.Color().setHSL(hue,.42,.52).getHex(),
       roof:new THREE.Color().setHSL(hue,.5,.3).getHex(),
       accent:new THREE.Color().setHSL((hue+0.42)%1,.72,.62).getHex()};
    d.rev=d.cost/20;
  }
  d.growth=Math.min(1.085+i*0.003,1.16);   // Kosten je Level
  _defCache[i]=d;return d;
}

/* ---------- Globale Upgrades (Familien mit unendlichen Stufen) ----------
   effect: 'income' (Einkommens-Multiplikator ×val je Stufe),
           'speed'  (Umlaufzeit ×val je Stufe, geklemmt),
           'sat'    (Zufriedenheit +val je Stufe),
           'walk'   (Gäste-Tempo, plus kleiner Einkommensbonus)                */
const UPGRADE_FAMILIES=[
 {id:'koch',   icon:'👨‍🍳',effect:'speed', val:0.92, baseCost:1200,  mult:26,
  names:['Schärfere Messer','Profi-Herde','Induktions-Wok','Convotherm-Öfen','Roboter-Sous-Chef'],
  info:'Alle Betriebe arbeiten 8 % schneller'},
 {id:'tip',    icon:'💰',effect:'income',val:1.12, baseCost:300,   mult:22,
  names:['Trinkgeldglas','Charmantes Personal','Kartenleser am Tisch','Stammgast-Bonus','Legendärer Service'],
  info:'+12 % Einnahmen (Trinkgeld)'},
 {id:'werbung',icon:'📣',effect:'income',val:1.15, baseCost:800,   mult:24,
  names:['Flyer im Viertel','Radiospot','Foodblogger-Dinner','TV-Kampagne','Weltweite Marke'],
  info:'+15 % Einnahmen (Werbung), mehr Gäste'},
 {id:'lauf',   icon:'👟',effect:'walk',  val:1.06, baseCost:2000,  mult:25,
  names:['Bequeme Schuhe','Servier-Trolleys','Rollschuh-Service','Laufband-Gassen','Hoverboards'],
  info:'Gäste & Personal 15 % flotter, +6 % Einnahmen'},
 {id:'deko',   icon:'🪴',effect:'sat',   val:0.08, baseCost:600,   mult:23,
  names:['Blumenkästen','Lichterketten','Designer-Mobiliar','Wintergarten','Hängende Gärten'],
  info:'+8 % Zufriedenheit, hübschere Straße'},
 {id:'liefer', icon:'🚗',effect:'income',val:1.10, baseCost:60e3,  mult:28,
  names:['Lieferwagen','Flottenausbau','Express-Routen','Kühl-Transporter','Nachtlieferung'],
  info:'+10 % Einnahmen, Lieferautos fahren vor'},
 {id:'drohne', icon:'🛸',effect:'income',val:1.12, baseCost:8e9,   mult:30,
  names:['Lieferdrohne','Drohnen-Schwarm','Autopilot-Netz','Stratosphären-Fracht','Orbital-Drop'],
  info:'+12 % Einnahmen, Drohnen am Himmel'},
];
function upgradeName(fam,tier){ // tier = bereits gekaufte Stufen → Name der nächsten
  return tier<fam.names.length?fam.names[tier]:fam.names[fam.names.length-1]+' '+(tier-fam.names.length+2);
}
function upgradeCost(fam,tier){return fam.baseCost*Math.pow(fam.mult,tier);}

/* ---------- Erfolge (unendlich generierte Schwellen, je +dauerhafter Bonus) ---------- */
const ACH_GROUPS=[
 {id:'earned', icon:'💶',label:'Umsatz',        bonus:0.02, thr:n=>100*Math.pow(1000,n),
  text:n=>'Insgesamt '+fmt(100*Math.pow(1000,n))+' € verdient'},
 {id:'venues', icon:'🏪',label:'Standorte',     bonus:0.03, thr:n=>2+n*2,
  text:n=>(2+n*2)+' Betriebe gleichzeitig'},
 {id:'levels', icon:'📈',label:'Ausbau',        bonus:0.02, thr:n=>Math.round(50*Math.pow(2.6,n)),
  text:n=>fmt(Math.round(50*Math.pow(2.6,n)))+' Level insgesamt'},
 {id:'staff',  icon:'👥',label:'Team',          bonus:0.02, thr:n=>Math.round(5*Math.pow(2.2,n)),
  text:n=>fmt(Math.round(5*Math.pow(2.2,n)))+' Angestellte eingestellt'},
 {id:'prestige',icon:'⭐',label:'Neueröffnungen',bonus:0.05, thr:n=>[1,2,3,5,8,13,21][n]||21*Math.pow(2,n-6),
  text:n=>fmt([1,2,3,5,8,13,21][n]||21*Math.pow(2,n-6))+'× neu eröffnet'},
];

/* ---------- Zentrale Balancing-Konfiguration ----------
   Alle wichtigen Stellschrauben an einem Ort (Debug-Panel: ?debug). */
const CONFIG={
  staffMax:5,          // Teamgröße je Betrieb (ohne Manager)
  staffBonus:0.30,     // Einnahmen-Basis je Teammitglied
  mgrBonus:2.5,        // Manager-Multiplikator
  staffLvlBonus:0.03,  // je Mitarbeiter-Level zusätzlich (auf seinen Beitrag)
  xpPerSec:1,          // XP-Gewinn pro Sekunde Betrieb
  starBonus:0.02,      // je Michelin-Stern
  rankBonus:0.06,      // je Ruf-Rang
  tipShare:0.02,       // Trinkgeld je Gast (Anteil vom Umlauf)
  offlineCapH:24,      // Stunden Offline-Verdienst maximal
  dailyRewardSec:120,  // Tagesaufgabe: Belohnung ≈ n Sekunden Einkommen
  msRewardSec:420,     // Meilenstein: Belohnung ≈ n Sekunden Einkommen
};
const STAFF_MAX=CONFIG.staffMax;
const STAFF_BONUS=CONFIG.staffBonus;
const MGR_BONUS=CONFIG.mgrBonus;
function staffCost(i,n){return getDef(i).cost*40*Math.pow(5,n);}
function managerCost(i){return getDef(i).cost*600;}

/* ---------- Mitarbeiter-Charaktere ---------- */
const EMP_FIRST=['Lena','Ben','Mia','Jonas','Emma','Paul','Ida','Noah','Frieda','Karl','Zoé','Max','Tilda','Ole','Nele','Emil','Greta','Anton','Lotte','Theo','Marlene','Bruno','Clara','Oskar','Yuki','Rosa','Samir','Ivy'];
const EMP_LAST=['Sommer','Brotgold','Pfefferkorn','Salzmann','Honigmann','Zimtstern','Kirschbaum','Krümel','Sahnestein','Muskat','Vanille','Löffelholz','Messerle','Brenner','Kesselring','Schaumburg'];
const ROLE_EMOJI={'Koch':'👨‍🍳','Chefkoch':'👩‍🍳','Konditor':'🧁','Kellner':'🤵','Barista':'☕','Barkeeper':'🍸','Empfang':'💁','Sommelier':'🍷','Manager':'🎩'};
const KITCHEN_FORMS=['cart','pizza','burger','sushi','steak','hotel','luxury','world'];
const RARITIES=[
 {name:'Solide',    mult:1,   w:58, col:'#9aa0ad'},
 {name:'Talentiert',mult:1.3, w:27, col:'#6fd58a'},
 {name:'Brillant',  mult:1.7, w:12, col:'#6a9ee3'},
 {name:'Legendär',  mult:2.4, w:3,  col:'#e8b84b'},
];
const TRAITS=[
 {id:'tip',  icon:'💰',name:'Charmeur',      info:'+10 % Trinkgeld im Betrieb'},
 {id:'speed',icon:'⚡',name:'Flinke Hände',  info:'Betrieb arbeitet 4 % schneller'},
 {id:'mood', icon:'☀️',name:'Sonnenschein',  info:'+3 % Gästezufriedenheit'},
 {id:'night',icon:'🦉',name:'Nachteule',     info:'+15 % Einnahmen nachts'},
 {id:'day',  icon:'🐦',name:'Frühaufsteher', info:'+15 % Einnahmen tagsüber'},
 {id:'xp',   icon:'📚',name:'Wissbegierig',  info:'Lernt doppelt so schnell'},
];
const QUIRKS=['singt beim Arbeiten','hasst Montage','sammelt Salzstreuer','erzählt Papa-Witze','tanzt beim Abwasch',
 'benennt alle Töpfe','spricht mit den Pflanzen','trinkt 9 Espressi am Tag','pfeift Filmmusik','verlegt ständig den Stift',
 'kennt jeden Stammgast beim Namen','träumt vom eigenen Foodtruck'];

/* ---------- Ruf-Ränge (Bewertungssystem) ---------- */
const RANKS=[
 {name:'Straßenstand',                 icon:'🛖', pts:0},
 {name:'Lokaler Geheimtipp',           icon:'🌱', pts:30},
 {name:'Beliebtes Lokal',              icon:'😊', pts:85},
 {name:'Regionale Marke',              icon:'🏙️', pts:170},
 {name:'Ausgezeichnetes Haus',         icon:'🏅', pts:310},
 {name:'Luxus-Gastronomie',            icon:'💎', pts:540},
 {name:'Internationale Spitzenklasse', icon:'🌍', pts:850},
 {name:'Legendäres Gastro-Imperium',   icon:'👑', pts:1250},
];

/* ---------- Tagesaufgaben ---------- */
const DAILY_DEFS=[
 {id:'guests',icon:'🧑‍🤝‍🧑',metric:'guests',goal:r=>30+r*35,  text:g=>'Bediene '+fmt(g)+' Gäste'},
 {id:'dishes',icon:'🍽️',metric:'dishes',goal:r=>60+r*80,  text:g=>'Verkaufe '+fmt(g)+' Gerichte'},
 {id:'tips',  icon:'🪙',metric:'tips',  goal:r=>25+r*25,  text:g=>'Kassiere '+fmt(g)+' Trinkgelder'},
 {id:'levels',icon:'📈',metric:'levels',goal:r=>25+r*20,  text:g=>'Kaufe '+fmt(g)+' Level'},
 {id:'clicks',icon:'👆',metric:'clicks',goal:r=>12+r*6,   text:g=>'Feuere deine Betriebe '+fmt(g)+'× an'},
 {id:'hires', icon:'👥',metric:'hires', goal:r=>1,        text:g=>'Stelle '+g+' neues Teammitglied ein'},
];

/* ---------- Meilenstein-Kette (kleine Geschichte des Aufstiegs) ---------- */
const MS_LIST=[
 {icon:'🌭',text:'Bediene 25 Gäste an deinem Imbisswagen',        check:()=>S.met.guests>=25},
 {icon:'☕',text:'Eröffne das Café nebenan',                       check:()=>S.venues.length>=2},
 {icon:'👥',text:'Stelle dein erstes Teammitglied ein',            check:()=>S.met.hires>=1},
 {icon:'📈',text:'Erreiche insgesamt Level 50',                    check:()=>totalLevels()>=50},
 {icon:'🍕',text:'Eröffne die Pizzeria',                           check:()=>S.venues.length>=3},
 {icon:'🌱',text:'Werde zum „Lokalen Geheimtipp“',                 check:()=>S.rank>=1},
 {icon:'🪙',text:'Kassiere 100 Trinkgelder',                       check:()=>S.met.tips>=100},
 {icon:'💶',text:'Verdiene deine erste Million',                   check:()=>S.lifeEarned>=1e6},
 {icon:'🎩',text:'Ein Manager führt einen deiner Betriebe',        check:()=>S.venues.some(v=>v.mgr)},
 {icon:'🍔',text:'Eröffne den Burgerladen',                        check:()=>S.venues.length>=4},
 {icon:'😊',text:'Werde zum „Beliebten Lokal“',                    check:()=>S.rank>=2},
 {icon:'🍣',text:'Eröffne die Sushi-Bar',                          check:()=>S.venues.length>=5},
 {icon:'💰',text:'Verdiene 1 Milliarde',                           check:()=>S.lifeEarned>=1e9},
 {icon:'🏆',text:'Sammle 10 Erfolge',                              check:()=>ACH_GROUPS.reduce((a,g)=>a+(S.ach[g.id]||0),0)>=10},
 {icon:'🏨',text:'Eröffne das Hotelrestaurant',                    check:()=>S.venues.length>=7},
 {icon:'🏙️',text:'Werde zur „Regionalen Marke“',                   check:()=>S.rank>=3},
 {icon:'🛳️',text:'Steche mit dem Kreuzfahrtschiff in See',         check:()=>S.venues.length>=9},
 {icon:'⭐',text:'Wage deine erste Neueröffnung (Prestige)',        check:()=>S.prestiges>=1},
 {icon:'🎡',text:'Eröffne den Freizeitpark',                       check:()=>S.venues.length>=10},
 {icon:'🏅',text:'Werde zum „Ausgezeichneten Haus“',               check:()=>S.rank>=4},
 {icon:'🎰',text:'Eröffne das Casino',                             check:()=>S.venues.length>=11},
 {icon:'💶',text:'Verdiene 1 Billion',                             check:()=>S.lifeEarned>=1e12},
 {icon:'✈️',text:'Eröffne den Flughafen',                          check:()=>S.venues.length>=12},
 {icon:'🥄',text:'Verdiene deinen ersten Goldenen Löffel',         check:()=>S.spoons>=1},
 {icon:'🌐',text:'Vollende die weltweite Gastronomie',             check:()=>S.venues.length>=15},
 {icon:'👑',text:'Werde zum „Legendären Gastro-Imperium“',         check:()=>S.rank>=7},
];
function getMilestone(idx){
  if(idx<MS_LIST.length)return MS_LIST[idx];
  const n=idx-MS_LIST.length,goal=Math.pow(10,13+n*3);
  return {icon:'🌌',text:'Verdiene insgesamt '+fmt(goal)+' €',check:()=>S.lifeEarned>=goal};
}

/* ---------- Lange Zahlennamen (Format-Option „ausgeschrieben“) ---------- */
const TIER_LONG=['Millionen','Milliarden','Billionen','Billiarden','Trillionen','Trilliarden',
 'Quadrillionen','Quadrilliarden','Quintillionen','Quintilliarden','Sextillionen','Sextilliarden',
 'Septillionen','Septilliarden','Oktillionen','Oktilliarden','Nonillionen','Nonilliarden',
 'Dezillionen','Dezilliarden'];

/* ---------- Meilensteine ---------- */
function msCount(l){let c=0;if(l>=10)c++;if(l>=25)c++;if(l>=50)c++;if(l>=100)c+=Math.floor(l/100);return c;}
function nextMs(l){if(l<10)return 10;if(l<25)return 25;if(l<50)return 50;return (Math.floor(l/100)+1)*100;}
