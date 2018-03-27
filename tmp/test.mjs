import childProcess from 'child_process'

const workerToStart = 1
const url = 'https://tcms-proxy.reisen.check24-test.de/flughafen?deviceoutput=desktop&beard=reload +6s'
let counter = 0

const run = () => {
  counter++
  for (let i = 0; i < workerToStart; i++) {

    console.log("WORKER STARTED %s", counter)

    let workerProcess = childProcess.fork('./tmp/pmodule.mjs', [url, i])

    workerProcess.on('error', err => console.error("WORKER ERROR", err))

    workerProcess.on('close', (code) => {
      console.log("WORKER ENDED %s", counter)
      run()
    })
  }
}

run()