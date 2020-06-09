#! groovy
library 'pipeline-library'

runNPMPackage {
  defaultNodeJSVersion = '12.18.0' // keep this in sync with appcd-core Node.js version!
  nodeVersions = [ '14.4.0' ] // [ '10.19.0', '12.18.0', '14.4.0' ]
  platforms = [ 'osx' ]
  packageJsonPath = 'packages/appcd/package.json'
  publish = false
  securityCommands = [ 'yarn run gulp check' ]
  successThreshold = 50 // require only 50% of test platforms to succeed
  useYarn = true
}
