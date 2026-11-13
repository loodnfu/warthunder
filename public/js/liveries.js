'use strict';
/* ---------- liveries ---------- */
const LIVERIES={
  raaf:{name:'RAAF',sub:'Royal Australian Air Force',base:0x7c858d,camo:[],ins:'raaf',fin:'raaf'},
  usaf:{name:'USAF',sub:'United States Air Force',base:0x8b939b,camo:[0x7c848c],ins:'star',fin:'usaf'},
  usn:{name:'US Navy',sub:'United States Navy',base:0x9aa3ab,camo:[],ins:'star',fin:'usn'},
  raf:{name:'RAF',sub:'Royal Air Force',base:0x828b92,camo:[],ins:'raf',fin:'raf'},
  rcaf:{name:'RCAF',sub:'Royal Canadian Air Force',base:0x8a9299,camo:[],ins:'rcaf',fin:'rcaf'},
  fr:{name:'France',sub:'French Air and Space Force',base:0x7f8990,camo:[0x707b83],ins:'fr',fin:'fr'},
  de:{name:'Luftwaffe',sub:'German Air Force',base:0x8693a0,camo:[0x6e7c8a,0x9eabb6],ins:'cross',fin:'de'},
  it:{name:'Italy',sub:'Italian Air Force',base:0x8c949a,camo:[],ins:'it',fin:'it'},
  jp:{name:'JASDF',sub:'Japan Air Self-Defense Force',base:0x5d7697,camo:[0x48638a,0x7690b1],ins:'jp',fin:'none'},
  ind:{name:'India',sub:'Indian Air Force',base:0x979da3,camo:[0x878e95],ins:'ind',fin:'ind'},
  aggr:{name:'Aggressor',sub:'Desert splinter adversary scheme',base:0xc6b089,camo:[0x9f7f57,0x6e5f48],ins:'lowstar',fin:'aggr'},
  black:{name:'Black Ops',sub:'Low-visibility black',base:0x30353a,camo:[0x25292d],ins:'lowstar',fin:'none'},
  vks:{name:'Red Force',sub:'Enemy',base:0x7b8ea5,camo:[0x5d7591,0xa2b5c9],ins:'redstar',fin:'ru',hidden:true}
};
for(const k in LIVERIES)LIVERIES[k].id=k;
function ring(c,cx,cy,r,cols){cols.forEach((q,i)=>{c.fillStyle=q[0];c.beginPath();c.arc(cx,cy,r*q[1],0,TAU);c.fill();});}
function starPath(c,cx,cy,R,r){c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,q=i%2?r:R;c.lineTo(cx+Math.cos(a)*q,cy+Math.sin(a)*q);}c.closePath();}
function kangaroo(c,cx,cy,s,col){
  c.fillStyle=col;c.save();c.translate(cx,cy);c.scale(s,s);
  c.beginPath();c.ellipse(-.05,.1,.42,.26,-.5,0,TAU);c.fill();                       // body
  c.beginPath();c.ellipse(.36,-.32,.14,.1,-.3,0,TAU);c.fill();                       // head
  c.beginPath();c.moveTo(.22,-.18);c.lineTo(.3,-.32);c.lineTo(.12,-.05);c.fill();    // neck
  c.beginPath();c.moveTo(.42,-.42);c.lineTo(.4,-.58);c.lineTo(.34,-.4);c.fill();     // ear
  c.beginPath();c.moveTo(-.4,.2);c.quadraticCurveTo(-.7,.45,-.95,.62);c.lineTo(-.9,.66);c.quadraticCurveTo(-.6,.5,-.3,.34);c.fill(); // tail
  c.beginPath();c.moveTo(-.1,.3);c.lineTo(.15,.62);c.lineTo(.42,.62);c.lineTo(.38,.56);c.lineTo(.2,.55);c.lineTo(.08,.24);c.fill(); // leg
  c.beginPath();c.moveTo(.22,-.02);c.lineTo(.36,.12);c.lineTo(.32,.15);c.lineTo(.18,.04);c.fill(); // arm
  c.restore();
}
function mapleLeaf(c,cx,cy,s,col){
  const r=[1,.45,.82,.42,.62,.3,.95,.3,.62,.42,.82,.45];c.fillStyle=col;c.beginPath();
  for(let i=0;i<=24;i++){const a=-Math.PI/2+i*TAU/24,k=r[i%12]*(i%2?1:1);c.lineTo(cx+Math.cos(a)*s*(i%2?.48:k),cy+Math.sin(a)*s*(i%2?.48:k)*.95);}
  c.fill();c.fillRect(cx-s*.06,cy+s*.3,s*.12,s*.45);
}
function drawIns(c,kind,cx,cy,r){
  switch(kind){
    case'raf':ring(c,cx,cy,r,[['#1f3c7a',1],['#fff',.62],['#c8102e',.32]]);break;
    case'raaf':ring(c,cx,cy,r,[['#1f3c8a',1],['#fff',.66]]);kangaroo(c,cx,cy+r*.05,r*.55,'#c8102e');break;
    case'rcaf':ring(c,cx,cy,r,[['#1f3c8a',1],['#fff',.66]]);mapleLeaf(c,cx,cy-r*.05,r*.55,'#d52b1e');break;
    case'fr':ring(c,cx,cy,r,[['#d52b1e',1],['#fff',.66],['#1f3c8a',.33]]);break;
    case'it':ring(c,cx,cy,r,[['#0b8a3e',1],['#fff',.66],['#ce2b37',.33]]);break;
    case'ind':ring(c,cx,cy,r,[['#ff8f1c',1],['#fff',.66],['#138808',.33]]);break;
    case'jp':ring(c,cx,cy,r,[['#fff',1],['#c8102e',.86]]);break;
    case'cross':{const w=r*.36,L=r;c.fillStyle='#fff';c.fillRect(cx-L,cy-w*.5-r*.1,2*L,w+r*.2);c.fillRect(cx-w*.5-r*.1,cy-L,w+r*.2,2*L);
      c.fillStyle='#111';c.fillRect(cx-L+r*.1,cy-w*.5,2*L-r*.2,w);c.fillRect(cx-w*.5,cy-L+r*.1,w,2*L-r*.2);break;}
    case'star':case'lowstar':{const lo=kind==='lowstar',d=r*.55;
      c.fillStyle=lo?'#5d646a':'#fff';c.fillRect(cx-r,cy-d*.32,2*r,d*.64);
      if(!lo){c.fillStyle='#c8102e';c.fillRect(cx-r+2,cy-d*.08,2*r-4,d*.16);}
      c.fillStyle=lo?'#5d646a':'#1f2f6e';c.beginPath();c.arc(cx,cy,d,0,TAU);c.fill();
      c.fillStyle=lo?'#878f96':'#fff';starPath(c,cx,cy,d*.95,d*.38);c.fill();break;}
    case'redstar':c.fillStyle='#1f3c8a';starPath(c,cx,cy,r,r*.42);c.fill();c.fillStyle='#fff';starPath(c,cx,cy,r*.84,r*.35);c.fill();
      c.fillStyle='#c8102e';starPath(c,cx,cy,r*.7,r*.29);c.fill();break;
  }
}
function drawFin(c,kind,S){
  const v=(cols)=>{const w=S*.7/cols.length;cols.forEach((q,i)=>{c.fillStyle=q;c.fillRect(S*.15+i*w,S*.2,w,S*.6);});};
  const h=(cols)=>{const hh=S*.5/cols.length;cols.forEach((q,i)=>{c.fillStyle=q;c.fillRect(S*.12,S*.25+i*hh,S*.76,hh);});};
  const t=(s,col)=>{c.fillStyle=col;c.font='bold '+Math.round(S*.42)+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(s,S/2,S/2);};
  switch(kind){
    case'raf':v(['#c8102e','#fff','#1f3c7a']);break;
    case'fr':v(['#1f3c8a','#fff','#d52b1e']);break;
    case'it':v(['#0b8a3e','#fff','#ce2b37']);break;
    case'ind':v(['#ff8f1c','#fff','#138808']);break;
    case'de':h(['#111','#d00','#ffce00']);break;
    case'ru':h(['#fff','#1f3c8a','#d52b1e']);break;
    case'raaf':kangaroo(c,S/2,S/2,S*.42,'#c8102e');break;
    case'rcaf':c.fillStyle='#d52b1e';c.fillRect(S*.1,S*.25,S*.2,S*.5);c.fillRect(S*.7,S*.25,S*.2,S*.5);c.fillStyle='#fff';c.fillRect(S*.3,S*.25,S*.4,S*.5);mapleLeaf(c,S/2,S/2,S*.2,'#d52b1e');break;
    case'usaf':t('AF','#3c4247');break;
    case'usn':t('NJ','#3c4247');break;
    case'aggr':t('WA','#5a4a36');break;
  }
}
const DECALMAT={};
function decalMat(lv,kind){
  const key=lv.id+'|'+kind;
  if(!DECALMAT[key]){
    const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
    if(kind==='fin')drawFin(x,lv.fin,128);else drawIns(x,lv.ins,64,64,60);
    DECALMAT[key]=new THREE.MeshLambertMaterial({map:new THREE.CanvasTexture(c),transparent:true,alphaTest:.3,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
  }
  return DECALMAT[key];
}
function hash3(i,j,k){const s=Math.sin(i*127.1+j*311.7+k*74.7)*43758.5453;return s-Math.floor(s);}
function vnoise(x,y,z){ // smooth value noise for camouflage patterns
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=x-ix,fy=y-iy,fz=z-iz,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=fz*fz*(3-2*fz);
  const l=(a,b,t)=>a+(b-a)*t,h=(a,b,c)=>hash3(ix+a,iy+b,iz+c);
  return l(l(l(h(0,0,0),h(1,0,0),u),l(h(0,1,0),h(1,1,0),u),v),l(l(h(0,0,1),h(1,0,1),u),l(h(0,1,1),h(1,1,1),u),v),w);
}
function camoColour(lv,x,y,z,out){
  const cs=[lv.base,...lv.camo];
  if(cs.length===1)return out.setHex(lv.base);
  const n=vnoise(x*.22+11,y*.22,z*.22)*.65+vnoise(x*.6,y*.6+7,z*.6)*.35;
  return out.setHex(cs[Math.min(cs.length-1,Math.floor(n*cs.length*1.05))]);
}
// decal spots: found once per aircraft by casting rays at its surfaces
const RC=new THREE.Raycaster(),SPOTS={};
function computeSpots(root){
  root.updateMatrixWorld(true);
  const meshes=[];
  root.traverse(o=>{if(!o.isMesh)return;let q=o,skip=false;while(q){if(q.name==='gear'||q.name==='glass'||q.userData.leg)skip=true;q=q.parent;}if(!skip){o.material.side=THREE.DoubleSide;meshes.push(o);}});
  const box=new THREE.Box3();meshes.forEach(m=>box.expandByObject(m));
  const hs=Math.max(-box.min.x,box.max.x),len=box.max.z-box.min.z,spots=[],V=(a,b,c)=>new THREE.Vector3(a,b,c);
  const cast=(o,d)=>{RC.set(o,d);RC.far=1e4;return RC.intersectObjects(meshes,false)[0]||null;};
  const nrm=h=>h.face.normal.clone().transformDirection(h.object.matrixWorld);
  const runs=(fn,n)=>{const out=[];let cur=[];for(let i=0;i<=n;i++){const h=fn(i);if(h)cur.push(h);else if(cur.length){out.push(cur);cur=[];}}if(cur.length)out.push(cur);return out.sort((a,b)=>b.length-a.length);};
  for(const f of[.62,.52,.72,.42]){ // national markings on the upper wings
    const x=hs*f,r=runs(i=>cast(V(x,box.max.y+5,box.max.z-len*i/90),V(0,-1,0)),90)[0];
    if(!r||r.length<3)continue;
    const mid=r[r.length>>1],size=Math.min(len*r.length/90*.7,x*.55,len*.2);
    for(const sg of[1,-1]){const h=cast(V(x*sg,box.max.y+5,mid.point.z),V(0,-1,0));if(h){const n=nrm(h);if(n.y<0)n.negate();spots.push({p:h.point.clone(),n,up:V(0,0,1),size,kind:'ins'});}}
    break;
  }
  const y0=box.min.y+(box.max.y-box.min.y)*.72;  // fin flash, both sides
  for(const sg of[1,-1]){
    const r=runs(i=>cast(V(sg*(hs+5),y0,box.min.z+len*.42*i/60),V(-sg,0,0)),60)[0];
    if(!r||r.length<2)continue;
    const mid=r[r.length>>1],n=nrm(mid);if(n.x*sg<0)n.negate();
    spots.push({p:mid.point.clone(),n,up:V(0,1,0),size:Math.min(len*.42*r.length/60*.8,(box.max.y-y0)*1.5),kind:'fin'});
  }
  if(len>25)for(const sg of[1,-1]){ // big aircraft carry the roundel on the rear fuselage
    const h=cast(V(sg*(hs+5),0,box.min.z+len*.3),V(-sg,0,0));
    if(h){const n=nrm(h);if(n.x*sg<0)n.negate();if(Math.abs(n.x)>.5)spots.push({p:h.point.clone(),n,up:V(0,1,0),size:len*.055,kind:'ins'});}
  }
  const o=new THREE.Object3D();
  for(const s of spots){o.position.copy(s.p);o.up.copy(s.up);o.lookAt(s.p.clone().add(s.n));s.q=o.quaternion.clone();}
  return spots;
}
const DECALGEO=new THREE.PlaneGeometry(1,1);
function addDecals(g,spots,lv){
  for(const s of spots){
    if(s.kind==='fin'&&lv.fin==='none')continue;
    const m=new THREE.Mesh(DECALGEO,decalMat(lv,s.kind));
    m.position.copy(s.p).addScaledVector(s.n,.04);m.quaternion.copy(s.q);m.scale.setScalar(s.size);g.add(m);
  }
}

