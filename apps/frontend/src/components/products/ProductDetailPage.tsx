import React, { useEffect } from 'react';
import { useProductDetail } from '../../hooks/useProducts';
import { ProductDetail } from './ProductDetail';

export interface ProductDetailPageProps {
  productId: string;
}

export default function ProductDetailPage({ productId }: ProductDetailPageProps) {
  const {
    product,
    relatedProducts,
    loading,
    error,
    loadProduct,
  } = useProductDetail();

  useEffect(() => {
    if (productId) {
      loadProduct(productId);
    }
  }, [productId, loadProduct]);

  const handleBack = () => {
    // Navigate back to browse page
    window.location.href = '/browse';
  };

  const handleViewProduct = (newProductId: string) => {
    // Navigate to the new product page
    window.location.href = `/products/${newProductId}`;
  };

  return (
    <ProductDetail
      product={product}
      relatedProducts={relatedProducts}
      loading={loading}
      error={error}
      onBack={handleBack}
      onViewProduct={handleViewProduct}
    />
  );
}