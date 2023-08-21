'use strict';

(function () {
  if (process.argv.length !== 3) {
    console.error('Expected one and only one argument for password!');
        process.exit(1);
  }
  var cipher = require('./cipher');
  var dirName = !process.pkg ? __dirname : require('path').dirname(process.execPath);
  var keystore = require('path').resolve(dirName, 'cert/' + cipher.kstore);
  cipher.lockSync(cipher.k, process.argv[2], keystore);
  console.log('Testing keystore..');
  var pass = cipher.unlockSync(cipher.k, keystore);
  if (pass === process.argv[2]) {
    console.log('Success.');
  } else {
    console.log('Failed.');
    process.exit(1);
  }
})();
