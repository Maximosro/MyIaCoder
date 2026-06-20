// Rasterizes public/logo.svg into resources/icon.png (256) and icon.ico using
// the already-installed Electron runtime — no extra image dependencies.
// Run with: electron scripts/make-icon.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SIZE = 256;

app.disableHardwareAcceleration();

function pngToIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0);  // width  (0 => 256)
  entry.writeUInt8(0, 1);  // height (0 => 256)
  entry.writeUInt8(0, 2);  // palette
  entry.writeUInt8(0, 3);  // reserved
  entry.writeUInt16LE(1, 4);   // planes
  entry.writeUInt16LE(32, 6);  // bpp
  entry.writeUInt32LE(png.length, 8); // bytes of PNG
  entry.writeUInt32LE(6 + 16, 12);    // offset
  return Buffer.concat([header, entry, png]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: false },
  });

  const svg = fs.readFileSync(path.join(ROOT, 'public', 'logo.svg'), 'utf-8')
    .replace('<svg ', `<svg width="${SIZE}" height="${SIZE}" `);
  const html = `<html><body style="margin:0;background:transparent">${svg}</body></html>`;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 400));

  const img = await win.webContents.capturePage();
  const png = img.toPNG();
  fs.writeFileSync(path.join(ROOT, 'resources', 'icon.png'), png);
  fs.writeFileSync(path.join(ROOT, 'resources', 'icon.ico'), pngToIco(png));
  console.log('icon.png + icon.ico written,', png.length, 'bytes png');
  app.quit();
});
