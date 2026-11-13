'use strict';
// Coral Front multiplayer server: serves the game and hosts Colyseus rooms over WebSockets.
const path=require('path'),http=require('http'),express=require('express');
const {Server,matchMaker}=require('@colyseus/core');
const {WebSocketTransport}=require('@colyseus/ws-transport');
const {AirWarRoom}=require('./AirWarRoom.js');

const PORT=Number(process.env.PORT)||2567;
const ROOT=path.join(__dirname,'..');
const app=express();
app.disable('x-powered-by');
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');next();});

// health check for Render
app.get('/health',async(req,res)=>{
  let rooms=0;try{rooms=(await matchMaker.query({name:'air_war'})).length;}catch(e){}
  res.json({ok:true,uptime:Math.round(process.uptime()),rooms});
});
// public room browser
app.get('/api/rooms',async(req,res)=>{
  try{
    const list=await matchMaker.query({name:'air_war'});
    res.json(list.filter(r=>r.metadata&&r.metadata.pub&&!r.private).map(r=>({code:r.roomId,title:r.metadata.title,map:r.metadata.map,mode:r.metadata.mode,players:r.clients,max:r.maxClients})));
  }catch(e){res.status(500).json({error:'Could not list rooms'});}
});
// does a room code exist?
app.get('/api/rooms/:code',async(req,res)=>{
  const code=String(req.params.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  try{
    const r=await matchMaker.getRoomById(code);
    if(!r)return res.status(404).json({error:'No room with code '+code});
    if(r.clients>=r.maxClients)return res.status(409).json({error:'Room '+code+' is full'});
    res.json({code,title:r.metadata&&r.metadata.title,players:r.clients,max:r.maxClients,map:r.metadata&&r.metadata.map});
  }catch(e){res.status(500).json({error:'Lookup failed'});}
});

const cache={maxAge:'1h'};
app.use('/shared',express.static(path.join(ROOT,'shared'),cache));
app.use('/vendor/three',express.static(path.join(ROOT,'node_modules/three/build'),cache));
app.use('/vendor/three-ex',express.static(path.join(ROOT,'node_modules/three/examples/js'),cache));
app.use('/vendor/colyseus',express.static(path.join(ROOT,'node_modules/@colyseus/sdk/dist'),cache));
app.use(express.static(path.join(ROOT,'public'),{maxAge:'10m'}));

const server=http.createServer(app);
const gameServer=new Server({transport:new WebSocketTransport({server,pingInterval:6000,pingMaxRetries:4}),gracefullyShutdown:true});
gameServer.define('air_war',AirWarRoom);
gameServer.listen(PORT).then(()=>console.log('Coral Front server listening on port '+PORT));
process.on('unhandledRejection',e=>console.error('unhandled',e));
