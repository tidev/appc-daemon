#! groovy
library 'pipeline-library@runNPMPackage'

runNPMPackage {
  nodeVersions = [ '10.19.0', '12.16.1', '13.11.0' ]
  packageJsonPath = 'packages/appcd/package.json'
  publish = false
  securityCommands = [ 'yarn run gulp check' ]
  successThreshold = 80
  useYarn = true
}
