/** 原 `random()`：Lehmer LCG，MINSTD 参数 */
export function createRng(seed) {
  let s = seed;
  return () => {
    s = (16807 * s) % 0x7fffffff;
    return (s - 1) / 0x7ffffffe;
  };
}

export const randomSeed = () => 1 + Math.floor(0x7ffffffd * Math.random());

/** Fisher–Yates（原 `shuffle`） */
export function shuffle(arr, rnd) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
