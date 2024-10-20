import fc from "fast-check";
import { describe, it, expect } from "vitest";
import Immutable from "immutable";
import { List } from "./list";

describe("Lists and Immutable Lists", () => {
  it("should behave the same way when setting values with indexes", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ max: 1000, min: -100 }), fc.float()), {
          maxLength: 100,
        }),
        (testData) => {
          let immList = Immutable.List();
          let list = List.empty();
          testData.forEach(([index, value]) => {
            immList = immList.set(index, value);
            list = list.set(index, value);
          });
          expect([...list]).toEqual(immList.toJS());
        }
      )
    );
  });
  it("should behave the same way when pushing and shifting", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.constantFrom("push", "pop", "shift", "unshift", "set", "insert"),
            fc.tuple(fc.integer({ max: 1000, min: -1000 }), fc.float())
          ),
          { maxLength: 10000 }
        ),
        (testData) => {
          let immList = Immutable.List();
          let list = List.empty();
          testData.forEach(([op, [index, value]]) => {
            if (op === "push") {
              immList = immList.push(value);
              list = list.push(value);
            } else if (op === "pop") {
              immList = immList.pop();
              list = list.pop();
            } else if (op === "shift") {
              immList = immList.shift();
              list = list.shift();
            } else if (op === "unshift") {
              immList = immList.unshift(value);
              list = list.unshift(value);
            } else if (op === "insert") {
              immList = immList.unshift(value);
              list = list.unshift(value);
            } else {
              immList = immList.set(index, value);
              list = list.set(index, value);

            }
          });
          const expected = immList.toJS().map(x => x === null ? undefined : x);
          expect([...list]).toEqual(expected);
        }
      ), { numRuns: 1000 }
    );
  });
});
