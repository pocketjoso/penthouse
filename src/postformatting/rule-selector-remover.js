import csstree from 'css-tree'

export default function ruleSelectorRemover (ast, selectorNodeMap, selectors) {
  selectors = new Set(selectors)

  csstree.walk(ast, {
    visit: 'Rule',
    enter: function (rule, item, list) {
      // remove a rule with a bad selector
      if (rule.prelude.type !== 'SelectorList') {
        list.remove(item)
        return
      }

      // filter out non-critical selectors
      rule.prelude.children = rule.prelude.children.filter(
        (selectorNode, item, list) => {
          let decision = selectorNodeMap.get(selectorNode)
          if (typeof decision === 'string') {
            decision = selectors.has(decision)
          }
          return typeof decision !== 'boolean' || decision
        }
      )

      // remote the rule if no selector is left
      if (rule.prelude.children.isEmpty()) {
        list.remove(item)
      }
    }
  })
}
