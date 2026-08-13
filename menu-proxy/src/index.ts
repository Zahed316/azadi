/**
 * Menu Proxy Worker
 *
 * Reverse proxy for www.azadiroastery.ir → azadi-menu.pages.dev
 * Works around Cloudflare Pages TLD restrictions on .ir domains.
 *
 * Deployed via Cloudflare API (workerd doesn't run on Android ARM64).
 * Uses service-worker syntax for API compatibility.
 */

const TARGET = 'https://azadi-menu.pages.dev';

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Build target URL preserving path and query
  const targetUrl = new URL(url.pathname + url.search, TARGET);

  const proxyRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'follow',
  });

  const response = await fetch(proxyRequest);

  // Clone response to add proxy headers
  const proxyResponse = new Response(response.body, response);
  proxyResponse.headers.set('x-proxy-by', 'menu-proxy');

  return proxyResponse;
}
