# 深寻鲸娘 · 鲸汐

> 一只住在桌面上的深海鲸娘。会眨眼、会害羞，也会安静地陪你敲代码。

基于 **Electron 37 + TypeScript + Webpack + Electron Forge** 的 Windows 桌面宠物：透明无边框窗口、拖拽移动、点击互动、状态机驱动动画、提醒事项、打字陪伴与本地持久化。

## 功能

- **状态机动画**：11 种状态、12 个触发条件、6 种互动，55 张成品 PNG 多帧动画
- **桌面互动**：摸摸头、喂食、玩耍等互动，带好感度与气泡反馈
- **窗口行为**：无边框透明窗口、拖拽、贴边、点击穿透，以及独立的仪表盘 / 提醒窗口
- **打字陪伴**：可选 `uiohook-napi` 全局键盘监听，打字时触发陪伴反应
- **本地持久化**：好感度、设置、提醒数据落盘，并对读入数据做校验
- **安全加固**：Electron Fuses 关闭 RunAsNode / Node CLI inspect、开启 cookie 加密与 asar 完整性校验

## 环境要求

- Windows 10/11 x64
- Node.js >= 20（开发环境使用 Node 24 验证）
- npm >= 10

## 快速开始

```bash
npm install
npm run dev
```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` / `npm start` | 启动开发模式（Webpack dev server） |
| `npm run check` | 类型检查 + 开发契约 / 规格 / 资产链接校验 + UI / 体验 / 资产 QA |
| `npm test` | 单元测试（状态机、持久化、拖拽、键盘监听、体验、端口） |
| `npm run test:e2e` | 打包宿主后运行端到端测试（需要可交互桌面） |
| `npm run test:dev-smoke` | 开发态冒烟测试 |
| `npm run preflight` / `npm run doctor` | 环境与依赖预检 |
| `npm run package:win` | 打包 Windows 应用目录 |
| `npm run make:win` | 生成 Windows 安装包（Squirrel） |
| `npm run portable:win` | 生成 Windows 便携版压缩包 |
| `npm run process:assets` | 从 `incoming-assets/` 处理生成成品素材（原始素材不入库） |

## 目录结构

```text
src/
  main.ts                 主进程入口
  preload.ts              预加载脚本（contextBridge）
  main/                   拖拽、持久化、键盘监听、日志、数据校验
  renderer/pet/           桌宠窗口与状态机
  renderer/reminder/      提醒窗口
  renderer/dashboard/     仪表盘窗口
  shared/contracts.ts     主进程 / 渲染进程共享契约
  assets/pet/             成品动画素材（55 张 PNG）
tools/                    开发、构建、打包与 QA 脚本
tests/                    单元测试与 E2E / soak 测试
pet-spec.json             角色、交互、主题与资产管线规格
qa/                       QA 报告与手动检查清单
```

## 素材说明

- `incoming-assets/` 是本机原始素材目录，体积较大，**不纳入版本库**；需要时自行放入后执行 `npm run process:assets`。
- `src/assets/pet/` 内为处理后的成品素材，是运行与构建所必需的。

## 许可证

代码以 [MIT](LICENSE) 许可发布。角色形象与美术素材的版权归作者所有，不包含在 MIT 许可范围内，未经许可请勿商用。

## 免责声明

本项目为个人桌面宠物作品，与任何第三方平台或产品无关。
