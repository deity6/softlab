/**
 * 全站唯一的「指针位置」输入源。
 *
 * 桌面：真实 pointermove 往这里写。
 * 触摸：HERO 光球每帧把自己的位置往这里写。
 *                        ↓
 *                  消费方只读这里（ElasticText 的标题躲避，以后别的效果也能接）
 *
 * 于是球**不是**"伪造的 PointerEvent"，而是一个**真正的指针位置** ——
 * 这也正好回避了"合成事件"那条路上最脏的问题：真实手指的事件混进来，难以过滤。
 *
 * 抽这一层还带来一个便宜的好处：想让别的指针驱动的效果（卡片光斑…）
 * 也响应这个球，改的只是它们的读取点，不用再动球。
 */
export interface VirtualPointer {
  /** 视口坐标。没在用时是 -9999（和 ElasticText 原来的哨兵值一致） */
  x: number;
  y: number;
  active: boolean;
  /**
   * 光球接管期间为 true：真实指针的写入会被忽略。
   * 不设这个标志的话，桌面 `?vp=1` 调试时鼠标和球会抢同一个坐标，
   * 字会来回抖 —— 两个源必须有一个让位。
   */
  hijacked: boolean;
}

export const virtualPointer: VirtualPointer = {
  x: -9999,
  y: -9999,
  active: false,
  hijacked: false,
};
