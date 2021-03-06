const { exec } = require('child_process');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
// eslint-disable-next-line import/no-extraneous-dependencies
const puppeteer = require('puppeteer');
const genericPool = require('generic-pool');

const app = express();
const port = 8079;

const browserFactory = {
  async create() {
    const browser = await puppeteer.launch(
      {
        executablePath: '/usr/bin/chromium-browser',
        headless: true,
        devtools: false,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
          // '--remote-debugging-port=9222',
          // '--remote-debugging-address=0.0.0.0'
        ]
      }
    );
    const page = await browser.newPage();
    return page;
  },
  async destroy(browser) {
    await browser.close();
    exec('pkill chrome');
  }
};

const browserPool = genericPool.createPool(browserFactory, {
  max: 1,
  min: 0,
  maxWaitingClients: 50,
  idleTimeoutMillis: 30000, // 1200000, // 20min
  evictionRunIntervalMillis: 1000
});

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

console.log(`PUBLIC_URL:${process.env.PUBLIC_URL}`);

app.get('*', async (req, res) => {
  console.log(req.params);
  const path = req.params['0'];

  let screenshotUrl = `${process.env.PUBLIC_URL}${path}`;
  let pageOptions = {
    width: 1200,
    height: 900,
    deviceScaleFactor: 2
  };
  if (req.query.hasOwnProperty('screenshot')) {
    screenshotUrl += '?screenshot';
  }
  if (req.query.hasOwnProperty('thumbnail')) {
    screenshotUrl += '&thumbnail';
    pageOptions = {
      width: 300,
      height: 300,
      deviceScaleFactor: 1
    };
  }

  const page = await browserPool.acquire();
  page.setViewport(pageOptions);
  await page.goto(screenshotUrl, {
    waitLoad: true,
    waitNetworkIdle: true
  });
  await page.waitForSelector('#mapstatus.loaded');
  await page.waitFor(500); // extra 500ms wait, for map tiles
  const screenshotBuffer = await page.screenshot({ encoding: 'binary' });
  // await browser.close();
  await browserPool.release(page);
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Content-disposition': 'attachment;filename=screenshot.png',
    'Content-Length': screenshotBuffer.length
  });

  res.end(Buffer.from(screenshotBuffer, 'binary'));
});

app.listen(port, () => console.log(`screenshot-server on port ${port}`));
