import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { SourceTextModule } from 'node:vm'
import { JSDOM, ResourceLoader, VirtualConsole } from 'jsdom'

// Execute the actual packaged ES modules, without depending on minifier syntax.
// This checks startup requests, not browser layout or the minimum browser versions.
const resourceRoot = path.resolve(process.argv[2] || '')
assert(process.argv[2], 'Usage: node --experimental-vm-modules check-webjar-smoke.mjs <resources>')
const fixture = JSON.parse(await readFile(new URL('./fixtures/swagger2-smoke.json', import.meta.url), 'utf8'))
const html = await readFile(path.join(resourceRoot, 'doc.html'), 'utf8')
let requests = []
let origin

function resourcePath(url) {
  assert.equal(url.origin, origin, `External resource is forbidden: ${url}`)
  const relative = decodeURIComponent(url.pathname.replace(/^\/demo\//, '/')).replace(/^\//, '')
  const resolved = path.resolve(resourceRoot, relative)
  assert(resolved.startsWith(resourceRoot + path.sep), `Resource escapes the WebJar: ${url}`)
  return resolved
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, origin)
  requests.push({ path: url.pathname, headers: req.headers })
  const sendJson = value => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(value))
  }
  if (/^\/(?:demo\/)?swagger-resources$/.test(url.pathname)) {
    return sendJson([{ name: 'default', url: 'v2/api-docs', location: 'v2/api-docs', swaggerVersion: '2.0' }])
  }
  if (/^\/(?:demo\/)?v2\/api-docs$/.test(url.pathname)) return sendJson(fixture)
  try {
    const bytes = await readFile(resourcePath(url))
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' })
    res.end(bytes)
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})
origin = `http://127.0.0.1:${server.address().port}`

class LocalResources extends ResourceLoader {
  fetch(url, options) {
    resourcePath(new URL(url))
    return super.fetch(url, options)
  }
}

async function checkStartup(prefix, gatewayCode) {
  requests = []
  const errors = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')))
  virtualConsole.on('jsdomError', error => {
    // jsdom's CSS parser does not implement the new minifier's full CSS syntax.
    if (error.type !== 'css parsing') errors.push(error.message)
  })
  const dom = new JSDOM(html, {
    url: `${origin}${prefix}doc.html`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    resources: new LocalResources(),
    virtualConsole,
  })
  const { window } = dom
  window.matchMedia = query => ({ matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  window.TextEncoder = TextEncoder
  window.TextDecoder = TextDecoder
  const preloadFetches = []
  window.fetch = (input, options) => {
    const url = new URL(input, window.location.href)
    resourcePath(url)
    const pending = fetch(url, options).then(async response => {
      await response.clone().arrayBuffer()
      return response
    })
    preloadFetches.push(pending)
    return pending
  }
  const context = dom.getInternalVMContext()
  const modules = new Map()
  async function loadModule(url) {
    if (modules.has(url.href)) return modules.get(url.href)
    const pending = (async () => {
      const source = await readFile(resourcePath(url), 'utf8')
      const module = new SourceTextModule(source, {
        context,
        identifier: url.href,
        initializeImportMeta(meta) { meta.url = url.href },
        async importModuleDynamically(specifier, referrer) {
          const imported = await loadModule(new URL(specifier, referrer.identifier))
          if (imported.status === 'unlinked') await imported.link(linker)
          if (imported.status === 'linked') await imported.evaluate()
          return imported
        },
      })
      return module
    })()
    modules.set(url.href, pending)
    return pending
  }
  const linker = (specifier, referrer) => loadModule(new URL(specifier, referrer.identifier))
  const rejection = error => errors.push(String(error))
  process.on('unhandledRejection', rejection)
  try {
    const entries = window.document.querySelectorAll('script[type="module"][src]')
    assert(entries.length > 0, 'doc.html must have an actual module entry')
    for (const entry of entries) {
      const module = await loadModule(new URL(entry.src))
      await module.link(linker)
      await module.evaluate()
    }
    const deadline = Date.now() + 15000
    while (!window.document.body.textContent.includes(fixture.info.title)) {
      const wrongDiscovery = requests.find(req => /swagger-config|services\.json|jf-swagger/.test(req.path))
      assert(!wrongDiscovery, `Wrong release discovery request: ${wrongDiscovery?.path}`)
      assert.equal(errors.length, 0, errors.join('\n'))
      assert(Date.now() < deadline, `Swagger2 did not render; requests: ${JSON.stringify(requests.map(req => req.path))}`)
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    assert.equal(errors.length, 0, errors.join('\n'))
    for (const endpoint of ['swagger-resources', 'v2/api-docs']) {
      const request = requests.find(req => req.path === prefix + endpoint)
      assert(request, `Missing Springfox request ${prefix}${endpoint}`)
      assert.equal(request.headers['knife4j-gateway-code'], gatewayCode, `Missing desktop behavior on ${endpoint}`)
    }
    assert(!requests.some(req => /swagger-config|services\.json|jf-swagger/.test(req.path)), 'Wrong release mode')
    console.log(`WebJar behavior OK: ${prefix}doc.html, Springfox + desktop ${gatewayCode}`)
  } finally {
    await Promise.allSettled(preloadFetches)
    dom.window.close()
    process.removeListener('unhandledRejection', rejection)
  }
}

try {
  await checkStartup('/', 'ROOT')
  await checkStartup('/demo/', 'demo')
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
