import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

await mkdir('dist', { recursive: true })
const result = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', 'dist'], { encoding: 'utf8' }))[0]
const allowed = /^(package\.json|cordis\.patch\.yml|README\.md|VALIDATION\.md|LICENSE|lib\/(index|client)\.js)$/
if (result.files.some(file => !allowed.test(file.path))) throw new Error('Unexpected file in Bundle')
const file = resolve('dist', result.filename)
const sha256 = createHash('sha256').update(await readFile(file)).digest('hex')
await writeFile(`${file}.sha256`, `${sha256}  ${result.filename}\n`)
await writeFile('verification/package.json', JSON.stringify({ name: result.name, version: result.version, files: result.files.map(file => file.path), size: result.size, sha256 }, null, 2) + '\n')
console.log(`${file}\nsha256 ${sha256}`)
