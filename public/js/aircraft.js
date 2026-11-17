'use strict';
/* ---------- aircraft models ---------- */
function flat(pts){
  const g=new THREE.BufferGeometry(),a=[];
  for(let i=1;i<pts.length-1;i++)a.push(pts[0][0],pts[0][1],pts[0][2],pts[i][0],pts[i][1],pts[i][2],pts[i+1][0],pts[i+1][1],pts[i+1][2]);
  g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));g.computeVertexNormals();return g;
}
function slab(pts,th){ // [x,z] outline -> a wing panel of thickness th centred on y=0
  const sh=new THREE.Shape();sh.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)sh.lineTo(pts[i][0],pts[i][1]);sh.closePath();
  const g=new THREE.ExtrudeGeometry(sh,{depth:th,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,th/2,0);return g;
}
function lathe(prof,seg){ // [z,radius] from tail to nose
  return new THREE.LatheGeometry(prof.map(q=>new THREE.Vector2(Math.max(q[1],.001),q[0])),seg||14).rotateX(Math.PI/2);
}
const cylZ=(r1,r2,len,seg)=>new THREE.CylinderGeometry(r1,r2,len,seg||12).rotateX(Math.PI/2); // r1 is the forward end
// aircraft materials pick up sky reflections (ENV, rebuilt as the sun moves) and get panel lines and light weathering
const AC_MATS=new Set();let ENV=null;
function setAircraftEnv(tex){ENV=tex;for(const m of AC_MATS){m.envMap=tex;m.needsUpdate=true;}}
function track(m,intensity){m.envMap=ENV;m.envMapIntensity=intensity;AC_MATS.add(m);return m;}
const FACE_VIEWER='#include <normal_fragment_maps>\n  if(dot(normal,vViewPosition)<0.0)normal=-normal;';
function faceViewer(m){const prev=m.onBeforeCompile;m.onBeforeCompile=(sh,r)=>{if(prev)prev(sh,r);sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',FACE_VIEWER);};
  const key=m.customProgramCacheKey?m.customProgramCacheKey():'';m.customProgramCacheKey=()=>key+'+fv';return m;}
function skinShader(m){
  m.onBeforeCompile=sh=>{
    sh.vertexShader='varying vec3 vOP;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvOP=position;');
    sh.fragmentShader='varying vec3 vOP;\n'+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      { vec3 q=vOP; vec3 f=abs(fract(q*vec3(.85,.7,.55))-.5);
        float line=smoothstep(.482,.5,max(f.x,f.z));
        float h=fract(sin(dot(floor(q*vec3(.85,.7,.55)),vec3(12.9898,78.233,37.719)))*43758.5453);
        float n=fract(sin(dot(floor(q*6.),vec3(7.13,157.1,113.7)))*24634.6345);
        float lum=dot(diffuseColor.rgb,vec3(.33));
        diffuseColor.rgb*=1.-line*.28*(.4+lum);
        diffuseColor.rgb*=.955+h*.07+n*.02;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.18,.17,.16),smoothstep(.15,-.6,q.y)*.08); }`);
  };
  m.customProgramCacheKey=()=>'skin';m.userData.skin=1;return faceViewer(m);
}
/* ---------- visible battle damage: each aircraft gets its own copy of its skin materials, and the shader
   blackens, holes and tears away the parts that have been shot up (same zones as the simulation) ---------- */
const DMG_GLSL_V='varying vec3 vPP;\nuniform mat4 uInv;\n';
const DMG_GLSL_F=`varying vec3 vPP;uniform vec3 uD0;uniform vec3 uD1;uniform vec4 uDim;
float dh(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
float dn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(dh(i),dh(i+vec3(1,0,0)),f.x),mix(dh(i+vec3(0,1,0)),dh(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(dh(i+vec3(0,0,1)),dh(i+vec3(1,0,1)),f.x),mix(dh(i+vec3(0,1,1)),dh(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
const DMG_FRAG=`
  { float Lz=uDim.x,Sp=uDim.y,Rf=uDim.z;vec3 q=vPP;float ax=abs(q.x),d=0.;bool wing=false,tail=false;
    if(q.z<-Lz*.3){d=uD0.z;tail=true;}
    else if(ax>Rf*.9){ if(uDim.w>.5&&ax>Sp*.2&&ax<Sp*.7&&q.y<-Rf*.2)d=uD1.x; else {d=q.x>0.?uD0.x:uD0.y;wing=true;} }
    else if(q.z>Lz*(uDim.w>.5?.38:.18))d=uD1.z;
    else if(uDim.w<.5&&q.z<-Lz*.12)d=uD1.x;
    else if(uDim.w>.5&&q.z<-Lz*.15)d=uD0.z;
    else d=uD1.y;
    if(d>0.){
      vec3 qr=mat3(.8,.36,-.48,-.6,.48,-.64,0.,.8,.6)*q;                 // rotated so the soot does not follow a grid
      float n=dn(qr*.55)*.55+dn(qr*1.9)*.3+dn(qr*6.1)*.15;
      if(d>=1.&&wing&&ax>Sp*(.3+.35*n))discard;                       // wing torn away
      if(d>=1.&&tail&&ax>Rf*(1.1+.5*n)&&q.y<Rf*1.6)discard;           // tailplane shot off
      if(d>.55&&dn(qr*4.)>1.02-(d-.55)*.28&&(wing||tail))discard;      // ragged holes you can see through
      float th=.18+d*.42,soot=smoothstep(th,th-.16,n);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.07,.065,.06),soot*(.55+.35*d));          // scorched, blackened skin
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.36,.26,.17),smoothstep(.04,0.,abs(n-th-.02))*.45*step(.25,d));   // burnt, blistered paint at the edge
    }
  }`;
function damageable(mat){
  const c=mat.clone(),prev=mat.onBeforeCompile,key=mat.customProgramCacheKey?mat.customProgramCacheKey():'';
  const u=c.userData.du={uD0:{value:new THREE.Vector3()},uD1:{value:new THREE.Vector3()},uDim:{value:new THREE.Vector4(15,5,1,0)},uInv:{value:new THREE.Matrix4()}};
  c.onBeforeCompile=(sh,r)=>{if(prev)prev(sh,r);Object.assign(sh.uniforms,u);
    sh.vertexShader=DMG_GLSL_V+sh.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n  vPP=(uInv*modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader=DMG_GLSL_F+sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>'+DMG_FRAG);};
  c.customProgramCacheKey=()=>key+'+dmg';c.envMap=mat.envMap;c.envMapIntensity=mat.envMapIntensity;AC_MATS.add(c);
  return c;
}
function makeDamageable(g,type){
  const t=TYPES[type],V=t.cls?1.3:(t.model&&MODELS[type])?1.7:1.3,L=(t.len||15)*V,S=(t.heli?t.rotorR*.35:(t.span?t.span/2:(t.wing?t.wing[4]:L*.35)))*V,Rr=Math.max(.6,(t.r||1)*V*1.5);
  const map=new Map(),mats=[];
  g.traverse(o=>{if(!o.isMesh||o.userData.hole)return;let skip=false;for(let q=o;q;q=q.parent)if(q.name==='glass'||q.name==='prop')skip=true;if(skip)return;
    const sw=m=>{if(!m||!m.userData||!m.userData.skin)return m;if(!map.has(m)){const c=damageable(m);c.userData.du.uDim.value.set(L,S,Rr,t.cls?1:0);map.set(m,c);mats.push(c);}return map.get(m);};
    o.material=Array.isArray(o.material)?o.material.map(sw):sw(o.material);});
  g.userData.dmgMats=mats;g.userData.dmgDim={S,R:Rr};
}
const _dmM=new THREE.Matrix4();
function syncPlaneDamage(g,p){
  const mats=g.userData.dmgMats;if(!mats||!mats.length)return;const dm=p.dm||[0,0,0,0,0,0];
  g.updateMatrixWorld(true);_dmM.copy(g.matrixWorld).invert();const sc=g.scale.x;_dmM.premultiply(new THREE.Matrix4().makeScale(sc,sc,sc));   // world → aircraft frame in drawn metres
  for(const m of mats){const u=m.userData.du;u.uD0.value.set(dm[0],dm[1],dm[2]);u.uD1.value.set(dm[3],dm[4],dm[5]);u.uInv.value.copy(_dmM);}
  // markings and bullet holes go with the wing when it is torn away
  const D=g.userData.dmgDim;for(const c of g.children)if(c.userData.decal||c.userData.hole||c.userData.kind){const x=c.position.x*sc;c.visible=!(Math.abs(x)>Math.max(D.R,D.S*.3)&&dm[x>0?0:1]>=1);}
}
function skinMat(c){return track(skinShader(new THREE.MeshStandardMaterial({color:c,roughness:.55,metalness:.18,side:THREE.DoubleSide})),.9);}
function glassMat(t){return track(faceViewer(new THREE.MeshStandardMaterial({color:t.gold?0x8a7a3e:0x16222b,roughness:.04,metalness:.9,side:THREE.DoubleSide})),1.6);}
function buildPlane(type,team,isPlayer,lv){
  lv=lv||LIVERIES[team?'vks':myLiv];
  const tf=TYPES[type];
  if(tf&&tf.model){ensureModel(tf.model);if(MODELS[type])return realPlane(type,team,lv);}
  const t=TYPES[type],g=new THREE.Group(),L=t.len,r=t.r,big=!!t.cls,U=g.userData,fw=t.flat||1;
  const tc=new THREE.Color(isPlayer?0xffd23f:TEAM[team].hex),DS=THREE.DoubleSide;
  const bc=new THREE.Color(lv.base);
  const body=skinMat(bc);
  const dk=skinMat(bc.clone().multiplyScalar(.74));
  const mark=skinMat(new THREE.Color(lv.camo[0]||lv.base).multiplyScalar(.85));
  const dark=new THREE.MeshStandardMaterial({color:0x1b2025,roughness:.7,metalness:.2,side:DS});
  const glass=glassMat(t);
  const add=(geo,mat,x,y,z,par)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);(par||g).add(m);return m;};
  const side=f=>{f(1);f(-1);};
  // fuselage
  const prof=big?[[-.5,.16],[-.43,.42],[-.26,.9],[-.1,1],[.36,1],[.44,.8],[.485,.45],[.5,0]]:[[-.5,.6],[-.44,.72],[-.3,.95],[-.05,1],[.14,.97],[.3,.7],[.42,.34],[.5,0]];
  if(t.flying){ // flying wing (B-2)
    const S=t.span,pts=[[0,L*.5],[S,-L*.1],[S*.86,-L*.32],[S*.58,-L*.16],[S*.36,-L*.42],[S*.16,-L*.22],[0,-L*.45]];
    const wingPts=pts.concat(pts.slice(1,-1).reverse().map(q=>[-q[0],q[1]]));
    add(slab(wingPts,.7),body,0,0,0);const hump=add(SPH,body,0,.5,L*.1);hump.scale.set(r*1.4,.9,L*.38);
    add(new THREE.BoxGeometry(1.4,.25,.6),dark,0,.85,L*.36);
    U.legs=[];U.flaps=[];
    const legs=[],ll=1.9;U.legs=legs;
    for(const q of[[0,L*.3],[3.4,-L*.05],[-3.4,-L*.05]]){const pv=new THREE.Group();pv.position.set(q[0],-.35,q[1]);pv.userData.leg=1;g.add(pv);legs.push(pv);add(new THREE.BoxGeometry(.3,ll,.3),dark,0,-ll/2,0,pv);add(new THREE.CylinderGeometry(.55,.55,.4,10).rotateZ(Math.PI/2),dark,0,-ll,0,pv);}
    if(!SPOTS[type])SPOTS[type]=computeSpots(g);addDecals(g,SPOTS[type],lv);
    g.scale.setScalar(1.3);g.rotation.order='YXZ';return g;
  }
  const fus=add(lathe(prof.map(q=>[q[0]*L,q[1]*r])),body,0,0,0);fus.scale.set(fw,fw>1?.84:1,1);
  if(t.heli){ // tandem-rotor helicopter
    fus.scale.set(1,1.15,1);U.rotors=[];
    for(const q of t.rotors){
      add(new THREE.CylinderGeometry(.5,.8,1.4,8),dk,0,r*1.15+q[1]*.35,q[0]);
      const rg=new THREE.Group();rg.position.set(0,r*1.15+q[1]*.5+.7,q[0]);g.add(rg);U.rotors.push(rg);
      for(let i=0;i<3;i++){const bl=add(new THREE.BoxGeometry(.5,.08,t.rotorR*2),dark,0,0,0,rg);bl.rotation.y=i*Math.PI/3;}
      add(new THREE.CircleGeometry(t.rotorR,24).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x222222,transparent:true,opacity:.12,side:DS,depthWrite:false}),0,0,0,rg);
    }
    add(new THREE.BoxGeometry(r*1.6,r*.5,r*.9),dark,0,r*.35,L*.43);
    const legs=[];U.legs=legs;U.flaps=[];
    for(const q of[[1.4,L*.3],[-1.4,L*.3],[1.4,-L*.25],[-1.4,-L*.25]]){const pv=new THREE.Group();pv.position.set(q[0],-r*.8,q[1]);pv.userData.leg=1;g.add(pv);legs.push(pv);add(new THREE.CylinderGeometry(.55,.55,.4,10).rotateZ(Math.PI/2),dark,0,-.6,0,pv);}
    if(!SPOTS[type])SPOTS[type]=computeSpots(g);addDecals(g,SPOTS[type],lv);
    g.scale.setScalar(1.3);g.rotation.order='YXZ';return g;
  }
  if(big){
    add(new THREE.BoxGeometry(r*1.5,r*.34,r*.9),dark,0,r*.5,L*.425);                         // flight-deck windows
    if(t.liner)add(new THREE.BoxGeometry(r*2.03,.24,L*.56),dark,0,r*.28,L*.03);              // cabin windows
  }else{
    const rad=add(new THREE.ConeGeometry(r*.36,L*.085,14).rotateX(Math.PI/2),dk,0,0,L*.459);rad.scale.set(fw*1.03,1.03,1); // radome
    const c=add(SPH,glass,0,r*.6,L*.2);c.scale.set(r*.56,r*.66,L*.135);                      // canopy
    U.glow=[];
    for(const ex of(t.eng===2?[-.5*r*fw,.5*r*fw]:[0])){
      add(new THREE.CylinderGeometry(r*.5,r*.4,L*.07,12,1,true).rotateX(Math.PI/2),dark,ex,0,-L*.52);
      U.glow.push(add(new THREE.CircleGeometry(r*.34,12),new THREE.MeshBasicMaterial({color:0xffa040,side:DS}),ex,0,-L*.545));
    }
    if(t.intake==='side')side(s=>{add(new THREE.BoxGeometry(r*.75,r*.85,L*.24),body,s*r*fw*.92,-r*.22,L*.08);add(new THREE.BoxGeometry(r*.6,r*.7,.08),dark,s*r*fw*.92,-r*.22,L*.2+.03);});
    else{add(new THREE.BoxGeometry(r*1.25,r*.55,L*.22),body,0,-r*.86,L*.1);add(new THREE.BoxGeometry(r*1.05,r*.42,.08),dark,0,-r*.86,L*.21+.03);}
  }
  // propellers, top engines, pushers
  U.props=[];
  const prop=(x,y,z,R)=>{const pg=new THREE.Group();pg.position.set(x,y,z);g.add(pg);U.props.push(pg);
    for(let i=0;i<4;i++){const bl=add(new THREE.BoxGeometry(.18,R*2,.06),dark,0,0,0,pg);bl.rotation.z=i*Math.PI/4;}
    add(new THREE.CircleGeometry(R,20),new THREE.MeshBasicMaterial({color:0x111111,transparent:true,opacity:.15,side:DS,depthWrite:false}),0,0,0,pg);
    add(new THREE.ConeGeometry(R*.18,R*.5,10).rotateX(Math.PI/2),dk,0,0,R*.2,pg);};
  if(t.nose)prop(0,0,L*.5+.2,1.25);
  if(t.pusher)prop(0,.2,-L*.5-.2,1.3);
  if(t.engTop){const n=add(cylZ(.7,.5,4.5),body,0,r*1.05,-L*.28);n.scale.y=.8;}
  if(t.podsTop)side(s=>{add(cylZ(.75,.7,3.8),dk,s*1.6,r*.95,-L*.2);add(new THREE.CircleGeometry(.62,12),dark,s*1.6,r*.95,-L*.2+1.92);});
  if(t.rearPods)side(s=>add(cylZ(.6,.5,4.2),dk,s*(r+.7),r*.3,-L*.22));
  if(t.cheeks)side(s=>add(new THREE.BoxGeometry(.5,r*.8,L*.12),dk,s*r*.95,0,L*.33));
  // wings
  const wy=t.high?r*.82:t.wy||0,th=big?.5:.2;let w=t.wing;
  if(t.swing){ // B-1: wings pivot, swept back as speed builds
    U.swing=[];
    side(s=>{
      add(slab([[s*r,10],[s*5.2,2.5],[s*5.2,-7],[s*r,-9]],.6),dk,0,wy,0);
      const pv=new THREE.Group();pv.position.set(s*4.2,wy+.1,1);g.add(pv);U.swing.push([pv,s]);
      add(slab([[0,2.3],[s*17.5,.4],[s*17.5,-1.4],[0,-2.6]],.34),body,0,0,0,pv);
      add(slab([[s*15.5,.7],[s*17.5,.4],[s*17.5,-1.4],[s*15.5,-1.6]],.38),mark,0,0,0,pv);
    });
    w=[2.5,-7,2.5,-7,5.2];
  }else side(s=>{
    add(slab([[s*r*.5,w[0]],[s*w[4],w[2]],[s*w[4],w[3]],[s*r*.5,w[1]]],th),body,0,wy,0);
    const k=.86;add(slab([[s*w[4]*k,w[0]+(w[2]-w[0])*k],[s*w[4],w[2]],[s*w[4],w[3]],[s*w[4]*k,w[1]+(w[3]-w[1])*k]],th+.04),mark,0,wy,0);
    if(t.lerx)add(slab([[s*r*.5,w[0]+t.lerx],[s*(r*.5+1.25),w[0]-.2],[s*r*.5,w[0]-.2]],.14),body,0,wy,0);
  });
  if(t.props)for(const q of t.props)if(q[0])side(s=>{add(cylZ(.8,.6,5),dk,s*q[0],wy-.3,q[1]+.4);prop(s*q[0],wy-.3,q[1]+3.1,q[0]>8?2.1:2.4);});
  // flaps hinge down from the inner trailing edge
  U.flaps=[];
  if(!t.swing)side(s=>{
    const ch=big?2.4:.9,fx0=r*.5+(w[4]-r*.5)*.08,fx1=r*.5+(w[4]-r*.5)*.5,zte=w[1]+(w[3]-w[1])*.3;
    const pv=new THREE.Group();pv.position.set(s*(fx0+fx1)/2,wy-.04,zte+ch);g.add(pv);U.flaps.push(pv);
    add(new THREE.BoxGeometry(fx1-fx0,th*.8,ch),dk,0,0,-ch/2,pv);
  });
  // tailplanes move with the stick
  if(t.tail){
    const a=t.tail,zc=(a[0]+a[1])/2,tg=new THREE.Group();tg.position.set(0,t.tTail?r*.4+t.finH*.96:t.tailY||0,zc);g.add(tg);U.tail=tg;
    side(s=>add(slab([[s*r*.3,a[0]-zc],[s*a[4],a[2]-zc],[s*a[4],a[3]-zc],[s*r*.3,a[1]-zc]],big?.3:.14),body,0,0,0,tg));
  }
  if(t.canard){
    const cg=new THREE.Group();cg.position.set(0,.3,L*.19);g.add(cg);U.canard=cg;
    side(s=>add(slab([[s*r*.6,.9],[s*2.8,-.6],[s*2.8,-1.3],[s*r*.6,-.9]],.12),body,0,0,0,cg));
  }
  // fins, team colour on the tip
  const h=t.finH,zb=-L/2+L*.07,ch=h*1.15,y0=r*.4,k=.68;
  const lo=flat([[0,y0,zb+ch],[0,y0,zb],[0,y0+h*k,zb-h*.12*k],[0,y0+h*k,zb+ch-(ch*.65)*k]]);
  const hi=flat([[0,y0+h*k,zb+ch-(ch*.65)*k],[0,y0+h*k,zb-h*.12*k],[0,y0+h,zb-h*.12],[0,y0+h,zb+ch*.35]]);
  if(t.vtail)side(s=>{const fg=new THREE.Group();fg.rotation.z=-s*.75;g.add(fg);add(flat([[0,0,-L*.32],[0,0,-L*.5],[0,2.6,-L*.55],[0,2.6,-L*.42]]),body,0,0,0,fg);});
  else if(t.twinTail&&t.tail)side(s=>{add(lo,body,s*t.tail[4],-r*.4,0);add(hi,mark,s*t.tail[4],-r*.4,0);});
  else if(t.fins===1){add(lo,body,0,0,0);add(hi,mark,0,0,0);}
  else if(!t.fins){}
  else side(s=>{const fg=new THREE.Group();fg.position.set(s*r*fw*.7,0,0);fg.rotation.z=-s*(t.cant||.38);g.add(fg);add(lo,body,0,0,0,fg);add(hi,mark,0,0,0,fg);});
  // podded engines
  if(t.pods&&!t.props)for(const p of t.pods)side(s=>{
    const n=add(cylZ(1.05,.95,t.swing?9:5.4),dk,s*p[0],wy-(t.swing?1.5:2),p[1]);if(t.twin)n.scale.x=t.swing?1.5:1.9;
    add(new THREE.CircleGeometry(.8,12),dark,s*p[0],wy-(t.swing?1.5:2),p[1]+(t.swing?4.52:2.72)).scale.x=t.twin?(t.swing?1.5:1.9):1;
    if(!t.swing)add(new THREE.BoxGeometry(.3,1.5,3.4),body,s*p[0],wy-.9,p[1]-.6);
  });
  if(t.radar){add(new THREE.BoxGeometry(1,1.5,10.5),dk,0,r+2.7,-3);add(new THREE.BoxGeometry(.5,2,4),body,0,r+1,-3);}
  // landing gear: each leg hangs from a pivot so it can swing back into the belly
  const legs=[],ll=r*.5+1.5;U.legs=legs;
  for(const q of[[0,L*.27],[1.7,-L*.07],[-1.7,-L*.07]]){
    const pv=new THREE.Group();pv.position.set(q[0],-r*.5,q[1]);pv.userData.leg=1;g.add(pv);legs.push(pv);
    add(new THREE.CylinderGeometry(.11,.12,ll*.6,10),GEAR_METAL,0,-ll*.3,0,pv);
    add(new THREE.CylinderGeometry(.075,.075,ll*.45,10),GEAR_METAL,0,-ll*.72,0,pv);
    add(new THREE.BoxGeometry(.04,ll*.3,.06),GEAR_METAL,0,-ll*.66,.14,pv).rotation.x=.4;
    const wh=new THREE.Group();wh.position.set(0,-ll+.05,0);pv.add(wh);wh.userData.wheel=.45;(U.wheels=U.wheels||[]).push(wh);
    const ty=new THREE.Mesh(new THREE.TorusGeometry(.33,.13,10,22).rotateY(Math.PI/2),GEAR_RUBBER);ty.scale.x=.9;wh.add(ty);
    wh.add(new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.22,14).rotateZ(Math.PI/2),GEAR_METAL));
    add(new THREE.BoxGeometry(.03,ll*.55,.8),body,q[0]?(q[0]>0?.22:-.22):.3,-ll*.35,0,pv);
  }
  if(!SPOTS[type])SPOTS[type]=computeSpots(g);
  addDecals(g,SPOTS[type],lv);
  if(U.glow&&AB_TYPES.has(type))U.flames=U.glow.map(q=>{const f=makeFlame(r*.34);f.position.copy(q.position);f.position.z-=.05;g.add(f);return f;});
  if(!t.heli&&!t.drone||t.drone){const bb=new THREE.Box3().setFromObject(g),cz=(bb.min.z+bb.max.z)/2;
    addLights(g,{L:new THREE.Vector3(bb.max.x,0,cz-L*.1),R:new THREE.Vector3(bb.min.x,0,cz-L*.1),nose:new THREE.Vector3(0,0,bb.max.z),top:new THREE.Vector3(0,bb.max.y,-L*.4),bot:new THREE.Vector3(0,bb.min.y+ll*.9,0)},t,1/(big?1.3:1.7));}
  g.scale.setScalar(big?1.3:1.7);g.rotation.order='YXZ';
  return g;
}
/* ---------- real aircraft models (FlightGear, GPL) ---------- */
const MODELS={},MODEL_REQ={};let modelsLoaded=0;
const MODEL_FILES=new Set(window.CF_MODEL_LIST||[]);
function ensureModel(file){ // load a FlightGear model the first time an aircraft that uses it appears
  if(!file||MODEL_REQ[file]||!THREE.GLTFLoader)return;
  MODEL_REQ[file]=1;
  const L=new THREE.GLTFLoader(),parts={};let left=4;
  const users=Object.keys(TYPES).filter(k=>TYPES[k].model===file);
  const doneOne=()=>{if(--left)return;if(!parts.body)return;for(const k of users)makeTemplate(k,parts);};
  for(const part of['body','gear','glass','prop']){
    const b64=(window.CF_MODELS||{})[file+'.'+part];
    if(b64){
      const bin=atob(b64),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
      try{L.parse(buf.buffer,'',gl=>{parts[part]=gl.scene;doneOne();},()=>doneOne());}catch(e){doneOne();}
    }else if(MODEL_FILES.has(file+'.'+part))L.load('models/'+file+'.'+part+'.glb',gl=>{parts[part]=gl.scene;doneOne();},undefined,()=>doneOne());
    else doneOne();
  }
}
function loadModels(){for(const k in TYPES)if(TYPES[k].model&&(k===myType))ensureModel(TYPES[k].model);}
function floatColours(g){
  let c=g.attributes.color;
  if(c&&(c.array instanceof Uint8Array||c.array instanceof Uint16Array)){ // normalised ints -> floats
    const n=c.array instanceof Uint8Array?255:65535,f=new Float32Array(c.count*3);
    for(let k=0;k<c.count;k++)for(let j=0;j<3;j++)f[k*3+j]=c.array[k*c.itemSize+j]/n;
    c=new THREE.BufferAttribute(f,3);g.setAttribute('color',c);
  }
  return c;
}
function paintModel(w,lv,t){ // skin vertices (marked magenta) take the livery colours
  const col=new THREE.Color();
  w.traverse(o=>{
    if(!o.isMesh)return;
    let glass=false;for(let q=o;q;q=q.parent)if(q.name==='glass')glass=true;
    if(glass){o.material=glassMat(t);return;}
    if(o.userData.propPart||o.userData.isDisc)return;
    for(let q=o;q;q=q.parent)if(q.userData.engine)return;
    if(o.userData.gearPart){const g=o.geometry=o.geometry.clone(),c=g.attributes.color,pos=g.attributes.position;
      for(let k=0;k<c.count;k++)if(c.getX(k)>.99&&c.getY(k)<.01&&c.getZ(k)>.99){camoColour(lv,pos.getX(k),pos.getY(k),pos.getZ(k),col);c.setXYZ(k,col.r,col.g,col.b);}
      const doors=track(skinShader(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,metalness:.18,side:THREE.DoubleSide})),.9);
      o.material=[doors,GEAR_RUBBER,GEAR_METAL];return;}
    const g=o.geometry=o.geometry.clone(),c=floatColours(g),pos=g.attributes.position;
    if(c)for(let k=0;k<c.count;k++)if(c.getX(k)>.99&&c.getY(k)<.01&&c.getZ(k)>.99){
      camoColour(lv,pos.getX(k),pos.getY(k),pos.getZ(k),col);c.setXYZ(k,col.r,col.g,col.b);
    }
    if(!g.attributes.normal)g.computeVertexNormals();
    o.material=track(skinShader(new THREE.MeshStandardMaterial({vertexColors:!!c,color:c?0xffffff:lv.base,roughness:.55,metalness:.18,side:THREE.DoubleSide})),.9);
  });
}

/* ---------- landing gear rig: split the model's gear into legs that swing into the wells and wheels that roll ---------- */
const GEAR_RUBBER=faceViewer(new THREE.MeshStandardMaterial({color:0x141414,roughness:.93,metalness:0,side:THREE.DoubleSide}));
const GEAR_METAL=track(faceViewer(new THREE.MeshStandardMaterial({color:0xc4c8cc,roughness:.3,metalness:.88,side:THREE.DoubleSide})),1.2);
const GEAR_WELL=faceViewer(new THREE.MeshStandardMaterial({color:0x2a2e31,roughness:.9,metalness:.1,side:THREE.DoubleSide}));
function triClass(r,g,b){ // 0 paint, 1 rubber, 2 metal
  if(r>.99&&g<.01&&b>.99)return 0;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
  if(mx<.1)return 1;
  if(mx-mn<.04&&mn>.5&&mx<.9)return 2;
  return 0;
}
function rigGear(inner,heavy){
  const go=inner.getObjectByName('gear');if(!go)return;
  inner.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(inner.matrixWorld).invert(),V=[],N=[],C=[];   // per-triangle-corner arrays in inner space
  const v=new THREE.Vector3(),n=new THREE.Vector3(),nm=new THREE.Matrix3();
  go.traverse(o=>{if(!o.isMesh)return;
    const g=o.geometry.clone(),col=floatColours(g),pos=g.attributes.position,nor=g.attributes.normal,idx=g.index,m=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld);nm.getNormalMatrix(m);
    const cnt=idx?idx.count:pos.count;
    for(let i=0;i<cnt;i++){const k=idx?idx.getX(i):i;v.fromBufferAttribute(pos,k).applyMatrix4(m);V.push(v.x,v.y,v.z);
      if(nor){n.fromBufferAttribute(nor,k).applyMatrix3(nm).normalize();N.push(n.x,n.y,n.z);}else N.push(0,1,0);
      if(col)C.push(col.getX(k),col.getY(k),col.getZ(k));else C.push(1,0,1);}
  });
  const T=V.length/9;if(!T)return;
  // connected components of triangles that share vertex positions
  const par=new Int32Array(T).map((_,i)=>i),find=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i];}return i;},uni=(a,b)=>{a=find(a);b=find(b);if(a!==b)par[a]=b;};
  const key=new Map();
  for(let t=0;t<T;t++)for(let c=0;c<3;c++){const o=(t*3+c)*3,k=Math.round(V[o]*500)+','+Math.round(V[o+1]*500)+','+Math.round(V[o+2]*500),q=key.get(k);if(q===undefined)key.set(k,t);else uni(t,q);}
  const comps=new Map();for(let t=0;t<T;t++){const r=find(t);if(!comps.has(r))comps.set(r,[]);comps.get(r).push(t);}
  const info=[...comps.values()].map(tris=>{
    const b=new THREE.Box3(),cen=new THREE.Vector3();let rub=0,cnt=0;
    for(const t of tris){for(let c=0;c<3;c++){const o=(t*3+c)*3;v.set(V[o],V[o+1],V[o+2]);b.expandByPoint(v);cen.add(v);cnt++;}if(triClass(C[t*9],C[t*9+1],C[t*9+2])===1)rub++;}
    cen.divideScalar(cnt);const s=b.getSize(new THREE.Vector3());
    // a wheel: roughly round in side view, narrow across, mostly rubber or disc shaped
    const disc=s.x<Math.min(s.y,s.z)*.85&&Math.abs(s.y-s.z)<Math.max(s.y,s.z)*.3&&s.y>.15&&s.y<2.5;
    const fr=rub/tris.length,round=Math.abs(s.y-s.z)<Math.max(s.y,s.z)*.35&&s.y>.12&&s.y<2.6&&s.x<s.y*1.3;
    return{tris,b,cen,s,rub:fr,wheel:(disc&&(fr>.3||tris.length>24))||(fr>.45&&round)};
  });
  // group components into legs by overlap in plan view
  const lp=info.map((_,i)=>i),lf=i=>{while(lp[i]!==i)i=lp[i]=lp[lp[i]];return i;};
  for(let i=0;i<info.length;i++)for(let j=i+1;j<info.length;j++){const A=info[i].b,B=info[j].b,e=.18;
    if(A.min.x-e<B.max.x&&B.min.x-e<A.max.x&&A.min.z-e<B.max.z&&B.min.z-e<A.max.z&&A.min.y-e<B.max.y&&B.min.y-e<A.max.y)lp[lf(i)]=lf(j);}
  const legs=new Map();info.forEach((c,i)=>{const r=lf(i);if(!legs.has(r))legs.set(r,[]);legs.get(r).push(c);});
  const build=(tris,ox,oy,oz)=>{ // geometry with triangles sorted into paint / rubber / metal groups
    const by=[[],[],[]];for(const t of tris)by[triClass(C[t*9],C[t*9+1],C[t*9+2])].push(t);
    const P=[],Nn=[],Cc=[],geo=new THREE.BufferGeometry();let start=0;
    by.forEach((list,mi)=>{for(const t of list)for(let c=0;c<3;c++){const o=(t*3+c)*3;P.push(V[o]-ox,V[o+1]-oy,V[o+2]-oz);Nn.push(N[o],N[o+1],N[o+2]);Cc.push(C[o],C[o+1],C[o+2]);}
      if(list.length){geo.addGroup(start*3,list.length*3,mi);start+=list.length;}});
    geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(Nn,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(Cc,3));
    const m=new THREE.Mesh(geo,[GEAR_WELL,GEAR_RUBBER,GEAR_METAL]);m.userData.gearPart=1;return m;
  };
  const node=new THREE.Group();node.name='gear';
  for(const list of legs.values()){
    const lb=new THREE.Box3();for(const c of list)lb.union(c.b);
    const cx=(lb.min.x+lb.max.x)/2,cz=(lb.min.z+lb.max.z)/2,top=lb.max.y,h=lb.max.y-lb.min.y;
    const leg=new THREE.Group();leg.position.set(cx,top,cz);node.add(leg);
    const centre=Math.abs(cx)<.45,axis=centre?'x':'z',sign=centre?(cz>0?-1:1):(cx>0?-1:1);
    leg.userData.leg={axis,sign,h,y0:top};
    // tyres: clusters of rubber triangles; hub triangles inside a tyre's ring roll with it
    const all=[];for(const c of list)all.push(...c.tris);
    const rub=all.filter(t=>triClass(C[t*9],C[t*9+1],C[t*9+2])===1),rp=new Map(),rk=new Map();
    const rf=t=>{while(rp.get(t)!==t){rp.set(t,rp.get(rp.get(t)));t=rp.get(t);}return t;};
    for(const t of rub){rp.set(t,t);}
    for(const t of rub)for(let c=0;c<3;c++){const o=(t*3+c)*3,k=Math.round(V[o]*200)+','+Math.round(V[o+1]*200)+','+Math.round(V[o+2]*200),q=rk.get(k);if(q===undefined)rk.set(k,t);else{const A=rf(t),B=rf(q);if(A!==B)rp.set(A,B);}}
    const tyres=new Map();for(const t of rub){const r=rf(t);if(!tyres.has(r))tyres.set(r,[]);tyres.get(r).push(t);}
    const wheels=[];
    for(const tl of tyres.values()){if(tl.length<10)continue;const b=new THREE.Box3();for(const t of tl)for(let c=0;c<3;c++){const o=(t*3+c)*3;b.expandByPoint(v.set(V[o],V[o+1],V[o+2]));}
      const sz=b.getSize(new THREE.Vector3());if(sz.y<.1||sz.y>3)continue;const ax='z';   // axles run across the aircraft
      if(Math.abs(sz.x-sz.y)>Math.max(sz.x,sz.y)*.3||sz.z>Math.max(sz.x,sz.y)*.95)continue;   // only round, tyre-shaped rubber rolls (not black bay panels or doors)
      wheels.push({b,c:b.getCenter(new THREE.Vector3()),ax,R:(ax==='z'?Math.max(sz.x,sz.y):Math.max(sz.y,sz.z))/2,w:ax==='z'?sz.z:sz.x,tris:[]});}
    const rest=[];
    for(const t of all){
      let mx=0,my=0,mz=0;for(let c=0;c<3;c++){const o=(t*3+c)*3;mx+=V[o]/3;my+=V[o+1]/3;mz+=V[o+2]/3;}
      const cls=triClass(C[t*9],C[t*9+1],C[t*9+2]),leg=C[t*9]>.72&&C[t*9]<.9&&Math.abs(C[t*9]-C[t*9+2])<.03;   // light-grey leg metal never rolls
      const inside=(W,o)=>{const x=V[o],y=V[o+1],z=V[o+2],ad=W.ax==='z'?Math.abs(z-W.c.z):Math.abs(x-W.c.x),rd=W.ax==='z'?Math.hypot(x-W.c.x,y-W.c.y):Math.hypot(y-W.c.y,z-W.c.z);return ad<W.w*.6&&rd<W.R*(cls===1?1.12:.8);};
      const w=leg?null:wheels.find(W=>inside(W,t*9)&&inside(W,t*9+3)&&inside(W,t*9+6));   // every corner inside the tyre, so struts through the axle stay put
      if(w)w.tris.push(t);else rest.push(t);
    }
    for(const W of wheels){if(!W.tris.length)continue;const g=new THREE.Group();g.position.set(W.c.x-cx,W.c.y-top,W.c.z-cz);g.userData.wheel=Math.max(.1,W.R);g.userData.axis=W.ax;leg.add(g);g.add(build(W.tris,W.c.x,W.c.y,W.c.z));}
    if(rest.length)leg.add(build(rest,cx,top,cz));
  }
  go.parent.add(node);go.parent.remove(go);node.position.copy(go.position);
}

/* ---------- propellers and rotors from the model, split into separate spinning hubs ---------- */
function rigProps(inner,t){
  const po=inner.getObjectByName('prop');if(!po)return;
  inner.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(inner.matrixWorld).invert(),V=[],N=[],C=[],v=new THREE.Vector3(),n=new THREE.Vector3(),nm=new THREE.Matrix3();
  po.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone(),col=floatColours(g),pos=g.attributes.position,nor=g.attributes.normal,idx=g.index,m=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld);nm.getNormalMatrix(m);
    const cnt=idx?idx.count:pos.count;for(let i=0;i<cnt;i++){const k=idx?idx.getX(i):i;v.fromBufferAttribute(pos,k).applyMatrix4(m);V.push(v.x,v.y,v.z);
      if(nor){n.fromBufferAttribute(nor,k).applyMatrix3(nm).normalize();N.push(n.x,n.y,n.z);}else N.push(0,1,0);C.push(col?col.getX(k):.15,col?col.getY(k):.15,col?col.getZ(k):.16);}});
  const T=V.length/9;if(!T)return;
  // cluster triangles into hubs: helicopters by fore/aft position, aeroplanes by left/right position
  const heli=!!t.heli,key=i=>{let s=0;for(let c=0;c<3;c++)s+=heli?V[(i*3+c)*3]:V[(i*3+c)*3+2];return s/3;};  // inner frame: x runs along the fuselage, z along the span
  // 1-D k-means: one cluster per engine along the span (or front/rear rotor along the fuselage)
  const vals=[...Array(T).keys()].map(key),K=heli?2:Math.max(1,t.thrN||t.eng||1);
  let lo=Infinity,hi=-Infinity;for(const q of vals){lo=Math.min(lo,q);hi=Math.max(hi,q);}
  let cen=[...Array(K).keys()].map(i=>K>1?lo+(hi-lo)*(i+.5)/K:(lo+hi)/2),lab=new Int32Array(T);
  for(let it=0;it<12;it++){const s=new Float64Array(K),c=new Float64Array(K);
    for(let i=0;i<T;i++){let b=0;for(let k=1;k<K;k++)if(Math.abs(vals[i]-cen[k])<Math.abs(vals[i]-cen[b]))b=k;lab[i]=b;s[b]+=vals[i];c[b]++;}
    cen=cen.map((v,k)=>c[k]?s[k]/c[k]:v);}
  const clusters=[...Array(K)].map(()=>[]);for(let i=0;i<T;i++)clusters[lab[i]].push(i);
  const node=new THREE.Group();node.name='prop';
  for(const cl of clusters){
    if(!cl.length)continue;
    const b=new THREE.Box3();for(const t2 of cl)for(let c=0;c<3;c++){const o=(t2*3+c)*3;b.expandByPoint(v.set(V[o],V[o+1],V[o+2]));}
    const ctr=b.getCenter(new THREE.Vector3());if(heli){/* rotor mast: centre in plan view */}
    const P=[],Nn=[],Cc=[];for(const t2 of cl)for(let c=0;c<3;c++){const o=(t2*3+c)*3;P.push(V[o]-ctr.x,V[o+1]-ctr.y,V[o+2]-ctr.z);Nn.push(N[o],N[o+1],N[o+2]);Cc.push(C[o],C[o+1],C[o+2]);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(Nn,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(Cc,3));
    const hub=new THREE.Group();hub.position.copy(ctr);hub.userData.prop={axis:heli?'y':'x',dir:heli?(ctr.x<0?-1:1):(ctr.z>=0?1:-1)};
    const m=new THREE.Mesh(geo,faceViewer(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6,metalness:.3,side:THREE.DoubleSide})));m.userData.propPart=1;hub.add(m);
    // a faint disc that shows at speed, like the blur you see on a real propeller
    const sz=b.getSize(new THREE.Vector3()),R=heli?Math.max(sz.x,sz.z)/2:Math.max(sz.y,sz.z)/2;
    const disc=new THREE.Mesh(new THREE.CircleGeometry(R,40),new THREE.MeshBasicMaterial({color:0x222222,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
    if(heli)disc.rotation.x=-Math.PI/2;else disc.rotation.y=Math.PI/2;disc.userData.isDisc=1;hub.add(disc);node.add(hub);
  }
  po.parent.add(node);po.parent.remove(po);
}
function makeTemplate(type,parts){
  const t=TYPES[type],inner=new THREE.Group();inner.rotation.y=Math.PI/2; // FlightGear: nose toward -x
  for(const k of['body','gear','glass','prop'])if(parts[k]){const o=parts[k].clone(true);o.name=k;inner.add(o);}
  const wrap=new THREE.Group();wrap.add(inner);wrap.updateMatrixWorld(true);
  // centre: middle of the body's length and span, fuselage axis from the nose section
  const box=new THREE.Box3().setFromObject(inner.getObjectByName('body'));
  const len=box.max.z-box.min.z,v=new THREE.Vector3();let sy=0,n=0;
  inner.getObjectByName('body').traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;o.updateMatrixWorld(true);
    for(let i=0;i<a.count;i+=3){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);if(v.z>box.max.z-len*.12){sy+=v.y;n++;}}});
  const cy=n?sy/n:(box.min.y+box.max.y)/2;
  inner.position.set(-(box.min.x+box.max.x)/2,-cy,-(box.min.z+box.max.z)/2);
  wrap.updateMatrixWorld(true);
  try{rigGear(inner,!!t.cls);}catch(e){console.warn('gear rig',e);}
  try{rigProps(inner,t);}catch(e){console.warn('prop rig',e);}
  wrap.updateMatrixWorld(true);
  const gb=inner.getObjectByName('gear')?new THREE.Box3().setFromObject(inner.getObjectByName('gear')):null;
  const sc=t.cls?1.3:1.7,bodyMin=box.min.y-cy;
  const lt={L:null,R:null,top:null,bot:null};{const bo=inner.getObjectByName('body');let mxx=-1e9,mnx=1e9,mxy=-1e9,mny=1e9;
    bo.traverse(o=>{if(!o.isMesh)return;const a2=o.geometry.attributes.position;for(let i=0;i<a2.count;i+=2){v.fromBufferAttribute(a2,i).applyMatrix4(o.matrixWorld);
      if(v.x>mxx){mxx=v.x;lt.L=v.clone();}if(v.x<mnx){mnx=v.x;lt.R=v.clone();}if(v.y>mxy){mxy=v.y;lt.top=v.clone();}if(v.y<mny&&Math.abs(v.x)<.6){mny=v.y;lt.bot=v.clone();}if(!lt.nose||v.z>lt.nose.z)lt.nose=v.clone();}});}
  const eng=ENG_HINTS[t.model]?probeEngines(wrap,inner,t,ENG_HINTS[t.model]):null,noz=eng?eng.noz:AB_TYPES.has(type)?findNozzles(inner,t):[];
  MODELS[type]={noz,lights:lt,wrap,sc,gearH:(gb&&!gb.isEmpty()?-gb.min.y:-bodyMin+1.6)*sc,spots:computeSpots(wrap),cache:{},legs:gb&&!gb.isEmpty()?null:{y0:bodyMin+.3,y1:bodyMin-1.6,len}};
  modelsLoaded++;
  for(const p of planes)if(p.type===type)swapMesh(p);
  show.key='';
}
function realPlane(type,team,lv){
  const M=MODELS[type],t=TYPES[type],g=new THREE.Group(),U=g.userData;
  if(!M.cache[lv.id]){const w=M.wrap.clone(true);paintModel(w,lv,t);M.cache[lv.id]=w;}
  const m=M.cache[lv.id].clone(true);g.add(m);
  U.legs=[];U.flaps=[];U.gearNode=m.getObjectByName('gear');U.rig=[];U.wheels=[];
  if(U.gearNode)U.gearNode.traverse(o=>{if(o.userData.leg)U.rig.push(o);if(o.userData.wheel)U.wheels.push(o);});
  U.hubs=[];const pn=m.getObjectByName('prop');if(pn)pn.traverse(o=>{if(o.userData.prop)U.hubs.push(o);});
  addLights(g,M.lights,t,1/M.sc);
  U.flames=(M.noz||[]).map(n=>{const f=makeFlame(n.r);f.position.set(n.x,n.y,n.z);g.add(f);return f;});
  U.engGlow=[];U.fans=[];const eg=m.getObjectByName('engines');
  if(eg)eg.traverse(o=>{if(o.userData.engGlow){o.material=o.material.clone();U.engGlow.push(o);}if(o.userData.fan)U.fans.push(o);});
  if(M.legs){ // detailed procedural gear for models that ship without one: oleo strut, torque links, rubber tyres, hubs
    const gn=new THREE.Group(),L=M.legs,h=L.y0-L.y1,big=!!t.cls;gn.name='gear';
    const wheelGeo=(R,w)=>{const s=new THREE.Group(),tyre=new THREE.Mesh(new THREE.TorusGeometry(R*.72,R*.28,10,24).rotateY(Math.PI/2),GEAR_RUBBER);tyre.scale.x=w/(R*.56);s.add(tyre);
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(R*.5,R*.5,w*.8,16).rotateZ(Math.PI/2),GEAR_METAL);s.add(hub);
      for(let i=0;i<6;i++){const b=new THREE.Mesh(new THREE.CylinderGeometry(R*.05,R*.05,w*.86,6).rotateZ(Math.PI/2),GEAR_WELL);b.position.set(0,Math.cos(i/6*TAU)*R*.28,Math.sin(i/6*TAU)*R*.28);s.add(b);}return s;};
    const mkLeg=(x,z,R,pairs,axle)=>{
      const leg=new THREE.Group();leg.position.set(x,L.y0,z);gn.add(leg);const centre=Math.abs(x)<.45;
      leg.userData.leg={axis:centre?'x':'z',sign:centre?(z>0?-1:1):(x>0?-1:1),h,y0:L.y0};
      const strut=new THREE.Mesh(new THREE.CylinderGeometry(.09*R*2.2,.1*R*2.2,h*.6,12),GEAR_METAL);strut.position.y=-h*.3;leg.add(strut);
      const piston=new THREE.Mesh(new THREE.CylinderGeometry(.06*R*2.2,.06*R*2.2,h*.45,12),new THREE.MeshStandardMaterial({color:0xe8ecef,roughness:.12,metalness:1,envMap:ENV}));piston.position.y=-h*.72;leg.add(piston);
      const link=new THREE.Mesh(new THREE.BoxGeometry(.04,h*.3,.06),GEAR_METAL);link.position.set(0,-h*.65,.12*R*2);link.rotation.x=.4;leg.add(link);
      const brace=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,h*.8,8),GEAR_METAL);brace.position.set(0,-h*.35,-h*.25);brace.rotation.x=-.6;leg.add(brace);
      const ax=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,axle,8).rotateZ(Math.PI/2),GEAR_METAL);ax.position.y=-h+R;leg.add(ax);
      for(const s of pairs>1?[-1,1]:[0]){const w=wheelGeo(R,R*.7);w.position.set(s*axle*.45,-h+R,0);w.userData.wheel=R;leg.add(w);}
      const door=new THREE.Mesh(new THREE.BoxGeometry(.03,h*.55,R*2.2),GEAR_WELL);door.position.set(centre?R*.9:(x>0?.25:-.25),-h*.35,0);leg.add(door);
    };
    const R=big?.62:.36;
    mkLeg(0,L.len*.27,R*.8,big?2:1,big?.9:.5);
    if(big){for(const z of[-L.len*.04,-L.len*.11])for(const s of[-1,1])mkLeg(s*1.9,z,R,2,1.0);}
    else for(const s of[-1,1])mkLeg(s*1.5,-L.len*.07,R,1,.4);
    m.add(gn);U.gearNode=gn;U.rig=[];U.wheels=[];gn.traverse(o=>{if(o.userData.leg)U.rig.push(o);if(o.userData.wheel)U.wheels.push(o);});
  }
  const dk=skinMat(new THREE.Color(lv.base).multiplyScalar(.88));
  if(type==='e7'){ // E-7's MESA radar 'top hat' on the 737 airframe
    const r=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.6,10.8),dk);r.position.set(0,4.1,-2.5);g.add(r);
    const s=new THREE.Mesh(new THREE.BoxGeometry(.5,1.6,3.6),dk);s.position.set(0,2.6,-2.5);g.add(s);
  }
  if(type==='rc135')for(const s of[-1,1]){const c=new THREE.Mesh(new THREE.BoxGeometry(.5,1.4,4.5),dk);c.position.set(s*1.85,0,12);g.add(c);}
  if(t.heli&&!(U.hubs&&U.hubs.length)){U.rotors=[];for(const q of t.rotors){const rg=new THREE.Group();rg.position.set(0,2.4+q[1]*.5,q[0]);g.add(rg);U.rotors.push(rg);
    for(let i=0;i<3;i++){const bl=new THREE.Mesh(new THREE.BoxGeometry(.5,.08,t.rotorR*2),new THREE.MeshStandardMaterial({color:0x1b2025}));bl.rotation.y=i*Math.PI/3;rg.add(bl);}}}
  addDecals(g,M.spots,lv);
  g.scale.setScalar(M.sc);g.rotation.order='YXZ';
  return g;
}
function swapMesh(p){
  if(!MODELS[p.type])return;
  const e=MESHES.get(p.id);if(e){scene.remove(e.mesh);MESHES.delete(p.id);}
  const was=p.gearH;p.gearH=MODELS[p.type].gearH;if(p.ground)p.y+=p.gearH-was;
}

/* ---------- afterburners: layered flame cones with shock diamonds ---------- */
const AB_TYPES=new Set(Object.keys(TYPES).filter(k=>TYPES[k].cls===0&&!['a10','hawk','hawk127','pc21'].includes(k)).concat(['b1']));
const FLAME_V=`varying float vT;varying float vR;void main(){vT=uv.y;vR=uv.x;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const FLAME_F=`uniform vec3 cA;uniform vec3 cB;uniform float uI;uniform float uTime;uniform float uDia;varying float vT;varying float vR;
void main(){float t=1.-vT;float fade=pow(max(0.,1.-t),1.6);float edge=1.;
  float flick=.85+.15*sin(uTime*60.+t*20.);float dia=uDia*smoothstep(.55,1.,sin(t*34.-uTime*4.))*(1.-t*1.4);
  vec3 c=mix(cA,cB,t)*(fade*edge*flick+dia*1.6);gl_FragColor=vec4(c*uI,1.);}`;
function flameMat(cA,cB,dia){return new THREE.ShaderMaterial({uniforms:{cA:{value:new THREE.Color(cA)},cB:{value:new THREE.Color(cB)},uI:{value:0},uTime:{value:0},uDia:{value:dia}},
  vertexShader:FLAME_V,fragmentShader:FLAME_F,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false});}
function makeFlame(r){
  const g=new THREE.Group(),mk=(len,r0,r1,mat)=>{const geo=new THREE.CylinderGeometry(r0,r1,len,20,8,true);geo.translate(0,-len/2,0);geo.rotateX(Math.PI/2);const m=new THREE.Mesh(geo,mat);m.frustumCulled=false;g.add(m);return m;};
  const outer=mk(r*9,r*.95,r*.25,flameMat(0xff8a2a,0xff3a10,0)),core=mk(r*5,r*.7,r*.08,flameMat(0x9fc8ff,0xffffff,1));
  const disk=new THREE.Mesh(new THREE.CircleGeometry(r*.92,20),new THREE.MeshBasicMaterial({color:0xffb060,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));disk.position.z=.02;g.add(disk);
  g.userData.flame={outer,core,disk};g.visible=false;return g;
}
/* ---------- engine internals: real nozzle and intake openings found by probing each model, then fitted with
   a jet pipe, flame holders and turbine face at the back and a compressor fan at the front ---------- */
// rough [x,y,radius] of each nozzle and intake (model frame, mirrored left/right); the probe centres and checks them
const ENG_HINTS={
  f22:{r:[[.72,.05,.36]],f:[[1.25,-.15,.35]]}, f35:{r:[[0,-.35,.55]],f:[[1.2,-.55,.35]]}, f15c:{r:[[.72,-.1,.5]],f:[[1.15,.2,.4]]},
  f15e:{r:[[.48,0,.42]],f:[[1.05,.1,.4]]}, f16:{r:[[0,.15,.45]],f:[[0,-.55,.4]]}, ef:{r:[[.55,-.05,.34]],f:[[.35,-.6,.3]]},
  f18:{r:[[.62,0,.33]],f:[[.95,-.05,.35]]}, gripen:{r:[[0,.62,.45]],f:[[.62,.3,.3]]}, m2000:{r:[[0,.33,.5]],f:[[.72,.3,.32]]},
  su27:{r:[[1.25,-.1,.55]],f:[[1.25,-.6,.4]]}, su37:{r:[[1.15,-.15,.6]],f:[[1.05,-.35,.4]]}, su57:{r:[[1.3,.05,.4]],f:[[1.2,-.3,.4]]},
  mig29:{r:[[.95,-.25,.55]],f:[[.9,-.5,.4]]}, b1:{r:[[2.7,-1.5,.6],[4.05,-1.5,.6]],f:[[2.7,-1.4,.55],[4.05,-1.4,.55]]},
};
let ENG_TEX=null;
function engTextures(){
  if(ENG_TEX)return ENG_TEX;const mk=(f)=>{const c=document.createElement('canvas');c.width=c.height=256;f(c.getContext('2d'));const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;};
  const turb=mk(x=>{ // last turbine stage seen up the jet pipe: dark, sooty, with blades and a tail cone
    const g=x.createRadialGradient(128,128,10,128,128,128);g.addColorStop(0,'#3a3532');g.addColorStop(.6,'#1c1a19');g.addColorStop(1,'#0b0a0a');x.fillStyle=g;x.fillRect(0,0,256,256);
    x.strokeStyle='rgba(120,112,104,.55)';x.lineWidth=2.2;for(let i=0;i<46;i++){const a=i/46*Math.PI*2;x.beginPath();x.moveTo(128+Math.cos(a)*40,128+Math.sin(a)*40);x.quadraticCurveTo(128+Math.cos(a+.18)*85,128+Math.sin(a+.18)*85,128+Math.cos(a+.28)*124,128+Math.sin(a+.28)*124);x.stroke();}
    x.strokeStyle='rgba(160,150,140,.35)';x.lineWidth=3;[38,84,124].forEach(r=>{x.beginPath();x.arc(128,128,r,0,Math.PI*2);x.stroke();});
    const h=x.createRadialGradient(118,118,4,128,128,40);h.addColorStop(0,'#77706a');h.addColorStop(1,'#26221f');x.fillStyle=h;x.beginPath();x.arc(128,128,38,0,Math.PI*2);x.fill();});
  const fan=mk(x=>{ // compressor fan at the end of the intake duct: bright titanium blades round a spinner
    x.fillStyle='#15181b';x.fillRect(0,0,256,256);
    for(let i=0;i<28;i++){const a=i/28*Math.PI*2,b=a+.17;x.fillStyle=i%2?'#8d969e':'#a7b0b8';x.beginPath();x.moveTo(128+Math.cos(a)*34,128+Math.sin(a)*34);x.lineTo(128+Math.cos(a+.05)*126,128+Math.sin(a+.05)*126);x.lineTo(128+Math.cos(b+.1)*126,128+Math.sin(b+.1)*126);x.lineTo(128+Math.cos(b)*34,128+Math.sin(b)*34);x.fill();}
    x.strokeStyle='#22262a';x.lineWidth=5;x.beginPath();x.arc(128,128,125,0,Math.PI*2);x.stroke();
    const h=x.createRadialGradient(116,116,3,128,128,36);h.addColorStop(0,'#e3e7ea');h.addColorStop(.5,'#9aa2a8');h.addColorStop(1,'#3b4045');x.fillStyle=h;x.beginPath();x.arc(128,128,34,0,Math.PI*2);x.fill();
    x.strokeStyle='#2a2e32';x.lineWidth=2;for(let i=0;i<3;i++){const a=i*2.094;x.beginPath();x.moveTo(128,128);x.quadraticCurveTo(128+Math.cos(a+.6)*20,128+Math.sin(a+.6)*20,128+Math.cos(a+1)*33,128+Math.sin(a+1)*33);x.stroke();}});
  const pipe=mk(x=>{ // jet pipe wall: heat-stained liner with cooling-hole bands, glowing deeper in
    const g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'#3b3733');g.addColorStop(.5,'#2a2724');g.addColorStop(1,'#141211');x.fillStyle=g;x.fillRect(0,0,256,256);
    x.fillStyle='rgba(0,0,0,.35)';for(let y=10;y<256;y+=22)for(let i=0;i<64;i++)x.fillRect(i*4,y,2,2);
    x.fillStyle='rgba(120,90,60,.18)';for(let i=0;i<14;i++)x.fillRect(i*18+Math.random()*6,0,3+Math.random()*4,256);});
  const glow=mk(x=>{const g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'#000');g.addColorStop(.55,'#120400');g.addColorStop(1,'#ff6a1a');x.fillStyle=g;x.fillRect(0,0,256,256);});
  return ENG_TEX={turb,fan,pipe,glow};
}
function probeEngines(wrap,inner,t,H){
  const bo=inner.getObjectByName('body');if(!bo)return null;
  const meshes=[],sides=[];bo.traverse(o=>{if(o.isMesh){meshes.push(o);const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{sides.push([m,m.side]);m.side=THREE.DoubleSide;});}});
  wrap.updateMatrixWorld(true);
  const box=new THREE.Box3();meshes.forEach(m=>box.expandByObject(m));
  const rc=new THREE.Raycaster(),o=new THREE.Vector3(),d=new THREE.Vector3();
  const hit=(x,y,back)=>{o.set(x,y,back?box.min.z-3:box.max.z+3);d.set(0,0,back?1:-1);rc.set(o,d);rc.far=box.max.z-box.min.z+6;const h=rc.intersectObjects(meshes,false)[0];return h?h.point.z:null;};
  const T=engTextures(),grp=new THREE.Group();grp.name='engines';grp.userData.engine=1;
  const steel=new THREE.MeshStandardMaterial({color:0x6b6560,metalness:.85,roughness:.42,side:THREE.DoubleSide});
  const res={noz:[],fans:[]};
  const each=(list,fn)=>{for(const [x,y,r] of list){fn(x,y,r);if(Math.abs(x)>.05)fn(-x,y,r);}};
  // nozzles: centre on the deepest point, the lip is the rearmost surface just outside it
  const zRear=box.min.z,Lm=box.max.z-box.min.z;
  const probeNoz=(hx,hy,r0)=>{
    // deepest point near the hint, only in the tail end of the aircraft (rays that slip past the airframe don't count)
    let best=null;for(let dx=-.3;dx<=.301;dx+=.06)for(let dy=-.3;dy<=.301;dy+=.06){let z=hit(hx+dx,hy+dy,true);if(z===null||z>zRear+Lm*.3)z=zRear+Lm*.3;   // straight through the pipe: as deep as it gets
      if(!best||z>best.z+.02||(Math.abs(z-best.z)<.02&&Math.hypot(dx,dy)<best.dd))best={x:hx+dx,y:hy+dy,z,dd:Math.hypot(dx,dy)};}
    // walk outwards to the edge of the opening: radius (smallest, so the pipe never pokes through) and lip
    const open=(c)=>{let rmin=9,rsum=0,lip=1e9,ok=0;
      for(let k=0;k<8;k++){const a=k/8*Math.PI*2,cx=Math.cos(a),cy=Math.sin(a);
        for(let st=.05;st<=r0*1.5;st+=.03){const z=hit(c.x+cx*st,c.y+cy*st,true);if(z===null||z>zRear+Lm*.3)continue;if(z<c.z-.22){ok++;rmin=Math.min(rmin,st);rsum+=st;lip=Math.min(lip,z);for(const e of[.08,.18,.3]){const z2=hit(c.x+cx*(st+e),c.y+cy*(st+e),true);if(z2!==null&&z2<zRear+Lm*.3)lip=Math.min(lip,z2);}break;}}}
      return ok>=6?{rmin,r:rsum/ok,lip}:null;};
    let o2=best&&best.dd<r0*.8?open(best):null;
    if(o2&&o2.r>r0*.45&&o2.r<r0*1.5){const depth=clamp(best.z-o2.lip,0,o2.r*3.4);return{x:best.x,y:best.y,lip:o2.lip,r:clamp(o2.r,.2,.8),rp:Math.min(o2.rmin,o2.r)*.94,depth};}
    // the model closes its nozzle (or the opening is odd): trust the hint and sit on the cap
    let lip=1e9;for(const f of[0,.5,1.05,1.25])for(let k=0;k<(f?8:1);k++){const a=k/8*Math.PI*2,z=hit(hx+Math.cos(a)*r0*f,hy+Math.sin(a)*r0*f,true);if(z!==null&&z<zRear+Lm*.3)lip=Math.min(lip,z);}
    return lip<1e8?{x:hx,y:hy,lip,r:r0,rp:r0*.94,depth:0}:null;
  };
  for(const [hx,hy,r0] of H.r||[]){
    const q=probeNoz(hx,hy,r0);if(!q)continue;
    const list=Math.abs(q.x)>.05?[q,Object.assign({},q,{x:-q.x})]:[q];   // engines come in mirror-image pairs
    for(const {x,y,lip,r,rp,depth} of list){
    const open=depth>.2;
    const best={x,y};
    const ng=new THREE.Group();ng.position.set(best.x,best.y,lip);ng.userData.engine=1;grp.add(ng);
    if(open){
      const L=depth-.06,pipe=new THREE.Mesh(new THREE.CylinderGeometry(rp*.97,rp,L,28,1,true).rotateX(Math.PI/2).translate(0,0,L/2+.06),
        new THREE.MeshStandardMaterial({map:T.pipe,color:0xffffff,metalness:.6,roughness:.55,side:THREE.BackSide,emissive:0xffffff,emissiveMap:T.glow,emissiveIntensity:.15}));
      pipe.userData.engGlow=1;ng.add(pipe);
      const fh=new THREE.Mesh(new THREE.TorusGeometry(rp*.58,rp*.035,6,28),steel);fh.position.z=L*.5;ng.add(fh);                       // afterburner flame holder ring
      const fh2=new THREE.Mesh(new THREE.TorusGeometry(rp*.32,rp*.03,6,20),steel);fh2.position.z=L*.55;ng.add(fh2);
      for(let i=0;i<8;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(rp*.035,rp*.62,rp*.035),steel);b.position.set(Math.cos(i/8*TAU)*rp*.45,Math.sin(i/8*TAU)*rp*.45,L*.52);b.rotation.z=i/8*TAU+Math.PI/2;ng.add(b);}   // spray bars
      const tf=new THREE.Mesh(new THREE.CircleGeometry(rp*.98,32),new THREE.MeshStandardMaterial({map:T.turb,metalness:.7,roughness:.5,emissive:0xff5a10,emissiveMap:T.turb,emissiveIntensity:.0}));tf.position.z=L+.05;tf.rotation.y=Math.PI;tf.userData.engGlow=2;ng.add(tf);
      const cone=new THREE.Mesh(new THREE.ConeGeometry(rp*.24,rp*.7,20).rotateX(-Math.PI/2),steel);cone.position.z=L-rp*.3;ng.add(cone);   // tail cone
    }else{ // the model closes its nozzle: paint the view up the pipe onto the cap
      const tf=new THREE.Mesh(new THREE.CircleGeometry(r*.92,32),new THREE.MeshStandardMaterial({map:T.turb,metalness:.6,roughness:.5,emissive:0xff5a10,emissiveMap:T.turb,emissiveIntensity:0,polygonOffset:true,polygonOffsetFactor:-4}));tf.position.z=-.015;tf.rotation.y=Math.PI;tf.userData.engGlow=2;ng.add(tf);
    }
    res.noz.push({x:best.x,y:best.y,z:lip-.03,r:clamp(r*.92,.25,.75)});
  }}
  // intakes: the duct shows as a deep pocket; the fan sits on the duct's end wall
  for(const [hx,hy,r] of H.f||[]){
    let best=null;for(let dx=-.3;dx<=.301;dx+=.06)for(let dy=-.3;dy<=.301;dy+=.06){const z=hit(hx+dx,hy+dy,false);if(z===null||z<box.max.z-Lm*.75)continue;if(!best||z<best.z)best={x:hx+dx,y:hy+dy,z};}
    if(!best)continue;let rim=-1e9,n=0;for(let k=0;k<8;k++){const a=k/8*Math.PI*2,z=hit(best.x+Math.cos(a)*(r*1.25+.2),best.y+Math.sin(a)*(r*1.25+.2),false);if(z!==null){rim=Math.max(rim,z);n++;}}
    if(!n||rim-best.z<.6)continue;   // not a real opening: leave the model alone
    for(const x of Math.abs(best.x)>.05?[best.x,-best.x]:[best.x]){
      const fan=new THREE.Mesh(new THREE.CircleGeometry(r*.95,32),new THREE.MeshStandardMaterial({map:T.fan,metalness:.8,roughness:.32}));
      fan.position.set(x,best.y,best.z+.04);fan.userData.fan=1;fan.userData.engine=1;grp.add(fan);res.fans.push(fan);}
  }
  sides.forEach(([m,sd])=>m.side=sd);grp.traverse(q=>{q.userData.engine=1;});
  if(grp.children.length)inner.parent.add(grp);   // in the wrap's frame, so it is copied with every aircraft
  return res;
}
function findNozzles(inner,t){ // the rear end of the fuselage, one nozzle per engine (skipping tail booms and stingers)
  const bo=inner.getObjectByName('body'),v=new THREE.Vector3(),twin=!!(t.twin||(t.eng||1)>1),P=[];
  bo.traverse(o=>{if(!o.isMesh)return;const a2=o.geometry.attributes.position;for(let i=0;i<a2.count;i++){v.fromBufferAttribute(a2,i).applyMatrix4(o.matrixWorld);
    const ax=Math.abs(v.x),wide=t.model==='su27'||t.model==='mig29';if(Math.abs(v.y)<1.2&&(twin?(wide?ax>.6&&ax<1.9:ax>.22&&ax<1.25):ax<.95))P.push(v.clone());}});   // Flanker/Fulcrum engines sit far apart
  const sides=twin?[P.filter(q=>q.x>0),P.filter(q=>q.x<0)]:[P];
  return sides.filter(s=>s.length>6).map(s=>{let zmin=1e9;for(const q of s)zmin=Math.min(zmin,q.z);
    const rear=s.filter(q=>q.z<zmin+.6),b=new THREE.Box3();rear.forEach(q=>b.expandByPoint(q));const c=b.getCenter(new THREE.Vector3()),sz=b.getSize(new THREE.Vector3());
    return{x:c.x,y:c.y,z:zmin-.05,r:clamp(Math.min(sz.y,sz.x)/2,.3,.7)};});
}
function stepFlames(F,p,e){
  const on=p.alive&&p.thr>.82&&!p.ground||p.alive&&p.ground&&p.thr>.9,lvl=on?clamp((p.thr-.82)/.18,0,1):0,tm=performance.now()/1000;
  for(const f of F){f.visible=lvl>0;if(!lvl)continue;const q=f.userData.flame,fl=.92+Math.random()*.12;
    f.scale.set(1,1,(.55+.45*lvl)*fl);q.outer.material.uniforms.uI.value=1.3*lvl;q.core.material.uniforms.uI.value=2.*lvl;
    q.outer.material.uniforms.uTime.value=tm;q.core.material.uniforms.uTime.value=tm;q.disk.material.opacity=.7*lvl;}
}
/* ---------- navigation lights, strobes, beacons and landing lights ---------- */
let LIGHT_TEX=null;
function lightSprite(col,size){if(!LIGHT_TEX)LIGHT_TEX=glowTex();const s=new THREE.Sprite(new THREE.SpriteMaterial({map:LIGHT_TEX,color:col,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));s.userData.size=size;s.scale.setScalar(size);return s;}
function addLights(g,lt,t,inv){
  if(!lt||!lt.L)return;
  const L=[],put=(pos,col,size,kind,ph)=>{const s=lightSprite(col,size*inv);s.position.copy(pos);s.userData.kind=kind;s.userData.ph=ph||0;g.add(s);L.push(s);return s;};
  const tipL=lt.L.clone(),tipR=lt.R.clone();tipL.x+=.15;tipR.x-=.15;
  put(tipL,0xff2a1f,1.2,'nav');put(tipR,0x2bff5a,1.2,'nav');
  put(tipL,0xffffff,2.6,'strobe',0);put(tipR,0xffffff,2.6,'strobe',0);
  if(lt.top)put(lt.top.clone().add(new THREE.Vector3(0,.2,0)),t.cls?0xff2a1f:0xffffff,t.cls?2.4:1.0,t.cls?'beacon':'nav',.5);
  if(lt.bot&&t.cls)put(lt.bot.clone().add(new THREE.Vector3(0,-.2,0)),0xff2a1f,2.4,'beacon',0);
  const nose=lt.nose?lt.nose.clone():new THREE.Vector3(0,0,5);nose.z-=Math.abs(lt.L.x)*.12;nose.y=(lt.bot?lt.bot.y:nose.y)-.2;nose.x=0;
  put(nose,0xfff3d6,2.2,'landing');
  g.userData.lights=L;
}
function stepLights(L,p,e){
  const night=typeof darkness==='number'?darkness:0,t=performance.now()/1000,on=p.alive;
  for(const s of L){const k=s.userData.kind;let vis=on,sc=s.userData.size*(.35+night*1.1);
    if(k==='strobe'){const ph=(t+p.id*.37)%1.3;vis=on&&(ph<.05||(ph>.12&&ph<.17));sc*=1.4;}
    else if(k==='beacon'){vis=on&&((t*1.1+s.userData.ph+p.id*.13)%1)<.12;}
    else if(k==='landing'){vis=on&&p.gearT>.9&&(p.ground?p.spd>3||p.thr>.2:p.y-PAD_Y<900);sc*=(.25+night*1.8);}
    s.visible=vis;if(vis)s.scale.setScalar(sc/(e.mesh.scale.x||1));s.material.opacity=.55+night*.45;}
}
// one scene mesh per aircraft in the world, rebuilt when its type or livery changes
const MESHES=new Map();
function meshFor(p){
  let e=MESHES.get(p.id);
  if(e&&(e.type!==p.type||e.lv!==p.lv)){scene.remove(e.mesh);MESHES.delete(p.id);e=null;}
  if(!e){
    const lv=LIVERIES[p.lv]||LIVERIES[p.team?'vks':'usaf'];
    const mesh=buildPlane(p.type,p.team,false,lv);addTeamMark(mesh,p.team,p.type);makeDamageable(mesh,p.type);
    scene.add(mesh);mesh.traverse(o=>{if(o.isMesh){o.castShadow=true;}});
    e={mesh,type:p.type,lv:p.lv,spin:0};MESHES.set(p.id,e);
    if(MODELS[p.type])p.gearH=MODELS[p.type].gearH;
  }
  return e;
}
function addTeamMark(g,team,type){ // small team-coloured identification light on top of the fin
  const t=TYPES[type],sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:TEAM[team].hex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  sp.position.set(0,(t.finH||2)+(t.r||1)*.6,-(t.len||15)*.42);sp.scale.setScalar(2.6/g.scale.x);g.add(sp);g.userData.mark=sp;
}
function pruneMeshes(){for(const [id,e] of MESHES)if(!world.byId.has(id)){scene.remove(e.mesh);MESHES.delete(id);}}
const MSLGEO=cylZ(.4,.4,6,6),MSLMAT=new THREE.MeshBasicMaterial({color:0xf2f2f2});
const BOMBGEO=cylZ(.9,.5,5,6),BOMBMAT=new THREE.MeshLambertMaterial({color:0x2c3136});


function syncMesh(p,dt){
  const e=meshFor(p),m=e.mesh,U=m.userData;
  m.visible=(p.alive||p.falling)&&!(p.local&&(view===0||view===4)&&state==='play');
  if(!m.visible)return;
  m.position.set(p.x,p.y-(p.ground?p.comp*.35:0)-(p.sliding?p.gearH*.55:0),p.z);m.rotation.set(-p.pitch,p.yaw,p.roll);syncPlaneDamage(m,p);
  e.spin+=(dt||.016)*(4+p.thr*40);
  if(U.props)for(const q of U.props)q.rotation.z=e.spin;
  if(U.rotors)U.rotors.forEach((q,i)=>q.rotation.y=(i?-1:1)*e.spin*.6);
  for(const pv of U.legs){if(pv.userData.y0===undefined)pv.userData.y0=pv.position.y;pv.position.y=pv.userData.y0+(1-p.gearT)*2.2;pv.visible=p.gearT>.02;}
  if(U.gearNode){U.gearNode.visible=p.gearT>.02;
    if(U.rig&&U.rig.length){const k=1-p.gearT,ease=k*k*(3-2*k);for(const lg of U.rig){const L=lg.userData.leg;lg.position.y=L.y0+ease*L.h;}}   // gear stays upright and draws straight up into the wells
    else U.gearNode.scale.y=.25+.75*p.gearT;}
  if(U.wheels&&p.ground)for(const w of U.wheels){const r=w.userData.wheel*(e.mesh.scale.x||1);w.userData.spin=(w.userData.spin||0)+p.spd*(dt||.016)/r;w.rotation[w.userData.axis||'x']=w.userData.spin;}
  if(U.lights)stepLights(U.lights,p,e);
  if(U.flames)stepFlames(U.flames,p,e);
  if(U.engGlow&&U.engGlow.length){const run=p.alive&&(p.thr>.02||!p.ground),ab=run&&p.thr>.82?(p.thr-.82)/.18:0,heat=run?.05+p.thr*.25+ab*1.6:0;
    for(const o of U.engGlow)o.material.emissiveIntensity=o.userData.engGlow===2?(run?.02+ab*1.5:0):heat;}
  if(U.fans)for(const f of U.fans){f.userData.w=(f.userData.w||0)+(((p.alive&&(p.thr>.02||!p.ground))?14+p.thr*40:0)-(f.userData.w||0))*Math.min(1,(dt||.016)*.8);f.rotation.z+=f.userData.w*(dt||.016);}
  if(U.hubs&&U.hubs.length){const run=p.alive&&(p.thr>.02||!p.ground),w=run?(TYPES[p.type].heli?14:22+p.thr*30):0;
    for(const h of U.hubs){const P=h.userData.prop;h.userData.w=(h.userData.w||0)+(w-(h.userData.w||0))*Math.min(1,(dt||.016)*1.5);h.rotation[P.axis]+=P.dir*h.userData.w*(dt||.016);
      const dc=h.children.find(c=>c.userData.isDisc);if(dc)dc.material.opacity=clamp((h.userData.w-10)/40,0,1)*(TYPES[p.type].heli?.06:.05+.07*p.thr);}}
  for(const pv of U.flaps)pv.rotation.x=-p.flapT*.7;
  if(U.tail)U.tail.rotation.x=-p.pitchS*.3;
  if(U.canard)U.canard.rotation.x=p.pitchS*.3;
  if(U.swing){const a=.26+.85*clamp((p.spd-110)/70,0,1);for(const q of U.swing)q[0].rotation.y=q[1]*a;}
  if(U.glow)for(const q of U.glow)q.visible=p.thr>.8;
}
