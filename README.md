# Roar Mongo

**PRE-ALPHA. BREAKING CHANGES LIKELY**

A functional reactive interface for MongoDb, based on Observables.

- Composable
- Reactive
- Batteries removable, but included

## Usage

### Batteries Included

To get up and running quickly, you can use `CRUDRepository` and `MappedRepository`.

`CRUDRepository` is exactly as it sounds and exposes all the standard sort of methods you would expect: `insert`, `query`, `update` and `delete`.

`MappedRepository` is effectively a `CRUDRepository`, with the addition of input and output mapping. At Trioxis, we use this as an ORM.

In the below example, we want to validate the stored object, as well as maintain a slightly different api

This can be useful when using a library like [Joi](https://github.com/hapijs/joi) for validation.

```js
import {
  MappedRepository,
  MongoConnect,
  MongoDispose
} from 'roar-mongo';
import { Observable } from 'rxjs/Rx';
import assert from 'assert';

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

const main = async () => {
  let res = await myRepo.insert(items)
  // Returns an Observable of items
  .toArray()
  .toPromise();

  // Close the connection to allow the program to exit
  await MongoDispose(MONGO_URL);
}

main();

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
```

### Observables

`Observable` is the main primitive throughout the library.
This means it's the same API to play with large data sets.
Lets say you want to migrate something...

```js
import {
  CRUDRepository,
  MongoConnect,
  MongoDispose
} from 'roar-mongo';

const myRepo =
CRUDRepository(
  'stuff',
  ()=>MongoConnect(MONGO_URL)
);

// Lets say... you've got all this stuff...
const newItems = Observable.range(0,1000000).map(i=>({foo:i}));

// Insert will automatically batch the data into sane amounts
await myRepo.insert(newItems).toPromise();

// And now... for some reason, we want to update every doc where foo is odd
// First we'll make a mongo query
const query = { foo: { $mod: [ 2, 1 ] } };

// Now we'll perform the query and map the results...
const updateItems = myRepo
.query(query)
.map(item=>({
  ...item,
  foo:(item.foo*10)
}));

const main = async () => {
  // ... and perform the update
  // Each item will be streamed in via the observable and sanely updated
  await myRepo.update(updateItems).toPromise();

  // Profit. Then close
  await MongoDispose(MONGO_URL);
}

main();
```

### Roll your own repository

You can easily build your own repository too. Take the following for example.
This repository has `Add` and `GetByName`. Both of which are composed from higher
order functions exposed by this library.

```js
import {
  Query,
  Insert,
  HandleArrayArgument,
  MapObservableArgument,
  MapObservableResult,
  MongoConnect,
  GetCollection
} from 'roar-mongo';

const MONGO_URL = ...;

const GetCollectionFn = ()=>GetCollection('myItems',MongoConnect(MONGO_URL)));
const OutMap = item=>({
  id:item._id.toString(),
  name:item.name
});
const InMap = ({name})=>({
  name
});

class MyRepo {
  GetByName(name){
    const mongoQuery = { name }
    return MapObservableResult(OutMap,
      Query(
        GetCollectionFn()
      )
    )(mongoQuery)
  }
  Add(arrayOfNames){
    return HandleArrayArgument(
      MapObservableArgument(InMap,
        MapObservableResult(OutMap,
          Insert(GetCollectionFn())
        )
      )
    )(arrayOfNames)
  }
}
```


## API
### `CRUDRepository`
#### Construction

```js
import {
  CRUDRepository,
  MongoConnect,
  MongoDispose
} from 'roar-mongo';

const myRepo =
CRUDRepository('tests',()=>MongoConnect(MONGO_URL));

// When you are done, dispose the connection
MongoDispose(MONGO_URL);
```

#### `insert`

```js
let insertedObjects = await myRepo
.insert(Observable.of([{a:'b'},{a:'b'}]))
.toArray()
.toPromise();

// [
//   { a: 'b', _id: 58154e18d52c140979028144 },
//   { a: 'b', _id: 58154e18d52c140979028145 }
// ]
```

#### `query`

```js
import { CRUDRepository } from 'roar-mongo';

await myRepo
.query({})
.toArray()
.toPromise();

// [
//   { a: 'b', _id: 58154e18d52c140979028144 },
//   { a: 'b', _id: 58154e18d52c140979028145 }
// ]
```

#### `update`

```js
// Objects are updated using their `_id`
// Argument to .update() must be Observables
let objectsToUpdate = insertedObjects.map(o => Observable.of({...o, newField: 'c'}));

await myRepo
.update(objectsToUpdate)
.toArray()
.toPromise();

// [ 58154e18d52c140979028144, 58154e18d52c140979028145 ]

// Upsert is supported
let moreToUpdate = objectsToUpdate.merge(Observable.of({...o, newField: 'c'}));

await myRepo
.update(moreToUpdate, {upsert: true})
.toArray()
.toPromise();

// [ 58154e18d52c140979028144, 58154e18d52c140979028145, 59b5e02023a61300d983146c ]

```

#### `delete`

```js
let objectsToDelete = insertedObjects;

await myRepo
.delete(objectsToDelete)
.toArray()
.toPromise();

// [ 58154e18d52c140979028144, 58154e18d52c140979028145 ]
```
