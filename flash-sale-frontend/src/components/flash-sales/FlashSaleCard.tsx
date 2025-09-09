import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Edit, Trash2, ShoppingCart, Tag, TrendingUp, Users } from 'lucide-react';
import { FlashSale } from '../../services/api';

interface FlashSaleCardProps {
  flashSale: FlashSale;
  onPurchase?: (flashSale: FlashSale) => void;
  isAdminView?: boolean;
  onEdit?: (flashSale: FlashSale) => void;
  onDelete?: (flashSale: FlashSale) => void;
  userHasPurchased?: boolean;
  isPurchaseLoading?: boolean;
}

const FlashSaleCard: React.FC<FlashSaleCardProps> = ({ 
  flashSale, 
  onPurchase, 
  isAdminView = false, 
  onEdit, 
  onDelete,
  userHasPurchased = false,
  isPurchaseLoading = false
}) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const startTime = new Date(flashSale.start_time + 'Z').getTime();
      const endTime = new Date(flashSale.end_time + 'Z').getTime();
      
      let targetTime = endTime; // Default to counting down to end
      let isCountingToStart = false;
      
      // If sale hasn't started yet, count down to start time
      if (startTime > now) {
        targetTime = startTime;
        isCountingToStart = true;
      }
      
      const difference = targetTime - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        let timeString = '';
        if (days > 0) {
          timeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        } else if (hours > 0) {
          timeString = `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
          timeString = `${minutes}m ${seconds}s`;
        } else if (seconds > 0) {
          timeString = `${seconds}s`;
        }
        
        setTimeRemaining(timeString);
      } else {
        if (isCountingToStart) {
          // Sale just started, refresh to show it as active
          setTimeRemaining('Starting now...');
          setTimeout(updateTimer, 1000);
        } else {
          setTimeRemaining('Expired');
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [flashSale.start_time, flashSale.end_time]);

  const now = new Date();
  const startTime = new Date(flashSale.start_time + 'Z');
  const endTime = new Date(flashSale.end_time + 'Z');
  
  const isExpired = endTime < now;
  const isUpcoming = startTime > now;
  const isActive = !isExpired && !isUpcoming && flashSale.is_active === 1;
  
  const formatDate = (dateString: string) => {
    // Treat backend time as UTC by adding 'Z' suffix, then format in user's local time
    return new Date(dateString + 'Z').toLocaleString();
  };

  return (
    <div className={`bg-white rounded-xl shadow-md border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden ${
      isExpired ? 'border-red-300 hover:border-red-400 bg-red-50' : 
      isUpcoming ? 'border-blue-300 hover:border-blue-400' :
      isActive ? 'border-green-300 hover:border-green-400' : 'border-amber-300 hover:border-amber-400'
    }`}>
      {/* Slim Top Bar */}
      <div className={`h-2 ${
        isExpired ? 'bg-gradient-to-r from-red-500 to-red-600' :
        isUpcoming ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
        isActive ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-amber-500 to-amber-600'
      }`}></div>
      
      {/* Compact Header */}
      <div className="p-4 bg-white">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 pr-3">
            <h3 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
              {flashSale.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-700 bg-gray-100 rounded-full px-3 py-1 border">
              <Tag className="h-3 w-3 text-gray-600" />
              <span className="font-bold">ID: {flashSale.id}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className={`px-3 py-2 rounded-full text-xs font-bold uppercase tracking-wide shadow-md ${
              isExpired 
                ? 'bg-red-600 text-white' 
                : isUpcoming
                  ? 'bg-blue-600 text-white'
                : isActive 
                  ? 'bg-green-600 text-white' 
                  : 'bg-amber-600 text-white'
            }`}>
              {isExpired ? '⏰ EXPIRED' : isUpcoming ? '🚀 COMING SOON' : isActive ? '🔥 LIVE NOW' : '⏸️ PAUSED'}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 pt-0">
        {/* Compact Timing Cards */}
        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-blue-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
              <div className="flex items-center mb-2">
                <div className="p-1 bg-blue-100 rounded mr-2">
                  <Calendar className="h-3 w-3 text-blue-600" />
                </div>
                <span className="text-xs font-bold text-gray-800">START</span>
              </div>
              <div className="text-xs text-gray-700 font-medium">
                {new Date(flashSale.start_time + 'Z').toLocaleDateString('en-US', { 
                  month: 'short', day: 'numeric'
                })}
                <br/>
                <span className="text-blue-600 font-mono">
                  {new Date(flashSale.start_time + 'Z').toLocaleTimeString('en-US', { 
                    hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
            
            <div className="bg-white border border-red-200 rounded-lg p-3 hover:border-red-300 transition-colors">
              <div className="flex items-center mb-2">
                <div className="p-1 bg-red-100 rounded mr-2">
                  <Calendar className="h-3 w-3 text-red-600" />
                </div>
                <span className="text-xs font-bold text-gray-800">END</span>
              </div>
              <div className="text-xs text-gray-700 font-medium">
                {new Date(flashSale.end_time + 'Z').toLocaleDateString('en-US', { 
                  month: 'short', day: 'numeric'
                })}
                <br/>
                <span className="text-red-600 font-mono">
                  {new Date(flashSale.end_time + 'Z').toLocaleTimeString('en-US', { 
                    hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>
          
          {/* Enhanced Compact Countdown Timer */}
          {!isExpired && (
            <div className={`p-4 rounded-lg shadow-md border-2 ${
              isUpcoming ? 'bg-gradient-to-r from-blue-600 to-blue-700 border-blue-800' : 'bg-gradient-to-r from-green-600 to-green-700 border-green-800'
            }`}>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="h-5 w-5 mr-2 text-yellow-200" />
                  <span className="text-yellow-100 font-bold text-sm uppercase tracking-wide">
                    {isUpcoming ? '🚀 LAUNCHING IN' : '⚡ TIME LEFT'}
                  </span>
                </div>
                <div className="text-3xl font-black text-yellow-100 font-mono tracking-wider mb-2 rounded-lg py-3 px-4 border-2 border-yellow-300 bg-black/30">
                  {timeRemaining || 'Loading...'}
                </div>
                <div className="text-sm text-yellow-100 font-bold bg-black/20 rounded px-3 py-1">
                  {isUpcoming ? 'Get ready!' : 'Hurry up!'}
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Compact Expired Message */}
          {isExpired && (
            <div className="p-4 rounded-lg shadow-md border-2 bg-gradient-to-r from-red-600 to-red-700 border-red-800">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="h-5 w-5 mr-2 text-yellow-200" />
                  <span className="text-yellow-100 font-bold text-sm uppercase tracking-wide">
                    ⏰ SALE ENDED
                  </span>
                </div>
                <div className="text-3xl font-black text-yellow-100 font-mono tracking-wider mb-2 bg-red-800/60 rounded-lg py-3 px-4 border-2 border-yellow-300">
                  EXPIRED
                </div>
                <div className="text-sm text-yellow-100 font-bold bg-black/20 rounded px-3 py-1">
                  This sale has ended
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Compact Purchase Section */}
        {!isAdminView && !isExpired && isActive && (
          <div className="mb-4">
            {userHasPurchased ? (
              <div className="bg-green-50 border border-green-300 rounded-lg px-4 py-3 text-center">
                <p className="text-green-800 font-bold">✓ Purchase Successful!</p>
                <p className="text-green-700 text-sm mt-1">Item secured</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-300 rounded-lg p-3">
                  <h4 className="font-bold text-blue-900 mb-2 text-sm">Available Products:</h4>
                  <div className="text-xs text-blue-900 space-y-2">
                    <div className="flex justify-between items-center p-2 bg-white rounded border border-blue-200">
                      <span className="font-medium">Gaming Laptop</span>
                      <span className="font-bold text-blue-800">$1,299.99</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-white rounded border border-blue-200">
                      <span className="font-medium">Wireless Headphones</span>
                      <span className="font-bold text-blue-800">$299.99</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-white rounded border border-blue-200">
                      <span className="font-medium">Premium Smartphone</span>
                      <span className="font-bold text-blue-800">$899.99</span>
                    </div>
                  </div>
                  <p className="text-xs text-blue-800 mt-2 font-medium bg-blue-100 rounded px-2 py-1">⚡ One per customer</p>
                </div>
                <button
                  onClick={() => onPurchase?.(flashSale)}
                  disabled={isPurchaseLoading}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-black rounded-xl px-6 py-4 font-black text-lg uppercase tracking-wide transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1 border-2 border-orange-700 hover:border-orange-800"
                >
                  {isPurchaseLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-5 w-5" />
                      <span>Purchase Now</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Enhanced Compact Admin Actions with spacing */}
        {isAdminView && (
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex justify-between items-center gap-4">
              <button
                onClick={() => onEdit?.(flashSale)}
                className="group bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-black rounded-lg px-8 py-4 font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg border border-emerald-700 flex-1"
              >
                <Edit className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                <span>EDIT</span>
              </button>
              <button
                onClick={() => onDelete?.(flashSale)}
                className="group bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-black rounded-lg px-8 py-4 font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg border border-rose-700 flex-1"
              >
                <Trash2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
                <span>DELETE</span>
              </button>
            </div>
          </div>
        )}

        {/* Compact Footer */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1 text-gray-600 bg-gray-50 rounded-full px-2 py-1">
              <TrendingUp className="h-3 w-3 text-green-600" />
              <span className="font-medium">
                Created {new Date(flashSale.created_at + 'Z').toLocaleDateString('en-US', { 
                  month: 'short', day: 'numeric' 
                })}
              </span>
            </div>
            <div className="flex items-center gap-1 text-gray-600 bg-gray-50 rounded-full px-2 py-1">
              <Users className="h-3 w-3 text-blue-600" />
              <span className="font-medium">
                Updated {new Date(flashSale.updated_at + 'Z').toLocaleDateString('en-US', { 
                  month: 'short', day: 'numeric' 
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlashSaleCard;
