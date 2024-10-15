import fc from 'fast-check';
import { describe, it, expect } from "vitest";
import Immutable from 'immutable';
import { List } from './list';


describe('Lists and Immutable Lists', () => {
    it('should behave the same way when setting values with indexes ', () => {
      fc.assert(
        fc.property(fc.array(fc.tuple(fc.integer({ max: 1000, min: -100 }), fc.float()), { maxLength: 100 }), (testData) => {
          let immList = Immutable.List();
          let list = List.empty();
          testData.forEach(([index, value]) => {
            immList = immList.set(index, value);
            list = list.set(index, value);
          });
          expect([...list]).toEqual(immList.toJS())
        }),
      );
    });
})
