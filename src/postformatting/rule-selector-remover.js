import csstree from 'css-tree'

export default function ruleSelectorRemover (ast, selectorNodeMap, selectors) {
  selectors = new Set(selectors)

  csstree.walk(ast, {
    visit: 'Rule',
    enter: function (rule, item, list) {
      // remove a rule with bad selector
      if (rule.prelude.type !== 'SelectorList') {
        list.remove(item)
        return
      }

      // check what, if any selectors are found above fold
      // filter out the ones that are not critical
      rule.prelude.children = rule.prelude.children.filter(
        (selectorNode, item, list) => {
          let decision = selectorNodeMap.get(selectorNode)
          if (typeof decision === 'string') {
            decision = selectors.has(decision)
          }
          return typeof decision !== 'boolean' || decision
        }
      )

      // NOTE: isCssSelectorRuleCritical mutates the rule
      if (rule.prelude.children.isEmpty()) {
        list.remove(item)
      }
    }
  })
}
