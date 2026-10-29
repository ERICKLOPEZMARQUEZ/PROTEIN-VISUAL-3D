import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Dna, FileText, Database, ArrowRight, CornerDownLeft } from 'lucide-react';
import { SearchSuggestion } from '../types';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  compact?: boolean;
  showPresets?: boolean;
  placeholder?: string;
}

const PRESET_SEARCHES = [
  { id: '6LU7', label: '6LU7: SARS-CoV-2 Mpro' },
  { id: '1CRN', label: '1CRN: Crambin 0.54 Å' },
  { id: '4HHB', label: '4HHB: Hemoglobin' },
  { id: 'P04637', label: 'P04637: p53 AlphaFold' }
];

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isLoading,
  compact = false,
  showPresets = true,
  placeholder
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut '/' to focus search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch live suggestions on debounce
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
        }
      } catch (err) {
        console.warn('Search suggestions error:', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setShowDropdown(false);
    onSearch(query.trim());
  };

  const handleSelectSuggestion = (id: string) => {
    setQuery(id);
    setShowDropdown(false);
    onSearch(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[selectedIndex].id);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Format type helper
  const detectQueryType = (val: string) => {
    const v = val.trim().toUpperCase();
    if (/^[0-9][A-Z0-9]{3}$/.test(v)) return 'PDB ID';
    if (/^[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]/.test(v)) return 'UniProt ID';
    if (v.length > 0) return 'Keyword Search';
    return null;
  };

  const queryType = detectQueryType(query);

  const defaultPlaceholder = compact
    ? "Search PDB ID (1CRN), UniProt (P04637)... [/]"
    : "Enter PDB ID (e.g. 1CRN), UniProt ID (e.g. P04637), or search term...";

  return (
    <div className={compact ? "w-full relative" : "w-full max-w-[960px] mx-auto pt-6 pb-4 px-4"}>
      {/* Search Input Container */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <div className={`absolute ${compact ? 'left-2.5' : 'left-3.5'} text-[var(--sg-text-tertiary)] flex items-center pointer-events-none`}>
            <Search className={`${compact ? 'w-3.5 h-3.5' : 'w-5 h-5'} text-[var(--sg-text-secondary)]`} />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
              setSelectedIndex(-1);
            }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || defaultPlaceholder}
            className={
              compact
                ? "w-full bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface)] focus:bg-[var(--sg-surface)] border border-[var(--sg-border)] rounded-[6px] pl-8 pr-14 py-1.5 text-[12.5px] placeholder-[var(--sg-text-tertiary)] text-[var(--sg-text-primary)] shadow-xs focus:outline-none focus:border-[#000000] focus:ring-1 focus:ring-[#000000] transition-all font-mono"
                : "w-full bg-[var(--sg-surface)] border border-[var(--sg-border)] rounded-[8px] pl-11 pr-28 py-3.5 text-[15px] placeholder-[var(--sg-text-tertiary)] text-[var(--sg-text-primary)] shadow-[var(--sg-shadow-sm)] focus:outline-none focus:border-[#000000] focus:ring-1 focus:ring-[#000000] transition-all font-mono"
            }
          />

          {/* Right badge & submit button */}
          <div className="absolute right-1.5 flex items-center gap-1">
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSuggestions([]);
                  inputRef.current?.focus();
                }}
                className="p-1 rounded-[4px] hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-tertiary)] hover:text-[var(--sg-text-primary)] transition-all"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {queryType && !compact && (
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-[4px] text-[11px] font-mono bg-[var(--sg-surface-sunken)] text-[var(--sg-text-secondary)] border border-[var(--sg-border-subtle)]">
                {queryType}
              </span>
            )}

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className={
                compact
                  ? "p-1 rounded-[4px] bg-[#000000] hover:bg-[#222222] text-white text-[11px] transition-all disabled:opacity-40 disabled:bg-[var(--sg-surface-active)] disabled:text-[var(--sg-text-tertiary)] cursor-pointer"
                  : "px-3 py-1.5 rounded-[6px] bg-[#000000] hover:bg-[#222222] text-white text-[13px] font-medium transition-all flex items-center gap-1 shadow-sm disabled:opacity-50 disabled:bg-[var(--sg-surface-active)] disabled:text-[var(--sg-text-tertiary)] cursor-pointer"
              }
              title="Search structure"
            >
              {!compact && <span>Search</span>}
              <CornerDownLeft className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
            </button>
          </div>
        </div>

        {/* Autocomplete Suggestions Dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1.5 bg-[var(--sg-surface)] border border-[var(--sg-border)] rounded-[8px] shadow-[var(--sg-shadow-lg)] z-50 overflow-hidden max-h-[320px] overflow-y-auto"
          >
            <div className="p-1.5 divide-y divide-[var(--sg-border-subtle)]">
              {suggestions.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectSuggestion(item.id)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2.5 rounded-[6px] cursor-pointer flex items-center justify-between transition-colors ${
                    selectedIndex === idx
                      ? 'bg-[var(--sg-accent-subtle)] text-[var(--sg-accent)]'
                      : 'hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-[4px] bg-[var(--sg-surface-sunken)] flex items-center justify-center text-[var(--sg-text-secondary)] shrink-0 font-mono text-[11px] font-bold">
                      {item.id.startsWith('P') ? 'AF' : 'PDB'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[13px]">{item.id}</span>
                        {item.resolution && (
                          <span className="text-[11px] px-1.5 py-0.2 rounded-[3px] bg-[var(--sg-surface-sunken)] text-[var(--sg-text-secondary)] font-mono">
                            {item.resolution} Å
                          </span>
                        )}
                        {item.method && (
                          <span className="text-[11px] text-[var(--sg-text-tertiary)] hidden sm:inline truncate">
                            {item.method}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[var(--sg-text-secondary)] truncate">
                        {item.title}
                      </p>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-[var(--sg-text-tertiary)] shrink-0 ml-2" />
                </div>
              ))}
            </div>
          </div>
        )}
      </form>

      {/* Preset Chips */}
      {!compact && showPresets && (
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[12px] text-[var(--sg-text-tertiary)] font-medium mr-1">Popular:</span>
          {PRESET_SEARCHES.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleSelectSuggestion(preset.id)}
              className="px-2 py-1 rounded-[4px] text-[12px] bg-white hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] transition-all flex items-center gap-1.5 shadow-[var(--sg-shadow-sm)]"
            >
              <span className="font-mono font-medium text-[var(--sg-text-primary)]">{preset.id}</span>
              <span className="text-[11px] text-[var(--sg-text-tertiary)] hidden sm:inline">
                {preset.label.split(':')[1]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
