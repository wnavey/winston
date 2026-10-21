import { chromium } from '/Users/winston/noetic/surveyor/node_modules/playwright-core/index.mjs';
import { writeFileSync } from 'fs';
const [,, url, out, wait] = process.argv;
const b = await chromium.launch({ headless: false, args: ['--headless=new','--disable-blink-features=AutomationControlled'] });
const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' });
const p = await ctx.newPage();
try {
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(parseInt(wait || '8000'));
  writeFileSync(out + '.html', await p.content());
  const t = await p.evaluate(() => document.body.innerText);
  writeFileSync(out + '.txt', t);
  console.log('ok', t.length, await p.title());
} catch (e) { console.log('ERR', e.message); }
await b.close();
