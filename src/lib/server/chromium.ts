/**
 * Browser launcher that works in both environments:
 *   - Vercel production: puppeteer-core + @sparticuz/chromium (no bundled Chrome)
 *   - Local dev: full puppeteer (bundles its own Chrome)
 *
 * Import only from server-side code (API routes, server actions).
 */
export async function launchBrowser() {
  if (process.env.NODE_ENV === 'production') {
    const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
      import('@sparticuz/chromium'),
      import('puppeteer-core'),
    ])

    return puppeteer.launch({
      args:           chromium.args,
      executablePath: await chromium.executablePath(),
      headless:       true,
    })
  }

  // Local development: puppeteer ships its own Chromium
  const { default: puppeteer } = await import('puppeteer')
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
}
