import path from 'path'
import penthouse from '../lib/'


function staticServerPerfHtmlUrl (file) {
  return 'file://' + path.join(__dirname, 'static-server', 'perf', file)
}

const FIXTURES = [
  {
    threshold: 1900,
    name: 'stripe'
  },
  {
    threshold: 2000,
    name: 'jso'
  },
  {
    threshold: 2700,
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
  this.timeout(10000)

  FIXTURES.forEach(({name, threshold}) => {
    it(`Penthouse should handle ${name} in less than ${threshold / 1000}s`, () => {
      const start = Date.now()
      return penthouse({
        url: staticServerPerfHtmlUrl(`${name}.html`),
        css: path.join(__dirname, 'static-server', 'perf', `${name}.css`)
      })
        .then(result => {
          expect(Date.now() - start).toBeLessThan(threshold)
        })
    })
  })
})
