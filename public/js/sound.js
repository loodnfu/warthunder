'use strict';
/* ---------- sound ---------- */
const snd={ctx:null,mute:false,last:0,
  init(){
    if(this.ctx)return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      const c=this.ctx=new AC();
      const b=c.createBuffer(1,c.sampleRate,c.sampleRate),d=b.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      this.noise=b;this.master=c.createGain();this.master.gain.value=.5;this.master.connect(c.destination);
      const s=c.createBufferSource();s.buffer=b;s.loop=true;
      const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=500;f.Q.value=.6;
      const g=c.createGain();g.gain.value=0;s.connect(f);f.connect(g);g.connect(this.master);s.start();
      this.engF=f;this.engGain=g;
    }catch(e){this.ctx=null;}
  },
  burst(freq,dur,vol,type){
    if(!this.ctx||this.mute||vol<=.01)return;
    try{
      const c=this.ctx,s=c.createBufferSource();s.buffer=this.noise;s.loop=true;
      const f=c.createBiquadFilter();f.type=type;f.frequency.value=freq;
      const g=c.createGain(),t=c.currentTime;
      g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
      s.connect(f);f.connect(g);g.connect(this.master);s.start(t,Math.random()*.5);s.stop(t+dur+.05);
    }catch(e){}
  },
  beep(freq,dur){
    if(!this.ctx||this.mute)return;
    try{const c=this.ctx,o=c.createOscillator(),g=c.createGain(),t=c.currentTime;o.type='square';o.frequency.value=freq;
      g.gain.setValueAtTime(.06,t);g.gain.setValueAtTime(0,t+dur);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+dur+.02);}catch(e){}
  },
  gun(v){const t=performance.now();if(t-this.last<60)return;this.last=t;this.burst(1700,.06,.22*v,'bandpass');},
  boom(v){this.burst(320,.9,.9*v,'lowpass');},
  whoosh(v){this.burst(800,1.1,.6*v,'bandpass');},
  nuke(){this.burst(60,9,2.2,'lowpass');this.burst(180,3,1.4,'lowpass');},
  engine(thr,on){
    if(!this.ctx)return;
    try{const t=this.ctx.currentTime;this.engF.frequency.setTargetAtTime(350+thr*500,t,.2);
      this.engGain.gain.setTargetAtTime(on&&!this.mute?.04+thr*.05:0,t,.2);}catch(e){}
  }
};
const vol=(x,y,z)=>clamp(1-Math.hypot(x-camera.position.x,y-camera.position.y,z-camera.position.z)/3000,0,1);

// extra layers: wind over the airframe, rain, radio static, tyres, thunder
Object.assign(snd,{
  loop(type,freq,q){
    const c=this.ctx,s=c.createBufferSource();s.buffer=this.noise;s.loop=true;
    const f=c.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q||.7;
    const g=c.createGain();g.gain.value=0;s.connect(f);f.connect(g);g.connect(this.master);s.start(0,Math.random());return{f,g};
  },
  env(spd,rain,inside,eng){
    if(!this.ctx)return;
    try{
      if(!this.windL){this.windL=this.loop('lowpass',600,.5);this.rainL=this.loop('highpass',3500,.4);this.jetL=this.loop('lowpass',180,1.4);}
      const t=this.ctx.currentTime,m=this.mute?0:1;
      this.windL.g.gain.setTargetAtTime(m*clamp(spd/320,0,1)*(inside?.05:.16),t,.3);this.windL.f.frequency.setTargetAtTime(300+spd*4,t,.3);
      this.rainL.g.gain.setTargetAtTime(m*rain*(inside?.12:.06),t,.5);
      // low rumble scaled by engine type: jets roar, props drone, rotors thump
      const e=eng||{thr:0,kind:'jet',on:false};
      this.jetL.g.gain.setTargetAtTime(m*(e.on?(e.kind==='rotor'?.08+.06*Math.abs(Math.sin(t*14)):e.kind==='prop'?.06:.05+e.thr*.09):0),t,.08);
      this.jetL.f.frequency.setTargetAtTime(e.kind==='prop'?90+e.thr*60:e.kind==='rotor'?70:140+e.thr*220,t,.2);
      this.engF.Q.value=e.kind==='prop'?3:.6;
    }catch(err){}
  },
  radio(){this.burst(2400,.18,.07,'bandpass');},
  chirp(v){this.burst(2600,.25,.25*v,'bandpass');this.burst(500,.4,.2*v,'lowpass');},
  thud(v){this.burst(120,.35,.6*v,'lowpass');},
  gearMotor(){this.burst(420,1.4,.12,'bandpass');},
  scrape(v){this.burst(1100,.4,.18*v,'highpass');},
  thunder(v){const c=this.ctx;if(!c)return;setTimeout(()=>{this.burst(70,4,1.1*v,'lowpass');this.burst(200,1.2,.5*v,'lowpass');},300+Math.random()*2500);}
});
/* ---------- air traffic control voices (browser speech, each unit its own voice, over radio static) ---------- */
const VOICE={list:[],q:[],busy:false,unit:{GROUND:0,TOWER:1,DEPARTURE:2,APPROACH:3,PILOT:4},pitch:[.9,1.06,.82,1.16,1],rate:[1.08,1.12,1.1,1.05,1.18]};
function loadVoices(){try{const v=speechSynthesis.getVoices()||[];VOICE.list=v.filter(q=>/^en/i.test(q.lang));if(!VOICE.list.length)VOICE.list=v;}catch(e){}}
if(window.speechSynthesis){loadVoices();speechSynthesis.onvoiceschanged=loadVoices;}
function speak(text,unit,quiet){
  if(!window.speechSynthesis||snd.mute)return;
  if(VOICE.q.length>3)VOICE.q.splice(0,VOICE.q.length-2);
  VOICE.q.push({text,unit,quiet});pumpVoice();
}
function pumpVoice(){
  if(VOICE.busy||!VOICE.q.length)return;
  const it=VOICE.q.shift(),u=new SpeechSynthesisUtterance(it.text.replace(/\bRWY\b/g,'runway').replace(/(\d)(\d)(\d)\b/g,'$1 $2 $3'));
  const i=VOICE.unit[it.unit]!==undefined?VOICE.unit[it.unit]:1,L=VOICE.list;
  if(L.length)u.voice=L[(i*3+1)%L.length];
  u.pitch=VOICE.pitch[i];u.rate=VOICE.rate[i];u.volume=it.quiet?.35:.9;
  VOICE.busy=true;snd.radio();
  const done=()=>{VOICE.busy=false;snd.radio();setTimeout(pumpVoice,250);};
  u.onend=done;u.onerror=done;setTimeout(()=>{if(VOICE.busy&&!speechSynthesis.speaking)done();},12000);
  try{speechSynthesis.speak(u);}catch(e){done();}
}
