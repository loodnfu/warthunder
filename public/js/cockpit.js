'use strict';
/* ---------- cockpits: per-family layouts modelled on the real aircraft, with live instruments ----------
   The eye is at the origin looking down -z. Side-by-side cockpits put you in the left seat. */
let cock=null,mfdT=0,gaugeT=0,headPitch=0;
const HUD_Y=-.25,HUD_Z=.8;
const PAGE={};               // canvas + texture for each display page
function page(name){
  if(PAGE[name])return PAGE[name];
  const c=document.createElement('canvas');c.width=c.height=256;const t=new THREE.CanvasTexture(c);t.anisotropy=4;
  return PAGE[name]={c,t,x:c.getContext('2d')};
}
// analog gauge faces share one 4x4 atlas
const GA=document.createElement('canvas');GA.width=GA.height=1024;const GAT=new THREE.CanvasTexture(GA);GAT.anisotropy=4;
const GK={adi:0,alt:1,asi:2,vsi:3,hsi:4,rpm:5,egt:6,fuel:7,clock:8,g:9,aoa:10,hyd:11,epr:12,ff:13,oil:14,flap:15};

/* ---------- which cockpit each aircraft gets ---------- */
function cockProfile(type){
  const t=TYPES[type],k=type;
  const P={seat:t.cls?'side':'single',ctl:t.stick||'centre',thrN:t.thrN||Math.max(1,t.eng||1),panel:0x24292e,face:'west',
    screens:[],gauges:[],engCols:0,frame:t.cls?'heavy':'bubble',over:!!t.cls,hud:!!t.hud,ufc:false,wide:false,airbus:false,posts:[-.62,.62,1.72],eyebrow:false,heli:false,drone:!!t.drone};
  const S=(x,y,w,h,p)=>P.screens.push({x,y,w,h,p}),G=(x,y,r,g)=>P.gauges.push({x,y,r,g});
  const fighterBasics=()=>{G(-.33,-.5,.032,'asi');G(-.33,-.6,.032,'alt');G(.33,-.5,.032,'rpm');G(.33,-.6,.032,'fuel');};
  if(P.drone)return P;
  if(['f35a','f35b'].includes(k)){P.wide=true;S(-.16,-.47,.3,.2,'map');S(.16,-.47,.3,.2,'sms');}
  else if(k==='f22'){S(0,-.48,.2,.2,'rdr');S(-.22,-.5,.17,.17,'map');S(.22,-.5,.17,.17,'sms');S(-.2,-.34,.11,.08,'eng');S(.2,-.34,.11,.08,'pfd');P.ufc=true;}
  else if(k==='f16'){P.ufc=true;S(-.21,-.52,.14,.14,'rdr');S(.21,-.52,.14,.14,'sms');G(0,-.52,.045,'adi');G(0,-.64,.035,'hsi');G(-.33,-.48,.03,'asi');G(-.33,-.58,.03,'alt');G(.33,-.48,.03,'rpm');G(.33,-.58,.03,'fuel');G(.33,-.68,.025,'egt');}
  else if(k==='f15c'){S(.17,-.47,.15,.15,'rdr');S(-.2,-.47,.12,.12,'map');G(0,-.47,.045,'adi');G(0,-.6,.04,'hsi');G(-.16,-.62,.03,'asi');G(.16,-.62,.03,'alt');G(-.32,-.5,.026,'rpm');G(-.32,-.6,.026,'egt');G(.32,-.5,.026,'fuel');G(.32,-.6,.026,'vsi');P.ufc=true;}
  else if(k==='f15e'||k==='f15ex'){if(k==='f15ex'){P.wide=true;S(0,-.5,.5,.22,'map');}else{S(-.22,-.48,.15,.15,'rdr');S(0,-.48,.15,.15,'map');S(.22,-.48,.15,.15,'sms');}P.ufc=true;G(-.34,-.62,.025,'asi');G(.34,-.62,.025,'alt');}
  else if(['f18f','ea18g','f18e'].includes(k)){S(-.21,-.46,.15,.15,'rdr');S(.21,-.46,.15,.15,'sms');S(0,-.6,.17,.15,'map');P.ufc=true;G(-.34,-.6,.026,'rpm');G(.34,-.6,.026,'fuel');}
  else if(['ef','rafale','gripen','kf21','m2000'].includes(k)){
    if(k==='gripen'){S(-.2,-.48,.17,.2,'pfd');S(0,-.48,.17,.2,'map');S(.2,-.48,.17,.2,'rdr');}
    else if(k==='kf21'){P.wide=true;S(0,-.48,.52,.2,'map');}
    else if(k==='m2000'){S(0,-.45,.14,.14,'rdr');G(0,-.6,.045,'adi');G(-.18,-.5,.03,'asi');G(.18,-.5,.03,'alt');G(-.18,-.62,.03,'rpm');G(.18,-.62,.03,'fuel');G(-.32,-.55,.026,'egt');G(.32,-.55,.026,'vsi');}
    else{S(-.22,-.48,.15,.15,'sms');S(0,-.48,.15,.15,'map');S(.22,-.48,.15,.15,'rdr');}
    P.ufc=k!=='m2000';
  }
  else if(['su27','mig29','mig31'].includes(k)){ // the classic turquoise Soviet panel, all round dials
    P.panel=0x4d8f8c;P.face='ru';
    G(0,-.48,.05,'adi');G(0,-.63,.045,'hsi');G(-.16,-.45,.034,'asi');G(-.16,-.56,.034,'alt');G(-.16,-.67,.03,'vsi');G(.16,-.45,.034,'aoa');G(.16,-.56,.034,'g');G(.16,-.67,.03,'clock');
    G(-.32,-.46,.028,'rpm');G(-.32,-.56,.028,'rpm');G(-.32,-.66,.028,'egt');G(.32,-.46,.028,'fuel');G(.32,-.56,.028,'hyd');G(.32,-.66,.028,'oil');
    if(k==='mig29')S(.31,-.36,.07,.06,'rdr');
  }
  else if(['su30','su35','su57','su75','mig35','su34'].includes(k)){
    P.panel=k==='su57'||k==='su75'?0x2a2f33:0x4a8783;P.face='ru';
    S(-.16,-.48,.2,.18,'map');S(.16,-.48,.2,.18,'rdr');G(-.34,-.48,.026,'asi');G(-.34,-.58,.026,'alt');G(.34,-.48,.026,'rpm');G(.34,-.58,.026,'fuel');
    if(k==='su57'||k==='su75'){S(-.33,-.36,.09,.07,'eng');S(.33,-.36,.09,.07,'sms');}
    if(k==='su34'){P.seat='side';P.frame='bubble';P.over=false;S(.55-.16,-.48,.2,.18,'sms');S(.55+.16,-.48,.2,.18,'eng');}
  }
  else if(['j20','j10c','jf17'].includes(k)){if(k==='j20'){P.wide=true;S(0,-.48,.5,.2,'map');S(-.32,-.35,.09,.07,'eng');S(.32,-.35,.09,.07,'pfd');}else{S(-.21,-.48,.16,.16,'rdr');S(0,-.48,.16,.16,'map');S(.21,-.48,.16,.16,'sms');}P.ufc=true;}
  else if(k==='a10'){S(-.21,-.5,.13,.13,'map');S(.21,-.5,.13,.13,'sms');G(0,-.5,.045,'adi');G(0,-.63,.038,'hsi');G(-.33,-.46,.028,'asi');G(-.33,-.56,.028,'alt');G(-.33,-.66,.026,'vsi');G(.33,-.46,.026,'rpm');G(.33,-.55,.026,'rpm');G(.33,-.64,.026,'egt');G(.33,-.73,.026,'fuel');P.ufc=true;}
  else if(['hawk','hawk127','pc21'].includes(k)){S(-.2,-.48,.14,.15,'pfd');S(0,-.48,.14,.15,'map');S(.2,-.48,.14,.15,'eng');P.ufc=true;G(-.33,-.6,.024,'asi');G(.33,-.6,.024,'alt');}
  else if(k==='u2'){P.seat='single';P.frame='bubble';P.over=false;S(-.2,-.48,.16,.2,'pfd');S(0,-.48,.16,.2,'map');S(.2,-.48,.16,.2,'eng');G(-.34,-.55,.026,'asi');G(.34,-.55,.026,'alt');}
  else if(k==='ch47'){P.heli=true;P.frame='heli';P.posts=[-.7,.55,1.8];for(const x0 of[0,1.1]){S(x0-.15,-.5,.15,.17,'pfd');S(x0+.05,-.5,.15,.17,'map');}S(.55,-.66,.15,.12,'eng');}
  // ---- big aircraft ----
  else if(k==='b52'){ // B-52H: twin control wheels, 8 throttles, the famous 8-column engine gauge stack
    P.panel=0x30353a;P.engCols=8;P.eyebrow=true;P.posts=[-.6,-.22,.2,.55,.9,1.32,1.72];
    for(const x0 of[0,1.1]){G(x0-.2,-.46,.03,'asi');G(x0-.07,-.46,.042,'adi');G(x0+.07,-.46,.03,'alt');G(x0-.2,-.58,.03,'vsi');G(x0-.07,-.59,.038,'hsi');G(x0+.07,-.58,.028,'clock');}
    S(.55-.13,-.72,.11,.09,'map');S(.55+.13,-.72,.11,.09,'sms');
  }
  else if(['kc135','rc135','c130'].includes(k)){ // older analog flight decks
    P.panel=k==='c130'?0x2e3337:0x2c3135;P.engCols=4;P.posts=[-.6,-.1,.55,1.2,1.72];
    for(const x0 of[0,1.1]){G(x0-.2,-.46,.03,'asi');G(x0-.06,-.46,.044,'adi');G(x0+.09,-.46,.03,'alt');G(x0-.2,-.58,.03,'vsi');G(x0-.06,-.6,.04,'hsi');G(x0+.09,-.58,.028,'clock');}
    if(k==='rc135')S(.55,-.73,.12,.09,'map');
  }
  else if(k==='b1'||k==='b2'){P.ctl='centre';P.posts=[-.6,-.05,.55,1.15,1.72];
    if(k==='b1'){P.engCols=4;for(const x0 of[0,1.1]){S(x0-.12,-.5,.12,.12,'pfd');S(x0+.12,-.5,.12,.12,'map');}}
    else for(const x0 of[0,1.1]){S(x0-.19,-.5,.12,.13,'pfd');S(x0-.06,-.5,.12,.13,'map');S(x0+.07,-.5,.12,.13,'sms');S(x0+.2,-.5,.12,.13,'eng');}
  }
  else{ // modern glass flight decks: C-17, C-5M, C-130J, A400M, A330 tankers, 737 family, KC-46, C-27J, MC-55
    P.airbus=['a400','voyager','kc30'].includes(k);
    if(['c17'].includes(k))P.ctl='centre';
    for(const x0 of[0,1.1]){S(x0-.13,-.5,.17,.17,'pfd');S(x0+.07,-.5,.17,.17,'map');}
    S(.55,-.5,.17,.17,'eng');if(k!=='c27j'&&k!=='mc55')S(.55,-.69,.15,.13,'sms');
    if(k==='a400'){S(-.32,-.5,.12,.17,'eng');S(1.42,-.5,.12,.17,'eng');}
  }
  return P;
}

/* ---------- textures: console placards with switch legends ---------- */
const PLACARD={};
function placardTex(seed,col){
  const key=seed+'_'+col;if(PLACARD[key])return PLACARD[key];
  const c=document.createElement('canvas');c.width=512;c.height=512;const x=c.getContext('2d'),rr=mulberry(seed);
  const base=new THREE.Color(col);x.fillStyle='#'+base.getHexString();x.fillRect(0,0,512,512);
  const words=['BATT','GEN','FUEL','PUMP','XFEED','HYD','ANTI ICE','PITOT','NAV','STROBE','LDG','TAXI','APU','START','IGN','BLEED','PACK','ENG FIRE','DISCH','OXY','ECS','RADAR','IFF','TACAN','ILS','UHF','VHF','INTERCOM','MASTER ARM','LASER','JETT','CHAFF','FLARE','RWR','EMER','TRIM','FLCS','DEFOG','CANOPY','SEAT','HOOK','PROBE','INS','GPS','DL','TGP'];
  const cells=[];for(let gy=0;gy<4;gy++)for(let gx=0;gx<3;gx++)cells.push([gx*170+4,gy*128+4,162,120]);
  x.strokeStyle='rgba(0,0,0,.6)';x.lineWidth=3;
  for(const [cx,cy,cw,ch] of cells){
    const sh=new THREE.Color(col).offsetHSL(0,0,(rr()-.5)*.04);x.fillStyle='#'+sh.getHexString();x.fillRect(cx,cy,cw,ch);x.strokeRect(cx,cy,cw,ch);
    for(let i=0;i<4;i++){const sx=cx+8+(i%2)*80,sy=cy+12+Math.floor(i/2)*56;
      x.fillStyle='rgba(235,238,240,.9)';x.font='bold 13px sans-serif';x.fillText(words[Math.floor(rr()*words.length)],sx,sy+10);
      x.fillStyle='#111';x.beginPath();x.arc(sx+18,sy+32,9,0,TAU);x.fill();x.fillStyle='#8a8f93';x.beginPath();x.arc(sx+18,sy+32,4,0,TAU);x.fill();
      x.fillStyle='rgba(235,238,240,.7)';x.font='10px sans-serif';x.fillText(rr()<.5?'ON':'NORM',sx+34,sy+28);x.fillText(rr()<.5?'OFF':'ALT',sx+34,sy+42);}
    for(let i=0;i<4;i++){x.fillStyle='rgba(0,0,0,.5)';x.beginPath();x.arc(cx+5+i%2*(cw-10),cy+5+(i>1?ch-10:0),2,0,TAU);x.fill();}   // screws
  }
  const t=new THREE.CanvasTexture(c);t.anisotropy=4;return PLACARD[key]=t;
}
function keypadTex(){
  if(PLACARD.kp)return PLACARD.kp;
  const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');
  x.fillStyle='#1a1d20';x.fillRect(0,0,256,128);x.fillStyle='#050807';x.fillRect(60,8,136,26);x.fillStyle='#4dff88';x.font='bold 15px monospace';x.fillText('UHF 243.0',70,26);
  const k='1234567890';for(let i=0;i<10;i++){const bx=60+(i%5)*28,by=44+Math.floor(i/5)*32;x.fillStyle='#3a3f44';x.fillRect(bx,by,24,26);x.fillStyle='#e8e8e8';x.font='bold 14px sans-serif';x.fillText(k[i],bx+7,by+18);}
  for(let i=0;i<4;i++){x.fillStyle='#3a3f44';x.fillRect(8,10+i*28,40,22);x.fillRect(208,10+i*28,40,22);}
  const t=new THREE.CanvasTexture(c);return PLACARD.kp=t;
}

/* ---------- building ---------- */
function stdM(o){return new THREE.MeshStandardMaterial(Object.assign({roughness:.75,metalness:.1},o));}
function buildCockpit(type){
  while(cockScene.children.length>2)cockScene.remove(cockScene.children[2]);
  const t=TYPES[type],P=cockProfile(type),g=new THREE.Group();cockScene.add(g);
  const thr=[],sticks=[];cock={g,thr,sticks,type,P};
  if(P.drone)return;
  const side=P.seat==='side',heavy=side&&P.frame!=='bubble',W0=side?-.62:-.46,W1=side?1.72:.46,CX=(W0+W1)/2,WW=W1-W0;
  const pz=heavy?-.85:-.72,top=heavy?-.24:-.28;
  if(heavy)for(const q of[...P.screens,...P.gauges])q.y+=.08;
  const panelM=stdM({color:P.panel,roughness:.85}),dark=stdM({color:0x15181b,roughness:.9}),frameM=stdM({color:0x1d2124,roughness:.6,metalness:.3}),
    metal=stdM({color:0x8b9196,roughness:.35,metalness:.8}),black=stdM({color:0x0b0c0d,roughness:.5}),bezel=stdM({color:0x2b2f33,roughness:.5,metalness:.4}),
    pad=stdM({color:0x26292c,roughness:1}),seatM=stdM({color:0x3b4237,roughness:.95}),yel=stdM({color:0xe8c21c,roughness:.6}),floor=stdM({color:0x1a1d1f,roughness:1});
  const consM=stdM({map:placardTex(type.length*7+3,P.panel===0x24292e?0x2a2f34:P.panel),roughness:.8});
  const add=(geo,mat,x,y,z,par,rx,ry,rz)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);if(rx||ry||rz)m.rotation.set(rx||0,ry||0,rz||0);(par||g).add(m);return m;};
  const box=(a,b,c)=>new THREE.BoxGeometry(a,b,c);
  // main panel, glareshield and the coaming
  add(box(WW,.6,.05),panelM,CX,top-.3,pz);
  add(box(WW+.06,.05,heavy?.42:.3),pad,CX,top+.02,pz-(heavy?.2:.14));
  add(box(WW+.06,.08,.03),pad,CX,top+.01,pz+.03,null,-.3);
  add(box(WW,.5,.05),dark,CX,top-.85,pz+.15,null,-.5);                              // lower panel / knee well
  add(box(WW+.6,.04,2.2),floor,CX,-1.12,-.1);                                        // floor
  // rudder pedals
  for(const x0 of side?[0,1.1]:[0])for(const s of[-1,1])add(box(.09,.16,.03),metal,x0+s*.13,-1,pz+.08,null,-.4);
  // side consoles with switch panels
  const cw=heavy?.34:.26;
  for(const s of[-1,1]){const x=s<0?W0-cw/2+.04:W1+cw/2-.04;
    add(box(cw,.3,1.5),panelM,x,-.75,-.12);const tp=add(new THREE.PlaneGeometry(cw-.02,1.46),consM,x,-.597,-.12);tp.rotation.x=-Math.PI/2;
    add(box(.04,.7,1.9),dark,x+s*(cw/2+.02),-.55,-.12);}
  // toggle switches scattered on the consoles
  const tg=new THREE.CylinderGeometry(.004,.004,.025,5),tb=new THREE.CylinderGeometry(.009,.009,.006,8),rr=mulberry(type.length*11);
  for(const s of[-1,1])for(let i=0;i<26;i++){const x=(s<0?W0-cw/2+.04:W1+cw/2-.04)+(rr()-.5)*(cw-.06),z=-.75+rr()*1.2;add(tb,black,x,-.592,z);add(tg,metal,x,-.58,z,null,.4*(rr()<.5?1:-1));}
  // displays with bezels and push buttons around the edge
  const osb=new THREE.BoxGeometry(.012,.01,.006);
  for(const s of P.screens){
    const pg=page(s.p),sx=s.x+(side&&!heavy?0:0);
    add(box(s.w+.05,s.h+.05,.02),bezel,sx,s.y,pz+.03);
    const scr=add(new THREE.PlaneGeometry(s.w,s.h),new THREE.MeshBasicMaterial({map:pg.t,toneMapped:false}),sx,s.y,pz+.042);scr.userData.page=s.p;
    if(s.w<.35){const n=Math.max(3,Math.round(s.w/.03));for(let i=0;i<n;i++){const ox=sx-s.w/2+(i+.5)*s.w/n;add(osb,black,ox,s.y+s.h/2+.016,pz+.043);add(osb,black,ox,s.y-s.h/2-.016,pz+.043);}
      for(let i=0;i<Math.max(3,Math.round(s.h/.03));i++){const oy=s.y-s.h/2+(i+.5)*s.h/Math.max(3,Math.round(s.h/.03));add(osb,black,sx-s.w/2-.016,oy,pz+.043,null,0,0,Math.PI/2);add(osb,black,sx+s.w/2+.016,oy,pz+.043,null,0,0,Math.PI/2);}}
  }
  // round dials (with a glass cover and bezel)
  const gaugeMesh=(cell,r)=>{const geo=new THREE.CircleGeometry(r,28),uv=geo.attributes.uv,c=cell%4,row=Math.floor(cell/4);
    for(let i=0;i<uv.count;i++)uv.setXY(i,(c+uv.getX(i))/4,1-(row+1)/4+uv.getY(i)/4);return new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:GAT,toneMapped:false}));};
  for(const q of P.gauges){add(new THREE.CylinderGeometry(q.r+.007,q.r+.007,.02,24),bezel,q.x,q.y,pz+.03,null,Math.PI/2);const m=gaugeMesh(GK[q.g],q.r);m.position.set(q.x,q.y,pz+.042);g.add(m);}
  // B-52 / tanker engine stack: columns of small dials, one per engine
  if(P.engCols){const n=P.engCols,cx=.55,dx=.052,rows=['epr','rpm','egt','ff'];
    add(box(n*dx+.04,rows.length*.052+.04,.02),bezel,cx,-.4,pz+.03);
    for(let i=0;i<n;i++)rows.forEach((kind,j)=>{const m=gaugeMesh(GK[kind],.021);m.position.set(cx+(i-(n-1)/2)*dx,-.32-j*.052,pz+.042);g.add(m);});}
  // up-front control keypad under the HUD
  if(P.ufc)add(new THREE.PlaneGeometry(.2,.1),stdM({map:keypadTex(),roughness:.6}),0,top-.06,pz+.045);
  // head-up display combiner
  if(P.hud&&t.hud){
    const hw=t.hud[0],hh=t.hud[1];
    add(new THREE.PlaneGeometry(hw,hh),new THREE.MeshBasicMaterial({color:0x66ffaa,transparent:true,opacity:.07,depthWrite:false,side:THREE.DoubleSide}),0,HUD_Y+hh/2,-HUD_Z);
    for(const s of[-1,1])add(box(.012,hh,.014),frameM,s*hw/2,HUD_Y+hh/2,-HUD_Z);
    add(box(hw+.012,.012,.014),frameM,0,HUD_Y+hh,-HUD_Z);add(box(hw*.7,.06,.16),dark,0,HUD_Y-.02,-HUD_Z+.02);
  }
  // canopy and windscreen framing
  if(P.frame==='bubble'){
    const bow=add(new THREE.TorusGeometry(.6,.022,6,30,Math.PI),frameM,0,-.28,-1.05);bow.scale.set(1,1.1,1);
    for(const s of[-1,1])add(box(.05,.05,1.9),frameM,s*.6,-.29,-.1);
    if(t.tandem||k2(type))add(new THREE.TorusGeometry(.58,.02,6,30,Math.PI),frameM,0,-.28,.75);
    add(box(.04,.04,.04),yel,.5,-.6,.1);   // canopy jettison handle
  }else if(P.frame==='heavy'||P.frame==='heli'){
    const y0=top+.02,y1=P.frame==='heli'?.55:.42,zf=P.frame==='heli'?-1.15:-1.22;
    for(const x of P.posts)add(box(.032,y1-y0,.04),frameM,x,(y0+y1)/2,zf,null,P.frame==='heli'?0:-.25);
    add(box(WW+.3,.06,.06),frameM,CX,y1,zf+.04);add(box(WW+.3,.05,.05),frameM,CX,y0+.01,zf-.05);
    for(const s of[-1,1]){const x=s<0?W0-.12:W1+.12;add(box(.05,y1-y0+.2,1.6),frameM,x,(y0+y1)/2,-.4);
      add(box(.06,.06,1.6),frameM,x,y0+.12,-.4);add(box(.06,.06,1.6),frameM,x,y1-.05,-.4);}
    if(P.eyebrow)for(const x of[-.4,.3,.85,1.5])add(box(.32,.04,.04),frameM,x,y1+.1,zf+.2);
    add(box(WW+.4,.04,1.8),dark,CX,y1+.18,-.2);                                       // roof
    if(P.frame==='heli')for(const x of[-.2,1.3])add(box(.4,.03,.4),frameM,x,-1.05,-.95);   // chin windows frames
  }
  // overhead panel on big aircraft
  if(P.over&&heavy){const op=add(new THREE.BoxGeometry(.7,.06,1),panelM,.55,.5,-.35,null,.25);
    const face=add(new THREE.PlaneGeometry(.66,.96),stdM({map:placardTex(99,P.panel),roughness:.8}),.55,.465,-.35);face.rotation.set(Math.PI/2+.25,0,0);
    for(let i=0;i<30;i++){const x=.55+(rr()-.5)*.6,z=-.8+rr()*.9;add(tg,metal,x,.45+(z+.35)*-.25,z,null,Math.PI+.4);}}
  // seats
  const seat=(x0)=>{add(box(.5,.12,.5),seatM,x0,-.98,.3);add(box(.5,.8,.12),seatM,x0,-.55,.62,null,-.12);if(!heavy){add(box(.12,.16,.02),yel,x0-.08,-.86,.04);add(box(.12,.16,.02),yel,x0+.08,-.86,.04);}};
  seat(0);if(side)seat(1.1);
  // controls: stick, yoke or Airbus side-stick, for both pilots on a two-seat flight deck
  const mkStick=(x0,z0)=>{const s=new THREE.Group();s.position.set(x0,-.84,z0);g.add(s);
    add(new THREE.CylinderGeometry(.06,.07,.04,12),dark,0,0,0,s);add(new THREE.CylinderGeometry(.014,.018,.24,10),black,0,.13,0,s);
    const grip=add(new THREE.CylinderGeometry(.022,.026,.11,10),black,0,.3,0,s,.25);add(box(.016,.016,.016),stdM({color:0xb02a20}),.012,.36,-.012,s);
    add(box(.04,.012,.03),metal,0,.33,-.025,s);sticks.push(s);return s;};
  const mkYoke=(x0)=>{const s=new THREE.Group();s.position.set(x0,-.96,-.58);g.add(s);
    add(box(.07,.5,.08),dark,0,.25,0,s);const wh=new THREE.Group();wh.position.set(0,.5,.08);s.add(wh);
    add(box(.32,.035,.04),black,0,0,0,wh);for(const sd of[-1,1]){add(box(.035,.13,.04),black,sd*.16,.05,0,wh);add(box(.02,.02,.02),stdM({color:0xb02a20}),sd*.16,.12,-.02,wh);}
    add(box(.08,.05,.02),bezel,0,0,-.025,wh);s.userData.wheel=wh;sticks.push(s);return s;};
  const mkSide=(x0,z0)=>{const s=new THREE.Group();s.position.set(x0,-.6,z0);g.add(s);add(new THREE.CylinderGeometry(.03,.04,.03,10),dark,0,0,0,s);
    add(new THREE.CylinderGeometry(.018,.022,.12,10),black,0,.07,0,s,-.2);add(box(.015,.015,.015),stdM({color:0xb02a20}),0,.14,-.02,s);sticks.push(s);return s;};
  if(P.airbus){mkSide(W0-cw/2+.05,-.2);mkSide(W1+cw/2-.05,-.2);}
  else if(P.ctl==='yoke'){mkYoke(0);if(side)mkYoke(1.1);}
  else if(P.ctl==='side'&&!side){mkSide(W1+cw/2-.08,-.32);}
  else{mkStick(0,-.42);if(side)mkStick(1.1,-.42);}
  // throttles: left console on fighters, centre pedestal between the pilots on big aircraft
  const n=P.thrN,ped=side;const tx=ped?.55:W0-cw/2+.06,ty=ped?-.62:-.57,tz=ped?-.5:-.32;
  if(ped){add(box(.36,.42,.9),panelM,.55,-.85,-.3);const pf=add(new THREE.PlaneGeometry(.34,.86),consM,.55,-.638,-.28);pf.rotation.x=-Math.PI/2;
    add(new THREE.CylinderGeometry(.08,.08,.03,20),black,.55+.15,-.6,-.1,null,0,0,Math.PI/2);}       // trim wheel
  for(let i=0;i<n;i++){const lv=new THREE.Group();lv.position.set(tx+(i-(n-1)/2)*(ped?Math.min(.04,.3/n):.035),ty,tz);g.add(lv);thr.push(lv);
    add(box(.012,.12,.012),metal,0,.06,0,lv);add(box(ped?.028:.07,.03,ped?.04:.08),ped&&n>4&&i%2?black:dark,0,.13,0,lv);}
  if(ped)add(box(.04,.03,.06),metal,tx+.14,ty+.05,tz+.12);   // speedbrake lever
}
function k2(type){return['f15e','f18f','ea18g','su30','mig31','hawk','hawk127','pc21'].includes(type);}

/* ---------- live displays ---------- */
const MFDG='#39d977';
function drawPages(p){
  const t=TYPES[p.type];
  for(const name in PAGE){
    const {x:c,t:tex}=PAGE[name];c.save();c.fillStyle='#03100a';c.fillRect(0,0,256,256);c.lineWidth=1.5;
    if(name==='map'){
      c.strokeStyle='#1f7a45';for(const rr of[40,80,118]){c.beginPath();c.arc(128,128,rr,0,TAU);c.stroke();}
      const k=118/(ARENA+1800),pt=(x,z)=>{let dx=-x*k,dy=-z*k;const d=Math.hypot(dx,dy);if(d>116){dx*=116/d;dy*=116/d;}return[128+dx,128+dy];};
      for(const b of BASES){const q=pt(b.x,b.z);c.strokeStyle=b.hp>0?TEAM[b.team].col:'#666';c.strokeRect(q[0]-5,q[1]-5,10,10);}
      for(const q of planes){if(!q.alive||(q.team!==p.team&&!canSee(q)))continue;const m=pt(q.x,q.z);
        if(q===p){c.save();c.translate(m[0],m[1]);c.rotate(Math.atan2(-Math.cos(q.yaw),-Math.sin(q.yaw)));c.fillStyle='#ffe066';c.beginPath();c.moveTo(11,0);c.lineTo(-7,-6);c.lineTo(-7,6);c.closePath();c.fill();c.restore();}
        else{c.fillStyle=q.human&&q.team===p.team?'#ffd23f':TEAM[q.team].col;if(q.cls)c.fillRect(m[0]-5,m[1]-5,10,10);else{c.beginPath();c.arc(m[0],m[1],4,0,TAU);c.fill();}}}
      c.fillStyle=MFDG;c.font='bold 15px monospace';c.fillText('TSD  '+(awacs[p.team]?'LINK':'OWN'),8,18);
    }else if(name==='rdr'){ // B-scope: range down the screen, bearing across
      c.strokeStyle='#1f7a45';for(let i=1;i<4;i++){c.beginPath();c.moveTo(0,i*64);c.lineTo(256,i*64);c.stroke();c.beginPath();c.moveTo(i*64,20);c.lineTo(i*64,256);c.stroke();}
      const sweep=(time*1.4)%2;c.strokeStyle='rgba(57,217,119,.6)';c.beginPath();const sx=sweep<1?sweep*256:(2-sweep)*256;c.moveTo(sx,20);c.lineTo(sx,256);c.stroke();
      for(const q of planes){if(!q.alive||q===p||q.team===p.team)continue;const dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz);if(d>RADAR)continue;
        const a=angDiff(Math.atan2(dx,dz),p.yaw);if(Math.abs(a)>1)continue;const X=128-a*128,Y=256-d/RADAR*236;
        c.fillStyle=q===lockTgt?'#ffd23f':MFDG;c.fillRect(X-4,Y-3,8,6);if(q===lockTgt){c.strokeStyle='#ffd23f';c.strokeRect(X-8,Y-7,16,14);}}
      c.fillStyle=MFDG;c.font='bold 15px monospace';c.fillText('RWS  '+Math.round(RADAR/1852)+' NM',8,16);
    }else if(name==='sms'){
      c.fillStyle=MFDG;c.font='bold 18px monospace';
      const rows=[t.name+'  SMS',t.msl?t.mslName+'  x'+p.msl:'',t.gun?'GUN     '+p.ammo:'',t.bombs?'MK-82   x'+p.bombs:'','FLARE   '+p.flares,'CHAFF   '+p.chaff,'B61     '+nukesHeld,'','MASTER ARM  '+(p.ground?'SAFE':'ARM')];
      rows.forEach((s,i)=>c.fillText(s,10,24+i*24));
    }else if(name==='eng'){
      const n=Math.min(8,TYPES[p.type].thrN||TYPES[p.type].eng||1),w=240/n;
      for(let i=0;i<n;i++){const cx=8+w*i+w/2,r=Math.min(w/2-4,34),a0=Math.PI*.75,v=clamp(.2+p.thr*.8,0,1)*(p.alive?1:0);
        c.strokeStyle='#5c6670';c.lineWidth=4;c.beginPath();c.arc(cx,60,r,a0,a0+Math.PI*1.5);c.stroke();
        c.strokeStyle=v>.95?'#ffd23f':'#e8eef2';c.beginPath();c.arc(cx,60,r,a0,a0+Math.PI*1.5*v);c.stroke();
        c.fillStyle='#e8eef2';c.font='bold 12px monospace';c.textAlign='center';c.fillText((v*100).toFixed(0),cx,64);
        c.fillStyle='#39d977';c.fillRect(cx-6,150-60*v,12,60*v);c.strokeStyle='#5c6670';c.lineWidth=1;c.strokeRect(cx-6,90,12,60);}
      c.textAlign='left';c.fillStyle='#e8eef2';c.font='bold 15px monospace';
      c.fillText('N1 %',8,18);c.fillText('GEAR '+(p.gearT>=1?'DN':p.gearT<=0?'UP':'TRN'),8,184);c.fillText('FLAP '+(p.flap>=1?'FULL':p.flap>0?'T/O':'UP'),8,206);
      c.fillText(p.burn?'FIRE':(p.dm&&p.dm[3]>=1)?'ENG OUT':'COND '+Math.max(0,Math.round((p.cond===undefined?1:p.cond)*100))+'%',130,184);c.fillText(p.brake?'BRK SET':'BRK OFF',130,206);c.fillText(p.rev?'REV':'',130,228);
    }else if(name==='pfd'){ // attitude, speed and altitude tapes, heading
      c.translate(128,118);c.rotate(-p.roll);const py=p.pitch*180/Math.PI*4;
      c.fillStyle='#2a6fb5';c.fillRect(-260,-400+py,520,400);c.fillStyle='#7a4f24';c.fillRect(-260,py,520,400);
      c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.moveTo(-200,py);c.lineTo(200,py);c.stroke();
      c.fillStyle='#fff';c.font='10px monospace';for(let d=-30;d<=30;d+=10){if(!d)continue;const y=py-d*4;c.beginPath();c.moveTo(-25,y);c.lineTo(25,y);c.stroke();c.fillText(d,30,y+3);}
      c.restore();c.save();
      c.strokeStyle='#ffd23f';c.lineWidth=4;c.beginPath();c.moveTo(80,118);c.lineTo(115,118);c.lineTo(115,126);c.moveTo(176,118);c.lineTo(141,118);c.lineTo(141,126);c.stroke();
      c.fillStyle='rgba(0,0,0,.55)';c.fillRect(0,40,48,160);c.fillRect(208,40,48,160);c.fillRect(70,226,116,26);
      c.fillStyle='#fff';c.font='bold 15px monospace';c.textAlign='center';c.fillText(kt(p.spd),24,124);c.fillText(Math.round(ft(p.y-PAD_Y)/10)*10,232,124);
      c.fillText(String(Math.round(((-p.yaw*180/Math.PI)+360)%360)).padStart(3,'0'),128,244);
      c.font='10px monospace';c.fillText('KT',24,50);c.fillText('FT',232,50);
    }
    c.restore();tex.needsUpdate=true;
  }
}
function needle(x,cx,cy,r,a,col,w){x.strokeStyle=col||'#f2f2f2';x.lineWidth=w||5;x.lineCap='round';x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.sin(a)*r,cy-Math.cos(a)*r);x.stroke();}
function dial(x,cx,cy,r,ticks,labels,face){
  x.fillStyle=face==='ru'?'#101314':'#0c0d0e';x.beginPath();x.arc(cx,cy,r,0,TAU);x.fill();
  x.strokeStyle='#e8e8e8';for(let i=0;i<ticks;i++){const a=i/ticks*TAU,l=i%(ticks/ (labels?labels.length:ticks))===0?16:8;x.lineWidth=i%(ticks/(labels?labels.length:ticks))===0?4:2;
    x.beginPath();x.moveTo(cx+Math.sin(a)*(r-4),cy-Math.cos(a)*(r-4));x.lineTo(cx+Math.sin(a)*(r-4-l),cy-Math.cos(a)*(r-4-l));x.stroke();}
  if(labels){x.fillStyle='#e8e8e8';x.font='bold 24px sans-serif';x.textAlign='center';x.textBaseline='middle';labels.forEach((s,i)=>{const a=i/labels.length*TAU;x.fillText(s,cx+Math.sin(a)*(r-40),cy-Math.cos(a)*(r-40));});}
}
function drawGauges(p){
  const x=GA.getContext('2d'),face=cock&&cock.P.face;
  x.fillStyle='#000';x.fillRect(0,0,1024,1024);
  const cell=(k,fn)=>{const i=GK[k],cx=(i%4)*256+128,cy=Math.floor(i/4)*256+128;x.save();x.beginPath();x.arc(cx,cy,124,0,TAU);x.clip();fn(cx,cy,122);x.restore();
    const gl=x.createLinearGradient(cx-120,cy-120,cx+60,cy+60);gl.addColorStop(0,'rgba(255,255,255,.14)');gl.addColorStop(.4,'rgba(255,255,255,0)');x.fillStyle=gl;x.beginPath();x.arc(cx,cy,122,0,TAU);x.fill();};
  const alt=ft(p.y-PAD_Y),spd=kt(p.spd),vs=p.vs||0,thr=p.alive?p.thr:0;
  cell('adi',(cx,cy,r)=>{x.translate(cx,cy);x.rotate(-p.roll);const py=p.pitch*180/Math.PI*3.2;
    x.fillStyle=face==='ru'?'#3d78b8':'#4a8ccc';x.fillRect(-200,-400+py,400,400);x.fillStyle=face==='ru'?'#6b4a2a':'#2a2a2a';x.fillRect(-200,py,400,400);
    x.strokeStyle='#fff';x.lineWidth=3;x.beginPath();x.moveTo(-200,py);x.lineTo(200,py);x.stroke();for(let d=-30;d<=30;d+=10){if(d){x.beginPath();x.moveTo(-30,py-d*3.2);x.lineTo(30,py-d*3.2);x.stroke();}}
    x.rotate(p.roll);x.strokeStyle='#ffb02a';x.lineWidth=7;x.beginPath();x.moveTo(-80,0);x.lineTo(-25,0);x.lineTo(-12,12);x.moveTo(80,0);x.lineTo(25,0);x.lineTo(12,12);x.stroke();});
  cell('alt',(cx,cy,r)=>{dial(x,cx,cy,r,50,['0','1','2','3','4','5','6','7','8','9'],face);needle(x,cx,cy,r*.82,(alt%1000)/1000*TAU);needle(x,cx,cy,r*.5,(alt%10000)/10000*TAU,'#f2f2f2',9);x.fillStyle='#ccc';x.font='bold 18px sans-serif';x.fillText('ALT',cx,cy+40);});
  cell('asi',(cx,cy,r)=>{dial(x,cx,cy,r,40,['0','100','200','300','400','500','600','700'],face);needle(x,cx,cy,r*.82,clamp(spd/800,0,1)*TAU);x.fillStyle='#ccc';x.font='bold 18px sans-serif';x.fillText('KNOTS',cx,cy+40);});
  cell('vsi',(cx,cy,r)=>{dial(x,cx,cy,r,24,['0','1','2','3','4','6'],face);needle(x,cx,cy,r*.82,-Math.PI/2+clamp(vs/30,-1,1)*Math.PI*.8);x.fillStyle='#ccc';x.font='bold 16px sans-serif';x.fillText('VERT SPD',cx,cy+40);});
  cell('hsi',(cx,cy,r)=>{x.translate(cx,cy);x.rotate(p.yaw);dial(x,0,0,r,72,['N','3','6','E','12','15','S','21','24','W','30','33'],face);x.rotate(-p.yaw);
    x.fillStyle='#ffb02a';x.beginPath();x.moveTo(0,-r+20);x.lineTo(-10,-r+44);x.lineTo(10,-r+44);x.fill();x.strokeStyle='#ffb02a';x.lineWidth=4;x.beginPath();x.moveTo(-30,20);x.lineTo(30,20);x.moveTo(0,-20);x.lineTo(0,50);x.stroke();});
  const arcDial=(k,v,label,red)=>cell(k,(cx,cy,r)=>{dial(x,cx,cy,r,30,null,face);x.strokeStyle=red||'#d33';x.lineWidth=10;x.beginPath();x.arc(cx,cy,r-14,-Math.PI/2+1.8,-Math.PI/2+2.4);x.stroke();
    needle(x,cx,cy,r*.82,-2.4+clamp(v,0,1)*4.8);x.fillStyle='#ccc';x.font='bold 22px sans-serif';x.fillText(label,cx,cy+44);x.font='bold 20px monospace';x.fillText(Math.round(v*100),cx,cy+70);});
  arcDial('rpm',.2+thr*.8,'RPM %');arcDial('egt',.25+thr*.6+(p.hp<p.hpMax*.3?.15:0),'EGT');arcDial('fuel',.75,'FUEL');arcDial('epr',.3+thr*.6,'EPR');arcDial('ff',.1+thr*.85,'FF');
  arcDial('hyd',p.hp>0?.8:0,'HYD');arcDial('oil',.6+thr*.1,'OIL');arcDial('flap',p.flapT||0,'FLAP');arcDial('aoa',clamp((p.ground?0:.3+(p.pitchS||0)*.3),0,1),'AOA');
  cell('g',(cx,cy,r)=>{dial(x,cx,cy,r,30,['0','2','4','6','8','-2'],face);needle(x,cx,cy,r*.82,clamp(1+(p.pitchS||0)*Math.min(1,p.spd/150)*6,-2,9)/12*TAU);x.fillStyle='#ccc';x.font='bold 22px sans-serif';x.fillText('G',cx,cy+44);});
  cell('clock',(cx,cy,r)=>{dial(x,cx,cy,r,60,['12','3','6','9'],face);const tod=world?world.weather.tod:12;needle(x,cx,cy,r*.5,(tod%12)/12*TAU,'#f2f2f2',8);needle(x,cx,cy,r*.82,(tod%1)*TAU);});
  GAT.needsUpdate=true;
}
function updateCockpit(p,dt){
  if(!cock||cock.type!==p.type)buildCockpit(p.type);
  for(const s of cock.sticks){
    if(s.userData.wheel){s.userData.wheel.rotation.z=(p.yawS||0)*.9;s.rotation.x=(p.pitchS||0)*.18;}
    else s.rotation.set((p.pitchS||0)*.32,0,(p.yawS||0)*.36);
  }
  const ped=cock.P.seat==='side';
  for(const lv of cock.thr)lv.rotation.x=ped?-.6+p.thr*1.1:-.4+p.thr*.9;
  headPitch+=((input.keys.KeyV?-.55:-.13)-headPitch)*Math.min(1,dt*8);
  mfdT-=dt;if(mfdT<=0){mfdT=.12;drawPages(p);}
  gaugeT-=dt;if(gaugeT<=0){gaugeT=.08;drawGauges(p);}
}
