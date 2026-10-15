import { readFileSync } from 'node:fs'

const required = '^22.18.0 || >=24.11.0'
const { engines } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
if (engines?.node !== required) {
  throw new Error('Update check-node.mjs together with package.json engines.node')
}

const [major, minor] = process.versions.node.split('.').map(Number)
const supported = (major === 22 && minor >= 18) || (major === 24 && minor >= 11) || major > 24
if (!supported || process.versions.node.includes('-')) {
  console.error(`Vue3 requires Node.js ${required}; found ${process.version}. Use a supported LTS release before installing or building.`)
  process.exit(1)
}
console.log(`Vue3 Node.js check passed: ${process.version}`)
