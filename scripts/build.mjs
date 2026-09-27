import { build } from 'esbuild'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const common = { absWorkingDir: root, bundle: true, target: 'es2022', logLevel: 'info' }
await build({ ...common, entryPoints: ['src/index.ts'], outfile: 'lib/index.js', platform: 'node', format: 'esm', packages: 'external' })
const result = await build({ ...common, entryPoints: ['src/client/index.ts'], outfile: 'lib/client.js', platform: 'browser', format: 'cjs', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-primitives'],
  loader: { '.css': 'text' }, define: { 'process.env.NODE_ENV': '"production"' }, metafile: true,
  banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
  footer: { js: 'return module.exports;}});' },
})
await mkdir(resolve(root, 'verification'), { recursive: true })
await writeFile(resolve(root, 'verification/build.json'), JSON.stringify({ version: pkg.version,
  imports: result.metafile.outputs['lib/client.js'].imports, inputs: Object.keys(result.metafile.inputs) }, null, 2) + '\n')
