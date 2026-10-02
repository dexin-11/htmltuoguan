// 声明式站点后端引擎（KV 存储）
//
// 设计原则：
// 1. 引擎只访问 KV 绑定（env.BAYKV），绝不接触 GH_TOKEN / ADMIN_PASSWORD —— 用户
//    通过页面声明的路由永远拿不到宿主密钥；GitHub 相关逻辑（如过期检查）由 index.js
//    以回调形式注入。
// 2. 所有 KV 键以 bay:{站点名}: 为前缀，站点之间天然隔离。
// 3. 用户只能"声明"路由（白名单 op + 模板替换），引擎不执行任何用户代码（无 eval /
//    动态 import），杜绝任意代码执行。
// 4. 每个站点默认拥有 api/submit 接口（POST 存 / GET 取），零配置可用；
//    进阶用户可在 HTML 内嵌 <script type="application/json" id="bay-config"> 自定义。

// ---------- 常量与限制 ----------
const BODY_LIMIT = 256 * 1024; // 后端接口请求体上限 256KB
const SUBMIT_RATE_MAX = 60; // api/submit 默认限流：每 IP 每站点每小时 60 次
const SUBMIT_RATE_WINDOW = 3600; // 限流窗口（秒）
const LIST_MAX = 100; // 单次 list 最多返回条数
const DEFAULT_LIST = 50; // 默认返回条数
const MAX_ROUTES = 20; // 单站点最多自定义路由数
const MAX_OPS = 20; // 单路由最多操作数
const MAX_OP_JSON = 4096; // 单个 op 序列化后上限
const KEY_RE = /^[a-z0-9_-]{1,40}$/; // 集合/键名规则
const FIELD_RE = /^[a-zA-Z0-9_-]{1,40}$/; // 校验字段名规则
const ROUTE_PATH_RE = /^api\/[a-z0-9_-]{1,40}$/; // 路由路径规则（必须以 api/ 开头）
const METHODS = new Set(["GET", "POST", "HEAD"]);
const OPS = new Set([
  "readBody", "readQuery", "readHeader", "validate",
  "append", "list", "del",
  "kvGet", "kvPut",
  "checkToken", "rateLimit",
  "setStatus", "returnJson", "returnText", "redirect",
]);

// ---------- 错误与响应 ----------
export class BackendError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// 与 index.js 的安全/隐私响应头保持一致
const secHeaders = () => ({
  "X-Robots-Tag": "noindex, noarchive, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

function jsonResp(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...secHeaders() },
  });
}

// ---------- KV 工具 ----------
export function hasKV(env) {
  return !!(env && env.BAYKV && typeof env.BAYKV.get === "function" && typeof env.BAYKV.put === "function");
}

const cfgKey = (site) => `bay:${site}:cfg`;
const colPrefix = (site, collection) => `bay:${site}:col:${collection}:`;
const kvKey = (site, key) => `bay:${site}:kv:${key}`;

// 时间可排序 ID：12 位零填充 base36 时间戳 + 随机尾巴（字典序即时间序，KV list 直接可用）
function genId(now = Date.now()) {
  return now.toString(36).padStart(12, "0") + "-" + Math.random().toString(36).slice(2, 8);
}

// IP 指纹（FNV-1a）：限流计数器键使用，避免明文 IP 落 KV
function ipHash(ip) {
  if (!ip) return "anon";
  let h = 0x811c9dc5;
  for (let i = 0; i < ip.length; i++) {
    h ^= ip.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function clientIp(request) {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return null;
}

// 限流：KV 计数器 + 过期 TTL；无 IP 时跳过（无法定位主体）
async function rateLimitCheck(kv, site, name, ip, max, windowSec) {
  if (!ip || !max) return null;
  const key = `bay:${site}:rl:${name}:${ipHash(ip)}`;
  let n = 0;
  try {
    const cur = await kv.get(key);
    n = cur ? parseInt(cur, 10) || 0 : 0;
  } catch { /* 读失败放行 */ }
  if (n >= max) {
    return jsonResp({ ok: false, error: `请求太频繁（每小时最多 ${max} 次），请稍后再试` }, 429);
  }
  try {
    await kv.put(key, String(n + 1), { expirationTtl: windowSec });
  } catch { /* 写失败放行 */ }
  return null;
}

// 列出集合并读取记录（按 id 倒序 = 时间倒序）
async function listCollection(kv, site, collection, limit) {
  const prefix = colPrefix(site, collection);
  const names = [];
  let cursor;
  let guard = 0;
  do {
    const page = await kv.list({ prefix, ...(cursor ? { cursor } : {}) });
    for (const k of page.keys || []) {
      names.push(k.name);
      if (names.length >= limit * 3) break; // 最多多取一些再排序截断
    }
    if (page.list_complete || names.length >= limit * 3) break;
    cursor = page.cursor;
  } while (++guard < 20);

  const rows = await Promise.all(
    names.slice(0, limit * 3).map(async (name) => {
      try {
        const v = await kv.get(name);
        return v ? JSON.parse(v) : null;
      } catch {
        return null;
      }
    })
  );
  return rows
    .filter((r) => r && typeof r === "object")
    .sort((a, b) => String(b.id || "").localeCompare(String(a.id || "")))
    .slice(0, limit);
}

// ---------- 请求体与模板 ----------
async function readBody(request, limit = BODY_LIMIT) {
  if (request.method === "GET" || request.method === "HEAD") return {};
  const ct = (request.headers.get("content-type") || "").toLowerCase();
  const buf = await request.arrayBuffer();
  if (buf.byteLength > limit) throw new BackendError("请求体超过 256KB 上限", 413);
  const text = new TextDecoder().decode(buf).trim();
  if (!text) return {};
  if (ct.includes("application/x-www-form-urlencoded")) {
    const o = {};
    for (const [k, v] of new URLSearchParams(text)) o[k] = v;
    return o;
  }
  // JSON（显式声明或兜底尝试）
  try {
    const j = JSON.parse(text);
    if (j === null || typeof j !== "object") return { value: j };
    return j;
  } catch {
    throw new BackendError("请求体需要是 JSON 或表单编码（application/x-www-form-urlencoded）", 400);
  }
}

// 模板取值：{{body.x}} {{query.x}} {{vars.x}} {{headers.x}} {{now}} {{site}}
function lookupPath(c, expr) {
  const parts = expr.split(".");
  const root = parts[0];
  let v;
  if (root === "now") return c.now;
  if (root === "site") return c.site;
  if (root === "body") v = c.body;
  else if (root === "query") v = c.query;
  else if (root === "vars") v = c.vars;
  else if (root === "headers") v = c.headers;
  else return undefined;
  for (let i = 1; i < parts.length && v != null; i++) v = v[parts[i]];
  return v;
}

function resolveValue(v, c) {
  if (typeof v === "string") {
    const full = v.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
    if (full) {
      const r = lookupPath(c, full[1]);
      return r === undefined ? null : r;
    }
    return v.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, expr) => {
      const r = lookupPath(c, expr);
      return r === undefined || r === null ? "" : String(r);
    });
  }
  if (Array.isArray(v)) return v.map((x) => resolveValue(x, c));
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v)) o[k] = resolveValue(v[k], c);
    return o;
  }
  return v;
}

// ---------- 校验规则（required / min:N / max:N） ----------
function applyValidate(rules, c) {
  for (const field of Object.keys(rules || {})) {
    const spec = String(rules[field] || "");
    const val = c.body ? c.body[field] : undefined;
    const s = val === undefined || val === null ? "" : typeof val === "string" ? val : JSON.stringify(val);
    for (const tok of spec.split("|")) {
      const t = tok.trim();
      if (!t) continue;
      if (t === "required" && !s) throw new BackendError(`字段 ${field} 不能为空`, 400);
      const mx = t.match(/^max:(\d+)$/);
      if (mx && s.length > Number(mx[1])) throw new BackendError(`字段 ${field} 超过最大长度 ${mx[1]}`, 400);
      const mn = t.match(/^min:(\d+)$/);
      if (mn && s.length < Number(mn[1])) throw new BackendError(`字段 ${field} 至少需要 ${mn[1]} 个字符`, 400);
    }
  }
}

// ---------- op 执行 ----------
async function runOp(kv, op, c, ip) {
  const kind = op.op;
  switch (kind) {
    case "readBody":
      c.body = await readBody(c.request);
      return null;
    case "readQuery":
      c.query = Object.fromEntries(c.url.searchParams);
      return null;
    case "readHeader": {
      const name = String(op.name || "");
      if (!name) throw new BackendError("readHeader 需要提供 name", 400);
      c.vars[String(op.as || name)] = c.request.headers.get(name) || "";
      return null;
    }
    case "validate":
      applyValidate(op.rules, c);
      return null;
    case "append": {
      const collection = String(op.collection || "");
      const item = resolveValue(op.item, c);
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new BackendError("append 的 item 必须是对象", 400);
      }
      const id = genId(c.now);
      const rec = { ...item, id };
      if (rec.ts === undefined) rec.ts = c.now;
      await kv.put(colPrefix(c.site, collection) + id, JSON.stringify(rec));
      return null;
    }
    case "list": {
      const collection = String(op.collection || "");
      const limit = Math.min(Math.max(Number(op.limit) || DEFAULT_LIST, 1), LIST_MAX);
      const rows = await listCollection(kv, c.site, collection, limit);
      c.vars[String(op.as || "list")] = rows;
      return null;
    }
    case "del": {
      if (op.collection && op.id) {
        const id = String(resolveValue(op.id, c));
        if (id) await kv.delete(colPrefix(c.site, String(op.collection)) + id);
      } else if (op.key) {
        await kv.delete(kvKey(c.site, String(resolveValue(op.key, c))));
      } else {
        throw new BackendError("del 需要 collection+id 或 key", 400);
      }
      return null;
    }
    case "kvGet": {
      const key = String(resolveValue(op.key, c));
      if (!KEY_RE.test(key)) throw new BackendError("kvGet 的 key 不合法", 400);
      c.vars[String(op.as || key)] = (await kv.get(kvKey(c.site, key))) ?? null;
      return null;
    }
    case "kvPut": {
      const key = String(resolveValue(op.key, c));
      if (!KEY_RE.test(key)) throw new BackendError("kvPut 的 key 不合法", 400);
      const val = resolveValue(op.value, c);
      await kv.put(kvKey(c.site, key), typeof val === "string" ? val : JSON.stringify(val));
      return null;
    }
    case "checkToken": {
      const from = op.from === "query" ? "query" : "header";
      const name = String(op.name || "");
      const expect = String(resolveValue(op.equals, c) ?? "");
      const given = from === "query" ? c.url.searchParams.get(name) || "" : c.request.headers.get(name) || "";
      if (!name || given !== expect) throw new BackendError("鉴权失败", 401);
      return null;
    }
    case "rateLimit": {
      const max = Math.min(Math.max(Number(op.max) || 60, 1), 10000);
      const windowSec = Math.min(Math.max(Number(op.windowSec) || 3600, 1), 86400);
      const name = op.key ? String(op.key) : "default";
      return await rateLimitCheck(kv, c.site, name, ip, max, windowSec);
    }
    case "setStatus":
      c.status = Math.min(Math.max(Number(op.code) || 200, 100), 599);
      return null;
    case "returnJson": {
      const body = resolveValue(op.body, c);
      return jsonResp(body === undefined ? { ok: true } : body, c.status);
    }
    case "returnText":
      return new Response(String(resolveValue(op.body, c) ?? ""), {
        status: c.status,
        headers: { "Content-Type": String(op.contentType || "text/plain; charset=utf-8"), "Cache-Control": "no-store", ...secHeaders() },
      });
    case "redirect": {
      const target = String(resolveValue(op.url, c) || "");
      if (!/^https?:\/\//i.test(target) && !target.startsWith("/")) throw new BackendError("redirect 的 url 不合法", 400);
      return new Response(null, { status: Number(op.code) === 301 ? 301 : 302, headers: { Location: target, ...secHeaders() } });
    }
    default:
      throw new BackendError(`未知的操作：${kind}`, 400);
  }
}

async function runRoute(kv, route, c, ip) {
  c.status = 200;
  const ops = Array.isArray(route.ops) ? route.ops : [];
  for (const op of ops) {
    if (!op || typeof op !== "object") continue;
    const out = await runOp(kv, op, c, ip);
    if (out) return out; // 终端操作（returnJson / returnText / redirect）
  }
  return new Response(null, { status: 204, headers: { ...secHeaders() } });
}

// ---------- 默认 api/submit ----------
async function defaultSubmit(kv, request, site, method, ip) {
  if (method === "POST") {
    const rl = await rateLimitCheck(kv, site, "submit", ip, SUBMIT_RATE_MAX, SUBMIT_RATE_WINDOW);
    if (rl) return rl;
    const body = await readBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BackendError("请提交一个 JSON 对象", 400);
    }
    const id = genId();
    const rec = { ...body, id, ts: Date.now() };
    await kv.put(colPrefix(site, "submit") + id, JSON.stringify(rec));
    return jsonResp({ ok: true, id });
  }
  // GET / HEAD：返回最近记录（裸数组，前端 await res.json() 直接得到数组）
  const items = await listCollection(kv, site, "submit", DEFAULT_LIST);
  return jsonResp(items);
}

// ---------- 主入口 ----------
// 返回 Response 表示命中后端；返回 null 表示没有任何后端路由匹配（调用方回退静态服务）。
// opts.checkExpired：由 index.js 注入的过期检查（引擎自身不接触 GitHub 配置），返回 true 表示已过期。
export async function handleBackendRequest(env, request, site, apiPath, ctx, opts = {}) {
  const kv = env.BAYKV;
  const method = request.method.toUpperCase();

  let cfg = null;
  try {
    cfg = await kv.get(cfgKey(site), { type: "json" });
  } catch {
    cfg = null;
  }

  const route =
    cfg && Array.isArray(cfg.routes)
      ? cfg.routes.find((r) => r && r.path === apiPath && METHODS.has(String(r.method || "GET").toUpperCase()) && String(r.method || "GET").toUpperCase() === method)
      : null;

  if (!route && apiPath !== "api/submit") return null;

  if (typeof opts.checkExpired === "function" && (await opts.checkExpired())) {
    return jsonResp({ ok: false, error: "该站点已过期下线" }, 410);
  }

  const ip = clientIp(request);
  const c = {
    site,
    now: Date.now(),
    request,
    url: new URL(request.url),
    body: {},
    query: {},
    headers: {},
    vars: {},
    status: 200,
  };

  try {
    if (route) return await runRoute(kv, route, c, ip);
    return await defaultSubmit(kv, request, site, method, ip);
  } catch (e) {
    if (e instanceof BackendError) return jsonResp({ ok: false, error: e.message }, e.status);
    throw e;
  }
}

// ---------- 删除站点时清空其后端数据 ----------
export async function deleteKVPrefix(env, prefix) {
  if (!hasKV(env)) return;
  let cursor;
  let guard = 0;
  try {
    do {
      const page = await env.BAYKV.list({ prefix, ...(cursor ? { cursor } : {}) });
      const names = (page.keys || []).map((k) => k.name);
      await Promise.all(names.map((n) => env.BAYKV.delete(n).catch(() => {})));
      if (page.list_complete) break;
      cursor = page.cursor;
    } while (++guard < 50); // 单次调用最多清理约 50 页
  } catch {
    /* KV 故障不阻断删除主流程 */
  }
}

// ---------- 上传时抽取与校验 bay-config ----------
// 从 HTML 里抽取 <script type="application/json" id="bay-config"> 声明。
// 未嵌入返回 null；嵌入了但不是合法 JSON 或结构不合法时抛 BackendError（上传失败并给出明确提示）。
export function extractBayConfig(html) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const attrs = m[1] || "";
    if (!/type\s*=\s*["']application\/json["']/i.test(attrs)) continue;
    if (!/id\s*=\s*["']bay-config["']/i.test(attrs)) continue;
    const raw = (m[2] || "").trim();
    if (!raw) throw new BackendError("页面里嵌入了 bay-config 但内容为空", 400);
    let cfg;
    try {
      cfg = JSON.parse(raw);
    } catch {
      throw new BackendError("页面里嵌入了 bay-config，但不是合法 JSON，无法开通自定义后端", 400);
    }
    return validateBackendConfig(cfg);
  }
  return null;
}

export function validateBackendConfig(cfg) {
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) {
    throw new BackendError("bay-config 必须是一个 JSON 对象", 400);
  }
  const routes = cfg.routes;
  if (!Array.isArray(routes) || routes.length === 0) throw new BackendError("bay-config.routes 必须是非空数组", 400);
  if (routes.length > MAX_ROUTES) throw new BackendError(`bay-config 路由数超过上限（${MAX_ROUTES}）`, 400);

  const normalized = [];
  for (const r of routes) {
    if (!r || typeof r !== "object") throw new BackendError("bay-config 路由必须是对象", 400);
    const path = String(r.path || "");
    if (!ROUTE_PATH_RE.test(path)) throw new BackendError(`路由路径不合法：${path}（需形如 api/xxx，仅小写字母数字下划线连字符）`, 400);
    const method = String(r.method || "GET").toUpperCase();
    if (!METHODS.has(method)) throw new BackendError(`路由 ${path} 的 method 不合法（可选 GET/POST/HEAD）`, 400);
    const ops = r.ops;
    if (!Array.isArray(ops) || ops.length === 0) throw new BackendError(`路由 ${path} 的 ops 必须是非空数组`, 400);
    if (ops.length > MAX_OPS) throw new BackendError(`路由 ${path} 的操作数超过上限（${MAX_OPS}）`, 400);
    for (const op of ops) {
      if (!op || typeof op !== "object" || !OPS.has(op.op)) {
        throw new BackendError(`路由 ${path} 含未知操作：${op && op.op ? op.op : JSON.stringify(op)}`, 400);
      }
      if (JSON.stringify(op).length > MAX_OP_JSON) throw new BackendError(`路由 ${path} 的单个操作过大`, 400);
      if ((op.op === "append" || op.op === "list") && !KEY_RE.test(String(op.collection || ""))) {
        throw new BackendError(`路由 ${path} 的 collection 名不合法（仅小写字母数字下划线连字符，1-40 位）`, 400);
      }
      if ((op.op === "kvGet" || op.op === "kvPut") && !KEY_RE.test(String(op.key || ""))) {
        throw new BackendError(`路由 ${path} 的 key 不合法（仅小写字母数字下划线连字符，1-40 位）`, 400);
      }
    }
    normalized.push({ path, method, ops });
  }
  return { version: 1, routes: normalized };
}

// ---------- AI 指南页（/ai，供网页版 AI / Agent 阅读的生成规则） ----------
// 传入当前访问域名（origin），页内「去哪里发布」的地址随之自动变化，换域名无需改代码。
export function buildAiGuide(origin) {
  const site = origin || "https://dxxx.cc.cd";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI 生成页面规则 · 网页托管舱</title>
<style>body{font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;max-width:760px;margin:32px auto;padding:0 20px;line-height:1.7;color:#1d1d1f}h1{font-size:24px}h2{font-size:18px;margin-top:28px;border-bottom:1px solid #e8e8ed;padding-bottom:6px}code,pre{background:#f5f5f7;border-radius:6px;padding:2px 6px;font-size:13px}pre{padding:12px;overflow:auto}h3{font-size:15px;margin-top:20px}li{margin:6px 0}</style>
</head>
<body>
<h1>本托管平台 · AI 生成页面规则（务必逐条遵守）</h1>

<p>先判断你是哪一类，按对应规则产出；<strong>第 3 节的通用要求 A / B 都适用</strong>：</p>
<ul>
  <li><strong>A. 网页版 AI</strong>（ChatGPT / 豆包 / Claude 等对话网页，只能给一段文本）：产出<strong>单个 index.html</strong>，见第 1 节。</li>
  <li><strong>B. Agent / 编程助手</strong>（能新建文件、能打包 ZIP）：产出<strong>一个 ZIP</strong>，内部可含多个文件，见第 2 节。</li>
  <li><strong>输出完成后</strong>：必须告诉用户去哪里粘贴 / 上传发布（见第 5 节）。</li>
</ul>

<h2>1. 网页版 AI：输出单个 index.html</h2>
<ul>
  <li>只输出<strong>一个 index.html</strong>，所有 CSS/JS 内联，<strong>不引用任何外部库、字体、CSS、图片或 API</strong>——外链都不会被托管，会加载失败。</li>
  <li>字体只用系统字体栈：<code>font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;</code></li>
  <li>文件尽量小（建议 &lt; 300KB）；平台<strong>单文件上限 3MB</strong>，超限无法上传。</li>
</ul>

<h2>2. Agent：输出一个 ZIP（可含多文件）</h2>
<ul>
  <li>产物是<strong>一个 ZIP 包</strong>，包内<strong>根目录必须有 index.html</strong>（外层多余文件夹平台会自动剥离）。</li>
  <li>可以有多个文件：本地 <code>.js</code> / <code>.css</code> / 图片等资源，用<strong>相对路径</strong>引用（如 <code>./assets/app.js</code>）。</li>
  <li><strong>仍禁止外链</strong>：不引用 CDN、外部字体、外部图片、第三方接口，所有资源都要随 ZIP 一起打包。</li>
  <li>页面在<strong>子目录</strong>时，引用资源与后端接口的相对路径要按层级写对（如 <code>sub/index.html</code> 里用 <code>../api/submit</code>）。</li>
  <li><strong>打包前必须自查体积</strong>（超限会被平台直接拒绝）：解压后<strong>总量 ≤ 10MB</strong>、<strong>单个文件 ≤ 3MB</strong>、<strong>文件数 ≤ 200</strong>；超了就先删冗余资源、压缩图片再打包。</li>
</ul>

<h2>3. 通用要求（A / B 都适用）</h2>
<h3>3.1 后端约定（存数据用）</h3>
<ul>
  <li>数据用<strong>相对路径</strong> fetch 到 <code>api/submit</code>（前面不要加 / 或域名，否则打到错误地址）。</li>
  <li>POST：body 为 JSON，字段名自定；GET：返回该站点全部提交记录的 JSON 数组（<strong>最多 50 条，按时间倒序</strong>）。</li>
  <li>每条记录建议 ≤ 1KB；<strong>单次请求体 ≤ 256KB</strong>；同一访客每站点每小时最多 <strong>60 次</strong>请求。</li>
  <li>平台已为每个站点预置 api/submit：POST 存全部字段，GET 列出记录。</li>
  <li><strong>只要页面用了后端（fetch api/submit 等），界面上必须显眼提示用户「后端更新约需 1 分钟」</strong>，避免用户以为改动没生效。</li>
</ul>
<h3>3.2 数据有效期（重要，别写错）</h3>
<ul>
  <li><strong>不要写死具体天数</strong>：绝不能在页面里出现「数据有效期 7 天」这类文案。</li>
  <li>站点有效期<strong>由上传者在控制台自己选择</strong>（3 天 / 7 天 / 1 个月），数据随站点一起保留，站点到期后一并清除。</li>
  <li>如需提示，只说「数据随站点保存，站点到期后清除」，不要擅自承诺天数。</li>
</ul>
<h3>3.3 必须自查的 bug（用户是小白，你生成的页面要直接能用）</h3>
<ul>
  <li><strong>不溢出</strong>：容器加 <code>max-width:100%; overflow-wrap:break-word; word-break:break-word;</code>；长文本、长链接、无空格字符串不撑破布局；按钮/卡片在窄屏不溢出。</li>
  <li><strong>响应式</strong>：必须有 <code>&lt;meta name="viewport" content="width=device-width, initial-scale=1"&gt;</code>；用 flex/grid 并在小屏自动换行；在 <strong>320px 宽</strong>下也正常显示。</li>
  <li><strong>防 XSS</strong>：渲染从 api/submit 取回的用户内容时，<strong>必须用 textContent 或先转义</strong>，绝不能用 innerHTML 直接塞用户输入——否则会被他人提交的内容攻击。</li>
  <li><strong>健壮性</strong>：fetch 失败/网络异常要有提示；无数据时有「暂无内容」占位；提交中有 loading 与成功/失败反馈；输入超长时前端先拦截。</li>
  <li><strong>无报错</strong>：浏览器控制台不能有 JS 报错；不要写死绝对路径（如 <code>/api/...</code> 或 <code>http://...</code>）；不要用已废弃/不稳定的 API。</li>
</ul>

<h2>4. 输出前自检清单</h2>
<p>生成后逐项核对，全部通过再输出：① 形态正确（A 单个 index.html；B 一个 ZIP 且根目录有 index.html）② 是否单文件且无任何外链（B 为所有资源已打包、无外链）③ 是否用相对路径 api/submit（子目录层级正确）④ 320px 窄屏是否溢出 ⑤ 长文本/长链接是否换行 ⑥ 渲染用户内容是否防 XSS ⑦ 是否有加载/错误/空态处理 ⑧ 控制台是否零报错 ⑨ 用了后端是否已提示「后端更新约需 1 分钟」⑩ 是否没有写死数据有效期天数 ⑪ 体积是否达标（A &lt; 300KB；B 总量 ≤ 10MB、单文件 ≤ 3MB、文件数 ≤ 200）⑫ 结尾是否已附「去哪里发布」的引导（打开平台地址 + 长按粘贴 / 上传 ZIP）。</p>

<h2>5. 输出后必须告诉用户怎么发布（结尾固定附上）</h2>
<p>代码输出 / 打包完成后，<strong>必须紧接着告诉用户去哪里发布</strong>；当前平台地址是：<code>${site}</code>（结尾照抄即可）。</p>
<ul>
  <li><strong>A 网页版 AI（贴代码）</strong>：告诉用户 —— ① 用手机或电脑浏览器打开 <code>${site}</code>；② 切到「粘贴代码」，在输入框里<strong>长按</strong>再点「粘贴」（<strong>不要点手机键盘上的粘贴键</strong>，常常粘不进去）；③ 填项目名、选有效期（3 天 / 7 天 / 1 个月）→ 点「发布我的网页」→ 复制返回的链接。</li>
  <li><strong>HTML / ZIP 文件</strong>：告诉用户在同一页面把 <code>.html</code> 或 <code>.zip</code> 拖进（或点选）上传框即可。</li>
  <li><strong>B Agent 有能力时代传</strong>：若你可以联网发送请求，可直接调用上传接口替用户发布（见 5.1）；没有联网能力就按上面两步引导用户。</li>
</ul>
<h3>5.1 Agent 直接上传接口</h3>
<pre># 方式一：直接贴 HTML（JSON）
curl -X POST ${site}/api/upload \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"my-site","html":"&lt;h1&gt;hello&lt;/h1&gt;","expiry":"7d"}'

# 方式二：上传 html / zip 文件（multipart）
curl -X POST ${site}/api/upload \\
  -F name=my-site -F expiry=7d -F file=@site.zip</pre>
<ul>
  <li>项目名规则：<code>^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$</code>（小写字母 / 数字 / 连字符，1-40 位，不能用 <code>api</code> / <code>admin</code>）。</li>
  <li><code>expiry</code> 可选 <code>3d</code> / <code>7d</code> / <code>30d</code>，由<strong>用户选择</strong>，不要替用户写死；不填按 7d 处理。</li>
  <li>成功返回 <code>{"ok":true,"name":"名字","url":"/名字/"}</code>；名称被占用返回 <strong>409</strong>，需换名或告知用户。</li>
  <li>上传前先按第 2 节自查体积，超限会被 <strong>413 / 400</strong> 拒绝。</li>
</ul>

<h2>6. 最小示例</h2>
<pre>// 提交
await fetch('api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,text})});
// 读取（渲染前务必转义，禁止 innerHTML 直接插入用户输入）
const list = await (await fetch('api/submit')).json();</pre>
</body>
</html>`;
}

// ---------- robots.txt / sitemap.xml（站点级网络文件，供搜索引擎与 AI 爬虫读取） ----------
// 同样接收当前访问域名（origin），换域名无需改代码。
// 策略：AI 搜索 / 引用型爬虫一律放行（保证 AI 能读到 /ai 生成规则页）；
//       训练型爬虫按 ai-train=no 拒绝；/admin 与 /api/ 不对任何爬虫开放；
//       用户发布的托管站点（/{项目名}/）本身带 noindex，不列入 sitemap。
const AI_SEARCH_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Googlebot",
  "Bingbot",
  "Baiduspider",
];
const AI_TRAIN_BOTS = ["GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "CCBot", "Bytespider", "Amazonbot", "meta-externalagent"];

export function buildRobotsTxt(origin) {
  const site = (origin || "https://dxxx.cc.cd").replace(/\/+$/, "");
  const block = (names, rule) => names.map((n) => `User-agent: ${n}`).join("\n") + "\n" + rule;
  return `# robots.txt · 网页托管舱
# 默认允许抓取平台页面（首页、/ai 生成规则页）。
# 用户发布的托管站点位于 /{项目名}/，响应头已带 noindex，也不列入 sitemap。

User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Content-Signal: search=yes, ai-input=yes, ai-train=no

# AI 搜索 / 引用型爬虫：放行（让 AI 能读到 /ai 规则页）
${block(AI_SEARCH_BOTS, "Allow: /\nDisallow: /admin\nDisallow: /api/")}

# 训练型爬虫：不用于模型训练（ai-train=no）
${block(AI_TRAIN_BOTS, "Disallow: /")}

Sitemap: ${site}/sitemap.xml
`;
}

export function buildSitemap(origin) {
  const site = (origin || "https://dxxx.cc.cd").replace(/\/+$/, "");
  // 只列平台页面（首页、AI 规则页）；托管站点带 noindex，保持不入站
  const urls = [`${site}/`, `${site}/ai`];
  const body = urls.map((u) => `  <url>\n    <loc>${u}</loc>\n  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}
