import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MessageCircle, User } from "lucide-react";
import { getConversations, createConversation } from '../endpoints/Chat';
import ChatArea from './ChatArea';
import ChatSidebar from './ChatSidebar';
import EmptyChatState from './EmptyChatState';

export default function ChatApp() {
  const { userId } = useParams();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

useEffect(() => {
  const getCurrentUser = async () => {
    try {
      // Use the correct storage keys that match your auth.js STORAGE_KEYS
      const userDetails = JSON.parse(localStorage.getItem('user_details')) || null;
      const userType = localStorage.getItem('user_type') || 'patient';
      
      console.log("🔍 Debug - Raw userDetails from localStorage:", userDetails);
      console.log("🔍 Debug - userType from localStorage:", userType);
      
      if (userDetails) {
        // Map basic user fields for chat
        const userData = {
          id: userDetails.id, // UUID from Django
          name: userDetails.name || // Property from Django model
                `${userDetails.first_name || ''} ${userDetails.last_name || ''}`.trim() ||
                userDetails.username ||
                userDetails.email ||
                "Current User",
          role: userDetails.role || userType, // Role from User model
          avatar: null, // Will be set based on role
        };

        // Set avatar based on user data structure
        // First check if profile_picture_url exists directly on user object
        if (userDetails.profile_picture_url) {
          userData.avatar = userDetails.profile_picture_url;
        } 
        // Then check nested profile structures (for backwards compatibility)
        else if (userType === 'doctor' && userDetails.doctor_profile) {
          userData.avatar = userDetails.doctor_profile.profile_picture || null;
        } else if (userType === 'patient' && userDetails.patient_profile) {
          userData.avatar = userDetails.patient_profile.profile_picture || null;
        }

        setCurrentUser(userData);
        
        console.log("✅ Current user loaded:", {
          id: userData.id,
          name: userData.name,
          role: userData.role,
          avatar: userData.avatar ? "✅ Has avatar" : "❌ No avatar"
        });
      } else {
        // Fallback when no user data is found
        console.warn("⚠️ No user details found in storage");
        console.log("🔍 Debug - All localStorage keys:", Object.keys(localStorage));
        
        setCurrentUser({
          id: null,
          name: "Current User",
          role: userType || "patient", // Use stored user type or default
          avatar: null
        });
      }
    } catch (error) {
      console.error('❌ Failed to get current user:', error);
      // Fallback user data
      const fallbackUserType = localStorage.getItem('user_type') || 'patient';
      setCurrentUser({
        id: null,
        name: "Current User",
        role: fallbackUserType,
        avatar: null
      });
    }
  };

  getCurrentUser();
}, []);


  // Initialize conversations
  useEffect(() => {
    if (currentUser) {
      initializeConversations();
    }
  }, [currentUser, userId]);

  const initializeConversations = async () => {
    try {
      setLoading(true);
      const response = await getConversations();
      const conversationsData = response.data || [];
      
      console.log('Conversations loaded:', conversationsData);
      setConversations(conversationsData);

      // Handle direct navigation to chat with a specific user
      if (userId) {
        await handleDirectChatNavigation(userId, conversationsData);
      } else if (conversationsData.length > 0) {
        setSelectedConversation(conversationsData[0]);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectChatNavigation = async (targetUserId, existingConversations) => {
    try {
      // Check if conversation exists
      const existingConversation = existingConversations.find(conv =>
        conv.participants.some(p => p.id.toString() === targetUserId.toString())
      );

      if (existingConversation) {
        setSelectedConversation(existingConversation);
      } else {
        // Create new conversation
        const response = await createConversation(targetUserId);
        const newConversation = response.data;
        setConversations(prev => [newConversation, ...prev]);
        setSelectedConversation(newConversation);
      }
    } catch (error) {
      console.error('Failed to handle direct chat navigation:', error);
      if (existingConversations.length > 0) {
        setSelectedConversation(existingConversations[0]);
      }
    }
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
  };

  const handleConversationUpdate = (updatedConversation) => {
    setConversations(prev =>
      prev.map(conv =>
        conv.id === updatedConversation.id ? updatedConversation : conv
      )
    );
  };

  const handleConversationDelete = (conversationId) => {
    setConversations(prev => prev.filter(conv => conv.id !== conversationId));
    if (selectedConversation?.id === conversationId) {
      setSelectedConversation(null);
    }
  };

  const handleNewConversation = (newConversation) => {
    setConversations(prev => [newConversation, ...prev]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-pulse" />
          <div className="text-gray-600">Loading conversations...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <div className="text-gray-600">Loading user data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <ChatSidebar
        conversations={conversations}
        selectedConversation={selectedConversation}
        currentUser={currentUser}
        onSelectConversation={handleSelectConversation}
        onConversationUpdate={handleConversationUpdate}
        onConversationDelete={handleConversationDelete}
        onNewConversation={handleNewConversation}
      />

      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <ChatArea
            conversation={selectedConversation}
            currentUser={currentUser}
            onConversationUpdate={handleConversationUpdate}
          />
        ) : (
          <EmptyChatState
            conversations={conversations}
            currentUser={currentUser}
          />
        )}
      </div>
    </div>
  );
}