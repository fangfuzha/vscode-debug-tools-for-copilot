#!/usr/bin/env node
/**
 * 回灌译者交付的 XLIFF 译文。
 *
 * vscode-l10n-dev 的 import-xlf 会把 XLIFF 里的所有文件单元写进同一个 --outDir，
 * 但两类文件的落位要求不同：
 *   - package.nls.<语言>.json 必须位于扩展根目录（VS Code 只在 package.json 旁边找它）；
 *   - bundle.l10n.<语言>.json 必须位于 package.json 声明的 l10n 目录。
 * 因此先落到临时目录，再按文件名前缀分别归位。
 *
 * 导入语义与 vscode-l10n-dev 一致：整体覆盖目标语言文件，XLIFF 里没有 <target> 的
 * 条目会被丢弃。脚本会比对导入前后的键集合，把被丢弃的条目明确报出来，
 * 最后调用 scripts/l10n-check.js 校验键集合一致性。
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const XLF_DIR = path.join(ROOT, "l10n-xlf");

const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
);
const l10nDir = path.resolve(ROOT, manifest.l10n ?? "./l10n");

if (!fs.existsSync(XLF_DIR)) {
  console.error(
    "✗ 找不到 l10n-xlf/ 目录，请先执行 npm run l10n:xlf 导出待翻译文件。",
  );
  process.exit(1);
}

/**
 * 判断导入文件应该落到哪里，以及它对应的母版是哪一个。
 *
 * @param {string} file 导入生成的文件名。
 * @returns {{dir: string, label: string, master: string}|null} 目标信息，未知类型返回 null。
 */
function resolveTargetDir(file) {
  if (/^package\.nls\..+\.json$/.test(file)) {
    return {
      dir: ROOT,
      label: "manifest 层（扩展根目录）",
      master: path.join(ROOT, "package.nls.json"),
    };
  }
  if (/^.+(\.l10n)\..+\.json$/.test(file)) {
    return {
      dir: l10nDir,
      label: "运行时层（l10n 目录）",
      master: path.join(l10nDir, "bundle.l10n.json"),
    };
  }
  return null;
}

/**
 * 让译文文件的键顺序跟随母版。
 *
 * XLIFF 解析出来的键是字典序，直接写回会让译文文件每次回灌都产生一大片无意义的
 * diff。母版（package.nls.json / bundle.l10n.json）才是权威顺序，译文按它排列后，
 * 只有真正变化的条目才会出现在 diff 里。
 *
 * @param {Record<string, string>} imported 导入解析出的译文。
 * @param {string} masterPath 母版文件路径。
 * @returns {Record<string, string>} 按母版顺序排列的译文。
 */
function orderLikeMaster(imported, masterPath) {
  if (!fs.existsSync(masterPath)) {
    return imported;
  }
  const master = JSON.parse(fs.readFileSync(masterPath, "utf8"));
  const ordered = {};
  for (const key of Object.keys(master)) {
    if (key in imported) {
      ordered[key] = imported[key];
    }
  }
  for (const key of Object.keys(imported)) {
    if (!(key in ordered)) {
      ordered[key] = imported[key];
    }
  }
  return ordered;
}

/**
 * 统一换行风格：仓库内 JSON 一律使用 CRLF，且以换行结尾。
 *
 * @param {string} text 原始文本。
 * @returns {string} 规范化后的文本。
 */
function toRepoFormat(text) {
  return text.replace(/\r/g, "").replace(/\n/g, "\r\n");
}

const stage = fs.mkdtempSync(path.join(os.tmpdir(), "l10n-import-"));

let exitCode;
try {
  exitCode = importTranslations(stage);
} finally {
  // 注意：process.exit() 不会执行 finally，所以这里不能用它提前退出
  for (const file of fs.readdirSync(stage)) {
    fs.unlinkSync(path.join(stage, file));
  }
  fs.rmdirSync(stage);
}
process.exit(exitCode ?? 0);

/**
 * 执行导入并落位。
 *
 * @param {string} stage import-xlf 的临时输出目录。
 * @returns {number} 进程退出码，0 表示成功。
 */
function importTranslations(stage) {
  const cli = require.resolve("@vscode/l10n-dev/dist/cli.js");
  const result = spawnSync(
    process.execPath,
    [cli, "import-xlf", "--outDir", stage, XLF_DIR],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    return result.status ?? 1;
  }

  const imported = fs
    .readdirSync(stage)
    .filter((file) => file.endsWith(".json"));

  if (imported.length === 0) {
    console.error(
      "✗ 没有从 XLIFF 中解析出译文，请确认文件包含 target-language 属性和 <target> 节点。",
    );
    return 1;
  }

  let droppedTotal = 0;

  for (const file of imported) {
    const target = resolveTargetDir(file);
    if (!target) {
      console.error(`✗ 无法识别导入文件的类型，未落位：${file}`);
      return 1;
    }

    const destination = path.join(target.dir, file);
    const previous = fs.existsSync(destination)
      ? JSON.parse(fs.readFileSync(destination, "utf8"))
      : {};
    const next = orderLikeMaster(
      JSON.parse(fs.readFileSync(path.join(stage, file), "utf8")),
      target.master,
    );

    const previousKeys = Object.keys(previous);
    const nextKeys = Object.keys(next);
    const dropped = previousKeys.filter((key) => !nextKeys.includes(key));
    droppedTotal += dropped.length;

    fs.writeFileSync(
      destination,
      toRepoFormat(`${JSON.stringify(next, null, 2)}\n`),
      "utf8",
    );

    console.log(`✓ ${path.relative(ROOT, destination)}`);
    console.log(`  ${target.label}｜共 ${nextKeys.length} 条`);
    if (previousKeys.length > 0) {
      console.log(
        `  相对原文件：新增 ${nextKeys.length - previousKeys.length + dropped.length} 条，丢失 ${dropped.length} 条`,
      );
    }
    if (dropped.length > 0) {
      console.log(
        `  ⚠ 丢失的条目（XLIFF 中缺少 <target>）：${dropped
          .slice(0, 5)
          .map((key) => JSON.stringify(key).slice(0, 60))
          .join("、")}${dropped.length > 5 ? " 等" : ""}`,
      );
    }
  }

  if (droppedTotal > 0) {
    console.log(
      `\n⚠ 本次回灌共丢失 ${droppedTotal} 条译文，缺失 <target> 的条目会被整体覆盖掉。`,
    );
  }

  console.log("\n--- 一致性校验 ---");
  const check = spawnSync(
    process.execPath,
    [path.join(__dirname, "l10n-check.js")],
    { stdio: "inherit" },
  );
  return check.status ?? 0;
}
