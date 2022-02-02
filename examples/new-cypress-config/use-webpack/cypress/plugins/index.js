/// <reference types="cypress" />

/**
 * @type {Cypress.PluginConfig}
 */
module.exports = (on, config) => {
  const options = {
    // use the same Webpack options to bundle spec files as your app does "normally"
    // which should instrument the spec files in this project
    webpackOptions: require('../../webpack.config'),
    watchOptions: {}
  }
  // on('file:preprocessor', webpack(options))
  on('file:preprocessor', require('cypress-istanbul/use-babelrc'))

  require('@cypress/code-coverage/task')(on, config)
  return config
}
