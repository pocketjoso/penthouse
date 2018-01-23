import csstree from 'css-tree'

function parseCssAst (css) {
  return csstree.parse(css)
}
// because dont want to fail tests on white space differences
export default function normaliseCss (css) {
  return csstree.generate(parseCssAst(css))
}
