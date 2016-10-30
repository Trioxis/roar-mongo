# Mongo-servable

An functional reactive interface for MongoDb, based on Observables.

The goal is to

- Composable
- Functional
- Stream focused
- Unoppinionated; batteries included

## Usage

### Batteries Included

To get up and running quickly, you can use `CRUDRepository` and `MappedRepository`.

#### `CRUDRepository`

##### `insert`

```
let insertedObjects = await testRepo
.insert(Observable.of({a:'b'},{a:'b'}])
.toArray()
.toPromise();

// [ { a: 'b', _id: 58154e18d52c140979028144 }, { a: 'b', _id: 58154e18d52c140979028145 } ]
```

##### `query`

```
await testRepo
.query({})
.toArray()
.toPromise();

// [ { a: 'b', _id: 58154e18d52c140979028144 }, { a: 'b', _id: 58154e18d52c140979028145 } ]
```

##### `update`

```
let objectsToUpdate = insertedObjects.map(o=>o.a = 'c');

await testRepo
.update(objectsToUpdate)
.toArray()
.toPromise();

// [ 58154e18d52c140979028144, 58154e18d52c140979028145 ]
```

##### `delete`

```
let objectsToDelete = insertedObjects;

await testRepo
.delete(objectsToDelete)
.toArray()
.toPromise();

// [ 58154e18d52c140979028144, 58154e18d52c140979028145 ]
```
