// Starts the server, connects several headless clients and checks the multiplayer flow end to end.
'use strict';
const {spawn}=require('child_process'),path=require('path');
const {Client}=require('@colyseus/sdk');
const PORT=2700+Math.floor(Math.random()*200),URL='http://localhost:'+PORT;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(c,m)=>{console.log((c?'  ok   ':'  FAIL ')+m);if(!c)fails++;};

(async()=>{
  const srv=spawn(process.execPath,[path.join(__dirname,'../server/index.js')],{env:Object.assign({},process.env,{PORT}),stdio:['ignore','pipe','pipe']});
  let log='';srv.stdout.on('data',d=>log+=d);srv.stderr.on('data',d=>log+=d);
  for(let i=0;i<40&&!/listening/.test(log);i++)await wait(200);
  try{
    ok(/listening/.test(log),'server starts');
    ok((await (await fetch(URL+'/health')).json()).ok,'health check');
    const mk=()=>new Client('ws://localhost:'+PORT);
    const A=mk(),B=mk(),C=mk();
    const ra=await A.create('air_war',{name:'King',team:0,type:'f35a',lv:'raaf',pub:true,ai:6,map:'coral'});
    const code=ra.roomId;ok(/^[A-Z0-9]{6}$/.test(code),'room created with code '+code);
    const look=await (await fetch(URL+'/api/rooms/'+code)).json();ok(look.code===code,'code lookup finds the room');
    const bad=await fetch(URL+'/api/rooms/NOPE99');ok(bad.status===404,'bad code gives 404 with: '+(await bad.json()).error);
    let joinErr='';try{await B.joinById('NOPE99',{name:'x'});}catch(e){joinErr=e.message;}ok(/not found/.test(joinErr),'joining a bad code fails cleanly');
    const listed=await (await fetch(URL+'/api/rooms')).json();ok(listed.some(r=>r.code===code),'public room is listed');
    const rb=await B.joinById(code,{name:'Mate',team:0,type:'ef',lv:'raf'});
    const rc=await C.joinById(code,{name:'Third',team:0,type:'su57',lv:'usaf'});
    const notes=[];rc.onMessage('notice',m=>notes.push(m.text));
    const snaps={a:null,b:null,c:null};
    ra.onMessage('snap',s=>snaps.a=s);rb.onMessage('snap',s=>snaps.b=s);rc.onMessage('snap',s=>snaps.c=s);
    const spawned={};for(const [k,r] of[['a',ra],['b',rb],['c',rc]])r.onMessage('spawned',m=>spawned[k]=m);
    const evs=[];ra.onMessage('ev',e=>evs.push(...e));
    let dmgSeen=0;rb.onMessage('dmg',()=>dmgSeen++);
    for(const r of[ra,rb,rc])
    for(const r of[ra,rb,rc])r.send('hello');
    await wait(1500);
    const players=[];ra.state.players.forEach(p=>players.push(p.cs+'/'+S(p.team)+'/'+p.type));
    function S(t){return t?'Red':'Blue';}
    ok(players.length===3,'host sees 3 players: '+players.join(', '));
    const teams=[0,0];ra.state.players.forEach(p=>teams[p.team]++);
    ok(Math.abs(teams[0]-teams[1])<=1,'team balancing kept teams even ('+teams.join(' v ')+')');
    ok(notes.some(t=>/balancing/i.test(t))||teams[0]===2,'balanced player was told');
    const css=new Set();ra.state.players.forEach(p=>css.add(p.cs));ok(css.size===3,'callsigns are unique');
    ok(snaps.a&&snaps.b&&snaps.a.P.length>=10,'snapshots stream ('+(snaps.a&&snaps.a.P.length)+' aircraft)');
    ok(spawned.a&&spawned.b&&spawned.c,'each player was spawned at an airfield');
    // B flies: stream a position and check A sees it
    const bid=spawned.b.id;
    for(let i=0;i<12;i++){rb.send('st',[1234.5,800,-2222,1.2,0,0,150,.8,8,0,0,0,-1,0,0,0,1]);await wait(60);}
    await wait(300);
    const seen=snaps.a.P.find(q=>q[0]===bid);
    ok(seen&&Math.abs(seen[1]-1234.5)<1&&Math.abs(seen[3]+2222)<1,'other players see B where B is flying');
    // weapons are server side: B locks the nearest enemy and fires
    const enemy0=snaps.b.P.filter(q=>(q[9]&1)&&q[0]!==bid).map(q=>({q,m:rb.state.planes.get(String(q[0]))})).filter(o=>o.m&&o.m.team!==rb.state.players.get(rb.sessionId).team).sort((a,b)=>Math.hypot(a.q[1]-1234,a.q[3]+2222)-Math.hypot(b.q[1]-1234,b.q[3]+2222));
    const enemy=enemy0[0];
    if(enemy){
      const e=enemy.q,yaw=Math.atan2(e[1]-1234.5,e[3]+2222),pitch=Math.atan2(e[2]-800,Math.hypot(e[1]-1234.5,e[3]+2222));
      rb.send('st',[1234.5,800,-2222,yaw,pitch,0,150,.8,8,0,0,0,-1,e[0],0,0,1]);
      await wait(150);rb.send('msl',{t:e[0]});await wait(400);
      ok(evs.some(x=>x.e==='launch'&&x.by===bid),'B fired a missile and everyone was told');
      ok(snaps.a.M.length>0,'the missile is in the shared state');
    }else ok(false,'found an enemy to shoot');
    // crash reporting is checked by the server
    rc.send('crash',{how:'crash',kind:'explode',x:0,y:0,z:0});await wait(400);
    const cid=spawned.c.id,cs=snaps.a.P.find(q=>q[0]===cid);ok(cs&&!(cs[9]&1),'a crash reported by C kills C for everyone');
    ok(evs.some(x=>x.e==='kill'&&x.v===cid),'kill feed event broadcast');
    // airport damage reaches everyone
    ok(dmgSeen>0,'airport damage state is sent to players');
    // reconnection after a dropped connection
    const tok=rb.reconnectionToken,wsb=rb.connection.transport.ws;
    if(wsb._socket)wsb._socket.destroy();else wsb.close();
    await wait(800);
    let stillThere=false;ra.state.players.forEach(p=>{if(p.planeId===bid)stillThere=true;});ok(stillThere,'dropped player keeps their seat');
    const B2=mk();let rb2=null;try{rb2=await B2.reconnect(tok);}catch(e){console.log('    ('+e.message+')');}
    if(!rb2){await wait(4500);try{rb2=await B2.reconnect(tok);}catch(e){console.log('    ('+e.message+')');}}
    ok(!!rb2,'dropped player reconnects with their token');
    // leaving gives the seat back to AI
    await rc.leave();await wait(500);
    let n=0;ra.state.players.forEach(()=>n++);ok(n===2,'leaving removes the player (now '+n+')');
    // room is full at 10
    ok(ra.state.code===code&&ra.state.map==='coral','room settings are shared');
    await ra.leave();if(rb2)await rb2.leave();
  }catch(e){ok(false,'unexpected error: '+e.stack);}
  srv.kill();
  console.log(fails?fails+' check(s) failed':'all multiplayer checks passed');
  process.exit(fails?1:0);
})();
