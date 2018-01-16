import csstree from 'css-tree'
import { describe, it } from 'global-mocha'
import path from 'path'
import penthouse from '../lib/'
import { readFileSync as read } from 'fs'
import normaliseCss from './util/normaliseCss'
import chai from 'chai'

import ffRemover from '../lib/postformatting/unused-fontface-remover'
import unusedKeyframeRemover from '../lib/postformatting/unused-keyframe-remover'
import unwantedPropertiesRemover from '../lib/postformatting/unwanted-properties-remover'
import embeddedbase64Remover from '../lib/postformatting/embedded-base64-remover'

chai.should() // binds globally on Object

function staticServerFileUrl (file) {
  return 'file://' + path.join(__dirname, 'static-server', file)
}

process.setMaxListeners(0)

describe('penthouse post formatting tests', function () {
  it('should remove propertiesToRemove', function () {
    const originalCss = `
      body {
        transition: all 0.5s;
        -webkit-transition: all 0.5s;
        cursor: pointer;
        pointer-events: null;
        -webkit-tap-highlight-color: blue;
        -moz-user-select: none;
        user-select: none;
      }
      @media all {
        body {
          pointer-events: null;
        }
      }
    `
    const propertiesToRemove = [
      '(.*)transition(.*)',
      'cursor',
      'pointer-events',
      '(-webkit-)?tap-highlight-color',
      '(.*)user-select'
    ]

    const ast = csstree.parse(originalCss)

    unwantedPropertiesRemover(ast, propertiesToRemove)

    ast.children.isEmpty().should.eql(true)
  })

  it('should remove embedded base64', function () {
    const originalCss = read(path.join(__dirname, 'static-server', 'embedded-base64--remove.css')).toString()
    const expectedCss = read(path.join(__dirname, 'static-server', 'embedded-base64--remove--expected.css')).toString()

    const ast = csstree.parse(originalCss)

    // NOTE: penthouse's default max uri length is 1000.
    // lowering the limit here so that everything will be removed in test fixture
    embeddedbase64Remover(ast, 250)

    csstree.generate(ast).should.eql(normaliseCss(expectedCss))
  })

  it('should remove @font-face rule, because it is not used', function () {
    var fontFaceRemoveCssFilePath = path.join(__dirname, 'static-server', 'fontface--remove.css')
    var fontFaceRemoveExpectedCssFilePath = path.join(__dirname, 'static-server', 'fontface--remove--expected.css')
    var originalCss = read(fontFaceRemoveCssFilePath).toString()
    var expectedCss = read(fontFaceRemoveExpectedCssFilePath).toString()

    const ast = csstree.parse(originalCss)

    ffRemover(ast)

    csstree.generate(ast).should.eql(normaliseCss(expectedCss))
  })

  it('should only keep @keyframe rules used in critical css', function () {
    const originalCss = read(path.join(__dirname, 'static-server', 'unused-keyframes.css'), 'utf8')
    const expectedCss = read(path.join(__dirname, 'static-server', 'unused-keyframes--expected.css'), 'utf8')

    const ast = csstree.parse(originalCss)

    unusedKeyframeRemover(ast)

    csstree.generate(ast).should.eql(normaliseCss(expectedCss))
  })

  it('should not remove transitions but still remove cursor from css', function () {
    var fullCssFilePath = path.join(__dirname, 'static-server', 'transition-full.css')
    var expectedCssFilePath = path.join(__dirname, 'static-server', 'transition-crit--expected.css')
    var expectedCss = read(expectedCssFilePath).toString()

    return penthouse({
      url: staticServerFileUrl('transition.html'),
      css: fullCssFilePath,
      width: 800,
      height: 450,
      propertiesToRemove: [
        'cursor',
        'pointer-events',
        '(-webkit-)?tap-highlight-color',
        '(.*)user-select'
      ]
    })
      .then(result => {
        result.should.eql(normaliseCss(expectedCss))
      })
  })
})
