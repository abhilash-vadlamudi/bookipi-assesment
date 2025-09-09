import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  BarChart3, 
  Clock, 
  DollarSign, 
  Users, 
  Package,
  Settings,
  RefreshCw,
  X
} from 'lucide-react';
import FlashSaleList from '../components/flash-sales/FlashSaleList';
import { FlashSale, flashSalesAPI } from '../services/api';
import toast from 'react-hot-toast';

interface StatsData {
  total_sales: number;
  active_flash_sales: number;
}

// Modal component moved outside to prevent re-creation on every render
const Modal: React.FC<{ children: React.ReactNode; onClose: () => void }> = ({ children, onClose }) => {
  useEffect(() => {
    // Disable body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {children}
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'flashsales'>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<StatsData>({
    total_sales: 0,
    active_flash_sales: 0,
  });
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingFlashSale, setEditingFlashSale] = useState<FlashSale | null>(null);
  const [deletingFlashSale, setDeletingFlashSale] = useState<FlashSale | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    endTime: '',
    product: {
      name: '',
      description: '',
      price: '',
      quantity: ''
    }
  });

  // Use useCallback to prevent re-creation of handlers on every render
  const handleInputChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleProductInputChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      product: {
        ...prev.product,
        [field]: value
      }
    }));
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const response = await flashSalesAPI.getAll();        
        if (response.data.success) {
          const flashSales = response.data.data?.flashSales || [];          
          const currentTime = new Date().getTime();          
          const activeFlashSales = flashSales.filter((sale: FlashSale) => {
            let startTime, endTime;
            
            try {
              // Handle date parsing properly with UTC
              const startTimeISO = sale.start_time.includes('Z') ? sale.start_time : sale.start_time.replace(' ', 'T') + 'Z';
              const endTimeISO = sale.end_time.includes('Z') ? sale.end_time : sale.end_time.replace(' ', 'T') + 'Z';
              
              startTime = new Date(startTimeISO).getTime();
              endTime = new Date(endTimeISO).getTime();
            } catch (error) {
              console.error('Date parsing error for sale:', sale.name, error);
              return false;
            }
            
            const isActive = currentTime >= startTime && currentTime <= endTime && sale.is_active;
            return isActive;
          });
          
          const calculatedStats = {
            total_sales: flashSales.length,
            active_flash_sales: activeFlashSales.length,
          };
          setStats(calculatedStats);
        } else {
          console.error('Flash sales API error:', response.data.message);
          toast.error(response.data.message || 'Failed to fetch stats');
        }
      } catch (error: any) {
        console.error('Error fetching flash sales:', error);
        toast.error('Failed to fetch dashboard stats');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleCreateFlashSale = () => {
    console.log('Modal opening...');
    setShowCreateModal(true);
    console.log('Modal state:', true);
  };
  
  const handleEditFlashSale = (flashSale: FlashSale) => {
    setEditingFlashSale(flashSale);
    setFormData({
      name: flashSale.name,
      startTime: new Date(flashSale.start_time).toISOString().slice(0, 16),
      endTime: new Date(flashSale.end_time).toISOString().slice(0, 16),
      product: {
        name: '',
        description: '',
        price: '',
        quantity: ''
      }
    });
    setShowEditModal(true);
  };

  const handleDeleteFlashSale = (flashSale: FlashSale) => {
    setDeletingFlashSale(flashSale);
    setShowDeleteModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const createData = {
        name: formData.name,
        startTime: formData.startTime,
        endTime: formData.endTime,
        products: [
          {
            name: formData.product.name || "Default Product",
            description: formData.product.description || "Flash sale product",
            price: parseFloat(formData.product.price) || 99.99,
            quantity: parseInt(formData.product.quantity) || 100
          }
        ]
      };

      const response = await flashSalesAPI.create(createData);

      if (response.data.success) {
        setShowCreateModal(false);
        setFormData({ 
          name: '', 
          startTime: '', 
          endTime: '',
          product: {
            name: '',
            description: '',
            price: '',
            quantity: ''
          }
        });
        toast.success('Flash sale created successfully!');
        // Refresh the component
        window.location.reload();
      } else {
        toast.error(response.data.message || 'Failed to create flash sale');
      }
    } catch (error: any) {
      console.error('Error creating flash sale:', error);
      toast.error(error.response?.data?.message || 'Failed to create flash sale');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFlashSale) return;

    try {
      setIsLoading(true);
      const updateData = {
        name: formData.name,
        startTime: formData.startTime,
        endTime: formData.endTime,
        products: [
          {
            name: "Default Product",
            description: "Default product for flash sale",
            price: 99.99,
            quantity: 100
          }
        ]
      };

      const response = await flashSalesAPI.update(editingFlashSale.id.toString(), updateData);

      if (response.data.success) {
        setShowEditModal(false);
        setEditingFlashSale(null);
        setFormData({ 
          name: '', 
          startTime: '', 
          endTime: '',
          product: {
            name: '',
            description: '',
            price: '',
            quantity: ''
          }
        });
        toast.success('Flash sale updated successfully!');
        window.location.reload();
      } else {
        toast.error(response.data.message || 'Failed to update flash sale');
      }
    } catch (error: any) {
      console.error('Error updating flash sale:', error);
      toast.error(error.response?.data?.message || 'Failed to update flash sale');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingFlashSale) return;

    try {
      setIsLoading(true);
      const response = await flashSalesAPI.delete(deletingFlashSale.id.toString());

      if (response.data.success) {
        setShowDeleteModal(false);
        setDeletingFlashSale(null);
        toast.success('Flash sale deleted successfully!');
        window.location.reload();
      } else {
        toast.error(response.data.message || 'Failed to delete flash sale');
      }
    } catch (error: any) {
      console.error('Error deleting flash sale:', error);
      toast.error(error.response?.data?.message || 'Failed to delete flash sale');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Admin Dashboard
                </h1>
                <p className="text-gray-600 mt-1">Manage your flash sales and monitor performance</p>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'dashboard'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('flashsales')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'flashsales'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Flash Sales
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'dashboard' && (
            <section>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Sales</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.total_sales}</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <BarChart3 className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Flash Sales</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.active_flash_sales}</p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <Clock className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <button
                    onClick={handleCreateFlashSale}
                    className="flex flex-col items-center justify-center space-y-3 p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <div className="p-3 bg-blue-100 rounded-full">
                      <Plus className="h-6 w-6 text-blue-600" />
                    </div>
                    <span className="text-gray-700 font-medium">Create Flash Sale</span>
                    <span className="text-sm text-gray-500 text-center">Start a new flash sale campaign</span>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('flashsales')}
                    className="flex flex-col items-center justify-center space-y-3 p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
                  >
                    <div className="p-3 bg-purple-100 rounded-full">
                      <Package className="h-6 w-6 text-purple-600" />
                    </div>
                    <span className="text-gray-700 font-medium">Manage Sales</span>
                    <span className="text-sm text-gray-500 text-center">Edit and monitor your campaigns</span>
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                  <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors">
                    <RefreshCw className="h-4 w-4" />
                    <span className="text-sm font-medium">Refresh</span>
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4 p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 font-medium">Flash sale "Summer Deals" started successfully</p>
                      <p className="text-sm text-gray-500">2 hours ago</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 font-medium">New user registered: user1@example.com</p>
                      <p className="text-sm text-gray-500">4 hours ago</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 font-medium">Flash sale "Weekend Gaming Special" scheduled to start in 1 hour</p>
                      <p className="text-sm text-gray-500">6 hours ago</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'flashsales' && (
            <div>
              <FlashSaleList 
                showCreateButton={true}
                onCreateClick={handleCreateFlashSale}
                isAdminView={true}
                onEditFlashSale={handleEditFlashSale}
                onDeleteFlashSale={handleDeleteFlashSale}
              />
            </div>
          )}
        </div>
      </div>

      {/* Create Flash Sale Modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)}>
          <div className="modal-content bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create New Flash Sale</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Close modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleCreateSubmit} className="space-y-6">
                <div>
                  <label htmlFor="create-name" className="block text-sm font-medium text-gray-700 mb-2">
                    Flash Sale Name
                  </label>
                  <input
                    type="text"
                    id="create-name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. Summer Gaming Sale 2025"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="create-startTime" className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      id="create-startTime"
                      value={formData.startTime}
                      onChange={(e) => handleInputChange('startTime', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="create-endTime" className="block text-sm font-medium text-gray-700 mb-2">
                      End Time
                    </label>
                    <input
                      type="datetime-local"
                      id="create-endTime"
                      value={formData.endTime}
                      onChange={(e) => handleInputChange('endTime', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                {/* Product Information */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Product Information</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="create-productName" className="block text-sm font-medium text-gray-700 mb-2">
                        Product Name
                      </label>
                      <input
                        type="text"
                        id="create-productName"
                        value={formData.product.name}
                        onChange={(e) => handleProductInputChange('name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g. ROG Gaming Laptop RTX 4070"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="create-productDescription" className="block text-sm font-medium text-gray-700 mb-2">
                        Product Description
                      </label>
                      <textarea
                        id="create-productDescription"
                        value={formData.product.description}
                        onChange={(e) => handleProductInputChange('description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g. High-performance gaming laptop with RTX 4070, 32GB RAM, 1TB SSD"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="create-productPrice" className="block text-sm font-medium text-gray-700 mb-2">
                          Price ($)
                        </label>
                        <input
                          type="number"
                          id="create-productPrice"
                          value={formData.product.price}
                          onChange={(e) => handleProductInputChange('price', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g. 1899.99"
                          step="0.01"
                          min="0"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="create-productQuantity" className="block text-sm font-medium text-gray-700 mb-2">
                          Available Quantity
                        </label>
                        <input
                          type="number"
                          id="create-productQuantity"
                          value={formData.product.quantity}
                          onChange={(e) => handleProductInputChange('quantity', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g. 25"
                          min="1"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium"
                  >
                    Create Flash Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Flash Sale Modal */}
      {showEditModal && editingFlashSale && (
        <Modal onClose={() => setShowEditModal(false)}>
          <div className="modal-content bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Edit Flash Sale</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Close modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleEditSubmit} className="space-y-6">
                <div>
                  <label htmlFor="editName" className="block text-sm font-medium text-gray-700 mb-2">
                    Flash Sale Name
                  </label>
                  <input
                    type="text"
                    id="editName"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter flash sale name..."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="editStartTime" className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      id="editStartTime"
                      value={formData.startTime}
                      onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="editEndTime" className="block text-sm font-medium text-gray-700 mb-2">
                      End Time
                    </label>
                    <input
                      type="datetime-local"
                      id="editEndTime"
                      value={formData.endTime}
                      onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium"
                  >
                    Update Flash Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingFlashSale && (
        <Modal onClose={() => setShowDeleteModal(false)}>
          <div className="modal-content bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Delete</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete the flash sale "{deletingFlashSale.name}"? This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors font-medium"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default AdminDashboard;
