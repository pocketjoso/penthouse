var csstree = require('css-tree')
var CSS_FIXTURE = '.button div, .button--meh:not([disabled]) { color: red}'

var ast = csstree.parse(CSS_FIXTURE)
var astRules = csstree.toPlainObject(ast).children
var firstRule = astRules[0]

var selectors = firstRule.prelude.children.map(selector => {
  var parsedSelector = csstree.fromPlainObject(selector)
  var selectorString = csstree.translate(parsedSelector)
  return selectorString
})

console.log({selectors})
