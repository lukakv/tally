import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'

const flat = await readFile('scripts/icon.svg')
const maskable = await readFile('scripts/icon-maskable.svg')

// rounded corners for the launcher/tab icon; maskable stays square so Android
// can apply its own mask without clipping the artwork
const rounded = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
     <rect width="512" height="512" rx="112" ry="112" fill="#fff"/>
   </svg>`,
)

async function png(src, size, out, round) {
  let img = sharp(src).resize(size, size)
  if (round) {
    const mask = await sharp(rounded).resize(size, size).png().toBuffer()
    img = img.composite([{ input: mask, blend: 'dest-in' }])
  }
  await img.png({ compressionLevel: 9 }).toFile(out)
  console.log('wrote', out)
}

await png(flat, 192, 'public/pwa-192.png', true)
await png(flat, 512, 'public/pwa-512.png', true)
await png(maskable, 512, 'public/maskable-512.png', false)
await png(flat, 180, 'public/apple-touch-icon.png', true)
await writeFile('public/favicon.svg', flat)
console.log('wrote public/favicon.svg')

// Source images for @capacitor/assets, which derives every Android density.
const splash = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732">
     <rect width="2732" height="2732" fill="#0A0B0D"/>
     <g transform="translate(1366 1366) scale(1.6) translate(-256 -256)"
        stroke-linecap="round" fill="none">
       <g stroke="#9B8CFF" stroke-width="26">
         <path d="M193 182 V330"/><path d="M235 182 V330"/>
         <path d="M277 182 V330"/><path d="M319 182 V330"/>
       </g>
       <path d="M172 344 L340 168" stroke="#FBBF24" stroke-width="26"/>
     </g>
   </svg>`,
)

await sharp(flat).resize(1024, 1024).png().toFile('resources/icon.png')
await sharp(splash).png().toFile('resources/splash.png')
await sharp(splash).png().toFile('resources/splash-dark.png')
console.log('wrote resources/icon.png + splash')
