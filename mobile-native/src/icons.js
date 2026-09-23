// Central SVG icon layer for native (lucide-react-native over react-native-svg).
// Mirrors src/icons.jsx on web: UI chrome is icon-based; emojis remain only in
// content (country flags, food lists, people avatars).

export {
  Home, Map, Camera, User, Search, History, Signal, BatteryFull,
  ChevronRight, ChevronUp, ChevronDown, ArrowRight, ArrowLeftRight, X, Plus, Check,
  MapPin, Landmark, TreePine, Drama, ShoppingBag, Users, Utensils, Martini,
  Compass, Navigation, Footprints, Plane, Ticket, TrainFront, Clock, Hourglass,
  Moon, Sun, Sunrise, Share2, Save, Pencil, Trash2, Undo2, RefreshCw, Zap,
  Eye, EyeOff, LayoutGrid, NotebookPen, Lightbulb, TriangleAlert, Star, Turtle,
  Scale, Wallet, Coins, Banknote, Backpack, Gem, MessagesSquare, MessageCircle,
  Hand, Heart, Bath, LifeBuoy, Ambulance, Plug, Globe, Palette, PartyPopper,
  Sparkles, CircleCheck, Lock, KeyRound, LogOut, Smile, Gift, Loader, List, Film,
  Link2, ThumbsUp, Handshake, Vote,
} from "lucide-react-native";

import { createElement } from "react";
import {
  Landmark as _Landmark, Utensils as _Utensils, TreePine as _TreePine,
  Martini as _Martini, ShoppingBag as _ShoppingBag, Users as _Users,
  MapPin as _MapPin, Sun as _Sun, CloudSun, CloudFog, CloudRain, CloudSnow,
  CloudDrizzle, CloudLightning, Thermometer,
} from "lucide-react-native";

// Interest/tag → icon. First matching tag wins; order roughly "most defining".
const CAT_ICONS = [
  ["culture", _Landmark],
  ["food", _Utensils],
  ["nature", _TreePine],
  ["nightlife", _Martini],
  ["shopping", _ShoppingBag],
  ["family", _Users],
];

// Icon for a stop / trip based on its tags or interests array — used wherever
// a data emoji used to render (stop rows, trip tiles, heroes).
export function CategoryIcon({ tags, size = 20, color, strokeWidth = 2, style }) {
  const list = Array.isArray(tags) ? tags : tags ? [tags] : [];
  const hit = CAT_ICONS.find(([tag]) => list.includes(tag));
  const Cmp = hit ? hit[1] : _MapPin;
  return createElement(Cmp, { size, color, strokeWidth, style });
}

// Weather code (the `code` weather.js returns) → icon. The same seven the web
// app uses, so a rainy Tuesday looks the same on both.
const WX_ICONS = {
  clear: _Sun, partly: CloudSun, fog: CloudFog, rain: CloudRain,
  snow: CloudSnow, showers: CloudDrizzle, storm: CloudLightning,
};

export function WeatherIcon({ code, size = 16, color, style }) {
  return createElement(WX_ICONS[code] || Thermometer, { size, color, style });
}
