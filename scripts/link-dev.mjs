/** Link the exact declared versions from a built Harness source tree. */
import {readFileSync, existsSync, readdirSync, mkdirSync, symlinkSync, realpathSync} from 'node:fs'
import {resolve, dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
if (!process.argv[2]) throw new Error('Usage: node scripts/link-dev.mjs /path/to/built/Harness-source')
const source = realpathSync(process.argv[2])
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const packages = new Map()
function collect(dir, depth) {
  if (!existsSync(dir)) return
  const path = join(dir, 'package.json')
  if (existsSync(path)) {
    const pkg = JSON.parse(readFileSync(path, 'utf8'))
    if (pkg.name) packages.set(pkg.name, {dir, version: pkg.version})
  }
  if (depth) for (const item of readdirSync(dir, {withFileTypes: true})) {
    if (item.isDirectory() && !['node_modules', 'lib', '.git', 'tests'].includes(item.name)) collect(join(dir, item.name), depth-1)
  }
}
collect(join(source, 'packages'), 2)
collect(join(source, 'vendor'), 4)
const store = join(source, 'node_modules/.pnpm')
for (const [name, version] of Object.entries({...manifest.dependencies, ...manifest.devDependencies})) {
  let entry = packages.get(name)
  if (!entry) {
    for (const item of readdirSync(store).sort()) {
      if (!item.startsWith(name.replace('/', '+')+'@'+version)) continue
      const dir = join(store, item, 'node_modules', name)
      if (existsSync(join(dir, 'package.json'))) {entry = {dir, version: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version}; break}
    }
  }
  if (!entry || entry.version !== version) throw new Error(`Missing exact development dependency ${name}@${version}`)
  const link = join(root, 'node_modules', name)
  mkdirSync(dirname(link), {recursive: true})
  if (existsSync(link)) {
    if (realpathSync(link) !== realpathSync(entry.dir)) throw new Error(`Refusing to replace ${link}`)
  } else symlinkSync(entry.dir, link, 'dir')
}
console.log('Linked the declared versions from '+source)
