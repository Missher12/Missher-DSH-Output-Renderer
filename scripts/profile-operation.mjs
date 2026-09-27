/** Use the installed app's official CLI; never edit a profile manifest by hand. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

const [app, targetHome, profile, operation, artifact] = process.argv.slice(2)
if (!app || !targetHome || !profile || !['add', 'remove'].includes(operation)) {
  throw new Error('Usage: node scripts/profile-operation.mjs APP DSH_HOME PROFILE add|remove [TARBALL]')
}
if (profile === 'desktop') throw new Error('The desktop profile is managed by Electron; use Plugins → Add plugin in DSH')
const id = '@missher/dsh-output-renderer'
const executable = join(app, 'Contents/MacOS/DeepSeek Harness')
const cli = join(app, 'Contents/Resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js')
const dir = join(targetHome, 'profiles', profile)
const manifestPath = join(dir, 'package.json')
const before = JSON.parse(readFileSync(manifestPath, 'utf8'))
const backup = resolve('verification', process.env.DSH_OUTPUT_BACKUP ?? 'runtime-operation-backup', new Date().toISOString().replace(/[:.]/g, '-'))
mkdirSync(backup, { recursive: true, mode: 0o700 })
for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.patch.yml']) {
  if (existsSync(join(dir, name))) writeFileSync(join(backup, name), readFileSync(join(dir, name)), { mode: 0o600 })
}
const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', DSH_DESKTOP_NODE_EXECUTABLE: executable,
  DSH_HOME: targetHome, PATH: `${join(app, 'Contents/Resources/runtime/bin')}:${process.env.PATH}` }
if (process.env.DSH_OUTPUT_TEST_HOME) env.HOME = resolve(process.env.DSH_OUTPUT_TEST_HOME)
const args = operation === 'add' ? ['add', resolve(artifact ?? 'dist/missher-dsh-output-renderer-0.1.0.tgz'), '--offline'] : ['remove', id]
const output = execFileSync(executable, ['--expose-internals', cli, 'plugin', '--profile', profile, ...args], { env, encoding: 'utf8', timeout: 90_000, stdio: ['ignore', 'pipe', 'pipe'] })
writeFileSync(join(backup, 'operation.log'), output, { mode: 0o600 })
const after = JSON.parse(readFileSync(manifestPath, 'utf8'))
const omit = data => {
  const next = structuredClone(data)
  delete next.dependencies?.[id]
  if (next.dependencies && !Object.keys(next.dependencies).length) delete next.dependencies
  if (next.dsh?.profile?.bundles) next.dsh.profile.bundles = next.dsh.profile.bundles.filter(name => name !== id)
  return next
}
if (!isDeepStrictEqual(omit(before), omit(after))) throw new Error('Unrelated profile metadata changed; inspect the backup before continuing')
if ((operation === 'add') !== after.dsh.profile.bundles.includes(id)) throw new Error('Bundle activation does not match the requested operation')
const receipt = { operation, profile, targetHome, backup, preservedOtherProfileMetadata: true,
  packageHash: createHash('sha256').update(readFileSync(manifestPath)).digest('hex') }
writeFileSync(join(backup, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 })
console.log(JSON.stringify(receipt, null, 2))
