import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { requestInterceptor } from 'jsdom'

const { version: jsdomVersion } = createRequire(import.meta.url)('jsdom/package.json')

export function createWebJarResources({ resourceRoot, origin }) {
  // beforeParse below uses one pinned private seam; never silently carry it across upgrades.
  assert.equal(jsdomVersion, '30.1.3', 'Revalidate the WebJar resource guard before changing jsdom')
  resourceRoot = path.resolve(resourceRoot)

  function resourcePath(url) {
    assert.equal(url.origin, origin, `External resource is forbidden: ${url}`)
    const relative = decodeURIComponent(url.pathname.replace(/^\/demo\//, '/')).replace(/^\//, '')
    const resolved = path.resolve(resourceRoot, relative)
    assert(resolved.startsWith(resourceRoot + path.sep), `Resource escapes the WebJar: ${url}`)
    return resolved
  }

  return {
    resourcePath,
    // Public interceptors validate every HTTP(S) request, including redirect hops.
    resources: { interceptors: [requestInterceptor(request => { resourcePath(new URL(request.url)) })] },
    beforeParse(window) {
      // jsdom 30 handles data:/file: before its public interceptors. Guard its
      // outer dispatcher so those schemes cannot bypass the old ResourceLoader policy.
      // Keep this test-only seam small and covered by actual resource-load negatives.
      const dispatcher = window._settings?.dispatcher
      assert.equal(typeof dispatcher?.dispatch, 'function', 'jsdom resource dispatcher contract changed')
      const dispatch = dispatcher.dispatch.bind(dispatcher)
      dispatcher.dispatch = (options, handler) => {
        assert.equal(typeof handler?.onResponseError, 'function', 'jsdom resource error handler contract changed')
        try {
          assert.equal(typeof options?.opaque?.url, 'string', 'jsdom resource URL contract changed')
          resourcePath(new URL(options.opaque.url))
        } catch (error) {
          handler.onResponseError(null, error)
          return false
        }
        return dispatch(options, handler)
      }
    },
  }
}

export function collectWebJarJsdomError(errors, error) {
  // Preserve the existing parser-only exclusion, with jsdom 30's new type name.
  if (error.type === 'css-parsing') return
  errors.push([error.type, error.message, error.cause?.message].filter(Boolean).join(': '))
}
