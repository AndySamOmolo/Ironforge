'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface CustomSelectOption {
  value: string | number;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  compact?: boolean;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  ariaLabel = 'Select option',
  searchable,
  searchPlaceholder = 'Filter options...',
  compact = false,
  icon,
  style,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isSearchEnabled = searchable ?? options.length > 8;

  const selectedOption = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!isSearchEnabled || !search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, search, isSearchEnabled]);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      return;
    }
    if (isSearchEnabled) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [isOpen, isSearchEnabled]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`custom-select-root ${isOpen ? 'is-open' : ''}`}
      style={{ position: 'relative', width: '100%', ...style }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`custom-select-trigger ${compact ? 'custom-select-trigger--compact' : ''} ${isOpen ? 'active' : ''}`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 6 : 10, minWidth: 0, flex: 1 }}>
          {icon && (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--accent-purple)' }}>
              {icon}
            </span>
          )}
          <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
            <div
              style={{
                fontSize: compact ? 12.5 : 13.5,
                fontWeight: 700,
                color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </div>
            {!compact && selectedOption?.sublabel && (
              <div
                style={{
                  fontSize: 10.5,
                  color: 'var(--text-muted)',
                  marginTop: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selectedOption.sublabel}
              </div>
            )}
          </div>
          {selectedOption?.badge && (
            <span
              className="custom-select-badge"
              style={{
                color: selectedOption.badgeColor || 'var(--accent-green)',
                borderColor: `color-mix(in srgb, ${selectedOption.badgeColor || 'var(--accent-green)'} 30%, transparent)`,
                background: `color-mix(in srgb, ${selectedOption.badgeColor || 'var(--accent-green)'} 12%, transparent)`,
              }}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>
        <span className={`custom-select-chevron ${isOpen ? 'rotated' : ''}`}>
          <ChevronDown size={compact ? 13 : 15} />
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="listbox"
            aria-label={ariaLabel}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={`custom-select-menu ${compact ? 'custom-select-menu--compact' : ''}`}
          >
            {isSearchEnabled && (
              <div className="custom-select-search-wrap">
                <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="custom-select-search-input"
                  onClick={(e) => e.stopPropagation()}
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Clear filter"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearch('');
                      searchInputRef.current?.focus();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            )}

            <div className="custom-select-options-list">
              {filteredOptions.length === 0 ? (
                <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                  No matching options
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = String(opt.value) === String(value);
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(String(opt.value));
                        setIsOpen(false);
                      }}
                      className={`custom-select-option ${isSelected ? 'selected' : ''} ${compact ? 'custom-select-option--compact' : ''}`}
                    >
                      <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                        <div
                          style={{
                            fontSize: compact ? 12 : 13,
                            fontWeight: isSelected ? 800 : 600,
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {opt.label}
                        </div>
                        {opt.sublabel && (
                          <div
                            style={{
                              fontSize: 10,
                              color: 'var(--text-muted)',
                              marginTop: 1,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {opt.sublabel}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {opt.badge && (
                          <span
                            className="custom-select-badge"
                            style={{
                              color: opt.badgeColor || (isSelected ? 'var(--accent-green)' : 'var(--text-muted)'),
                              borderColor: `color-mix(in srgb, ${opt.badgeColor || (isSelected ? 'var(--accent-green)' : 'var(--border-bright)')} 30%, transparent)`,
                              background: `color-mix(in srgb, ${opt.badgeColor || (isSelected ? 'var(--accent-green)' : 'var(--bg-glass)')} 12%, transparent)`,
                            }}
                          >
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && (
                          <span className="custom-select-check">
                            <Check size={12} strokeWidth={3} />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


export interface ChipScrollItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  isActive?: boolean;
  isCompleted?: boolean;
  onClick: () => void;
  title?: string;
}

interface ChipScrollBarProps {
  items: ChipScrollItem[];
  dropdownTitle?: string;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  chipStyle?: React.CSSProperties;
  showDropdown?: boolean;
  trailingAction?: React.ReactNode;
}

export function ChipScrollBar({
  items,
  dropdownTitle = 'All Options',
  ariaLabel = 'Scrollable options',
  className = '',
  style,
  chipStyle,
  showDropdown = true,
  trailingAction,
}: ChipScrollBarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const edgeAnchorXRef = useRef<number | null>(null);
  const prevScrollLeftRef = useRef<number>(0);
  const wheelResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [bounceX, setBounceX] = useState(0);
  const [isDraggingBounce, setIsDraggingBounce] = useState(false);

  const updateScrollEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(maxScroll - el.scrollLeft > 2);
  }, []);

  useEffect(() => {
    updateScrollEdges();
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      updateScrollEdges();
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      const prev = prevScrollLeftRef.current;
      const curr = el.scrollLeft;
      prevScrollLeftRef.current = curr;
      if (touchStartXRef.current === null && maxScroll > 8) {
        if (prev > 4 && curr <= 1) triggerImpulseBounce(1, 10);
        else if (prev < maxScroll - 4 && curr >= maxScroll - 1) triggerImpulseBounce(-1, 10);
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => updateScrollEdges());
      ro.observe(el);
    }
    window.addEventListener('resize', updateScrollEdges);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateScrollEdges);
      ro?.disconnect();
    };
  }, [updateScrollEdges, items.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (wheelResetRef.current) clearTimeout(wheelResetRef.current);
    };
  }, []);

  const triggerImpulseBounce = useCallback((direction: 1 | -1, strength = 12) => {
    setIsDraggingBounce(false);
    setBounceX(direction * strength);
    if (wheelResetRef.current) clearTimeout(wheelResetRef.current);
    wheelResetRef.current = setTimeout(() => setBounceX(0), 140);
  }, []);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || e.touches.length !== 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    edgeAnchorXRef.current = null;
    prevScrollLeftRef.current = el.scrollLeft;
    setIsDraggingBounce(false);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || touchStartXRef.current === null || e.touches.length !== 1) return;
    const currentX = e.touches[0].clientX;
    const deltaFromStart = currentX - touchStartXRef.current;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);

    const atLeft = el.scrollLeft <= 1;
    const atRight = el.scrollLeft >= maxScroll - 1;

    if (atLeft && deltaFromStart > 0) {
      if (edgeAnchorXRef.current === null) edgeAnchorXRef.current = currentX;
      const pull = Math.max(0, currentX - edgeAnchorXRef.current);
      const resisted = Math.min(30, Math.pow(pull + 4, 0.78) * 1.45);
      setIsDraggingBounce(true);
      setBounceX(resisted);
    } else if (atRight && deltaFromStart < 0) {
      if (edgeAnchorXRef.current === null) edgeAnchorXRef.current = currentX;
      const pull = Math.max(0, edgeAnchorXRef.current - currentX);
      const resisted = -Math.min(30, Math.pow(pull + 4, 0.78) * 1.45);
      setIsDraggingBounce(true);
      setBounceX(resisted);
    } else {
      edgeAnchorXRef.current = null;
      if (bounceX !== 0) {
        setIsDraggingBounce(false);
        setBounceX(0);
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartXRef.current = null;
    edgeAnchorXRef.current = null;
    if (bounceX !== 0) {
      setIsDraggingBounce(false);
      setBounceX(0);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
    if (delta === 0) return;

    if (el.scrollLeft <= 1 && delta < 0) {
      setIsDraggingBounce(false);
      setBounceX(Math.min(18, Math.abs(delta) * 0.25));
      if (wheelResetRef.current) clearTimeout(wheelResetRef.current);
      wheelResetRef.current = setTimeout(() => setBounceX(0), 160);
    } else if (el.scrollLeft >= maxScroll - 1 && delta > 0) {
      setIsDraggingBounce(false);
      setBounceX(-Math.min(18, Math.abs(delta) * 0.25));
      if (wheelResetRef.current) clearTimeout(wheelResetRef.current);
      wheelResetRef.current = setTimeout(() => setBounceX(0), 160);
    }
  };

  const scrollChipIntoView = (id: string) => {
    const el = scrollRef.current;
    if (!el) return;
    const target = el.querySelector(`[data-chip-id="${CSS.escape ? CSS.escape(id) : id}"]`) as HTMLElement | null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const maskGradient = canScrollLeft && canScrollRight
    ? 'linear-gradient(to right, transparent 0%, #000 22px, #000 calc(100% - 22px), transparent 100%)'
    : canScrollRight
      ? 'linear-gradient(to right, #000 0%, #000 calc(100% - 22px), transparent 100%)'
      : canScrollLeft
        ? 'linear-gradient(to right, transparent 0%, #000 22px, #000 100%)'
        : 'none';

  return (
    <div
      ref={rootRef}
      className={`chip-scroll-shell ${isOpen ? 'is-open' : ''} ${className}`}
      style={{ position: 'relative', marginBottom: 14, ...style }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          ref={scrollRef}
          role="region"
          aria-label={ariaLabel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onWheel={handleWheel}
          className="chip-scroll-track hide-scrollbar"
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            overflowX: 'auto',
            overscrollBehaviorX: 'contain',
            WebkitOverflowScrolling: 'touch',
            padding: '2px 2px 4px',
            maskImage: maskGradient,
            WebkitMaskImage: maskGradient,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              paddingRight: canScrollRight ? 16 : 2,
              paddingLeft: canScrollLeft ? 10 : 0,
              transform: `translateX(${bounceX}px)`,
              transition: isDraggingBounce ? 'none' : 'transform 0.42s cubic-bezier(0.22, 1.6, 0.36, 1)',
              willChange: 'transform',
            }}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                data-chip-id={item.id}
                title={item.title || item.label}
                className={`filter-chip ${item.isActive ? 'active' : ''}`}
                onClick={item.onClick}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  ...chipStyle,
                  ...(item.isCompleted && !item.isActive
                    ? {
                        background: 'color-mix(in srgb, var(--accent-green) 16%, transparent)',
                        borderColor: 'color-mix(in srgb, var(--accent-green) 48%, transparent)',
                        color: 'var(--accent-green)',
                        fontWeight: 700,
                      }
                    : {}),
                }}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && (
                  <span style={{ opacity: 0.78, fontSize: '0.85em', fontWeight: 800 }}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
            {trailingAction}
          </div>
        </div>

        {showDropdown && items.length > 1 && (
          <button
            type="button"
            aria-label={`Show all ${dropdownTitle.toLowerCase()}`}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((prev) => !prev)}
            className={`chip-scroll-dropdown-btn ${isOpen ? 'active' : ''}`}
          >
            <ChevronDown
              size={14}
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="chip-scroll-dropdown-menu"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="section-label">{dropdownTitle} ({items.length})</span>
              <button
                type="button"
                aria-label="Close list"
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 2 }}
              >
                <X size={13} />
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`filter-chip ${item.isActive ? 'active' : ''}`}
                  onClick={() => {
                    item.onClick();
                    setIsOpen(false);
                    setTimeout(() => scrollChipIntoView(item.id), 40);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11.5,
                    padding: '6px 11px',
                    minHeight: 32,
                    textTransform: chipStyle?.textTransform,
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span style={{ opacity: 0.78, fontSize: '0.85em', fontWeight: 800 }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
              {trailingAction}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
