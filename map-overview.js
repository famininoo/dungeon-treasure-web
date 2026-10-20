"use strict";
(function(){
 const overlay=document.getElementById("mapOverlay");
 const canvas=document.getElementById("mapOverviewCanvas");
 const ctx=canvas.getContext("2d");
 const closeButton=document.getElementById("mapClose");
 let state=null,zoom=1,panX=0,panY=0,frame=0,previousFocus=null;
 const fingers=new Map();
 let gesture=null;
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 const known=(x,y)=>!state.fog||state.seen.has(x+","+y);
 const within=(x,y)=>Math.abs(state.player.x-x)+Math.abs(state.player.y-y)<=4;
 const cellColor={"#":"#5a7180",".":"#203d4f","B":"#976a4d","D":"#9c724e","E":"#247e69"};
 function dimensions(){
  const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,3);
  const width=Math.max(100,Math.round(r.width*dpr)),height=Math.max(100,Math.round(r.height*dpr));
  if(canvas.width!==width)canvas.width=width;
  if(canvas.height!==height)canvas.height=height;
  return {w:r.width,h:r.height,dpr};
 }
 function metrics(w,h){
  const base=Math.min((w-26)/state.width,(h-26)/state.height);
  const tile=base*zoom;
  return {tile,cx:w/2+panX,cy:h/2+panY};
 }
 function paint(){
  if(!state||overlay.hidden)return;
  const {w,h,dpr}=dimensions();
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle="#081723";ctx.fillRect(0,0,w,h);
  const {tile,cx,cy}=metrics(w,h);
  const originX=cx-state.width*tile/2,originY=cy-state.height*tile/2;
  const visibleEnemies=new Set(state.enemies.filter(e=>e.alive&&within(e.x,e.y)).map(e=>e.x+","+e.y));
  const visibleBombs=new Set(state.bombs.filter(b=>within(b.x,b.y)).map(b=>b.x+","+b.y));
  for(let y=0;y<state.height;y++)for(let x=0;x<state.width;x++){
   const left=originX+x*tile,top=originY+y*tile;
   if(left+tile<0||top+tile<0||left>w||top>h)continue;
   const explored=known(x,y),k=x+","+y;
   ctx.fillStyle=explored?(cellColor[state.grid[y][x]]||"#203d4f"):"#091d2c";
   ctx.fillRect(left,top,Math.ceil(tile)+.3,Math.ceil(tile)+.3);
   if(tile>=10){ctx.strokeStyle=explored?"#19303d":"#102534";ctx.lineWidth=.65;ctx.strokeRect(left+.4,top+.4,tile-.8,tile-.8)}
   if(!explored)continue;
   const middleX=left+tile/2,middleY=top+tile/2;
   if(state.jewels.has(k)){
    ctx.fillStyle="#f5d17c";ctx.beginPath();ctx.moveTo(middleX,middleY-tile*.34);ctx.lineTo(middleX+tile*.29,middleY);ctx.lineTo(middleX,middleY+tile*.34);ctx.lineTo(middleX-tile*.29,middleY);ctx.fill();
   }else if(state.keysOnGround.has(k)){
    ctx.strokeStyle="#ffe0a5";ctx.lineWidth=Math.max(1.5,tile*.12);ctx.beginPath();ctx.arc(middleX-tile*.12,middleY-tile*.08,tile*.17,0,Math.PI*2);ctx.moveTo(middleX,middleY+tile*.04);ctx.lineTo(middleX+tile*.3,middleY+tile*.29);ctx.stroke();
   }
   if(visibleEnemies.has(k)){ctx.fillStyle="#ff808e";ctx.beginPath();ctx.arc(middleX,middleY,tile*.31,0,2*Math.PI);ctx.fill()}
   if(visibleBombs.has(k)){ctx.fillStyle="#e2e4ed";ctx.beginPath();ctx.arc(middleX,middleY,tile*.26,0,2*Math.PI);ctx.fill()}
  }
  const px=originX+(state.player.x+.5)*tile,py=originY+(state.player.y+.5)*tile;
  ctx.fillStyle="#98ffe0";ctx.strokeStyle="#06232c";ctx.lineWidth=Math.max(1,tile*.13);
  ctx.beginPath();ctx.arc(px,py,Math.max(3,tile*.36),0,2*Math.PI);ctx.fill();ctx.stroke();
  frame=requestAnimationFrame(paint);
 }
 function moveBounds(){
  if(!state)return;
  const r=canvas.getBoundingClientRect(),base=Math.min((r.width-26)/state.width,(r.height-26)/state.height);
  panX=clamp(panX,-Math.max(0,state.width*base*zoom-r.width)/2-18,Math.max(0,state.width*base*zoom-r.width)/2+18);
  panY=clamp(panY,-Math.max(0,state.height*base*zoom-r.height)/2-18,Math.max(0,state.height*base*zoom-r.height)/2+18);
 }
 function setZoom(value){
  zoom=clamp(value,1,5);moveBounds();paintOnce();
 }
 function paintOnce(){
  if(!frame&&!overlay.hidden)frame=requestAnimationFrame(paint);
 }
 function open(newState){
  if(!newState||!overlay.hidden)return;
  state=newState;zoom=1;panX=0;panY=0;gesture=null;fingers.clear();
  previousFocus=document.activeElement;overlay.hidden=false;
  document.body.classList.add("map-overview-open");
  closeButton.focus();
  frame=requestAnimationFrame(paint);
 }
 function close(){
  if(overlay.hidden)return;
  overlay.hidden=true;state=null;fingers.clear();gesture=null;
  document.body.classList.remove("map-overview-open");
  if(frame)cancelAnimationFrame(frame);frame=0;
  if(previousFocus&&typeof previousFocus.focus==="function")previousFocus.focus();
 }
 closeButton.addEventListener("click",close);
 overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
 document.getElementById("mapZoomIn").addEventListener("click",()=>setZoom(zoom*1.4));
 document.getElementById("mapZoomOut").addEventListener("click",()=>setZoom(zoom/1.4));
 document.getElementById("mapReset").addEventListener("click",()=>{zoom=1;panX=0;panY=0;});
 canvas.addEventListener("wheel",e=>{
  e.preventDefault();setZoom(zoom*(e.deltaY<0?1.2:1/1.2));
 },{passive:false});
 function point(e){return {x:e.clientX,y:e.clientY}}
 function separation(){
  const [a,b]=[...fingers.values()];return Math.hypot(a.x-b.x,a.y-b.y);
 }
 function center(){
  const vals=[...fingers.values()];return {x:vals.reduce((n,p)=>n+p.x,0)/vals.length,y:vals.reduce((n,p)=>n+p.y,0)/vals.length};
 }
 canvas.addEventListener("pointerdown",e=>{
  e.preventDefault();canvas.setPointerCapture(e.pointerId);
  fingers.set(e.pointerId,point(e));
  if(fingers.size===1)gesture={kind:"drag",last:point(e)};
  else if(fingers.size===2)gesture={kind:"pinch",distance:separation(),center:center(),zoom};
 });
 canvas.addEventListener("pointermove",e=>{
  if(!fingers.has(e.pointerId))return;
  const old=fingers.get(e.pointerId);fingers.set(e.pointerId,point(e));
  if(fingers.size===1&&gesture?.kind==="drag"){
   panX+=e.clientX-old.x;panY+=e.clientY-old.y;
  }else if(fingers.size===2&&gesture?.kind==="pinch"){
   const c=center(),diff=separation();
   panX+=c.x-gesture.center.x;panY+=c.y-gesture.center.y;
   zoom=clamp(gesture.zoom*(diff/Math.max(10,gesture.distance)),1,5);
   gesture.center=c;gesture.distance=diff;gesture.zoom=zoom;
  }
  moveBounds();
 });
 function release(e){
  fingers.delete(e.pointerId);
  if(fingers.size===1)gesture={kind:"drag",last:[...fingers.values()][0]};
  else gesture=null;
 }
 canvas.addEventListener("pointerup",release);
 canvas.addEventListener("pointercancel",release);
 window.addEventListener("resize",()=>{if(!overlay.hidden)moveBounds()});
 window.TreasureMap={open,close,isOpen:()=>!overlay.hidden};
})();
