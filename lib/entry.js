'use strict'

const { findPackageInYarnLock, findEntryInPackageLock } = require('../util/traverse')
const { npmRequires } = require('./dependencies')
const { parse } = require('url')

const GITHUB_REGEX = /^\/([^/]+\/[^/]+)\/tar\.gz\/([0-9a-f]+)$/

function yarnToNpmResolved (version, yarnResolved) {
  const resolvedParts = parse(yarnResolved)
  if (resolvedParts.hostname === 'codeload.github.com') {
    const version = resolvedParts.pathname.replace(GITHUB_REGEX, 'github:$1#$2')
    return { version }
  }
  const resolved = yarnResolved.replace(/#.*$/, '')
  const hexChecksum = yarnResolved.replace(/^.*#/, '')
  const integrity = 'sha1-' + Buffer.from(hexChecksum, 'hex').toString('base64')
  return { version, resolved, integrity }
}

function npmToYarnResolved (resolved, integrity) {
  let result = resolved

  if (integrity) {
    const hexChecksum = /^sha1-/.test(integrity)
      ? Buffer.from(integrity.replace(/^sha1-/, ''), 'base64').toString('hex')
      : Buffer.from(integrity.replace(/^sha512-/, ''), 'base64').toString('hex')
      // see caveats in README
    result = `${result}#${hexChecksum}`
  }

  const resolvedParts = parse(result)

  if (resolvedParts.protocol === 'github:') {
    result = result.replace(/^github:/, 'https://github.com/')
  }

  return result
}

module.exports = {
  npmEntry (nodeModulesTree, yarnObject, mPath) {
    const { name, version, dependencies } = nodeModulesTree[mPath]
    const entryInYarnFile = findPackageInYarnLock(name, version, yarnObject)
    if (!entryInYarnFile) return null // likely a bundled dependency
    const yarnResolved = entryInYarnFile.resolved
    const entry = yarnToNpmResolved(version, yarnResolved)
    if (dependencies && Object.keys(dependencies).length > 0) {
      entry.requires = npmRequires(dependencies, yarnObject)
    }
    return entry
  },
  yarnEntry (entry, allDeps, flattenedPackageLock, tree) {
    const { name, version } = entry
    const entryInNpmFile = findEntryInPackageLock(entry, flattenedPackageLock)
    if (!entryInNpmFile) return null // likely a bundled dependency
    const {
      resolved,
      integrity
    } = entryInNpmFile
    const { dependencies, optionalDependencies } = allDeps
    const yarnStyleResolved = npmToYarnResolved(resolved || version, integrity)
    const existingPackage = tree[name] || {}
    const existingPackageVersion = tree[name] && tree[name][version]
      ? tree[name][version]
      : {}
    const hasDeps = dependencies && Object.keys(dependencies).length > 0
    const hasOptionalDeps = optionalDependencies &&
      Object.keys(optionalDependencies).length > 0
    return Object.assign({}, existingPackage, {
      [version]: Object.assign({}, existingPackageVersion, {
        resolved: yarnStyleResolved
      },
      hasDeps ? { dependencies } : {},
      hasOptionalDeps ? { optionalDependencies } : {}
      )
    })
  }
}
