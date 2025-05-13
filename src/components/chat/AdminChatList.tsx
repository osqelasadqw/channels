"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { ref, onValue, off, remove, set } from "firebase/database";
import { doc, getDoc, updateDoc, collection, addDoc, query, where, onSnapshot, orderBy, getDocs } from "firebase/firestore";
import { db, rtdb } from "@/firebase/config";

interface AdminRequest {
  id: string;
  chatId: string;
  productId: string;
  requestedBy: string;
  requestedByName: string;
  timestamp: number;
}

interface WalletNotification {
  id: string;
  type: string;
  chatId: string;
  productId: string;
  productName: string;
  transactionId: number;
  buyerName: string;
  buyerId: string;
  sellerName: string;
  sellerId: string;
  paymentMethod: string;
  amount: number;
  walletAddress: string;
  createdAt: number;
  read: boolean;
}

export default function AdminChatList() {
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [walletNotifications, setWalletNotifications] = useState<WalletNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<WalletNotification | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user || !user.isAdmin) return;

    setLoading(true);
    setError(null);

    // Listen for admin requests
    const adminRequestsRef = ref(rtdb, "adminRequests");
    
    onValue(adminRequestsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const requestsList = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          ...value
        }));
        
        // Sort requests by timestamp, newest first
        requestsList.sort((a, b) => b.timestamp - a.timestamp);
        
        setRequests(requestsList);
      } else {
        setRequests([]);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error fetching admin requests:", err);
      setError("Failed to load requests");
      setLoading(false);
    });

    // Listen for wallet notifications
    const walletNotificationsRef = collection(db, "admin_notifications");
    const walletNotificationsQuery = query(
      walletNotificationsRef,
      where("type", "==", "wallet_added")
    );

    const unsubscribeWalletNotifications = onSnapshot(
      walletNotificationsQuery,
      (snapshot) => {
        const notificationsList: WalletNotification[] = [];
        snapshot.forEach((doc) => {
          notificationsList.push({
            id: doc.id,
            ...doc.data()
          } as WalletNotification);
        });
        notificationsList.sort((a, b) => b.createdAt - a.createdAt);
        setWalletNotifications(notificationsList);
      },
      (error) => {
        console.error("Error fetching wallet notifications:", error);
      }
    );

    return () => {
      off(adminRequestsRef);
      unsubscribeWalletNotifications();
    };
  }, [user]);

  const handleJoinChat = async (request: AdminRequest) => {
    if (!user || !user.isAdmin) return;

    try {
      setProcessing(request.id);

      // Get chat data to verify it exists
      const chatDocRef = doc(db, "chats", request.chatId);
      const chatDoc = await getDoc(chatDocRef);
      
      if (!chatDoc.exists()) {
        throw new Error("Chat not found");
      }

      // Update the chat to mark admin as joined
      await updateDoc(chatDocRef, {
        adminJoined: true,
        participants: [...chatDoc.data().participants, user.id],
        participantNames: {
          ...chatDoc.data().participantNames,
          [user.id]: user.name
        },
        participantPhotos: {
          ...chatDoc.data().participantPhotos,
          [user.id]: user.photoURL || ""
        }
      });

      // Send a system message to the chat
      const messagesRef = ref(rtdb, `messages/${request.chatId}`);
      const messageKey = Date.now().toString();
      const messageRef = ref(rtdb, `messages/${request.chatId}/${messageKey}`);
      
      await set(messageRef, {
        text: "The escrow agent has joined the chat.",
        senderId: "system",
        senderName: "System",
        timestamp: Date.now(),
        isSystem: true
      });

      // Remove the request
      await remove(ref(rtdb, `adminRequests/${request.id}`));

      // Navigate to the chat - USING NEW URL FORMAT WITH QUERY PARAMETERS
      console.log('Joining chat and navigating to:', request.chatId);
      router.push(`/my-chats?chatId=${request.chatId}`);
    } catch (err) {
      console.error("Error joining chat:", err);
      setError("Failed to join chat");
    } finally {
      setProcessing(null);
    }
  };

  const handleShowDetails = (notification: WalletNotification) => {
    setSelectedNotification(notification);
    setShowDetailsModal(true);
  };

  if (!user || !user.isAdmin) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded-md">
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded-md">
        <p>{error}</p>
      </div>
    );
  }

  if (requests.length === 0 && walletNotifications.length === 0) {
    return (
      <div className="text-center py-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl shadow-xl border border-gray-200">
        <div className="relative w-24 h-24 mx-auto mb-4">
          <div className="absolute inset-0 bg-indigo-50 rounded-full animate-pulse"></div>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-full h-full text-indigo-500 relative">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2"></h3>
        <p className="text-gray-500 max-w-md mx-auto font-medium">არ მოიძებნა ესქროუ სერვისების მოთხოვნები ამ მომენტისთვის</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="p-8 border-b bg-gradient-to-r from-gray-900 to-indigo-900 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3 text-white group">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-400 rounded-full blur-sm opacity-70 group-hover:opacity-100 transition-all duration-300"></div>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-white relative">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              </div>
              Escrow Agent Dashboard
            </h2>
            <p className="text-gray-300 mt-3 ml-11 text-sm font-light tracking-wide">
              მართეთ ესქროუ სერვისები და ტრანზაქციების ვერიფიკაცია მაღალი უსაფრთხოებით
            </p>
          </div>
          <div className="hidden md:flex items-center space-x-2">
            <div className="px-4 py-3 flex items-center gap-2 rounded-lg bg-indigo-800 bg-opacity-50 border border-indigo-700">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
              <span className="text-sm font-medium text-indigo-100">ლაივ მონიტორინგი აქტიურია</span>
            </div>
          </div>
        </div>
      </div>
      
      {walletNotifications.length > 0 && (
        <div className="p-8 border-b relative overflow-hidden">
          <div className="absolute -top-10 right-0 w-96 h-96 bg-green-50 rounded-full blur-3xl opacity-20"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                <div className="p-2 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-green-200">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                  </svg>
                </div>
                საფულის მისამართები
                <span className="ml-2 px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">
                  {walletNotifications.length}
                </span>
              </h3>
              <div className="text-sm text-gray-500 font-medium flex items-center gap-2">
                <span>ბოლო განახლება:</span>
                <span className="text-gray-800 font-semibold">{new Date().toLocaleTimeString()}</span>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200 shadow-lg">
              <div className="overflow-x-auto overflow-y-auto max-h-[60vh]" style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db #f3f4f6' }}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gradient-to-r from-emerald-700 to-green-600">
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        არხის სახელი / ფასი
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        მყიდველი / გამყიდველი
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        საფულის მისამართი
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        ტრანზაქცია
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        თარიღი
                      </th>
                      <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                        მოქმედება
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {walletNotifications.map((notification, idx) => (
                      <tr key={notification.id} 
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                          style={{transition: 'all 0.2s'}}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#f9fafb'}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center shadow-sm">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-green-600">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                              </svg>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                                {notification.productName}
                              </div>
                              <div className="text-xs text-gray-500 font-bold bg-gray-100 rounded-full px-2 py-0.5 inline-block mt-1">
                                ${notification.amount}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-6">
                            <div className="flex flex-col">
                              <div className="text-xs text-gray-900 flex items-center gap-1">
                                <div className="p-1 rounded-full bg-blue-100 mr-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 text-blue-600">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                  </svg>
                                </div>
                                <span className="font-semibold text-blue-600">მყიდველი:</span>
                              </div>
                              <div className="text-xs text-gray-700 ml-6">{notification.buyerName}</div>
                            </div>
                            <div className="flex flex-col">
                              <div className="text-xs text-gray-900 flex items-center gap-1">
                                <div className="p-1 rounded-full bg-indigo-100 mr-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 text-indigo-600">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                  </svg>
                                </div>
                                <span className="font-semibold text-indigo-600">გამყიდველი:</span>
                              </div>
                              <div className="text-xs text-gray-700 ml-6">{notification.sellerName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center shadow-sm">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-amber-600">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                              </svg>
                            </div>
                            <div className="ml-4">
                              <div className="relative text-xs bg-gray-800 text-white py-1.5 px-3 rounded-md font-mono max-w-[180px] overflow-hidden text-ellipsis">
                                {notification.walletAddress}
                                <button 
                                  onClick={() => navigator.clipboard.writeText(notification.walletAddress)}
                                  className="absolute right-1 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1 rounded">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                                  </svg>
                                </button>
                              </div>
                              <div className="text-xs font-medium text-gray-500 flex items-center gap-1 mt-1.5">
                                <span className="px-2 py-1 text-xs font-medium rounded-md bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 border border-gray-200 shadow-sm">
                                  {notification.paymentMethod === 'stripe' ? 'Stripe' : 'Bitcoin'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs font-semibold text-gray-900 flex items-center gap-1">
                            <span className="px-3 py-1.5 text-xs font-medium rounded-md bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-800 border border-purple-200 shadow-sm">
                              ID: {notification.transactionId}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                          <div className="flex items-center bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-500 mr-1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {new Date(notification.createdAt).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button 
                            onClick={() => {
                              console.log('Navigating to chat (table):', notification.chatId);
                              router.push(`/my-chats?chatId=${notification.chatId}`);
                            }}
                            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg 
                                     bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-green-200
                                     hover:from-emerald-700 hover:to-green-700 focus:outline-none focus:ring-2 
                                     focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 transform hover:scale-105">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6.8 3.11 2.19 4.024C6.07 18.332 7.5 19.5 9 19.5h6c1.5 0 2.93-1.168 3.99-2.715.32-.297.71-.53 1.13-.69M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
                            </svg>
                            ჩათში გადასვლა
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button 
                            onClick={() => handleShowDetails(notification)}
                            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg 
                                     bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-md shadow-gray-300
                                     hover:from-gray-600 hover:to-gray-700 focus:outline-none focus:ring-2 
                                     focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 transform hover:scale-105">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                            </svg>
                            დეტალები
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {requests.length > 0 && (
        <div className="p-8 relative overflow-hidden">
          <div className="absolute top-0 left-20 w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-20"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                <div className="p-2 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                  </svg>
              </div>
                
                <span className="ml-2 px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  {requests.length}
                </span>
              </h3>
              <div className="text-sm text-gray-500 font-medium flex items-center gap-2">
                <span>მოთხოვნების სტატუსი:</span>
                <span className="flex items-center text-blue-600 font-semibold">
                  <span className="relative flex h-3 w-3 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
                  აქტიური
                </span>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200 shadow-lg">
              <div className="overflow-x-auto overflow-y-auto max-h-[60vh]" style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db #f3f4f6' }}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-700 to-indigo-600">
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        მომხმარებელი
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        მოთხოვნის დეტალები
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        თარიღი
                      </th>
                      <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                        მოქმედება
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {requests.map((request, idx) => (
                      <tr key={request.id} 
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                          style={{transition: 'all 0.3s'}}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#f9fafb'}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center shadow-sm">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-600">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                              </svg>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {request.requestedByName}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                მომხმარებლის ID: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-700">{request.requestedBy.substring(0, 6)}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-2">
                            <div className="text-xs text-gray-700 flex items-center gap-2">
                              <span className="font-medium text-gray-500">Chat ID:</span>
                              <span className="font-mono bg-blue-50 px-2 py-1 rounded-md text-blue-700 border border-blue-100">{request.chatId.substring(0, 8)}...</span>
                            </div>
                            <div className="text-xs text-gray-700 flex items-center gap-2">
                              <span className="font-medium text-gray-500">Product ID:</span>
                              <span className="font-mono bg-indigo-50 px-2 py-1 rounded-md text-indigo-700 border border-indigo-100">{request.productId.substring(0, 8)}...</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                          <div className="flex items-center bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-500 mr-1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {new Date(request.timestamp).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
              <button
                onClick={() => handleJoinChat(request)}
                disabled={processing === request.id}
                            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg 
                                     bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200
                                     hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 
                                     focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 transform hover:scale-105
                                     disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                            {processing === request.id ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                მიერთება...
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                                </svg>
                                ჩათში შესვლა
                              </>
                            )}
              </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
            </div>
          </div>
      </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedNotification && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-white to-gray-100 rounded-xl shadow-2xl max-w-2xl w-full relative border border-gray-200 transform transition-all scale-100 opacity-100">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white rounded-t-xl flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                 <div className="p-2 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                 </div>
                ტრანზაქციის დეტალები
              </h3>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {/* Column 1 */}
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
                  <p className="text-sm font-semibold text-gray-500 mb-1">არხის სახელი</p>
                  <p className="text-lg font-bold text-indigo-700 truncate">{selectedNotification.productName}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
                  <p className="text-sm font-semibold text-gray-500 mb-1">თანხა</p>
                  <p className="text-lg font-bold text-emerald-700">${selectedNotification.amount}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
                  <p className="text-sm font-semibold text-gray-500 mb-1">გადახდის მეთოდი</p>
                  <p className="text-base font-medium text-gray-800">{selectedNotification.paymentMethod === 'stripe' ? 'Stripe' : 'Bitcoin'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
                  <p className="text-sm font-semibold text-gray-500 mb-1">შექმნის თარიღი</p>
                  <p className="text-sm text-gray-700">{new Date(selectedNotification.createdAt).toLocaleString()}</p>
                </div>
              </div>
              
              {/* Column 2 */}
              <div className="space-y-4">
                 <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 shadow-sm">
                  <p className="text-sm font-semibold text-blue-600 mb-1">მყიდველი</p>
                  <p className="text-base font-medium text-gray-800">{selectedNotification.buyerName}</p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">ID: {selectedNotification.buyerId}</p>
                </div>
                 <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200 shadow-sm">
                  <p className="text-sm font-semibold text-indigo-600 mb-1">გამყიდველი</p>
                  <p className="text-base font-medium text-gray-800">{selectedNotification.sellerName}</p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">ID: {selectedNotification.sellerId}</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 shadow-sm">
                  <p className="text-sm font-semibold text-amber-600 mb-1">საფულის მისამართი</p>
                  <p className="text-sm text-gray-800 font-mono break-all relative group">{selectedNotification.walletAddress}
                     <button 
                        onClick={() => navigator.clipboard.writeText(selectedNotification.walletAddress)}
                        className="absolute -top-1 -right-1 text-gray-400 hover:text-gray-700 transition-colors p-1 rounded opacity-0 group-hover:opacity-100 bg-white bg-opacity-50 backdrop-blur-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                        </svg>
                      </button>
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 shadow-sm">
                  <p className="text-sm font-semibold text-purple-600 mb-1">ტრანზაქციის ID</p>
                  <p className="text-sm font-medium text-gray-800">{selectedNotification.transactionId}</p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">Chat ID: {selectedNotification.chatId}</p>
                   <p className="text-xs text-gray-500 mt-1 font-mono">Product ID: {selectedNotification.productId}</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 rounded-b-xl border-t border-gray-200 flex justify-end space-x-3">
                <button 
                onClick={() => {
                  console.log('Navigating to chat (modal):', selectedNotification.chatId);
                  router.push(`/my-chats?chatId=${selectedNotification.chatId}`);
                }}
                 className="inline-flex items-center justify-center px-5 py-2 text-sm font-medium rounded-lg 
                          bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-green-200
                          hover:from-emerald-700 hover:to-green-700 focus:outline-none focus:ring-2 
                          focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 transform hover:scale-105">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6.8 3.11 2.19 4.024C6.07 18.332 7.5 19.5 9 19.5h6c1.5 0 2.93-1.168 3.99-2.715.32-.297.71-.53 1.13-.69M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
                   </svg>
                 ჩატში გადასვლა
               </button>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="px-5 py-2 text-sm font-medium text-gray-700 bg-white rounded-lg border border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
                დახურვა
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 