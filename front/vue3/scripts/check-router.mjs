import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createRouter, createMemoryHistory, isNavigationFailure, NavigationFailureType } from 'vue-router'

// Keep the production route declarations, replacing only SFC imports. Fail closed
// if the module structure changes instead of silently testing a partial route table.
// Memory history checks matching/navigation; hash reloads, tabs and rendering need browser checks.
const source = await readFile(new URL('../src/router/index.js', import.meta.url), 'utf8')
const declaration = source.match(/^import \{ createRouter, createWebHashHistory \} from 'vue-router'\s+import BasicLayout from '\.\.\/layouts\/BasicLayout\.vue'\s+export const routes = (\[[\s\S]*\]);\s+const router = createRouter\(\{\s+history: createWebHashHistory\(import\.meta\.env\.BASE_URL\),\s+routes\s+\}\)\s+export default router\s*$/)
assert.ok(declaration, 'router module changed: update the harness without dropping production declarations')
const components = new Map()
function componentStub(file) {
  if (!components.has(file)) components.set(file, { name: file, render: () => null })
  return components.get(file)
}
const routeSource = declaration[1].replace(/\(\) => import\('(@\/views\/[\w/]+\.vue)'\)/g, (_, file) => `componentStub(${JSON.stringify(file)})`)
assert.ok(!/\bimport\b/.test(routeSource), 'unsupported component import in route declarations')
const routes = Function('BasicLayout', 'componentStub', `return (${routeSource})`)(componentStub('BasicLayout'), componentStub)
const router = createRouter({ history: createMemoryHistory(), routes })

const apiPath = '/:groupName/:controller/:summary'
const cases = [
  ['/home', '/home', {}],
  ['/home/zh-CN', '/home/:i18n', { i18n: 'zh-CN' }],
  ['/plus', '/plus', {}],
  ['/plus/en-US', '/plus/:i18n', { i18n: 'en-US' }],
  ['/default/Compatibility/echo', apiPath, { groupName: 'default', controller: 'Compatibility', summary: 'echo' }],
  ['/中文分组/用户 管理+&=/查询(详情)', apiPath, { groupName: '中文分组', controller: '用户 管理+&=', summary: '查询(详情)' }],
  ['/中文分组/中文%20%2B%26%3D/echo%23%3F%25', apiPath, { groupName: '中文分组', controller: '中文 +&=', summary: 'echo#?%' }],
  ['/default/encoded%2Fslash/echo', apiPath, { groupName: 'default', controller: 'encoded/slash', summary: 'echo' }],
  ['/default/literal%252F/echo', apiPath, { groupName: 'default', controller: 'literal%2F', summary: 'echo' }],
  ['/Authorize/default', '/Authorize/:groupName', { groupName: 'default' }],
  ['/SwaggerModels/default', '/SwaggerModels/:groupName', { groupName: 'default' }],
  ['/documentManager/Settings', '/documentManager/Settings', {}],
  ['/oauth2', '/oauth2', {}],
]
for (const [url, matchedPath, params] of cases) {
  const resolved = router.resolve(url)
  assert.equal(resolved.matched.at(-1)?.path, matchedPath, url)
  assert.equal(resolved.matched.length, matchedPath === '/oauth2' ? 1 : 2, url)
  assert.deepEqual({ ...resolved.params }, params, url)
  assert.equal(resolved.fullPath, url)
  assert.equal(await router.push(url), undefined, url)
  assert.deepEqual({ ...router.currentRoute.value.params }, params, url)
  assert.equal(router.currentRoute.value.fullPath, url)
}
await router.isReady()

// Both spellings must select the same component and retain the requested URL.
// This does not assert that the historical $ URLs render a tab on a cold load.
const aliases = [
  ['/documentManager/GlobalParameters$default', '/documentManager/GlobalParameters-default', '/documentManager/GlobalParameters$:groupName', { groupName: 'default' }],
  ['/documentManager/OfficelineDocument$default', '/documentManager/OfficelineDocument-default', '/documentManager/OfficelineDocument$:groupName', { groupName: 'default' }],
  ['/default$abcdefghij$omd/doc-id', '/default-abcdefghij-omd/doc-id', '/:groupName$:mdid$omd/:id', { groupName: 'default', mdid: 'abcdefghij', id: 'doc-id' }],
]
for (const [canonicalUrl, aliasUrl, matchedPath, params] of aliases) {
  const canonical = router.resolve(canonicalUrl).matched.at(-1)
  const alias = router.resolve(aliasUrl).matched.at(-1)
  assert.equal(canonical?.path, matchedPath)
  assert.equal(alias?.aliasOf, canonical)
  assert.equal(alias.components.default, canonical.components.default)
  for (const url of [canonicalUrl, aliasUrl]) {
    await router.replace('/home')
    assert.equal(await router.push(url), undefined, url)
    assert.equal(router.currentRoute.value.fullPath, url)
    assert.deepEqual({ ...router.currentRoute.value.params }, params, url)
  }
}

const oauthCode = '/oauth2?code=fixture%2Bcode&state=fixture'
await router.push(oauthCode)
assert.equal(router.currentRoute.value.name, 'oauth2')
assert.deepEqual({ ...router.currentRoute.value.query }, { code: 'fixture+code', state: 'fixture' })
const oauthToken = '/oauth2#access_token=fixture-token&token_type=Bearer'
await router.push(oauthToken)
assert.equal(router.currentRoute.value.hash, '#access_token=fixture-token&token_type=Bearer')
assert.equal(router.currentRoute.value.fullPath, oauthToken)

const queryUrl = '/default/Compatibility/echo?q=a%2Bb&q=%E4%B8%AD%E6%96%87&flag&empty=&space=a+b#part%2525'
await router.push(queryUrl)
assert.equal(router.currentRoute.value.fullPath, queryUrl)
assert.deepEqual({ ...router.currentRoute.value.query }, { q: ['a+b', '中文'], flag: null, empty: '', space: 'a b' })
assert.equal(router.currentRoute.value.hash, '#part%25')
const named = { name: 'oauth2', query: { code: 'a+b /中文', flag: null, empty: '' }, hash: '#part%25' }
const namedUrl = '/oauth2?code=a%2Bb+/%E4%B8%AD%E6%96%87&flag&empty=#part%2525'
assert.equal(router.resolve(named).fullPath, namedUrl)
await router.push(named)
assert.equal(router.currentRoute.value.fullPath, namedUrl)
assert.deepEqual({ ...router.resolve(namedUrl).query }, named.query)
assert.equal(router.resolve(namedUrl).hash, named.hash)

// The root redirect preserves OAuth-like query/hash data and records its source.
await router.push({ name: 'home', query: { lang: 'en-US' }, hash: '#section' })
assert.equal(router.currentRoute.value.fullPath, '/home?lang=en-US#section')
assert.equal(router.currentRoute.value.redirectedFrom?.path, '/')
const duplicate = await router.push('/home?lang=en-US#section')
assert.ok(isNavigationFailure(duplicate, NavigationFailureType.duplicated))

// Replacing the active tab URL must not add a history entry. A rejected navigation
// must leave the selected route intact. Use router hooks rather than timing sleeps.
await router.push('/home')
await router.push('/default/Compatibility/echo')
await router.replace('/SwaggerModels/default')
async function traverse(action, expected) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { remove(); reject(new Error(`navigation timed out: ${expected}`)) }, 2000)
    const remove = router.afterEach((to, from, failure) => {
      clearTimeout(timeout)
      remove()
      try {
        assert.equal(failure, undefined)
        assert.equal(to.fullPath, expected)
        resolve()
      } catch (error) { reject(error) }
    })
    action()
  })
  assert.equal(router.currentRoute.value.fullPath, expected)
}
await traverse(() => router.back(), '/home')
await traverse(() => router.forward(), '/SwaggerModels/default')
const removeGuard = router.beforeEach((to) => to.path === '/Authorize/default' ? false : undefined)
try {
  const aborted = await router.push('/Authorize/default')
  assert.ok(isNavigationFailure(aborted, NavigationFailureType.aborted))
  assert.equal(router.currentRoute.value.fullPath, '/SwaggerModels/default')
} finally {
  removeGuard()
}

const require = createRequire(import.meta.url)
console.log(`vue3 router integration check passed (vue-router ${require('vue-router/package.json').version}): production routes, encoded params/query/hash, aliases, redirect, duplicate/aborted navigation and push/replace/back/forward`)
