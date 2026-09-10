// HTML 托管舱 · Cloudflare Worker
// 图形化自助部署：上传 ZIP / HTML → 存入 GitHub 仓库 sites/{项目名}/ → 通过 /{项目名}/ 公开访问

import { UI_HTML, FAVICON_SVG } from "./ui.js";

// ---------- 常量与限制 ----------
const NAME_RE = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/; // 1-40 位，小写字母/数字/连字符
const RESERVED = new Set(["api"]); // 系统保留的项目名
const MAX_FILES = 200; // 单个项目最多文件数
const MAX_FILE_BYTES = 3 * 1024 * 1024; // 单文件上限 3MB
const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 项目总大小上限 10MB
const META_FILE = ".bay.json"; // 站点元数据文件（记录有效期）
const EXPIRY_DAYS = { "3d": 3, "7d": 7, "30d": 30 }; // 有效期选项：3 天 / 7 天 / 1 个月
const DEFAULT_EXPIRY = "7d";

// ---------- 通用工具 ----------
class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function toBase64(bytes) {
  let s = "";
  const CH = 0x8000; // 分块避免调用栈溢出
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(s);
}

// ---------- MIME 兜底表（优先使用 GitHub 返回的 Content-Type） ----------
const MIME = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  svg: "image/svg+xml", webp: "image/webp", avif: "image/avif", ico: "image/x-icon",
  bmp: "image/bmp", txt: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8",
  xml: "application/xml", pdf: "application/pdf", csv: "text/csv; charset=utf-8",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", eot: "application/vnd.ms-fontobject",
  mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
  wasm: "application/wasm", map: "application/json",
};

function mimeFor(path) {
  const i = path.lastIndexOf(".");
  const ext = i >= 0 ? path.slice(i + 1).toLowerCase() : "";
  return MIME[ext] || "application/octet-stream";
}

// ---------- ZIP 解析（零依赖，基于 DecompressionStream("deflate-raw")） ----------
// CP437 高位字符表：非 UTF-8 标志位的历史 zip 文件名解码
const CP437 =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»" +
  "░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠╬╧╨╤╥╙╘╒╓╖╗╝┘┌█▄▌▐▀" +
  "αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

function decodeZipName(bytes, isUtf8) {
  if (isUtf8) return new TextDecoder("utf-8").decode(bytes);
  let s = "";
  for (const b of bytes) s += b < 128 ? String.fromCharCode(b) : CP437[b - 128];
  return s;
}

async function inflateRaw(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// 解析 zip，返回原始条目 [{path, bytes}]（未做根目录归一化）
async function extractZip(buf) {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  if (u8.length < 22) throw new UserError("无效的 ZIP 文件（太小）");

  // 定位 EOCD（中央目录结尾记录）
  const scanFrom = Math.max(0, u8.length - 65557);
  let eocd = -1;
  for (let i = u8.length - 22; i >= scanFrom; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new UserError("无效的 ZIP 文件（未找到中央目录）");
  const count = dv.getUint16(eocd + 10, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  if (count === 0xffff || cdOffset === 0xffffffff) throw new UserError("暂不支持 Zip64 格式的压缩包");

  // 读取中央目录
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) {
      throw new UserError("无效的 ZIP 文件（中央目录损坏）");
    }
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = decodeZipName(u8.subarray(p + 46, p + 46 + nameLen), (flags & 0x800) !== 0);
    entries.push({ method, compSize, localOffset, name });
    p += 46 + nameLen + extraLen + commentLen;
  }

  // 读取文件内容
  const files = [];
  for (const e of entries) {
    if (e.name.endsWith("/")) continue; // 目录条目
    // 清洗路径：统一分隔符、去掉前导 ./
    let n = e.name.replace(/\\/g, "/").replace(/^\.?\//, "").replace(/\/{2,}/g, "/");
    if (!n) continue;
    // 过滤系统垃圾文件
    if (n === ".DS_Store" || n.endsWith("/.DS_Store") || n.includes("/__MACOSX/") || n.startsWith("__MACOSX/") || n.endsWith("Thumbs.db")) continue;
    if (n.split("/").includes("..")) throw new UserError("ZIP 中含有非法路径（..），请重新打包");

    if (e.localOffset + 30 > u8.length || dv.getUint32(e.localOffset, true) !== 0x04034b50) {
      throw new UserError("无效的 ZIP 文件（本地文件头损坏）");
    }
    const ln = dv.getUint16(e.localOffset + 26, true);
    const le = dv.getUint16(e.localOffset + 28, true);
    const start = e.localOffset + 30 + ln + le;
    const data = u8.subarray(start, start + e.compSize);
    let out;
    if (e.method === 0) out = data.slice(); // stored
    else if (e.method === 8) out = await inflateRaw(data); // deflate
    else throw new UserError(`ZIP 中使用了不支持的压缩方式（method ${e.method}）`);
    files.push({ path: n, bytes: out });
  }
  return files;
}

// 归一化站点文件：剥离公共根目录，保证 index.html 位于根
function normalizeSiteFiles(entries) {
  if (!entries.length) throw new UserError("ZIP 中没有文件");

  // 去重
  const seen = new Map();
  for (const e of entries) if (!seen.has(e.path)) seen.set(e.path, e);
  let list = [...seen.values()];

  // 1) 剥离所有文件的最长公共目录前缀（处理"整个站点被包了一层文件夹"的 zip）
  const paths = list.map((e) => e.path);
  let segs = paths[0].split("/");
  segs.pop();
  for (const p of paths) {
    const s = p.split("/");
    s.pop();
    let i = 0;
    while (i < segs.length && i < s.length && segs[i] === s[i]) i++;
    segs = segs.slice(0, i);
  }
  if (segs.length) {
    const prefix = segs.join("/") + "/";
    list = list.map((e) => ({ ...e, path: e.path.slice(prefix.length) })).filter((e) => e.path !== "");
  }

  // 2) 保证 index.html 在根：若根上没有，则取最浅层的 index.html 所在目录作为站点根
  const rootIndex = list.find((e) => e.path.toLowerCase() === "index.html");
  if (!rootIndex) {
    const indexes = list
      .filter((e) => e.path.toLowerCase().endsWith("/index.html"))
      .sort((a, b) => a.path.split("/").length - b.path.split("/").length);
    if (!indexes.length) throw new UserError("ZIP 中必须包含 index.html");
    const dir = indexes[0].path.slice(0, indexes[0].path.length - 10); // "index.html".length === 10
    list = list.filter((e) => e.path.startsWith(dir)).map((e) => ({ ...e, path: e.path.slice(dir.length) }));
  }

  // 3) 根 index 大小写归一（如 Index.HTML → index.html），保证 /{项目名}/ 可直接命中
  const idx = list.find((e) => e.path.toLowerCase() === "index.html");
  if (idx && idx.path !== "index.html") idx.path = "index.html";

  return list;
}

// ---------- GitHub REST API ----------
function ghConfig(env) {
  const token = env.GH_TOKEN;
  const owner = env.GH_OWNER;
  const repo = env.GH_REPO;
  if (!token || !owner || !repo) {
    throw new UserError("环境变量未配置完整：需要 GH_TOKEN / GH_OWNER / GH_REPO（见 wrangler.toml 与 wrangler secret）", 500);
  }
  return { api: env.GH_API || "https://api.github.com", owner, repo, token, branch: env.GH_BRANCH || "main" };
}

async function ghFetch(env, path, init = {}) {
  const { api, token } = ghConfig(env);
  return fetch(api + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "html-hosting-worker",
      ...(init.headers || {}),
    },
  });
}

async function ghErrorDetail(res) {
  try {
    const j = await res.json();
    return j.message ? ` ${res.status}: ${j.message}` : ` ${res.status}`;
  } catch {
    return ` ${res.status}`;
  }
}

// 获取仓库 sites/ 下的全部文件（树扫描）；分支/仓库不存在返回 null
async function getTree(env) {
  const { owner, repo, branch } = ghConfig(env);
  const res = await ghFetch(env, `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  if (res.status === 404) return null;
  if (res.status === 401) throw new UserError("GitHub Token 无效或未授权 (401)，请检查 GH_TOKEN", 502);
  if (res.status === 403) throw new UserError("GitHub 拒绝访问 (403)：Token 权限不足或触发限流", 502);
  if (!res.ok) throw new UserError("GitHub API 请求失败" + (await ghErrorDetail(res)), 502);
  const data = await res.json();
  return (data.tree || []).filter((it) => it.type === "blob" && it.path.startsWith("sites/"));
}

// 由文件树聚合出项目列表 Map<name, {name, files, size, paths}>
function sitesFromTree(blobs) {
  const sites = new Map();
  for (const it of blobs) {
    const rest = it.path.slice(6); // 去掉 "sites/"
    const slash = rest.indexOf("/");
    if (slash <= 0) continue;
    const name = rest.slice(0, slash);
    const s = sites.get(name) || { name, files: 0, size: 0, paths: [] };
    s.files += 1;
    s.size += it.size || 0;
    s.paths.push(it);
    sites.set(name, s);
  }
  return sites;
}

// 读取站点元数据（有效期）；无元数据或读取失败视为长期有效
async function getMeta(env, name) {
  const { api, owner, repo, branch, token } = ghConfig(env);
  const url = `${api}/repos/${owner}/${repo}/contents/${encodePath(`sites/${name}/${META_FILE}`)}?ref=${encodeURIComponent(branch)}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github.raw",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "html-hosting-worker",
      },
      cf: { cacheTtl: 300, cacheEverything: true }, // 边缘缓存 5 分钟
    });
    if (!res.ok) return null;
    const j = JSON.parse(await res.text());
    return j && typeof j.expire_at === "number" ? j : null;
  } catch {
    return null;
  }
}

const isExpired = (meta, now = Date.now()) => !!meta && meta.expire_at <= now;

// 删除站点全部文件（含元数据）；逐个删除，失败不中断
async function deleteSite(env, name, blobs) {
  const { owner, repo, branch } = ghConfig(env);
  for (const it of blobs) {
    const res = await ghFetch(env, `/repos/${owner}/${repo}/contents/${encodePath(it.path)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: `cleanup(html-hosting): 过期删除 ${name}`, sha: it.sha, branch }),
    });
    if (!res.ok && res.status !== 404 && res.status !== 409) {
      // 尽力而为：单个失败不影响其余文件
    }
  }
}

// 项目列表接口：附带有效期信息，顺带异步清理已过期站点
async function handleListSites(env, ctx) {
  const blobs = await getTree(env);
  if (blobs === null) {
    return { sites: [], warning: "仓库或分支未找到，请检查 GH_OWNER / GH_REPO / GH_BRANCH 配置" };
  }
  const sites = sitesFromTree(blobs);
  const out = [];
  const expired = [];
  const now = Date.now();
  for (const s of sites.values()) {
    const meta = await getMeta(env, s.name);
    const item = { name: s.name, files: s.files, size: s.size, expire_at: meta ? meta.expire_at : null };
    if (isExpired(meta, now)) {
      item.expired = true;
      expired.push(s);
    }
    out.push(item);
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  if (expired.length && ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(Promise.allSettled(expired.map((s) => deleteSite(env, s.name, s.paths))));
  }
  return { sites: out };
}

// 写入单个文件到仓库
async function putFile(env, sitePath, bytes, message) {
  const { owner, repo, branch } = ghConfig(env);
  const res = await ghFetch(env, `/repos/${owner}/${repo}/contents/${encodePath(sitePath)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, branch, content: toBase64(bytes) }),
  });
  if (!res.ok) {
    // 并发竞态：文件已存在但未提供 sha 时 GitHub 返回 422
    if (res.status === 422 || res.status === 409) {
      throw new UserError("项目名已被占用（检测到写入冲突）", 409);
    }
    if (res.status === 401) throw new UserError("GitHub Token 无效或未授权 (401)，请检查 GH_TOKEN", 502);
    if (res.status === 403) throw new UserError("GitHub 拒绝写入 (403)：Token 权限不足或触发限流", 502);
    throw new UserError("写入 GitHub 失败" + (await ghErrorDetail(res)), 502);
  }
}

// 从仓库读取并回源渲染站点文件；过期站点返回 410 并异步清理
async function serveFile(env, name, path, ctx) {
  // ---- 有效期检查 ----
  const meta = await getMeta(env, name);
  if (isExpired(meta)) {
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(
        (async () => {
          const blobs = await getTree(env);
          if (!blobs) return;
          const s = sitesFromTree(blobs).get(name);
          if (s) await deleteSite(env, name, s.paths);
        })()
      );
    }
    return expiredPage();
  }

  const { api, owner, repo, branch, token } = ghConfig(env);
  const url = `${api}/repos/${owner}/${repo}/contents/${encodePath(`sites/${name}/${path}`)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github.raw",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "html-hosting-worker",
    },
    cf: { cacheTtl: 300, cacheEverything: true }, // 边缘缓存 5 分钟
  });
  if (res.status === 404) return notFoundPage();
  if (!res.ok) throw new UserError("回源 GitHub 失败" + (await ghErrorDetail(res)), 502);

  // 优先透传 GitHub 的 Content-Type，缺失时按扩展名兜底
  let ct = res.headers.get("content-type") || "";
  if (!ct || ct === "application/octet-stream") ct = mimeFor(path);
  else if (/^(text\/|image\/svg|application\/(json|javascript|xml))/.test(ct) && !ct.includes("charset")) {
    ct += "; charset=utf-8";
  }
  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// ---------- 业务处理 ----------
function validateName(raw) {
  if (typeof raw !== "string" || !raw.trim()) throw new UserError("请填写项目名");
  const name = raw.trim().toLowerCase();
  if (name.length > 40) throw new UserError("项目名过长（最多 40 个字符）");
  if (!NAME_RE.test(name)) throw new UserError("项目名只能包含小写字母、数字、连字符，且以字母或数字开头和结尾");
  if (RESERVED.has(name)) throw new UserError("该名称为系统保留字，请更换");
  return name;
}

async function handleUpload(request, env) {
  const ct = request.headers.get("content-type") || "";
  let name, file, htmlText, expiry = DEFAULT_EXPIRY;

  if (ct.includes("multipart/form-data")) {
    const fd = await request.formData();
    name = fd.get("name");
    expiry = fd.get("expiry") || DEFAULT_EXPIRY;
    const f = fd.get("file");
    if (f && typeof f === "object" && typeof f.arrayBuffer === "function") file = f;
    else htmlText = fd.get("html");
  } else if (ct.includes("application/json")) {
    let body;
    try {
      body = await request.json();
    } catch {
      throw new UserError("请求体不是合法的 JSON");
    }
    name = body.name;
    htmlText = body.html;
    expiry = body.expiry || DEFAULT_EXPIRY;
  } else {
    throw new UserError("不支持的请求类型，请使用 multipart/form-data 或 application/json", 415);
  }

  name = validateName(name);
  if (!(expiry in EXPIRY_DAYS)) throw new UserError("有效期选项不合法（可选：3d / 7d / 30d）");

  // ---- 解析出待写入文件（始终保证根上有 index.html） ----
  let files; // [{path, bytes}]
  if (file) {
    const fname = (file.name || "").toLowerCase();
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const isZip = fname.endsWith(".zip") || (head[0] === 0x50 && head[1] === 0x4b && head[2] === 3 && head[3] === 4);
    if (isZip) {
      const buf = await file.arrayBuffer();
      if (buf.byteLength > MAX_TOTAL_BYTES) throw new UserError("压缩包超过 10MB 上限", 413);
      files = normalizeSiteFiles(await extractZip(buf));
    } else if (fname.endsWith(".html") || fname.endsWith(".htm")) {
      files = [{ path: "index.html", bytes: new Uint8Array(await file.arrayBuffer()) }];
    } else {
      throw new UserError("仅支持 .zip（内含 index.html）或 .html 文件");
    }
  } else if (typeof htmlText === "string" && htmlText.trim()) {
    files = [{ path: "index.html", bytes: new TextEncoder().encode(htmlText) }];
  } else {
    throw new UserError("请上传 ZIP / HTML 文件，或粘贴 HTML 内容");
  }

  // ---- 大小限制 ----
  if (files.length > MAX_FILES) throw new UserError(`文件数超过上限（${MAX_FILES} 个）`, 413);
  if (files.some((f) => f.bytes.length > MAX_FILE_BYTES)) throw new UserError("单个文件超过 3MB 上限", 413);
  const total = files.reduce((s, f) => s + f.bytes.length, 0);
  if (total > MAX_TOTAL_BYTES) throw new UserError("项目总大小超过 10MB 上限", 413);

  // ---- 项目名唯一性校验（过期的项目自动清理后可复用名称） ----
  const blobs = await getTree(env);
  const existing = sitesFromTree(blobs || []).get(name);
  if (existing) {
    const meta = await getMeta(env, name);
    if (!isExpired(meta)) {
      throw new UserError(`项目名 "${name}" 已被占用，请更换一个`, 409);
    }
    await deleteSite(env, name, existing.paths); // 已过期：清理后复用
  }

  // ---- 逐个文件顺序提交（避免 GitHub 并发提交限制） ----
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    await putFile(env, `sites/${name}/${f.path}`, f.bytes, `deploy(html-hosting): ${name} (${i + 1}/${files.length}) ${f.path}`);
  }

  // ---- 写入有效期元数据 ----
  const now = Date.now();
  const meta = JSON.stringify({ v: 1, created_at: now, expire_at: now + EXPIRY_DAYS[expiry] * 86400000 });
  await putFile(env, `sites/${name}/${META_FILE}`, new TextEncoder().encode(meta), `meta(html-hosting): ${name} 有效期 ${expiry}`);

  return json({ ok: true, name, url: `/${name}/`, files: files.length, expiry_days: EXPIRY_DAYS[expiry] });
}

async function handleHealth(env) {
  const missing = ["GH_TOKEN", "GH_OWNER", "GH_REPO"].filter((k) => !env[k]);
  const out = { ok: true, configured: missing.length === 0, missing };
  if (out.configured) {
    try {
      const r = await ghFetch(env, "/user");
      out.token_valid = r.ok;
      if (!r.ok) out.detail = r.status === 401 ? "Token 无效 (401)" : `GitHub 返回 ${r.status}`;
    } catch {
      out.token_valid = false;
      out.detail = "无法连接 GitHub API";
    }
  }
  return json(out);
}

// ---------- 路由 ----------
const notFoundPage = () =>
  new Response(
    `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>404 · HTML 托管舱</title><style>body{background:#0a0f0c;color:#d9e6de;font-family:ui-monospace,monospace;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}div{text-align:center;border:1px solid #1e2d24;padding:48px 64px}h1{color:#3dff8b;font-size:64px;margin:0 0 8px}p{color:#7d968a}a{color:#3dff8b}</style></head><body><div><h1>404</h1><p>未找到站点或文件</p><p><a href="/">← 返回托管舱</a></p></div></body></html>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );

const expiredPage = () =>
  new Response(
    `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>410 · HTML 托管舱</title><style>body{background:#0a0f0c;color:#d9e6de;font-family:ui-monospace,monospace;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}div{text-align:center;border:1px solid #1e2d24;padding:48px 64px}h1{color:#ffb454;font-size:64px;margin:0 0 8px}p{color:#7d968a}a{color:#3dff8b}</style></head><body><div><h1>410</h1><p>该站点已过期并被清理</p><p><a href="/">← 返回托管舱重新部署</a></p></div></body></html>`,
    { status: 410, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );

// 解码 URL 路径分段并做安全校验（拒绝 ../ 穿越）
function safeSegments(pathname) {
  const segs = [];
  for (const raw of pathname.slice(1).split("/")) {
    let s;
    try {
      s = decodeURIComponent(raw);
    } catch {
      return null;
    }
    if (s === "" || s === ".") continue;
    if (s === ".." || s.includes("\0")) return null;
    segs.push(s);
  }
  return segs;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const { pathname } = url;

    try {
      // ---- 控制台页面 ----
      if (method === "GET" && (pathname === "/" || pathname === "/index.html")) {
        return new Response(UI_HTML, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
        });
      }
      if (pathname === "/favicon.ico") {
        return new Response(FAVICON_SVG, {
          headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
        });
      }

      // ---- API ----
      if (pathname === "/api/sites" && (method === "GET" || method === "HEAD")) {
        const { sites, warning } = await handleListSites(env, ctx);
        return json({ ok: true, sites, ...(warning ? { warning } : {}) });
      }
      if (pathname === "/api/upload" && method === "POST") {
        return await handleUpload(request, env);
      }
      if (pathname === "/api/health" && (method === "GET" || method === "HEAD")) {
        return await handleHealth(env);
      }
      if (pathname === "/api" || pathname.startsWith("/api/")) {
        return json({ ok: false, error: "未知的 API 路径" }, 404);
      }

      // ---- 站点静态服务 /{项目名}/... ----
      if (method === "GET" || method === "HEAD") {
        const segs = safeSegments(pathname);
        if (segs && segs.length >= 1) {
          const name = segs[0];
          if (NAME_RE.test(name) && !RESERVED.has(name)) {
            const rest = segs.slice(1).join("/");
            if (!rest) {
              // /{项目名} → 301 到 /{项目名}/，保证站内相对路径正确解析
              if (pathname.endsWith("/")) return await serveFile(env, name, "index.html", ctx);
              return new Response(null, { status: 301, headers: { Location: `/${name}/` } });
            }
            // /{项目名}/子目录/ → 自动回退到该目录的 index.html
            const filePath = pathname.endsWith("/") ? `${rest}/index.html` : rest;
            return await serveFile(env, name, filePath, ctx);
          }
        }
        return notFoundPage();
      }

      return json({ ok: false, error: "方法不允许" }, 405);
    } catch (e) {
      if (e instanceof UserError) return json({ ok: false, error: e.message }, e.status || 400);
      return json({ ok: false, error: "服务器内部错误：" + (e && e.message ? e.message : String(e)) }, 500);
    }
  },
};
