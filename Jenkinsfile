#! groovy
library 'pipeline-library'

runNPMPackage {
  defaultNodeJSVersion = '12.16.2' // keep this in sync with appcd-core Node.js version!
  nodeVersions = [ '10.19.0', '12.16.2' ]
  packageJsonPath = 'packages/appcd/package.json'
  platforms = [ 'osx' ]
  publish = false
  securityCommands = [ 'yarn run gulp check' ]
  successThreshold = 1
  useYarn = true
}
