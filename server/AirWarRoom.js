'use strict';
// One multiplayer match. The server runs the authoritative simulation (AI, weapons, damage,
// airports, weather, ATC); each client flies its own aircraft and streams its position.
const {Room,matchMaker}=require('@colyseus/core');
const {Schema,MapSchema,defineTypes}=require('@colyseus/schema');
const S=require('../shared/sim.js');

class PlayerS extends Schema{constructor(){super();Object.assign(this,{name:'',cs:'',team:0,type:'f16',lv:'usaf',planeId:0,kills:0,deaths:0,connected:true,host:false});}}
defineTypes(PlayerS,{name:'string',cs:'string',team:'uint8',type:'string',lv:'string',planeId:'uint32',kills:'uint16',deaths:'uint16',connected:'boolean',host:'boolean'});
class PlaneS extends Schema{constructor(){super();Object.assign(this,{id:0,team:0,type:'',lv:'',cs:'',human:false,sid:''});}}
defineTypes(PlaneS,{id:'uint32',team:'uint8',type:'string',lv:'string',cs:'string',human:'boolean',sid:'string'});
class WxS extends Schema{constructor(){super();Object.assign(this,{tod:12,cloud:0,rain:0,storm:0,fog:0,windKt:0,windDir:0});}}
defineTypes(WxS,{tod:'float32',cloud:'float32',rain:'float32',storm:'float32',fog:'float32',windKt:'float32',windDir:'float32'});
class RoomS extends Schema{
  constructor(){super();Object.assign(this,{code:'',title:'',map:'coral',mode:'strike',diff:'normal',pub:true,balance:true,phase:'play',
    timeLeft:0,score0:0,score1:0,kills0:0,kills1:0,reserve0:0,reserve1:0,winner:-1,why:'',players:new MapSchema(),planes:new MapSchema(),wx:new WxS()});}
}
defineTypes(RoomS,{code:'string',title:'string',map:'string',mode:'string',diff:'string',pub:'boolean',balance:'boolean',phase:'string',
  timeLeft:'uint16',score0:'uint16',score1:'uint16',kills0:'uint16',kills1:'uint16',reserve0:'uint16',reserve1:'uint16',winner:'int8',why:'string',
  players:{map:PlayerS},planes:{map:PlaneS},wx:WxS});

const CALL=[['Kestrel','Dingo','Brolga','Wombat','Galah','Taipan','Quoll','Bilby','Numbat','Magpie'],['Viper','Jackal','Raven','Cobra','Hornet','Shrike','Mamba','Krait','Lynx','Talon']];
const TICK=1/30;
const clean=(s,n)=>String(s||'').replace(/[^\w \-.']/g,'').trim().slice(0,n||16);

class AirWarRoom extends Room{
  async onCreate(o){
    o=o||{};
    let code;do{code=Array.from({length:6},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');}while(await matchMaker.getRoomById(code));
    this.roomId=code;
    this.maxClients=10;
    this.autoDispose=true;
    const st=new RoomS();
    st.code=code;st.title=clean(o.title,28)||clean(o.name)+"'s room";
    st.map=S.MAPS[o.map]?o.map:'coral';st.mode=o.mode==='tdm'?'tdm':'strike';st.diff=S.DIFF[o.difficulty]?o.difficulty:'normal';
    st.pub=o.pub!==false;st.balance=o.balance!==false;
    this.setState(st);
    this.opts={map:st.map,mode:st.mode,difficulty:st.diff,aiPerTeam:S.clamp(o.ai|0||8,0,16),weather:o.weather||'dynamic',tod:o.tod!==undefined?+o.tod:13,
      duration:S.clamp(+o.duration||1500,300,3600),blueLivery:o.blueLivery||'usaf',redLivery:'vks'};
    this.newWorld();
    this.setMetadata({code,title:st.title,map:st.map,mode:st.mode,pub:st.pub});
    if(!st.pub)this.setPrivate(true);
    this.snapT=0;this.dmgT=0;this.lastDmg=-1;

    this.onMessage('st',(c,m)=>this.onState(c,m));
    this.onMessage('msl',(c,m)=>{const p=this.planeOf(c),t=m&&this.world.byId.get(m.t|0);if(!p||!t||!p.alive||t.team===p.team)return;
      const dx=t.x-p.x,dy=t.y-p.y,dz=t.z-p.z,d=Math.hypot(dx,dy,dz),F=S.fwd(p);if(d>9000||(dx*F.x+dy*F.y+dz*F.z)/d<Math.cos(.6))return;this.world.fireMissile(p,t);});
    this.onMessage('bomb',c=>{const p=this.planeOf(c);if(!p||!p.alive||p.ground)return;if(p.cls===1){if(p.ammo>0||p.bombs>0){if(p.bombs>0)p.bombs--;this.world.dropBomb(p,false);}}else if(p.bombs>0){p.bombs--;this.world.dropBomb(p,false);}});
    this.onMessage('nuke',c=>{const pl=this.state.players.get(c.sessionId),p=this.planeOf(c);if(!p||!p.alive||p.ground||!pl)return;if((this.nukes[c.sessionId]||0)<=0)return;this.nukes[c.sessionId]--;this.world.dropBomb(p,true);});
    this.onMessage('cm',(c,m)=>{const p=this.planeOf(c);if(p)this.world.countermeasure(p,m==='chaff'?'chaff':'flare');});
    this.onMessage('crash',(c,m)=>{const p=this.planeOf(c);if(!p||!p.alive)return;const by=this.world.time-p.hitT<8?p.lastHitBy:null;
      if(m&&m.kind)this.world.emit('crash',Object.assign({},m,{id:p.id}));this.world.kill(p,by,m&&m.how==='ditch'?'ditch':'crash');});
    this.onMessage('rearm',(c,m)=>{const p=this.planeOf(c);if(!p||!p.alive||!p.ground)return;const hb=this.world.homeBase(p);
      if(p.pad!==hb.i||p.spd>3)return c.send('notice',{text:'Rearm only at '+hb.name+', stopped',col:'#ffd23f'});
      this.world.applyLoad(p,m||{});p.hp=p.hpMax;p.gearDmg=0;this.world.repair(p);p.rearmed=true;c.send('rearmed',{msl:p.msl,ammo:p.ammo,bombs:p.bombs,flares:p.flares,chaff:p.chaff});});
    this.onMessage('spawn',(c,m)=>this.doSpawn(c,m||{}));
    this.onMessage('team',(c,m)=>{const pl=this.state.players.get(c.sessionId),p=this.planeOf(c);if(!pl||!p||p.alive)return;
      const t=m===1?1:0;if(t===pl.team)return;if(this.state.balance&&this.teamCount(t)>=this.teamCount(pl.team))return c.send('notice',{text:'Teams are balanced — '+S.TEAM[t].name+' is full',col:'#ffd23f'});
      pl.team=t;p.team=t;pl.cs=this.callsign(t);p.cs=pl.cs;this.syncPlane(p);});
    this.onMessage('chat',(c,m)=>{const pl=this.state.players.get(c.sessionId);if(pl)this.broadcast('chat',{cs:pl.cs,team:pl.team,text:clean(m,120)});});
    this.onMessage('restart',c=>{if(this.state.phase==='over')this.restart();});
    this.onMessage('ping',(c,m)=>c.send('pong',m));
    // a client says hello once its handlers are ready: it then gets its aircraft and the airport damage
    this.onMessage('hello',c=>{const p=this.planeOf(c);if(p&&p.alive)c.send('spawned',this.spawnInfo(c,p));this.broadcastDamage(true,c);});
    this.setSimulationInterval(dt=>this.tick(dt/1000),1000*TICK);
  }
  newWorld(){
    this.world=new S.World(Object.assign({},this.opts,{auth:true}));
    this.world.populate([0,0]);
    this.nukes={};
    this.state.planes.clear();
    for(const p of this.world.planes)this.syncPlane(p);
    this.state.phase='play';this.state.winner=-1;this.state.why='';
  }
  restart(){
    const humans=[...this.clients].map(c=>({c,pl:this.state.players.get(c.sessionId)})).filter(q=>q.pl);
    this.newWorld();
    for(const {c,pl} of humans){this.addHuman(c,pl);c.send('spawned',this.spawnInfo(c,this.planeOf(c)));}
    this.broadcastDamage(true);
    this.broadcast('restarted',{});
  }
  syncPlane(p){
    let m=this.state.planes.get(String(p.id));
    if(!m){m=new PlaneS();this.state.planes.set(String(p.id),m);}
    m.id=p.id;m.team=p.team;m.type=p.type;m.lv=p.lv;m.cs=p.cs;m.human=p.human;m.sid=p.owner||'';
  }
  teamCount(t){let n=0;this.state.players.forEach(p=>{if(p.team===t)n++;});return n;}
  callsign(t){
    const used=new Set();this.state.players.forEach(p=>used.add(p.cs));
    for(let n=1;n<10;n++)for(const w of CALL[t]){const cs=w+' '+n+'-1';if(!used.has(cs))return cs;}
    return CALL[t][0]+' '+Math.floor(Math.random()*90+10);
  }
  planeOf(c){const pl=this.state.players.get(c.sessionId);return pl?this.world.byId.get(pl.planeId):null;}
  onJoin(client,o){
    o=o||{};
    const pl=new PlayerS();
    pl.name=clean(o.name)||'Pilot';
    let team=o.team===1?1:0;
    if(this.state.balance&&this.teamCount(team)>this.teamCount(1-team)){team=1-team;client.send('notice',{text:'Team balancing put you on '+S.TEAM[team].name+' Team',col:'#ffd23f'});}
    pl.team=team;pl.cs=this.callsign(team);pl.type=S.TYPES[o.type]?o.type:'f16';pl.lv=clean(o.lv,10)||'usaf';
    pl.host=this.clients.length<=1;
    this.state.players.set(client.sessionId,pl);
    this.addHuman(client,pl,o);
    this.broadcast('notice',{text:pl.cs+' ('+pl.name+') joined '+S.TEAM[team].name+' Team',col:S.TEAM[team].col},{except:client});
  }
  addHuman(client,pl,o){
    o=o||{};
    // a human takes the place of one AI fighter on their team
    const w=this.world,ai=w.planes.find(p=>!p.human&&p.team===pl.team&&p.cls===0);
    if(ai)w.removePlane(ai),this.state.planes.delete(String(ai.id));
    const p=w.addPlane({team:pl.team,type:pl.type,human:true,remote:true,owner:client.sessionId,name:pl.name,cs:pl.cs,lv:pl.lv});
    pl.planeId=p.id;this.nukes[client.sessionId]=1;
    this.syncPlane(p);
    this.doSpawn(client,{type:pl.type,lv:pl.lv,base:o.base,air:o.air},true);
  }
  doSpawn(client,m,first){
    const pl=this.state.players.get(client.sessionId),p=this.planeOf(client),w=this.world;
    if(!pl||!p)return;
    if(p.alive&&!first)return;
    if(!first&&p.respawn>0)return client.send('notice',{text:'Next aircraft in '+Math.ceil(p.respawn)+'s',col:'#ffd23f'});
    if(!first){if(w.reserve[p.team]<=0)return client.send('notice',{text:'No aircraft left in reserve',col:'#ff5a4d'});w.reserve[p.team]--;}
    if(m.type&&S.TYPES[m.type]){pl.type=m.type;w.setType(p,m.type);}
    if(m.lv)p.lv=pl.lv=clean(m.lv,10);
    let base=-1;
    if(m.base!==undefined&&m.base!==null&&m.base>=0){const b=w.bases[m.base|0];if(b&&b.team===p.team&&b.hp>0)base=b.i;}
    p.remote=true;
    w.spawn(p,{base,air:!!m.air,load:m.load});
    p.remote=true;
    this.syncPlane(p);
    if(!first)client.send('spawned',this.spawnInfo(client,p));
  }
  spawnInfo(client,p){
    return{id:p.id,type:p.type,lv:p.lv,team:p.team,cs:p.cs,x:p.x,y:p.y,z:p.z,yaw:p.yaw,spd:p.spd,thr:p.thr,ground:p.ground,gear:p.gear,flap:p.flap,pad:p.pad,base:p.base,stand:p.stand,
      msl:p.msl,ammo:p.ammo,bombs:p.bombs,flares:p.flares,chaff:p.chaff,hp:p.hp,nukes:this.nukes[client.sessionId]||0,atc:p.atc,wps:p.wps};
  }
  onState(client,m){
    const p=this.planeOf(client);
    if(!p||!p.alive||!Array.isArray(m)||m.length<17)return;
    const [x,y,z,yaw,pitch,roll,spd,thr,f,gearT,flapT,vs,pad,lock,ax,ay,az]=m;
    if(![x,y,z,yaw,pitch,roll,spd].every(Number.isFinite))return;
    // light sanity checks against teleporting
    const jump=Math.hypot(x-p.x,z-p.z);
    if(jump>Math.max(400,p.maxSpd*2)&&p.lastSt){this.world.emit('notice',{to:p.id,text:'Position rejected',col:'#ff5a4d'});return;}
    const wasGround=p.ground;
    p.x=x;p.y=y;p.z=z;p.yaw=yaw;p.pitch=pitch;p.roll=roll;p.spd=S.clamp(spd,0,p.maxSpd*1.4);p.thr=S.clamp(thr,0,1);
    p.ground=!!(f&4);p.gear=!!(f&8);p.sliding=!!(f&16);p.collapsed=!!(f&32);p.fire=!!(f&64)&&S.TYPES[p.type].gun&&p.ammo>0;p.brake=!!(f&128);p.rev=!!(f&256);
    p.gearT=S.clamp(gearT,0,1);p.flapT=S.clamp(flapT,0,1);p.flap=p.flapT;p.vs=vs;p.pad=pad|0;p.lock=lock|0;
    const al=Math.hypot(ax,ay,az);if(al>.5){p.aimX=ax/al;p.aimY=ay/al;p.aimZ=az/al;}
    if(!wasGround&&p.ground){p.comp=1;this.world.atcTouchdown(p);if(p.pad>=0)p.base=p.pad;}
    if(wasGround&&!p.ground){p.airT=this.world.time;this.world.atcAirborne(p);p.stand=-1;}
    p.lastSt=this.world.time;
  }
  tick(dt){
    const w=this.world;
    // remote humans: fire their guns and run their ATC here, where the runways are allocated
    for(const p of w.planes)if(p.human&&p.alive&&p.remote){
      if(p.fire&&p.cool<=0){p.cool=.07;p.ammo-=2;w.fireGun(p);}
      w.atcUpdate(p);
      if(w.time-(p.lastSt||0)>6&&!p.ground){p.x+=Math.sin(p.yaw)*p.spd*dt;p.z+=Math.cos(p.yaw)*p.spd*dt;}
    }
    w.step(dt);
    // events: ATC addressed to one pilot goes only to that pilot; everything else to the room
    const pub=[];
    for(const e of w.events){
      if(e.e==='kill'){for(const id of[e.k,e.v]){const p=w.byId.get(id);if(p&&p.human){const pl=[...this.state.players.values()].find(q=>q.planeId===id);if(pl){pl.kills=p.kills;pl.deaths=p.deaths;}}}
        const k=w.byId.get(e.k);if(k&&k.human&&e.how!=='nuke'&&k.gunKills%3===0){const sid=k.owner;this.nukes[sid]=Math.min(2,(this.nukes[sid]||0)+1);const c=this.clients.find(q=>q.sessionId===sid);if(c)c.send('nukes',this.nukes[sid]);}}
      if((e.e==='atc'||e.e==='notice'||e.e==='gate'||e.e==='loop')&&e.to){
        const p=w.byId.get(e.to);
        if(p&&p.human){const c=this.clients.find(q=>q.sessionId===p.owner);if(c)c.send('ev',[e]);continue;}
        if(e.e!=='atc')continue;
      }
      if(e.e==='hit'||e.e==='spawn')continue;
      pub.push(e);
    }
    w.events.length=0;
    if(pub.length)this.broadcast('ev',pub);
    this.snapT+=dt;
    if(this.snapT>=1/15){this.snapT=0;this.broadcast('snap',w.snapshot());}
    this.dmgT+=dt;
    if(this.dmgT>.5){this.dmgT=0;this.broadcastDamage(false);}
    const st=this.state,wx=w.weather;
    st.timeLeft=Math.max(0,Math.round(w.duration-w.time));
    st.score0=Math.round(w.score[0]);st.score1=Math.round(w.score[1]);st.kills0=w.kills[0];st.kills1=w.kills[1];st.reserve0=w.reserve[0];st.reserve1=w.reserve[1];
    st.wx.tod=wx.tod;st.wx.cloud=wx.cloud;st.wx.rain=wx.rain;st.wx.storm=wx.storm;st.wx.fog=wx.fog;st.wx.windKt=wx.windKt;st.wx.windDir=wx.windDir;
    if(w.over&&st.phase!=='over'){st.phase='over';st.winner=w.over.winner;st.why=w.over.why;}
    for(const p of w.planes){const m=st.planes.get(String(p.id));if(m&&(m.type!==p.type||m.team!==p.team||m.lv!==p.lv))this.syncPlane(p);}
    for(const [id] of st.planes)if(!w.byId.get(+id))st.planes.delete(id);
  }
  broadcastDamage(force,client){
    const w=this.world;if(!force&&w.dmgVer===this.lastDmg)return;
    this.lastDmg=w.dmgVer;const d=w.damageState();
    if(client)client.send('dmg',d);else this.broadcast('dmg',d);
  }
  async onDrop(client){
    const pl=this.state.players.get(client.sessionId);if(pl)pl.connected=false;
    try{await this.allowReconnection(client,45);}catch(e){}
  }
  onReconnect(client){
    const pl=this.state.players.get(client.sessionId);if(pl)pl.connected=true;
    const p=this.planeOf(client);
    if(p)client.send('resume',{id:p.id,alive:p.alive,x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,spd:p.spd,thr:p.thr,ground:p.ground,gear:p.gear,pad:p.pad,base:p.base,hp:p.hp,type:p.type,lv:p.lv,team:p.team,cs:p.cs,
      msl:p.msl,ammo:p.ammo,bombs:p.bombs,flares:p.flares,chaff:p.chaff,nukes:this.nukes[client.sessionId]||0});
    this.broadcastDamage(true,client);
  }
  onLeave(client){
    const pl=this.state.players.get(client.sessionId);
    if(!pl)return;
    const w=this.world,p=w.byId.get(pl.planeId);
    if(p){w.removePlane(p);this.state.planes.delete(String(p.id));}
    // an AI fighter takes the empty seat
    const fleet=pl.team?S.FLEET.redF:S.FLEET.blueF,ai=w.addPlane({team:pl.team,type:S.FLEET[pl.team?'redF':'blueF'][Math.floor(Math.random()*fleet.length)],cs:S.NAMES[pl.team][Math.floor(Math.random()*12)]+' 9-1',lv:pl.team?this.opts.redLivery:this.opts.blueLivery});
    ai.name=ai.cs;w.spawn(ai);this.syncPlane(ai);
    this.state.players.delete(client.sessionId);
    if(pl.host){const next=[...this.state.players.values()][0];if(next)next.host=true;}
    this.broadcast('notice',{text:pl.cs+' left',col:'#9fb3bd'});
  }
}
module.exports={AirWarRoom};
