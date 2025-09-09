import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Calendar,
  Clock,
  Target,
  Zap
} from 'lucide-react';

interface AdminStatsProps {
  className?: string;
}

interface SalesData {
  name: string;
  sales: number;
  revenue: number;
  orders: number;
}

interface ProductData {
  name: string;
  sold: number;
  revenue: number;
  fill: string;
}

interface TrendData {
  date: string;
  revenue: number;
  orders: number;
  conversion: number;
}

const AdminStats: React.FC<AdminStatsProps> = ({ className = '' }) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [isLoading, setIsLoading] = useState(true);

  // Mock data - in real app, this would come from API
  const salesData: SalesData[] = [
    { name: 'Mon', sales: 45, revenue: 2400, orders: 24 },
    { name: 'Tue', sales: 52, revenue: 3200, orders: 28 },
    { name: 'Wed', sales: 38, revenue: 1800, orders: 18 },
    { name: 'Thu', sales: 65, revenue: 4100, orders: 35 },
    { name: 'Fri', sales: 71, revenue: 4800, orders: 42 },
    { name: 'Sat', sales: 89, revenue: 6200, orders: 58 },
    { name: 'Sun', sales: 67, revenue: 4500, orders: 38 }
  ];

  const productData: ProductData[] = [
    { name: 'Electronics', sold: 45, revenue: 25000, fill: '#3B82F6' },
    { name: 'Clothing', sold: 35, revenue: 18000, fill: '#10B981' },
    { name: 'Home & Garden', sold: 25, revenue: 12000, fill: '#F59E0B' },
    { name: 'Sports', sold: 20, revenue: 8000, fill: '#EF4444' },
    { name: 'Books', sold: 15, revenue: 4500, fill: '#8B5CF6' }
  ];

  const trendData: TrendData[] = [
    { date: '2025-01-01', revenue: 4200, orders: 42, conversion: 3.2 },
    { date: '2025-01-02', revenue: 3800, orders: 38, conversion: 2.8 },
    { date: '2025-01-03', revenue: 5100, orders: 51, conversion: 4.1 },
    { date: '2025-01-04', revenue: 4700, orders: 47, conversion: 3.7 },
    { date: '2025-01-05', revenue: 6200, orders: 62, conversion: 4.8 },
    { date: '2025-01-06', revenue: 5800, orders: 58, conversion: 4.5 },
    { date: '2025-01-07', revenue: 6900, orders: 69, conversion: 5.2 }
  ];

  const keyMetrics = [
    {
      title: 'Total Revenue',
      value: '$124,592',
      change: '+12.5%',
      trend: 'up' as const,
      icon: DollarSign,
      color: 'bg-green-500'
    },
    {
      title: 'Active Flash Sales',
      value: '8',
      change: '+2',
      trend: 'up' as const,
      icon: Zap,
      color: 'bg-blue-500'
    },
    {
      title: 'Total Orders',
      value: '1,247',
      change: '+8.3%',
      trend: 'up' as const,
      icon: ShoppingCart,
      color: 'bg-purple-500'
    },
    {
      title: 'Conversion Rate',
      value: '4.2%',
      change: '-0.3%',
      trend: 'down' as const,
      icon: Target,
      color: 'bg-orange-500'
    },
    {
      title: 'Active Users',
      value: '2,847',
      change: '+15.2%',
      trend: 'up' as const,
      icon: Users,
      color: 'bg-indigo-500'
    },
    {
      title: 'Products Sold',
      value: '3,684',
      change: '+9.1%',
      trend: 'up' as const,
      icon: Package,
      color: 'bg-pink-500'
    }
  ];

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [timeRange]);

  const StatCard: React.FC<{
    title: string;
    value: string;
    change: string;
    trend: 'up' | 'down';
    icon: React.ElementType;
    color: string;
  }> = ({ title, value, change, trend, icon: Icon, color }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`${color} p-3 rounded-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
      <div className="flex items-center mt-4">
        {trend === 'up' ? (
          <TrendingUp className="h-4 w-4 text-green-500" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-500" />
        )}
        <span className={`text-sm font-medium ml-1 ${
          trend === 'up' ? 'text-green-600' : 'text-red-600'
        }`}>
          {change}
        </span>
        <span className="text-sm text-gray-500 ml-1">vs last period</span>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <div className="bg-gray-200 h-80 rounded-lg"></div>
            <div className="bg-gray-200 h-80 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-gray-600 mt-1">Comprehensive insights into your flash sale performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-500" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            title="Select time range"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {keyMetrics.map((metric, index) => (
          <StatCard key={index} {...metric} />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Trend Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Revenue Trend</h3>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>Real-time</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date: any) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  name === 'revenue' ? `$${value.toLocaleString()}` : value,
                  name === 'revenue' ? 'Revenue' : 'Orders'
                ]}
                labelFormatter={(date: any) => new Date(date).toLocaleDateString()}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Top Product Categories</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={productData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="sold"
                label={({ name, percent }: any) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
              >
                {productData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number, name: string) => [value, 'Items Sold']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Sales Bar Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Weekly Sales Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion Rate Line Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Conversion Rate Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date: any) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [`${value}%`, 'Conversion Rate']}
                labelFormatter={(date: any) => new Date(date).toLocaleDateString()}
              />
              <Line
                type="monotone"
                dataKey="conversion"
                stroke="#F59E0B"
                strokeWidth={3}
                dot={{ r: 6 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance Summary */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-sm p-8 text-white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="bg-white bg-opacity-20 rounded-lg p-4 mb-4">
              <TrendingUp className="h-8 w-8 mx-auto" />
            </div>
            <h4 className="text-xl font-bold mb-2">Growth Rate</h4>
            <p className="text-3xl font-bold mb-1">+24.5%</p>
            <p className="text-blue-100">Month over month</p>
          </div>
          <div className="text-center">
            <div className="bg-white bg-opacity-20 rounded-lg p-4 mb-4">
              <Target className="h-8 w-8 mx-auto" />
            </div>
            <h4 className="text-xl font-bold mb-2">Success Rate</h4>
            <p className="text-3xl font-bold mb-1">94.2%</p>
            <p className="text-blue-100">Flash sale completion</p>
          </div>
          <div className="text-center">
            <div className="bg-white bg-opacity-20 rounded-lg p-4 mb-4">
              <Zap className="h-8 w-8 mx-auto" />
            </div>
            <h4 className="text-xl font-bold mb-2">Avg. Sale Duration</h4>
            <p className="text-3xl font-bold mb-1">2.4h</p>
            <p className="text-blue-100">Until sold out</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStats;
