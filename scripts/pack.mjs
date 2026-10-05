import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const filename = `${pkg.name.replace(/^@/u, '').replaceAll('/', '-')}-${pkg.version}.tgz`
const file = resolve(root, 'dist', filename)
try {
  await access(file)
  throw new Error(`Refusing to overwrite an existing package: ${file}`)
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const expected = ['package.json', ...pkg.files]
for (const name of expected) await access(resolve(root, name))
await mkdir(resolve(root, 'dist'), { recursive: true })
await mkdir(resolve(root, 'verification'), { recursive: true })
const result = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', 'dist'], { cwd: root, encoding: 'utf8' }))[0]
const allowed = /^(package\.json|cordis\.patch\.yml|README(?:\.en)?\.md|VALIDATION\.md|LICENSE|NOTICE\.md|licenses\/deepseek-harness-MIT\.txt|lib\/(index|client)\.js)$/
if (result.files.some(file => !allowed.test(file.path))) throw new Error('Unexpected file in Bundle')
if (result.filename !== filename || expected.some(name => !result.files.some(file => file.path === name))) throw new Error('Incomplete Bundle')
const sha256 = createHash('sha256').update(await readFile(file)).digest('hex')
await writeFile(`${file}.sha256`, `${sha256}  ${result.filename}\n`)
await writeFile(resolve(root, 'verification/package.json'), JSON.stringify({ name: result.name, version: result.version, files: result.files.map(file => file.path), size: result.size, sha256 }, null, 2) + '\n')
console.log(`${file}\nsha256 ${sha256}`)
