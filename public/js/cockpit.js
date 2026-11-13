'use strict';
/* ---------- cockpit interior ---------- */
const mfdA=document.createElement('canvas'),mfdB=document.createElement('canvas');mfdA.width=mfdA.height=mfdB.width=mfdB.height=256;
const texA=new THREE.CanvasTexture(mfdA),texB=new THREE.CanvasTexture(mfdB);
let cock=null,mfdT=0,headPitch=0;
const HUD_Y=-.25,HUD_Z=.8;
function buildCockpit(type){
  while(cockScene.children.length>2)cockScene.remove(cockScene.children[2]);
  const t=TYPES[type],g=new THREE.Group(),big=!!t.cls,w=big?2.5:1.5;cockScene.add(g);
  const M=c=>new THREE.MeshLambertMaterial({color:c}),pm=M(0x1c2024),cm=M(0x0f1113),fm=M(0x2b3035),gm=M(0x0a0b0c),bz=M(0x3a4046);
  const add=(geo,mat,x,y,z,par)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);(par||g).add(m);return m;};
  const box=(a,b,c)=>new THREE.BoxGeometry(a,b,c);
  add(box(w,.04,.3),cm,0,-.27,-.8);                                     // glareshield
  add(box(w,.56,.05),pm,0,-.55,-.66);                                   // instrument panel
  for(const s of[-1,1])add(box(.3,.08,1.3),fm,s*(w/2-.15),-.62,-.1);    // side consoles
  // displays
  const lay=t.mfd===1?[[0,.9,.2]]:t.mfd===3?[[-.4,.27,.2],[0,.27,.2],[.4,.27,.2]]:[[-.27,.3,.2],[.27,.3,.2]];
  lay.forEach((q,i)=>{
    add(box(q[1]+.04,q[2]+.04,.02),bz,q[0],-.42,-.632);
    if(t.mfd===1){add(new THREE.PlaneGeometry(.43,q[2]),new THREE.MeshBasicMaterial({map:texA}),-.225,-.42,-.62);add(new THREE.PlaneGeometry(.43,q[2]),new THREE.MeshBasicMaterial({map:texB}),.225,-.42,-.62);}
    else add(new THREE.PlaneGeometry(q[1],q[2]),new THREE.MeshBasicMaterial({map:i%2?texB:texA}),q[0],-.42,-.62);
  });
  if(big)for(let i=0;i<8;i++)add(new THREE.CircleGeometry(.04,16),M(0x10261a),-.42+i*.12,-.6,-.632); // engine gauges
  // head-up display glass
  if(t.hud){
    const hw=t.hud[0],hh=t.hud[1];
    add(new THREE.PlaneGeometry(hw,hh),new THREE.MeshBasicMaterial({color:0x66ffaa,transparent:true,opacity:.07,depthWrite:false,side:THREE.DoubleSide}),0,HUD_Y+hh/2,-HUD_Z);
    for(const s of[-1,1])add(box(.012,hh,.014),bz,s*hw/2,HUD_Y+hh/2,-HUD_Z);
    add(box(hw+.012,.012,.014),bz,0,HUD_Y+hh,-HUD_Z);add(box(hw+.08,.04,.14),cm,0,HUD_Y-.01,-HUD_Z);
  }
  // canopy / windscreen framing
  if(big){
    for(const x of[0,-.62,.62,-1.24,1.24])add(box(.06,1,.06),cm,x,.26,-.98);
    add(box(w+.3,.1,1),cm,0,.72,-.6);for(const s of[-1,1])add(box(.08,1,1.4),cm,s*(w/2+.1),.25,-.3);
  }else{
    for(const s of[-1,1])add(box(.05,.05,1.7),cm,s*.76,-.3,-.15);
    if(t.bow){const a=add(new THREE.TorusGeometry(.78,.028,6,26,Math.PI),cm,0,-.3,-1.02);a.scale.y=1.15;}
  }
  add(box(w+.5,.04,1.9),fm,0,-1.02,-.1);add(box(w,.5,.05),pm,0,-.95,-.5);    // floor and lower panel
  for(const s of[-1,1])add(box(.05,.7,1.9),fm,s*(w/2+.05),-.66,-.1);            // cockpit walls
  // stick or yoke
  const stick=new THREE.Group(),sx=t.stick==='side'?.5:0;stick.position.set(sx,-.74,-.56);g.add(stick);
  if(t.stick==='yoke'){
    add(new THREE.CylinderGeometry(.02,.02,.24,8),gm,0,.12,0,stick);
    const wh=new THREE.Group();wh.position.set(0,.27,0);stick.add(wh);
    add(new THREE.TorusGeometry(.13,.018,6,18,Math.PI*1.3),gm,0,0,0,wh).rotation.z=-Math.PI*1.15;
    add(box(.2,.03,.03),gm,0,0,0,wh);stick.userData.wheel=wh;
  }else{
    add(new THREE.CylinderGeometry(.016,.02,.22,8),gm,0,.11,0,stick);
    add(box(.045,.1,.05),gm,0,.26,0,stick);add(box(.03,.03,.03),M(0xb02a20),.012,.32,-.01,stick);
  }
  // throttles
  const thr=[],n=t.thrN||1,tx=big?0:-.5,ty=big?-.6:-.52;
  add(box(big?.06*n+.08:.12,.04,.34),fm,tx,ty-.02,-.58);
  for(let i=0;i<n;i++){
    const lv=new THREE.Group();lv.position.set(tx+(i-(n-1)/2)*.055,ty,-.5);g.add(lv);thr.push(lv);
    add(box(big?.02:.03,.1,.02),bz,0,.05,0,lv);add(box(big?.04:.08,.04,.05),gm,0,.11,0,lv);
  }
  cock={g,stick,thr,type};
}
function drawMfd(p){
  let c=mfdA.getContext('2d');
  c.fillStyle='#04140c';c.fillRect(0,0,256,256);c.strokeStyle='#1f7a45';c.lineWidth=1.5;
  for(const rr of[40,80,118]){c.beginPath();c.arc(128,128,rr,0,TAU);c.stroke();}
  c.beginPath();c.moveTo(128,8);c.lineTo(128,248);c.moveTo(8,128);c.lineTo(248,128);c.stroke();
  const k=118/(ARENA+1800),pt=(x,z)=>{let dx=-x*k,dy=-z*k;const d=Math.hypot(dx,dy);if(d>116){dx*=116/d;dy*=116/d;}return[128+dx,128+dy];};
  for(const b of BASES){const q=pt(b.x,b.z);c.strokeStyle=b.hp>0?TEAM[b.team].col:'#666';c.strokeRect(q[0]-5,q[1]-5,10,10);}
  for(const q of planes){
    if(!q.alive||(q.team!==p.team&&!canSee(q)))continue;const m=pt(q.x,q.z);
    if(q===p){c.save();c.translate(m[0],m[1]);c.rotate(Math.atan2(-Math.cos(q.yaw),-Math.sin(q.yaw)));c.fillStyle='#ffe066';c.beginPath();c.moveTo(11,0);c.lineTo(-7,-6);c.lineTo(-7,6);c.closePath();c.fill();c.restore();}
    else{c.fillStyle=TEAM[q.team].col;if(q.cls)c.fillRect(m[0]-5,m[1]-5,10,10);else{c.beginPath();c.arc(m[0],m[1],4,0,TAU);c.fill();}}
  }
  c.fillStyle='#39d977';c.font='bold 15px monospace';c.textAlign='left';c.fillText('RDR  '+(awacs[p.team]?'LINK':'OWN'),8,18);
  texA.needsUpdate=true;
  c=mfdB.getContext('2d');c.fillStyle='#04140c';c.fillRect(0,0,256,256);c.fillStyle='#39d977';c.font='bold 19px monospace';c.textAlign='left';
  const t=TYPES[p.type],rows=[t.name+'  SMS',t.cls?'BOMBS   '+p.ammo:(t.mslName+'  x'+p.msl),t.cls?'':'GUN     '+p.ammo,t.cls?'':'MK-82   x'+p.bombs,'FLARE   '+p.flares,'B61     '+nukesHeld,'',
    'ENG RPM '+Math.round(55+p.thr*45)+'%','GEAR    '+(p.gearT>=1?'DOWN':p.gearT<=0?'UP':'TRANS'),'FLAPS   '+(p.flap>=1?'FULL':p.flap>0?'T/O':'UP'),'HULL    '+Math.max(0,Math.round(p.hp/p.hpMax*100))+'%'];
  rows.forEach((s,i)=>c.fillText(s,10,26+i*21));
  texB.needsUpdate=true;
}
function updateCockpit(p,dt){
  if(!cock||cock.type!==p.type)buildCockpit(p.type);
  const s=cock.stick;
  if(s.userData.wheel){s.userData.wheel.rotation.z=p.yawS*.9;s.rotation.x=p.pitchS*.22;}
  else s.rotation.set(p.pitchS*.32,0,p.yawS*.36);
  for(const lv of cock.thr)lv.position.z=-.5-p.thr*.15;
  headPitch+=((input.keys.KeyV?-.5:0)-headPitch)*Math.min(1,dt*8);
  mfdT-=dt;if(mfdT<=0){mfdT=.15;drawMfd(p);}
}

