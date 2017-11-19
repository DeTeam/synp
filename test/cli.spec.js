'use strict'

const fs = require('fs')
const test = require('tape')
const sinon = require('sinon')
const lockfile = require('@yarnpkg/lockfile')
const synp = require('../')

function mocks ({
  sandbox,
  packagePath,
  yarnPath,
  pLockPath,
  yarnExists,
  pLockExists,
  nodeModulesExists = true,
  yarnIsDir = false,
  nodeModulesIsFile = false
}) {
  const fsExists = sandbox.stub(fs, 'existsSync')
  const statSync = sandbox.stub(fs, 'statSync')
  sandbox.stub(fs, 'writeFileSync')
  sandbox.stub(process, 'exit')
  fsExists.withArgs(`${packagePath}/package-lock.json`).returns(pLockExists)
  fsExists.withArgs(`${yarnPath}`).returns(yarnExists)
  fsExists.withArgs(`${packagePath}/node_modules`).returns(nodeModulesExists)
  statSync.withArgs(`${packagePath}/node_modules`).returns({
    isDirectory: () => !nodeModulesIsFile
  })
  statSync.withArgs(yarnPath).returns({
    isFile: () => !yarnIsDir
  })
  statSync.withArgs(pLockPath).returns({
    isFile: () => true
  })
  sandbox.stub(synp, 'yarnToNpm')
    .returns('{"mockedResult": "mockedResult"}')
  sandbox.stub(synp, 'npmToYarn')
    .returns('{"mockedResult": "mockedResult"}')
}

function mockProgram (sourceFile) {
  return {
    sourceFile,
    outputHelp: sinon.spy()
  }
}

test('cli tool converts yarn.lock to package-lock.json', async t => {
  t.plan(4)
  const sandbox = sinon.sandbox.create()
  try {
    const packagePath = '/foo/bar/baz'
    const yarnPath = '/foo/bar/baz/yarn.lock'
    const pLockPath = '/foo/bar/baz/package-lock.json'
    const mockedProgram = mockProgram(yarnPath)
    mocks({sandbox, packagePath, yarnPath, pLockPath, pLockExists: false, yarnExists: true})
    const run = require('../cli/run')
    run(mockedProgram)
    t.ok(synp.yarnToNpm.calledWith(packagePath), 'proper converter called with proper path')
    t.equals(fs.writeFileSync.args[0][0], `${packagePath}/package-lock.json`, 'result written to proper file')
    t.deepEquals(JSON.parse(fs.writeFileSync.args[0][1]), {mockedResult: 'mockedResult'}, 'proper result written to destination file')
    t.ok(process.exit.calledOnce, 'program exited')
    sandbox.restore()
  } catch (e) {
    t.fail(e.stack)
    sandbox.restore()
    t.end()
  }
})

test('cli tool converts package-lock.json to yarn.lock', async t => {
  t.plan(4)
  const sandbox = sinon.sandbox.create()
  try {
    const packagePath = '/foo/bar/baz'
    const yarnPath = '/foo/bar/baz/yarn.lock'
    const pLockPath = '/foo/bar/baz/package-lock.json'
    const mockedProgram = mockProgram(pLockPath)
    mocks({sandbox, packagePath, yarnPath, pLockPath, pLockExists: true, yarnExists: false})
    const run = require('../cli/run')
    run(mockedProgram)
    t.ok(synp.npmToYarn.calledWith(packagePath), 'proper converter called with proper path')
    t.equals(fs.writeFileSync.args[0][0], `${packagePath}/yarn.lock`, 'result written to proper file')
    t.deepEquals(fs.writeFileSync.args[0][1], '{"mockedResult": "mockedResult"}', 'proper result written to destination file')
    t.ok(process.exit.calledOnce, 'program exited')
    sandbox.restore()
  } catch (e) {
    t.fail(e.stack)
    sandbox.restore()
    t.end()
  }
})

test('cli prints help and exits with no source file', async t => {
  t.plan(5)
  const sandbox = sinon.sandbox.create()
  try {
    const packagePath = '/foo/bar/baz'
    const yarnPath = '/foo/bar/baz/yarn.lock'
    const pLockPath = '/foo/bar/baz/package-lock.json'
    const mockedProgram = mockProgram()
    mocks({sandbox, packagePath, yarnPath, pLockPath, pLockExists: false, yarnExists: true})
    const run = require('../cli/run')
    run(mockedProgram)
    t.ok(synp.yarnToNpm.notCalled, 'yarnToNpm not called')
    t.ok(synp.npmToYarn.notCalled, 'npmToYarn not called')
    t.ok(fs.writeFileSync.notCalled, 'no file written')
    t.ok(process.exit.calledWith(2), 'program exited with proper exit status')
    t.ok(mockedProgram.outputHelp.calledOnce, 'help text printed')
    sandbox.restore()
  } catch (e) {
    t.fail(e.stack)
    sandbox.restore()
    t.end()
  }
})

test('cli prints help and exits with bad source file', async t => {
  t.plan(5)
  const sandbox = sinon.sandbox.create()
  try {
    const packagePath = '/foo/bar/baz'
    const yarnPath = '/foo/bar/baz/yarn.lock'
    const pLockPath = '/foo/bar/baz/package-lock.json'
    const mockedProgram = mockProgram('foo')
    mocks({sandbox, packagePath, yarnPath, pLockPath, pLockExists: false, yarnExists: true})
    const run = require('../cli/run')
    run(mockedProgram)
    t.ok(synp.yarnToNpm.notCalled, 'yarnToNpm not called')
    t.ok(synp.npmToYarn.notCalled, 'npmToYarn not called')
    t.ok(fs.writeFileSync.notCalled, 'no file written')
    t.ok(process.exit.calledWith(2), 'program exited with proper exit status')
    t.ok(mockedProgram.outputHelp.calledOnce, 'help text printed')
    sandbox.restore()
  } catch (e) {
    t.fail(e.stack)
    sandbox.restore()
    t.end()
  }
})

test('cli prints help and exits when source file does not exist', async t => {
  t.plan(5)
  const sandbox = sinon.sandbox.create()
  try {
    const packagePath = '/foo/bar/baz'
    const yarnPath = '/foo/bar/baz/yarn.lock'
    const pLockPath = '/foo/bar/baz/package-lock.json'
    const mockedProgram = mockProgram(yarnPath)
    mocks({sandbox, packagePath, yarnPath, pLockPath, pLockExists: false, yarnExists: true, yarnIsDir: true})
    const run = require('../cli/run')
    run(mockedProgram)
    t.ok(synp.yarnToNpm.notCalled, 'yarnToNpm not called')
    t.ok(synp.npmToYarn.notCalled, 'npmToYarn not called')
    t.ok(fs.writeFileSync.notCalled, 'no file written')
    t.ok(process.exit.calledWith(2), 'program exited with proper exit status')
    t.ok(mockedProgram.outputHelp.calledOnce, 'help text printed')
    sandbox.restore()
  } catch (e) {
    t.fail(e.stack)
    sandbox.restore()
    t.end()
  }
})

test('cli prints help and exits when destination file exists', async t => {
  t.plan(5)
  const sandbox = sinon.sandbox.create()
  try {
    const packagePath = '/foo/bar/baz'
    const yarnPath = '/foo/bar/baz/yarn.lock'
    const pLockPath = '/foo/bar/baz/package-lock.json'
    const mockedProgram = mockProgram(pLockPath)
    mocks({sandbox, packagePath, yarnPath, pLockPath, pLockExists: true, yarnExists: true})
    const run = require('../cli/run')
    run(mockedProgram)
    t.ok(synp.yarnToNpm.notCalled, 'yarnToNpm not called')
    t.ok(synp.npmToYarn.notCalled, 'npmToYarn not called')
    t.ok(fs.writeFileSync.notCalled, 'no file written')
    t.ok(process.exit.calledWith(2), 'program exited with proper exit status')
    t.ok(mockedProgram.outputHelp.calledOnce, 'help text printed')
    sandbox.restore()
  } catch (e) {
    t.fail(e.stack)
    sandbox.restore()
    t.end()
  }
})

test('cli prints help and exits when destination file exists', async t => {
  t.plan(5)
  const sandbox = sinon.sandbox.create()
  try {
    const packagePath = '/foo/bar/baz'
    const yarnPath = '/foo/bar/baz/yarn.lock'
    const pLockPath = '/foo/bar/baz/package-lock.json'
    const mockedProgram = mockProgram(pLockPath)
    mocks({sandbox, packagePath, yarnPath, pLockPath, pLockExists: true, yarnExists: false, nodeModulesIsFile: true})
    const run = require('../cli/run')
    run(mockedProgram)
    t.ok(synp.yarnToNpm.notCalled, 'yarnToNpm not called')
    t.ok(synp.npmToYarn.notCalled, 'npmToYarn not called')
    t.ok(fs.writeFileSync.notCalled, 'no file written')
    t.ok(process.exit.calledWith(2), 'program exited with proper exit status')
    t.ok(mockedProgram.outputHelp.calledOnce, 'help text printed')
    sandbox.restore()
  } catch (e) {
    t.fail(e.stack)
    sandbox.restore()
    t.end()
  }
})