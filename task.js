// @ts-check
const istanbul = require('istanbul-lib-coverage')
const { join, resolve } = require('path')
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs')
const execa = require('execa')
const {
  showNycInfo,
  resolveRelativePaths,
  checkAllPathsNotFound,
  tryFindingLocalFiles,
  readNycOptions,
  includeAllFiles
} = require('./task-utils')
const { fixSourcePaths } = require('./support-utils')
const { removePlaceholders } = require('./common-utils')

const debug = require('debug')('code-coverage')

// these are standard folder and file names used by NYC tools
const processWorkingDirectory = process.cwd()

// there might be custom "nyc" options in the user package.json
// see https://github.com/istanbuljs/nyc#configuring-nyc
// potentially there might be "nyc" options in other configuration files
// it allows, but for now ignore those options
const pkgFilename = join(processWorkingDirectory, 'package.json')
const pkg = existsSync(pkgFilename)
  ? JSON.parse(readFileSync(pkgFilename, 'utf8'))
  : {}
const scripts = pkg.scripts || {}
const DEFAULT_CUSTOM_COVERAGE_SCRIPT_NAME = 'coverage:report'
const customNycReportScript = scripts[DEFAULT_CUSTOM_COVERAGE_SCRIPT_NAME]

const nycReportOptions = (function getNycOption() {
  // https://github.com/istanbuljs/nyc#common-configuration-options
  const nycReportOptions = readNycOptions(processWorkingDirectory)

  if (nycReportOptions.exclude && !Array.isArray(nycReportOptions.exclude)) {
    console.error('NYC options: %o', nycReportOptions)
    throw new Error('Expected "exclude" to by an array')
  }

  if (nycReportOptions['temp-dir']) {
    nycReportOptions['temp-dir'] = resolve(nycReportOptions['temp-dir'])
  } else {
    nycReportOptions['temp-dir'] = join(processWorkingDirectory, '.nyc_output')
  }

  nycReportOptions.tempDir = nycReportOptions['temp-dir']

  if (nycReportOptions['report-dir']) {
    nycReportOptions['report-dir'] = resolve(nycReportOptions['report-dir'])
  }
  // seems nyc API really is using camel cased version
  nycReportOptions.reportDir = nycReportOptions['report-dir']

  return nycReportOptions
})()

const nycFilename = join(nycReportOptions['temp-dir'], 'out.json')

function saveCoverage(coverage) {
  console.log('qrqrqr aaa');
  if (!existsSync(nycReportOptions.tempDir)) {
    console.log('qrqrqr bbb');
    mkdirSync(nycReportOptions.tempDir, { recursive: true })
    console.log('qrqrqr ccc');
    debug('created folder %s for output coverage', nycReportOptions.tempDir)
    console.log('qrqrqr ddd');
  }

  console.log('qrqrqr eee');
  writeFileSync(nycFilename, JSON.stringify(coverage, null, 2))
  console.log('qrqrqr fff');
}

function maybePrintFinalCoverageFiles(folder) {
  const jsonReportFilename = join(folder, 'coverage-final.json')
  if (!existsSync(jsonReportFilename)) {
    debug('Did not find final coverage file %s', jsonReportFilename)
    return
  }

  debug('Final coverage in %s', jsonReportFilename)
  const finalCoverage = JSON.parse(readFileSync(jsonReportFilename, 'utf8'))
  const finalCoverageKeys = Object.keys(finalCoverage)
  debug(
    'There are %d key(s) in %s',
    finalCoverageKeys.length,
    jsonReportFilename
  )

  // finalCoverageKeys.forEach((key) => {
  //   const s = finalCoverage[key].s || {}
  //   const statements = Object.keys(s)
  //   const totalStatements = statements.length
  //   let coveredStatements = 0
  //   statements.forEach((statementKey) => {
  //     if (s[statementKey]) {
  //       coveredStatements += 1
  //     }
  //   })

  //   const hasStatements = totalStatements > 0
  //   const allCovered = coveredStatements === totalStatements
  //   const coverageStatus = hasStatements ? (allCovered ? '✅' : '⚠️') : '❓'

  //   debug(
  //     '%s %s statements covered %d/%d',
  //     coverageStatus,
  //     key,
  //     coveredStatements,
  //     totalStatements
  //   )
  // })
}

const tasks = {
  /**
   * Clears accumulated code coverage information.
   *
   * Interactive mode with "cypress open"
   *    - running a single spec or "Run all specs" needs to reset coverage
   * Headless mode with "cypress run"
   *    - runs EACH spec separately, so we cannot reset the coverage
   *      or we will lose the coverage from previous specs.
   */
  resetCoverage({ isInteractive }) {
    if (isInteractive) {
      debug('reset code coverage in interactive mode')
      const coverageMap = istanbul.createCoverageMap({})
      saveCoverage(coverageMap)
    }
    /*
        Else:
          in headless mode, assume the coverage file was deleted
          before the `cypress run` command was called
          example: rm -rf .nyc_output || true
      */

    return null
  },

  /**
   * Combines coverage information from single test
   * with previously collected coverage.
   *
   * @param {string} sentCoverage Stringified coverage object sent by the test runner
   * @returns {null} Nothing is returned from this task
   */
  combineCoverage(sentCoverage) {
    console.log('qrqrqr1', new Date().toISOString());
    const coverage = JSON.parse(sentCoverage)
    console.log('qrqrqr2', new Date().toISOString());
    debug('parsed sent coverage', new Date().toISOString())

    fixSourcePaths(coverage)
    console.log('qrqrqr3', new Date().toISOString());

    const previousCoverage = existsSync(nycFilename)
      ? JSON.parse(readFileSync(nycFilename, 'utf8'))
      : {}

    console.log('qrqrqr4', new Date().toISOString());

    // previous code coverage object might have placeholder entries
    // for files that we have not seen yet,
    // but the user expects to include in the coverage report
    // the merge function messes up, so we should remove any placeholder entries
    // and re-insert them again when creating the report
    removePlaceholders(previousCoverage)

    console.log('qrqrqr5', new Date().toISOString());

    const coverageMap = istanbul.createCoverageMap(previousCoverage)
    console.log('qrqrqr6', new Date().toISOString());
    coverageMap.merge(coverage)
    console.log('qrqrqr7', new Date().toISOString());
    saveCoverage(coverageMap)
    console.log('qrqrqr8', new Date().toISOString());
    debug('wrote coverage file %s', nycFilename)

    return null
  },

  /**
   * Saves coverage information as a JSON file and calls
   * NPM script to generate HTML report
   */
  coverageReport() {
    console.log('qrqrqrA', new Date().toISOString());
    if (!existsSync(nycFilename)) {
      console.warn('Cannot find coverage file %s', nycFilename)
      console.warn('Skipping coverage report')
      return null
    }

    console.log('qrqrqrB', new Date().toISOString());
    showNycInfo(nycFilename)

    console.log('qrqrqrC', new Date().toISOString());
    const allSourceFilesMissing = checkAllPathsNotFound(nycFilename)
    console.log('qrqrqrD', new Date().toISOString());
    if (allSourceFilesMissing) {
      console.log('qrqrqrE', new Date().toISOString());
      tryFindingLocalFiles(nycFilename)
    }

    console.log('qrqrqrF', new Date().toISOString());
    resolveRelativePaths(nycFilename)

    console.log('qrqrqrG', new Date().toISOString());
    if (customNycReportScript) {
      console.log('qrqrqrH', new Date().toISOString());
      debug(
        'saving coverage report using script "%s" from package.json, command: %s',
        DEFAULT_CUSTOM_COVERAGE_SCRIPT_NAME,
        customNycReportScript
      )
      console.log('qrqrqrI', new Date().toISOString());
      debug('current working directory is %s', process.cwd())
      console.log('qrqrqrJ', new Date().toISOString());
      return execa('npm', ['run', DEFAULT_CUSTOM_COVERAGE_SCRIPT_NAME], {
        stdio: 'inherit'
      })
    }

    console.log('qrqrqrK', new Date().toISOString());
    if (nycReportOptions.all) {
      console.log('qrqrqrL', new Date().toISOString());
      debug('nyc needs to report on all included files')
      console.log('qrqrqrM', new Date().toISOString());
      includeAllFiles(nycFilename, nycReportOptions)
      console.log('qrqrqrN', new Date().toISOString());
    }

    console.log('qrqrqrO', new Date().toISOString());
    debug('calling NYC reporter with options %o', nycReportOptions)
    console.log('qrqrqrP', new Date().toISOString());
    debug('current working directory is %s', process.cwd())
    console.log('qrqrqrQ', new Date().toISOString());
    const NYC = require('nyc')
    console.log('qrqrqrR', new Date().toISOString());
    const nyc = new NYC(nycReportOptions)

    console.log('qrqrqrS', new Date().toISOString());
    const returnReportFolder = () => {
      console.log('qrqrqrT', new Date().toISOString());
      const reportFolder = nycReportOptions['report-dir']
      console.log('qrqrqrU', new Date().toISOString());
      debug(
        'after reporting, returning the report folder name %s',
        reportFolder
      )

      console.log('qrqrqrV', new Date().toISOString());
      maybePrintFinalCoverageFiles(reportFolder)

      console.log('qrqrqrW', new Date().toISOString());
      return reportFolder
    }
    console.log('qrqrqrX', new Date().toISOString());
    return nyc.report().then(returnReportFolder)
  }
}

/**
 * Registers code coverage collection and reporting tasks.
 * Sets an environment variable to tell the browser code that it can
 * send the coverage.
 * @example
  ```
    // your plugins file
    module.exports = (on, config) => {
      require('cypress/code-coverage/task')(on, config)
      // IMPORTANT to return the config object
      // with the any changed environment variables
      return config
    }
  ```
*/
function registerCodeCoverageTasks(on, config) {
  on('task', tasks)

  // set a variable to let the hooks running in the browser
  // know that they can send coverage commands
  config.env.codeCoverageTasksRegistered = true

  return config
}

module.exports = registerCodeCoverageTasks
