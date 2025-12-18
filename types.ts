export interface TocItem {
  title: string;
  page: number; // 0-based index
  level: number;
}

export interface Book {
  title: string;
  fileType: 'pdf' | 'epub';
  content: string[]; // Text content for AI context
  renderData: ArrayBuffer | string[]; // ArrayBuffer for PDF, HTML strings for EPUB
  totalPages: number;
  fileName: string;
  toc: TocItem[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export enum ReaderState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  READING = 'READING',
  ERROR = 'ERROR'
}

export interface ChatState {
  isOpen: boolean;
  messages: Message[];
  isLoading: boolean;
}