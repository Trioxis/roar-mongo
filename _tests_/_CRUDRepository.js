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

const MONGO_URL = 'mongodb://mongo:27017/integration_tests';

describe('CRUD Repositories',()=>{
  let sandbox,mocks,testRepo;
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    mocks = {};
    testRepo = CRUDRepository('tests',()=>connectMongo(MONGO_URL));
  });
  afterEach(() => {
    return disposeMongo(MONGO_URL);
  });
  describe('insert', () => {
    it('should accept and array and return observable of inserted items',async ()=>{
      let res = await testRepo
      .insert([{a:'b'},{a:'b'}])
      .do(item=>assert.equal(item.a,'b','Should return observable of added items'))
      .toArray()
      .toPromise();

      assert.equal(res.length, 2, 'All items should be returned');
    });
    it('should also accept an observable of items',async ()=>{
      let itemObservable = Observable.range(1,10).map(i=>({i}));

      let res = await testRepo
      .insert(itemObservable)
      .toArray()
      .toPromise();

      assert.equal(res.length, 10, 'All items should be returned');
    });
    it('should deal with enormous amounts of data',async function(){
      this.timeout(10000);

      let hugeness = 100000;

      let itemFactory = Observable
        .range(1, hugeness)
        .map(i=>({foo:5}));

      await testRepo
      .insert(itemFactory)
      .toPromise();

      let res = await testRepo.query({})
      // Accumulate count
      .reduce((acc, item) => acc + 1, 0)
      .toPromise();

      assert.equal(res, hugeness,'Should return all results');
    })
  });
  describe('query', () => {
    it('should return added items',async ()=>{
      let itemFactory = Observable
        .range(0, 100)
        .map(i=>({
          even:(i%2 === 0),
          foo:i
        }));

      await testRepo
      .insert(itemFactory)
      .toPromise();

      let res = await testRepo.query({
        foo:{$gte:20},
        even:true
      })
      .do(item=>assert.ok(item.foo,'Each item should contain "foo" key'))
      .toArray()
      .toPromise();

      assert.equal(res.length, 40,'Should return all results');
    });
    it('should handle multiple simultaneous queries',async ()=>{
      const numberOfItems = 1000;
      let itemFactory = Observable
        .range(0, numberOfItems)
        .map(i=>({
          even:(i%2===0),
        }));

      await testRepo
      .insert(itemFactory)
      .toPromise();

      const numberOfQueries = 100;

      const res = await Observable
      .range(0, numberOfQueries)
      .mapTo({})
      .flatMap(query=>testRepo.query(query))
      .toArray()
      .toPromise();

      assert.equal(res.length, numberOfQueries*numberOfItems,'Should return all results');
    });
    it('should handle result limit',async ()=>{
      let itemFactory = Observable
        .range(0, 1000)
        .map(i=>({foo:'bar'}));

      await testRepo
      .insert(itemFactory)
      .toPromise();

      let res = await testRepo.query({},{limit:100})
      .toArray()
      .toPromise();

      assert.equal(res.length, 100,'Should return all results');
    });
  });
  describe('update',()=>{
    it('should update items accordingly and return corrosponding ids',async()=>{
      let itemFactory = Observable
        .range(1, 50)
        .map(i=>({aNumber:5}));

      let insertedObs = testRepo
      .insert(itemFactory)
      .do(item=>assert.equal(item.aNumber,5,'Field value should be that of inserted value'));

      let newItems = insertedObs
      .map(item=>({...item,aNumber:6}));

      let res = await testRepo
      .update(newItems)
      .do(id=>assert.ok(id,'Should return ids'))
      .toArray()
      .flatMap(ids=>testRepo.query({_id:{$in:ids}}))
      .do(item=>assert.equal(item.aNumber,6,'Documents should have been updated'))
      .toArray()
      .toPromise();

      assert.equal(res.length, 50,'Should return all results');
    })
  });
  describe('upsert',()=>{
    it('should upsert items and return corrosponding ids', async () => {
      let itemFactory = Observable
      .range(1, 50)
      .map(i => ({aNumber: 5}));

      let insertedObs = testRepo
      .insert(itemFactory)
      .do(item => assert.equal(item.aNumber, 5, 'Field value should be that of inserted value'));

      let newItems = Observable.merge(
        insertedObs.map(item => ({...item, aNumber: 6})),
        Observable.range(1, 10).map(_ => ({_id: ObjectID(), aNumber: 6}))
      );

      let res = await testRepo
      .upsert(newItems)
      .do(id => assert.ok(id, 'Should return ids'))
      .toArray()
      .flatMap(ids => testRepo.query({_id: {$in: ids}}))
      .do(item => assert.equal(item.aNumber, 6, 'Documents should have been updated'))
      .toArray()
      .toPromise();

      assert.equal(res.length, 60, 'Should return all results');
    })
  });
  describe('delete',()=>{
    it('should delete items accordingly and return corrosponding ids',async()=>{
      let itemFactory = Observable
        .range(1, 50)
        .map(i=>({aNumber:5}));

      let insertedObs = testRepo
      .insert(itemFactory);

      await testRepo
      .delete(insertedObs.take(10))
      .toPromise();

      let res = await testRepo
      .query({})
      .toArray()
      .toPromise();

      assert.equal(res.length, 40,'10 items should have been deleted');
    });
  });
});
