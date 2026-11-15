import React from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { DOOR_STYLE_META } from '../cad/constants';
import { KITCHEN_STYLE_PRESETS, KitchenStylePreset } from '../cad/stylePresets';

interface StyleGalleryModalProps {
  onApplyStyle: (preset: KitchenStylePreset) => void;
  onClose: () => void;
}

export const StyleGalleryModal: React.FC<StyleGalleryModalProps> = ({
  onApplyStyle,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="انتخاب استایل آشپزخانه از روی عکس"
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <div>
              <h2 className="text-sm font-black text-slate-900">استخراج استایل و رنگ از عکس نمونه</h2>
              <p className="text-[11px] text-slate-500">
                با انتخاب هر عکس، رنگ کابینت، سبک درب (مدرن یا نئوکلاسیک CNC)، صفحه، بین‌کابینتی و دستگیره روی پروژه اعمال می‌شود
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن گالری استایل"
            className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-500 inline-flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {KITCHEN_STYLE_PRESETS.map((preset) => (
            <div
              key={preset.id}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between hover:border-indigo-400 hover:shadow-md transition"
            >
              <div>
                <div className="aspect-[16/10] bg-slate-100 overflow-hidden relative">
                  <img
                    src={preset.image}
                    alt={preset.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-slate-900/80 text-white text-[10px] font-bold">
                    {preset.designStyle === 'neoclassic' ? 'نئوکلاسیک' : 'مدرن'}
                  </span>
                </div>

                <div className="p-3 space-y-1.5">
                  <div className="text-xs font-black text-slate-900">{preset.title}</div>
                  <p className="text-[11px] text-slate-500 leading-5">{preset.subtitle}</p>
                  <div className="flex flex-wrap gap-1 pt-0.5 text-[10px] font-bold text-slate-600">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100">
                      درب: {DOOR_STYLE_META[preset.doorStyle].shortLabel}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100">
                      دستگیره:{' '}
                      {preset.handleStyle === 'hidden'
                        ? 'مخفی'
                        : preset.handleStyle === 'knob'
                        ? 'قارچی'
                        : 'ساده'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100">
                      هود: {preset.defaultHoodKind === 'chimney' ? 'اکسپوز' : 'مخفی'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-3 pb-3">
                <button
                  type="button"
                  onClick={() => onApplyStyle(preset)}
                  className="w-full h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>اعمال روی طراحی فعلی</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
