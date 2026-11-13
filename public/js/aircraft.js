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
function skinMat(c){return new THREE.MeshStandardMaterial({color:c,roughness:.48,metalness:.32,side:THREE.DoubleSide});}
function glassMat(t){return new THREE.MeshStandardMaterial({color:t.gold?0x8a7a3e:0x1d2b35,roughness:.08,metalness:.85,side:THREE.DoubleSide});}
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
    add(new THREE.BoxGeometry(.22,ll,.22),dark,0,-ll/2,0,pv);
    add(new THREE.CylinderGeometry(.45,.45,.3,10).rotateZ(Math.PI/2),dark,0,-ll,0,pv);
  }
  if(!SPOTS[type])SPOTS[type]=computeSpots(g);
  addDecals(g,SPOTS[type],lv);
  g.scale.setScalar(big?1.3:1.7);g.rotation.order='YXZ';
  return g;
}
/* ---------- real aircraft models (FlightGear, GPL) ---------- */
const MODELS={},MODEL_REQ={};let modelsLoaded=0;
const MODEL_FILES=new Set(window.CF_MODEL_LIST||[]);
function ensureModel(file){ // load a FlightGear model the first time an aircraft that uses it appears
  if(!file||MODEL_REQ[file]||!THREE.GLTFLoader)return;
  MODEL_REQ[file]=1;
  const L=new THREE.GLTFLoader(),parts={};let left=3;
  const users=Object.keys(TYPES).filter(k=>TYPES[k].model===file);
  const doneOne=()=>{if(--left)return;if(!parts.body)return;for(const k of users)makeTemplate(k,parts);};
  for(const part of['body','gear','glass']){
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
    const g=o.geometry=o.geometry.clone(),c=floatColours(g),pos=g.attributes.position;
    if(c)for(let k=0;k<c.count;k++)if(c.getX(k)>.99&&c.getY(k)<.01&&c.getZ(k)>.99){
      camoColour(lv,pos.getX(k),pos.getY(k),pos.getZ(k),col);c.setXYZ(k,col.r,col.g,col.b);
    }
    if(!g.attributes.normal)g.computeVertexNormals();
    o.material=new THREE.MeshStandardMaterial({vertexColors:!!c,color:c?0xffffff:lv.base,roughness:.5,metalness:.3,side:THREE.DoubleSide});
  });
}
function makeTemplate(type,parts){
  const t=TYPES[type],inner=new THREE.Group();inner.rotation.y=Math.PI/2; // FlightGear: nose toward -x
  for(const k of['body','gear','glass'])if(parts[k]){const o=parts[k].clone(true);o.name=k;inner.add(o);}
  const wrap=new THREE.Group();wrap.add(inner);wrap.updateMatrixWorld(true);
  // centre: middle of the body's length and span, fuselage axis from the nose section
  const box=new THREE.Box3().setFromObject(inner.getObjectByName('body'));
  const len=box.max.z-box.min.z,v=new THREE.Vector3();let sy=0,n=0;
  inner.getObjectByName('body').traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;o.updateMatrixWorld(true);
    for(let i=0;i<a.count;i+=3){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);if(v.z>box.max.z-len*.12){sy+=v.y;n++;}}});
  const cy=n?sy/n:(box.min.y+box.max.y)/2;
  inner.position.set(-(box.min.x+box.max.x)/2,-cy,-(box.min.z+box.max.z)/2);
  wrap.updateMatrixWorld(true);
  const gb=inner.getObjectByName('gear')?new THREE.Box3().setFromObject(inner.getObjectByName('gear')):null;
  const sc=t.cls?1.3:1.7,bodyMin=box.min.y-cy;
  MODELS[type]={wrap,sc,gearH:(gb&&!gb.isEmpty()?-gb.min.y:-bodyMin+1.6)*sc,spots:computeSpots(wrap),cache:{},legs:gb&&!gb.isEmpty()?null:{y0:bodyMin+.3,y1:bodyMin-1.6,len}};
  modelsLoaded++;
  for(const p of planes)if(p.type===type)swapMesh(p);
  show.key='';
}
function realPlane(type,team,lv){
  const M=MODELS[type],t=TYPES[type],g=new THREE.Group(),U=g.userData;
  if(!M.cache[lv.id]){const w=M.wrap.clone(true);paintModel(w,lv,t);M.cache[lv.id]=w;}
  const m=M.cache[lv.id].clone(true);g.add(m);
  U.legs=[];U.flaps=[];U.gearNode=m.getObjectByName('gear');
  if(M.legs){ // simple gear for models that ship without one
    const gn=new THREE.Group(),L=M.legs,dm=new THREE.MeshLambertMaterial({color:0x1b2025}),h=L.y0-L.y1;
    for(const q of[[0,L.len*.25],[1.6,-L.len*.08],[-1.6,-L.len*.08]]){
      const leg=new THREE.Mesh(new THREE.BoxGeometry(.2,h,.2),dm);leg.position.set(q[0],L.y0-h/2,q[1]);gn.add(leg);
      const wh=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.28,10).rotateZ(Math.PI/2),dm);wh.position.set(q[0],L.y1+.42,q[1]);gn.add(wh);
    }
    g.add(gn);U.gearNode=gn;
  }
  const dk=new THREE.MeshLambertMaterial({color:0x2a3036});
  if(type==='e7'){ // E-7's MESA radar 'top hat' on the 737 airframe
    const r=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.6,10.8),dk);r.position.set(0,4.1,-2.5);g.add(r);
    const s=new THREE.Mesh(new THREE.BoxGeometry(.5,1.6,3.6),dk);s.position.set(0,2.6,-2.5);g.add(s);
  }
  if(type==='p8'){const r=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,2.4,10).rotateX(Math.PI/2),dk);r.position.set(0,-2.1,9);g.add(r);}
  if(type==='rc135')for(const s of[-1,1]){const c=new THREE.Mesh(new THREE.BoxGeometry(.5,1.4,4.5),dk);c.position.set(s*1.85,0,12);g.add(c);}
  if(t.heli){U.rotors=[];for(const q of t.rotors){const rg=new THREE.Group();rg.position.set(0,2.4+q[1]*.5,q[0]);g.add(rg);U.rotors.push(rg);
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
// one scene mesh per aircraft in the world, rebuilt when its type or livery changes
const MESHES=new Map();
function meshFor(p){
  let e=MESHES.get(p.id);
  if(e&&(e.type!==p.type||e.lv!==p.lv)){scene.remove(e.mesh);MESHES.delete(p.id);e=null;}
  if(!e){
    const lv=LIVERIES[p.lv]||LIVERIES[p.team?'vks':'usaf'];
    const mesh=buildPlane(p.type,p.team,false,lv);addTeamMark(mesh,p.team,p.type);
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
  m.position.set(p.x,p.y-(p.ground?p.comp*.35:0)-(p.sliding?p.gearH*.55:0),p.z);m.rotation.set(-p.pitch,p.yaw,p.roll);
  e.spin+=(dt||.016)*(4+p.thr*40);
  if(U.props)for(const q of U.props)q.rotation.z=e.spin;
  if(U.rotors)U.rotors.forEach((q,i)=>q.rotation.y=(i?-1:1)*e.spin*.6);
  for(const pv of U.legs){pv.rotation.x=(1-p.gearT)*Math.PI/2;pv.visible=p.gearT>.02;}
  if(U.gearNode){U.gearNode.visible=p.gearT>.02;U.gearNode.scale.y=.25+.75*p.gearT;}
  for(const pv of U.flaps)pv.rotation.x=-p.flapT*.7;
  if(U.tail)U.tail.rotation.x=-p.pitchS*.3;
  if(U.canard)U.canard.rotation.x=p.pitchS*.3;
  if(U.swing){const a=.26+.85*clamp((p.spd-110)/70,0,1);for(const q of U.swing)q[0].rotation.y=q[1]*a;}
  if(U.glow)for(const q of U.glow)q.visible=p.thr>.8;
}
