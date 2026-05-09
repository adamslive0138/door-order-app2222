import chromium from "@sparticuz/chromium"
import puppeteer from "puppeteer-core"

export async function getBrowser() {
  const executablePath = await chromium.executablePath()

  return puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  })
}