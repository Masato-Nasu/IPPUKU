'use strict';
// 2D incompressible Eulerian smoke: semi-Lagrangian advection,
// pressure projection, buoyancy, density diffusion and vorticity confinement.
const N=128,S=N*N,canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d',{alpha:true});canvas.width=canvas.height=N;
let u=new Float32Array(S),v=new Float32Array(S),du=new Float32Array(S),dv=new Float32Array(S),d=new Float32Array(S),dd=new Float32Array(S),p=new Float32Array(S),div=new Float32Array(S),curl=new Float32Array(S);
let active=false,start=0,lastMove=0,x0=0,exhale=0,emission=0,heat=0,clock=0,moved=false;const mouth={x:.397,y:.382},ember=document.querySelector('#ember'),knob=document.querySelector('.knob'),hint=document.querySelector('#hint'),button=document.querySelector('#draw');
let breathDelay=0;const scene=document.querySelector("#scene");
const frame=ctx.createImageData(N,N);const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function sample(a,x,y){x=clamp(x,1,N-2);y=clamp(y,1,N-2);const ix=x|0,iy=y|0,fx=x-ix,fy=y-iy,k=ix+iy*N;return (a[k]*(1-fx)+a[k+1]*fx)*(1-fy)+(a[k+N]*(1-fx)+a[k+N+1]*fx)*fy;}
function advect(out,a,dt){for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){let k=x+y*N;out[k]=sample(a,x-dt*u[k],y-dt*v[k]);}}
function project(){p.fill(0);for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){let k=x+y*N;div[k]=-.5*(u[k+1]-u[k-1]+v[k+N]-v[k-N]);}for(let t=0;t<6;t++)for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){let k=x+y*N;p[k]=(div[k]+p[k-1]+p[k+1]+p[k-N]+p[k+N])*.25;}for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){let k=x+y*N;u[k]-=.5*(p[k+1]-p[k-1]);v[k]-=.5*(p[k+N]-p[k-N]);}}
const phase=Math.random()*Math.PI*2;
function inject(dt){
 if(exhale<=0||active)return;
 if(breathDelay>0){breathDelay-=dt;return;}
 exhale=Math.max(0,exhale-dt);
 const elapsed=emission-exhale;
 // Soft onset, irregular breath pressure, and a long taper instead of a constant jet.
 const envelope=Math.min(1,elapsed/.48)*Math.min(1,exhale/1.15);
 const pulse=.83+.12*Math.sin(clock*2.3+phase)+.05*Math.sin(clock*5.1);
 const angle=-.15+.25*Math.sin(clock*1.7+phase)+.12*Math.sin(clock*3.7);
 const cx=mouth.x*N,cy=mouth.y*N+.35*Math.sin(clock*2.1);
 for(let y=(cy-6)|0;y<cy+7;y++)for(let x=(cx-1)|0;x<cx+9;x++){
  const k=x+y*N,r=((x-cx)/4.4)**2+((y-cy)/2.25)**2,w=Math.exp(-r*1.5)*envelope*pulse;
  d[k]+=dt*16*w;u[k]+=dt*440*w*Math.cos(angle);v[k]+=dt*440*w*Math.sin(angle);
 }
}
// A slowly evolving divergence-free ambient current bends the plume after it leaves the lips.
const sx=new Float32Array(N),cxw=new Float32Array(N),sy=new Float32Array(N),cyw=new Float32Array(N);
function ambient(dt){
 for(let i=0;i<N;i++){sx[i]=Math.sin(i*.105+clock*.41+phase);cxw[i]=Math.cos(i*.105+clock*.41+phase);sy[i]=Math.sin(i*.087-clock*.32);cyw[i]=Math.cos(i*.087-clock*.32);}
 for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){
  const k=x+y*N,reach=clamp((x-mouth.x*N-3)/16,0,1),force=dt*4.5*reach;
  u[k]+=force*sx[x]*cyw[y];v[k]-=force*1.2*cxw[x]*sy[y];
 }
}
function step(dt){clock+=dt;inject(dt);ambient(dt);for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){let k=x+y*N;v[k]-=dt*d[k]*11;curl[k]=.5*(v[k+1]-v[k-1]-u[k+N]+u[k-N]);}for(let y=2;y<N-2;y++)for(let x=2;x<N-2;x++){let k=x+y*N,gx=Math.abs(curl[k+1])-Math.abs(curl[k-1]),gy=Math.abs(curl[k+N])-Math.abs(curl[k-N]),len=Math.hypot(gx,gy)+.0001;u[k]+=dt*8*gy/len*curl[k];v[k]-=dt*8*gx/len*curl[k];}project();advect(du,u,dt);advect(dv,v,dt);[u,du]=[du,u];[v,dv]=[dv,v];project();advect(dd,d,dt);[d,dd]=[dd,d];for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){let k=x+y*N;dd[k]=(d[k]+dt*.23*(d[k-1]+d[k+1]+d[k-N]+d[k+N]-4*d[k]))*Math.exp(-dt*.12);u[k]*=Math.exp(-dt*.3);v[k]*=Math.exp(-dt*.3);}[d,dd]=[dd,d];}
function begin(e){if(completed||e.button>0)return;active=true;exhale=0;scene.classList.add('inhaling');start=lastMove=performance.now();x0=e.clientX||0;moved=e.type==='keydown';if(e.pointerId!==undefined)button.setPointerCapture(e.pointerId);hint.textContent='ゆっくり、引く。';}
function move(e){if(!active)return;lastMove=performance.now();moved=true;knob.style.transform=`translateX(${170*(1-Math.exp(-Math.abs(e.clientX-x0)/100))}px)`;}
function end(){if(!active)return;active=false;scene.classList.remove('inhaling');breathDelay=1.05;const duration=clamp((performance.now()-start)/1000,.3,12);if(moved){emission=Math.max(.9,duration);exhale=emission;hint.textContent='煙の行方を、眺める。';}else hint.textContent='押したまま、ゆっくり引いてください。';knob.style.transform='';}
button.addEventListener('pointerdown',begin);button.addEventListener('pointermove',move);button.addEventListener('pointerup',end);button.addEventListener('pointercancel',()=>{active=false;scene.classList.remove('inhaling');knob.style.transform='';});button.addEventListener('keydown',e=>{if((e.code==='Space'||e.code==='Enter')&&!e.repeat){e.preventDefault();begin(e);}});button.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();end();}});
document.querySelector('#reset').onclick=()=>{for(const a of [u,v,d,dd,du,dv])a.fill(0);active=false;scene.classList.remove('inhaling');knob.style.transform='';exhale=0;pleasure=0;burned=0;updateCigarettes();completed=false;document.body.classList.remove('completed');button.disabled=false;button.querySelector('.label').textContent='引く';document.querySelector('#reset').textContent='リセット';hint.textContent='ゆっくり引いて、指を離す。';};window.addEventListener('blur',()=>{active=false;scene.classList.remove('inhaling');knob.style.transform='';});
let burned=0;
const cigarettes=[{pose:document.querySelector("#rest-pose"),fire:ember,x:51.8,y:42.2,dx:-4.1,dy:2.35},{pose:document.querySelector("#inhale-pose"),fire:document.querySelector("#ember-inhale"),x:51.5,y:37.5,dx:-4.4,dy:.32}];
function updateCigarettes(){
 for(const c of cigarettes){
 const x=c.x+c.dx*burned,y=c.y+c.dy*burned,len=Math.hypot(c.dx,c.dy),nx=-c.dy/len*.85,ny=c.dx/len*.85;
 const fx=c.x-c.dx/len*1.1,fy=c.y-c.dy/len*1.1;
 c.pose.querySelector(".burn-mask").style.clipPath=burned<=0?"polygon(0 0,0 0,0 0)":`polygon(${x+nx}% ${y+ny}%,${fx+nx}% ${fy+ny}%,${fx-nx}% ${fy-ny}%,${x-nx}% ${y-ny}%)`;
 c.fire.style.left=x+"%";c.fire.style.top=y+"%";
 }
}
let pleasure=0,completed=false;let prev=0;
function completeRitual(){
 if(completed)return;completed=true;active=false;scene.classList.remove('inhaling');
 exhale=Math.min(exhale,.85);document.body.classList.add('completed');
 hint.textContent='よい一服でした。';button.disabled=true;button.querySelector('.label').textContent='余韻';
 document.querySelector('#reset').textContent='もう一度';
}
function animate(t){const dt=Math.min((t-prev)/1000||.016,.066);prev=t;if(!document.hidden){step(dt);if(active&&moved)burned=Math.min(1,burned+dt/18);updateCigarettes();if(exhale>0&&!active&&breathDelay<=0)pleasure=Math.min(100,pleasure+dt*8.4);document.querySelector('#pleasure').style.width=pleasure+'%';document.querySelector('#level').textContent=Math.floor(pleasure);if(pleasure>=100)completeRitual();for(let k=0;k<S;k++){const alpha=1-Math.exp(-Math.max(0,d[k])*1.6),i=k*4;frame.data[i]=218;frame.data[i+1]=224;frame.data[i+2]=235;frame.data[i+3]=clamp(alpha*235,0,235);}ctx.putImageData(frame,0,0);heat+=(Number(active)-heat)*(1-Math.exp(-dt*(active?2.4:1.7)));
 const shimmer=1+.045*Math.sin(clock*9.3)+.025*Math.sin(clock*14.7);
 const breath=Math.sin(clock*.83)+.35*Math.sin(clock*1.31+phase);
 scene.style.transform=`translate3d(${.45*Math.sin(clock*.47)}px,${.8*breath}px,0) rotate(${.075*Math.sin(clock*.61)}deg)`;
 const glow=heat*shimmer;
for(const fire of [ember,document.querySelector('#ember-inhale')]){fire.style.background=`rgb(${130+glow*120},${40+glow*115},${15+glow*50})`;fire.style.boxShadow=`0 0 ${5+glow*13}px ${2+glow*4}px rgba(255,75,20,${.08+heat*.6})`;}if(!completed&&exhale<=0&&!active&&clock>2)hint.textContent='ゆっくり引いて、指を離す。';}requestAnimationFrame(animate);}requestAnimationFrame(animate);
window.smokeDebug=()=>({density:d.reduce((a,b)=>a+b,0),active,exhale,finite:d.every(Number.isFinite)});
