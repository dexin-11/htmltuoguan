// 真实 ZIP 全流程 E2E（离线、无需 GitHub 凭据）
// 用一个"磁盘级" GitHub 扮演：批处理树写入时把 base64 内容真实解码落盘，
// 站点回源时按真实字节读回 —— 验证的是真实字节链路而非内存 mock，
// 并复现"站点文件被以 base64 文本误存"的乱码场景，确认 serveFile 自愈解码。
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, statSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import worker from "../src/index.js";

const ORIGIN = "https://bay.test";
const ENV = { GH_TOKEN: "t", GH_OWNER: "o", GH_REPO: "r", GH_BRANCH: "main", ADMIN_PASSWORD: "admin-secret" };
const b64 = (u) => Buffer.from(u).toString("base64");

// ---------- 1) 生成真实 ZIP（含嵌套目录与二进制图片） ----------
const tmp = mkdtempSync(join(tmpdir(), "bay-e2e-"));
const repo = join(tmp, "repo"); // "GitHub" 落盘目录
mkdirSync(repo, { recursive: true });
const py = join(tmp, "makezip.py");
writeFileSync(
  py,
  `
import zipfile
with zipfile.ZipFile(r"${join(tmp, 'site.zip')}", "w", zipfile.ZIP_DEFLATED) as f:
    f.writestr("index.html", "<!DOCTYPE html>\\n<html><head><title>E2E Proof</title><link rel=stylesheet href=style.css></head><body><h1>Hello E2E</h1><img src=img/logo.png></body></html>")
    f.writestr("style.css", "body{color:#333}.hero{background:#0071e3}")
    f.writestr("img/logo.png", bytes([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A, 1,2,3,4,5,6,7,8]))
    f.writestr("README.txt", "真实 ZIP 全流程 (中文) 测例")
print("zip ok")
`
);
execSync(`python3 ${JSON.stringify(py)}`);

const EXPECT_HTML =
  "<!DOCTYPE html>\n<html><head><title>E2E Proof</title><link rel=stylesheet href=style.css></head><body><h1>Hello E2E</h1><img src=img/logo.png></body></html>";
const EXPECT_CSS = "body{color:#333}.hero{background:#0071e3}";
const EXPECT_PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);
const zipBytes = new Uint8Array(readFileSync(join(tmp, "site.zip")));

// ---------- 2) 磁盘级 GitHub Mock ----------
function walk(dir, out = []) {
  for (const d of readdirSync(dir)) {
    const a = join(dir, d);
    if (statSync(a).isDirectory()) walk(a, out);
    else out.push(a);
  }
  return out;
}
let totalRequests = 0;

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method || "GET").toUpperCase();
  const accept = init.headers?.Accept || "";
  const rawJson = /raw\+json/.test(accept);
  totalRequests++;
  const P = url.pathname;

  if (P === "/repos/o/r/git/refs/heads/main" && method === "GET")
    return new Response(JSON.stringify({ object: { sha: "HEAD" } }), { status: 200, headers: { "content-type": "application/json" } });
  if (P === "/repos/o/r/git/refs/heads/main" && method === "PATCH")
    return new Response(JSON.stringify({ object: { sha: "NEW" } }), { status: 200, headers: { "content-type": "application/json" } });
  if (P === "/repos/o/r/git/commits/HEAD" && method === "GET")
    return new Response(JSON.stringify({ tree: { sha: "ROOT-TREE" } }), { status: 200, headers: { "content-type": "application/json" } });
  if (P === "/repos/o/r/git/commits" && method === "POST")
    return new Response(JSON.stringify({ sha: "COMMIT-NEW" }), { status: 201, headers: { "content-type": "application/json" } });
  if (P === "/repos/o/r/git/trees/main" && method === "GET") {
    const tree = walk(repo).map((p) => {
      const rel = p.slice(repo.length + 1).replace(/\\/g, "/");
      return { path: rel, type: "blob", size: statSync(p).size, sha: "s-" + rel };
    });
    return new Response(JSON.stringify({ tree }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (P === "/repos/o/r/git/trees" && method === "POST") {
    const body = JSON.parse(init.body || "{}");
    for (const e of body.tree || []) {
      if (e.type === "tree" && body.base_tree && e.path) {
        // deleteTree：用空子树覆盖该目录 => 移除目录及其下全部文件
        rmSync(join(repo, e.path), { recursive: true, force: true });
      } else if (e.content) {
        const f = join(repo, e.path);
        mkdirSync(dirname(f), { recursive: true });
        writeFileSync(f, Buffer.from(e.content.replace(/\s+/g, ""), "base64"));
      }
    }
    return new Response(JSON.stringify({ sha: "TREE-NEW" }), { status: 201, headers: { "content-type": "application/json" } });
  }
  if (P.startsWith("/repos/o/r/contents/")) {
    const fileKey = decodeURIComponent(P.slice("/repos/o/r/contents/".length));
    const abs = join(repo, fileKey);
    const st = statSync(abs, { throwIfNoEntry: false });
    if (!st) return new Response("{}", { status: 404 });
    // 目录探测（siteExists）：路径是目录时返回目录列表（非递归、单次请求，替代整仓库树扫描）
    if (st.isDirectory()) {
      return new Response(
        JSON.stringify(readdirSync(abs).map((n) => ({ name: n, path: fileKey + "/" + n, type: statSync(join(abs, n)).isDirectory() ? "dir" : "file" }))),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    const bytes = readFileSync(abs);
    if (rawJson) // 站点回源：raw+json 返回真实字节
      return new Response(bytes, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
    // 元数据/配置：JSON 信封（base64 content）
    return new Response(
      JSON.stringify({ name: basename(abs), path: fileKey, sha: "sha", size: bytes.length, encoding: "base64", content: b64(bytes) }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }
  if (P === "/repos/o/r" && method === "GET")
    return new Response(JSON.stringify({ size: 1 }), { status: 200, headers: { "content-type": "application/json" } });
  return new Response("{}", { status: 404 });
};

const req = (path, init) =>
  new Request(ORIGIN + path, { ...init, headers: { "cf-connecting-ip": "1.2.3.4", ...(init?.headers || {}) } });
const ctx = { waitUntil() {} };

// ---------- 3) 上传真实 ZIP ----------
{
  const fd = new FormData();
  fd.append("name", "proof");
  fd.append("expiry", "7d");
  fd.append("file", new File([zipBytes], "site.zip", { type: "application/zip" }));
  const r = await worker.fetch(req("/api/upload", { method: "POST", body: fd }), ENV, ctx);
  const j = await r.json();
  assert.equal(r.status, 200, "上传应成功: " + JSON.stringify(j));
  assert.equal(j.ok, true);
  console.log("[上传] ok name=%s files=%s expiry_days=%s (GitHub 子请求=%s)", j.name, j.files, j.expiry_days, totalRequests);
}

// ---------- 4) 磁盘级校验：存的一定是真实字节，而非 base64 文本 ----------
{
  assert.equal(readFileSync(join(repo, "sites/proof/index.html"), "utf8"), EXPECT_HTML, "index.html 落盘必须是真实 HTML");
  assert.equal(readFileSync(join(repo, "sites/proof/style.css"), "utf8"), EXPECT_CSS);
  assert.deepEqual([...new Uint8Array(readFileSync(join(repo, "sites/proof/img/logo.png")))], [...EXPECT_PNG]);
  const meta = JSON.parse(readFileSync(join(repo, "sites/proof/.bay.json"), "utf8"));
  assert.equal(typeof meta.expire_at, "number");
  console.log("[磁盘] 真实字节校验通过：index.html / style.css / img/logo.png / .bay.json 均为正常内容（非 base64 乱码）");
}

// ---------- 5) 完整下发：读取到的就是真实 HTML / CSS / PNG ----------
{
  const r = await worker.fetch(req("/proof/"), ENV, ctx);
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").startsWith("text/html"));
  assert.equal(await r.text(), EXPECT_HTML);
  console.log("[下发] /proof/ 200 => content-type=%s，正文为真实 HTML", r.headers.get("content-type"));

  const css = await worker.fetch(req("/proof/style.css"), ENV, ctx);
  assert.equal(await css.text(), EXPECT_CSS);
  console.log("[下发] /proof/style.css 200 => content-type=%s，正文正确", css.headers.get("content-type"));

  const img = await worker.fetch(req("/proof/img/logo.png"), ENV, ctx);
  assert.ok(img.headers.get("content-type").startsWith("image/png"));
  assert.deepEqual([...new Uint8Array(await img.arrayBuffer())], [...EXPECT_PNG]);
  console.log("[下发] /proof/img/logo.png 200 => content-type=%s，字节一致", img.headers.get("content-type"));
}

// ---------- 6) 项目列表：有效期是具体时间，而非永久 ----------
{
  const j = await (await worker.fetch(req("/api/sites?mine=proof"), ENV, ctx)).json();
  const it = j.sites.find((s) => s.name === "proof");
  assert.ok(it && typeof it.expire_at === "number", "proof 有效期应为具体时间戳，而非永久");
  console.log("[列表] /api/sites 返回 proof，expire_at=%s（有确定过期时间，非永久）", it.expire_at);
}

// ---------- 7) 乱码自愈：站点文件被以 base64 文本误存时仍能还原为可读 HTML ----------
{
  writeFileSync(join(repo, "sites/proof/index.html"), b64("<h1>POLLUTED-BASE64</h1>"), "utf8");
  const r = await worker.fetch(req("/proof/"), ENV, ctx);
  const txt = await r.text();
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").startsWith("text/html"));
  assert.equal(txt, "<h1>POLLUTED-BASE64</h1>", "已 base64 化的 HTML 应被自愈解码，而非原样乱码");
  console.log("[自愈] 命中 base64 乱码场景 => /proof/ 正确还原为可读 HTML，Content-Type=%s", r.headers.get("content-type"));
}

// ---------- 8) 管理页删除：轻量探测目录 → 子树整体删除 ----------
{
  // 先恢复 index.html 为正常内容，删除前校验完整性
  writeFileSync(join(repo, "sites/proof/index.html"), EXPECT_HTML, "utf8");
  const before = totalRequests;
  const r = await worker.fetch(
    req("/api/admin/sites/proof", { method: "DELETE", headers: { "X-Admin-Token": "admin-secret" } }),
    ENV,
    ctx
  );
  const j = await r.json();
  assert.equal(r.status, 200, "删除应成功: " + JSON.stringify(j));
  assert.equal(j.ok, true);
  // 磁盘上 sites/proof 整目录已被清空
  assert.equal(statSync(join(repo, "sites/proof"), { throwIfNoEntry: false }), undefined, "站点目录应已被删除");
  assert.ok(totalRequests - before <= 8, "删除子请求应受控（≤8），实际 " + (totalRequests - before));
  console.log("[删除] /api/admin/sites/proof 200，GitHub 子请求=%s（避免整仓库树扫描）", totalRequests - before);

  // 删除后访问 /proof/ → 404
  const gone = await worker.fetch(req("/proof/"), ENV, ctx);
  assert.equal(gone.status, 404);
  console.log("[删除] 删除后 /proof/ 返回 404（站点已下线）");
}

// ---------- 9) 删除不存在的站点 → 404 ----------
{
  const r = await worker.fetch(
    req("/api/admin/sites/nope", { method: "DELETE", headers: { "X-Admin-Token": "admin-secret" } }),
    ENV,
    ctx
  );
  assert.equal(r.status, 404);
  console.log("[删除] 不存在的站点 → 404");
}

console.log("\n全部真实 ZIP 全流程断言通过 ✅");