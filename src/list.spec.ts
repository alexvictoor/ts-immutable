import { describe, it, expect } from "vitest";

const SIZE = 32;
const SHIFT = Math.log2(SIZE);
const MASK = SIZE - 1;

class Node<T> {

  constructor(
    public children: Array<Node<T> | undefined> | Array<Leaf<T> | undefined>,
    public level: number
  ) {}

  public computeCapacity = () => 1 << (this.level + SHIFT);

  private computeChildrenIndex = (index: number): number =>  (index >> this.level) & MASK;

  private createNewEmptyChild = (): Trie<T> => this.level > SHIFT ? new Node<T>([], this.level - SHIFT) : new Leaf<T>([]);

  findValueAt = (index: number): T | undefined => {
    const childrenIndex = this.computeChildrenIndex(index);
    return this.children[childrenIndex]?.findValueAt(index);
  };

  //swallowCopy =  () => new Node<T>(this.children.slice(), this.level);

  set = (updateIndex: number, updateValue: T) => {
    const childrenIndex = this.computeChildrenIndex(updateIndex);
    const newChildren = this.children.slice();
    const child = newChildren[childrenIndex] || this.createNewEmptyChild();
    newChildren[childrenIndex] = child.set(updateIndex, updateValue)
    return new Node<T>(newChildren, this.level);
  }

  isLeaf = () => false;
  toJSON = () => this.children;
}

class Leaf<T> {
  public readonly level = 0;
  constructor(public children: Array<T | undefined>) {}

  public computeCapacity = () => SIZE;

  private computeChildrenIndex = (index: number): number => index & MASK;

  findValueAt = (index: number): T | undefined => {
    const childrenIndex = (index >> this.level) & MASK;
    return this.children[childrenIndex];
  };

  set = (updateIndex: number, updateValue: T) => {
    const childrenIndex = this.computeChildrenIndex(updateIndex);
    const newChildren = this.children.slice();
    newChildren[childrenIndex] = updateValue;
    return new Leaf<T>(newChildren);
  }

  isLeaf = () => true;
  toJSON = () => this.children;
}

type Trie<T> = Node<T> | Leaf<T>;

const isLeaf = <T>(trie: Trie<T>): trie is Leaf<T> => trie.isLeaf();


const buildTrie = <T>(
  nodes: Array<Node<T>> | Array<Leaf<T>>,
  level = 0
): Trie<T> => {
  if (nodes.length === 1) {
    return nodes[0];
  }
  const parents = new Array<Node<T>>();
  let offset = 0;
  const parentLevel = level + SHIFT;
  while (offset < nodes.length) {
    parents.push(new Node(nodes.slice(offset, offset + SIZE), parentLevel));
    offset += SIZE;
  }
  return buildTrie(parents, parentLevel);
};

const buildHigherCapacityTrie = <T>(trie: Trie<T>): Trie<T> => {
  const newLevel = trie.level + SHIFT;
  if (isLeaf(trie)) {
    return new Node<T>([trie], newLevel);
  }
  return new Node<T>([trie], newLevel);
}

export class List<T> {
  private static EMPTY_LIST = new List<any>(new Leaf<any>([]), 0);
  public static empty = <T>(): List<T> => List.EMPTY_LIST;

  public static of = <T>(...input: Array<T>) => {
    //const level = Math.floor(Math.log2(input.length));
    let offset = 0;
    const leafs = new Array<Leaf<T>>();
    while (offset < input.length) {
      leafs.push(new Leaf(input.slice(offset, offset + SIZE)));
      offset += SIZE;
    }
    const trie = buildTrie(leafs);
    return new List(trie, input.length);
  };

  private capacity: number;

  private constructor(
    private readonly root: Trie<T>,
    public readonly length: number
  ) {
    this.capacity = 1 << (this.root.level + SHIFT);
  }
  //empty
  //of
  // push
  // pop
  // set
  // get
  // spread

  isEmpty = () => this.length === 0;

  at = (index: number) => {
    if (index >= this.length) {
      return undefined;
    }
    return this.root.findValueAt(index);
  };

  push = (value: T) => {
    if (this.length >= this.capacity) { 
      const newRoot = buildHigherCapacityTrie(this.root);
      return new List<T>(newRoot.set(this.length, value), this.length + 1);
    }
    return new List<T>(this.root.set(this.length, value), this.length + 1);
  };

  with = (index: number, value: T): List<T> => {
    let newRoot = this.root;
    while (index >= newRoot.computeCapacity()) { 
      newRoot = buildHigherCapacityTrie(newRoot);
    }
    const newLength = index < this.length ? this.length : index + 1;
    return new List<T>(newRoot.set(index, value), newLength);
  };

  [Symbol.iterator] = () => {
    let currentIdex = -1;

    return {
      next: () => {
        if (currentIdex === this.length - 1) {
          return { done: true, value: undefined };
        }
        currentIdex++;
        const value = this.at(currentIdex);
        return { done: false, value };
      },
    };
  };
}

const range = (start: number, end: number) =>
  Array.from({ length: end - start }, (_, index) => index + start);

describe("List", () => {
  it("should be created from an iterable", () => {
    const list = List.of(1, 2, 3, undefined, 4, 5);
    expect([...list]).toEqual([1, 2, 3, undefined, 4, 5]);
  });

  it("should be created from an array", () => {
    const data = range(1, 34);
    const list = List.of(...data); //?

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

  /*
  it("should not be empty when an item has been added", () => {
    const list = List.empty();
    const list2 = list.push(123);
    expect(list.isEmpty()).toBe(true);
    expect(list2.isEmpty()).not.toBe(true);
  });

  it("should remove value after pop", () => {
    const list = List.empty();
    const list2 = list.push(123);
    const list3 = list2.pop();
    expect(list3).toBe(list);
  });

  it("should be iterable", () => {
    const list = List.empty().push(123).push(42);

    expect([...list]).toEqual([42, 123]);
  });
*/
});
