const SIZE = 32;
const SHIFT = 5; //Math.log2(SIZE);
const MASK = SIZE - 1;

const emptyArray = (length: number) => Array.from({ length }, () => undefined);

const isIterable = <T>(obj: unknown): obj is Iterable<T> => {
  // checks for null and undefined
  if (obj == null) {
    return false;
  }
  return typeof obj[Symbol.iterator] === 'function';
}

type MutationBatchId = unknown;

// TODO type opaque treeindex

class Node<T> {
  constructor(
    public children: Array<Node<T> | undefined> | Array<Leaf<T> | undefined>,
    public level: number,
    private mutationBatchId?: MutationBatchId
  ) {}

  public computeCapacity = () => 1 << (this.level + SHIFT);

  private computeChildIndex = (index: number): number =>
    (index >> this.level) & MASK;

  private createNewEmptyChild = (mutationBatchId: MutationBatchId): Trie<T> =>
    this.level > SHIFT
      ? new Node<T>(new Array(SIZE), this.level - SHIFT, mutationBatchId)
      : new Leaf<T>(new Array(32));

  private isInSameBatch = (mutationBatchId?: MutationBatchId) =>
    mutationBatchId && mutationBatchId === this.mutationBatchId;

  findValueAt = (index: number): T | undefined => {
    const childrenIndex = this.computeChildIndex(index);
    return this.children[childrenIndex]?.findValueAt(index);
  };

  set = (
    updateIndex: number,
    updateValue: T | undefined,
    mutationBatchId: MutationBatchId
  ) => {
    const childrenIndex = this.computeChildIndex(updateIndex);
    const child =
      this.children[childrenIndex] || this.createNewEmptyChild(mutationBatchId);
    if (this.isInSameBatch(mutationBatchId)) {
      this.children[childrenIndex] = child.set(
        updateIndex,
        updateValue,
        mutationBatchId
      );
      return this;
    }
    const newChildren = this.children.slice();
    newChildren[childrenIndex] = child.set(
      updateIndex,
      updateValue,
      mutationBatchId
    );
    return new Node<T>(newChildren, this.level, mutationBatchId);
  };

  private doInsertLeaf = (
    index: number,
    leaf: Leaf<T> | undefined,
    mutationBatchId: MutationBatchId
  ) => {
    const childIndex = this.computeChildIndex(index);
    if (this.level === SHIFT) {
      if (this.isInSameBatch(mutationBatchId)) {
        this.children[childIndex] = leaf;
        return this;
      }
      const newChildren = this.children.slice();
      newChildren[childIndex] = leaf;
      return new Node<T>(newChildren, this.level, mutationBatchId);
    }
    const child = (this.children[childIndex] ||
      this.createNewEmptyChild(mutationBatchId)) as Node<T>;
    if (this.isInSameBatch(mutationBatchId)) {
      this.children[childIndex] = child.doInsertLeaf(
        index,
        leaf,
        mutationBatchId
      );
      return this;
    }
    const newChildren = this.children.slice();
    newChildren[childIndex] = child.doInsertLeaf(index, leaf, mutationBatchId);
    return new Node<T>(newChildren, this.level, mutationBatchId);
  };

  insertLeaf = (
    index: number,
    leaf: Leaf<T>,
    mutationBatchId: MutationBatchId
  ) => this.doInsertLeaf(index, leaf, mutationBatchId);

  removeLeaf = (
    index: number,
    mutationBatchId: MutationBatchId
  ) => this.doInsertLeaf(index, undefined, mutationBatchId);
  
  getLeaf = (index: number) => {
    const childrenIndex = this.computeChildIndex(index);
    const child = this.children[childrenIndex];

    if (!child) {
      return new Leaf([], this.mutationBatchId);
    }
    if (isLeaf(child)) {
      return this.children[childrenIndex];
    }
    return child.getLeaf(index);
  };

  // TODO index inclusif ou exclusif
  removeAfter = (index: number,  mutationBatchId: MutationBatchId
  ) => {
    const childIndex = this.computeChildIndex(index);
    const child = this.children[childIndex];
    const cleanChild = child ? child.removeAfter(index, mutationBatchId) : undefined;

    if (this.isInSameBatch(mutationBatchId)) {
      this.children.splice(childIndex, SIZE - childIndex);
      this.children[childIndex] = cleanChild;
      return this;
    }
    let newChildren = this.children.slice(0, childIndex);
    if (cleanChild) {
      newChildren.push(cleanChild as any);
    }
    return new Node<T>(newChildren, this.level, mutationBatchId);
  };

  // TODO index inclusif ou exclusif
  removeBefore = (index: number,  mutationBatchId: MutationBatchId
  ) => {
    const childIndex = this.computeChildIndex(index);
    const child = this.children[childIndex];
    const cleanChild = child ? child.removeBefore(index, mutationBatchId) : undefined;

    if (this.isInSameBatch(mutationBatchId)) {
      this.children.splice(0, childIndex, ...emptyArray(childIndex)); // TODO WTF
      this.children[childIndex] = cleanChild;
      return this;
    }
    let newChildren = this.children.slice().splice(0, childIndex, ...emptyArray(childIndex));
    if (cleanChild) {
      newChildren.push(cleanChild as any);
    }
    return new Node<T>(newChildren, this.level, mutationBatchId);
  };

  isLeaf = () => false;
  toJSON = () => this.children;
}

class Leaf<T> {
  public readonly level = 0;
  constructor(
    public children: Array<T | undefined>,
    private mutationBatchId?: MutationBatchId
  ) {}

  public computeCapacity = () => SIZE;

  private computeChildIndex = (index: number): number => index & MASK;

  private isInSameBatch = (mutationBatchId: MutationBatchId) =>
    mutationBatchId && mutationBatchId === this.mutationBatchId;

  findValueAt = (index: number): T | undefined => {
    const childrenIndex = (index >> this.level) & MASK;
    return this.children[childrenIndex];
  };

  set = (
    updateIndex: number,
    updateValue: T | undefined,
    mutationBatchId: MutationBatchId
  ) => {
    const childIndex = this.computeChildIndex(updateIndex);
    if (this.isInSameBatch(mutationBatchId)) {
      this.children[childIndex] = updateValue;
      return this;
    }
    const newChildren = this.children.slice();
    newChildren[childIndex] = updateValue;
    return new Leaf<T>(newChildren, mutationBatchId);
  };

  removeAfter = (index: number,  mutationBatchId: MutationBatchId
  ) => {
    const childIndex = this.computeChildIndex(index);
    
    if (this.isInSameBatch(mutationBatchId)) {
      this.children.splice(childIndex, SIZE - childIndex);
      return this;
    }
    
    const newChildren = this.children.slice(0, childIndex);
    return new Leaf<T>(newChildren, mutationBatchId);
  };

  removeBefore = (index: number,  mutationBatchId: MutationBatchId
  ) => {
    const childIndex = this.computeChildIndex(index);
    
    if (this.isInSameBatch(mutationBatchId)) {
      this.children.splice(0, childIndex, ...emptyArray(childIndex));
      return this;
    }
    const newChildren = this.children.slice();
    newChildren.splice(0, childIndex,  ...emptyArray(childIndex));
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

const buildHigherCapacityTrie = <T>(
  trie: Trie<T>,
  batchMutationId: MutationBatchId
): Node<T> => {
  const newLevel = trie.level + SHIFT;
  if (isLeaf(trie)) {
    return new Node<T>([trie], newLevel, batchMutationId);
  }
  return new Node<T>([trie], newLevel, batchMutationId);
};

const buildTrieWithMoreCapacityOnLeft = <T>(
  trie: Trie<T>,
  batchMutationId: MutationBatchId
): Trie<T> => {
  const newLevel = trie.level + SHIFT;
  if (isLeaf(trie)) {
    return new Node<T>([], newLevel, batchMutationId);
  }
  return new Node<T>([undefined, trie], newLevel, batchMutationId);
};

const buildMutationBatchId = () => new Object();

class MutableList<T> {
  protected capacity: number;

  protected constructor(
    protected root: Trie<T>,
    protected tail: Leaf<T>,
    protected length: number,
    protected origin: number,
    protected batchMutationId: MutationBatchId
  ) {
    this.updateCapacity();
  }

  protected updateState = (
    root: Trie<T>,
    tail: Leaf<T>,
    length: number,
    origin: number
  ) => {
    this.root = root;
    this.tail = tail;
    this.length = length;
    this.origin = origin;
    this.updateCapacity();
  };

  private updateCapacity = () => this.capacity = this.root.computeCapacity();

  protected stopMutations = () => (this.batchMutationId = undefined);
}

const getTailOffset = (size) => {
  return size < SIZE ? 0 : ((size - 1) >>> SHIFT) << SHIFT;
};

const EMPTY_LEAF = new Leaf<any>(new Array(32));

export class List<T> extends MutableList<T> implements Iterable<T> {
  private static readonly EMPTY_LIST = new List<any>(
    EMPTY_LEAF,
    EMPTY_LEAF,
    0,
    0
  );
  public static readonly empty = <T>(): List<T> => List.EMPTY_LIST;

  public static of = <T>(...input: Array<T>): List<T> => {
    if (input.length === 0) {
      return List.empty();
    }
    let offset = 0;
    const leafs = new Array<Leaf<T>>();
    while (offset < input.length) {
      leafs.push(new Leaf(input.slice(offset, offset + SIZE)));
      offset += SIZE;
    }
    const trie = buildTrie(leafs);
    return new List(trie, leafs[leafs.length - 1], input.length, 0);
  };

  private constructor(
    protected readonly root: Trie<T>,
    protected readonly tail: Leaf<T>,
    public readonly length: number,
    protected readonly origin: number,
    protected readonly batchMutationId: MutationBatchId = undefined
  ) {
    super(root, tail, length, origin, batchMutationId);
  }

  private normalizeIndex = (index: number) => index + this.origin;

  private buildMutableCopy = (): List<T> => {
    if (this.isMutableCopy()) {
      return this;
    }
    return new List(
      this.root,
      this.tail,
      this.length,
      this.origin,
      buildMutationBatchId()
    );
  };

  private buildImmutableCopy = (): List<T> => {
    if (!this.isMutableCopy()) {
      return this;
    }
    return new List(
      this.root,
      this.tail,
      this.length,
      this.origin,
    );
  };

  private isMutableCopy = (): boolean => !!this.batchMutationId;

  private createList = (
    root: Trie<T>,
    tail: Leaf<T>,
    length: number,
    origin: number
  ): List<T> => {
    // avoid to keep a reference to a useless leaf root
    if (isLeaf(root) && root !== tail) {
      return this.createList(tail, tail, length, origin);
    }

    if (this.isMutableCopy()) {
      this.updateState(root, tail, length, origin);
      return this;
    }
    return new List<T>(root, tail, length, origin);
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
    const treeIndex = this.normalizeIndex(index);
    if (getTailOffset(this.length + this.origin) <= treeIndex) {
      return this.tail.findValueAt(treeIndex);
    }
    return this.root.findValueAt(treeIndex);
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

  private pushASingleValue = (value: T) => {
    const insertionIndex = this.normalizeIndex(this.length);
    const tailOffset = getTailOffset(this.length + this.origin);

    if (insertionIndex === this.capacity) {
      const newRoot = buildHigherCapacityTrie(
        this.root,
        this.batchMutationId
      ).insertLeaf(tailOffset, this.tail, this.batchMutationId);
      const newTail = new Leaf<T>([value], this.batchMutationId);
      return this.createList(newRoot, newTail, this.length + 1, this.origin);
    }
    if (insertionIndex === tailOffset + SIZE) {
      const newTail = new Leaf<T>([value], this.batchMutationId);
      return this.createList(
        (this.root as Node<T>).insertLeaf(
          tailOffset,
          this.tail,
          this.batchMutationId
        ), 
        newTail,
        this.length + 1,
        this.origin
      );
    }

    return this.createList(
      this.root,
      this.tail.set(insertionIndex, value, this.batchMutationId),
      this.length + 1,
      this.origin
    );
  };

  push = (...values: Array<T>) => this.batchMutations(that => values.forEach(that.pushASingleValue))


  pop = () => this.batchMutations((that) => {
      const newLength = Math.max(this.length - 1, 0);
      if (newLength === 0) {
        const newTail = new Leaf<T>([]);
        that.createList(newTail, newTail, 0, 0);
      } else if (((that.origin + newLength) & MASK) === 0) {
        const root = that.root as Node<T>;
        const lastElementTreeIndex = Math.max(that.origin + newLength - 1, 0);
        const newTail = root.getLeaf(lastElementTreeIndex);
        const newRoot = root.removeLeaf(that.origin + newLength, that.batchMutationId).removeLeaf(lastElementTreeIndex, that.batchMutationId);
        that.createList(newRoot, newTail, newLength, that.origin);
      } else {
        const newTail = that.tail.set(that.origin + newLength, undefined, that.batchMutationId);
        that.createList(that.root, newTail, newLength, that.origin);
      }
    });

  private doSet = (index: number, value: T | undefined): List<T> => {
    let newRoot = this.root;
    let newTail = this.tail;

    const oldTailOffset = getTailOffset(this.length + this.origin);
    const treeIndex = this.normalizeIndex(index);

    // need at least one more layer
    if (treeIndex >= this.capacity) {
      newRoot = buildHigherCapacityTrie(
        newRoot,
        this.batchMutationId
      ).insertLeaf(oldTailOffset, this.tail, this.batchMutationId);
      newTail = new Leaf<T>([], this.batchMutationId);
      while (treeIndex >= newRoot.computeCapacity()) {
        newRoot = buildHigherCapacityTrie(newRoot, this.batchMutationId);
      }
    }

    const newLength = index < this.length ? this.length : index + 1;

    const newTailOffset = getTailOffset(newLength + this.origin);

    // tail needs to change
    if (newTailOffset > oldTailOffset) {
      newRoot = (newRoot as Node<T>).insertLeaf(
        oldTailOffset,
        this.tail,
        this.batchMutationId
      );
      newTail = new Leaf<T>([], this.batchMutationId);
    }

    // do we update the tail or the rest of the tree
    if (treeIndex >= newTailOffset) {
      newTail = newTail.set(treeIndex, value, this.batchMutationId);
    } else {
      newRoot = newRoot.set(
        treeIndex,
        value,
        this.batchMutationId
      );
    }

    return this.createList(newRoot, newTail, newLength, this.origin);
  };

  set = (index: number, value: T): List<T> => {
    const correctedIndex =  index < 0 ? this.length + index : index;
    if (correctedIndex < 0) {
      return this.batchMutations((that) => {
        for (let index = 0; index < -correctedIndex; index++) {
          that.unshift(undefined as any)
        }
        that.set(0, value);
      });
    }
    return this.doSet(correctedIndex, value);
  }

  shift = () => {
    if (this.isEmpty()) {
      return this;
    }
    return this.batchMutations((that) => {
      that.doSet(0, undefined);
      that.createList(that.root, that.tail, that.length - 1, that.origin + 1);
    });
  };

  unshift = (value: T): List<T> => {
    if (this.isEmpty()) {
      return this.set(0, value);
    }
    if (this.origin === 0) {
      const newRoot = buildTrieWithMoreCapacityOnLeft(
        this.root,
        this.batchMutationId
      );
      const newOrigin = (1 << newRoot.level) - 1;
      return this.batchMutations((that) =>
        that
          .createList(newRoot, that.tail, that.length + 1, newOrigin)
          .set(0, value)
      );
    }
    return this.batchMutations((that) =>
      that
        .createList(that.root, that.tail, that.length + 1, that.origin - 1)
        .set(0, value)
    );
  };

  private correctOutOfRangeIndex = (index: number) => index < 0 ? Math.max(this.length + index, 0) : Math.min(this.length, index);

  slice = (start: number = 0, end: number = this.length): List<T> => {
    const startIndex = this.correctOutOfRangeIndex(start);
    const endIndex = this.correctOutOfRangeIndex(end);
    let newLength = Math.max(0, endIndex - startIndex);
    let newOrigin = startIndex + this.origin;

    if (newLength === this.length) {
      return this;
    }

    const oldTailOffset = getTailOffset(this.length + this.origin);
    const newTailOffset = getTailOffset(newLength + newOrigin);

    return this.batchMutations((that) => {
      if (oldTailOffset === newTailOffset || isLeaf(that.root)) {
        const newTail = that.tail.removeAfter(newOrigin + newLength, that.batchMutationId).removeBefore(newOrigin, that.batchMutationId);
        return that.createList(that.root, newTail, newLength, newOrigin);
      }
  
      const newRoot = that.root.removeAfter(newOrigin + newLength, that.batchMutationId).removeBefore(newOrigin, that.batchMutationId);
      const newTail = newRoot.getLeaf(newTailOffset);
      return that.createList(newRoot, newTail, newLength, newOrigin);
    });
  };

  concat = (...params: Array<Iterable<T> | T>): List<T> => {
    const result = this.batchMutations(that => params.forEach(param => isIterable(param) ? that.push(...param) : that.push(param)));
    return result;
  }

  insert = (index: number, value: T): List<T> => {
    const normalizedIndex = Math.max(0, Math.min(index, this.length)); 
    if (!this.isMutableCopy()) {
      return this.slice(0, normalizedIndex).concat(value, this.slice(normalizedIndex));
    } 
    const safeCopy = this.buildImmutableCopy();
    const result = safeCopy.slice(0, normalizedIndex).concat(value, safeCopy.slice(normalizedIndex));
    this.updateState(result.root, result.tail, result.length, result.origin);
    return this;
  } 

  splice = (start: number, deleteCount?: number, ...items: Array<T>): List<T> => {

    const startIndex = this.correctOutOfRangeIndex(start);

    if (deleteCount === 0 && items.length === 0) {
      return this;
    }
    if (deleteCount === undefined) {
      return this.slice(0, startIndex);
    }

    const deleteCountNormalized = Math.max(0, deleteCount);

    if (!this.isMutableCopy()) {
      return this.slice(0, startIndex).concat(items).concat(this.slice(startIndex + deleteCountNormalized));
    }
    const safeCopy = this.buildImmutableCopy();
    const result = safeCopy.slice(0, startIndex).concat(items).concat(safeCopy.slice(startIndex + deleteCountNormalized));
    this.updateState(result.root, result.tail, result.length, result.origin);
    return this;
  }

  [Symbol.iterator] = () => {
    let currentIdex = -1;

    return {
      next: () => {
        if (currentIdex >= this.length - 1) {
          return { done: true, value: undefined } as IteratorResult<T>;
        }
        currentIdex++;
        const value = this.at(currentIdex);
        return { done: false, value } as IteratorResult<T>;
      },
    };
  };

  toJS = () => [...this];
}