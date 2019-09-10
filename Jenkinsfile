#! groovy
library 'pipeline-library'

stage('Integration Tests') {
  parallel(
    'Linux': run('linux'),
    'macOS': run('osx'),
    'Windows': run('windows'),
    failFast: false
  )
}

def run(os) {
  return buildNPMPackage({
    labels = "${os} && git && npm-publish"
    projectKey = 'DAEMON'
    nodeVersion = '10.15.0'
    publish = false
    tagGit = false
    junitReportPath = 'junit.xml'
  })
}
