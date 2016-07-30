
function getAllKeyframes(rules) {
  var matches = []
  function handleRule (rule) {
    if (rule.type === 'rule') {
      ;(rule.declarations || []).forEach(function (props) {
        if (props.property === 'animation' || props.property === 'animation-name') {
          matches.push(props.value.split(' ')[0])
        }
      })
    } else if (rule.type === 'media') {
      ;(rule.rules || []).forEach(handleRule)
    }
  }
  rules.forEach(handleRule)
  return matches
}

function unusedKeyframeRemover (rules) {
  var usedKeyFrames = getAllKeyframes(rules)

  function filterUnusedKeyframeRule (rule) {
    if (rule.type === 'media') {
      // mutating the original object..
      rule.rules = rule.rules.filter(filterUnusedKeyframeRule)
      return rule.rules.length > 0
    }
    if (rule.type !== 'keyframes') {
      return true
    }
    // remove unnused keyframes rules
    return usedKeyFrames.indexOf(rule.name) !== -1
  }

  // remove all unknown keyframes
  return rules.filter(filterUnusedKeyframeRule)
}

if (typeof module !== 'undefined') {
  module.exports = unusedKeyframeRemover
}
