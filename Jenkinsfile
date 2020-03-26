#! groovy
library 'pipeline-library@runNPMPackage'

runNPMPackage {
  defaultNodeJSVersion = "${jsonParse(readFile('packages/appcd-core/package.json'))['appcd']['node'].split('.')[0]}.x"
  nodeVersions = [ '10.19.0', '12.16.1', '13.11.0' ]
  packageJsonPath = 'packages/appcd/package.json'
  publish = false
  securityCommands = [ 'yarn run gulp check' ]
  successThreshold = 65
  useYarn = true
}
