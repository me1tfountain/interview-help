# AI 面试助手

> 个人专属的 AI 面试辅助工具 —— 实时语音转写 + AI 自动回答，专为 AI/LLM 岗位面试优化。

## 核心理念

这不是一个通用面试工具，而是**你个人的数字面试分身**。

你把简历和项目问答库放在 `personal/` 目录下，系统会基于你的真实经历来生成回答。面试官问「介绍一下你的项目」，AI 回答的是**你的项目**，不是编造的。

```text
面试官说话 → 麦克风/系统音频采集 → 科大讯飞实时转写 → AI 自动回答（基于你的简历）
                                                    ↑
                                          Ctrl+Shift+Enter 手动兜底
```

## 快速开始

### 1. 启动 PostgreSQL

```bash
# 确保 PostgreSQL 正在运行（端口 5432）
psql -U postgres -c "SELECT 1"
```

### 2. 启动后端（端口 9000）

```bash
cd backend
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

python test_connection.py      # 首次：验证数据库连接
python init_default_user.py    # 首次：创建默认用户
python run_server.py           # 启动 → http://localhost:9000
```

### 3. 启动前端（端口 5173）

```bash
cd frontend
npm install                    # 首次：安装依赖
npm run dev                    # 启动 → http://localhost:5173
```

### 4. 配置 API 密钥

打开 <http://localhost:5173>，进入设置页面填入：

| 服务 | 需要 | 申请地址 |
| ---- | ---- | --------- |
| 科大讯飞 RTasr | AppId + APIKey | <https://www.xfyun.cn/> |
| DeepSeek | API Key | <https://platform.deepseek.com/> |

### 5. 放置个人资料

在项目根目录创建 `personal/` 文件夹，放入你的简历和问答库（详见下文）。

### 6. 开始面试

点击「开始面试」→ 选择音频源（麦克风/系统音频）→ 开始对话。

---

## 个人定制

### 你的个人资料放在哪里

```text
interview-helper/
├── personal/              ← 你只需要维护这个目录
│   ├── resume.md          # 你的简历
│   └── qa-bank.md         # 高频面试题的标准答案
```

### `personal/resume.md` — 简历

AI 回答「自我介绍」「你的项目经历」等个人化问题时，会基于这份简历。

```markdown
# 个人信息
- 工作年限：X 年
- 当前方向：AI Agent 开发 / LLM 算法
- 学历：XXX

# 技术能力
- 精通：LangChain, AutoGPT, Function Calling, RAG
- 熟悉：Python, Prompt Engineering, Vector Database
- 了解：Fine-tuning, RLHF, Model Serving

# 核心项目

## 项目一：企业级 AI Agent 平台
- 角色：核心开发者
- 技术栈：LangChain + FastAPI + ChromaDB + OpenAI
- 核心功能：多 Agent 协作、工具编排、记忆管理
- 成果：支撑 3 个业务线，日均调用 5000+ 次
- 难点：Agent 幻觉控制、长对话上下文管理

## 项目二：智能客服 RAG 系统
- 角色：技术负责人
...
```

### `personal/qa-bank.md` — 项目问答库

AI 匹配到相关问题后，**基于你预设的答案骨架润色输出**，保证不跑偏。

```markdown
## Q: AI Agent 和传统 LLM 应用的区别
A: 核心区别在自主决策能力。
1. Agent 能拆解任务、自主选择工具、迭代执行；传统应用是单轮问答
2. Agent 有 Tool Use 能力（Function Calling），能调用外部 API
3. Agent 有记忆系统：短期（上下文窗口）+ 长期（向量数据库）
4. Agent 有规划能力：ReAct / Plan-Execute / Tree of Thoughts
我在 XX 项目中实际踩过的坑是：Agent 的工具选择有时不准确，通过 Few-shot 示例和工具描述优化解决。

## Q: RAG 的核心流程
A: 索引 + 检索 + 增强 + 生成 四步。
1. 索引：文档切片 → Embedding → 向量数据库存储
2. 检索：用户 Query → Embedding → 向量相似度搜索 → Top-K
3. 增强：检索结果 + 原始 Query → 拼接 Prompt
4. 生成：LLM 基于增强后的 Prompt 生成答案
优化的关键点：切片策略、Embedding 模型选择、检索重排序。
我的实践中，使用语义分块 + BM25 混合检索效果最好。

## Q: Function Calling 的实现原理
A: ...

## Q: 如何处理 LLM 幻觉问题
A: ...
```

> **建议**：把自己面过的、真实被问到过的问题和你的回答放进去。这会是你最宝贵的资产。

---

## 工作流程

### 自动模式（正常面试）

```text
面试官提问 → 音频采集 → 科大讯飞转写 → 静音 1.1 秒 → 自动触发 AI 回答
```

你在面试中正常对话，系统自动在面试官问完问题时生成回答。

### 手动兜底（快捷键）

```text
Ctrl+Shift+Enter → 强制触发 AI 回答（收集最近 30 秒所有转写文字）
```

当自动检测没有触发、或者你想针对某段话立即生成回答时使用。快捷键可在设置页面自定义。

---

## 双模式音频采集

| 模式 | 适用场景 | 实现 |
| ---- | -------- | ---- |
| 🎤 麦克风 | 面对面面试 | `getUserMedia({audio: true})` |
| 🖥️ 系统音频 | 在线面试（腾讯会议/Zoom/飞书） | `getDisplayMedia({audio: true})` |

> 系统音频模式会弹出浏览器对话框让你选择共享哪个标签页，选择带有音频的标签页即可。

---

## 技术架构

```text
┌──────────────────────────────────────────────────────┐
│ 前端 (React 19 + TypeScript + Vite) :5173            │
│                                                      │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ 音频采集  │→│ 讯飞 RTasr │→│ AI 回答生成       │  │
│  │ useAudio  │  │ WebSocket │  │ (DeepSeek API)   │  │
│  │ Capture   │  │ 实时转写   │  │ + personal/ 注入  │  │
│  └──────────┘  └───────────┘  └──────────────────┘  │
│                      ↓                               │
│              全局快捷键监听                           │
│           Ctrl+Shift+Enter 兜底                      │
├──────────────────────────────────────────────────────┤
│ 后端 (FastAPI + PostgreSQL) :9000                    │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ JWT 认证 │  │ 会话管理   │  │ 消息持久化        │  │
│  └──────────┘  └───────────┘  └──────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 前端技术栈

- React 19 + TypeScript + Vite
- Zustand（状态管理）+ Immer
- Ant Design（UI 组件）
- WebAudio API（音频采集管线）
- react-markdown（AI 回答渲染）

### 后端技术栈

- FastAPI + Uvicorn
- PostgreSQL 18 + SQLAlchemy
- JWT 认证（bcrypt + python-jose）

---

## API 密钥申请

### 科大讯飞 RTasr（语音转写）

1. 注册 <https://www.xfyun.cn/>
2. 控制台 → 语音转写 → 实时语音转写 → 领取免费时长
3. 获取 AppId + APIKey

### DeepSeek（AI 回答生成）

1. 注册 <https://platform.deepseek.com/>
2. API Keys → 创建新 Key
3. 充值（按量计费，极便宜）

---

## 默认账户

| 项目 | 值 |
| ---- | --- |
| 用户名 | `test` |
| 密码 | `test1234` |

---

## 常见问题

### 系统音频采集没有声音？

- Chrome：必须选择「Chrome 标签页」而非整个屏幕，并勾选「分享标签页音频」
- Edge：选择「标签页」并勾选「分享音频」
- Firefox：不支持 `getDisplayMedia` 音频采集

### AI 回答不够像自己？

调优三个地方：

1. `personal/resume.md` — 写得更具体，加上你的真实表达习惯
2. `personal/qa-bank.md` — 补充更多你被问过的问题
3. `frontend/src/utils/questionDetection.ts` 中的 `buildInterviewSystemPrompt()` — 调整 Prompt 指令

### 自动触发时机不准确？

当前触发条件是「静音 1.1 秒后触发」，如果面试官说话有停顿可能误触发，如果面试官连续提问可能漏触发。所以设计了 **Ctrl+Shift+Enter 快捷键作为兜底**——任何时候你觉得该回答了但 AI 没反应，按一下就行。

---

## 当前版本

**v0.4-dev** — 个人定制版

- [x] 双模式音频采集（麦克风 + 系统音频）
- [x] 实时语音转写（科大讯飞 RTasr）
- [x] AI 自动回答（DeepSeek）
- [x] WebSocket 断线自动重连
- [x] 个人简历注入（`personal/resume.md`）
- [x] 预设问答匹配（`personal/qa-bank.md`）
- [x] 快捷键手动兜底（`Ctrl+Shift+Enter`）
- [x] 手动文字输入（底部输入框）
- [x] 会话持久化（PostgreSQL）
- [ ] 快捷键自定义设置页面
- [ ] 更精准的问题边界检测

---

## 启动命令速查

```bash
# 终端 1 — 后端
cd backend && venv\Scripts\activate && python run_server.py

# 终端 2 — 前端
cd frontend && npm run dev

# 验证
curl http://localhost:9000/health       # → {"status":"healthy"}
curl http://localhost:5173               # → 前端页面
```

---

## 项目结构

```text
interview-helper/
├── personal/                # 【你的个人资料 — 唯一需要手动维护的目录】
│   ├── resume.md            #   简历
│   └── qa-bank.md           #   高频面试题标准答案
├── frontend/                # React 前端
│   ├── src/
│   │   ├── api/             #   API 封装（DeepSeek, 讯飞 RTasr）
│   │   ├── hooks/           #   自定义 Hook（useAudioCapture）
│   │   ├── pages/           #   页面（InterviewMeeting, Settings）
│   │   ├── store/           #   Zustand 状态管理
│   │   └── utils/           #   工具函数（Prompt 构建, 问题检测）
│   └── public/
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── auth.py          #   JWT 认证
│   │   ├── models.py        #   数据库模型
│   │   ├── schemas.py       #   Pydantic 模型
│   │   └── routers/         #   API 路由
│   └── main.py              #   应用入口
└── memory-bank/             # 开发文档
```
