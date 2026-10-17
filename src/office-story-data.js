// 文学叙事与数值说明分开；每条来件只有一次入口。
export const STORY_WEEKS = [3, 6, 19, 32, 45, 52, 58, 65, 71, 84, 91, 97, 110, 117, 123, 130, 136, 149];
export function story(id, index, title, speaker, text, county, help, check, result, cost = { silver: 4, ap: 1 }, gain = { cooperation: 2 }, checkResult) {
  return {
    id, week: STORY_WEEKS[index], title, speaker, text, county, maxAppearances: 1,
    options: [
      { id: "help", label: help, cost, after: 2, gain, result },
      { id: "check", label: check, cost: { ap: 1 }, after: 3, gain: { cooperation: 1 }, result: checkResult },
      { id: "delegate", label: "交属员按常例办理，留卷待查", cost: {}, after: 0, gain: {}, result: "交属员跟办；本次不计亲办查验成果。" },
    ],
  };
}
