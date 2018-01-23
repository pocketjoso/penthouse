import csstree from 'css-tree'

export default function unwantedPropertiesRemover (ast, propertiesToRemove) {
  const propertiesToRemoveRegexes = propertiesToRemove.map(
    text => new RegExp(text)
  )

  csstree.walk(ast, {
    visit: 'Declaration',
    enter: (declaration, item, list) => {
      const shouldRemove = propertiesToRemoveRegexes.some(pattern =>
        pattern.test(declaration.property)
      )

      if (shouldRemove) {
        list.remove(item)
      }
    }
  })
}
