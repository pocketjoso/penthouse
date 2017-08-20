'use strict'

import css from 'css-fork-pocketjoso'
// because dont want to fail tests on white space differences
export default function normaliseCssAst (cssString) {
  return css.parse(css.stringify(css.parse(cssString), { compress: true }))
}
