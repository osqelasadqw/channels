"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/firebase/config";
import { doc, getDoc, addDoc, collection, query, where, getDocs } from "firebase/firestore";
import { Product } from "@/types/product";

interface ProductPageProps {
  params: {
    id: string;
  };
}

export default function ProductPage({ params }: ProductPageProps) {
  const pathname = usePathname();
  const productId = pathname.split('/').pop() || '';
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [contactLoading, setContactLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const [showAllDetailsModal, setShowAllDetailsModal] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);

        const productDocRef = doc(db, "products", productId);
        const productDoc = await getDoc(productDocRef);

        if (productDoc.exists()) {
          setProduct({
            id: productDoc.id,
            ...productDoc.data()
          } as Product);
        } else {
          setError("Product not found");
        }
      } catch (err) {
        console.error("Error fetching product:", err);
        setError("Failed to load product details");
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const nextImage = () => {
    if (!product || product.imageUrls.length <= 1) return;
    setCurrentImageIndex((prev) => 
      prev === product.imageUrls.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    if (!product || product.imageUrls.length <= 1) return;
    setCurrentImageIndex((prev) => 
      prev === 0 ? product.imageUrls.length - 1 : prev - 1
    );
  };

  const handleContactSeller = async () => {
    if (!user) {
      alert("Please log in to contact the seller");
      router.push('/login');
      return;
    }

    if (!product) return;

    // Don't allow contacting yourself
    if (user.id === product.userId) {
      alert("You cannot contact yourself");
      return;
    }

    try {
      setContactLoading(true);

      // Check if a chat already exists
      const chatsQuery = query(
        collection(db, "chats"),
        where("productId", "==", product.id),
        where("participants", "array-contains", user.id)
      );

      const existingChats = await getDocs(chatsQuery);
      
      if (!existingChats.empty) {
        // Chat already exists, redirect to it
        const chatId = existingChats.docs[0].id;
        router.push(`/my-chats`);
        return;
      }

      // Create a new chat
      const chatData = {
        productId: product.id,
        participants: [user.id, product.userId],
        participantNames: {
          [user.id]: user.name,
          [product.userId]: product.userEmail.split('@')[0] // Simple name from email
        },
        participantPhotos: {
          [user.id]: user.photoURL || "",
          [product.userId]: "" // Assuming no photo available
        },
        createdAt: Date.now(),
        adminJoined: false
      };

      const chatRef = await addDoc(collection(db, "chats"), chatData);
      
      // Redirect to the new chat
      router.push(`/my-chats`);
    } catch (err) {
      console.error("Error creating chat:", err);
      alert("Failed to initiate chat. Please try again.");
    } finally {
      setContactLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full bg-indigo-900 min-h-screen"></div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-4xl mx-auto my-8 bg-red-50 text-red-700 p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Error</h2>
        <p className="text-lg mb-6">{error || "Product not found"}</p>
        <Link 
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full bg-indigo-900 min-h-screen">
      <div className="max-w-[90%] mx-auto px-2 sm:px-4 py-6 sm:py-8 overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:none]">
        {/* Breadcrumbs */}
        <nav className="inline-flex items-center text-sm sm:text-base text-gray-100 mb-4 sm:mb-8 p-2 sm:p-3 rounded-lg overflow-hidden">
          <Link href="/" className="hover:text-cyan-300 flex items-center min-w-0 relative group transition-colors duration-200 ease-in-out">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-1.5 text-gray-300 flex-shrink-0 group-hover:text-cyan-300 transition-colors duration-200 ease-in-out">
              <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 10.707V17.5a1.5 1.5 0 0 1-1.5 1.5h-3.5a.5.5 0 0 1-.5-.5V15a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5v3.5a.5.5 0 0 1-.5.5h-3.5A1.5 1.5 0 0 1 3 17.5V10.707a1 1 0 0 1 .293-.707l7-7Z" clipRule="evenodd" />
            </svg>
            <span className="truncate">Home</span>
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-cyan-400 group-hover:w-full transition-all duration-300 ease-in-out"></span>
          </Link>
          <span className="mx-1.5 sm:mx-2.5 text-gray-400 flex-shrink-0">/</span>
          <Link href={`/?platform=${product.platform}`} className="hover:text-cyan-300 truncate max-w-[80px] sm:max-w-[120px] relative group transition-colors duration-200 ease-in-out text-gray-100">
            {product.platform}
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-cyan-400 group-hover:w-full transition-all duration-300 ease-in-out"></span>
          </Link>
          <span className="mx-1.5 sm:mx-2.5 text-gray-400 flex-shrink-0">/</span>
          <span className="font-semibold text-white truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">{product.displayName}</span>
        </nav>

        <div className="bg-cyan-600/20 backdrop-filter backdrop-blur-sm rounded-xl shadow-lg overflow-hidden mb-6 sm:mb-8 border border-cyan-500/30">
          <div className="p-3 sm:p-4 md:p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row gap-5 sm:gap-8 lg:gap-10">
              {/* Left column - Images */}
              <div className="w-full lg:w-1/2">
                <div className="relative aspect-video rounded-lg overflow-hidden mb-3 sm:mb-4 border border-cyan-300/30 shadow-sm">
                  {product.imageUrls.length > 0 ? (
                    <>
                      <Image
                        src={product.imageUrls[currentImageIndex]}
                        alt={product.displayName}
                        fill
                        className="object-cover"
                        priority
                      />
                      {product.imageUrls.length > 1 && (
                        <div className="absolute inset-0 flex justify-between items-center">
                          <button 
                            onClick={prevImage}
                            className="bg-black bg-opacity-40 text-white p-2 sm:p-3 rounded-full ml-2 sm:ml-3 hover:bg-opacity-60 transition-all transform hover:scale-105"
                            aria-label="Previous image"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                          </button>
                          <button 
                            onClick={nextImage}
                            className="bg-black bg-opacity-40 text-white p-2 sm:p-3 rounded-full mr-2 sm:mr-3 hover:bg-opacity-60 transition-all transform hover:scale-105"
                            aria-label="Next image"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 sm:w-16 sm:h-16 text-gray-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </div>
                  )}
                </div>

                {product.imageUrls.length > 1 && (
                  <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
                    {product.imageUrls.map((url, index) => (
                      <div 
                        key={index}
                        className={`aspect-square rounded-md overflow-hidden cursor-pointer transition-all border ${
                          currentImageIndex === index 
                            ? 'ring-2 ring-cyan-400 border-cyan-400 scale-105' 
                            : 'border-gray-200 hover:border-cyan-300'
                        }`}
                        onClick={() => setCurrentImageIndex(index)}
                      >
                        <Image
                          src={url}
                          alt={`${product.displayName} - Image ${index + 1}`}
                          width={100}
                          height={100}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Financials */}
                <div className="bg-cyan-800/30 p-3 sm:p-5 rounded-lg mt-4 sm:mt-8 border border-cyan-500/30">
                  <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-white flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-cyan-300">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Financial Data
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:gap-6">
                    <div className="bg-cyan-700/30 p-2 sm:p-4 rounded-lg shadow-sm border border-cyan-600/30">
                      <h3 className="text-xs sm:text-sm font-medium text-cyan-100 mb-1">Monthly Income</h3>
                      <p className="text-lg sm:text-2xl font-bold text-green-400">${product.monthlyIncome}</p>
                    </div>
                    <div className="bg-cyan-700/30 p-2 sm:p-4 rounded-lg shadow-sm border border-cyan-600/30">
                      <h3 className="text-xs sm:text-sm font-medium text-cyan-100 mb-1">Monthly Expenses</h3>
                      <p className="text-lg sm:text-2xl font-bold text-red-400">${product.monthlyExpenses}</p>
                    </div>
                    <div className="col-span-2 bg-cyan-700/30 p-2 sm:p-4 rounded-lg shadow-sm border border-cyan-600/30">
                      <h3 className="text-xs sm:text-sm font-medium text-cyan-100 mb-1">Income Sources</h3>
                      <p className="text-xs sm:text-sm md:text-base text-white break-words">{product.incomeSource}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Right column - Info */}
              <div className="w-full lg:w-1/2">
                <div className="flex flex-wrap justify-between items-start mb-3 sm:mb-4 gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-indigo-600/50 text-cyan-50 text-xs sm:text-sm font-semibold rounded-full">{product.platform}</span>
                    <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-cyan-800/50 text-cyan-50 text-xs sm:text-sm font-medium rounded-full">{product.category}</span>
                  </div>
                  <div className="text-xs sm:text-sm text-cyan-200 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 sm:w-4 sm:h-4 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    Listed on {new Date(product.createdAt).toLocaleDateString('en-US')}
                  </div>
                </div>
                
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3 text-white break-words">{product.displayName}</h1>
                
                <div className="flex flex-wrap items-baseline mb-4 sm:mb-6 gap-2 sm:gap-4">
                  <span className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-green-400">${product.price}</span>
                  <div className="px-2 sm:px-3 py-0.5 sm:py-1 bg-indigo-700/30 rounded-full flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 sm:w-4 sm:h-4 mr-1 text-cyan-300">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                    <span className="text-xs sm:text-sm font-medium text-white">{product.subscribers.toLocaleString()} subscribers</span>
                  </div>
                </div>
                
                <div className="bg-indigo-800/30 p-2 sm:p-4 rounded-lg mb-4 sm:mb-6 flex items-center border border-indigo-600/20">
                  <a 
                    href={product.accountLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-cyan-300 hover:text-cyan-100 font-medium flex items-center transition-colors text-sm sm:text-base"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    View Channel
                  </a>
                </div>
                
                {/* Call to action */}
                <div className="mb-4 sm:mb-8">
                  <button
                    onClick={handleContactSeller}
                    disabled={contactLoading || user?.id === product.userId}
                    className={`w-full py-2 sm:py-3 px-4 sm:px-6 rounded-lg text-white font-medium text-sm sm:text-lg flex justify-center items-center gap-1.5 sm:gap-2 ${
                      user?.id === product.userId
                        ? 'bg-gray-500/50 cursor-not-allowed'
                        : contactLoading
                          ? 'bg-cyan-700/70'
                          : 'bg-cyan-600 hover:bg-cyan-700'
                    } transition-colors`}
                  >
                    {contactLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-t-2 border-b-2 border-white"></div>
                        დაკავშირება...
                      </>
                    ) : user?.id === product.userId ? (
                      'თქვენი არხი'
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                        </svg>
                        გამყიდველთან დაკავშირება
                      </>
                    )}
                  </button>
                </div>

                {/* Expense Details */}
                <div className="mb-4 sm:mb-8">
                  <h2 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-red-300">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                    </svg>
                    ხარჯების დეტალები
                  </h2>
                  <div className="bg-indigo-800/30 p-3 sm:p-4 rounded-lg border border-indigo-600/20">
                    <p className="text-xs sm:text-sm md:text-base text-white whitespace-pre-line break-words">{product.expenseDetails || "ინფორმაცია არ არის მოწოდებული"}</p>
                  </div>
                </div>

                {/* Description */}
                <div className="mb-4 sm:mb-8">
                  <h2 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-cyan-300">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                    </svg>
                    აღწერა
                  </h2>
                  <div className="bg-indigo-800/30 p-3 sm:p-4 rounded-lg border border-indigo-600/20">
                    <p className="text-xs sm:text-sm md:text-base text-white whitespace-pre-line break-words">{product.description}</p>
                  </div>
                </div>

                {/* Promotion Strategy */}
                <div className="mb-4 sm:mb-8">
                  <h2 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-cyan-300">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                    </svg>
                    პრომოციის სტრატეგია
                  </h2>
                  <div className="bg-indigo-800/30 p-3 sm:p-4 rounded-lg border border-indigo-600/20">
                    <p className="text-xs sm:text-sm md:text-base text-white whitespace-pre-line break-words">{product.promotionStrategy || "ინფორმაცია არ არის მოწოდებული"}</p>
                  </div>
                </div>

                {/* View All Details Button */}
                <div className="mt-6 sm:mt-8 text-center">
                  <button 
                    onClick={() => setShowAllDetailsModal(true)}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-cyan-600 text-white font-medium rounded-lg hover:bg-cyan-700 transition-colors text-sm sm:text-base"
                  >
                    ყველაფრის ნახვა
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* All Details Modal */}
      {showAllDetailsModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4 pointer-events-none backdrop-blur-sm bg-indigo-900/70">
          <div className="bg-cyan-900/90 rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 md:p-8 pointer-events-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:none] border border-cyan-500/30">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white">პროდუქტის სრული ინფორმაცია</h2>
              <button onClick={() => setShowAllDetailsModal(false)} className="text-cyan-200 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 sm:w-7 sm:h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <ModalSection title="ძირითადი ინფორმაცია">
                  <DataItem label="პლატფორმა" value={product.platform} />
                  <DataItem label="კატეგორია" value={product.category} />
                  <DataItem label="არხის ბმული" value={product.accountLink} isLink />
                  <DataItem label="არხის სახელი" value={product.displayName} />
                  <DataItem label="ფასი ($)" value={product.price} highlight />
                  <DataItem label="გამომწერების რაოდენობა" value={product.subscribers.toLocaleString()} />
                  <DataItem label="დამატების თარიღი" value={new Date(product.createdAt).toLocaleDateString('ka-GE')} />
                </ModalSection>

                <ModalSection title="აღწერა">
                  <p className="text-xs sm:text-sm md:text-base text-white whitespace-pre-line break-words">{product.description || "ინფორმაცია არ არის მოწოდებული"}</p>
                </ModalSection>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <ModalSection title="ფინანსური მონაცემები">
                  <DataItem label="თვიური შემოსავალი ($)" value={product.monthlyIncome} />
                  <DataItem label="თვიური ხარჯები ($)" value={product.monthlyExpenses} />
                  <DataItem label="შემოსავლის დეტალური აღწერა" value={product.incomeSource || "ინფორმაცია არ არის მოწოდებული"} />
                  <DataItem label="ხარჯების დეტალური აღწერა" value={product.expenseDetails || "ინფორმაცია არ არის მოწოდებული"} />
                </ModalSection>

                <div className="space-y-4 sm:space-y-6">
                  <ModalSection title="პრომოციის სტრატეგია">
                    <p className="text-xs sm:text-sm md:text-base text-white whitespace-pre-line break-words">{product.promotionStrategy || "ინფორმაცია არ არის მოწოდებული"}</p>
                  </ModalSection>

                  <ModalSection title="მხარდაჭერის მოთხოვნები">
                    <p className="text-xs sm:text-sm md:text-base text-white whitespace-pre-line break-words">{product.supportRequirements || "ინფორმაცია არ არის მოწოდებული"}</p>
                  </ModalSection>
                </div>
              </div>

              <ModalSection title="კომენტარების დაშვება">
                <DataItem label="" value={product.allowComments ? "დაშვებულია" : "არ არის დაშვებული"} />
              </ModalSection>

            </div>
            <div className="mt-6 sm:mt-8 text-right">
              <button 
                onClick={() => setShowAllDetailsModal(false)}
                className="px-4 sm:px-6 py-1.5 sm:py-2 bg-cyan-600 text-white font-medium rounded-lg hover:bg-cyan-700 transition-colors text-sm sm:text-base"
              >
                დახურვა
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper components for the modal
const ModalSection: React.FC<{ title: string; children: React.ReactNode, adminOnly?: boolean }> = ({ title, children, adminOnly }) => (
  <div className={`py-3 sm:py-4 ${adminOnly ? 'bg-red-900/50 p-3 sm:p-4 rounded-lg border border-red-500/30' : 'bg-indigo-800/50 px-3 sm:px-4 py-3 sm:py-5 rounded-lg border border-indigo-600/30'} [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:none]`}>
    <h3 className={`text-lg sm:text-xl font-semibold mb-3 sm:mb-4 ${adminOnly ? 'text-red-300' : 'text-cyan-100'}`}>{title}</h3>
    <div className="space-y-2 sm:space-y-3">{children}</div>
  </div>
);

const DataItem: React.FC<{ label: string; value: string | number | undefined; highlight?: boolean; isLink?: boolean }> = ({ label, value, highlight, isLink }) => (
  <div className="flex flex-col sm:flex-row mb-1">
    <p className="w-full sm:w-1/3 text-xs sm:text-sm font-medium text-cyan-200">{label}{label && ':'}</p>
    {isLink ? (
      <a href={String(value)} target="_blank" rel="noopener noreferrer" className={`w-full sm:w-2/3 text-xs sm:text-sm ${highlight ? 'font-bold text-cyan-300' : 'text-white'} hover:underline break-words`}>
        {value || "ინფორმაცია არ არის"}
      </a>
    ) : (
      <p className={`w-full sm:w-2/3 text-xs sm:text-sm ${highlight ? 'font-bold text-green-300' : 'text-white'} break-words`}>{value === undefined || value === null || value === '' ? "ინფორმაცია არ არის მოწოდებული" : value}</p>
    )}
  </div>
); 