/* Coral Front — shared simulation.
   Runs in the browser (single player, and the local aircraft in multiplayer) and in Node on the
   multiplayer server, which is authoritative for AI, weapons, damage, airports, weather and ATC.
   Nothing in here touches rendering: the world reports what happened through world.events. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.CFSim=factory();
})(typeof self!=='undefined'?self:this,function(){
'use strict';
const TAU=Math.PI*2,D2R=Math.PI/180;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rnd=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
function angDiff(a,b){let d=(a-b)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;}
function mulberry(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const kt=v=>Math.round(v*1.944),ft=m=>Math.round(m*3.281/10)*10;
const hdgOf=yaw=>((Math.round(-yaw/D2R)%360)+360)%360||360;
const hdgStr=yaw=>String(Math.round(hdgOf(yaw)/10)*10||360).padStart(3,'0');

const ARENA=8000,BSPD=1000,LETHAL=1000,BLAST=1900,RADAR=3500,PAD_Y=9,BR=1000,GS=Math.tan(3*D2R),G=9.81;
const TEAM=[{name:'Blue',col:'#4db4ff',hex:0x4db4ff},{name:'Red',col:'#ff5a4d',hex:0xff5a4d}];

/* ---------- aircraft ---------------------------------------------------------------
   cls 0 fighter/attack/trainer · 1 bomber · 2 surveillance/ISR · 3 transport/tanker
   Flight: max (m/s game scale), agil, hp, mass (t), msl (count), mslName, bombs.
   Shape fields drive the procedural model when no real model is available.          */
const TYPES={
  // ---- USAF
  f22:{name:'F-22A',full:'F-22 Raptor',cls:0,af:'usaf',model:'f22',max:260,agil:1.1,hp:110,mass:29,msl:6,mslName:'AIM-120D',len:19,r:1.05,flat:1.35,wing:[3.6,-5.4,-3.4,-4.8,6.8],tail:[-5.6,-9.4,-8.4,-9.8,4.2],fins:2,finH:3.3,cant:.48,eng:2,intake:'side',gold:1,col:0x7b858f,stick:'side',hud:[.38,.32],mfd:3},
  f35a:{name:'F-35A',full:'F-35A Lightning II',cls:0,af:'usaf',model:'f35',max:225,agil:.95,hp:120,mass:22,msl:4,mslName:'AIM-120D',len:15.6,r:1.05,flat:1.3,wing:[2.4,-4.4,-2.8,-4,5.4],tail:[-4.8,-7.8,-6.8,-8,3.4],fins:2,finH:2.9,cant:.4,eng:1,intake:'side',gold:1,col:0x6c747d,stick:'side',hud:null,mfd:1},
  f35b:{name:'F-35B',full:'F-35B Lightning II',cls:0,af:'raf',model:'f35',max:215,agil:.92,hp:120,mass:23,msl:4,mslName:'AIM-120D',len:15.6,r:1.05,flat:1.3,wing:[2.4,-4.4,-2.8,-4,5.3],tail:[-4.8,-7.8,-6.8,-8,3.4],fins:2,finH:2.9,cant:.4,eng:1,intake:'side',gold:1,col:0x6c747d,stick:'side',hud:null,mfd:1,stol:1},
  f15c:{name:'F-15C',full:'F-15 Eagle',cls:0,af:'usaf',model:'f15c',max:255,agil:1.02,hp:115,mass:25,msl:8,mslName:'AIM-120C',len:19.4,r:1,flat:1.4,wing:[2.6,-4.8,-3.6,-4.8,6.5],tail:[-6.4,-9,-8.6,-9.6,4],fins:2,finH:3.4,cant:0,eng:2,intake:'side',col:0x8d969f,stick:'centre',hud:[.38,.32],mfd:2},
  f15e:{name:'F-15E',full:'F-15E Strike Eagle',cls:0,af:'usaf',model:'f15e',max:250,agil:.98,hp:130,mass:31,msl:4,mslName:'AIM-120C',bombs:8,len:19.4,r:1,flat:1.4,wing:[2.6,-4.8,-3.6,-4.8,6.5],tail:[-6.4,-9,-8.6,-9.6,4],fins:2,finH:3.4,cant:0,eng:2,intake:'side',col:0x5d6670,stick:'centre',hud:[.38,.32],mfd:3},
  f15ex:{name:'F-15EX',full:'F-15EX Eagle II',cls:0,af:'usaf',model:'f15c',max:255,agil:1,hp:130,mass:30,msl:10,mslName:'AIM-120D',len:19.4,r:1,flat:1.4,wing:[2.6,-4.8,-3.6,-4.8,6.5],tail:[-6.4,-9,-8.6,-9.6,4],fins:2,finH:3.4,cant:0,eng:2,intake:'side',col:0x7f8891,stick:'centre',hud:[.4,.32],mfd:1},
  f16:{name:'F-16C',full:'F-16 Fighting Falcon',cls:0,af:'usaf',model:'f16',max:235,agil:1.05,hp:100,mass:12,msl:4,mslName:'AIM-9X',len:15,r:.8,wing:[1.8,-3.4,-1.8,-3.2,4.8],lerx:3.2,tail:[-5,-7.2,-6.4,-7.4,2.8],fins:1,finH:3.3,eng:1,intake:'chin',col:0x8a929c,stick:'side',hud:[.32,.32],mfd:2},
  a10:{name:'A-10C',full:'A-10 Thunderbolt II',cls:0,af:'usaf',model:'a10',max:190,agil:.85,hp:170,mass:14,msl:2,mslName:'AIM-9M',bombs:8,len:16.3,r:.9,wing:[1.2,-1.6,.4,-1.2,8.8],tail:[-6.2,-7.6,-6.6,-7.8,2.8],fins:2,finH:3,cant:0,twinTail:1,eng:2,podsTop:1,col:0x6b7176,stick:'centre',hud:[.34,.3],mfd:2,straight:1},
  b1:{name:'B-1B',full:'B-1B Lancer',cls:1,af:'usaf',model:'b1',max:205,agil:.36,hp:450,mass:150,msl:0,bombs:48,len:44,r:1.6,flat:1.3,swing:1,wy:.3,tail:[-17.5,-21,-20,-21.8,6.6],tailY:3.4,fins:1,finH:7.5,pods:[[2.7,-4]],twin:1,col:0x4a5056,stick:'centre',hud:null,mfd:2,thrN:4},
  b2:{name:'B-2A',full:'B-2 Spirit',cls:1,af:'usaf',model:'b2',max:190,agil:.34,hp:420,mass:150,msl:0,bombs:40,len:21,r:1.8,flying:1,span:26,col:0x3f454b,stick:'centre',hud:null,mfd:3,thrN:4},
  b52:{name:'B-52H',full:'B-52 Stratofortress',cls:1,af:'usaf',model:'b52',max:165,agil:.26,hp:520,mass:180,msl:0,bombs:60,len:48,r:1.9,wy:1.4,wing:[9,2,-8,-12,28],tail:[-19,-23,-21.5,-23.5,8],fins:1,finH:10.5,pods:[[9.5,3],[18,-3]],twin:1,col:0x6b7075,stick:'yoke',hud:null,mfd:2,thrN:8},
  c5:{name:'C-5M',full:'C-5M Super Galaxy',cls:3,af:'usaf',model:'c5',max:160,agil:.22,hp:600,mass:380,len:75,r:3.4,wy:2.6,high:1,tTail:1,wing:[10,0,-10,-16,34],tail:[-30,-35,-33,-36,10],tailY:13,fins:1,finH:12,pods:[[10,4],[20,-2]],col:0x6f777e,stick:'yoke',hud:null,mfd:3,thrN:4,rev:1},
  c17:{name:'C-17A',full:'C-17 Globemaster III',cls:3,af:'usaf',model:'c17',max:160,agil:.26,hp:520,mass:265,len:53,r:3,wy:2.3,high:1,tTail:1,wing:[7,0,-8,-11,25],tail:[-21,-25,-23.5,-26,9],tailY:11,fins:1,finH:10,pods:[[8,4],[15,0]],col:0x707880,stick:'side',hud:[.5,.3],mfd:3,thrN:4,rev:1,stol:1},
  c130:{name:'C-130H',full:'C-130 Hercules',cls:3,af:'usaf',model:'c130',max:140,agil:.32,hp:380,mass:70,len:30,r:2.2,wy:1.9,high:1,wing:[3.5,0,-1.5,-2.6,20],tail:[-12,-14.5,-13.4,-14.8,7],tailY:1.2,fins:1,finH:7.5,props:[[5,2.6],[10.2,2.2]],col:0x6e7880,stick:'yoke',hud:null,mfd:2,thrN:4,rev:1,stol:1},
  ac130:{name:'AC-130J',full:'AC-130J Ghostrider',cls:3,af:'usaf',model:'c130',max:140,agil:.32,hp:420,mass:75,gun:1,len:30,r:2.2,wy:1.9,high:1,wing:[3.5,0,-1.5,-2.6,20],tail:[-12,-14.5,-13.4,-14.8,7],tailY:1.2,fins:1,finH:7.5,props:[[5,2.6],[10.2,2.2]],col:0x41474c,stick:'yoke',hud:[.4,.3],mfd:3,thrN:4,rev:1},
  kc135:{name:'KC-135R',full:'KC-135 Stratotanker',cls:3,af:'usaf',model:'b707',max:170,agil:.26,hp:420,mass:140,len:41,r:1.9,wy:-1,wing:[6,-1,-8,-11,19.8],tail:[-16,-19.5,-18.5,-20,6.8],fins:1,finH:8,pods:[[6.5,3.6],[12.5,1]],liner:1,col:0x8c949b,stick:'yoke',hud:null,mfd:2,thrN:4,rev:1},
  kc46:{name:'KC-46A',full:'KC-46 Pegasus',cls:3,af:'usaf',model:'kc46',max:175,agil:.26,hp:430,mass:180,len:50,r:2.5,wy:-1.2,wing:[7,-1.5,-9,-12,24],tail:[-20,-24,-22.5,-24.5,8],fins:1,finH:9,pods:[[7.6,4.6]],liner:1,col:0x9aa1a7,stick:'yoke',hud:null,mfd:3,thrN:2,rev:1},
  u2:{name:'U-2S',full:'U-2 Dragon Lady',cls:2,af:'usaf',max:150,agil:.4,hp:160,mass:18,len:19,r:.9,glider:1,wing:[1.4,-1,.2,-.8,15.5],tail:[-7.4,-8.8,-8,-9,3],fins:1,finH:3,eng:1,intake:'side',col:0x2e3338,stick:'yoke',hud:null,mfd:2,awacs:1},
  rq4:{name:'RQ-4B',full:'RQ-4 Global Hawk',cls:2,af:'usaf',max:140,agil:.35,hp:150,mass:14,drone:1,len:14.5,r:.8,glider:1,wing:[1,-.6,.2,-.4,19.8],vtail:1,engTop:1,col:0xb7bdc2,stick:'side',hud:null,mfd:2,awacs:1},
  mq9:{name:'MQ-9A',full:'MQ-9 Reaper',cls:0,af:'usaf',model:'mq9',max:115,agil:.55,hp:90,mass:4.8,drone:1,msl:4,mslName:'AGM-114',bombs:2,len:11,r:.55,wing:[.6,-.4,.2,-.2,10],vtail:1,pusher:1,col:0x8f969c,stick:'side',hud:null,mfd:2},
  // ---- RAF
  ef:{name:'Typhoon FGR4',full:'Eurofighter Typhoon',cls:0,af:'raf',model:'ef',max:250,agil:1.08,hp:100,mass:16,msl:6,mslName:'METEOR',len:16,r:.9,wing:[2.6,-6.9,-5.8,-6.9,5.5],canard:1,fins:1,finH:3.6,eng:2,intake:'chin',col:0xa2a9b0,stick:'centre',hud:[.44,.32],mfd:3},
  a400:{name:'A400M',full:'A400M Atlas',cls:3,af:'raf',model:'a400',max:150,agil:.3,hp:420,mass:120,len:45,r:2.6,wy:2.2,high:1,tTail:1,wing:[4.5,0,-2.5,-4,21],tail:[-17,-20.5,-19,-21,8.5],tailY:9.5,fins:1,finH:9,props:[[6.5,3],[12.4,2.5]],col:0x666e75,stick:'side',hud:[.45,.3],mfd:3,thrN:4,rev:1,stol:1},
  voyager:{name:'Voyager KC2',full:'Voyager KC2/KC3 (A330 MRTT)',cls:3,af:'raf',model:'a330',max:180,agil:.24,hp:460,mass:230,len:59,r:2.8,wy:-1.4,wing:[9,-2,-11,-14,30],tail:[-24,-28.5,-26.6,-29,9.5],fins:1,finH:9.5,pods:[[10,6]],liner:1,col:0x9aa2a8,stick:'side',hud:null,mfd:3,thrN:2,rev:1},
  rc135:{name:'RC-135W',full:'RC-135W Rivet Joint',cls:2,af:'raf',model:'b707',max:170,agil:.26,hp:420,mass:135,len:41,r:1.9,wy:-1,wing:[6,-1,-8,-11,19.8],tail:[-16,-19.5,-18.5,-20,6.8],fins:1,finH:8,pods:[[6.5,3.6],[12.5,1]],liner:1,cheeks:1,col:0x8a939a,stick:'yoke',hud:null,mfd:2,thrN:4,awacs:1,rev:1},
  p8:{name:'P-8A',full:'P-8A Poseidon',cls:2,af:'raf',model:'b737',max:165,agil:.3,hp:300,mass:85,len:38,r:1.9,wy:-1,wing:[5.5,-2,-7,-9.5,18.8],tail:[-15,-18.5,-17.5,-19,6.5],fins:1,finH:7.8,pods:[[5.8,3.6]],liner:1,col:0xa9b0b7,stick:'yoke',hud:null,mfd:2,thrN:2,awacs:1,rev:1},
  e7:{name:'E-7A',full:'E-7 Wedgetail',cls:2,af:'raaf',model:'b737',max:160,agil:.3,hp:300,mass:77,len:34,r:1.9,wy:-1,wing:[5,-2.5,-6,-8.5,17],tail:[-13,-16.5,-15.5,-17,6.5],fins:1,finH:7.5,pods:[[5.6,3.2]],radar:1,liner:1,col:0xc8cdd2,stick:'yoke',hud:null,mfd:2,thrN:2,awacs:1,rev:1},
  hawk:{name:'Hawk T2',full:'BAE Hawk T2',cls:0,af:'raf',max:180,agil:1.02,hp:80,mass:7,msl:2,mslName:'AIM-9L',len:12.4,r:.75,wing:[1.4,-1.8,-.7,-1.6,4.9],tail:[-4.4,-5.8,-5.2,-6,2.3],fins:1,finH:2.6,eng:1,intake:'side',tandem:1,col:0x2d3237,stick:'centre',hud:[.3,.28],mfd:2},
  ch47:{name:'Chinook HC6',full:'CH-47 Chinook',cls:3,af:'raf',model:'ch47',max:78,agil:.6,hp:300,mass:22,heli:1,len:30,r:1.9,rotors:[[8.5,1.6],[-7.5,3.4]],rotorR:9.2,col:0x4f5952,stick:'centre',hud:null,mfd:2,thrN:1},
  // ---- RAAF
  f18f:{name:'F/A-18F',full:'F/A-18F Super Hornet',cls:0,af:'raaf',model:'f18',max:220,agil:1,hp:115,mass:21,msl:6,mslName:'AIM-120C',bombs:4,len:18,r:.9,wing:[1.2,-3.8,-1.6,-3.4,6.2],lerx:4.6,tail:[-6.2,-8.6,-7.8,-9,3.6],fins:2,finH:3.1,cant:.35,eng:2,intake:'side',tandem:1,col:0x9aa2ab,stick:'centre',hud:[.36,.32],mfd:3},
  ea18g:{name:'EA-18G',full:'EA-18G Growler',cls:0,af:'raaf',model:'f18',max:215,agil:.97,hp:120,mass:22,msl:2,mslName:'AIM-120C',jam:1,len:18,r:.9,wing:[1.2,-3.8,-1.6,-3.4,6.2],lerx:4.6,tail:[-6.2,-8.6,-7.8,-9,3.6],fins:2,finH:3.1,cant:.35,eng:2,intake:'side',tandem:1,col:0x8a939b,stick:'centre',hud:[.36,.32],mfd:3},
  hawk127:{name:'Hawk 127',full:'BAE Hawk 127 Lead-In Fighter',cls:0,af:'raaf',max:185,agil:1.03,hp:80,mass:7,msl:2,mslName:'AIM-9M',len:12.4,r:.75,wing:[1.4,-1.8,-.7,-1.6,4.9],tail:[-4.4,-5.8,-5.2,-6,2.3],fins:1,finH:2.6,eng:1,intake:'side',tandem:1,col:0x6f7881,stick:'centre',hud:[.3,.28],mfd:2},
  c130j:{name:'C-130J',full:'C-130J Hercules',cls:3,af:'raaf',model:'c130',max:150,agil:.33,hp:380,mass:70,len:30,r:2.2,wy:1.9,high:1,wing:[3.5,0,-1.5,-2.6,20],tail:[-12,-14.5,-13.4,-14.8,7],tailY:1.2,fins:1,finH:7.5,props:[[5,2.6],[10.2,2.2]],col:0x737c84,stick:'yoke',hud:[.4,.3],mfd:3,thrN:4,rev:1,stol:1},
  c27j:{name:'C-27J',full:'C-27J Spartan',cls:3,af:'raaf',max:140,agil:.38,hp:260,mass:30,len:22.7,r:1.7,wy:1.5,high:1,tTail:1,wing:[2.4,0,-1,-1.8,14.4],tail:[-9,-11.2,-10.3,-11.5,4.6],tailY:5.6,fins:1,finH:5.4,props:[[4.6,2.2]],col:0x6c757c,stick:'yoke',hud:null,mfd:3,thrN:2,rev:1,stol:1},
  kc30:{name:'KC-30A',full:'KC-30A MRTT',cls:3,af:'raaf',model:'a330',max:180,agil:.24,hp:460,mass:230,len:59,r:2.8,wy:-1.4,wing:[9,-2,-11,-14,30],tail:[-24,-28.5,-26.6,-29,9.5],fins:1,finH:9.5,pods:[[10,6]],liner:1,col:0x9aa2a8,stick:'side',hud:null,mfd:3,thrN:2,rev:1},
  mq4c:{name:'MQ-4C',full:'MQ-4C Triton',cls:2,af:'raaf',max:145,agil:.34,hp:150,mass:15,drone:1,len:14.5,r:.8,glider:1,wing:[1,-.6,.2,-.4,19.8],vtail:1,engTop:1,col:0xc3c8cc,stick:'side',hud:null,mfd:2,awacs:1},
  mc55:{name:'MC-55A',full:'MC-55A Peregrine',cls:2,af:'raaf',max:190,agil:.4,hp:220,mass:41,len:29.4,r:1.3,wy:-.6,wing:[3.5,-1,-4,-5.4,14.4],tail:[-11.6,-14,-13.4,-14.6,5],tailY:4.6,tTail:1,fins:1,finH:5,rearPods:1,liner:1,col:0xc0c5ca,stick:'yoke',hud:[.4,.28],mfd:3,thrN:2,awacs:1,rev:1},
  pc21:{name:'PC-21',full:'Pilatus PC-21',cls:0,af:'raaf',model:'pc21',max:150,agil:1.05,hp:60,mass:3.1,msl:0,len:11.2,r:.7,wing:[.9,-.9,.2,-.6,4.5],tail:[-4.4,-5.4,-5,-5.6,2],fins:1,finH:2,props:[[0,0]],nose:1,tandem:1,col:0xe8ebed,stick:'centre',hud:[.3,.26],mfd:2},
  // ---- other fighters and bombers
  f18e:{name:'F/A-18E',full:'F/A-18E Super Hornet',cls:0,af:'usn',model:'f18',max:220,agil:1,hp:115,mass:21,msl:6,mslName:'AIM-9X',len:18,r:.9,wing:[1.2,-3.8,-1.6,-3.4,6.2],lerx:4.6,tail:[-6.2,-8.6,-7.8,-9,3.6],fins:2,finH:3.1,cant:.35,eng:2,intake:'side',col:0x9aa2ab,stick:'centre',hud:[.36,.32],mfd:3},
  rafale:{name:'Rafale C',full:'Dassault Rafale',cls:0,af:'fr',max:245,agil:1.08,hp:105,mass:15,msl:6,mslName:'MICA',len:15.3,r:.85,delta:1,wing:[1.5,-6.6,-5.4,-6.6,5.4],canard:1,fins:1,finH:3.4,eng:2,intake:'side',col:0x86909a,stick:'side',hud:[.4,.3],mfd:3},
  gripen:{name:'Gripen E',full:'Saab JAS 39 Gripen E',cls:0,af:'other',max:235,agil:1.1,hp:95,mass:11,msl:6,mslName:'METEOR',len:15.2,r:.8,delta:1,wing:[1.4,-6.2,-5,-6.2,4.3],canard:1,fins:1,finH:3.2,eng:1,intake:'side',col:0x8b939c,stick:'centre',hud:[.4,.3],mfd:1},
  m2000:{name:'Mirage 2000-5',full:'Dassault Mirage 2000',cls:0,af:'fr',model:'m2000',max:240,agil:1.02,hp:95,mass:12,msl:4,mslName:'MICA',len:14.4,r:.8,delta:1,wing:[1,-5.6,-5,-5.6,4.5],fins:1,finH:3.4,eng:1,intake:'side',col:0x7f8a95,stick:'centre',hud:[.36,.3],mfd:2},
  kf21:{name:'KF-21',full:'KAI KF-21 Boramae',cls:0,af:'other',max:240,agil:1.03,hp:110,mass:17,msl:6,mslName:'METEOR',len:16.9,r:1,flat:1.3,wing:[3,-4.6,-3,-4.4,5.6],tail:[-5.2,-8.2,-7.2,-8.4,3.4],fins:2,finH:3.1,cant:.45,eng:2,intake:'side',col:0x7a838c,stick:'side',hud:[.38,.32],mfd:1},
  jf17:{name:'JF-17',full:'JF-17 Thunder',cls:0,af:'other',max:220,agil:1.02,hp:90,mass:9,msl:4,mslName:'PL-5E',len:14.9,r:.8,wing:[1.8,-3.4,-1.8,-3.2,4.7],lerx:3.4,tail:[-5,-7,-6.3,-7.2,2.8],fins:1,finH:3.2,eng:1,intake:'side',col:0x828b93,stick:'centre',hud:[.34,.3],mfd:3},
  su27:{name:'Su-27',full:'Sukhoi Su-27 Flanker',cls:0,af:'ru',model:'su27',max:250,agil:1.04,hp:115,mass:23,msl:6,mslName:'R-27',len:21.9,r:1,flat:1.3,wing:[3.6,-5,-4,-5.6,7.4],tail:[-7.6,-10,-9.6,-10.6,4.2],fins:2,finH:3.6,cant:0,eng:2,intake:'chin',col:0x7b8ea5,stick:'centre',hud:[.38,.3],mfd:0},
  su30:{name:'Su-30SM',full:'Sukhoi Su-30 Flanker-C',cls:0,af:'ru',model:'su27',max:250,agil:1.06,hp:120,mass:26,msl:6,mslName:'R-77',len:21.9,r:1,flat:1.3,wing:[3.6,-5,-4,-5.6,7.4],tail:[-7.6,-10,-9.6,-10.6,4.2],fins:2,finH:3.6,cant:0,eng:2,intake:'chin',canard:1,tandem:1,col:0x7b8ea5,stick:'centre',hud:[.38,.3],mfd:2},
  su35:{name:'Su-35S',full:'Sukhoi Su-35 Flanker-E',cls:0,af:'ru',model:'su27',max:255,agil:1.12,hp:120,mass:25,msl:8,mslName:'R-77',len:21.9,r:1,flat:1.3,wing:[3.6,-5,-4,-5.6,7.4],tail:[-7.6,-10,-9.6,-10.6,4.2],fins:2,finH:3.6,cant:0,eng:2,intake:'chin',col:0x6a7e95,stick:'centre',hud:[.4,.3],mfd:2},
  su34:{name:'Su-34',full:'Sukhoi Su-34 Fullback',cls:1,af:'ru',max:215,agil:.8,hp:200,mass:39,msl:2,mslName:'R-73',bombs:16,len:23.3,r:1.2,flat:1.3,wing:[3.6,-5,-4,-5.6,7.4],tail:[-8.2,-10.8,-10.2,-11.4,4.2],fins:2,finH:3.6,eng:2,intake:'chin',canard:1,flatNose:1,col:0x76889d,stick:'centre',hud:[.4,.3],mfd:2},
  su57:{name:'Su-57',full:'Sukhoi Su-57 Felon',cls:0,af:'ru',max:265,agil:1.12,hp:115,mass:28,msl:6,mslName:'R-77M',len:20.1,r:1.05,flat:1.45,wing:[3.8,-5.8,-4.6,-6,7],lerx:3,tail:[-7,-9.6,-9,-10,4],fins:2,finH:3,cant:.5,eng:2,intake:'side',col:0x6f7f93,stick:'centre',hud:[.42,.32],mfd:2},
  su75:{name:'Su-75',full:'Sukhoi Su-75 Checkmate',cls:0,af:'ru',max:240,agil:1,hp:105,mass:18,msl:5,mslName:'R-77',len:17.5,r:1,flat:1.2,wing:[3.2,-6,-4.4,-6.2,6],fins:2,finH:3.5,cant:.62,eng:1,intake:'chin',col:0x6a7889,stick:'centre',hud:[.42,.32],mfd:2},
  mig29:{name:'MiG-29',full:'Mikoyan MiG-29 Fulcrum',cls:0,af:'ru',model:'mig29',max:240,agil:1.08,hp:100,mass:15,msl:6,mslName:'R-73',len:17.3,r:.9,flat:1.3,wing:[3,-4.4,-3.4,-4.6,5.7],lerx:3,tail:[-6.2,-8.2,-7.8,-8.6,3.6],fins:2,finH:3.2,cant:.1,eng:2,intake:'chin',col:0x7d8e9f,stick:'centre',hud:[.36,.3],mfd:0},
  mig35:{name:'MiG-35',full:'Mikoyan MiG-35 Fulcrum-F',cls:0,af:'ru',model:'mig29',max:245,agil:1.1,hp:105,mass:17,msl:6,mslName:'R-77',len:17.3,r:.9,flat:1.3,wing:[3,-4.4,-3.4,-4.6,5.7],lerx:3,tail:[-6.2,-8.2,-7.8,-8.6,3.6],fins:2,finH:3.2,cant:.1,eng:2,intake:'chin',col:0x6f8193,stick:'centre',hud:[.38,.3],mfd:3},
  mig31:{name:'MiG-31',full:'Mikoyan MiG-31 Foxhound',cls:0,af:'ru',max:290,agil:.82,hp:130,mass:41,msl:4,mslName:'R-33',len:22.7,r:1.15,flat:1.35,wing:[2.6,-4.6,-3.6,-4.8,6.7],tail:[-8,-10.8,-10,-11.2,4.4],fins:2,finH:3.8,cant:.1,eng:2,intake:'side',tandem:1,col:0x8c97a2,stick:'centre',hud:[.34,.3],mfd:0},
  j20:{name:'J-20',full:'Chengdu J-20 Mighty Dragon',cls:0,af:'cn',max:255,agil:1.02,hp:115,mass:34,msl:6,mslName:'PL-15',len:20.4,r:1.1,flat:1.4,delta:1,wing:[2.4,-6.6,-5.6,-6.8,6.5],canard:1,fins:2,finH:2.8,cant:.45,eng:2,intake:'side',gold:1,col:0x5b6470,stick:'side',hud:[.4,.32],mfd:1},
  j10c:{name:'J-10C',full:'Chengdu J-10C',cls:0,af:'cn',max:240,agil:1.08,hp:100,mass:14,msl:6,mslName:'PL-15',len:16.9,r:.85,delta:1,wing:[1,-6.4,-5.2,-6.6,4.7],canard:1,fins:1,finH:3.6,eng:1,intake:'chin',col:0x8b95a0,stick:'centre',hud:[.38,.3],mfd:3}
};
// 3D models (FlightGear, GPL) for types that share or have their own airframe
Object.assign(TYPES.gripen,{model:'gripen'});Object.assign(TYPES.su57,{model:'su57'});Object.assign(TYPES.su30,{model:'su37'});
Object.assign(TYPES.u2,{model:'u2'});Object.assign(TYPES.hawk,{model:'hawk'});Object.assign(TYPES.hawk127,{model:'hawk'});Object.assign(TYPES.kc46,{model:'b767'});
for(const k in TYPES){
  const t=TYPES[k];t.id=k;t.msl=t.msl||0;t.bombs=t.bombs||0;
  t.gun=t.gun!==undefined?t.gun:(t.cls===0||k==='ac130')?1:0;
  t.mslKind=/AIM-9|R-73|PL-5|AGM/.test(t.mslName||'')?'ir':'rdr';
  t.minSpd=t.heli?0:t.cls?78:92;
  if(t.stol)t.minSpd*=.86;if(t.glider)t.minSpd*=.8;if(t.drone)t.minSpd=Math.min(t.minSpd,62);
  t.gearLimit=t.af==='usn'||k.startsWith('f18')||k==='ea18g'?8:t.cls===0?6:t.mass>150?3.6:4.5;
  t.inertia=clamp(Math.pow(t.mass/20,.25),.7,2.2);
}
const AIR_FORCES={
  usaf:{name:'USAF',types:['f22','f35a','f15c','f15e','f15ex','f16','a10','b1','b2','b52','c5','c17','c130','ac130','kc135','kc46','u2','rq4','mq9']},
  raf:{name:'RAF',types:['ef','f35b','a400','c17','voyager','rc135','p8','e7','hawk','ch47']},
  raaf:{name:'RAAF',types:['f35a','f18f','ea18g','hawk127','c17','c130j','c27j','kc30','p8','e7','mq4c','mc55','pc21']},
  other:{name:'Other nations',types:['f18e','rafale','m2000','gripen','kf21','jf17','su27','su30','su35','su34','su57','su75','mig29','mig35','mig31','j20','j10c']}
};
const FLEET={
  blueF:['f22','f35a','f15e','f16','f18f','ef','rafale','gripen','f15ex','ea18g','kf21','f15c'],
  redF:['su57','su35','su30','j20','j10c','mig29','mig31','su27','mig35','su75','jf17'],
  blueB:['b1','b2','b52'],redB:['su34'],
  blueS:['e7','p8','rc135'],redS:['p8'],
  blueT:['c17','c130j','a400','kc46','kc30','c5','voyager','c27j'],redT:['a400','c130']
};
const kindOf=cls=>cls===1?'B':cls>=2?'S':'F';
const NAMES=[['Magpie','Dingo','Kestrel','Brolga','Wombat','Galah','Kookaburra','Taipan','Quoll','Bilby','Numbat','Echidna'],['Viper','Jackal','Raven','Cobra','Hornet','Shrike','Mamba','Krait','Lynx','Wraith','Talon','Saber']];
const DIFF={easy:{skill:[.25,.5],agil:.72,aim:2,msl:.5,flare:.4},normal:{skill:[.45,.8],agil:.85,aim:1.2,msl:1,flare:.8},hard:{skill:[.7,.95],agil:.95,aim:.8,msl:1.3,flare:1.1},expert:{skill:[.9,1],agil:1.03,aim:.5,msl:1.6,flare:1.4}};

/* ---------- airfields ------------------------------------------------------------- */
const KIND={F:{name:'Fighter base',short:'FTR'},S:{name:'Support base',short:'SUP'},B:{name:'Bomber base',short:'BMR'}};
const BASE_NAMES=[{F:'Kestrel Field',S:'Wedgetail Field',B:'Lancer Field'},{F:'Viper Field',S:'Mainstay Field',B:'Blackjack Field'}];
const RWYS=[{name:'36',dx:0,dz:1},{name:'18',dx:0,dz:-1},{name:'09',dx:-1,dz:0},{name:'27',dx:1,dz:0}];
// 14 stands on the apron, 7 each side of the cross runway, which keeps a clear gap through the middle of the apron
const STANDS=[];for(let k=0;k<7;k++)STANDS.push(-(130+74*k),130+74*k);STANDS.sort((a,b)=>a-b);
// base furniture in base-local coordinates (lx is mirrored by base side s, so + points away from the runway)
function baseLayout(kind){
  const B=[],add=(type,lx,lz,w,d,h,extra)=>B.push(Object.assign({type,lx,lz,w,d,h},extra||{}));
  // nothing may stand in the cross runway's strip (|lz|<100) or on taxiways Bravo/Charlie (|lz| 172-208 out to lx 690)
  if(kind==='F'){for(const q of[[590,-560],[590,-460],[590,-360],[590,-260],[590,260],[590,360],[590,460],[680,-560]])add('shelter',q[0],q[1],46,40,15);}
  else for(const lz of[-480,-290,330])add('hangar',600,lz,120,150,34);
  add('tower',790,150,22,22,48);
  add('fire',520,-130,46,30,11);
  add('terminal',640,520,170,60,16);
  add('maint',720,-330,70,50,14);add('maint',720,-420,60,40,11);
  add('fuel',770,-560,14,14,15);add('fuel',800,-560,14,14,15);add('fuel',770,-520,14,14,15);add('fuel',800,-520,14,14,15);
  add('ops',720,330,60,40,12);add('carpark',780,420,80,110,0);add('gatehouse',930,-90,10,8,4);
  return B;
}
function rwGeo(b,r){
  const R=RWYS[r];
  return{r,name:R.name,dx:R.dx,dz:R.dz,px:R.dz,pz:-R.dx,ns:R.dx===0,axis:R.dx===0?'ns':'ew',yaw:Math.atan2(R.dx,R.dz),
    T:{x:b.x-R.dx*650,z:b.z-R.dz*650},A:{x:b.x-R.dx*490,z:b.z-R.dz*490},E:{x:b.x+R.dx*690,z:b.z+R.dz*690}};
}
function gatePt(b,r){const g=rwGeo(b,r);return{x:g.A.x-g.dx*4500,z:g.A.z-g.dz*4500,y:PAD_Y+5+4500*GS};}
function holdPt(b,r){
  const g=rwGeo(b,r),sg=Math.sign(g.px*b.x+g.pz*b.z)||1;
  return{x:g.A.x-g.dx*3500+g.px*sg*2500,z:g.A.z-g.dz*3500+g.pz*sg*2500,y:900};
}
function makeBases(){
  const out=[];
  for(let t=0;t<2;t++)for(const q of[['F',6800,0],['S',7800,-5600],['B',7800,5600]]){
    const b={i:out.length,team:t,kind:q[0],x:(t?1:-1)*q[1],z:q[2],s:t?-1:1,name:BASE_NAMES[t][q[0]],hp:100,act:0,next:0,rw:null,t:0,
      quiet:0,closed:{ns:false,ew:false},repair:null,fire:null};
    b.bld=baseLayout(q[0]).map((o,i)=>Object.assign(o,{id:i,x:b.x+b.s*o.lx,z:b.z+o.lz,dmg:0}));
    out.push(b);
  }
  return out;
}
function clearZone(bases,x,z,w){
  w=w||900;
  for(const b of bases){
    const ax=x-b.x,az=z-b.z;
    if((Math.abs(az)<w&&Math.abs(ax)<7200)||(Math.abs(ax)<w&&Math.abs(az)<7200))return true;
    for(let r=0;r<4;r++){const h=holdPt(b,r);if(Math.hypot(x-h.x,z-h.z)<1300)return true;}
  }
  return false;
}

/* ---------- terrain (deterministic, shared by every client and the server) ---------- */
const MAPS={
  coral:{name:'Coral Islands',desc:'Open sea and island chains',sky:0x9cc9e8,floor:0x1f7096,sea:true,fog:[3000,22000],aiFloor:0,seed:9127},
  loop:{name:'Mach Loop',desc:'Low-level valley run through the mountains',sky:0xb4c4cf,floor:0x56804a,fog:[2500,17000],aiFloor:0,seed:4411},
  city:{name:'Metro City',desc:'Skyscraper canyons and a river',sky:0xbccbd8,floor:0x5c6a5e,fog:[2500,19000],aiFloor:520,seed:7723}
};
const CELL=150;
const loopR=a=>3500+650*Math.sin(3*a);
function genTerrain(id,bases){
  const M=MAPS[id]||MAPS.coral,r=mulberry(M.seed),T={id,cones:[],beaches:[],ponds:[],trees:[],cells:new Map(),cellList:[],gates:[],clouds:[],rocks:[],park:null,river:false};
  const cone=(x,z,R,h,kind)=>{const c={x,z,R,h,kind,rot:r()*TAU,snow:kind!=='grass'&&h>660};T.cones.push(c);return c;};
  const nearBase=(x,z,m)=>bases.some(b=>Math.hypot(x-b.x,z-b.z)<m);
  const approach=(x,z)=>clearZone(bases,x,z);
  if(id==='coral'){
    let made=0;
    while(made<44){
      const a=r()*TAU,d=Math.sqrt(r())*9500,R=280+r()*800,h=70+r()*380,x=Math.cos(a)*d,z=Math.sin(a)*d;
      if(nearBase(x,z,R+1300)||approach(x,z))continue;
      made++;cone(x,z,R,h,h>300?'rock':'grass');T.beaches.push({x,z,R});
      for(let k=Math.floor(r()*3);k>0;k--){const t=r()*TAU,o=R*(.25+r()*.3),hh=h*(.5+r()*.9);cone(x+Math.cos(t)*o,z+Math.sin(t)*o,R*(.3+r()*.25),hh,hh>300?'rock':'grass');}
    }
    for(let i=0;i<34;i++){const x=(r()-.5)*18000,z=(r()-.5)*18000;if(nearBase(x,z,1500)||approach(x,z))continue;cone(x,z,35+r()*60,90+r()*170,'rock');}
    // the airfields sit on their own flat islands
    for(const b of bases)T.beaches.push({x:b.x,z:b.z,R:1150,flat:1});
  }else if(id==='loop'){
    for(let i=0;i<3;i++){const a=i*2.1+.4,rr=loopR(a);T.ponds.push({x:Math.cos(a)*rr,z:Math.sin(a)*rr,R:330+r()*120});}
    let made=0,tries=0;
    while(made<240&&tries++<6000){
      const x=(r()-.5)*21000,z=(r()-.5)*21000,R=450+r()*900,h=250+r()*520;
      const dl=Math.abs(Math.hypot(x,z)-loopR(Math.atan2(z,x)));
      if(dl<R*.8+260||nearBase(x,z,R+1500)||approach(x,z))continue;
      made++;cone(x,z,R,h,h>560?'rock':'grass');
    }
    tries=0;
    while(T.trees.length<1500&&tries++<30000){
      const x=(r()-.5)*19000,z=(r()-.5)*19000;if(nearBase(x,z,1100))continue;
      let ok=true;for(const I of T.cones)if(Math.hypot(x-I.x,z-I.z)<I.R){ok=false;break;}
      if(ok)T.trees.push([x,z,.7+r()*.9]);
    }
    for(let i=0;i<10;i++){const a=i/10*TAU,a2=(i+.05)/10*TAU;T.gates.push({x:Math.cos(a)*loopR(a),y:150,z:Math.sin(a)*loopR(a),nx:Math.cos(a2)*loopR(a2),nz:Math.sin(a2)*loopR(a2)});}
  }else{
    T.river=true;T.park={x:-2250,z:1350,R:350};
    for(let i=-31;i<=31;i++)for(let j=-31;j<=31;j++){
      if(i%6===0||j%6===0)continue;
      const x=i*CELL,z=j*CELL,d=Math.hypot(x,z);
      if(Math.hypot(x+2250,z-1350)<520||clearZone(bases,x,z,340))continue;
      if(r()>(d<3000?.92:Math.max(0,.92-(d-3000)/1600)))continue;
      const h=18+r()*42+Math.pow(r(),2.2)*360*Math.exp(-d/1500),half=38+r()*12;
      T.cells.set(i*1000+j,{h,half});T.cellList.push([x,z,h,half]);
    }
    for(let i=0;i<46;i++){const a=r()*TAU,d=7200+r()*3600,x=Math.cos(a)*d,z=Math.sin(a)*d,R=400+r()*800;if(nearBase(x,z,R+1500)||approach(x,z)||Math.abs(x)<400)continue;const h=120+r()*320;cone(x,z,R,h,h>330?'rock':'grass');}
  }
  for(let i=0;i<(id==='loop'?60:44);i++){
    const cx=(r()-.5)*26000,cy=(id==='loop'?1300:1000)+r()*1500,cz=(r()-.5)*26000,n=5+Math.floor(r()*5),p=[];
    for(let k=0;k<n;k++)p.push([(r()-.5)*520,(r()-.5)*70,(r()-.5)*360,120+r()*190]);
    T.clouds.push({x:cx,y:cy,z:cz,p});
  }
  return T;
}

/* ---------- weather and time of day ----------------------------------------------- */
const WX_PRESETS={clear:{cloud:.15,rain:0,storm:0,fog:0,wind:6},fair:{cloud:.4,rain:0,storm:0,fog:.05,wind:10},overcast:{cloud:.85,rain:.15,storm:0,fog:.25,wind:14},
  rain:{cloud:.95,rain:.75,storm:0,fog:.4,wind:18},storm:{cloud:1,rain:1,storm:1,fog:.5,wind:28},fog:{cloud:.6,rain:0,storm:0,fog:.9,wind:3}};
function makeWeather(o){
  const p=WX_PRESETS[o.weather]||WX_PRESETS.fair;
  return{tod:o.tod!==undefined?o.tod:13,daySpeed:o.daySpeed!==undefined?o.daySpeed:.2,dynamic:o.weather==='dynamic'||o.dynamic!==false,
    cloud:p.cloud,rain:p.rain,storm:p.storm,fog:p.fog,windKt:p.wind,windDir:rnd(0,360),gust:0,target:null,nextChange:rnd(150,300)};
}

/* ---------- the world ------------------------------------------------------------- */
class World{
  constructor(o){
    o=o||{};
    this.opts=o;this.map=o.map||'coral';this.auth=o.auth!==false;this.mode=o.mode||'strike';this.diff=DIFF[o.difficulty]||DIFF.normal;
    this.time=0;this.planes=[];this.byId=new Map();this.missiles=[];this.bombs=[];this.nukes=[];this.bullets=[];this.wrecks=[];this.craters=[];
    this.events=[];this.nid=1;this.bases=makeBases();this.terrain=genTerrain(this.map,this.bases);
    this.reserve=[o.reserve||100,o.reserve||100];this.score=[0,0];this.kills=[0,0];
    this.duration=o.duration||1500;this.over=null;this.awacs=[false,false];
    this.weather=makeWeather(o);this.aiF=o.aiPerTeam!==undefined?o.aiPerTeam:8;this.support=o.support!==false;
    this.dmgVer=0;this.rtbHuman=!!o.landToWin;
    for(const b of this.bases){b.act=Math.floor(Math.random()*4);b.next=rnd(90,150);}
  }
  emit(type,d){d=d||{};d.e=type;this.events.push(d);return d;}
  // ---- geometry helpers bound to this world
  padAt(x,z){for(const b of this.bases)if(Math.hypot(x-b.x,z-b.z)<BR)return b.i;return -1;}
  rwAxis(b,x,z){const dx=Math.abs(x-b.x),dz=Math.abs(z-b.z);return dx<60&&dz<700?'ns':dz<60&&dx<700?'ew':null;}
  onRunway(x,z){for(const b of this.bases)if(this.rwAxis(b,x,z))return b;return null;}
  onPaved(x,z){
    if(this.onRunway(x,z))return true;
    for(const b of this.bases){
      const lx=(x-b.x)*b.s,lz=z-b.z;
      if(lx>190&&lx<520&&Math.abs(lz)<660)return true;          // apron
      if(Math.abs(lx-210)<18&&Math.abs(lz)<670)return true;      // parallel taxiway A
      if(lx>0&&lx<215&&(Math.abs(lz+650)<18||Math.abs(lz-650)<18||Math.abs(lz+300)<16||Math.abs(lz-300)<16))return true; // connectors
      if(lx>-700&&lx<215&&Math.abs(Math.abs(lz)-190)<16)return true;   // taxiways Bravo and Charlie beside the cross runway
      if((Math.abs(lx+650)<16||Math.abs(lx+300)<16)&&Math.abs(lz)<205)return true; // their links onto the cross runway
      if(lx>500&&lx<880&&(Math.abs(lz-660)<8||Math.abs(lz+660)<8))return true; // service roads
      if(Math.abs(lx-860)<8&&Math.abs(lz)<670)return true;
    }
    return false;
  }
  ground(x,z){
    let g=0;
    for(const I of this.terrain.cones){
      const dx=x-I.x,dz=z-I.z;
      if(Math.abs(dx)>I.R||Math.abs(dz)>I.R)continue;
      const h=I.h*(1-Math.sqrt(dx*dx+dz*dz)/I.R);if(h>g)g=h;
    }
    const cl=this.terrain.cells;
    if(cl.size){
      const i=Math.round(x/CELL),j=Math.round(z/CELL),c=cl.get(i*1000+j);
      if(c&&c.h>g&&Math.abs(x-i*CELL)<c.half&&Math.abs(z-j*CELL)<c.half)g=c.h;
    }
    const pi=this.padAt(x,z);
    if(pi>=0){
      if(g<PAD_Y)g=PAD_Y;
      const b=this.bases[pi];
      for(const o of b.bld){if(!o.h||o.dmg>=1)continue;if(Math.abs(x-o.x)<o.w/2&&Math.abs(z-o.z)<o.d/2&&g<PAD_Y+o.h)g=PAD_Y+o.h;}
    }else if(MAPS[this.map].sea&&g<.5){
      for(const s of this.terrain.beaches)if(Math.hypot(x-s.x,z-s.z)<s.R*1.18){g=Math.max(g,1.2);break;}
    }
    return g;
  }
  surface(x,z){
    if(this.onPaved(x,z)){for(const c of this.craters)if(!c.done&&Math.hypot(x-c.x,z-c.z)<c.r)return'crater';return'asphalt';}
    for(const c of this.craters)if(!c.done&&Math.hypot(x-c.x,z-c.z)<c.r)return'crater';
    const pi=this.padAt(x,z);if(pi>=0)return'grass';
    const g=this.ground(x,z),M=MAPS[this.map];
    if(M.sea&&g<.6)return'water';
    if(this.terrain.cells.size&&Math.hypot(x,z)<4800)return T_RIVER(x)?'water':'asphalt';
    for(const I of this.terrain.cones){const d=Math.hypot(x-I.x,z-I.z);if(d<I.R)return I.kind==='rock'?'rock':g<12&&M.sea?'sand':'grass';}
    return M.sea?'sand':'grass';
  }
  slope(x,z){const e=6;return Math.max(Math.abs(this.ground(x+e,z)-this.ground(x-e,z)),Math.abs(this.ground(x,z+e)-this.ground(x,z-e)))/(2*e);}
  baseOf(t,k){return this.bases.find(b=>b.team===t&&b.kind===k);}
  homeBase(p){
    const want=this.baseOf(p.team,kindOf(p.cls));
    if(want.hp>0&&!this.baseClosed(want))return want;
    const alt=this.bases.find(b=>b.team===p.team&&b.hp>0&&!this.baseClosed(b));
    return alt||want;
  }
  baseClosed(b){return b.closed.ns&&b.closed.ew;}
  stallOf(p){return p.minSpd*(1-.28*p.flapT)*(1+.18*((p.dm?p.dm[0]+p.dm[1]:0)));}
  // nose attitude on the wheels: rotate up for take-off, lower gently after touchdown
  groundPitch(p,dt,target){
    const up=target>p.pitch,rate=up?(p.cls?.09:.16):(p.spd<25?.3:p.cls?.05:.065);
    p.pitch+=clamp(target-p.pitch,-rate*dt,rate*dt);if(p.pitch<0)p.pitch=0;
  }
  pivotLift(p){const t=TYPES[p.type];return Math.sin(p.pitch)*(t.len||15)*.05;}   // the aircraft pivots on its main wheels, just behind the centre
  wind(){const w=this.weather,a=w.windDir*D2R,v=w.windKt*.514+w.gust;return{x:Math.sin(a)*-v,z:Math.cos(a)*-v,v};} // blowing FROM windDir

  /* ---- planes ---- */
  addPlane(o){
    const t=TYPES[o.type]||TYPES.f16,id=o.id||this.nid++;
    const p={id,team:o.team|0,type:t.id,cls:t.cls,human:!!o.human,local:!!o.local,remote:!!o.remote,owner:o.owner||null,
      name:o.name||'',cs:o.cs||o.name||t.name,lv:o.lv||(o.team?'vks':'usaf'),
      x:0,y:0,z:0,yaw:0,pitch:0,roll:0,spd:0,thr:0,vy:0,hpMax:t.hp,hp:t.hp,maxSpd:t.max,minSpd:t.minSpd,
      agil:t.agil*(o.human?1.05:t.cls?1:rnd(.86,1)*this.diff.agil),rad:t.cls?Math.max(14,t.len*.5):14,mass:t.mass,
      alive:false,falling:false,ground:false,gear:true,gearT:1,flap:.5,flapT:.5,gearH:(t.r+1.95)*(t.cls?1.3:1.7),vs:0,g:1,
      comp:0,gearDmg:0,sliding:false,collapsed:false,spinR:0,parts:0,dm:[0,0,0,0,0,0],burn:false,cond:1,brake:false,rev:false,fire:false,aimX:0,aimY:0,aimZ:0,
      pad:-1,base:0,rwy:0,lrw:-1,gs:null,wps:[],wi:0,next:'',blockT:0,noCost:false,airT:0,rearmed:false,stand:-1,
      ammo:400,bombs:t.bombs,msl:t.msl,mslMax:t.msl,mslCd:0,flares:4,chaff:4,flareCd:0,flareT:0,chaffT:0,cool:0,reload:0,
      yawS:0,pitchS:0,kills:0,deaths:0,gunKills:0,respawn:0,spin:1,lastHitBy:null,hitT:-99,lock:0,lockT:0,
      atc:'',atcT:0,atcN:0,wantLand:false,gate:0,ctl:{yaw:0,pitch:0,fire:false},
      ai:{mode:'fight',air:0,climb:0,holdT:0,tgt:null,retgt:0,evade:0,evDir:1,evFlip:0,wp:null,skill:rnd(this.diff.skill[0],this.diff.skill[1]),jit:rnd(0,10),lockT:0,mslCd:rnd(4,12),phase:0,drop:0,dropT:0,role:o.role||'fight'}};
    this.planes.push(p);this.byId.set(id,p);
    return p;
  }
  removePlane(p){const i=this.planes.indexOf(p);if(i>=0)this.planes.splice(i,1);this.byId.delete(p.id);for(const b of this.bases)if(b.rw===p)b.rw=null;this.emit('gone',{id:p.id});}
  setType(p,type){
    const t=TYPES[type];if(!t)return;
    Object.assign(p,{type,cls:t.cls,hpMax:t.hp,hp:t.hp,maxSpd:t.max,minSpd:t.minSpd,mass:t.mass,rad:t.cls?Math.max(14,t.len*.5):14,
      gearH:(t.r+1.95)*(t.cls?1.3:1.7),mslMax:t.msl,msl:t.msl,bombs:t.bombs,agil:t.agil*(p.human?1.05:1)});
  }
  holdFor(b,r,fromZ){
    const g=rwGeo(b,r),X=b.x+b.s*210;
    if(g.ns)return{x:b.x+b.s*110,z:g.T.z,via:[[X,g.T.z]],tw:'Alpha'};
    const side=fromZ>=b.z?1:-1,tl=(g.T.x-b.x)*b.s;
    if(tl>0)return{x:X,z:b.z+side*75,via:[],tw:'Alpha',back:true};      // threshold on the apron side: hold at the Alpha crossing, backtrack
    return{x:b.x+b.s*tl,z:b.z+side*110,via:[[X,b.z+side*190],[b.x+b.s*tl,b.z+side*190]],tw:'Alpha, '+(side>0?'Bravo':'Charlie')};
  }
  toAlpha(p,b){ // waypoints that follow the taxiways from wherever the aircraft is back to taxiway Alpha
    const lx=(p.x-b.x)*b.s,lz=p.z-b.z,W=(x,z)=>[b.x+b.s*x,b.z+z],sd=lz>=0?1:-1;
    if(Math.abs(lx-210)<25||lx>190)return[];
    for(const c of[-650,-300])if(Math.abs(lx-c)<25&&Math.abs(lz)<205)return[W(c,sd*190),W(210,sd*190)];
    if(Math.abs(Math.abs(lz)-190)<25)return[W(210,sd*190)];
    for(const c of[-650,-300,300,650])if(Math.abs(lz-c)<25)return[W(210,c)];
    if(Math.abs(lz)<70)return[W(210,0)];                       // on the cross runway: Alpha crosses it
    return[];
  }
  routeToHold(p,b,fromApron){
    const H=this.holdFor(b,b.act,p.z),X=b.x+b.s*210,w=this.toAlpha(p,b);
    if(fromApron)w.push([b.x+b.s*330,p.z]);
    const tz=H.via.length?H.via[0][1]:H.z,pz=w.length?w[w.length-1][1]:p.z;
    w.push([X,pz+Math.sign(tz-pz)*Math.min(50,Math.abs(tz-pz))]);
    for(const v of H.via)w.push(v);
    w.push([H.x,H.z]);return w;
  }
  lineupPath(b,r){
    const g=rwGeo(b,r),X=b.x+b.s*210,w=g.ns||(g.T.x-b.x)*b.s<0?[]:[[X,b.z]];
    w.push([g.T.x,g.T.z],[g.T.x+g.dx*60,g.T.z+g.dz*60]);return w;
  }
  freeStand(b){
    const used=new Set(this.planes.filter(q=>q.alive&&q.stand>=0&&q.pad===b.i).map(q=>q.stand));
    const free=STANDS.map((_,i)=>i).filter(i=>!used.has(i));return free.length?pick(free):Math.floor(Math.random()*STANDS.length);
  }
  exitRoute(p,b){
    const g=rwGeo(b,p.rwy),X=b.x+b.s*210,w=[];p.stand=this.freeStand(b);const sz=b.z+STANDS[p.stand];
    if(g.ns){const ez=b.z+[-650,-300,300,650].reduce((a,v)=>Math.abs(b.z+v-(p.z+g.dz*80))<Math.abs(a-(p.z+g.dz*80))?b.z+v:a,1e9)-b.z;
      w.push([b.x+b.s*60,ez],[X,ez]);}
    else{ // cross runway: turn off at the next link to Bravo/Charlie (or Alpha), then taxi to the apron
      const side=sz>b.z?1:-1,plx=(p.x-b.x)*b.s,dir=Math.sign(g.dx*b.s)||1;
      const ahead=[-650,-300,210].filter(c=>(c-plx)*dir>-15).sort((a,c)=>Math.abs(a-plx)-Math.abs(c-plx));
      const c=ahead.length?ahead[0]:210;
      if(c===210)w.push([X,b.z],[X,b.z+side*60]);
      else w.push([b.x+b.s*c,b.z],[b.x+b.s*c,b.z+side*190],[X,b.z+side*190]);
    }
    w.push([X,sz],[b.x+b.s*300,sz]);return w;
  }
  standPos(b,i){return{x:b.x+b.s*300,z:b.z+STANDS[i]};}
  spawn(p,o){ // o: {base, slot, air, stand}
    o=o||{};
    let b=o.base!==undefined&&o.base>=0?this.bases[o.base]:this.homeBase(p);if(b.hp<=0)b=this.homeBase(p);
    const t=TYPES[p.type];
    Object.assign(p,{spd:0,thr:0,pitch:0,roll:0,yawS:0,pitchS:0,hp:p.hpMax,dm:[0,0,0,0,0,0],burn:false,cond:1,alive:true,falling:false,ammo:t.gun?400:0,reload:0,cool:0,
      msl:p.mslMax,bombs:t.bombs,mslCd:0,flares:p.human?24:p.cls?8:4,chaff:p.human?24:p.cls?8:4,flareCd:0,flareT:0,chaffT:0,lastHitBy:null,lrw:-1,
      ground:true,gear:true,gearT:1,flap:.5,flapT:.5,pad:b.i,base:b.i,blockT:0,noCost:false,comp:0,gearDmg:0,sliding:false,collapsed:false,
      parts:0,dm:[0,0,0,0,0,0],burn:false,cond:1,dmWarn:0,spinR:0,vy:0,lock:0,lockT:0,stand:-1,atc:'park',atcT:0,wantLand:false,rearmed:false,fire:false,brake:false,rev:false});
    p.y=PAD_Y+p.gearH;
    const ai=p.ai;Object.assign(ai,{mode:'fight',air:0,climb:0,tgt:null,evade:0,lockT:0,phase:0,holdT:0});
    if(o.air){
      Object.assign(p,{ground:false,gear:false,gearT:0,flap:0,flapT:0,pad:-1,gs:null,rearmed:true,atc:'enroute'});
      p.x=b.x+b.s*1800;p.z=b.z;p.y=1400;p.yaw=b.s*Math.PI/2;p.spd=t.heli?40:p.maxSpd*.75;p.thr=.85;p.airT=this.time;
    }else if(o.slot!==undefined){
      const g=rwGeo(b,b.act),X=b.x+b.s*210;
      if(g.ns){p.x=X;p.z=g.T.z+g.dz*(90+o.slot*58);p.yaw=Math.atan2(0,-g.dz);}
      else{p.x=X;p.z=b.z-135-o.slot*58;p.yaw=0;}
      p.wps=this.routeToHold(p,b,false);p.wi=0;p.gs='taxi';p.next='hold';
    }else{
      const st=o.stand!==undefined?o.stand:this.freeStand(b),sp=this.standPos(b,st);p.stand=st;
      p.x=sp.x;p.z=sp.z;p.yaw=-b.s*Math.PI/2;
      p.wps=this.routeToHold(p,b,true);p.wi=0;p.gs='taxi';p.next='hold';
    }
    if(t.heli){p.flap=0;p.flapT=0;}
    if(p.human)this.applyLoad(p,o.load);
    this.emit('spawn',{id:p.id});
    return p;
  }
  applyLoad(p,load){
    const t=TYPES[p.type];load=load||{};p.reload=0;
    p.flares=clamp(load.flares!==undefined?load.flares:24,0,24);p.chaff=clamp(load.chaff!==undefined?load.chaff:24,0,24);
    p.msl=clamp(load.msl!==undefined?load.msl:t.msl,0,t.msl);p.ammo=t.gun?clamp(load.ammo!==undefined?load.ammo:400,0,800):0;
    p.bombs=clamp(load.bombs!==undefined?load.bombs:t.bombs,0,t.bombs);
    const w=((t.msl?p.msl/t.msl:0)+(t.gun?p.ammo/800:0)+(t.bombs?p.bombs/t.bombs:0)+p.flares/24)/4;
    p.agil=t.agil*1.05*(1-.1*w);
  }
  /* ---- teams and fleets (AI population) ---- */
  populate(humanTeams){ // fill each team with AI up to the requested numbers
    humanTeams=humanTeams||[0,0];
    for(let t=0;t<2;t++){
      const lv=t?(this.opts.redLivery||'vks'):(this.opts.blueLivery||'usaf'),list=[];
      const nF=Math.max(0,this.aiF-humanTeams[t]);
      const fleet=t?FLEET.redF:FLEET.blueF;
      for(let i=0;i<nF;i++)list.push(this.addPlane({team:t,type:fleet[i%fleet.length],name:NAMES[t][i%NAMES[t].length],cs:NAMES[t][i%NAMES[t].length]+' '+(1+Math.floor(i/NAMES[t].length))+'-1',lv}));
      if(this.support){
        const bt=pick(t?FLEET.redB:FLEET.blueB),st=pick(t?FLEET.redS:FLEET.blueS),tt=pick(t?FLEET.redT:FLEET.blueT);
        list.push(this.addPlane({team:t,type:bt,name:TYPES[bt].name,cs:(t?'Bear':'Bone')+' 1',lv}));
        list.push(this.addPlane({team:t,type:st,name:TYPES[st].name,cs:(t?'Mainstay':'Wedgetail')+' 1',lv}));
        list.push(this.addPlane({team:t,type:tt,name:TYPES[tt].name,cs:(t?'Candid':'Reach')+' 1',lv,role:'transport'}));
      }
      this.spawnQueue(list);
    }
  }
  spawnQueue(list){ // everyone starts in their base's taxi queue, in random order
    const groups={};
    for(const p of list){const bi=this.homeBase(p).i;(groups[bi]=groups[bi]||[]).push(p);}
    for(const bi in groups){
      const g=groups[bi];for(let i=g.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[g[i],g[j]]=[g[j],g[i]];}
      g.forEach((p,i)=>this.spawn(p,{base:+bi,slot:i}));
    }
  }

  /* ---- damage, kills, scores ---- */
  // blast or crash damage with no exact impact point: spread over the airframe
  damage(p,amt,by,how){
    if(!p.alive||!this.auth)return;
    const tough=Math.sqrt(p.hpMax/100),n=amt>60?3:2;
    for(let i=0;i<n;i++)this.hitZone(p,Math.floor(Math.random()*5),amt/100/tough*(i?.45:.8),by,how);
  }
  /* ---- zone damage: no health bar, the airframe takes hits where the rounds land ----
     zones: 0 left wing, 1 right wing, 2 tail (elevator/rudder), 3 engine, 4 fuel tank, 5 cockpit */
  visScale(t){return t.cls?1.3:t.model?1.7:1.3;}
  toLocal(p,x,y,z){ // world → aircraft frame (x left wing, y up, z nose), same rotation as the drawn model
    let dx=x-p.x,dy=y-p.y,dz=z-p.z,c=Math.cos(-p.yaw),s=Math.sin(-p.yaw);
    let x1=dx*c+dz*s,z1=-dx*s+dz*c;c=Math.cos(p.pitch);s=Math.sin(p.pitch);
    const y2=dy*c-z1*s,z2=dy*s+z1*c;c=Math.cos(-p.roll);s=Math.sin(-p.roll);
    return{x:x1*c-y2*s,y:x1*s+y2*c,z:z2};
  }
  // which part of the aircraft a point (aircraft frame) is in, or -1 for a miss
  zoneAt(p,l){
    const t=TYPES[p.type],k=1.35,V=this.visScale(t),L=(t.len||15)*V,S=(t.heli?t.rotorR*.35:(t.span?t.span/2:(t.wing?t.wing[4]:L*.35)))*V,R=Math.max(.6,(t.r||1)*V*1.5);
    const ax=Math.abs(l.x),fus=l.x*l.x+l.y*l.y<R*R*k*k&&Math.abs(l.z)<L*.53,wing=!t.heli&&ax<S*k&&Math.abs(l.y)<Math.max(1,R*.55)*k&&l.z>-L*.32&&l.z<L*.2,
      tail=l.z<-L*.27&&l.z>-L*.56&&ax<Math.max(S*.45,R*2.5)*k&&l.y>-R&&l.y<R*3.6*k;
    if(!fus&&!wing&&!tail)return -1;
    if(tail&&!wing)return 2;
    if(wing&&ax>R*.9){
      if(t.cls&&!t.heli&&ax>S*.2&&ax<S*.7&&Math.random()<.32)return 3;   // wing-mounted engines
      if(ax<S*.4&&Math.random()<.25)return 4;                          // wing-root tanks
      return l.x>0?0:1;
    }
    if(l.z>L*(t.cls?.38:.18)&&(t.cls||l.y>-R*.2||l.z>L*.42))return 5;
    if(!t.cls&&l.z<-L*.12)return 3;
    if(t.cls&&l.z<-L*.15)return 2;
    return 4;
  }
  hitZone(p,z,amt,by,how){
    if(!p.alive||!this.auth||z<0)return;
    const dm=p.dm;if(p.human)amt*=.75;
    const was=dm[z];dm[z]=Math.min(1,dm[z]+amt);p.lastHitBy=by;p.hitT=this.time;
    if(how!=='fire')this.emit('hit',{id:p.id,by:by?by.id:0,z});
    const kh=how==='fire'?(by?'gun':'crash'):how||'gun';
    if((z===4&&dm[4]>.3&&Math.random()<(how==='msl'?.6:.18))||(z===3&&dm[3]>.65&&Math.random()<.15))if(!p.burn){p.burn=true;this.dmgNote(p,'FIRE! — GET IT ON THE GROUND','#ff5a4d');}
    const NM=['LEFT WING','RIGHT WING','TAIL','ENGINE','FUEL TANK','COCKPIT'];
    if(was<.35&&dm[z]>=.35&&dm[z]<1)this.dmgNote(p,NM[z]+(z===4?' HIT — LEAKING FUEL':' DAMAGED'),'#ffd23f');
    else if(was<.7&&dm[z]>=.7&&dm[z]<1)this.dmgNote(p,NM[z]+' CRITICAL','#ff8a3d');
    this.condOf(p);
    if(dm[z]<1||was>=1)return;
    if(z<=1){p.parts|=z?2:1;this.emit('breakup',{id:p.id,part:z?'wingR':'wingL'});this.kill(p,by,kh);}
    else if(z===2){this.emit('breakup',{id:p.id,part:'tail'});this.dmgNote(p,'ELEVATOR SHOT AWAY — USE THROTTLE AND TRIM','#ff5a4d');}
    else if(z===3){this.dmgNote(p,'ENGINE FAILURE — GLIDE TO A RUNWAY','#ff5a4d');if(Math.random()<.5)p.burn=true;}
    else if(z===4){this.emit('boom',{x:p.x,y:p.y,z:p.z,s:p.cls?1:0});this.kill(p,by,kh);}
    else if(z===5){this.dmgNote(p,'PILOT HIT','#ff5a4d');this.kill(p,by,kh);}
  }
  missileHit(p,m){
    const t=TYPES[p.type],V=this.visScale(t),l=this.toLocal(p,m.x,m.y,m.z),L=(t.len||15)*V,sc=Math.max(Math.abs(l.x),Math.abs(l.y),Math.abs(l.z),1);
    // pull the warhead position onto the airframe to find what it shredded
    const f=Math.min(1,L*.3/sc),q={x:l.x*f,y:l.y*f*.3,z:l.z*f};let z=this.zoneAt(p,q);if(z<0)z=Math.abs(q.x)>L*.15?(q.x>0?0:1):q.z<-L*.25?2:4;
    const tough=Math.sqrt(p.hpMax/100),big=m.pl?1.25:1;
    this.hitZone(p,z,(.62+Math.random()*.3)*big/tough,m.owner,'msl');
    const nb=z<=1?[4,3]:z===2?[3,z===2?0:1]:[z===3?2:3,Math.random()<.5?0:1];
    if(p.alive)this.hitZone(p,nb[Math.random()<.5?0:1],(.25+Math.random()*.25)*big/tough,m.owner,'msl');
  }
  dmgNote(p,text,col){if(p.human)this.emit('notice',{to:p.id,text,col});}
  condOf(p){const d=p.dm;p.cond=1-Math.max(d[0],d[1],d[2]*.8,d[3]*.8,d[4],d[5]);return p.cond;}
  repair(p){p.dm=[0,0,0,0,0,0];p.burn=false;p.cond=1;p.parts=0;}
  kill(p,by,how,opts){ // gun | msl | nuke | crash | ditch
    if(!p.alive||!this.auth)return;
    opts=opts||{};
    p.alive=false;p.hp=0;p.spin=Math.random()<.5?-1:1;p.gs=null;p.deaths++;p.fire=false;
    for(const b of this.bases)if(b.rw===p)b.rw=null;
    const t=TYPES[p.type],onGround=p.ground||p.sliding||p.y<this.ground(p.x,p.z)+10;
    const quiet=opts.quiet;
    if(how==='nuke'||how==='crash'||how==='ditch'||onGround){
      p.falling=false;p.ground=false;p.sliding=false;p.respawn=p.cls?25:8;
      if(!quiet)this.emit('boom',{x:p.x,y:p.y,z:p.z,s:p.cls?2:1});
      this.crashSite(p,how,quiet);
    }else{p.falling=true;this.emit('boom',{x:p.x,y:p.y,z:p.z,s:p.cls?1:0});}
    const credit=!!by&&by!==p&&by.team!==p.team;
    if(credit){
      by.kills++;this.kills[by.team]++;this.score[by.team]+=p.cls?3:1;
      if(how!=='nuke')by.gunKills++;
    }
    this.emit('kill',{k:credit||(how==='nuke'&&by&&by!==p)?by.id:0,v:p.id,how,kn:by?by.cs:'',vn:p.cs,kt:by?by.team:-1,vt:p.team});
    if(p.cls&&!p.human)this.emit('notice',{text:TEAM[p.team].name+' '+t.name+' destroyed',team:1-p.team});
    this.checkWin();
  }
  crashSite(p,how,quiet){
    if(how==='ditch'||this.surface(p.x,p.z)==='water'){this.emit('splash',{x:p.x,z:p.z,s:p.cls?2:1});return;}
    const g=this.ground(p.x,p.z),w={id:this.nid++,x:p.x,y:g,z:p.z,yaw:p.yaw,type:p.type,lv:p.lv,team:p.team,t:this.time,burn:!quiet,parts:p.parts};
    this.wrecks.push(w);
    if(!quiet&&p.cls!==undefined)this.addCrater(p.x,p.z,p.cls?14:8,null,'crash');
    this.emit('wreck',w);this.dmgVer++;
  }
  addCrater(x,z,r,by,why){
    const pi=this.padAt(x,z),onRw=this.onRunway(x,z);
    const c={id:this.nid++,x,z,r,t:this.time,base:pi,rw:onRw?this.rwAxis(onRw,x,z):null,rep:0,done:false,why:why||'bomb'};
    this.craters.push(c);if(this.craters.length>220)this.craters.splice(0,this.craters.findIndex(q=>q.done)+1||1);
    if(pi>=0){
      const b=this.bases[pi];b.quiet=0;
      for(const o of b.bld)if(o.dmg<1&&Math.abs(x-o.x)<o.w/2+r&&Math.abs(z-o.z)<o.d/2+r){o.dmg=Math.min(1,o.dmg+(why==='nuke'?1:.55));this.emit('bld',{base:b.i,id:o.id,dmg:o.dmg});}
      this.updateClosures(b);
    }
    this.emit('crater',c);this.dmgVer++;
    return c;
  }
  updateClosures(b){
    for(const ax of['ns','ew']){
      const was=b.closed[ax];
      b.closed[ax]=this.craters.some(c=>!c.done&&c.base===b.i&&c.rw===ax)||this.wrecks.some(w=>this.padAt(w.x,w.z)===b.i&&this.rwAxis(b,w.x,w.z)===ax);
      if(was!==b.closed[ax])this.emit('runway',{base:b.i,axis:ax,closed:b.closed[ax]});
    }
    if(b.closed[rwGeo(b,b.act).axis]){const open=[0,1,2,3].filter(r=>!b.closed[rwGeo(b,r).axis]);if(open.length)this.setActive(b,pick(open),'closed');}
  }
  setActive(b,r,why){
    if(b.act===r)return;b.act=r;b.next=this.time+rnd(90,150);
    for(const p of this.planes)if(p.alive&&p.ground&&p.pad===b.i&&p.gs==='taxi'&&p.next==='hold'){p.wps=this.routeToHold(p,b,(p.x-b.x)*b.s>260);p.wi=0;}
    this.emit('rwchange',{base:b.i,rw:r,why});
  }
  hitBase(bi,n){
    const b=this.bases[bi];if(!this.auth||this.over||b.hp<=0)return;
    const was=b.hp;b.hp=Math.max(0,was-n);b.quiet=0;
    if(Math.floor(was/25)!==Math.floor(b.hp/25)&&b.hp>0)this.emit('notice',{text:b.name+' at '+Math.ceil(b.hp)+'%',team:-1,base:b.i});
    this.score[1-b.team]+=n*.05;
    if(b.hp<=0){
      for(const o of b.bld)if(o.h){o.dmg=1;}
      this.emit('baseDown',{base:b.i});this.dmgVer++;
      this.checkWin();
    }
  }
  checkWin(){
    if(this.over||!this.auth)return;
    for(let t=0;t<2;t++){
      const fb=this.baseOf(t,'F');
      if(fb.hp<=0){
        if(this.rtbHuman&&1-t===this.localTeam()){if(!this.rtb){this.rtb={why:'Enemy fighter base destroyed'};this.emit('rtb',{why:this.rtb.why});}}
        else this.finish(1-t,(t?'Red':'Blue')+' fighter base destroyed');
        return;
      }
    }
    if(this.mode==='tdm'){for(let t=0;t<2;t++)if(this.kills[t]>=(this.opts.scoreLimit||30))return this.finish(t,'Score limit reached');}
    for(let t=0;t<2;t++)if(this.reserve[t]<=0&&!this.planes.some(p=>p.team===t&&p.alive))return this.finish(1-t,TEAM[t].name+' has no aircraft left');
  }
  localTeam(){const p=this.planes.find(q=>q.local);return p?p.team:-1;}
  finish(winner,why){if(this.over)return;this.over={winner,why,t:this.time};this.emit('over',this.over);}

  /* ---- weapons ---- */
  fireMissile(p,t){
    if(!this.auth||!p.alive||p.msl<=0||p.mslCd>0||!t||!t.alive)return null;
    const ty=TYPES[p.type];p.msl--;p.mslCd=1;const F=fwd(p);
    const m={id:this.nid++,x:p.x+F.x*10,y:p.y-3,z:p.z+F.z*10,dx:F.x,dy:F.y,dz:F.z,spd:p.spd+40,tgt:t,owner:p,team:p.team,pl:p.human,kind:ty.mslKind,life:p.human?14:10,safe:null};
    this.missiles.push(m);this.emit('launch',{id:m.id,by:p.id,tgt:t.id,kind:m.kind,x:m.x,y:m.y,z:m.z});
    return m;
  }
  countermeasure(p,kind){ // kind 'flare' | 'chaff'
    if(!p.alive)return;
    const key=kind==='chaff'?'chaff':'flares';
    if(p[key]<=0||p.flareCd>0)return;
    p[key]--;p.flareCd=p.human?.3:.7;if(p.human){if(kind==='chaff')p.chaffT=3;else p.flareT=3;}
    this.emit(kind,{id:p.id,x:p.x,y:p.y,z:p.z,yaw:p.yaw});
    if(!this.auth)return;
    for(const m of this.missiles){
      if(m.tgt!==p)continue;
      const match=(kind==='flare')===(m.kind==='ir');
      if(p.human?match:(match&&!m.pl&&Math.random()<.55*this.diff.flare))this.decoy(m,p);
    }
  }
  decoy(m,p){m.tgt=null;m.safe=p;m.dy-=.4;const l=Math.hypot(m.dx,m.dy,m.dz);m.dx/=l;m.dy/=l;m.dz/=l;this.emit('decoy',{id:m.id});}
  stepMissile(m,dt){
    m.life-=dt;m.spd=Math.min(640,m.spd+280*dt);
    if(m.tgt&&((m.kind==='ir'&&m.tgt.flareT>0)||(m.kind!=='ir'&&m.tgt.chaffT>0)))this.decoy(m,m.tgt);
    const t=m.tgt;
    if(t&&t.alive){
      const d=Math.hypot(t.x-m.x,t.y-m.y,t.z-m.z),tt=d/m.spd,G2=fwd(t);
      let ex=t.x+G2.x*t.spd*tt-m.x,ey=t.y+G2.y*t.spd*tt-m.y,ez=t.z+G2.z*t.spd*tt-m.z;const el=Math.hypot(ex,ey,ez)||1;ex/=el;ey/=el;ez/=el;
      const ang=Math.acos(clamp(ex*m.dx+ey*m.dy+ez*m.dz,-1,1));
      if(ang>1.3&&!m.pl)m.tgt=null;
      else{const k=Math.min(1,(m.pl?3.4:1.15)*dt/Math.max(ang,1e-4));m.dx+=(ex-m.dx)*k;m.dy+=(ey-m.dy)*k;m.dz+=(ez-m.dz)*k;const l=Math.hypot(m.dx,m.dy,m.dz);m.dx/=l;m.dy/=l;m.dz/=l;}
    }else{
      m.tgt=null;
      if(m.pl&&!m.safe){let bd=3500;for(const e of this.planes){if(e.team===m.team||!e.alive)continue;const d=Math.hypot(e.x-m.x,e.y-m.y,e.z-m.z);if(d<bd){bd=d;m.tgt=e;}}}
    }
    m.x+=m.dx*m.spd*dt;m.y+=m.dy*m.spd*dt;m.z+=m.dz*m.spd*dt;
    if(!this.auth)return m.life>0;
    for(const p of this.planes){
      if(!p.alive||p.team===m.team||p===m.safe)continue;
      if(Math.hypot(p.x-m.x,p.y-m.y,p.z-m.z)<p.rad+(m.pl?28:12)){this.emit('boom',{x:m.x,y:m.y,z:m.z,s:0});this.missileHit(p,m);return false;}
    }
    if(m.life<=0||m.y<this.ground(m.x,m.z)){this.emit('boom',{x:m.x,y:Math.max(m.y,1),z:m.z,s:0});return false;}
    return true;
  }
  dropBomb(p,nuke){
    if(!this.auth||!p.alive||p.ground)return;
    const F=fwd(p),b={id:this.nid++,nuke:!!nuke,x:p.x,y:p.y-6,z:p.z,vx:F.x*p.spd,vy:nuke?F.y*p.spd:0,vz:F.z*p.spd,owner:p};
    this.bombs.push(b);this.emit('drop',{id:b.id,nuke:b.nuke,by:p.id});return b;
  }
  bombFall(p){
    const F=fwd(p);let x=p.x,y=p.y-6,z=p.z,vx=F.x*p.spd,vy=0,vz=F.z*p.spd;const dt=.1,dr=Math.exp(-dt*.15);
    for(let i=0;i<500;i++){vx*=dr;vz*=dr;vy+=(-150-vy)*Math.min(1,dt*1.1);x+=vx*dt;y+=vy*dt;z+=vz*dt;if(y<=this.ground(x,z)+2)break;}
    return[x,y,z];
  }
  detonate(x,y,z,owner){
    const n={id:this.nid++,x,y,z,t:0,owner,hit:new Set()};this.nukes.push(n);
    this.emit('nuke',{x,y,z});
    for(const b of this.bases)if(Math.hypot(x-b.x,z-b.z)<1200&&b.hp>0){this.emit('notice',{text:b.name+' nuked',team:-1});this.hitBase(b.i,50);}
    this.addCrater(x,z,90,owner,'nuke');
  }
  stepNuke(n,dt){
    const t=n.t+=dt,front=t*330;
    for(const p of this.planes){
      if(!p.alive||n.hit.has(p))continue;
      const d=Math.hypot(p.x-n.x,p.y-n.y,p.z-n.z);
      if(d>front)continue;
      n.hit.add(p);
      if(d<LETHAL)this.kill(p,n.owner,'nuke');
      else if(d<BLAST)this.damage(p,(p.cls?200:70)*(1-(d-LETHAL)/(BLAST-LETHAL)),n.owner,'nuke');
    }
    return t<50;
  }

  /* ---- airfield traffic ---- */
  rwBusy(b,p){
    if(b.rw&&b.rw!==p){if(!b.rw.alive||this.time-b.t>170)b.rw=null;else return true;}
    for(const q of this.planes)if(q!==p&&q.human&&q.alive&&q.ground&&q.pad===b.i&&this.rwAxis(b,q.x,q.z)===rwGeo(b,b.act).axis&&!(b.rw===q))return true;
    return this.baseClosed(b);
  }
  aiGround(p,dt){
    const b=this.bases[p.pad>=0?p.pad:p.base];
    p.gear=true;p.brake=false;
    if(p.gs==='roll'){
      const g=rwGeo(b,p.rwy);
      p.thr=1;p.yaw+=angDiff(g.yaw,p.yaw)*Math.min(1,dt*3);
      const e=(p.x-g.T.x)*g.px+(p.z-g.T.z)*g.pz;p.x-=g.px*e*Math.min(1,dt*2);p.z-=g.pz*e*Math.min(1,dt*2);
      p.spd=Math.min(p.spd+(p.cls?11:17)*dt,p.maxSpd*.75);
      if(b.rw===p&&(p.x-g.T.x)*g.dx+(p.z-g.T.z)*g.dz>270)b.rw=null;
      const vr=this.stallOf(p)+12;if(!TYPES[p.type].heli){this.groundPitch(p,dt,p.spd>vr*.9?(p.cls?.13:.16):0);p.y=this.ground(p.x,p.z)+p.gearH+this.pivotLift(p);}
      if(TYPES[p.type].heli?p.spd>15:p.spd>vr&&p.pitch>.08){p.ground=false;p.gs=null;p.gam=0;p.gear=true;p.ai.mode='fight';p.ai.air=0;p.ai.climb=7;p.airT=this.time;if(b.rw===p)b.rw=null;p.stand=-1;}
    }else if(p.gs==='rollout'){
      const g=rwGeo(b,p.rwy);
      p.thr=0;p.rev=!!TYPES[p.type].rev&&p.spd>25;p.brake=true;
      p.spd=Math.max(0,p.spd-(p.rev?14:11)*dt);p.yaw+=angDiff(g.yaw,p.yaw)*Math.min(1,dt*2);this.groundPitch(p,dt,0);p.y=this.ground(p.x,p.z)+p.gearH+this.pivotLift(p);
      if(p.spd<13){p.gs='taxi';p.next='stand';p.wi=0;p.flap=0;p.rev=false;p.wps=this.exitRoute(p,b);this.atc(p,'GROUND','taxi to stand '+(p.stand+1)+' via Alpha','stand '+(p.stand+1)+' via Alpha');}
    }else{
      const w=p.wps[p.wi];
      if(!w){
        p.spd=Math.max(0,p.spd-14*dt);
        if(p.next==='stand'){p.next='parked';p.atcT=this.time;p.yaw=-b.s*Math.PI/2;}
        else if(p.next==='parked'){if(this.time-p.atcT>20){p.alive=false;p.falling=false;p.ground=false;p.gs=null;p.respawn=6;p.noCost=true;p.stand=-1;this.emit('park',{id:p.id});}}
        else if(p.next==='hold'){
          if(p.atc!=='hold'){p.atc='hold';this.atc(p,'TOWER',this.rwBusy(b,p)?'hold short runway '+rwGeo(b,b.act).name+', traffic':'','',p.cs+' ready for departure runway '+rwGeo(b,b.act).name);}
          const Hh=this.holdFor(b,b.act,p.z);
          if(Math.hypot(p.x-Hh.x,p.z-Hh.z)>40){p.wps=this.routeToHold(p,b,false);p.wi=0;p.atc='taxi';}   // runway changed while waiting: taxi to the new holding point
          else if(!this.rwBusy(b,p)){b.rw=p;b.t=this.time;p.rwy=b.act;p.wps=this.lineupPath(b,p.rwy);p.wi=0;p.next='roll';this.atc(p,'TOWER','runway '+rwGeo(b,p.rwy).name+', line up and wait','line up and wait runway '+rwGeo(b,p.rwy).name);}
        }else if(p.next==='roll'){p.gs='roll';p.flap=.5;this.atc(p,'TOWER',this.windStr()+', runway '+rwGeo(b,p.rwy).name+', cleared for takeoff','cleared for takeoff runway '+rwGeo(b,p.rwy).name);}
      }else{
        const dx=w[0]-p.x,dz=w[1]-p.z,d=Math.hypot(dx,dz),df=angDiff(Math.atan2(dx,dz),p.yaw);
        p.yaw+=clamp(df,-1.3*dt,1.3*dt);
        let v=Math.abs(df)>.5?7:24,blocked=false;
        const sy=Math.sin(p.yaw),cy=Math.cos(p.yaw);
        for(const q of this.planes){
          if(q===p||!q.alive||!q.ground)continue;
          const qx=q.x-p.x,qz=q.z-p.z,qd=Math.hypot(qx,qz);
          if(qd<62&&(qx*sy+qz*cy)/qd>.6&&!(q.human&&p.blockT>8)){blocked=true;break;}
        }
        if(blocked){v=0;p.blockT+=dt;}else if(p.blockT>0)p.blockT=Math.max(0,p.blockT-dt*.5);
        p.spd+=clamp(v-p.spd,-14*dt,6*dt);
        if(d<12)p.wi++;
      }
    }
    if(b.rw===p&&(p.next==='stand'||p.next==='parked')&&!this.rwAxis(b,p.x,p.z))b.rw=null;
    p.x+=Math.sin(p.yaw)*p.spd*dt;p.z+=Math.cos(p.yaw)*p.spd*dt;if(p.gs!=='roll'&&p.gs!=='rollout')p.pitch=0;p.roll=0;p.y=this.ground(p.x,p.z)+p.gearH+this.pivotLift(p);
  }
  aiLand(p,dt){
    const ai=p.ai,b=this.homeBase(p),c={yaw:0,pitch:0,fire:false,thr:.8},F=fwd(p);
    if(this.inbound(p)&&Math.random()<dt*1.5)this.countermeasure(p,Math.random()<.5?'flare':'chaff');
    let tx,tz,ty;
    if(ai.mode==='rtb'){
      if(p.atc==='enroute'||p.atc==='dep'){p.atc='app';this.atc(p,'APPROACH','radar contact, descend and maintain '+ft(gatePt(b,b.act).y+200)+' feet, expect runway '+rwGeo(b,b.act).name,'descend '+ft(gatePt(b,b.act).y+200)+', runway '+rwGeo(b,b.act).name);}
      const f=gatePt(b,b.act);tx=f.x;tz=f.z;ty=Math.max(f.y,300);
      const d=Math.hypot(p.x-tx,p.z-tz);c.thr=d<3000?.3:.8;
      if(d<700){
        if(!this.rwBusy(b,p)){b.rw=p;b.t=this.time;p.rwy=b.act;ai.mode='final';p.gear=true;p.flap=1;this.atc(p,'TOWER',this.windStr()+', runway '+rwGeo(b,p.rwy).name+', cleared to land','cleared to land runway '+rwGeo(b,p.rwy).name);}
        else{ai.mode='hold';ai.holdT=0;this.atc(p,'TOWER','runway occupied, hold as published, expect further clearance','holding');}
      }
    }
    if(ai.mode==='hold'){
      const f=holdPt(b,b.act),a=Math.atan2(p.z-f.z,p.x-f.x)+.6;tx=f.x+Math.cos(a)*900;tz=f.z+Math.sin(a)*900;ty=f.y;c.thr=.45;
      ai.holdT+=dt;if(ai.holdT>8&&!this.rwBusy(b,p)){ai.holdT=0;ai.mode='rtb';}
    }
    if(ai.mode==='final'){
      const g=rwGeo(b,p.rwy),da=(g.A.x-p.x)*g.dx+(g.A.z-p.z)*g.dz,e=(p.x-g.A.x)*g.px+(p.z-g.A.z)*g.pz;
      ty=this.ground(g.A.x,g.A.z)+p.gearH+Math.max(0,da)*GS;
      c.yaw=clamp(angDiff(Math.atan2(g.dx*500-g.px*e*1.6,g.dz*500-g.pz*e*1.6),p.yaw)*2.5,-1,1);
      c.pitch=clamp((clamp((ty-p.y)/140-GS,-.22,.12)-p.pitch)*4,-1,1);
      c.thr=p.spd<this.stallOf(p)+18?.62:.1;
      if(-da>770&&p.y>PAD_Y+40){ai.mode='rtb';p.flap=.5;if(b.rw===p)b.rw=null;}   // overshot: quietly line up again (never happens in testing)
      return c;
    }
    c.yaw=clamp(angDiff(Math.atan2(tx-p.x,tz-p.z),p.yaw)*2,-1,1);
    c.pitch=clamp((clamp((ty-p.y)/700,-.3,.3)-p.pitch)*2,-1,1);
    this.terrainGuard(p,c,F);
    return c;
  }
  pickTarget(p){
    let best=null,bs=1e9;const F=fwd(p);
    for(const e of this.planes){
      if(e.team===p.team||!e.alive)continue;
      const dx=e.x-p.x,dy=e.y-p.y,dz=e.z-p.z,d=Math.hypot(dx,dy,dz)||1;
      if(!this.awacs[p.team]&&d>RADAR+1000)continue;
      let s=d*rnd(.7,1.3)+(1-(dx*F.x+dy*F.y+dz*F.z)/d)*800;
      let n=0;for(const q of this.planes)if(q!==p&&q.team===p.team&&q.alive&&q.ai.tgt===e)n++;
      s+=n*(e.human?1500:e.cls?500:900);
      if(e.cls===1)s-=1200;if(e.ground)s+=2500;
      if(s<bs){bs=s;best=e;}
    }
    return best;
  }
  inbound(p){for(const m of this.missiles)if(m.tgt===p&&Math.hypot(m.x-p.x,m.y-p.y,m.z-p.z)<2200)return m;return null;}
  terrainGuard(p,c,F){
    const la=p.spd*3;let gh=0;
    for(const k of[.25,.5,.75,1]){const h=this.ground(p.x+F.x*la*k,p.z+F.z*la*k);if(h>gh)gh=h;}
    if(p.y+F.y*la<gh+220||p.y<gh+180||p.y<MAPS[this.map].aiFloor){c.pitch=1;c.thr=1;c.fire=false;}
  }
  avoid(p,c,F){ // keep clear of other aircraft
    for(const q of this.planes){
      if(q===p||!q.alive||q.ground)continue;
      const dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z,d=Math.hypot(dx,dy,dz);
      if(d>(q.team===p.team?260:120)+q.rad||d<1)continue;
      if((dx*F.x+dy*F.y+dz*F.z)/d<.3)continue;
      c.yaw=(dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw))>0?1:-1;c.pitch=dy>0?-.6:.6;return true;
    }
    return false;
  }
  aiBig(p,dt){
    const ai=p.ai,c={yaw:0,pitch:0,fire:false,thr:.9},F=fwd(p);let tx=0,tz=0,ty,hold=false;
    if(p.cls===1){
      const eb=this.bases.find(b=>b.team!==p.team&&b.kind==='F'&&b.hp>0)||this.bases.find(b=>b.team!==p.team&&b.hp>0)||this.bases[0],ob=this.homeBase(p),de=Math.hypot(p.x-eb.x,p.z-eb.z);
      ty=1500;
      if(ai.phase===0){tx=eb.x;tz=eb.z;if(de<420){ai.phase=1;ai.drop=6;ai.dropT=0;}}
      else if(ai.phase===1){
        hold=true;ai.dropT-=dt;
        if(ai.dropT<=0&&ai.drop>0&&p.bombs>0){ai.drop--;p.bombs--;ai.dropT=.3;this.dropBomb(p,false);}
        if((ai.drop<=0||p.bombs<=0)&&de>2600)ai.phase=2;
      }else{tx=ob.x;tz=ob.z-3000;if(Math.hypot(p.x-tx,p.z-tz)<4000){ai.phase=0;ai.mode='rtb';}}
    }else{
      const ob=this.homeBase(p),cx=ob.x+ob.s*(ai.role==='transport'?3500:1800),cz=ob.z,a=Math.atan2(p.z-cz,p.x-cx)+.6,R=ai.role==='transport'?3200:1800;
      tx=cx+Math.cos(a)*R;tz=cz+Math.sin(a)*R;ty=ai.role==='transport'?1200:2200;
      if(ai.air>(ai.role==='transport'?220:600))ai.mode='rtb';
    }
    if(!hold)c.yaw=clamp(angDiff(Math.atan2(tx-p.x,tz-p.z),p.yaw)*2,-1,1);
    c.pitch=clamp((clamp((ty-p.y)/900,-.25,.25)-p.pitch)*2,-1,1);
    if(this.inbound(p)&&Math.random()<dt*1.2)this.countermeasure(p,Math.random()<.5?'flare':'chaff');
    this.avoid(p,c,F);this.terrainGuard(p,c,F);
    return c;
  }
  aiThink(p,dt){
    const ai=p.ai,D=this.diff;ai.air+=dt;
    if(p.gear&&!p.wantLand&&this.time-(p.airT||0)<20&&p.y-this.ground(p.x,p.z)>18&&p.vs<-.5)p.gear=false; // positive rate, then gear up
    if(ai.climb>0){ai.climb-=dt;if(ai.climb<=0)p.flap=0;return{yaw:0,pitch:clamp((.2-p.pitch)*3,-1,1),fire:false,thr:1};}
    if(ai.mode!=='fight')return this.aiLand(p,dt);
    if(p.cls)return this.aiBig(p,dt);
    if((p.msl===0&&ai.air>150)||p.hp<p.hpMax*.35||p.cond<.5||p.burn||ai.air>420){ai.mode='rtb';return this.aiLand(p,dt);}
    const c={yaw:0,pitch:0,fire:false,thr:1};
    ai.retgt-=dt;ai.mslCd-=dt;
    if(!ai.tgt||!ai.tgt.alive||ai.retgt<=0){ai.tgt=this.pickTarget(p);ai.retgt=rnd(2.5,6);}
    let threat=!!this.inbound(p);
    if(threat&&Math.random()<dt*1.6*ai.skill*D.flare){const m=this.inbound(p);this.countermeasure(p,m&&m.kind==='ir'?'flare':'chaff');}
    if(!threat)for(const e of this.planes){
      if(e.team===p.team||!e.alive||e.cls||e.ground)continue;
      const dx=p.x-e.x,dy=p.y-e.y,dz=p.z-e.z,d=Math.hypot(dx,dy,dz);
      if(d<700&&d>1){const G2=fwd(e);if((dx*G2.x+dy*G2.y+dz*G2.z)/d>.93){threat=true;break;}}
    }
    if(threat&&ai.evade<=0&&Math.random()<dt*2.5*ai.skill){ai.evade=rnd(1.2,2.6);ai.evDir=Math.random()<.5?-1:1;ai.evFlip=rnd(.6,1.2);}
    const F=fwd(p),t=ai.tgt;p.lock=0;
    if(ai.evade>0){
      ai.evade-=dt;ai.evFlip-=dt;ai.lockT=0;
      if(ai.evFlip<=0){if(Math.random()<.45)ai.evDir*=-1;ai.evFlip=rnd(.5,1.1);}
      c.yaw=ai.evDir;c.pitch=Math.sin(this.time*1.4+ai.jit)*.6;
    }else if(t){
      const d=Math.hypot(t.x-p.x,t.y-p.y,t.z-p.z),lt=d/BSPD,err=(1.05-ai.skill)*40*D.aim,G2=fwd(t);
      const ex=t.x+(G2.x*t.spd-F.x*p.spd)*lt+Math.sin(this.time*1.1+ai.jit)*err-p.x;
      const ey=t.y+(G2.y*t.spd-F.y*p.spd)*lt+Math.sin(this.time*.9+ai.jit*2)*err-p.y;
      const ez=t.z+(G2.z*t.spd-F.z*p.spd)*lt+Math.cos(this.time*1.3+ai.jit)*err-p.z;
      const el=Math.hypot(ex,ey,ez)||1,dot=(ex*F.x+ey*F.y+ez*F.z)/el;
      c.yaw=clamp(angDiff(Math.atan2(ex,ez),p.yaw)*2.5,-1,1);
      c.pitch=clamp((Math.atan2(ey,Math.hypot(ex,ez))-p.pitch)*3,-1,1);
      c.fire=TYPES[p.type].gun&&d<850&&dot>Math.cos(.03+(8+t.rad*.5)/Math.max(d,80));
      const rng=TYPES[p.type].mslKind==='ir'?2600:4200;
      if(p.msl>0&&!t.ground&&d<rng&&d>600&&dot>.985&&!(t.flareT>0||t.chaffT>0)){
        ai.lockT+=dt;p.lock=t.id;
        if(ai.lockT>1.6/D.msl&&ai.mslCd<=0){this.fireMissile(p,t);ai.mslCd=rnd(8,16)/D.msl;ai.lockT=0;}
      }else ai.lockT=0;
      const behind=F.x*G2.x+F.y*G2.y+F.z*G2.z>.5;
      if(d<350+t.rad&&behind&&!t.ground)c.thr=t.cls?.2:.4;
      if(d<170+t.rad*3&&(!behind||t.cls)){ai.evade=1;ai.evDir=c.yaw>0?-1:1;ai.evFlip=1.2;}
    }else{
      if(!ai.wp||Math.hypot(ai.wp.x-p.x,ai.wp.z-p.z)<500){const a=rnd(0,TAU),r=rnd(0,4000);ai.wp={x:Math.cos(a)*r,y:rnd(700,1600),z:Math.sin(a)*r};}
      const ex=ai.wp.x-p.x,ey=ai.wp.y-p.y,ez=ai.wp.z-p.z;
      c.yaw=clamp(angDiff(Math.atan2(ex,ez),p.yaw)*2,-1,1);c.pitch=clamp((Math.atan2(ey,Math.hypot(ex,ez))-p.pitch)*2,-1,1);c.thr=.8;
    }
    if(Math.hypot(p.x,p.z)>ARENA+300){c.yaw=clamp(angDiff(Math.atan2(-p.x,-p.z),p.yaw)*3,-1,1);ai.evade=0;}
    if(!ai.evade)this.avoid(p,c,F);
    this.terrainGuard(p,c,F);
    return c;
  }

  /* ---- the flight model ---- */
  stepPlane(p,dt){
    if(!p.alive){
      if(p.falling){
        const t=TYPES[p.type];
        p.pitch+=(-1.25-p.pitch)*dt*1.2;p.roll+=dt*(p.cls?1.2:3.5)*p.spin*(p.parts&3?2.2:1);p.spd+=(190-p.spd)*dt*.5;
        const F=fwd(p);p.x+=F.x*p.spd*dt;p.y+=F.y*p.spd*dt;p.z+=F.z*p.spd*dt;
        if(p.y<=this.ground(p.x,p.z)+2&&this.auth){p.falling=false;p.respawn=p.cls?25:8;this.emit('boom',{x:p.x,y:p.y,z:p.z,s:p.cls?2:1});this.crashSite(p,'crash');this.emit('crash',{id:p.id,kind:'explode',x:p.x,y:p.y,z:p.z,yaw:p.yaw,spd:p.spd,type:p.type});}
      }else if(this.auth&&!p.human){
        p.respawn-=dt;
        if(p.respawn<=0&&!this.over){
          const home=this.baseOf(p.team,kindOf(p.cls));
          if(home.hp<=0&&p.cls)p.respawn=1e9;
          else if(p.noCost||this.reserve[p.team]>0){if(!p.noCost)this.reserve[p.team]--;this.spawn(p);}
        }
      }else if(p.human)p.respawn-=dt;
      return;
    }
    p.gearT=clamp(p.gearT+(p.gear&&!p.collapsed?1:-1)*dt/1.6,0,1);
    p.flapT+=clamp(p.flap-p.flapT,-dt*.5,dt*.5);
    p.cool-=dt;p.mslCd-=dt;p.flareCd-=dt;p.flareT-=dt;p.chaffT-=dt;p.comp=Math.max(0,p.comp-dt*2.4);
    if(p.burn&&this.auth){
      if(p.ground&&p.spd<6){p.burn=false;this.dmgNote(p,'FIRE OUT — CRASH CREW ON SCENE','#7ddc6f');}
      else{const tough=Math.sqrt(p.hpMax/100);p.dm[3]=Math.min(1,p.dm[3]+dt*.008/tough);this.hitZone(p,4,dt*.042/tough,p.lastHitBy,'fire');if(!p.alive)return;}
    }
    if(p.remote)return;                      // kinematics arrive from the owning client
    const t=TYPES[p.type],ai=!p.human;
    if(p.sliding)return this.stepSlide(p,dt);
    if(p.ground){
      if(ai){if(!p.gs){p.gs='rollout';p.rwy=this.bases[p.pad>=0?p.pad:p.base].act;}this.aiGround(p,dt);this.atcUpdate(p);return;}
      return this.stepGround(p,dt,ai?{yaw:0,pitch:0}:p.ctl);
    }
    const c=ai?this.aiThink(p,dt):p.ctl;
    if(ai)p.thr+=(c.thr-p.thr)*Math.min(1,dt*2);
    p.fire=!!c.fire&&!!t.gun&&p.ammo>0;
    if(!p.human&&p.ai.mode==='final'&&this.padAt(p.x,p.z)===this.homeBase(p).i&&p.y<=this.ground(p.x,p.z)+p.gearH+1.5){
      const b=this.homeBase(p);p.ground=true;p.gs='rollout';p.pitch=clamp(p.pitch,0,.2);p.pitchS=0;p.roll=0;p.y=this.ground(p.x,p.z)+p.gearH;p.pad=b.i;p.base=b.i;p.ai.mode='fight';p.comp=.6;
      this.emit('touch',{id:p.id,x:p.x,z:p.z,vs:2});this.atc(p,'TOWER','exit runway when able, contact ground','wilco');return;
    }
    if(t.heli)this.stepHeli(p,c,dt);
    else{
      let yi=c.yaw,pi=c.pitch;const stall=this.stallOf(p);
      if(p.spd<stall+3)pi=Math.min(pi,-.4);
      if(p.y>4200)pi=Math.min(pi,-.3);
      if(p.flapT>0&&p.spd>p.minSpd*1.9&&p.flap>0){p.flap=0;if(p.human)this.emit('notice',{text:'FLAPS RETRACTED — TOO FAST',to:p.id});}
      const resp=Math.min(1,dt*4/t.inertia);
      p.yawS+=(yi-p.yawS)*resp;p.pitchS+=(pi-p.pitchS)*Math.min(1,dt*5/t.inertia);
      const dm=p.dm,asym=dm[0]-dm[1],elev=dm[2]>=1?.18:1-dm[2]*.6;
      let ag=clamp(1.35-p.spd/480,.6,1)*p.agil;if(p.parts&3)ag*=.6;ag*=1-.35*Math.max(dm[0],dm[1]);
      p.yaw+=p.yawS*ag*dt+(p.parts&1?-.25:p.parts&2?.25:0)*dt-asym*.14*dt;
      p.pitch=clamp(p.pitch+p.pitchS*.9*ag*elev*dt-(dm[2]>.5?(dm[2]-.5)*.12*dt:0),-1.3,1.3);   // a shot-up tail droops the nose and answers less
      p.roll+=(-p.yawS*(p.cls?.55:1.2)+asym*.5-p.roll)*Math.min(1,dt*3.5);   // a damaged wing drops
      p.g=Math.min(9,1+(Math.hypot(Math.cos(p.pitch)+p.pitchS*.9*ag*p.spd/G,p.yawS*ag*p.spd/G)-1)*.36);
      const eng=p.dm[3]>=1?0:1-p.dm[3]*.55,want=(p.minSpd*(eng?1:.55)+(p.maxSpd-p.minSpd)*p.thr*eng)*(1-.22*p.gearT-.2*p.flapT)*(1-.12*(p.dm[0]+p.dm[1]));
      p.spd=clamp(p.spd+(want-p.spd)*dt*.5/Math.sqrt(t.inertia)-Math.sin(p.pitch)*30*dt-Math.abs(p.yawS)*7*dt,50,p.maxSpd*1.25);
      const F=fwd(p),W=this.wind();
      const agl=p.y-this.ground(p.x,p.z)-p.gearH,tau=(p.cls?.9:.45)*Math.max(clamp(1-agl/90,0,1),clamp(1-(this.time-(p.airT||0))/5,0,1));
      if(p.gam===undefined)p.gam=p.pitch;p.gam+=(p.pitch-p.gam)*(tau>0?Math.min(1,dt/tau):1);   // flight path follows the nose with a little lag near the ground
      const vy=Math.sin(p.gam)*p.spd;
      p.x+=(F.x*p.spd+W.x)*dt;p.y+=vy*dt;p.z+=(F.z*p.spd+W.z)*dt;
      if(this.weather.storm>.5&&!p.ground){const k=this.weather.storm*dt;p.pitch+=rnd(-.08,.08)*k;p.yaw+=rnd(-.05,.05)*k;p.y+=rnd(-3,3)*k;}
      const sink=p.human||p.dm[3]>=1?clamp((stall+10-p.spd)*.35,0,15):0;   // below approach speed the wing stops holding you up
      p.y-=sink*dt;p.vs=sink-vy;
    }
    if(this.contact(p,dt))return;
    // guns
    if(p.reload>0){p.reload-=dt;if(p.reload<=0)p.ammo=400;}
    if(p.fire&&p.cool<=0&&p.reload<=0){
      p.cool=.07;p.ammo-=2;
      if(this.auth)this.fireGun(p);
      if(p.ammo<=0&&!p.human)p.reload=2.5;
    }
    if(p.human&&p.ctl.bomb&&p.cls===1&&p.cool<=0&&p.ammo>0){}
    this.atcUpdate(p);
  }
  stepHeli(p,c,dt){
    const t=TYPES[p.type],F0=Math.cos(p.yaw),S0=Math.sin(p.yaw);
    p.yawS+=(c.yaw-p.yawS)*Math.min(1,dt*3);p.yaw+=p.yawS*.75*dt;
    const tp=-c.pitch*.32;p.pitch+=(tp-p.pitch)*Math.min(1,dt*2);   // stick forward: nose down, accelerate
    p.roll+=(-p.yawS*.25-p.roll)*Math.min(1,dt*3);
    const lift=(p.thr*1.3-1)*G*.6;p.vy+=(lift-p.vy*.6)*dt;p.vy=clamp(p.vy,-14,12);
    p.spd=clamp(p.spd+(-Math.sin(p.pitch)*14-p.spd*.06)*dt,-12,t.max);
    const W=this.wind();
    p.x+=(S0*p.spd+W.x*.5)*dt;p.z+=(F0*p.spd+W.z*.5)*dt;p.y+=p.vy*dt;p.vs=-p.vy;p.g=1;
  }
  fireGun(p){
    const F=fwd(p),t=TYPES[p.type];let ax=F.x,ay=F.y,az=F.z;
    if(p.human&&(p.aimX||p.aimY||p.aimZ)){ax=p.aimX;ay=p.aimY;az=p.aimZ;}
    const rx=-Math.cos(p.yaw),rz=Math.sin(p.yaw);
    for(const s of[-1,1]){
      const j=()=>rnd(-.006,.006);
      this.bullets.push({x:p.x+rx*2*s+F.x*12,y:p.y-1+F.y*12,z:p.z+rz*2*s+F.z*12,vx:(ax+j())*BSPD+F.x*p.spd,vy:(ay+j())*BSPD+F.y*p.spd,vz:(az+j())*BSPD+F.z*p.spd,life:1.1,team:p.team,owner:p});
    }
    if(this.bullets.length>900)this.bullets.splice(0,this.bullets.length-900);
  }
  // touching the ground in flight: a landing, a bounce, a belly slide or a crash
  contact(p,dt){
    const t=TYPES[p.type],gh=this.ground(p.x,p.z),surf=this.surface(p.x,p.z),wheels=p.gearT>.95&&!p.collapsed&&surf!=='water';
    if(p.y>=gh+(wheels?p.gearH:3))return false;
    if(!this.auth&&!p.local)return false;
    if(wheels&&p.vs<.5&&p.y>gh+p.gearH-3){p.y=gh+p.gearH;return false;}           // climbing away: still flying
    if(!p.human&&wheels&&p.ai.mode!=='final'&&p.vs<6&&Math.abs(p.roll)<.5){       // AI brushing the ground: touch and go
      p.y=gh+p.gearH+.5;p.pitch=Math.max(p.pitch,.12);return false;
    }
    const slope=this.slope(p.x,p.z),stall=this.stallOf(p),vMax=t.heli?30:stall*1.6,lim=t.gearLimit*(t.heli?1.6:1);
    const by=this.time-p.hitT<8?p.lastHitBy:null;
    if(surf==='water'){
      if(p.vs<6&&p.spd<stall*1.5){this.emit('crash',{id:p.id,kind:'ditch',x:p.x,y:0,z:p.z,yaw:p.yaw,spd:p.spd,type:p.type});this.reportCrash(p,by,'ditch');}
      else{this.emit('crash',{id:p.id,kind:'explode',x:p.x,y:0,z:p.z,yaw:p.yaw,spd:p.spd,type:p.type});this.reportCrash(p,by,'crash');}
      return true;
    }
    const okAttitude=Math.abs(p.roll)<.35&&p.pitch>-.14,soft=p.vs<=lim*1.7&&p.spd<vMax*1.2&&slope<.14;
    if(wheels&&okAttitude&&soft){
      const hard=p.vs>lim;
      p.comp=clamp(p.vs/lim,.2,1.3);
      if(hard){p.gearDmg+=(p.vs-lim)/(lim*.55);if(p.human)p.hp-=Math.max(0,p.vs-lim)*6;}
      this.emit('touch',{id:p.id,x:p.x,z:p.z,vs:p.vs,surf,hard});
      if(p.human){this.emit('notice',{to:p.id,text:p.gearDmg>=1?'GEAR COLLAPSED':hard?'HARD LANDING':surf==='asphalt'?'GOOD LANDING':'GRASS LANDING — KEEP IT STRAIGHT',col:p.gearDmg>=1?'#ff5a4d':hard?'#ffd23f':'#7ddc6f'});}
      if(p.gearDmg>=1){p.collapsed=true;p.gear=false;this.startSlide(p,'gear');return true;}
      if(p.hp<=0){this.reportCrash(p,by,'crash');return true;}
      if(p.vs>lim*1.15&&!t.heli){p.pitch=.07;p.pitchS=.3;p.y=gh+p.gearH+.5+p.vs*.08;p.spd*=.96;return true;}  // bounce
      p.ground=true;p.pad=this.padAt(p.x,p.z);p.pitch=clamp(p.pitch,0,.25);p.pitchS=0;p.roll=0;p.y=gh+p.gearH+this.pivotLift(p);p.vy=0;if(p.pad>=0)p.base=p.pad;
      this.atcTouchdown(p);
      return true;
    }
    // no landing: belly in, or a crash
    const severe=p.vs>(t.heli?9:14)||slope>.3||p.pitch<-.35||(p.spd>vMax*1.6&&p.vs>6);
    if(!severe){
      if(Math.abs(p.roll)>.35){p.parts|=p.roll>0?2:1;this.emit('breakup',{id:p.id,part:p.roll>0?'wingR':'wingL'});}
      p.collapsed=true;p.gear=false;p.hp-=20+p.vs*4;this.startSlide(p,wheels?'attitude':'belly');return true;
    }
    this.emit('crash',{id:p.id,kind:'explode',x:p.x,y:gh,z:p.z,yaw:p.yaw,pitch:p.pitch,spd:p.spd,vs:p.vs,type:p.type,lv:p.lv,team:p.team});
    this.reportCrash(p,by,'crash');
    return true;
  }
  reportCrash(p,by,how){ // the server decides; a remote client reports its own crash
    if(this.auth)this.kill(p,by,how);else this.emit('selfcrash',{id:p.id,how});
  }
  startSlide(p,why){
    p.sliding=true;p.ground=true;p.spinR=rnd(-.6,.6)*(why==='attitude'?2:1);p.y=this.ground(p.x,p.z)+1.2;p.pitch=0;
    this.emit('crash',{id:p.id,kind:'slide',x:p.x,y:p.y,z:p.z,yaw:p.yaw,spd:p.spd,type:p.type,why});
    if(p.human)this.emit('notice',{to:p.id,text:'BELLY SLIDE — HOLD ON',col:'#ff5a4d'});
  }
  stepSlide(p,dt){
    const surf=this.surface(p.x,p.z),mu={asphalt:.5,grass:.36,crater:.7,sand:.6,rock:.7,water:.9}[surf]||.45;
    p.spd=Math.max(0,p.spd-mu*G*dt*(1+p.mass/400));
    p.spinR*=Math.exp(-dt*.6);p.yaw+=p.spinR*dt;
    const mv=p.yaw+p.spinR*.3;
    p.x+=Math.sin(mv)*p.spd*dt;p.z+=Math.cos(mv)*p.spd*dt;
    const g=this.ground(p.x,p.z);
    if(g>p.y+4&&p.spd>8){this.emit('crash',{id:p.id,kind:'explode',x:p.x,y:g,z:p.z,yaw:p.yaw,spd:p.spd,type:p.type});this.reportCrash(p,null,'crash');return;}
    p.y=g+1.1;p.roll+=(0-p.roll)*dt*2;p.hp-=p.spd*.02*dt;
    if(surf==='water'){this.reportCrash(p,null,'ditch');return;}
    if(p.spd<.5){
      p.sliding=false;
      if(p.human)this.emit('notice',{to:p.id,text:'AIRCRAFT WRITTEN OFF — YOU WALKED AWAY',col:'#ffd23f'});
      this.reportCrash(p,this.time-p.hitT<8?p.lastHitBy:null,'crash');
    }
  }
  stepGround(p,dt,c){
    const t=TYPES[p.type],surf=this.surface(p.x,p.z);
    if(t.heli){
      if(p.thr>.62){p.ground=false;p.vy=1;p.airT=this.time;p.stand=-1;this.atcAirborne(p);return;}
      p.spd=Math.max(0,p.spd-4*dt);p.x+=Math.sin(p.yaw)*p.spd*dt;p.z+=Math.cos(p.yaw)*p.spd*dt;p.yaw+=(c.yaw||0)*.6*dt;p.y=this.ground(p.x,p.z)+p.gearH;p.pitch=0;p.roll=0;
      this.atcUpdate(p);return;
    }
    const RR={asphalt:.25,grass:1.4,crater:3,sand:3.6,rock:2.6}[surf]||1.2,MU={asphalt:.62,grass:.32,crater:.3,sand:.25,rock:.4}[surf]||.4;
    let acc=p.thr*(p.cls?11:17)/Math.sqrt(t.inertia);
    if(p.brake&&p.thr<.05)acc-=MU*G*(1-p.gearDmg*.5);
    if(p.rev&&t.rev&&p.spd>3)acc-=4.2;
    acc-=p.spd*p.spd*.0006+RR;
    if(p.spd<.05&&acc<0)acc=0;
    p.spd=clamp(p.spd+acc*dt,0,p.maxSpd*.75);
    if(surf!=='asphalt'&&p.spd>8){
      p.comp=Math.max(p.comp,rnd(0,.25)*clamp(p.spd/40,0,1));
      if((surf==='sand'||surf==='rock')&&p.spd>30){p.gearDmg+=dt*.08*(p.spd-30)/10;}
    }
    if(surf==='crater'&&p.spd>6){p.gearDmg+=.6+p.spd/40;this.emit('notice',{to:p.id,text:'HIT A CRATER',col:'#ff5a4d'});}
    if(p.gearDmg>=1){p.collapsed=true;p.gear=false;this.startSlide(p,'gear');return;}
    p.yawS+=((c.yaw||0)-p.yawS)*Math.min(1,dt*4);
    const grip=surf==='asphalt'?1:.75;
    p.yaw+=p.yawS*clamp(p.spd/8,0,1)*(1-clamp((p.spd-30)/90,0,.75))*.7*grip*dt;
    p.pitchS+=((c.pitch||0)-p.pitchS)*Math.min(1,dt*5);
    const vr=this.stallOf(p)+10;
    this.groundPitch(p,dt,(c.pitch||0)>.15&&p.spd>vr*.88?Math.min(p.cls?.17:.24,.06+(c.pitch||0)*.2):0);
    p.roll=0;
    p.x+=Math.sin(p.yaw)*p.spd*dt;p.z+=Math.cos(p.yaw)*p.spd*dt;
    const g=this.ground(p.x,p.z);
    if(g>p.y-p.gearH+3&&p.spd>5){this.emit('crash',{id:p.id,kind:'explode',x:p.x,y:g,z:p.z,yaw:p.yaw,spd:p.spd,type:p.type});this.reportCrash(p,null,'crash');return;}
    p.y=g+p.gearH*(1-p.comp*.12)+this.pivotLift(p);p.pad=this.padAt(p.x,p.z);
    if(MAPS[this.map].sea&&this.surface(p.x,p.z)==='water'){this.reportCrash(p,null,'ditch');return;}
    if(p.spd>vr&&p.pitch>.07){p.ground=false;p.rearmed=false;p.gam=0;p.airT=this.time;p.stand=-1;this.atcAirborne(p);}
    this.atcUpdate(p);
  }

  /* ---- ATC: ground, tower, departure and approach, driven by what each aircraft is doing ---- */
  windStr(){const w=this.weather;return w.windKt<3?'wind calm':'wind '+String(Math.round(w.windDir/10)*10||360).padStart(3,'0')+' at '+Math.round(w.windKt);}
  atc(p,unit,text,readback,pilot){
    if(!text&&!pilot)return;
    const b=this.bases[p.pad>=0?p.pad:p.base]||this.homeBase(p);
    this.emit('atc',{to:p.id,team:p.team,human:p.human,base:b.i,unit,station:b.name.replace(' Field',''),cs:p.cs,text,readback:readback||'',pilot:pilot||''});
  }
  atcTouchdown(p){
    const b=this.bases[p.pad>=0?p.pad:p.base];if(!b)return;
    p.atc='landed';p.atcT=this.time;p.wantLand=false;
    if(p.human)this.atc(p,'TOWER','welcome to '+b.name+', exit runway when able, contact ground','exit when able');
  }
  atcAirborne(p){p.atc='climb';p.atcT=this.time;}
  atcUpdate(p){
    if(!p.human||!p.alive)return;
    const hb=this.homeBase(p),now=this.time,since=now-p.atcT,b=p.pad>=0?this.bases[p.pad]:null;
    const say=(unit,text,rb,state)=>{this.atc(p,unit,text,rb);if(state)p.atc=state;p.atcT=now;};
    if(p.ground){
      p.wantLand=false;p.lrw=-1;
      if(!b){if(p.atc!=='field'&&p.spd<2)say('GROUND','',null,'field');return;}
      const g=rwGeo(b,b.act),ax=this.rwAxis(b,p.x,p.z),H=this.holdFor(b,b.act,p.z),dh=Math.hypot(p.x-H.x,p.z-H.z);
      if(b.rw===p&&!ax&&now-b.t>4)b.rw=null;
      if(this.rtb)return;
      switch(p.atc){
        case'park':case'field':
          if(b.team!==p.team){say('GROUND','you are on an enemy airfield','', 'wrong');break;}
          if(b!==hb&&p.spd<2){say('GROUND','this is '+b.name+'. Your aircraft belongs at '+hb.name+'. No rearm here. Taxi to holding point runway '+g.name+' when ready','taxi holding point '+g.name,'taxi');break;}
          if(since>1.5)say('GROUND',b.name+' ground, taxi to holding point runway '+g.name+' via '+H.tw+(H.back?', backtrack on the runway when cleared':'')+', contact tower when ready','holding point '+g.name+' via '+H.tw,'taxi');
          break;
        case'taxi':
          if(ax===g.axis)p.atc='onrw';
          else if(dh<45&&p.spd<4){
            if(this.rwBusy(b,p))say('TOWER','hold short runway '+g.name+', traffic on the runway','holding short '+g.name,'holdshort');
            else{b.rw=p;b.t=now;say('TOWER','runway '+g.name+', line up and wait','line up and wait '+g.name,'lineup');}
          }
          break;
        case'holdshort':
          if(!this.rwBusy(b,p)&&since>3){b.rw=p;b.t=now;say('TOWER','runway '+g.name+', line up and wait','line up and wait '+g.name,'lineup');}
          else if(ax===g.axis)p.atc='onrw';
          break;
        case'lineup':case'onrw':
          if(ax){
            b.rw=p;b.t=now;
            const arriving=this.planes.some(q=>q!==p&&q.alive&&!q.ground&&q.ai.mode==='final'&&this.homeBase(q)===b&&Math.hypot(q.x-b.x,q.z-b.z)<3000);
            if(!arriving&&p.spd<6&&since>2.5)say('TOWER',this.windStr()+', runway '+g.name+' clear, cleared for takeoff','cleared for takeoff '+g.name,'cleared');
          }
          break;
        case'landed':
          if(!ax&&since>2)say('GROUND',b.name+' ground, taxi to stand '+((p.stand=p.stand>=0?p.stand:this.freeStand(b))+1)+' via Alpha','stand '+(p.stand+1),'tostand');
          break;
        case'tostand':{
          const sp=this.standPos(b,p.stand);
          if(Math.hypot(p.x-sp.x,p.z-sp.z)<35&&p.spd<2)say('GROUND','parking stand '+(p.stand+1)+', shut down when ready. Ground crew are standing by','','parked');
          break;}
      }
      return;
    }
    const dHome=Math.hypot(p.x-hb.x,p.z-hb.z);
    switch(p.atc){
      case'climb':case'cleared':case'lineup':case'onrw':
        if(p.y>320&&now-p.airT>4)say('TOWER','contact departure, good day','departure, good day','dep1');
        break;
      case'dep1':{
        if(since<2.5)break;
        const eb=this.bases.find(q=>q.team!==p.team&&q.kind==='F')||this.bases[0],hd=hdgStr(Math.atan2(eb.x-p.x,eb.z-p.z));
        const turn=angDiff(Math.atan2(eb.x-p.x,eb.z-p.z),p.yaw)>0?'left':'right',alt=p.cls?6000:8000;
        say('DEPARTURE','radar contact, climb and maintain '+alt+' feet, turn '+turn+' heading '+hd,'climb '+alt+', '+turn+' heading '+hd,'dep');break;}
      case'dep':
        if(since>45||dHome>11000)p.atc='enroute';
        break;
    }
    if(this.rtb||(p.gear&&now-p.airT>25)||(p.gearT>.5&&dHome<4000))p.wantLand=dHome<15000;
    if(p.wantLand&&(p.atc==='enroute'||p.atc==='dep'||p.atc==='dep1'||p.atc==='climb')){
      const gp=gatePt(hb,hb.act),hd=hdgStr(Math.atan2(gp.x-p.x,gp.z-p.z)),turn=angDiff(Math.atan2(gp.x-p.x,gp.z-p.z),p.yaw)>0?'left':'right';
      say('APPROACH',hb.name.replace(' Field','')+' approach, radar contact, descend and maintain '+ft(gp.y+150)+' feet, turn '+turn+' heading '+hd+', vectors ILS runway '+rwGeo(hb,hb.act).name,'descend '+ft(gp.y+150)+', heading '+hd,'app');
      p.lrw=hb.act;
    }
    if(!p.wantLand&&(p.atc==='app'||p.atc==='final'||p.atc==='cont'||p.atc==='hold')){if(hb.rw===p)hb.rw=null;p.atc='enroute';p.lrw=-1;}
    const g=rwGeo(hb,p.lrw>=0?p.lrw:hb.act),da=(g.A.x-p.x)*g.dx+(g.A.z-p.z)*g.dz,e=(p.x-g.A.x)*g.px+(p.z-g.A.z)*g.pz;
    switch(p.atc){
      case'app':
        if(da>0&&da<6500&&Math.abs(e)<1600&&since>4){
          // a pilot on approach always gets the runway: the tower holds the AI traffic instead of sending you around
          hb.rw=p;hb.t=now;say('TOWER',this.windStr()+', runway '+g.name+', cleared to land','cleared to land '+g.name,'final');
        }
        break;
      case'cont':
        hb.rw=p;hb.t=now;say('TOWER','runway '+g.name+', cleared to land','cleared to land '+g.name,'final');
        break;
      case'final':{
        hb.rw=p;hb.t=now;
        const gy=this.ground(g.A.x,g.A.z)+p.gearH+Math.max(0,da)*GS;
        // advice only — never a go-around: you are cleared, land it however you can
        const tip=da<2500&&da>150?(p.gearT<.95&&!(p.dm&&p.burn)?'gear':p.y-gy>140?'high':Math.abs(e)>160?'line':p.spd>this.stallOf(p)*2.1?'fast':''):'';
        if(tip&&tip!==p.atcTip&&since>3){p.atcTip=tip;this.atc(p,'TOWER',{gear:'check gear down',high:'you are high on the glidepath, increase descent',line:'correct to the centreline',fast:'speed high, reduce power'}[tip],'');}
        if(da<-900&&!p.ground&&p.y>this.ground(p.x,p.z)+60){p.atc='app';p.atcTip='';}   // flew past it: the tower just lines you up again
        break;}
      case'goaround':
        if(hb.rw===p)hb.rw=null;
        if(since>25){p.atc='enroute';}
        break;
    }
  }

  /* ---- weather ---- */
  stepWeather(dt){
    const w=this.weather;
    w.tod=(w.tod+dt*w.daySpeed/60)%24;
    w.gust=w.storm>.3?Math.sin(this.time*.7)*w.windKt*.25*w.storm:Math.sin(this.time*.3)*w.windKt*.06;
    if(!this.auth)return;
    if(w.dynamic){
      w.nextChange-=dt;
      if(w.nextChange<=0){w.nextChange=rnd(180,360);const k=pick(['clear','fair','fair','overcast','rain','storm','fog']);w.target=Object.assign({},WX_PRESETS[k],{windDir:(w.windDir+rnd(-60,60)+360)%360,name:k});this.emit('wx',{name:k});}
      if(w.target){const T=w.target,k=Math.min(1,dt*.01);for(const f of['cloud','rain','storm','fog'])w[f]+=(T[f]-w[f])*k;w.windKt+=(T.wind-w.windKt)*k;w.windDir+=angDiff(T.windDir*D2R,w.windDir*D2R)/D2R*k;}
    }
    if(w.storm>.5&&Math.random()<dt*.12*w.storm){
      const p=this.planes.find(q=>q.human&&q.alive)||{x:0,z:0};
      this.emit('lightning',{x:p.x+rnd(-6000,6000),z:p.z+rnd(-6000,6000)});
    }
  }
  windShift(){
    for(const b of this.bases){
      if(this.time<b.next)continue;b.next=this.time+rnd(90,150);
      if(b.rw)continue;
      // pick the open runway most into the wind
      const wd=this.weather.windDir*D2R,opts=[0,1,2,3].filter(r=>!b.closed[rwGeo(b,r).axis]);if(!opts.length)continue;
      let best=opts[0],bs=-9;for(const r of opts){const g=rwGeo(b,r),s=-(g.dx*Math.sin(wd)+g.dz*Math.cos(wd))*-1+Math.random()*.6;if(s>bs){bs=s;best=r;}}
      if(this.weather.windKt<6)best=pick(opts);
      if(best!==b.act)this.setActive(b,best,'wind');
    }
  }
  stepRepairs(dt){
    for(const b of this.bases){
      b.quiet+=dt;
      if(b.hp<=0)continue;
      if(b.quiet>45&&b.hp<100)b.hp=Math.min(100,b.hp+dt*.03);
      if(b.quiet<20){if(b.repair){b.repair=null;}continue;}
      if(!b.repair){
        // wrecks on the runway first, then runway craters, then the rest, then buildings
        const wreck=this.wrecks.find(w=>this.padAt(w.x,w.z)===b.i&&!w.cleared);
        const cr=this.craters.filter(c=>c.base===b.i&&!c.done).sort((a,c)=>(c.rw?1:0)-(a.rw?1:0))[0];
        const bl=b.bld.find(o=>o.dmg>0&&o.h);
        if(wreck)b.repair={kind:'wreck',id:wreck.id,x:wreck.x,z:wreck.z,t:0,need:40};
        else if(cr)b.repair={kind:'crater',id:cr.id,x:cr.x,z:cr.z,t:0,need:20+cr.r*2};
        else if(bl)b.repair={kind:'bld',id:bl.id,x:bl.x,z:bl.z,t:0,need:120};
        if(b.repair){b.fire=b.repair.kind==='wreck'?b.repair.id:null;this.emit('repair',{base:b.i,kind:b.repair.kind,x:b.repair.x,z:b.repair.z});this.dmgVer++;}
        continue;
      }
      const R=b.repair;R.t+=dt;
      if(R.t>=R.need){
        if(R.kind==='wreck'){const w=this.wrecks.find(q=>q.id===R.id);if(w)w.cleared=true;}
        else if(R.kind==='crater'){const c=this.craters.find(q=>q.id===R.id);if(c){c.done=true;c.rep=1;}}
        else{const o=b.bld.find(q=>q.id===R.id);if(o)o.dmg=0;}
        b.repair=null;b.fire=null;this.updateClosures(b);this.emit('repaired',{base:b.i,kind:R.kind,id:R.id});this.dmgVer++;
      }
    }
    const before=this.wrecks.length;
    this.wrecks=this.wrecks.filter(w=>!(w.cleared||this.time-w.t>240));
    if(before!==this.wrecks.length){for(const b of this.bases)this.updateClosures(b);this.dmgVer++;}
  }

  /* ---- one simulation step ---- */
  step(dt){
    if(dt<=0)return;
    this.time+=dt;
    this.awacs=[false,false];for(const p of this.planes)if(p.alive&&!p.ground&&TYPES[p.type].awacs)this.awacs[p.team]=true;
    for(const p of this.planes)this.stepPlane(p,dt);
    if(this.auth){
      for(let i=0;i<this.planes.length;i++)for(let j=i+1;j<this.planes.length;j++){
        const a=this.planes[i],b=this.planes[j];
        if(!a.alive||!b.alive||(a.ground&&b.ground))continue;
        if(Math.abs(a.x-b.x)>80||Math.abs(a.z-b.z)>80)continue;
        if(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<(a.rad+b.rad)*.45){
          this.emit('crash',{id:a.id,kind:'midair',x:a.x,y:a.y,z:a.z});
          this.kill(a,a.team!==b.team?b:null,'crash');this.kill(b,a.team!==b.team?a:null,'crash');
        }
      }
      for(let i=this.bullets.length-1;i>=0;i--){
        const b=this.bullets[i];b.life-=dt;
        const sx=b.vx*dt,sy=b.vy*dt,sz=b.vz*dt,sl=sx*sx+sy*sy+sz*sz;
        let gone=b.life<=0;
        if(!gone)for(const p of this.planes){
          if(p.team===b.team||!p.alive)continue;
          const px=p.x-b.x,py=p.y-b.y,pz=p.z-b.z;if(px*px+py*py+pz*pz>4e4)continue;
          const u=clamp((px*sx+py*sy+pz*sz)/sl,0,1),dx=px-sx*u,dy=py-sy*u,dz=pz-sz*u;
          if(dx*dx+dy*dy+dz*dz<p.rad*p.rad){const hx=b.x+sx*u,hy=b.y+sy*u,hz=b.z+sz*u,z=this.zoneAt(p,this.toLocal(p,hx,hy,hz));if(z<0)continue;
            gone=true;const il=1/Math.sqrt(sl);this.emit('hole',{id:p.id,x:r1(hx),y:r1(hy),z:r1(hz),dx:r2(sx*il),dy:r2(sy*il),dz:r2(sz*il)});
            this.hitZone(p,z,[.085,.085,.11,.1,.08,.2][z]/Math.sqrt(p.hpMax/100),b.owner,'gun');break;}
        }
        b.x+=sx;b.y+=sy;b.z+=sz;
        if(b.y<16){const pd=this.padAt(b.x,b.z);if(pd>=0&&this.bases[pd].team!==b.team&&b.owner.human&&b.y<this.ground(b.x,b.z)+2){this.hitBase(pd,.25);gone=true;}if(b.y<0)gone=true;}
        if(gone)this.bullets.splice(i,1);
      }
    }
    for(let i=this.missiles.length-1;i>=0;i--)if(!this.stepMissile(this.missiles[i],dt)){this.emit('mgone',{id:this.missiles[i].id});this.missiles.splice(i,1);}
    for(let i=this.bombs.length-1;i>=0;i--){
      const b=this.bombs[i],dr=Math.exp(-dt*(b.nuke?.7:.15));
      b.vx*=dr;b.vz*=dr;b.vy+=((b.nuke?-62:-150)-b.vy)*Math.min(1,dt*1.1);
      b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
      const gh=this.ground(b.x,b.z);
      if(b.y<=gh+2){
        this.bombs.splice(i,1);this.emit('bgone',{id:b.id});
        if(!this.auth)continue;
        if(b.nuke){this.detonate(b.x,gh,b.z,b.owner);continue;}
        const water=MAPS[this.map].sea&&this.surface(b.x,b.z)==='water';
        this.emit('boom',{x:b.x,y:gh+4,z:b.z,s:2,water});
        if(!water)this.addCrater(b.x,b.z,rnd(9,14),b.owner,'bomb');
        for(const eb of this.bases)if(eb.team!==b.owner.team&&Math.hypot(b.x-eb.x,b.z-eb.z)<1000)this.hitBase(eb.i,b.owner.human?4:1.5);
        for(const p of this.planes)if(p.alive&&Math.hypot(p.x-b.x,p.y-gh,p.z-b.z)<40)this.damage(p,120,b.owner,'bomb');
      }
    }
    for(let i=this.nukes.length-1;i>=0;i--)if(!this.stepNuke(this.nukes[i],dt))this.nukes.splice(i,1);
    this.stepWeather(dt);
    if(this.auth){
      this.windShift();this.stepRepairs(dt);
      for(const p of this.planes){
        if(!p.human||!p.alive||!this.terrain.gates.length)continue;
        const g=this.terrain.gates[p.gate%this.terrain.gates.length];
        if(Math.hypot(p.x-g.x,p.y-g.y,p.z-g.z)<135){p.gate++;this.emit('gate',{to:p.id,n:p.gate});if(p.gate%this.terrain.gates.length===0)this.emit('loop',{to:p.id});}
      }
      if(this.time>=this.duration&&!this.over){const w=this.score[0]===this.score[1]?-1:this.score[0]>this.score[1]?0:1;this.finish(w,'Time is up');}
      if(this.rtb&&!this.over){const lp=this.planes.find(q=>q.local);if(lp&&lp.alive&&lp.ground&&lp.pad===this.homeBase(lp).i&&lp.spd<3)this.finish(lp.team,this.rtb.why+' · landed safely at '+this.homeBase(lp).name);}
    }
  }

  /* ---- networking helpers ---- */
  snapshot(){
    const P=[];
    for(const p of this.planes){
      const f=(p.alive?1:0)|(p.falling?2:0)|(p.ground?4:0)|(p.gear?8:0)|(p.sliding?16:0)|(p.collapsed?32:0)|(p.fire?64:0)|(p.brake?128:0)|(p.rev?256:0)|(p.flareT>0?512:0)|(p.chaffT>0?1024:0)|(p.burn?2048:0);
      P.push([p.id,r1(p.x),r1(p.y),r1(p.z),r3(p.yaw),r3(p.pitch),r3(p.roll),r1(p.spd),r2(p.thr),f,r2(p.gearT),r2(p.flapT),Math.max(0,Math.round(p.hp)),p.lock||0,r2(p.comp),p.parts,p.pad,Math.round(p.respawn),p.msl,p.ammo,p.bombs,p.flares,p.chaff,p.kills,p.deaths,p.dm.map(v=>Math.round(v*100))]);
    }
    const M=this.missiles.map(m=>[m.id,r1(m.x),r1(m.y),r1(m.z),r3(m.dx),r3(m.dy),r3(m.dz),m.team,m.kind==='ir'?1:0,m.tgt?m.tgt.id:0]);
    const B=this.bombs.map(b=>[b.id,r1(b.x),r1(b.y),r1(b.z),r1(b.vx),r1(b.vy),r1(b.vz),b.nuke?1:0]);
    return{t:r2(this.time),P,M,B};
  }
  damageState(){
    return{v:this.dmgVer,craters:this.craters.map(c=>[c.id,r1(c.x),r1(c.z),r1(c.r),c.done?1:0,c.base]),
      wrecks:this.wrecks.map(w=>[w.id,r1(w.x),r1(w.y),r1(w.z),r3(w.yaw),w.type,w.lv,w.team,w.burn?1:0]),
      bld:this.bases.map(b=>b.bld.map(o=>r2(o.dmg))),
      bases:this.bases.map(b=>[r1(b.hp),b.act,b.closed.ns?1:0,b.closed.ew?1:0,b.repair?[b.repair.kind,r1(b.repair.x),r1(b.repair.z),r2(b.repair.t/b.repair.need)]:0])};
  }
  applyDamageState(d){
    this.craters=d.craters.map(c=>({id:c[0],x:c[1],z:c[2],r:c[3],done:!!c[4],base:c[5],rw:null}));
    for(const c of this.craters){const b=c.base>=0?this.bases[c.base]:null;if(b)c.rw=this.rwAxis(b,c.x,c.z);}
    this.wrecks=d.wrecks.map(w=>({id:w[0],x:w[1],y:w[2],z:w[3],yaw:w[4],type:w[5],lv:w[6],team:w[7],burn:!!w[8]}));
    d.bld.forEach((a,i)=>a.forEach((v,j)=>{if(this.bases[i].bld[j])this.bases[i].bld[j].dmg=v;}));
    d.bases.forEach((q,i)=>{const b=this.bases[i];b.hp=q[0];b.act=q[1];b.closed.ns=!!q[2];b.closed.ew=!!q[3];b.repair=q[4]?{kind:q[4][0],x:q[4][1],z:q[4][2],t:q[4][3],need:1}:null;});
    this.dmgVer=d.v;
  }
}
const r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100,r3=v=>Math.round(v*1000)/1000;
function T_RIVER(x){return Math.abs(x)<85;}
function fwd(p,o){const c=Math.cos(p.pitch);o=o||{};o.x=Math.sin(p.yaw)*c;o.y=Math.sin(p.pitch);o.z=Math.cos(p.yaw)*c;return o;}

return{World,TYPES,AIR_FORCES,FLEET,MAPS,KIND,RWYS,STANDS,TEAM,NAMES,DIFF,WX_PRESETS,
  ARENA,BSPD,LETHAL,BLAST,RADAR,PAD_Y,BR,GS,CELL,
  rwGeo,gatePt,holdPt,kindOf,fwd,clamp,rnd,angDiff,mulberry,kt,ft,hdgOf,hdgStr,loopR};
});
