// @flow
import {
  connect as MongoConnect,
  dispose as disposeMongo
} from './_MongoConnect';

import {ObjectID} from 'mongodb';

import {
  MappedRepository
} from '../src/Repository';

import { Observable } from 'rxjs/Rx';
import assert from 'assert';

const MONGO_URL = 'mongodb://mongo:27017/integration_tests'

describe.skip('MappedRepository',()=>{
  afterEach(() => {
    return disposeMongo();
  });
  describe('bar',()=>{
    it('foo',async ()=>{
      const InboundMap = (input:Object)=>{
        assert.ok(input.name,'Author should contain name');
        const _id = input.id ? new ObjectID(input.id) : new ObjectID()

        return {
          name:input.name,
          _id
        };
      }
      const OutboundMap = (input:Object)=>({
        name:input.name,
        id:input._id.toString()
      })

      const myRepo =
      MappedRepository(
        'authors',
        ()=>MongoConnect(MONGO_URL),
        InboundMap,
        OutboundMap
      );

      const items = [
        {
          name: 'Arya Stark'
        }, {
          name: 'Rob Stark'
        }
      ]

      let res = await myRepo.insert(items)
      // Returns an Observable of items
      .toArray()
      .toPromise();

      // Stored in Mongo:
      // [
      //   {
      //     _id:ObjectID(1234),
      //     name: 'Arya Stark'
      //   }, {
      //     _id:ObjectID(5678),
      //     name: 'Rob Stark'
      //   }
      // ]

      // console.log(res) would result in
      // [
      //   {
      //     id:'1234',
      //     name: 'Arya Stark'
      //   }, {
      //     id:'5678',
      //     name: 'Rob Stark'
      //   }
      // ]

      // Note the difference in ID key and value
    });
  });
});
