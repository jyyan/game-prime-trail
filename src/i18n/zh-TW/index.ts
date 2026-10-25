import { app } from './app';
import { board } from './board';
import { common } from './common';
import { conflict } from './conflict';
import { deadEnd } from './deadEnd';
import { demo } from './demo';
import { difficulty } from './difficulty';
import { help } from './help';
import { home } from './home';
import { input } from './input';
import { pdf } from './pdf';
import { picker } from './picker';
import { play } from './play';
import { solution } from './solution';
import { status } from './status';
import { win } from './win';

export const zhTW = {
  app,
  common,
  difficulty,
  board,
  conflict,
  input,
  status,
  picker,
  win,
  solution,
  pdf,
  play,
  home,
  help,
  demo,
  deadEnd,
} as const;
