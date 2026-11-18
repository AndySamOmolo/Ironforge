'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
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
