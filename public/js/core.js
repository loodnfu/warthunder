'use strict';
// Shared client globals: renderer, scenes, the current world and small helpers used by every module.
const $=id=>document.getElementById(id);
const S=window.CFSim;
const TAU=Math.PI*2;
const {TYPES,MAPS,KIND,RWYS,TEAM,PAD_Y,GS,ARENA,RADAR,BLAST,LETHAL,BSPD,AIR_FORCES,STANDS,rwGeo,gatePt,holdPt,kindOf,kt,ft}=S;
const clamp=S.clamp,rnd=S.rnd,angDiff=S.angDiff,mulberry=S.mulberry;
const nm=d=>(d/1852).toFixed(1)+' nm';
const hud=$('hud'),ctx=hud.getContext('2d');
const renderer=new THREE.WebGLRenderer({canvas:$('gl'),antialias:true,powerPreference:'high-performance'});
renderer.autoClear=false;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x9cc9e8);
scene.fog=new THREE.Fog(0x9cc9e8,3000,22000);
const camera=new THREE.PerspectiveCamera(72,1,1,60000);
camera.rotation.order='YXZ';scene.add(camera);
const hemi=new THREE.HemisphereLight(0xe6f2ff,0x3a5a6a,.72);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff2d8,.75);sun.position.set(.5,1,.3);scene.add(sun);scene.add(sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-260,right:260,top:260,bottom:-260,near:10,far:3000});sun.shadow.bias=-.0006;sun.shadow.normalBias=.6;
// the cockpit is drawn in a second pass with its own close-range camera
const cockScene=new THREE.Scene(),cockCam=new THREE.PerspectiveCamera(78,1,.05,20);
const cockHemi=new THREE.HemisphereLight(0xffffff,0x555555,.95);cockScene.add(cockHemi);
const cockSun=new THREE.DirectionalLight(0xffffff,.5);cockSun.position.set(.3,1,.6);cockScene.add(cockSun);

let W=0,H=0,DPR=1;
let state='menu',world=null,player=null,planes=[],BASES=[],missiles=[],bombs=[],net=null;
let time=0,view=0,cockOn=false,shake=0,hitFlash=0,killMsg=0,deaths=0,nukesHeld=1,nukeFlash=0;
let load={msl:99,ammo:400,flares:24,chaff:24,bombs:99},armOpen=false,rtb=false,twr={s:'',col:'#7ddc6f',hold:false},wantLand=false;
let feed=[],notices=[],lockTgt=null,lockT=0,beepT=0,awacs=[true,true],reserve=[0,0];
let myType='f35a',myLiv='raaf',myTeam=0,myName='',spawnKind='F',myMap='coral',myAF='raaf';
const input={mx:0,my:0,fire:false,keys:{}},fly={x:0,y:0,z:0,set:false};
const VIEWS=['COCKPIT','CHASE','WIDE CHASE','FLY-BY','BOMB CAM','REAR VIEW','TOWER','ORBIT'];
const F=new THREE.Vector3(),G=new THREE.Vector3(),_v=new THREE.Vector3();
const orbit={yaw:2.6,pitch:.25,dist:90};
const SPH=new THREE.SphereGeometry(1,20,14);

// world helpers used by the HUD, cameras and effects
function fwd(p,o){const c=Math.cos(p.pitch);return o.set(Math.sin(p.yaw)*c,Math.sin(p.pitch),Math.cos(p.yaw)*c);}
const ground=(x,z)=>world?world.ground(x,z):0;
const padAt=(x,z)=>world?world.padAt(x,z):-1;
const onRunway=(x,z)=>!!(world&&world.onRunway(x,z));
const rwAxis=(b,x,z)=>world.rwAxis(b,x,z);
const homeBase=p=>world.homeBase(p);
const baseOf=(t,k)=>world.baseOf(t,k);
const stallOf=p=>world.stallOf(p);
const inbound=p=>{for(const m of missiles)if(m.tgt===p&&Math.hypot(m.x-p.x,m.y-p.y,m.z-p.z)<2200)return m;return null;};
const bombFall=p=>world.bombFall(p);
const canSee=e=>!player||awacs[player.team]||Math.hypot(e.x-player.x,e.y-player.y,e.z-player.z)<RADAR;
const lrwOf=p=>p.lrw>=0?p.lrw:homeBase(p).act;
let gateIdx=0,gates=[];

let _glow=null;
function glowTex(){
  if(_glow)return _glow;
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.85)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,64,64);return _glow=new THREE.CanvasTexture(c);
}
function notice(s,col){notices.unshift({s,col:col||'#eef3f5',t:5});if(notices.length>3)notices.pop();}
function addFeed(k,v,how){feed.unshift({k,v,how,t:7});if(feed.length>6)feed.pop();}
