"use strict";
(()=>{
const D=window.TreasureLevels,Core=window.DungeonCore,Gen=window.TreasureGenerator;
const $=id=>document.getElementById(id),KEY="treasure-adventure-v1";
const mapOverview=window.TreasureMap;
const collections={tutorial:D.tutorial,training:D.training,archive:D.archive};
const byId=new Map([...D.tutorial,...D.training,...D.archive].map(x=>[x.id,x]));
const categories=D.categories;
const el={canvas:$("board"),mini:$("minimap")},ctx=el.canvas.getContext("2d"),mini=el.mini.getContext("2d");
let viewW=17,viewH=11;const T=44;
let saved={records:{},lastId:"t01",snapshot:null},active=null,game=null,modalOpen=false,tab="tutorial";
let browseCategory="全部",browsePage=0,browseQuery="",browseSize="全部",queue=[],mute=false,turnAnimation=0;
try{const obj=JSON.parse(localStorage.getItem(KEY)||"{}");if(obj&&typeof obj==="object")saved={...saved,...obj,records:obj.records||{}}}catch(e){}
const safeSave=()=>{try{localStorage.setItem(KEY,JSON.stringify(saved))}catch(e){$("stepStatus").textContent="存档不可用，仍可继续游玩"}};
const fmt=(n)=>String(n).padStart(2,"0");
const score=s=>Math.round((s.score/(s.total*100+100+s.maxHp*25+s.maxTurns*2))*10000)/100;
const stars=s=>s.collected===s.total?3:s.collected/s.total>=.67?2:1;
const played=id=>!!saved.records[id]?.attempts;
const clearNode=n=>{while(n.firstChild)n.removeChild(n.firstChild)};
function beep(f=600,t=.12,wave="sine"){
 if(mute)return;try{
 const ac=beep.ctx||(beep.ctx=new (window.AudioContext||window.webkitAudioContext)());
 const osc=ac.createOscillator(),g=ac.createGain();osc.type=wave;osc.frequency.value=f;
 osc.connect(g);g.connect(ac.destination);g.gain.setValueAtTime(.07,ac.currentTime);
 g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+t);osc.start();osc.stop(ac.currentTime+t);
 }catch(e){}
}
function modal({icon="✦",label="冒险提示",title,text="",stats="",primary="继续",secondary="返回",onPrimary,onSecondary}){
 modalOpen=true;$("modalIcon").textContent=icon;$("modalLabel").textContent=label;
 $("modalHeading").textContent=title;$("modalBody").textContent=text;$("modalStats").textContent=stats;
 $("modalPrimary").textContent=primary;$("modalSecondary").textContent=secondary;
 $("modalPrimary").onclick=()=>{closeModal();onPrimary?.()};
 $("modalSecondary").onclick=()=>{closeModal();onSecondary?.()};
 $("modal").classList.remove("hidden");
}
function closeModal(){modalOpen=false;$("modal").classList.add("hidden")}
function info(){
 modal({icon:"✧",label:"玩法说明",title:"带着宝石走出地牢",
 text:"用 WASD 或方向键移动，每个动作消耗一回合。\n拾取宝石，带至少一颗宝石走到绿色出口才能通关。\n钥匙会自动开启封印门；放置炸弹后经过三个行动阶段爆炸，可炸墙、击倒守卫，也可能炸伤自己。\n守卫每三回合移动一次，受到伤害后短暂受保护。\n黑暗区域需要靠近才能看见；撞墙或尝试无效动作也会消耗回合。\n手机可使用屏幕底部的方向键、炸弹和等待按钮。\n成功撤离后，宝石越多、生命与回合剩余越多，得分越高。",
 stats:"手机：屏幕底部方向键 / 炸弹 / 等待　·　电脑：WASD、空格、Q 和 R　·　地图总览可随时回顾探索区域",
 primary:"继续冒险",secondary:"选择教程",onSecondary:()=>{showTab("tutorial");document.getElementById("library").scrollIntoView({behavior:"smooth"})}});
}
function levelById(id){return byId.get(id)||((active&&active.id===id)?active.spec:null)}
function placeActive(item,kind,showIntro=true){
 if(!item)return;
 active={id:item.id,spec:item,kind};game=Core.create(item);
 saved.lastId=item.id;saved.snapshot={id:item.id,kind,actions:[],spec:kind==="random"?item:null,queue:[...queue]};
 const rec=saved.records[item.id]||{attempts:0,wins:0,best:0,stars:0};
 saved.records[item.id]={...rec,attempts:rec.attempts+1};safeSave();
 refreshInfo();renderLibrary();
 if(showIntro)modal({label:"进入遗迹",icon:"◇",title:item.name,
 text:item.description||"收集宝石并寻找安全出口。越贪心，奖励越丰厚，但风险也会增加。",
 stats:"宝石 "+game.total+" 颗　·　生命 "+game.hp+"　·　回合 "+game.turns+"　·　炸弹 "+game.heldBombs,
 primary:"开始探索",secondary:"了解玩法",onSecondary:info});
}
function launchId(id){
 const item=byId.get(id);if(!item){$("stepStatus").textContent="关卡未找到";return}
 const kind=id[0]==="t"?"tutorial":id[0]==="p"?"training":"archive";
 placeActive(item,kind);
 window.scrollTo({top:0,behavior:"smooth"});
}
function replayLast(){
 const snap=saved.snapshot;if(!snap)return false;
 const item=(snap.kind==="random"?snap.spec:byId.get(snap.id));if(!item)return false;
 try{
  const state=Core.create(item);
  for(const a of snap.actions||[]){if(state.phase!=="playing")break;Core.step(state,a)}
  if(state.phase!=="playing")return false;
  active={id:item.id,spec:item,kind:snap.kind};game=state;queue=snap.queue||[];
  refreshInfo();return true;
 }catch(e){return false}
}
function restart(){if(active){const id=active.id;placeActive(active.spec,active.kind,false);$("stepStatus").textContent="重新开始";beep(430,.1)}}
function onAction(action){
 if(!game||modalOpen||game.phase!=="playing")return;
 const hp=game.hp,gems=game.collected,keys=game.heldKeys;
 Core.step(game,action);turnAnimation=performance.now();
 if(game.collected>gems)beep(880,.12,"triangle");
 else if(game.hp<hp)beep(140,.22,"sawtooth");
 else if(game.heldKeys>keys)beep(690,.08);
 saved.snapshot={id:active.id,kind:active.kind,actions:game.actionLog.slice(),
  spec:active.kind==="random"?active.spec:null,queue:[...queue]};
 safeSave();refreshInfo();
 if(game.phase!=="playing")finish();
}
function finish(){
 const ok=game.phase==="won",r=saved.records[active.id]||{attempts:1,wins:0,best:0,stars:0};
 const points=ok?score(game):0;
 if(ok){r.wins+=1;r.best=Math.max(r.best,points);r.stars=Math.max(r.stars,stars(game));beep(1000,.28,"triangle")}
 else beep(130,.32,"sawtooth");
 saved.records[active.id]=r;saved.snapshot=null;safeSave();refreshInfo();renderLibrary();
 let onward=null;
 if(ok&&queue.length&&queue[0]===active.id){queue.shift();onward=queue[0]||null;}
 else if(active.kind==="tutorial"){const n=D.tutorial.findIndex(x=>x.id===active.id);onward=D.tutorial[n+1]?.id||D.training[0].id}
 else if(active.kind==="training"){const n=D.training.findIndex(x=>x.id===active.id);onward=D.training[n+1]?.id||D.archive[0].id}
 else if(active.kind==="archive"){const n=D.archive.findIndex(x=>x.id===active.id);onward=D.archive[n+1]?.id||null}
 const msg=ok?"带着 "+game.collected+" 颗宝石，成功离开了遗迹。":
  game.lastEvent+"。不过宝物和通道都还在那里，随时可以再试。";
 modal({icon:ok?"✦":"☽",label:ok?"撤离成功":"探险失败",title:ok?"收获颇丰！":"下次一定能走得更远",
 text:msg,stats:ok?"本关得分 "+points.toFixed(2)+"　·　最佳 "+r.best.toFixed(2)+"　·　评级 "+"★".repeat(stars(game)):"已探索 "+game.tick+" 回合　·　拿到 "+game.collected+" 颗宝石",
 primary:ok?(onward?"下一关 →":"自由探索"):"再试一次",
 secondary:ok?"再玩本关":"选择关卡",
 onPrimary:()=>{if(!ok)return restart();if(onward)return launchId(onward);showTab(active.kind==="random"?"random":"archive");$("library").scrollIntoView({behavior:"smooth"})},
 onSecondary:()=>{if(ok)restart();else{$("library").scrollIntoView({behavior:"smooth"})}}
 });
}
function nextLevel(){
 if(!active)return;
 if(queue.length&&queue[0]===active.id&&queue[1]){launchId(queue[1]);return}
 const arr=collections[active.kind];if(!arr){showTab("random");$("library").scrollIntoView({behavior:"smooth"});return}
 const i=arr.findIndex(s=>s.id===active.id);
 if(arr[i+1])launchId(arr[i+1].id);
 else if(active.kind==="tutorial")launchId(D.training[0].id);
 else if(active.kind==="training")launchId(D.archive[0].id);
 else showTab("archive");
}
function refreshInfo(){
 if(!game||!active)return;
 $("modeTag").textContent=active.kind==="tutorial"?"教学":active.kind==="training"?"精选":"archive"===active.kind?"遗迹":"随机生成";
 $("levelTitle").textContent=active.spec.name;
 $("stepStatus").textContent=game.lastEvent;
 $("gems").textContent=game.collected+" / "+game.total;
 $("hearts").textContent="♥ ".repeat(Math.max(0,game.hp))||"—";
 $("turns").textContent=game.turns+" / "+game.maxTurns;
 $("keys").textContent=game.heldKeys;
 $("bombs").textContent=game.heldBombs;
 $("mission").textContent=active.spec.name;
 $("description").textContent=active.spec.description||"收集宝石、处理障碍并在回合耗尽前撤离。";
 $("tip").textContent=active.spec.tip||((active.spec.fog?"迷雾覆盖了地图。":"你能看清地图，但仍需考虑路线。")+" 带至少一颗宝石进入出口即可通关。");
 $("fogLabel").textContent=active.spec.fog?"仅显示已经见过的区域":"完整地图";
 $("next").disabled=game.phase==="playing";
 const recs=Object.values(saved.records);
 $("doneCount").textContent=recs.filter(x=>x.wins>0).length;
 $("bestCount").textContent=recs.reduce((n,r)=>n+(r.attempts||0),0);
 const arr=collections[active.kind]||[active.spec];
 const won=arr.reduce((n,x)=>n+Number(saved.records[x.id]?.wins>0),0);
 $("progressBar").style.width=(won/arr.length*100)+"%";
 $("categoryProgress").textContent=won+" / "+arr.length+" 关已通关 · 本关"+(saved.records[active.id]?.best?"最佳 "+saved.records[active.id].best.toFixed(2)+" 分":"尚未通关");
}
const R=(x,y,w,h,fill)=>{ctx.fillStyle=fill;ctx.fillRect(x,y,w,h)};
function oval(x,y,r,fill){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill()}
function diamond(x,y,r,fill){
 ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r*.8,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r*.8,y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();
}
function charAt(x,y){
 if(x<0||y<0||x>=game.width||y>=game.height)return "#";
 const k=x+","+y;
 if(game.player.x===x&&game.player.y===y)return "P";
 if(game.bombs.some(b=>b.x===x&&b.y===y))return "O";
 if(game.enemies.some(e=>e.alive&&e.x===x&&e.y===y))return "M";
 if(game.jewels.has(k))return "T";
 if(game.keysOnGround.has(k))return "K";
 return game.grid[y][x];
}
function drawTile(x,y,X,Y,time){
 const px=X*T,py=Y*T,k=x+","+y;
 const lit=!game.fog||Math.abs(x-game.player.x)+Math.abs(y-game.player.y)<=4;
 if(!lit){R(px,py,T,T,(X+Y)%2?"#071522":"#091825");return}
 let c=game.grid[y]?.[x]||"#";
 R(px,py,T,T,"#132a39");
 if(c==="#"){
  R(px+1,py+1,T-2,T-2,"#334c59");R(px+2,py+3,T-4,6,"#526675");
  R(px+1,py+T-7,T-2,6,"#203640");R(px+18,py+9,2,19,"#1c323e");
  R(px+5,py+26,27,2,"#4c616b");
 }else{
  R(px+1,py+1,T-2,T-2,(x+y)%3?"#183242":"#1a3544");
  R(px+4,py+T-6,T-8,1,"#365361");
  if((x*13+y*17)%7===0)R(px+9,py+13,3,2,"#395665");
 }
 if(c==="B"){
  R(px+4,py+6,T-8,T-11,"#755545");R(px+7,py+8,T-14,7,"#a17b5b");
  R(px+21,py+7,2,25,"#4b3530");R(px+5,py+23,32,2,"#4b3530");
 }
 if(c==="D"){
  R(px+7,py+3,30,38,"#60483d");R(px+12,py+5,20,34,"#826144");
  R(px+20,py+7,3,31,"#c4a16a");oval(px+22,py+23,5,"#f4d17b");
 }
 if(c==="E"){
  const pulse=.5+.5*Math.sin(time/400);
  ctx.fillStyle="rgba(65,240,165,"+(.1+.13*pulse)+")";ctx.fillRect(px,py,T,T);
  R(px+8,py+3,28,38,"#237964");R(px+12,py+7,20,31,"#123f3f");
  oval(px+22,py+22,8+pulse*3,"rgba(117,244,187,.35)");
  ctx.fillStyle="#a5ffce";ctx.font="bold 18px sans-serif";ctx.textAlign="center";ctx.fillText("↥",px+22,py+29);
 }
 if(game.jewels.has(k)){
  ctx.shadowColor="#ffc56d";ctx.shadowBlur=14;
  diamond(px+22,py+22+Math.sin(time/310+x)*2,12,"#ffd87c");ctx.shadowBlur=0;
  diamond(px+22,py+20,5,"#fff5c4");
 }
 if(game.keysOnGround.has(k)){
  ctx.strokeStyle="#ffd07b";ctx.lineWidth=4;ctx.beginPath();ctx.arc(px+18,py+19,7,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(px+23,py+24);ctx.lineTo(px+33,py+33);ctx.lineTo(px+36,py+29);ctx.stroke();
 }
 const enemy=game.enemies.find(e=>e.alive&&e.x===x&&e.y===y);
 if(enemy){
  ctx.shadowColor="#fb7374";ctx.shadowBlur=13;oval(px+22,py+22,13,"#af5264");ctx.shadowBlur=0;
  oval(px+17,py+18,3,"#fff0e9");oval(px+27,py+18,3,"#fff0e9");
  R(px+15,py+30,14,3,"#642b3a");
 }
 const bomb=game.bombs.find(b=>b.x===x&&b.y===y);
 if(bomb){
  oval(px+22,py+25,11,"#171d2b");oval(px+19,py+21,4,"#586e7d");
  R(px+21,py+7,3,11,"#bd7d51");diamond(px+23,py+7,5+2*Math.sin(time/160),"#fff2a0");
  ctx.fillStyle="#e7ecf6";ctx.font="bold 12px sans-serif";ctx.textAlign="center";ctx.fillText(bomb.fuse,px+22,py+29);
 }
 if(game.player.x===x&&game.player.y===y){
  ctx.shadowColor="#73e9ce";ctx.shadowBlur=17;
  oval(px+22,py+23,13,"#47b8bb");ctx.shadowBlur=0;
  oval(px+22,py+21,9,"#bff9e5");R(px+17,py+18,3,3,"#194552");R(px+24,py+18,3,3,"#194552");
  oval(px+22,py+37,7,"rgba(85,222,195,.19)");
 }
 if(game.lastBlast.some(v=>v.x===x&&v.y===y)&&performance.now()-turnAnimation<450){
  R(px,py,T,T,"rgba(255,183,76,.38)");
 }
}
function updateViewport(){
 const mobile=window.matchMedia('(max-width:800px)').matches;
 const narrow=window.matchMedia('(max-width:560px)').matches;
 const landscape=window.matchMedia('(max-width:800px) and (orientation:landscape)').matches;
 viewW=mobile?(landscape?11:narrow?9:11):17;
 viewH=mobile?(landscape?7:9):11;
 const width=viewW*T,height=viewH*T;
 if(el.canvas.width!==width)el.canvas.width=width;
 if(el.canvas.height!==height)el.canvas.height=height;
}
function draw(time){
 if(game){
  ctx.clearRect(0,0,el.canvas.width,el.canvas.height);
  let x0=Math.min(Math.max(game.player.x-Math.floor(viewW/2),0),Math.max(0,game.width-viewW));
  let y0=Math.min(Math.max(game.player.y-Math.floor(viewH/2),0),Math.max(0,game.height-viewH));
  for(let y=0;y<viewH;y++)for(let x=0;x<viewW;x++)drawTile(x+x0,y+y0,x,y,time);
  drawMini();
 }
 requestAnimationFrame(draw);
}
function drawMini(){
 const W=el.mini.width,H=el.mini.height;
 mini.fillStyle="#0a1b2b";mini.fillRect(0,0,W,H);
 if(!game)return;
 const tile=Math.min((W-12)/game.width,(H-12)/game.height);
 const x0=(W-game.width*tile)/2,y0=(H-game.height*tile)/2;
 for(let y=0;y<game.height;y++)for(let x=0;x<game.width;x++){
  const k=x+","+y,seen=!game.fog||game.seen.has(k);
  const c=game.grid[y][x];mini.fillStyle=!seen?"#081725":c==="#"?"#415665":c==="D"?"#a87b5e":c==="B"?"#7d5844":c==="E"?"#5bd8ac":"#244454";
  mini.fillRect(x0+x*tile,y0+y*tile,Math.max(1,tile-.5),Math.max(1,tile-.5));
  if(seen&&game.jewels.has(k)){mini.fillStyle="#f1c66d";mini.fillRect(x0+x*tile+tile*.28,y0+y*tile+tile*.28,tile*.45,tile*.45)}
 }
 mini.fillStyle="#d5f7df";
 mini.beginPath();mini.arc(x0+(game.player.x+.5)*tile,y0+(game.player.y+.5)*tile,Math.max(2,tile*.5),0,Math.PI*2);mini.fill();
}
function escape(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function cardHTML(item){
 const record=saved.records[item.id]||{};
 return "<button type='button' class='level-card "+(record.wins?"done ":"")+(active?.id===item.id?"selected":"")+
 "' data-level='"+item.id+"'><span><strong>"+escape(item.name)+"</strong><small>"+escape(item.category)+
 " · "+item.rows[0].length+"×"+item.rows.length+" · "+item.turns+"回合</small></span><span class='flag'>"+
 (record.wins?"★".repeat(record.stars||1):record.attempts?"已尝试":"未探索")+"</span></button>";
}
function makeFilters(includeSearch){
 return "<div class='filters'><div class='field'><label for='typeFilter'>挑战类型</label><select id='typeFilter'>"+
 ["全部",...categories].map(s=>"<option "+(browseCategory===s?"selected":"")+">"+s+"</option>").join("")+
 "</select></div><div class='field'><label for='sizeFilter'>地图高度</label><select id='sizeFilter'>"+
 ["全部","11","13","15","17","19","21"].map(s=>"<option "+(browseSize===s?"selected":"")+">"+s+"</option>").join("")+
 "</select></div>"+(includeSearch?"<div class='field search-box'><label for='searchFilter'>查找遗迹编号</label><input id='searchFilter' placeholder='例如：0128' value='"+escape(browseQuery)+"'></div>":"")+"</div>";
}
function renderLibrary(){
 const root=$("libraryContent");for(const b of document.querySelectorAll(".tabs button"))
  b.classList.toggle("active",b.dataset.tab===tab);
 if(tab==="tutorial"||tab==="training"){
  const arr=collections[tab];
  root.innerHTML="<p class='hint-line'>"+(tab==="tutorial"?"从移动、宝石、钥匙到炸弹和迷雾，循序渐进学会地牢规则。":"30张精选练习地图，自由选择，不设解锁门槛。")+"</p>"+
   "<div class='level-list'>"+arr.map(cardHTML).join("")+"</div>";
 }else if(tab==="archive"){
  const arr=D.archive.filter(x=>(browseCategory==="全部"||x.category===browseCategory)&&
   (browseSize==="全部"||String(x.rows.length)===browseSize)&&
   (!browseQuery||x.id.includes(browseQuery)||x.name.includes(browseQuery)));
  const pages=Math.max(1,Math.ceil(arr.length/30));browsePage=Math.min(browsePage,pages-1);
  root.innerHTML=makeFilters(true)+
   "<p class='hint-line'>共 "+arr.length+" 张符合条件的遗迹。每种挑战类型100关；选择任意一关开始游玩。</p>"+
   "<div class='level-list'>"+arr.slice(browsePage*30,browsePage*30+30).map(cardHTML).join("")+"</div>"+
   "<div class='paging'><button id='pagePrev' "+(browsePage===0?"disabled":"")+">← 上一页</button><span>第 "+(browsePage+1)+" / "+pages+" 页</span>"+
   "<button id='pageNext' "+(browsePage>=pages-1?"disabled":"")+">下一页 →</button></div>";
  $("typeFilter").onchange=e=>{browseCategory=e.target.value;browsePage=0;renderLibrary()};
  $("sizeFilter").onchange=e=>{browseSize=e.target.value;browsePage=0;renderLibrary()};
  $("searchFilter").oninput=e=>{const pos=e.target.selectionStart;browseQuery=e.target.value.trim();browsePage=0;renderLibrary();const node=$("searchFilter");node.focus();node.setSelectionRange(pos,pos)};
  $("pagePrev").onclick=()=>{browsePage--;renderLibrary()};
  $("pageNext").onclick=()=>{browsePage++;renderLibrary()};
 }else if(tab==="unplayed"){
  const pool=D.archive.filter(x=>!played(x.id));
  root.innerHTML="<div class='mode-panel'><h3>下一段未知的旅程</h3><p>从你还没挑战过的遗迹中抽取指定数量。抽取后按顺序游玩，已尝试过的关卡不会再次出现。</p>"+
   "<div class='filters'><div class='field'><label>挑战类型</label><select id='queueType'><option value='全部'>全部类型</option>"+
   categories.map(x=>"<option>"+x+"</option>").join("")+"</select></div>"+
   "<div class='field'><label>抽取数量</label><input type='number' id='queueCount' min='1' max='1200' value='10'></div>"+
   "<button class='primary' id='queueStart'>抽取并开始 →</button></div>"+
   "<p class='hint-line'>还有 <strong>"+pool.length+"</strong> 张遗迹尚未尝试。抽取结果仅从未玩过的关卡中产生。</p>"+
   (queue.length?"<div class='queue-list'>本次冒险："+queue.map(s=>"<span>"+escape(byId.get(s)?.name||s)+"</span>").join("")+"</div>":"")+"</div>";
  $("queueStart").onclick=()=>startQueue();
 }else{
  root.innerHTML="<div class='mode-panel'><h3>每次进入，都不一样</h3><p>使用与关卡库相同的规则即时生成新迷宫：12种挑战类型、6种地图尺寸。输入固定种子可重复挑战同一地图，留空则每次随机。</p>"+
   "<div class='filters'><div class='field'><label>挑战类型</label><select id='randomType'>"+
   categories.map((c,i)=>"<option value='"+i+"'>"+c+"</option>").join("")+"</select></div>"+
   "<div class='field'><label>地图尺寸</label><select id='randomSize'>"+
   [["auto","随机尺寸"],["0","11×17"],["1","13×19"],["2","15×23"],["3","17×27"],["4","19×29"],["5","21×31"]].map(([v,t])=>"<option value='"+v+"'>"+t+"</option>").join("")+"</select></div>"+
   "<div class='field'><label>地图种子（选填）</label><input id='randomSeed' type='number' min='0' max='4294967295' placeholder='留空即随机'></div>"+
   "<button class='primary' id='randomStart'>生成新地牢 →</button></div>"+
   "<p class='hint-line' id='randomHint'>地图生成后即刻开始冒险。相同种子、类型与尺寸可以复现地图。</p></div></div>";
  $("randomStart").onclick=()=>randomLevel();
 }
 root.querySelectorAll("[data-level]").forEach(b=>b.onclick=()=>launchId(b.dataset.level));
}
function showTab(name){tab=name;renderLibrary()}
function startQueue(){
 const count=Math.max(1,Math.min(1200,Number($("queueCount").value)||10)),type=$("queueType").value;
 const pool=D.archive.filter(x=>!played(x.id)&&(type==="全部"||x.category===type)).map(x=>x.id);
 if(!pool.length){modal({title:"这里已经被你探索过了",text:"该类别暂无未游玩的关卡。可以改选其他类型，或重新挑战曾经探索的遗迹。"});return}
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
 queue=pool.slice(0,Math.min(count,pool.length));
 const first=queue[0];launchId(first);
}
function randomLevel(){
 const type=Number($("randomType")?.value??0),option=$("randomSize")?.value||"auto";
 const size=option==="auto"?null:Gen.dims[Number(option)];
 const entry=$("randomSeed")?.value?.trim(),manual=entry!=="";
 let seed=manual?Number(entry):Math.floor(Math.random()*4294967295);
 if(!Number.isInteger(seed)||seed<0||seed>4294967295){
  $("randomHint").textContent="种子必须是0到4294967295之间的整数";return;
 }
 let result=null,used=seed;
 for(let n=0;n<(manual?1:16);n++){
  try{result=Gen.generate((seed+n)>>>0,type,size);used=(seed+n)>>>0;break}catch(e){if(manual){$("randomHint").textContent="当前种子未能生成有效地图，请调整种子或尺寸。";return}}
 }
 if(!result){$("randomHint").textContent="地图生成失败，请重试其他设置";return}
 const s=result.spec;
 const spec={id:"r"+type+"-"+used+"-"+(size?size.join("x"):"auto"),name:categories[type]+" · 种子 "+used,
  category:categories[type],rows:s.rows,turns:s.turns,hp:s.hp,bombs:s.bombs,fog:s.fog,
  description:"这是一张全新的随机遗迹。找到宝石，在体力与时间耗尽前撤离。",
  tip:"地图种子："+used+" · "+s.rows[0].length+"×"+s.rows.length+"。再次输入相同设置即可复现。"};
 queue=[];placeActive(spec,"random");
 window.scrollTo({top:0,behavior:"smooth"});
}
function updateMobileControls(){
 const rect=$("board").getBoundingClientRect();
 const mobile=window.matchMedia("(max-width:800px)").matches;
 const visible=mobile&&rect.bottom>0&&rect.top<window.innerHeight-60;
 document.body.classList.toggle("mobile-play-active",visible);
}
function register(){
 $("openMap").onclick=()=>{if(game&&!modalOpen)mapOverview.open(game)};
 $("help").onclick=info;
 $("jumpLevels").onclick=()=>{$("library").scrollIntoView({behavior:"smooth"})};
 window.addEventListener("scroll",updateMobileControls,{passive:true});
 window.addEventListener("resize",updateMobileControls);
 updateMobileControls();
 $("sound").onclick=()=>{mute=!mute;$("sound").textContent=mute?"♪ 音效关闭":"♪ 音效开启";if(!mute)beep()};
 $("restart").onclick=restart;$("next").onclick=nextLevel;
 $("browse").onclick=()=>{$("library").scrollIntoView({behavior:"smooth"})};
 $("continue").onclick=()=>{
  if(saved.snapshot&&replayLast()){window.scrollTo({top:0,behavior:"smooth"});return}
  if(active){window.scrollTo({top:0,behavior:"smooth"});return}
  launchId(saved.lastId||"t01");
 };
 $("clearSave").onclick=()=>{
  if(!confirm("确定要清除本机的全部游玩记录和进度吗？这一操作无法撤销。"))return;
  saved={records:{},lastId:"t01",snapshot:null};queue=[];safeSave();
  placeActive(D.tutorial[0],"tutorial",false);renderLibrary();
 };
 document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
 document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>onAction(b.dataset.action));
 document.addEventListener("keydown",e=>{
  if(mapOverview.isOpen()){
   if(e.key==="Escape"||e.key==="m"||e.key==="M"){e.preventDefault();mapOverview.close()}
   return;
  }
  if(["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName)||e.ctrlKey||e.altKey||e.metaKey)return;
  if(e.key==="Escape"&&modalOpen){closeModal();return}
  if(modalOpen)return;
  const map={ArrowUp:"up",ArrowRight:"right",ArrowDown:"down",ArrowLeft:"left",
   w:"up",W:"up",a:"left",A:"left",s:"down",S:"down",d:"right",D:"right",
   " ":"bomb",q:"wait",Q:"wait"};
  if(map[e.key]){e.preventDefault();onAction(map[e.key])}
  else if(e.key==="r"||e.key==="R"){e.preventDefault();restart()}
  else if(e.key==="m"||e.key==="M"){e.preventDefault();if(game&&!modalOpen)mapOverview.open(game)}
 });
}
register();
const resumed=replayLast();
if(!resumed)placeActive(D.tutorial[0],"tutorial",false);
showTab("tutorial");
refreshInfo();
updateViewport();
window.addEventListener('resize',updateViewport);
updateMobileControls();
requestAnimationFrame(draw);
if(!resumed&&!saved.records.t01?.wins){
 modal({label:"欢迎来到地牢",icon:"✦",title:"第一段冒险，从这里开始",
 text:"寻找宝石，绕开障碍，带着战利品从绿色出口撤离。\n\n可以随时选择其它关卡，也可以先玩五张教学地图熟悉规则。",
 stats:"完全离线 · 进度自动保存 · 支持键盘与触屏",
 primary:"进入教学关",secondary:"先看规则",onSecondary:info});
}
})();
