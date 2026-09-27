/** Launch the real built Web profile with an isolated HOME and DSH_HOME. */
import { spawn, execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
const source = process.env.DSH_SOURCE_DIR
if (!source) throw new Error('DSH_SOURCE_DIR must identify the verified built 0.1.7-rc.2 tree')
const app = process.env.DSH_OUTPUT_TEST_APP
const root = resolve('.')
const work = resolve('verification', process.env.DSH_OUTPUT_TEST_RUN ?? 'runtime')
const home = join(work, 'home')
await mkdir(home, { recursive: true })
const env = { PATH: process.env.PATH, HOME: home, TMPDIR: process.env.TMPDIR ?? '/tmp', LANG: 'zh_CN.UTF-8',
  DSH_HOME: join(home, '.dsh'), DSH_TELEMETRY_DISABLED: '1', DSH_OUTPUT_TEST_SOURCE: source }
const executable = app ? join(app, 'Contents/MacOS/DeepSeek Harness') : process.execPath
const cli = app ? join(app, 'Contents/Resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js') : resolve(source, 'apps/cli/lib/bin.js')
const prefix = app ? ['--expose-internals', cli] : [cli]
if (app) {
  env.ELECTRON_RUN_AS_NODE = '1'
  env.DSH_DESKTOP_NODE_EXECUTABLE = executable
  env.PATH = `${join(app, 'Contents/Resources/runtime/bin')}:${env.PATH}`
  env.DSH_OUTPUT_TEST_LLM = join(app, 'Contents/Resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-llm/lib/index.js')
}
const run = (args) => execFileSync(executable, [...prefix, ...args], { cwd: work, env, encoding: 'utf8', timeout: 90_000, stdio: ['ignore', 'pipe', 'pipe'] })
const profile = 'output-preview'
const manifestPath = join(env.DSH_HOME, 'profiles', profile, 'package.json')
if (!existsSync(manifestPath)) {
  await writeFile(join(work, 'base.yml'), run(['--profile', profile, '--from-default-profile', 'web', '--dump-config']))
}
const spec = process.argv[2] ? resolve(process.argv[2]) : root
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
if (!manifest.dsh?.profile?.bundles?.includes('@missher/dsh-output-renderer') || process.argv[2]) {
  await writeFile(join(work, 'install.log'), run(['plugin', '--profile', profile, 'add', spec, '--offline']))
}
if (process.env.DSH_OUTPUT_TEST_FIXTURE === '1') {
  const patchPath = join(env.DSH_HOME, 'profiles', profile, 'cordis.patch.yml')
  let patch = existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : ''
  patch = patch.replace(/^[ \t]*\[\][ \t]*$/m, '')
  patch = patch.replace(join(root, 'scripts/fixture.mjs'), join(root, 'scripts/fixture/index.mjs'))
  if (!patch.includes('id: output-renderer-fixture')) patch += `\n- insert:\n    - id: output-renderer-fixture\n      name: ${JSON.stringify(join(root, 'scripts/fixture/index.mjs'))}\n`
  if (!patch.includes('provider: output-preview')) patch += '\n- id: agent-default-model\n  config:\n    provider: output-preview\n    model: local-render\n'
  await writeFile(patchPath, patch)
  await writeFile(join(work, 'output-sample.txt'), 'OUTPUT_RENDERER_LOCAL_FIXTURE\nOnly isolated synthetic data.\n')
}
const composed = run(['--profile', profile, '--dump-config'])
if (!composed.includes('output-renderer')) throw new Error('Bundle did not compose')
await writeFile(join(work, 'composed.yml'), composed)
const child = spawn(executable, [...prefix, '--profile', profile, '--no-open', '--host', '127.0.0.1', '--port', '0'], { cwd: work, env, stdio: ['ignore', 'pipe', 'pipe'] })
await writeFile(join(work, 'pid.json'), JSON.stringify({ pid: child.pid, home: env.DSH_HOME, source, app, profile, spec }) + '\n')
let log = ''
const collect = data => {
  const text = data.toString()
  const match = text.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)
  if (match) void writeFile(join(work, '.auth-url'), match[0], { mode: 0o600 })
  const safe = text.replace(/([?&]token=)[^\s&]+/g, '$1[REDACTED]')
  log += safe
  process.stdout.write(safe)
}
child.stdout.on('data', collect)
child.stderr.on('data', collect)
process.on('SIGTERM', () => child.kill('SIGTERM'))
process.on('SIGINT', () => child.kill('SIGTERM'))
child.on('exit', async (code) => {
  await writeFile(join(work, 'server.log'), log)
  process.exitCode = code ?? 0
})
