import generateScreenshots from 'css-compare-screenshots'
import { after, describe, it } from 'global-mocha'
import path from 'path'
import penthouse from '../lib'
import rimraf from 'rimraf'

import compareScreenshots from './util/compareScreenshots'

const SCREENSHOT_DIST = path.join(__dirname, '/results/')
const STATIC_SERVER_PATH = path.join(__dirname, 'static-server')

describe('penthouse fault tolerant normalising css tests', function () {
  after(function () {
    rimraf.sync(SCREENSHOT_DIST.replace(/\/$/, ''))
  })
  this.timeout(20000)

  it('should generate same layout for yemoan with css errors', function (done) {
    const screenshotFilename = 'yeoman'
    console.log('get critical css..')
    penthouse({
      url: path.join(STATIC_SERVER_PATH, 'yeoman.html'),
      css: path.join(STATIC_SERVER_PATH, 'yeoman-full--invalid.css'),
      width: 800,
      height: 450
    }, function (err, result) {
      if (err) {
        done(err)
      }
      console.log('generate screenshots..')
      generateScreenshots({
        url: path.join(__dirname, 'static-server', 'yeoman.html'),
        css: result,
        width: 800,
        height: 450,
        dist: SCREENSHOT_DIST,
        fileName: screenshotFilename
      }).then(function () {
        console.log('compare screenshots..')
        return compareScreenshots(
          `${SCREENSHOT_DIST + screenshotFilename}-before.jpg`,
          `${SCREENSHOT_DIST + screenshotFilename}-after.jpg`
        )
      }).then(done)
        .catch(done)
    })
  })
})
