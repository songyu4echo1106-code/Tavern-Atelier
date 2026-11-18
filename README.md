# 酒馆工坊 · Tavern Atelier

面向 SillyTavern 创作者的本地优先桌面工作台。当前仓库是首个可运行 MVP，不是 SillyTavern 的完整复刻。

## 运行

### 双击启动（当前电脑）

直接双击仓库根目录的 `启动酒馆工坊.cmd`。首次运行会检查依赖，已有构建时会直接打开应用，不需要手动输入命令。

```powershell
npm.cmd install
npm.cmd run build
npm.cmd start
```

开发模式：

```powershell
npm.cmd run dev
```

Windows PowerShell 如禁止运行 `npm.ps1`，请使用上述 `npm.cmd` 命令。

## 已实现

- 角色卡、世界书、正则、Chat Completion 预设的统一本地素材库。
- JSON/PNG 导入、SHA-256 文件去重、角色内嵌世界书与角色级正则自动提取、预设级正则提取。
- PNG `ccv3` 优先读取、损坏时回退 `chara`，导出时同步写入 V3/V2，保留其他 PNG 数据块。
- 角色卡常用字段、世界书条目、正则规则和 Chat 预设条目编辑。
- 未知 JSON 字段保留及原始 JSON 高级编辑。
- 独立世界书/正则写回关联素材，写回和导出前自动保留版本。
- 手动版本、完整素材元数据恢复、恢复生成新版本、过期草稿保存冲突检测。
- JavaScript 正则 Worker 测试，支持 flags、捕获组、`{{match}}`、Trim Out 和宏替换模式，800ms 超时终止。
- Chat 预设请求展开、角色与关键词世界书注入、最终消息与请求/响应查看。
- 共用 OpenAI-compatible 服务配置，密钥由 Electron `safeStorage` 加密。
- AI 建议差异预览，用户确认后才应用。
- 本地备份与恢复，备份包含原始文件但排除 API 密钥；恢复同 ID 服务时保留本机已有密钥。
- 预设条目分组：在分组内插入 / 复制 / 导入新条目时自动继承该分组，拖入分组无需精确拖到分组标签。
- 预设条目多选（Ctrl / Shift）与多选批量拖拽排序，可整体移入分组。
- 素材库右上角统计全部素材 token（估算值，排除“其它”分类）。

## 数据位置

应用数据保存在 Electron 的 `userData/atelier-data` 下：

- `workspace.json`：素材、版本、服务和测试记录。
- `originals/`：不可变原始导入文件。
- `workspace.json.before-restore-*`：恢复前的自动副本。

测试历史最多保留 50 次。备份文件为便携 JSON，原始 PNG 以 Base64 包含在备份中。

## 首版边界

- 世界书测试是关键词级快速预览，不完整模拟递归、概率、预算和多源排序。
- Chat 测试实现常用条目展开，不保证覆盖全部宏、角色覆盖、扩展注入、上下文裁减和服务商专有转换。
- 通用 AI 测试仅发送常见 OpenAI-compatible 参数，其余采样字段保留在预设 JSON 中。
- 不执行 STscript、Quick Reply、工具调用或任何导入的扩展代码。
- JSON 角色卡导出统一为 V2；PNG 导出需要原始 PNG 作为图像容器。
- 当前备份采用完整替换恢复，尚未提供逐素材合并恢复。

## 构建

```powershell
npm.cmd run build
```

该命令依次执行 React/共享代码 TypeScript 检查、Vite 生产构建和 Electron TypeScript 编译。

## 发布给别人使用

在 Windows 上运行：

```powershell
npm.cmd run dist:win
```

产物位于 `release/`：

- `Tavern-Atelier-Setup-0.2.3-x64.exe`：Windows 安装包，用户可选择安装目录，并自动创建开始菜单和桌面快捷方式。
- `Tavern-Atelier-Portable-0.2.3-x64.zip`：免安装版，解压后运行其中的 `TavernAtelier.exe`，请勿只解压部分文件。

发布时上传这两个文件即可，接收者不需要安装 Node.js、SillyTavern 或本项目依赖。建议同时提供版本号、文件 SHA-256 和更新说明。正式发布时可用 `gh release create` 把 Setup 与 Portable 一并上传到 GitHub Releases。

当前安装包未配置商业代码签名证书，Windows SmartScreen 可能提示“未知发布者”。公开分发前建议使用可信代码签名证书签名，不要引导用户关闭安全功能。

`npm.cmd run pack` 可生成未打包的安装目录，用于发布前检查。发布其他操作系统时，需要在对应系统上调整并执行 Electron Builder 构建。
