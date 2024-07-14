const SIZE = 32;
const SHIFT = 5; //Math.log2(SIZE);
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

const buildTrieWithMoreCapacityOnLeft = <T>(trie: Trie<T>): Trie<T> => {
  const newLevel = trie.level + SHIFT;
  if (isLeaf(trie)) {
    return new Node<T>([undefined, trie], newLevel);
  }
  return new Node<T>([undefined, trie], newLevel);
}

export class List<T> {
  private static EMPTY_LIST = new List<any>(new Leaf<any>([]), 0, 0);
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
    return new List(trie, input.length, 0);
  };

  private capacity: number;

  private constructor(
    private readonly root: Trie<T>,
    public readonly length: number,
    private readonly origin: number
  ) {
    this.capacity = 1 << (this.root.level + SHIFT);
  }

  private normalizeIndex = (index: number) => index + this.origin;
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
    return this.root.findValueAt(this.normalizeIndex(index));
  };

  push = (value: T) => {
    const insertionIndex = this.normalizeIndex(this.length);
    if (this.length >= this.capacity) { 
      const newRoot = buildHigherCapacityTrie(this.root);
      return new List<T>(newRoot.set(insertionIndex, value), this.length + 1, this.origin);
    }
    return new List<T>(this.root.set(insertionIndex, value), this.length + 1, this.origin);
  };

  pop = () => {
    return new List<T>(this.root, Math.max(this.length - 1, 0), this.origin);
  }

  with = (index: number, value: T): List<T> => {
    let newRoot = this.root;
    while (index >= newRoot.computeCapacity()) { 
      newRoot = buildHigherCapacityTrie(newRoot);
    }
    const newLength = index < this.length ? this.length : index + 1;
    return new List<T>(newRoot.set(this.normalizeIndex(index), value), newLength, this.origin);
  };

  shift = () => {
    if (this.isEmpty()) {
      return this;
    }
    return new List<T>(this.root, this.length - 1, this.origin + 1);
  }

  unshift = (value: T): List<T> => {
    if (this.origin === 0) {
      const newRoot = buildTrieWithMoreCapacityOnLeft(this.root);
      const newOrigin = (1 << newRoot.level) - 1;
      return new List<T>(newRoot, this.length + 1, newOrigin).with(0, value);
    }
    return new List<T>(this.root, this.length + 1, this.origin - 1).with(0, value);
  }; 

  slice = (start: number = 0, end: number = this.length): List<T> => {
    const startIndex = start < 0 ? (this.length + start) : start;
    const endIndex = end < 0 ? (this.length + end) : end;
    let newLength = endIndex - startIndex; 
    let newOrigin = this.origin; 
    if (startIndex) {
      newOrigin += startIndex;
    }

    if (newLength === this.length || newOrigin === this.origin) {
      return this;
    }

    return new List<T>(this.root, newLength, newOrigin);
  }

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