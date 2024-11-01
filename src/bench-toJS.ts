import { Bench } from "tinybench";
import { List } from "../dist";
import Immutable from "immutable";

const range = (start: number, end: number) =>
  Array.from({ length: end - start }, (_, index) => index + start);

const main = async () => {
  const bench = new Bench({ time: 1000, warmupTime: 1000, warmupIterations: 100 });

  const data = range(0, 3000);
  const list = List.of(...data);
  const iList = Immutable.List.of(...data);

  bench

    .add("List", () => {
      let result = 0;
      list.toJS().forEach((item) => {
        result += item;
      });
    })
    .add("Immutable List", () => {
      let result = 0;
      iList.toJS().forEach((item) => {
        result += item;
      });
    })

  await bench.run();

  console.table(bench.table());
};
main();
