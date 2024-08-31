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
    this.level > SHIFT
      ? new Node<T>(new Array(SIZE), this.level - SHIFT, mutationBatchId)
      : new Leaf<T>(new Array(32));

  private isInSameBatch = (mutationBatchId?: MutationBatchId) =>
    mutationBatchId && mutationBatchId === this.mutationBatchId;

  findValueAt = (index: number): T | undefined => {
    const childrenIndex = this.computeChildrenIndex(index);
    return this.children[childrenIndex]?.findValueAt(index);
  };

  set = (
    updateIndex: number,
    updateValue: T | undefined,
    mutationBatchId: MutationBatchId
  ) => {
    const childrenIndex = this.computeChildrenIndex(updateIndex);
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

  insertLeaf = (
    index: number,
    leaf: Leaf<T>,
    mutationBatchId: MutationBatchId
  ) => {
    const childrenIndex = this.computeChildrenIndex(index);
    if (this.level === SHIFT) {
      if (this.isInSameBatch(mutationBatchId)) {
        this.children[childrenIndex] = leaf;
        return this;
      }
      const newChildren = this.children.slice();
      newChildren[childrenIndex] = leaf;
      return new Node<T>(newChildren, this.level, mutationBatchId);
    }
    const child = (this.children[childrenIndex] ||
      this.createNewEmptyChild(mutationBatchId)) as Node<T>;
    if (this.isInSameBatch(mutationBatchId)) {
      this.children[childrenIndex] = child.insertLeaf(
        index,
        leaf,
        mutationBatchId
      );
      return this;
    }
    const newChildren = this.children.slice();
    newChildren[childrenIndex] = child.insertLeaf(index, leaf, mutationBatchId);
    return new Node<T>(newChildren, this.level, mutationBatchId);
  };

  getLeaf = (index: number) => {
    const childrenIndex = this.computeChildrenIndex(index);
    const child = this.children[childrenIndex];

    if (!child) {
      return new Leaf([], this.mutationBatchId);
    }
    if (isLeaf(child)) {
      return this.children[childrenIndex];
    }
    return child.getLeaf(index);
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

  private computeChildrenIndex = (index: number): number => index & MASK;

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
    return new Node<T>([undefined, trie], newLevel, batchMutationId);
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

  private updateCapacity = () =>
    (this.capacity = 1 << (this.root.level + SHIFT));

  protected stopMutations = () => (this.batchMutationId = undefined);
}

const getTailOffset = (size) => {
  return size < SIZE ? 0 : ((size - 1) >>> SHIFT) << SHIFT;
};

const EMPTY_LEAF = new Leaf<any>(new Array(32));

export class List<T> extends MutableList<T> {
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
    this.capacity = 1 << (this.root.level + SHIFT);
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

  push = (value: T) => {
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

  pop = () => {
    const newLength = Math.max(this.length - 1, 0);

    return this.batchMutations((that) => {
      that.set(newLength, undefined);
      let newTail = that.tail;
      let newRoot = that.root;

      if ((newLength & MASK) === 0) {
        if (isLeaf(that.root)) {
          newTail = that.root;
        } else {
          newRoot = that.root.insertLeaf(
            newLength,
            newTail,
            that.batchMutationId
          );
          newTail = newRoot.getLeaf(Math.max(newLength - 1, 0));
        }
      }
      that.createList(newRoot, newTail, newLength, that.origin);
    });
  };

  private set = (index: number, value: T | undefined): List<T> => {
    let newRoot = this.root;
    let newTail = this.tail;

    const oldTailOffset = getTailOffset(this.length + this.origin);
    // need at least one more layer
    if (index >= this.capacity) {
      newRoot = buildHigherCapacityTrie(
        newRoot,
        this.batchMutationId
      ).insertLeaf(oldTailOffset, this.tail, this.batchMutationId);
      newTail = new Leaf<T>([], this.batchMutationId);
      while (index >= newRoot.computeCapacity()) {
        newRoot = buildHigherCapacityTrie(newRoot, this.batchMutationId);
      }
    }

    const newLength = index < this.length ? this.length : index + 1;

    const treeIndex = this.normalizeIndex(index);
    const newTailOffset = getTailOffset(newLength + this.origin);

    // tail needs to change
    if (newTailOffset > oldTailOffset && oldTailOffset !== 0) {
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
        this.normalizeIndex(index),
        value,
        this.batchMutationId
      );
    }

    return this.createList(newRoot, newTail, newLength, this.origin);
  };

  with = (index: number, value: T): List<T> => this.set(index, value);

  shift = () => {
    if (this.isEmpty()) {
      return this;
    }
    return this.batchMutations((that) => {
      that.set(0, undefined);
      that.createList(that.root, that.tail, that.length - 1, that.origin + 1);
    });
  };

  unshift = (value: T): List<T> => {
    if (this.origin === 0) {
      const newRoot = buildTrieWithMoreCapacityOnLeft(
        this.root,
        this.batchMutationId
      );
      const newOrigin = (1 << newRoot.level) - 1;
      return this.batchMutations((that) =>
        that
          .createList(newRoot, this.tail, this.length + 1, newOrigin)
          .with(0, value)
      );
    }
    return this.batchMutations((that) =>
      that
        .createList(this.root, this.tail, this.length + 1, this.origin - 1)
        .with(0, value)
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

    return new List<T>(this.root, this.tail, newLength, newOrigin);
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
