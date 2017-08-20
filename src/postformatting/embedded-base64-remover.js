'use strict'

const cssAstFormatter = require('css-fork-pocketjoso')

const BASE64_ENCODE_PATTERN = /data:[^,]*base64,/

const _isTooLongBase64Encoded = function (declaration, maxEmbeddedBase64Length) {
  return (
    BASE64_ENCODE_PATTERN.test(declaration.value) &&
    declaration.value.length > maxEmbeddedBase64Length
  )
}

const _removeDataUrisFromRule = function (rule, maxEmbeddedBase64Length) {
  if (rule.type === 'font-face') {
    let hasSrc = false
    rule.declarations = rule.declarations.filter(function (declaration) {
      if (_isTooLongBase64Encoded(declaration, maxEmbeddedBase64Length)) {
        return false
      } else if (declaration.property === 'src') {
        hasSrc = true
      }
      return true
    })
    if (!hasSrc) {
      return null
    }
  } else if (rule.type === 'rule') {
    rule.declarations = rule.declarations.filter(function (declaration) {
      if (_isTooLongBase64Encoded(declaration, maxEmbeddedBase64Length)) {
        return false
      }
      return true
    })
  } else if (rule.type === 'media') {
    const rules = rule.rules.map(function (rule) {
      return _removeDataUrisFromRule(rule, maxEmbeddedBase64Length)
    })
    rule.rules = rules.filter(function (rule) {
      return Boolean(rule)
    })
    return rule
  }
  return rule
}

const embeddedbase64Remover = function (css, maxEmbeddedBase64Length) {
  const ast = cssAstFormatter.parse(css)
  let rules = ast.stylesheet.rules.map(function (rule) {
    return _removeDataUrisFromRule(rule, maxEmbeddedBase64Length)
  })
  rules = rules.filter(function (rule) {
    return Boolean(rule)
  })

  return cssAstFormatter.stringify({
    stylesheet: {
      rules: rules
    }
  })
}

module.exports = embeddedbase64Remover
