// Ícones Feather (react-icons/fi) por conquista e por tipo de atividade.
import {
  FiPackage,
  FiLayers,
  FiArchive,
  FiGlobe,
  FiFlag,
  FiCheckCircle,
  FiAward,
  FiShield,
  FiClock,
  FiBookOpen,
  FiCalendar,
  FiTag,
  FiShoppingCart,
  FiStar,
  FiFolder,
  FiTarget,
  FiTrendingUp,
  FiPlusSquare,
  FiHeart,
  FiPlay,
  FiChevronsUp,
  FiFolderPlus,
} from 'react-icons/fi';

export const ACHIEVEMENT_ICONS = {
  package: FiPackage,
  layers: FiLayers,
  archive: FiArchive,
  globe: FiGlobe,
  flag: FiFlag,
  'check-circle': FiCheckCircle,
  award: FiAward,
  shield: FiShield,
  clock: FiClock,
  'book-open': FiBookOpen,
  calendar: FiCalendar,
  tag: FiTag,
  'shopping-cart': FiShoppingCart,
  star: FiStar,
  folder: FiFolder,
  target: FiTarget,
  'trending-up': FiTrendingUp,
};

export const ACTIVITY_ICONS = {
  GAME_ADDED: FiPlusSquare,
  WISHLIST_ADDED: FiHeart,
  GAME_STARTED: FiPlay,
  GAME_COMPLETED: FiFlag,
  SESSION_LOGGED: FiClock,
  GAME_RATED: FiStar,
  ACHIEVEMENT_UNLOCKED: FiAward,
  LEVEL_UP: FiChevronsUp,
  COLLECTION_CREATED: FiFolderPlus,
  WISHLIST_PURCHASED: FiShoppingCart,
  GOAL_COMPLETED: FiTarget,
};


// Cor de cada tipo de atividade (classe Tailwind de texto)
export const ACTIVITY_TONE = {
  ACHIEVEMENT_UNLOCKED: 'text-amber',
  LEVEL_UP: 'text-violet',
  GOAL_COMPLETED: 'text-violet',
  GAME_COMPLETED: 'text-ok',
  WISHLIST_ADDED: 'text-magenta',
  WISHLIST_PURCHASED: 'text-magenta',
  SESSION_LOGGED: 'text-blue',
};
