# AI Interview Helper — 项目进度记录

> 最后更新: 2026-07-19

---

## 当前状态总览

| 维度 | 完成度 | 状态 |
|------|--------|------|
| 后端 API | 95% | ✅ 运行中 (http://localhost:9000)，API 实测通过 |
| 前端核心 | 65% | ✅ 运行中 (http://localhost:5173)，编译通过 |
| 基础设施 | 100% | ✅ PostgreSQL 18.4 + Redis 无需（代码未使用） |
| **综合** | **~85%** | 🔄 v0.3 运行中，前后端均已成功启动 |

---

## 修复记录

### 🟡 P1 — 2026-07-19 新修复

| # | 问题 | 文件 | 修复方式 | 验证 |
|---|------|------|----------|------|
| 9 | `test_connection.py` 和 `main.py` 中 emoji 在 Windows GBK 终端报 UnicodeEncodeError | test_connection.py, main.py | 所有 emoji 替换为 ASCII 标记，添加 `sys.stdout.reconfigure(encoding='utf-8')` | ✅ 数据库连接测试全通过 |
| 10 | `passlib` 与 `bcrypt 5.0.0` 不兼容 | app/auth.py, requirements.txt | 移除 passlib，直接用 bcrypt；处理 72 字节密码限制 | ✅ 用户登录正常 |
| 11 | `datetime.utcnow()` 在 Python 3.12+ 已弃用 | app/auth.py, app/models.py, app/routers/sessions.py | 替换为 `datetime.now(timezone.utc)` + `utcnow()` 辅助函数 | ✅ 启动无警告 |
| 12 | `email-validator` 包缺失 | requirements.txt | 添加 `email-validator>=2.0.0` | ✅ Pydantic EmailStr 正常 |

---

## 当前环境

| 组件 | 状态 |
|------|------|
| **Python** | 3.14.0 ✅ |
| **Node.js** | v24.15.0 ✅ |
| **Docker** | ❌ 不需要（本地直接运行） |
| **PostgreSQL** | ✅ 18.4 本地运行 (localhost:5432, user=postgres, pw=root) |
| **Redis** | ⚠️ 未安装（代码中未使用） |
| **pip 依赖** | ✅ fastapi, sqlalchemy, psycopg3, bcrypt, jose 等全部就绪 |
| **npm 依赖** | ✅ 393 packages |
| **后端** | ✅ 运行在 http://localhost:9000 (uvicorn + reload) |
| **前端** | ✅ 运行在 http://localhost:5173 (vite dev) |
| **默认用户** | ✅ test / test1234 |

---

## 已知问题

| # | 严重度 | 问题 | 位置 | 说明 |
|---|--------|------|------|------|
| 1 | 🟢 低 | Redis 未使用 | backend/app/ | docker-compose 中配置了但代码无缓存逻辑 |
| 2 | 🟢 低 | 无数据库迁移 | — | Alembic 已在依赖中但未配置 |

### 功能层 (UI 暂缓)

| # | 严重度 | 问题 | 位置 |
|---|--------|------|------|
| 3 | 🟡 中 | 登录页面缺失 | frontend |
| 4 | 🟡 中 | 路由无认证守卫 | App.tsx |
| 5 | 🟢 低 | 各页面占位符 | App.tsx |
| 6 | 🟢 低 | 无错误边界 | frontend |

---

## 验证过的端点

| 端点 | 结果 |
|------|------|
| `GET /health` | `{"status":"healthy"}` ✅ |
| `GET /` | `{"message":"AI Interview Helper API v0.3.0"}` ✅ |
| `POST /api/auth/login` | JWT token 正常签发 ✅ |
| `GET /docs` | Swagger 自动生成 ✅ |

---

## 启动命令

```bash
# 终端 1 — 后端
cd d:\interview-help\interview-helper\backend
venv\Scripts\activate
python run_server.py

# 终端 2 — 前端
cd d:\interview-help\interview-helper\frontend
npm run dev
```

---

## 版本路线图

| 版本 | 状态 | 内容 |
|------|------|------|
| v0.3 | ✅ 运行中 | 后端 + 数据持久化 + JWT 认证 |
| v0.4 | 📋 计划中 | 多模型支持 + API 配置管理 |
| v0.5 | 📋 计划中 | 完善用户系统 + 登录页面 |
