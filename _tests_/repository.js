// @flow
import sinon from 'sinon';
import assert from 'assert';
import {ObjectID,MongoClient} from 'mongodb';
import {
  connect as connectMongo,
  dispose as disposeMongo
} from './_MongoConnect';

import { Observable } from 'rxjs/Rx';

const MONGO_URL = 'mongodb://mongo:27017/integration_tests'

describe.only('Mongo Repositories',()=>{
  let sandbox,mocks;
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    mocks = {};
  });
  afterEach(() => {
    sandbox.restore();
    return disposeMongo();
  });
  describe('BasicRepository',()=>{
    let testRepo;
    beforeEach(() => {
      testRepo = BasicRepository('tests');
    });
    describe('insert', () => {
      it('should insert items into mongodb collection');
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
      it('should also accept an object');
      it('should deal with enormous amounts of data',async function(){
        this.timeout(10000);

        let hugeness = 100000;

        let itemFactory = Observable
          .range(1, hugeness)
          .map(i=>({foo:5}));

        await testRepo
        .insert(itemFactory)
        .toPromise();

        let res = await testRepo.query({},{take:hugeness})
        // Accumulate count
        .reduce((acc, item) => acc + 1, 0)
        .toPromise();

        assert.equal(res, hugeness,'Should return all results');
      })
    });
    describe('query', () => {
      it('should return added items',async ()=>{
        let itemFactory = Observable
          .range(1, 50)
          .map(i=>({foo:5}));

        await testRepo
        .insert(itemFactory)
        .toPromise();

        let res = await testRepo.query({})
        .do(item=>assert.ok(item.foo,'Each item should contain "foo" key'))
        .toArray()
        .toPromise();

        assert.equal(res.length, 50,'Should return all results');
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
      })
    })
  });
  describe('MappedRepository',()=>{
    let testRepo;
    beforeEach(() => {
      // Map converts "id" and "foo" fields to store with underscore
      let inMap = (item)=>({_id:item.id, _foo:item.foo});
      let outMap = (item)=>({id:item._id,foo:item._foo});
      testRepo = MappedRepository('test', inMap, outMap);
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
      })
    })
  });
});

type RepoIn<TIn,TOut> = (obj:TIn)=>TOut;
type RepoOut<TIn,TOut> = (obj:TOut)=>TIn;

const cursorToObservable = (cursor)=>{
  const stream = cursor.stream();
  let obs = Observable.create(observer=>{
    stream
    .on('close',()=>observer.complete())
    .on('error',err=>observer.error(err))
    .on('data',data=>observer.next(data));
  })

  obs.debounceTime(20)
  .subscribe(async()=>{
    let hasNext = await cursor.hasNext();
    if(!hasNext){
      cursor.close();
    }
  });

  return obs;
}

const Query = getColumn=>
(params:Object = {},cursor:Object = { take:100 }):Observable=>
  Observable
  .fromPromise(getColumn())
  .map(col=>col.find(params).limit(cursor.take))
  .flatMap(cursorToObservable);

const Insert = getColumn=>
(input:Observable):Observable=>Observable
  .fromPromise(getColumn())
  .mergeMap(col=>input
    // Buffer into batches of 1 thousand to avoid freaking mongo out
    .bufferCount(1000)
    // Insert the docs
    .flatMap(items=>{
      return col.insertMany(items)
    })
    .retry(5)
    // Flatten the batches back out into an observable
    .flatMap(res=>Observable.from(res.ops))
  );

const Update = getColumn=>
(input:Observable):Observable=>Observable
  .fromPromise(getColumn())
  .mergeMap(col=>input
    .flatMap(item=>col
      .findOneAndReplace({_id:item._id},item)
    )
    .map(res=>res.value._id)
  );

const Delete = getColumn=>
(input:Observable):Observable=>Observable
  .fromPromise(getColumn())
  .mergeMap(col=>input
    .flatMap(item=>col
      .findOneAndDelete({_id:item._id})
    )
    .map(res=>res.value._id)
  );

const GetColumn = (collectionName)=>async()=>{
  let db = await connectMongo(MONGO_URL);
  let col = db.collection(collectionName);
  return col;
};

const HandleArrayArgument = (insertFn)=>(input:Array<Object>|Observable)=>{
  if(input instanceof Observable){
    return insertFn(input);
  }else{
    return insertFn(Observable.from(input));
  }
}

const MapObservableArgument = (mapFn,decoratedFn)=>
(input:Observable)=>
  decoratedFn(input.map(mapFn));

const MapObservableResult = (mapFn,decoratedFn)=>
(...args)=>decoratedFn(...args).map(mapFn);

const BasicRepository = (columnName:string)=>({
  query:Query(GetColumn(columnName)),
  insert:HandleArrayArgument(
    Insert(GetColumn(columnName))),
  update:Update(GetColumn(columnName)),
  delete:Delete(GetColumn(columnName))
})

const MappedRepository = (columnName:string,inMap,outMap)=>({
  query:MapObservableResult(outMap,
    Query(GetColumn(columnName))),
  insert:HandleArrayArgument(
    MapObservableArgument(inMap,
      MapObservableResult(outMap,
        Insert(GetColumn(columnName))))),
  update:HandleArrayArgument(
    Update(GetColumn(columnName))),
  delete:
  HandleArrayArgument(
    Delete(GetColumn(columnName)))
});
