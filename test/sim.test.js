// Runs the shared simulation headless on every map and checks that matches play out sensibly.
'use strict';
const S=require('../shared/sim.js');
let fails=0;const ok=(c,m)=>{console.log((c?'  ok   ':'  FAIL ')+m);if(!c)fails++;};
for(const map of Object.keys(S.MAPS)){
  const w=new S.World({map,aiPerTeam:8,difficulty:'normal'});w.populate([0,0]);
  const n={kill:0,launch:0,touch:0,atc:0,crater:0};let err=null;
  try{for(let i=0;i<30*600;i++){w.step(1/30);for(const e of w.events)if(n[e.e]!==undefined)n[e.e]++;w.events.length=0;}}catch(e){err=e;}
  ok(!err,map+': 10 minutes simulated without errors'+(err?' — '+err.message:''));
  ok(n.launch>0&&n.kill>0,map+': AI fights ('+n.launch+' missiles, '+n.kill+' kills)');
  ok(n.touch>0,map+': AI lands ('+n.touch+' touchdowns)');
  ok(w.planes.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)),map+': every aircraft has a valid position');
  const s=w.snapshot();ok(s.P.length===w.planes.length&&JSON.stringify(s).length<60000,map+': snapshot '+(JSON.stringify(s).length/1024).toFixed(1)+' KB');
}
// every aircraft type can be spawned and flown
const w=new S.World({map:'coral',aiPerTeam:0,support:false});let bad=[];
for(const t of Object.keys(S.TYPES)){try{const p=w.addPlane({team:0,type:t});w.spawn(p,{air:true});for(let i=0;i<60;i++)w.step(1/30);if(!Number.isFinite(p.y))bad.push(t);}catch(e){bad.push(t+': '+e.message);}}
ok(!bad.length,Object.keys(S.TYPES).length+' aircraft types spawn and fly'+(bad.length?' — '+bad.join(', '):''));
// a human landing on the runway is a landing, not a crash
{const w=new S.World({map:'coral',aiPerTeam:0,support:false}),p=w.addPlane({team:0,type:'f16',human:true,local:true});w.spawn(p,{});
 const b=w.homeBase(p),g=S.rwGeo(b,b.act);Object.assign(p,{ground:false,x:g.A.x-g.dx*20,z:g.A.z-g.dz*20,y:S.PAD_Y+p.gearH+1,yaw:g.yaw,pitch:-.02,spd:p.minSpd*1.25,thr:.3,gear:true,gearT:1,flap:1,flapT:1});
 for(let i=0;i<60;i++)w.step(1/30);ok(p.alive&&p.ground,'gentle touchdown on the runway lands the aircraft');}
process.exit(fails?1:0);
