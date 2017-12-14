'use strict'

const BASE64_ENCODE_PATTERN = /data:[^,]*base64,/

const _isTooLongBase64Encoded = function (declaration, maxEmbeddedBase64Length) {
  const value = declaration.value.value
  return (
    BASE64_ENCODE_PATTERN.test(value) && value.length > maxEmbeddedBase64Length
  )
}

const _removeDataUrisFromRule = function (rule, maxEmbeddedBase64Length) {
  if (rule.type === 'Atrule' && rule.name === 'font-face') {
    let hasSrc = false
    rule.block.children = rule.block.children.filter(declaration => {
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
  } else if (rule.type === 'Rule') {
    rule.block.children = rule.block.children.filter(declaration => {
      if (_isTooLongBase64Encoded(declaration, maxEmbeddedBase64Length)) {
        return false
      }
      return true
    })
  } else if (rule.type === 'Atrule' && rule.name === 'media') {
    rule.block.children = rule.block.children
      .map(function (rule) {
        return _removeDataUrisFromRule(rule, maxEmbeddedBase64Length)
      })
      .filter(Boolean)

    return rule
  }
  return rule
}

const embeddedbase64Remover = function (astRules, maxEmbeddedBase64Length) {
  return astRules
    .map(rule => _removeDataUrisFromRule(rule, maxEmbeddedBase64Length))
    .filter(Boolean)
}

module.exports = embeddedbase64Remover
