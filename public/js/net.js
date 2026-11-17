'use strict';
// Multiplayer client: Colyseus room on the same server that served this page.
const NET_DELAY=.12;          // remote aircraft are drawn 120 ms in the past, between two snapshots
const netOK=()=>typeof Colyseus!=='undefined'&&location.protocol.startsWith('http');
function wsURL(){return(location.protocol==='https:'?'wss://':'ws://')+location.host;}
async function api(path){const r=await fetch(path,{cache:'no-store'});let j={};try{j=await r.json();}catch(e){}if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j;}
const NET={
  client:null,room:null,snaps:[],clockOff:null,lastSt:0,ready:false,msl:new Map(),bmb:new Map(),reconnecting:false,
  connect(){if(!this.client)this.client=new Colyseus.Client(wsURL());return this.client;},
  async create(o){this.connect();const r=await this.client.create('air_war',o);this.attach(r);return r;},
  async join(code,o){
    code=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(!/^[A-Z0-9]{6}$/.test(code))throw new Error('Room codes are 6 letters and numbers');
    await api('/api/rooms/'+code);                 // clear message for a wrong, full or finished room
    this.connect();const r=await this.client.joinById(code,o);this.attach(r);return r;
  },
  async rooms(){try{return await api('/api/rooms');}catch(e){return[];}},
  attach(r){
    this.room=r;this.snaps=[];this.clockOff=null;this.ready=false;
    try{sessionStorage.setItem('cf_rt',r.reconnectionToken);}catch(e){}
    r.onMessage('snap',s=>this.onSnap(s));
    r.onMessage('ev',list=>{for(const e of list)onEvent(e,true);});
    r.onMessage('dmg',d=>{if(world){world.applyDamageState(d);syncDamage();}});
    r.onMessage('spawned',m=>onSpawned(m));
    r.onMessage('resume',m=>onSpawned(m,true));
    r.onMessage('rearmed',m=>{if(player){Object.assign(player,m);player.hp=player.hpMax;player.gearDmg=0;world.repair(player);player.rearmed=true;notice('REARMED, REFUELLED AND REPAIRED','#7ddc6f');}});
    r.onMessage('nukes',n=>{nukesHeld=n;notice('☢ NUKE EARNED','#ffd23f');});
    r.onMessage('notice',m=>notice(m.text,m.col));
    r.onMessage('chat',m=>{chatLog.unshift({cs:m.cs,team:m.team,text:m.text,t:12});if(chatLog.length>6)chatLog.pop();});
    r.onMessage('restarted',()=>{notice('NEW ROUND','#7ddc6f');world.wrecks=[];world.craters=[];syncDamage();$('res').classList.add('hide');state='play';});
    r.onMessage('pong',t=>{net.ping=Math.round(performance.now()-t);});
    r.onLeave(code=>{
      if(state==='menu'||code===1000||code===4000)return;
      notice('CONNECTION LOST — RECONNECTING…','#ffd23f');this.tryReconnect();
    });
    r.onError((c,m)=>notice('Server error: '+(m||c),'#ff5a4d'));
  },
  async tryReconnect(){
    if(this.reconnecting)return;this.reconnecting=true;
    const tok=this.room&&this.room.reconnectionToken;
    for(let i=0;i<12&&tok&&state!=='menu';i++){
      await new Promise(r=>setTimeout(r,1500+i*500));
      try{const r=await this.client.reconnect(tok);this.attach(r);r.send('hello');notice('RECONNECTED','#7ddc6f');this.reconnecting=false;return;}catch(e){}
    }
    this.reconnecting=false;if(state!=='menu')endGame(null,'Lost connection to the server');
  },
  leave(){try{if(this.room)this.room.leave(true);}catch(e){}this.room=null;try{sessionStorage.removeItem('cf_rt');}catch(e){}},
  send(t,m){if(this.room)try{this.room.send(t,m);}catch(e){}},
  onSnap(s){
    const now=performance.now()/1000;
    if(this.clockOff===null)this.clockOff=s.t-now;
    this.clockOff+=((s.t-now)-this.clockOff)*.05;         // track the server clock smoothly
    this.snaps.push(s);if(this.snaps.length>30)this.snaps.shift();
  },
  // place remote aircraft, missiles and bombs at render time (interpolated between snapshots)
  apply(){
    if(!this.snaps.length||!world)return;
    const st=this.room.state,T=performance.now()/1000+this.clockOff-NET_DELAY;
    let a=this.snaps[0],b=this.snaps[this.snaps.length-1];
    for(let i=0;i<this.snaps.length-1;i++)if(this.snaps[i].t<=T&&this.snaps[i+1].t>=T){a=this.snaps[i];b=this.snaps[i+1];break;}
    const k=b.t>a.t?clamp((T-a.t)/(b.t-a.t),0,1.25):1,A=new Map(a.P.map(q=>[q[0],q])),seen=new Set();
    for(const q of b.P){
      const id=q[0];seen.add(id);
      let p=world.byId.get(id);
      const meta=st.planes.get(String(id));
      if(!p){if(!meta)continue;p=world.addPlane({id,team:meta.team,type:meta.type,lv:meta.lv,cs:meta.cs,name:meta.cs,human:meta.human,remote:true});}
      if(meta&&(meta.type!==p.type))world.setType(p,meta.type);
      if(meta){p.lv=meta.lv;p.team=meta.team;p.cs=meta.cs;p.human=meta.human;}
      const o=A.get(id)||q,L=(i)=>o[i]+(q[i]-o[i])*k,LA=(i)=>o[i]+angDiff(q[i],o[i])*k,f=q[9];
      if(p===player){ // our own aircraft: the server owns health, weapons and death
        p.hp=q[12];p.kills=q[23];p.deaths=q[24];p.lock=q[13];p.msl=q[18];p.ammo=q[19];p.bombs=q[20];p.flares=q[21];p.chaff=q[22];
        if(q[25]){p.dm=q[25].map(v=>v/100);p.burn=!!(f&2048);p.parts=q[15];world.condOf(p);}
        if(!(f&1)&&p.alive){p.alive=false;p.falling=!!(f&2);p.respawn=q[17];deaths++;}
        if(!p.alive){p.respawn=q[17];if(f&2){p.x=L(1);p.y=L(2);p.z=L(3);p.yaw=LA(4);p.pitch=LA(5);p.roll=LA(6);p.falling=true;}else p.falling=false;}
        continue;
      }
      p.x=L(1);p.y=L(2);p.z=L(3);p.yaw=LA(4);p.pitch=LA(5);p.roll=LA(6);p.spd=L(7);p.thr=q[8];
      p.alive=!!(f&1);p.falling=!!(f&2);p.ground=!!(f&4);p.gear=!!(f&8);p.sliding=!!(f&16);p.collapsed=!!(f&32);p.fire=!!(f&64);p.brake=!!(f&128);p.rev=!!(f&256);
      p.flareT=f&512?1:0;p.chaffT=f&1024?1:0;
      p.gearT=L(10);p.flapT=L(11);p.hp=q[12];p.lock=q[13];p.comp=q[14];p.parts=q[15];p.pad=q[16];p.respawn=q[17];
      p.msl=q[18];p.ammo=q[19];p.bombs=q[20];p.flares=q[21];p.chaff=q[22];p.kills=q[23];p.deaths=q[24];
      if(q[25]){p.dm=q[25].map(v=>v/100);p.burn=!!(f&2048);world.condOf(p);}
    }
    for(const p of world.planes.slice())if(p!==player&&!seen.has(p.id))world.removePlane(p);
    // missiles and bombs: extrapolate from the latest snapshot
    const age=clamp(performance.now()/1000+this.clockOff-b.t,0,.4);
    missiles.length=0;
    for(const m of b.M){const sp=420;missiles.push({id:m[0],x:m[1]+m[4]*sp*age,y:m[2]+m[5]*sp*age,z:m[3]+m[6]*sp*age,dx:m[4],dy:m[5],dz:m[6],team:m[7],kind:m[8]?'ir':'rdr',tgt:world.byId.get(m[9])||null});}
    bombs.length=0;
    for(const m of b.B)bombs.push({id:m[0],x:m[1]+m[4]*age,y:m[2]+m[5]*age,z:m[3]+m[6]*age,vx:m[4],vy:m[5],vz:m[6],nuke:!!m[7]});
    const wx=st.wx;Object.assign(world.weather,{tod:wx.tod,cloud:wx.cloud,rain:wx.rain,storm:wx.storm,fog:wx.fog,windKt:wx.windKt,windDir:wx.windDir});
    reserve=[st.reserve0,st.reserve1];world.reserve=reserve;world.score=[st.score0,st.score1];world.kills=[st.kills0,st.kills1];
    if(st.phase==='over'&&state==='play')endGame(st.winner,st.why);
  },
  // our own aircraft goes up ~20 times a second
  sendState(dt){
    if(!player||!player.alive||!this.room)return;
    this.lastSt+=dt;if(this.lastSt<.05)return;this.lastSt=0;
    const p=player,f=(p.ground?4:0)|(p.gear?8:0)|(p.sliding?16:0)|(p.collapsed?32:0)|(p.fire?64:0)|(p.brake?128:0)|(p.rev?256:0);
    const r=v=>Math.round(v*100)/100;
    this.send('st',[r(p.x),r(p.y),r(p.z),r(p.yaw),r(p.pitch),r(p.roll),r(p.spd),r(p.thr),f,r(p.gearT),r(p.flapT),r(p.vs),p.pad,lockTgt&&lockT>=1.2?lockTgt.id:0,r(p.aimX),r(p.aimY),r(p.aimZ)]);
  }
};
let chatLog=[];
