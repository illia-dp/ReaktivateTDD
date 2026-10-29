import { autorun, observable, runInAction } from "mobx";
import { expect, test } from "vitest";

test("MobX batches observable updates and stops observing after disposal", () => {
  const state = observable({ count: 0 });
  const observed: number[] = [];
  const dispose = autorun(() => observed.push(state.count));

  try {
    runInAction(() => {
      state.count = 1;
      state.count = 2;
    });
    expect(observed).toEqual([0, 2]);
  } finally {
    dispose();
  }

  runInAction(() => {
    state.count = 3;
  });
  expect(observed).toEqual([0, 2]);
});
