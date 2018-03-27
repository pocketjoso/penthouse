const penthouse = require('../lib')
const fs        = require('fs')
const puppeteer = require('puppeteer')

const urls = []
for (let i = 0; i < 5; i++) {
  urls.push('https://tcms-proxy.reisen.check24-test.de/mietwagen?beard=reload')
}

const penthouseOptions = {
  cssString: 'body {color: red}, .someCss {}'
}

// recursively generates critical css for one url at the time,
// until all urls have been handled
const browserLaunchPromise = puppeteer.launch({
  args: [
    '--disable-setuid-sandbox',
    '--no-sandbox',
    '--ignore-certificate-errors'
  ]
})

function startNewJob () {
  const url = urls.pop() // NOTE: mutates urls array
  if (!url) {
    // no more new jobs to process (might still be jobs currently in process)
    return Promise.resolve()
  }
  return penthouse({
    url,
    ...penthouseOptions,
    puppeteer: {
      getBrowser: () => browserLaunchPromise
    }
  })
    .then(criticalCss => {
      // do something with your criticalCSS here!
      // Then call to see if there are more jobs to process
      return startNewJob()
    })
    .catch(err => console.error(err))
}

// how many jobs do we want to handle in paralell?
// Below, 5:
Promise.all([
  startNewJob(),
  startNewJob(),
  startNewJob(),
  startNewJob(),
  startNewJob()
]).then(() => {
  console.log('all done!')
})
