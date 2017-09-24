import {spawn} from 'child_process'

export default function chromeProcessesRunning () {
  return new Promise(resolve => {
    const ps = spawn('ps', ['aux'])
    //  bit fragile to match across platforms..
    const grep = spawn('egrep', ['-i', '/[c]hrom(e|ium) --(render|disable-background)'])
    ps.stdout.on('data', data => grep.stdin.write(data))
    ps.on('close', () => grep.stdin.end())
    let chromiumStillRunning = false
    grep.stdout.on('data', (data) => {
      const result = data.toString()
      if (result.length) {
        chromiumStillRunning = result
      }
    })
    grep.on('close', () => {
      resolve(chromiumStillRunning)
    })
  })
}
