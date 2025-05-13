"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/components/auth/AuthProvider";
import { Chat, Message } from "@/types/chat";
import { db, rtdb } from "@/firebase/config";
import { ref, push, onValue, off } from "firebase/database";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { addDoc, collection } from "firebase/firestore";

interface ChatInterfaceProps {
  chatId: string;
  productId: string;
}

export default function ChatInterface({ chatId, productId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatData, setChatData] = useState<Chat | null>(null);
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch chat data and messages
  useEffect(() => {
    if (!chatId || !user) return;

    setLoading(true);
    setError(null);

    // შევინახოთ ბოლოს გახსნილი ჩატის ID ლოკალურ სტორიჯში
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastChatId', chatId);
    }

    // Get chat data from Firestore
    const fetchChatData = async () => {
      try {
        const chatDocRef = doc(db, "chats", chatId);
        const chatDoc = await getDoc(chatDocRef);
        
        if (chatDoc.exists()) {
          setChatData(chatDoc.data() as Chat);
          
          // დავამატოთ ბაზიდან მიღებული ჩატის მონაცემები კონსოლში
          console.log("Chat data from Firestore:", chatDoc.data());
          
          // შევამოწმოთ ჩატში არის თუ არა მონაცემი lastMessage
          const data = chatDoc.data();
          if (data.lastMessage) {
            console.log("Last message found in Firestore:", data.lastMessage);
          } else {
            console.log("No last message found in Firestore");
          }
          
        } else {
          setError("Chat not found");
        }
      } catch (err) {
        console.error("Error fetching chat data:", err);
        setError("Failed to load chat data");
      }
    };

    fetchChatData();

    // Listen for messages from Realtime Database
    const messagesRef = ref(rtdb, `messages/${chatId}`);
    
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      console.log("Firebase RTD Data:", data);
      if (data) {
        const messageList = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value as Omit<Message, 'id'>
        }));
        
        // Sort messages by timestamp
        messageList.sort((a, b) => a.timestamp - b.timestamp);
        
        console.log("Parsed messages:", messageList);
        setMessages(messageList);
      } else {
        // თუ მონაცემები არ არის, ცარიელი მასივი დავაყენოთ
        setMessages([]);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error fetching messages:", err);
      setError("Failed to load messages");
      setLoading(false);
    });

    return () => {
      // Clean up listener
      off(messagesRef);
    };
  }, [chatId, user]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !user || !chatId) return;

    try {
      const messagesRef = ref(rtdb, `messages/${chatId}`);
      
      const timestamp = Date.now();
      
      await push(messagesRef, {
        text: newMessage.trim(),
        senderId: user.id,
        senderName: user.name,
        senderPhotoURL: user.photoURL || null,
        timestamp: timestamp,
        isAdmin: user.isAdmin
      });
      
      // განვაახლოთ ჩატში lastMessage ველი, რომ ჩატების სიაში სწორად გამოჩნდეს მესიჯი
      try {
        // ჩატის დოკუმენტის განახლება Firestore-ში
        const chatDocRef = doc(db, "chats", chatId);
        await updateDoc(chatDocRef, {
          lastMessage: {
            text: newMessage.trim(),
            timestamp: timestamp,
            senderId: user.id
          }
        });
        console.log("Chat lastMessage updated");
      } catch (err) {
        console.error("Error updating chat lastMessage:", err);
      }
      
      setNewMessage("");
    } catch (err) {
      console.error("Error sending message:", err);
      setError("Failed to send message");
    }
  };

  const handleRequestAdmin = async () => {
    if (!user || !chatId) return;

    try {
      // ლოგი
      console.log("Sending admin request for chat:", chatId);
      
      const adminRequestsRef = ref(rtdb, `adminRequests`);
      
      // Generate a unique ID for this request
      const requestTimestamp = Date.now();
      const requestData = {
        chatId,
        productId,
        productName: chatData?.productName || 'Unknown Product',
        requestedBy: user.id,
        requestedByName: user.name,
        timestamp: requestTimestamp
      };
      
      console.log("Request data:", requestData);
      
      // გაგზავნა
      await push(adminRequestsRef, requestData);
      
      // Send a system message to the chat
      const messagesRef = ref(rtdb, `messages/${chatId}`);
      
      await push(messagesRef, {
        text: "An admin (escrow agent) has been requested for this chat. They will join shortly.",
        senderId: "system",
        senderName: "System",
        timestamp: requestTimestamp,
        isSystem: true
      });
      
      // დადასტურება
      alert("Escrow agent request sent successfully!");
      
    } catch (err) {
      console.error("Error requesting admin:", err);
      setError("Failed to request admin");
      alert("Failed to request escrow agent. Please try again.");
    }
  };

  // Message item component displayed in the chat
  const MessageItem = ({ message }: { message: Message }) => {
    const { user } = useAuth();
    const isOwn = message.senderId === user?.id;
    const [walletAddress, setWalletAddress] = useState<string>("");
    const [isSubmittingWallet, setIsSubmittingWallet] = useState<boolean>(false);
    const [isWalletSubmitted, setIsWalletSubmitted] = useState<boolean>(false);

    // Save seller's wallet address
    const handleSubmitWalletAddress = async () => {
      if (!walletAddress.trim() || !message.transactionData) return;

      setIsSubmittingWallet(true);
      try {
        // Save the wallet address in Firebase
        await addDoc(collection(db, "wallet_addresses"), {
          userId: user?.id,
          productId: message.transactionData.productId,
          transactionId: message.transactionData.transactionId,
          paymentMethod: message.transactionData.paymentMethod,
          address: walletAddress,
          createdAt: Date.now()
        });

        // Get product name from transaction data
        const productName = message.transactionData.productName || 'Unknown Product';
        
        // Get chat data for participants
        const chatDocRef = doc(db, "chats", chatId);
        const chatDoc = await getDoc(chatDocRef);
        
        // Get buyer info
        let buyerName = 'Unknown Buyer';
        if (chatDoc.exists()) {
          const chatData = chatDoc.data();
          if (chatData.participantNames && chatData.participantNames[message.senderId]) {
            buyerName = chatData.participantNames[message.senderId];
          }
        }
        
        // Send a notification to the admin notifications collection
        await addDoc(collection(db, "admin_notifications"), {
          type: "wallet_added",
          chatId,
          productId: message.transactionData.productId,
          productName: productName,
          transactionId: message.transactionData.transactionId,
          buyerName,
          buyerId: message.senderId,
          sellerName: user?.name || 'Unknown Seller',
          sellerId: user?.id,
          paymentMethod: message.transactionData.paymentMethod,
          amount: message.transactionData.price,
          walletAddress,
          createdAt: Date.now(),
          read: false
        });

        // Confirm that the address is saved
        setIsWalletSubmitted(true);

        // Add a message to the chat indicating the wallet address was added successfully
        const messagesRef = ref(rtdb, `messages/${chatId}`);
        await push(messagesRef, {
          text: `Wallet address added successfully: ${walletAddress}`,
          senderId: user?.id || '',
          senderName: user?.name || '',
          senderPhotoURL: user?.photoURL || null,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error("Error saving wallet address:", error);
        alert("Failed to save wallet address. Please try again later.");
      } finally {
        setIsSubmittingWallet(false);
      }
    };

    // Special transaction request message
    if (message.isRequest && message.transactionData) {
      const { productName, price, paymentMethod, transactionId, useEscrow } = message.transactionData;
      const isSeller = user?.id !== message.senderId; // If the user is not the sender of the message, they are the seller
      
      return (
        <div className="p-4 mb-4 rounded-lg border border-gray-200 bg-indigo-50">
          <div className="flex items-center mb-3">
            <div className="p-2 rounded-full bg-indigo-600 text-white mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h3 className="font-bold">🔒 Request to Purchase {productName}</h3>
          </div>
          
          <div className="mb-3 space-y-1 text-sm text-gray-700">
            <div>Transaction ID: {transactionId}</div>
            <div>Transaction Amount: ${price}</div>
            <div>Payment Method: {paymentMethod === 'stripe' ? 'Stripe' : 'Bitcoin'}</div>
          </div>
          
          {useEscrow ? (
            <div className="text-xs text-gray-600 mt-3 border-t border-gray-200 pt-3">
              <p className="mb-1">The buyer pays the cost of the channel + 8% ($3 minimum) service fee.</p>
              <p className="mb-1">The seller confirms and agrees to use the escrow service.</p>
              <p className="mb-1">The escrow agent verifies everything and assigns manager rights to the buyer.</p>
              <p className="mb-1">After 7 days (or sooner if agreed), the escrow agent removes other managers and transfers full ownership to the buyer.</p>
              <p>The funds are then released to the seller. Payments are sent instantly via all major payment methods.</p>
            </div>
          ) : (
            <div className="text-xs text-gray-600 mt-3 border-t border-gray-200 pt-3">
              <p>Direct purchase without escrow service</p>
            </div>
          )}
          
          {/* Input form for the seller's wallet address */}
          {isSeller && !isWalletSubmitted && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              <div className="mb-2 text-sm font-medium">
                {paymentMethod === 'bitcoin' 
                  ? 'Please enter your Bitcoin wallet address:'
                  : 'Please enter your Stripe account details:'}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder={paymentMethod === 'bitcoin' ? 'Bitcoin Address' : 'Stripe Account Email'}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <button
                  onClick={handleSubmitWalletAddress}
                  disabled={!walletAddress.trim() || isSubmittingWallet}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {isSubmittingWallet ? (
                    <div className="flex items-center">
                      <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Processing...</span>
                    </div>
                  ) : (
                    'Add Address'
                  )}
                </button>
              </div>
            </div>
          )}
          
          {/* If wallet address is added */}
          {isSeller && isWalletSubmitted && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              <div className="flex items-center text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">Wallet address added successfully!</span>
              </div>
            </div>
          )}
          
          <div className="mt-4 flex justify-end">
            <span className="text-xs text-gray-500">
              {new Date(message.timestamp).toLocaleString()}
            </span>
          </div>
        </div>
      );
    }
    
    // Regular message
    return (
      <div className={`flex mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
        {!isOwn && (
          <div className="h-12 w-12 rounded-full overflow-hidden mr-2 flex-shrink-0 border border-gray-200 shadow-sm">
            {message.isAdmin ? (
              <Image 
                src="/agent.png" 
                alt="Escrow Agent"
                width={48}
                height={48}
                className="h-full w-full object-contain p-0"
              />
            ) : message.senderPhotoURL ? (
              <Image 
                src={message.senderPhotoURL} 
                alt={message.senderName}
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white font-medium">
                {message.senderName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
        
        <div 
          className={`max-w-[80%] p-3 rounded-lg shadow-sm ${
            isOwn 
              ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white rounded-tr-none' 
              : message.isAdmin 
                ? 'bg-green-100 text-green-800 rounded-tl-none border border-green-200' 
                : message.isSystem
                  ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                  : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
          }`}
        >
          {!isOwn && !message.isAdmin && !message.isSystem && (
            <div className="text-sm font-medium mb-1 text-indigo-800">{message.senderName}</div>
          )}
          {message.isAdmin && (
            <div className="text-xs font-medium mb-1 text-green-600 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
              Escrow Agent
            </div>
          )}
          {message.isSystem && (
            <div className="text-xs font-medium mb-1 text-yellow-600 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              System
            </div>
          )}
          
          <div className="whitespace-pre-wrap break-words">{message.text}</div>
          
          <div className={`text-xs mt-1 text-right ${isOwn ? 'text-indigo-100' : message.isAdmin ? 'text-green-500' : message.isSystem ? 'text-yellow-500' : 'text-gray-400'}`}>
            {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
        
        {isOwn && (
          <div className="h-12 w-12 rounded-full overflow-hidden ml-2 flex-shrink-0 border border-gray-200 shadow-sm">
            {message.isAdmin ? (
              <Image 
                src="/agent.png" 
                alt="Escrow Agent"
                width={48}
                height={48}
                className="h-full w-full object-contain p-0"
              />
            ) : message.senderPhotoURL ? (
              <Image 
                src={message.senderPhotoURL} 
                alt={message.senderName}
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white font-medium">
                {message.senderName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center">
        <p>Authorization is required to view this chat</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-lg overflow-hidden">
      {/* Chat Header */}
      <div className="bg-white p-4 border-b flex items-center justify-between shadow-sm">
        <div className="flex items-center">
          <h2 className="font-bold text-lg text-gray-800 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2 text-indigo-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
            </svg>
            <span>{chatData?.productName || 'Chat'}</span>
          </h2>
          {chatData?.adminJoined && (
            <span className="ml-2 px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 mr-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
              Escrow Active
            </span>
          )}
        </div>
        
        {!chatData?.adminJoined && (
          <button
            onClick={handleRequestAdmin}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-500 text-white rounded-md hover:from-indigo-700 hover:to-blue-600 transition-all duration-200 shadow-sm hover:shadow text-sm font-medium flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
            Request Escrow
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-indigo-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6.8 3.11 2.19 4.024C6.07 18.332 7.5 19.5 9 19.5h6c1.5 0 2.93-1.168 3.99-2.715.32-.297.71-.53 1.13-.69M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">მესიჯები არ არის</h3>
            <p className="text-gray-500">დაიწყეთ საუბარი მესიჯის გაგზავნით</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="bg-white p-4 border-t">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-full bg-gray-50 hover:bg-white focus-within:bg-white focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all duration-200 shadow-sm">
            <button
              type="button"
              className="text-gray-400 hover:text-indigo-500 transition-colors"
              title="Add emoji"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
              </svg>
            </button>
            
            <button
              type="button"
              className="text-gray-400 hover:text-indigo-500 transition-colors"
              title="Attach file"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
            </button>
            
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="დაწერეთ მესიჯი..."
              className="flex-1 bg-transparent border-none outline-none placeholder-gray-400 text-gray-800"
            />
          </div>
          
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="p-3 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white rounded-full hover:shadow-md disabled:opacity-50 transition-all duration-200 flex items-center justify-center"
            title="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
} 