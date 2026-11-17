'use strict';
// Everything you see that is not an aircraft: terrain, sea, sky, weather, airports, grass and damage.
const envRoot=new THREE.Group();scene.add(envRoot);
const dynRoot=new THREE.Group();scene.add(dynRoot);     // craters, wrecks, vehicles: rebuilt as damage changes
let envMap='',lightSets=[],papis=[],socks=[],vehicles=[],grassField=null,waterMat=null,cloudSprites=[],stars=null,skyMesh=null;
const BU=THREE.BufferGeometryUtils;

/* ---------- procedural textures (no downloads: drawn once on canvases) ---------- */
const TEXC={};
function canvasTex(key,w,h,draw,rep){
  if(TEXC[key])return TEXC[key];
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);
  t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return TEXC[key]=t;
}
function speckle(x,w,h,n,cols,smin,smax){for(let i=0;i<n;i++){x.fillStyle=cols[i%cols.length];const s=smin+Math.random()*(smax-smin);x.fillRect(Math.random()*w,Math.random()*h,s,s);}}
function noiseBlobs(x,w,h,n,col,rmin,rmax,a){for(let i=0;i<n;i++){const r=rmin+Math.random()*(rmax-rmin),cx=Math.random()*w,cy=Math.random()*h,g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,col.replace('A',a));g.addColorStop(1,col.replace('A',0));x.fillStyle=g;x.fillRect(cx-r,cy-r,2*r,2*r);}}
const texGrass=()=>canvasTex('grass',512,512,(x,w,h)=>{
  x.fillStyle='#55803f';x.fillRect(0,0,w,h);
  noiseBlobs(x,w,h,60,'rgba(70,112,48,A)',30,110,.5);noiseBlobs(x,w,h,40,'rgba(120,140,70,A)',20,80,.35);noiseBlobs(x,w,h,25,'rgba(46,80,34,A)',20,70,.45);
  for(let i=0;i<9000;i++){const px=Math.random()*w,py=Math.random()*h,l=3+Math.random()*6,g=90+Math.random()*80|0;x.strokeStyle='rgba('+(g*.55|0)+','+g+','+(g*.35|0)+','+(.35+Math.random()*.4)+')';x.lineWidth=1;x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.random()*2-1,py-l);x.stroke();}
});
const texAsphalt=()=>canvasTex('asphalt',512,512,(x,w,h)=>{
  x.fillStyle='#3d4247';x.fillRect(0,0,w,h);noiseBlobs(x,w,h,50,'rgba(30,33,36,A)',20,90,.4);noiseBlobs(x,w,h,40,'rgba(80,84,88,A)',20,70,.18);
  speckle(x,w,h,26000,['#2c3034','#50565b','#5d6368','#34383c'],1,2);
  x.strokeStyle='rgba(20,22,24,.55)';x.lineWidth=1;for(let i=0;i<14;i++){x.beginPath();let px=Math.random()*w,py=Math.random()*h;x.moveTo(px,py);for(let k=0;k<8;k++){px+=Math.random()*24-12;py+=Math.random()*24-12;x.lineTo(px,py);}x.stroke();}
});
const texConcrete=()=>canvasTex('concrete',512,512,(x,w,h)=>{
  x.fillStyle='#8d9195';x.fillRect(0,0,w,h);noiseBlobs(x,w,h,60,'rgba(110,114,118,A)',20,80,.35);noiseBlobs(x,w,h,20,'rgba(70,72,74,A)',10,40,.2);
  speckle(x,w,h,16000,['#7c8084','#a0a4a8','#888c90'],1,2);
  x.strokeStyle='rgba(50,52,54,.6)';x.lineWidth=2;for(let i=0;i<=4;i++){x.beginPath();x.moveTo(i*w/4,0);x.lineTo(i*w/4,h);x.moveTo(0,i*h/4);x.lineTo(w,i*h/4);x.stroke();}
});
const texSand=()=>canvasTex('sand',512,512,(x,w,h)=>{x.fillStyle='#d4c393';x.fillRect(0,0,w,h);noiseBlobs(x,w,h,50,'rgba(190,170,120,A)',20,90,.4);noiseBlobs(x,w,h,30,'rgba(235,222,180,A)',20,70,.4);speckle(x,w,h,20000,['#c2b083','#e2d4a8','#b5a376'],1,2);});
const texRock=()=>canvasTex('rock',512,512,(x,w,h)=>{x.fillStyle='#7b7f74';x.fillRect(0,0,w,h);noiseBlobs(x,w,h,80,'rgba(95,98,90,A)',10,70,.5);noiseBlobs(x,w,h,40,'rgba(150,152,140,A)',10,50,.35);speckle(x,w,h,14000,['#6a6e64','#8d9185','#5a5d54'],1,3);});
const texDirt=()=>canvasTex('dirt',256,256,(x,w,h)=>{x.fillStyle='#5c4a36';x.fillRect(0,0,w,h);noiseBlobs(x,w,h,40,'rgba(40,30,22,A)',10,50,.5);speckle(x,w,h,8000,['#4a3a2a','#6f5b44','#3a2e22'],1,3);});
const texWater=()=>canvasTex('water',512,512,(x,w,h)=>{
  x.fillStyle='#7f7f7f';x.fillRect(0,0,w,h);
  for(let i=0;i<900;i++){const px=Math.random()*w,py=Math.random()*h,l=8+Math.random()*30;x.strokeStyle='rgba(255,255,255,'+(.05+Math.random()*.12)+')';x.lineWidth=1+Math.random()*1.5;x.beginPath();x.moveTo(px,py);x.quadraticCurveTo(px+l/2,py-3,px+l,py);x.stroke();}
  for(let i=0;i<500;i++){const px=Math.random()*w,py=Math.random()*h,l=8+Math.random()*24;x.strokeStyle='rgba(0,0,0,'+(.05+Math.random()*.1)+')';x.lineWidth=1;x.beginPath();x.moveTo(px,py);x.quadraticCurveTo(px+l/2,py+3,px+l,py);x.stroke();}
},[60,60]);
const texWindows=(key,bg,lit)=>canvasTex(key,256,256,(x,w,h)=>{x.fillStyle=bg;x.fillRect(0,0,w,h);for(let r=0;r<8;r++)for(let c=0;c<8;c++){x.fillStyle=Math.random()<lit?'rgba(255,214,140,.9)':'rgba(40,62,82,.95)';x.fillRect(c*32+4,r*32+6,24,18);}});
const texCloud=()=>canvasTex('cloud',128,128,(x,w,h)=>{for(let i=0;i<14;i++){const cx=32+Math.random()*64,cy=40+Math.random()*48,r=18+Math.random()*30,g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);}});
const texCorrugated=()=>canvasTex('corr',128,128,(x,w,h)=>{for(let i=0;i<w;i+=4){x.fillStyle=i%8?'#8b949b':'#727b82';x.fillRect(i,0,4,h);}noiseBlobs(x,w,h,8,'rgba(60,40,30,A)',10,30,.25);});
function std(o){return new THREE.MeshStandardMaterial(Object.assign({roughness:.9,metalness:0},o));}

/* ---------- runway markings, painted on a texture per runway direction ---------- */
function runwayTex(ns){
  return canvasTex('rwy'+(ns?'ns':'ew'),256,2560,(x,w,h)=>{
    // texture is 120 m wide (u) by 1400 m long (v); v=0 is the far (+) end
    const mx=w/120,mz=h/1400,Z=m=>(700-m)*mz,X=m=>(m+60)*mx;
    const a=texAsphalt().image;for(let yy=0;yy<h;yy+=256)x.drawImage(a,0,yy,256,256);
    x.fillStyle='rgba(25,25,25,.35)';x.fillRect(X(-24),0,48*mx,h);                               // darker keel
    const paint=(cx,cz,ww,ll)=>{x.fillStyle='rgba(238,238,232,.92)';x.fillRect(X(cx-ww/2),Z(cz+ll/2),ww*mx,ll*mz);};
    paint(-56.5,0,1.2,1400);paint(56.5,0,1.2,1400);                                                 // edge lines
    for(let m=-560;m<560;m+=50)if(Math.abs(m)>70)paint(0,m+15,.9,30);                                // centreline
    const names=ns?['36','18']:['09','27'];
    for(const end of[-1,1]){
      const th=end*-1;                                                                                // threshold at -650*dir
      const tz=th*650;
      for(let i=0;i<8;i++)for(const sgn of[-1,1])paint(sgn*(5+i*6),tz-th*18,3.6,30);                  // piano keys
      paint(0,th*682,112,2.2);                                                                        // runway end bar
      // number, written to be read on approach
      x.save();x.translate(X(0),Z(tz-th*62));if(th<0)x.rotate(Math.PI);
      x.fillStyle='rgba(238,238,232,.92)';x.font='bold '+Math.round(26*mx)+'px sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.scale(1,mz/mx*2.4);x.fillText(names[end<0?0:1],0,0);x.restore();
      paint(0,tz-th*148,30,.9);
      // aiming point and touchdown zone
      for(const sgn of[-1,1])paint(sgn*11,tz-th*160,6,45);
      for(const d of[230,300])for(const sgn of[-1,1])for(let k=0;k<2;k++)paint(sgn*(8+k*4),tz-th*d,2.2,22);
      // rubber from thousands of landings
      for(let i=0;i<70;i++){x.fillStyle='rgba(12,12,12,'+(.04+Math.random()*.06)+')';const rz=tz-th*(150+Math.random()*190),rx=(Math.random()-.5)*16;x.fillRect(X(rx-1.5),Z(rz+8),3*mx,16*mz);}
    }
  });
}
function signTex(text,bg,fg,key){
  return canvasTex('sign_'+key+text,256,64,(x,w,h)=>{x.fillStyle=bg;x.fillRect(0,0,w,h);x.strokeStyle=fg;x.lineWidth=4;x.strokeRect(3,3,w-6,h-6);x.fillStyle=fg;x.font='bold 40px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(text,w/2,h/2+2);});
}

/* ---------- static batching: many small meshes merged per material ---------- */
function Batch(){this.items=new Map();}
Batch.prototype.add=function(geo,mat,x,y,z,ry,sx,sy,sz,worldUV){
  const g=geo.clone(),m=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,ry||0,0)),new THREE.Vector3(sx||1,sy||1,sz||1));
  g.applyMatrix4(m);
  if(worldUV){const p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/worldUV,p.getZ(i)/worldUV);}
  if(!this.items.has(mat))this.items.set(mat,[]);this.items.get(mat).push(g);
};
Batch.prototype.build=function(parent,shadows){
  for(const [mat,list] of this.items){
    const norm=list.map(g=>{const q=g.index?g.toNonIndexed():g;for(const k of Object.keys(q.attributes))if(!['position','normal','uv'].includes(k))q.deleteAttribute(k);if(!q.attributes.uv)q.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(q.attributes.position.count*2),2));return q;});
    const merged=BU&&BU.mergeBufferGeometries?BU.mergeBufferGeometries(norm,false):null;
    if(merged){const m=new THREE.Mesh(merged,mat);m.castShadow=!!shadows;m.receiveShadow=true;parent.add(m);}
    else for(const g of norm){const m=new THREE.Mesh(g,mat);parent.add(m);}
  }
};

/* ---------- lights: points that glow brighter at night ---------- */
function LightSet(color,size){this.pos=[];this.color=color;this.size=size||5;}
LightSet.prototype.add=function(x,y,z){this.pos.push(x,y,z);};
LightSet.prototype.build=function(){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.pos,3));
  const m=new THREE.PointsMaterial({color:this.color,size:this.size,map:glowTex(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true,fog:false});
  const p=new THREE.Points(g,m);p.frustumCulled=false;envRoot.add(p);this.mesh=p;lightSets.push(this);return this;
};

/* ---------- terrain and sea ---------- */
function buildEnvironment(w){
  if(envMap===w.map+'|'+w.bases.length)return;
  envMap=w.map+'|'+w.bases.length;
  envRoot.traverse(o=>{if(o.geometry)o.geometry.dispose();});envRoot.clear();lightSets=[];papis=[];socks=[];
  const M=MAPS[w.map],T=w.terrain;
  scene.background=new THREE.Color(M.sky);scene.fog.color.setHex(M.sky);
  // sea or land floor
  if(M.sea){
    const t=texWater();waterMat=new THREE.MeshPhongMaterial({color:0x1d6f95,specular:0x9fc9dd,shininess:90,map:t,bumpMap:t,bumpScale:.4});
    const sea=new THREE.Mesh(new THREE.PlaneGeometry(140000,140000),waterMat);sea.rotation.x=-Math.PI/2;sea.receiveShadow=true;envRoot.add(sea);
  }else{
    const gt=texGrass().clone();gt.needsUpdate=true;gt.repeat.set(900,900);
    const fl=new THREE.Mesh(new THREE.PlaneGeometry(140000,140000),std({color:M.floor===0x56804a?0x8fb377:0x9aa59a,map:gt}));fl.rotation.x=-Math.PI/2;fl.receiveShadow=true;envRoot.add(fl);waterMat=null;
  }
  // islands, hills and mountains: subdivided cones coloured by height and slope
  const coneGeo=new THREE.ConeGeometry(1,1,28,6,true);coneGeo.translate(0,.5,0);
  const hillMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,flatShading:false});
  const col=new THREE.Color(),hills=[];
  for(const c of T.cones){
    const g=coneGeo.clone(),pos=g.attributes.position,cols=new Float32Array(pos.count*3),rr=mulberry(Math.round(c.x*7+c.z*13));
    for(let i=0;i<pos.count;i++){
      const y=pos.getY(i),n=.86+rr()*.28;
      pos.setXYZ(i,pos.getX(i)*c.R*n,y*c.h,pos.getZ(i)*c.R*n);
      const hgt=y*c.h;
      if(c.kind==='rock'||hgt>420)col.setHex(hgt>620?0xe8ecee:0x7c8074).offsetHSL(0,0,(rr()-.5)*.06);
      else if(M.sea&&hgt<10)col.setHex(0xcfbf8a);
      else col.setHex(hgt>260?0x6f7a5c:0x5d8a46).offsetHSL((rr()-.5)*.02,0,(rr()-.5)*.08);
      cols[i*3]=col.r;cols[i*3+1]=col.g;cols[i*3+2]=col.b;
    }
    g.setAttribute('color',new THREE.BufferAttribute(cols,3));g.rotateY(c.rot);g.translate(c.x,0,c.z);g.computeVertexNormals();hills.push(g);
  }
  if(hills.length){const merged=BU.mergeBufferGeometries(hills);const hm=new THREE.Mesh(merged,hillMat);hm.receiveShadow=true;hm.castShadow=true;envRoot.add(hm);}
  // beaches and the islands the airfields sit on
  if(M.sea){
    const sm=std({map:texSand().clone(),color:0xffffff});sm.map.repeat.set(30,30);sm.map.needsUpdate=true;
    for(const s of T.beaches){const m=new THREE.Mesh(new THREE.CylinderGeometry(s.R*(s.flat?1:1.08),s.R*(s.flat?1.12:1.22),s.flat?8:6,48),sm);m.position.set(s.x,s.flat?4:2,s.z);m.receiveShadow=true;envRoot.add(m);
      const sh=new THREE.Mesh(new THREE.RingGeometry(s.R*(s.flat?1.1:1.2),s.R*(s.flat?1.35:1.5),48),new THREE.MeshBasicMaterial({color:0x4fb3c0,transparent:true,opacity:.45,depthWrite:false}));sh.rotation.x=-Math.PI/2;sh.position.set(s.x,.3,s.z);envRoot.add(sh);}
  }
  for(const p of T.ponds){const m=new THREE.Mesh(new THREE.CircleGeometry(p.R,40),new THREE.MeshPhongMaterial({color:0x2f6f8f,specular:0x88aabb,shininess:80}));m.rotation.x=-Math.PI/2;m.position.set(p.x,.6,p.z);envRoot.add(m);}
  if(T.trees.length){
    const tg=BU.mergeBufferGeometries([new THREE.CylinderGeometry(1.2,1.6,8,6).translate(0,4,0),new THREE.ConeGeometry(9,26,7).translate(0,19,0),new THREE.ConeGeometry(7,20,7).translate(0,28,0)].map(g=>g.toNonIndexed()));
    const trees=new THREE.InstancedMesh(tg,std({color:0x2f5a2e}),T.trees.length),o=new THREE.Object3D(),c2=new THREE.Color();
    T.trees.forEach((t,i)=>{o.position.set(t[0],0,t[1]);o.scale.setScalar(t[2]);o.rotation.y=t[0];o.updateMatrix();trees.setMatrixAt(i,o.matrix);trees.setColorAt&&trees.setColorAt(i,c2.setHSL(.27+((i*37)%10)/200,.4,.2+((i*13)%10)/100));});
    trees.castShadow=true;envRoot.add(trees);
  }
  if(T.cellList.length){ // city blocks with lit windows at night
    flatPlane(9600,9600,std({map:texAsphalt().clone(),color:0x9a9a9a}),0,.4,0,[90,90]);
    flatPlane(170,40000,new THREE.MeshPhongMaterial({color:0x2a6684,specular:0x99bbcc,shininess:70}),0,.8,0);
    flatPlane(700,700,std({map:texGrass(),color:0xffffff}),T.park.x,.7,T.park.z,[20,20]);
    const geo=new THREE.BoxGeometry(1,1,1).translate(0,.5,0);
    const day=[texWindows('win_a','#8e98a3',.1),texWindows('win_b','#6f7b88',.1),texWindows('win_c','#4f6f8c',.06)];
    const groups=[[],[],[]];
    T.cellList.forEach((q,k)=>groups[q[2]>110?2:k%2].push(q));
    groups.forEach((list,gi)=>{
      if(!list.length)return;
      const m=new THREE.InstancedMesh(geo,std({map:day[gi],color:0xffffff,emissive:0xffcc88,emissiveMap:day[gi],emissiveIntensity:0}),list.length),o=new THREE.Object3D();
      list.forEach((q,k)=>{o.position.set(q[0],0,q[1]);o.scale.set(q[3]*2,q[2],q[3]*2);o.updateMatrix();m.setMatrixAt(k,o.matrix);});
      m.castShadow=true;m.receiveShadow=true;m.userData.night=true;envRoot.add(m);
    });
  }
  for(const g of T.gates){
    const m=new THREE.Mesh(new THREE.TorusGeometry(120,6,8,30),new THREE.MeshBasicMaterial({color:0x35d0e0,fog:false}));
    m.position.set(g.x,g.y,g.z);m.lookAt(g.nx,g.y,g.nz);envRoot.add(m);g.m=m;
  }
  gates=T.gates;
  buildClouds(T);
  for(const b of w.bases)buildAirfield(w,b);
  for(const s of lightSets)s.base=s.mesh.material.size;
}
function flatPlane(wd,ln,mat,x,y,z,rep){
  if(rep&&mat.map){mat.map=mat.map.clone();mat.map.repeat.set(rep[0],rep[1]);mat.map.needsUpdate=true;}
  const m=new THREE.Mesh(new THREE.PlaneGeometry(wd,ln),mat);m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.receiveShadow=true;envRoot.add(m);return m;
}
function buildClouds(T){
  cloudSprites=[];
  const mat=new THREE.SpriteMaterial({map:texCloud(),color:0xffffff,transparent:true,depthWrite:false,fog:true});
  for(const c of T.clouds){
    for(const q of c.p){const s=new THREE.Sprite(mat.clone());s.position.set(c.x+q[0],c.y+q[1],c.z+q[2]);s.scale.set(q[3]*3.2,q[3]*1.7,1);envRoot.add(s);s.userData.base=s.position.clone();cloudSprites.push(s);}
  }
}

/* ---------- an airfield ---------- */
function buildAirfield(w,b){
  const s=b.s,Y=PAD_Y,root=new THREE.Group();envRoot.add(root);b.view={root,bld:[]};
  const L=(lx,lz)=>[b.x+s*lx,b.z+lz];
  // grass field and perimeter
  const grassT=texGrass().clone();grassT.repeat.set(70,70);grassT.needsUpdate=true;
  const pad=new THREE.Mesh(new THREE.CircleGeometry(1000,64),std({map:grassT,color:0xffffff}));pad.rotation.x=-Math.PI/2;pad.position.set(b.x,Y-.05,b.z);pad.receiveShadow=true;root.add(pad);
  const batch=new Batch();
  const asph=std({map:texAsphalt(),color:0xffffff,roughness:.85}),conc=std({map:texConcrete(),color:0xffffff});
  const yel=new THREE.MeshBasicMaterial({color:0xe8bf2c}),wht=new THREE.MeshBasicMaterial({color:0xeeeeea}),red=new THREE.MeshBasicMaterial({color:0xb81d1d});
  const plane=(wd,ln,mat,x,z,y,ry)=>{const g=new THREE.PlaneGeometry(wd,ln);g.rotateX(-Math.PI/2);batch.add(g,mat,x,Y+(y||.05),z,ry||0,1,1,1,mat.map?(mat===conc?24:36):0);};
  // runways with their painted markings
  for(const ns of[true,false]){
    const t=runwayTex(ns),m=new THREE.Mesh(new THREE.PlaneGeometry(120,1400),std({map:t,roughness:.85}));
    m.rotation.x=-Math.PI/2;if(!ns)m.rotation.z=Math.PI/2;m.position.set(b.x,Y+(ns?.12:.1),b.z);m.receiveShadow=true;root.add(m);
    const sh=new THREE.Mesh(new THREE.PlaneGeometry(150,1440),std({color:0x6f6a55,roughness:1}));sh.rotation.x=-Math.PI/2;if(!ns)sh.rotation.z=Math.PI/2;sh.position.set(b.x,Y+.04,b.z);sh.receiveShadow=true;root.add(sh);
  }
  // taxiways, apron and roads
  {const [x,z]=L(210,0);plane(32,1340,asph,x,z,.08);}
  for(const lz of[-650,-300,300,650]){const [x,z]=L(135,lz);plane(150,lz%650?28:34,asph,x,z,.085);}
  for(const sd of[-1,1]){const [x,z]=L(355,sd*380);plane(330,560,conc,x,z,.07);}          // apron, split by the cross runway's clear strip
  for(const lz of[-660,660]){const [x,z]=L(690,lz);plane(380,14,asph,x,z,.06);}
  {const [x,z]=L(860,0);plane(14,1334,asph,x,z,.06);}
  {const [x,z]=L(780,420);plane(80,110,asph,x,z,.065);}
  // taxiway centre lines, edge lines and holding points
  {const [x,z]=L(210,0);plane(.5,1330,yel,x,z,.1);for(const e of[-15.5,15.5]){const [ex,ez]=L(210+e,0);plane(.35,1330,yel,ex,ez,.1);}}
  for(const lz of[-650,-300,300,650]){const [x,z]=L(128,lz);plane(150,.5,yel,x,z,.11);}
  const holdBar=(lx,lz,alongZ)=>{for(let i=0;i<4;i++){const off=(i-1.5)*.9;const [x,z]=L(lx+(alongZ?0:off),lz+(alongZ?off:0));
    if(i<2)plane(alongZ?30:.35,alongZ?.35:30,yel,x,z,.12);else for(let k=-12;k<=12;k+=4){const [dx,dz]=L(lx+(alongZ?k:off),lz+(alongZ?off:k));plane(alongZ?2:.35,alongZ?.35:2,yel,dx,dz,.12);}}};
  for(const lz of[-650,-300,300,650])holdBar(92,lz,false);
  holdBar(210,-75,true);holdBar(210,75,true);
  // taxiways Bravo (north) and Charlie (south) alongside the cross runway, with links onto it
  for(const sd of[-1,1]){
    {const [x,z]=L(-242,sd*190);plane(916,32,asph,x,z,.08);plane(916,.5,yel,x,z,.1);for(const e of[-15.5,15.5]){const [ex,ez]=L(-242,sd*190+e);plane(890,.35,yel,ex,ez,.1);}}
    for(const c of[-650,-300]){const [x,z]=L(c,sd*125);plane(32,140,asph,x,z,.085);plane(.5,125,yel,x,z,.11);holdBar(c,sd*110,true);}
  }
  // parking stands with lead-in lines and numbers
  STANDS.forEach((sz,i)=>{
    const [x,z]=L(300,sz);plane(.4,1,yel,x,z,.11);
    const [lx,lz]=L(255,sz);plane(90,.4,yel,lx,lz,.11);
    const [bx,bz]=L(342,sz);plane(.5,12,yel,bx,bz,.11);
    const num=new THREE.Mesh(new THREE.PlaneGeometry(9,4.5),new THREE.MeshBasicMaterial({map:signTex(String(i+1),'rgba(0,0,0,0)','#e8bf2c','stand'),transparent:true,depthWrite:false}));
    num.rotation.x=-Math.PI/2;num.rotation.z=s>0?Math.PI/2:-Math.PI/2;num.position.set(b.x+s*350,Y+.13,b.z+sz);root.add(num);
  });
  // runway, approach and taxiway lights
  const edge=new LightSet(0xfff2d0,7),thr=new LightSet(0x4dff6a,9),endL=new LightSet(0xff3030,9),ctr=new LightSet(0xffffff,5),taxi=new LightSet(0x4d7dff,5),appr=new LightSet(0xfff6e0,9),obst=new LightSet(0xff2020,12);
  for(let m=-700;m<=700;m+=60){edge.add(b.x-61,Y+.6,b.z+m);edge.add(b.x+61,Y+.6,b.z+m);edge.add(b.x+m,Y+.6,b.z-61);edge.add(b.x+m,Y+.6,b.z+61);}
  for(let m=-690;m<=690;m+=15){if(Math.abs(m)>62){ctr.add(b.x,Y+.25,b.z+m);ctr.add(b.x+m,Y+.25,b.z);}}
  for(let k=-56;k<=56;k+=7){thr.add(b.x+k,Y+.5,b.z-694);thr.add(b.x+k,Y+.5,b.z+694);thr.add(b.x-694,Y+.5,b.z+k);thr.add(b.x+694,Y+.5,b.z+k);}
  for(let k=-56;k<=56;k+=14){endL.add(b.x+k,Y+.5,b.z-700.5);endL.add(b.x+k,Y+.5,b.z+700.5);endL.add(b.x-700.5,Y+.5,b.z+k);endL.add(b.x+700.5,Y+.5,b.z+k);}
  for(let lz=-660;lz<=660;lz+=40){if(Math.abs(lz)<75)continue;taxi.add(b.x+s*194,Y+.4,b.z+lz);taxi.add(b.x+s*226,Y+.4,b.z+lz);}
  for(const sd of[-1,1]){for(let lx=-680;lx<=190;lx+=40){if(Math.abs(lx)<75)continue;for(const e of[-16,16])taxi.add(b.x+s*lx,Y+.4,b.z+sd*190+e);}
    for(const c of[-650,-300])for(let lz=75;lz<=175;lz+=25)for(const e of[-16,16])taxi.add(b.x+s*(c+e),Y+.4,b.z+sd*lz);}
  for(let r=0;r<4;r++){ // approach light system out to 900 m with a crossbar at 300 m
    const g=rwGeo(b,r);
    for(let d=60;d<=900;d+=30){const px=g.T.x-g.dx*(d+50),pz=g.T.z-g.dz*(d+50);if(world.padAt(px,pz)<0&&MAPS[w.map].sea)continue;
      for(let k=-2;k<=2;k++)appr.add(px+g.px*k*1.6,Y+1+d*.002,pz+g.pz*k*1.6);
      if(d===300)for(let k=-12;k<=12;k++)appr.add(px+g.px*k*2.4,Y+1,pz+g.pz*k*2.4);}
    // PAPI: four units on the left of the aiming point
    const units=[];for(let i=0;i<4;i++){const px=g.A.x-g.px*(70+i*9),pz=g.A.z-g.pz*(70+i*9);
      const box=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.2,1.4),std({color:0xd8d8d0}));box.position.set(px,Y+.7,pz);box.rotation.y=g.yaw;root.add(box);
      const lamp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:0xffffff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));lamp.position.set(px-g.dx*.8,Y+1,pz-g.dz*.8);lamp.scale.setScalar(5);root.add(lamp);units.push(lamp);}
    papis.push({b,r,g,units,th:[3.5,3.17,2.83,2.5]});
    // distance remaining boards along the runway
    for(let k=1;k<=9;k++){const d=650-k*140;if(d<-650)break;const px=g.T.x+g.dx*(1300-k*140)-g.px*80,pz=g.T.z+g.dz*(1300-k*140)-g.pz*80;
      const brd=new THREE.Mesh(new THREE.PlaneGeometry(3.2,2.2),new THREE.MeshBasicMaterial({map:signTex(String(k),'#151515','#f2f2f2','dist'+k),side:THREE.DoubleSide}));brd.position.set(px,Y+1.6,pz);brd.rotation.y=g.yaw+Math.PI;root.add(brd);}
  }
  // signs at the holding points: red mandatory, yellow-on-black location
  const sign=(lx,lz,text,mand)=>{const [x,z]=L(lx,lz),m=new THREE.Mesh(new THREE.PlaneGeometry(6,1.5),new THREE.MeshBasicMaterial({map:signTex(text,mand?'#b81d1d':'#141414',mand?'#ffffff':'#f0c419',mand?'m':'l'),side:THREE.DoubleSide}));m.position.set(x,Y+1.4,z);m.rotation.y=Math.PI/2;root.add(m);
    batch.add(new THREE.BoxGeometry(.15,1.2,.15),std({color:0x333333}),x-1.6*s,Y+.6,z);batch.add(new THREE.BoxGeometry(.15,1.2,.15),std({color:0x333333}),x+1.6*s,Y+.6,z);};
  sign(95,-668,'36-18',true);sign(95,668,'18-36',true);sign(95,-318,'36-18',true);sign(95,318,'18-36',true);
  sign(232,-90,'09-27',true);sign(232,90,'27-09',true);sign(232,-300,'A',false);sign(232,300,'A',false);sign(232,-210,'A  C',false);sign(232,210,'A  B',false);
  for(const sd of[-1,1])for(const c of[-650,-300])sign(c+24,sd*112,'09-27',true);
  // buildings
  for(const o of b.bld){const v=buildBuilding(o,b,batch);if(v){root.add(v);b.view.bld[o.id]=v;}}
  // perimeter fence with the security gate
  const fenceMat=new THREE.MeshBasicMaterial({color:0x9aa3a8,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false}),post=std({color:0x6c7378,metalness:.4});
  for(let i=0;i<120;i++){
    const a0=i/120*TAU,a1=(i+1)/120*TAU,R=985;
    const x0=b.x+Math.cos(a0)*R,z0=b.z+Math.sin(a0)*R,x1=b.x+Math.cos(a1)*R,z1=b.z+Math.sin(a1)*R;
    const gx=b.x+s*R;if(Math.hypot((x0+x1)/2-gx,(z0+z1)/2-(b.z-90))<30)continue;
    const len=Math.hypot(x1-x0,z1-z0),g=new THREE.PlaneGeometry(len,2.6);
    batch.add(g,fenceMat,(x0+x1)/2,Y+1.3,(z0+z1)/2,-Math.atan2(z1-z0,x1-x0));
    batch.add(new THREE.BoxGeometry(.18,2.9,.18),post,x0,Y+1.45,z0);
  }
  // windsocks near both thresholds
  for(const lz of[-560,560]){const [x,z]=L(-110,lz);socks.push(makeSock(root,x,Y,z));}
  batch.build(root,true);
  const ls=[edge,thr,endL,ctr,taxi,appr];for(const l of ls)l.build();
  obst.add(b.x+s*520,Y+52,b.z+140);obst.build();
}
function makeSock(root,x,y,z){
  const g=new THREE.Group();g.position.set(x,y,z);root.add(g);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,8,6),std({color:0xdddddd,metalness:.4}));pole.position.y=4;g.add(pole);
  const sock=new THREE.Group();sock.position.y=7.8;g.add(sock);
  for(let i=0;i<5;i++){const seg=new THREE.Mesh(new THREE.CylinderGeometry(.55-i*.07,.48-i*.07,.9,10,1,true).rotateZ(Math.PI/2),new THREE.MeshStandardMaterial({color:i%2?0xffffff:0xff5a1e,side:THREE.DoubleSide}));seg.position.x=.5+i*.9;sock.add(seg);}
  return sock;
}
function buildBuilding(o,b,batch){
  const s=b.s,Y=PAD_Y,g=new THREE.Group();g.position.set(o.x,Y,o.z);g.userData.o=o;
  const add=(geo,mat,x,y,z,ry)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x*s,y,z);if(ry)m.rotation.y=ry;m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
  const conc=std({map:texConcrete(),color:0xd8d8d0}),metal=std({map:texCorrugated(),color:0xffffff,metalness:.35,roughness:.6}),dark=std({color:0x22282d,roughness:.4,metalness:.5});
  switch(o.type){
    case'shelter':{ // hardened aircraft shelter
      const arch=new THREE.CylinderGeometry(o.w/2,o.w/2,o.d,24,1,false,0,Math.PI);arch.rotateZ(Math.PI/2);arch.rotateY(Math.PI/2);
      const m=add(arch,std({map:texConcrete(),color:0xa9aba2}),0,0,0);m.rotation.y=Math.PI/2;
      add(new THREE.BoxGeometry(1.2,o.h*.9,o.w*.86),dark,-o.d/2+.4,o.h*.45,0);
      add(new THREE.BoxGeometry(o.d*.9,1,o.w*.2),std({color:0x5b6b4b}),.0,o.w/2,0);
      break;}
    case'hangar':{
      add(new THREE.BoxGeometry(o.w,o.h*.62,o.d),metal,0,o.h*.31,0);
      const roof=new THREE.CylinderGeometry(o.w*.62,o.w*.62,o.d,28,1,false,-0.95,1.9);roof.rotateX(Math.PI/2);
      const r=add(roof,std({color:0x6e787f,metalness:.5,roughness:.5}),0,o.h*.62-o.w*.62*Math.cos(.95),0);r.rotation.z=0;
      add(new THREE.BoxGeometry(.6,o.h*.55,o.d*.84),std({color:0x4a5a66,metalness:.6,roughness:.4}),-o.w/2-.1,o.h*.28,0);
      for(let i=-3;i<=3;i++)add(new THREE.BoxGeometry(.7,o.h*.55,.25),dark,-o.w/2-.3,o.h*.28,i*o.d*.12);
      break;}
    case'tower':{
      add(new THREE.CylinderGeometry(5,6,o.h-8,12),conc,0,(o.h-8)/2,0);
      add(new THREE.BoxGeometry(18,8,18),conc,6,4,0);
      const cab=add(new THREE.CylinderGeometry(9,7.5,6,8),std({color:0x1d3a4d,roughness:.05,metalness:.9,emissive:0x5a8aa0,emissiveIntensity:0}),0,o.h-5,0);cab.userData.night=true;
      add(new THREE.CylinderGeometry(10,10,1.2,8),conc,0,o.h-1.6,0);add(new THREE.CylinderGeometry(.2,.2,6,4),std({color:0xaaaaaa}),0,o.h+2,0);
      break;}
    case'fire':{
      add(new THREE.BoxGeometry(o.w,o.h,o.d),conc,0,o.h/2,0);
      for(let i=-1;i<=1;i++)add(new THREE.BoxGeometry(.4,o.h*.7,8),red3(),-o.w/2-.1,o.h*.35,i*9.5);
      const sg=new THREE.Mesh(new THREE.PlaneGeometry(18,3),new THREE.MeshBasicMaterial({map:signTex('FIRE · RESCUE','#b81d1d','#ffffff','fire'),side:THREE.DoubleSide}));sg.position.set(-s*(o.w/2+.4),o.h-1.8,0);sg.rotation.y=Math.PI/2;g.add(sg);
      break;}
    case'terminal':{
      const glass=std({map:texWindows('term','#2f4a5e',.3),color:0xffffff,roughness:.1,metalness:.8,emissive:0xffd59a,emissiveMap:texWindows('term','#2f4a5e',.3),emissiveIntensity:0});glass.userData.night=true;
      const m=add(new THREE.BoxGeometry(o.d,o.h,o.w),glass,0,o.h/2,0);m.material=glass;m.userData.night=true;
      add(new THREE.BoxGeometry(o.d+8,1.4,o.w+8),std({color:0xc9ccd0,metalness:.6,roughness:.3}),0,o.h+.6,0);
      for(const z of[-50,10])add(new THREE.BoxGeometry(46,4,4),std({color:0x9aa1a6,metalness:.5}),-o.d/2-23,6,z);
      break;}
    case'maint':add(new THREE.BoxGeometry(o.w,o.h,o.d),metal,0,o.h/2,0);add(new THREE.BoxGeometry(.4,o.h*.7,o.d*.6),dark,-o.w/2-.1,o.h*.35,0);break;
    case'ops':{const wm=std({map:texWindows('ops','#9aa3a8',.25),emissive:0xffd59a,emissiveMap:texWindows('ops','#9aa3a8',.25),emissiveIntensity:0});const m=add(new THREE.BoxGeometry(o.w,o.h,o.d),wm,0,o.h/2,0);m.userData.night=true;break;}
    case'fuel':add(new THREE.CylinderGeometry(o.w/2,o.w/2,o.h,20),std({color:0xe6e8e9,metalness:.5,roughness:.35}),0,o.h/2,0);add(new THREE.CylinderGeometry(o.w/2+.3,o.w/2+.3,.6,20),std({color:0x8e9499}),0,o.h,0);break;
    case'carpark':{const cols=[0x9c1d1d,0x1d3c9c,0xdddddd,0x222222,0x6b6f73,0xb28b2a];for(let i=0;i<40;i++){const r=Math.floor(i/8),c=i%8;if(Math.random()<.3)continue;
      const car=new THREE.Group();car.position.set((-30+r*14)*s,0,-45+c*12);g.add(car);const cm=std({color:cols[i%cols.length],metalness:.6,roughness:.35});
      const bd=new THREE.Mesh(new THREE.BoxGeometry(4.4,1.1,1.9),cm);bd.position.y=.8;car.add(bd);const tp=new THREE.Mesh(new THREE.BoxGeometry(2.4,.8,1.7),std({color:0x1d2a33,metalness:.8,roughness:.1}));tp.position.set(-.2,1.6,0);car.add(tp);}
      break;}
    case'gatehouse':add(new THREE.BoxGeometry(o.w,o.h,o.d),conc,0,o.h/2,0);{const arm=add(new THREE.BoxGeometry(.3,.3,9),std({color:0xffffff}),0,1.2,8);arm.userData.barrier=true;}break;
  }
  return g;
}
const red3=()=>std({color:0xb81d1d,metalness:.3,roughness:.5});

/* ---------- vehicles and ground crew that react to what is happening ---------- */
const VEH={};
function vehicleMesh(kind){
  if(VEH[kind])return VEH[kind].clone();
  const g=new THREE.Group(),add=(geo,col,x,y,z,o)=>{const m=new THREE.Mesh(geo,std(Object.assign({color:col,roughness:.5,metalness:.3},o||{})));m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  const wheels=(xs,zs)=>{for(const x of xs)for(const z of zs)add(new THREE.CylinderGeometry(.5,.5,.4,10).rotateX(Math.PI/2),0x151515,x,.5,z);};
  if(kind==='fuel'){add(new THREE.BoxGeometry(2.2,2.2,2.4),0xe6e6e0,0,1.6,3.4);add(new THREE.CylinderGeometry(1.2,1.2,6,14).rotateX(Math.PI/2),0xd9dadc,0,1.9,-.8,{metalness:.6});add(new THREE.BoxGeometry(2.3,.4,8.4),0x333333,0,.75,.2);wheels([-1,1],[3,-1.5,-3.2]);}
  else if(kind==='fire'){add(new THREE.BoxGeometry(2.6,2.6,9),0xc41a17,0,1.9,0);add(new THREE.BoxGeometry(2.5,1.3,2.2),0x1d2a33,0,2.6,3.3,{metalness:.8,roughness:.1});add(new THREE.BoxGeometry(.4,.4,3),0xd8d8d8,0,3.5,-1);wheels([-1.2,1.2],[3,-1,-3]);g.userData.beacon=true;}
  else if(kind==='tug'){add(new THREE.BoxGeometry(2.2,1,3.8),0xe5b91c,0,.9,0);add(new THREE.BoxGeometry(1.4,1.1,1.2),0x2a3238,0,1.9,-.9);wheels([-1,1],[1.2,-1.2]);}
  else if(kind==='bag'){add(new THREE.BoxGeometry(1.8,1.1,2.6),0xdddddd,0,1,0);for(let i=1;i<=3;i++){add(new THREE.BoxGeometry(1.7,1.3,2.4),0x5a6b7a,0,1.1,-i*3.2);wheels([-.8,.8],[-i*3.2]);}wheels([-.8,.8],[0]);}
  else if(kind==='stairs'){add(new THREE.BoxGeometry(2,.8,4.5),0xe8e8e8,0,.7,0);const st=add(new THREE.BoxGeometry(1.4,.3,6),0xb0b4b8,0,2.6,1.6);st.rotation.x=-.55;wheels([-.9,.9],[1.6,-1.6]);}
  else if(kind==='repair'){add(new THREE.BoxGeometry(2.4,2.2,7),0xe8a21c,0,1.6,0);const arm=add(new THREE.BoxGeometry(.5,.5,6),0xe8a21c,0,3.2,3.6);arm.rotation.x=.5;wheels([-1.1,1.1],[2.4,-2.4]);}
  else if(kind==='crew'){add(new THREE.CylinderGeometry(.28,.24,1.1,8),0xf2ff3a,0,1.15,0,{emissive:0x3a3f00});add(new THREE.CylinderGeometry(.22,.22,.8,6),0x2a3340,0,.4,0);add(new THREE.SphereGeometry(.2,8,6),0xe0b49a,0,1.9,0);}
  VEH[kind]=g;return g.clone();
}
function buildGroundOps(w){
  for(const v of vehicles)dynRoot.remove(v.m);vehicles=[];
  for(const b of w.bases){
    const s=b.s,L=(lx,lz)=>[b.x+s*lx,b.z+lz];
    const put=(kind,lx,lz,ry,extra)=>{const [x,z]=L(lx,lz),m=vehicleMesh(kind);m.position.set(x,PAD_Y,z);m.rotation.y=ry||0;dynRoot.add(m);const v=Object.assign({kind,m,b,home:{x,z,ry:ry||0}},extra||{});vehicles.push(v);return v;};
    STANDS.forEach((sz,i)=>{if(i%3===0)put('stairs',330,sz-14,s>0?-Math.PI/2:Math.PI/2);if(i%4===1){put('crew',335,sz+10);put('crew',326,sz+14);}});
    put('fire',480,-160,s>0?-Math.PI/2:Math.PI/2,{role:'fire'});put('fire',480,-135,s>0?-Math.PI/2:Math.PI/2,{role:'fire'});
    put('fuel',740,-560,0,{role:'fuelrun',t:Math.random()*60});put('fuel',760,-470,0);
    put('tug',470,-240,0);put('tug',470,250,Math.PI);put('bag',600,470,0,{role:'bag',t:Math.random()*40});
    put('repair',800,-290,0,{role:'repair'});put('repair',810,-350,0,{role:'repair2'});
  }
}
function driveTo(v,x,z,dt,speed){
  const dx=x-v.m.position.x,dz=z-v.m.position.z,d=Math.hypot(dx,dz);
  if(d<2)return true;
  const yaw=Math.atan2(dx,dz);v.m.rotation.y+=angDiff(yaw,v.m.rotation.y)*Math.min(1,dt*3);
  const st=Math.min(d,(speed||12)*dt);v.m.position.x+=Math.sin(v.m.rotation.y)*st;v.m.position.z+=Math.cos(v.m.rotation.y)*st;return false;
}
function stepGroundOps(dt){
  for(const v of vehicles){
    const b=v.b;
    if(v.role==='fire'){
      const wr=b.fire&&world.wrecks.find(q=>q.id===b.fire)||world.wrecks.find(q=>world.padAt(q.x,q.z)===b.i&&world.time-q.t<90);
      if(wr){if(driveTo(v,wr.x+(v===vehicles.find(q=>q.b===b&&q.role==='fire')?-14:14),wr.z+10,dt,22)&&Math.random()<dt*20)part(wr.x+rnd(-4,4),PAD_Y+3,wr.z+rnd(-4,4),rnd(-3,3),rnd(2,6),rnd(-3,3),1,5,5);}
      else driveTo(v,v.home.x,v.home.z,dt,10);
      if(v.m.userData.beacon&&wr&&Math.random()<dt*6)part(v.m.position.x,PAD_Y+4,v.m.position.z,0,0,0,.15,4,Math.random()<.5?2:7);
    }else if(v.role==='repair'||v.role==='repair2'){
      const R=b.repair;
      if(R){if(driveTo(v,R.x+(v.role==='repair'?-12:10),R.z+(v.role==='repair'?6:-8),dt,14)&&Math.random()<dt*6)part(R.x+rnd(-5,5),PAD_Y+1,R.z+rnd(-5,5),rnd(-2,2),rnd(1,3),rnd(-2,2),1.5,6,3);}
      else driveTo(v,v.home.x,v.home.z,dt,10);
    }else if(v.role==='fuelrun'){ // fuel truck shuttles between the fuel farm and the stands
      v.t+=dt;const SS=STANDS.filter(z=>z<0),stand=SS[Math.floor(v.t/40)%SS.length],out=(v.t%40)<20;
      driveTo(v,out?b.x+b.s*318:v.home.x,out?b.z+stand+18:v.home.z,dt,9);
    }else if(v.role==='bag'){v.t+=dt;driveTo(v,(v.t%40)<20?b.x+b.s*330:v.home.x,(v.t%40)<20?b.z+STANDS.filter(z=>z>0)[Math.floor(v.t/40)%7]:v.home.z,dt,7);}
  }
}

/* ---------- craters, wrecks and building damage (rebuilt from the shared damage state) ---------- */
const DMGV={craters:new Map(),wrecks:new Map()};
function craterMesh(c){
  const g=new THREE.Group(),y=world.ground(c.x,c.z)+.15;g.position.set(c.x,y,c.z);
  if(c.done){ // repaired: a square patch of fresh asphalt
    const m=new THREE.Mesh(new THREE.PlaneGeometry(c.r*2.2,c.r*2.2),std({color:0x2b2f33,roughness:.7}));m.rotation.x=-Math.PI/2;m.rotation.z=(c.id%7)*.3;m.position.y=.02;g.add(m);return g;
  }
  const scorch=new THREE.Mesh(new THREE.CircleGeometry(c.r*2.3,24),new THREE.MeshBasicMaterial({map:canvasTex('scorch',128,128,(x,w,h)=>{const gr=x.createRadialGradient(64,64,6,64,64,64);gr.addColorStop(0,'rgba(12,10,8,.95)');gr.addColorStop(.5,'rgba(25,20,15,.6)');gr.addColorStop(1,'rgba(30,25,20,0)');x.fillStyle=gr;x.fillRect(0,0,w,h);for(let i=0;i<40;i++){x.strokeStyle='rgba(15,12,10,.5)';x.lineWidth=2;x.beginPath();x.moveTo(64,64);const a=Math.random()*TAU,l=30+Math.random()*34;x.lineTo(64+Math.cos(a)*l,64+Math.sin(a)*l);x.stroke();}}),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
  scorch.rotation.x=-Math.PI/2;scorch.position.y=.05;g.add(scorch);
  const pit=new THREE.Mesh(new THREE.CircleGeometry(c.r*.85,20),std({map:texDirt(),color:0x5a4a3a}));pit.rotation.x=-Math.PI/2;pit.position.y=.08;g.add(pit);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(c.r,c.r*.22,6,20),std({map:texDirt(),color:0x6b5a46}));rim.rotation.x=-Math.PI/2;rim.scale.z=.45;rim.position.y=.3;g.add(rim);
  const rr=mulberry(c.id*31);
  for(let i=0;i<10;i++){const a=rr()*TAU,d=c.r*(1.1+rr()*1.4),chunk=new THREE.Mesh(new THREE.DodecahedronGeometry(.4+rr()*1.1,0),std({color:rr()<.5?0x3d4247:0x8d9195}));chunk.position.set(Math.cos(a)*d,.3,Math.sin(a)*d);chunk.rotation.set(rr()*3,rr()*3,0);chunk.castShadow=true;g.add(chunk);}
  return g;
}
function wreckMesh(w){
  const g=new THREE.Group();g.position.set(w.x,(w.y||world.ground(w.x,w.z))+.4,w.z);g.rotation.y=w.yaw;
  const t=TYPES[w.type]||TYPES.f16,L=Math.min(t.len||15,60),burnt=std({color:0x1b1b1b,roughness:1});
  const f=new THREE.Mesh(new THREE.CylinderGeometry((t.r||1)*.9,(t.r||1)*.7,L*.6,10).rotateX(Math.PI/2),burnt);f.position.y=(t.r||1)*.5;f.rotation.z=.3;g.add(f);
  const tail=new THREE.Mesh(new THREE.CylinderGeometry((t.r||1)*.6,(t.r||1)*.4,L*.25,8).rotateX(Math.PI/2),burnt);tail.position.set(L*.12,(t.r||1)*.4,-L*.45);tail.rotation.y=.6;g.add(tail);
  for(const sd of[-1,1]){const wg=new THREE.Mesh(new THREE.BoxGeometry(L*.25,.3,L*.12),burnt);wg.position.set(sd*L*.2,.3,rnd(-L*.1,L*.1));wg.rotation.y=rnd(-.6,.6);g.add(wg);}
  const sc=new THREE.Mesh(new THREE.CircleGeometry(L*.7,20),new THREE.MeshBasicMaterial({color:0x0e0c0a,transparent:true,opacity:.7,depthWrite:false}));sc.rotation.x=-Math.PI/2;sc.position.y=-.35;g.add(sc);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});g.userData.w=w;return g;
}
function syncDamage(){
  if(!world)return;
  const seen=new Set();
  for(const c of world.craters){
    const key=c.id+(c.done?'d':'');seen.add(key);
    if(!DMGV.craters.has(key)){const old=DMGV.craters.get(c.id+'');if(old&&c.done){dynRoot.remove(old);DMGV.craters.delete(c.id+'');}const m=craterMesh(c);dynRoot.add(m);DMGV.craters.set(key,m);}
  }
  for(const [k,m] of DMGV.craters)if(!seen.has(k)){dynRoot.remove(m);DMGV.craters.delete(k);}
  const ws=new Set();
  for(const w of world.wrecks){ws.add(w.id);if(!DMGV.wrecks.has(w.id)){const m=wreckMesh(w);dynRoot.add(m);DMGV.wrecks.set(w.id,m);}}
  for(const [k,m] of DMGV.wrecks)if(!ws.has(k)){dynRoot.remove(m);DMGV.wrecks.delete(k);}
  for(const b of world.bases){
    if(!b.view)continue;
    for(const o of b.bld){const v=b.view.bld[o.id];if(!v)continue;const ruined=o.dmg>=.5;
      if(v.userData.ruined!==ruined){v.userData.ruined=ruined;v.scale.y=ruined?.35:1;v.traverse(q=>{if(q.isMesh){if(!q.userData.mat0)q.userData.mat0=q.material;q.material=ruined?std({color:0x2a2622,roughness:1}):q.userData.mat0;}});}}
  }
}
function damageSmoke(dt){
  for(const [,m] of DMGV.wrecks){const w=m.userData.w,age=world.time-(w.t||0);if(Math.random()<dt*(age<120?10:3))part(w.x+rnd(-3,3),m.position.y+2,w.z+rnd(-3,3),rnd(-2,2),rnd(8,16),rnd(-2,2),rnd(3,6),rnd(12,26),1);if(age<60&&Math.random()<dt*14)part(w.x+rnd(-3,3),m.position.y+1,w.z+rnd(-3,3),rnd(-2,2),rnd(4,9),rnd(-2,2),rnd(.4,.9),rnd(5,10),2);}
  for(const b of world.bases)if(b.view)for(const o of b.bld){if(o.dmg>=.5&&Math.random()<dt*3)part(o.x+rnd(-o.w/3,o.w/3),PAD_Y+o.h*.4,o.z+rnd(-o.d/3,o.d/3),rnd(-2,2),rnd(10,18),rnd(-2,2),rnd(3,6),rnd(16,30),1);}
  for(const c of world.craters)if(!c.done&&world.time-(c.t||world.time)<40&&Math.random()<dt*3)part(c.x+rnd(-2,2),world.ground(c.x,c.z)+1,c.z+rnd(-2,2),rnd(-1,1),rnd(4,8),rnd(-1,1),rnd(2,4),rnd(8,16),1);
}

/* ---------- grass blades that sway, close to the camera ---------- */
function makeGrass(){
  const blade=new THREE.BufferGeometry(),P=[],U=[];
  for(let k=0;k<3;k++){const a=k*Math.PI/3,cx=Math.cos(a)*.18,cz=Math.sin(a)*.18;P.push(-cx,0,-cz, cx,0,cz, 0,.9,0);U.push(0,0,1,0,.5,1);}
  blade.setAttribute('position',new THREE.Float32BufferAttribute(P,3));blade.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));blade.computeVertexNormals();
  const mat=new THREE.MeshLambertMaterial({color:0x8fbf5e,side:THREE.DoubleSide});
  mat.onBeforeCompile=sh=>{
    sh.uniforms.uTime={value:0};sh.uniforms.uWind={value:new THREE.Vector2(1,0)};mat.userData.sh=sh;
    sh.vertexShader='uniform float uTime;uniform vec2 uWind;\n'+sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n vec4 wp=instanceMatrix*vec4(0.,0.,0.,1.);float sway=sin(uTime*2.2+wp.x*.13+wp.z*.11)*.5+.5;transformed.xz+=uWind*position.y*position.y*(.25+.35*sway);');
    sh.fragmentShader=sh.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\n gl_FragColor.rgb*=mix(.55,1.15,vUv.y);');
    sh.vertexShader=sh.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n vUv=uv;');
    sh.fragmentShader='varying vec2 vUv;\n'+sh.fragmentShader;sh.vertexShader='varying vec2 vUv;\n'+sh.vertexShader.replace('varying vec2 vUv;\n','');
  };
  const N=26000,m=new THREE.InstancedMesh(blade,mat,N);m.frustumCulled=false;m.count=0;scene.add(m);
  return{m,mat,N,cx:1e9,cz:1e9};
}
function updateGrass(){
  if(!grassField)grassField=makeGrass();
  const G2=grassField,cam=camera.position,near=ground(cam.x,cam.z);
  G2.m.visible=state==='play'&&cam.y-near<90;
  if(!G2.m.visible)return;
  if(Math.hypot(cam.x-G2.cx,cam.z-G2.cz)<35)return;
  G2.cx=cam.x;G2.cz=cam.z;
  const o=new THREE.Object3D(),R=170;let n=0;
  const rr=mulberry(Math.floor(cam.x/35)*7919+Math.floor(cam.z/35)*104729);
  for(let i=0;i<G2.N*1.6&&n<G2.N;i++){
    const a=rr()*TAU,d=Math.sqrt(rr())*R,x=cam.x+Math.cos(a)*d,z=cam.z+Math.sin(a)*d;
    if(world.surface(x,z)!=='grass')continue;
    if(world.padAt(x,z)<0&&!MAPS[world.map].sea&&rr()<.4)continue;
    o.position.set(x,ground(x,z),z);o.rotation.y=rr()*TAU;const sc=.6+rr()*1.1;o.scale.set(sc,sc*(.8+rr()*.8),sc);o.updateMatrix();G2.m.setMatrixAt(n++,o.matrix);
  }
  G2.m.count=n;G2.m.instanceMatrix.needsUpdate=true;
}

/* ---------- tyre marks ---------- */
const TRACKS={n:0,max:900,mesh:null};
function trackMark(x,z,yaw,w,dark){
  if(!TRACKS.mesh){const g=new THREE.PlaneGeometry(1,1);g.rotateX(-Math.PI/2);TRACKS.mesh=new THREE.InstancedMesh(g,new THREE.MeshBasicMaterial({color:0x1a1611,transparent:true,opacity:.42,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3}),TRACKS.max);TRACKS.mesh.count=0;TRACKS.mesh.frustumCulled=false;scene.add(TRACKS.mesh);}
  const o=new THREE.Object3D();o.position.set(x,ground(x,z)+.18,z);o.rotation.y=yaw;o.scale.set(w||.5,1,3.2);o.updateMatrix();
  TRACKS.mesh.setMatrixAt(TRACKS.n%TRACKS.max,o.matrix);TRACKS.n++;TRACKS.mesh.count=Math.min(TRACKS.n,TRACKS.max);TRACKS.mesh.instanceMatrix.needsUpdate=true;
}

/* ---------- sky, sun, stars, day and night, weather ---------- */
let skyU=null,rainPts=null,lightning=0,darkness=0;
function buildSky(){
  if(skyMesh)return;
  if(THREE.Sky){skyMesh=new THREE.Sky();skyMesh.scale.setScalar(45000);scene.add(skyMesh);skyU=skyMesh.material.uniforms;
    skyU.turbidity.value=6;skyU.rayleigh.value=1.6;skyU.mieCoefficient.value=.004;skyU.mieDirectionalG.value=.82;skyMesh.material.fog=false;}
  const sp=[];for(let i=0;i<1500;i++){const a=Math.random()*TAU,e=Math.acos(Math.random()*.95),r=40000;sp.push(Math.cos(a)*Math.sin(e)*r,Math.cos(e)*r,Math.sin(a)*Math.sin(e)*r);}
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
  stars=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:2.2,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false}));stars.frustumCulled=false;scene.add(stars);
  const rg=new THREE.BufferGeometry(),rp=new Float32Array(3000*6);rg.setAttribute('position',new THREE.BufferAttribute(rp,3));
  rainPts=new THREE.LineSegments(rg,new THREE.LineBasicMaterial({color:0xaabbcc,transparent:true,opacity:.35,fog:false,depthWrite:false}));rainPts.frustumCulled=false;scene.add(rainPts);
  rainPts.userData.drops=Array.from({length:3000},()=>({x:rnd(-80,80),y:rnd(-40,60),z:rnd(-80,80)}));
}
const SKYCOL=new THREE.Color(),HZ=new THREE.Color();
let envTod=-99,pmrem=null,envRT=null;
function refreshEnv(tod){ // reflections of the current sky for aircraft paint and canopies
  if(!skyMesh||Math.abs(tod-envTod)<.25)return;envTod=tod;
  try{
    pmrem=pmrem||new THREE.PMREMGenerator(renderer);
    const sc=new THREE.Scene(),sk=new THREE.Mesh(skyMesh.geometry,skyMesh.material);sk.scale.setScalar(80);sc.add(sk);
    const lo=new THREE.Mesh(new THREE.CircleGeometry(60,24),new THREE.MeshBasicMaterial({color:MAPS[world.map].sea?0x1d4f66:0x4d6a3e}));lo.rotation.x=-Math.PI/2;lo.position.y=-8;sc.add(lo);
    const rt=pmrem.fromScene(sc,0,.1,200);if(envRT)envRT.dispose();envRT=rt;setAircraftEnv(rt.texture);
  }catch(e){envTod=tod;}
}
function updateSky(dt){
  buildSky();
  const wx=world.weather,M=MAPS[world.map],tod=wx.tod;
  // sun goes round once a day; sunrise around 06:00, sunset 18:00
  const ang=(tod-6)/12*Math.PI,elev=Math.sin(ang)*1.15,az=Math.cos(ang);
  const sx=az*.8,sy=Math.max(-.4,elev),sz=.35;
  const day=clamp(elev*3+.3,0,1),dusk=clamp(1-Math.abs(elev)*4,0,1)*(elev>-.2?1:0);
  darkness=1-day;
  if(skyU){skyU.sunPosition.value.set(sx,sy,sz);skyU.turbidity.value=4+wx.cloud*12+wx.fog*6;skyU.rayleigh.value=1.2+dusk*2.5-wx.cloud*.8;skyMesh.position.copy(camera.position);skyMesh.visible=state==='play';}
  // fog and ambient colour follow the time of day and weather
  HZ.setHex(M.sky);HZ.lerp(new THREE.Color(0xf3a35f),dusk*.55).lerp(new THREE.Color(0x0a1220),1-day).lerp(new THREE.Color(0x8a939a),wx.cloud*.5*day).lerp(new THREE.Color(0x4a5258),wx.storm*.6*day);
  scene.fog.color.copy(HZ);scene.background=HZ;
  const fogFar=M.fog[1]*(1-wx.fog*.75)*(1-wx.rain*.35)*(.55+.45*day),fogNear=M.fog[0]*(1-wx.fog*.85);
  scene.fog.near=fogNear;scene.fog.far=Math.max(fogNear+1500,fogFar);
  const flash=lightning>0?lightning:0;lightning=Math.max(0,lightning-dt*3);
  sun.position.set(camera.position.x+sx*2000,camera.position.y+Math.max(.05,sy)*2000,camera.position.z+sz*2000);
  sun.target.position.copy(camera.position);
  sun.intensity=(.9*day*(1-wx.cloud*.55)+.05)+flash*2;
  sun.color.setHex(0xfff2d8).lerp(new THREE.Color(0xff9a50),dusk*.6);
  hemi.intensity=(.25+.55*day)*(1-wx.storm*.3)+nukeFlash*2.5+flash*1.5;
  hemi.color.setHex(0xe6f2ff).lerp(new THREE.Color(0x3a4a6a),1-day);
  cockHemi.intensity=.22+.38*day;cockSun.intensity=.15+.35*day;
  if(stars){stars.material.opacity=clamp((darkness-.4)*1.6,0,1)*(1-wx.cloud*.8);stars.position.copy(camera.position);}
  // lights glow at night and in murk
  const glow=clamp(darkness*1.3+wx.fog*.4+wx.rain*.25,.12,1);
  for(const l of lightSets){l.mesh.material.size=l.base*(.6+glow*1.6);l.mesh.material.opacity=.35+glow*.65;}
  envRoot.traverse(o=>{if(o.userData.night&&o.material)o.material.emissiveIntensity=darkness*.9;});
  if(waterMat){waterMat.map.offset.x=(world.time*.004)%1;waterMat.map.offset.y=(world.time*.0025)%1;waterMat.color.setHex(0x1d6f95).lerp(new THREE.Color(0x0b1c28),darkness*.85).lerp(new THREE.Color(0x3d5a66),wx.storm*.5);}
  // clouds thicken with the weather
  for(const s of cloudSprites){const b=s.userData.base;s.position.x=b.x+((world.time*(4+wx.windKt*.6))%3000)-1500;s.material.opacity=clamp(wx.cloud*1.2,.08,.95);s.material.color.setHex(0xffffff).lerp(new THREE.Color(0x5b6168),wx.storm*.7+wx.rain*.25).lerp(new THREE.Color(0x1c2230),darkness*.85).lerp(new THREE.Color(0xffb27a),dusk*.4);}
  // rain falls around the camera
  if(rainPts){
    const on=wx.rain>.05&&state==='play';rainPts.visible=on;
    if(on){const a=rainPts.geometry.attributes.position.array,W2=world.wind(),n=Math.floor(3000*wx.rain),c=camera.position;
      for(let i=0;i<3000;i++){const d=rainPts.userData.drops[i];if(i>=n){a.fill(0,i*6,i*6+6);continue;}
        d.y-=dt*22;d.x+=W2.x*dt*.3;d.z+=W2.z*dt*.3;if(d.y<-40){d.y=60;d.x=rnd(-80,80);d.z=rnd(-80,80);}
        const x=c.x+d.x,y=c.y+d.y,z=c.z+d.z;a[i*6]=x;a[i*6+1]=y;a[i*6+2]=z;a[i*6+3]=x-W2.x*.04;a[i*6+4]=y+1.8;a[i*6+5]=z-W2.z*.04;}
      rainPts.geometry.attributes.position.needsUpdate=true;rainPts.material.opacity=.2+wx.rain*.25;}
  }
  // windsocks point downwind and fill with the wind
  const W3=world.wind(),wy=Math.atan2(W3.x,W3.z),fill=clamp(W3.v/12,.15,1);
  for(const sk of socks){sk.rotation.y=wy-Math.PI/2;sk.rotation.z=-(1-fill)*1.1+Math.sin(world.time*3)*.04;}
  // PAPI lights show white above the glidepath, red below, seen from the camera
  for(const P of papis){const g=P.g,da=Math.max(1,(g.A.x-camera.position.x)*g.dx+(g.A.z-camera.position.z)*g.dz),angle=Math.atan2(camera.position.y-PAD_Y,da)*180/Math.PI;
    P.units.forEach((u,i)=>{u.material.color.setHex(da<0?0x000000:angle>P.th[i]?0xffffff:0xff2a2a);u.scale.setScalar(4+glow*8);});}
  if(gates.length&&player)gates.forEach((g,i)=>g.m&&g.m.material.color.setHex(i===player.gate%gates.length?0xffd23f:0x35d0e0));
  sun.shadow.camera.updateProjectionMatrix();
  refreshEnv(tod);
}
