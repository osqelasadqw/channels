"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/firebase/config";
import { doc, getDoc, addDoc, collection, query, where, getDocs, deleteDoc, setDoc, updateDoc } from "firebase/firestore";
import { Product } from "@/types/product";
import { ref, push, get } from "firebase/database";
import { rtdb } from "@/firebase/config";

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
  const [contactLoading, setContactLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

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

  useEffect(() => {
    const checkIfFavorite = async () => {
      if (!user || !productId) return;
      setFavoriteLoading(true);
      try {
        const favoriteDocRef = doc(db, "users", user.id, "favorites", productId);
        const favoriteDoc = await getDoc(favoriteDocRef);
        setIsFavorite(favoriteDoc.exists());
      } catch (err) {
        console.error("Error checking favorite status:", err);
        // Optionally set an error state here
      } finally {
        setFavoriteLoading(false);
      }
    };

    checkIfFavorite();
  }, [user, productId]);

  const handleToggleFavorite = async () => {
    if (!user) {
      // alert("Please log in to manage your favorites.");
      router.push('/login');
      return;
    }
    if (!product) return;

    setFavoriteLoading(true);
    const favoriteDocRef = doc(db, "users", user.id, "favorites", product.id);

    try {
      if (isFavorite) {
        await deleteDoc(favoriteDocRef);
        setIsFavorite(false);
        // alert("Removed from favorites!");
      } else {
        await setDoc(favoriteDocRef, { 
          productId: product.id, 
          addedAt: Date.now(),
          // Storing some basic product info for easier display on favorites page
          productName: product.displayName,
          productPrice: product.price,
          productImage: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : ""
        });
        setIsFavorite(true);
        // alert("Added to favorites!");
      }
    } catch (err) {
      console.error("Error updating favorite status:", err);
      // alert("Failed to update favorites. Please try again.");
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleContactSeller = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (!product) return;

    // Don't allow contacting yourself
    if (user.id === product.userId) {
      return;
    }

    try {
      setContactLoading(true);
      console.log("Starting contact seller process...");
      console.log("Current user ID:", user.id);
      console.log("Seller ID:", product.userId);

      // შევამოწმოთ არსებობს თუ არა ჩატი ერთი where პირობით ინდექსის შეცდომის თავიდან ასაცილებლად
      const chatsQuery = query(
        collection(db, "chats"),
        where("productId", "==", product.id)
      );

      console.log("Checking if chat exists for product:", product.id);
      const existingChats = await getDocs(chatsQuery);
      let chatId;
      
      // ფილტრაცია კოდში - შევამოწმოთ არსებობს თუ არა ჩატი იმავე მომხმარებლებით
      const existingChat = existingChats.docs.find(doc => {
        const chatData = doc.data();
        const participants = chatData.participants || [];
        return participants.includes(user.id);
      });
      
      if (existingChat) {
        // Chat already exists, use it
        chatId = existingChat.id;
        console.log("Found existing chat:", chatId);
        
        // შევამოწმოთ არსებობს თუ არა შეტყობინებები ჩატში
        try {
          const rtdbMessagesRef = ref(rtdb, `messages/${chatId}`);
          const messagesSnapshot = await get(rtdbMessagesRef);
          
          if (!messagesSnapshot.exists()) {
            console.log("No messages found in existing chat. Adding initial purchase message.");
            
            // გავაგზავნოთ საწყისი შეტყობინება, თუ ჩატი ცარიელია
            const transactionId = Math.floor(1000000 + Math.random() * 9000000);
            const paymentMethod = "stripe";
            const useEscrow = true;
            
            await push(rtdbMessagesRef, {
              text: `Transfer to: ${product.userEmail || "seller@example.com"}`,
              senderId: "ADMIN_ID", // ადმინისტრატორის ID - ჩავანაცვლოთ რეალური ID-ით პროდაქშენზე
              senderName: "Escrow Agent",
              senderPhotoURL: null,
              timestamp: Date.now(),
              isAdmin: true,
              isRequest: true,
              transactionData: {
                productId: product.id,
                productName: product.displayName,
                price: product.price,
                useEscrow: true,
                paymentMethod: "bitcoin", // ან stripe, პროექტის მოთხოვნების მიხედვით
                transactionId: transactionId
              }
            });
            
            console.log("Initial message added to existing empty chat");
            
            // განვაახლოთ lastMessage ჩატში
            const chatDocRef = doc(db, "chats", chatId);
            await updateDoc(chatDocRef, {
              lastMessage: {
                text: `Escrow service request for "${product.displayName}"`,
                senderId: "ADMIN_ID", // ადმინისტრატორის ID
                timestamp: Date.now()
              },
              adminJoined: true // ჩავთვალოთ რომ ადმინი შემოვიდა ჩატში
            });
          } else {
            console.log("Existing chat already has messages, not adding initial message");
          }
        } catch (rtdbError) {
          console.error("Error checking for messages in RTDB:", rtdbError);
        }
      } else {
        console.log("No existing chat found, creating new one...");
        
        // Make sure we have valid user IDs
        const buyerId = user.id;
        const sellerId = product.userId;
        
        console.log("Verified buyer ID:", buyerId);
        console.log("Verified seller ID:", sellerId);
        
        if (!buyerId || !sellerId) {
          console.error("Missing user IDs", { buyerId, sellerId });
          throw new Error("Missing user IDs");
        }

        // Create a new chat
        const chatData = {
          productId: product.id,
          productName: product.displayName,
          productImage: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : "",
          participants: [buyerId, sellerId],
          participantNames: {
            [buyerId]: user.name || user.email?.split('@')[0] || "User",
            [sellerId]: product.userEmail?.split('@')[0] || "Seller"
          },
          participantPhotos: {
            [buyerId]: user.photoURL || "",
            [sellerId]: "" // Assuming no photo available
          },
          productPrice: product.price,
          lastMessage: `🔒 Request to Purchase ${product.displayName}`,
          lastMessageTimestamp: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          unreadCount: {
            [sellerId]: 1, // Unread for seller
            [buyerId]: 0   // Read for buyer
          },
          isActive: true,
          adminJoined: false
        };

        try {
          // Explicitly create the chat document
          const chatRef = doc(collection(db, "chats"));
          chatId = chatRef.id;
          
          // Set the document with the ID
          await setDoc(chatRef, chatData);
          console.log("Created new chat with ID:", chatId);
          
          // Generate transaction ID
          const transactionId = Math.floor(1000000 + Math.random() * 9000000);
          console.log("Generated transaction ID:", transactionId);
          
          // საგადახდო მეთოდის და escrow მომსახურების გამოყენების განსაზღვრა
          const paymentMethod = "stripe"; // ნაგულისხმევად Stripe
          const useEscrow = true;        // ნაგულისხმევად ჩართულია escrow მომსახურება
          
          // Create the purchase message object
          const purchaseMessage = {
            senderId: buyerId,
            senderName: user.name || user.email?.split('@')[0] || "User",
            text: `🔒 Request to Purchase ${product.displayName}
Transaction ID: ${transactionId}
Transaction Amount: $${product.price}
Payment Method: ${paymentMethod === 'stripe' ? 'Stripe' : 'Bitcoin'}
${useEscrow ? `The buyer pays the cost of the channel + 8% ($3 minimum) service fee.

The seller confirms and agrees to use the escrow service.

The escrow agent verifies everything and assigns manager rights to the buyer.

After 7 days (or sooner if agreed), the escrow agent removes other managers and transfers full ownership to the buyer.

The funds are then released to the seller. Payments are sent instantly via all major payment methods.` : 'Direct purchase without escrow service'}`,
            timestamp: Date.now(),
            isSystemMessage: true,
            isPurchaseRequest: true,
            read: {
              [buyerId]: true,     // Read by sender
              [sellerId]: false    // Not read by recipient
            },
            purchaseDetails: {
              transactionId: transactionId,
              amount: product.price,
              paymentMethod: paymentMethod === 'stripe' ? 'Stripe' : 'Bitcoin',
              escrowDetails: [
                "The buyer pays the cost of the channel + 8% ($3 minimum) service fee.",
                "The seller confirms and agrees to use the escrow service.",
                "The escrow agent verifies everything and assigns manager rights to the buyer.",
                "After 7 days (or sooner if agreed), the escrow agent removes other managers and transfers full ownership to the buyer.",
                "The funds are then released to the seller. Payments are sent instantly via all major payment methods."
              ],
              productName: product.displayName,
              productId: product.id
            }
          };
          
          // Create the messages subcollection and add the first message
          const messageRef = doc(collection(db, "chats", chatId, "messages"));
          console.log("Adding purchase message to chat...");
          await setDoc(messageRef, purchaseMessage);
          console.log("Purchase message added successfully");
          
          // დავამატოთ მესიჯი რეალურ დროის ბაზაშიც
          try {
            const rtdbMessagesRef = ref(rtdb, `messages/${chatId}/${messageRef.id}`);
            await push(ref(rtdb, `messages/${chatId}`), {
              text: purchaseMessage.text,
              senderId: buyerId,
              senderName: user.name || user.email?.split('@')[0] || "User",
              timestamp: Date.now(),
              isSystem: true,
              isPurchaseRequest: true
            });
            console.log("Message added to Realtime Database");
          } catch (rtdbError) {
            console.error("Error adding message to RTDB:", rtdbError);
          }
          
          // Update the buyer's chatList - CRITICAL PORTION
          console.log("Attempting to create buyer's chat list entry");
          try {
            const buyerChatListRef = doc(db, "users", buyerId, "chatList", chatId);
            const buyerChatData = {
              chatId: chatId,
              productId: product.id,
              productName: product.displayName,
              productImage: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : "",
              otherUserId: sellerId,
              otherUserName: product.userEmail?.split('@')[0] || "Seller",
              lastMessage: `🔒 Request to Purchase ${product.displayName}`,
              lastMessageTimestamp: Date.now(),
              unreadCount: 0,
              updatedAt: Date.now()
            };
            
            await setDoc(buyerChatListRef, buyerChatData);
            console.log("Successfully added chat to buyer's chat list");
          } catch (buyerChatError) {
            console.error("Error creating buyer's chat list entry:", buyerChatError);
            // Still continue even if this fails
          }
          
          // Update the seller's chatList
          console.log("Attempting to create seller's chat list entry");
          try {
            const sellerChatListRef = doc(db, "users", sellerId, "chatList", chatId);
            const sellerChatData = {
              chatId: chatId,
              productId: product.id,
              productName: product.displayName,
              productImage: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : "",
              otherUserId: buyerId,
              otherUserName: user.name || user.email?.split('@')[0] || "User",
              lastMessage: `🔒 Request to Purchase ${product.displayName}`,
              lastMessageTimestamp: Date.now(),
              unreadCount: 1,
              updatedAt: Date.now()
            };
            
            await setDoc(sellerChatListRef, sellerChatData);
            console.log("Successfully added chat to seller's chat list");
          } catch (sellerChatError) {
            console.error("Error creating seller's chat list entry:", sellerChatError);
            // Still continue even if this fails
          }
          
        } catch (chatError) {
          console.error("Error in chat creation process:", chatError);
          throw chatError; // Re-throw to be caught by the outer catch
        }
      }
      
      // Explicitly check and create buyer's chat list entry if it doesn't exist yet
      // This is a fallback in case the above creation failed
      try {
        const buyerChatEntryRef = doc(db, "users", user.id, "chatList", chatId);
        const buyerChatEntry = await getDoc(buyerChatEntryRef);
        
        if (!buyerChatEntry.exists()) {
          console.log("Fallback: Creating missing buyer chat list entry");
          await setDoc(buyerChatEntryRef, {
            chatId: chatId,
            productId: product.id,
            productName: product.displayName,
            productImage: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls[0] : "",
            otherUserId: product.userId,
            otherUserName: product.userEmail?.split('@')[0] || "Seller",
            lastMessage: `🔒 Request to Purchase ${product.displayName}`,
            lastMessageTimestamp: Date.now(),
            unreadCount: 0,
            updatedAt: Date.now()
          });
          console.log("Fallback: Successfully created missing buyer chat entry");
        }
      } catch (fallbackError) {
        console.error("Fallback error:", fallbackError);
      }
      
      console.log("Redirecting to chat page with chatId:", chatId);
      // Redirect to the chat
      router.push(`/my-chats?chatId=${chatId}`);
    } catch (err) {
      console.error("Error in contact seller function:", err);
    } finally {
      setContactLoading(false);
    }
  };
  
  const handleDeleteListing = async () => {
    if (!user || !product) return;
    
    if (user.id !== product.userId) {
      // alert("You can only delete your own listings");
      return;
    }
    
    const confirmDelete = window.confirm("Are you sure you want to delete this listing?");
    if (!confirmDelete) return;
    
    try {
      setDeleteLoading(true);
      await deleteDoc(doc(db, "products", product.id));
      // alert("Listing deleted successfully");
      router.push("/my-products");
    } catch (err) {
      console.error("Error deleting listing:", err);
      // alert("Failed to delete listing. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-gray-100 flex flex-col">
        <div className="flex-grow flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
        
        {/* Footer */}
        <footer className="bg-gray-900 text-white py-4 px-6 mt-auto">
          <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="text-sm">MateSwap LP</div>
              <div className="text-xs text-gray-400">Address: 85 First Floor Great Portland Street, London, England, W1W 7LT</div>
            </div>
            <div className="flex space-x-6">
              <Link href="/terms" className="text-sm hover:text-gray-300 transition-colors">
                Terms and Conditions
              </Link>
              <Link href="/privacy" className="text-sm hover:text-gray-300 transition-colors">
                Privacy Policy
              </Link>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="w-full min-h-screen bg-gray-100 flex flex-col">
        <div className="flex-grow flex items-center justify-center p-4">
          <div className="max-w-4xl w-full bg-red-50 text-red-700 p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Error</h2>
        <p className="text-lg mb-6">{error || "Product not found"}</p>
        <Link 
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
        >
          Back to Home
        </Link>
          </div>
        </div>
        
        {/* Footer */}
        <footer className="bg-gray-900 text-white py-4 px-6 mt-auto">
          <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="text-sm">MateSwap LP</div>
              <div className="text-xs text-gray-400">Address: 85 First Floor Great Portland Street, London, England, W1W 7LT</div>
            </div>
            <div className="flex space-x-6">
              <Link href="/terms" className="text-sm hover:text-gray-300 transition-colors">
                Terms and Conditions
              </Link>
              <Link href="/privacy" className="text-sm hover:text-gray-300 transition-colors">
                Privacy Policy
              </Link>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gray-100 flex flex-col">
      <div className="w-full px-4 py-6 flex-grow">
        {/* Header info */}
        <div className="flex justify-between items-center mb-4 text-sm text-gray-500 px-2">
          <div className="flex items-center space-x-3">
            <span>Listed: {product.createdAt ? new Date(product.createdAt).toLocaleDateString() : 'Recently'}</span>
            <span>|</span>
            <span>Updated: {product.createdAt ? new Date(product.createdAt).toLocaleDateString() : 'Recently'}</span>
            <span>|</span>
            <Link href="/" className="text-blue-500 hover:text-blue-700 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </Link>
          </div>
          
          {user && user.id === product.userId && (
            <button 
              onClick={handleDeleteListing}
              disabled={deleteLoading}
              className="text-gray-600 hover:text-red-500 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              This channel is mine, delete listing!
            </button>
          )}
        </div>
        
        {/* Main content - 3 column row */}
        <div className="w-full mb-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left column - Logo (1/4) */}
            <div className="lg:w-1/4">
              <div className="rounded-full overflow-hidden w-64 h-64 mx-auto mb-8 border-4 border-gray-200">
                {product.imageUrls && product.imageUrls.length > 0 ? (
                  <Image 
                    src={product.imageUrls[0]} 
                    alt={product.displayName}
                    width={256}
                    height={256}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 mt-4">
                <button 
                  onClick={handleContactSeller}
                  disabled={contactLoading || !product}
                  className="flex-1 py-2 px-3 bg-black text-white font-medium rounded-full text-sm hover:bg-gray-800 transition-colors"
                >
                  {contactLoading ? 'Processing...' : 'Buy this channel'}
                </button>
                <button 
                  onClick={handleToggleFavorite}
                  disabled={favoriteLoading || !product}
                  className={`flex-1 py-2 px-3 border font-medium rounded-full text-sm transition-colors ${
                    isFavorite 
                      ? 'bg-pink-500 text-white border-pink-500 hover:bg-pink-600' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {favoriteLoading ? 'Updating...' : isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                </button>
              </div>
            </div>
            
            {/* Middle column - Channel info (1/2) */}
            <div className="lg:w-1/2">
              <div className="flex flex-col xl:flex-row xl:justify-between">
                <div className="mb-6 xl:mb-0">
                  <h1 className="text-4xl font-bold text-gray-900 mb-2">{product.displayName}</h1>
                  <div className="text-gray-600 mb-6 text-lg">
                    {product.category} / <a href={product.accountLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{product.accountLink}</a>
                  </div>
                  
                  <div className="border-l-4 border-blue-500 pl-5 space-y-2 mb-8">
                    <div className="text-gray-700 text-lg">{product.subscribers?.toLocaleString() || 0} — subscribers</div>
                    <div className="text-gray-700 text-lg">${product.monthlyIncome || 0} — income (month)</div>
                    <div className="text-gray-700 text-lg">${product.monthlyExpenses || 0} — expense (month)</div>
                  </div>
                  
                  <div className="text-5xl font-bold text-gray-900 mb-6">$ {product.price}</div>
                </div>
              </div>
              
              <div className="mt-4 flex items-center space-x-2">
                {(product as any).isVerified && (
                  <div className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full font-medium flex items-center text-xs">
                    <svg className="w-3 h-3 mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    PASS
                  </div>
                )}
                {(product as any).isVIP && (
                  <div className="bg-gray-800 text-white px-3 py-1 rounded-full font-medium text-xs">VIP</div>
                )}
                {(product as any).discount && (
                  <div className="bg-gray-800 text-white px-3 py-1 rounded-full font-medium text-xs">-{(product as any).discount}%</div>
                )}
              </div>
            </div>

            {/* Right column - Attached images (1/4) */}
            <div className="lg:w-1/4">
              <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Attached images:</h2>
              {product.imageUrls && product.imageUrls.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> {/* Adjusted grid-cols for potentially smaller space */}
                  {product.imageUrls.map((url, index) => (
                    <div 
                      key={index} 
                      className="aspect-square rounded-md overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setSelectedImage(url)}
                    >
                      <Image
                        src={url}
                        alt={`${product.displayName} - Image ${index + 1}`}
                        width={200}
                        height={200}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-center py-8">No images attached</div>
              )}
            </div>
          </div>
        </div>
        
        {/* Description section (Full width, below the 3-column row) */}
        <div className="w-full mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Description:</h2>
          <div className="text-gray-700 text-lg">
            {/* ვამუშავებთ აღწერის ტექსტს მარტივი ფორმატით */}
            {product.description && (
              <>
                {/* თუ აღწერა არ შეიცავს სტრუქტურირებულ მონაცემებს */}
                {!product.description.includes("Monetization:") ? (
                  <p className="whitespace-pre-wrap">{product.description}</p>
                ) : (
                  <>
                    {/* პირველი ნაწილი description-დან */}
                    {product.description.split("Monetization:")[0]?.trim() && (
                      <p className="mb-4 whitespace-pre-wrap">{product.description.split("Monetization:")[0]?.trim()}</p>
                    )}
                    
                    {/* Monetization */}
                    <p className="mb-2"><strong>Monetization:</strong> <span className="whitespace-pre-wrap">{product.description.split("Monetization:")[1]?.split("Ways of promotion:")[0]?.trim() || "N/A"}</span></p>
                    
                    {/* Ways of promotion */}
                    {product.description.includes("Ways of promotion:") && (
                      <p className="mb-2"><strong>Ways of promotion:</strong> <span className="whitespace-pre-wrap">{product.description.split("Ways of promotion:")[1]?.split("Sources of expense:")[0]?.trim() || "N/A"}</span></p>
                    )}
                    
                    {/* Sources of expense */}
                    {product.description.includes("Sources of expense:") && (
                      <p className="mb-2"><strong>Sources of expense:</strong> <span className="whitespace-pre-wrap">{product.description.split("Sources of expense:")[1]?.split("Sources of income:")[0]?.trim() || "N/A"}</span></p>
                    )}
                    
                    {/* Sources of income */}
                    {product.description.includes("Sources of income:") && (
                      <p className="mb-2"><strong>Sources of income:</strong> <span className="whitespace-pre-wrap">{product.description.split("Sources of income:")[1]?.split("To support the channel, you need:")[0]?.trim() || "N/A"}</span></p>
                    )}
                    
                    {/* Support requirements */}
                    {product.description.includes("To support the channel, you need:") && (
                      <p className="mb-2"><strong>To support the channel, you need:</strong> <span className="whitespace-pre-wrap">{product.description.split("To support the channel, you need:")[1]?.split("Content:")[0]?.trim() || "N/A"}</span></p>
                    )}
                    
                    {/* Content */}
                    {product.description.includes("Content:") && (
                      <p className="mb-2"><strong>Content:</strong> <span className="whitespace-pre-wrap">{product.description.split("Content:")[1]?.split("$")[0]?.trim() || "N/A"}</span></p>
                    )}
                    
                    {/* Income */}
                    {product.description.includes("income (month)") && !product.monthlyIncome && (
                      <p><strong>Income (month):</strong> ${product.description.split("income (month)")[0]?.split("$").pop()?.trim() || "N/A"}</p>
                    )}
                    
                    {/* Expense */}
                    {product.description.includes("expense (month)") && !product.monthlyExpenses && (
                      <p><strong>Expense (month):</strong> ${product.description.split("expense (month)")[0]?.split("$").pop()?.trim() || "N/A"}</p>
                    )}
                  </>
                )}
              </>
            )}
            
            {/* additionalDetails ნაწილი - ვინაიდან შეიძლება დამატებით გვქონდეს */}
            {(product as any).additionalDetails && (
              <div className="mt-4">
                {Object.entries((product as any).additionalDetails).map(([key, value]) => (
                  <p key={key}><strong>{key}:</strong> {String(value)}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* გადიდებული ფოტოს მოდალი */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden">
            <button 
              className="absolute top-4 right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-800 z-10 shadow-md"
              onClick={() => setSelectedImage(null)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <Image
              src={selectedImage}
              alt="Enlarged product image"
              width={1200}
              height={900}
              className="max-h-[90vh] w-auto h-auto object-contain"
            />
          </div>
        </div>
      )}
      
      {/* Footer */}
      <footer className="bg-gray-900 text-white py-4 px-6 mt-auto">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <div className="text-sm">MateSwap LP</div>
            <div className="text-xs text-gray-400">Address: 85 First Floor Great Portland Street, London, England, W1W 7LT</div>
          </div>
          <div className="flex space-x-6">
            <Link href="/terms" className="text-sm hover:text-gray-300 transition-colors">
              Terms and Conditions
            </Link>
            <Link href="/privacy" className="text-sm hover:text-gray-300 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}