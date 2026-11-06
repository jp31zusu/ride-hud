// Renders build/icon.svg and build/tray.svg into every icon file the app and
// installers need. Run with `npm run icons` after editing either SVG.
import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const appSvg = readFileSync('build/icon.svg')
const traySvg = readFileSync('build/tray.svg')

const render = (svg, size) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()

function icns(entries) {
  const chunks = entries.map(([type, png]) => {
    const header = Buffer.alloc(8)
    header.write(type, 0, 'ascii')
    header.writeUInt32BE(png.length + 8, 4)
    return Buffer.concat([header, png])
  })
  const body = Buffer.concat(chunks)
  const header = Buffer.alloc(8)
  header.write('icns', 0, 'ascii')
  header.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([header, body])
}

function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + images.length * 16
  const dir = images.map(([size, png]) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0)
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += png.length
    return e
  })
  return Buffer.concat([header, ...dir, ...images.map(([, png]) => png)])
}

const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
const png = Object.fromEntries(sizes.map((s) => [s, render(appSvg, s)]))

writeFileSync('build/icon.png', png[1024])
writeFileSync('resources/icon.png', png[512])
writeFileSync(
  'build/icon.icns',
  icns([
    ['icp4', png[16]],
    ['icp5', png[32]],
    ['icp6', png[64]],
    ['ic07', png[128]],
    ['ic08', png[256]],
    ['ic09', png[512]],
    ['ic10', png[1024]],
    ['ic11', png[32]],
    ['ic12', png[64]],
    ['ic13', png[256]],
    ['ic14', png[512]]
  ])
)
writeFileSync('build/icon.ico', ico([16, 24, 32, 48, 64, 128, 256].map((s) => [s, png[s]])))

// macOS menu bar icons must be black-on-transparent "Template" images so the
// system can tint them for light and dark menu bars.
writeFileSync('resources/trayTemplate.png', render(traySvg, 16))
writeFileSync('resources/trayTemplate@2x.png', render(traySvg, 32))

console.log('Icons written to build/ and resources/')
