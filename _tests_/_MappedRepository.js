// @flow
import sinon from 'sinon';
import assert from 'assert';
import {ObjectID,MongoClient} from 'mongodb';
import {
  connect as connectMongo,
  dispose as disposeMongo
} from './_MongoConnect';

import {
  CRUDRepository,
  MappedRepository
} from '../src/Repository';

import { Observable } from 'rxjs/Rx';

const MONGO_URL = 'mongodb://mongo:27017/integration_tests'

describe.only('MappedRepository',()=>{
  let sandbox,mocks,testRepo;
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    mocks = {};

    // Map converts "id" and "foo" fields to store with underscore
    let inMap = (item)=>({_id:item.id, _foo:item.foo});
    let outMap = (item)=>({id:item._id,foo:item._foo});
    testRepo = MappedRepository('test',()=>connectMongo(MONGO_URL), inMap, outMap);
  });
  afterEach(() => {
    sandbox.restore();
    return disposeMongo();
  });
  describe('insert',()=>{
    it('should use inMap for arguements and outMap for result',async ()=>{
      // Insert items like
      // { foo:1, bar:1 }
      let itemObservable = Observable
      .range(1,10)
      .map(foo=>({foo,bar:foo}));

      let res = await testRepo
      .insert(itemObservable)
      .do(item=>assert.equal(item.bar,undefined,'Bar should not exist because of map'))
      .do(item=>assert.ok(item.foo,'"foo" should be set'))
      .do(item=>assert.ok(item.id,'"id" should be set'))
      .toArray()
      .toPromise();

      assert.equal(res.length, 10, 'All items should be returned');
    })
  })
  describe('query',()=>{
    it('should use outMap for result',async ()=>{
      // Insert items like
      // { foo:1, bar:1 }
      let itemObservable = Observable
      .range(1,10)
      .map(foo=>({foo,bar:foo}));

      await testRepo
      .insert(itemObservable)
      .toPromise();

      let res = await testRepo.query({})
      .do(item=>assert.equal(item.bar,undefined,'Bar should not exist because of map'))
      .do(item=>assert.ok(item.foo,'"foo" should be set'))
      .do(item=>assert.ok(item.id,'"id" should be set'))
      .toArray()
      .toPromise();

      assert.equal(res.length, 10, 'All items should be returned');
    });
  });
});
