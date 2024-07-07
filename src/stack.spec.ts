import { describe, it, expect } from "vitest";
import { Stack } from "./stack";



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
  it("should push several values", () => {
    const stack = Stack.empty();
    const stack2 = stack.push(123, 46);
    expect(stack2.peek()).toBe(46);
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

  it("should be created from arguments", () => {
    const stack = Stack.of(1, 2, 3);

    expect([...stack]).toEqual([1, 2, 3]);
  });
});
