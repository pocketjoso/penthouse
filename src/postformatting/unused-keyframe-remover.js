import debug from 'debug'
import csstree from 'css-tree'

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

  // remove all unknown keyframes
  csstree.walk(ast, {
    visit: 'Atrule',
    enter: (atrule, item, list) => {
      if (csstree.keyword(atrule.name).basename === 'keyframes') {
        const keyframeName = csstree.generate(atrule.prelude)
        if (!usedKeyFrames.has(keyframeName)) {
          debuglog('drop non critical keyframe: ' + keyframeName)
          list.remove(item)
        }
      }
    }
  })
}
