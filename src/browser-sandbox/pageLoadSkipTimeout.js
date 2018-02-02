/**
 * Sandbox function to stop requests after page load timeout
 *
 * @param pageLoadSkipTimeout
 * @returns {*}
 */

export default function pruneNonCriticalSelectors ({ pageLoadSkipTimeout }) {
  console.log('debug: pageLoadSkipTimeout [' + pageLoadSkipTimeout + ']')
  try {
    return new Promise((resolve, reject) => {
      if (pageLoadSkipTimeout) {
        const start = Date.now()
        const pageLoadTimeout = function () {
          window.requestAnimationFrame(() => {
            const timePassed = Date.now() - start

            if (timePassed >= pageLoadSkipTimeout) {
              console.log(
                'debug:  pageLoadSkipTimeout - page load waiting ABORTED after ' +
                  pageLoadSkipTimeout / 1000 +
                  's. '
              )
              window.stop()
              return resolve('pageLoadSkipTimeout - in browser')
            } else {
              pageLoadTimeout()
            }
          })
        }
        pageLoadTimeout()
      }
    })
  } catch (err) {
    console.log('debug: pageLoadSkipTimeout error: ', err)
    return false
  }
}
