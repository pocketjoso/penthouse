'use strict'

const _removePropertiesFromRule = function (rule, propertiesToRemoveRegexes) {
  if (
    rule.type === 'Rule' ||
    (rule.type === 'Atrule' && rule.name === 'font-face')
  ) {
    rule.block.children = rule.block.children.filter(declaration => {
      if (
        propertiesToRemoveRegexes.some(toRemovePattern => {
          return toRemovePattern.test(declaration.property)
        })
      ) {
        return false
      }
      return true
    })
  } else if (rule.type === 'Atrule' && rule.name === 'media') {
    rule.block.children = rule.block.children
      .map(function (rule) {
        return _removePropertiesFromRule(rule, propertiesToRemoveRegexes)
      })
      .filter(Boolean)
  }
  if (rule.block && rule.block.children.length === 0) {
    return null
  }
  return rule
}

const unwantedPropertiesRemover = function (astRules, propertiesToRemove) {
  const propertiesToRemoveRegexes = propertiesToRemove.map(
    text => new RegExp(text)
  )

  return astRules
    .map(rule => _removePropertiesFromRule(rule, propertiesToRemoveRegexes))
    .filter(Boolean)
}

module.exports = unwantedPropertiesRemover
