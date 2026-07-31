import { chromium } from 'playwright';
import { mkdirSync, existsSync, rmSync } from 'fs';
import path from 'path';

const [, , htmlFile, outDir, wStr, hStr, scaleStr, onlyFrame] = process.argv;
const W = +wStr, H = +hStr, scale = +(scaleStr || 1);

if (existsSync(outDir)) rmSync(outDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text'],
});
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: scale,
});
await page.goto('file://' + path.resolve(htmlFile));
await page.waitForTimeout(600); // fonts

const total = await page.evaluate(() => window.TOTAL_FRAMES);

if (onlyFrame !== undefined) {
  for (const f of onlyFrame.split(',')) {
    await page.evaluate((i) => window.setFrame(i), +f);
    await page.waitForTimeout(60);
    await page.screenshot({ path: path.join(outDir, `f${String(f).padStart(4, '0')}.png`) });
  }
} else {
  for (let i = 0; i < total; i++) {
    await page.evaluate((n) => window.setFrame(n), i);
    await page.screenshot({ path: path.join(outDir, `f${String(i).padStart(4, '0')}.png`) });
  }
  console.log(`captured ${total} frames -> ${outDir}`);
}

await browser.close();
