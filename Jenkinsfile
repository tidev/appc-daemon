#! groovy
library 'pipeline-library@archivefix'

runNPMPackage {
  defaultNodeJSVersion = '10.19.0' // keep this in sync with appcd-core Node.js version!
  nodeVersions = [ '12.16.1' ]
  packageJsonPath = 'packages/appcd/package.json'
  platforms = [ 'osx' ]
  publish = false
  securityCommands = [ 'yarn run gulp check' ]
  successThreshold = 1
  useYarn = true
}
