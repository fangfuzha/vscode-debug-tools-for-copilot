#!/usr/bin/env node
/**
 * 导出 XLIFF 翻译中间产物。
 *
 * 扩展的界面文案分两层，翻译时需要一起交给译者：
 *   1. manifest 层：package.nls.json —— 供 package.json 里的 %占位符% 使用；
 *   2. 运行时层：l10n/bundle.l10n.json —— 供源码里的 vscode.l10n.t(...) 使用。
 *
 * vscode-l10n-dev 的 generate-xlf 支持同时打包这两类文件，产出单个 XLIFF；
 * 回灌用 scripts/l10n-import.js。
 *
 * 注意：l10n-xlf/ 会被整体重建，避免上一次的旧 XLIFF 残留下来被重复导入。
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const XLF_DIR = path.join(ROOT, "l10n-xlf");
const XLF_FILE = path.join(XLF_DIR, "vscode-debug-tools.l10n.xlf");

const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
);
const l10nDir = path.resolve(ROOT, manifest.l10n ?? "./l10n");

// 翻译源：manifest 层在扩展根目录，运行时层在 package.json 声明的 l10n 目录
const sources = [
  path.join(ROOT, "package.nls.json"),
  path.join(l10nDir, "bundle.l10n.json"),
];

for (const source of sources) {
  if (!fs.existsSync(source)) {
    console.error(
      `✗ 找不到翻译源文件：${path.relative(ROOT, source)}`,
    );
    process.exit(1);
  }
}

// 清掉上一次的旧 XLIFF，避免残留文件被重复导入
if (fs.existsSync(XLF_DIR)) {
  for (const file of fs.readdirSync(XLF_DIR)) {
    if (file.endsWith(".xlf")) {
      fs.unlinkSync(path.join(XLF_DIR, file));
    }
  }
} else {
  fs.mkdirSync(XLF_DIR);
}

const cli = require.resolve("@vscode/l10n-dev/dist/cli.js");
const result = spawnSync(
  process.execPath,
  [cli, "generate-xlf", "--outFile", XLF_FILE, ...sources],
  { stdio: "inherit" },
);
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`\n✓ 已导出 ${path.relative(ROOT, XLF_FILE)}`);
console.log("  包含 manifest 层（package.nls.json）与运行时层（bundle.l10n.json）。");
console.log(
  "  译者回传时需保留 <file> 的 target-language 属性，并为每个 trans-unit 填入 <target>。",
);
