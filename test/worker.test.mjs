// Worker 全链路测试（零依赖，Node >= 21，需系统 python3 生成 zip 夹具）
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ORIGIN = "https://bay.test";
const ENV = { GH_TOKEN: "t", GH_OWNER: "o", GH_REPO: "r", GH_BRANCH: "main" };

// ---------- 生成 zip 夹具 ----------
const tmp = mkdtempSync(join(tmpdir(), "bay-test-"));
const pyScript = `
import sys, zipfile, os
out = sys.argv[1]
def z(p): return os.path.join(out, p)

with zipfile.ZipFile(z("z1.zip"), "w", zipfile.ZIP_DEFLATED) as f:
    f.writestr("index.html", "<h1>z1-root</h1>")
    f.writestr("style.css", "body{background:#000}")
    f.writestr("img/", "")
    f.writestr("img/logo.svg", "<svg xmlns='http://www.w3.org/2000/svg'/>")
    f.writestr("img/dot.png", bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4]))

with zipfile.ZipFile(z("z2.zip"), "w", zipfile.ZIP_DEFLATED) as f:
    f.writestr("site/index.html", "<h1>z2-nested</h1>")
    f.writestr("site/app.js", "console.log(1)")

with zipfile.ZipFile(z("z3.zip"), "w", zipfile.ZIP_DEFLATED) as f:
    f.writestr("about.html", "<h1>no index</h1>")

with zipfile.ZipFile(z("z4.zip"), "w", zipfile.ZIP_DEFLATED) as f:
    f.writestr("index.html", "<h1>evil</h1>")
    f.writestr("../evil.txt", "x")

with zipfile.ZipFile(z("z5.zip"), "w", zipfile.ZIP_STORED) as f:
    f.writestr("proj/index.html", "<h1>z5-stored</h1>")
    f.writestr("proj/data.json", "{}")
print("fixtures ok")
`;
const pyPath = join(tmp, "mkfixtures.py");
writeFileSync(pyPath, pyScript);
execSync(`python3 ${JSON.stringify(pyPath)} ${JSON.stringify(tmp)}`);
const zipBytes = (name) => new Uint8Array(readFileSync(join(tmp, name)));

// ---------- Mock GitHub API ----------
const MIME_MAP = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8", svg: "image/svg+xml", png: "image/png", json: "application/json; charset=utf-8",
};
const mockExt = (p) => p.slice(p.lastIndexOf(".") + 1);
const state = { files: new Map(), treeStatus: 200 };

state.files.set("sites/taken/index.html", "<h1>taken</h1>");

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method || "GET").toUpperCase();
  const headers = init.headers || {};
  const auth = headers["Authorization"] || headers.Authorization;

  if (url.pathname.startsWith("/repos/")) {
    assert.ok(auth === "Bearer t", "GitHub 请求必须携带 Authorization 头");
    if (url.pathname === "/repos/o/r/git/trees/main") {
      if (state.treeStatus === 404) return new Response("{}", { status: 404 });
      const tree = [...state.files.keys()].map((p) => ({ path: p, type: "blob", size: state.files.get(p).length }));
      return new Response(JSON.stringify({ tree }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.pathname.startsWith("/repos/o/r/contents/")) {
      const path = decodeURIComponent(url.pathname.slice("/repos/o/r/contents/".length));
      if (method === "PUT") {
        const body = JSON.parse(init.body);
        state.files.set(path, atob(body.content));
        return new Response('{"commit":{"sha":"x"}}', { status: 201 });
      }
      const raw = state.files.get(path);
      if (raw == null) return new Response('{"message":"Not Found"}', { status: 404 });
      return new Response(raw, { status: 200, headers: { "content-type": MIME_MAP[mockExt(path)] || "application/octet-stream" } });
    }
  }
  if (url.pathname === "/user") return new Response("{}", { status: 200 });
  return new Response("{}", { status: 404 });
};

const worker = (await import("../src/index.js")).default;
const req = (path, init) => new Request(ORIGIN + path, init);

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("FAIL  " + name + "\n      " + (e && e.message)); }
}

console.log("\n── Worker 测试 ──");

await test("GET / 返回控制台页面", async () => {
  const r = await worker.fetch(req("/"), ENV);
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").includes("text/html"));
  assert.ok((await r.text()).includes("托管舱"));
});

await test("GET /favicon.ico 返回 SVG", async () => {
  const r = await worker.fetch(req("/favicon.ico"), ENV);
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").includes("svg"));
});

await test("GET /api/health 已配置时 token_valid", async () => {
  const j = await (await worker.fetch(req("/api/health"), ENV)).json();
  assert.equal(j.configured, true);
  assert.equal(j.token_valid, true);
});

await test("GET /api/health 未配置时报告缺失变量", async () => {
  const j = await (await worker.fetch(req("/api/health"), {})).json();
  assert.equal(j.configured, false);
  assert.deepEqual(j.missing, ["GH_TOKEN", "GH_OWNER", "GH_REPO"]);
});

await test("GET /api/sites 列出已有项目", async () => {
  const j = await (await worker.fetch(req("/api/sites"), ENV)).json();
  assert.equal(j.ok, true);
  assert.ok(j.sites.some((s) => s.name === "taken" && s.files === 1));
});

await test("POST /api/upload 粘贴 HTML 部署成功", async () => {
  const r = await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Pasted1", html: "<h1>hello</h1>" }), // 大写会被小写化
  }), ENV);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(j.url, "/pasted1/");
  assert.equal(state.files.get("sites/pasted1/index.html"), "<h1>hello</h1>");
});

await test("项目名重复 → 409", async () => {
  const r = await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "taken", html: "<h1>x</h1>" }),
  }), ENV);
  assert.equal(r.status, 409);
});

await test("非法项目名 → 400（空格 / 保留字 / 前导连字符 / 超长）", async () => {
  for (const bad of ["bad name", "api", "-x", "a".repeat(41), ""]) {
    const r = await worker.fetch(req("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: bad, html: "<h1>x</h1>" }),
    }), ENV);
    assert.equal(r.status, 400, "name=" + JSON.stringify(bad));
  }
});

await test("空 HTML 内容 → 400", async () => {
  const r = await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "empty1", html: "   " }),
  }), ENV);
  assert.equal(r.status, 400);
});

await test("multipart 上传 .html 文件成功", async () => {
  const fd = new FormData();
  fd.append("name", "single");
  fd.append("file", new File(["<h1>single</h1>"], "page.html", { type: "text/html" }));
  const j = await (await worker.fetch(req("/api/upload", { method: "POST", body: fd }), ENV)).json();
  assert.equal(j.ok, true);
  assert.equal(state.files.get("sites/single/index.html"), "<h1>single</h1>");
});

await test("multipart 上传 .txt 文件 → 400", async () => {
  const fd = new FormData();
  fd.append("name", "badtype");
  fd.append("file", new File(["x"], "a.txt", { type: "text/plain" }));
  const r = await worker.fetch(req("/api/upload", { method: "POST", body: fd }), ENV);
  assert.equal(r.status, 400);
});

await test("ZIP 上传：根目录 index.html，文件数与二进制完整", async () => {
  const fd = new FormData();
  fd.append("name", "z1x");
  fd.append("file", new File([zipBytes("z1.zip")], "z1.zip", { type: "application/zip" }));
  const j = await (await worker.fetch(req("/api/upload", { method: "POST", body: fd }), ENV)).json();
  assert.equal(j.ok, true);
  assert.equal(j.files, 4);
  assert.equal(state.files.get("sites/z1x/index.html"), "<h1>z1-root</h1>");
  assert.equal(state.files.get("sites/z1x/style.css"), "body{background:#000}");
  assert.equal(state.files.get("sites/z1x/img/logo.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
  const png = state.files.get("sites/z1x/img/dot.png");
  const codes = [...png].map((c) => c.charCodeAt(0));
  assert.deepEqual(codes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
});

await test("ZIP 重名部署 → 409（唯一性校验）", async () => {
  const fd = new FormData();
  fd.append("name", "z1x");
  fd.append("file", new File([zipBytes("z1.zip")], "z1.zip", { type: "application/zip" }));
  const r = await worker.fetch(req("/api/upload", { method: "POST", body: fd }), ENV);
  assert.equal(r.status, 409);
});

await test("ZIP 包了一层文件夹：自动剥离到根", async () => {
  const fd = new FormData();
  fd.append("name", "z2x");
  fd.append("file", new File([zipBytes("z2.zip")], "z2.zip", { type: "application/zip" }));
  const j = await (await worker.fetch(req("/api/upload", { method: "POST", body: fd }), ENV)).json();
  assert.equal(j.ok, true);
  assert.equal(state.files.has("sites/z2x/index.html"), true);
  assert.equal(state.files.has("sites/z2x/site/index.html"), false);
});

await test("ZIP 缺少 index.html → 400", async () => {
  const fd = new FormData();
  fd.append("name", "z3x");
  fd.append("file", new File([zipBytes("z3.zip")], "z3.zip", { type: "application/zip" }));
  const r = await worker.fetch(req("/api/upload", { method: "POST", body: fd }), ENV);
  assert.equal(r.status, 400);
  assert.ok((await r.json()).error.includes("index.html"));
});

await test("ZIP 含 ../ 路径穿越 → 400", async () => {
  const fd = new FormData();
  fd.append("name", "z4x");
  fd.append("file", new File([zipBytes("z4.zip")], "z4.zip", { type: "application/zip" }));
  const r = await worker.fetch(req("/api/upload", { method: "POST", body: fd }), ENV);
  assert.equal(r.status, 400);
});

await test("ZIP stored(不压缩) + 文件夹包裹：正常部署", async () => {
  const fd = new FormData();
  fd.append("name", "z5x");
  fd.append("file", new File([zipBytes("z5.zip")], "z5.zip", { type: "application/zip" }));
  const j = await (await worker.fetch(req("/api/upload", { method: "POST", body: fd }), ENV)).json();
  assert.equal(j.ok, true);
  assert.equal(state.files.get("sites/z5x/index.html"), "<h1>z5-stored</h1>");
});

await test("GET /z1x 301 跳转到 /z1x/", async () => {
  const r = await worker.fetch(req("/z1x"), ENV);
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("location"), "/z1x/");
});

await test("GET /z1x/ 渲染 index.html", async () => {
  const r = await worker.fetch(req("/z1x/"), ENV);
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").includes("text/html"));
  assert.equal(await r.text(), "<h1>z1-root</h1>");
});

await test("GET /z1x/style.css 返回 CSS 类型", async () => {
  const r = await worker.fetch(req("/z1x/style.css"), ENV);
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").includes("text/css"));
  assert.equal(await r.text(), "body{background:#000}");
});

await test("GET /z1x/img/dot.png 返回二进制与 PNG 类型", async () => {
  const r = await worker.fetch(req("/z1x/img/dot.png"), ENV);
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").includes("image/png"));
});

await test("GET /none/ 不存在的站点 → 404", async () => {
  const r = await worker.fetch(req("/none/"), ENV);
  assert.equal(r.status, 404);
});

await test("路径穿越 /z1x/%2e%2e/x 不会读到 z1x 的文件", async () => {
  const r = await worker.fetch(req("/z1x/%2e%2e/x"), ENV);
  // URL 解析器会把 %2e%2e 规范化为 ..，最终请求等价于 /x（仍被限制在单站点命名空间内）
  assert.notEqual(r.status, 200);
  if (r.status === 301) assert.equal(r.headers.get("location"), "/x/");
});

await test("路径穿越 /z1x/..%2fx → 404", async () => {
  const r = await worker.fetch(req("/z1x/..%2fx"), ENV);
  assert.equal(r.status, 404);
});

await test("未配置环境变量时上传 → 500 且提示配置", async () => {
  const r = await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "noconf", html: "<h1>x</h1>" }),
  }), {});
  assert.equal(r.status, 500);
  assert.ok((await r.json()).error.includes("GH_TOKEN"));
});

await test("分支不存在时 /api/sites 返回空列表与警告", async () => {
  state.treeStatus = 404;
  const j = await (await worker.fetch(req("/api/sites"), ENV)).json();
  state.treeStatus = 200;
  assert.equal(j.ok, true);
  assert.deepEqual(j.sites, []);
  assert.ok(j.warning);
});

await test("GET /api/sites 反映全部新上传项目", async () => {
  const j = await (await worker.fetch(req("/api/sites"), ENV)).json();
  const names = j.sites.map((s) => s.name);
  for (const n of ["taken", "pasted1", "single", "z1x", "z2x", "z5x"]) assert.ok(names.includes(n), n);
  const z1 = j.sites.find((s) => s.name === "z1x");
  assert.equal(z1.files, 4);
});

console.log(`\n结果: ${passed} 通过 / ${failed} 失败\n`);
process.exit(failed ? 1 : 0);
