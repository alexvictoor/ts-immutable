const SIZE = 32;
const SHIFT = 5; //Math.log2(SIZE);
const MASK = SIZE - 1;

type MutationBatchId = unknown | undefined;

class Node<T> {
  constructor(
    public children: Array<Node<T> | undefined> | Array<Leaf<T> | undefined>,
    public level: number,
    private mutationBatchId?: MutationBatchId
  ) {}

  public computeCapacity = () => 1 << (this.level + SHIFT);

  private computeChildrenIndex = (index: number): number =>
    (index >> this.level) & MASK;

  private createNewEmptyChild = (mutationBatchId: MutationBatchId): Trie<T> =>
    this.level > SHIFT ? new Node<T>(new Array(SIZE), this.level - SHIFT, mutationBatchId) : new Leaf<T>(new Array(32));

  private isInSameBatch = (mutationBatchId?: MutationBatchId) => mutationBatchId && (mutationBatchId === this.mutationBatchId);


  findValueAt = (index: number): T | undefined => {
    const childrenIndex = this.computeChildrenIndex(index);
    return this.children[childrenIndex]?.findValueAt(index);
  };

  //swallowCopy =  () => new Node<T>(this.children.slice(), this.level);

  set = (updateIndex: number, updateValue: T, mutationBatchId: MutationBatchId) => {
    const childrenIndex = this.computeChildrenIndex(updateIndex);
    const child = this.children[childrenIndex] || this.createNewEmptyChild(mutationBatchId);
    if (this.isInSameBatch(mutationBatchId)) {
      this.children[childrenIndex] = child.set(updateIndex, updateValue, mutationBatchId);
      return this;
    }
    const newChildren = this.children.slice();
    newChildren[childrenIndex] = child.set(updateIndex, updateValue, mutationBatchId);
    return new Node<T>(newChildren, this.level, mutationBatchId);
  };

  isLeaf = () => false;
  toJSON = () => this.children;
}

class Leaf<T> {
  public readonly level = 0;
  constructor(public children: Array<T | undefined>, private mutationBatchId?: MutationBatchId) {}

  public computeCapacity = () => SIZE;

  private computeChildrenIndex = (index: number): number => index & MASK;

  private isInSameBatch = (mutationBatchId: MutationBatchId) => mutationBatchId && (mutationBatchId === this.mutationBatchId);


  findValueAt = (index: number): T | undefined => {
    const childrenIndex = (index >> this.level) & MASK;
    return this.children[childrenIndex];
  };

  set = (updateIndex: number, updateValue: T, mutationBatchId: MutationBatchId) => {
    const childrenIndex = this.computeChildrenIndex(updateIndex);
    if (this.isInSameBatch(mutationBatchId)) {
      this.children[childrenIndex] = updateValue;
      return this;
    }
    const newChildren = this.children.slice();
    newChildren[childrenIndex] = updateValue;
    return new Leaf<T>(newChildren, mutationBatchId);
  };

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

const buildHigherCapacityTrie = <T>(trie: Trie<T>, batchMutationId: MutationBatchId): Trie<T> => {
  const newLevel = trie.level + SHIFT;
  if (isLeaf(trie)) {
    return new Node<T>([trie], newLevel, batchMutationId);
  }
  return new Node<T>([trie], newLevel, batchMutationId);
};

const buildTrieWithMoreCapacityOnLeft = <T>(trie: Trie<T>, batchMutationId: MutationBatchId): Trie<T> => {
  const newLevel = trie.level + SHIFT;
  if (isLeaf(trie)) {
    return new Node<T>([undefined, trie], newLevel, batchMutationId);
  }
  return new Node<T>([undefined, trie], newLevel, batchMutationId);
};

const buildMutationBatchId = () => new Object();


class MutableList<T> {

  protected capacity: number;

  protected constructor(
    protected root: Trie<T>,
    protected length: number,
    protected origin: number,
    protected batchMutationId: MutationBatchId
  ) {
    this.updateCapacity();
  }

  protected updateState = (root: Trie<T>, length: number, origin: number) => {
    this.root = root;
    this.length = length;
    this.origin = origin;
    this.updateCapacity();
  };

  private updateCapacity = () => this.capacity = 1 << (this.root.level + SHIFT);

  protected stopMutations = () => this.batchMutationId = undefined;
}

export class List<T> extends MutableList<T> {
  private static readonly EMPTY_LIST = new List<any>(new Leaf<any>(new Array(32)), 0, 0);
  public static readonly empty = <T>(): List<T> => List.EMPTY_LIST;

  public static of = <T>(...input: Array<T>) => {
    let offset = 0;
    const leafs = new Array<Leaf<T>>();
    while (offset < input.length) {
      leafs.push(new Leaf(input.slice(offset, offset + SIZE)));
      offset += SIZE;
    }
    const trie = buildTrie(leafs);
    return new List(trie, input.length, 0);
  };

  private constructor(
    protected readonly root: Trie<T>,
    public readonly length: number,
    protected readonly origin: number,
    protected readonly batchMutationId: MutationBatchId = undefined
  ) {
    super(root, length, origin, batchMutationId);
    this.capacity = 1 << (this.root.level + SHIFT);
  }

  private normalizeIndex = (index: number) => index + this.origin;

  private buildMutableCopy = (): List<T> => {
    return new List(
      this.root,
      this.length,
      this.origin,
      buildMutationBatchId()
    );
  };

  private isMutableCopy = (): boolean => !!this.batchMutationId;

  private createList = (root: Trie<T>, length: number, origin: number) => {
    if (this.isMutableCopy()) {
      this.updateState(root, length, origin);
      return this;
    }
    return new List<T>(root, length, origin);
  };

  private equals = (other: List<T>): boolean =>
    this.root === other.root &&
    this.length === other.length &&
    this.origin === other.origin;


  isEmpty = () => this.length === 0;

  at = (index: number) => {
    if (index >= this.length) {
      return undefined;
    }
    return this.root.findValueAt(this.normalizeIndex(index));
  };

  batchMutations = (runMutations: (mutableCopy: List<T>) => void): List<T> => {
    const copy = this.buildMutableCopy();
    runMutations(copy);
    if (this.equals(copy)) {
      return this;
    }
    copy.stopMutations();
    return copy;
  };

  push = (value: T) => {
    const insertionIndex = this.normalizeIndex(this.length);
    if (insertionIndex >= this.capacity) {
      const newRoot = buildHigherCapacityTrie(this.root, this.batchMutationId);
      return this.createList(
        newRoot.set(insertionIndex, value, this.batchMutationId),
        this.length + 1,
        this.origin
      );
    }
    return this.createList(
      this.root.set(insertionIndex, value, this.batchMutationId),
      this.length + 1,
      this.origin
    );
  };

  pop = () => {
    return this.createList(this.root, Math.max(this.length - 1, 0), this.origin);
  };

  with = (index: number, value: T): List<T> => {
    let newRoot = this.root;
    while (index >= newRoot.computeCapacity()) {
      newRoot = buildHigherCapacityTrie(newRoot, this.batchMutationId);
    }
    const newLength = index < this.length ? this.length : index + 1;
    return this.createList(
      newRoot.set(this.normalizeIndex(index), value, this.batchMutationId),
      newLength,
      this.origin
    );
  };

  shift = () => {
    if (this.isEmpty()) {
      return this;
    }
    return this.createList(this.root, this.length - 1, this.origin + 1);
  };

  unshift = (value: T): List<T> => {
    if (this.origin === 0) {
      const newRoot = buildTrieWithMoreCapacityOnLeft(this.root, this.batchMutationId);
      const newOrigin = (1 << newRoot.level) - 1;
      return this.createList(newRoot, this.length + 1, newOrigin).with(0, value);
    }
    return this.createList(this.root, this.length + 1, this.origin - 1).with(
      0,
      value
    );
  };

  slice = (start: number = 0, end: number = this.length): List<T> => {
    const startIndex = start < 0 ? Math.max(this.length + start, 0) : start;
    const endIndex = end < 0 ? Math.max(this.length + end, 0) : end;
    let newLength = endIndex - startIndex;
    let newOrigin = startIndex;

    if (newLength === this.length && newOrigin === this.origin) {
      return this;
    }

    return new List<T>(this.root, newLength, newOrigin);
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
