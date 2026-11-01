#!/usr/bin/env node
/**
 * 校验多语言配置的一致性。
 *
 * 检查项：
 * 1. 源码中的 vscode.l10n.t() 调用与 l10n/bundle.l10n.json 的键集合完全一致
 *    （母版既不缺键，也没有源码已废弃的残留键）
 * 2. 源码中不存在模板字面量形式的 l10n.t() 调用
 *    （@vscode/l10n-dev 无法提取，重新生成母版时会丢失该条目的翻译）
 * 3. l10n/bundle.l10n.zh-cn.json 与母版键集合一致，且每条的中英占位符完全相同
 * 4. package.nls.json 覆盖 package.json 引用的全部 %占位符%，且没有多余条目
 * 5. package.nls.zh-cn.json 与 package.nls.json 键集合一致
 *
 * 任何一项不满足都会以非零退出码结束，便于接入 CI。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const errors = [];

const readText = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(readText(relativePath));

const fail = (area, message) => errors.push({ area, message });

// ---------------------------------------------------------------- 源码扫描

/**
 * 递归收集 src 下的 TypeScript 文件。
 *
 * @param {string} dir 当前目录。
 * @returns {string[]} TypeScript 文件路径。
 */
function collectTypeScriptFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(entryPath));
    } else if (entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }
  return files;
}

/**
 * 提取源码里所有 vscode.l10n.t() 的字面量键。
 *
 * @param {string} filePath 源文件路径。
 * @returns {{keys: Map<string, string[]>, templates: {line: number, file: string}[]}}
 */
function extractL10nKeys(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const relativePath = path.relative(ROOT, filePath).replace(/\\/g, "/");
  const keys = new Map();
  const templates = [];

  const literalPattern =
    /vscode\.l10n\.t\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  let match;
  while ((match = literalPattern.exec(text)) !== null) {
    const raw = match[1];
    const key =
      raw[0] === "'"
        ? JSON.parse(`"${raw.slice(1, -1)}"`)
        : JSON.parse(raw);
    const line = text.slice(0, match.index).split("\n").length;
    if (!keys.has(key)) {
      keys.set(key, []);
    }
    keys.get(key).push(`${relativePath}:${line}`);
  }

  const templatePattern = /vscode\.l10n\.t\(\s*`/g;
  while ((match = templatePattern.exec(text)) !== null) {
    const line = text.slice(0, match.index).split("\n").length;
    templates.push({ file: relativePath, line });
  }

  return { keys, templates };
}

const sourceKeys = new Map();
const templateUsages = [];

for (const filePath of collectTypeScriptFiles(path.join(ROOT, "src"))) {
  const { keys, templates } = extractL10nKeys(filePath);
  for (const [key, locations] of keys) {
    if (!sourceKeys.has(key)) {
      sourceKeys.set(key, locations);
    }
  }
  for (const usage of templates) {
    templateUsages.push(usage);
  }
}

// ------------------------------------------------------- 1) 源码 vs 母版

const master = readJson("l10n/bundle.l10n.json");

for (const [key, locations] of sourceKeys) {
  if (!Object.prototype.hasOwnProperty.call(master, key)) {
    fail(
      "源码 → 母版",
      `源码中的 l10n.t() 调用未出现在 l10n/bundle.l10n.json（${locations[0]}）：${JSON.stringify(key).slice(0, 110)}`,
    );
  }
}

for (const key of Object.keys(master)) {
  if (!sourceKeys.has(key)) {
    fail(
      "母版多余",
      `l10n/bundle.l10n.json 中的键在源码里已不存在：${JSON.stringify(key).slice(0, 110)}`,
    );
  }
}

// ------------------------------------------------- 2) 模板字面量不可提取

for (const usage of templateUsages) {
  fail(
    "模板字面量",
    `${usage.file}:${usage.line} 使用了模板字面量形式的 vscode.l10n.t()，@vscode/l10n-dev 无法提取，重新生成母版会丢失其翻译，请改用普通字符串`,
  );
}

// --------------------------------------------- 3) 母版 vs 中文版与占位符

const chinese = readJson("l10n/bundle.l10n.zh-cn.json");

for (const key of Object.keys(master)) {
  if (!Object.prototype.hasOwnProperty.call(chinese, key)) {
    fail("中文版缺失", `母版有、中文版缺：${JSON.stringify(key).slice(0, 110)}`);
  }
}

for (const key of Object.keys(chinese)) {
  if (!Object.prototype.hasOwnProperty.call(master, key)) {
    fail("中文版多余", `中文版有、母版缺：${JSON.stringify(key).slice(0, 110)}`);
  }
}

const collectPlaceholders = (value) =>
  (String(value).match(/\{\d+\}/g) || []).slice().sort().join(",");

for (const key of Object.keys(master)) {
  if (!Object.prototype.hasOwnProperty.call(chinese, key)) {
    continue;
  }
  const expected = collectPlaceholders(master[key]);
  const actual = collectPlaceholders(chinese[key]);
  if (expected !== actual) {
    fail(
      "占位符",
      `中英占位符不一致：${JSON.stringify(key).slice(0, 90)}（母版 [${expected}] / 中文版 [${actual}]）`,
    );
  }
}

// ------------------------------------------------------- 4) manifest 层

const manifestText = readText("package.json");
const manifestPlaceholders = new Set();
for (const match of manifestText.matchAll(/"%([^%]+)%"/g)) {
  manifestPlaceholders.add(match[1]);
}

const manifestBundle = readJson("package.nls.json");
const manifestBundleChinese = readJson("package.nls.zh-cn.json");

for (const key of manifestPlaceholders) {
  if (!Object.prototype.hasOwnProperty.call(manifestBundle, key)) {
    fail(
      "manifest 缺失",
      `package.json 引用的 %${key}% 在 package.nls.json 中没有对应条目`,
    );
  }
}

for (const key of Object.keys(manifestBundle)) {
  if (!manifestPlaceholders.has(key)) {
    fail(
      "manifest 多余",
      `package.nls.json 中的 "${key}" 没有被 package.json 引用`,
    );
  }
}

for (const key of Object.keys(manifestBundle)) {
  if (!Object.prototype.hasOwnProperty.call(manifestBundleChinese, key)) {
    fail("manifest 中文缺失", `package.nls.json 有、package.nls.zh-cn.json 缺：${key}`);
  }
}

for (const key of Object.keys(manifestBundleChinese)) {
  if (!Object.prototype.hasOwnProperty.call(manifestBundle, key)) {
    fail("manifest 中文多余", `package.nls.zh-cn.json 有、package.nls.json 缺：${key}`);
  }
}

// ---------------------------------------------------------------- 输出

const summary = [
  `package.json 占位符: ${manifestPlaceholders.size}`,
  `package.nls.json: ${Object.keys(manifestBundle).length} / package.nls.zh-cn.json: ${Object.keys(manifestBundleChinese).length}`,
  `源码 l10n.t() 字面量键: ${sourceKeys.size}`,
  `母版: ${Object.keys(master).length} / 中文版: ${Object.keys(chinese).length}`,
];

console.log("=== 多语言配置检查 ===");
for (const line of summary) {
  console.log(`  ${line}`);
}

if (errors.length === 0) {
  console.log("\n✓ 检查通过，没有多余或缺失的键值。");
  process.exit(0);
}

console.log(`\n✗ 发现 ${errors.length} 个问题：`);
for (const error of errors) {
  console.log(`  [${error.area}] ${error.message}`);
}
console.log(
  "\n提示：新增 vscode.l10n.t() 调用后，执行 `npm run l10n` 重新生成母版，再同步中文版。",
);
process.exit(1);
