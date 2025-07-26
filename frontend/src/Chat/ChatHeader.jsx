import React from 'react';
import { User, Settings } from "lucide-react";
import {Avatar ,AvatarImage, AvatarFallback} from '../components/ui/Avatar';
import Button from '../components/ui/Button';

export default function ChatHeader({ conversation, currentUser, onlineUsers }) {
  const otherParticipant = conversation.participants.find(p => p.id !== currentUser.id);
  
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <Avatar className="w-10 h-10">
          <AvatarImage src={otherParticipant?.avatar || "/placeholder.svg"} />
          <AvatarFallback>
            {otherParticipant?.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
            {otherParticipant?.name}
            {onlineUsers.includes(otherParticipant?.id) && (
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
            )}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
            {otherParticipant?.role}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon">
          <User className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}