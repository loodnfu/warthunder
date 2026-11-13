'use strict';
/* ---------- hangar showroom ---------- */
const show={scene:new THREE.Scene(),cam:new THREE.PerspectiveCamera(36,1,.5,4000),obj:null,key:'',yaw:-2.4,pitch:.2,dist:60,radius:20,drag:null,gh:3,idle:0};
show.scene.background=new THREE.Color(0x141c23);
show.scene.fog=new THREE.Fog(0x141c23,300,900);
show.scene.add(new THREE.HemisphereLight(0xdfe9f2,0x2a3038,.95));
{const d=new THREE.DirectionalLight(0xffffff,.65);d.position.set(.6,1,.5);show.scene.add(d);
 const fl=new THREE.Mesh(new THREE.CircleGeometry(600,64),new THREE.MeshLambertMaterial({color:0x232c34}));fl.rotation.x=-Math.PI/2;show.scene.add(fl);
 for(const r of[40,70,110,160]){const m=new THREE.Mesh(new THREE.RingGeometry(r,r+.6,96),new THREE.MeshBasicMaterial({color:0x34414c}));m.rotation.x=-Math.PI/2;m.position.y=.05;show.scene.add(m);}
 show.shadow=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshBasicMaterial({color:0x0b1014,transparent:true,opacity:.55,depthWrite:false}));show.shadow.rotation.x=-Math.PI/2;show.shadow.position.y=.08;show.scene.add(show.shadow);}
function refreshShow(){
  const key=myType+'|'+myLiv+'|'+(MODELS[myType]?1:0);
  if(key===show.key)return;show.key=key;
  if(show.obj)show.scene.remove(show.obj);
  const t=TYPES[myType],g=buildPlane(myType,0,true,LIVERIES[myLiv]);
  if(g.userData.gearNode){g.userData.gearNode.visible=true;g.userData.gearNode.scale.y=1;}
  for(const pv of g.userData.legs||[]){pv.rotation.x=0;pv.visible=true;}
  show.gh=MODELS[myType]?MODELS[myType].gearH:(t.r+1.95)*(t.cls?1.3:1.7);
  const holder=new THREE.Group();holder.add(g);g.position.y=show.gh;
  const sz=new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
  show.radius=Math.max(sz.x,sz.z)/2;show.dist=show.radius*3.1;show.shadow.scale.set(sz.x*.45,sz.z*.42,1);
  show.obj=holder;show.scene.add(holder);
}
function renderShow(dt){
  refreshShow();
  if(!show.drag){show.idle+=dt;if(show.idle>1.5)show.yaw+=dt*.22;}
  show.obj.rotation.y=show.yaw;show.shadow.rotation.z=show.yaw;
  const c=show.cam,mw=$('menu').offsetWidth||0;
  c.aspect=W/H;c.setViewOffset(W,H,-mw/2,H*.04,W,H);c.updateProjectionMatrix();
  const ty=show.gh*.8;
  c.position.set(0,ty+Math.sin(show.pitch)*show.dist,Math.cos(show.pitch)*show.dist);c.lookAt(0,ty,0);
  renderer.setClearColor(show.scene.background,1);renderer.clear();renderer.render(show.scene,c);
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,W,H);
}
const glc=$('gl');
glc.addEventListener('pointerdown',e=>{if(state!=='menu')return;show.drag={x:e.clientX,y:e.clientY};show.idle=0;});
window.addEventListener('pointermove',e=>{if(!show.drag)return;show.yaw+=(e.clientX-show.drag.x)*.008;show.pitch=clamp(show.pitch+(e.clientY-show.drag.y)*.005,-.05,1.3);show.drag={x:e.clientX,y:e.clientY};});
window.addEventListener('pointerup',()=>{show.drag=null;});
glc.addEventListener('wheel',e=>{if(state!=='menu')return;e.preventDefault();show.idle=0;show.dist=clamp(show.dist*(1+e.deltaY*.0012),show.radius*1.5,show.radius*7);},{passive:false});

