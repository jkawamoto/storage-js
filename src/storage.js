/*
 * Copyright (c) 2018 Junpei Kawamoto
 *
 * This software is released under the MIT License.
 *
 * http://opensource.org/licenses/mit-license.php
 */

/* global indexedDB */
const ReadOnly = "readonly";
const ReadWrite = "readwrite";

class Storage {

  constructor(db) {
    this._db = db;
  }

  close() {
    this._db.close();
  }

  get name() {
    return this._db.name;
  }

  get kinds() {
    return this._db.objectStoreNames;
  }

  async put(kind, obj) {
    const {tx, txPromise} = this._createTransaction(kind, ReadWrite);
    return Promise.all([txPromise, this._executeMethod(tx, kind, "put", obj)]);
  }

  async get(kind, id) {
    const {tx, txPromise} = this._createTransaction(kind);
    return Promise.all([txPromise, this._executeMethod(tx, kind, "get", id)]).then(res => res[1]);
  }

  async delete(kind, id) {
    const {tx, txPromise} = this._createTransaction(kind, ReadWrite);
    return Promise.all([txPromise, this._executeMethod(tx, kind, "delete", id)]).then(() => {
    });
  }

  async take(kind) {

    const {tx, txPromise} = this._createTransaction(kind, ReadWrite);
    const promise = this._executeMethod(tx, kind, "getAllKeys").then((keys) => {
      if (!keys.length) {
        return;
      }
      keys.sort();
      return this._executeMethod(tx, kind, "get", keys[0])
        .then(obj => this._executeMethod(tx, kind, "delete", keys[0]).then(() => obj));
    });
    return Promise.all([txPromise, promise]).then(res => res[1]);

  }

  _createTransaction(kind, mode = ReadOnly) {

    const tx = this._db.transaction(kind, mode);
    const txPromise = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    return {tx, txPromise};

  }

  async _executeMethod(tx, kind, method, param) {

    const store = tx.objectStore(kind);
    const req = store[method](param);
    return new Promise((resolve, reject) => {
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = (err) => {
        tx.abort();
        reject(err);
      };
    });

  }

}

export const create = async (dbName, kinds = []) => {

  if (!(kinds instanceof Array)) {
    kinds = [kinds];
  }

  return new Promise((resolve, reject) => {

    const openReq = indexedDB.open(dbName);
    openReq.onupgradeneeded = (e) => {
      const db = e.target.result;
      kinds.forEach(v => db.createObjectStore(v, {keyPath: "id"}));
    };

    openReq.onsuccess = e => resolve(new Storage(e.target.result));

    openReq.onerror = reject;

  });

};

export const remove = async dbName => new Promise((resolve, reject) => {
  const deleteReq = indexedDB.deleteDatabase(dbName);
  deleteReq.onsuccess = resolve;
  deleteReq.onerror = reject;
});

