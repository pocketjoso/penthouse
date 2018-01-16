'use strict'

import gm from 'gm'

// intention: identical
const TOLERANCE_THRESHOLD_GOOD = 0.0001

export default function (beforeImage, afterImage) {
  return new Promise(function (resolve, reject) {
    gm.compare(beforeImage, afterImage, TOLERANCE_THRESHOLD_GOOD,
      function (error, isEqual, equality) {
        if (error) {
          reject(error)
          return
        }
        if (equality <= TOLERANCE_THRESHOLD_GOOD) {
          resolve({ equality })
        } else {
          reject(new Error('Equality insuffiecient: ' + equality))
        }
      }
    )
  }).then(function (data) {
    if (data.equality !== 0) {
      return data
    }
    return new Promise(function (resolve, reject) {
      gm(afterImage).color(function (error, numberColors) {
        if (error) {
          reject(error)
          return
        }
        if (numberColors < 2) {
          reject(new Error('Image seems blank'))
        }
        resolve()
      })
    })
  })
}
