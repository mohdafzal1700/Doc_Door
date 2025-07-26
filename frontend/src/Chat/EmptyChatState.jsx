import React from 'react';
import { MessageCircle, Search } from "lucide-react";
import Button from '../components/ui/Button';

export default function EmptyChatState({ conversations, currentUser }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <div className="text-xl font-medium text-gray-600 dark:text-gray-400 mb-2">
          {conversations.length === 0 ? 'No conversations yet' : 'Welcome to the Chat'}
        </div>
        <div className="text-gray-500 dark:text-gray-500 mb-4">
          {conversations.length === 0 
            ? 'Start a new conversation by searching for a user'
            : 'Select a conversation to start messaging'}
        </div>
        {conversations.length === 0 && (
          <Button 
            onClick={() => document.querySelector('input[type="search"]')?.focus()}
            className="bg-black hover:bg-gray-800 text-white"
          >
            <Search className="h-4 w-4 mr-2" />
            Search users
          </Button>
        )}
      </div>
    </div>
  );
}