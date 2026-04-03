import { spawn } from 'node:child_process'
import process from 'node:process'

const CHILDREN = []
let isShuttingDown = false

function commandForCurrentPlatform() {
  return process.platform === 'win32'
    ? { command: 'npm.cmd', shell: false }
    : { command: 'npm', shell: false }
}

function prefixOutput(stream, prefix, target) {
  let buffer = ''
  stream.setEncoding('utf8')
  stream.on('data', (chunk) => {
    buffer += chunk
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      target.write(`[${prefix}] ${line}\n`)
    }
  })
  stream.on('end', () => {
    if (buffer) {
      target.write(`[${prefix}] ${buffer}\n`)
      buffer = ''
    }
  })
}

function terminateChildren(signal = 'SIGTERM') {
  if (isShuttingDown) {
    return
  }
  isShuttingDown = true

  for (const child of CHILDREN) {
    if (!child.killed) {
      child.kill(signal)
    }
  }
}

function runNamedProcess(name, args) {
  const { command, shell } = commandForCurrentPlatform()
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    shell,
    stdio: ['inherit', 'pipe', 'pipe'],
  })

  prefixOutput(child.stdout, name, process.stdout)
  prefixOutput(child.stderr, name, process.stderr)

  child.on('exit', (code, signal) => {
    if (!isShuttingDown) {
      const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`
      process.stderr.write(`[${name}] exited with ${reason}\n`)
      terminateChildren()
      process.exitCode = typeof code === 'number' ? code : 1
    }
  })

  CHILDREN.push(child)
  return child
}

runNamedProcess('web', ['run', 'dev'])

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    terminateChildren(signal)
  })
}

process.on('exit', () => {
  terminateChildren('SIGTERM')
})
