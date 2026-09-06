const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pngPath = path.join(rootDir, 'favicon.png');
const pngBuf = fs.readFileSync(pngPath);
const base64 = pngBuf.toString('base64');

// 1. Create a modern SVG wrapping the exact red 'b' play logo
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <image href="data:image/png;base64,${base64}" width="128" height="128" />
</svg>
`;

const targets = [
  rootDir,
  path.join(rootDir, 'public'),
  path.join(rootDir, 'dist'),
  path.join(rootDir, 'docs')
];

// 2. Create valid 128x128 PNG-based .ico file
const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // ICO type (1 for icon)
icoHeader.writeUInt16LE(1, 4); // Number of images (1)
icoHeader.writeUInt8(128, 6);  // Width (128)
icoHeader.writeUInt8(128, 7);  // Height (128)
icoHeader.writeUInt8(0, 8);    // Color palette count (0 for 24/32-bit)
icoHeader.writeUInt8(0, 9);    // Reserved
icoHeader.writeUInt16LE(1, 10); // Color planes
icoHeader.writeUInt16LE(32, 12); // Bits per pixel
icoHeader.writeUInt32LE(pngBuf.length, 14); // Image size in bytes
icoHeader.writeUInt32LE(22, 18); // Image offset

const icoBuf = Buffer.concat([icoHeader, pngBuf]);

targets.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'favicon.svg'), svgContent);
  fs.writeFileSync(path.join(dir, 'favicon.png'), pngBuf);
  fs.writeFileSync(path.join(dir, 'favicon.ico'), icoBuf);
});

console.log('Successfully generated favicon.svg, favicon.png, and favicon.ico with Red b Play Logo across all folders!');
