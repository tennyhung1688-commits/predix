'use client';

import { useTranslation } from '@/i18n/I18nProvider';

interface Category {
  id: string;
  label: string;
  slug: string;
}

interface CategoryFilterProps {
  categories: Category[];
  activeTab: string;
  onSelect: (tab: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  sports: '⚽',
  politics: '🏛️',
  crypto: '₿',
  science: '🔬',
  technology: '🔬',
  tech: '🔬',
  world: '🌍',
  'pop-culture': '🎬',
  'pop culture': '🎬',
  entertainment: '🎬',
  business: '💼',
  economics: '💼',
  finance: '💼',
  gaming: '🎮',
  governance: '⚖️',
  weather: '🌤️',
};

function getCategoryIcon(cat: Category): string {
  const slug = (cat.slug || '').toLowerCase();
  const label = (cat.label || '').replace(/[^\w\s]/g, '').trim().toLowerCase();
  return CATEGORY_ICONS[slug] || CATEGORY_ICONS[label] || '📊';
}

export function CategoryFilter({ categories, activeTab, onSelect }: CategoryFilterProps) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory items-center">
      {/* All tab */}
      <button
        onClick={() => onSelect('all')}
        className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 snap-start transition-all duration-300 ${
          activeTab === 'all'
            ? 'bg-[var(--gradient-brand)] text-white shadow-[0_2px_8px_rgba(79,143,255,0.25)]'
            : 'bg-[var(--bg-card)] border border-[var(--border-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)]/30 hover:bg-[var(--accent-blue)]/5'
        }`}
      >
        🌐 {t('home.all')}
      </button>

      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 snap-start transition-all duration-300 ${
            activeTab === cat.id
              ? 'bg-[var(--gradient-brand)] text-white shadow-[0_2px_8px_rgba(79,143,255,0.25)]'
              : 'bg-[var(--bg-card)] border border-[var(--border-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)]/30 hover:bg-[var(--accent-blue)]/5'
          }`}
        >
          {t(`category.${cat.id}` as any) || cat.label}
        </button>
      ))}
    </div>
  );
}
