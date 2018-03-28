import penthouse from '../lib'
import puppeteer from 'puppeteer'
import fs from 'fs'

//const url = process.argv[2]
//const i = process.argv[3]

const urlsToTestInParallel = 1
const url                  = 'https://jonassebastianohlsson.com/criticalpathcssgenerator/'
let jobArr                 = []

//puppeteer.launch().then(browser => {/

function startNewJob () {
  return penthouse({
    url:       url,       // can also use file:/// protocol for local files
    cssString: 'body { color; red }', // the original css to extract critcial css from
//  css: 'tmp/all_desktop_urlaub_de.full.min.css',      // path to original css file on disk

    // OPTIONAL params
    width:                   1300,                    // viewport width
    height:                  900,                    // viewport height
    keepLargerMediaQueries:  true,  // when true, will not filter out larger media queries
    timeout:                 60000,                 // ms; abort critical CSS generation after this timeout
    pageLoadSkipTimeout:     5000,         // ms; stop waiting for page load after this timeout (for sites with broken page load event timings)
    maxEmbeddedBase64Length: 1000,  // characters; strip out inline base64 encoded resources larger than this
    renderWaitTime:          500,            // ms; render wait timeout before CSS processing starts (default: 100)
    blockJSRequests:         true,          // set to false to load (external) JS (default: true)
    strict:                  false,                  // set to true to throw on CSS errors
    puppeteer:               {
      getBrowser: () => undefined        // A function that resolves with a puppeteer browser to use instead of launching a new browser session
    }
  }).then(criticalCss => {
    fs.writeFileSync('tmp/output/atf-' + i + '.css', criticalCss)
    console.log('FINISHED')
  }).catch(err => {
    // handle the error
    console.log(err)
  })
}
// }

for (let i = 0; i < urlsToTestInParallel; i++) {
  jobArr.push(startNewJob())
}

Promise.all(jobArr)
       .then(() => {
         console.log('all done!')
       })