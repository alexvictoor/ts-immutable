import { describe, it, expect } from "vitest";

//peek
//push
// pop
// isEmpty
// of

type Link<T> = readonly [T, Stack<T>] | undefined;

class Stack<T> {
  private static EMPTY_STACK = new Stack<any>();
  public static empty = <T>(): Stack<T> => Stack.EMPTY_STACK;

  public static of = <T>(iterable: Iterable<T>) =>
    [...iterable]
      .reverse()
      .reduce((acc, item) => acc.push(item), Stack.empty());

  private constructor(private readonly top: Link<T> = undefined) {}

  push = (value: T): Stack<T> => new Stack([value, this]);

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

describe("Stack", () => {
  it("should be empty by default", () => {
    const stack = Stack.empty();
    expect(stack.isEmpty()).toBe(true);
  });

  it("should not be empty after push", () => {
    const stack = Stack.empty();
    const stack2 = stack.push(123);
    expect(stack.isEmpty()).toBe(true);
    expect(stack2.isEmpty()).not.toBe(true);
  });

  it("should peek value after push", () => {
    const stack = Stack.empty();
    const stack2 = stack.push(123);
    expect(stack2.peek()).toBe(123);
  });

  it("should remove value after pop", () => {
    const stack = Stack.empty();
    const stack2 = stack.push(123);
    const stack3 = stack2.pop();
    expect(stack3).toBe(stack);
  });

  it("should be iterable", () => {
    const stack = Stack.empty().push(123).push(42);

    expect([...stack]).toEqual([42, 123]);
  });

  it("should be created from an iterable", () => {
    const stack = Stack.of([1, 2, 3]);

    expect([...stack]).toEqual([1, 2, 3]);
  });
});
