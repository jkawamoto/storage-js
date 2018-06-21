/*
 * Copyright (c) 2018 Junpei Kawamoto
 *
 * This software is released under the MIT License.
 *
 * http://opensource.org/licenses/mit-license.php
 */

/* global window */

import * as storage from "../src/storage";

describe("storage module", () => {

  const name = "sample-storage";
  const kindA = "kind-a";
  const kindB = "kind-b";
  const kinds = [kindA, kindB];
  const obj = {id: "1", value: "sample-object"};
  const err = "expected error";

  afterEach(() => storage.remove(name));

  it("has create which creates a new storage which accepts given kinds of objects", async () => {
    const s = await storage.create(name, kinds);
    expect(s.name).toEqual(name);
    expect(s.kinds).toEqual(kinds);
    s.close();
  });

  it("has create which creates a new storage with a kind instead of a list of kinds", async () => {
    const s = await storage.create(name, kindA);
    expect(s.name).toEqual(name);
    expect(s.kinds).toEqual([kindA]);
    s.close();
  });

  it("has remove which deletes the storage", async () => {
    const fn = jest.spyOn(window.indexedDB, "deleteDatabase");
    try {
      await storage.remove(name);
      expect(fn).toHaveBeenCalledWith(name);
    } finally {
      fn.mockRestore();
    }
  });

  describe("Storage class", () => {

    let s;
    beforeEach(async () => {
      s = await storage.create(name, kinds);
    });

    afterEach(() => {
      s.close();
    });

    it("has put to insert a new object and get to retrieve the object", async () => {
      await s.put(kindA, obj);
      await expect(s.get(kindA, obj.id)).resolves.toEqual(obj);
      await expect(s.get(kindB, obj.id)).resolves.toBeUndefined();
    });

    it("has delete to remove an object from the storage", async () => {
      await s.put(kindA, obj);
      await expect(s.get(kindA, obj.id)).resolves.toEqual(obj);
      await s.delete(kindA, obj.id);
      await expect(s.get(kindA, obj.id)).resolves.toBeUndefined();
    });

    it("has take to obtain an object which has the smallest id and remove the object from the storage", async () => {
      const obj2 = {id: "2", value: "sample-object-2"};
      const obj3 = {id: "3", value: "sample-object-3"};
      const others = [obj2, obj3];
      await s.put(kindA, obj);
      for (const o of others) {
        await s.put(kindA, o);
      }

      await expect(s.take(kindA)).resolves.toEqual(obj);
      await expect(s.get(kindA, obj.id)).resolves.toBeUndefined();
      for (const o of others) {
        await expect(s.get(kindA, o.id)).resolves.toEqual(o);
      }
      await expect(s.take(kindA)).resolves.toEqual(obj2);
    });

    it("do nothing when being closed twice", () => {
      s.close();
      s.close();
    });

    describe("put method", () => {

      it("overwrites the object if putting a new object which has the same ID", async () => {
        const oldObj = {...obj, value: "old-object"};
        await s.put(kindA, oldObj);
        await expect(s.get(kindA, obj.id)).resolves.toEqual(oldObj);
        await s.put(kindA, obj);
        await expect(s.get(kindA, obj.id)).resolves.toEqual(obj);
      });

      it("returns a rejected promise if the storage doesn't allow the given kind", async () => {
        await expect(s.put("another kind", obj)).rejects.not.toBeUndefined();
      });

      it("returns a rejected promise if failing to create a transaction", async () => {
        const fn = jest.spyOn(s, "_createTransaction").mockImplementation((kind, mode) => ({
          tx: s._db.transaction(kind, mode),
          txPromise: Promise.reject(err)
        }));
        try {
          await expect(s.put(kindA, obj)).rejects.toEqual(err);
        } finally {
          fn.mockRestore();
        }
      });

      it("returns a rejected promise if failing to execute the corresponding method", async () => {
        const fn = jest.spyOn(s, "_executeMethod").mockRejectedValue(err);
        try {
          await expect(s.put(kindA, obj)).rejects.toEqual(err);
        } finally {
          fn.mockRestore();
        }
      });

    });

    describe("get method", () => {

      it("returns undefined if the storage doesn't have any object corresponding to the given ID", async () => {
        await expect(s.get(kindA, "random-id")).resolves.toBeUndefined();
      });

      it("returns a rejected promise if the storage doesn't allow the given kind", async () => {
        await expect(s.get("another kind", obj.id)).rejects.not.toBeUndefined();
      });

      it("returns a rejected promise if failing to create a transaction", async () => {
        const fn = jest.spyOn(s, "_createTransaction").mockImplementation((kind, mode) => ({
          tx: s._db.transaction(kind, mode),
          txPromise: Promise.reject(err),
        }));
        try {
          await expect(s.get(kindA, obj.id)).rejects.toEqual(err);
        } finally {
          fn.mockRestore();
        }
      });

      it("returns a rejected promise if failing to execute the corresponding method", async () => {
        const fn = jest.spyOn(s, "_executeMethod").mockRejectedValue(err);
        try {
          await expect(s.get(kindA, obj.id)).rejects.toEqual(err);
        } finally {
          fn.mockRestore();
        }
      });

    });

    describe("delete method", () => {

      it("do nothing if the storage doesn't have an object corresponding to the given ID", async () => {
        await expect(s.delete(kindA, obj.id)).resolves.toBeUndefined();
      });

      it("returns a rejected promise if the storage doesn't allow the given kind", async () => {
        await expect(s.delete("another kind", obj.id)).rejects.not.toBeUndefined();
      });

      it("returns a rejected promise if failing to create a transaction", async () => {
        const fn = jest.spyOn(s, "_createTransaction").mockImplementation((kind, mode) => ({
          tx: s._db.transaction(kind, mode),
          txPromise: Promise.reject(err)
        }));
        try {
          await expect(s.delete(kindA, obj.id)).rejects.toEqual(err);
        } finally {
          fn.mockRestore();
        }
      });

      it("returns a rejected promise if failing to execute the corresponding method", async () => {
        const fn = jest.spyOn(s, "_executeMethod").mockRejectedValue(err);
        try {
          await expect(s.delete(kindA, obj.id)).rejects.toEqual(err);
        } finally {
          fn.mockRestore();
        }
      });

    });

    describe("take method", () => {

      it("returns undefined if the storage doesn't have objects", async () => {
        await expect(s.take(kindB)).resolves.toBeUndefined();
      });

      it("returns a rejected promise if the storage doesn't allow the given kind", async () => {
        await expect(s.take("another kind")).rejects.not.toBeUndefined();
      });

      it("returns a rejected promise if failing to create a transaction", async () => {
        const fn = jest.spyOn(s, "_createTransaction").mockImplementation((kind, mode) => ({
          tx: s._db.transaction(kind, mode),
          txPromise: Promise.reject(err)
        }));
        try {
          await expect(s.take(kindA, obj.id)).rejects.toEqual(err);
        } finally {
          fn.mockRestore();
        }
      });

      it("returns a rejected promise if failing to execute the corresponding method", async () => {
        const fn = jest.spyOn(s, "_executeMethod").mockRejectedValue(err);
        try {
          await expect(s.take(kindA, obj.id)).rejects.toEqual(err);
        } finally {
          fn.mockRestore();
        }
      });

    });

  });

});
