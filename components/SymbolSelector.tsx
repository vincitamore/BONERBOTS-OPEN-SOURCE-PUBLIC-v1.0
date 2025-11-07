import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiConfig';
import { useToast } from '../context/ToastContext';

const API_BASE_URL = getApiBaseUrl();

interface MarketData {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
}

interface SymbolSelectorProps {
  selectedSymbols: string[];
  onChange: (symbols: string[]) => void;
  maxSelections?: number;
}

type SortField = 'symbol' | 'volume' | 'price' | 'change';
type SortDirection = 'asc' | 'desc';

export const SymbolSelector: React.FC<SymbolSelectorProps> = ({ 
  selectedSymbols, 
  onChange,
  maxSelections 
}) => {
  const { showToast } = useToast();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [filteredMarkets, setFilteredMarkets] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('volume');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  useEffect(() => {
    fetchMarketData();
  }, []);

  useEffect(() => {
    filterAndSortMarkets();
  }, [markets, searchTerm, sortField, sortDirection, showOnlySelected]);

  const fetchMarketData = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/asterdex`);
      
      // Filter for USDT pairs only
      const usdtPairs = response.data.filter((m: MarketData) => 
        m.symbol.endsWith('USDT')
      );
      
      setMarkets(usdtPairs);
    } catch (error) {
      console.error('Failed to fetch market data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortMarkets = () => {
    let filtered = [...markets];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(m => 
        m.symbol.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply selected filter
    if (showOnlySelected) {
      filtered = filtered.filter(m => selectedSymbols.includes(m.symbol));
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: number, bVal: number;

      switch (sortField) {
        case 'symbol':
          return sortDirection === 'asc' 
            ? a.symbol.localeCompare(b.symbol)
            : b.symbol.localeCompare(a.symbol);
        
        case 'volume':
          aVal = parseFloat(a.quoteVolume) || 0;
          bVal = parseFloat(b.quoteVolume) || 0;
          break;
        
        case 'price':
          aVal = parseFloat(a.lastPrice) || 0;
          bVal = parseFloat(b.lastPrice) || 0;
          break;
        
        case 'change':
          aVal = parseFloat(a.priceChangePercent) || 0;
          bVal = parseFloat(b.priceChangePercent) || 0;
          break;
        
        default:
          return 0;
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    setFilteredMarkets(filtered);
  };

  const handleToggle = (symbol: string) => {
    if (selectedSymbols.includes(symbol)) {
      onChange(selectedSymbols.filter(s => s !== symbol));
    } else {
      if (maxSelections && selectedSymbols.length >= maxSelections) {
        showToast(`Maximum ${maxSelections} symbols allowed`, 'warning');
        return;
      }
      onChange([...selectedSymbols, symbol]);
    }
  };

  const handleSelectAll = () => {
    if (maxSelections && filteredMarkets.length > maxSelections) {
      showToast(`Maximum ${maxSelections} symbols allowed`, 'warning');
      return;
    }
    onChange(filteredMarkets.map(m => m.symbol));
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatVolume = (volume: string) => {
    const val = parseFloat(volume);
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
    return `$${val.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <span className="ml-3 text-gray-400">Loading market data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {selectedSymbols.length} of {markets.length} symbols selected
          {maxSelections && ` (max ${maxSelections})`}
        </div>
        <button
          onClick={fetchMarketData}
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Refresh Data
        </button>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search symbols..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        />
        <label className="flex items-center gap-2 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white cursor-pointer hover:bg-gray-600 transition-colors text-sm">
          <input
            type="checkbox"
            checked={showOnlySelected}
            onChange={(e) => setShowOnlySelected(e.target.checked)}
            className="w-4 h-4 text-indigo-600 bg-gray-600 border-gray-500 rounded focus:ring-indigo-500"
          />
          <span>Selected only</span>
        </label>
      </div>

      {/* Bulk actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSelectAll}
          className="px-3 py-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
        >
          Select All ({filteredMarkets.length})
        </button>
        <button
          onClick={handleDeselectAll}
          className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
        >
          Deselect All
        </button>
      </div>

      {/* Table */}
      <div className="border border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: '400px' }}>
          <table className="w-full">
            <thead className="bg-gray-900 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-400">
                  <input
                    type="checkbox"
                    checked={filteredMarkets.length > 0 && filteredMarkets.every(m => selectedSymbols.includes(m.symbol))}
                    onChange={(e) => e.target.checked ? handleSelectAll() : handleDeselectAll()}
                    className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                  />
                </th>
                <th 
                  className="text-left px-3 py-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-white transition-colors"
                  onClick={() => toggleSort('symbol')}
                >
                  <div className="flex items-center gap-1">
                    Symbol
                    {sortField === 'symbol' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="text-right px-3 py-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-white transition-colors"
                  onClick={() => toggleSort('price')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Price
                    {sortField === 'price' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="text-right px-3 py-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-white transition-colors"
                  onClick={() => toggleSort('change')}
                >
                  <div className="flex items-center justify-end gap-1">
                    24h Change
                    {sortField === 'change' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="text-right px-3 py-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-white transition-colors"
                  onClick={() => toggleSort('volume')}
                >
                  <div className="flex items-center justify-end gap-1">
                    24h Volume
                    {sortField === 'volume' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredMarkets.map((market) => {
                const isSelected = selectedSymbols.includes(market.symbol);
                const changePercent = parseFloat(market.priceChangePercent);
                
                return (
                  <tr 
                    key={market.symbol}
                    className={`hover:bg-gray-750 transition-colors cursor-pointer ${
                      isSelected ? 'bg-indigo-500/10' : ''
                    }`}
                    onClick={() => handleToggle(market.symbol)}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-white font-medium text-sm">
                        {market.symbol.replace('USDT', '')}
                        <span className="text-gray-500 text-xs">/USDT</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300 text-sm">
                      ${parseFloat(market.lastPrice).toFixed(2)}
                    </td>
                    <td className={`px-3 py-2 text-right text-sm font-medium ${
                      changePercent >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400 text-xs">
                      {formatVolume(market.quoteVolume)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredMarkets.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No symbols found matching your criteria
        </div>
      )}
    </div>
  );
};

