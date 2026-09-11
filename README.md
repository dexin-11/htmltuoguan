# HTML 托管舱 · Hosting Bay

部署在 **Cloudflare Workers** 上的 HTML 自助部署工具：上传 ZIP / HTML / 粘贴代码 → 存入 GitHub 仓库 → 秒级获得公开访问链接。

```
浏览器 ──POST /api/upload──▶ Cloudflare Worker ──REST API──▶ GitHub 仓库 sites/{项目名}/
浏览器 ◀──GET /{项目名}/──── Cloudflare Worker ◀──raw 回源── GitHub（边缘缓存 5 分钟）
```

## 功能

- 图形化控制台（`/`）：拖拽上传 ZIP / HTML 文件、粘贴 HTML 代码、项目名即时校验（格式 + 唯一性）
- **项目有效期**：3 天 / 7 天 / 1 个月（默认 7 天），过期站点访问返回 410 并自动从仓库清理，名称可复用
- 项目名唯一性校验（以仓库 `sites/` 实际目录为准，冲突返回 409）
- ZIP 必须包含 `index.html` 校验；自动剥离外层文件夹（`site/index.html` → 根目录）；自动过滤 `__MACOSX`、`.DS_Store`
- 项目列表展示（文件数 / 总大小 / 剩余有效期 / 访问链接）
- 站点静态服务：`/{项目名}/` 渲染 `index.html`，其余文件按原路径回源，子目录自动回退 `index.html`
- **管理后台**（`/admin`）：输入环境变量 `ADMIN_PASSWORD` 密码登录后可查看全部站点（含上传者 IP）、一键续期或删除站点、将恶意 IP 加入黑名单（被拉黑 IP 无法再发布）
- 安全：项目名白名单正则、URL/ZIP 双重路径穿越防护、`X-Content-Type-Options: nosniff`、管理 API 统一密码鉴权

## 快速开始

```bash
git clone https://github.com/dexin-11/htmltuoguan && cd htmltuoguan
npm install            # 安装 wrangler
npx wrangler login     # 登录 Cloudflare
```

### 1. 准备 GitHub 仓库

任意空仓库或已有仓库均可（默认分支需已存在），Worker 会把站点写入 `sites/` 目录。

### 2. 生成 Token

打开 https://github.com/settings/tokens 创建 Token：

- **Fine-grained（推荐）**：仅勾选目标仓库，权限 `Contents: Read and write`
- **Classic**：勾选 `repo` scope

### 3. 配置环境变量

编辑 [wrangler.toml](wrangler.toml)：

```toml
[vars]
GH_OWNER = "your-github-username"   # GitHub 用户名 / 组织名
GH_REPO  = "your-repo-name"         # 存储仓库
GH_BRANCH = "main"                  # 存储分支（需已存在）
```

设置 Token（密钥，不入库）：

```bash
npx wrangler secret put GH_TOKEN
```

可选变量：`GH_API`（自建 GitHub Enterprise 的 API 地址，默认 `https://api.github.com`）。

设置管理后台密码（访问 `/admin` 需要，密钥不入库）：

```bash
npx wrangler secret put ADMIN_PASSWORD
```

### 4. 部署

```bash
npx wrangler deploy
```

部署完成后打开 `https://<worker域名>/` 即为控制台；可用 `https://<worker域名>/api/health` 验证配置（返回 `configured` / `token_valid`）。

## 使用

**页面操作**：打开 Worker 首页 → 填项目名（小写字母/数字/连字符，1-40 位）→ 选择有效期（3 天 / 7 天 / 1 个月，默认 7 天）→ 拖入 ZIP（内含 index.html）或 .html 文件，或切到"粘贴代码" → 点"部署到 GITHUB" → 复制返回的链接。

**管理后台**：打开 `https://<worker域名>/admin` → 输入 `ADMIN_PASSWORD` 对应的密码 → 进入后可查看所有站点（文件数 / 大小 / 上传者 IP / 有效期）、一键续期（+7 天 / +30 天）或删除站点；右侧"IP 黑名单"输入框填入恶意 IP（支持 IPv4 / IPv6）点击"拉黑"，此后该 IP 的发布请求会被拒绝（403）。密码仅在浏览器会话内保存，退出登录或关闭页面即失效。

**规则与限制**：

| 项目 | 限制 |
|---|---|
| 项目名 | `^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$`，保留字 `api` |
| 必须包含 | 根目录 `index.html`（外层文件夹自动剥离） |
| 单文件 | ≤ 3MB |
| 项目总量 | ≤ 10MB、≤ 200 个文件 |
| 有效期 | 3 天 / 7 天 / 1 个月（默认 7 天），过期返回 410 并自动清理，名称可复用 |
| 名称冲突 | 409 拒绝；已过期或手动删除远端 `sites/{项目名}/` 目录后可复用 |

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/` | 图形化控制台 |
| `GET` | `/admin` | 管理后台（需输入 `ADMIN_PASSWORD` 密码） |
| `GET` | `/{项目名}/` | 访问站点（`/{项目名}` 301 跳转至此；已过期返回 410） |
| `GET` | `/api/sites` | 项目列表 `{ok, sites:[{name, files, size, expire_at, expired?}]}` |
| `GET` | `/api/health` | 配置自检 `{configured, missing, token_valid}` |
| `POST` | `/api/upload` | 部署（见下） |
| `GET` | `/api/admin/sites` | 管理：全部站点（含 `uploader_ip`），需 `X-Admin-Token` |
| `DELETE` | `/api/admin/sites/{项目名}` | 管理：删除站点 |
| `POST` | `/api/admin/sites/{项目名}/renew` | 管理：续期 `{days: 1-365}` |
| `GET` | `/api/admin/blacklist` | 管理：读取 IP 黑名单 |
| `POST` | `/api/admin/blacklist` | 管理：拉黑 `{ip, note?}` |
| `DELETE` | `/api/admin/blacklist/{ip}` | 管理：移出黑名单 |

管理端接口鉴权：请求头 `X-Admin-Token: <ADMIN_PASSWORD>`，缺失或错误返回 401。

上传接口支持两种请求体，可选字段 `expiry`：`"3d"` / `"7d"` / `"30d"`（默认 `"7d"`）：

```bash
# 1. multipart/form-data：字段 name + file（.zip 或 .html）
curl -F name=my-site -F expiry=7d -F file=@site.zip https://<worker域名>/api/upload

# 2. application/json：直接粘贴 HTML
curl -H 'Content-Type: application/json' \
     -d '{"name":"my-site","html":"<h1>hello</h1>","expiry":"30d"}' \
     https://<worker域名>/api/upload
```

成功返回 `{"ok":true,"name":"my-site","url":"/my-site/","files":N,"expiry_days":7}`；失败返回 `{"ok":false,"error":"..."}`（400 参数错误 / 409 名称占用 / 413 超限 / 5xx GitHub 或配置错误）。

## 本地开发与测试

```bash
cp .dev.vars.example .dev.vars   # 填入本地测试用的 GitHub 配置
npx wrangler dev                 # http://localhost:8787
npm test                         # 58 项全链路测试（mock GitHub，零依赖，需系统 python3）
```

## 注意事项

- Worker 调用 GitHub API 有 5000 次/小时限额；部署是逐文件提交（避免 GitHub 并发提交限制），一个 200 文件的站点消耗约 202 次配额（含元数据）
- **有效期机制**：部署时在 `sites/{项目名}/.bay.json` 写入过期时间戳与上传者 IP（`uploader_ip`）；站点被访问或项目列表加载时检查，过期则返回 410 并异步删除仓库内该目录（因边缘缓存，过期判断最多延迟约 5 分钟）；重新上传同名过期项目会先清理再写入
- **IP 黑名单**：保存在仓库根目录 `.bay-blacklist.json`（`.bay-blacklist.json` 不会被计入站点列表）；上传请求按 Cloudflare 连接 IP（`cf-connecting-ip`）校验，命中黑名单返回 403。注意：普通用户更换网络/代理后 IP 会变化，黑名单仅作访问控制辅助手段
- 若部署中途失败（如限流），部分文件可能已写入仓库，可删除远端 `sites/{项目名}/` 目录后重试
- 回源内容在 Cloudflare 边缘缓存 5 分钟，更新站点后最多延迟 5 分钟生效
- 控制台无鉴权，任何知道域名的人都可部署；管理后台 `/admin` 由 `ADMIN_PASSWORD` 保护。如需进一步限制访问，请在 Cloudflare 侧启用 Access 等防护

## 项目结构

```
src/index.js   Worker：路由 / 校验 / 零依赖 ZIP 解析 / GitHub API / 有效期管理 / 静态回源 / 管理端 API / IP 黑名单
src/ui.js      图形化控制台页面（内嵌 HTML）
src/admin.js   管理后台页面（内嵌 HTML）
test/          全链路测试（mock GitHub REST API）
wrangler.toml  Cloudflare Workers 配置与环境变量
```
