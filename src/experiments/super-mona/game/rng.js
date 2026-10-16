/** 原 `random()`：Lehmer LCG，MINSTD 参数 */
export function createRng(seed) {
  let s = seed;
  return () => {
    s = (16807 * s) % 0x7fffffff;
    return (s - 1) / 0x7ffffffe;
  };
}

export const randomSeed = () => 1 + Math.floor(0x7ffffffd * Math.random());

/**
 * 从主种子派生一条**独立流**的种子。
 *
 * 同一个主种子永远派生出同一个值 —— 服务端重放时只拿到主种子，两边各自派生出
 * 相同的几条流，所以派生过程本身必须确定，不能用 `Math.random()`。
 */
export function deriveSeed(seed, salt) {
  const next = (16807 * (seed ^ salt) + 12345) % 0x7fffffff;
  return next || 1;
}

/** Fisher–Yates（原 `shuffle`） */
export function shuffle(arr, rnd) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
