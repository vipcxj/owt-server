#!/usr/bin/env node
// Copyright (C) <2019> Intel Corporation
//
// SPDX-License-Identifier: Apache-2.0

const path = require('path');
const fs = require('fs');

const cipher = require('./cipher');
const authStore = path.resolve(__dirname, cipher.astore);

const saveAuth = (obj, filename) => new Promise((resolve, reject) => {
  const lock = (obj) => {
    cipher.lock(cipher.k, obj, filename, (err) => {
      if (!err) {
        process.stdout.write(err || 'done!\n');
        resolve();
      } else {
        reject(err);
      }
    });
  };
  if (fs.existsSync(filename)) {
    cipher.unlock(cipher.k, filename, (err, res) => {
      if (!err) {
        res = Object.assign(res, obj);
        lock(res);
      } else {
        reject(err);
      }
    });
  } else {
    lock(obj);
  }
});

const updateRabbit = (cleanup) => new Promise((resolve, reject) => {
  if (cleanup) {
    console.log('Cleanup RabbitMQ account...');
    saveAuth({rabbit: null}, authStore)
      .then(resolve)
      .catch(reject);
    return;
  }
  saveAuth({ rabbit: { username: options.rabbitmqUsername, password: options.rabbitmqPassowrd } }, authStore)
    .then(resolve)
    .catch(reject);
});

const updateMongo = (cleanup) => new Promise((resolve, reject) => {
  if (cleanup) {
    console.log('Cleanup MongoDB account...');
    saveAuth({mongo: null}, authStore)
      .then(resolve)
      .catch(reject);
    return;
  }

  saveAuth({ mongo: { username: options.mongodbUsername, password: options.mongodbPassowrd } }, authStore)
    .then(resolve)
    .catch(reject);
});

const updateInternal = (cleanup) => new Promise((resolve, reject) => {
  if (cleanup) {
    console.log('Cleanup internal passphrase...');
    saveAuth({internalPass: null}, authStore)
      .then(resolve)
      .catch(reject);
    return;
  }

  saveAuth({ internalPass: options.internalPassphrase }, authStore)
    .then(resolve)
    .catch(reject);
});

const updateGKeyPass = (cleanup) => new Promise((resolve, reject) => {
  if (cleanup) {
    console.log('Cleanup gRPC TLS key...');
    saveAuth({grpc: null}, authStore)
      .then(resolve)
      .catch(reject);
    return;
  }
  saveAuth({ grpc: { serverPass: options.grpcServerPass, clientPass: options.grpcClientPass } }, authStore)
    .then(resolve)
    .catch(reject);
});

const generateServiceProtectionKey = (cleanup) => new Promise((resolve, reject) => {
  if (cleanup) {
    console.log('Cleanup service protection key...');
    saveAuth({spk: null}, authStore)
      .then(resolve)
      .catch(reject);
    return;
  }
  const spk = require('crypto').randomBytes(64).toString('hex');
  saveAuth({spk: spk}, authStore)
    .then(() => {
      console.log(`Service protection key generated: ${spk}`);
      resolve();
    })
    .catch(reject);
});

const getArg = (target, i, argname) => {
    pos = process.argv.indexOf(target);
    if (pos == -1) {
        console.error('No such target: ' + target + ".")
        process.exit(1);
    }
    if (pos + i + 1 >= process.argv.length) {
        console.error('No ' + argname + ' specified.')
        process.exit(1);
    }
    arg = process.argv[pos + i + 1]
    if (arg.startsWith('--')) {
        console.error('No ' + argname + ' specified.')
        process.exit(1);
    }
    return arg
}

const printUsage = () => {
  let usage = 'Usage:\n';
  usage += '  --rabbitmq  Update RabbitMQ account\n';
  usage += '  --mongodb   Update MongoDB account\n';
  usage += '  --internal  Update internal TLS key passphrase\n';
  usage += '  --grpc      Update gRPC TLS key passphrase\n';
  usage += '  --spk       Generate service protection key\n';
  usage += '  --cleanup   Clean up selected credentials\n';
  usage += '  --authstore Print the file name of the auth store\n';
  console.log(usage);
}
const options = {};
const parseArgs = () => {
  if (process.argv.length == 3 && process.argv[2] === '--help') {
    printUsage();
    process.exit(0);
  }
  if (process.argv.length == 3 && process.argv[2] === '--authstore') {
    console.info(cipher.astore);
    process.exit(0);
  }
  if (process.argv.includes('--rabbitmq')) {
    options.rabbit = true;
  }
  if (process.argv.includes('--mongodb')) {
    options.mongo = true;
  }
  if (process.argv.includes('--internal')) {
    options.internal = true;
  }
  if (process.argv.includes('--grpc')) {
    options.grpc = true;
  }
  if (process.argv.includes('--spk')) {
    options.spk = true;
  }
  if (process.argv.includes('--cleanup')) {
    options.cleanup = true;
  }
  let selectedUpdate = Object.keys(options).length;
  if (options.cleanup) {
    selectedUpdate -= 1;
  }
  if (selectedUpdate === 0) {
    console.error('At least select one target, use --help to see more info.');
    process.exit(1);
  }
  if (options.rabbit) {
    if (process.argv.includes('--help')) {
        let usage = 'Usage:\n';
        usage += '  --rabbitmq username password  (Update RabbitMQ account)\n';
        console.log(usage);
        process.exit(0);
    }
    options.rabbitmqUsername = getArg('--rabbitmq', 0, 'username');
    options.rabbitmqPassowrd = getArg('--rabbitmq', 1, 'passowrd');
  }
  if (options.mongo) {
    if (process.argv.includes('--help')) {
        let usage = 'Usage:\n';
        usage += '  --mongodb username password  (Update MongoDB account)\n';
        console.log(usage);
        process.exit(0);
    }
    options.mongodbUsername = getArg('--mongodb', 0, 'username');
    options.mongodbPassowrd = getArg('--mongodb', 1, 'passowrd');
  }
  if (options.internal) {
    if (process.argv.includes('--help')) {
        let usage = 'Usage:\n';
        usage += '  --internal passphrase  (Update internal TLS key passphrase)\n';
        console.log(usage);
        process.exit(0);
    }
    options.internalPassphrase = getArg('--internal', 0, 'passphrase');
  }
  if (options.grpc) {
    if (process.argv.includes('--help')) {
        let usage = 'Usage:\n';
        usage += '  --grpc serverpass clientpass  (Update gRPC TLS key passphrase)\n';
        console.log(usage);
        process.exit(0);
    }
    options.grpcServerPass = getArg('--grpc', 0, 'server pass');
    options.grpcClientPass = getArg('--grpc', 1, 'client pass');
  }
  if (options.spk) {
    if (process.argv.includes('--help')) {
        let usage = 'Usage:\n';
        usage += '  --spk (Generate service protection key)\n';
        console.log(usage);
        process.exit(0);
    }
  }
  return Promise.resolve();
}

parseArgs()
  .then(() => {
    if (options.rabbit) {
      return updateRabbit(options.cleanup);
    }
  })
  .then(() => {
    if (options.mongo) {
      return updateMongo(options.cleanup);
    }
  })
  .then(() => {
    if (options.internal) {
      return updateInternal(options.cleanup);
    }
  })
  .then(() => {
    if (options.grpc) {
      return updateGKeyPass(options.cleanup);
    }
  })
  .then(() => {
    if (options.spk) {
      return generateServiceProtectionKey(options.cleanup);
    }
  })
