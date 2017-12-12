import debug from 'debug'
const debuglog = debug('penthouse:postformatting:unused-keyframe-remover')

function getAllKeyframes (rules) {
  const matches = []
  function handleRule (rule) {
    if (rule.type === 'Rule') {
      rule.block.children.forEach(function (possibleDeclaration) {
        if (
          possibleDeclaration.property === 'animation' ||
          possibleDeclaration.property === 'animation-name'
        ) {
          const keyframeName = possibleDeclaration.value.value.split(' ')[0]
          debuglog('found used keyframe animation: ' + keyframeName)
          matches.push(keyframeName)
        }
      })
    } else if (rule.type === 'Atrule' && rule.name === 'media') {
      rule.block.children.forEach(handleRule)
    }
  }
  rules.forEach(handleRule)
  return matches
}

function unusedKeyframeRemover (rules) {
  debuglog('getAllAnimationKeyframes')
  const usedKeyFrames = getAllKeyframes(rules)
  debuglog(
    'getAllAnimationKeyframes AFTER, usedKeyFrames: ' + usedKeyFrames.length
  )

  function filterUnusedKeyframeRule (rule) {
    if (rule.type !== 'Atrule') {
      return true
    }
    if (rule.name === 'media') {
      // mutating the original object..
      rule.block.children = rule.block.children.filter(filterUnusedKeyframeRule)
      return rule.block.children.length > 0
    }
    if (!/^(-webkit-)?keyframes/.test(rule.name)) {
      return true
    }
    // remove unnused keyframes rules
    const keep = usedKeyFrames.indexOf(rule.prelude.value) !== -1
    if (!keep) {
      debuglog('drop non critical keyframe: ' + rule.prelude.value)
    }
    return keep
  }

  // remove all unknown keyframes
  return rules.filter(filterUnusedKeyframeRule)
}

if (typeof module !== 'undefined') {
  module.exports = unusedKeyframeRemover
}
