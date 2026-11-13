'use strict';
/* ---------- particles (soft points) ---------- */
let parts=[],fx=[];
const MAXP=3200;
const pGeo=new THREE.BufferGeometry();
const pPos=new Float32Array(MAXP*3),pCol=new Float32Array(MAXP*4),pSize=new Float32Array(MAXP);
pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
pGeo.setAttribute('pcol',new THREE.BufferAttribute(pCol,4));
pGeo.setAttribute('psize',new THREE.BufferAttribute(pSize,1));
const pMat=new THREE.ShaderMaterial({
  uniforms:{sc:{value:500}},transparent:true,depthWrite:false,
  vertexShader:'attribute float psize;attribute vec4 pcol;varying vec4 vc;uniform float sc;void main(){vc=pcol;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=psize*sc/max(1.0,-mv.z);gl_Position=projectionMatrix*mv;}',
  fragmentShader:'varying vec4 vc;void main(){float d=length(gl_PointCoord-vec2(0.5));if(d>0.5)discard;gl_FragColor=vec4(vc.rgb,vc.a*(1.0-smoothstep(0.15,0.5,d)));}'
});
const pPoints=new THREE.Points(pGeo,pMat);pPoints.frustumCulled=false;scene.add(pPoints);
function part(x,y,z,vx,vy,vz,life,size,type){ // 0 light smoke, 1 dark smoke, 2 fire, 3 dust, 4 sparks, 5 spray, 6 tyre smoke, 7 flare
  if(parts.length>=MAXP)parts.shift();
  parts.push({x,y,z,vx,vy,vz,life,max:life,size,type});
}
function syncParts(){
  const n=parts.length;
  for(let i=0;i<n;i++){
    const p=parts[i],k=p.life/p.max;
    pPos[i*3]=p.x;pPos[i*3+1]=p.y;pPos[i*3+2]=p.z;
    if(p.type===2){pCol[i*4]=1;pCol[i*4+1]=.35+.6*k;pCol[i*4+2]=.15*k;pCol[i*4+3]=k;pSize[i]=p.size*(.5+k*.5);}
    else if(p.type===3){pCol[i*4]=.62;pCol[i*4+1]=.53;pCol[i*4+2]=.38;pCol[i*4+3]=k*.42;pSize[i]=p.size*(1+(1-k)*2.5);}
    else if(p.type===4){pCol[i*4]=1;pCol[i*4+1]=.85;pCol[i*4+2]=.45;pCol[i*4+3]=k;pSize[i]=p.size;}
    else if(p.type===5){pCol[i*4]=.88;pCol[i*4+1]=.94;pCol[i*4+2]=1;pCol[i*4+3]=k*.6;pSize[i]=p.size*(1+(1-k)*1.5);}
    else if(p.type===6){pCol[i*4]=.82;pCol[i*4+1]=.82;pCol[i*4+2]=.8;pCol[i*4+3]=k*.55;pSize[i]=p.size*(1+(1-k)*3);}
    else if(p.type===7){pCol[i*4]=1;pCol[i*4+1]=.95;pCol[i*4+2]=.8;pCol[i*4+3]=k;pSize[i]=p.size*(.6+k*.4);}
    else{const c=p.type?.14:.9;pCol[i*4]=c;pCol[i*4+1]=c;pCol[i*4+2]=c;pCol[i*4+3]=k*(p.type?.6:.45);pSize[i]=p.size*(1+(1-k)*2);}
  }
  pGeo.setDrawRange(0,n);
  pGeo.attributes.position.needsUpdate=true;pGeo.attributes.pcol.needsUpdate=true;pGeo.attributes.psize.needsUpdate=true;
}
function boom(x,y,z,size){ // 0 small, 1 big, 2 huge
  const n=[9,22,40][size],sp=[1,1,2.2][size];
  for(let i=0;i<n;i++)part(x,y,z,rnd(-40,40)*sp,rnd(-25,45)*sp,rnd(-40,40)*sp,rnd(.4,1.1),rnd(10,[14,26,50][size]),2);
  for(let i=0;i<n*.7;i++)part(x,y,z,rnd(-22,22)*sp,rnd(-5,30)*sp,rnd(-22,22)*sp,rnd(1.2,2.8),rnd(14,[20,30,60][size]),1);
  const m=new THREE.Mesh(SPH,new THREE.MeshBasicMaterial({color:0xffc35a,transparent:true,fog:false}));
  m.position.set(x,y,z);scene.add(m);fx.push({m,t:0,dur:[.4,.7,1][size],s0:4,s1:[26,55,120][size]});
  snd.boom(vol(x,y,z)*[.5,1,1.2][size]);
}
const MAXB=600;
const bGeo=new THREE.BufferGeometry(),bPos=new Float32Array(MAXB*6);
bGeo.setAttribute('position',new THREE.BufferAttribute(bPos,3));
const bLines=new THREE.LineSegments(bGeo,new THREE.LineBasicMaterial({color:0xffe98a,fog:false}));
bLines.frustumCulled=false;scene.add(bLines);

