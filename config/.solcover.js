module.exports = {
  skipFiles: ['interfaces', './test'],
  istanbulReporter: ['html', 'lcov', 'json-summary'],
  mocha: {
    forbidOnly: true,
    grep: '@skip-on-coverage',
    invert: true,
  },
};
