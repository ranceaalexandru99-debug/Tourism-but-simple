// Central SVG icon layer (lucide-react). Every UI icon in the app goes through
// this module so sizing/coloring stays consistent and swapping the icon set
// later means touching one file. Icons inherit `currentColor` by default.
//
// What stays emoji on purpose: country flags (semantic content with no SVG
// equivalent in an icon set) and emojis embedded in translated copy strings.

export {
  // navigation / chrome
  Home, Map, Camera, User, Search, History, Signal, BatteryFull,
  ChevronRight, ChevronDown, ArrowRight, ArrowUp, ArrowLeftRight, X, Plus, Check,
  // trip & route
  MapPin, Landmark, TreePine, Drama, ShoppingBag, Users, Utensils, Martini,
  Compass, Navigation, Footprints, Route as RouteIcon, Plane, LocateFixed,
  Ticket, TrainFront, Clock, Hourglass, Timer, Moon, Sun, Sunrise,
  // actions
  Share2, Save, Pencil, Trash2, Undo2, RefreshCw, Zap, Eye, EyeOff,
  LayoutGrid, List, NotebookPen, Lightbulb, TriangleAlert, Star, Turtle, Scale,
  // cards & info
  Wallet, Coins, Banknote, Backpack, Gem, MessagesSquare, MessageCircle,
  Hand, Heart, Bath, LifeBuoy, Ambulance, Plug, Globe, Palette,
  PartyPopper, Sparkles, CircleCheck, FileText, Calendar, QrCode, Link2, Mail,
  Lock, KeyRound, LogOut, UserX, WifiOff, Smile, Gift, CloudRain, Bus, Loader, Image,
  ThumbsUp, Handshake, Vote, Film,
} from "lucide-react";

import {
  Landmark as _Landmark, Utensils as _Utensils, TreePine as _TreePine,
  Martini as _Martini, ShoppingBag as _ShoppingBag, Users as _Users,
  MapPin as _MapPin, Sun as _Sun, CloudSun, CloudFog, CloudRain, CloudSnow,
  CloudDrizzle, CloudLightning, Thermometer,
} from "lucide-react";

// Interest/tag → icon. First matching tag wins; order roughly "most defining".
const CAT_ICONS = [
  ["culture", _Landmark],
  ["food", _Utensils],
  ["nature", _TreePine],
  ["nightlife", _Martini],
  ["shopping", _ShoppingBag],
  ["family", _Users],
];

// Icon for a stop / trip based on its tags or interests array.
// Used everywhere a data emoji used to render (stop rows, trip tiles, heroes).
export function CategoryIcon({ tags, size = 20, color, strokeWidth = 2, style }) {
  const list = Array.isArray(tags) ? tags : tags ? [tags] : [];
  const hit = CAT_ICONS.find(([tag]) => list.includes(tag));
  const Cmp = hit ? hit[1] : _MapPin;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} style={style} />;
}

// Weather code (weather.js codeInfo) → icon.
const WX_ICONS = {
  clear: _Sun, partly: CloudSun, fog: CloudFog, rain: CloudRain,
  snow: CloudSnow, showers: CloudDrizzle, storm: CloudLightning,
};
export function WeatherIcon({ code, size = 16, color, style }) {
  const Cmp = WX_ICONS[code] || Thermometer;
  return <Cmp size={size} color={color} style={style} />;
}
