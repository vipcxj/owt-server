import mongoose from 'mongoose';
import crypto from 'crypto';
import cipher from './cipher.js';
import k8s from '@kubernetes/client-node';
import fs from 'fs/promises';

console.log('Loading k8s config ...');
const kc = new k8s.KubeConfig();
kc.loadFromCluster();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
console.log('K8s config loaded.');

let dbURL = process.env.DB_URL;
if (!dbURL) {
  throw 'DB_URL not found.';
}
dbURL = dbURL.trim()

if (!dbURL.startsWith('mongodb://') && !dbURL.startsWith('mongodb+srv://')) {
    dbURL = 'mongodb://' + dbURL;
}

if (!dbURL.includes('@')) {
    const dbUser = process.env.DB_USER;
    if (!dbUser) {
        throw `No user name found in DB_URL: ${dbURL}, and DB_USER not found.`;
    }
    const dbPass = process.env.DB_PASS;
    if (!dbPass) {
        throw `No password found in DB_URL: ${dbURL}, and DB_PASS not found.`;
    }
    if (dbURL.startsWith('mongodb://')) {
        dbURL = `mongodb://${dbUser}:${dbPass}@${dbURL}`;
    } else {
        dbURL = `mongodb+srv://${dbUser}:${dbPass}@${dbURL}`;
    }
}

const SERVICE_NAMES = ['superService'];
(process.env.SERVICES || '').split(/[,\s]+/).filter(sn => sn).forEach(sn => {
  SERVICE_NAMES.push(sn);
});
const SECRET_NAME = process.env.SECRET_NAME;
const TARGET_NAMESPACE = process.env.TARGET_NAMESPACE;
const LABELS = (process.env.SECRET_LABELS || '').split(/[,\s]+/).map(part => part.split('='));
const ANNOTATIONS = (process.env.SECRET_ANNOTATIONS || '').split(/[,\s]+/).map(part => part.split('='));

const ServiceSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    key: {
      type: String,
      required: true
    },
    encrypted: {
      type: Boolean
    },
    rooms:[
      { type: mongoose.Schema.Types.ObjectId, ref: 'Room' }
    ]
  });

const Service = mongoose.model('Service', ServiceSchema)

async function currentNamespace() {
  const namespace = await fs.readFile('/var/run/secrets/kubernetes.io/serviceaccount/namespace', { encoding: 'utf8' });
  return namespace.trim();
}

const shallowCompare = (obj1, obj2) =>
  Object.keys(obj1).length === Object.keys(obj2).length &&
  Object.keys(obj1).every(key => 
    obj2.hasOwnProperty(key) && obj1[key] === obj2[key]
  );

async function prepareDb() {
  await mongoose.connect(dbURL);
  const services = {}
  try {
    console.log('Mongodb connected.')
    await Service.createIndexes();
    for (const serviceName of SERVICE_NAMES) {
      console.log(`Init service ${serviceName}.`)
      const key = crypto.pbkdf2Sync(crypto.randomBytes(64).toString('hex'), crypto.randomBytes(32).toString('hex'), 4000, 128, 'sha256').toString('base64');
      await Service.updateOne(
          { name: serviceName },
          { $setOnInsert: { name: serviceName, key: cipher.encrypt(cipher.dk, key), encrypted: true, rooms: [], __v: 0 } },
          { upsert: true },
      ).exec();
      const service = await Service.findOne({ name: serviceName }).exec()
      if (!service) {
        throw `This is impossible! Unable to find the service ${serviceName}` 
      }
      services[serviceName] = {
        id: service._id,
        key: service.encrypted ? cipher.decrypt(cipher.dk, service.key) : service.key,
      };
    }
    console.log(`Services ${SERVICE_NAMES} inited.`)
  } finally {
    await mongoose.disconnect();
  }
  if (SECRET_NAME) {
    const services_string = JSON.stringify(services);
    const namespace = TARGET_NAMESPACE || await currentNamespace();
    console.log(`Writing services into secret ${namespace}/${SECRET_NAME}.`)
    let exist_secret = undefined;
    const labels = {};
    for (const label of LABELS) {
      if (label[0] && label[1]) {
        labels[label[0]] = label[1];
      }
    }
    const annotations = {};
    for (const annotation of ANNOTATIONS) {
      if (annotation[0] && annotation[1]) {
        annotations[annotation[0]] = annotation[1];
      }
    }
    try {
      const { body } = await k8sApi.readNamespacedSecret(SECRET_NAME, namespace);
      exist_secret = body;
    } catch (e) {
      await k8sApi.createNamespacedSecret(namespace, {
        metadata: {
          name: SECRET_NAME,
          labels,
          annotations,
        },
        type: 'Opaque',
        stringData: {
          'services.json': JSON.stringify(services),
        },
      });
      console.log(`Secret created.`);
      return;
    }
    let services_json = undefined;
    if (exist_secret.stringData) {
      services_json = exist_secret.stringData['services.json'];
    } else {
      services_json = exist_secret.data['services.json']
      if (services_json) {
        services_json = Buffer.from(services_json, 'base64').toString('utf-8');
      }
    }

    let services_changed = true;
    if (!services_json && !services_string) {
      services_changed = false;
    } else if (services_json) {
      try {
        if (JSON.stringify(JSON.parse(services_json)) === services_string) {
          services_changed = false;
        }
      } catch (e) {
        console.warn(e);
      }
    }
    let labels_changed = true;
    const exist_labels = exist_secret.metadata && exist_secret.metadata.labels || {};
    if (shallowCompare(exist_labels, labels)) {
      labels_changed = false;
    }
    let annotations_changed = true;
    const exist_annotations = exist_secret.metadata && exist_secret.metadata.annotations || {};
    if (shallowCompare(exist_annotations, annotations)) {
      annotations_changed = false;
    }
    const patches = [];
    if (services_changed) {
      console.log('Service change detected.');
      patches.push({
        op: 'replace',
        path: '/stringData',
        value: {
          'services.json': services_string,
        },
      });
    }
    if (labels_changed) {
      console.log('Labels change detected.');
      patches.push({
        op: 'replace',
        path: '/metadata/labels',
        value: labels,
      })
    }
    if (annotations_changed) {
      console.log('Annotations change detected.');
      patches.push({
        op: 'replace',
        path: '/metadata/annotations',
        value: annotations,
      })
    }
    if (patches.length === 0) {
      console.log(`Secret up-to-date.`);
      return;
    }
    await k8sApi.patchNamespacedSecret(SECRET_NAME, namespace, patches, undefined, undefined, undefined, undefined, undefined, {
      headers: { 'Content-type': k8s.PatchUtils.PATCH_FORMAT_JSON_PATCH },
    });
    console.log(`Secret patched.`);
  }
}

await prepareDb();
console.log('Completed.');