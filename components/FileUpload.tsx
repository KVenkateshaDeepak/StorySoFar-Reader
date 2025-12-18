import React, { useCallback, useState } from 'react';
import { Upload, Book, FileText, Loader2, AlertCircle, Moon, Sun } from 'lucide-react';
import { parseFile } from '../services/documentUtils';
import { Book as BookType } from '../types';

interface FileUploadProps {
  onBookLoaded: (book: BookType) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onBookLoaded, isDarkMode, onToggleDarkMode }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setIsLoading(true);
    
    try {
      const book = await parseFile(file);
      onBookLoaded(book);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to parse file. Please ensure it is a valid PDF or EPUB.');
    } finally {
      setIsLoading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-50 to-stone-50 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300 relative">
      
      <button
        onClick={onToggleDarkMode}
        className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDarkMode ? (
          <Sun className="w-6 h-6 text-gray-200" />
        ) : (
          <Moon className="w-6 h-6 text-gray-600" />
        )}
      </button>

      <div className="max-w-xl w-full text-center space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight font-serif transition-colors">
            StorySoFar Reader
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg transition-colors">
            An intelligent companion that learns as you read. <br />
            It only knows what you've seen.
          </p>
        </div>

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`
            relative group border-2 border-dashed rounded-2xl p-12 transition-all duration-300 ease-in-out
            ${isDragging 
              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/30 scale-102' 
              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-lg'
            }
          `}
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-4">
              <Loader2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-300 font-medium">Processing your book...</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">This usually takes a few seconds.</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center gap-4 mb-6">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400">
                  <FileText className="w-8 h-8" />
                </div>
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Book className="w-8 h-8" />
                </div>
              </div>
              
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2 transition-colors">
                Upload your book
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs mx-auto transition-colors">
                Drag and drop your PDF or EPUB file here, or click to browse.
              </p>

              <label className="relative inline-flex cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.epub"
                  onChange={onInputChange}
                />
                <span className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors shadow-md hover:shadow-xl flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Select File
                </span>
              </label>
            </>
          )}

          {error && (
            <div className="absolute -bottom-16 left-0 right-0 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm flex items-center justify-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
            <h4 className="font-semibold text-gray-800 dark:text-white mb-1">Spoiler-Free</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">The AI strictly tracks your reading progress page by page.</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
            <h4 className="font-semibold text-gray-800 dark:text-white mb-1">Page Aware</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ask specific questions about the context you just read.</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
            <h4 className="font-semibold text-gray-800 dark:text-white mb-1">Summarization</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Get recaps of the story solely based on read pages.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;