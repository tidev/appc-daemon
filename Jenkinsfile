#! groovy
library 'pipeline-library@runNPMPackage'

runNPMPackage {
  defaultNodeJSVersion = '10.19.0' // keep this in sync with appcd-core Node.js version!
  nodeVersions = [ '10.19.0', '12.16.1', '13.11.0' ]
  packageJsonPath = 'packages/appcd/package.json'
  publish = false
  securityCommands = [ 'yarn run gulp check' ]
  successThreshold = 1
  useYarn = true
}
