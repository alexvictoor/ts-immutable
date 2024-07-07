type Link<T> = readonly [T, Stack<T>] | undefined;

export class Stack<T> {
  private static EMPTY_STACK = new Stack<any>();
  public static empty = <T>(): Stack<T> => Stack.EMPTY_STACK;

  public static of = <T>(...iterable: Array<T>): Stack<T> =>
    iterable.reverse().reduce((acc, item) => acc.push(item), Stack.empty<T>());

  private constructor(private readonly top: Link<T> = undefined) {}

  push = (...values: T[]): Stack<T> => {
    if (values.length === 0) {
      return this;
    }
    const [value, ...otherValues] = values;
    return new Stack([value, this]).push(...otherValues);
  };

  pop = (): Stack<T> => (this.top ? this.top[1] : this);

  peek = (): T | undefined => this.top && this.top[0];

  isEmpty = () => !this.top;

  [Symbol.iterator] = () => {
    let currentStack: Stack<T> = this;
    return {
      next: () => {
        if (currentStack.isEmpty()) {
          return { done: true, value: undefined };
        }
        const value = currentStack.peek();
        currentStack = currentStack.pop();
        return { done: false, value };
      },
    };
  };
}
