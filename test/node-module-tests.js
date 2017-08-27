'use strict'

import css from 'css-fork-pocketjoso'
import { readFileSync as read } from 'fs'
import { describe, it } from 'global-mocha'
import path from 'path'
import penthouse from '../lib/'
import chai from 'chai'
import {spawn} from 'child_process'

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

  it('error should contain debug info in debug mode', function (done) {
    penthouse.DEBUG = true
    penthouse({
      url: 'http://localhost.does.not.exist',
      css: page1cssPath
    })
    .catch(err => {
      if (err) {
        // err should have format like:
        // time: 0 | opened css file
        // time: 2 | parsed ast (without errors)
        if (/^Error: time: /.test(err)) {
          done()
        } else {
          done(err)
        }
        return
      }
      done(new Error('did not throw any error, which was expected'))
    })
  })

  it('error should handle parallell jobs, sharing one browser instance, closing afterwards', function (done) {
    // reset from previous test
    penthouse.DEBUG = false
    // currently breaks if testing with more than one url at the time
    const urls = [page1FileUrl, page1FileUrl]
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
        setTimeout(() => {
          const ps = spawn('ps', ['aux'])
          const grep = spawn('grep', ['[C]hromium --type=renderer --disable-background-timer'])
          ps.stdout.on('data', data => grep.stdin.write(data))
          ps.on('close', () => grep.stdin.end())
          let chromiumStillRunning = false
          grep.stdout.on('data', (data) => {
            const result = data.toString()
            if (result.length) {
              chromiumStillRunning = result
            }
          })
          grep.on('close', () => {
            if (chromiumStillRunning) {
              done(new Error('Chromium seems to not have shut down properly: ' + chromiumStillRunning))
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
      setTimeout(() => {
        const ps = spawn('ps', ['aux'])
        const grep = spawn('grep', ['[C]hromium --type=renderer --disable-background-timer'])
        ps.stdout.on('data', data => grep.stdin.write(data))
        ps.on('close', () => grep.stdin.end())
        let chromiumStillRunning = false
        grep.stdout.on('data', (data) => {
          const result = data.toString()
          if (result.length) {
            chromiumStillRunning = result
          }
        })
        grep.on('close', () => {
          if (chromiumStillRunning) {
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
})
