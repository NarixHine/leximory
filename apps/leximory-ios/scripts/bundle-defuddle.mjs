import { createRequire } from 'node:module'
import { copyFile, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(app, '../../packages/scrape/package.json'))
const source = require.resolve('defuddle/full')
const packageRoot = resolve(dirname(source), '..')
const { version } = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'))
if (version !== '0.14.0') throw new Error('Review the browser extraction contract before changing the bundled Defuddle version.')
await copyFile(source, resolve(app, 'App/Resources/Browser/defuddle.js'))
await copyFile(resolve(packageRoot, 'LICENSE'), resolve(app, 'App/Resources/Browser/Defuddle-LICENSE.txt'))
