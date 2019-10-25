const path = require('path');

exports.main = require.main;

exports.resolved = require.resolve('fs-extra');
exports.resolvedWithOptions = require.resolve('./fixtures/require-api', {
  paths: [ path.resolve(__dirname, '..') ]
});

exports.paths = require.resolve.paths('fs-extra');
