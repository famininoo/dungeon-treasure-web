(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 else root.DungeonCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 "use strict";
 const ACTIONS=["up","right","down","left","bomb","wait"];
 const DIRS=[{x:0,y:-1,name:"up"},{x:1,y:0,name:"right"},{x:0,y:1,name:"down"},{x:-1,y:0,name:"left"}];
 const pos=(x,y)=>x+","+y;
 const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
 function create(spec){
  if(!spec||!Array.isArray(spec.rows))throw Error("level rows missing");
  const h=spec.rows.length,w=spec.rows[0].length;
  if(h<4||w<4||spec.rows.some(r=>r.length!==w))throw Error("invalid map size");
  const grid=[],jewels=new Set(),keysOnGround=new Set(),enemies=[];let spawn=null,exit=null;
  for(let y=0;y<h;y++){let row=[];for(let x=0;x<w;x++){const c=spec.rows[y][x],k=pos(x,y);
   if(c==="P"){if(spawn)throw Error("duplicate spawn");spawn={x,y};row.push(".")}
   else if(c==="E"){if(exit)throw Error("duplicate exit");exit={x,y};row.push("E")}
   else if(c==="T"){jewels.add(k);row.push(".")}
   else if(c==="K"){keysOnGround.add(k);row.push(".")}
   else if(c==="M"){enemies.push({x,y,home:{x,y},dir:0,alive:true});row.push(".")}
   else if("#.DB".includes(c)){row.push(c)}
   else throw Error("Unknown map character "+c);
  }grid.push(row)}
  if(!spawn||!exit||!jewels.size)throw Error("map requires start, exit and jewels");
  if(!(spec.turns>0)||!(spec.hp>0)||!(spec.bombs>=0))throw Error("invalid resource");
  const state={levelName:spec.name,grid,player:{...spawn},exit,jewels,keysOnGround,enemies,bombs:[],flashes:[],collected:0,total:jewels.size,heldKeys:0,heldBombs:spec.bombs,hp:spec.hp,maxHp:spec.hp,turns:spec.turns,maxTurns:spec.turns,tick:0,shield:0,score:0,seen:new Set(),phase:"playing",lastEvent:"进入地牢",lastBlast:[],fog:!!spec.fog,width:w,height:h,invalidActions:0,actionLog:[],events:[],id:spec.id||null};
  reveal(state);return state;
 }
 function cell(s,x,y){return x<0||y<0||x>=s.width||y>=s.height?"#":s.grid[y][x]}
 function reveal(s){const r=4;for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++)if(distance(s.player,{x,y})<=r)s.seen.add(pos(x,y))}
 function walk(s,x,y){const c=cell(s,x,y);return c!=="#"&&c!=="B"&&c!=="D"}
 function end(s,win,reason){s.phase=win?"won":"lost";s.lastEvent=reason;if(win)s.score=s.collected*100+(s.collected===s.total?100:0)+s.hp*25+Math.max(0,s.turns)*2;}
 function hit(s,reason){if(s.shield>0)return;s.hp--;s.shield=3;s.lastEvent=reason+"：失去生命";if(s.hp<=0)end(s,false,"生命耗尽")}
 function touch(s){for(const e of s.enemies)if(e.alive&&e.x===s.player.x&&e.y===s.player.y){hit(s,"撞上守卫");break}}
 function neighbors(s,x,y){return DIRS.map(d=>({x:x+d.x,y:y+d.y})).filter(p=>p.x>=0&&p.y>=0&&p.x<s.width&&p.y<s.height)}
 function moveEnemy(s,e){
  const blocked=(x,y)=>!walk(s,x,y)||s.enemies.some(v=>v!==e&&v.alive&&v.x===x&&v.y===y);
  const steps=DIRS.map((d,i)=>({x:e.x+d.x,y:e.y+d.y,dir:i})).filter(p=>!blocked(p.x,p.y));
  if(!steps.length)return;
  let move=null;
  if(distance(e,s.player)<=5){
   const q=[{x:s.player.x,y:s.player.y,d:0}],seen=new Set([pos(s.player.x,s.player.y)]),dmap=new Map([[pos(s.player.x,s.player.y),0]]);
   for(let qi=0;qi<q.length;qi++)for(const n of neighbors(s,q[qi].x,q[qi].y)){const k=pos(n.x,n.y);if(!seen.has(k)&&walk(s,n.x,n.y)){seen.add(k);dmap.set(k,q[qi].d+1);q.push({x:n.x,y:n.y,d:q[qi].d+1})}}
   const ranked=steps.filter(p=>dmap.has(pos(p.x,p.y))).sort((a,b)=>dmap.get(pos(a.x,a.y))-dmap.get(pos(b.x,b.y))||a.dir-b.dir);
   if(ranked.length&&dmap.get(pos(ranked[0].x,ranked[0].y))<=distance(e,s.player)+4)move=ranked[0];
  }
  if(!move)for(let n=0;n<4;n++){const p=steps.find(v=>v.dir===(e.dir+n)%4);if(p){move=p;break}}
  if(move){e.x=move.x;e.y=move.y;e.dir=move.dir}
 }
 function explode(s,b){
  const cells=[{x:b.x,y:b.y}];for(const d of DIRS){const x=b.x+d.x,y=b.y+d.y;if(cell(s,x,y)!=="#")cells.push({x,y})}
  const blast=new Set(cells.map(p=>pos(p.x,p.y)));
  for(const p of cells)if(cell(s,p.x,p.y)==="B")s.grid[p.y][p.x]=".";
  for(const e of s.enemies)if(e.alive&&blast.has(pos(e.x,e.y))){e.alive=false;s.events.push("守卫被炸倒")}
  if(blast.has(pos(s.player.x,s.player.y)))hit(s,"被炸弹波及");
  s.lastBlast.push(...cells);s.events.push("炸弹爆炸");
 }
 function advance(s){
  s.tick++;s.turns--;if(s.shield>0)s.shield--;
  const expired=[];
  for(const b of s.bombs){b.fuse--;if(b.fuse<=0)expired.push(b)}
  if(expired.length){s.bombs=s.bombs.filter(b=>!expired.includes(b));for(const b of expired)explode(s,b)}
  if(s.phase!=="playing")return;
  if(s.tick%3===0)for(const e of s.enemies)if(e.alive)moveEnemy(s,e);
  touch(s);reveal(s);
  if(s.phase==="playing"&&s.turns<=0&&!(s.player.x===s.exit.x&&s.player.y===s.exit.y&&s.collected>0))end(s,false,"回合耗尽");
 }
 function step(s,action){
  if(s.phase!=="playing")return observation(s);
  s.events=[];s.lastBlast=[];
  if(!ACTIONS.includes(action)){s.invalidActions++;action="wait";s.lastEvent="非法动作：按等待处理"}
  if(action==="bomb"){
   if(s.heldBombs<=0||s.bombs.some(b=>b.x===s.player.x&&b.y===s.player.y)){s.invalidActions++;s.lastEvent="炸弹不可用：浪费一回合";}
   else{s.heldBombs--;s.bombs.push({x:s.player.x,y:s.player.y,fuse:3});s.lastEvent="放置炸弹";}
   advance(s);
  }else if(action==="wait"){s.lastEvent="等待";advance(s)}
  else{
   const d=DIRS.find(v=>v.name===action),x=s.player.x+d.x,y=s.player.y+d.y,c=cell(s,x,y),k=pos(x,y);
   if(c==="#"||c==="B"||(c==="D"&&s.heldKeys===0)){s.invalidActions++;s.lastEvent="路线受阻：浪费一回合";advance(s)}
   else{
    if(c==="D"){s.heldKeys--;s.grid[y][x]=".";s.events.push("开启封印门")}
    s.player.x=x;s.player.y=y;
    if(s.keysOnGround.has(k)){s.keysOnGround.delete(k);s.heldKeys++;s.events.push("拾取钥匙")}
    if(s.jewels.has(k)){s.jewels.delete(k);s.collected++;s.events.push("获得宝石")}
    s.lastEvent=s.events.join("、")||"移动";
    advance(s);
    if(s.phase==="playing"&&s.player.x===s.exit.x&&s.player.y===s.exit.y&&s.collected>0)end(s,true,"成功撤离");
   }
  }
  s.actionLog.push(action);return observation(s);
 }
 function observation(s){
  const view=[];
  for(let y=0;y<s.height;y++){let row="";for(let x=0;x<s.width;x++){
    const visible=!s.fog||distance(s.player,{x,y})<=4,k=pos(x,y);
    if(!visible){row+="?";continue}
    let c=cell(s,x,y);
    if(s.jewels.has(k))c="T";
    if(s.keysOnGround.has(k))c="K";
    if(s.enemies.some(e=>e.alive&&e.x===x&&e.y===y))c="M";
    if(s.bombs.some(b=>b.x===x&&b.y===y))c="O";
    if(s.player.x===x&&s.player.y===y)c="P";
    row+=c;
   }view.push(row)}
  return {version:"0.2",level:s.levelName,phase:s.phase,turn:s.tick,turnsRemaining:s.turns,maxTurns:s.maxTurns,hp:s.hp,maxHp:s.maxHp,keys:s.heldKeys,bombs:s.heldBombs,jewels:s.collected,totalJewels:s.total,player:{...s.player},view,score:s.score,lastEvent:s.lastEvent,events:[...s.events],invalidActions:s.invalidActions};
 }
 function play(spec,policy,maxActions=1000){
  const state=create(spec);let obs=observation(state);
  while(state.phase==="playing"&&state.tick<maxActions){const a=policy(obs);obs=step(state,a)}
  return {score:state.score,phase:state.phase,turnsUsed:state.tick,jewels:state.collected,totalJewels:state.total,hp:state.hp,invalidActions:state.invalidActions,actionLog:state.actionLog.slice(),lastEvent:state.lastEvent};
 }
 return {ACTIONS,DIRS,create,step,observation,play,score:s=>s.score};
});