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

with zipfile.ZipFile(z("z6.zip"), "w", zipfile.ZIP_DEFLATED) as f:
    f.writestr("index.html", "<h1>z6</h1>")
    f.writestr("big.bin", bytes(3 * 1024 * 1024 + 100))

with zipfile.ZipFile(z("z7.zip"), "w", zipfile.ZIP_DEFLATED) as f:
    f.writestr("index.html", "<h1>z7</h1>")
    for i in range(4):
        f.writestr("part%d.bin" % i, bytes(2 * 1024 * 1024 + 600 * 1024))

with zipfile.ZipFile(z("z8.zip"), "w", zipfile.ZIP_DEFLATED) as f:
    f.writestr("index.html", "<h1>z8-many</h1>")
    for i in range(50):
        f.writestr("f%02d.txt" % i, "data %d" % i)

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
const state = { files: new Map(), treeStatus: 200, serveOverride: null, repoSizeKb: null };

state.files.set("sites/taken/index.html", "<h1>taken</h1>");

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method || "GET").toUpperCase();
  const headers = init.headers || {};
  const auth = headers["Authorization"] || headers.Authorization;

  if (url.pathname.startsWith("/repos/")) {
    state.gitCalls = (state.gitCalls || 0) + 1;
    assert.ok(auth === "Bearer t", "GitHub 请求必须携带 Authorization 头");
    if (url.pathname === "/repos/o/r/git/trees/main") {
      if (state.treeStatus === 404) return new Response("{}", { status: 404 });
      const tree = [...state.files.keys()].map((p) => ({ path: p, type: "blob", size: state.files.get(p).length, sha: "sha-" + p }));
      return new Response(JSON.stringify({ tree }), { status: 200, headers: { "content-type": "application/json" } });
    }
    // 批量写入/删除（commitFiles / deleteTree）：refs → head commit → 创建树 → 创建提交 → 推进分支
    if (url.pathname === "/repos/o/r/git/refs/heads/main") {
      return new Response(JSON.stringify({ object: { type: "commit", sha: "HEAD-commit" } }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/repos/o/r/git/commits/HEAD-commit") {
      return new Response(JSON.stringify({ tree: { sha: "ROOT-tree" } }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/repos/o/r/git/trees" && method === "POST") {
      const body = JSON.parse(init.body);
      if (!(body.tree && body.tree.length)) {
        // deleteTree 第一步：创建空树
        return new Response(JSON.stringify({ sha: "EMPTY-tree" }), { status: 201, headers: { "content-type": "application/json" } });
      }
      for (const e of body.tree) {
        if (e.type === "tree" && e.sha === "EMPTY-tree" && body.base_tree) {
          // deleteTree 第二步：用空树覆盖 path → 删除该目录下全部文件
          for (const k of [...state.files.keys()]) {
            if (k === e.path || k.startsWith(e.path + "/")) state.files.delete(k);
          }
        } else if (e.content) {
          // commitFiles：内联写入文件
          state.files.set(e.path, atob(e.content));
        }
      }
      return new Response(JSON.stringify({ sha: "TREE-new" }), { status: 201, headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/repos/o/r/git/commits" && method === "POST") {
      JSON.parse(init.body); // message / tree / parents 结构校验
      return new Response(JSON.stringify({ sha: "COMMIT-new" }), { status: 201, headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/repos/o/r/git/refs/heads/main" && method === "PATCH") {
      const body = JSON.parse(init.body);
      assert.equal(body.force, false);
      return new Response(JSON.stringify({ object: { sha: body.sha } }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.pathname.startsWith("/repos/o/r/contents/")) {
      const path = decodeURIComponent(url.pathname.slice("/repos/o/r/contents/".length));
      if (method === "PUT") {
        const body = JSON.parse(init.body);
        state.files.set(path, atob(body.content));
        return new Response('{"commit":{"sha":"x"}}', { status: 201 });
      }
      if (method === "DELETE") {
        if (state.files.has(path)) {
          state.files.delete(path);
          return new Response('{"commit":{"sha":"d"}}', { status: 200 });
        }
        return new Response('{"message":"Not Found"}', { status: 404 });
      }
      const raw = state.files.get(path);
      if (raw == null) return new Response('{"message":"Not Found"}', { status: 404 });
      const accept = headers["Accept"] || headers.accept || "";
      // 模拟 GitHub raw 媒体类型可能出现的各种异常 Content-Type / 响应体（serveFile 使用）
      if (accept.includes("vnd.github.raw")) {
        const ov = state.serveOverride;
        if (ov && ov.path === path) {
          return new Response(ov.body !== undefined ? ov.body : raw, {
            status: 200,
            headers: { "content-type": ov.ct },
          });
        }
        return new Response(raw, { status: 200, headers: { "content-type": MIME_MAP[mockExt(path)] || "application/octet-stream" } });
      }
      // 模拟 GitHub JSON 信封（readRepoFile 使用 application/vnd.github+json）
      return new Response(
        JSON.stringify({ name: path.split("/").pop(), path, sha: "sha-" + path, content: btoa(raw), encoding: "base64" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
  }
  if (url.pathname === "/repos/o/r") {
    if (state.repoSizeKb == null) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({ size: state.repoSizeKb }), { status: 200, headers: { "content-type": "application/json" } });
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

await test("POST /api/upload 粘贴 HTML 部署成功（默认有效期 7 天）", async () => {
  const r = await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Pasted1", html: "<h1>hello</h1>" }), // 大写会被小写化
  }), ENV);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(j.url, "/pasted1/");
  assert.equal(j.expiry_days, 7);
  assert.equal(state.files.get("sites/pasted1/index.html"), "<h1>hello</h1>");
  const meta = JSON.parse(state.files.get("sites/pasted1/.bay.json"));
  assert.equal(typeof meta.expire_at, "number");
  const week = 7 * 86400000;
  assert.ok(meta.expire_at > Date.now() + week - 60000 && meta.expire_at < Date.now() + week + 60000);
});

await test("自定义有效期 3 天", async () => {
  const j = await (await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "exp3", html: "<h1>3d</h1>", expiry: "3d" }),
  }), ENV)).json();
  assert.equal(j.ok, true);
  assert.equal(j.expiry_days, 3);
});

await test("非法有效期 → 400", async () => {
  const r = await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "expbad", html: "<h1>x</h1>", expiry: "1y" }),
  }), ENV);
  assert.equal(r.status, 400);
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
  for (const bad of ["bad name", "api", "admin", "-x", "a".repeat(41), ""]) {
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

await test("超过单文件 3MB 上限 → 413", async () => {
  const fd = new FormData();
  fd.append("name", "z6x");
  fd.append("file", new File([zipBytes("z6.zip")], "z6.zip", { type: "application/zip" }));
  const r = await worker.fetch(req("/api/upload", { method: "POST", body: fd }), ENV);
  assert.equal(r.status, 413);
  assert.ok((await r.json()).error.includes("3MB"));
});

await test("超过项目总量 10MB 上限（单文件均合规）→ 413", async () => {
  const fd = new FormData();
  fd.append("name", "z7x");
  fd.append("file", new File([zipBytes("z7.zip")], "z7.zip", { type: "application/zip" }));
  const r = await worker.fetch(req("/api/upload", { method: "POST", body: fd }), ENV);
  assert.equal(r.status, 413);
  assert.ok((await r.json()).error.includes("10MB"));
});

await test("大文件数站点批量写入：GitHub 子请求数受控（修复 50 上限）", async () => {
  state.gitCalls = 0; // 只统计本测试的调用
  const fd = new FormData();
  fd.append("name", "z8x");
  fd.append("file", new File([zipBytes("z8.zip")], "z8.zip", { type: "application/zip" }));
  const j = await (await worker.fetch(req("/api/upload", { method: "POST", body: fd }), ENV)).json();
  assert.equal(j.ok, true);
  assert.equal(j.files, 51); // 50 个文件 + index.html
  assert.equal(state.files.get("sites/z8x/index.html"), "<h1>z8-many</h1>");
  assert.equal(state.files.get("sites/z8x/f49.txt"), "data 49");
  assert.ok(state.gitCalls <= 20, "批量写入应把子请求压到很少（实际 " + state.gitCalls + " 次，全部文件逐一写入会超过 50）");
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

await test("无元数据的旧站点视为长期有效：/taken/ 正常访问", async () => {
  const r = await worker.fetch(req("/taken/"), ENV);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "<h1>taken</h1>");
});

// ---- Content-Type 回归测试：无论 GitHub 返回什么类型，.html 一律以 text/html 渲染 ----
await test("GitHub 返回 application/octet-stream 时仍以 text/html 渲染", async () => {
  state.serveOverride = { path: "sites/single/index.html", ct: "application/octet-stream" };
  const r = await worker.fetch(req("/single/"), ENV);
  state.serveOverride = null;
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").startsWith("text/html"));
  assert.equal(await r.text(), "<h1>single</h1>");
});

await test("GitHub 回显 vnd.github.raw+json 类型时仍以 text/html 渲染", async () => {
  state.serveOverride = { path: "sites/single/index.html", ct: "application/vnd.github.raw+json" };
  const r = await worker.fetch(req("/single/"), ENV);
  state.serveOverride = null;
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").startsWith("text/html"));
  assert.equal(await r.text(), "<h1>single</h1>");
});

await test("GitHub 返回 text/plain 时 .html 仍以 text/html 渲染", async () => {
  state.serveOverride = { path: "sites/single/index.html", ct: "text/plain; charset=utf-8" };
  const r = await worker.fetch(req("/single/"), ENV);
  state.serveOverride = null;
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").startsWith("text/html"));
  assert.equal(await r.text(), "<h1>single</h1>");
});

await test("GitHub 返回 base64 JSON 信封时解码内容并以 text/html 渲染", async () => {
  const raw = state.files.get("sites/single/index.html");
  state.serveOverride = {
    path: "sites/single/index.html",
    ct: "application/json; charset=utf-8",
    body: JSON.stringify({ name: "index.html", encoding: "base64", content: btoa(raw) }),
  };
  const r = await worker.fetch(req("/single/"), ENV);
  state.serveOverride = null;
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").startsWith("text/html"));
  assert.equal(await r.text(), "<h1>single</h1>");
});

await test(".json 文件原样以 application/json 返回（不解码）", async () => {
  const r = await worker.fetch(req("/z5x/data.json"), ENV);
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").startsWith("application/json"));
  assert.equal(await r.text(), "{}");
});

await test("未知扩展名时参考 GitHub 返回的类型", async () => {
  state.files.set("sites/single/blob.binx", "BINXDATA");
  state.serveOverride = { path: "sites/single/blob.binx", ct: "application/x-custom" };
  const r = await worker.fetch(req("/single/blob.binx"), ENV);
  state.serveOverride = null;
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/x-custom");
  assert.equal(await r.text(), "BINXDATA");
  state.files.delete("sites/single/blob.binx");
});

await test("未过期站点正常访问", async () => {
  const r = await worker.fetch(req("/exp3/"), ENV);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "<h1>3d</h1>");
});

await test("过期站点访问 → 410 并异步清理", async () => {
  // 人为把 exp3 的元数据改为已过期
  state.files.set("sites/exp3/.bay.json", JSON.stringify({ v: 1, created_at: Date.now() - 8 * 86400000, expire_at: Date.now() - 1000 }));
  const tasks = [];
  const ctx = { waitUntil(p) { tasks.push(p); } };
  const r = await worker.fetch(req("/exp3/"), ENV, ctx);
  assert.equal(r.status, 410);
  assert.ok((await r.text()).includes("过期"));
  await Promise.allSettled(tasks);
  assert.equal(state.files.has("sites/exp3/index.html"), false);
  assert.equal(state.files.has("sites/exp3/.bay.json"), false);
});

await test("过期项目名称可复用（重新部署成功）", async () => {
  const j = await (await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "exp3", html: "<h1>reborn</h1>", expiry: "30d" }),
  }), ENV)).json();
  assert.equal(j.ok, true);
  assert.equal(j.expiry_days, 30);
  assert.equal(state.files.get("sites/exp3/index.html"), "<h1>reborn</h1>");
});

await test("未过期项目重名 → 409", async () => {
  const r = await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "exp3", html: "<h1>x</h1>" }),
  }), ENV);
  assert.equal(r.status, 409);
});

await test("/api/sites 携带有效期信息并在列表加载时清理过期站点", async () => {
  // pastdue 直接置为过期
  await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "pastdue", html: "<h1>pd</h1>" }),
  }), ENV);
  state.files.set("sites/pastdue/.bay.json", JSON.stringify({ v: 1, created_at: 1, expire_at: Date.now() - 1 }));
  const tasks = [];
  const ctx = { waitUntil(p) { tasks.push(p); } };
  const j = await (await worker.fetch(req("/api/sites"), ENV, ctx)).json();
  const pd = j.sites.find((s) => s.name === "pastdue");
  assert.equal(pd.expired, true);
  await Promise.allSettled(tasks);
  assert.equal(state.files.has("sites/pastdue/index.html"), false);

  // 无元数据站点不再视为永久，按默认有效期（该测试上传于 7 天前… 此处断言有 expire_at）
  const taken = j.sites.find((s) => s.name === "taken");
  assert.equal(typeof taken.expire_at, "number");
  // 有限期站点有 expire_at
  const z1 = j.sites.find((s) => s.name === "z1x");
  assert.equal(typeof z1.expire_at, "number");
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
  for (const n of ["taken", "pasted1", "single", "z1x", "z2x", "z5x", "exp3"]) assert.ok(names.includes(n), n);
  const z1 = j.sites.find((s) => s.name === "z1x");
  assert.equal(z1.files, 5); // 4 个用户文件 + .bay.json 元数据
});

// ── 管理后台 / IP 黑名单 / 上传 IP 记录 ──
const ADMIN_ENV = { ...ENV, ADMIN_PASSWORD: "s3cret" };
const AUTH = { "X-Admin-Token": "s3cret" };

await test("GET /admin 返回管理后台页面", async () => {
  const r = await worker.fetch(req("/admin"), ADMIN_ENV);
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("content-type").includes("text/html"));
  assert.ok((await r.text()).includes("管理后台"));
});

await test("管理 API 未带密码 → 401", async () => {
  const r = await worker.fetch(req("/api/admin/sites"), ADMIN_ENV);
  assert.equal(r.status, 401);
});

await test("管理 API 密码错误 → 401", async () => {
  const r = await worker.fetch(req("/api/admin/sites", { headers: { "X-Admin-Token": "wrong" } }), ADMIN_ENV);
  assert.equal(r.status, 401);
});

await test("ADMIN_PASSWORD 未配置 → 500 并提示", async () => {
  const r = await worker.fetch(req("/api/admin/sites", { headers: AUTH }), ENV);
  assert.equal(r.status, 500);
  assert.ok((await r.json()).error.includes("ADMIN_PASSWORD"));
});

await test("管理 API 密码正确 → 200 列出站点", async () => {
  const j = await (await worker.fetch(req("/api/admin/sites", { headers: AUTH }), ADMIN_ENV)).json();
  assert.equal(j.ok, true);
  assert.ok(j.sites.some((s) => s.name === "taken"));
});

await test("上传记录上传者 IP（cf-connecting-ip）", async () => {
  const r = await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": "198.51.100.9" },
    body: JSON.stringify({ name: "ip-site", html: "<h1>ip</h1>" }),
  }), ENV);
  assert.equal(r.status, 200);
  const meta = JSON.parse(state.files.get("sites/ip-site/.bay.json"));
  assert.equal(meta.uploader_ip, "198.51.100.9");
});

await test("管理列表返回上传 IP", async () => {
  const j = await (await worker.fetch(req("/api/admin/sites", { headers: AUTH }), ADMIN_ENV)).json();
  const s = j.sites.find((x) => x.name === "ip-site");
  assert.ok(s);
  assert.equal(s.uploader_ip, "198.51.100.9");
});

await test("IP 拉黑后上传被拒绝 → 403", async () => {
  const j = await (await worker.fetch(req("/api/admin/blacklist", {
    method: "POST",
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ ip: "198.51.100.9", note: "test" }),
  }), ADMIN_ENV)).json();
  assert.equal(j.ok, true);
  const r = await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": "198.51.100.9" },
    body: JSON.stringify({ name: "banned2", html: "<h1>x</h1>" }),
  }), ENV);
  assert.equal(r.status, 403);
  assert.ok((await r.json()).error.includes("黑名单"));
});

await test("黑名单读取 / 移除", async () => {
  const j = await (await worker.fetch(req("/api/admin/blacklist", { headers: AUTH }), ADMIN_ENV)).json();
  assert.equal(j.ok, true);
  assert.ok(j.entries.some((e) => e.ip === "198.51.100.9"));
  const d = await (await worker.fetch(req("/api/admin/blacklist/198.51.100.9", {
    method: "DELETE",
    headers: AUTH,
  }), ADMIN_ENV)).json();
  assert.equal(d.ok, true);
  const j2 = await (await worker.fetch(req("/api/admin/blacklist", { headers: AUTH }), ADMIN_ENV)).json();
  assert.ok(!j2.entries.some((e) => e.ip === "198.51.100.9"));
});

await test("黑名单 IP 格式非法 → 400", async () => {
  const r = await worker.fetch(req("/api/admin/blacklist", {
    method: "POST",
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ ip: "not-an-ip" }),
  }), ADMIN_ENV);
  assert.equal(r.status, 400);
});

await test("管理续期：过期时间向后顺延", async () => {
  const j = await (await worker.fetch(req("/api/admin/sites/ip-site/renew", {
    method: "POST",
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ days: 30 }),
  }), ADMIN_ENV)).json();
  assert.equal(j.ok, true);
  assert.equal(j.days, 30);
  const meta = JSON.parse(state.files.get("sites/ip-site/.bay.json"));
  assert.ok(meta.expire_at > Date.now() + 29 * 86400000);
});

await test("续期天数非法 → 400", async () => {
  const r = await worker.fetch(req("/api/admin/sites/taken/renew", {
    method: "POST",
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ days: 0 }),
  }), ADMIN_ENV);
  assert.equal(r.status, 400);
});

await test("续期不存在的站点 → 404", async () => {
  const r = await worker.fetch(req("/api/admin/sites/no-such-site/renew", {
    method: "POST",
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ days: 7 }),
  }), ADMIN_ENV);
  assert.equal(r.status, 404);
});

await test("管理删除站点", async () => {
  const j = await (await worker.fetch(req("/api/admin/sites/ip-site", {
    method: "DELETE",
    headers: AUTH,
  }), ADMIN_ENV)).json();
  assert.equal(j.ok, true);
  assert.equal(state.files.has("sites/ip-site/index.html"), false);
  assert.equal(state.files.has("sites/ip-site/.bay.json"), false);
});

await test("管理删除不存在的站点 → 404", async () => {
  const r = await worker.fetch(req("/api/admin/sites/no-such-site", { method: "DELETE", headers: AUTH }), ADMIN_ENV);
  assert.equal(r.status, 404);
});

// ── 全局上传开关 / 仓库容量闸门 / 单 IP 上传配额 ──
const dayKeyNow = new Date().toISOString().slice(0, 10);
const weekKeyNow = (() => {
  const x = new Date();
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); // 周一为一周起点
  return x.toISOString().slice(0, 10);
})();

await test("上传成功后写入 IP 配额记账", async () => {
  state.files.delete(".bay-quota.json");
  const fd = new FormData();
  fd.append("name", "q-acc");
  fd.append("file", new File(["<h1>q</h1>"], "a.html", { type: "text/html" }));
  const r = await worker.fetch(req("/api/upload", { method: "POST", headers: { "cf-connecting-ip": "198.51.100.55" }, body: fd }), ENV);
  assert.equal(r.status, 200);
  const q = JSON.parse(state.files.get(".bay-quota.json"));
  assert.equal(q.byIp["198.51.100.55"].d, dayKeyNow);
  assert.equal(q.byIp["198.51.100.55"].w, weekKeyNow);
  assert.equal(q.byIp["198.51.100.55"].db, "<h1>q</h1>".length);
});

await test("单 IP 每日配额超限 → 429", async () => {
  state.files.set(".bay-quota.json", JSON.stringify({ v: 1, byIp: { "198.51.100.56": { d: dayKeyNow, db: 19 * 1024 * 1024, w: weekKeyNow, wb: 19 * 1024 * 1024 } } }));
  const r = await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": "198.51.100.56" },
    body: JSON.stringify({ name: "q-day", html: "<h1>" + "x".repeat(2 * 1024 * 1024) + "</h1>" }),
  }), ENV);
  assert.equal(r.status, 429);
  assert.ok((await r.json()).error.includes("20MB"));
});

await test("单 IP 每周配额超限 → 429（日配额未超）", async () => {
  state.files.set(".bay-quota.json", JSON.stringify({ v: 1, byIp: { "198.51.100.57": { d: dayKeyNow, db: 3 * 1024 * 1024, w: weekKeyNow, wb: 48 * 1024 * 1024 } } }));
  const r = await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": "198.51.100.57" },
    body: JSON.stringify({ name: "q-week", html: "<h1>" + "x".repeat(2 * 1024 * 1024 + 512 * 1024) + "</h1>" }),
  }), ENV);
  assert.equal(r.status, 429);
  assert.ok((await r.json()).error.includes("50MB"));
});

await test("配额未超时同 IP 可正常上传", async () => {
  state.files.set(".bay-quota.json", JSON.stringify({ v: 1, byIp: { "198.51.100.58": { d: dayKeyNow, db: 1024 * 1024, w: weekKeyNow, wb: 1024 * 1024 } } }));
  const r = await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": "198.51.100.58" },
    body: JSON.stringify({ name: "q-ok", html: "<h1>ok</h1>" }),
  }), ENV);
  assert.equal(r.status, 200);
});

await test("全局上传开关关闭后上传被拒绝 → 503", async () => {
  state.files.set(".bay-settings.json", JSON.stringify({ v: 1, uploads_enabled: false }));
  const r = await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "sw-off", html: "<h1>x</h1>" }),
  }), ENV);
  assert.equal(r.status, 503);
  assert.ok((await r.json()).error.includes("关闭"));
});

await test("全局设置读取：开关状态与仓库体积", async () => {
  state.repoSizeKb = 300 * 1024;
  const j = await (await worker.fetch(req("/api/admin/settings", { headers: AUTH }), ADMIN_ENV)).json();
  state.repoSizeKb = null;
  assert.equal(j.ok, true);
  assert.equal(j.uploads_enabled, false);
  assert.equal(j.repo_size_bytes, 300 * 1024 * 1024);
  assert.equal(j.max_repo_bytes, 800 * 1024 * 1024);
});

await test("全局设置：重新开启上传并恢复发布", async () => {
  const j = await (await worker.fetch(req("/api/admin/settings", {
    method: "POST",
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ uploads_enabled: true }),
  }), ADMIN_ENV)).json();
  assert.equal(j.ok, true);
  assert.equal(j.uploads_enabled, true);
  const r = await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "sw-on", html: "<h1>x</h1>" }),
  }), ENV);
  assert.equal(r.status, 200);
  state.files.delete(".bay-settings.json");
});

await test("settings 参数非法 → 400", async () => {
  const r = await worker.fetch(req("/api/admin/settings", {
    method: "POST",
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ uploads_enabled: "yes" }),
  }), ADMIN_ENV);
  assert.equal(r.status, 400);
});

await test("仓库容量达到 800MB → 上传被拒绝 503", async () => {
  state.repoSizeKb = 800 * 1024;
  const r = await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "cap-full", html: "<h1>x</h1>" }),
  }), ENV);
  state.repoSizeKb = null;
  assert.equal(r.status, 503);
  assert.ok((await r.json()).error.includes("800MB"));
});

await test("仓库容量 799MB 时上传正常", async () => {
  state.repoSizeKb = 799 * 1024;
  const r = await worker.fetch(req("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "cap-ok", html: "<h1>x</h1>" }),
  }), ENV);
  state.repoSizeKb = null;
  assert.equal(r.status, 200);
});

console.log(`\n结果: ${passed} 通过 / ${failed} 失败\n`);
process.exit(failed ? 1 : 0);
