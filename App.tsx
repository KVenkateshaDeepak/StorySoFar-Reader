import React, { useState, useEffect } from 'react';
import { Book, Message } from './types';
import FileUpload from './components/FileUpload';
import Reader from './components/Reader';
import ChatInterface from './components/ChatInterface';
import { generateAssistantResponse } from './services/geminiService';
import { MessageCircle } from 'lucide-react';

const App: React.FC = () => {
  const [book, setBook] = useState<Book | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize dark mode from system preference
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  // Update HTML class when dark mode changes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Persist Page Progress
  useEffect(() => {
    if (book) {
      localStorage.setItem(`progress_${book.fileName}`, currentPage.toString());
    }
  }, [currentPage, book]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  const handleBookLoaded = (loadedBook: Book) => {
    setBook(loadedBook);
    
    // Restore progress
    const savedPage = localStorage.getItem(`progress_${loadedBook.fileName}`);
    if (savedPage) {
      setCurrentPage(parseInt(savedPage, 10));
    } else {
      setCurrentPage(0);
    }

    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm ready to read **${loadedBook.title}** with you. \n\nI'll track your progress page by page. Feel free to ask me questions, but remember: I only know what *you* have read so far!`,
      timestamp: Date.now()
    }]);
    setIsChatOpen(false); // Start with reader focused
  };

  const handleBackToHome = () => {
    setBook(null);
    setMessages([]);
    setIsChatOpen(false);
  };

  const handleSendMessage = async (content: string) => {
    if (!book) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsAiLoading(true);

    try {
      const assistantMsgId = (Date.now() + 1).toString();
      
      // Placeholder for streaming
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true
      }]);

      let accumulatedText = "";

      await generateAssistantResponse(
        [...messages, userMsg],
        book.content,
        currentPage,
        (textChunk) => {
          accumulatedText = textChunk;
          setMessages(prev => prev.map(m => 
            m.id === assistantMsgId ? { ...m, content: accumulatedText } : m
          ));
        }
      );

      setMessages(prev => prev.map(m => 
        m.id === assistantMsgId ? { ...m, isStreaming: false } : m
      ));

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Sorry, I encountered an error answering that.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!book) {
    return (
      <FileUpload 
        onBookLoaded={handleBookLoaded} 
        isDarkMode={isDarkMode} 
        onToggleDarkMode={toggleDarkMode}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden relative dark:bg-gray-900 transition-colors duration-200">
      {/* Main Reader Area */}
      <div className={`flex-1 h-full transition-all duration-300 ${isChatOpen ? 'mr-0 lg:mr-[400px]' : ''}`}>
        <Reader
          book={book}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          onBackToHome={handleBackToHome}
        />
      </div>

      {/* Floating Chat Button (Mobile/When closed) */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 hover:scale-105 transition-all z-20 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Sidebar/Overlay */}
      <div 
        className={`
          fixed top-0 right-0 h-full bg-white dark:bg-gray-900 shadow-2xl z-30 transition-transform duration-300 ease-in-out border-l border-gray-200 dark:border-gray-800
          w-full sm:w-[400px]
          ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <ChatInterface
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isAiLoading}
          onClose={() => setIsChatOpen(false)}
          currentPage={currentPage}
        />
      </div>
      
      {/* Overlay for mobile when chat is open */}
      {isChatOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setIsChatOpen(false)}
        />
      )}
    </div>
  );
};

export default App;