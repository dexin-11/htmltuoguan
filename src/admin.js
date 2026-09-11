// 管理后台页面（苹果风格 · 与主控制台一致）
// 注意：本文件整体使用模板字符串，内部 HTML/CSS/JS 一律不使用反引号与 ${}

export const ADMIN_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>管理后台 · 网页托管舱</title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230071e3'/%3E%3Cpath d='M32 44V24m0 0-8 8m8-8 8 8' stroke='%23fff' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<style>
:root{
  --bg:#f5f5f7; --card:#ffffff; --text:#1d1d1f; --text2:#6e6e73; --text3:#86868b;
  --blue:#0071e3; --blue-deep:#0068d0; --blue-soft:rgba(0,113,227,.08);
  --green:#34c759; --green-deep:#248a3d; --red:#ff3b30; --red-deep:#c22b21; --red-soft:rgba(255,59,48,.08);
  --fill:rgba(118,118,128,.08); --fill-2:rgba(118,118,128,.16);
  --line:#e8e8ed; --shadow:0 4px 24px rgba(0,0,0,.06);
  --r-lg:24px; --r-md:16px; --r-sm:10px;
  --font:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased;min-height:100vh}
::selection{background:rgba(0,113,227,.2)}
a{color:var(--blue);text-decoration:none}a:hover{text-decoration:underline}
button{font-family:inherit;cursor:pointer;border:none;background:none;font-size:inherit;color:inherit}
:focus-visible{outline:3px solid rgba(0,113,227,.4);outline-offset:2px;border-radius:8px}
.hidden{display:none!important}
.nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.72);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border-bottom:.5px solid rgba(0,0,0,.08)}
.nav-inner{max-width:1120px;margin:0 auto;padding:0 22px;height:56px;display:flex;align-items:center;gap:10px}
.logo{display:flex;align-items:center;gap:10px;font-weight:600;font-size:17px}
.logo-badge{width:30px;height:30px;border-radius:8px;background:var(--blue);display:grid;place-items:center}
.nav-right{margin-left:auto;display:flex;align-items:center;gap:16px}
.nav-link{font-size:13px;color:var(--text2)}
.nav-link:hover{color:var(--blue);text-decoration:none}
.page{max-width:1120px;margin:0 auto;padding:32px 22px 72px}

/* 登录卡片 */
.login-wrap{display:grid;place-items:center;min-height:calc(100vh - 56px);padding:32px 22px}
.login{width:100%;max-width:380px;background:var(--card);border-radius:var(--r-lg);box-shadow:var(--shadow);padding:40px 34px;text-align:center;animation:fadeUp .5s both}
.lock{
  width:56px;height:56px;border-radius:50%;background:var(--blue-soft);display:grid;place-items:center;margin:0 auto 18px;
}
.login h1{font-size:22px;font-weight:700;letter-spacing:-.02em}
.login p{font-size:13.5px;color:var(--text2);margin:8px 0 24px}
.pw-input{
  width:100%;background:var(--fill);border:1.5px solid transparent;border-radius:var(--r-sm);
  padding:13px 15px;font-family:inherit;font-size:16px;transition:all .2s;text-align:center;
}
.pw-input::placeholder{color:#b0b0b5}
.pw-input:focus{outline:none;background:#fff;border-color:var(--blue);box-shadow:0 0 0 4px rgba(0,113,227,.12)}
.unlock-btn{
  width:100%;margin-top:14px;background:var(--blue);color:#fff;font-size:16px;font-weight:600;
  padding:13px;border-radius:980px;transition:all .2s;box-shadow:0 6px 18px rgba(0,113,227,.28);
}
.unlock-btn:hover{background:var(--blue-deep);transform:scale(1.015)}
.unlock-btn:disabled{opacity:.55;cursor:wait;box-shadow:none}
.login-err{margin-top:14px;font-size:13px;color:var(--red);min-height:18px}
.login-hint{margin-top:22px;font-size:12px;color:var(--text3);line-height:1.5}

/* 面板 */
.admin-head{display:flex;align-items:center;gap:14px;margin-bottom:26px;animation:fadeUp .4s both}
.admin-head h1{font-size:28px;font-weight:700;letter-spacing:-.02em}
.admin-head .sub{color:var(--text2);font-size:14px;margin-top:2px}
.logout-btn{margin-left:auto;background:var(--fill);color:var(--text);font-size:13.5px;font-weight:500;padding:9px 18px;border-radius:980px;transition:all .2s}
.logout-btn:hover{background:var(--fill-2)}
.banner{display:flex;gap:10px;align-items:flex-start;background:rgba(255,149,0,.12);color:#b25f00;border-radius:var(--r-md);padding:13px 16px;font-size:13.5px;margin-bottom:22px;line-height:1.55;animation:fadeUp .4s both}
.grid{display:grid;grid-template-columns:7fr 5fr;gap:22px;align-items:start}
.card{background:var(--card);border-radius:var(--r-lg);box-shadow:var(--shadow);padding:26px 24px;animation:fadeUp .45s both}
.card-head{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.card-title{font-size:19px;font-weight:700;letter-spacing:-.02em}
.pill{background:var(--fill);color:var(--text2);font-size:12.5px;font-weight:600;border-radius:980px;padding:2px 10px}
.card-sub{font-size:13px;color:var(--text3);margin-bottom:16px}

/* 表格 */
.tbl{width:100%;border-collapse:collapse;font-size:13.5px}
.tbl th{text-align:left;font-weight:600;color:var(--text2);font-size:12px;letter-spacing:.04em;padding:8px 10px;border-bottom:.5px solid var(--line);white-space:nowrap}
.tbl td{padding:11px 10px;border-bottom:.5px solid var(--line);vertical-align:middle}
.tbl tr:last-child td{border-bottom:none}
.tbl tr:hover td{background:var(--fill)}
.mono{font-family:var(--mono);font-size:12.5px}
.name-cell{font-weight:600;font-size:14px;color:var(--text)}
.exp-cell{font-size:12.5px;color:var(--text2)}
.exp-cell.bad{color:var(--red)}
.ip-cell{font-family:var(--mono);font-size:12.5px;color:var(--text2)}
.ip-cell .none{color:var(--text3)}
.row-actions{display:flex;gap:6px;flex-wrap:nowrap}
.mini-btn{font-size:12px;font-weight:600;padding:6px 11px;border-radius:980px;transition:all .18s;white-space:nowrap;display:inline-flex;align-items:center;gap:4px}
.mini-btn.blue{background:var(--blue-soft);color:var(--blue)}
.mini-btn.blue:hover{background:rgba(0,113,227,.16)}
.mini-btn.green{background:rgba(52,199,89,.14);color:var(--green-deep)}
.mini-btn.green:hover{background:rgba(52,199,89,.22)}
.mini-btn.red{background:var(--red-soft);color:var(--red-deep)}
.mini-btn.red:hover{background:rgba(255,59,48,.16)}
.mini-btn:disabled{opacity:.5;cursor:wait}

/* 黑名单 */
.bl-add{display:grid;grid-template-columns:1fr 120px auto;gap:8px;margin-bottom:18px}
.bl-input{background:var(--fill);border:1.5px solid transparent;border-radius:var(--r-sm);padding:10px 12px;font-family:var(--mono);font-size:13px;transition:all .2s}
.bl-input:focus{outline:none;background:#fff;border-color:var(--blue);box-shadow:0 0 0 4px rgba(0,113,227,.12)}
.add-btn{background:var(--blue);color:#fff;font-weight:600;font-size:13px;padding:10px 16px;border-radius:980px;transition:all .2s}
.add-btn:hover{background:var(--blue-deep)}
.add-btn:disabled{opacity:.5;cursor:wait}
.bl-row{display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:.5px solid var(--line)}
.bl-row:last-child{border-bottom:none}
.bl-ip{font-family:var(--mono);font-size:13.5px;font-weight:600}
.bl-note{color:var(--text3);font-size:12.5px}
.bl-time{color:var(--text3);font-size:12px;margin-left:auto;white-space:nowrap}
.bl-remove{color:var(--text3);font-size:11.5px;font-weight:600;transition:color .18s;white-space:nowrap}
.bl-remove:hover{color:var(--red)}
.empty{text-align:center;padding:30px 14px;color:var(--text3);font-size:13.5px;border:1.5px dashed #c7c7cc;border-radius:var(--r-md)}
.loading{text-align:center;padding:30px;color:var(--text3);font-size:14px}
.msg{margin-top:14px;font-size:13.5px;border-radius:var(--r-sm);padding:11px 14px;display:none}
.msg.show{display:block}
.msg.err{background:var(--red-soft);color:var(--red-deep)}
.msg.ok{background:rgba(52,199,89,.12);color:var(--green-deep)}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
@media (max-width:900px){
  .grid{grid-template-columns:1fr}
  .bl-add{grid-template-columns:1fr;grid-template-rows:auto auto auto}
  .tbl{font-size:12.5px}
  .tbl .hide-sm{display:none}
}
</style>
</head>
<body>
<nav class="nav">
  <div class="nav-inner">
    <div class="logo">
      <span class="logo-badge">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 7.5v9L12 21l8-4.5v-9Z"/><path d="M12 12v9M4 7.5l8 4.5 8-4.5"/></svg>
      </span>
      网页托管舱 · 管理后台
    </div>
    <div class="nav-right">
      <a class="nav-link" href="/">← 返回控制台</a>
    </div>
  </div>
</nav>

<!-- 登录 -->
<div class="login-wrap" id="login-wrap">
  <form class="login" id="login-form">
    <span class="lock">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0071e3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
    </span>
    <h1>管理员登录</h1>
    <p>输入管理密码以查看、续期、删除站点并管理 IP 黑名单。</p>
    <input type="password" class="pw-input" id="pw" placeholder="管理密码" autocomplete="current-password" autofocus>
    <button type="submit" class="unlock-btn" id="unlock-btn">解锁后台</button>
    <p class="login-err" id="login-err"></p>
    <p class="login-hint">密码由部署者在环境变量 ADMIN_PASSWORD 中设置，不会随页面传输保存。</p>
  </form>
</div>

<!-- 管理面板 -->
<div class="page hidden" id="panel">
  <div class="admin-head">
    <div>
      <h1>管理后台</h1>
      <div class="sub">站点部署与访问控制</div>
    </div>
    <button class="logout-btn" id="logout-btn">退出登录</button>
  </div>
  <div class="banner hidden" id="banner"></div>

  <div class="grid">
    <section class="card">
      <div class="card-head"><h2 class="card-title">站点管理</h2><span class="pill" id="site-count">–</span></div>
      <p class="card-sub">查看每个站点的上传来源，可一键续期或删除。</p>
      <div id="sites-loading" class="loading">加载中…</div>
      <div id="sites-wrap" class="hidden" style="overflow-x:auto">
        <table class="tbl">
          <thead><tr>
            <th>项目</th><th>文件</th><th class="hide-sm">大小</th>
            <th>上传 IP</th><th>有效期</th><th>操作</th>
          </tr></thead>
          <tbody id="sites-tbody"></tbody>
        </table>
      </div>
      <div id="sites-empty" class="empty hidden">还没有任何已发布的站点。</div>
      <div class="msg" id="sites-msg" role="alert"></div>
    </section>

    <section class="card">
      <div class="card-head"><h2 class="card-title">IP 黑名单</h2><span class="pill" id="bl-count">0</span></div>
      <p class="card-sub">被拉黑的 IP 将无法再发布任何站点。</p>
      <div class="bl-add">
        <input class="bl-input" id="bl-ip" placeholder="IP 地址，如 203.0.113.7" spellcheck="false">
        <input class="bl-input" id="bl-note" placeholder="备注（可选）">
        <button class="add-btn" id="bl-add-btn">拉黑</button>
      </div>
      <div id="bl-list"></div>
      <div id="bl-empty" class="empty hidden">黑名单为空。</div>
      <div class="msg" id="bl-msg" role="alert"></div>
    </section>
  </div>
</div>

<script>
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
var TOKEN_KEY = 'bay_admin_token';
var token = sessionStorage.getItem(TOKEN_KEY) || '';

function api(path, opts){
  opts = opts || {};
  opts.headers = opts.headers || {};
  opts.headers['X-Admin-Token'] = token;
  return fetch(path, opts);
}
function showMsg(el, text, cls){
  el.textContent = text || '';
  el.className = 'msg' + (cls ? ' show ' + cls : '');
}
function fmtBytes(n){
  if(!n) return '0 B';
  var u = ['B','KB','MB','GB'], i = 0;
  while(n >= 1024 && i < u.length - 1){ n /= 1024; i++; }
  return (i === 0 ? n : Math.round(n * 10) / 10) + ' ' + u[i];
}
function fmtDate(ts){
  if(!ts) return '永久';
  var d = new Date(ts);
  var p = function(x){ return String(x).padStart(2, '0'); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function expiryText(s){
  if(!s.expire_at) return '永久';
  var ms = s.expire_at - Date.now();
  if(ms <= 0) return '已过期';
  var days = Math.ceil(ms / 86400000);
  return '剩 ' + days + ' 天 · ' + fmtDate(s.expire_at);
}
function esc(s){
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── 登录 ── */
function unlock(){
  var pw = $('pw').value;
  if(!pw){ $('login-err').textContent = '请输入管理密码'; return; }
  var btn = $('unlock-btn');
  btn.disabled = true; btn.textContent = '验证中…';
  token = pw;
  api('/api/admin/sites')
    .then(function(r){ return r.json().then(function(j){ j._status = r.status; return j; }); })
    .then(function(j){
      if(j.ok){
        sessionStorage.setItem(TOKEN_KEY, token);
        $('login-wrap').classList.add('hidden');
        $('panel').classList.remove('hidden');
        loadSites(); loadBlacklist();
      } else {
        $('login-err').textContent = (j._status === 401) ? '密码错误，请重试。' : (j.error || '无法连接后台，请稍后再试。');
        token = sessionStorage.getItem(TOKEN_KEY) || '';
      }
    })
    .catch(function(){ $('login-err').textContent = '网络错误，请稍后再试。'; })
    .finally(function(){ btn.disabled = false; btn.textContent = '解锁后台'; });
}
$('login-form').addEventListener('submit', function(e){ e.preventDefault(); unlock(); });

/* ── 站点管理 ── */
function siteRow(s){
  var tr = document.createElement('tr');
  var cls = (s.expire_at && s.expire_at <= Date.now()) ? 'bad' : '';
  var btn = function(label, cls2, fn){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'mini-btn ' + cls2; b.textContent = label;
    b.onclick = function(){ b.disabled = true; fn(b); };
    return b;
  };
  tr.innerHTML =
    '<td class="name-cell">' + esc(s.name) + '</td>' +
    '<td>' + s.files + '</td>' +
    '<td class="hide-sm">' + fmtBytes(s.size) + '</td>' +
    '<td class="ip-cell">' + (s.uploader_ip ? esc(s.uploader_ip) : '<span class="none">—</span>') + '</td>' +
    '<td class="exp-cell ' + cls + '">' + expiryText(s) + '</td>' +
    '<td><div class="row-actions">' +
      '<button type="button" class="mini-btn blue" data-act="renew7">+7 天</button>' +
      '<button type="button" class="mini-btn blue" data-act="renew30">+30 天</button>' +
      '<button type="button" class="mini-btn red" data-act="del">删除</button>' +
    '</div></td>';

  tr.querySelector('[data-act=renew7]').onclick = function(){ renewSite(s.name, 7, this); };
  tr.querySelector('[data-act=renew30]').onclick = function(){ renewSite(s.name, 30, this); };
  tr.querySelector('[data-act=del]').onclick = function(){
    if(!confirm('确定删除站点 "' + s.name + '"？该操作会移除仓库中的全部文件，且不可恢复。')){ return; }
    this.disabled = true;
    api('/api/admin/sites/' + encodeURIComponent(s.name), { method: 'DELETE' })
      .then(function(r){ return r.json().then(function(j){ j._status = r.status; return j; }); })
      .then(function(j){
        if(j.ok){ showMsg($('sites-msg'), '已删除站点 ' + s.name, 'ok'); loadSites(); }
        else showMsg($('sites-msg'), '删除失败：' + (j.error || j._status), 'err');
      })
      .catch(function(e){ showMsg($('sites-msg'), '删除失败：' + e.message, 'err'); });
  };
  return tr;
}
function renewSite(name, days, btn){
  api('/api/admin/sites/' + encodeURIComponent(name) + '/renew', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days: days })
  })
    .then(function(r){ return r.json().then(function(j){ j._status = r.status; return j; }); })
    .then(function(j){
      if(j.ok){ showMsg($('sites-msg'), '已为 ' + name + ' 续期 ' + days + ' 天', 'ok'); loadSites(); }
      else showMsg($('sites-msg'), '续期失败：' + (j.error || j._status), 'err');
    })
    .catch(function(e){ showMsg($('sites-msg'), '续期失败：' + e.message, 'err'); })
    .finally(function(){ if(btn){ btn.disabled = false; } });
}
function loadSites(){
  $('sites-loading').classList.remove('hidden');
  $('sites-wrap').classList.add('hidden');
  $('sites-empty').classList.add('hidden');
  api('/api/admin/sites')
    .then(function(r){ return r.json().then(function(j){ j._status = r.status; return j; }); })
    .then(function(j){
      $('sites-loading').classList.add('hidden');
      if(!j.ok){ showMsg($('sites-msg'), '加载失败：' + (j.error || j._status), 'err'); return; }
      var sites = j.sites || [];
      $('site-count').textContent = String(sites.length);
      var tb = $('sites-tbody');
      tb.innerHTML = '';
      if(!sites.length){ $('sites-empty').classList.remove('hidden'); return; }
      $('sites-wrap').classList.remove('hidden');
      sites.forEach(function(s){ tb.appendChild(siteRow(s)); });
    })
    .catch(function(e){
      $('sites-loading').classList.add('hidden');
      showMsg($('sites-msg'), '加载失败：' + e.message, 'err');
    });
}

/* ── 黑名单 ── */
function blRow(e){
  var div = document.createElement('div'); div.className = 'bl-row';
  var info = document.createElement('div'); info.style.flex = '1'; info.style.minWidth = '0';
  var ip = document.createElement('div'); ip.className = 'bl-ip'; ip.textContent = e.ip;
  var note = document.createElement('div'); note.className = 'bl-note'; note.textContent = e.note || '—';
  info.appendChild(ip); info.appendChild(note);
  var time = document.createElement('span'); time.className = 'bl-time'; time.textContent = fmtDate(e.added_at);
  var rm = document.createElement('button'); rm.type = 'button'; rm.className = 'bl-remove'; rm.textContent = '移除';
  rm.onclick = function(){
    rm.disabled = true;
    api('/api/admin/blacklist/' + encodeURIComponent(e.ip), { method: 'DELETE' })
      .then(function(r){ return r.json().then(function(j){ j._status = r.status; return j; }); })
      .then(function(j){
        if(j.ok){ showMsg($('bl-msg'), '已移除 ' + e.ip, 'ok'); loadBlacklist(); }
        else showMsg($('bl-msg'), '移除失败：' + (j.error || j._status), 'err');
      })
      .catch(function(e2){ showMsg($('bl-msg'), '移除失败：' + e2.message, 'err'); });
  };
  div.appendChild(info); div.appendChild(time); div.appendChild(rm);
  return div;
}
function loadBlacklist(){
  api('/api/admin/blacklist')
    .then(function(r){ return r.json().then(function(j){ j._status = r.status; return j; }); })
    .then(function(j){
      if(!j.ok){ showMsg($('bl-msg'), '加载失败：' + (j.error || j._status), 'err'); return; }
      var entries = j.entries || [];
      $('bl-count').textContent = String(entries.length);
      var list = $('bl-list');
      list.innerHTML = '';
      $('bl-empty').classList.toggle('hidden', entries.length > 0);
      entries.forEach(function(e){ list.appendChild(blRow(e)); });
    })
    .catch(function(e){ showMsg($('bl-msg'), '加载失败：' + e.message, 'err'); });
}
$('bl-add-btn').onclick = function(){
  var ip = $('bl-ip').value.trim();
  var note = $('bl-note').value.trim();
  if(!ip){ showMsg($('bl-msg'), '请填写要拉黑的 IP 地址', 'err'); return; }
  var btn = this; btn.disabled = true;
  api('/api/admin/blacklist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip: ip, note: note })
  })
    .then(function(r){ return r.json().then(function(j){ j._status = r.status; return j; }); })
    .then(function(j){
      if(j.ok){
        showMsg($('bl-msg'), '已将 ' + j.ip + ' 加入黑名单', 'ok');
        $('bl-ip').value = ''; $('bl-note').value = '';
        loadBlacklist();
      } else showMsg($('bl-msg'), '操作失败：' + (j.error || j._status), 'err');
    })
    .catch(function(e){ showMsg($('bl-msg'), '操作失败：' + e.message, 'err'); })
    .finally(function(){ btn.disabled = false; });
};

/* ── 退出 ── */
$('logout-btn').onclick = function(){
  sessionStorage.removeItem(TOKEN_KEY);
  token = '';
  $('panel').classList.add('hidden');
  $('login-wrap').classList.remove('hidden');
  $('pw').value = '';
};

/* ── 自动解锁（已保存密码）── */
if(token){
  api('/api/admin/sites')
    .then(function(r){ return r.json().then(function(j){ j._status = r.status; return j; }); })
    .then(function(j){
      if(j.ok){
        $('login-wrap').classList.add('hidden');
        $('panel').classList.remove('hidden');
        loadSites(); loadBlacklist();
      } else {
        sessionStorage.removeItem(TOKEN_KEY);
        token = '';
      }
    })
    .catch(function(){});
}
})();
</script>
</body>
</html>`;
