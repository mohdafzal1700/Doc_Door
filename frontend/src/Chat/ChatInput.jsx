import React, { useState, useEffect, useRef } from 'react';
import { Paperclip, Send, Image, Trash2 } from "lucide-react";
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';


export default function ChatInput({ onSendMessage, disabled, socket, conversationId, currentUserId }) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const typingTimeoutRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((message.trim() || attachments.length > 0) && !disabled) {
      onSendMessage(message.trim(), attachments);
      setMessage('');
      setAttachments([]);
      stopTyping();
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    handleTyping();
  };

  const handleTyping = () => {
    if (!isTyping && socket && socket.readyState === WebSocket.OPEN) {
      setIsTyping(true);
      socket.send(JSON.stringify({
        type: 'typing_start',
        conversation_id: conversationId,
        user_id: currentUserId
      }));
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1000);
  };

  const stopTyping = () => {
    if (isTyping && socket && socket.readyState === WebSocket.OPEN) {
      setIsTyping(false);
      socket.send(JSON.stringify({
        type: 'typing_stop',
        conversation_id: conversationId,
        user_id: currentUserId
      }));
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleAttachment = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setAttachments(prev => [...prev, ...files]);
    }
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      stopTyping();
    };
  }, []);

  return (
    <div className="flex flex-col p-4 border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 gap-2">
      {attachments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {attachments.map((file, index) => (
            <div key={index} className="relative flex-shrink-0 w-20 h-20 rounded-md border border-gray-200 overflow-hidden">
              {file.type.startsWith('image/') ? (
                <img 
                  src={URL.createObjectURL(file)} 
                  alt={`Attachment ${index}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <Paperclip className="h-6 w-6 text-gray-500" />
                </div>
              )}
              <button
                onClick={() => removeAttachment(index)}
                className="absolute top-1 right-1 bg-gray-800 bg-opacity-75 rounded-full p-1"
              >
                <Trash2 className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <label className="rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 cursor-pointer">
          <Paperclip className="h-5 w-5" />
          <input 
            type="file" 
            className="hidden" 
            onChange={handleAttachment}
            multiple
          />
        </label>
        <label className="rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 cursor-pointer">
          <Image className="h-5 w-5" />
          <input 
            type="file" 
            className="hidden" 
            accept="image/*"
            onChange={handleAttachment}
            multiple
          />
        </label>
        <div className="flex-1 flex gap-2">
          <Input
            type="text"
            placeholder="Type a message ..."
            value={message}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
            disabled={disabled}
            className="flex-1 rounded-lg bg-gray-100 dark:bg-gray-800 border-none text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
          />
          <Button 
            onClick={handleSubmit}
            size="icon" 
            disabled={disabled || (!message.trim() && attachments.length === 0)}
            className="rounded-full bg-black hover:bg-gray-800 text-white disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>
      </div>
    </div>
  );
}