"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { Chat } from "@/types/chat";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";

export default function ChatList() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setError(null);

    // Get chats where the current user is a participant
    const chatsQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.id)
    );

    const unsubscribe = onSnapshot(
      chatsQuery,
      (snapshot) => {
        const chatList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        } as Chat));
        
        // Sort by createdAt in descending order
        chatList.sort((a, b) => b.createdAt - a.createdAt);
        
        setChats(chatList);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching chats:", err);
        setError("Failed to load chats");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  if (!user) {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-bold mb-2">You need to sign in to view your chats</h2>
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

  if (chats.length === 0) {
    return (
      <div className="text-center py-10 bg-white rounded-lg shadow-md">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto text-gray-400 mb-2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6.8 3.11 2.19 4.024C6.07 18.332 7.5 19.5 9 19.5h6c1.5 0 2.93-1.168 3.99-2.715.32-.297.71-.53 1.13-.69M7.5 11.25v-1.5c0-.8.4-1.6.8-2.4C8.4 6.56 9.5 5.25 11.1 5.25h1.8c1.6 0
2.7 1.31 2.9 2.4.2.8.2 1.6 0 2.4" />
        </svg>
        <h3 className="text-lg font-medium mb-2">No Chats Yet</h3>
        <p className="text-gray-500 mb-4">Start a conversation by contacting a seller</p>
        <Link 
          href="/" 
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md divide-y">
      {chats.map((chat) => {
        // Find the other participant's info
        const participants = chat.participants || [];
        const otherParticipants = participants.filter(id => id !== user?.id);
        const otherParticipantId = otherParticipants.length > 0 ? otherParticipants[0] : "";
        
        // Safely access nested properties
        const participantNames = chat.participantNames || {};
        const participantPhotos = chat.participantPhotos || {};
        
        const otherParticipantName = otherParticipantId && participantNames[otherParticipantId] 
          ? participantNames[otherParticipantId] 
          : "Unknown User";
          
        const otherParticipantPhoto = otherParticipantId && participantPhotos[otherParticipantId]
          ? participantPhotos[otherParticipantId]
          : "";

        return (
          <Link 
            key={chat.id} 
            href={`/chats/${chat.id}`}
            className="flex items-center p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="h-12 w-12 rounded-full overflow-hidden mr-4 flex-shrink-0">
              {otherParticipantPhoto ? (
                <Image
                  src={otherParticipantPhoto}
                  alt={otherParticipantName}
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-blue-500 flex items-center justify-center text-white">
                  {otherParticipantName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <h3 className="font-medium truncate">{otherParticipantName}</h3>
                <span className="text-xs text-gray-500">
                  {chat.lastMessage 
                    ? new Date(chat.lastMessage.timestamp).toLocaleDateString() 
                    : chat.createdAt ? new Date(chat.createdAt).toLocaleDateString() : "Unknown date"}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 truncate">
                {chat.lastMessage ? chat.lastMessage.text : "No messages yet"}
              </p>
            </div>
            
            {chat.adminJoined && (
              <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full whitespace-nowrap">
                Escrow Active
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
} 