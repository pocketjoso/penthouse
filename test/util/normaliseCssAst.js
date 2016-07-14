import css from 'css'
// because dont want to fail tests on white space differences
export default function normaliseCssAst (cssString) {
  return css.parse(css.stringify(css.parse(cssString), { compress: true }))
}
