// URL never loading when setRequestInterceptionEnabled

// function blockinterceptedRequests (interceptedRequest) {
//   const isJsRequest = /\.js(\?.*)?$/.test(interceptedRequest.url)
//   console.log('intercepted', interceptedRequest.url)
//   if (isJsRequest) {
//     interceptedRequest.abort()
//   } else {
//     interceptedRequest.continue()
//   }
// }

const puppeteer = require('puppeteer');
(async() => {
const browser = await puppeteer.launch({
      ignoreHTTPSErrors: true,
      args: ['--disable-setuid-sandbox', '--no-sandbox']
    })
const page = await browser.newPage()

// await page.setJavaScriptEnabled(false)
await page.setRequestInterceptionEnabled(true)
page.on('request', intercepted => {
  console.log(intercepted.url)
  intercepted.continue()
})

await page.goto('https://www.studentdebtrelief.us/')
console.log('page load DONE')
browser.close();
})();
