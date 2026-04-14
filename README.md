# VS Code 调试工具 for Copilot

一个通过本地 MCP 服务向 Copilot Chat 暴露断点和调试工作台工具的 VS Code 扩展。

## 功能特性

- 注册本地 MCP 服务 `VS Code Debug Tools for Copilot`
- 支持通过 Copilot 管理当前工作区的断点
- 支持 TypeScript 开发
- 包含完整的测试和代码检查配置

## 扩展用法

### 1. 安装与配置

安装扩展后，首次使用需要配置 AI agent：

1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入 "Configure AI Agent MCP" 并执行
3. 在弹出的选择框中勾选要配置的 agent（GitHub Copilot、Cline、Cursor）
4. 点击确定，扩展会自动修改相应配置文件

### 2. 在 Copilot 中使用断点工具

配置完成后，您可以在 Copilot Chat 中使用以下断点管理功能：

- **查看断点**：询问 Copilot "列出当前工作区的所有断点"
- **添加断点**：询问 Copilot "在第10行添加断点" 或 "在函数foo处添加断点"
- **删除断点**：询问 Copilot "删除第10行的断点"
- **启用/禁用断点**：询问 Copilot "禁用第10行的断点"
- **调试控制**：询问 Copilot "开始调试" 或 "单步执行"

### 3. 支持的工具列表

扩展提供完整的断点和调试工具集，详细说明请参考：

- [中文工具文档](doc/mcp-tools.zh-cn.md)
- [English Tool Documentation](doc/mcp-tools.en.md)

## 开发环境要求

- Node.js 20.x 或更高版本
- VS Code 1.115.0 或更高版本

## 编译与运行

1. **安装依赖**

   在项目根目录下执行：

   ```sh
   npm install
   ```

2. **编译 TypeScript 代码**

   ```sh
   npm run compile
   ```

   或使用监听模式自动编译：

   ```sh
   npm run watch
   ```

3. **在 VS Code 中调试插件**
   - 活动编辑器聚焦`入口文件(一般是 src/extension.ts)`或者`编译输出的js文件(out/extension.js)`，按 **F5** 启动插件调试，会自动打开一个新的 VS Code 窗口加载本插件。（通过js文件调试时，需要选择`vscode 扩展开发`调试器）

4. **测试插件功能**

   在新打开的 VS Code 窗口中：
   - 按 `Ctrl+Shift+P` 打开命令面板
   - 输入 "显示欢迎消息" 并执行
   - 应该看到弹出的欢迎信息

5. **使用 Copilot 的 MCP 断点工具**

   同时提供了一个 Copilot skill：
   - [Breakpoint MCP Tools Guide](src/lm/skills/breakpoint-mcp-tools-guide/SKILL.md)

   详细说明已迁移到 `doc/` 目录中的文档：
   - [doc/mcp-tools.zh-cn.md](doc/mcp-tools.zh-cn.md)：中文版本
   - [doc/mcp-tools.en.md](doc/mcp-tools.en.md)：English version

   这些文档包含完整的工具列表、输入结构、返回值、匹配规则和路径处理说明。

6. **代码检查**

   ```sh
   npm run lint
   ```

7. **运行测试**

   ```sh
   npm test
   ```

## 项目结构

```
├── src/
│   └── extension.ts          # 插件主入口文件
├── out/                      # 编译输出目录
├── package.json             # 项目配置和依赖
├── tsconfig.json            # TypeScript 配置
└── README.md                # 项目说明文档
```

## 打包与发布

1. **安装 vsce 工具**

   ```sh
   npm install -g vsce
   ```

2. **打包插件**

   ```sh
   vsce package
   ```

3. **发布到市场**

   ```sh
   vsce publish
   ```

## 开发提示

- 修改代码后需要重新编译才能在调试窗口中看到更改
- 可以使用 `npm run watch` 监听文件变化自动编译
- 调试时可以在代码中设置断点进行调试

## 相关资源

- [VS Code 扩展开发文档](https://code.visualstudio.com/api)
- [VS Code 扩展示例](https://github.com/Microsoft/vscode-extension-samples)
