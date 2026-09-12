// HTML 托管舱 · Cloudflare Worker
// 图形化自助部署：上传 ZIP / HTML → 存入 GitHub 仓库 sites/{项目名}/ → 通过 /{项目名}/ 公开访问

import { UI_HTML, FAVICON_SVG } from "./ui.js";
import { ADMIN_HTML } from "./admin.js";

// ---------- 常量与限制 ----------
const NAME_RE = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/; // 1-40 位，小写字母/数字/连字符
const RESERVED = new Set(["api", "admin"]); // 系统保留的项目名
const MAX_FILES = 200; // 单个项目最多文件数
const MAX_FILE_BYTES = 3 * 1024 * 1024; // 单文件上限 3MB
const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 项目总大小上限 10MB
const META_FILE = ".bay.json"; // 站点元数据文件（记录有效期与上传 IP）
const BLACKLIST_FILE = ".bay-blacklist.json"; // IP 黑名单文件（仓库根目录）
const EXPIRY_DAYS = { "3d": 3, "7d": 7, "30d": 30 }; // 有效期选项：3 天 / 7 天 / 1 个月
const DEFAULT_EXPIRY = "7d";
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const QUOTA_FILE = ".bay-quota.json"; // IP 上传配额（仓库根目录）
const SETTINGS_FILE = ".bay-settings.json"; // 全局上传开关（仓库根目录）
const DAY_BYTES = 20 * 1024 * 1024; // 单 IP 每日上传上限 20MB
const WEEK_BYTES = 50 * 1024 * 1024; // 单 IP 每周上传上限 50MB
const MAX_REPO_BYTES = 800 * 1024 * 1024; // 仓库容量上限 800MB，达到后停止上传

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

// 读取站点元数据（有效期/上传IP）；无元数据或读取失败时按默认有效期处理，
// 避免历史遗留站点被当作"永久"长期保留。元数据仅在发布/续期/删除时改变，
// 故走边缘缓存，避免每次访问都回源 GitHub
async function getMeta(env, name) {
  try {
    const f = await readRepoFile(env, `sites/${name}/${META_FILE}`, true);
    if (f) {
      const j = JSON.parse(f.text);
      if (j && typeof j.expire_at === "number") return j;
    }
  } catch {
    /* 无元数据或读取失败：按默认有效期处理 */
  }
  // 站点缺少元数据（如本期功能上线前上传的历史站点）时，从当前时间起算补一个默认有效期，
  // 使其不再以"永久"形式存在，到期后按常规流程下线清理
  const now = Date.now();
  return { v: 1, created_at: now, expire_at: now + EXPIRY_DAYS[DEFAULT_EXPIRY] * 86400000 };
}

// 读取站点元数据（含文件 sha，供更新）
async function getMetaWithSha(env, name) {
  const f = await readRepoFile(env, `sites/${name}/${META_FILE}`);
  if (!f) return { meta: null, sha: null };
  let meta = null;
  try {
    const j = JSON.parse(f.text);
    if (j && typeof j.expire_at === "number") meta = j;
  } catch {
    /* 视为无元数据 */
  }
  return { meta, sha: f.sha };
}

const isExpired = (meta, now = Date.now()) => !!meta && meta.expire_at <= now;

// 删除站点全部文件（含元数据）：把 sites/{name} 子树置空后一次提交，速度快且不受文件数影响
async function deleteSite(env, name, blobs) {
  await deleteTree(env, `sites/${name}`, `cleanup(html-hosting): 过期删除 ${name}`);
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
  // 并行读取各站点元数据，避免站点多时逐串行回源导致列表加载缓慢
  const results = await Promise.all(
    [...sites.values()].map(async (s) => {
      const meta = await getMeta(env, s.name);
      const item = { name: s.name, files: s.files, size: s.size, expire_at: meta ? meta.expire_at : null };
      if (isExpired(meta, now)) {
        item.expired = true;
        return { item, s, expired: true };
      }
      return { item, s, expired: false };
    })
  );
  for (const r of results) {
    out.push(r.item);
    if (r.expired) expired.push(r.s);
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  if (expired.length && ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(Promise.allSettled(expired.map((s) => deleteSite(env, s.name, s.paths))));
  }
  return { sites: out };
}

// 写入单个文件到仓库；sha 存在则更新（否则创建）
async function putFile(env, sitePath, bytes, message, sha) {
  const { owner, repo, branch } = ghConfig(env);
  const body = { message, branch, content: toBase64(bytes) };
  if (sha) body.sha = sha;
  const res = await ghFetch(env, `/repos/${owner}/${repo}/contents/${encodePath(sitePath)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // 并发竞态：文件已存在但未提供 sha 时 GitHub 返回 422
    if (res.status === 422 || res.status === 409) {
      throw new UserError("写入冲突：文件已存在（需要 sha 更新）或项目名已被占用", 409);
    }
    if (res.status === 401) throw new UserError("GitHub Token 无效或未授权 (401)，请检查 GH_TOKEN", 502);
    if (res.status === 403) throw new UserError("GitHub 拒绝写入 (403)：Token 权限不足或触发限流", 502);
    throw new UserError("写入 GitHub 失败" + (await ghErrorDetail(res)), 502);
  }
}

// 批量写入多个文件：一次创建 git 树（内联 base64），再创建提交并推进分支引用。
// 相比逐个文件走 contents API（每文件一次子请求），批量提交仅需约 4-5 次请求，
// 以适配 Workers Free 计划"每次调用最多 50 个子请求"的限制（站点文件多时不再报
// "Too many subrequests by single Worker invocation"）。entries: [{ repoPath, bytes }]
// 读取分支头提交 sha 与其根树 sha（批量写入/删除的公共起点）
async function branchHead(env) {
  const { owner, repo, branch } = ghConfig(env);
  const refRes = await ghFetch(env, `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`);
  if (!refRes.ok) throw new UserError("读取分支引用失败" + (await ghErrorDetail(refRes)), 502);
  const ref = await refRes.json();
  const parentSha = ref && ref.object && ref.object.sha;
  if (!parentSha) throw new UserError("无法获取分支头提交", 502);
  const headRes = await ghFetch(env, `/repos/${owner}/${repo}/git/commits/${parentSha}`);
  if (!headRes.ok) throw new UserError("读取分支头提交失败" + (await ghErrorDetail(headRes)), 502);
  const head = await headRes.json();
  return { parentSha, baseTreeSha: head.tree && head.tree.sha };
}

// 基于给定树创建一次提交并推进分支引用（批量写入/删除的公共收尾）
async function commitTree(env, message, treeSha, parentSha) {
  const { owner, repo, branch } = ghConfig(env);
  const commitRes = await ghFetch(env, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
  if (!commitRes.ok) throw new UserError("创建提交失败" + (await ghErrorDetail(commitRes)), 502);
  const commit = await commitRes.json();
  const updRes = await ghFetch(env, `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  if (!updRes.ok) throw new UserError("更新分支引用失败" + (await ghErrorDetail(updRes)), 502);
}

async function commitFiles(env, entries, message) {
  const { owner, repo } = ghConfig(env);
  const { parentSha, baseTreeSha } = await branchHead(env);

  // 一步创建整棵新树（内容内联、base64 编码，mode 100644）
  const treeRes = await ghFetch(env, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: entries.map((e) => ({ path: e.repoPath, mode: "100644", type: "blob", content: toBase64(e.bytes) })),
    }),
  });
  if (!treeRes.ok) throw new UserError("批量写入失败（创建树）" + (await ghErrorDetail(treeRes)), 502);
  const tree = await treeRes.json();

  await commitTree(env, message || `deploy(html-hosting): 批量更新 ${entries.length} 个文件`, tree.sha, parentSha);
}

// 删除整棵子树（如整个站点目录）：创建一棵空树覆盖该目录，再作为一次提交推进分支。
// 相比 contents API 逐文件删除（每文件一次子请求，站点文件多时很慢且易触发 50 上限），
// 这里仅需约 5 次请求，删除任意多文件都是同样的速度。
async function deleteTree(env, path, message) {
  const { owner, repo } = ghConfig(env);
  const { parentSha, baseTreeSha } = await branchHead(env);

  // 1) 空树（代表该目录不再含任何文件）
  const emptyRes = await ghFetch(env, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tree: [] }),
  });
  if (!emptyRes.ok) throw new UserError("删除失败（创建空树）" + (await ghErrorDetail(emptyRes)), 502);
  const empty = await emptyRes.json();

  // 2) 根树中把 path 覆盖为空树，等效删除该目录全部文件
  const treeRes = await ghFetch(env, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: [{ path, mode: "040000", type: "tree", sha: empty.sha }],
    }),
  });
  if (!treeRes.ok) throw new UserError("删除失败（重建树）" + (await ghErrorDetail(treeRes)), 502);
  const tree = await treeRes.json();

  await commitTree(env, message, tree.sha, parentSha);
}

// 读取仓库文件（JSON 模式，返回内容与 sha）；不存在返回 null
// cached=true 时让边缘缓存该响应（仅用于几乎不变的元数据，如 .bay.json），
// 生效命中后不再回源 GitHub，显著降低站点访问的加载延迟（与站点回源同样缓存 5 分钟）。
async function readRepoFile(env, path, cached = false) {
  const { api, owner, repo, branch, token } = ghConfig(env);
  const url = `${api}/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "html-hosting-worker",
    },
    cf: cached ? { cacheTtl: 300, cacheEverything: true } : { cacheEverything: false },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new UserError("读取仓库文件失败" + (await ghErrorDetail(res)), 502);
  const j = await res.json();
  let text;
  if (j.encoding === "base64") {
    const bin = atob(j.content.replace(/\s+/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    text = new TextDecoder().decode(bytes);
  } else {
    text = j.content || "";
  }
  return { text, sha: j.sha };
}

// 写文本文件；sha 存在则更新
async function writeRepoFile(env, path, content, message, sha) {
  await putFile(env, path, new TextEncoder().encode(content), message, sha);
}

// 获取上传者 IP（优先 Cloudflare 连接 IP）
function clientIP(request) {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return null;
}

// ---------- IP 黑名单 ----------
async function getBlacklist(env) {
  try {
    const f = await readRepoFile(env, BLACKLIST_FILE);
    if (!f) return { entries: [], sha: null };
    const j = JSON.parse(f.text);
    return { entries: Array.isArray(j.entries) ? j.entries : [], sha: f.sha };
  } catch {
    return { entries: [], sha: null };
  }
}

async function saveBlacklist(env, entries, sha) {
  await writeRepoFile(
    env,
    BLACKLIST_FILE,
    JSON.stringify({ v: 1, updated_at: Date.now(), entries }),
    "admin(html-hosting): 更新 IP 黑名单",
    sha
  );
}

function isValidIp(s) {
  if (IPV4_RE.test(s)) return s.split(".").every((o) => Number(o) <= 255);
  // IPv6（含压缩形式与 zone 后缀）
  return s.includes(":") && /^[0-9a-fA-F:.%]+$/.test(s);
}

// ---------- 全局上传开关 ----------
async function getSettings(env) {
  try {
    const f = await readRepoFile(env, SETTINGS_FILE);
    if (!f) return { uploads_enabled: true, sha: null };
    const j = JSON.parse(f.text);
    return { uploads_enabled: j.uploads_enabled !== false, sha: f.sha };
  } catch {
    return { uploads_enabled: true, sha: null };
  }
}

async function saveSettings(env, uploadsEnabled, sha) {
  await writeRepoFile(
    env,
    SETTINGS_FILE,
    JSON.stringify({ v: 1, updated_at: Date.now(), uploads_enabled: !!uploadsEnabled }),
    "admin(html-hosting): 更新上传开关",
    sha
  );
}

// 仓库当前体积（GitHub API size 字段为 KB）；读取失败返回 null（不阻断上传）
async function getRepoSizeBytes(env) {
  try {
    const { owner, repo } = ghConfig(env);
    const res = await ghFetch(env, `/repos/${owner}/${repo}`);
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j.size === "number" ? j.size * 1024 : null;
  } catch {
    return null;
  }
}

// 上传前闸门：全局开关 + 仓库容量
async function checkUploadGate(env) {
  const s = await getSettings(env);
  if (!s.uploads_enabled) throw new UserError("管理员已暂时关闭上传功能，请稍后再试", 503);
  const size = await getRepoSizeBytes(env);
  if (size !== null && size >= MAX_REPO_BYTES) throw new UserError("仓库容量已达上限（≥800MB），上传已停止", 503);
}

// ---------- 单 IP 上传配额 ----------
const dayKey = (d) => d.toISOString().slice(0, 10);
const weekKey = (d) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); // 周一为一周起点
  return x.toISOString().slice(0, 10);
};
const fmtMb = (b) => (b / 1024 / 1024).toFixed(1) + "MB";

async function getQuota(env) {
  try {
    const f = await readRepoFile(env, QUOTA_FILE);
    if (!f) return { byIp: {}, sha: null };
    const j = JSON.parse(f.text);
    return { byIp: j.byIp && typeof j.byIp === "object" ? j.byIp : {}, sha: f.sha };
  } catch {
    return { byIp: {}, sha: null };
  }
}

async function saveQuota(env, byIp, sha) {
  await writeRepoFile(
    env,
    QUOTA_FILE,
    JSON.stringify({ v: 1, updated_at: Date.now(), byIp }),
    "quota(html-hosting): 更新上传配额",
    sha
  );
}

// 配额检查：单 IP 每日 ≤ 20MB、每周 ≤ 50MB（UTC 日/周窗口），超限抛 429
async function checkIpQuota(env, ip, addBytes) {
  const q = await getQuota(env);
  const now = new Date();
  const dk = dayKey(now), wk = weekKey(now);
  const rec = q.byIp[ip];
  const dayUsed = rec && rec.d === dk ? rec.db : 0;
  const weekUsed = rec && rec.w === wk ? rec.wb : 0;
  if (dayUsed + addBytes > DAY_BYTES) throw new UserError(`单 IP 每天最多上传 20MB（今天已用 ${fmtMb(dayUsed)}），请明天再试`, 429);
  if (weekUsed + addBytes > WEEK_BYTES) throw new UserError(`单 IP 每周最多上传 50MB（本周已用 ${fmtMb(weekUsed)}），请下周再试`, 429);
}

// 上传成功后才累计配额；记账失败不阻断发布结果
async function consumeIpQuota(env, ip, bytes) {
  try {
    const q = await getQuota(env);
    const now = new Date();
    const dk = dayKey(now), wk = weekKey(now);
    const rec = q.byIp[ip] || {};
    q.byIp[ip] = {
      d: dk,
      db: (rec.d === dk ? rec.db : 0) + bytes,
      w: wk,
      wb: (rec.w === wk ? rec.wb : 0) + bytes,
    };
    await saveQuota(env, q.byIp, q.sha);
  } catch {
    /* 忽略 */
  }
}

// 管理端鉴权
function adminCheck(env, request) {
  const pwd = env.ADMIN_PASSWORD;
  if (!pwd) throw new UserError("管理密码未配置：请设置环境变量 ADMIN_PASSWORD", 500);
  const given = request.headers.get("x-admin-token") || "";
  if (given !== pwd) throw new UserError("密码错误或未登录", 401);
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
      Accept: "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "html-hosting-worker",
    },
    cf: { cacheTtl: 300, cacheEverything: true }, // 边缘缓存 5 分钟
  });
  if (res.status === 404) return notFoundPage();
  if (!res.ok) throw new UserError("回源 GitHub 失败" + (await ghErrorDetail(res)), 502);

  const ghCt = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const myMime = mimeFor(path);

  // GitHub 对 raw 媒体类型可能返回 JSON 信封（base64 元数据）而非原始内容：解码出真实文件
  let body = res.body;
  if (ghCt === "application/json" && !myMime.startsWith("application/json")) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      if (j && typeof j.content === "string" && j.encoding === "base64") {
        const bin = atob(j.content.replace(/\s+/g, ""));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        body = bytes;
      } else {
        body = text;
      }
    } catch {
      body = text;
    }
  }

  // Content-Type 一律以本地扩展名映射为准：GitHub 对 raw 请求会返回
  // application/octet-stream / vnd.github.* 等类型，直接透传会导致浏览器下载而非渲染
  let ct = myMime;
  if (ct === "application/octet-stream" && ghCt && ghCt !== "application/json" && ghCt !== "application/octet-stream" && !ghCt.startsWith("application/vnd.github")) {
    // 仅当扩展名未知时参考 GitHub 返回的类型
    ct = /^(text\/|image\/svg|application\/(javascript|xml))/.test(ghCt) ? ghCt + "; charset=utf-8" : ghCt;
  }

  return new Response(body, {
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

  // ---- 黑名单检查（按上传者 IP） ----
  const ip = clientIP(request);
  if (ip) {
    const bl = await getBlacklist(env);
    if (bl.entries.some((e) => String(e.ip).toLowerCase() === ip.toLowerCase())) {
      throw new UserError("你的 IP 已被加入黑名单，无法发布", 403);
    }
  }

  // ---- 全局闸门：管理员开关 + 仓库容量 ----
  await checkUploadGate(env);

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

  // ---- 单 IP 配额预检（成功发布后才累计） ----
  if (ip) await checkIpQuota(env, ip, total);

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

  // ---- 批量写入全部文件与有效期元数据（单次提交，避免逐文件回源触发子请求上限） ----
  const now = Date.now();
  const meta = JSON.stringify({
    v: 1,
    created_at: now,
    expire_at: now + EXPIRY_DAYS[expiry] * 86400000,
    ...(ip ? { uploader_ip: ip } : {}),
  });
  const entries = files.map((f) => ({ repoPath: `sites/${name}/${f.path}`, bytes: f.bytes }));
  entries.push({ repoPath: `sites/${name}/${META_FILE}`, bytes: new TextEncoder().encode(meta) });
  await commitFiles(env, entries, `deploy(html-hosting): ${name}（${files.length} 个文件）`);

  // ---- 配额记账（发布成功后才累计本次体积） ----
  if (ip) await consumeIpQuota(env, ip, total);

  return json({ ok: true, name, url: `/${name}/`, files: files.length, expiry_days: EXPIRY_DAYS[expiry] });
}

// ---------- 管理端 API ----------
// 列出全部项目（含上传 IP 与有效期）
async function handleAdminSites(env, request) {
  adminCheck(env, request);
  const blobs = await getTree(env);
  if (blobs === null) throw new UserError("仓库或分支未找到，请检查 GH_OWNER / GH_REPO / GH_BRANCH 配置", 502);
  const sites = sitesFromTree(blobs);
  // 并行读取各站点元数据，站点多时避免逐串行回源拖慢后台加载
  const rows = await Promise.all(
    [...sites.values()].map(async (s) => {
      const meta = await getMeta(env, s.name);
      return {
        name: s.name,
        files: s.files,
        size: s.size,
        expire_at: meta ? meta.expire_at : null,
        uploader_ip: meta && meta.uploader_ip ? meta.uploader_ip : null,
      };
    })
  );
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return json({ ok: true, sites: rows });
}

// 删除项目（整个目录）
async function handleAdminDelete(env, request, name) {
  adminCheck(env, request);
  if (!NAME_RE.test(name)) throw new UserError("项目名不合法", 400);
  const blobs = await getTree(env);
  const s = sitesFromTree(blobs || []).get(name);
  if (!s) throw new UserError("项目不存在", 404);
  await deleteSite(env, name, s.paths);
  return json({ ok: true, name });
}

// 续期：把过期时间向后顺延 days 天（已过期则从现在算起）
async function handleAdminRenew(env, request, name) {
  adminCheck(env, request);
  if (!NAME_RE.test(name)) throw new UserError("项目名不合法", 400);
  let body = {};
  try {
    body = await request.json();
  } catch {
    /* 缺省 */
  }
  const days = Number(body.days);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new UserError("续期天数需为 1-365 的整数", 400);

  const blobs = await getTree(env);
  const s = sitesFromTree(blobs || []).get(name);
  if (!s) throw new UserError("项目不存在", 404);

  const { meta, sha } = await getMetaWithSha(env, name);
  const now = Date.now();
  const base = meta ? Math.max(meta.expire_at, now) : now;
  const next = { ...(meta || {}), v: 1, expire_at: base + days * 86400000, renewed_at: now };
  await writeRepoFile(env, `sites/${name}/${META_FILE}`, JSON.stringify(next), `admin(html-hosting): ${name} 续期 ${days} 天`, sha || undefined);
  return json({ ok: true, name, expire_at: next.expire_at, days });
}

// 黑名单：读取
async function handleBlacklistGet(env, request) {
  adminCheck(env, request);
  const bl = await getBlacklist(env);
  return json({ ok: true, entries: bl.entries });
}

// 黑名单：添加
async function handleBlacklistAdd(env, request) {
  adminCheck(env, request);
  let body;
  try {
    body = await request.json();
  } catch {
    throw new UserError("请求体不是合法的 JSON");
  }
  const ip = (body.ip || "").trim().toLowerCase();
  if (!ip) throw new UserError("请填写要拉黑的 IP", 400);
  if (!isValidIp(ip)) throw new UserError("IP 格式不正确", 400);
  const note = (body.note || "").trim().slice(0, 100);
  const bl = await getBlacklist(env);
  if (!bl.entries.some((e) => e.ip === ip)) {
    bl.entries.push({ ip, note, added_at: Date.now() });
  }
  await saveBlacklist(env, bl.entries, bl.sha);
  return json({ ok: true, ip });
}

// 黑名单：移除
async function handleBlacklistRemove(env, request, ip) {
  adminCheck(env, request);
  ip = ip.toLowerCase();
  const bl = await getBlacklist(env);
  const next = bl.entries.filter((e) => e.ip !== ip);
  if (next.length === bl.entries.length) throw new UserError("该 IP 不在黑名单中", 404);
  await saveBlacklist(env, next, bl.sha);
  return json({ ok: true, ip });
}

// 全局设置：读取（含仓库体积与上限）
async function handleSettingsGet(env, request) {
  adminCheck(env, request);
  const s = await getSettings(env);
  const size = await getRepoSizeBytes(env);
  return json({
    ok: true,
    uploads_enabled: s.uploads_enabled,
    repo_size_bytes: size,
    max_repo_bytes: MAX_REPO_BYTES,
  });
}

// 全局设置：修改上传开关
async function handleSettingsSet(env, request) {
  adminCheck(env, request);
  let body;
  try {
    body = await request.json();
  } catch {
    throw new UserError("请求体不是合法的 JSON");
  }
  if (typeof body.uploads_enabled !== "boolean") throw new UserError("uploads_enabled 需为布尔值", 400);
  const s = await getSettings(env);
  await saveSettings(env, body.uploads_enabled, s.sha);
  return json({ ok: true, uploads_enabled: body.uploads_enabled });
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
// 苹果风格错误页（浅色 · 与控制台一致）
const errorPage = (code, title, desc) =>
  new Response(
    `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${code} · 网页托管舱</title><style>body{background:#f5f5f7;color:#1d1d1f;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;-webkit-font-smoothing:antialiased}div{text-align:center;padding:48px 40px;background:#fff;border-radius:24px;box-shadow:0 4px 24px rgba(0,0,0,.06);max-width:400px;margin:24px}h1{font-size:56px;margin:0 0 6px;letter-spacing:-.03em;background:linear-gradient(180deg,#1d1d1f 60%,#6e6e73);-webkit-background-clip:text;background-clip:text;color:transparent}p{color:#6e6e73;font-size:15px;line-height:1.6;margin:0 0 22px}a{display:inline-block;background:#0071e3;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:11px 26px;border-radius:980px;transition:background .2s}a:hover{background:#0068d0}</style></head><body><div><h1>${code}</h1><p><b style="color:#1d1d1f">${title}</b><br>${desc}</p><a href="/">返回首页</a></div></body></html>`,
    { status: code, headers: { "Content-Type": "text/html; charset=utf-8", ...(code === 410 ? { "Cache-Control": "no-store" } : {}) } }
  );

const notFoundPage = () => errorPage(404, "找不到这个网页", "它可能还没发布、名字写错了，或者已经过期下线。");
const expiredPage = () => errorPage(410, "这个网页已过期", "它超出了保存时长并已自动下线。你可以回到首页重新发布。");

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
      if (method === "GET" && (pathname === "/admin" || pathname === "/admin/")) {
        return new Response(ADMIN_HTML, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
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

      // ---- 管理端 API ----
      if (pathname.startsWith("/api/admin/")) {
        const rest = pathname.slice("/api/admin/".length);
        if (rest === "sites" && (method === "GET" || method === "HEAD")) {
          return await handleAdminSites(env, request);
        }
        if (rest === "blacklist" && (method === "GET" || method === "HEAD")) {
          return await handleBlacklistGet(env, request);
        }
        if (rest === "blacklist" && method === "POST") {
          return await handleBlacklistAdd(env, request);
        }
        if (rest === "settings" && (method === "GET" || method === "HEAD")) {
          return await handleSettingsGet(env, request);
        }
        if (rest === "settings" && method === "POST") {
          return await handleSettingsSet(env, request);
        }
        let m = rest.match(/^sites\/([^/]+)$/);
        if (m && method === "DELETE") {
          return await handleAdminDelete(env, request, decodeURIComponent(m[1]));
        }
        m = rest.match(/^sites\/([^/]+)\/renew$/);
        if (m && method === "POST") {
          return await handleAdminRenew(env, request, decodeURIComponent(m[1]));
        }
        m = rest.match(/^blacklist\/(.+)$/);
        if (m && method === "DELETE") {
          return await handleBlacklistRemove(env, request, decodeURIComponent(m[1]));
        }
        return json({ ok: false, error: "未知的管理接口" }, 404);
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
