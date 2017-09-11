// @flow
import "babel-polyfill";
import { Observable } from 'rxjs/Rx';

type RepoIn<TIn,TOut> = (obj:TIn)=>TOut;
type RepoOut<TIn,TOut> = (obj:TOut)=>TIn;
type ConnectFn = (url:string)=>()=>Promise<Object>;

import {
  Connect as MongoConnect,
  Dispose as MongoDispose
} from './MongoConnect';

export {MongoConnect};
export {MongoDispose};

export const cursorToObservable = (cursor)=>{
  return Observable.create(observer=>cursor
    .once('end',()=>observer.complete())
    .once('error',err=>observer.error(err))
    .on('data',data=>observer.next(data))
  );
}

export const Query = getColumn=>
(params:Object = {},cursor:Object = { }):Observable=>
  Observable
  .fromPromise(getColumn())
  .map(col=>col.find(params))
  .map(queryCursor=>{
    if(cursor.limit != null){
      return queryCursor.limit(cursor.limit);
    }else {
      return queryCursor;
    }
  })
  .flatMap(cursorToObservable);

export const Insert = getColumn=>
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

export const Update = getColumn =>
  (input: Observable): Observable => Observable
    .fromPromise(getColumn())
    .mergeMap(col => input
      .flatMap(item => col
        .findOneAndReplace({_id: item._id}, item)
      )
      .map(res => res.value._id)
    );

export const Upsert = getColumn =>
  (input: Observable): Observable => Observable
    .fromPromise(getColumn())
    .mergeMap(col => input
      .flatMap(item => col
        .findOneAndReplace({_id: item._id}, item, {
          upsert: true,
          returnOriginal: false
        })
      )
      .map(res => res.value._id)
    );

export const Delete = getColumn=>
(input:Observable):Observable=>Observable
  .fromPromise(getColumn())
  .mergeMap(col=>input
    .flatMap(item=>col
      .findOneAndDelete({_id:item._id})
    )
    .map(res=>res.value._id)
  );

export const GetCollection = (collectionName:string,connectFn:ConnectFn)=>async()=>{
  let db = await connectFn();
  let col = db.collection(collectionName);
  return col;
};

export const HandleArrayArgument = (insertFn)=>(input:Array<Object>|Observable)=>{
  if(input instanceof Observable){
    return insertFn(input);
  }else{
    return insertFn(Observable.from(input));
  }
}

export const MapObservableArgument = (mapFn,decoratedFn)=>
(input:Observable)=>
  decoratedFn(input.map(mapFn));

export const MapObservableResult = (mapFn,decoratedFn)=>
(...args)=>decoratedFn(...args).map(mapFn);

export const CRUDRepository = (columnName:string,connectFn:ConnectFn)=>({
  query:Query(GetCollection(columnName,connectFn)),
  insert:HandleArrayArgument(
    Insert(GetCollection(columnName,connectFn))),
  update:Update(GetCollection(columnName,connectFn)),
  upsert:Upsert(GetCollection(columnName,connectFn)),
  delete:Delete(GetCollection(columnName,connectFn))
})

export const MappedRepository = (columnName:string,connectFn:ConnectFn,inMap:RepoIn,outMap:RepoOut)=>({
  query:MapObservableResult(outMap,
    Query(GetCollection(columnName,connectFn))),
  insert:HandleArrayArgument(
    MapObservableArgument(inMap,
      MapObservableResult(outMap,
        Insert(GetCollection(columnName,connectFn))))),
  update:HandleArrayArgument(
    MapObservableArgument(inMap,
      Update(GetCollection(columnName,connectFn)))),
  upsert:HandleArrayArgument(
    MapObservableArgument(inMap,
      Upsert(GetCollection(columnName,connectFn)))),
  delete:
  HandleArrayArgument(
    MapObservableArgument(inMap,
      Delete(GetCollection(columnName,connectFn))))
});
