import crypto from 'crypto';
import {
  Connect as superConnect,
  Dispose as superDispose
} from '../src/MongoConnect';

let currentConnection;

export async function connect (mongoUrl) {
  let random = await GenerateRandomString();
  return superConnect(mongoUrl+random);
}

function GenerateRandomString(mongoUrl) {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(12, function(error, buf) {
        if (error) {
          reject(err);
        } else {
          resolve(buf.toString('hex'));
        }
    });
  });
}

export async function dispose () {
  return await superDispose();
}
