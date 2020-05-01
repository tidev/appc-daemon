#! groovy
library 'pipeline-library'

runNPMPackage {
  defaultNodeJSVersion = '12.16.2' // keep this in sync with appcd-core Node.js version!
  nodeVersions = [ '10.19.0', '12.16.2', '14.0.0' ]
  packageJsonPath = 'packages/appcd/package.json'
  publish = false
  securityCommands = [ 'yarn run gulp check' ]
  successThreshold = 50 // require only 50% of test platforms to succeed
  useYarn = true
}
