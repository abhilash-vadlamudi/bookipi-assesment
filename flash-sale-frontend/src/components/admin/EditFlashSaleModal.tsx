import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Calendar, Clock, Package, DollarSign, Plus, Trash2 } from 'lucide-react';
import { flashSalesAPI, FlashSale } from '../../services/api';
import toast from 'react-hot-toast';

const editFlashSaleSchema = z.object({
  name: z.string().min(3, 'Flash sale name must be at least 3 characters'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  products: z.array(z.object({
    name: z.string().min(1, 'Product name is required'),
    description: z.string().min(1, 'Product description is required'),
    price: z.number().min(0.01, 'Price must be greater than 0'),
    quantity: z.number().min(1, 'Quantity must be at least 1')
  })).min(1, 'At least one product is required')
}).refine((data) => new Date(data.endTime) > new Date(data.startTime), {
  message: "End time must be after start time",
  path: ["endTime"],
});

type EditFlashSaleFormData = z.infer<typeof editFlashSaleSchema>;

interface EditFlashSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  flashSale: FlashSale | null;
}

const EditFlashSaleModal: React.FC<EditFlashSaleModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  flashSale 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState([{
    name: '',
    description: '',
    price: 0,
    quantity: 1
  }]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<EditFlashSaleFormData>({
    resolver: zodResolver(editFlashSaleSchema),
    defaultValues: {
      name: '',
      startTime: '',
      endTime: '',
      products: [{
        name: '',
        description: '',
        price: 0,
        quantity: 1
      }]
    }
  });

  useEffect(() => {
    if (flashSale && isOpen) {
      // Populate form with existing flash sale data
      setValue('name', flashSale.name);
      
      // Format dates for datetime-local input
      const startTime = new Date(flashSale.start_time);
      const endTime = new Date(flashSale.end_time);
      
      setValue('startTime', startTime.toISOString().slice(0, 16));
      setValue('endTime', endTime.toISOString().slice(0, 16));

      // For now, use sample product data since flash sale doesn't include products
      // In a real app, you'd fetch products for this flash sale
      const sampleProducts = [
        {
          name: 'Product 1',
          description: 'Sample product description',
          price: 99.99,
          quantity: 50
        }
      ];
      
      setProducts(sampleProducts);
      setValue('products', sampleProducts);
    }
  }, [flashSale, isOpen, setValue]);

  const addProduct = () => {
    const newProduct = {
      name: '',
      description: '',
      price: 0,
      quantity: 1
    };
    const updatedProducts = [...products, newProduct];
    setProducts(updatedProducts);
    setValue('products', updatedProducts);
  };

  const removeProduct = (index: number) => {
    if (products.length > 1) {
      const updatedProducts = products.filter((_, i) => i !== index);
      setProducts(updatedProducts);
      setValue('products', updatedProducts);
    }
  };

  const updateProduct = (index: number, field: string, value: string | number) => {
    const updatedProducts = [...products];
    updatedProducts[index] = {
      ...updatedProducts[index],
      [field]: value
    };
    setProducts(updatedProducts);
    setValue('products', updatedProducts);
  };

  const onSubmit = async (data: EditFlashSaleFormData) => {
    if (!flashSale) return;
    
    setIsLoading(true);
    try {
      // For updates, only send the fields that have changed
      const updateData: any = {};
      
      if (data.name !== flashSale.name) {
        updateData.name = data.name;
      }
      
      const currentStartTime = new Date(flashSale.start_time).toISOString().slice(0, 16);
      const currentEndTime = new Date(flashSale.end_time).toISOString().slice(0, 16);
      
      if (data.startTime !== currentStartTime) {
        updateData.startTime = data.startTime;
      }
      
      if (data.endTime !== currentEndTime) {
        updateData.endTime = data.endTime;
      }
      
      // Only send products if they were actually changed
      // For now, we'll skip products update since flash sales don't have products in the current model
      // updateData.products = data.products;
      
      if (Object.keys(updateData).length === 0) {
        toast.success('No changes to save');
        return;
      }
      
      await flashSalesAPI.update(flashSale.id.toString(), updateData);
      
      toast.success('Flash sale updated successfully');
      reset();
      setProducts([{
        name: '',
        description: '',
        price: 0,
        quantity: 1
      }]);
      onSuccess();
    } catch (error: any) {
      console.error('Update flash sale error:', error);
      toast.error(error.response?.data?.message || 'Failed to update flash sale');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    setProducts([{
      name: '',
      description: '',
      price: 0,
      quantity: 1
    }]);
    onClose();
  };

  if (!isOpen || !flashSale) {
    console.log('EditFlashSaleModal: not rendering - isOpen:', isOpen, 'flashSale:', !!flashSale);
    return null;
  }

  console.log('EditFlashSaleModal: Rendering modal for:', flashSale.name);

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Edit Flash Sale
            </h2>
            <p className="text-gray-600 mt-1">Update your flash sale details and products</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100"
            title="Close modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <form id="edit-flash-sale-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4 bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <div className="bg-orange-600 rounded-lg p-2 mr-3">
                  <Package className="h-4 w-4 text-white" />
                </div>
                Basic Information
              </h3>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Flash Sale Name *
                </label>
                <input
                  {...register('name')}
                  type="text"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors ${
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Black Friday Electronics Sale"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              {/* Timing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="h-4 w-4 inline mr-1 text-green-600" />
                    Start Time *
                  </label>
                  <input
                    {...register('startTime')}
                    type="datetime-local"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors ${
                      errors.startTime ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.startTime && (
                    <p className="mt-1 text-sm text-red-600">{errors.startTime.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="h-4 w-4 inline mr-1 text-red-600" />
                    End Time *
                  </label>
                  <input
                    {...register('endTime')}
                    type="datetime-local"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors ${
                      errors.endTime ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.endTime && (
                    <p className="mt-1 text-sm text-red-600">{errors.endTime.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Products */}
            <div className="space-y-4 bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <div className="bg-green-600 rounded-lg p-2 mr-3">
                    <DollarSign className="h-4 w-4 text-white" />
                  </div>
                  Products ({products.length})
                </h3>
                <button
                  type="button"
                  onClick={addProduct}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Product</span>
                </button>
              </div>

              <div className="space-y-4">
                {products.map((product, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900">Product {index + 1}</h4>
                      {products.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeProduct(index)}
                          className="text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                          title="Remove product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Product Name *
                        </label>
                        <input
                          type="text"
                          value={product.name}
                          onChange={(e) => updateProduct(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                          placeholder="Product name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description *
                        </label>
                        <input
                          type="text"
                          value={product.description}
                          onChange={(e) => updateProduct(index, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                          placeholder="Product description"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Price ($) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={product.price}
                          onChange={(e) => updateProduct(index, 'price', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantity *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={product.quantity}
                          onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                          placeholder="1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {errors.products && (
                <p className="mt-1 text-sm text-red-600">{errors.products.message}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Updating...</span>
                  </div>
                ) : (
                  'Update Flash Sale'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default EditFlashSaleModal;
