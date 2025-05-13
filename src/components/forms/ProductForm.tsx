"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from "@/components/auth/AuthProvider";
import { ProductFormData } from "@/types/product";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/firebase/config";
import Image from "next/image";

const platforms = ["YouTube", "TikTok", "Twitter", "Instagram", "Facebook", "Telegram"];

const initialFormData: ProductFormData = {
  platform: "",
  category: "",
  accountLink: "",
  displayName: "",
  price: 0,
  subscribers: 0,
  allowComments: true,
  description: "",
  monthlyIncome: 0,
  monthlyExpenses: 0,
  incomeSource: "",
  expenseDetails: "",
  promotionStrategy: "",
  supportRequirements: "",
  images: [],
  verificationCode: uuidv4().substring(0, 8)
};

export default function ProductForm() {
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [filePreview, setFilePreview] = useState<string[]>([]);
  const [currentSection, setCurrentSection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': []
    },
    onDrop: (acceptedFiles) => {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...acceptedFiles]
      }));

      // Generate previews
      acceptedFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = () => {
          setFilePreview(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : 
              type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
              value
    }));
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
    setFilePreview(prev => prev.filter((_, i) => i !== index));
  };

  const toggleSection = () => {
    // Validate section 1 before proceeding to section 2
    if (currentSection === 1) {
      if (!formData.platform) {
        setError("Please select a platform");
        return;
      }
      if (!formData.accountLink) {
        setError("Please enter the channel link");
        return;
      }
      if (!formData.displayName) {
        setError("Please enter a display name");
        return;
      }
      if (formData.price <= 0) {
        setError("Please enter a valid price");
        return;
      }
      if (formData.subscribers <= 0) {
        setError("Please enter a valid number of subscribers");
        return;
      }
      setError(null);
    } else if (currentSection === 2) {
      // Validate section 2 before going back to section 1
      if (formData.images.length === 0) {
        setError("Please upload at least one photo");
        return;
      }
      setError(null);
    }
    setCurrentSection(currentSection === 1 ? 2 : 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError("You must be logged in to create a listing");
      return;
    }

    // Final validation before submission
    if (!formData.platform) {
      setError("Please select a platform");
      return;
    }
    if (!formData.accountLink) {
      setError("Please enter the channel link");
      return;
    }
    if (!formData.displayName) {
      setError("Please enter a display name");
      return;
    }
    if (formData.price <= 0) {
      setError("Please enter a valid price");
      return;
    }
    if (formData.subscribers <= 0) {
      setError("Please enter a valid number of subscribers");
      return;
    }
    if (!formData.description) {
      setError("Please provide a description");
      return;
    }
    if (formData.images.length === 0) {
      setError("Please upload at least one photo");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Upload images first
      const imageUrls = await Promise.all(
        formData.images.map(async (image) => {
          const storageRef = ref(storage, `product-images/${user.id}/${Date.now()}-${image.name}`);
          await uploadBytes(storageRef, image);
          return getDownloadURL(storageRef);
        })
      );

      // Add product to Firestore
      const productData = {
        userId: user.id,
        userEmail: user.email,
        createdAt: Date.now(),
        platform: formData.platform,
        category: "",
        accountLink: formData.accountLink,
        displayName: formData.displayName,
        price: formData.price,
        subscribers: formData.subscribers,
        allowComments: formData.allowComments,
        description: formData.description,
        monthlyIncome: formData.monthlyIncome,
        monthlyExpenses: formData.monthlyExpenses,
        incomeSource: formData.incomeSource,
        expenseDetails: formData.expenseDetails,
        promotionStrategy: formData.promotionStrategy,
        supportRequirements: formData.supportRequirements,
        imageUrls,
        verificationCode: formData.verificationCode
      };

      const docRef = await addDoc(collection(db, "products"), productData);
      
      router.push(`/products/${docRef.id}`);
    } catch (err) {
      console.error("Error creating product:", err);
      setError("Failed to create listing. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-10 bg-blue-100 rounded-lg shadow-md border border-blue-200 text-blue-800">
        <h2 className="text-2xl font-bold mb-4">Please log in to add a listing</h2>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white/90 rounded-lg shadow-lg p-6 border border-blue-200 text-blue-900">
      <h1 className="text-2xl font-bold mb-6">New Channel Listing</h1>

      {error && (
        <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Section 1: Basic Info */}
        {currentSection === 1 && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-blue-700">Basic Information</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-blue-700 mb-1">Platform</label>
              <select
                name="platform"
                value={formData.platform}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-blue-900"
              >
                <option value="">Select Platform</option>
                {platforms.map(platform => (
                  <option key={platform} value={platform}>{platform}</option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-blue-700 mb-1">Channel Link</label>
              <input
                type="url"
                name="accountLink"
                value={formData.accountLink}
                onChange={handleChange}
                placeholder="https://"
                required
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-blue-900 placeholder-blue-300"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-blue-700 mb-1">Display Name</label>
              <input
                type="text"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                placeholder="Channel or account name"
                required
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-blue-900 placeholder-blue-300"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1">Price ($)</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price === 0 ? "" : formData.price}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                  required
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-blue-900 placeholder-blue-300"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1">Number of Subscribers</label>
                <input
                  type="number"
                  name="subscribers"
                  value={formData.subscribers === 0 ? "" : formData.subscribers}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                  required
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-blue-900 placeholder-blue-300"
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="allowComments"
                  checked={formData.allowComments}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-500 bg-blue-50 border-blue-300 rounded focus:ring-blue-400"
                />
                <span className="ml-2 text-sm text-blue-700">Allow comments on listing</span>
              </label>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={toggleSection}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
        
        {/* Section 2: Detailed Info */}
        {currentSection === 2 && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-blue-700">Detailed Information</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-blue-700 mb-1">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Provide a detailed description (contact information not allowed)"
                required
                rows={4}
                className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-blue-900 placeholder-blue-300"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1">Monthly Income ($)</label>
                <input
                  type="number"
                  name="monthlyIncome"
                  value={formData.monthlyIncome === 0 ? "" : formData.monthlyIncome}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                  required
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-blue-900 placeholder-blue-300"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1">Monthly Expenses ($)</label>
                <input
                  type="number"
                  name="monthlyExpenses"
                  value={formData.monthlyExpenses === 0 ? "" : formData.monthlyExpenses}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                  required
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-blue-900 placeholder-blue-300"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-blue-700 mb-1">Income Source Details</label>
                  <textarea
                    name="incomeSource"
                    value={formData.incomeSource}
                    onChange={handleChange}
                    placeholder="Describe your income sources (ads, sponsorships, etc.)"
                    required
                    rows={2}
                    className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-blue-900 placeholder-blue-300"
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-blue-700 mb-1">Expense Details</label>
                  <textarea
                    name="expenseDetails"
                    value={formData.expenseDetails}
                    onChange={handleChange}
                    placeholder="Describe your expenses (content creation, tools, etc.)"
                    required
                    rows={2}
                    className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-blue-900 placeholder-blue-300"
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-blue-700 mb-1">Promotion Strategy</label>
                  <textarea
                    name="promotionStrategy"
                    value={formData.promotionStrategy}
                    onChange={handleChange}
                    placeholder="How did you promote your account?"
                    required
                    rows={2}
                    className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-blue-900 placeholder-blue-300"
                  />
                </div>
              </div>
              
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-blue-700 mb-1">Support Requirements</label>
                  <textarea
                    name="supportRequirements"
                    value={formData.supportRequirements}
                    onChange={handleChange}
                    placeholder="What is needed to maintain this account?"
                    required
                    rows={2}
                    className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-blue-900 placeholder-blue-300"
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-blue-700 mb-1">Screenshots & Verification Photos</label>
                  <div 
                    {...getRootProps()} 
                    className="border-2 border-dashed border-blue-300 rounded-md p-4 cursor-pointer hover:bg-blue-50 bg-blue-50/50 transition-colors"
                  >
                    <input {...getInputProps()} />
                    <div className="text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mx-auto text-blue-500 mb-1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <p className="text-sm text-blue-700">Drop files here or click to upload</p>
                    </div>
                  </div>
                  
                  {filePreview.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {filePreview.map((src, index) => (
                        <div key={index} className="relative group">
                          <Image 
                            src={src} 
                            alt={`Image ${index + 1}`}
                            width={64}
                            height={64}
                            className="h-16 w-full object-cover rounded-md border border-blue-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between mt-4">
              <button
                type="button"
                onClick={toggleSection}
                className="px-4 py-2 bg-blue-400 text-white rounded-md hover:bg-blue-500 transition-colors"
              >
                Back
              </button>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? "Processing..." : "Create Listing"}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
} 