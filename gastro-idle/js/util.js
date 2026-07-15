'use strict';
/* ============================================================
   util.js — Zahlenformatierung, Mathe-Helfer, Geometrie-Helfer
   ============================================================ */

/* Deutsche Kurznotation für beliebig große Zahlen */
const TIERS=[['Mio.',1e6],['Mrd.',1e9],['Bio.',1e12],['Brd.',1e15],['Tri.',1e18],['Trd.',1e21],
  ['Qua.',1e24],['Qud.',1e27],['Qui.',1e30],['Qip.',1e33],['Sex.',1e36],['Sed.',1e39],
  ['Sep.',1e42],['Spd.',1e45],['Okt.',1e48],['Okd.',1e51],['Non.',1e54],['Nod.',1e57],
  ['Dez.',1e60],['Dzd.',1e63]];
function fmt(n){
  if(!isFinite(n))return'∞';
  if(n<0)return'-'+fmt(-n);
  if(n<1e6)return n.toLocaleString('de-DE',{maximumFractionDigits:0});
  const mode=(typeof S!=='undefined'&&S&&S.numFmt)||'kurz';
  if(mode==='sci')return n.toExponential(2).replace('.',',').replace('e+','e');
  for(let i=TIERS.length-1;i>=0;i--){
    if(n>=TIERS[i][1]){
      const val=(n/TIERS[i][1]).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2});
      return val+' '+(mode==='lang'&&typeof TIER_LONG!=='undefined'?TIER_LONG[i]:TIERS[i][0]);
    }
  }
  return n.toExponential(2).replace('.',',');
}
function fmtT(s){return s>=10?Math.round(s)+' s':s.toLocaleString('de-DE',{maximumFractionDigits:1})+' s';}
function fmtPct(x){return (x*100).toLocaleString('de-DE',{maximumFractionDigits:0})+' %';}

const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const randI=(a,b)=>Math.floor(rand(a,b+1));
const easeOut=t=>1-Math.pow(1-t,3);

/* ---------- Geometrie-Helfer (abgerundete Formen für den hochwertigen Look) ---------- */
const _geoCache={};
function boxGeo(w,h,d){const k='b'+w+'_'+h+'_'+d;if(!_geoCache[k])_geoCache[k]=new THREE.BoxGeometry(w,h,d);return _geoCache[k];}

/* Abgerundeter Quader über ExtrudeGeometry: weiche Kanten statt Low-Poly-Härte */
function roundedBoxGeo(w,h,d,r){
  const k='r'+w+'_'+h+'_'+d+'_'+r;
  if(_geoCache[k])return _geoCache[k];
  r=Math.min(r,w/2-0.01,d/2-0.01);
  const shape=new THREE.Shape();
  const x=-w/2,y=-d/2;
  shape.moveTo(x+r,y);
  shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);
  shape.lineTo(x+w,y+d-r);shape.quadraticCurveTo(x+w,y+d,x+w-r,y+d);
  shape.lineTo(x+r,y+d);shape.quadraticCurveTo(x,y+d,x,y+d-r);
  shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
  const bev=Math.min(0.06,h*0.1);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:h-bev*2,bevelEnabled:true,bevelThickness:bev,bevelSize:bev,bevelSegments:2,curveSegments:5});
  geo.rotateX(-Math.PI/2);           // Extrusion zeigt nach oben
  geo.translate(0,bev-h/2,0);        // zentriert wie BoxGeometry
  _geoCache[k]=geo;return geo;
}

/* Canvas-Textur mit Text/Emoji */
function makeTextTexture(txt,size,color){
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d');
  g.font='bold '+size+'px sans-serif';g.textAlign='center';g.textBaseline='middle';
  if(color){g.fillStyle=color;g.shadowColor='rgba(0,0,0,0.4)';g.shadowBlur=6;}
  g.fillText(txt,64,68);
  return srgbTex(new THREE.CanvasTexture(c));
}
/* Canvas-Texturen sind sRGB — für korrektes Farbmanagement markieren */
function srgbTex(t){t.encoding=THREE.sRGBEncoding;return t;}

/* ---------- Prozedurale Oberflächen-Texturen (Art-Direction: weiche,
   stilisierte Materialien mit dezenter Variation statt flacher Farben) ---------- */
function texNoise(base,vary,amount){          // Gras, Putz, Stoff
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d');
  g.fillStyle=base;g.fillRect(0,0,128,128);
  g.fillStyle=vary;
  for(let i=0;i<amount;i++){
    g.globalAlpha=rand(0.05,0.2);
    const s=rand(3,14);
    g.fillRect(rand(0,128),rand(0,128),s,s*rand(0.4,1.4));
  }
  g.globalAlpha=1;
  const t=srgbTex(new THREE.CanvasTexture(c));
  t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
function texAsphalt(){                        // Straße mit feinem Korn
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d');
  g.fillStyle='#484c55';g.fillRect(0,0,128,128);
  for(let i=0;i<420;i++){
    g.fillStyle=Math.random()<0.5?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.09)';
    g.fillRect(rand(0,128),rand(0,128),rand(1,2.5),rand(1,2.5));
  }
  const t=srgbTex(new THREE.CanvasTexture(c));
  t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
function texPavers(base,line){                // Gehweg-Platten
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d');
  g.fillStyle=base;g.fillRect(0,0,128,128);
  for(let i=0;i<260;i++){
    g.fillStyle='rgba(255,255,255,0.04)';
    g.fillRect(rand(0,128),rand(0,128),rand(2,6),rand(2,6));
  }
  g.strokeStyle=line;g.lineWidth=2.5;
  for(let x=0;x<=128;x+=32){g.beginPath();g.moveTo(x,0);g.lineTo(x,128);g.stroke();}
  for(let y=0;y<=128;y+=32){g.beginPath();g.moveTo(0,y);g.lineTo(128,y);g.stroke();}
  const t=srgbTex(new THREE.CanvasTexture(c));
  t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
/* Renovierungs-Look: niedrige Ausbaustufe = verblasste, leicht vergraute
   Fassade, hohe Stufe = satte, frisch gestrichene Farbe */
const _greyMix=new THREE.Color(0x9a948c);
function wornColor(hex,extra){
  const c=new THREE.Color(hex);
  const worn=clamp(0.30-extra*0.10,0,0.30);
  c.lerp(_greyMix,worn);
  c.multiplyScalar(0.88+extra*0.05);
  return c;
}
function roundRectPath(g,x,y,w,h,r){
  g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();
}
