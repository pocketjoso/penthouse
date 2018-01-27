import puppeteer from 'puppeteer'
import { readFileSync as read } from 'fs'
import path from 'path'
import penthouse from '../../lib/'

import chromeProcessesRunning from '../util/chromeProcessesRunning'
import normaliseCss from '../util/normaliseCss'

function staticServerFileUrl (file) {
  return 'file://' + path.join(process.env.PWD, 'test', 'static-server', file)
}

describe('extra tests for penthouse node module', () => {
  var page1FileUrl = staticServerFileUrl('page1.html')
  var page1cssPath = path.join(process.env.PWD, 'test', 'static-server', 'page1.css')

  // the last two tests are using the unstableKeepBrowserAlive property,
  // which expects to continue to use the same browser forever.
  // Hence we cannot close that browser until _both_ those tests are finished,
  // so it needs to be shared.
  // However before that test we have another test that checks that _all_
  // browsers have been closed (when _nt_ using unstableKeepBrowserAlive),
  // so we cannot start this extra shared browser until _after_ that.
  // So it is launched later in this file.
  let browserPromiseForUnstableKeepOpenTests

  // module handles both callback (legacy), and promise
  it('module invocation should return promise', () => {
    var originalCss = read(page1cssPath).toString()

    return penthouse({
      url: page1FileUrl,
      css: page1cssPath
    })
      .then(result => {
        expect(result).toEqual(normaliseCss(originalCss))
      })
  })

  it('error should not contain debug info', done => {
    // callback
    penthouse({
      url: 'http://localhost.does.not.exist',
      css: page1cssPath
    })
      .catch(err => {
        if (err) {
          if (/^Error: time: 0/.test(err)) {
            done(err)
          } else {
            done()
          }
          return
        }
        done(new Error('did not return expected error'))
      })
  })

  it('should use the browser given in options', async (done) => {
    let newPageCalled = false

    const browser = await puppeteer.launch()

    // Spy on browser.newPage method to check if it's called
    let originalNewPage = browser.newPage
    browser.newPage = (...args) => {
      newPageCalled = true
      return originalNewPage.call(browser, args)
    }
    return penthouse({
      url: page1FileUrl,
      css: page1cssPath,
      puppeteer: {
        getBrowser: () => browser
      }
    })
    .then(() => {
      if (!newPageCalled) {
        done(new Error('Did not use the browser passed in options'))
      } else {
        done()
      }
    })
    .catch(done)
  })

  it('error should handle parallell jobs, sharing one browser instance, closing afterwards', done => {
    const urls = [page1FileUrl, page1FileUrl, page1FileUrl]
    const promises = urls.map(url => {
      return penthouse(({url, css: page1cssPath}))
    })
    Promise.all(promises)
      .then(results => {
        const hasErrors = results.find(result => {
          return result.error || !result.length
        })
        if (hasErrors) {
          done(new Error('some result had errors: ' + hasErrors))
        } else {
          // give chrome some time to shutdown
          // NOTE: this test assumes no other chrome processes are running in this environment
          setTimeout(() => {
            chromeProcessesRunning()
              .then(({browsers, pages}) => {
                if (browsers || pages) {
                  // pages: ${pages}
                  done(new Error(`Chromium seems to not have shut down properly:
                    browsers: ${browsers}`
                  ))
                } else {
                  done()
                }
              })
          }, 1000)
        }
      })
      .catch(done)
  })

  it('should close browser page even if page execution errored, in unstableKeepBrowserAlive mode', done => {
    browserPromiseForUnstableKeepOpenTests = puppeteer.launch()
    penthouse({
      url: 'http://localhost.does.not.exist',
      css: page1cssPath,
      unstableKeepBrowserAlive: true,
      // so we can kill the browser after
      // (but after the _next_ test, which also uses unstableKeepBrowserAlive)
      puppeteer: { getBrowser: () => browserPromiseForUnstableKeepOpenTests }
    })
      .catch(() => {
        // NOTE: this test assumes no other chrome processes are running in this environment
        setTimeout(() => {
          chromeProcessesRunning()
            .then(({pages}) => {
              // chrome browser opens with an empty page (tab),
              // which we are just ignoring for now -
              // did the _extra_ page we opened close, or are we left with 2?
              if (pages && pages.length > 1) {
                done(new Error('Chromium seems to not have closed the page we opened, kept nr of pages: ' + pages.length))
              } else {
                done()
              }
            })
        }, 1000)
      })
  })


  it('should keep chromium browser instance open, if requested', done => {
    penthouse(({
      url: page1FileUrl,
      css: page1cssPath,
      unstableKeepBrowserAlive: true,
      // so we can kill the browser after
      puppeteer: { getBrowser: () => browserPromiseForUnstableKeepOpenTests }
    }))
      .then(() => {
        // wait a bit to ensure Chrome doesn't just take time to close
        // we want to ensure it stays open
        // NOTE: this test assumes no other chrome processes are running in this environment
        setTimeout(() => {
          chromeProcessesRunning()
            .then(({browsers}) => {
              // so test finishes automatically
              browserPromiseForUnstableKeepOpenTests.then(browser => {
                browser.close()
              })

              if (browsers) {
                done()
              } else {
                done(new Error('Chromium did NOT keep running despite option telling it so'))
              }
            })
        }, 1000)
      })
      .catch(err => {
        browserPromise.then(browser => browser.close())
        done(err)
      })
  })
})
