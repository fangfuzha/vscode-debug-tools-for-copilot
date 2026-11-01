# VS Code 调试工具 for Copilot

让 Copilot 直接操作你 VS Code 里的断点和调试会话：扩展内置了一个本地 MCP 服务，AI 可以列出/添加/修改断点、启动与单步调试、查看调用栈和变量，而不用你在调试器里手动点。

English version: [README.en.md](README.en.md)

## 功能

- **断点管理**：新增源代码断点和函数断点，删除、启用/禁用，修改条件、命中次数和日志消息，批量启停某个文件的所有断点，按关键字/类型/状态搜索断点，统计断点数量，一键清空断点。
- **调试会话控制**：启动 `launch.json` 配置，继续、暂停、单步进入/跳过/跳出、重启、停止，列出当前调试会话与线程。
- **调试状态检视**：查看调用堆栈、作用域和变量，在 `watch` / `repl` / `hover` 上下文里求值表达式。
- **Watch 表达式**：维护一份独立的 watch 列表并批量求值。
- **多工作区支持**：路径可以是绝对路径或工作区相对路径，多根工作区下用 `workspaceFolderPath` 精确指定目标文件夹。
- **DebugMCP 兼容入口**：额外提供 `get_debug_instructions`、`start_debugging`、`get_variables_values` 等入口，方便复用常见客户端的调用方式。

## 运行原理

1. 扩展激活时，在本机回环地址 `127.0.0.1` 的随机端口上启动一个 HTTP MCP 服务，只监听本机。
2. 通过 VS Code 的 `mcpServerDefinitionProviders` 贡献点把这个服务注册给 VS Code，MCP 服务器列表中会出现 `VS Code Debug Tools for Copilot`。
3. 每个 MCP 工具背后都是 VS Code 官方的调试与断点 API，所以所有操作都真实作用于你当前打开的工作区，新增的断点也会正常显示在编辑器的断点槽里。
4. 端口每次启动都会变化，因此扩展在启动时会自动把已配置的客户端（Cline / Cursor）刷新到当前 endpoint，无需手动改配置。

简单说：调试能力仍然完全由 VS Code 提供，AI 只是通过 MCP 协议下达指令。

## 安装

在 VS Code 扩展市场搜索 "VS Code 调试工具 for Copilot" 并安装，需要 VS Code 1.144.0 或更高版本。

## 配置

### Copilot Chat（内置集成）

Copilot Chat 通过 VS Code 原生的 MCP 集成使用本扩展的服务，不需要额外配置：

1. 打开 Copilot Chat，点击工具选择器（聊天输入框上方的工具图标）。
2. 在列表中勾选 `VS Code Debug Tools for Copilot`。
3. 之后在对话里即可调用断点和调试工具。

也可以执行命令面板里的 `MCP: List Servers`，确认该服务器已经注册。

### 其他 MCP 客户端（Cline / Cursor）

1. 按 `Ctrl+Shift+P` 打开命令面板，执行 `配置 AI 代理 MCP`。
2. 在多选列表中勾选要配置的客户端（当前支持 Cline、Cursor），已经配置过的客户端会默认勾选。
3. 点击确定，扩展会写入对应的配置文件（文件不存在时自动创建），并把服务指向当前 endpoint。
4. 之后每次启动 VS Code，扩展都会自动把这些客户端的地址刷新为当前端口。

取消勾选某个已配置的客户端再确定，即可把它从配置文件中移除；如果配置文件里已经存在同名的 `debugmcp` 条目，扩展会就地更新，而不是新增一条。

### 查看状态与导出配置

- `显示 MCP 诊断`：在 "VS Code Debug Tools" 输出面板中打印当前 endpoint、各客户端的配置状态、断点数量、调试会话数量等，并可一键复制 endpoint。
- `导出 MCP 配置`：生成可复制的 JSON 片段，可选择通用 server 条目、VS Code `mcp.json`（`servers` 包装）或通用 `mcpServers` 包装三种格式，用于配置其他 MCP 客户端。

## 使用

在 Copilot Chat 里直接用自然语言描述需求即可，例如：

- 断点相关
  - “列出当前工作区的所有断点”
  - “在 `src/app.ts` 第 42 行加一个断点”
  - “给 `handleRequest` 函数加个断点，条件是 `user.role === 'admin'`”
  - “禁用第 42 行的断点” / “把这个文件里的断点全部禁用” / “清空所有断点”
- 调试控制
  - “启动 launch 配置 `Run Extension`”
  - “继续运行” / “暂停” / “单步跳过” / “单步进入” / “停止调试”
- 调试检视
  - “看看当前调用栈和局部变量”
  - “在调试上下文里求值 `payload.items.length`”

新增断点后，工具会返回该断点的稳定标识（`key`）。后续删除或修改断点时优先使用 `key`，可以避免同名函数或同一行多个断点带来的歧义。

## 工具一览

断点管理

| 工具 | 作用 |
| --- | --- |
| `list_breakpoints` | 列出全部断点 |
| `list_breakpoints_in_file` | 列出某个文件中的断点 |
| `get_breakpoint_statistics` | 统计断点总数、启用数与类型分布 |
| `search_breakpoints` | 按关键字、类型、启用状态搜索断点 |
| `add_source_breakpoint` | 在文件的某一行添加源代码断点 |
| `add_function_breakpoint` | 按函数名添加函数断点 |
| `remove_breakpoint` | 删除断点 |
| `set_breakpoint_enabled` | 启用或禁用断点 |
| `update_breakpoint` | 修改断点的状态、条件、命中次数或日志消息 |
| `set_breakpoints_enabled_in_file` | 批量启用/禁用某个文件的所有源代码断点 |
| `clear_breakpoints` | 清空所有断点 |

调试会话

| 工具 | 作用 |
| --- | --- |
| `list_debug_sessions` | 列出当前调试会话 |
| `list_debug_threads` | 列出某个会话的线程 |
| `pause_debug_session` | 暂停调试 |
| `continue_debug_session` | 继续运行 |
| `step_over_debug_session` | 单步跳过 |
| `step_into_debug_session` | 单步进入 |
| `step_out_debug_session` | 单步跳出 |
| `restart_debug_session` | 重启调试会话 |
| `stop_debug_session` | 停止调试 |

工作台与检视

| 工具 | 作用 |
| --- | --- |
| `open_debug_source_file` | 在编辑器中打开并定位到某个源文件 |
| `list_debug_launch_configurations` | 列出 `launch.json` 中的调试配置 |
| `start_debug_launch_configuration` | 按名称或配置对象启动调试 |
| `list_debug_call_stack` | 查看调用堆栈 |
| `list_debug_scopes` | 查看某个栈帧的作用域 |
| `list_debug_variables` | 展开变量引用 |
| `evaluate_debug_expression` | 在调试上下文中求值表达式 |
| `list_debug_watch_expressions` | 列出 watch 表达式 |
| `add_debug_watch_expression` | 添加 watch 表达式 |
| `remove_debug_watch_expression` | 移除 watch 表达式 |
| `clear_debug_watch_expressions` | 清空 watch 表达式 |
| `evaluate_debug_watch_expressions` | 批量求值 watch 表达式 |

DebugMCP 兼容入口

| 工具 | 作用 |
| --- | --- |
| `get_debug_instructions` | 返回 Markdown 格式的调试指南 |
| `start_debugging` | 启动调试，可按语言自动生成默认配置 |
| `get_variables_values` | 读取当前暂停帧的作用域变量 |

每个工具的完整参数、返回值和匹配规则见：

- [中文工具文档](doc/mcp-tools.zh-cn.md)
- [English tool documentation](doc/mcp-tools.en.md)

扩展还附带一个 Copilot skill（`VS Code Debug Tools Guide`），用于指导 Copilot 选择合适的工具并正确传参。

## 多工作区与路径规则

- 文件路径既可以使用绝对路径，也可以使用相对于工作区文件夹的相对路径。
- 在多根工作区中，相对路径建议同时传入 `workspaceFolderPath`；不传时扩展会尝试推断唯一的工作区文件夹，若存在多个候选会返回歧义错误。
- `list_debug_launch_configurations` 与 `start_debug_launch_configuration` 在多个工作区存在同名 launch 配置时，也需要 `workspaceFolderPath` 来指定目标工作区。
- `list_debug_launch_configurations` 只读取工作区里的 `.vscode/launch.json`，由动态 `DebugConfigurationProvider` 提供的配置不会被自动枚举。
- 调试会话类工具都支持可选的 `sessionId`，不传时作用于当前活动会话；`sessionId` 无效会直接报错，不会去猜测目标会话。

## 常见问题

- **Copilot 里看不到这些工具**：确认工具选择器里已勾选 `VS Code Debug Tools for Copilot`；再执行 `显示 MCP 诊断`，查看输出面板里的 endpoint 和报错信息。
- **客户端提示连不上**：MCP 端口每次启动都会变化。扩展会自动刷新 Cline / Cursor 的配置；如果是手动配置的其它客户端，请执行 `导出 MCP 配置` 重新拷贝当前 endpoint。
- **找不到某个 launch 配置**：确认它写在工作区的 `.vscode/launch.json` 里；动态 provider 提供的配置不会出现在列表中。
- **调用栈或变量为空**：这类工具需要在程序暂停时使用，请先让断点命中或执行 `暂停调试`。

## 调试

- 运行日志与诊断信息在 **“VS Code Debug Tools”** 输出面板中（视图 → 输出 → 选择该通道）。
- 需要调试扩展自身时：在 VS Code 中打开本项目，在 `src/extension.ts` 上按 **F5** 启动 Extension Development Host；配合 `npm run watch` 可以在保存后自动重新编译。
- 也可以直接执行以下命令（需要 Node.js 22 或更高版本）：

  ```sh
  npm install     # 安装依赖
  npm run compile # 编译 TypeScript
  npm run watch   # 监听模式自动编译
  npm run lint    # 代码检查
  ```

## 相关资源

- [在 VS Code 中使用 MCP 服务器](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)
- [VS Code 调试 API](https://code.visualstudio.com/api/references/vscode-api)
- [Model Context Protocol](https://modelcontextprotocol.io/)
