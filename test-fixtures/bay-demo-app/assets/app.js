/* 演示留言板前端：所有渲染都用 textContent / createElement，绝不使用 innerHTML 拼接用户输入 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  function hint(el, text, kind) {
    el.textContent = text || "";
    el.className = "hint" + (kind ? " " + kind : "");
  }
  function show(el, value) {
    el.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }
  function fmtTime(ts) {
    var n = Number(ts);
    if (!n) return "";
    try { return new Date(n).toLocaleString("zh-CN", { hour12: false }); } catch (e) { return String(ts); }
  }

  // 统一的请求封装：解析 JSON，非 2xx 或 ok:false 都进错误分支
  function api(path, opts) {
    var o = opts || {};
    return fetch(path, {
      method: o.method || "GET",
      headers: o.headers || undefined,
      body: o.body ? JSON.stringify(o.body) : undefined
    }).then(function (res) {
      return res.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
        if (!res.ok || !j || j.ok === false) {
          var msg = (j && j.error) ? j.error : ("HTTP " + res.status);
          var err = new Error(msg);
          err.status = res.status;
          throw err;
        }
        return j;
      });
    });
  }
  // 纯文本接口（api/greet）不走 JSON 解析
  function apiText(path) {
    return fetch(path).then(function (res) {
      return res.text().then(function (t) {
        if (!res.ok) throw new Error(t || ("HTTP " + res.status));
        return t;
      });
    });
  }

  // ---------- 1. 留言板 ----------
  function renderList(items) {
    var ul = $("msg-list");
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    if (!items || !items.length) {
      var li0 = document.createElement("li");
      li0.className = "empty";
      li0.textContent = "还没有留言，来写第一条吧。";
      ul.appendChild(li0);
      return;
    }
    items.forEach(function (m) {
      var li = document.createElement("li");
      var who = document.createElement("span");
      who.className = "who";
      who.textContent = m && m.name ? String(m.name) : "(匿名)";
      var when = document.createElement("span");
      when.className = "when";
      when.textContent = fmtTime(m && m.ts);
      var body = document.createElement("div");
      body.textContent = m && m.text ? String(m.text) : "";
      li.appendChild(who);
      li.appendChild(when);
      li.appendChild(body);
      ul.appendChild(li);
    });
  }

  function loadList() {
    hint($("msg-hint"), "加载中…");
    return api("api/msgs")
      .then(function (j) {
        renderList(j.items);
        var n = (j.items || []).length;
        hint($("msg-hint"), "已加载 " + n + " 条" + (j.q ? "（q=" + j.q + "）" : ""), "ok");
      })
      .catch(function (e) {
        renderList([]);
        hint($("msg-hint"), "列表加载失败：" + e.message, "err");
      });
  }

  $("msg-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var btn = $("msg-btn");
    var name = $("f-name").value.trim();
    var text = $("f-text").value.trim();
    if (!name || !text) { hint($("msg-hint"), "昵称和留言都不能为空。", "err"); return; }

    btn.disabled = true;
    hint($("msg-hint"), "提交中…");
    api("api/msg", { method: "POST", headers: { "Content-Type": "application/json" }, body: { name: name, text: text } })
      .then(function (j) {
        hint($("msg-hint"), "提交成功，服务器时间 " + fmtTime(j.server_now) + "，最新 " + ((j.latest || []).length) + " 条：", "ok");
        renderList(j.latest);
        $("f-text").value = "";
      })
      .catch(function (e) {
        hint($("msg-hint"), "提交失败（" + (e.status || "-") + "）：" + e.message, "err");
      })
      .then(function () { btn.disabled = false; });
  });

  $("reload-btn").addEventListener("click", function () { loadList(); });

  // ---------- 2. 投票 + 统计 ----------
  function loadStats() {
    show($("stats"), "加载中…");
    return api("api/stats")
      .then(function (j) {
        show($("stats"), [
          "站点：" + j.site,
          "留言总数：" + j.messages,
          "最近一次投票：" + (j.last_vote || "(还没投票)"),
          "服务器时间：" + fmtTime(j.now)
        ].join("\n"));
      })
      .catch(function (e) {
        show($("stats"), "统计加载失败：" + e.message);
      });
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-choice]"), function (b) {
    b.addEventListener("click", function () {
      hint($("vote-hint"), "提交中…");
      api("api/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: { choice: b.getAttribute("data-choice") } })
        .then(function (j) {
          hint($("vote-hint"), "已记录你的选择：" + j.saved, "ok");
          return loadStats();
        })
        .catch(function (e) {
          hint($("vote-hint"), "投票失败（" + (e.status || "-") + "）：" + e.message, "err");
        });
    });
  });

  // ---------- 3. 纯文本接口 ----------
  $("g-btn").addEventListener("click", function () {
    var name = ($("g-name").value || "").trim() || "朋友";
    show($("greet-out"), "请求中…");
    apiText("api/greet?name=" + encodeURIComponent(name))
      .then(function (t) { show($("greet-out"), t); })
      .catch(function (e) { show($("greet-out"), "失败：" + e.message); });
  });

  // ---------- 4. 口令门禁 ----------
  function purge(token) {
    show($("purge-out"), "请求中…");
    api("api/purge", { method: "POST", headers: { "X-Purge-Token": token }, body: {} })
      .then(function (j) { show($("purge-out"), "成功：" + JSON.stringify(j)); return loadStats(); })
      .catch(function (e) { show($("purge-out"), "被拒绝（HTTP " + (e.status || "-") + "）：" + e.message); });
  }
  $("p-ok").addEventListener("click", function () { purge("demo-secret-2026"); });
  $("p-bad").addEventListener("click", function () { purge("wrong-token"); });

  // ---------- 5. 平台默认接口 api/submit ----------
  $("d-post").addEventListener("click", function () {
    show($("default-out"), "提交中…");
    api("api/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: { from: "默认接口", at: Date.now() } })
      .then(function (j) { show($("default-out"), "已保存：" + JSON.stringify(j)); })
      .catch(function (e) { show($("default-out"), "失败（" + (e.status || "-") + "）：" + e.message); });
  });
  $("d-get").addEventListener("click", function () {
    show($("default-out"), "读取中…");
    api("api/submit")
      .then(function (j) { show($("default-out"), "最近记录（共 " + j.length + " 条）：\n" + JSON.stringify(j.slice(0, 3), null, 2)); })
      .catch(function (e) { show($("default-out"), "失败：" + e.message); });
  });

  // ---------- 启动 ----------
  $("api-base").textContent = "接口基址：" + location.origin + location.pathname.replace(/index\.html$/, "") + "api/*";
  loadList();
  loadStats();
})();