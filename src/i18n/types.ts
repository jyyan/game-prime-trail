import type { zhTW } from './zh-TW';

export type Messages = typeof zhTW;

/** Union of dot-separated paths to every string leaf of `T`. */
export type DotPath<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotPath<T[K]>}`;
}[keyof T & string];

export type MessageKey = DotPath<Messages>;

export type Locale = 'zh-TW';
