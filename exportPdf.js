// backend/pdf/exportPdf.js
const fs = require('fs');
const puppeteer = require('puppeteer');

async function generatePdfFromHtml(html, outPath){
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ path: outPath, format: 'A4', printBackground: true });
  await browser.close();
}

module.exports = { generatePdfFromHtml };
