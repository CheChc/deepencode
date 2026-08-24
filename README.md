# deepencode

opencode 风格的 **DeepSeek Harness (dsh) 终端交互界面**——一个 out-of-tree plugin bundle,直接骑在 `dsh-base` 之上,不引入 Web 运行时。

```
⚕ deepseek-v4-pro │ BUILD ws │ ♻ 91% │ 9.4K/1.0M ░░░░░░░░░░░░░░░░ 1% │ 33s
```

## 功能

| 能力 | 实现 |
|---|---|
| **build / plan 模式** | `Tab` 一键切换;`/plan [消息]` 进入、`/plan off` 退出;plan 审批走终端内 `📋 批准计划` 弹窗 |
| **模型切换** | `/model`:供应商 → 模型 → 思考强度 三级选择;DeepSeek 原生模型 + 任意第三方 OpenAI 兼容供应商 |
| **动态思考强度** | `/effort`:不换模型直接切换思考强度(与 dsh web 模型选择器一致),状态栏模型段实时显示 `model·effort` |
| **第三方供应商管理** | `/provider add`(route/baseURL/APIKey/模型列表)、`/provider rm`;写入 `settings.yaml` 热生效,与 dsh web 的 Models 页一致 |
| **Hermes 风格状态栏** | 模型名、缓存命中率 `♻ %`、上下文用量/上限 + 彩色阈值进度条、会话时长、模式/权限徽章 |
| **权限预设** | `Shift+Tab` 循环;`/permissions read-only / workspace-write / danger-full-access` |
| **终端内审批/提问** | 工具审批弹窗(允许一次/拒绝)、ask_user_question 弹窗(选项/plan 评审) |
| **会话** | `--resume <id>` 恢复并回放历史;`/sessions` 列出持久会话 |
| **状态** | `/status` 会话信息、`/help` 全部命令、`Ctrl+C` 取消当前轮次(再按退出) |

## 安装

```bash
# 1. 安装 dsh 启动器(如未安装)
npm install -g @deepseek-ai/dsh

# 2. 建 tui profile 并装入本插件
dsh plugin --profile tui add @your-scope/deepencode   # 或 npm 包名

# 3. 启动
dsh --profile tui                          # 新会话
dsh --profile tui --resume <sessionId>     # 恢复会话
```

本地开发调试:

```bash
git clone <this-repo> && cd deepencode
pnpm install && pnpm build
dsh plugin --profile tui add file:$PWD   # 链接本地包
dsh --profile tui
```

## 斜杠命令

| 命令 | 说明 |
|---|---|
| `/plan [off\|消息]` | 进入/退出 plan 模式;带消息则进入并提交 |
| `/model` | 供应商 → 模型 → 思考强度 |
| `/effort` | 不换模型,直接切换当前模型的思考强度 |
| `/provider add\|rm` | 第三方供应商管理 |
| `/permissions [name]` | 权限预设切换 |
| `/sessions` | 持久会话列表 |
| `/status` | 模式/权限/模型信息 |
| `/help` | 命令列表 |
| `/quit` | 退出 |

## 快捷键

- `Enter` 发送;`Shift+Enter` / `Alt+Enter` 换行;`Tab` 文件路径补全(输入框非空时)
- `Tab`(输入框为空)build ⇄ plan 切换(静默,状态栏徽章/编辑器边框即反馈)
- `Shift+Tab` 权限预设循环
- `Ctrl+C` 运行中取消轮次;空闲时退出
- 弹窗:`↑/↓` 选择、`Enter` 确认、`Esc` 取消

## 架构

- **装配**:profile bundle(`dsh.bundle.patch` → `cordis.patch.yml`),与官方 `dsh-headless` 同构:
  `tui-startup`(解析 `--resume`,发布 `tuiStartup` 服务)+ `tui-runner`(终端主循环)。
- **渲染**:[@earendil-works/pi-tui](https://www.npmjs.com/package/@earendil-works/pi-tui)
  差分渲染 + alternate screen(`ScrollView` 转录区 / `Editor` 输入 / 状态栏)。
- **核心服务**(全部来自 `dsh-base`,无需额外挂载):
  - `ctx.agents.create/resume` 会话生命周期;`ctx.on('session/event')` 流式事件
  - `ctx.planMode.set/get` plan 模式;`ctx.permissionPresets` 权限
  - `ctx.llm` 模型目录;`installModelSelection` 运行中切换模型;`ctx.settings` 供应商配置
  - `ctx.sessionProjections` 读取 `tokenUsage`(缓存命中率)与 `contextPressure`(上下文用量)
  - `ctx.userQuestions.registerProvider` + `approval/request` waterfall 终端应答
- **兼容性**:dsh `0.1.1-rc.2`;Node ≥ 22。

## 多终端支持

- **macOS / Windows / Linux** 全平台可用:pi-tui 自带 darwin(arm64/x64)与 win32(arm64/x64)原生预编译;Windows 下通过 Windows Terminal(ConPTY)运行,无需安装额外字体;
- 跨平台路径显示统一走 `os.homedir()`(Windows 下 `USERPROFILE`);OSC 11 黑色背景在不支持的终端上自动降级为逐行黑底;
- Windows 推荐 Windows Terminal / VS Code 终端;iTerm2、Kitty、Ghostty、WezTerm 体验最佳(支持 Shift+Enter 区分);
- UI 文案全中文(含 `--help`、斜杠命令说明、弹窗提示)。

## 配色(opencode 对齐)

- **BUILD = 蓝**(#2563eb)、**PLAN = 橙**(#ea580c),状态栏徽章与模式切换提示均使用对应颜色;
- **整体黑色背景**:启动时经 OSC 11 将终端背景置黑(iTerm2/Kitty/Ghostty 支持),退出时恢复原背景色;不支持 OSC 11 的终端退化为逐行黑色填充;
- 状态栏始终全宽黑底,弹窗(审批/选择器/输入)黑底圆角风格。

## 状态栏说明(Hermes 参考)

```
⚕ <模型> │ <BUILD|PLAN> <权限> │ ♻ <缓存命中率> │ <已用>/<上限> [████░░] <百分比> │ <时长>
```

- 上下文进度条颜色阈值:<50% 绿,50–80% 黄,80–95% 橙,≥95% 红;
- 窄终端自动降级:先隐藏费用/缓存段,再收缩进度条;
- 缓存命中率 = `cacheReadTokens / (cacheReadTokens + uncachedInputTokens)`。

## License

MIT
