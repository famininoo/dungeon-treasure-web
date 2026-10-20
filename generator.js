(function(){
"use strict";
(function(){const module={exports:{}};
"use strict";
const Core=window.DungeonCore;
const profiles=[
 ["路线规划",.06,[4,9],0,0,0,false,1.4],
 ["环路选择",.25,[6,13],0,0,0,false,1.28],
 ["钥匙经济",.11,[6,12],0,2,0,false,1.30],
 ["多门资源",.08,[7,14],0,3,0,false,1.35],
 ["炸墙捷径",.09,[5,12],0,1,3,false,1.25],
 ["障碍密集",.10,[7,15],0,1,7,false,1.28],
 ["守卫潜行",.14,[5,10],2,0,0,false,1.35],
 ["多守卫迷宫",.11,[8,15],4,1,2,false,1.38],
 ["浓雾探索",.13,[6,12],1,1,1,true,1.45],
 ["低生命挑战",.17,[5,11],2,0,0,true,1.40],
 ["宝石密集",.21,[12,24],1,0,1,false,1.35],
 ["综合限时",.12,[9,19],3,2,3,true,1.20]
];
const dims=[[11,17],[13,19],[15,23],[17,27],[19,29],[21,31]];
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=Math.imul(s^(s>>>15),1|s);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296}}
const key=p=>p[0]+","+p[1],dirs=[[0,-1],[1,0],[0,1],[-1,0]],moves=["up","right","down","left"];
function generate(seed,type,size=null){
 const R=rng(seed),n=(max)=>Math.floor(R()*max),p=profiles[type%profiles.length],[name,loops,gRange,guards,doors,bWalls,fog,slack]=p;
 const [h,w]=size||dims[n(dims.length)];
 const map=Array.from({length:h},()=>Array(w).fill("#")),gridCells=[[1,1]],seen=new Set(["1,1"]);map[1][1]=".";
 let stack=[[1,1]];
 while(stack.length){
  const [x,y]=stack[stack.length-1],options=[];
  for(const [dx,dy] of [[0,-2],[2,0],[0,2],[-2,0]]){const X=x+dx,Y=y+dy;
   if(X>0&&Y>0&&X<w-1&&Y<h-1&&!seen.has(X+","+Y))options.push([X,Y,dx,dy])}
  if(options.length){const [X,Y,dx,dy]=options[n(options.length)];
   map[y+dy/2][x+dx/2]=".";map[Y][X]=".";seen.add(X+","+Y);gridCells.push([X,Y]);stack.push([X,Y])}
  else stack.pop();
 }
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(map[y][x]==="#"&&R()<loops){
  if((map[y][x-1]!=="#"&&map[y][x+1]!=="#")||(map[y-1][x]!=="#"&&map[y+1][x]!=="#"))map[y][x]=".";
 }
 const floor=[];
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(map[y][x]===".")floor.push([x,y]);
 function bfs(from,to,exitBlock=null){
  const queue=[from],used=new Set([key(from)]),prev=new Map(),target=key(to);
  for(let i=0;i<queue.length;i++){
   const current=queue[i],curKey=key(current);
   if(curKey===target){
    const result=[current];let k=curKey;
    while(prev.has(k)){const last=prev.get(k);result.push(last);k=key(last)}
    return result.reverse();
   }
   for(const [dx,dy] of dirs){const X=current[0]+dx,Y=current[1]+dy,p2=[X,Y],k=key(p2);
    if(X>0&&Y>0&&X<w-1&&Y<h-1&&map[Y][X]!=="#"&&!used.has(k)&&
       (exitBlock===null||k!==key(exitBlock)||k===target)){used.add(k);prev.set(k,current);queue.push(p2)}
   }
  }
  return null;
 }
 const spawn=gridCells[n(gridCells.length)];
 let exit=null,distance=0;
 for(const c of gridCells){const p2=bfs(spawn,c);if(p2&&p2.length>distance){exit=c;distance=p2.length}}
 const available=floor.filter(pt=>key(pt)!==key(spawn)&&key(pt)!==key(exit));
 const gemCount=Math.min(available.length-5,gRange[0]+n(gRange[1]-gRange[0]+1)),gems=[];
 while(gems.length<gemCount)gems.push(available.splice(n(available.length),1)[0]);
 const targets=gems.slice(),tour=[spawn];let here=spawn;
 while(targets.length){
  let bi=-1,best=null;
  for(let i=0;i<targets.length;i++){const path=bfs(here,targets[i],exit);
   if(path&&(!best||path.length<best.length)){bi=i;best=path}}
  if(!best)throw Error("Unreachable jewel");
  tour.push(...best.slice(1));here=targets.splice(bi,1)[0];
 }
 const last=bfs(here,exit,exit);if(!last)throw Error("Unreachable exit");tour.push(...last.slice(1));
 const actions=[];for(let i=1;i<tour.length;i++){
  const dx=tour[i][0]-tour[i-1][0],dy=tour[i][1]-tour[i-1][1];
  const a=dirs.findIndex(d=>d[0]===dx&&d[1]===dy);if(a<0)throw Error("Non-adjacent path");actions.push(moves[a]);
 }
 const witness=new Set(tour.map(key)),gemKeys=new Set(gems.map(key)),firstSeen=new Set(),sites=[];
 for(let i=0;i<tour.length;i++){
  const pt=tour[i],k=key(pt);if(firstSeen.has(k))continue;firstSeen.add(k);
  if(i>8&&i<tour.length-5&&!gemKeys.has(k))sites.push({pt,i});
 }
 const gates=[],locks=[];
 for(let i=0;i<doors&&sites.length>8;i++){
  const gate=sites[Math.floor((i+1)*sites.length/(doors+1))];
  if(!gate||gates.some(g=>key(g)===key(gate.pt)))continue;
  const earlier=sites.filter(s=>s.i<gate.i-3&&!gates.some(g=>key(g)===key(s.pt))&&!locks.some(k=>key(k)===key(s.pt)));
  if(!earlier.length)continue;
  const lock=earlier[Math.floor(earlier.length*.45)];
  gates.push(gate.pt);locks.push(lock.pt);
 }
 for(const pt of gems)map[pt[1]][pt[0]]="T";
 for(const pt of locks)map[pt[1]][pt[0]]="K";
 for(const pt of gates)map[pt[1]][pt[0]]="D";
 const optional=available.filter(pt=>!witness.has(key(pt))&&map[pt[1]][pt[0]]==="."),
       countB=Math.min(bWalls,optional.length);
 for(let i=0;i<countB;i++){const pt=optional.splice(n(optional.length),1)[0];map[pt[1]][pt[0]]="B"}
 const enemies=floor.filter(pt=>map[pt[1]][pt[0]]==="."&&!witness.has(key(pt))&&
    Math.abs(pt[0]-spawn[0])+Math.abs(pt[1]-spawn[1])>5);
 for(let i=0;i<guards&&enemies.length;i++){
  const pt=enemies.splice(n(enemies.length),1)[0];map[pt[1]][pt[0]]="M";
 }
 map[spawn[1]][spawn[0]]="P";map[exit[1]][exit[0]]="E";
 const turns=Math.max(actions.length+4,Math.ceil(actions.length*slack)+4);
 const hp=name==="低生命挑战"?3:guards>=3?6:guards?5:3;
 const spec={id:seed,name:name+"-"+seed,archetype:type,seed,rows:map.map(r=>r.join("")),
  turns,hp,bombs:bWalls?Math.min(3,bWalls):0,fog};
 const state=Core.create(spec);
 for(const action of actions){if(state.phase!=="playing")break;Core.step(state,action)}
 if(state.phase!=="won"||state.collected!==state.total)throw Error("Witness failed: "+state.phase+" "+state.collected+"/"+state.total);
 return {spec,proof:{actions,score:state.score,turnsUsed:state.tick,remainingHp:state.hp,allJewels:state.collected}};
}
function signature(spec){return String(spec.seed||0)}
module.exports={generate,profiles,signature,dims};

window.TreasureBase=module.exports;})();
(function(){const module={exports:{}};
"use strict";

const base=window.TreasureBase;
const Core=window.DungeonCore;
const key=([x,y])=>x+","+y;
const dirs=[[0,-1,"up"],[1,0,"right"],[0,1,"down"],[-1,0,"left"]];
const bombProfiles=new Set([4,5,7,8,10,11]);
const dims=base.dims,profiles=base.profiles;
function seedRandom(seed){
 let s=(seed>>>0)^0xA27DE5C1;
 return ()=>{s=(s+0x6D2B79F5)>>>0;let t=Math.imul(s^(s>>>15),1|s);
  t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296};
}
function pointByCharacter(grid,ch){
 for(let y=0;y<grid.length;y++)for(let x=0;x<grid[0].length;x++)
  if(grid[y][x]===ch)return [x,y];
 throw Error("No "+ch+" on map");
}
function positions(start,actions){
 const out=[start];let x=start[0],y=start[1];
 for(const action of actions){
  const d=dirs.find(item=>item[2]===action);
  if(!d)throw Error("Unexpected base witness action: "+action);
  x+=d[0];y+=d[1];out.push([x,y]);
 }
 return out;
}
function action(from,to){
 const d=dirs.find(v=>v[0]===to[0]-from[0]&&v[1]===to[1]-from[1]);
 if(!d)throw Error("Witness movement is not adjacent");
 return d[2];
}
function reachable(grid,start,blockedKey){
 const H=grid.length,W=grid[0].length,queue=[start],seen=new Set([key(start)]);
 for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i];
  for(const [dx,dy] of dirs){
   const X=x+dx,Y=y+dy,k=X+","+Y;
   if(X<=0||Y<=0||X>=W-1||Y>=H-1||seen.has(k)||k===blockedKey)continue;
   if(grid[Y][X]==="#"||grid[Y][X]==="B")continue;
   seen.add(k);queue.push([X,Y]);
  }
 }
 return seen;
}
function tryMandatoryBomb(spec,originalActions){
 const grid=spec.rows.map(s=>s.split("")),start=pointByCharacter(grid,"P");
 const positionsList=positions(start,originalActions),used=new Set(),candidates=[];
 const nGems=grid.flat().filter(x=>x==="T").length;
 if(!spec.bombs||nGems<2)return null;
 for(let idx=0;idx<positionsList.length;idx++){
  const p=positionsList[idx],k=key(p);
  if(used.has(k))continue;used.add(k);
  if(idx<6||idx>positionsList.length-6||grid[p[1]][p[0]]!==".")continue;
  const stand=positionsList[idx-1],retreats=[];
  for(const [dx,dy] of dirs){
   const x1=stand[0]+dx,y1=stand[1]+dy;
   if(y1<1||x1<1||y1>=grid.length-1||x1>=grid[0].length-1)continue;
   if(![".","T","K","P"].includes(grid[y1][x1])||key([x1,y1])===k)continue;
   for(const [ex,ey] of dirs){
    const x2=x1+ex,y2=y1+ey;
    if(x2<1||y2<1||x2>=grid[0].length-1||y2>=grid.length-1)continue;
    if(![".","T","K","P"].includes(grid[y2][x2]))continue;
    if(Math.abs(x2-stand[0])+Math.abs(y2-stand[1])<2||key([x2,y2])===k)continue;
    retreats.push([[x1,y1],[x2,y2]]);
   }
  }
  if(!retreats.length)continue;
  const opened=reachable(grid,start,k);
  let lost=0,remaining=0,exitConnected=false;
  for(let y=0;y<grid.length;y++)for(let x=0;x<grid[y].length;x++){
   if(grid[y][x]==="T"){if(opened.has(x+","+y))remaining++;else lost++}
   if(grid[y][x]==="E")exitConnected=opened.has(x+","+y);
  }
  if(lost>0&&remaining>0&&exitConnected)
   candidates.push({idx,p,stand,retreats,lost,remaining});
 }
 // Prefer a meaningful split rather than an arbitrary obstacle.
 candidates.sort((a,b)=>Math.abs(a.lost/(a.lost+a.remaining)-.44)-
                        Math.abs(b.lost/(b.lost+b.remaining)-.44));
 for(const c of candidates){
  for(const [r1,r2] of c.retreats){
   grid[c.p[1]][c.p[0]]="B";
   const extended=originalActions.slice(0,c.idx-1)
    .concat(["bomb",action(c.stand,r1),action(r1,r2),action(r2,r1),action(r1,c.stand)],
             originalActions.slice(c.idx-1));
   const candidate={...spec,rows:grid.map(r=>r.join("")),
       turns:Math.ceil(extended.length*1.055)+4};
   const state=Core.create(candidate);
   for(const a of extended){if(state.phase!=="playing")break;Core.step(state,a)}
   if(state.phase==="won"&&state.collected===state.total)return {spec:candidate,actions:extended};
   grid[c.p[1]][c.p[0]]=".";
  }
 }
 return null;
}
function generate(seed,type,size=null){
 if(!Number.isInteger(seed)||!Number.isInteger(type)||type<0||type>=profiles.length)
  throw Error("Seed integer and type 0.."+(profiles.length-1)+" required");
 const primary=base.generate(seed,type,size);
 let spec={...primary.spec},actions=primary.proof.actions.slice();
 const r=seedRandom(seed+type*10009);
 // and 100% fog in its three native fog profiles.
 spec.fog=Boolean(spec.fog||r()<.70);
 if(bombProfiles.has(type)){
  const forced=tryMandatoryBomb(spec,actions);
  if(forced){spec=forced.spec;actions=forced.actions}
 }
 if(!actions.length)throw Error("Empty winning certificate");
 spec.turns=Math.max(actions.length+1,Math.ceil(actions.length*1.055)+4);
 const verified=Core.create(spec);
 for(const a of actions){if(verified.phase!=="playing")break;Core.step(verified,a)}
 if(verified.phase!=="won"||verified.collected!==verified.total)
  throw Error("Hardened generator produced an invalid level");
 return {spec,proof:{
  actions,score:verified.score,turnsUsed:verified.tick,
  remainingHp:verified.hp,allJewels:verified.collected
 }};
}
module.exports={generate,profiles,dims,signature:base.signature};

window.TreasureGenerator=module.exports;})();
})();