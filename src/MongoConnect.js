// @flow
import {MongoClient} from 'mongodb';

import crypto from 'crypto';

let currentConnection;

export async function Connect (url) {
  if (!currentConnection) {
    currentConnection = await newConnection(url);
  }
  return currentConnection;
}

async function newConnection(url) {
  return await MongoClient.connect(url);
}

export async function Dispose (url) {
  if(currentConnection){
    await currentConnection.close();
  }
}
