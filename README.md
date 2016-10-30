# Mongo-servable

An functional reactive interface for MongoDb, based on Observables.

The goal is to

- Composable
- Reactive Functional; via `Observable`s
- Unopinionated; batteries included

## Usage

### Batteries Included

To get up and running quickly, you can use `CRUDRepository` and `MappedRepository`.

`CRUDRepository` is exactly as it sounds and exposes all the standard sort of methods you would expect: `insert`, `query`, `update` and `delete`.

`MappedRepository` is effectively a `CRUDRepository`, with the addition of input and output mapping. At Trioxis, we use this as an ORM.

In the below example, we have a collection `authors`. In our application code, we prefer referring to `author.id` instead of `author._id`. We'd also prefer the ID field to be a string instead of a BSON `ObjectID`.

```js
import {
  MappedRepository,
  ConnectMongo
} from 'mongo-servable';

const InboundMap = (input:Object)=>({
  ...input,
  _id:new ObjectID(input.id)
})
const OutboundMap = (input:Object)=>({
  ...input,
  id:input._id.toString()
})

const myRepo =
MappedRepository(
  'authors',
  ()=>ConnectMongo(MONGO_URL),
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
```

### Observables

`Observable` is the main primitive throughout the library.
This means it's the same API to play with large data sets.
Lets say you want to migrate something...

```js
import {
  CRUDRepository,
  ConnectMongo
} from 'mongo-servable';

const myRepo =
CRUDRepository(
  'stuff',
  ()=>ConnectMongo(MONGO_URL),
  InboundMap,
  OutboundMap
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

// ... and perform the update
// Each item will be streamed in via the observable and sanely updated
await myRepo.update(updateItems).toPromise();

// Profit.
```

## API
### `CRUDRepository`
#### Construction

```js
import {
  CRUDRepository,
  ConnectMongo
} from 'mongo-servable';

const myRepo =
CRUDRepository('tests',()=>ConnectMongo(MONGO_URL));
```

#### `insert`

```js
let insertedObjects = await myRepo
.insert(Observable.of({a:'b'},{a:'b'}])
.toArray()
.toPromise();

// [
//   { a: 'b', _id: 58154e18d52c140979028144 },
//   { a: 'b', _id: 58154e18d52c140979028145 }
// ]
```

#### `query`

```js
import { CRUDRepository } from 'mongo-servable';

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
let objectsToUpdate = insertedObjects.map(o=>o.a = 'c');

await myRepo
.update(objectsToUpdate)
.toArray()
.toPromise();

// [ 58154e18d52c140979028144, 58154e18d52c140979028145 ]
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
