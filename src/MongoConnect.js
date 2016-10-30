import {MongoClient} from 'mongodb';

import crypto from 'crypto';

let currentConnection;

export async function connect (url) {
  if (!currentConnection) {
    currentConnection = await newConnection(url);
  }
  return currentConnection;
}

async function newConnection(url) {
  return await MongoClient.connect(url);
}

export async function dispose (url) {
  if(currentConnection){
    await currentConnection.dropDatabase();
  }
}
