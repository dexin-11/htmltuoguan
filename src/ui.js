// 图形化控制台页面（作为字符串内嵌，随 Worker 一同部署）
// 注意：本文件整体使用模板字符串，内部 HTML/CSS/JS 一律不使用反引号与 ${}

export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0a0f0c"/><path d="M9 11h14M9 16h10M9 21h6" stroke="#3dff8b" stroke-width="3" stroke-linecap="round"/></svg>`;

export const UI_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HTML 托管舱 · Hosting Bay</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230a0f0c'/%3E%3Cpath d='M9 11h14M9 16h10M9 21h6' stroke='%233dff8b' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;800&family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,700;1,400&family=Noto+Sans+SC:wght@400;700;900&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#0a0f0c; --panel:#0d1510; --panel2:#101a13;
  --line:#1e2d24; --line2:#2c4433;
  --fg:#d9e6de; --dim:#7d968a; --faint:#49604f;
  --acc:#3dff8b; --acc-ink:#05130b; --amber:#ffb454; --bad:#ff5c74;
  --mono:'IBM Plex Mono','Noto Sans SC',ui-monospace,Menlo,monospace;
  --disp:'Unbounded','Noto Sans SC',sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{
  background:
    radial-gradient(1100px 560px at 88% -12%, rgba(61,255,139,.08), transparent 62%),
    radial-gradient(900px 520px at -12% 112%, rgba(255,180,84,.05), transparent 60%),
    var(--bg);
  color:var(--fg); font-family:var(--mono); font-size:15px; line-height:1.65;
  min-height:100vh; overflow-x:hidden;
}
body::before{ /* 网格底纹 */
  content:""; position:fixed; inset:0; pointer-events:none; z-index:0;
  background:
    repeating-linear-gradient(0deg, rgba(61,255,139,.028) 0 1px, transparent 1px 52px),
    repeating-linear-gradient(90deg, rgba(61,255,139,.028) 0 1px, transparent 1px 52px);
}
body::after{ /* 扫描线 */
  content:""; position:fixed; inset:0; pointer-events:none; z-index:99;
  background:repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,.14) 2px 3px);
  mix-blend-mode:multiply;
}
::selection{background:var(--acc);color:var(--acc-ink)}
a{color:var(--acc);text-decoration:none}
button{font-family:var(--mono);cursor:pointer}
.hidden{display:none!important}
:focus-visible{outline:2px solid var(--acc);outline-offset:2px}

/* ── 顶栏 ─────────────────────────── */
.topbar{
  position:relative; z-index:2; display:flex; align-items:center; gap:20px;
  border-bottom:1px solid var(--line); background:rgba(10,15,12,.88); backdrop-filter:blur(6px);
  padding:12px 24px; animation:drop .5s both;
}
.brand{font-weight:700; letter-spacing:.08em; white-space:nowrap}
.brand-mark{color:var(--acc); margin-right:8px}
.ver{color:var(--faint); font-size:12px; margin-left:8px; font-weight:400}
.ticker{flex:1; overflow:hidden; white-space:nowrap; mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.ticker-inner{display:inline-block; animation:tick 26s linear infinite; color:var(--dim); font-size:12.5px; letter-spacing:.06em}
.ticker-inner b{color:var(--acc); font-weight:700}
.status{white-space:nowrap; color:var(--dim); font-size:12.5px; letter-spacing:.1em; display:flex; align-items:center; gap:8px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--acc);box-shadow:0 0 10px var(--acc);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes tick{from{transform:translateX(0)}to{transform:translateX(-50%)}}

/* ── 主区 ─────────────────────────── */
main{position:relative; z-index:1; max-width:1180px; margin:0 auto; padding:56px 24px 40px}
.hero{display:grid; grid-template-columns:7fr 5fr; gap:40px; align-items:center; margin-bottom:48px}
.eyebrow{color:var(--acc); font-size:12px; letter-spacing:.22em; margin-bottom:18px; animation:rise .6s .05s both}
.title{font-family:var(--disp); font-weight:800; font-size:clamp(44px,6.4vw,84px); line-height:1.04; letter-spacing:.01em; animation:rise .6s .12s both}
.t-outline{color:transparent; -webkit-text-stroke:2px var(--acc); text-stroke:2px var(--acc)}
.cursor{display:inline-block; width:.5em; height:.9em; background:var(--acc); margin-left:12px; vertical-align:baseline; animation:blink 1.1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
.lead{color:var(--dim); max-width:56ch; margin:22px 0 26px; animation:rise .6s .2s both}
.lead b{color:var(--fg); font-weight:500}
.steps{list-style:none; display:flex; flex-wrap:wrap; gap:10px; animation:rise .6s .28s both}
.steps li{border:1px solid var(--line2); padding:7px 14px; font-size:13px; color:var(--dim); background:rgba(16,26,19,.6)}
.steps li i{font-style:normal; color:var(--acc); font-weight:700; margin-right:8px}

/* 终端装饰卡 */
.term{border:1px solid var(--line2); background:#0b120d; box-shadow:0 24px 60px -30px rgba(61,255,139,.25); animation:rise .6s .3s both; clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,0 100%)}
.term-bar{display:flex; gap:6px; align-items:center; padding:10px 14px; border-bottom:1px solid var(--line)}
.term-bar span{width:9px;height:9px;border-radius:50%;background:var(--line2)}
.term-bar span:first-child{background:var(--bad)}
.term-bar span:nth-child(2){background:var(--amber)}
.term-bar span:nth-child(3){background:var(--acc)}
.term-bar em{font-style:normal;color:var(--faint);font-size:12px;margin-left:auto}
.term pre{padding:18px 20px 22px; font-size:13px; line-height:1.9; color:var(--dim); overflow-x:auto}
.term .c-dim{color:var(--faint)} .term .c-ok{color:var(--acc);font-weight:700} .term .c-link{color:var(--amber)}
.cursor2{display:inline-block;width:8px;height:14px;background:var(--acc);vertical-align:-2px;animation:blink 1.1s steps(1) infinite}

/* ── 横幅 ─────────────────────────── */
.banner{border:1px solid rgba(255,180,84,.4); background:rgba(255,180,84,.07); color:var(--amber); padding:12px 18px; margin-bottom:28px; font-size:13.5px; animation:rise .5s both}

/* ── 面板 ─────────────────────────── */
.grid{display:grid; grid-template-columns:7fr 5fr; gap:28px; align-items:start}
.panel{border:1px solid var(--line); background:var(--panel); clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,0 100%)}
#panel-upload{animation:rise .6s .36s both}
#panel-list{animation:rise .6s .44s both}
.panel-head{display:flex; align-items:center; gap:12px; padding:14px 20px; border-bottom:1px solid var(--line)}
.panel-head h2{font-size:15px; font-weight:700; letter-spacing:.06em}
.tag{font-size:10.5px; letter-spacing:.18em; background:var(--acc); color:var(--acc-ink); padding:3px 8px; font-weight:700}
.tag.alt{background:transparent; color:var(--acc); border:1px solid var(--acc)}
.count{margin-left:auto; color:var(--dim); font-size:13px}
.refresh{background:none; border:1px solid var(--line2); color:var(--dim); width:30px; height:30px; font-size:15px; transition:.2s}
.refresh:hover{color:var(--acc); border-color:var(--acc)}
.refresh.spin{animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.panel-body{padding:22px 20px 24px}

/* Tabs */
.tabs{display:flex; gap:8px; margin-bottom:20px}
.tab{background:none; border:1px solid var(--line2); color:var(--dim); padding:8px 18px; font-size:13.5px; letter-spacing:.04em; transition:.2s}
.tab.active{background:var(--acc); color:var(--acc-ink); border-color:var(--acc); font-weight:700}
.tab:not(.active):hover{color:var(--fg); border-color:var(--fg)}

/* 项目名 */
.field-label{display:block; font-size:11.5px; letter-spacing:.2em; color:var(--dim); margin-bottom:8px}
.name-row{margin-bottom:20px}
#name-input{
  width:100%; background:#0a110d; border:1px solid var(--line2); color:var(--acc);
  font-family:var(--mono); font-size:17px; padding:12px 14px; letter-spacing:.04em; transition:.2s;
}
#name-input:focus{outline:none; border-color:var(--acc); box-shadow:0 0 0 3px rgba(61,255,139,.12)}
.name-status{display:block; margin-top:7px; font-size:12.5px; color:var(--faint)}
.name-status.ok{color:var(--acc)} .name-status.bad{color:var(--bad)}

/* 拖放区 */
.dropzone{
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px;
  min-height:190px; border:1.5px dashed var(--line2); background:rgba(16,26,19,.35);
  padding:26px 18px; text-align:center; cursor:pointer; transition:.22s;
}
.dropzone svg{opacity:.75; margin-bottom:6px; transition:.22s}
.dz-main{color:var(--fg); font-size:14.5px}
.dz-main b{color:var(--acc); font-weight:700}
.dz-hint{color:var(--faint); font-size:12px}
.dropzone:hover, .dropzone.drag{border-color:var(--acc); background:rgba(61,255,139,.06); box-shadow:inset 0 0 40px rgba(61,255,139,.06)}
.dropzone.drag svg{transform:translateY(-4px) scale(1.1)}

/* 文件信息条 */
.file-chip{display:flex; align-items:center; gap:12px; border:1px solid var(--line2); background:#0a110d; padding:10px 14px; margin-top:12px}
.chip-badge{background:var(--acc); color:var(--acc-ink); font-size:10.5px; font-weight:700; padding:3px 8px; letter-spacing:.1em}
.chip-name{color:var(--fg); font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.chip-size{color:var(--faint); font-size:12.5px; margin-left:auto; white-space:nowrap}
.chip-remove{background:none;border:none;color:var(--dim);font-size:18px;line-height:1;padding:2px 6px}
.chip-remove:hover{color:var(--bad)}

/* 粘贴区 */
#paste-area{
  width:100%; min-height:230px; resize:vertical; background:#0a110d; border:1px solid var(--line2);
  color:var(--fg); font-family:var(--mono); font-size:13.5px; line-height:1.7; padding:14px; transition:.2s;
}
#paste-area:focus{outline:none; border-color:var(--acc); box-shadow:0 0 0 3px rgba(61,255,139,.12)}

/* 部署按钮 */
.deploy-btn{
  width:100%; margin-top:22px; padding:15px; background:var(--acc); color:var(--acc-ink);
  border:none; font-size:15px; font-weight:700; letter-spacing:.14em; transition:.18s;
  clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px));
}
.deploy-btn:hover:not(:disabled){transform:translateY(-2px); box-shadow:0 14px 34px -12px rgba(61,255,139,.5)}
.deploy-btn:active:not(:disabled){transform:translateY(0)}
.deploy-btn:disabled{background:var(--line2); color:var(--dim); cursor:wait}
.progress{height:5px; margin-top:16px; background:#0a110d; overflow:hidden; border:1px solid var(--line)}
.progress-bar{height:100%; width:40%; background:repeating-linear-gradient(90deg,var(--acc) 0 14px, transparent 14px 22px); animation:load 1s linear infinite}
@keyframes load{from{transform:translateX(-100%)}to{transform:translateX(350%)}}
.msg{margin-top:14px; font-size:13.5px; min-height:20px; color:var(--dim)}
.msg.bad{color:var(--bad)}

/* 部署结果 */
.result{margin-top:20px; border:1px solid rgba(61,255,139,.4); border-left:4px solid var(--acc); background:rgba(61,255,139,.05); padding:16px 18px; animation:rise .45s both}
.result-ok{color:var(--acc); font-weight:700; letter-spacing:.04em; margin-bottom:10px}
.result-link{display:block; font-size:15.5px; word-break:break-all; margin-bottom:14px}
.result-link:hover{text-decoration:underline}
.result-actions{display:flex; gap:10px}
.ghost-btn{background:none; border:1px solid var(--line2); color:var(--dim); padding:8px 16px; font-size:13px; transition:.2s; display:inline-block}
.ghost-btn:hover{color:var(--acc); border-color:var(--acc)}
.ghost-btn.solid{background:var(--acc); color:var(--acc-ink); border-color:var(--acc); font-weight:700}
.ghost-btn.solid:hover{box-shadow:0 8px 22px -8px rgba(61,255,139,.55)}

/* ── 站点列表 ─────────────────────── */
.list-msg{color:var(--faint); font-size:13.5px; padding:18px 4px}
.list-msg.bad{color:var(--bad)}
.site-row{
  display:grid; grid-template-columns:34px 1fr auto; gap:4px 12px; align-items:center;
  padding:13px 10px; border-bottom:1px solid var(--line); transition:.18s; border-left:2px solid transparent;
}
.site-row:last-child{border-bottom:none}
.site-row:hover{background:var(--panel2); border-left-color:var(--acc); transform:translateX(3px)}
.sr-idx{color:var(--faint); font-size:12px}
.sr-name{color:var(--fg); font-weight:700; font-size:14.5px; letter-spacing:.02em}
.sr-name:hover{color:var(--acc); text-shadow:0 0 14px rgba(61,255,139,.5)}
.sr-meta{grid-column:2; color:var(--faint); font-size:12px}
.sr-act{grid-row:1 / span 2; display:flex; gap:8px}
.sr-btn{background:none; border:1px solid var(--line2); color:var(--dim); padding:5px 11px; font-size:12px; transition:.2s}
.sr-btn:hover{color:var(--acc); border-color:var(--acc)}

/* ── 页脚 ─────────────────────────── */
footer{
  position:relative; z-index:1; max-width:1180px; margin:0 auto; padding:26px 24px 34px;
  border-top:1px solid var(--line); display:flex; justify-content:space-between; gap:16px;
  color:var(--faint); font-size:12.5px; letter-spacing:.05em;
}
noscript{display:block;padding:16px;color:var(--bad)}

@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes drop{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:none}}

@media (max-width:960px){
  .hero{grid-template-columns:1fr; gap:30px}
  .grid{grid-template-columns:1fr}
  .ticker{display:none}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
}
</style>
</head>
<body>
<header class="topbar">
  <div class="brand"><span class="brand-mark">▮▮</span>HTML-HOSTING-BAY<span class="ver">v1.0</span></div>
  <div class="ticker"><div class="ticker-inner">
    <span><b>01</b> 上传 ZIP / HTML 文件 &nbsp;→&nbsp; <b>02</b> 命名项目 &nbsp;→&nbsp; <b>03</b> 一键部署到 GITHUB &nbsp;→&nbsp; <b>04</b> 获得公开访问链接 &nbsp;→&nbsp; 文件存储于你的仓库 sites/ 目录 &nbsp;→&nbsp; WORKER 实时回源渲染 &nbsp;→&nbsp;&nbsp;</span>
    <span><b>01</b> 上传 ZIP / HTML 文件 &nbsp;→&nbsp; <b>02</b> 命名项目 &nbsp;→&nbsp; <b>03</b> 一键部署到 GITHUB &nbsp;→&nbsp; <b>04</b> 获得公开访问链接 &nbsp;→&nbsp; 文件存储于你的仓库 sites/ 目录 &nbsp;→&nbsp; WORKER 实时回源渲染 &nbsp;→&nbsp;&nbsp;</span>
  </div></div>
  <div class="status"><span class="dot"></span>WORKER ONLINE</div>
</header>

<main>
  <section class="hero">
    <div class="hero-left">
      <p class="eyebrow">// SELF-SERVICE STATIC HOSTING · CLOUDFLARE WORKERS × GITHUB</p>
      <h1 class="title"><span class="t-outline">HTML</span><br>托管舱<span class="cursor"></span></h1>
      <p class="lead">上传一个包含 <b>index.html</b> 的 ZIP 压缩包、单个 HTML 文件，或直接粘贴代码 —— 数秒内获得可公开访问的 HTTPS 链接。文件存储于你的 GitHub 仓库，Worker 实时回源渲染，无需任何服务器。</p>
      <ol class="steps">
        <li><i>01</i>选择文件</li>
        <li><i>02</i>命名项目</li>
        <li><i>03</i>一键部署</li>
        <li><i>04</i>获取链接</li>
      </ol>
    </div>
    <div class="hero-right">
      <div class="term">
        <div class="term-bar"><span></span><span></span><span></span><em>deploy.log</em></div>
        <pre><span class="c-dim">$</span> bay deploy --name my-site
<span class="c-dim">→</span> 打包 4 个文件 …
<span class="c-dim">→</span> 写入 sites/my-site/
<span class="c-ok">✔</span> 部署完成
<span class="c-link">https://bay.workers.dev/my-site/</span><span class="cursor2"></span></pre>
      </div>
    </div>
  </section>

  <div id="banner" class="banner hidden"></div>

  <section class="grid">
    <div class="panel" id="panel-upload">
      <div class="panel-head"><h2>部署控制台</h2><span class="tag">DEPLOY</span></div>
      <div class="panel-body">
        <div class="tabs">
          <button type="button" class="tab active" id="tab-file">文件上传</button>
          <button type="button" class="tab" id="tab-paste">粘贴代码</button>
        </div>

        <label class="field-label" for="name-input">项目名 · SITE NAME</label>
        <div class="name-row">
          <input id="name-input" type="text" spellcheck="false" autocomplete="off" placeholder="my-site" maxlength="40">
          <span id="name-status" class="name-status">小写字母 / 数字 / 连字符 · 1-40 位</span>
        </div>

        <div id="pane-file">
          <label id="dropzone" class="dropzone" for="file-input">
            <input id="file-input" type="file" accept=".zip,.html,.htm" hidden>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#3dff8b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3m0 0L7 8m5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
            <p class="dz-main">拖拽 <b>ZIP / HTML</b> 到这里，或点击选择文件</p>
            <p class="dz-hint">ZIP 内须包含 index.html · 单文件 ≤ 10MB · 项目总量 ≤ 20MB · ≤ 200 个文件</p>
          </label>
          <div id="file-chip" class="file-chip hidden">
            <span class="chip-badge" id="chip-badge">ZIP</span>
            <span class="chip-name" id="chip-name"></span>
            <span class="chip-size" id="chip-size"></span>
            <button type="button" id="chip-remove" class="chip-remove" title="移除文件">×</button>
          </div>
        </div>

        <div id="pane-paste" class="hidden">
          <textarea id="paste-area" spellcheck="false" placeholder="&lt;!DOCTYPE html&gt;&#10;&lt;html&gt;&lt;body&gt;&#10;  &lt;h1&gt;Hello, 托管舱&lt;/h1&gt;&#10;&lt;/body&gt;&lt;/html&gt;"></textarea>
        </div>

        <button id="deploy-btn" class="deploy-btn" type="button">▣ 部署到 GITHUB</button>
        <div id="progress" class="progress hidden"><div class="progress-bar"></div></div>
        <p id="msg" class="msg"></p>

        <div id="result" class="result hidden">
          <p class="result-ok">✔ 部署完成 · 站点已上线</p>
          <a id="result-link" class="result-link" target="_blank" rel="noopener"></a>
          <div class="result-actions">
            <button type="button" id="copy-btn" class="ghost-btn">复制链接</button>
            <a id="open-btn" class="ghost-btn solid" target="_blank" rel="noopener">访问站点 ↗</a>
          </div>
        </div>
      </div>
    </div>

    <div class="panel" id="panel-list">
      <div class="panel-head">
        <h2>机位清单</h2><span class="tag alt">SITES</span>
        <span id="site-count" class="count">—</span>
        <button type="button" id="refresh-btn" class="refresh" title="刷新列表">↻</button>
      </div>
      <div class="panel-body">
        <div id="list"></div>
        <div id="list-msg" class="list-msg">载入中 …</div>
      </div>
    </div>
  </section>
</main>

<footer>
  <span>HTML 托管舱 · CLOUDFLARE WORKERS × GITHUB STORAGE</span>
  <a href="/api/health">/api/health</a>
</footer>
<noscript>需要启用 JavaScript 才能使用托管舱控制台。</noscript>

<script>
(function(){
'use strict';
var NAME_RE = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;
var takenNames = [];
var currentFile = null;
var tab = 'file';
var busy = false;
var $ = function(id){ return document.getElementById(id); };

function fmtBytes(n){
  if(!n) return '0 B';
  var u = ['B','KB','MB','GB'], i = 0;
  while(n >= 1024 && i < u.length - 1){ n /= 1024; i++; }
  return (i === 0 ? n : Math.round(n * 10) / 10) + ' ' + u[i];
}
function setMsg(text, cls){
  var m = $('msg');
  m.textContent = text || '';
  m.className = 'msg' + (text ? ' ' + (cls || '') : '');
}
function setBanner(text){
  var b = $('banner');
  if(!text){ b.classList.add('hidden'); return; }
  b.textContent = text;
  b.classList.remove('hidden');
}
function copyText(text, btn){
  var done = function(){
    var o = btn.textContent;
    btn.textContent = '已复制 ✔';
    setTimeout(function(){ btn.textContent = o; }, 1200);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done, done);
  } else {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); }catch(e){}
    ta.remove(); done();
  }
}

/* Tabs */
function switchTab(t){
  tab = t;
  $('tab-file').classList.toggle('active', t === 'file');
  $('tab-paste').classList.toggle('active', t === 'paste');
  $('pane-file').classList.toggle('hidden', t !== 'file');
  $('pane-paste').classList.toggle('hidden', t !== 'paste');
  if(t === 'paste') $('paste-area').focus();
}
$('tab-file').onclick = function(){ switchTab('file'); };
$('tab-paste').onclick = function(){ switchTab('paste'); };

/* 拖放区 */
var dz = $('dropzone'), fi = $('file-input');
function setFile(f){
  if(!f){ currentFile = null; $('file-chip').classList.add('hidden'); return; }
  var n = (f.name || '').toLowerCase();
  if(!(n.endsWith('.zip') || n.endsWith('.html') || n.endsWith('.htm'))){
    setMsg('仅支持 .zip / .html / .htm 文件', 'bad'); return;
  }
  currentFile = f;
  $('chip-badge').textContent = n.endsWith('.zip') ? 'ZIP' : 'HTML';
  $('chip-name').textContent = f.name || '(未命名文件)';
  $('chip-size').textContent = fmtBytes(f.size);
  $('file-chip').classList.remove('hidden');
  setMsg('');
}
fi.onchange = function(){ setFile(this.files[0]); };
$('chip-remove').onclick = function(){ currentFile = null; fi.value = ''; $('file-chip').classList.add('hidden'); };
['dragenter','dragover'].forEach(function(ev){
  dz.addEventListener(ev, function(e){ e.preventDefault(); dz.classList.add('drag'); });
});
['dragleave','drop'].forEach(function(ev){
  dz.addEventListener(ev, function(e){ e.preventDefault(); dz.classList.remove('drag'); });
});
dz.addEventListener('drop', function(e){
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if(f) setFile(f);
});

/* 项目名即时校验 */
var nameTimer = null;
$('name-input').addEventListener('input', function(){
  var v = this.value.trim().toLowerCase();
  this.value = v;
  clearTimeout(nameTimer);
  nameTimer = setTimeout(function(){
    var s = $('name-status');
    if(!v){ s.textContent = '小写字母 / 数字 / 连字符 · 1-40 位'; s.className = 'name-status'; return; }
    if(!NAME_RE.test(v)){ s.textContent = '✗ 格式不合法'; s.className = 'name-status bad'; return; }
    if(v === 'api'){ s.textContent = '✗ 系统保留名称'; s.className = 'name-status bad'; return; }
    if(takenNames.indexOf(v) >= 0){ s.textContent = '✗ 名称已被占用'; s.className = 'name-status bad'; return; }
    s.textContent = '✓ 名称可用'; s.className = 'name-status ok';
  }, 150);
});

/* 部署 */
$('deploy-btn').onclick = deploy;
function deploy(){
  if(busy) return;
  var name = $('name-input').value.trim().toLowerCase();
  if(!NAME_RE.test(name)){ setMsg('请先填写合法的项目名', 'bad'); return; }
  if(takenNames.indexOf(name) >= 0){ setMsg('项目名 "' + name + '" 已被占用，请更换', 'bad'); return; }

  var opts;
  if(tab === 'file'){
    if(!currentFile){ setMsg('请先选择 ZIP 或 HTML 文件', 'bad'); return; }
    var fd = new FormData();
    fd.append('name', name);
    fd.append('file', currentFile);
    opts = { method: 'POST', body: fd };
  } else {
    var html = $('paste-area').value || '';
    if(!html.trim()){ setMsg('请先粘贴 HTML 内容', 'bad'); return; }
    opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, html: html }) };
  }

  busy = true;
  var btn = $('deploy-btn');
  btn.disabled = true; btn.textContent = '▮▮ 部署中 …';
  $('progress').classList.remove('hidden');
  $('result').classList.add('hidden');
  setMsg('');

  fetch('/api/upload', opts)
    .then(function(r){
      return r.json().then(function(j){ j._status = r.status; return j; })
        .catch(function(){ return { ok: false, error: 'HTTP ' + r.status }; });
    })
    .then(function(j){
      if(j.ok){
        var link = location.origin + j.url;
        $('result-link').textContent = link;
        $('result-link').href = link;
        $('open-btn').href = link;
        $('result').classList.remove('hidden');
        setMsg('');
        if(takenNames.indexOf(j.name) < 0) takenNames.push(j.name);
        loadSites();
      } else {
        setMsg('部署失败：' + (j.error || 'HTTP ' + j._status), 'bad');
      }
    })
    .catch(function(e){ setMsg('网络错误：' + e.message, 'bad'); })
    .finally(function(){
      busy = false;
      btn.disabled = false; btn.textContent = '▣ 部署到 GITHUB';
      $('progress').classList.add('hidden');
    });
}

/* 复制链接 */
$('copy-btn').onclick = function(){ copyText($('result-link').textContent, this); };

/* 站点列表 */
function row(s, i){
  var el = document.createElement('div'); el.className = 'site-row';
  var idx = document.createElement('span'); idx.className = 'sr-idx';
  idx.textContent = String(i + 1).padStart(2, '0');
  var nm = document.createElement('a'); nm.className = 'sr-name';
  nm.href = '/' + s.name + '/'; nm.target = '_blank'; nm.rel = 'noopener'; nm.textContent = s.name;
  var meta = document.createElement('span'); meta.className = 'sr-meta';
  meta.textContent = s.files + ' 个文件 · ' + fmtBytes(s.size);
  var act = document.createElement('span'); act.className = 'sr-act';
  var cp = document.createElement('button'); cp.type = 'button'; cp.className = 'sr-btn'; cp.textContent = '复制';
  cp.onclick = function(){ copyText(location.origin + '/' + s.name + '/', cp); };
  var go = document.createElement('a'); go.className = 'sr-btn'; go.href = '/' + s.name + '/';
  go.target = '_blank'; go.rel = 'noopener'; go.textContent = '访问 ↗';
  act.appendChild(cp); act.appendChild(go);
  el.appendChild(idx); el.appendChild(nm); el.appendChild(act); el.appendChild(meta);
  return el;
}
function loadSites(){
  var rb = $('refresh-btn');
  rb.classList.add('spin');
  fetch('/api/sites')
    .then(function(r){ return r.json(); })
    .then(function(j){
      rb.classList.remove('spin');
      if(!j.ok){
        $('list').innerHTML = '';
        $('list-msg').textContent = '加载失败：' + (j.error || '');
        $('list-msg').className = 'list-msg bad';
        return;
      }
      if(j.warning) setBanner(j.warning);
      var sites = j.sites || [];
      takenNames = sites.map(function(s){ return s.name; });
      $('site-count').textContent = String(sites.length).padStart(2, '0');
      var list = $('list');
      list.innerHTML = '';
      if(!sites.length){
        $('list-msg').textContent = '机位空空如也 —— 部署第一个站点吧';
        $('list-msg').className = 'list-msg';
        return;
      }
      $('list-msg').className = 'list-msg hidden';
      sites.forEach(function(s, i){ list.appendChild(row(s, i)); });
    })
    .catch(function(e){
      rb.classList.remove('spin');
      $('list-msg').textContent = '加载失败：' + e.message;
      $('list-msg').className = 'list-msg bad';
    });
}
$('refresh-btn').onclick = loadSites;

/* 健康检查（配置提示） */
fetch('/api/health')
  .then(function(r){ return r.json(); })
  .then(function(j){
    if(j && j.configured === false){
      setBanner('环境变量未配置：' + (j.missing || []).join(', ') + ' —— 请在 wrangler.toml 的 [vars] 与 wrangler secret 中设置后重新部署');
    } else if(j && j.token_valid === false){
      setBanner('GH_TOKEN 校验失败：' + (j.detail || '无效或权限不足'));
    }
  })
  .catch(function(){});

loadSites();
})();
</script>
</body>
</html>`;
