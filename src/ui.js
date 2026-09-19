// 图形化控制台页面（苹果风格 · 新手友好）
// 注意：本文件整体使用模板字符串，内部 HTML/CSS/JS 一律不使用反引号与 ${}

export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0071e3"/><path d="M32 44V24m0 0-8 8m8-8 8 8" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 46h24" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".9"/></svg>`;

export const UI_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>网页托管舱 · 三步发布你的网页</title>
<meta name="description" content="上传 HTML 或 ZIP 文件，几秒钟获得一个任何人都能访问的公开网址。">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230071e3'/%3E%3Cpath d='M32 44V24m0 0-8 8m8-8 8 8' stroke='%23fff' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<style>
/* ── 设计令牌：苹果风浅色调 ─────────────────── */
:root{
  --bg:#f5f5f7;          /* 页面浅灰 */
  --card:#ffffff;        /* 卡片白 */
  --text:#1d1d1f;        /* 主文字 */
  --text2:#6e6e73;       /* 次级文字 */
  --text3:#86868b;       /* 弱化文字 */
  --blue:#0071e3;        /* 苹果蓝 */
  --blue-deep:#0068d0;
  --blue-soft:rgba(0,113,227,.08);
  --green:#34c759;
  --green-deep:#248a3d;
  --red:#ff3b30;
  --red-soft:rgba(255,59,48,.08);
  --orange:#b25f00;
  --orange-soft:rgba(255,149,0,.12);
  --fill:rgba(118,118,128,.08);   /* 输入框灰底 */
  --fill-2:rgba(118,118,128,.12); /* 分段控件轨道 */
  --line:#e8e8ed;
  --shadow:0 4px 24px rgba(0,0,0,.06);
  --shadow-lg:0 12px 40px rgba(0,0,0,.1);
  --r-lg:24px; --r-md:16px; --r-sm:10px;
  --font:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{
  font-family:var(--font); background:var(--bg); color:var(--text);
  font-size:17px; line-height:1.6; letter-spacing:.01em;
  -webkit-font-smoothing:antialiased; min-height:100vh;
}
::selection{background:rgba(0,113,227,.2)}
a{color:var(--blue);text-decoration:none}
a:hover{text-decoration:underline}
button{font-family:inherit;cursor:pointer;border:none;background:none;font-size:inherit;color:inherit}
:focus-visible{outline:3px solid rgba(0,113,227,.4);outline-offset:2px;border-radius:8px}
.hidden{display:none!important}

/* ── 顶部导航：毛玻璃 ─────────────────────── */
.nav{
  position:sticky; top:0; z-index:50;
  background:rgba(255,255,255,.72); backdrop-filter:saturate(180%) blur(20px);
  -webkit-backdrop-filter:saturate(180%) blur(20px);
  border-bottom:.5px solid rgba(0,0,0,.08);
}
.nav-inner{max-width:1080px;margin:0 auto;padding:0 22px;height:56px;display:flex;align-items:center;gap:10px}
.logo{display:flex;align-items:center;gap:10px;font-weight:600;font-size:17px;letter-spacing:-.01em}
.logo-badge{width:30px;height:30px;border-radius:8px;background:var(--blue);display:grid;place-items:center;flex:none}
.nav-right{margin-left:auto;display:flex;align-items:center;gap:16px}
.nav-status{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--text2)}
.status-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 3px rgba(52,199,89,.18)}

/* ── 页面骨架 ─────────────────────────────── */
.page{max-width:1080px;margin:0 auto;padding:0 22px}
.hero{text-align:center;padding:72px 0 48px;animation:fadeUp .7s cubic-bezier(.2,.7,.3,1) both}
.hero h1{
  font-size:clamp(34px,5.4vw,58px); font-weight:700; letter-spacing:-.025em; line-height:1.1;
  background:linear-gradient(180deg,#1d1d1f 60%,#4b4b50); -webkit-background-clip:text; background-clip:text; color:transparent;
}
.hero p{margin:20px auto 0;max-width:560px;font-size:19px;color:var(--text2);line-height:1.55}

/* 三步引导 */
.steps{
  display:grid; grid-template-columns:repeat(3,1fr); gap:14px;
  max-width:760px;margin:40px auto 0; text-align:left;
}
.step{
  background:var(--card); border-radius:var(--r-md); padding:18px 18px 16px;
  box-shadow:var(--shadow); animation:fadeUp .7s cubic-bezier(.2,.7,.3,1) both;
}
.step:nth-child(1){animation-delay:.08s}
.step:nth-child(2){animation-delay:.16s}
.step:nth-child(3){animation-delay:.24s}
.step-num{
  width:26px;height:26px;border-radius:50%;background:var(--blue-soft);color:var(--blue);
  display:grid;place-items:center;font-size:14px;font-weight:700;margin-bottom:10px;
}
.step b{display:block;font-size:15px;font-weight:600;letter-spacing:-.01em}
.step span{display:block;font-size:13px;color:var(--text3);margin-top:3px;line-height:1.5}

/* ── 主区布局 ─────────────────────────────── */
.main{display:grid;grid-template-columns:7fr 5fr;gap:24px;align-items:start;padding-bottom:72px}
.card{
  background:var(--card); border-radius:var(--r-lg); box-shadow:var(--shadow);
  padding:32px 30px 30px; animation:fadeUp .7s .2s cubic-bezier(.2,.7,.3,1) both;
}
.card-side{animation-delay:.3s;padding:26px 26px 20px}
.card-title{font-size:22px;font-weight:700;letter-spacing:-.02em;margin-bottom:4px}
.card-sub{font-size:14px;color:var(--text3);margin-bottom:26px}

/* 表单区块标题 */
.block{margin-bottom:28px}
.block-head{display:flex;align-items:baseline;gap:8px;margin-bottom:10px}
.block-num{flex:none;width:21px;height:21px;border-radius:50%;background:var(--blue);color:#fff;font-size:12px;font-weight:700;display:grid;place-items:center;transform:translateY(3px)}
.block-title{font-size:16px;font-weight:600;letter-spacing:-.01em}
.block-help{font-size:13px;color:var(--text3);margin-top:8px;line-height:1.55}

/* 分段控件（iOS 风格） */
.seg{display:flex;background:var(--fill-2);border-radius:11px;padding:2px;margin-bottom:18px}
.seg-btn{
  flex:1;padding:8px 10px;border-radius:9px;font-size:14px;font-weight:500;color:var(--text2);
  transition:all .22s cubic-bezier(.2,.7,.3,1);white-space:nowrap;
}
.seg-btn.active{background:#fff;color:var(--text);font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.12)}

/* 拖放区 */
.dropzone{
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
  min-height:200px;padding:28px 20px;border-radius:var(--r-md);
  background:var(--fill);border:1.5px dashed #c7c7cc;cursor:pointer;
  transition:all .25s cubic-bezier(.2,.7,.3,1);
}
.dropzone:hover{border-color:var(--blue);background:var(--blue-soft)}
.dropzone.drag{border-color:var(--blue);background:var(--blue-soft);transform:scale(1.01)}
.dz-icon{
  width:52px;height:52px;border-radius:50%;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.08);
  display:grid;place-items:center;margin-bottom:12px;transition:transform .25s cubic-bezier(.2,.7,.3,1);
}
.dropzone.drag .dz-icon{transform:translateY(-4px)}
.dz-main{font-size:16px;font-weight:600}
.dz-main b{color:var(--blue);font-weight:600}
.dz-hint{font-size:13px;color:var(--text3);margin-top:6px;line-height:1.6}

/* 已选文件条 */
.file-chip{
  display:flex;align-items:center;gap:12px;background:var(--fill);border-radius:var(--r-sm);
  padding:12px 14px;margin-top:12px;animation:fadeUp .3s both;
}
.chip-icon{flex:none;width:36px;height:36px;border-radius:9px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.1);display:grid;place-items:center}
.chip-info{flex:1;min-width:0}
.chip-name{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chip-size{font-size:12px;color:var(--text3)}
.chip-remove{
  flex:none;width:28px;height:28px;border-radius:50%;background:rgba(118,118,128,.12);
  color:var(--text2);font-size:15px;line-height:1;display:grid;place-items:center;transition:all .18s;
}
.chip-remove:hover{background:var(--red-soft);color:var(--red)}

/* 粘贴代码 */
.paste-area{
  width:100%;min-height:230px;resize:vertical;background:var(--fill);border:1.5px solid transparent;
  border-radius:var(--r-md);padding:14px 16px;font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  font-size:13.5px;line-height:1.7;color:var(--text);transition:all .2s;
  -webkit-user-select:text;user-select:text;-webkit-touch-callout:default;
}
.paste-area:focus{outline:none;background:#fff;border-color:var(--blue);box-shadow:0 0 0 4px rgba(0,113,227,.12)}

/* 粘贴剪贴板按钮（移动端显示：部分手机键盘粘贴会不全、内嵌浏览器长按无粘贴项） */
.paste-btn{
  display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:10px;
  background:var(--blue-soft);color:var(--blue);font-size:14.5px;font-weight:600;
  padding:11px;border-radius:980px;transition:all .2s;cursor:pointer;
}
.paste-btn:hover{background:var(--blue-soft);filter:brightness(.96)}
.paste-btn:disabled{opacity:.55;cursor:wait}
.paste-hint{margin-top:10px;font-size:13px;line-height:1.55;background:var(--red-soft);color:#c22b21;border-radius:var(--r-sm);padding:10px 12px}

/* 输入框 */
.text-input{
  width:100%;background:var(--fill);border:1.5px solid transparent;border-radius:var(--r-sm);
  padding:13px 15px;font-family:inherit;font-size:17px;color:var(--text);transition:all .2s;letter-spacing:.01em;
}
.text-input::placeholder{color:#b0b0b5}
.text-input:focus{outline:none;background:#fff;border-color:var(--blue);box-shadow:0 0 0 4px rgba(0,113,227,.12)}
.input-status{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:13px;color:var(--text3)}
.input-status.ok{color:var(--green-deep)}
.input-status.bad{color:var(--red)}
.status-ico{flex:none;display:grid;place-items:center}

/* 网址预览 */
.url-preview{
  display:flex;align-items:center;gap:8px;margin-top:12px;background:#fff;border:1px solid var(--line);
  border-radius:var(--r-sm);padding:10px 14px;font-size:13px;color:var(--text2);
  overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
}
.url-preview code{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12.5px;overflow:hidden;text-overflow:ellipsis}
.url-preview .up{color:var(--blue);font-weight:600}

/* 有效期选择 */
.exp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.exp-opt{
  background:var(--fill);border:1.5px solid transparent;border-radius:var(--r-md);
  padding:14px 8px 12px;text-align:center;transition:all .2s cubic-bezier(.2,.7,.3,1);
}
.exp-opt:hover{background:rgba(0,113,227,.06)}
.exp-opt.active{background:var(--blue-soft);border-color:var(--blue)}
.exp-opt b{display:block;font-size:16px;font-weight:700;letter-spacing:-.01em}
.exp-opt.active b{color:var(--blue)}
.exp-opt span{display:block;font-size:12px;color:var(--text3);margin-top:2px}
.exp-check{width:18px;height:18px;margin:0 auto 6px;border-radius:50%;border:1.5px solid #c7c7cc;display:grid;place-items:center;transition:all .2s}
.exp-opt.active .exp-check{background:var(--blue);border-color:var(--blue)}
.exp-opt.active .exp-check svg{opacity:1}
.exp-check svg{opacity:0;transition:opacity .15s}

/* 发布按钮 */
.publish-btn{
  display:flex;align-items:center;justify-content:center;gap:8px;width:100%;
  background:var(--blue);color:#fff;font-size:17px;font-weight:600;letter-spacing:.02em;
  padding:15px;border-radius:980px;transition:all .2s cubic-bezier(.2,.7,.3,1);
  box-shadow:0 6px 18px rgba(0,113,227,.28);
}
.publish-btn:hover:not(:disabled){background:var(--blue-deep);transform:scale(1.015);box-shadow:0 10px 26px rgba(0,113,227,.34)}
.publish-btn:active:not(:disabled){transform:scale(.98)}
.publish-btn:disabled{opacity:.55;cursor:wait;box-shadow:none}
.spinner{
  width:18px;height:18px;border-radius:50%;flex:none;
  border:2.5px solid rgba(255,255,255,.35);border-top-color:#fff;
  animation:spin .7s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg)}}

/* 发布进度条 */
.progress{margin-top:16px}
.progress-track{height:6px;border-radius:980px;background:var(--fill-2);overflow:hidden}
.progress-fill{height:100%;width:0;border-radius:inherit;background:var(--blue);transition:width .25s ease}
.progress.working .progress-fill{width:45%!important;animation:slideX 1.1s ease-in-out infinite}
@keyframes slideX{0%{transform:translateX(-120%)}100%{transform:translateX(340%)}}
.progress-label{font-size:12.5px;color:var(--text3);margin-top:6px;min-height:18px}

/* 消息与结果 */
.msg{margin-top:16px;font-size:14px;border-radius:var(--r-sm);padding:12px 14px;line-height:1.5}
.msg:empty{display:none}
.msg.err{background:var(--red-soft);color:#c22b21}
.result{
  margin-top:24px;background:linear-gradient(180deg,rgba(52,199,89,.07),rgba(52,199,89,.03));
  border:1px solid rgba(52,199,89,.25);border-radius:var(--r-md);padding:24px;
  animation:popIn .45s cubic-bezier(.2,1.2,.3,1) both;text-align:center;
}
.result-check{width:52px;height:52px;border-radius:50%;background:var(--green);display:grid;place-items:center;margin:0 auto 12px;box-shadow:0 6px 18px rgba(52,199,89,.35)}
.result-title{font-size:20px;font-weight:700;letter-spacing:-.02em}
.result-sub{font-size:13.5px;color:var(--text2);margin-top:4px}
.result-url{
  display:block;background:#fff;border-radius:var(--r-sm);padding:13px 14px;margin:16px 0;
  font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:14px;color:var(--blue);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-shadow:inset 0 0 0 1px var(--line);
}
.result-url:hover{text-decoration:underline}
.result-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.pill-btn{
  display:inline-flex;align-items:center;gap:6px;padding:10px 22px;border-radius:980px;
  font-size:15px;font-weight:600;transition:all .2s;
}
.pill-btn.primary{background:var(--blue);color:#fff;box-shadow:0 4px 14px rgba(0,113,227,.25)}
.pill-btn.primary:hover{background:var(--blue-deep);transform:scale(1.03)}
.pill-btn.ghost{background:var(--fill);color:var(--text)}
.pill-btn.ghost:hover{background:var(--fill-2)}

/* ── 站点列表 ─────────────────────────────── */
.side-head{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.side-title{font-size:19px;font-weight:700;letter-spacing:-.02em}
.side-count{background:var(--fill);color:var(--text2);font-size:13px;font-weight:600;border-radius:980px;padding:2px 10px}
.refresh-btn{
  margin-left:auto;width:32px;height:32px;border-radius:50%;background:var(--fill);
  display:grid;place-items:center;color:var(--text2);transition:all .2s;
}
.refresh-btn:hover{background:var(--fill-2);color:var(--text)}
.refresh-btn.spin svg{animation:spin .8s linear infinite}
.side-sub{font-size:13px;color:var(--text3);margin-bottom:18px}

.site-row{
  display:flex;align-items:center;gap:12px;padding:12px 10px;border-radius:var(--r-sm);
  transition:background .18s;position:relative;
}
.site-row:hover{background:var(--fill)}
.site-row + .site-row{border-top:.5px solid var(--line)}
.avatar{
  flex:none;width:40px;height:40px;border-radius:11px;display:grid;place-items:center;
  color:#fff;font-size:17px;font-weight:700;text-transform:uppercase;letter-spacing:0;
}
.site-info{flex:1;min-width:0}
.site-name{display:block;font-size:15px;font-weight:600;letter-spacing:-.01em;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.site-name:hover{color:var(--blue);text-decoration:underline}
.site-meta{display:block;font-size:12.5px;color:var(--text3);margin-top:1px}
.exp-pill{
  flex:none;font-size:11.5px;font-weight:600;border-radius:980px;padding:3px 9px;white-space:nowrap;
}
.exp-pill.ok{background:rgba(52,199,89,.12);color:var(--green-deep)}
.exp-pill.warn{background:var(--orange-soft);color:var(--orange)}
.exp-pill.perm{background:var(--fill);color:var(--text3)}
.site-link{flex:none;color:#b0b0b5;display:grid;place-items:center;transition:color .18s;transform:translateX(0);transition:transform .18s}
.site-row:hover .site-link{color:var(--blue);transform:translateX(2px)}

/* 空状态 */
.empty{
  text-align:center;padding:40px 16px;border:1.5px dashed #c7c7cc;border-radius:var(--r-md);
  color:var(--text3);font-size:14px;line-height:1.7;
}
.empty-icon{margin-bottom:10px;opacity:.5}
.empty b{color:var(--text2);font-weight:600}

/* 提示横幅 */
.banner{
  display:flex;gap:10px;align-items:flex-start;background:var(--orange-soft);color:var(--orange);
  border-radius:var(--r-md);padding:14px 16px;font-size:14px;line-height:1.55;margin-bottom:24px;
  animation:fadeUp .5s both;
}

/* ── 页脚 ─────────────────────────────────── */
.footer{
  border-top:.5px solid var(--line);padding:28px 0 40px;text-align:center;
  font-size:13px;color:var(--text3);
}
.footer-links{display:flex;justify-content:center;gap:20px;margin-top:8px}

noscript{display:block;text-align:center;padding:20px;color:var(--red);background:var(--red-soft)}

/* ── 动画 ─────────────────────────────────── */
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes popIn{from{opacity:0;transform:scale(.94) translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
}

/* ── 响应式 ───────────────────────────────── */
@media (max-width:900px){
  .main{grid-template-columns:1fr}
  .steps{grid-template-columns:1fr;gap:10px}
  .step{display:flex;gap:12px;align-items:flex-start;padding:14px}
  .step-num{margin-bottom:0}
  .hero{padding:48px 0 36px}
  .card{padding:26px 22px 24px}
  .nav-right .nav-status span{display:none}
}
</style>
</head>
<body>

<nav class="nav">
  <div class="nav-inner">
    <div class="logo">
      <span class="logo-badge">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5m0 0-6 6m6-6 6 6"/></svg>
      </span>
      网页托管舱
    </div>
    <div class="nav-right">
      <span class="nav-status"><span class="status-dot"></span><span>服务运行中</span></span>
    </div>
  </div>
</nav>

<div class="page">

  <section class="hero">
    <h1>三步，把网页发布到互联网。</h1>
    <p>上传你的 HTML 文件或压缩包，起个名字，几秒钟后就会获得一个任何人都能访问的公开网址。不需要服务器，也不需要懂部署。</p>
    <div class="steps">
      <div class="step">
        <span class="step-num">1</span>
        <b>选择文件</b>
        <span>拖入 ZIP 压缩包或单个 HTML 文件</span>
      </div>
      <div class="step">
        <span class="step-num">2</span>
        <b>起个名字</b>
        <span>名字就是网址的一部分，越好记越好</span>
      </div>
      <div class="step">
        <span class="step-num">3</span>
        <b>点击发布</b>
        <span>立刻获得链接，随手就能分享给朋友</span>
      </div>
    </div>
  </section>

  <div id="banner" class="banner hidden"></div>

  <div class="main">

    <!-- 左：发布卡片 -->
    <section class="card">
      <h2 class="card-title">发布新网页</h2>
      <p class="card-sub">按下面的三步操作即可，全程大约 10 秒钟。</p>

      <!-- 第 1 步：内容 -->
      <div class="block">
        <div class="block-head"><span class="block-num">1</span><span class="block-title">选择网页文件</span></div>
        <div class="seg" role="tablist">
          <button type="button" class="seg-btn" id="tab-file" role="tab" aria-selected="false">上传文件</button>
          <button type="button" class="seg-btn active" id="tab-paste" role="tab" aria-selected="true">粘贴代码</button>
        </div>

        <div id="pane-file" class="hidden">
          <label class="dropzone" id="dropzone" for="file-input">
            <input type="file" id="file-input" accept=".zip,.html,.htm" hidden>
            <span class="dz-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0071e3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V7m0 0-4 4m4-4 4 4"/><path d="M20 16.5A4.5 4.5 0 0 0 17.5 8h-.6A6.5 6.5 0 1 0 5 13.5"/></svg>
            </span>
            <span class="dz-main">点击选择文件，<b>或把文件拖到这里</b></span>
            <span class="dz-hint">支持 .zip 压缩包（里面要有 index.html）或单个 .html 文件<br>单个文件最大 3MB，整个项目最大 10MB</span>
          </label>
          <div class="file-chip hidden" id="file-chip">
            <span class="chip-icon" id="chip-icon"></span>
            <span class="chip-info">
              <span class="chip-name" id="chip-name"></span>
              <span class="chip-size" id="chip-size"></span>
            </span>
            <button type="button" class="chip-remove" id="chip-remove" title="移除文件" aria-label="移除文件">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </div>
        </div>

        <div id="pane-paste">
          <textarea class="paste-area" id="paste-area" spellcheck="false" placeholder="把 HTML 代码粘贴到这里，例如：&#10;&#10;&lt;!DOCTYPE html&gt;&#10;&lt;html&gt;&#10;  &lt;body&gt;&lt;h1&gt;你好，世界&lt;/h1&gt;&lt;/body&gt;&#10;&lt;/html&gt;"></textarea>
          <button type="button" class="paste-btn" id="paste-btn" hidden>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4.5A2.5 2.5 0 0 1 2 12.5v-8A2.5 2.5 0 0 1 4.5 2h8A2.5 2.5 0 0 1 15 4.5V5"/></svg>
            <span>粘贴剪贴板内容</span>
          </button>
          <p class="paste-hint" id="paste-hint" hidden role="alert"></p>
          <p class="block-help">整段代码会保存为一个网页，自动作为首页。</p>
        </div>
      </div>

      <!-- 第 2 步：命名 -->
      <div class="block">
        <div class="block-head"><span class="block-num">2</span><span class="block-title">给项目起个名字</span></div>
        <input class="text-input" id="name-input" type="text" spellcheck="false" autocomplete="off"
               placeholder="例如：my-first-site" maxlength="40" aria-label="项目名称">
        <p class="input-status" id="name-status">只能用小写字母、数字和连字符，例如 hello-world</p>
        <div class="url-preview" id="url-preview" hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#86868b" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>
          <span>发布后的网址：</span><code id="url-preview-text"></code>
        </div>
      </div>

      <!-- 第 3 步：有效期 -->
      <div class="block">
        <div class="block-head"><span class="block-num">3</span><span class="block-title">选择保存时长</span></div>
        <div class="exp-grid" id="exp-grid">
          <button type="button" class="exp-opt" data-exp="3d" aria-label="保存 3 天">
            <span class="exp-check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg></span>
            <b>3 天</b><span>临时给朋友看看</span>
          </button>
          <button type="button" class="exp-opt active" data-exp="7d" aria-label="保存 7 天">
            <span class="exp-check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg></span>
            <b>7 天</b><span>最常用的选择</span>
          </button>
          <button type="button" class="exp-opt" data-exp="30d" aria-label="保存 1 个月">
            <span class="exp-check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg></span>
            <b>1 个月</b><span>较长时间使用</span>
          </button>
        </div>
        <p class="block-help">到期后网页会自动下线并清空文件，名字也会释放给别人使用。发布后随时可以重新上传。</p>
      </div>

      <button class="publish-btn" id="publish-btn" type="button">
        <span id="publish-label">发布我的网页</span>
      </button>

      <div class="progress hidden" id="progress" role="status" aria-live="polite">
        <div class="progress-track"><div class="progress-fill" id="progress-fill"></div></div>
        <p class="progress-label" id="progress-label"></p>
      </div>

      <div class="msg err hidden" id="msg" role="alert"></div>

      <div class="result hidden" id="result">
        <span class="result-check">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>
        </span>
        <p class="result-title">发布成功！</p>
        <p class="result-sub" id="result-sub">网页已经上线，把这个链接分享给任何人吧。</p>
        <a class="result-url" id="result-link" target="_blank" rel="noopener"></a>
        <div class="result-actions">
          <button class="pill-btn primary" id="copy-btn" type="button">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4.5A2.5 2.5 0 0 1 2 12.5v-8A2.5 2.5 0 0 1 4.5 2h8A2.5 2.5 0 0 1 15 4.5V5"/></svg>
            复制链接
          </button>
          <a class="pill-btn ghost" id="open-btn" target="_blank" rel="noopener">
            打开网页
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>
          </a>
        </div>
      </div>
    </section>

    <!-- 右：站点列表 -->
    <aside class="card card-side">
      <div class="side-head">
        <h2 class="side-title">已发布的站点</h2>
        <span class="side-count" id="site-count">–</span>
        <button type="button" class="refresh-btn" id="refresh-btn" title="刷新列表" aria-label="刷新列表">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5"/></svg>
        </button>
      </div>
      <p class="side-sub">这里只会显示这台浏览器发布过的网页，不会展示他人的站点。</p>

      <div id="site-list"></div>
      <div class="empty" id="empty">
        <div class="empty-icon">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="3"/><path d="m3 13 4.5-4.5a1.4 1.4 0 0 1 2 0L14 13m2-2 1.5-1.5a1.4 1.4 0 0 1 2 0L21 13"/><circle cx="15.5" cy="8.5" r="1"/></svg>
        </div>
        <b>还没有发布过站点</b><br>
        上传一个文件，几秒后这里就会出现你的第一个网址。
      </div>
      <div class="msg err hidden" id="list-msg" role="alert"></div>
    </aside>
  </div>

  <footer class="footer">
    <p>网页托管舱 · 由 Cloudflare Workers 与 GitHub 提供 storage 支持</p>
    <div class="footer-links">
      <a href="/api/health">服务状态</a>
    </div>
  </footer>
</div>
<noscript>需要开启 JavaScript 才能使用本页面。</noscript>

<script>
(function(){
'use strict';
var NAME_RE = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;
var AVATAR_COLORS = ['#0071e3','#5856d6','#ff2d55','#ff9500','#30b0c7','#34c759','#af52de','#ff6b22'];
var takenNames = [];
var currentFile = null;
var tab = 'paste';
var expiry = '7d';
var busy = false;
var $ = function(id){ return document.getElementById(id); };

var OK_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>';
var BAD_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg>';
var ZIP_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff9500" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h6a3 3 0 0 1 3 3Z"/><path d="M12 11v2m0 2v2"/></svg>';
var HTML_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0071e3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5M9 13h6M9 17h4"/></svg>';

/* 上传记录：用浏览器本地记录（localStorage）记住「这台浏览器发布过哪些站点」，
   主页只显示这些站点，不再依赖 IP 判断（IP 在代理/切换网络后会变，且会误显示他人站点）。 */
var STORE_KEY = 'bay.uploaded.sites';
function myUploadedNames(){
  try{
    var r = JSON.parse(localStorage.getItem(STORE_KEY));
    return Array.isArray(r) ? r : [];
  }catch(e){ return []; }
}
function rememberUploaded(name){
  try{
    var list = myUploadedNames();
    if(list.indexOf(name) < 0){ list.push(name); localStorage.setItem(STORE_KEY, JSON.stringify(list)); }
  }catch(e){}
}

function fmtBytes(n){
  if(!n) return '0 B';
  var u = ['B','KB','MB','GB'], i = 0;
  while(n >= 1024 && i < u.length - 1){ n /= 1024; i++; }
  return (i === 0 ? n : Math.round(n * 10) / 10) + ' ' + u[i];
}
function setStatus(el, text, cls){
  el.innerHTML = (cls === 'ok' ? '<span class="status-ico">' + OK_ICON + '</span>' : cls === 'bad' ? '<span class="status-ico">' + BAD_ICON + '</span>' : '') + '<span>' + text + '</span>';
  el.className = 'input-status' + (cls ? ' ' + cls : '');
}
function setErr(el, text){
  if(!text){ el.classList.add('hidden'); el.textContent = ''; return; }
  el.textContent = text;
  el.classList.remove('hidden');
}
function setBanner(text){
  var b = $('banner');
  if(!text){ b.classList.add('hidden'); return; }
  b.innerHTML = '<svg width="17" height="17" style="flex:none;margin-top:2px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg><span>' + text + '</span>';
  b.classList.remove('hidden');
}
function copyText(text, btn){
  var done = function(){
    if(!btn) return;
    var label = btn.querySelector('span') || btn;
    var o = label.textContent;
    label.textContent = '已复制';
    setTimeout(function(){ label.textContent = o; }, 1300);
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

/* 分段控件：文件 / 粘贴 */
function switchTab(t){
  tab = t;
  $('tab-file').classList.toggle('active', t === 'file');
  $('tab-paste').classList.toggle('active', t === 'paste');
  $('tab-file').setAttribute('aria-selected', t === 'file' ? 'true' : 'false');
  $('tab-paste').setAttribute('aria-selected', t === 'paste' ? 'true' : 'false');
  $('pane-file').classList.toggle('hidden', t !== 'file');
  $('pane-paste').classList.toggle('hidden', t !== 'paste');
  if(t === 'paste') $('paste-area').focus();
}
$('tab-file').onclick = function(){ switchTab('file'); };
$('tab-paste').onclick = function(){ switchTab('paste'); };

/* 拖放上传 */
var dz = $('dropzone'), fi = $('file-input');
function setFile(f){
  if(!f){ currentFile = null; $('file-chip').classList.add('hidden'); return; }
  var n = (f.name || '').toLowerCase();
  if(!(n.endsWith('.zip') || n.endsWith('.html') || n.endsWith('.htm'))){
    setErr($('msg'), '只支持 .zip 压缩包或 .html 网页文件，请重新选择。');
    return;
  }
  currentFile = f;
  $('chip-icon').innerHTML = n.endsWith('.zip') ? ZIP_ICON : HTML_ICON;
  $('chip-name').textContent = f.name || '(未命名文件)';
  $('chip-size').textContent = fmtBytes(f.size);
  $('file-chip').classList.remove('hidden');
  setErr($('msg'), '');

  // 选择文件后：切到"文件"页签，未填名字时按文件名自动生成项目名（可修改），
  // 但不自动上传——由用户确认自定义项目名后手动点击"发布我的网页"
  switchTab('file');
  var nameInput = $('name-input');
  if(!nameInput.value.trim()){
    var slug = slugFromName(f.name);
    if(slug){ nameInput.value = slug; refreshNameStatus(); }
  }
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

/* 项目名：即时校验 + 网址预览 */
var nameTimer = null;
var nameCheckSeq = 0;
var lastCheck = null; // 最后一次服务端占用校验结果 {v, taken}，避免对同一名字重复请求
function checkNameOnServer(v, s){
  var seq = ++nameCheckSeq;
  setStatus(s, '检查这个名字…', '');
  fetch('/api/sites/check?name=' + encodeURIComponent(v))
    .then(function(r){ return r.json(); })
    .then(function(j){
      if(seq !== nameCheckSeq) return; // 已输入新名字，忽略过时结果
      lastCheck = { v: v, taken: !!(j && j.ok && j.taken) };
      if(j && j.ok){
        if(j.taken){ setStatus(s, '这个名字已经被占用了，换一个试试', 'bad'); }
        else { setStatus(s, '这个名字可以用', 'ok'); }
      } else if(j && j.warning){
        setStatus(s, '暂时无法校验，发布时以服务端校验为准', '');
      }
    })
    .catch(function(){
      if(seq === nameCheckSeq) setStatus(s, '暂时无法校验，发布时以服务端校验为准', '');
    });
}
function refreshNameStatus(){
  var v = $('name-input').value.trim().toLowerCase();
  var s = $('name-status');
  var pv = $('url-preview');
  if(!v){
    setStatus(s, '只能用小写字母、数字和连字符，例如 hello-world', '');
    pv.hidden = true; return;
  }
  pv.hidden = false;
  $('url-preview-text').textContent = location.host + '/' + v + '/';
  if(!NAME_RE.test(v)){
    setStatus(s, '名字格式不对：只能用小写字母、数字和连字符，开头结尾不能是连字符', 'bad');
    pv.hidden = true; return;
  }
  if(v === 'api' || v === 'admin'){ setStatus(s, '这个名字被系统保留了，换一个吧', 'bad'); pv.hidden = true; return; }
  if(takenNames.indexOf(v) >= 0){ setStatus(s, '这个名字已经被占用了，换一个试试', 'bad'); return; }
  if(lastCheck && lastCheck.v === v){
    setStatus(s, lastCheck.taken ? '这个名字已经被占用了，换一个试试' : '这个名字可以用', lastCheck.taken ? 'bad' : 'ok');
    return;
  }
  checkNameOnServer(v, s);
}
$('name-input').addEventListener('input', function(){
  var v = this.value.trim().toLowerCase();
  if(v !== this.value) this.value = v;
  clearTimeout(nameTimer);
  nameTimer = setTimeout(refreshNameStatus, 200);
});

/* 有效期选择 */
(function(){
  var opts = $('exp-grid').querySelectorAll('.exp-opt');
  opts.forEach(function(b){
    b.onclick = function(){
      expiry = b.getAttribute('data-exp');
      opts.forEach(function(x){ x.classList.toggle('active', x === b); });
    };
  });
})();

/* 发布（含上传进度条） */
function slugFromName(n){
  var s = (n || '').toLowerCase()
    .replace(/\.[^.]+$/, '')            // 去掉扩展名
    .replace(/[^a-z0-9]+/g, '-')        // 非字母数字 → 连字符
    .replace(/^-+|-+$/g, '');           // 去掉首尾连字符
  if(s.length > 40) s = s.slice(0, 40);
  return s.replace(/^-+|-+$/g, '');
}
function showProgress(){ $('progress').classList.remove('hidden'); }
function hideProgress(){
  $('progress').classList.add('hidden');
  $('progress-fill').classList.remove('working');
  $('progress-fill').style.width = '0';
  $('progress-label').textContent = '';
}
function setProgress(pct, label){
  $('progress-fill').classList.remove('working');
  $('progress-fill').style.width = Math.max(0, Math.min(100, pct)) + '%';
  $('progress-label').textContent = label || '';
}
function setWorking(label){
  $('progress-fill').classList.add('working');
  $('progress-fill').style.width = '';
  $('progress-label').textContent = label || '';
}
// 用 XHR 发送上传，支持请求体上传进度的回调
function uploadWithProgress(opts, onProgress){
  return new Promise(function(resolve, reject){
    var xhr = new XMLHttpRequest();
    xhr.open(opts.method || 'POST', '/api/upload', true);
    xhr.upload.onprogress = function(e){
      if(e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload = function(){
      var j = null;
      try { j = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch(e){ j = null; }
      if(!j){ resolve({ ok: false, error: '服务器返回了异常响应 (HTTP ' + xhr.status + ')' }); return; }
      j._status = xhr.status;
      resolve(j);
    };
    xhr.onerror = function(){ reject(new Error('网络错误，请稍后再试。')); };
    if(opts.headers){
      for(var k in opts.headers) xhr.setRequestHeader(k, opts.headers[k]);
    }
    xhr.send(opts.body);
  });
}
$('publish-btn').onclick = publish;
function publish(){
  if(busy) return;
  var name = $('name-input').value.trim().toLowerCase();
  if(!NAME_RE.test(name)){ setErr($('msg'), '请先填一个合法的项目名（小写字母、数字、连字符），或直接选择文件自动命名。'); return; }
  if(takenNames.indexOf(name) >= 0){ setErr($('msg'), '项目名 "' + name + '" 已被占用，请换一个。'); return; }

  var isFile, opts, total;
  if(tab === 'file' && currentFile){
    isFile = true;
    var fd = new FormData();
    fd.append('name', name);
    fd.append('expiry', expiry);
    fd.append('file', currentFile);
    opts = { method: 'POST', body: fd };
    total = currentFile.size || 0;
  } else {
    var html = $('paste-area').value || '';
    if(!html.trim()){ setErr($('msg'), '请先粘贴 HTML 代码，或选择要上传的文件。'); return; }
    opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, html: html, expiry: expiry }) };
    total = 0;
  }

  busy = true;
  var btn = $('publish-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span><span>正在发布…</span>';
  setErr($('msg'), '');
  $('result').classList.add('hidden');
  showProgress();

  var done = onResult;
  var fail = onResultError;
  var finish = onPublishDone;
  if(isFile && total){
    setProgress(0, '正在上传 0%');
    uploadWithProgress(opts, function(pct){
      if(pct >= 100) setWorking('文件已上传，正在部署到 GitHub…');
      else setProgress(pct, '正在上传 ' + pct + '%');
    }).then(done, fail).finally(finish);
  } else {
    setWorking('正在部署到 GitHub…');
    uploadWithProgress(opts, null).then(done, fail).finally(finish);
  }
}
function onResult(j){
  if(j.ok){
    var link = location.origin + j.url;
    $('result-link').textContent = link;
    $('result-link').href = link;
    $('open-btn').href = link;
    $('result-sub').textContent = '网页已上线，有效期 ' + (j.expiry_days || 7) + ' 天，把链接分享给任何人吧。';
    $('result').classList.remove('hidden');
    if(takenNames.indexOf(j.name) < 0) takenNames.push(j.name);
    rememberUploaded(j.name);
    refreshNameStatus();
    loadSites();
    $('result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    var m = j.error || ('HTTP ' + j._status);
    setErr($('msg'), '发布没成功：' + m + (j._status === 409 ? '（换个项目名再试）' : ''));
  }
}
function onResultError(e){
  setErr($('msg'), '网络出了点问题：' + e.message + '，请稍后再试。');
}
function onPublishDone(){
  busy = false;
  var btn = $('publish-btn');
  btn.disabled = false;
  btn.innerHTML = '<span>发布我的网页</span>';
  hideProgress();
}

/* 复制链接 */
$('copy-btn').onclick = function(){ copyText($('result-link').textContent, this); };

/* 站点列表 */
function fmtExpiry(s){
  if(!s.expire_at) return { text: '永久', cls: 'perm' };
  var ms = s.expire_at - Date.now();
  if(s.expired || ms <= 0) return { text: '已过期', cls: 'warn' };
  var d = Math.floor(ms / 86400000);
  if(d >= 1) return { text: '剩 ' + d + ' 天', cls: d <= 2 ? 'warn' : 'ok' };
  var h = Math.floor(ms / 3600000);
  if(h >= 1) return { text: '剩 ' + h + ' 小时', cls: 'warn' };
  return { text: '即将到期', cls: 'warn' };
}
var colorSeq = 0;
function row(s){
  var el = document.createElement('div'); el.className = 'site-row';

  var av = document.createElement('span'); av.className = 'avatar';
  av.style.background = AVATAR_COLORS[colorSeq++ % AVATAR_COLORS.length];
  av.textContent = s.name.charAt(0);

  var info = document.createElement('span'); info.className = 'site-info';
  var nm = document.createElement('a'); nm.className = 'site-name';
  nm.href = '/' + s.name + '/'; nm.target = '_blank'; nm.rel = 'noopener'; nm.textContent = s.name;
  var meta = document.createElement('span'); meta.className = 'site-meta';
  meta.textContent = s.files + ' 个文件 · ' + fmtBytes(s.size);
  info.appendChild(nm); info.appendChild(meta);

  var pill = document.createElement('span');
  var exp = fmtExpiry(s);
  pill.className = 'exp-pill ' + exp.cls; pill.textContent = exp.text;

  var go = document.createElement('a'); go.className = 'site-link';
  go.href = '/' + s.name + '/'; go.target = '_blank'; go.rel = 'noopener';
  go.title = '访问 ' + s.name;
  go.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>';

  var copy = document.createElement('button'); copy.type = 'button';
  copy.className = 'site-link'; copy.title = '复制链接';
  copy.style.marginRight = '2px';
  copy.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4.5A2.5 2.5 0 0 1 2 12.5v-8A2.5 2.5 0 0 1 4.5 2h8A2.5 2.5 0 0 1 15 4.5V5"/></svg>';
  copy.onclick = function(){
    copyText(location.origin + '/' + s.name + '/', null);
    var old = copy.title; copy.title = '已复制';
    setTimeout(function(){ copy.title = old; }, 1200);
  };

  el.appendChild(av); el.appendChild(info); el.appendChild(copy); el.appendChild(pill); el.appendChild(go);
  return el;
}
function loadSites(){
  var rb = $('refresh-btn');
  rb.classList.add('spin');
  // 把浏览器本地记录的名字作为 ?mine= 传给后端，后端只返回这些站点，不返回全部
  fetch('/api/sites?mine=' + encodeURIComponent(myUploadedNames().join(',')))
    .then(function(r){ return r.json(); })
    .then(function(j){
      rb.classList.remove('spin');
      setErr($('list-msg'), '');
      if(!j.ok){
        setErr($('list-msg'), '加载失败：' + (j.error || '未知错误'));
        return;
      }
      if(j.warning) setBanner(j.warning);
      var sites = j.sites || [];
      takenNames = sites.map(function(s){ return s.name; });
      $('site-count').textContent = String(sites.length);
      var list = $('site-list');
      list.innerHTML = '';
      colorSeq = 0;
      if(!sites.length){
        $('empty').classList.remove('hidden');
        return;
      }
      $('empty').classList.add('hidden');
      sites.forEach(function(s){ list.appendChild(row(s)); });
    })
    .catch(function(e){
      rb.classList.remove('spin');
      setErr($('list-msg'), '加载失败：' + e.message);
    });
}
$('refresh-btn').onclick = loadSites;

/* 配置自检 */
fetch('/api/health')
  .then(function(r){ return r.json(); })
  .then(function(j){
    if(j && j.configured === false){
      setBanner('服务还没配置好：缺少 ' + (j.missing || []).join('、') + ' 环境变量。管理员需要在 Cloudflare 的 wrangler.toml 与 secret 中设置后再部署。');
    } else if(j && j.token_valid === false){
      setBanner('GitHub 访问令牌校验失败：' + (j.detail || '无效或权限不足') + '，暂时无法发布，请联系管理员。');
    }
  })
  .catch(function(){});

refreshNameStatus();
loadSites();

/* 手机端：提供"粘贴剪贴板"按钮——部分手机键盘的粘贴会粘贴不全，内嵌浏览器长按也可能没有粘贴项 */
if(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || ('ontouchstart' in window && window.matchMedia('(max-width: 900px)').matches)){
  var ta = $('paste-area');
  ta.placeholder = '请点击下方按钮粘贴完整代码（键盘上的粘贴会粘贴不全）';
  var pasteBtn = $('paste-btn');
  pasteBtn.hidden = false;
  /* 底部提示太靠下容易看不到，剪贴板相关提示就近显示在按钮下方 */
  var hint = $('paste-hint');
  var showPasteHint = function(text){
    setErr($('msg'), '');
    hint.textContent = text;
    hint.classList.remove('hidden');
    hint.scrollIntoView({block:'nearest'});
  };
  var clearPasteHint = function(){ hint.classList.add('hidden'); hint.textContent = ''; };
  /* 部分手机禁止网页读取剪贴板：引导用户长按输入框，用系统菜单里的"粘贴"（不是手机键盘上的粘贴按钮） */
  var guideSystemPaste = function(){
    showPasteHint('当前浏览器不允许直接读取剪贴板：请长按上面的输入框，在弹出的菜单中选择"粘贴"（用系统粘贴，不要用手机键盘上的粘贴按钮）。');
    ta.focus();
  };
  pasteBtn.onclick = function(){
    var b = this, o = b.innerHTML;
    b.disabled = true;
    b.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-color:rgba(0,113,227,.35);border-top-color:#0071e3"></span><span>正在读取剪贴板…</span>';
    clearPasteHint();
    if(!navigator.clipboard || !navigator.clipboard.readText){
      b.disabled = false;
      b.innerHTML = o;
      guideSystemPaste();
      return;
    }
    navigator.clipboard.readText().then(function(t){
      if(!t || !t.trim()){
        showPasteHint('剪贴板是空的：请先复制网页代码，再回来点「粘贴剪贴板内容」。');
        return;
      }
      ta.value = t;
      ta.focus();
      clearPasteHint();
      setErr($('msg'), '');
    }).catch(function(){
      guideSystemPaste();
    }).finally(function(){
      b.disabled = false;
      b.innerHTML = o;
    });
  };
}
})();
</script>
</body>
</html>`;
