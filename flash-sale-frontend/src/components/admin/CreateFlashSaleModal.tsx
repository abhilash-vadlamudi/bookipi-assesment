import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Calendar, Clock, Package, DollarSign, Plus, Trash2 } from 'lucide-react';
import { flashSalesAPI } from '../../services/api';
import toast from 'react-hot-toast';

const createFlashSaleSchema = z.object({
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

type CreateFlashSaleFormData = z.infer<typeof createFlashSaleSchema>;

interface CreateFlashSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateFlashSaleModal: React.FC<CreateFlashSaleModalProps> = ({ isOpen, onClose, onSuccess }) => {
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
  } = useForm<CreateFlashSaleFormData>({
    resolver: zodResolver(createFlashSaleSchema),
    defaultValues: {
      products: products
    }
  });

  // Watch for changes to sync with local state
  const watchedProducts = watch('products') || products;

  const addProduct = () => {
    const newProducts = [...products, {
      name: '',
      description: '',
      price: 0,
      quantity: 1
    }];
    setProducts(newProducts);
    setValue('products', newProducts);
  };

  const removeProduct = (index: number) => {
    if (products.length > 1) {
      const newProducts = products.filter((_, i) => i !== index);
      setProducts(newProducts);
      setValue('products', newProducts);
    }
  };

  const updateProduct = (index: number, field: keyof typeof products[0], value: string | number) => {
    const newProducts = [...products];
    newProducts[index] = { ...newProducts[index], [field]: value };
    setProducts(newProducts);
    setValue('products', newProducts);
  };

  const onSubmit = async (data: CreateFlashSaleFormData) => {
    setIsLoading(true);
    try {
      await flashSalesAPI.create({
        name: data.name,
        startTime: data.startTime,
        endTime: data.endTime,
        products: data.products
      });
      
      toast.success('Flash sale created successfully!');
      reset();
      setProducts([{ name: '', description: '', price: 0, quantity: 1 }]);
      onSuccess();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to create flash sale. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSuggestedTimes = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    
    const endTime = new Date(tomorrow);
    endTime.setHours(18, 0, 0, 0);

    setValue('startTime', tomorrow.toISOString().slice(0, 16));
    setValue('endTime', endTime.toISOString().slice(0, 16));
  };

  if (!isOpen) {
    console.log('CreateFlashSaleModal: isOpen is false, not rendering');
    return null;
  }

  console.log('CreateFlashSaleModal: Rendering modal...');

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Create New Flash Sale
            </h2>
            <p className="text-gray-600 mt-1">Set up a new flash sale campaign with products and timing</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100"
            title="Close modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4 bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <div className="bg-blue-600 rounded-lg p-2 mr-3">
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
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Black Friday Electronics Sale 2025"
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
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
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
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.endTime ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.endTime && (
                    <p className="mt-1 text-sm text-red-600">{errors.endTime.message}</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={generateSuggestedTimes}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
              >
                Use suggested times (Tomorrow 10 AM - 6 PM)
              </button>
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
                          title={`Remove product ${index + 1}`}
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
                          {...register(`products.${index}.name` as const)}
                          type="text"
                          value={product.name}
                          onChange={(e) => updateProduct(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                          placeholder="Premium Wireless Headphones"
                        />
                        {errors.products?.[index]?.name && (
                          <p className="mt-1 text-sm text-red-600">{errors.products[index]?.name?.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Price ($) *
                        </label>
                        <input
                          {...register(`products.${index}.price` as const, { valueAsNumber: true })}
                          type="number"
                          step="0.01"
                          min="0"
                          value={product.price}
                          onChange={(e) => updateProduct(index, 'price', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                          placeholder="99.99"
                        />
                        {errors.products?.[index]?.price && (
                          <p className="mt-1 text-sm text-red-600">{errors.products[index]?.price?.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantity *
                        </label>
                        <input
                          {...register(`products.${index}.quantity` as const, { valueAsNumber: true })}
                          type="number"
                          min="1"
                          value={product.quantity}
                          onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                          placeholder="50"
                        />
                        {errors.products?.[index]?.quantity && (
                          <p className="mt-1 text-sm text-red-600">{errors.products[index]?.quantity?.message}</p>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description *
                        </label>
                        <textarea
                          {...register(`products.${index}.description` as const)}
                          value={product.description}
                          onChange={(e) => updateProduct(index, 'description', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors resize-none"
                          placeholder="High-quality noise-cancelling wireless headphones with 30-hour battery life"
                        />
                        {errors.products?.[index]?.description && (
                          <p className="mt-1 text-sm text-red-600">{errors.products[index]?.description?.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {errors.products && (
                <p className="text-sm text-red-600">{errors.products.message}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>Create Flash Sale</span>
                  </>
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

export default CreateFlashSaleModal;
