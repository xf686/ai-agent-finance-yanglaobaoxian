# 🏡 安享养老 · AI规划助手

**国民养老保险小程序 AI赋能方案 Demo**

基于 RAG + Function Call + Memory + Voice + Digital Avatar 的智能养老规划助手，将小程序原有的8个独立计算器整合为一个AI对话入口，实现从”人找功能”到”功能找人”的体验升级。

-----

## ✨ 功能亮点

|版本|能力              |说明                                                 |
|--|----------------|---------------------------------------------------|
|V1|🤖 LLM对话         |MiniMax M2大模型，对话式交互替代表单                            |
|V2|📚 RAG知识库        |10篇养老政策/产品文档，检索增强回答，展示引用来源                         |
|V3|⚡ Function Call |3个精确计算函数（养老金测算、缺口分析、方案推荐），消除AI幻觉                   |
|V4|🧠 Memory        |用户画像自动提取+持久化，关闭再开记忆还在                              |
|V5|🎤 Voice         |语音输入（Web Speech）+ 语音输出（MiniMax TTS），文字→文字回复，语音→语音回复|
|V6|🤖 Digital Avatar|2D卡通数字人，嘴巴/眨眼动画与AI语音同步                             |

-----

## 🎬 演示效果

### 对话式养老规划

输入个人信息，AI自动调用计算引擎，精确测算养老金、分析缺口、推荐方案。

### RAG知识检索

提问养老政策问题，AI基于知识库回答，展示参考来源。

### 语音 + 数字人

语音输入自动识别发送，AI语音回复时数字人嘴巴同步动。

-----

## 🚀 快速开始

### 环境要求

- Node.js v18+
- npm
- Chrome 或 Safari 浏览器

### 安装运行

```bash
# 克隆项目
git clone https://github.com/你的用户名/pension-ai.git

# 进入项目目录
cd pension-ai

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

浏览器打开 `http://localhost:5173/` 即可使用。

### 切换版本

编辑 `src/App.jsx`，修改导入路径：

```javascript
export { default } from './PensionAI_v1'  // V1 基础对话
export { default } from './PensionAI_v2'  // V2 + RAG
export { default } from './PensionAI_v3'  // V3 + Function Call
export { default } from './PensionAI_v4'  // V4 + Memory
export { default } from './PensionAI_v5'  // V5 + Voice
export { default } from './PensionAI_v6'  // V6 + Digital Avatar（完整版）
```

### 接入 MiniMax API

1. 注册 [MiniMax开放平台](https://platform.minimax.io)，获取 API Key
1. 点击界面右上角 ⚙️ 按钮
1. 输入 API Key，点击”连接 API”

未接入API时为演示模式，使用预设回复和浏览器原生TTS。

-----

## 📁 项目结构

```
pension-ai/
├── data/
│   └── knowledgeBase.json        # 知识库（10篇养老政策/产品文档）
├── src/
│   ├── App.jsx                   # 入口文件（切换版本）
│   ├── PensionAI_v1.jsx          # V1 基础对话
│   ├── PensionAI_v2.jsx          # V2 + RAG
│   ├── PensionAI_v3.jsx          # V3 + Function Call
│   ├── PensionAI_v4.jsx          # V4 + Memory
│   ├── PensionAI_v5.jsx          # V5 + Voice
│   └── PensionAI_v6.jsx          # V6 + Digital Avatar
├── vite.config.js                # Vite配置（@data路径别名）
├── CLAUDE.md                     # 项目说明文档
└── README.md                     # 本文件
```

-----

## 🛠️ 技术栈

|技术                  |用途                |
|--------------------|------------------|
|React + Vite        |前端框架 + 构建工具       |
|MiniMax M2          |LLM大模型（OpenAI兼容格式）|
|MiniMax Speech-02-HD|TTS语音合成           |
|Web Speech API      |浏览器原生语音识别         |
|localStorage        |用户画像持久化存储         |
|SVG Animation       |2D数字人动画           |

-----

## 🧮 养老金计算说明

Demo中的计算公式基于国家养老金计算规则：

- **基础养老金** = 社平工资 × (1+缴费指数) ÷ 2 × 缴费年限 × 1%
- **个人账户养老金** = 个人账户余额 ÷ 计发月数
- **计发月数**：50岁=195，55岁=170，60岁=139，65岁=101

⚠️ 公式为简化版（社平工资使用城市固定值、未计个人账户利息），仅供演示。实际以社保部门核定为准。

-----

## 📊 Demo演示脚本

按以下顺序操作可展示所有能力：

1. **Function Call + Memory**：输入 `我是女生，30岁，在上海工作，月薪2万，帮我做一份完整的养老规划`
1. **Memory验证**：输入 `帮我重新算一下养老金`（不用再提供信息）
1. **Memory更新**：输入 `我涨薪到3万了，重新帮我分析缺口`
1. **RAG检索**：输入 `社保断缴了怎么办`
1. **RAG另一个场景**：输入 `个人养老金账户有什么税收优惠`
1. **语音交互**：点🎤说”我想了解退休年龄政策”
1. **持久化验证**：关闭浏览器重新打开，显示”欢迎回来”

-----

## 🏗️ 架构设计

### 当前Demo架构

```
用户 → 交互层（对话/语音/数字人）
     → 智能层（LLM意图识别 + 参数提取）
     → 能力层（RAG检索 + Function Call计算 + Memory画像）
     → 数据层（知识库JSON + localStorage + 计算函数）
```

### 生产环境升级方向

|Demo方案         |生产方案                 |
|---------------|---------------------|
|关键词检索          |Embedding语义检索 + 向量数据库|
|localStorage   |加密数据库 + 用户登录体系       |
|前端Function Call|MCP标准化Server         |
|浏览器Web Speech  |科大讯飞ASR / 微信原生录音     |
|SVG卡通数字人       |3D数字人SDK（腾讯云/硅基智能）   |
|前端API调用        |后端代理 + API Key安全管理   |

-----

## ⚠️ 免责声明

- 本项目仅为方案演示Demo，不构成任何投资或保险购买建议
- 知识库为模拟数据，非国民养老保险公司真实产品信息
- 养老金计算为简化估算，实际以社保部门核定为准
- API Key请勿提交到公开仓库

-----

## 📄 License

MIT


# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
