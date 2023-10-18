'use strict';

(function () {
  if (process.argv.length !== 3) {
    console.error('Expected one and only one argument for password!');
        process.exit(1);
  }
  var cipher = require('./cipher');
  var dirName = !process.pkg ? __dirname : require('path').dirname(process.execPath);
  var keystore = require('path').resolve(dirName, 'cert/.woogeen.keystore');
  var collection;
  cipher.unlock(cipher.k, keystore, function cb(err, obj) {
    if (err || typeof collection !== 'object') {
      collection = {};
    } else {
      collection = obj;
    }
    collection['sample'] = process.argv[2];
    cipher.lock(cipher.k, collection, keystore, function cb(err) {
      console.log(err || 'done!');
      console.log('Testing keystore ...');
      cipher.unlock(cipher.k, keystore, function cb1(err, obj) {
        if (err || typeof collection !== 'object' || collection['sample'] !== process.argv[2]) {
          console.log('Failed.');
          process.exit(1);
        } else {
          console.log('Success.');
        }
      });
    });
  });
})();
