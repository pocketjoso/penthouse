import {spawn} from 'child_process'

function grepProcessByPattern (pattern) {
  return new Promise(resolve => {
    const ps = spawn('ps', ['aux'])
    const grep = spawn('egrep', ['-i', pattern])
    ps.stdout.on('data', data => grep.stdin.write(data))
    ps.on('close', () => grep.stdin.end())
    let matchingProcesses = false
    grep.stdout.on('data', (data) => {
      const result = data.toString()
      if (result.length) {
        matchingProcesses = result
      }
    })
    grep.on('close', () => {
      resolve(matchingProcesses)
    })
  })
}

export default function chromeProcessesRunning () {
  return Promise.all([
    // bit fragile to match across platforms..
    // also fragile relying on ~internal chrome headless process arguments to
    // distinguish between browser and page instances
    grepProcessByPattern('/[c]hrom(e|ium) --disable-background'),
    grepProcessByPattern('/[c]hrom(e|ium) --type=renderer')
  ]).then(([browsers, pages]) => {
    return {
      browsers,
      pages
    }
  })
}
