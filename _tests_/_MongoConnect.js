import {MongoClient} from 'mongodb';

import crypto from 'crypto';

let currentConnection;

export async function connect (mongoUrl) {
  if (!currentConnection) {
    currentConnection = await newConnection(mongoUrl);
  }
  return currentConnection;
}

function newConnection(mongoUrl) {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(12, function(error, buf) {
      MongoClient.connect(mongoUrl + buf.toString('hex'), (err, db) => {
        if (err) {
          reject(err);
        } else {
          resolve(db);
        }
      });
    });
  });
}

export async function dispose () {
  const db = await connect();
  await db.dropDatabase();
}
