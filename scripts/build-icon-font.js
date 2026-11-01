#!/usr/bin/env node
/**
 * 生成状态栏图标字体。
 *
 * VS Code 的状态栏条目只接受 codicon，扩展无法直接塞入 SVG 图片；
 * 但可以通过 contributes.icons 贡献一个自定义图标字体，再用 $(图标 ID) 引用。
 * 本脚本把 assets/icons/ 下的 SVG 源文件编译成 assets/fonts/ 下的 woff 字体。
 *
 * 字体产物是提交进仓库的：日常开发不需要跑本脚本，
 * 只有修改了 SVG 源文件才需要执行 `npm run icon:font`。
 *
 * 脚本同时校验 package.json 的 contributes.icons 与下面的图标登记表一致，
 * 避免出现「清单引用了字体里不存在的字形」这类只在运行时才暴露的问题。
 */
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");

const ROOT = path.resolve(__dirname, "..");

/** 字体家族名，写进 SVG 字体与 TTF 的 name 表。 */
const FONT_NAME = "debug-tools";

/** 字体产物路径（相对仓库根目录）。 */
const FONT_FILE = path.join("assets", "fonts", "debug-tools.woff");

/**
 * 固定时间戳。
 *
 * svg2ttf 默认把当前时间写进字体的创建/修改时间，
 * 同样的输入会产出不同的字节，破坏「改了 SVG 重跑脚本结果不变」的预期。
 */
const FONT_TIMESTAMP = 1700000000;

/**
 * 图标登记表。
 *
 * id 是清单里引用图标用的 ID，必须与 package.json 的 contributes.icons 一致；
 * codepoint 是该字形在字体中的编码，必须与产出的字体一致。
 */
const ICONS = [
  {
    id: "debugtools-debug-agent",
    source: path.join("assets", "icons", "debug-agent.svg"),
    codepoint: 0xe001,
  },
];

/**
 * 把码位转成清单里使用的 fontCharacter 写法。
 *
 * @param {number} codepoint 字形编码。
 * @returns {string} 形如 \E001 的字符串。
 */
function toFontCharacter(codepoint) {
  return `\\${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * 把若干 SVG 编译成一个 woff 字体。
 *
 * @param {{id: string, source: string, codepoint: number}[]} icons 图标登记表。
 * @returns {Promise<Buffer>} woff 字节。
 */
async function buildFont(icons) {
  const { SVGIcons2SVGFontStream } = await import("svgicons2svgfont");
  const svg2ttfModule = await import("svg2ttf");
  const ttf2woffModule = await import("ttf2woff");
  const svg2ttf = svg2ttfModule.default || svg2ttfModule;
  const ttf2woff = ttf2woffModule.default || ttf2woffModule;

  const fontStream = new SVGIcons2SVGFontStream({
    fontName: FONT_NAME,
    fontHeight: 1000,
    normalize: true,
    centerHorizontally: true,
  });

  const chunks = [];
  fontStream.on("data", (chunk) => chunks.push(chunk.toString()));
  const finished = new Promise((resolve, reject) => {
    fontStream.on("end", resolve);
    fontStream.on("error", reject);
  });

  for (const icon of icons) {
    const svg = fs.readFileSync(path.join(ROOT, icon.source), "utf8");
    const stream = Readable.from([svg]);
    stream.metadata = {
      name: icon.id,
      unicode: [String.fromCodePoint(icon.codepoint)],
    };
    fontStream.write(stream);
  }
  fontStream.end();
  await finished;

  const svgFont = chunks.join("");
  const ttf = toBuffer(
    svg2ttf(svgFont, {
      description: "VS Code Debug Tools for Copilot",
      version: "1.0",
      ts: FONT_TIMESTAMP,
    }),
  );
  return toBuffer(ttf2woff(ttf));
}

/**
 * 把字体工具返回的字节转成 Buffer。
 *
 * svg2ttf 返回的是 microbuffer，不是标准 Buffer，
 * 直接交给 Buffer.from() 会按数组语义逐项拷贝，得到全零的坏数据。
 *
 * @param {unknown} value 字体工具的返回值。
 * @returns {Buffer} 字节缓冲。
 */
function toBuffer(value) {
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (value && typeof value.toArray === "function") {
    return Buffer.from(value.toArray());
  }
  if (value && value.buffer instanceof ArrayBuffer) {
    return Buffer.from(
      value.buffer,
      value.byteOffset || 0,
      value.byteLength ?? value.buffer.byteLength,
    );
  }
  return Buffer.from(value);
}

/**
 * 校验 package.json 的 contributes.icons 与图标登记表一致。
 *
 * @param {{id: string, source: string, codepoint: number}[]} icons 图标登记表。
 * @returns {string[]} 问题列表，空数组表示一致。
 */
function checkManifest(icons) {
  const errors = [];
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
  );
  const contributed = manifest.contributes && manifest.contributes.icons;

  if (!contributed || typeof contributed !== "object") {
    return ["package.json 的 contributes.icons 缺失或不是对象"];
  }

  for (const icon of icons) {
    const entry = contributed[icon.id];

    if (!entry) {
      errors.push(`package.json 的 contributes.icons 缺少 "${icon.id}"`);
      continue;
    }

    const expectedPath = `./${FONT_FILE.split(path.sep).join("/")}`;
    const actualPath = entry.default && entry.default.fontPath;

    if (actualPath !== expectedPath) {
      errors.push(
        `${icon.id} 的 fontPath 应为 "${expectedPath}"，实际为 "${actualPath}"`,
      );
    }

    const expectedCharacter = toFontCharacter(icon.codepoint);
    const actualCharacter = entry.default && entry.default.fontCharacter;

    if (actualCharacter !== expectedCharacter) {
      errors.push(
        `${icon.id} 的 fontCharacter 应为 "${expectedCharacter}"，实际为 "${actualCharacter}"`,
      );
    }
  }

  for (const id of Object.keys(contributed)) {
    if (!icons.some((icon) => icon.id === id)) {
      errors.push(`package.json 的 contributes.icons 里的 "${id}" 没有登记在脚本中`);
    }
  }

  return errors;
}

/**
 * 校验 SVG 源文件与图标登记表一一对应。
 *
 * @param {{source: string}[]} icons 图标登记表。
 * @returns {string[]} 问题列表，空数组表示一致。
 */
function checkSources(icons) {
  const errors = [];
  const directory = path.join(ROOT, "assets", "icons");
  const files = fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".svg"));

  for (const file of files) {
    const relative = path.join("assets", "icons", file);
    if (!icons.some((icon) => icon.source === relative)) {
      errors.push(`assets/icons/${file} 没有登记在脚本中`);
    }
  }

  for (const icon of icons) {
    if (!fs.existsSync(path.join(ROOT, icon.source))) {
      errors.push(`${icon.source} 不存在`);
    }
  }

  return errors;
}

async function main() {
  const errors = [...checkSources(ICONS), ...checkManifest(ICONS)];

  if (errors.length > 0) {
    console.error("✗ 图标配置不一致：");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  const woff = await buildFont(ICONS);
  const target = path.join(ROOT, FONT_FILE);
  const previous = fs.existsSync(target) ? fs.readFileSync(target) : null;
  const unchanged = previous !== null && previous.equals(woff);

  fs.writeFileSync(target, woff);

  console.log("=== 图标字体 ===");
  for (const icon of ICONS) {
    console.log(
      `  ${icon.id}  ${icon.source}  ${toFontCharacter(icon.codepoint)}`,
    );
  }
  console.log(`  产物: ${FONT_FILE} (${woff.length} 字节)`);
  console.log(
    unchanged
      ? "  与仓库中的版本逐字节一致。"
      : previous === null
        ? "  新建字体。"
        : "  字体内容已更新。",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
