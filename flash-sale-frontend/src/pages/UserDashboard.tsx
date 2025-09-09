import React, { useState, useEffect } from 'react';
import { User, ShoppingBag, Clock, TrendingUp, Star } from 'lucide-react';
import FlashSaleList from '../components/flash-sales/FlashSaleList';
import { flashSalesAPI } from '../services/api';
import toast from 'react-hot-toast';

interface Purchase {
  id: string;
  user_id: string;
  product_id: number;
  flash_sale_id: number;
  quantity: number;
  total_amount: number;
  status: string;
  purchase_time: string;
  product_name?: string;
  product_price?: number;
  flash_sale_name?: string;
}

interface FlashSale {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  is_active: number; // SQLite stores boolean as integer (0 or 1)
}

const UserDashboard: React.FC = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'flashsales' | 'history'>('overview');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setIsLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      if (user.id) {
        // Fetch user purchase history
        const purchaseResponse = await flashSalesAPI.getUserPurchaseHistory(user.id);
        if (purchaseResponse.data.success && purchaseResponse.data.data) {
          setPurchases(purchaseResponse.data.data.purchases || []);
        }
      }
      
      // Fetch all flash sales to count active ones
      const flashSalesResponse = await flashSalesAPI.getAll();
      if (flashSalesResponse.data.success && flashSalesResponse.data.data) {
        setFlashSales(flashSalesResponse.data.data.flashSales || []);
      }
      
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Failed to load user data');
    } finally {
      setIsLoading(false);
    }
  };

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Calculate stats from actual data
  const totalPurchases = purchases.length;
  const totalSpent = purchases.reduce((sum, purchase) => sum + (purchase.total_amount || 0), 0);
  const completedPurchases = purchases.filter(p => p.status === 'completed').length;
  
  // Calculate active flash sales count
  const now = new Date();
  const activeFlashSalesCount = flashSales.filter(sale => {
    const startTime = new Date(sale.start_time);
    const endTime = new Date(sale.end_time);
    return startTime <= now && endTime > now && sale.is_active === 1;
  }).length;

  const stats = [
    {
      title: 'Total Purchases',
      value: totalPurchases.toString(),
      icon: ShoppingBag,
      color: 'bg-blue-500',
      change: `${completedPurchases} completed`,
      changeType: 'positive' as const
    },
    {
      title: 'Total Spent',
      value: `$${totalSpent.toFixed(2)}`,
      icon: TrendingUp,
      color: 'bg-green-500',
      change: `Avg: $${totalPurchases > 0 ? (totalSpent / totalPurchases).toFixed(2) : '0.00'}`,
      changeType: 'neutral' as const
    },
    {
      title: 'Active Sales',
      value: activeFlashSalesCount.toString(),
      icon: Clock,
      color: 'bg-orange-500',
      change: 'Available now',
      changeType: 'neutral' as const
    },
    {
      title: 'Member Since',
      value: new Date(user.created_at || Date.now()).toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      }),
      icon: Star,
      color: 'bg-purple-500',
      change: 'Premium member',
      changeType: 'positive' as const
    }
  ];

  const tabs = [
    { id: 'overview', name: 'Overview', icon: User },
    { id: 'flashsales', name: 'Flash Sales', icon: Clock },
    { id: 'history', name: 'Purchase History', icon: ShoppingBag }
  ];

  const StatCard: React.FC<{
    title: string;
    value: string;
    icon: React.ElementType;
    color: string;
    change: string;
    changeType: 'positive' | 'negative' | 'neutral';
  }> = ({ title, value, icon: Icon, color, change, changeType }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className={`${color} rounded-lg p-3`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          <div className="mt-2">
            <span className={`text-sm font-medium px-2 py-1 rounded ${
              changeType === 'positive' ? 'text-green-700 bg-green-100' : 
              changeType === 'negative' ? 'text-red-700 bg-red-100' : 'text-blue-700 bg-blue-100'
            }`}>
              {change}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                My Dashboard
              </h1>
              <p className="text-gray-600 mt-1">Welcome back, {user.email?.split('@')[0] || 'User'}!</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Premium Member
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat, index) => (
                <StatCard key={index} {...stat} />
              ))}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('flashsales')}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg p-4 text-center transition-colors border border-blue-200"
                >
                  <Clock className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <p className="font-medium">Browse Flash Sales</p>
                  <p className="text-sm text-blue-600 mt-1">{activeFlashSalesCount} active sales</p>
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className="bg-green-50 hover:bg-green-100 text-green-700 rounded-lg p-4 text-center transition-colors border border-green-200"
                >
                  <ShoppingBag className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p className="font-medium">View Purchases</p>
                  <p className="text-sm text-green-600 mt-1">{totalPurchases} total orders</p>
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="bg-blue-600 rounded-full p-2">
                    <ShoppingBag className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Welcome to FlashSale!</p>
                    <p className="text-sm text-gray-600 mt-1">Account created successfully</p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(user.created_at || Date.now()).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'flashsales' && (
          <div>
            <FlashSaleList />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchase History</h3>
            {purchases.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="h-8 w-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No purchases yet</h4>
                <p className="text-gray-600 mb-6">Start shopping to see your purchase history here.</p>
                <button
                  onClick={() => setActiveTab('flashsales')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Browse Flash Sales
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {purchases.map((purchase) => (
                  <div key={purchase.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="font-medium text-gray-900">{purchase.flash_sale_name || 'Flash Sale'}</h4>
                        <p className="text-sm text-gray-600">Quantity: {purchase.quantity}</p>
                        {purchase.product_name && (
                          <p className="text-sm text-gray-600">Product: {purchase.product_name}</p>
                        )}
                        <p className="text-sm text-gray-500">{new Date(purchase.purchase_time).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="font-semibold text-gray-900">${purchase.total_amount.toFixed(2)}</p>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                          purchase.status === 'completed' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {purchase.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;
