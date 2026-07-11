'use strict';
/* ============================================================
   audio.js — prozeduraler Sound: SFX + entspannte Hintergrundmusik
   Alles per WebAudio erzeugt, keine Audiodateien nötig.
   ============================================================ */
const AUDIO=(()=>{
  let ac=null,sfxBus=null,musicBus=null,lastCash=0,musicTimer=null,barIdx=0;

  function ensure(){
    if(ac)return true;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return false;
    ac=new AC();
    sfxBus=ac.createGain();sfxBus.gain.value=0.25*S.volSfx;sfxBus.connect(ac.destination);
    musicBus=ac.createGain();musicBus.gain.value=0.1*S.volMusic;musicBus.connect(ac.destination);
    startMurmur();
    startMusic();
    return true;
  }
  /* Straßen-Ambiente: leises, bandgefiltertes Stimmengemurmel,
     dessen Pegel mit der Zahl der Gäste atmet */
  let murmurGain=null;
  function startMurmur(){
    const len=ac.sampleRate*2;
    const buf=ac.createBuffer(1,len,ac.sampleRate);
    const d=buf.getChannelData(0);
    let last=0;
    for(let i=0;i<len;i++){last=last*0.96+(Math.random()*2-1)*0.04;d[i]=last*3;}
    const src=ac.createBufferSource();src.buffer=buf;src.loop=true;
    const bp=ac.createBiquadFilter();bp.type='bandpass';bp.frequency.value=480;bp.Q.value=0.7;
    murmurGain=ac.createGain();murmurGain.gain.value=0;
    src.connect(bp);bp.connect(murmurGain);murmurGain.connect(sfxBus);
    src.start();
    setInterval(()=>{
      if(!murmurGain)return;
      const n=(typeof ACTORS!=='undefined')?ACTORS.count():0;
      const day=(typeof nightFactor==='function')?1-nightFactor()*0.5:1;
      const target=document.hidden?0:Math.min(n/50,1)*0.05*day;
      murmurGain.gain.linearRampToValueAtTime(target,ac.currentTime+0.8);
    },1000);
  }
  function resume(){if(ac&&ac.state==='suspended')ac.resume();}
  function applyVolumes(){
    if(!ac)return;
    sfxBus.gain.linearRampToValueAtTime(0.25*S.volSfx,ac.currentTime+0.2);
    musicBus.gain.linearRampToValueAtTime(0.1*S.volMusic,ac.currentTime+0.2);
  }

  /* ---------- SFX ---------- */
  function tone(f0,f1,dur,type,vol,delay){
    if(!ac||S.volSfx<=0)return;
    const t=ac.currentTime+(delay||0);
    const o=ac.createOscillator(),g=ac.createGain();
    o.type=type||'sine';
    o.frequency.setValueAtTime(f0,t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime((vol||1)*0.5,t+0.012);
    g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g);g.connect(sfxBus);o.start(t);o.stop(t+dur+0.05);
  }
  const api={
    ensure,resume,
    cash(){const n=performance.now();if(n-lastCash<140)return;lastCash=n;
      tone(1318,1568,0.09,'sine',0.35);tone(2637,2637,0.06,'sine',0.12,0.03);},
    buy(){tone(294,392,0.07,'triangle',0.5);tone(392,523,0.09,'triangle',0.5,0.06);},
    unlock(){[523,659,784,1047].forEach((f,j)=>tone(f,f,0.16,'triangle',0.5,j*0.09));},
    milestone(){[659,831,988,1319].forEach((f,j)=>tone(f,f,0.14,'triangle',0.45,j*0.07));},
    achieve(){[784,988,1175,1568,1976].forEach((f,j)=>tone(f,f,0.13,'sine',0.4,j*0.06));},
    event(){tone(880,660,0.25,'sine',0.4);tone(660,880,0.25,'sine',0.4,0.22);},
    coin(){tone(1976,2637,0.07,'square',0.06);},
    rankUp(){ // große Fanfare für den Ruf-Aufstieg
      [392,523,659,784,1047,1319].forEach((f,j)=>tone(f,f,0.22,'triangle',0.5,j*0.11));
      [784,1047].forEach((f,j)=>tone(f,f,0.5,'sine',0.3,0.7+j*0.05));
    },
    applyVolumes,
  };

  /* ---------- Musik: sanfte Akkord-Pads + Pentatonik-Arpeggio ----------
     Lo-Fi-Wohnzimmer-Stimmung: I–vi–IV–V in C, alle 4 Sekunden ein Akkord. */
  const CHORDS=[
    [261.6,329.6,392.0,493.9],   // Cmaj7
    [220.0,261.6,329.6,392.0],   // Am7
    [174.6,220.0,261.6,349.2],   // Fmaj7
    [196.0,246.9,293.7,392.0],   // G7
  ];
  const PENTA=[523.3,587.3,659.3,784.0,880.0,1046.5];
  function pad(freq,t,dur){
    const o=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter();
    o.type='triangle';o.frequency.value=freq;
    f.type='lowpass';f.frequency.value=900;
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(0.16,t+1.2);
    g.gain.linearRampToValueAtTime(0.10,t+dur-1);
    g.gain.linearRampToValueAtTime(0,t+dur+0.4);
    o.connect(f);f.connect(g);g.connect(musicBus);
    o.start(t);o.stop(t+dur+0.6);
  }
  function pluck(freq,t){
    const o=ac.createOscillator(),g=ac.createGain();
    o.type='sine';o.frequency.value=freq;
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(0.14,t+0.015);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.9);
    o.connect(g);g.connect(musicBus);o.start(t);o.stop(t+1);
  }
  function scheduleBar(){
    if(!ac)return;
    const t=ac.currentTime+0.1,dur=4;
    const chord=CHORDS[barIdx%CHORDS.length];barIdx++;
    for(const f of chord)pad(f,t,dur);
    pad(chord[0]/2,t,dur);                      // Bass
    for(let b=0;b<8;b++)                        // lockere Achtel, nicht jede belegt
      if(Math.random()<0.4)pluck(PENTA[randI(0,PENTA.length-1)],t+b*0.5+rand(-0.02,0.02));
  }
  function startMusic(){
    if(musicTimer)return;
    scheduleBar();
    musicTimer=setInterval(()=>{if(document.hidden||S.volMusic<=0)return;scheduleBar();},4000);
  }
  return api;
})();
