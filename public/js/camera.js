'use strict';
/* ---------- cameras ---------- */
const camSm={x:0,y:0,z:0,set:false};let chaseZoom=1;
function setFov(f){
  if(camera.fov===f)return;
  camera.fov=f;camera.updateProjectionMatrix();cockCam.fov=f;cockCam.updateProjectionMatrix();
  pMat.uniforms.sc.value=H*DPR/2/Math.tan(f*Math.PI/360);
}
function placeCamera(){
  let f=player;
  if(!f){f=planes[0];for(const q of planes)if(q.alive&&!q.ground){f=q;break;}}
  const live=state==='play'&&!!player&&(player.alive||player.falling);
  const v=live?view:1;
  const jx=shake?rnd(-1,1)*shake*.035:0,jy=shake?rnd(-1,1)*shake*.035:0;
  fwd(f,F);cockOn=false;
  if(v===0){
    setFov(78);camera.position.set(f.x,f.y+1.9,f.z);camera.rotation.set(f.pitch+jx,f.yaw+Math.PI+jy,-f.roll);camera.rotateX(headPitch);cockCam.rotation.x=headPitch;cockOn=true;
  }else if(v===1||v===2){
    setFov(72);const big=TYPES[f.type]&&TYPES[f.type].len>30,back=(v===2?190:f.cls?125:72)*(big?1.5:1)*chaseZoom,up=(v===2?55:f.cls?30:18)*(big?1.4:1)*chaseZoom;
    const cx=f.x-F.x*back,cz=f.z-F.z*back,ty=Math.max(ground(cx,cz)+5,f.y-F.y*back+up);
    // spring the camera after the aircraft so turns feel smooth
    const k=1-Math.exp(-lastDt*(v===2?3:6));
    if(!camSm.set||Math.hypot(camSm.x-cx,camSm.z-cz)>400){camSm.x=cx;camSm.y=ty;camSm.z=cz;camSm.set=true;}
    camSm.x+=(cx-camSm.x)*k;camSm.y+=(ty-camSm.y)*k;camSm.z+=(cz-camSm.z)*k;
    camera.position.set(camSm.x,Math.max(ground(camSm.x,camSm.z)+4,camSm.y),camSm.z);
    camera.lookAt(f.x+F.x*60+jx*40,f.y+F.y*60+up*.45+jy*40,f.z+F.z*60);camera.rotateZ(-f.roll*.35);
  }else if(v===3){
    setFov(34);
    if(!fly.set||Math.hypot(fly.x-f.x,fly.y-f.y,fly.z-f.z)>1500){
      fly.x=f.x+F.x*800-Math.cos(f.yaw)*110;fly.z=f.z+F.z*800+Math.sin(f.yaw)*110;fly.y=Math.max(ground(fly.x,fly.z)+12,f.y+F.y*800-50);fly.set=true;
    }
    camera.position.set(fly.x,fly.y,fly.z);camera.lookAt(f.x,f.y,f.z);
  }else if(v===4){
    setFov(60);camera.position.set(f.x,f.y-5,f.z);camera.rotation.set(-Math.PI/2+.001,f.yaw+Math.PI,0);
  }else if(v===5){
    setFov(70);const up=f.cls?16:7;camera.position.set(f.x+F.x*(f.cls?24:8),f.y+up+F.y*8,f.z+F.z*(f.cls?24:8));camera.rotation.set(-f.pitch-.22,f.yaw,f.roll);
  }else if(v===7){
    setFov(60);const R=orbit.dist*(TYPES[f.type]&&TYPES[f.type].len>30?2.2:1);
    const cx=f.x+Math.sin(f.yaw+orbit.yaw)*Math.cos(orbit.pitch)*R,cz=f.z+Math.cos(f.yaw+orbit.yaw)*Math.cos(orbit.pitch)*R;
    camera.position.set(cx,Math.max(ground(cx,cz)+3,f.y+Math.sin(orbit.pitch)*R),cz);camera.lookAt(f.x,f.y,f.z);
  }else{
    setFov(16);const tb=player?(player.ground&&player.pad>=0?BASES[player.pad]:homeBase(player)):BASES[0];
    camera.position.set(tb.x+tb.s*400,104,tb.z);camera.lookAt(f.x,f.y,f.z);
  }
  camera.updateMatrixWorld();camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
}

