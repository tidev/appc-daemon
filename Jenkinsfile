#! groovy
library 'pipeline-library'

def platforms = [
  // 'Linux': 'linux',
  'macOS': 'osx' // ,
  // 'Windows': 'windows'
]

def nodeVersions = [
  // '8.16.0',
  '10.16.3',
  '12.10.0'
]

timestamps {
  try {
    node('osx && git') {
      nodejs(nodeJSInstallationName: "node 10.16.3") {
        ansiColor('xterm') {
          timeout(60) {
            ensureYarn('latest')

            stage('Checkout') {
              checkout([
                $class: 'GitSCM',
                branches: scm.branches,
                extensions: scm.extensions + [
                  // check out to local branch so greenkeeper-lockfile-upload can work!
                  [$class: 'LocalBranch', localBranch: '**'],
                  // do a git clean -fdx first to wipe any local changes during last build
                  [$class: 'CleanBeforeCheckout'],
                  // If there are submodules recursively update them (and use the credentials from the main repo clone/checkout)
                  [$class: 'SubmoduleOption', disableSubmodules: false, parentCredentials: true, recursiveSubmodules: true, reference: '', trackingSubmodules: false]
                ],
                userRemoteConfigs: scm.userRemoteConfigs
              ])

              def packageJSON = jsonParse(readFile('packages/appcd/package.json'))
              currentBuild.displayName = "#${packageJSON['version']}-${currentBuild.number}"

              stash allowEmpty: true, name: 'sources', useDefaultExcludes: false
            }

            stage('Security') {
              sh 'yarn install --production'
              sh 'yarn global add retire'
              sh 'retire --exitwith 0'
              step([$class: 'WarningsPublisher', canComputeNew: false, canResolveRelativePaths: false, consoleParsers: [[parserName: 'Node Security Project Vulnerabilities'], [parserName: 'RetireJS']], defaultEncoding: '', excludePattern: '', healthy: '', includePattern: '', messagesPattern: '', unHealthy: ''])
            }

            stage('Check') {
              sh 'yarn run gulp check'
            }
          } // timeout
        } // ansiColor
      } // nodejs
    } // node

    stage('Integration Tests') {
      def matrix = [ failFast: false ]
      platforms.each { name, platform ->
        matrix[name] = runPlatform(platform)
      }

      parallel matrix
    }
  } finally {
    deleteDir() // always wipe to avoid errors when unstashing in the future
  }
}

def runPlatform(platform) {
  def matrix = [ failFast: false ]
  nodeVersions.each { nodeVersion ->
    matrix["Node.js ${nodeVersion}"] = runNode(nodeVersion)
  }

  return {
    node("${platform} && git") {
      parallel matrix
    }
  }
}

def runNode(nodeVersion) {
  return {
    try {
      unstash 'sources'
      ensureYarn('latest')

      nodejs(nodeJSInstallationName: "node ${nodeVersion}") {
        ansiColor('xterm') {
          timeout(60) {
            stage('Install') {
              sh 'yarn'
            }

            stage('Test') {
              try {
                // set special env var so we don't try test requiring sudo prompt
                withEnv(['JENKINS=true']) {
                  sh 'yarn test'
                }
              } finally {
                // record results even if tests/coverage 'fails'
                if (fileExists('junit.xml')) {
                  junit 'junit.xml'
                }
                if (fileExists('coverage/cobertura-coverage.xml')) {
                  step([$class: 'CoberturaPublisher', autoUpdateHealth: false, autoUpdateStability: false, coberturaReportFile: 'coverage/cobertura-coverage.xml', failUnhealthy: false, failUnstable: false, maxNumberOfBuilds: 0, onlyStable: false, sourceEncoding: 'ASCII', zoomCoverageChart: false])
                }
              } // try
            } // stage 'Test'
          } // timeout
        } // ansiColor
      } // nodejs
    } finally {
      deleteDir() // always wipe to avoid errors when unstashing in the future
    }
  } // node
}
