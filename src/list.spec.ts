import { describe, it, expect } from "vitest";
import { Stack } from "./stack";

const SIZE = 32; 
const SHIFT = Math.log2(SIZE);
const MASK = SIZE - 1;

class Node<T> {
  constructor(
    public children: Array<Node<T> | undefined> | Array<Leaf<T> | undefined>,
    public level: number
  ) {}

  findValueAt = (index: number): T | undefined => {
    const childrenIndex = (index >> this.level) & MASK;
    return this.children[childrenIndex]?.findValueAt(index);
  }

  //swallowCopy =  () => new Node<T>(this.children.slice(), this.level);

  update = (updateIndex: number, updateValue: T) => new Node<T>(this.children.map((child, index) => updateIndex === index ? child!.update(updateIndex, updateValue) : child), this.level);

  isLeaf = () => false;
  toJSON = () => this.children;
}

class Leaf<T> {
  private readonly level = 0;
  constructor(public children: Array<T | undefined>) {}

  findValueAt = (index: number): T | undefined => {
    const childrenIndex = (index >> this.level) & MASK;
    return this.children[childrenIndex];
  }
  
  //swallowCopy =  () => new Leaf<T>(this.children.slice());

  update = (updateIndex: number, updateValue: T) => new Leaf<T>(this.children.map((value, index) => updateIndex === index ? updateValue : value));

  isLeaf = () => true;
  toJSON = () => this.children;
}

type Trie<T> = Node<T> | Leaf<T>;

const isLeaf = <T>(trie: Trie<T>): trie is Leaf<T> => trie.isLeaf();

/*
type SearchContext<T> = {currentTrieNode: Trie<T>, index: number};
type SearchContextStack<T> = Stack<SearchContext<T>>;
const searchNextValue = <T>(contextStack: SearchContextStack<T>): { value?: T, searchContextStack: SearchContextStack<T>} => {
  const context = contextStack.peek();
  const newContextStack = contextStack.pop();

  if (!context) {
    return { value: undefined, searchContextStack: Stack.empty()}
  }
  const { currentTrieNode, index } = context;
  if (index === SIZE) {
    return searchNextValue(newContextStack);
  }
  
  let newIndex = index + 1;
  if (isLeaf(currentTrieNode)) {
    let value = currentTrieNode.children[newIndex];
    while (!value && newIndex < SIZE) {
      newIndex++;
      value = currentTrieNode.children[newIndex];
    }
    if (newIndex === SIZE) {
      return searchNextValue(newContextStack);
    }
    return { value, searchContextStack: newContextStack.push({ currentTrieNode, index: newIndex })}
  }

  let lowerTrie = currentTrieNode.children[newIndex];
  while (!lowerTrie && newIndex < SIZE) {
    lowerTrie = currentTrieNode.children[newIndex];
    newIndex++;
  }
  if (newIndex === SIZE) {
    return searchNextValue(newContextStack);
  }

  return searchNextValue(newContextStack.push({ currentTrieNode, index: newIndex }).push({ currentTrieNode: lowerTrie as Trie<T>, index: -1 }));
}*/

const buildTrie = <T>(nodes: Array<Node<T>> | Array<Leaf<T>>, level = 0): Trie<T> => {
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

  private constructor(private readonly root: Trie<T>, public readonly length: number) {}
  //empty
  //of
  // push
  // pop
  // set
  // get
  // spread

  isEmpty = () => this.length === 0;

  get = (index: number) => {
    return this.root.findValueAt(index);
  }

  push = (value: T) => {
    return this;
  }

  update = (index: number, value: T): List<T> => {

    return new List<T>(this.root.update(index, value), this.length);
  }

  [Symbol.iterator] = () => {

    let currentIdex = -1;

    return {
     
      next: () => {
        if (currentIdex === this.length - 1) {
          return { done: true, value: undefined };
        }
        currentIdex++;
        const value = this.get(currentIdex);
        return { done: false, value };
      },
    };
  };
}

const range = (start: number, end: number) => Array.from({length: end - start}, (_, index) => index + start);


describe("List", () => {
  it("should be created from an iterable", () => {
    const list = List.of(1, 2, 3, undefined, 4, 5); 
    expect([...list]).toEqual([1, 2, 3, undefined, 4, 5]);
  });

  it("should be created from an array", () => {
    const data = range(1, 34);
    const list = List.of(...data);

    expect([...list]).toHaveLength(data.length)
  });
  it("should be created from an array", () => {
    const data = range(1, 32 * 32 * 31 + 2);
    const list = List.of(...data);

    expect([...data]).toHaveLength(data.length)
    expect([...list]).toHaveLength(data.length)
  });

  it("should be randomly accessible", () => {
    const data = range(1, 34);
    const list = List.of(...data);

    expect(list.get(11)).toEqual(12);
  });


  it("should be empty by default", () => {
    const list = List.empty();
    expect(list.isEmpty()).toBe(true);
  });

  it("should create a new list when update is called", () => {
    const list = List.of(1, 2, 3);
    const list2 = list.update(1, 42);
    expect(list2.get(1)).toBe(42);
    expect(list.get(1)).toBe(2);
  });

  it("should push a new value without increasing capacity", () => {
    const list = List.of(1, 2, 3);
    const list2 = list.push(42);
    expect(list.length).toBe(3);
    expect(list2.length).toBe(4);
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
