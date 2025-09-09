import React from 'react';
import { Clock, Tag, TrendingUp, Users } from 'lucide-react';
import FlashSaleList from '../components/flash-sales/FlashSaleList';

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Welcome to <span className="text-blue-600">FlashSale</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8 leading-relaxed">
              Discover incredible deals on premium products with time-limited flash sales. 
              Save up to 70% on electronics, fashion, and more.
            </p>
            
            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
              <div className="flex flex-col items-center p-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Limited Time</h3>
                <p className="text-gray-600 text-center">Flash sales with countdown timers for urgency</p>
              </div>
              
              <div className="flex flex-col items-center p-6">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Tag className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Best Prices</h3>
                <p className="text-gray-600 text-center">Exclusive discounts you won't find elsewhere</p>
              </div>
              
              <div className="flex flex-col items-center p-6">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Trending Items</h3>
                <p className="text-gray-600 text-center">Popular products everyone is talking about</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Sales Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">
              🔥 Active Flash Sales
            </h2>
            <p className="text-blue-100 text-lg">
              Limited time offers with exclusive discounts. Act fast before they're gone!
            </p>
          </div>
        </div>
      </div>

      {/* Flash Sales List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <FlashSaleList />
      </div>
    </div>
  );
};

export default HomePage;
