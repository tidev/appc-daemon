#! groovy
library 'pipeline-library'

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

parallel(
  'Linux tests': run('linux'),
  'macOS tests': run('osx'),
  'Windows tests': run('windows'),
  failFast: false
)
