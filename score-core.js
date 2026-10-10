/* ===== スコア記録・結果画面で共通の処理（保存・計算・集計・半荘の編集） ===== */
(function(){
"use strict";
var KEY="mahjong-score-v2",mem=null;
var MJ=window.MJ={};

function $(i){return document.getElementById(i);}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function r1(v){return Math.round(v*10)/10;}
function pt(v){return (v>0?"+":"")+r1(v).toFixed(1);}
function yen(v){return (v<0?"-":"+")+Math.abs(Math.round(v)).toLocaleString();}
function todayStr(){var d=new Date();return d.getFullYear()+"/"+("0"+(d.getMonth()+1)).slice(-2)+"/"+("0"+d.getDate()).slice(-2);}
function press(id,v){document.querySelectorAll("#"+id+" .btn").forEach(function(b){
  b.setAttribute("aria-pressed",(b.dataset.v!==undefined&&b.dataset.v===String(v))?"true":"false");});}
var toastTimer=null;
function toast(m){
  var t=$("toast");
  if(!t){t=document.createElement("div");t.className="toast";t.id="toast";document.body.appendChild(t);}
  t.textContent=m;t.classList.add("on");clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){t.classList.remove("on");},1700);
}
MJ.$=$;MJ.esc=esc;MJ.r1=r1;MJ.pt=pt;MJ.yen=yen;MJ.todayStr=todayStr;MJ.press=press;MJ.toast=toast;

/* ===== 保存 =====
   D = {date, players:[今のメンバー], rule:{今のルール}, games:[...], fee:{total,payer:名前}, presets}
   各半荘は登録時のメンバー(names)とルール(rule)を持つので、メンバーが替わっても記録は残る。
   リセット後〜設定完了までは {presets} だけを保存する。 */
MJ.save=function(d){try{localStorage.setItem(KEY,JSON.stringify(d));}catch(e){mem=d;}};
MJ.load=function(){
  var d;
  try{var v=localStorage.getItem(KEY);d=v?JSON.parse(v):mem;}catch(e){d=mem;}
  if(d&&d.players&&d.games){
    d.games.forEach(function(g){if(!g.names)g.names=d.players.slice();});
    if(!d.fee)d.fee={total:0,payer:null};
    if(typeof d.fee.payer==="number")d.fee.payer=d.players[d.fee.payer]||null;
  }
  return d;
};
MJ.isReady=function(d){return !!(d&&d.players&&d.rule&&d.presets&&d.games);};

/* ===== 既定プリセット（レート・トビ賞・ウマ・原点） ===== */
MJ.P_RATE=[["ノーレート",0],["テンイチ",10],["テンニ",20],["テンサン",30],["テンヨン",40],
           ["テンゴ",50],["テンロク",60],["テンナナ",70],["テンハチ",80],["テンキュウ",90],
           ["テンピン",100],["リャンピン",200]];
MJ.P_TOBI=[["なし",0],["5",5],["10",10],["20",20]];
MJ.P_UMA={
  2:[["なし",[0,0]],["10-10",[10,-10]],["20-20",[20,-20]],["30-30",[30,-30]]],
  3:[["なし",[0,0,0]],["10-0-10",[10,0,-10]],["20-0-20",[20,0,-20]],["30-0-30",[30,0,-30]],
     ["10-5-15",[10,5,-15]],["20-10-30",[20,10,-30]],["30-10-40",[30,10,-40]]],
  4:[["なし",[0,0,0,0]],["10-5-5-10",[10,5,-5,-10]],["20-10-10-20",[20,10,-10,-20]],
     ["30-10-10-30",[30,10,-10,-30]],["10-20-20-10",[10,20,-20,-10]]]
};
MJ.DEF={2:{start:30000,ret:30000},3:{start:35000,ret:40000},4:{start:25000,ret:30000}};
function pick(list){return list.map(function(x){return [x[0],x[1]];});}
MJ.allRate=function(pr){return MJ.P_RATE.concat(pick(pr.rate));};
MJ.allTobi=function(pr){return MJ.P_TOBI.concat(pick(pr.tobi));};
MJ.allUma=function(pr,n){return MJ.P_UMA[n].concat(pick(pr.uma[n]||[]));};

/* ===== 1半荘の計算 ===== */
MJ.calcGame=function(scores,shooterIdx,rule,names){
  var n=scores.length;
  var need=rule.start*n;
  var total=scores.reduce(function(a,b){return a+b;},0);
  if(total!==need) return {error:"素点合計が"+need.toLocaleString()+"点になっていません（現在 "+total.toLocaleString()+"点）"};
  if(new Set(scores).size!==n) return {error:"同点順位には未対応です。順位を確定して点数を調整してください。"};

  var order=scores.map(function(s,i){return {s:s,i:i};}).sort(function(a,b){return b.s-a.s;});
  var ranks=new Array(n);
  order.forEach(function(o,k){ranks[o.i]=k+1;});

  var oka=(rule.ret-rule.start)*n/1000;
  var points=scores.map(function(s,i){
    var base=(s-rule.ret)/1000;
    var bonus=rule.uma[ranks[i]-1]+(ranks[i]===1?oka:0);
    return base+bonus;
  });

  var busted=[];scores.forEach(function(s,i){if(s<0)busted.push(i);});
  if(busted.length>0&&rule.tobiPoint>0){
    if(shooterIdx===null||shooterIdx===undefined)
      return {error:"トビが発生しています。「飛ばした人」を選択してください。"};
    for(var k=0;k<busted.length;k++){
      if(busted[k]===shooterIdx) return {error:"トビ者と飛ばした人が同じです。"};
      points[busted[k]]-=rule.tobiPoint;
      points[shooterIdx]+=rule.tobiPoint;
    }
  }
  if(busted.length===0&&shooterIdx!==null&&shooterIdx!==undefined)
    return {error:"トビ者がいないため、「飛ばした人」は選択できません。"};

  var pts=points.map(r1);
  var settle=pts.map(function(p){return Math.round(p*rule.yen);});
  var err=r1(pts.reduce(function(a,b){return a+b;},0));
  return {scores:scores,ranks:ranks,pts:pts,settle:settle,shooter:(shooterIdx===undefined?null:shooterIdx),
          error:null,pointError:err,rule:rule,names:names.slice()};
};

/* ===== 集計（名前ごと） ===== */
MJ.participants=function(D){
  var seen={},list=[];
  function add(n){if(!seen[n]){seen[n]=true;list.push(n);}}
  D.games.forEach(function(g){g.names.forEach(add);});
  D.players.forEach(add);
  return list;
};
MJ.hasMoney=function(D){return D.rule.yen>0||D.games.some(function(g){return g.rule.yen>0;});};
MJ.totals=function(D){
  var map={},list=[];
  D.games.forEach(function(g){
    g.names.forEach(function(n,i){
      if(!map[n]){map[n]={name:n,p:0,money:0,games:0,fee:0};list.push(map[n]);}
      map[n].p+=g.pts[i];map[n].money+=g.settle[i];map[n].games++;
    });
  });
  if(D.fee&&D.fee.total>0&&list.length){
    var each=D.fee.total/list.length;
    list.forEach(function(x){x.fee=-each+(x.name===D.fee.payer?D.fee.total:0);});
  }
  list.forEach(function(x){x.p=r1(x.p);x.net=x.money+x.fee;});
  return list.sort(function(a,b){return b.p-a.p;});
};
MJ.pointErrorTotal=function(D){var e=0;D.games.forEach(function(g){e+=g.pointError||0;});return r1(e);};
MJ.rateRangeText=function(D){
  if(D.games.length===0) return D.rule.rateLabel;
  var seen={},list=[];
  D.games.forEach(function(g){
    var l=g.rule.rateLabel;
    if(!seen[l]){seen[l]=true;list.push([l,g.rule.yen]);}
  });
  if(list.length===1) return list[0][0];
  list.sort(function(a,b){return a[1]-b[1];});
  return list[0][0]+"〜"+list[list.length-1][0];
};

/* 成績ボード（総計） */
MJ.boardHTML=function(D,title){
  var t=MJ.totals(D),money=MJ.hasMoney(D);
  var h='<div class="bh"><span>'+esc(title)+'　'+D.games.length+'半荘</span><span>'+esc(MJ.rateRangeText(D))+'</span></div>';
  if(D.games.length===0) return h+'<div class="empty">まだ記録がありません</div>';
  t.forEach(function(x,k){
    h+='<div class="brow"><span class="rk'+(k===0?" top":"")+'">'+(k+1)+'</span><span class="nm">'+esc(x.name)+
       '<small>'+x.games+'半荘</small></span><span class="vals">';
    if(money){
      h+='<span class="pt '+(x.net>=0?"plus":"minus")+'">'+yen(x.net)+'<span style="font-size:12px">円</span></span>'+
         '<br><span class="yen">'+pt(x.p)+'P</span>';
    }else{
      h+='<span class="pt '+(x.p>=0?"plus":"minus")+'">'+pt(x.p)+'<span style="font-size:12px">P</span></span>';
    }
    h+='</span></div>';
  });
  var foot=[];
  if(D.fee&&D.fee.total>0) foot.push("場代 "+D.fee.total.toLocaleString()+"円込み"+(D.fee.payer?"（立替："+esc(D.fee.payer)+"）":""));
  var pe=MJ.pointErrorTotal(D);
  if(Math.abs(pe)>0.001) foot.push("ポイント誤差 "+pt(pe)+"P");
  if(foot.length) h+='<div class="bf">'+foot.join("　／　")+'</div>';
  return h;
};

/* ルールを小さなタグで表示 */
MJ.ruleTags=function(r,n){
  var oka=r1((r.ret-r.start)*n/1000);
  function tag(cls,label,val){return '<span class="rtag'+(cls?" "+cls:"")+'">'+(label?'<i>'+label+'</i>':"")+esc(val)+'</span>';}
  return '<div class="rtags">'+
    tag("","",n+"人")+
    tag("rate","",r.rateLabel+(r.yen?"・1P="+r.yen+"円":""))+
    tag("","ウマ",r.umaLabel)+
    tag("","トビ",r.tobiLabel)+
    tag("","持ち",(r.start/1000)+"k→"+(r.ret/1000)+"k")+
    (oka?tag("","オカ",oka+"P"):"")+
  '</div>';
};

/* 半荘カード（タップで編集） */
MJ.gameCardHTML=function(g,i){
  var h='<div class="hrow" data-i="'+i+'"><div class="htop"><span class="hn">#'+(i+1)+'</span>'+
        '<span class="hbadge">'+esc(g.rule.rateLabel)+'</span>';
  if(g.shooter!==null&&g.shooter!==undefined) h+='<span class="hbadge">飛 '+esc(g.names[g.shooter])+'</span>';
  if(Math.abs(g.pointError||0)>0.001) h+='<span class="hbadge">誤差 '+pt(g.pointError)+'</span>';
  if(g.memo) h+='<span class="hbadge">'+esc(g.memo)+'</span>';
  h+='<span class="hg">›</span></div>';
  h+='<div class="hc" style="grid-template-columns:repeat('+g.names.length+',minmax(0,1fr))">';
  g.pts.forEach(function(p,k){
    var c=p>=0?"up":"down";
    h+='<div class="hp"><span class="hpn">'+esc(g.names[k])+'</span>';
    if(g.rule.yen) h+='<span class="hpp '+c+'">'+yen(g.settle[k])+'</span><span class="hpy">'+pt(p)+'P</span>';
    else h+='<span class="hpp '+c+'">'+pt(p)+'</span><span class="hpy">P</span>';
    h+='</div>';
  });
  return h+'</div></div>';
};

/* ===== 半荘の編集（モーダル） ===== */
var ed={D:null,i:-1,shooter:null,done:null,rule:null};
function ensureModal(){
  if($("modal")) return;
  var m=document.createElement("div");
  m.className="modal hide";m.id="modal";
  m.innerHTML='<div class="msheet">'+
    '<h3 id="mTitle">半荘の編集</h3>'+
    '<div id="mScores"></div>'+
    '<div class="sumbar"><span>素点合計</span><span id="mSum">—</span></div>'+
    '<div style="margin-top:15px"><p class="lbl">飛ばした人</p><div class="seg sm" id="mShooter"></div></div>'+
    '<div class="frow" style="margin-top:15px"><span>メモ</span><input type="text" id="mMemo" placeholder="任意"></div>'+
    '<div class="lblrow" style="display:flex;align-items:center;gap:8px;margin:4px 0 8px">'+
      '<p class="lbl" style="flex:1;margin:0 0 0 4px">この半荘のルール</p>'+
      '<button class="tlink hide" id="mRuleNow">今の設定に合わせる</button>'+
      '<button class="tlink" id="mRuleEdit" aria-expanded="false">変更</button>'+
    '</div>'+
    '<div id="mRule"></div>'+
    '<div class="hide" id="mRuleBox" style="margin-top:6px">'+
      '<p class="lbl" style="margin:12px 0 0 4px">レート</p><div class="chips" id="mRate"></div>'+
      '<p class="lbl" style="margin:12px 0 0 4px">ウマ</p><div class="chips" id="mUma"></div>'+
      '<p class="lbl" style="margin:12px 0 0 4px">トビ賞</p><div class="chips" id="mTobi"></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">'+
        '<div class="frow"><span>配給原点</span><input type="number" inputmode="numeric" id="mStart"></div>'+
        '<div class="frow"><span>返し点</span><input type="number" inputmode="numeric" id="mRet"></div>'+
      '</div>'+
    '</div>'+
    '<div class="err hide" id="mErr"></div>'+
    '<button class="primary" id="mSave" style="margin-top:14px">更新する</button>'+
    '<button class="ghost" id="mCancel" style="margin-top:9px">キャンセル</button>'+
    '<button class="ghost danger" id="mDelete" style="margin-top:9px">この半荘を削除</button>'+
  '</div>';
  document.body.appendChild(m);
  $("mShooter").addEventListener("click",function(e){
    var b=e.target.closest(".btn");if(!b)return;
    ed.shooter=b.dataset.v==="none"?null:+b.dataset.v;
    press("mShooter",b.dataset.v);validate();
  });
  $("mRuleEdit").addEventListener("click",function(){
    var open=$("mRuleBox").classList.toggle("hide")===false;
    this.setAttribute("aria-expanded",open?"true":"false");
  });
  $("mRuleNow").addEventListener("click",function(){
    ed.rule=JSON.parse(JSON.stringify(ed.D.rule));renderRule();validate();toast("今の設定に合わせました");
  });
  function onChip(kind){
    return function(e){
      var b=e.target.closest(".btn");if(!b)return;
      var n=ed.D.games[ed.i].names.length,pr=ed.D.presets;
      if(kind==="rate"){var r=MJ.allRate(pr)[+b.dataset.k];ed.rule.rateLabel=r[0];ed.rule.yen=r[1];}
      if(kind==="uma"){var u=MJ.allUma(pr,n)[+b.dataset.k];ed.rule.umaLabel=u[0];ed.rule.uma=u[1].slice();}
      if(kind==="tobi"){var t=MJ.allTobi(pr)[+b.dataset.k];ed.rule.tobiLabel=t[0];ed.rule.tobiPoint=t[1];}
      renderRule();validate();
    };
  }
  $("mRate").addEventListener("click",onChip("rate"));
  $("mUma").addEventListener("click",onChip("uma"));
  $("mTobi").addEventListener("click",onChip("tobi"));
  ["mStart","mRet"].forEach(function(id){
    $(id).addEventListener("input",function(){
      var v=Number(this.value);
      if(this.value===""||!Number.isFinite(v)) return;
      ed.rule[id==="mStart"?"start":"ret"]=v;
      $("mRule").innerHTML=MJ.ruleTags(ed.rule,ed.D.games[ed.i].names.length);validate();
    });
  });
  $("mSave").addEventListener("click",function(){
    var g=ed.D.games[ed.i],res=MJ.calcGame(read(),ed.shooter,ed.rule,g.names);
    if(res.error){toast(res.error);return;}
    res.memo=$("mMemo").value.trim();
    ed.D.games[ed.i]=res;MJ.save(ed.D);close();
    toast("第"+(ed.i+1)+"半荘を更新しました");
  });
  $("mCancel").addEventListener("click",function(){$("modal").classList.add("hide");});
  $("mDelete").addEventListener("click",function(){
    if(!confirm("第"+(ed.i+1)+"半荘を削除しますか？"))return;
    ed.D.games.splice(ed.i,1);MJ.save(ed.D);close();toast("削除しました");
  });
}
function chipsHTML(list,label,sub){
  return list.map(function(x,k){
    return '<button class="btn" data-k="'+k+'" aria-pressed="'+(x[0]===label)+'">'+esc(x[0])+(sub?'<small>'+sub(x)+'</small>':'')+'</button>';
  }).join("");
}
function renderRule(){
  var n=ed.D.games[ed.i].names.length,pr=ed.D.presets,r=ed.rule;
  $("mRule").innerHTML=MJ.ruleTags(r,n);
  $("mRate").innerHTML=chipsHTML(MJ.allRate(pr),r.rateLabel,function(x){return (x[1]||0)+"円";});
  $("mUma").innerHTML=chipsHTML(MJ.allUma(pr,n),r.umaLabel);
  $("mTobi").innerHTML=chipsHTML(MJ.allTobi(pr),r.tobiLabel,function(x){return x[1]+"P";});
  $("mStart").value=r.start;$("mRet").value=r.ret;
}
function close(){$("modal").classList.add("hide");if(ed.done)ed.done();}
function read(){
  var v=[];document.querySelectorAll("#mScores input").forEach(function(el){v.push(el.value===""?null:Number(el.value));});
  return v;
}
function validate(){
  var g=ed.D.games[ed.i],v=read();
  var need=ed.rule.start*v.length,blanks=v.filter(function(x){return x===null;}).length;
  var filled=v.reduce(function(a,b){return a+(b||0);},0);
  var el=$("mSum");
  if(blanks>0){el.innerHTML='<span class="ng">未入力あり</span>';}
  else if(filled===need){el.innerHTML='<span class="ok">'+filled.toLocaleString()+' ✓</span>';}
  else{el.innerHTML='<span class="ng">'+filled.toLocaleString()+'（差 '+(filled-need>0?"+":"")+(filled-need).toLocaleString()+'）</span>';}
  var e=$("mErr");e.classList.add("hide");
  if(blanks>0){$("mSave").disabled=true;return;}
  var res=MJ.calcGame(v,ed.shooter,ed.rule,g.names);
  if(res.error){e.textContent=res.error;e.classList.remove("hide");$("mSave").disabled=true;return;}
  $("mSave").disabled=false;
}
MJ.openEdit=function(D,i,done){
  ensureModal();
  ed.D=D;ed.i=i;ed.done=done;
  var g=D.games[i];
  ed.rule=JSON.parse(JSON.stringify(g.rule));
  $("mTitle").textContent="第"+(i+1)+"半荘の編集";
  var h="";
  g.names.forEach(function(n,k){
    h+='<div class="pscore"><span class="pn">'+esc(n)+'</span><input type="number" inputmode="numeric" data-i="'+k+'" value="'+g.scores[k]+'"></div>';
  });
  $("mScores").innerHTML=h;
  document.querySelectorAll("#mScores input").forEach(function(el){el.addEventListener("input",validate);});
  var s="";g.names.forEach(function(n,k){s+='<button class="btn" data-v="'+k+'">'+esc(n)+'</button>';});
  s+='<button class="btn" data-v="none">無し</button>';
  $("mShooter").innerHTML=s;
  ed.shooter=(g.shooter===null||g.shooter===undefined)?null:g.shooter;
  press("mShooter",ed.shooter===null?"none":ed.shooter);
  $("mMemo").value=g.memo||"";
  renderRule();
  $("mRuleBox").classList.add("hide");$("mRuleEdit").setAttribute("aria-expanded","false");
  $("mRuleNow").classList.toggle("hide",!(D.rule&&D.players.length===g.names.length));
  $("modal").classList.remove("hide");validate();
};

})();
