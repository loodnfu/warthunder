'use strict';
/* ---------- HUD ---------- */
const FONT='"Avenir Next Condensed","Roboto Condensed","Arial Narrow",system-ui,sans-serif';
function txt(s,x,y,col,align,size,weight){
  ctx.font=(weight||600)+' '+(size||13)+'px '+FONT;ctx.textAlign=align||'left';
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillText(s,x+1,y+1);ctx.fillStyle=col;ctx.fillText(s,x,y);
}
function circle(x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
function diamond(x,y,r){ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();ctx.stroke();}
function proj(x,y,z){
  _v.set(x,y,z).applyMatrix4(camera.matrixWorldInverse);
  const front=_v.z<-1,cx=_v.x,cy=_v.y;
  _v.applyMatrix4(camera.projectionMatrix);
  return{x:(_v.x*.5+.5)*W,y:(-_v.y*.5+.5)*H,front,cx,cy,on:front&&Math.abs(_v.x)<1&&Math.abs(_v.y)<1};
}
function edgeArrow(s,col,r){
  const a=Math.atan2(-s.cy,s.cx);r=r||Math.min(W,H)*.4;
  ctx.save();ctx.translate(W/2+Math.cos(a)*r,H/2+Math.sin(a)*r);ctx.rotate(a);ctx.fillStyle=col;
  ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(-7,-7);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.restore();
}
function marker(pt,label,col,always){ // labelled world waypoint
  const s=proj(pt.x,pt.y,pt.z);
  if(s.on){ctx.strokeStyle=col;diamond(s.x,s.y,9);txt(label,s.x,s.y-14,col,'center',12,800);}
  else if(always)edgeArrow(s,col,Math.min(W,H)*.36);
}
function fighterHUD(pl,g){ // green head-up symbology, clipped to the combiner glass (F-35: helmet display, no glass)
  const t=TYPES[pl.type],th=Math.tan(camera.fov*Math.PI/360),ax=W/H,GR='#49ff7a';
  let x0,x1,y0,y1;
  if(t.hud){
    cockCam.updateMatrixWorld();cockCam.matrixWorldInverse.copy(cockCam.matrixWorld).invert();
    const a=_v.set(-t.hud[0]/2,HUD_Y+t.hud[1],-HUD_Z).project(cockCam);x0=(a.x*.5+.5)*W;y0=(-a.y*.5+.5)*H;
    const b=_v.set(t.hud[0]/2,HUD_Y,-HUD_Z).project(cockCam);x1=(b.x*.5+.5)*W;y1=(-b.y*.5+.5)*H;
  }
  else{x0=W/2-H*.34;x1=W/2+H*.34;y0=H*.12;y1=H*.68;}
  const cx=(x0+x1)/2,wd=x1-x0;
  ctx.save();ctx.beginPath();ctx.rect(x0,y0,wd,y1-y0);ctx.clip();
  ctx.strokeStyle=GR;ctx.fillStyle=GR;ctx.lineWidth=1.5;ctx.font='600 12px monospace';
  // pitch ladder
  const pd=pl.pitch*180/Math.PI;
  const dir=(yw,pt)=>{const c=Math.cos(pt);return proj(pl.x+Math.sin(yw)*c*2000,pl.y+1.9+Math.sin(pt)*2000,pl.z+Math.cos(yw)*c*2000);};
  for(let a=-85;a<=85;a+=5){
    if(Math.abs(a-pd)>16)continue;
    const pr=a*Math.PI/180,hw=a===0?.34:.085,A=dir(pl.yaw+hw,pr),B=dir(pl.yaw-hw,pr);
    if(!A.front||!B.front)continue;
    ctx.beginPath();
    if(a===0){ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);}
    else{
      if(a<0)ctx.setLineDash([6,5]);
      ctx.moveTo(A.x,A.y);ctx.lineTo(A.x+(B.x-A.x)*.36,A.y+(B.y-A.y)*.36);ctx.moveTo(B.x,B.y);ctx.lineTo(B.x+(A.x-B.x)*.36,B.y+(A.y-B.y)*.36);
    }
    ctx.stroke();ctx.setLineDash([]);
    if(a!==0){ctx.textAlign='center';ctx.fillText(String(Math.abs(a)),A.x+(A.x-B.x)*.12,A.y+(A.y-B.y)*.12+4);ctx.fillText(String(Math.abs(a)),B.x+(B.x-A.x)*.12,B.y+(B.y-A.y)*.12+4);}
  }
  // heading tape
  const hdg=((-pl.yaw*180/Math.PI)%360+360)%360,ppd=wd/34,ty=y0+22;
  ctx.beginPath();
  for(let d=Math.ceil((hdg-17)/5)*5;d<=hdg+17;d+=5){
    const x=cx+(d-hdg)*ppd;ctx.moveTo(x,ty);ctx.lineTo(x,ty+(d%10?4:8));
    if(d%10===0){ctx.textAlign='center';ctx.fillText(('0'+Math.round(((d%360)+360)%360/10)).slice(-2),x,ty-4);}
  }
  ctx.moveTo(cx-5,ty+17);ctx.lineTo(cx,ty+10);ctx.lineTo(cx+5,ty+17);ctx.stroke();
  // boxes: airspeed left, altitude right
  const by=g.y-10,bx0=x0+8,bx1=x1-8;
  ctx.font='700 14px monospace';
  ctx.strokeRect(bx0,by,50,20);ctx.textAlign='right';ctx.fillText(String(kt(pl.spd)),bx0+45,by+15);
  ctx.strokeRect(bx1-58,by,58,20);ctx.fillText(String(ft(pl.y)),bx1-5,by+15);
  ctx.font='600 11px monospace';ctx.textAlign='left';
  ctx.fillText('M '+(pl.spd/340).toFixed(2),bx0,by+36);ctx.fillText('G '+pl.g.toFixed(1),bx0,by+50);
  ctx.textAlign='right';ctx.fillText('VS '+Math.round(-pl.vs*197/100)*100,bx1,by+36);
  ctx.textAlign='left';ctx.fillText(pl.msl>0?t.mslName+' '+pl.msl:'GUN',bx0,y1-22);ctx.fillText('RNDS '+pl.ammo,bx0,y1-8);
  ctx.textAlign='right';ctx.fillText(pl.gearT>0?'GEAR':'',bx1,y1-22);ctx.fillText(pl.flap>0?'FLAP '+(pl.flap>=1?'FULL':'T/O'):'',bx1,y1-8);
  // boresight cross and flight path marker
  ctx.strokeStyle=hitFlash>0?'#ff5a4d':GR;ctx.beginPath();
  ctx.moveTo(g.x-12,g.y);ctx.lineTo(g.x-4,g.y);ctx.moveTo(g.x+4,g.y);ctx.lineTo(g.x+12,g.y);ctx.moveTo(g.x,g.y-12);ctx.lineTo(g.x,g.y-4);ctx.moveTo(g.x,g.y+4);ctx.lineTo(g.x,g.y+12);
  const fy=g.y+clamp(pl.vs-(-Math.sin(pl.pitch)*pl.spd),0,15)*3;
  ctx.moveTo(g.x+7,fy);ctx.arc(g.x,fy,7,0,TAU);ctx.moveTo(g.x-7,fy);ctx.lineTo(g.x-18,fy);ctx.moveTo(g.x+7,fy);ctx.lineTo(g.x+18,fy);ctx.moveTo(g.x,fy-7);ctx.lineTo(g.x,fy-13);
  ctx.stroke();
  ctx.restore();
}
function approachGuide(pl,hb,g){ // green boxes down the glidepath, ILS needles and PAPI lights
  const da=(g.A.x-pl.x)*g.dx+(g.A.z-pl.z)*g.dz,e=(pl.x-g.A.x)*g.px+(pl.z-g.A.z)*g.pz,gy=PAD_Y+pl.gearH;
  if(da<-300)return;
  const gp=gatePt(hb,lrwOf(pl)),gd=Math.hypot(pl.x-gp.x,pl.z-gp.z);
  if(da>4700)marker(gp,'APPROACH GATE '+ft(gp.y)+' ft  '+nm(gd),'#2fd65a',true);
  ctx.lineWidth=2;
  for(let k=Math.min(4500,Math.floor((da-120)/300)*300);k>=0&&k>da-1800;k-=300){
    if(k<0||k>da-80)continue;
    const cx=g.A.x-g.dx*k,cz=g.A.z-g.dz*k,cy=gy+k*GS,w=34,h=22;
    const c=[[-1,-1],[1,-1],[1,1],[-1,1]].map(q=>proj(cx+g.px*w*q[0],cy+h*q[1],cz+g.pz*w*q[0]));
    if(!c.every(q=>q.front))continue;
    ctx.strokeStyle='rgba(47,214,90,'+clamp(1-(da-k)/2000,.25,.95)+')';
    ctx.beginPath();c.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.stroke();
  }
  // ILS: glideslope and localiser needles
  const ang=Math.atan2(pl.y-gy,Math.max(1,da))*180/Math.PI,gsd=clamp((ang-3)/.7,-1,1),loc=clamp(Math.atan2(e,da+1300)*180/Math.PI/2.5,-1,1);
  const bx=W-Math.min(210,W*.2),by=H*.36,R=56;
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(bx-R-14,by-R-30,2*R+28,2*R+76);
  ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1.2;ctx.strokeRect(bx-R,by-R,2*R,2*R);
  ctx.fillStyle='rgba(255,255,255,.7)';for(const k of[-2,-1,1,2]){circle(bx+k*R/2.4,by,2.2);circle(bx,by+k*R/2.4,2.2);}
  const lc=Math.abs(loc)<.2&&Math.abs(gsd)<.2?'#2fd65a':'#ffd23f';
  ctx.strokeStyle=lc;ctx.lineWidth=3;ctx.beginPath();
  ctx.moveTo(bx+loc*R,by-R+4);ctx.lineTo(bx+loc*R,by+R-4);ctx.moveTo(bx-R+4,by+gsd*R);ctx.lineTo(bx+R-4,by+gsd*R);ctx.stroke();
  ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(bx-8,by);ctx.lineTo(bx+8,by);ctx.moveTo(bx,by-8);ctx.lineTo(bx,by+8);ctx.stroke();
  txt('ILS RWY '+g.name+'  '+nm(Math.max(0,da)),bx,by-R-12,'#eef3f5','center',13,800);
  txt(gsd>.25?'HIGH — DESCEND':gsd<-.25?'LOW — CLIMB':'ON GLIDESLOPE',bx,by+R+18,Math.abs(gsd)>.25?'#ffd23f':'#2fd65a','center',12,800);
  txt(loc>.2?'FLY RIGHT':loc<-.2?'FLY LEFT':'ON CENTRELINE',bx,by+R+34,Math.abs(loc)>.2?'#ffd23f':'#2fd65a','center',12,800);
  // PAPI: 2 white over 2 red is on path
  const th=[3.5,3.17,2.83,2.5];for(let i=0;i<4;i++){ctx.fillStyle=ang>th[i]?'#fff':'#ff3b30';circle(bx-27+i*18,by+R+52,5);}
  // the same four lights beside the runway
  const lp=proj(g.A.x+g.px*85,PAD_Y+2,g.A.z+g.pz*85);
  if(lp.on&&da>200)for(let i=0;i<4;i++){ctx.fillStyle=ang>th[i]?'#fff':'#ff3b30';circle(lp.x+(i-1.5)*clamp(9000/Math.max(da,400),3,14),lp.y,clamp(5000/Math.max(da,400),2,6));}
}
function drawHUD(){
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,W,H);
  const pl=player&&player.alive&&state==='play'?player:null;
  ctx.lineWidth=1.5;
  // contacts
  for(const p of planes){
    if(!p.alive||p===player)continue;
    const enemy=player?p.team!==player.team:false;
    if(enemy&&!canSee(p))continue;
    const T=TEAM[p.team],s=proj(p.x,p.y,p.z);
    const d=pl?Math.hypot(p.x-pl.x,p.y-pl.y,p.z-pl.z):0;
    if(s.on){
      const b=pl?clamp((p.cls?26000:10000)/Math.max(d,1),9,p.cls?70:36):12;
      ctx.strokeStyle=T.col;
      if(enemy||!player){ctx.strokeRect(s.x-b,s.y-b,b*2,b*2);}
      else{ctx.beginPath();ctx.moveTo(s.x-7,s.y-b-2);ctx.lineTo(s.x,s.y-b-9);ctx.lineTo(s.x+7,s.y-b-2);ctx.stroke();}
      if(!pl||enemy||p.cls||d<3000)txt(p.cs+(pl&&enemy?'  '+nm(d):''),s.x,s.y-b-12,T.col,'center',12);
      if(pl&&enemy){
        ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(s.x-b,s.y+b+4,b*2,3);
        ctx.fillStyle=T.col;ctx.fillRect(s.x-b,s.y+b+4,b*2*clamp(p.hp/p.hpMax,0,1),3);
        if(d<1100&&!pl.ground){
          const lt=d/BSPD;fwd(p,G);fwd(pl,F);
          const l=proj(p.x+(G.x*p.spd-F.x*pl.spd)*lt,p.y+(G.y*p.spd-F.y*pl.spd)*lt,p.z+(G.z*p.spd-F.z*pl.spd)*lt);
          if(l.front){ctx.strokeStyle='#ffd23f';ctx.beginPath();ctx.arc(l.x,l.y,8,0,TAU);ctx.stroke();
            ctx.strokeStyle='rgba(255,210,63,.35)';ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(l.x,l.y);ctx.stroke();}
        }
        if(p===lockTgt&&pl.msl>0){
          const lk=lockT>=1.2;ctx.strokeStyle=lk?'#ff3b30':'#ffd23f';ctx.lineWidth=2;
          if(!lk)ctx.setLineDash([6,5]);diamond(s.x,s.y,b+10+(lk?0:10*(1-lockT/1.2)));ctx.setLineDash([]);ctx.lineWidth=1.5;
          txt(lk?'LOCK — F':'LOCKING',s.x,s.y+b+24,lk?'#ff3b30':'#ffd23f','center',13,800);
        }
      }
    }else if(pl&&enemy&&d<6000&&!pl.ground)edgeArrow(s,'rgba(255,90,77,.9)');
  }
  for(const m of missiles){
    const hot=pl&&m.tgt===pl,s=proj(m.x,m.y,m.z);
    if(s.on){ctx.strokeStyle=hot?'#ff3b30':'rgba(255,255,255,.7)';diamond(s.x,s.y,hot?8:5);}
    else if(hot)edgeArrow(s,'#ff3b30',Math.min(W,H)*.33);
  }
  if(pl){
    const foes=BASES.filter(b=>b.team!==pl.team&&b.hp>0);
    if(!pl.ground)for(const b of foes)marker({x:b.x,y:30,z:b.z},'ENEMY '+KIND[b.kind].short+' BASE '+Math.ceil(b.hp)+'%  '+nm(Math.hypot(pl.x-b.x,pl.z-b.z)),'#ff5a4d',false);
    const near=foes.reduce((a,b)=>!a||Math.hypot(pl.x-b.x,pl.z-b.z)<Math.hypot(pl.x-a.x,pl.z-a.z)?b:a,null);
    if(near&&(pl.bombs>0&&(pl.cls||Math.hypot(pl.x-near.x,pl.z-near.z)<7000))&&!pl.ground){
      const q=bombFall(pl),bs=proj(q[0],q[1],q[2]),off=Math.hypot(q[0]-near.x,q[2]-near.z);
      if(bs.on){ctx.strokeStyle='#ffa040';ctx.lineWidth=2;ctx.beginPath();ctx.arc(bs.x,bs.y,12,0,TAU);ctx.moveTo(bs.x-18,bs.y);ctx.lineTo(bs.x+18,bs.y);ctx.moveTo(bs.x,bs.y-18);ctx.lineTo(bs.x,bs.y+18);ctx.stroke();ctx.lineWidth=1.5;}
      txt(off<900?'BOMBS ON TARGET — DROP [B]':'BOMB IMPACT '+nm(off)+' FROM '+near.name.toUpperCase(),W/2,H*.7,off<900?'#7ddc6f':'#ffa040','center',18,800);
    }
    if(gates.length&&!pl.ground){const g=gates[gateIdx];marker(g,'GATE '+(gateIdx+1)+'/'+gates.length+'  '+nm(Math.hypot(pl.x-g.x,pl.z-g.z)),'#ffd23f',false);}
    // airfield guidance
    const hb=homeBase(pl);
    if(pl.ground&&pl.pad>=0&&!rtb){
      const b=BASES[pl.pad],g=rwGeo(b,b.act),hp=holdFor(b,b.act,pl.z);
      if(!rwAxis(b,pl.x,pl.z))marker({x:hp.x,y:PAD_Y+6,z:hp.z},'HOLD SHORT '+g.name,'#ffd23f',true);
      marker({x:g.T.x,y:PAD_Y+6,z:g.T.z},'RUNWAY '+g.name,'#7ddc6f',false);
    }
    if(!pl.ground&&(wantLand||rtb||pl.ammo<=0)){
      const lr=pl.lrw>=0?pl.lrw:hb.act,g=rwGeo(hb,lr);
      marker({x:g.A.x,y:PAD_Y,z:g.A.z},hb.name.toUpperCase()+' RWY '+g.name+'  '+nm(Math.hypot(pl.x-g.A.x,pl.z-g.A.z)),'#7ddc6f',true);
      if(twr.hold){const h=holdPt(hb,hb.act);marker(h,'HOLD '+ft(h.y)+' ft','#35d0e0',true);}
      if(wantLand&&pl.lrw>=0)approachGuide(pl,hb,g);
    }
  }
  for(const b of bombs){
    if(!b.nuke)continue;const s=proj(b.x,b.y,b.z);
    if(s.on){ctx.strokeStyle='#ffd23f';ctx.beginPath();ctx.arc(s.x,s.y,10,0,TAU);ctx.stroke();txt('☢',s.x,s.y-14,'#ffd23f','center',14);}
  }
  if(pl){
    fwd(pl,F);
    const g=proj(pl.x+F.x*2000,pl.y+1.9+F.y*2000,pl.z+F.z*2000);
    if(cockOn&&!pl.cls)fighterHUD(pl,g);
    else if(g.front&&view!==4&&view!==5){
      ctx.strokeStyle=hitFlash>0?'#ff5a4d':'rgba(120,255,140,.95)';ctx.lineWidth=1.6;
      ctx.beginPath();ctx.arc(g.x,g.y,22,0,TAU);
      ctx.moveTo(g.x-38,g.y);ctx.lineTo(g.x-12,g.y);ctx.moveTo(g.x+12,g.y);ctx.lineTo(g.x+38,g.y);ctx.moveTo(g.x,g.y+12);ctx.lineTo(g.x,g.y+34);ctx.stroke();
      ctx.fillStyle=ctx.strokeStyle;circle(g.x,g.y,2);
    }
    if(hitFlash>0&&g.front){ctx.strokeStyle='#ff5a4d';ctx.beginPath();for(const[a,b]of[[-1,-1],[1,-1],[-1,1],[1,1]]){ctx.moveTo(g.x+a*30,g.y+b*30);ctx.lineTo(g.x+a*40,g.y+b*40);}ctx.stroke();}
    ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(W/2,H/2);ctx.lineTo(input.mx,input.my);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.9)';ctx.beginPath();ctx.arc(input.mx,input.my,7,0,TAU);ctx.stroke();
  }
  if(pl&&(pl.gearT>.5||pl.flapT>.2)&&!pl.ground){ // landing tape: stay in the green
    const st=stallOf(pl),lo=st+6,hi=st*1.6,x=W/2-Math.min(260,W*.24),top=H/2-95,hg=190,s0=st-12,s1=hi*1.3;
    const Y=v=>top+hg-(clamp(v,s0,s1)-s0)/(s1-s0)*hg,ok=pl.spd>=lo&&pl.spd<=hi;
    ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(x-8,top,16,hg);
    ctx.fillStyle='rgba(255,90,77,.85)';ctx.fillRect(x-8,Y(lo),16,Y(s0)-Y(lo));
    ctx.fillStyle='rgba(255,210,63,.75)';ctx.fillRect(x-8,Y(s1),16,Y(hi)-Y(s1));
    ctx.fillStyle='#2fd65a';ctx.fillRect(x-8,Y(hi),16,Y(lo)-Y(hi));
    const py=Y(pl.spd);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(x-10,py);ctx.lineTo(x-24,py-8);ctx.lineTo(x-24,py+8);ctx.closePath();ctx.fill();
    txt(kt(pl.spd)+' kt',x-30,py+5,ok?'#2fd65a':'#fff','right',15,800);
    txt(ok?'SAFE LANDING SPEED':pl.spd<lo?'TOO SLOW — ADD POWER':'TOO FAST',x,top-10,ok?'#2fd65a':pl.spd<lo?'#ff5a4d':'#ffd23f','center',13,800);
    const vs=pl.vs,vc=vs<5?'#2fd65a':vs<10?'#ffd23f':'#ff5a4d',sx=W/2+Math.min(260,W*.24);
    txt('SINK '+Math.round(Math.max(0,vs)*197/50)*50+' fpm',sx,H/2-6,vc,'center',14,800);
    if(pl.y-ground(pl.x,pl.z)<45)txt(vs<5?'SMOOTH':vs<10?'HARD':'CRASH',sx,H/2+12,vc,'center',12);
  }
  if(player&&state==='play'&&(player.falling||(player.alive&&player.hp<player.hpMax*.4))){
    const gr=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.3,W/2,H/2,Math.max(W,H)*.7);
    gr.addColorStop(0,'rgba(200,0,0,0)');gr.addColorStop(1,'rgba(200,0,0,'+(.32+.12*Math.sin(time*6))+')');
    ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);
  }
  if(nukeFlash>0){ctx.fillStyle='rgba(255,250,235,'+Math.pow(nukeFlash,1.6)+')';ctx.fillRect(0,0,W,H);}
  if(state==='menu')return;
  // score bar: each base's health, with aircraft left in reserve
  const bw=Math.min(170,W*.26),cx=W/2;
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(cx-bw-34,12,bw*2+68,22);
  const tm=player?player.team:0,fb0=baseOf(tm,'F'),fb1=baseOf(1-tm,'F');
  ctx.fillStyle=TEAM[tm].col;ctx.fillRect(cx-30-bw*fb0.hp/100,16,bw*fb0.hp/100,14);
  ctx.fillStyle=TEAM[1-tm].col;ctx.fillRect(cx+30,16,bw*fb1.hp/100,14);
  txt(String(Math.ceil(fb0.hp)),cx-15,29,'#fff','center',13,800);txt(String(Math.ceil(fb1.hp)),cx+15,29,'#fff','center',13,800);
  const st=t=>['S','B'].map(k=>{const b=baseOf(t,k);return KIND[k].short+(b.hp>0?' '+Math.ceil(b.hp)+'%':' ✕');}).join('  ');
  txt(st(tm),cx-bw-40,46,TEAM[tm].col,'right',11);txt(st(1-tm),cx+bw+40,46,TEAM[1-tm].col,'left',11);
  let up=[0,0];for(const q of planes)if(q.alive)up[q.team]++;
  txt('YOUR FIGHTER BASE · '+up[tm]+' UP · '+reserve[tm]+' RESERVE',cx-bw-40,29,TEAM[tm].col,'right',12);
  txt('ENEMY FIGHTER BASE · '+up[1-tm]+' UP · '+reserve[1-tm]+' RESERVE',cx+bw+40,29,TEAM[1-tm].col,'left',12);
  if(player)txt(awacs[player.team]?'AEW DATALINK ONLINE':'E-7 NOT ON STATION — RADAR '+nm(RADAR)+' ONLY',cx,52,awacs[player.team]?'#7ddc6f':'#ff5a4d','center',12);
  notices.forEach((n,i)=>{ctx.globalAlpha=clamp(n.t,0,1);txt(n.s,cx,78+i*22,n.col,'center',17,800);ctx.globalAlpha=1;});
  // kill feed
  const ICON={gun:'✕',msl:'➤',nuke:'☢',crash:'✕'};
  feed.forEach((f,i)=>{
    const y=58+i*19;ctx.globalAlpha=clamp(f.t,0,1);
    ctx.font='600 13px '+FONT;const wv=ctx.measureText(f.v.name).width;
    txt(f.v.name,W-16,y,TEAM[f.v.team].col,'right',13);
    if(f.k){txt(ICON[f.how],W-24-wv,y,f.how==='nuke'?'#ffd23f':'#ddd','right',12);txt(f.k.name,W-42-wv,y,TEAM[f.k.team].col,'right',13);}
    else txt(f.how==='nuke'?'vaporised':'crashed',W-24-wv,y,'#ddd','right',12);
    ctx.globalAlpha=1;
  });
  const compact=cockOn&&!!player&&!player.cls&&player.alive;
  if(compact){
    const q=player,lf=3-q.gunKills%3;
    txt(TYPES[q.type].name+' · '+VIEWS[view]+' [C] · hold V to look down at the controls',14,H-10,'#ffd23f','left',12,800);
    txt((nukesHeld>0?'☢ NUKE ×'+nukesHeld+' [N]':'☢ nuke in '+lf)+' · MSL ×'+q.msl+' [F] · FLARES ×'+q.flares+' [X] · BOMBS ×'+q.bombs+' [B] · KILLS '+q.kills,W-14,H-10,'#eef3f5','right',12,800);
  }
  // minimap (north up)
  const mr=Math.min(66,H*.1),mx=mr+14,my=H-mr-12,mk=mr/(ARENA+1800);
  if(!compact){
  ctx.fillStyle='rgba(4,22,32,.72)';circle(mx,my,mr);
  ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(mx,my,(ARENA+300)*mk,0,TAU);ctx.stroke();
  const mp=(x,z)=>{let dx=-x*mk,dy=-z*mk;const d=Math.hypot(dx,dy);if(d>mr-3){dx*=(mr-3)/d;dy*=(mr-3)/d;}return[mx+dx,my+dy];};
  for(const b of BASES){const q=mp(b.x,b.z);ctx.strokeStyle=b.hp>0?TEAM[b.team].col:'#666';ctx.strokeRect(q[0]-4,q[1]-4,8,8);if(player&&b===homeBase(player)){ctx.strokeStyle='#ffd23f';ctx.strokeRect(q[0]-6,q[1]-6,12,12);}}
  for(const n of nukes){const q=mp(n.x,n.z);ctx.strokeStyle='rgba(255,210,63,.8)';ctx.beginPath();ctx.arc(q[0],q[1],Math.min(n.t*330,BLAST)*mk,0,TAU);ctx.stroke();}
  for(const b of bombs){if(!b.nuke)continue;const q=mp(b.x,b.z);ctx.strokeStyle='#ffd23f';ctx.beginPath();ctx.arc(q[0],q[1],LETHAL*mk,0,TAU);ctx.stroke();}
  for(const p of planes){
    if(!p.alive||(player&&p.team!==player.team&&!canSee(p)))continue;const q=mp(p.x,p.z);
    if(p===player){
      ctx.save();ctx.translate(q[0],q[1]);ctx.rotate(Math.atan2(-Math.cos(p.yaw),-Math.sin(p.yaw)));ctx.fillStyle='#ffd23f';
      ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-4,-4);ctx.lineTo(-4,4);ctx.closePath();ctx.fill();ctx.restore();
    }else{ctx.fillStyle=TEAM[p.team].col;if(p.cls)ctx.fillRect(q[0]-3.5,q[1]-3.5,7,7);else circle(q[0],q[1],2.6);}
  }
  }
  if(!player)return;
  const p=player;
  // instruments
  if(!compact){
  const lx=mx+mr+14,by=H-14,st=stallOf(p),okL=!p.ground&&p.gearT>.5&&p.spd>=st+6&&p.spd<=st*1.6;
  txt(TYPES[p.type].name+'   '+VIEWS[view]+' [C]',lx,by-80,'#ffd23f','left',14,800);
  txt('SPD '+kt(p.spd)+' kt',lx,by-60,okL?'#2fd65a':'#eef3f5','left',15,okL?800:600);
  txt('ALT '+ft(p.y)+' ft',lx,by-40,'#eef3f5','left',15);
  txt('THR '+Math.round(p.thr*100)+'%',lx,by-20,'#eef3f5','left',15);
  txt('GEAR '+(p.gearT>=1?'DOWN':p.gearT<=0?'UP':'…')+' [G]   FLAPS '+(p.flap>=1?'FULL':p.flap>0?'T/O':'UP')+' [Q/E]',lx,by,p.gearT>0||p.flap>0?'#7ddc6f':'#9fb3bd','left',14);
  const px=W-16,left=3-p.gunKills%3;
  txt(nukesHeld>0?'☢ NUKE READY ×'+nukesHeld+'  [N]':'☢ nuke in '+left+' kill'+(left===1?'':'s'),px,by-84,nukesHeld>0?'#ffd23f':'#9fb3bd','right',15,nukesHeld>0?800:600);
  if(p.cls){
    txt('FLARES ×'+p.flares+' [X]   CHAFF ×'+p.chaff+' [Z]',px,by-64,'#eef3f5','right',15);
    txt(p.bombs>0?'BOMBS ×'+p.bombs+' [B]':TYPES[p.type].bombs?'BOMBS EMPTY — LAND TO REARM':'NO BOMBS ON THIS TYPE',px,by-44,p.bombs>0?'#eef3f5':'#ffd23f','right',15);
  }else{
    txt('MISSILES ×'+p.msl+' [F]   FLARES ×'+p.flares+' [X]   CHAFF ×'+p.chaff+' [Z]',px,by-64,p.msl>0?'#eef3f5':'#9fb3bd','right',15);
    txt((p.ammo>0?'CANNON '+p.ammo:'CANNON EMPTY — LAND')+'   BOMBS ×'+p.bombs+' [B]',px,by-44,p.ammo>0?'#eef3f5':'#ffd23f','right',15);
  }
  txt('KILLS '+p.kills+'   DEATHS '+deaths,px,by-24,'#eef3f5','right',14);
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(px-190,by-14,190,12);
  const hf=clamp(p.hp/p.hpMax,0,1);
  ctx.fillStyle=hf>.55?'#7ddc6f':hf>.28?'#ffd23f':'#ff5a4d';ctx.fillRect(px-190,by-14,190*hf,12);
  }
  if(state!=='play')return;
  let my2=H*.3;
  if(rtb)txt('MISSION COMPLETE — LAND AT '+homeBase(p).name.toUpperCase(),W/2,H*.2,'#7ddc6f','center',24,800);
  if(!p.alive){
    txt(p.falling?'YOU ARE GOING DOWN':'Shot down',W/2,H*.38,'#ff5a4d','center',28,800);
    if(!p.falling)txt(p.respawn>0?'Next aircraft in '+Math.max(1,Math.ceil(p.respawn)):'Choose your next aircraft'+' · '+reserve[p.team]+' left in reserve',W/2,H*.38+26,'#eef3f5','center',15);
    return;
  }
  if(twr.s&&!armOpen)txt(twr.s,W/2,H*.145+(rtb?H*.09:0),twr.col,'center',16,800);
  if(p.ground){
    if(!armOpen&&!rtb&&p.pad>=0&&rwAxis(BASES[p.pad],p.x,p.z)){
      const vr=kt(stallOf(p)+10);
      txt(p.spd<2?(p.flap>0?'':'SET TAKE-OFF FLAPS — E'):p.spd>stallOf(p)+10?'ROTATE — PULL UP':p.thr>.05?'ROLLING — ROTATE AT '+vr+' kt':'BRAKING',W/2,H*.62,'#ffd23f','center',20,800);
    }
  }else{
    if(p.gear&&p.spd>130)txt('GEAR DOWN — G TO RETRACT',W/2,H*.62,'#ffd23f','center',18,800);
    else if(!p.gear&&p.y<500&&padAt(p.x,p.z)>=0&&p.pitch<.05)txt('GEAR UP — G TO LOWER',W/2,H*.62,'#ff5a4d','center',20,800);
    else if(p.flap>0&&!p.gear&&p.spd>150)txt('FLAPS STILL DOWN — Q TO RAISE',W/2,H*.62,'#ffd23f','center',16,800);
    if(p.flareT>0||p.chaffT>0)txt(p.chaffT>0?'CHAFF OUT':'FLARES OUT',W/2,my2,'#7ddc6f','center',22,800);
    else if(inbound(p)&&Math.sin(time*18)>-.3)txt('MISSILE INBOUND — '+(inbound(p).kind==='ir'?'IR — X FOR FLARES':'RADAR — Z FOR CHAFF'),W/2,my2,'#ff3b30','center',26,800);
    my2+=32;
    if(Math.hypot(p.x,p.z)>ARENA+300&&!BASES.some(b=>b.team===p.team&&Math.hypot(p.x-b.x,p.z-b.z)<6500)){txt('RETURN TO THE BATTLE AREA',W/2,my2,'#ffd23f','center',22,800);my2+=30;}
    if(!p.gear&&padAt(p.x,p.z)<0&&p.y-ground(p.x,p.z)<150&&p.pitch<.05){txt('PULL UP',W/2,my2,'#ff5a4d','center',26,800);my2+=30;}
    for(const b of bombs){
      if(!b.nuke)continue;
      const d=Math.hypot(p.x-b.x,p.z-b.z),safe=d>LETHAL;
      txt('☢ NUKE FALLING — '+nm(d)+' away — '+(safe?'CLEAR':'GET OUT, 0.5 nm LETHAL'),W/2,my2,safe?'#7ddc6f':'#ff5a4d','center',20,800);my2+=28;
    }
    if(killMsg>0){ctx.globalAlpha=clamp(killMsg,0,1);txt('ENEMY DOWN',W/2,H*.24,'#ffd23f','center',28,800);ctx.globalAlpha=1;}
  }
}

