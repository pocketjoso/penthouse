'use strict'

import css from 'css-fork-pocketjoso'
import puppeteer from 'puppeteer'
import { readFileSync as read } from 'fs'
import { describe, it } from 'global-mocha'
import path from 'path'
import penthouse from '../lib/'
import chai from 'chai'

import chromeProcessesRunning from './util/chromeProcessesRunning'

chai.should() // binds globally on Object

// becasuse dont want to fail tests on white space differences
function normalisedCssAst (cssString) {
  return css.parse(css.stringify(css.parse(cssString), { compress: true }))
}
function staticServerFileUrl (file) {
  return 'file://' + path.join(__dirname, 'static-server', file)
}

describe('extra tests for penthouse node module', function () {
  var page1FileUrl = staticServerFileUrl('page1.html')
  var page1cssPath = path.join(__dirname, 'static-server', 'page1.css')

  this.timeout(6000)
  // module handles both callback (legacy), and promise
  it('module invocation should return promise', function (done) {
    var originalCss = read(page1cssPath).toString()

    penthouse({
      url: page1FileUrl,
      css: page1cssPath
    })
    .then(result => {
      var resultAst = normalisedCssAst(result)
      var expectedAst = normalisedCssAst(originalCss)
      resultAst.should.eql(expectedAst)
      done()
    })
    .catch(done)
  })

  it('error should not contain debug info', function (done) {
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

  it('error should handle parallell jobs, sharing one browser instance, closing afterwards', function (done) {
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
              done(new Error('Chromium seems to not have shut down properly: ' + {browsers, pages}))
            } else {
              done()
            }
          })
        }, 1000)
      }
    })
    .catch(err => {
      done(err)
    })
  })

  it('should keep chromium browser instance open, if requested', function (done) {
    penthouse(({url: page1FileUrl, css: page1cssPath, unstableKeepBrowserAlive: true}))
    .then(() => {
      // wait a bit to ensure Chrome doesn't just take time to close
      // we want to ensure it stays open
      // NOTE: this test assumes no other chrome processes are running in this environment
      setTimeout(() => {
        chromeProcessesRunning()
        .then(({browsers, pages}) => {
          if (browsers) {
            done()
          } else {
            done(new Error('Chromium did NOT keep running despite option telling it so'))
          }
        })
      }, 1000)
    })
    .catch(err => {
      done(err)
    })
  })

  it('should close browser page even if page execution errored, in unstableKeepBrowserAlive mode', function (done) {
    penthouse({
      url: 'http://localhost.does.not.exist',
      css: page1cssPath,
      unstableKeepBrowserAlive: true
    })
    .catch(() => {
      // NOTE: this test assumes no other chrome processes are running in this environment
      setTimeout(() => {
        chromeProcessesRunning()
        .then(({browsers, pages}) => {
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

  it('should use the browser given in options', function (done) {
    let newPageCalled = false

    puppeteer.launch()
    .then((browser) => {
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
})
