'use strict'

import { describe, it } from 'global-mocha'
import path from 'path'
import penthouse from '../lib/'
import chai from 'chai'

chai.should() // binds globally on Object

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

describe('performance tests for penthouse', function () {
  this.timeout(10000)

  FIXTURES.forEach(({name, threshold}) => {
    it(`Penthouse should handle ${name} in less than ${threshold / 1000}s`, function () {
      const start = Date.now()
      return penthouse({
        url: staticServerPerfHtmlUrl(`${name}.html`),
        css: path.join(__dirname, 'static-server', 'perf', `${name}.css`)
      })
        .then(result => {
          (Date.now() - start).should.be.below(threshold)
        })
    })
  })
})
