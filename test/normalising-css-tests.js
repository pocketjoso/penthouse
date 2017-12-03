'use strict'

import puppeteer from 'puppeteer'
import { after, describe, it } from 'global-mocha'
import path from 'path'
import penthouse from '../lib'
import normalizeCss from '../lib/normalize-css'
import rimraf from 'rimraf'

import compareScreenshots from './util/compareScreenshots'

import css from 'css-fork-pocketjoso'
import fs from 'fs'
import chai from 'chai'
chai.should() // binds globally on Object

const SCREENSHOT_DIST = path.join(__dirname, '/results/')
const STATIC_SERVER_PATH = path.join(__dirname, 'static-server')

// because dont want to fail tests on white space differences
function normalisedCssAst (cssString) {
  // use silent parsing mode here,
  // as Penthouse does, to see that the parsed css is correct despite error
  // this is relevant for the extra closing brace test(s)
  return css.parse(css.stringify(css.parse(cssString, { silent: true }), { compress: true }))
}
function staticServerFileUrl (file) {
  return 'file://' + path.join(__dirname, 'static-server', file)
}

describe('penthouse fault tolerant normalising css tests', function () {
  after(function () {
    rimraf.sync(SCREENSHOT_DIST + '*')
  })
  this.timeout(20000)

  it('should preserve escaped hex reference styles', async function (done) {
    // NOTE: the normalised CSS comes back with all quotes (for escaped hex refs only?)
    // as single quotes, regardless of what they were before.
    // This test will fail if the css uses double quotes (although false negative: still works)
    const cssPath = path.join(STATIC_SERVER_PATH, 'escaped-hex-reference-in-invalid.css')
    const css = fs.readFileSync(cssPath, 'utf8')

    // because too lazy to create separate 'original' and 'expected' stylesheets (• -> \u2022)
    const expected = css
      .replace('{ invalid }', '')
      .replace(/(['"])•(['"])/g, `$1\\2022$2`)
      // chrome now turns all quotes into double quotes
      // so match here
      .replace(/'/g, '"')
    const expectedAst = normalisedCssAst(expected)

    const browser = await puppeteer.launch({
      ignoreHTTPSErrors: true,
      args: ['--disable-setuid-sandbox', '--no-sandbox']
    })

    var options = {
      css,
      browser,
      debuglog: () => {}
    }

    normalizeCss(options)
    .then(result => {
      const resultAst = normalisedCssAst(result)
      resultAst.should.eql(expectedAst)
      browser.close()
      done()
    })
    .catch(err => {
      browser.close()
      done(err)
    })
  })

  it('should generate same layout for yeoman with css errors', function (done) {
    const screenshotFilename = 'yeoman'
    console.log('get critical css and screenshots..')
    penthouse({
      url: staticServerFileUrl('yeoman.html'),
      css: path.join(STATIC_SERVER_PATH, 'yeoman-full--invalid.css'),
      width: 800,
      height: 450,
      // for testing
      screenshots: {
        basePath: path.join(SCREENSHOT_DIST, screenshotFilename),
        type: 'jpeg',
        quality: 20
      }
    })
    .then(function () {
      console.log('compare screenshots..')
      return compareScreenshots(
        `${SCREENSHOT_DIST + screenshotFilename}-before.jpg`,
        `${SCREENSHOT_DIST + screenshotFilename}-after.jpg`
      )
    })
    .then(() => done())
    .catch(done)
  })

  // NOTE: the functionality for handling extra closing brace errors is in
  // (the forked version of) the css package, in the parse function.
  // Still adding tests here since this used to be broken.
  it('should remove extra closing braces in css', function (done) {
    const originalCss = `@media all {
      body {
        color: red;
        content: '{';
      }}}
    }
    div {
      display: block;
    }}`
    const expectedCss = `@media all {
      body {
        color: red;
        content: '{';
      }
    }
    div {
      display: block;
    }`
    normalisedCssAst(expectedCss).should.eql(normalisedCssAst(originalCss))
    done()
  })

  it('should correctly AST parse css with extra closing braces w/o dropping rules', function (done) {
    const cssWithUnclosedBraces = fs.readFileSync(path.join(__dirname, 'static-server', 'css-with-unclosed-braces.css'), 'utf8')

    const originalAst = normalisedCssAst(cssWithUnclosedBraces)
    // 0.9 is magic number here - just to show that we haven't dropped most of the css,
    // which happens with original css' parser
    // (what have we dropped? some whitespace, maybe some comments? invalid rules?)
    cssWithUnclosedBraces.should.have.length.greaterThan(css.stringify(originalAst).length * 0.9)
    done()
  })
})
