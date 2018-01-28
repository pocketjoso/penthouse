import puppeteer from 'puppeteer'
import path from 'path'
import penthouse from '../../lib/'


function staticServerPerfHtmlUrl (file) {
  return 'file://' + path.join(process.env.PWD, 'test', 'static-server', 'perf', file)
}

const FIXTURES = [
  {
    // NOTE: with current test setup, the first test incurs extra cost of launching browser
    // whereas the latter ones re-use it
    threshold: 1900,
    name: 'stripe'
  },
  {
    threshold: 2000,
    name: 'jso'
  },
  {
    threshold: 2900,
    name: 'dn'
  },
  {
    threshold: 4600,
    name: 'guardian'
  },
  {
    threshold: 6400,
    name: 'forbesindustries'
  }
]

describe('performance tests for penthouse', () => {
  jest.setTimeout(7000)
  const browserPromise = puppeteer.launch()

  let testsCompleted = 0
  FIXTURES.forEach(({name, threshold}) => {
    it(`Penthouse should handle ${name} in less than ${threshold / 1000}s`, () => {
      const start = Date.now()
      return penthouse({
        url: staticServerPerfHtmlUrl(`${name}.html`),
        css: path.join(process.env.PWD, 'test', 'static-server', 'perf', `${name}.css`),
        unstableKeepBrowserAlive: true,
        puppeteer: { getBrowser: () => browserPromise }
      })
        .then((result) => {
          testsCompleted++
          if (testsCompleted === FIXTURES.length) {
            console.log('close shared browser after performance tests')
            browserPromise.then(browser => browser.close())
          }
          expect(Date.now() - start).toBeLessThan(threshold)
        })
    })
  })
})
