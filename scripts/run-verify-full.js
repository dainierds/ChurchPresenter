const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const logPath = path.join(__dirname, '..', 'docs', 'verify-full-output.txt')
fs.mkdirSync(path.dirname(logPath), { recursive: true })
fs.writeFileSync(logPath, `=== ChurchPresenter verify:full Execution [${new Date().toISOString()}] ===\n\n`)

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const fullCmd = `${command} ${args.join(' ')}`
    fs.appendFileSync(logPath, `\n>>> RUNNING: ${fullCmd}\n\n`)
    console.log(`\n>>> RUNNING: ${fullCmd}\n`)

    const isWindows = process.platform === 'win32'
    const proc = spawn(command, args, {
      shell: isWindows,
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe']
    })

    proc.stdout.on('data', (data) => {
      process.stdout.write(data)
      fs.appendFileSync(logPath, data)
    })

    proc.stderr.on('data', (data) => {
      process.stderr.write(data)
      fs.appendFileSync(logPath, data)
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        fs.appendFileSync(logPath, `\n>>> FAILED with exit code: ${code}\n`)
        reject(new Error(`Command failed with code ${code}: ${fullCmd}`))
      } else {
        fs.appendFileSync(logPath, `\n>>> SUCCESS: ${fullCmd}\n`)
        resolve()
      }
    })
  })
}

async function main() {
  const steps = [
    { cmd: 'npx', args: ['tsc', '--noEmit', '-p', 'tsconfig.json'] },
    { cmd: 'npx', args: ['eslint', '.', '--ext', '.ts,.tsx'] },
    { cmd: 'node', args: ['scripts/verify-test-assertions.js'] },
    { cmd: 'npx', args: ['vitest', 'run'] },
    { cmd: 'npx', args: ['electron-vite', 'build'] },
    { cmd: 'node', args: ['scripts/run-e2e.js'] }
  ]

  for (const step of steps) {
    await runCommand(step.cmd, step.args)
  }
  console.log('\n=== VERIFY:FULL COMPLETED SUCCESSFULLY ===')
  fs.appendFileSync(logPath, '\n=== VERIFY:FULL COMPLETED SUCCESSFULLY ===\n')
}

main().catch((err) => {
  console.error('\n*** VERIFY:FULL FAILED ***\n', err)
  process.exit(1)
})
