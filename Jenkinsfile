#! groovy
library 'pipeline-library'

runNPMPackage {
  defaultNodeJSVersion = '12.16.2' // keep this in sync with appcd-core Node.js version!
  nodeVersions = [ '10.19.0', '12.16.2', '13.11.0' ]
  packageJsonPath = 'packages/appcd/package.json'
  platforms = [ 'linux', 'osx' ]
  publish = false
  securityCommands = [ 'yarn run gulp check' ]
  successThreshold = 1
  testPostInstallCommands = [ 'yarn run gulp build', 'node packages/appcd/bin/appcd pm install default' ]
  useYarn = true
}
