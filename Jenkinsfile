#! groovy
library 'pipeline-library'

timestamps {
  def isMaster = false
  def packageVersion

  node('osx || linux') {
    stage('Checkout') {
      // checkout scm
      // Hack for JENKINS-37658 - see https://support.cloudbees.com/hc/en-us/articles/226122247-How-to-Customize-Checkout-for-Pipeline-Multibranch
      // do a git clean before checking out
      checkout([
        $class: 'GitSCM',
        branches: scm.branches,
        extensions: scm.extensions + [[$class: 'CleanBeforeCheckout']],
        userRemoteConfigs: scm.userRemoteConfigs
      ])

      isMaster = env.BRANCH_NAME.equals('master')
      packageVersion = jsonParse(readFile('package.json'))['version']
      currentBuild.displayName = "#${packageVersion}-${currentBuild.number}"
    }

    nodejs(nodeJSInstallationName: 'node 8.2.1') {
      ansiColor('xterm') {
        stage('Install') {
          timeout(15) {
            // Install yarn if not installed
            if (sh(returnStatus: true, script: 'where yarn') != 0) {
              sh 'npm install -g yarn'
            }
            sh 'yarn install'
            fingerprint 'package.json'
          } // timeout
        } // stage

        stage('Check') {
          // TODO export the results to a file we can archive and/or parse with a custom warnings parser? We have parsers for NSP/Retirejs
          sh 'node ./node_modules/.bin/gulp check' // Use --json --silent to get json output, but then we still need to extract the nsp stuff from it
        }

        stage('Test') {
          try {
            sh 'node ./node_modules/.bin/gulp coverage'
          } finally {
            // record results even if tests/coverage 'fails'
            junit 'bootstrap/junit.xml,packages/*/junit.xml'
            step([$class: 'CoberturaPublisher', autoUpdateHealth: false, autoUpdateStability: false, coberturaReportFile: 'coverage/cobertura-coverage.xml', failUnhealthy: false, failUnstable: false, maxNumberOfBuilds: 0, onlyStable: false, sourceEncoding: 'ASCII', zoomCoverageChart: false])
          }
        }

        // stage('Package') {
        //  sh 'node ./node_modules/.bin/gulp package'
        //  archiveArtifacts 'dist/*.tgz'
        // } // stage

        // stage('Publish') {
        //   // TODO tag in git and push to repo?
        //   // TODO publish to npm?
        // }

      } // ansiColor
    } // nodejs
  } // node
} // timestamps
