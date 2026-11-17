'use strict';
/* ---------- glue between the shared simulation, the network and the visuals ---------- */
const holdFor=(b,r,z)=>world.holdFor(b,r,z);
let nukes=[],debris=[],visTr=[],mode='sp',lastHp=0,paused=false,radioLog=[],manualTgt=null,spawnBase=-1,spawnAir=false,myCS='',scoreOpen=false,lastWorldKey='',helpOpen=false;
const MP=()=>mode==='mp';
const AF_LIVERY={usaf:'usaf',raf:'raf',raaf:'raaf'};
const TYPE_LIVERY={rafale:'fr',m2000:'fr',f18e:'usn',ea18g:'raaf',gripen:'black',kf21:'black',jf17:'aggr'};
const show$=(id,on)=>$(id).classList.toggle('hide',!on);

/* ---------- setup screen ---------- */
function fillSelect(sel,items,val){sel.innerHTML='';for(const [v,l] of items){const o=document.createElement('option');o.value=v;o.textContent=l;sel.appendChild(o);}if(val!==undefined)sel.value=val;}
function fillAircraft(sel){
  sel.innerHTML='';
  for(const k in AIR_FORCES){
    const g=document.createElement('optgroup');g.label=AIR_FORCES[k].name;
    for(const t of AIR_FORCES[k].types){const o=document.createElement('option');o.value=k+':'+t;o.textContent=(TYPES[t].full||TYPES[t].name)+' — '+['fighter','bomber','surveillance','transport'][TYPES[t].cls];g.appendChild(o);}
    sel.appendChild(g);
  }
}
function typeOf(v){const [af,t]=String(v).split(':');return{af,t:TYPES[t]?t:'f35a'};}
const BASE_LABEL=t=>[0,1,2].map(i=>{const b=menuBases[t*3+i];return[String(b.i),b.name+' — '+S.KIND[b.kind].name.toLowerCase()];});
const menuBases=new S.World({map:'coral',aiPerTeam:0}).bases;
function describeType(t){
  const T=TYPES[t];
  return '<b>'+(T.full||T.name)+'</b><br>Top speed '+kt(T.max)+' kt · '+(T.msl?T.msl+'× '+T.mslName:'no missiles')+(T.bombs?' · '+T.bombs+' bombs':'')+(T.gun?' · cannon':'')+
    '<br>Home base: '+S.KIND[kindOf(T.cls)].name+(T.awacs?' · airborne radar for the team':'')+(T.heli?' · helicopter':'')+(MODEL_FILES.has(T.model+'.body')?' · <span class="ok">3D model</span>':'');
}
function syncSetup(){
  const s=typeOf($('sType').value);myType=s.t;myAF=s.af;
  $('sDesc').innerHTML=describeType(myType);
  $('tBlue').classList.toggle('on',myTeam===0);$('tRed').classList.toggle('on',myTeam===1);
  fillSelect($('sBase'),[['-1','Home base for this aircraft'],...BASE_LABEL(myTeam),['air','Airborne, near home']],$('sBase').value||'-1');
  ensureModel(TYPES[myType].model);show.key='';
}
function initSetup(){
  fillAircraft($('sType'));$('sType').value='raaf:f35a';
  fillSelect($('sLiv'),Object.values(LIVERIES).filter(l=>!l.hidden).map(l=>[l.id,l.name+' — '+l.sub]),'raaf');
  fillSelect($('sMap'),Object.keys(MAPS).map(k=>[k,MAPS[k].name+' — '+MAPS[k].desc]),'coral');
  fillSelect($('sDiff'),[['easy','Easy'],['normal','Normal'],['hard','Hard'],['expert','Expert']],'normal');
  fillSelect($('sMode'),[['strike','Base strike — destroy their fighter base'],['tdm','Team dogfight — first to 30 kills']],'strike');
  fillSelect($('sWx'),[['dynamic','Dynamic (changes during the match)'],['clear','Clear'],['fair','Fair weather'],['overcast','Overcast'],['rain','Rain'],['storm','Thunderstorms'],['fog','Fog']],'dynamic');
  fillSelect($('sTod'),[['6','Sunrise'],['9','Morning'],['13','Midday'],['17.6','Sunset'],['20.5','Dusk'],['23','Night']],'13');
  try{const n=localStorage.getItem('cf_name');if(n)$('sName').value=n;}catch(e){}
  $('sType').addEventListener('change',()=>{const s=typeOf($('sType').value);const lv=TYPE_LIVERY[s.t]||AF_LIVERY[s.af];if(lv){$('sLiv').value=lv;myLiv=lv;}syncSetup();});
  $('sLiv').addEventListener('change',()=>{myLiv=$('sLiv').value;show.key='';});
  $('sMap').addEventListener('change',()=>{myMap=$('sMap').value;});
  $('tBlue').onclick=()=>{myTeam=0;syncSetup();};$('tRed').onclick=()=>{myTeam=1;syncSetup();};
  $('sAI').addEventListener('input',()=>$('vAI').textContent=$('sAI').value);
  $('bPlay').onclick=()=>{snd.init();show$('title',false);show$('menu',true);refreshRooms();};
  $('bBack').onclick=()=>{show$('menu',false);show$('title',true);};
  $('bHelp').onclick=()=>{helpOpen=!helpOpen;show$('help',helpOpen);};
  $('bAI').onclick=()=>{snd.init();startSP();};
  $('bCreate').onclick=()=>startMP(true);
  $('bJoin').onclick=()=>startMP(false);
  $('sCode').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);$('mpErr').textContent='';});
  $('sCode').addEventListener('keydown',e=>{if(e.key==='Enter')startMP(false);});
  $('bCopy').onclick=()=>{const c=$('codeTxt').textContent;try{navigator.clipboard.writeText(c);$('bCopy').textContent='COPIED';setTimeout(()=>$('bCopy').textContent='COPY',1500);}catch(e){}};
  if(!netOK()){$('mpNote').classList.remove('hide');for(const id of['bCreate','bJoin','sCode'])$(id).disabled=true;}
  syncSetup();
}
async function refreshRooms(){
  if(!netOK())return;
  const list=await NET.rooms(),box=$('roomList');box.innerHTML='';
  if(!list.length){box.innerHTML='<span class="dim">No public rooms right now — create one.</span>';return;}
  for(const r of list){const b=document.createElement('button');b.className='room';b.textContent=r.code+' · '+r.title+' · '+(MAPS[r.map]?MAPS[r.map].name:r.map)+' · '+r.players+'/'+r.max;b.onclick=()=>{$('sCode').value=r.code;startMP(false);};box.appendChild(b);}
}
function readName(){
  let n=($('sName').value||'').replace(/[^\w \-.']/g,'').trim().slice(0,16);
  if(!n){$('mpErr').textContent='Enter a username first';$('sName').focus();return null;}
  try{localStorage.setItem('cf_name',n);}catch(e){}myName=n;return n;
}

/* ---------- starting a match ---------- */
function worldOpts(){
  const wx=$('sWx').value;
  return{map:myMap,mode:$('sMode').value,difficulty:$('sDiff').value,aiPerTeam:+$('sAI').value,weather:wx,dynamic:wx==='dynamic',tod:+$('sTod').value,
    blueLivery:myTeam===0?myLiv:'usaf',redLivery:myTeam===1?myLiv:'vks',landToWin:true};
}
function startSP(){
  if(!readName())return;
  spawnBase=$('sBase').value==='air'?-1:+$('sBase').value;spawnAir=$('sBase').value==='air';
  world=new S.World(Object.assign({auth:true},worldOpts()));
  myCS=S.NAMES[myTeam][0]+' 1-1';
  player=world.addPlane({team:myTeam,type:myType,human:true,local:true,name:myName,cs:myName,lv:myLiv});
  world.populate(myTeam?[0,1]:[1,0]);
  world.spawn(player,{base:spawnBase,air:spawnAir});
  nukesHeld=1;begin('sp');
}
async function startMP(create){
  $('mpErr').textContent='';
  if(!readName())return;
  if(!create&&!/^[A-Z0-9]{6}$/.test($('sCode').value)){$('mpErr').textContent='Enter the 6-character room code';return;}
  snd.init();
  const base=$('sBase').value,o={name:myName,team:myTeam,type:myType,lv:myLiv,base:base==='air'?-1:+base,air:base==='air'};
  $('bCreate').disabled=$('bJoin').disabled=true;$('mpErr').textContent=create?'Creating room…':'Joining '+$('sCode').value+'…';
  try{
    let r;
    if(create){const w=worldOpts();r=await NET.create(Object.assign(o,{pub:$('sPub').checked,map:w.map,mode:w.mode,difficulty:w.difficulty,ai:w.aiPerTeam,weather:w.weather,tod:w.tod,blueLivery:w.blueLivery,title:myName+"'s room"}));}
    else r=await NET.join($('sCode').value,o);
    $('mpErr').textContent='';
    await waitState(r);
    const st=r.state;
    world=new S.World({auth:false,map:st.map,mode:st.mode,difficulty:st.diff,aiPerTeam:0});
    world.planes.length=0;player=null;net=NET;
    $('codeTxt').textContent=st.code;
    begin('mp');
    r.send('hello');
  }catch(e){$('mpErr').textContent=friendly(e);}
  finally{$('bCreate').disabled=$('bJoin').disabled=false;}
}
function friendly(e){const m=(e&&e.message)||String(e);if(/not found|No room/i.test(m))return 'No room with that code. Check it and try again.';if(/full/i.test(m))return 'That room is full (10 players).';if(/fetch|network|ECONN|WebSocket/i.test(m))return 'Cannot reach the game server.';return m;}
function waitState(r){return new Promise(res=>{if(r.state&&r.state.code)return res();let n=0;const iv=setInterval(()=>{if((r.state&&r.state.code)||++n>50){clearInterval(iv);res();}},100);});}
function begin(m){
  mode=m;state='play';paused=false;
  show$('title',false);show$('menu',false);show$('res',false);show$('pause',false);show$('spawnP',false);show$('codeBox',m==='mp');
  document.body.classList.remove('menu');
  BASES=world.bases;planes=world.planes;
  if(m==='sp'){missiles=world.missiles;bombs=world.bombs;}else{missiles=[];bombs=[];}
  clearVisuals();
  envMap='';buildEnvironment(world);buildGroundOps(world);syncDamage();
  time=0;view=player&&TYPES[player.type].cls?1:0;deaths=0;rtb=false;nukeFlash=0;lockTgt=null;lockT=0;wantLand=false;fly.set=false;camSm.set=false;
  feed=[];notices=[];radioLog=[];chatLog=[];reserve=world.reserve;awacs=[true,true];lastHp=player?player.hp:0;
  input.mx=W/2;input.my=H/2;
  if(player)ensureModel(TYPES[player.type].model);
  notice(m==='mp'?'ROOM '+$('codeTxt').textContent+' — share the code with your friends':'TAXI TO THE RUNWAY AND TAKE OFF','#7ddc6f');
}
function clearVisuals(){
  for(const [,e] of MESHES)scene.remove(e.mesh);MESHES.clear();
  for(const [,m] of DMGV.craters)dynRoot.remove(m);DMGV.craters.clear();
  for(const [,m] of DMGV.wrecks)dynRoot.remove(m);DMGV.wrecks.clear();
  for(const d of debris)scene.remove(d.m);debris=[];
  for(const n of nukes)scene.remove(n.g);nukes=[];
  parts.length=0;visTr=[];
  if(TRACKS.mesh){TRACKS.n=0;TRACKS.mesh.count=0;}
}
function onSpawned(m,resume){
  if(!world)return;
  let p=world.byId.get(m.id);
  if(!p)p=world.addPlane({id:m.id,team:m.team,type:m.type,lv:m.lv,cs:m.cs,name:myName,human:true});
  if(p.type!==m.type)world.setType(p,m.type);
  Object.assign(p,{local:true,remote:false,human:true,team:m.team,lv:m.lv,cs:m.cs,x:m.x,y:m.y,z:m.z,yaw:m.yaw,spd:m.spd||0,thr:m.thr||0,ground:!!m.ground,gear:m.gear!==false,
    gearT:m.gear!==false?1:0,flap:m.flap!==undefined?m.flap:.5,flapT:m.flap!==undefined?m.flap:.5,pad:m.pad,base:m.base,stand:m.stand!==undefined?m.stand:-1,
    msl:m.msl,ammo:m.ammo,bombs:m.bombs,flares:m.flares,chaff:m.chaff,hp:m.hp,alive:resume?m.alive!==false:true,falling:false,sliding:false,collapsed:false,gearDmg:0,comp:0,parts:0,
    pitch:m.pitch||0,roll:0,yawS:0,pitchS:0,atc:m.atc||'park',wps:m.wps||[],respawn:0});
  if(m.nukes!==undefined)nukesHeld=m.nukes;
  player=p;myTeam=p.team;lastHp=p.hp;camSm.set=false;
  if(!resume){view=TYPES[p.type].cls?1:0;show$('spawnP',false);}
  ensureModel(TYPES[p.type].model);
}

/* ---------- controls ---------- */
const dead=v=>Math.abs(v)<.05?0:v;
function playerControls(p,dt){
  const k=input.keys,t=TYPES[p.type],chat=document.activeElement===$('chatIn');
  if(!chat){
    if(k.KeyW||k.ShiftLeft)p.thr=clamp(p.thr+dt*.7,0,1);
    if(k.KeyS||k.ControlLeft)p.thr=clamp(p.thr-dt*.7,0,1);
  }
  const m=Math.min(W,H)*.4;
  let yaw=-dead(clamp((input.mx-W/2)/m,-1,1)),pitch=-dead(clamp((input.my-H/2)/m,-1,1));
  if(!chat){if((k.KeyA&&view!==0)||k.ArrowLeft)yaw=1;if((k.KeyD&&view!==0)||k.ArrowRight)yaw=-1;if(k.ArrowUp)pitch=1;if(k.ArrowDown)pitch=-1;}
  if(Math.hypot(p.x,p.z)>ARENA+3200&&!p.ground)yaw=clamp(angDiff(Math.atan2(-p.x,-p.z),p.yaw)*3,-1,1);
  const fire=(input.fire||(!p.ground&&!!k.Space))&&!armOpen&&!chat;
  p.ctl.yaw=armOpen?0:yaw;p.ctl.pitch=armOpen?0:pitch;p.ctl.fire=fire;
  p.brake=p.ground&&(!!k.Space||(!!k.KeyS&&p.thr<.05)||armOpen);
  if(p.ground&&p.brake&&p.thr>.05&&k.Space)p.thr=Math.max(0,p.thr-dt*1.5);
  if(!p.ground)p.rev=false;
  if(t.heli&&p.ground&&p.thr<.62)p.brake=true;
  p.fire=fire&&!!t.gun&&p.ammo>0;
  wantLand=!!p.wantLand||(p.gearT>.5&&!p.ground);
  if(MP()&&!p.ground){const hb=homeBase(p);if(p.gearT>.5&&Math.hypot(p.x-hb.x,p.z-hb.z)<15000){if(p.lrw<0)p.lrw=hb.act;}else p.lrw=-1;}
}
function updateLock(dt){
  const p=player;
  if(!p||!p.alive||p.ground||!p.msl){lockTgt=null;lockT=0;return;}
  fwd(p,F);let best=null,bs=.42;
  if(manualTgt&&(!manualTgt.alive||manualTgt.team===p.team))manualTgt=null;
  for(const e of planes){
    if(!e.alive||e.team===p.team||!canSee(e))continue;
    const dx=e.x-p.x,dy=e.y-p.y,dz=e.z-p.z,d=Math.hypot(dx,dy,dz);if(d>6500||d<120)continue;
    const a=Math.acos(clamp((dx*F.x+dy*F.y+dz*F.z)/d,-1,1));
    if(e===manualTgt&&a<.6){best=e;break;}
    if(a<bs){bs=a;best=e;}
  }
  if(best!==lockTgt){lockTgt=best;lockT=0;}
  else if(best){const was=lockT<1.2;lockT+=dt;if(was&&lockT>=1.2)snd.beep(1400,.12);else if(lockT<1.2){beepT-=dt;if(beepT<=0){beepT=.25;snd.beep(900,.04);}}}
}
function cycleTarget(){
  if(!player)return;
  const list=planes.filter(e=>e.alive&&e.team!==player.team&&canSee(e)).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
  if(!list.length)return;
  const i=list.indexOf(manualTgt);manualTgt=list[(i+1)%list.length];notice('TARGET '+manualTgt.cs+' · '+TYPES[manualTgt.type].name,'#ffd23f');
}
function fireMissileCmd(){
  const p=player;if(state!=='play'||!p||!p.alive||p.msl<=0||p.mslCd>0||!lockTgt||lockT<1.2)return;
  if(MP()){NET.send('msl',{t:lockTgt.id});p.mslCd=1;p.msl--;}else world.fireMissile(p,lockTgt);
}
function bombCmd(){
  const p=player;if(state!=='play'||!p||!p.alive||p.ground||p.bombs<=0)return;
  p.bombs--;if(MP())NET.send('bomb');else world.dropBomb(p,false);
}
function nukeCmd(){
  const p=player;if(state!=='play'||!p||!p.alive||p.ground||nukesHeld<=0)return;
  nukesHeld--;if(MP())NET.send('nuke');else world.dropBomb(p,true);notice('☢ NUKE AWAY — GET CLEAR','#ffd23f');
}
function cmCmd(kind){
  const p=player;if(state!=='play'||!p||!p.alive)return;
  world.countermeasure(p,kind);if(MP())NET.send('cm',kind);
}

/* ---------- rearm panel ---------- */
function canRearm(p){return p&&p.alive&&p.ground&&p.spd<3&&p.pad===homeBase(p).i&&!p.sliding;}
function openArm(){
  const p=player;if(!canRearm(p))return notice('REARM ONLY WHEN STOPPED AT '+homeBase(p).name.toUpperCase(),'#ffd23f');
  const t=TYPES[p.type];armOpen=true;
  show$('rM',!!t.msl);show$('rC',!!t.gun);show$('rB',!!t.bombs);
  $('aM').max=t.msl||1;$('aM').value=t.msl;$('aC').value=Math.max(p.ammo,400);$('aF').value=24;$('aZ').value=24;$('aB').max=t.bombs||1;$('aB').value=t.bombs||0;
  armLabels();show$('arm',true);
}
function armLabels(){for(const k of['M','C','F','Z','B'])$('v'+k).textContent=$('a'+k).value;}
function closeArm(){armOpen=false;show$('arm',false);}
for(const k of['M','C','F','Z','B'])$('a'+k).addEventListener('input',armLabels);
$('aGo').onclick=()=>{
  if(!player||!armOpen)return;
  load={msl:+$('aM').value,ammo:+$('aC').value,flares:+$('aF').value,chaff:+$('aZ').value,bombs:+$('aB').value};
  if(MP())NET.send('rearm',load);
  else{world.applyLoad(player,load);player.hp=player.hpMax;player.gearDmg=0;world.repair(player);player.rearmed=true;notice('REARMED, REFUELLED AND REPAIRED','#7ddc6f');}
  snd.burst(300,.6,.3,'lowpass');closeArm();
};
$('aX').onclick=closeArm;

/* ---------- respawn panel ---------- */
function openSpawn(){
  if(!$('spawnP').classList.contains('hide'))return;
  fillAircraft($('rType'));$('rType').value=myAF+':'+myType;
  fillSelect($('rBase'),[['-1','Home base for this aircraft'],...BASE_LABEL(player.team),['air','Airborne, near home']],'-1');
  show$('spawnP',true);
}
$('rGo').onclick=()=>{
  const p=player;if(!p||p.alive)return;
  if(p.respawn>0)return notice('NEXT AIRCRAFT IN '+Math.ceil(p.respawn)+'s','#ffd23f');
  const s=typeOf($('rType').value),bv=$('rBase').value;myType=s.t;myAF=s.af;
  const lv=TYPE_LIVERY[s.t]||AF_LIVERY[s.af]||myLiv;
  if(MP()){NET.send('spawn',{type:s.t,lv,base:bv==='air'?-1:+bv,air:bv==='air'});return;}
  if(world.reserve[p.team]<=0)return notice('NO AIRCRAFT LEFT IN RESERVE','#ff5a4d');
  world.reserve[p.team]--;world.setType(p,s.t);p.lv=lv;
  world.spawn(p,{base:bv==='air'?-1:+bv,air:bv==='air'});lastHp=p.hp;view=TYPES[p.type].cls?1:0;camSm.set=false;show$('spawnP',false);ensureModel(TYPES[p.type].model);
};

/* ---------- events from the simulation (local or from the server) ---------- */
const UNITCOL={GROUND:'#ffd23f',TOWER:'#7ddc6f',DEPARTURE:'#35d0e0',APPROACH:'#9ab8ff'};
function onEvent(e,fromNet){
  const p=player,me=p&&e.id===p.id;
  switch(e.e){
    case'boom':{const v=vol(e.x,e.y,e.z);boom(e.x,e.y,e.z,e.s||0);snd.boom(v);if(e.water)for(let i=0;i<40;i++)part(e.x,1,e.z,rnd(-10,10),rnd(20,45),rnd(-10,10),rnd(1,2.5),rnd(6,14),5);
      if(p&&Math.hypot(e.x-p.x,e.y-p.y,e.z-p.z)<600)shake=Math.max(shake,.5);break;}
    case'crash':
      if(fromNet&&me)break;
      crashFX(e);break;
    case'breakup':{const q=world.byId.get(e.id);if(q){spawnDebris(q,1,e.part!=='tail');if(q===p&&e.part!=='tail')notice(e.part==='wingL'?'LEFT WING GONE':'RIGHT WING GONE','#ff5a4d');}break;}
    case'splash':for(let i=0;i<70;i++)part(e.x+rnd(-8,8),1,e.z+rnd(-8,8),rnd(-12,12),rnd(15,55),rnd(-12,12),rnd(1.5,3),rnd(8,20),5);snd.boom(vol(e.x,0,e.z)*.7);break;
    case'selfcrash':
      if(!MP()||!me||!p.alive)break;
      p.alive=false;p.falling=false;p.respawn=8;deaths++;NET.send('crash',{how:e.how});break;
    case'kill':{
      const k=world.byId.get(e.k),v=world.byId.get(e.v);
      addFeed(e.k?{name:e.kn,team:e.kt}:null,{name:e.vn,team:e.vt},e.how==='ditch'?'crash':e.how);
      if(p&&e.k===p.id&&e.v!==p.id){killMsg=1.6;snd.beep(660,.15);if(!MP()&&e.how!=='nuke'&&p.gunKills%3===0&&nukesHeld<2){nukesHeld++;notice('☢ NUKE EARNED','#ffd23f');}}
      if(p&&e.v===p.id&&!MP()){deaths++;shake=1;}
      if(v&&e.how!=='nuke'&&v.falling)spawnDebris(v,3,false);
      break;}
    case'notice':
      if(e.to!==undefined&&(!p||e.to!==p.id))break;
      if(e.team!==undefined&&e.team>=0&&p&&e.team!==p.team&&e.to===undefined)break;
      notice(e.text,e.col||(e.team!==undefined&&e.team>=0?TEAM[e.team].col:undefined));break;
    case'atc':radio(e,fromNet);break;
    case'touch':{const q=world.byId.get(e.id);if(!q)break;const grass=e.surf&&e.surf!=='asphalt';
      for(let i=0;i<(grass?20:14);i++)part(q.x+rnd(-3,3),ground(q.x,q.z)+.6,q.z+rnd(-3,3),rnd(-4,4),rnd(1,4),rnd(-4,4),rnd(1,2.2),rnd(4,9),grass?3:6);
      if(q===p||vol(q.x,q.y,q.z)>.3){snd.chirp(q===p?1:vol(q.x,q.y,q.z));if(e.hard)snd.thud(1);}if(q===p&&e.hard)shake=.6;break;}
    case'launch':snd.whoosh(vol(e.x,e.y,e.z));{const t=world.byId.get(e.tgt);if(t&&t===p)snd.beep(1800,.3);}break;
    case'flare':case'chaff':{const q=world.byId.get(e.id)||e;fwd(q.yaw!==undefined?q:{yaw:e.yaw,pitch:0},F);
      for(let i=0;i<(e.e==='flare'?6:14);i++)part(e.x,e.y-2,e.z,-F.x*30+rnd(-25,25),rnd(-25,5),-F.z*30+rnd(-25,25),e.e==='flare'?rnd(2,3.5):rnd(1.5,3),e.e==='flare'?rnd(5,8):rnd(1,2),e.e==='flare'?7:4);
      if(q===p)snd.burst(1200,.15,.2,'highpass');break;}
    case'spark':for(let i=0;i<6;i++)part(e.x,e.y,e.z,rnd(-30,30),rnd(-30,30),rnd(-30,30),.25,2,4);break;
    case'hole':{for(let i=0;i<6;i++)part(e.x,e.y,e.z,rnd(-30,30),rnd(-30,30),rnd(-30,30),.25,2,4);addHole(e);
      if(me&&p.alive){hitFlash=Math.max(hitFlash,.25);shake=Math.max(shake,.3);snd.burst(900,.12,.25,'bandpass');}break;}
    case'nuke':nukeVisual(e.x,e.y,e.z);break;
    case'lightning':lightning=1;snd.thunder(clamp(1-Math.hypot(e.x-camera.position.x,e.z-camera.position.z)/9000,.15,1));break;
    case'wx':notice('WEATHER: '+String(e.name).toUpperCase()+' MOVING IN','#9fb3bd');break;
    case'rwchange':if(p&&BASES[e.base]&&BASES[e.base].team===p.team&&(e.base===homeBase(p).i||e.base===p.pad))notice(BASES[e.base].name+': runway '+rwGeo(BASES[e.base],e.rw).name+' now in use'+(e.why==='closed'?' (other runway closed)':''),'#35d0e0');break;
    case'runway':if(p&&BASES[e.base].team===p.team)notice(BASES[e.base].name+' runway '+(e.axis==='ns'?'18/36':'09/27')+(e.closed?' CLOSED — DAMAGED':' REOPENED'),e.closed?'#ff5a4d':'#7ddc6f');syncDamage();break;
    case'repaired':syncDamage();break;
    case'crater':case'wreck':case'bld':case'baseDown':case'repair':if(!MP())syncDamage();if(e.e==='baseDown')notice(BASES[e.base].name+' DESTROYED',TEAM[1-BASES[e.base].team].col);break;
    case'rtb':rtb=true;notice('MISSION COMPLETE — LAND AT YOUR BASE','#7ddc6f');break;
    case'gate':gateIdx=e.n%Math.max(1,gates.length);snd.beep(1000,.1);break;
    case'loop':notice('MACH LOOP COMPLETE','#ffd23f');break;
    case'over':if(!MP())endGame(e.winner,e.why);break;
  }
}
function radio(e,fromNet){
  const p=player;if(!p)return;
  if(MP()&&!fromNet&&e.to===p.id)return;            // the server runs our ATC in multiplayer
  const mine=e.to===p.id,station=e.station||'',col=UNITCOL[e.unit]||'#eef3f5';
  if(!e.text)return;
  const line=e.cs+', '+e.text;
  if(mine){
    twr={s:'',col,hold:/hold/.test(e.text)};
    radioLog.unshift({u:e.unit,s:station+' '+e.unit.toLowerCase()+': '+line,col,t:14});
    speak(station+' '+e.unit.toLowerCase()+', '+line,e.unit);
    if(e.readback){radioLog.unshift({u:'PILOT',s:e.cs+': '+e.readback,col:'#eef3f5',t:14});speak(e.readback+', '+e.cs,'PILOT');}
  }else if(e.base!==undefined&&p.team===e.team&&(p.pad===e.base||homeBase(p).i===e.base)){
    radioLog.unshift({u:e.unit,s:station+' '+e.unit.toLowerCase()+': '+line,col:'rgba(220,230,235,.75)',t:9});
    if(!VOICE.busy&&!VOICE.q.length&&Math.random()<.35)speak(line,e.unit,true);
  }
  if(radioLog.length>5)radioLog.length=5;
}
function crashFX(e){
  const v=vol(e.x,e.y,e.z),q=world.byId.get(e.id);
  if(e.kind==='slide'){snd.scrape(v);for(let i=0;i<30;i++)part(e.x,e.y,e.z,rnd(-20,20),rnd(2,14),rnd(-20,20),rnd(.3,.8),2,4);return;}
  if(e.kind==='ditch'){for(let i=0;i<80;i++)part(e.x+rnd(-6,6),1,e.z+rnd(-6,6),rnd(-14,14),rnd(15,50),rnd(-14,14),rnd(1.5,3),rnd(8,18),5);snd.boom(v*.6);return;}
  boom(e.x,(e.y||ground(e.x,e.z))+3,e.z,TYPES[e.type]&&TYPES[e.type].cls?2:1);snd.boom(v);
  for(let i=0;i<50;i++)part(e.x,(e.y||0)+2,e.z,rnd(-30,30),rnd(5,40),rnd(-30,30),rnd(.3,1),2.5,4);
  if(q)spawnDebris(q,TYPES[q.type].cls?8:5,false,e);
}

/* ---------- debris that tumbles, bounces and skids to a stop ---------- */
const DEBRISMAT=new THREE.MeshStandardMaterial({color:0x2a2d30,roughness:.8,metalness:.3});
/* bullet holes: each round that hits leaves a mark on the skin where it went in */
const HOLE_RC=new THREE.Raycaster(),HOLE_GEO=new THREE.PlaneGeometry(1,1);let HOLE_MATS=null;
function holeMats(){
  if(HOLE_MATS)return HOLE_MATS;HOLE_MATS=[];
  for(let k=0;k<4;k++){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),r=()=>Math.random();
    const g=x.createRadialGradient(32,32,2,32,32,30);g.addColorStop(0,'rgba(20,18,16,.95)');g.addColorStop(.35,'rgba(40,36,32,.75)');g.addColorStop(1,'rgba(40,36,32,0)');x.fillStyle=g;x.fillRect(0,0,64,64);
    x.fillStyle='#050505';x.beginPath();for(let i=0;i<10;i++){const a=i/10*Math.PI*2,rr=5+r()*5;x.lineTo(32+Math.cos(a)*rr,32+Math.sin(a)*rr);}x.fill();   // the torn hole
    x.strokeStyle='rgba(200,200,200,.55)';x.lineWidth=1.2;for(let i=0;i<5;i++){const a=r()*Math.PI*2;x.beginPath();x.moveTo(32+Math.cos(a)*8,32+Math.sin(a)*8);x.lineTo(32+Math.cos(a)*(12+r()*6),32+Math.sin(a)*(12+r()*6));x.stroke();}   // bent-out metal
    HOLE_MATS.push(new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6,side:THREE.DoubleSide}));}
  return HOLE_MATS;
}
function addHole(e){
  const q=world.byId.get(e.id),ent=q&&MESHES.get(q.id);if(!ent||!ent.mesh.visible)return;
  if(Math.hypot(e.x-camera.position.x,e.y-camera.position.y,e.z-camera.position.z)>3000)return;
  const m=ent.mesh;m.updateMatrixWorld(true);
  const d=new THREE.Vector3(e.dx,e.dy,e.dz).normalize(),hp=new THREE.Vector3(e.x,e.y,e.z);
  const cand=[];m.traverse(o=>{if(o.isMesh&&!o.isSprite&&!o.userData.hole&&!o.userData.engine&&!o.userData.fan&&!o.userData.isDisc&&!o.userData.propPart&&!o.userData.flame&&o.visible&&o.geometry&&o.geometry.attributes.position.count>8)cand.push(o);});
  let h=null;
  for(const [o,dir] of[[hp.clone().addScaledVector(d,-60),d],[hp.clone().addScaledVector(d,-6),d]]){HOLE_RC.set(o,dir);HOLE_RC.far=140;HOLE_RC.camera=camera;h=HOLE_RC.intersectObjects(cand,false)[0];if(h)break;}
  if(!h){const c=new THREE.Vector3().setFromMatrixPosition(m.matrixWorld),dir=c.clone().sub(hp).normalize();HOLE_RC.set(hp.clone().addScaledVector(dir,-30),dir);h=HOLE_RC.intersectObjects(cand,false)[0];}
  if(!h||!h.face)return;
  const n=h.face.normal.clone().transformDirection(h.object.matrixWorld);if(n.dot(d)>0)n.negate();
  const mk=new THREE.Mesh(HOLE_GEO,holeMats()[Math.floor(Math.random()*4)]);mk.userData.hole=1;
  const wp=h.point.clone().addScaledVector(n,.03);mk.position.copy(m.worldToLocal(wp));
  const look=new THREE.Object3D();look.position.copy(wp);look.lookAt(wp.clone().add(n));look.rotateZ(Math.random()*6.28);
  const pq=new THREE.Quaternion();m.getWorldQuaternion(pq);mk.quaternion.copy(pq.invert().multiply(look.quaternion));
  mk.scale.setScalar((q.cls?.9:.55)*(.7+Math.random()*.6)/m.scale.x);
  m.add(mk);const U=m.userData;(U.holes=U.holes||[]).push(mk);if(U.holes.length>90)m.remove(U.holes.shift());
}
function spawnDebris(q,n,wing,e){
  const t=TYPES[q.type],L=Math.min(t.len||15,50),F0=fwd(q,new THREE.Vector3());
  for(let i=0;i<n;i++){
    const big=wing&&i===0,g=big?new THREE.BoxGeometry(L*.35,.35,L*.14):new THREE.BoxGeometry(rnd(.6,1)*L*.12,rnd(.3,.8),rnd(.5,1)*L*.08);
    const m=new THREE.Mesh(g,big&&MESHES.get(q.id)?skinMat(0x8a9299):DEBRISMAT);m.castShadow=true;scene.add(m);
    const sp=(e&&e.spd)||q.spd||60;
    debris.push({m,x:q.x+rnd(-3,3),y:q.y+rnd(0,2),z:q.z+rnd(-3,3),vx:F0.x*sp*.6+rnd(-25,25),vy:rnd(5,30),vz:F0.z*sp*.6+rnd(-25,25),rx:rnd(-6,6),ry:rnd(-6,6),rz:rnd(-6,6),life:45,smoke:Math.random()<.5,rest:false});
  }
  if(debris.length>120){const d=debris.shift();scene.remove(d.m);}
}
function stepDebris(dt){
  for(let i=debris.length-1;i>=0;i--){
    const d=debris[i];d.life-=dt;
    if(!d.rest){
      d.vy-=9.8*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;
      d.m.rotation.x+=d.rx*dt;d.m.rotation.y+=d.ry*dt;d.m.rotation.z+=d.rz*dt;
      const g=ground(d.x,d.z)+.3;
      if(d.y<g){d.y=g;if(world.surface(d.x,d.z)==='water'){d.life=Math.min(d.life,1.5);part(d.x,1,d.z,0,8,0,1,6,5);}
        d.vy=Math.abs(d.vy)*.35;d.vx*=.6;d.vz*=.6;d.rx*=.5;d.rz*=.5;
        if(Math.hypot(d.vx,d.vz)>6)part(d.x,g,d.z,rnd(-2,2),rnd(1,4),rnd(-2,2),.3,2,4);
        if(Math.abs(d.vy)<1.5&&Math.hypot(d.vx,d.vz)<1){d.rest=true;d.m.rotation.x=0;d.m.rotation.z=0;}}
    }
    if(d.smoke&&d.life>25&&Math.random()<dt*6)part(d.x,d.y+1,d.z,rnd(-1,1),rnd(4,9),rnd(-1,1),rnd(2,4),rnd(5,10),1);
    d.m.position.set(d.x,d.y,d.z);
    if(d.life<=0){scene.remove(d.m);debris.splice(i,1);}
  }
}

/* ---------- nuclear detonation visuals (damage is done by the simulation) ---------- */
const STEM=new THREE.CylinderGeometry(1,1.35,1,18,1,true).translate(0,.5,0),RING=new THREE.RingGeometry(.9,1,72);
function nukeVisual(x,y,z){
  const g=new THREE.Group();g.position.set(x,y,z);scene.add(g);
  const hot=new THREE.MeshLambertMaterial({color:0x6e6258,emissive:0xffffff,transparent:true,fog:false});
  const smoke=new THREE.MeshLambertMaterial({color:0x82776b,emissive:0xffffff,transparent:true,fog:false});
  const ball=new THREE.Mesh(SPH,hot);g.add(ball);const stem=new THREE.Mesh(STEM,smoke);g.add(stem);
  const caps=[],base=[];
  for(let i=0;i<8;i++){const m=new THREE.Mesh(SPH,smoke),a=i/8*TAU;m.userData={ox:Math.cos(a)*.8,oz:Math.sin(a)*.8,oy:rnd(-.3,.05),s:rnd(.5,.75)};g.add(m);caps.push(m);}
  for(let i=0;i<12;i++){const m=new THREE.Mesh(SPH,smoke),a=i/12*TAU;m.userData={ox:Math.cos(a),oz:Math.sin(a),s:rnd(.8,1.2)};g.add(m);base.push(m);}
  const ringMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false,fog:false});
  const ring=new THREE.Mesh(RING,ringMat);ring.rotation.x=-Math.PI/2;ring.position.y=4;g.add(ring);
  const domeMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.18,side:THREE.BackSide,depthWrite:false,fog:false});
  const dome=new THREE.Mesh(SPH,domeMat);g.add(dome);
  nukes.push({g,ball,stem,caps,base,ring,dome,hot,smoke,ringMat,domeMat,x,y,z,t:0});
  nukeFlash=1;shake=1;snd.nuke();
}
function stepNukeVis(dt){
  for(let i=nukes.length-1;i>=0;i--){
    const n=nukes[i],t=n.t+=dt;
    const R=430*(1-Math.exp(-t*1.5)),hy=130+1500*(1-Math.exp(-t*.13)),grow=Math.min(1,t/5);
    n.ball.position.y=hy;n.ball.scale.set(R,R*.72,R);n.stem.scale.set(R*.3,hy,R*.3);
    for(const m of n.caps){const u=m.userData,s=R*u.s*(.3+.7*grow)+1;m.position.set(u.ox*R*.95,hy+u.oy*R,u.oz*R*.95);m.scale.set(s,s*.8,s);}
    const rb=120+950*(1-Math.exp(-t*.28));
    for(const m of n.base){const u=m.userData,s=(80+190*(1-Math.exp(-t*.3)))*u.s;m.position.set(u.ox*rb,s*.25,u.oz*rb);m.scale.set(s,s*.55,s);}
    const h1=Math.exp(-t*.16),h2=Math.exp(-t*.4);
    n.hot.emissive.setRGB(h1,.72*h1*h1,.3*h1*h1*h1);n.smoke.emissive.setRGB(h2,.6*h2*h2,.25*h2*h2*h2);
    const front=t*330;n.ring.scale.set(front,front,1);n.ringMat.opacity=.7*Math.max(0,1-front/3200);
    n.dome.scale.setScalar(front);n.domeMat.opacity=.2*Math.max(0,1-front/2600);
    const op=t>40?Math.max(0,1-(t-40)/10):1;n.hot.opacity=op;n.smoke.opacity=op;
    if(player&&Math.abs(Math.hypot(player.x-n.x,player.z-n.z)-front)<330*dt*2)shake=1;
    if(t>50){scene.remove(n.g);nukes.splice(i,1);}
  }
}

/* ---------- per-frame effects: smoke, dust, tyre marks, tracers ---------- */
const MSLM=[],BMBM=[];
function frameFX(dt){
  const cam=camera.position;
  for(const p of planes){
    if(!(p.alive||p.falling))continue;
    const near=Math.hypot(p.x-cam.x,p.y-cam.y,p.z-cam.z)<4500,t=TYPES[p.type];if(!near)continue;
    fwd(p,F);const bx=p.x-F.x*(t.len||15)*.5,by=p.y-F.y*(t.len||15)*.5,bz=p.z-F.z*(t.len||15)*.5;
    if(p.falling){part(p.x,p.y,p.z,rnd(-6,6),rnd(0,10),rnd(-6,6),rnd(.6,1.8),rnd(10,p.cls?34:18),Math.random()<.4?2:1);continue;}
    const dm=p.dm||[0,0,0,0,0,0],hf=p.hp/p.hpMax;
    if(hf<.5&&Math.random()<dt*(hf<.25?40:16))part(bx,by,bz,rnd(-3,3),rnd(2,6),rnd(-3,3),rnd(1.5,3),rnd(6,12),hf<.25&&Math.random()<.5?2:1);
    // damage you can see: smoking engine, streaming fuel, fire
    if(dm[3]>.3&&Math.random()<dt*(dm[3]>.7?36:14))part(bx,by,bz,rnd(-2,2),rnd(1,4),rnd(-2,2),rnd(1.5,3.5),rnd(5,11)*(p.cls?1.8:1),dm[3]>=1?1:0);
    if(dm[4]>.35&&!p.ground&&Math.random()<dt*30){const s=Math.random()<.5?1:-1,w=(t.len||15)*.12;part(p.x+Math.cos(p.yaw)*s*w,p.y-.4,p.z-Math.sin(p.yaw)*s*w,rnd(-1,1),rnd(-1,.5),rnd(-1,1),rnd(.8,1.6),rnd(2,4),5);}
    for(const k of[0,1])if(dm[k]>.55&&Math.random()<dt*10*dm[k]){const s=k?-1:1,w=(t.len||15)*.32;part(p.x+Math.cos(p.yaw)*s*w,p.y,p.z-Math.sin(p.yaw)*s*w,rnd(-1,1),rnd(0,2),rnd(-1,1),rnd(.6,1.4),rnd(3,6),1);}
    if(p.burn&&Math.random()<dt*45){part(bx+rnd(-1,1),by,bz+rnd(-1,1),rnd(-2,2),rnd(1,4),rnd(-2,2),rnd(.4,.9),rnd(3,6)*(p.cls?1.6:1),2);if(Math.random()<.5)part(bx,by+1,bz,rnd(-2,2),rnd(3,7),rnd(-2,2),rnd(2,4),rnd(8,16),1);}
    if(p.parts&3&&Math.random()<dt*25){const s=p.parts&1?1:-1;part(p.x+Math.cos(p.yaw)*s*5,p.y,p.z-Math.sin(p.yaw)*s*5,0,0,0,1.6,7,Math.random()<.5?2:1);}
    if(p.sliding&&p.spd>3){for(let i=0;i<3;i++)part(p.x+rnd(-4,4),ground(p.x,p.z)+.5,p.z+rnd(-4,4),rnd(-15,15)-F.x*p.spd*.3,rnd(2,10),rnd(-15,15)-F.z*p.spd*.3,rnd(.2,.6),2,4);
      if(Math.random()<dt*20)part(p.x,ground(p.x,p.z)+1,p.z,rnd(-3,3),rnd(1,4),rnd(-3,3),rnd(2,4),rnd(8,16),world.surface(p.x,p.z)==='asphalt'?6:3);
      if(p===player&&Math.random()<dt*6)snd.scrape(.7);}
    if(p.ground&&!p.sliding&&p.spd>3){
      const surf=world.surface(p.x,p.z);
      if(surf!=='asphalt'){
        if(p.spd>12&&Math.random()<dt*p.spd*.5)part(bx,ground(bx,bz)+.8,bz,rnd(-3,3)-F.x*4,rnd(1,4),rnd(-3,3)-F.z*4,rnd(1.2,2.5),rnd(5,10),surf==='water'?5:3);
        p._trk=(p._trk||0)+p.spd*dt;
        if(p._trk>3){p._trk=0;const rx=Math.cos(p.yaw),rz=-Math.sin(p.yaw),w=(t.len||15)*.12;for(const s of[-1,1])trackMark(bx+rx*w*s,bz+rz*w*s,p.yaw,t.cls?.9:.5);}
      }else if(p.brake&&p.spd>25&&Math.random()<dt*8){part(bx,ground(bx,bz)+.5,bz,rnd(-2,2),rnd(1,3),rnd(-2,2),1,5,6);p._trk=(p._trk||0)+p.spd*dt;if(p._trk>4){p._trk=0;trackMark(bx,bz,p.yaw,.6);}}
      if(p.rev&&p.spd>10&&Math.random()<dt*10)part(bx-F.x*8,ground(bx,bz)+2,bz-F.z*8,rnd(-5,5)+F.x*20,rnd(1,4),rnd(-5,5)+F.z*20,1.2,8,surf==='asphalt'?6:3);
    }
    if(!p.ground&&p.y>2600&&Math.random()<dt*30)part(bx,by,bz,0,0,0,4,t.cls?6:3,0);       // contrails up high
    if(world.weather.rain>.4&&!p.ground&&p.spd>120&&Math.random()<dt*10){const rx=Math.cos(p.yaw)*(t.len||15)*.4,rz=-Math.sin(p.yaw)*(t.len||15)*.4;part(p.x+rx,p.y,p.z+rz,0,0,0,.6,1.5,5);part(p.x-rx,p.y,p.z-rz,0,0,0,.6,1.5,5);}
    // helicopter downwash
    if(t.heli&&p.y-ground(p.x,p.z)<40&&p.thr>.3&&Math.random()<dt*30){const a=Math.random()*TAU;part(p.x+Math.cos(a)*12,ground(p.x,p.z)+.5,p.z+Math.sin(a)*12,Math.cos(a)*14,1,Math.sin(a)*14,1.5,7,world.surface(p.x,p.z)==='water'?5:3);}
  }
  // missiles and bombs
  while(MSLM.length<missiles.length){const m=new THREE.Mesh(MSLGEO,MSLMAT);scene.add(m);MSLM.push(m);}
  MSLM.forEach((m,i)=>{const q=missiles[i];m.visible=!!q;if(!q)return;m.position.set(q.x,q.y,q.z);m.lookAt(q.x+q.dx,q.y+q.dy,q.z+q.dz);
    if(Math.random()<dt*50)part(q.x-q.dx*4,q.y-q.dy*4,q.z-q.dz*4,rnd(-1,1),rnd(-1,1),rnd(-1,1),rnd(1.5,2.5),rnd(3,5),0);
    if(Math.random()<dt*30)part(q.x-q.dx*3,q.y-q.dy*3,q.z-q.dz*3,0,0,0,.12,3,2);});
  while(BMBM.length<bombs.length){const m=new THREE.Mesh(BOMBGEO,BOMBMAT);scene.add(m);BMBM.push(m);}
  BMBM.forEach((m,i)=>{const q=bombs[i];m.visible=!!q;if(!q)return;m.position.set(q.x,q.y,q.z);m.lookAt(q.x+(q.vx||0),q.y+(q.vy||-1),q.z+(q.vz||0));m.scale.setScalar(q.nuke?2.2:1);});
  // tracers: the simulation's bullets on the host, or drawn from each gun's fire flag in multiplayer
  if(MP()){
    for(const p of planes){
      if(!p.alive||!p.fire)continue;p._gt=(p._gt||0)+dt;if(p._gt<.07)continue;p._gt=0;
      fwd(p,F);const rx=-Math.cos(p.yaw),rz=Math.sin(p.yaw);
      for(const s of[-1,1])visTr.push({x:p.x+rx*2*s+F.x*12,y:p.y-1+F.y*12,z:p.z+rz*2*s+F.z*12,vx:F.x*(BSPD+p.spd)+rnd(-6,6),vy:F.y*(BSPD+p.spd)+rnd(-6,6),vz:F.z*(BSPD+p.spd)+rnd(-6,6),life:1.1});
      if(p===player)snd.gun(1);else snd.gun(vol(p.x,p.y,p.z));
    }
    for(let i=visTr.length-1;i>=0;i--){const b=visTr[i];b.life-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;if(b.life<=0||b.y<ground(b.x,b.z))visTr.splice(i,1);}
    if(visTr.length>MAXB)visTr.splice(0,visTr.length-MAXB);
  }else if(player&&player.fire&&player.cool>.06)snd.gun(1);
  const list=MP()?visTr:world.bullets,n=Math.min(list.length,MAXB);
  for(let i=0;i<n;i++){const b=list[i],o=i*6;bPos[o]=b.x;bPos[o+1]=b.y;bPos[o+2]=b.z;bPos[o+3]=b.x-b.vx*.05;bPos[o+4]=b.y-b.vy*.05;bPos[o+5]=b.z-b.vz*.05;}
  bGeo.setDrawRange(0,n*2);bGeo.attributes.position.needsUpdate=true;
}
function stepParticles(dt){
  const W2=world?world.wind():{x:0,z:0};
  for(let i=parts.length-1;i>=0;i--){
    const q=parts[i];q.life-=dt;if(q.life<=0){parts.splice(i,1);continue;}
    const drag=q.type===4||q.type===7?.5:1.6;q.vx+=(W2.x*.6-q.vx)*Math.min(1,dt*drag*.3);q.vz+=(W2.z*.6-q.vz)*Math.min(1,dt*drag*.3);
    if(q.type===4||q.type===5||q.type===7)q.vy-=(q.type===7?6:9.8)*dt;else q.vy*=1-dt*.6;
    q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;
    if(q.type===7&&Math.random()<dt*20)parts.push({x:q.x,y:q.y,z:q.z,vx:0,vy:1,vz:0,life:1.5,max:1.5,size:3,type:0});
  }
}

/* ---------- main update ---------- */
function update(dt){
  if(paused&&!MP())return;
  time+=dt;
  const p=player;
  if(p&&p.alive){playerControls(p,dt);updateLock(dt);}else{lockTgt=null;lockT=0;}
  if(MP()){world.step(dt);NET.apply();NET.sendState(dt);if(NET.room&&Math.floor(time)!==Math.floor(time-dt)&&Math.floor(time)%3===0)NET.send('ping',performance.now());}
  else{world.step(dt);reserve=world.reserve;}
  awacs=world.awacs;
  for(const e of world.events)onEvent(e,false);world.events.length=0;
  if(p){
    if(p.hp<lastHp-.5&&p.alive){hitFlash=.35;shake=Math.max(shake,.35);snd.burst(900,.12,.25,'bandpass');}lastHp=p.hp;
    if(p.ground&&p.spd>2&&armOpen)closeArm();
    if(!p.alive&&!p.falling&&state==='play')openSpawn();
    if(p.gear!==p._gearWas){if(p._gearWas!==undefined&&!p.ground)snd.gearMotor();p._gearWas=p.gear;}
  }
  stepGroundOps(dt);damageSmoke(dt);stepDebris(dt);stepNukeVis(dt);frameFX(dt);stepParticles(dt);
  for(const f of feed)f.t-=dt;while(feed.length&&feed[feed.length-1].t<=0)feed.pop();
  for(const n of notices)n.t-=dt;while(notices.length&&notices[notices.length-1].t<=0)notices.pop();
  for(const r of radioLog)r.t-=dt;while(radioLog.length&&radioLog[radioLog.length-1].t<=0)radioLog.pop();
  for(const c of chatLog)c.t-=dt;while(chatLog.length&&chatLog[chatLog.length-1].t<=0)chatLog.pop();
  shake=Math.max(0,shake-dt*1.4);hitFlash-=dt;killMsg-=dt;nukeFlash=Math.max(0,nukeFlash-dt/3.5);
  if(view===7)orbit.yaw+=dt*.12;stepLook(dt);
  const t=p?TYPES[p.type]:null,live=state==='play'&&!!p&&p.alive;
  snd.engine(p?p.thr:0,live);
  snd.env(p&&live?p.spd:0,world.weather.rain,view===0,{thr:p?p.thr:0,on:live,ab:!!p&&AB_TYPES.has(p.type),kind:t?(t.heli?'rotor':t.props?'prop':'jet'):'jet'});
  if(p&&p.local&&live&&p.ground&&!armOpen&&canRearm(p)&&!p.rearmed&&!p._rearmHint){p._rearmHint=true;notice('STOPPED AT HOME BASE — PRESS P TO REARM','#7ddc6f');}
  if(p&&!p.ground)p._rearmHint=false;
}

/* ---------- match end ---------- */
function endGame(winner,why){
  if(state==='over')return;
  state='over';closeArm();show$('spawnP',false);
  const my=player?player.team:myTeam,win=winner===my;
  $('ttl').textContent=winner===null?'DISCONNECTED':winner<0?'DRAW':win?'VICTORY':'DEFEAT';
  $('ttl').style.color=winner===null?'#ffd23f':winner<0?'#eef3f5':win?'#7ddc6f':'#ff5a4d';
  $('sub').textContent=why||'';
  $('stats').textContent='Kills '+(player?player.kills:0)+'  ·  Deaths '+deaths+'  ·  Score '+Math.round(world.score[my])+' – '+Math.round(world.score[1-my]);
  show$('restart',MP()&&winner!==null);show$('again2',!MP());
  show$('res',true);
}
function toMenu(){
  if(MP())NET.leave();
  state='menu';mode='sp';net=null;player=null;closeArm();snd.engine(0,false);snd.env(0,0,false,{on:false});
  for(const id of['res','pause','spawnP','codeBox','chatBox'])show$(id,false);show$('menu',true);document.body.classList.add('menu');show.key='';
  try{speechSynthesis.cancel();}catch(e){}VOICE.q.length=0;VOICE.busy=false;
  refreshRooms();
}
$('again').onclick=toMenu;$('again2').onclick=()=>{show$('res',false);startSP();};
$('restart').onclick=()=>NET.send('restart');
$('pResume').onclick=()=>{paused=false;show$('pause',false);};
$('pQuit').onclick=()=>{paused=false;toMenu();};
$('spMenu').onclick=toMenu;

/* ---------- extra HUD layers: scores, timer, RWR, radio, chat, rain on the canopy ---------- */
const drops=Array.from({length:70},()=>({x:Math.random(),y:Math.random(),r:rnd(2,6),v:rnd(.02,.12)}));
function drawExtras(){
  if(state==='menu'||!world)return;
  const p=player,my=p?p.team:myTeam;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  // rain on the canopy glass
  if(view===0&&p&&p.alive&&world.weather.rain>.05){
    ctx.strokeStyle='rgba(210,225,235,.35)';ctx.lineWidth=1.2;const n=Math.floor(drops.length*world.weather.rain);
    for(let i=0;i<n;i++){const d=drops[i];d.y+=d.v*lastDt*(1+p.spd/90);d.x+=(p.spd/400)*(d.x-.5)*lastDt;if(d.y>1||d.x<0||d.x>1){d.y=Math.random()*.2;d.x=Math.random();}
      ctx.beginPath();ctx.ellipse(d.x*W,d.y*H*.75,d.r,d.r*(1+p.spd/200),0,0,TAU);ctx.stroke();}
  }
  // match clock and score
  const left=MP()&&NET.room?NET.room.state.timeLeft:Math.max(0,world.duration-world.time),mm=Math.floor(left/60),ss=String(Math.floor(left%60)).padStart(2,'0');
  const modeTxt=world.mode==='tdm'?'TEAM DOGFIGHT · KILLS':'BASE STRIKE · SCORE',sc=world.mode==='tdm'?world.kills:world.score.map(Math.round);
  const Y0=62;ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(10,Y0,250,48);
  txt(modeTxt,18,Y0+16,'#9fb3bd','left',11,800);
  txt(TEAM[0].name.toUpperCase()+' '+sc[0],18,Y0+38,TEAM[0].col,'left',18,800);txt(sc[1]+' '+TEAM[1].name.toUpperCase(),170,Y0+38,TEAM[1].col,'right',18,800);
  txt(mm+':'+ss,250,Y0+38,left<60?'#ff5a4d':'#eef3f5','right',18,800);
  if(MP()&&NET.room&&net&&net.ping)txt(net.ping+' ms',255,Y0+64,'#9fb3bd','right',11,800);
  // radar warning receiver
  if(p&&p.alive){
    const rx=W-80,ry=H*.5,R=46,locks=planes.filter(e=>e.alive&&e.team!==p.team&&e.lock===p.id),inb=inbound(p);
    ctx.fillStyle='rgba(0,12,4,.55)';circle(rx,ry,R+6);ctx.strokeStyle='rgba(73,255,122,.5)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(rx,ry,R,0,TAU);ctx.arc(rx,ry,R*.5,0,TAU);ctx.stroke();
    txt('RWR',rx,ry+R+18,'#49ff7a','center',11,800);
    const sym=(e,col,label)=>{const a=Math.atan2(e.x-p.x,e.z-p.z)-p.yaw,d=Math.hypot(e.x-p.x,e.z-p.z),r=clamp(d/9000,.3,1)*R;const x=rx-Math.sin(a)*r,y=ry-Math.cos(a)*r;txt(label,x,y+4,col,'center',11,800);};
    for(const e of planes)if(e.alive&&e.team!==p.team&&!e.ground&&Math.hypot(e.x-p.x,e.z-p.z)<RADAR)sym(e,'rgba(73,255,122,.7)',TYPES[e.type].cls?'B':String(TYPES[e.type].name).replace(/[^0-9A-Z]/g,'').slice(-2)||'F');
    for(const e of locks)sym(e,'#ff3b30','◆');
    if(inb){sym(inb,'#ff3b30','M');if(Math.sin(time*20)>0)snd.beep(1100,.03);}
    if(locks.length&&!inb)txt('LOCKED',rx,ry-R-10,'#ff3b30','center',12,800);
  }
  // radio log (ATC) bottom centre
  radioLog.slice(0,4).forEach((r,i)=>{ctx.globalAlpha=clamp(r.t,0,1);txt(r.s,W/2,view===0?126+i*18:H-100-i*18,r.col,'center',13,700);ctx.globalAlpha=1;});
  // chat
  chatLog.forEach((c,i)=>{ctx.globalAlpha=clamp(c.t,0,1);txt(c.cs+': '+c.text,18,H*.42-i*18,TEAM[c.team].col,'left',13,700);ctx.globalAlpha=1;});
  // hints
  if(p&&p.alive&&p.ground&&canRearm(p)&&!armOpen)txt('P — REARM & REPAIR',W/2,H*.68,'#7ddc6f','center',15,800);
  if(lockTgt&&manualTgt===lockTgt)txt('TARGET SELECTED [T]',W/2,H*.3+64,'#ffd23f','center',12,800);
  if(paused)txt('PAUSED',W/2,H*.4,'#ffd23f','center',30,800);
  if(scoreOpen)drawScoreboard();
}
function drawScoreboard(){
  const rows=[[],[]];
  if(MP()&&NET.room)NET.room.state.players.forEach(pl=>rows[pl.team].push({n:pl.cs+' ('+pl.name+')',t:TYPES[pl.type]?TYPES[pl.type].name:pl.type,k:pl.kills,d:pl.deaths,h:pl.host,c:pl.connected}));
  for(const q of planes)if(!q.human||!MP())rows[q.team].push({n:q.cs+(q===player?' (you)':q.human?'':' · AI'),t:TYPES[q.type].name,k:q.kills,d:q.deaths,ai:!q.human});
  const w=Math.min(820,W-40),x0=(W-w)/2,y0=H*.14;
  ctx.fillStyle='rgba(6,14,20,.86)';ctx.fillRect(x0,y0,w,H*.7);
  for(let t=0;t<2;t++){
    const x=x0+20+t*w/2;txt(TEAM[t].name.toUpperCase()+' TEAM · '+(world.mode==='tdm'?world.kills[t]+' kills':Math.round(world.score[t])+' pts')+' · '+reserve[t]+' in reserve',x,y0+28,TEAM[t].col,'left',15,800);
    rows[t].sort((a,b)=>(a.ai?1:0)-(b.ai?1:0)||b.k-a.k).slice(0,22).forEach((r,i)=>{const y=y0+54+i*18;txt(r.n+(r.h?' ★':'')+(r.c===false?' (reconnecting)':''),x,y,r.ai?'#9fb3bd':'#eef3f5','left',12,r.ai?500:800);txt(r.t,x+w/2-150,y,'#9fb3bd','left',12);txt(r.k+' / '+r.d,x+w/2-40,y,'#eef3f5','right',12,700);});
  }
}

/* ---------- input ---------- */
window.addEventListener('mousemove',e=>{if(look.hold)return;input.mx=e.clientX;input.my=e.clientY;});  // steering freezes while you look around
window.addEventListener('mousedown',e=>{snd.init();if(state!=='play'||armOpen||e.target.closest('.panel'))return;if(e.button===0)input.fire=true;});
window.addEventListener('mouseup',()=>{input.fire=false;});
window.addEventListener('contextmenu',e=>{if(state==='play')e.preventDefault();});
window.addEventListener('blur',()=>{input.fire=false;input.keys={};});
window.addEventListener('wheel',e=>{if(state!=='play')return;if(view===7)orbit.dist=clamp(orbit.dist*(1+e.deltaY*.001),30,400);else chaseZoom=clamp(chaseZoom*(1+e.deltaY*.001),.5,3);},{passive:true});
window.addEventListener('keydown',e=>{
  if(document.activeElement&&document.activeElement.tagName==='INPUT'&&document.activeElement.id!=='chatIn')return;
  if(document.activeElement===$('chatIn')){
    if(e.key==='Enter'){const v=$('chatIn').value.trim();if(v&&MP())NET.send('chat',v);$('chatIn').value='';$('chatIn').blur();show$('chatBox',false);}
    if(e.key==='Escape'){$('chatIn').blur();show$('chatBox',false);}
    return;
  }
  const p=player,live=state==='play'&&p&&p.alive;
  if(e.code==='Tab'){scoreOpen=true;e.preventDefault();}
  if(!e.repeat&&state!=='menu'){
    if(e.code==='Escape'){if(armOpen)closeArm();else if(state==='play'){paused=!paused;show$('pause',paused);}}
    if(e.code==='Enter'&&MP()){show$('chatBox',true);setTimeout(()=>$('chatIn').focus(),0);e.preventDefault();return;}
    if(e.code==='KeyM')snd.mute=!snd.mute;
    if(e.code==='KeyC'){view=(view+1)%VIEWS.length;fly.set=false;camSm.set=false;notice('CAM '+(view+1)+' · '+VIEWS[view],'#9fb3bd');}
    if(/^Digit[1-8]$/.test(e.code)){view=+e.code[5]-1;fly.set=false;camSm.set=false;look.yaw=look.pitch=0;notice('CAM '+(view+1)+' · '+VIEWS[view],'#9fb3bd');}
    if(e.code==='KeyN')nukeCmd();
    if(e.code==='KeyF')fireMissileCmd();
    if(e.code==='KeyB')bombCmd();
    if(e.code==='KeyT')cycleTarget();
    if(e.code==='KeyP'){if(armOpen)closeArm();else if(live)openArm();}
    if(live&&e.code==='KeyG'&&!p.ground){p.gear=!p.gear;}
    if(live&&e.code==='KeyE'){p.flap=Math.min(1,p.flap+.5);snd.burst(300,.3,.3,'lowpass');}
    if(live&&e.code==='KeyQ'){p.flap=Math.max(0,p.flap-.5);snd.burst(300,.3,.3,'lowpass');}
    if(live&&e.code==='KeyR'&&p.ground&&TYPES[p.type].rev){p.rev=!p.rev;notice(p.rev?'REVERSE THRUST':'REVERSE STOWED','#9fb3bd');}
    if(live&&e.code==='KeyH'){p.wantLand=!p.wantLand;notice(p.wantLand?'REQUESTING APPROACH':'CANCELLED APPROACH','#35d0e0');}
  }
  if(live&&e.code==='KeyX')cmCmd('flare');
  if(live&&e.code==='KeyZ')cmCmd('chaff');
  input.keys[e.code]=true;
  if(state!=='menu'&&(e.code==='Space'||e.code.startsWith('Arrow')))e.preventDefault();
});
window.addEventListener('keyup',e=>{input.keys[e.code]=false;if(e.code==='Tab')scoreOpen=false;});
const touch=e=>{const t=e.touches[0];if(t&&state==='play'&&!armOpen&&!e.target.closest('.panel')){input.mx=t.clientX;input.my=t.clientY;input.fire=true;e.preventDefault();}};
window.addEventListener('touchstart',touch,{passive:false});window.addEventListener('touchmove',touch,{passive:false});window.addEventListener('touchend',()=>{input.fire=false;});
window.addEventListener('beforeunload',()=>{if(MP())NET.leave();});

/* ---------- render loop ---------- */
let lastDt=.016;
function render(){
  if(state==='menu'){renderShow(lastDt);return;}
  for(const q of planes){syncMesh(q,lastDt);const e=MESHES.get(q.id),mk=e&&e.mesh.userData.mark;
    if(mk){const hum=q.human&&q!==player&&player&&q.team===player.team;mk.material.color.setHex(hum?0xffd23f:TEAM[q.team].hex);mk.scale.setScalar((q.human&&q!==player?5:2.6)/e.mesh.scale.x);}}
  pruneMeshes();
  placeCamera();updateSky(lastDt);updateGrass();syncParts();
  renderer.setClearColor(scene.background,1);renderer.clear();
  renderer.render(scene,camera);
  if(cockOn&&player){updateCockpit(player,lastDt);renderer.clearDepth();renderer.render(cockScene,cockCam);}
  drawHUD();drawExtras();
}
function resize(){
  DPR=Math.min(window.devicePixelRatio||1,2);W=window.innerWidth;H=window.innerHeight;
  renderer.setPixelRatio(DPR);renderer.setSize(W,H,false);hud.width=W*DPR;hud.height=H*DPR;
  camera.aspect=W/H;camera.updateProjectionMatrix();cockCam.aspect=W/H;cockCam.updateProjectionMatrix();
  pMat.uniforms.sc.value=H*DPR/2/Math.tan(camera.fov*Math.PI/360);
}
window.addEventListener('resize',resize);resize();
const NORENDER=/norender/.test(location.search);  // used by automated tests
let last=0;
function frame(t){
  const dt=Math.min(.05,(t-last)/1000||0);last=t;lastDt=dt;
  try{if(state==='play'||state==='over')update(dt);if(!NORENDER)render();}catch(err){console.error(err);if(!frame.errShown){frame.errShown=true;notice('Error: '+err.message,'#ff5a4d');}}
  requestAnimationFrame(frame);
}
initSetup();input.mx=W/2;input.my=H/2;loadModels();
document.body.classList.add('menu');
requestAnimationFrame(frame);
window.CF={get world(){return world;},get player(){return player;},get state(){return state;},startSP,startMP,NET,setView:v=>{view=v;}};
