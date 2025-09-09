import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { FlashSale, flashSalesAPI } from '../../services/api';
import FlashSaleCard from './FlashSaleCard';
import toast from 'react-hot-toast';

interface FlashSaleListProps {
  showCreateButton?: boolean;
  onCreateClick?: () => void;
  isAdminView?: boolean;
  onEditFlashSale?: (flashSale: FlashSale) => void;
  onDeleteFlashSale?: (flashSale: FlashSale) => void;
}

const FlashSaleList: React.FC<FlashSaleListProps> = ({ 
  showCreateButton = false, 
  onCreateClick,
  isAdminView = false,
  onEditFlashSale,
  onDeleteFlashSale
}) => {
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'upcoming' | 'expired' | 'inactive'>('all');
  const [purchaseStatuses, setPurchaseStatuses] = useState<Record<number, boolean>>({});
  const [purchaseLoading, setPurchaseLoading] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchFlashSales();
  }, [isAdminView]);

  useEffect(() => {
    if (!isAdminView && flashSales.length > 0) {
      fetchUserPurchaseStatuses();
    }
  }, [isAdminView, flashSales]);

  const fetchFlashSales = async () => {
    try {
      setLoading(true);
      const response = await flashSalesAPI.getAll();
      setFlashSales(response.data.data.flashSales);
    } catch (error: any) {
      toast.error('Failed to load flash sales');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPurchaseStatuses = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.id && flashSales.length > 0) {
        // Check purchase status for each flash sale individually
        const statusPromises = flashSales.map(async (flashSale) => {
          try {
            const response = await flashSalesAPI.getUserFlashSalePurchaseStatus(user.id, flashSale.id);
            return {
              flashSaleId: flashSale.id,
              hasPurchased: response.data.success ? response.data.data.hasPurchased : false
            };
          } catch (error) {
            console.error(`Failed to fetch purchase status for flash sale ${flashSale.id}:`, error);
            return {
              flashSaleId: flashSale.id,
              hasPurchased: false
            };
          }
        });

        const statuses = await Promise.all(statusPromises);
        const statusMap: Record<number, boolean> = {};
        statuses.forEach(status => {
          statusMap[status.flashSaleId] = status.hasPurchased;
        });
        
        setPurchaseStatuses(statusMap);
      }
    } catch (error) {
      console.error('Failed to fetch purchase statuses:', error);
    }
  };

  const handlePurchase = async (flashSale: FlashSale) => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) {
        toast.error('Please login to make a purchase');
        return;
      }

      setPurchaseLoading(prev => ({ ...prev, [flashSale.id]: true }));

      const response = await flashSalesAPI.attemptPurchase({
        userId: user.id,
        flashSaleId: flashSale.id
      });

      if (response.data.success) {
        toast.success('Purchase successful! You have secured your item.');
        setPurchaseStatuses(prev => ({ ...prev, [flashSale.id]: true }));
        fetchFlashSales(); // Refresh the list
      } else {
        toast.error(response.data.message || 'Purchase failed');
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      toast.error(error.response?.data?.message || 'Purchase failed');
    } finally {
      setPurchaseLoading(prev => ({ ...prev, [flashSale.id]: false }));
    }
  };

  // Filter flash sales based on search and status
  const filteredFlashSales = flashSales.filter((sale) => {
    const matchesSearch = sale.id.toString().includes(searchTerm.toLowerCase()) ||
                         sale.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const now = new Date();
    // Treat backend times as UTC by adding 'Z' suffix if not already present
    const startTimeStr = sale.start_time.includes('Z') ? sale.start_time : sale.start_time + 'Z';
    const endTimeStr = sale.end_time.includes('Z') ? sale.end_time : sale.end_time + 'Z';
    const startTime = new Date(startTimeStr);
    const endTime = new Date(endTimeStr);
    
    const isExpired = endTime < now;
    const isUpcoming = startTime > now;
    const isActive = !isExpired && !isUpcoming && sale.is_active;
    const isInactive = !isExpired && !isUpcoming && !sale.is_active;
    
    const matchesFilter = 
      filterStatus === 'all' ||
      (filterStatus === 'active' && isActive) ||
      (filterStatus === 'upcoming' && isUpcoming) ||
      (filterStatus === 'expired' && isExpired) ||
      (filterStatus === 'inactive' && isInactive);

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading flash sales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Flash Sales</h1>
          <p className="text-gray-600 mt-1">
            Manage your flash sale campaigns and monitor performance
          </p>
        </div>
        
        {showCreateButton && (
          <button
            onClick={onCreateClick}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Flash Sale
          </button>
        )}
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between gap-6">
          {/* Left: Search Input */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            </div>
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
          
          {/* Right: Filter and Results */}
          <div className="flex items-center gap-3">
            {/* Filter Dropdown */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                title="Filter flash sales by status"
                className="appearance-none pl-9 pr-8 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer w-32"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="upcoming">Upcoming</option>
                <option value="inactive">Inactive</option>
                <option value="expired">Expired</option>
              </select>
              {/* Dropdown Arrow */}
              <svg className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            
            {/* Results Count */}
            <div className="flex items-center gap-2 px-3 py-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-700 font-medium">
              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
              <span>{filteredFlashSales.length} Results</span>
            </div>
          </div>
        </div>
        
        {/* Filter Status Summary Bar */}
        {filterStatus !== 'all' && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Showing:</span>
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md font-medium">
                  {filterStatus === 'active' && 'Active'}
                  {filterStatus === 'upcoming' && 'Upcoming'}
                  {filterStatus === 'inactive' && 'Inactive'}
                  {filterStatus === 'expired' && 'Expired'}
                  {' '}sales
                </span>
              </div>
              <button
                onClick={() => setFilterStatus('all')}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                Clear filter
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Flash Sales Grid */}
      {filteredFlashSales.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Search className="h-8 w-8 text-gray-400" />
          </div>
          <div className="text-gray-600">
            {flashSales.length === 0 ? (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No flash sales available</h3>
                <p>Check back later for exciting deals!</p>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No flash sales match your filters</h3>
                <p>Try adjusting your search or filter criteria</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFlashSales.map((flashSale) => (
            <FlashSaleCard
              key={flashSale.id}
              flashSale={flashSale}
              onPurchase={handlePurchase}
              isAdminView={isAdminView}
              onEdit={onEditFlashSale}
              onDelete={onDeleteFlashSale}
              userHasPurchased={purchaseStatuses[flashSale.id] || false}
              isPurchaseLoading={purchaseLoading[flashSale.id] || false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FlashSaleList;
