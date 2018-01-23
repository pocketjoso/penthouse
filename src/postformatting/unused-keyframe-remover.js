import csstree from 'css-tree'
import debug from 'debug'

const debuglog = debug('penthouse:css-cleanup:unused-keyframe-remover')

function getAllKeyframes (ast) {
  return new Set(
    csstree.lexer.findAllFragments(ast, 'Type', 'keyframes-name').map(entry => {
      const keyframeName = csstree.generate(entry.nodes.first())
      debuglog('found used keyframe animation: ' + keyframeName)
      return keyframeName
    })
  )
}

export default function unusedKeyframeRemover (ast) {
  debuglog('getAllAnimationKeyframes')
  const usedKeyFrames = getAllKeyframes(ast)
  debuglog(
    'getAllAnimationKeyframes AFTER, usedKeyFrames: ' + usedKeyFrames.size
  )

  // remove all unused keyframes
  csstree.walk(ast, {
    visit: 'Atrule',
    enter: (atrule, item, list) => {
      const keyword = csstree.keyword(atrule.name)

      if (keyword.basename === 'keyframes') {
        const keyframeName = csstree.generate(atrule.prelude)

        if (!usedKeyFrames.has(keyframeName)) {
          debuglog(`drop unused @${keyword.name}: ${keyframeName}`)
          list.remove(item)
        }
      }
    }
  })
}
