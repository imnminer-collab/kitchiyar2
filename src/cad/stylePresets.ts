import { CABINET_FINISHES } from './constants';
import {
  BacksplashFinishId,
  CabinetFinishId,
  CountertopFinishId,
  DesignStyle,
  DoorStyle,
  HandleStyle,
  ProjectState,
} from './types';

export interface KitchenStylePreset {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  designStyle: DesignStyle;
  cabinetFinish: CabinetFinishId;
  upperCabinetFinish?: CabinetFinishId;
  backsplashFinish: BacksplashFinishId;
  countertopFinish: CountertopFinishId;
  doorStyle: DoorStyle;
  handleStyle: HandleStyle;
  defaultHoodKind: 'chimney' | 'hidden';
}

export const KITCHEN_STYLE_PRESETS: KitchenStylePreset[] = [
  {
    id: 'reference-cream',
    title: 'کرم مینیمال گرم',
    subtitle: 'کشمیر مات، صفحه چوب بلوط و هود مخفی',
    image: './assets/styles/reference-cream.webp',
    designStyle: 'modern',
    cabinetFinish: 'cashmere',
    backsplashFinish: 'warm-travertine',
    countertopFinish: 'oak-butcher',
    doorStyle: 'flat',
    handleStyle: 'hidden',
    defaultHoodKind: 'hidden',
  },
  {
    id: 'reference-classic',
    title: 'نئوکلاسیک سفید',
    subtitle: 'درب ابزارخورده CNC، دستگیره قارچی و مرمر سفید',
    image: './assets/styles/reference-classic.webp',
    designStyle: 'neoclassic',
    cabinetFinish: 'warm-white',
    backsplashFinish: 'calacatta-marble',
    countertopFinish: 'calacatta-top',
    doorStyle: 'cnc',
    handleStyle: 'knob',
    defaultHoodKind: 'chimney',
  },
  {
    id: 'reference-green',
    title: 'سبز مریم‌گلی کلاسیک',
    subtitle: 'نئوکلاسیک سبز، دستگیره قارچی و صفحه چوب بلوط',
    image: './assets/styles/reference-green.webp',
    designStyle: 'neoclassic',
    cabinetFinish: 'sage-green',
    backsplashFinish: 'warm-travertine',
    countertopFinish: 'oak-butcher',
    doorStyle: 'cnc',
    handleStyle: 'knob',
    defaultHoodKind: 'chimney',
  },
  {
    id: 'walnut-sage',
    title: 'چوب گردویی و سبز',
    subtitle: 'ترکیب دو رنگ گردویی و سبز مریم‌گلی با کاشی مدرن',
    image: './assets/styles/walnut-sage.webp',
    designStyle: 'modern',
    cabinetFinish: 'sage-green',
    upperCabinetFinish: 'walnut',
    backsplashFinish: 'hex-sage',
    countertopFinish: 'calacatta-top',
    doorStyle: 'flat',
    handleStyle: 'simple',
    defaultHoodKind: 'chimney',
  },
  {
    id: 'modern-oak',
    title: 'بلوط طبیعی مدرن',
    subtitle: 'نما چوب بلوط، دستگیره مخفی و کاشی تراورتن',
    image: './assets/styles/modern-oak.webp',
    designStyle: 'modern',
    cabinetFinish: 'natural-oak',
    backsplashFinish: 'warm-travertine',
    countertopFinish: 'calacatta-top',
    doorStyle: 'flat',
    handleStyle: 'hidden',
    defaultHoodKind: 'hidden',
  },
  {
    id: 'graphite',
    title: 'گرافیت آنتراسیت',
    subtitle: 'ذغالی مات یکدست، صفحه تیره و بین‌کابینتی جناغی',
    image: './assets/styles/graphite.webp',
    designStyle: 'modern',
    cabinetFinish: 'charcoal',
    backsplashFinish: 'herringbone-charcoal',
    countertopFinish: 'dark-quartz',
    doorStyle: 'flat',
    handleStyle: 'hidden',
    defaultHoodKind: 'chimney',
  },
  {
    id: 'soft-cream',
    title: 'کرم قاب‌دار آرام',
    subtitle: 'درب CNC ملایم، دستگیره خطی و سنگ روشن',
    image: './assets/styles/soft-cream.webp',
    designStyle: 'neoclassic',
    cabinetFinish: 'cashmere',
    backsplashFinish: 'subway-white',
    countertopFinish: 'calacatta-top',
    doorStyle: 'cnc',
    handleStyle: 'simple',
    defaultHoodKind: 'chimney',
  },
  {
    id: 'reference-grey',
    title: 'گریژ و سنگ تیره',
    subtitle: 'طوسی بژ مدرن، کوارتز مشکی و هود توکار',
    image: './assets/styles/reference-grey.webp',
    designStyle: 'modern',
    cabinetFinish: 'greige',
    backsplashFinish: 'herringbone-charcoal',
    countertopFinish: 'dark-quartz',
    doorStyle: 'flat',
    handleStyle: 'hidden',
    defaultHoodKind: 'hidden',
  },
  {
    id: 'reference-white',
    title: 'سفید نئوکلاسیک روشن',
    subtitle: 'درب قاب‌دار سفید، دستگیره قارچی و صفحه کوارتز سفید',
    image: './assets/styles/reference-white.webp',
    designStyle: 'neoclassic',
    cabinetFinish: 'warm-white',
    backsplashFinish: 'subway-white',
    countertopFinish: 'calacatta-top',
    doorStyle: 'cnc',
    handleStyle: 'knob',
    defaultHoodKind: 'chimney',
  },
];

export function applyKitchenStylePreset(
  project: ProjectState,
  presetId: string
): { next: ProjectState; preset: KitchenStylePreset } | null {
  const preset = KITCHEN_STYLE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;

  const next: ProjectState = JSON.parse(JSON.stringify(project));
  next.designStyle = preset.designStyle;
  next.cabinetFinish = preset.cabinetFinish;
  next.backsplashFinish = preset.backsplashFinish;
  next.countertopFinish = preset.countertopFinish;
  next.skipStylePrompt = true;
  if (next.settings) {
    next.settings.defaultHoodKind = preset.defaultHoodKind;
  }

  for (const wall of next.walls) {
    for (const box of wall.boxes) {
      if (box.type === 'fridge') continue;
      if (
        preset.upperCabinetFinish &&
        (box.type === 'wall' || box.type === 'wall-deep')
      ) {
        box.finish = preset.upperCabinetFinish;
      } else {
        delete box.finish;
      }

      for (const door of box.doors) {
        if (door.kind === 'door' || door.kind === 'drawer' || door.kind === 'lift') {
          if (door.doorStyle !== 'glass' && door.doorStyle !== 'glass-grid' && door.doorStyle !== 'pantry') {
            door.doorStyle = preset.doorStyle;
          }
        }
      }
      for (const handle of box.handles) {
        handle.style = preset.handleStyle;
      }
    }
    for (const app of wall.appliances) {
      if (app.kind === 'gas') {
        app.hoodKind = preset.defaultHoodKind;
      }
    }
  }

  // Validate finish existence fallback
  if (!CABINET_FINISHES[next.cabinetFinish]) {
    next.cabinetFinish = 'warm-white';
  }

  return { next, preset };
}
