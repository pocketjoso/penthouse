import csstree from 'css-tree'

const unwantedPropertiesRemover = function (ast, propertiesToRemove) {
  const propertiesToRemoveRegexes = propertiesToRemove.map(
    text => new RegExp(text)
  )
  const shouldRemove = declaration =>
    propertiesToRemoveRegexes.some(toRemovePattern =>
      toRemovePattern.test(declaration.property)
    )

  csstree.walk(ast, {
    visit: 'Declaration',
    enter: (declaration, item, list) => {
      if (shouldRemove(declaration)) {
        list.remove(item)
      }
    }
  })

  // remove empty rules
  csstree.walk(ast, {
    visit: 'Rule',
    leave: (rule, item, list) => {
      if (rule.block.children.isEmpty()) {
        list.remove(item)
      }
    }
  })

  // remove empty at-rules
  csstree.walk(ast, {
    visit: 'Atrule',
    leave: (atrule, item, list) => {
      if (atrule.block && atrule.block.children.isEmpty()) {
        list.remove(item)
      }
    }
  })

  return ast
}

module.exports = unwantedPropertiesRemover
