import React, { useState, useEffect } from 'react';
import { api, type ProductDetail as ProductDetailType, type PropertySpec, type Section } from '../../lib/api';

interface ProductDetailProps {
    productId: string;
}

// Helper to format property value
const formatPropertyValue = (prop: PropertySpec): string => {
    if (prop.value_string) {
        return prop.value_string;
    }
    if (prop.value_numeric !== null) {
        return `${prop.value_numeric}${prop.unit ? ` ${prop.unit}` : ''}`;
    }
    if (prop.value_min !== null && prop.value_max !== null) {
        return `${prop.value_min} - ${prop.value_max}${prop.unit ? ` ${prop.unit}` : ''}`;
    }
    if (prop.value_min !== null) {
        return `≥ ${prop.value_min}${prop.unit ? ` ${prop.unit}` : ''}`;
    }
    if (prop.value_max !== null) {
        return `≤ ${prop.value_max}${prop.unit ? ` ${prop.unit}` : ''}`;
    }
    return '—';
};

// Group properties by category
const groupPropertiesByCategory = (properties: PropertySpec[]): Map<string, PropertySpec[]> => {
    const grouped = new Map<string, PropertySpec[]>();
    properties.forEach(prop => {
        const category = prop.category || 'General';
        if (!grouped.has(category)) {
            grouped.set(category, []);
        }
        grouped.get(category)!.push(prop);
    });
    return grouped;
};

// Section component
const SectionDisplay: React.FC<{ section: Section }> = ({ section }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const isLongText = section.text.length > 500;

    return (
        <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {section.name}
                </h3>
                <span className="text-gray-500 dark:text-gray-400">
                    {isExpanded ? '−' : '+'}
                </span>
            </button>
            {isExpanded && (
                <div className="px-4 pb-4">
                    <p className={`text-gray-700 dark:text-gray-300 whitespace-pre-wrap ${isLongText && !isExpanded ? 'line-clamp-10' : ''}`}>
                        {section.text}
                    </p>
                    {section.page && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Page {section.page}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

// Properties table component
const PropertiesTable: React.FC<{ properties: PropertySpec[] }> = ({ properties }) => {
    const grouped = groupPropertiesByCategory(properties);

    return (
        <div className="space-y-6">
            {Array.from(grouped.entries()).map(([category, props]) => (
                <div key={category}>
                    <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">
                        {category}
                    </h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">
                                        Property
                                    </th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">
                                        Value
                                    </th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">
                                        Test Method
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {props.map((prop, index) => (
                                    <tr
                                        key={index}
                                        className="border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                                    >
                                        <td className="py-2 px-3 text-gray-900 dark:text-gray-100">
                                            {prop.name}
                                            {prop.notes && (
                                                <span className="block text-xs text-gray-500 dark:text-gray-400">
                                                    {prop.notes}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2 px-3 text-gray-700 dark:text-gray-300 font-mono">
                                            {formatPropertyValue(prop)}
                                        </td>
                                        <td className="py-2 px-3 text-gray-500 dark:text-gray-400 text-xs">
                                            {prop.test_method || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
};

export const ProductDetail: React.FC<ProductDetailProps> = ({ productId }) => {
    const [product, setProduct] = useState<ProductDetailType | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const productData = await api.getProduct(productId);
                setProduct(productData);

                // Try to fetch PDF URL
                try {
                    const pdfData = await api.getProductPdf(productId);
                    setPdfUrl(pdfData.pdf_url);
                } catch {
                    // PDF might not be available, that's OK
                    console.log('PDF not available for this product');
                }
            } catch (err) {
                console.error('Failed to fetch product:', err);
                setError(err instanceof Error ? err.message : 'Failed to load product');
            } finally {
                setIsLoading(false);
            }
        };

        fetchProduct();
    }, [productId]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading product...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-16">
                <p className="text-red-500 text-lg mb-4">{error}</p>
                <a
                    href="/products"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                    ← Back to Products
                </a>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="text-center py-16">
                <p className="text-gray-500 text-lg mb-4">Product not found</p>
                <a
                    href="/products"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                    ← Back to Products
                </a>
            </div>
        );
    }

    const { product_info, derived_info } = product;

    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            {/* Back link */}
            <a
                href="/products"
                className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline mb-6"
            >
                ← Back to Products
            </a>

            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-6 mb-6">
                <div className="flex justify-between items-start gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            {product_info.product_name}
                        </h1>
                        {product_info.product_short_name !== product_info.product_name && (
                            <p className="text-lg text-gray-600 dark:text-gray-400">
                                {product_info.product_short_name}
                            </p>
                        )}
                    </div>
                    {product_info.product_family && (
                        <span className="px-3 py-1.5 text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                            {product_info.product_family}
                        </span>
                    )}
                </div>

                {/* Chemical info */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {product_info.cas_number && (
                        <div>
                            <span className="text-sm text-gray-500 dark:text-gray-400">CAS Number:</span>
                            <span className="ml-2 text-gray-900 dark:text-white font-mono">
                                {product_info.cas_number}
                            </span>
                        </div>
                    )}
                    {product_info.chemical_name && (
                        <div>
                            <span className="text-sm text-gray-500 dark:text-gray-400">Chemical Name:</span>
                            <span className="ml-2 text-gray-900 dark:text-white">
                                {product_info.chemical_name}
                            </span>
                        </div>
                    )}
                </div>

                {/* Synonyms */}
                {product_info.synonyms.length > 0 && (
                    <div className="mt-4">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Also known as:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {product_info.synonyms.map((syn, i) => (
                                <span
                                    key={i}
                                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded"
                                >
                                    {syn}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* PDF link */}
                {pdfUrl && (
                    <div className="mt-6">
                        <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download Technical Bulletin (PDF)
                        </a>
                    </div>
                )}
            </div>

            {/* Summary & Key Info */}
            {derived_info?.summary && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                        Summary
                    </h2>
                    <p className="text-gray-700 dark:text-gray-300">
                        {derived_info.summary}
                    </p>
                </div>
            )}

            {/* Key Benefits */}
            {product.key_benefits.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                        Key Benefits
                    </h2>
                    <ul className="list-disc list-inside space-y-1">
                        {product.key_benefits.map((benefit, i) => (
                            <li key={i} className="text-gray-700 dark:text-gray-300">
                                {benefit}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Applications */}
            {(product.applications.length > 0 || product.applications_text) && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                        Applications
                    </h2>
                    {product.applications.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {product.applications.map((app, i) => (
                                <span
                                    key={i}
                                    className="px-3 py-1.5 text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full"
                                >
                                    {app}
                                </span>
                            ))}
                        </div>
                    )}
                    {product.applications_text && (
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {product.applications_text}
                        </p>
                    )}
                </div>
            )}

            {/* Properties & Specifications */}
            {product.properties_and_specifications.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                        Properties & Specifications
                    </h2>
                    <PropertiesTable properties={product.properties_and_specifications} />
                </div>
            )}

            {/* Registrations */}
            {product.registrations.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                        Registrations & Certifications
                    </h2>
                    <div className="space-y-3">
                        {product.registrations.map((reg, i) => (
                            <div
                                key={i}
                                className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800"
                            >
                                <div className="flex flex-wrap gap-2 items-center mb-2">
                                    {reg.authority && (
                                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded">
                                            {reg.authority}
                                        </span>
                                    )}
                                    {reg.jurisdiction && (
                                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded">
                                            {reg.jurisdiction}
                                        </span>
                                    )}
                                    {reg.status && (
                                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                                            {reg.status}
                                        </span>
                                    )}
                                </div>
                                {reg.registration_name && (
                                    <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                                        {reg.registration_name}
                                    </p>
                                )}
                                {reg.registration_number && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 font-mono mt-1">
                                        Reg #: {reg.registration_number}
                                    </p>
                                )}
                                {reg.notes && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                                        {reg.notes}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Document Sections */}
            {product.sections.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        Document Sections
                    </h2>
                    {product.sections.map((section, i) => (
                        <SectionDisplay key={i} section={section} />
                    ))}
                </div>
            )}

            {/* Manufacturer Info */}
            {(product.manufacturer || product.contact_info) && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                        Manufacturer
                    </h2>
                    {product.manufacturer && (
                        <p className="text-gray-900 dark:text-white font-medium mb-2">
                            {product.manufacturer}
                        </p>
                    )}
                    {product.contact_info && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            {product.contact_info.address && (
                                <p>{product.contact_info.address}</p>
                            )}
                            {product.contact_info.phone && (
                                <p>Phone: {product.contact_info.phone}</p>
                            )}
                            {product.contact_info.email && (
                                <p>Email: {product.contact_info.email}</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Document Metadata */}
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-8 text-center">
                Document ID: {product.doc_id}
                {product.extraction_metadata?.extraction_date && (
                    <span className="ml-4">
                        Last updated: {product.extraction_metadata.extraction_date}
                    </span>
                )}
            </div>
        </div>
    );
};
