'use strict'

import path from 'path'
import penthouse from '../lib/'
import { readFileSync as read } from 'fs'
import csstree from 'css-tree'
import http from 'http'
import url from 'url'

import normaliseCss from './util/normaliseCss'

const serverPort = 8888;

function staticServerFileUrl (file) {
  return 'file://' + path.join(process.env.PWD, 'test', 'static-server', file)
}

function responseSatusUrl (code) {
  return 'http://localhost:' + serverPort + '?responseStatus=' + code
}


describe('basic tests of penthouse functionality', () => {
  var page1FileUrl = staticServerFileUrl('page1.html')
  var page1cssPath = path.join(process.env.PWD, 'test', 'static-server', 'page1.css')
  var originalCss = read(page1cssPath).toString()
  var httpServer;

  beforeAll(function() {
    httpServer = http.createServer(function(request, response) {
      var query = url.parse(request.url, true).query
      response.writeHead(query.responseStatus)
      response.end()
    }).listen(serverPort)
  });

  afterAll(function() {
    httpServer.close();
  })

  function largeViewportTest () {
    var widthLargerThanTotalTestCSS = 1000
    var heightLargerThanTotalTestCSS = 1000

    return penthouse({
      url: page1FileUrl,
      css: page1cssPath,
      width: widthLargerThanTotalTestCSS,
      height: heightLargerThanTotalTestCSS
    })
      .then(result => {
        expect(result).toEqual(normaliseCss(originalCss))
      })
  }

  function smallViewportTest () {
    var widthLargerThanTotalTestCSS = 1000
    var heightSmallerThanTotalTestCSS = 100

    return penthouse({
      url: page1FileUrl,
      css: page1cssPath,
      width: widthLargerThanTotalTestCSS,
      height: heightSmallerThanTotalTestCSS
    })
      .then(result => {
        const resultRules = csstree.toPlainObject(csstree.parse(result)).children
        const originalRules = csstree.toPlainObject(csstree.parse(originalCss)).children
        expect(resultRules.length).toBeLessThan(originalRules.length)
        // not be empty
      })
  }

  it('should return a css file whose parsed AST is equal to the the original\'s AST when the viewport is large', largeViewportTest)

  it('should return a subset of the original AST rules when the viewport is small', smallViewportTest)

  // largeViewportTest will set the default viewport, in the puppeteer browser penthouse
  // will re-use for the smallViewportTest here (since they run in parallell).
  // Since this is not the viewport size the second test wants,
  // penthouse needs to explicitly update the viewport on the browser page during execution.
  // This test will fail if that doesn't happen.
  it('should handle updating viewport size between two jobs run at the same time', () => {
    return Promise.all([
      largeViewportTest(),
      smallViewportTest()
    ])
  })

  it('should not crash on invalid css', () => {
    return penthouse({
      url: page1FileUrl,
      css: path.join(process.env.PWD, 'test', 'static-server', 'invalid.css')
    })
      .then(result => {
        if (result.length === 0) {
          throw new Error('length should be > 0')
        }
        expect(result.length).toBeGreaterThan(0)
      })
  })

  it('should not crash on invalid media query', () => {
    return penthouse({
      url: page1FileUrl,
      css: path.join(process.env.PWD, 'test', 'static-server', 'invalid-media.css')
    })
      .then(result => {
        expect(result.length).toBeGreaterThan(0)
      })
  })

  it('should crash with errors in strict mode on invalid css', done => {
    penthouse({
      url: page1FileUrl,
      css: path.join(process.env.PWD, 'test', 'static-server', 'invalid.css'),
      strict: true
    })
      .then(() => done(new Error('Did not get error')))
      .catch(() => done())
  })

  it('should not crash or hang on special chars', () => {
    return penthouse({
      url: page1FileUrl,
      css: path.join(process.env.PWD, 'test', 'static-server', 'special-chars.css')
    })
      .then(result => {
        expect(result.length).toBeGreaterThan(0)
      })
  })

  it('should surface parsing errors to the end user', done => {
    penthouse({
      css: 'missing.css'
    })
      .then(() => done(new Error('Did not get error')))
      .catch(() => done())
  })

  it('should exit after timeout', done => {
    penthouse({
      url: page1FileUrl,
      css: page1cssPath,
      timeout: 100
    })
      .then(() => done(new Error('Got no timeout error')))
      .catch(err => {
        if (err && /Penthouse timed out/.test(err)) {
          done()
        } else {
          done(new Error('Did not get timeout error, got: ' + err))
        }
      })
  })

  it('should not throw an error on 200-299 response status', done => {
    penthouse({
      url: responseSatusUrl(200),
      css: page1cssPath
    }).then(() => {
      done();
    }).catch(() => {
      done(new Error('Thrown an error on a 200-299 response status'))
    })
  });

  it('should throw an error on error server response', done => {
    var code = 401;
    var errorMessage = 'Didn\'t throw an error on ' + code + ' response';

    penthouse({
      url: responseSatusUrl(code),
      css: page1cssPath
    }).then(() => {
        done(new Error(errorMessage))
    }).catch((err) => {
      if (err.message.match(code)) {
        done()
      } else {
        done(new Error(errorMessage))
      }
    })
  });
})
