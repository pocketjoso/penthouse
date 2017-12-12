import csstree from 'css-tree'

function parseCssAst (css) {
  return csstree.parse(css, {
    parseRulePrelude: false,
    parseAtrulePrelude: false,
    parseValue: false
  })
}
// because dont want to fail tests on white space differences
export default function normaliseCssAst (css) {
  return parseCssAst(
    csstree.translate(
      parseCssAst(css)
    )
  )
}
