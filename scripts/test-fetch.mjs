import { CHATGPT_SHARE_HEADERS } from 'chatgpt-share-parser'

const url = 'https://chatgpt.com/share/6a33210e-41f8-83ea-ab1f-7995db2433b1'
const response = await fetch(url, { headers: CHATGPT_SHARE_HEADERS, cache: 'no-store' })
const html = await response.text()
console.log(JSON.stringify({
  status: response.status,
  length: html.length,
  hasStream: html.includes('streamController.enqueue'),
  hasDataBuild: html.includes('data-build='),
  hasCf: html.includes('Attention Required'),
  title: html.match(/<title>[^<]+/)?.[0] ?? null
}, null, 2))
