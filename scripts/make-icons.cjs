// יוצר אייקוני PNG מ-public/icon.svg
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const svg = fs.readFileSync(__dirname + '/../public/icon.svg', 'utf8');
  const b = await chromium.launch();
  for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<style>*{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg.replace('rx="112"', 'rx="0"')}`);
    await p.screenshot({ path: __dirname + '/../public/' + name });
    await p.close();
  }
  await b.close();
})();
