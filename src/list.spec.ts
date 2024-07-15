import { describe, it, expect } from "vitest";
import { List } from "./list";

const range = (start: number, end: number) =>
  Array.from({ length: end - start }, (_, index) => index + start);

describe("List", () => {
  it("should be created from parameters that can be undefined", () => {
    const list = List.of(1, 2, 3, undefined, 4, 5);
    expect([...list]).toEqual([1, 2, 3, undefined, 4, 5]);
  });

  it("should be created from an array", () => {
    const data = range(1, 34);
    const list = List.of(...data);
    expect([...list]).toHaveLength(data.length);
  });

  it("should be created from an array", () => {
    const data = range(1, 32 * 32 * 31 + 2);
    const list = List.of(...data);

    expect([...data]).toHaveLength(data.length);
    expect([...list]).toHaveLength(data.length);
  });

  it("should be randomly accessible", () => {
    const data = range(1, 34);
    const list = List.of(...data);

    expect(list.at(11)).toEqual(12);
  });

  it("should be empty by default", () => {
    const list = List.empty();
    expect(list.isEmpty()).toBe(true);
  });

  it("should create a new list when update is called", () => {
    const list = List.of(1, 2, 3);
    const list2 = list.with(1, 42);
    expect(list2.at(1)).toBe(42);
    expect(list.at(1)).toBe(2);
  });
  it("should update list on given indexes", () => {
    const list = List.of(...range(1, 34));
    const list2 = list.with(32, 42);
    expect(list2.at(32)).toBe(42);
  });

  it("should increase list size when out of range indexes are used", () => {
    const list = List.of(1);
    const list2 = list.with(12345, 42);
    expect(list2.length).toBe(12346);
  });

  it("should not get any value when out of range", () => {
    const data = range(1, 33);
    const list = List.of(...data);
    expect(list.at(32)).toBeUndefined();
  });
  describe("push", () => {
    it("should increase length when pushing a new value", () => {
      const list = List.of(1, 2, 3);
      const list2 = list.push(42);
      expect(list.length).toBe(3);
      expect(list2.length).toBe(4);
    });

    it("should increase capacity when pushing a new value in an out of capacity list", () => {
      const data = range(1, 33);
      const list = List.of(...data);
      const list2 = list.push(42);
      expect(list.at(0)).toEqual(1);
      expect(list2.at(32)).toEqual(42);
    });

    it("should not be empty when an item has been added", () => {
      const list = List.empty();
      const list2 = list.push(123);
      expect(list.isEmpty()).toBe(true);
      expect(list2.isEmpty()).not.toBe(true);
    });
  });
  describe("pop", () => {
    it("should remove value after pop", () => {
      const list = List.empty();
      const list2 = list.push(123);
      const list3 = list2.pop();
      expect(list3.isEmpty()).toBe(true);
      expect(list3.pop().isEmpty()).toBe(true);
    });
  });

  describe("shift", () => {
    it("should remove first value when calling shift", () => {
      const list = List.empty();
      const list2 = list.push(123);
      const list3 = list2.shift();
      expect(list3.isEmpty()).toBe(true);
    });

    it("should shift all indexes", () => {
      const list = List.of(123, 42);
      const list2 = list.shift().with(0, 36);
      expect(list2.at(0)).toBe(36);
    });

    it("should take in account shifts to compute capacity when pushing new values", () => {
      const data = range(1, 33);
      const list = List.of(...data).shift();
      const list2 = list.push(36).push(42);
      expect(list2.at(0)).toEqual(2);
      expect(list2.at(30)).toEqual(32);
      expect(list2.at(32)).toEqual(42);
    });

    it("should not shift an empty list", () => {
      const list = List.of(1);
      const list2 = list.shift().shift().push(42);
      expect(list2.at(0)).toBe(42);
    });
  });
  describe("unshift", () => {
    it("should insert values when unshifting after shift", () => {
      const list = List.of(1).shift();
      const list2 = list.unshift(42);
      expect(list2.at(0)).toBe(42);
    });

    it("should insert values when unshifting", () => {
      const list = List.of(1).with(31, 36);
      const list2 = list.unshift(42);
      expect(list2.at(0)).toBe(42);
      expect(list2.at(32)).toBe(36);
    });
  });
  describe("slice", () => {
    it("should copy everything when slicing without parameters", () => {
      const list = List.of(1, 2, 3);

      expect(list.slice()).toBe(list);
    });

    it("should skip items when a start parameter is specified", () => {
      const data = [1, 2, 3];
      const list = List.of(...data);

      expect([...list.slice(1)]).toEqual([...data.slice(1)]);
    });

    it("should skip items when a start parameter and an end parameter are specified", () => {
      const data = [1, 2, 3];
      const list = List.of(...data);

      expect([...list.slice(1, 2)]).toEqual([...data.slice(1, 2)]);
      expect([...list.slice(-2, 2)]).toEqual([...data.slice(-2, 2)]);
    });

    it("should slice handling out of bounds parameters", () => {
      const data = [1, 2, 3, 4];
      const list = List.of(...data);
      expect([...list.slice(-4, 2)]).toEqual([...data.slice(-4, 2)]);
      expect([...list.slice(-5, 2)]).toEqual([...data.slice(-5, 2)]);
      expect([...list.slice(0, -5)]).toEqual([...data.slice(0, -5)]);
    });
  });

  describe("batchMutations", () => {
    it("should perform all operation", () => {
      const list = List.empty();
      const NUMBER_OF_ITEMS_TO_ADD = 6400;
      const items = range(0, NUMBER_OF_ITEMS_TO_ADD);
      const list2 = list.batchMutations((l) => {
        items.forEach((item) => {
          l
          .push(item)
          .shift()
          .push(item)
          .push(item)
          .with(item, item * 2)
          .pop()
          .pop()
          .unshift(item);
        });
      });
      //console.log(JSON.stringify((list2 as any).root.toJSON(), null, 2));
      expect(list2.length).toBe(NUMBER_OF_ITEMS_TO_ADD);
    });

    it("should return the same list when there were no changes", () => {
      const list = List.of(1, 2, 3);
      const list2 = list.batchMutations((l) => {});

      expect(list2).toBe(list);
    });
  });
});
