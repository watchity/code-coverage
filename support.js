/// <reference types="cypress" />
// @ts-check

const dayjs = require('dayjs')
var duration = require('dayjs/plugin/duration')
const { filterSpecsFromCoverage } = require('./support-utils')

dayjs.extend(duration)

/**
 * Sends collected code coverage object to the backend code
 * via "cy.task".
 */
const sendCoverage = (coverage, pathname = '/') => {
  logMessage(`Saving code coverage for **${pathname}**`)

  // const withoutSpecs = filterSpecsFromCoverage(coverage)
  // const appCoverageOnly = filterSupportFilesFromCoverage(withoutSpecs)

  // stringify coverage object for speed
  cy.task('combineCoverage', JSON.stringify(coverage), {
    log: true,
  })
}

/**
 * Consistently logs the given string to the Command Log
 * so the user knows the log message is coming from this plugin.
 * @param {string} s Message to log.
 */
const logMessage = s => {
  cy.log(`${s} \`[@cypress/code-coverage]\``)
}

/**
 * Removes support file from the coverage object.
 * If there are more files loaded from support folder, also removes them
 */
const filterSupportFilesFromCoverage = totalCoverage => {
  const integrationFolder = Cypress.config('integrationFolder')
  const supportFile = Cypress.config('supportFile')

  /** @type {string} Cypress run-time config has the support folder string */
  // @ts-ignore
  const supportFolder = Cypress.config('supportFolder')

  const isSupportFile = filename => filename === supportFile

  let coverage = Cypress._.omitBy(totalCoverage, (fileCoverage, filename) =>
    isSupportFile(filename)
  )

  // check the edge case
  //   if we have files from support folder AND the support folder is not same
  //   as the integration, or its prefix (this might remove all app source files)
  //   then remove all files from the support folder
  if (!integrationFolder.startsWith(supportFolder)) {
    // remove all covered files from support folder
    coverage = Cypress._.omitBy(totalCoverage, (fileCoverage, filename) =>
      filename.startsWith(supportFolder)
    )
  }
  return coverage
}

const registerHooks = () => {
  let windowCoverageObjects

  const hasE2ECoverage = () => Boolean(windowCoverageObjects.length)

  // @ts-ignore
  const hasUnitTestCoverage = () => Boolean(window.__coverage__)

  before(() => {
    // we need to reset the coverage when running
    // in the interactive mode, otherwise the counters will
    // keep increasing every time we rerun the tests
    const logInstance = Cypress.log({
      name: 'Coverage',
      message: ['Reset [@cypress/code-coverage]']
    })

    cy.task(
      'resetCoverage',
      {
        // @ts-ignore
        isInteractive: Cypress.config('isInteractive')
      },
      { log: true }
    ).then(() => {
      logInstance.end()
    })
  })

  beforeEach(() => {
    // each object will have the coverage and url pathname
    // to let the user know the coverage has been collected
    windowCoverageObjects = []

    const saveCoverageObject = win => {
      // if application code has been instrumented, the app iframe "window" has an object
      const applicationSourceCoverage = win.__coverage__
      if (!applicationSourceCoverage) {
        return
      }

      if (
        Cypress._.find(windowCoverageObjects, {
          coverage: applicationSourceCoverage
        })
      ) {
        // this application code coverage object is already known
        // which can happen when combining `window:load` and `before` callbacks
        return
      }

      windowCoverageObjects.push({
        coverage: applicationSourceCoverage,
        pathname: win.location.pathname
      })
    }

    // save reference to coverage for each app window loaded in the test
    cy.on('window:load', saveCoverageObject)

    // save reference if visiting a page inside a before() hook
    cy.window({ log: true }).then(saveCoverageObject)
  })

  afterEach(() => {
    // save coverage after the test
    // because now the window coverage objects have been updated
    console.log('qrqrqr xxx1', new Date().toISOString())
    windowCoverageObjects.forEach(cover => {
      console.log('qrqrqr xxx2', new Date().toISOString())
      sendCoverage(cover.coverage, cover.pathname)
      console.log('qrqrqr xxx3', new Date().toISOString())
    })

    console.log('qrqrqr xxx4', new Date().toISOString())
    if (!hasE2ECoverage()) {
      console.log('qrqrqr xxx5', new Date().toISOString())
      if (hasUnitTestCoverage()) {
        console.log('qrqrqr xxx6', new Date().toISOString())
        logMessage(`👉 Only found unit test code coverage.`)
        console.log('qrqrqr xxx7', new Date().toISOString())
      } else {
        console.log('qrqrqr xxx8', new Date().toISOString())
        const expectBackendCoverageOnly = Cypress._.get(
          Cypress.env('codeCoverage'),
          'expectBackendCoverageOnly',
          false
        )
        console.log('qrqrqr xxx9', new Date().toISOString())
        if (!expectBackendCoverageOnly) {
          console.log('qrqrqr xxx10', new Date().toISOString())
          logMessage(`
            ⚠️ Could not find any coverage information in your application
            by looking at the window coverage object.
            Did you forget to instrument your application?
            See [code-coverage#instrument-your-application](https://github.com/cypress-io/code-coverage#instrument-your-application)
          `)
          console.log('qrqrqr xxx11', new Date().toISOString())
        }
      }
    }
  })

  after(function collectBackendCoverage() {
    // I wish I could fail the tests if there is no code coverage information
    // but throwing an error here does not fail the test run due to
    // https://github.com/cypress-io/cypress/issues/2296

    // there might be server-side code coverage information
    // we should grab it once after all tests finish
    // @ts-ignore
    console.log('qrqrqr yyy1', new Date().toISOString())
    const baseUrl = Cypress.config('baseUrl') || cy.state('window').origin
    console.log('qrqrqr yyy2', new Date().toISOString())
    // @ts-ignore
    const runningEndToEndTests = baseUrl !== Cypress.config('proxyUrl')
    console.log('qrqrqr yyy3', new Date().toISOString())
    const specType = Cypress._.get(Cypress.spec, 'specType', 'integration')
    console.log('qrqrqr yyy4', new Date().toISOString())
    const isIntegrationSpec = specType === 'integration'
    console.log('qrqrqr yyy5', new Date().toISOString())

    if (runningEndToEndTests && isIntegrationSpec) {
      console.log('qrqrqr yyy6', new Date().toISOString())
      // we can only request server-side code coverage
      // if we are running end-to-end tests,
      // otherwise where do we send the request?
      const url = Cypress._.get(
        Cypress.env('codeCoverage'),
        'url',
        '/__coverage__'
      )
      console.log('qrqrqr yyy7', new Date().toISOString())
      cy.request({
        url,
        log: true,
        failOnStatusCode: false
      })
        .then(r => {
          console.log('qrqrqr yyy8', new Date().toISOString())
          return Cypress._.get(r, 'body.coverage', null)
        })
        .then(coverage => {
          console.log('qrqrqr yyy9', new Date().toISOString())
          if (!coverage) {
            // we did not get code coverage - this is the
            // original failed request
            console.log('qrqrqr yyy10', new Date().toISOString())
            const expectBackendCoverageOnly = Cypress._.get(
              Cypress.env('codeCoverage'),
              'expectBackendCoverageOnly',
              false
            )
            console.log('qrqrqr yyy11', new Date().toISOString())
            if (expectBackendCoverageOnly) {
              console.log('qrqrqr yyy12', new Date().toISOString())
              throw new Error(
                `Expected to collect backend code coverage from ${url}`
              )
            } else {
              console.log('qrqrqr yyy13', new Date().toISOString())
              // we did not really expect to collect the backend code coverage
              return
            }
          }
          console.log('qrqrqr yyy14', new Date().toISOString())
          sendCoverage(coverage, 'backend')
          console.log('qrqrqr yyy15', new Date().toISOString())
        })
    }
  })

  after(function mergeUnitTestCoverage() {
    console.log('qrqrqr zzz1', new Date().toISOString())
    // collect and merge frontend coverage

    // if spec bundle has been instrumented (using Cypress preprocessor)
    // then we will have unit test coverage
    // NOTE: spec iframe is NOT reset between the tests, so we can grab
    // the coverage information only once after all tests have finished
    // @ts-ignore
    const unitTestCoverage = window.__coverage__
    console.log('qrqrqr zzz2', new Date().toISOString())
    if (unitTestCoverage) {
      console.log('qrqrqr zzz3', new Date().toISOString())
      sendCoverage(unitTestCoverage, 'unit')
      console.log('qrqrqr zzz4', new Date().toISOString())
    }
  })

  after(function generateReport() {
    console.log('qrqrqr ooo1', new Date().toISOString())
    // when all tests finish, lets generate the coverage report
    const logInstance = Cypress.log({
      name: 'Coverage',
      message: ['Generating report [@cypress/code-coverage]']
    })
    console.log('qrqrqr ooo2', new Date().toISOString())
    cy.task('coverageReport', null, {
      log: true,
      timeout: dayjs.duration(3, 'minutes').asMilliseconds(),
    }).then(coverageReportFolder => {
      console.log('qrqrqr ooo3', new Date().toISOString())
      logInstance.set('consoleProps', () => ({
        'coverage report folder': coverageReportFolder
      }))
      console.log('qrqrqr ooo4', new Date().toISOString())
      logInstance.end()
      console.log('qrqrqr ooo5', new Date().toISOString())
      return coverageReportFolder
    })
  })
}

// to disable code coverage commands and save time
// pass environment variable coverage=false
//  cypress run --env coverage=false
// or
//  CYPRESS_coverage=false cypress run
// see https://on.cypress.io/environment-variables

// to avoid "coverage" env variable being case-sensitive, convert to lowercase
const cyEnvs = Cypress._.mapKeys(Cypress.env(), (value, key) =>
  key.toLowerCase()
)

if (cyEnvs.coverage === false) {
  console.log('Skipping code coverage hooks')
} else if (Cypress.env('codeCoverageTasksRegistered') !== true) {
  // register a hook just to log a message
  before(() => {
    logMessage(`
      ⚠️ Code coverage tasks were not registered by the plugins file.
      See [support issue](https://github.com/cypress-io/code-coverage/issues/179)
      for possible workarounds.
    `)
  })
} else {
  registerHooks()
}
