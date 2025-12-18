import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, Minimize, Maximize, 
  MoveHorizontal, Sun, Moon, Type, Keyboard, X, List, Menu, Home
} from 'lucide-react';
import { Book, TocItem } from '../types';

interface ReaderProps {
  book: Book;
  currentPage: number;
  onPageChange: (page: number) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onBackToHome: () => void;
}

const PDFJS_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const Reader: React.FC<ReaderProps> = ({ 
  book,
  currentPage, 
  onPageChange,
  isDarkMode,
  onToggleDarkMode,
  onBackToHome
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [isRendering, setIsRendering] = useState(false);
  
  // View State
  const [scaleMode, setScaleMode] = useState<'width' | 'page' | 'manual'>('width');
  const [manualScale, setManualScale] = useState(1.0);
  const [renderedScale, setRenderedScale] = useState(1.0);
  
  // EPUB Typography State
  const [fontSize, setFontSize] = useState(18); // px
  const [lineHeight, setLineHeight] = useState(1.6);
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans' | 'mono'>('serif');

  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [pageInput, setPageInput] = useState((currentPage + 1).toString());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Navigation Logic State
  const lastNavigationTime = useRef(0);
  const touchStartY = useRef<number | null>(null);
  
  // Tracks where to scroll on the new page ('top' | 'bottom')
  const scrollTargetRef = useRef<'top' | 'bottom'>('top');

  // Sync page input with current page
  useEffect(() => {
    setPageInput((currentPage + 1).toString());
  }, [currentPage]);

  // Initialize PDF Doc
  useEffect(() => {
    if (book.fileType === 'pdf' && book.renderData instanceof ArrayBuffer) {
      const loadPdf = async () => {
        setIsRendering(true);
        try {
          if (!window.pdfjsLib) return;
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
          const loadingTask = window.pdfjsLib.getDocument({ data: book.renderData as ArrayBuffer });
          const doc = await loadingTask.promise;
          setPdfDoc(doc);
        } catch (e) {
          console.error("Error loading PDF for rendering", e);
        } finally {
          setIsRendering(false);
        }
      };
      loadPdf();
    } else {
      setPdfDoc(null);
    }
  }, [book]);

  // Render PDF Page
  const renderPage = useCallback(async () => {
    if (!book.fileType || book.fileType !== 'pdf' || !pdfDoc || !canvasRef.current || !contentRef.current) return;

    setIsRendering(true);
    try {
      const page = await pdfDoc.getPage(currentPage + 1);
      const viewportUnscaled = page.getViewport({ scale: 1.0 });

      // Determine scale based on mode and container size
      const containerWidth = contentRef.current.clientWidth;
      const containerHeight = contentRef.current.clientHeight;
      
      let finalScale = 1.0;
      
      if (scaleMode === 'width') {
        const targetWidth = Math.min(containerWidth - 48, 1000); 
        finalScale = targetWidth / viewportUnscaled.width;
      } else if (scaleMode === 'page') {
        const hScale = (containerHeight - 48) / viewportUnscaled.height;
        const wScale = (containerWidth - 48) / viewportUnscaled.width;
        finalScale = Math.min(hScale, wScale);
      } else {
        finalScale = manualScale;
      }

      setRenderedScale(finalScale);

      const outputScale = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: finalScale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      
      // Match style dimensions to viewport (CSS pixels)
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const transform = outputScale !== 1 
        ? [outputScale, 0, 0, outputScale, 0, 0] 
        : null;

      // Render Canvas
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({
          canvasContext: context,
          transform: transform,
          viewport: viewport
        }).promise;
      }

      // Render Text Layer
      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = '';
        textLayerRef.current.style.width = canvas.style.width;
        textLayerRef.current.style.height = canvas.style.height;

        const textContent = await page.getTextContent();
        
        textContent.items.forEach((item: any) => {
           if (!item.str || !item.str.trim()) return;

           const span = document.createElement('span');
           span.textContent = item.str;
           
           // Item transform: [scaleX, skewY, skewX, scaleY, x, y]
           // PDF coordinates: (0,0) is bottom-left. Canvas/CSS: (0,0) is top-left.
           const tx = item.transform; 
           
           // Approximate font size from transform matrix (usually element 0 or 3)
           const fontSize = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
           
           // Calculate CSS position
           // x is straightforward
           const x = tx[4] * finalScale;
           
           // y needs to be flipped relative to viewport height. 
           // NOTE: tx[5] is the baseline y-coordinate in PDF space.
           // CSS top is usually top-left of the box. 
           // We subtract fontSize (scaled) to move from baseline to top-ish.
           // This is an approximation as actual font metrics are complex.
           const y = viewport.height - (tx[5] * finalScale) - (fontSize * finalScale * 0.8);

           span.style.left = `${x}px`;
           span.style.top = `${y}px`;
           span.style.fontSize = `${fontSize * finalScale}px`;
           // Use sans-serif to match generic PDF fonts, or try to map fontName if possible
           span.style.fontFamily = 'sans-serif'; 
           
           // Optional: Apply width scaling if horizontal scale differs significantly
           // span.style.transform = `scaleX(${...})`

           textLayerRef.current?.appendChild(span);
        });
      }
      
      // If we need to scroll to bottom (e.g. came from next page scrolling up), do it after render
      if (scrollTargetRef.current === 'bottom' && contentRef.current) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }

    } catch (e) {
      console.error("Error rendering PDF page", e);
    } finally {
      setIsRendering(false);
    }
  }, [pdfDoc, currentPage, scaleMode, manualScale, book.fileType]);

  // Effect to trigger render
  useEffect(() => {
    renderPage();
    const handleResize = () => {
      if (scaleMode !== 'manual') renderPage();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderPage, scaleMode]);

  // Scroll Position Management on Page Change
  useEffect(() => {
    if (contentRef.current) {
      // Temporarily hide overflow to kill any scroll momentum from previous page
      const originalOverflow = contentRef.current.style.overflow;
      contentRef.current.style.overflow = 'hidden';
      
      const target = scrollTargetRef.current;

      // For Non-PDF (EPUB/HTML), content is ready immediately, so we set scroll now.
      // For PDF, we set it here too as a best effort, but renderPage will handle it after render if size changes.
      if (target === 'bottom') {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      } else {
        contentRef.current.scrollTop = 0;
      }
      
      // Restore overflow after a brief delay
      const timeoutId = setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.style.overflow = 'auto'; // or originalOverflow if complex
          
          // Re-apply bottom scroll for safety (layout shifts)
          if (target === 'bottom') {
             contentRef.current.scrollTop = contentRef.current.scrollHeight;
          }
          
          // Reset target to default 'top' for subsequent interactions (like resize)
          scrollTargetRef.current = 'top';
        }
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [currentPage]);

  // Navigation Helpers
  const navigateToPage = useCallback((newPage: number, target: 'top' | 'bottom' = 'top') => {
      scrollTargetRef.current = target;
      onPageChange(newPage);
  }, [onPageChange]);

  const handleZoomIn = useCallback(() => {
    if (book.fileType === 'pdf') {
      setManualScale(prev => renderedScale * 1.2);
      setScaleMode('manual');
    } else {
      setFontSize(prev => Math.min(prev + 2, 32));
    }
  }, [renderedScale, book.fileType]);

  const handleZoomOut = useCallback(() => {
    if (book.fileType === 'pdf') {
      setManualScale(prev => renderedScale * 0.8);
      setScaleMode('manual');
    } else {
      setFontSize(prev => Math.max(prev - 2, 12));
    }
  }, [renderedScale, book.fileType]);

  const handlePrev = useCallback(() => {
    if (currentPage > 0) navigateToPage(currentPage - 1, 'top');
  }, [currentPage, navigateToPage]);

  const handleNext = useCallback(() => {
    if (currentPage < book.totalPages - 1) navigateToPage(currentPage + 1, 'top');
  }, [currentPage, book.totalPages, navigateToPage]);

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(pageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= book.totalPages) {
      navigateToPage(pageNum - 1, 'top');
    } else {
      setPageInput((currentPage + 1).toString());
    }
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handleTocClick = (page: number) => {
    navigateToPage(page, 'top');
    setShowToc(false);
  };

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'ArrowRight':
        case ' ': 
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case '+':
        case '=': 
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
          e.preventDefault();
          handleZoomOut();
          break;
        case '0':
          e.preventDefault();
          if(book.fileType === 'pdf') setScaleMode('width');
          else setFontSize(18);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleZoomIn, handleZoomOut, book.fileType]);

  // Fullscreen Logic
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      const readerElement = contentRef.current?.parentElement;
      if (readerElement?.requestFullscreen) await readerElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Navigation Logic (Wheel/Touch)
  const handleWheel = (e: React.WheelEvent) => {
    const element = contentRef.current;
    if (!element) return;
    const { scrollTop, scrollHeight, clientHeight } = element;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 5;
    const isAtTop = scrollTop === 0;
    const now = Date.now();
    
    // Increased debounce time to 1200ms for more deliberate action
    if (now - lastNavigationTime.current <= 1200) return;

    // Increased threshold for deltaY to prevent accidental triggers (was 30)
    const threshold = 50;

    if (isAtBottom && e.deltaY > threshold && currentPage < book.totalPages - 1) {
      lastNavigationTime.current = now;
      navigateToPage(currentPage + 1, 'top');
    } else if (isAtTop && e.deltaY < -threshold && currentPage > 0) {
      lastNavigationTime.current = now;
      navigateToPage(currentPage - 1, 'bottom'); // Go to bottom of previous page
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const element = contentRef.current;
    if (!element || touchStartY.current === null) return;
    const { scrollTop, scrollHeight, clientHeight } = element;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 5;
    const isAtTop = scrollTop === 0;
    const currentY = e.touches[0].clientY;
    const deltaY = touchStartY.current - currentY;
    const now = Date.now();

    if (now - lastNavigationTime.current <= 1200) return;

    // Increased touch threshold (was 80)
    if (isAtBottom && deltaY > 100 && currentPage < book.totalPages - 1) {
       lastNavigationTime.current = now;
       navigateToPage(currentPage + 1, 'top');
       touchStartY.current = null;
    } else if (isAtTop && deltaY < -100 && currentPage > 0) {
       lastNavigationTime.current = now;
       navigateToPage(currentPage - 1, 'bottom'); // Go to bottom of previous page
       touchStartY.current = null;
    }
  };

  const handleTouchEnd = () => { touchStartY.current = null; };

  const progress = ((currentPage + 1) / book.totalPages) * 100;

  // Font Family Class Map
  const fontFamilyClass = {
    'serif': 'font-serif',
    'sans': 'font-sans',
    'mono': 'font-mono'
  };

  return (
    <div className="flex flex-col h-full bg-paper dark:bg-gray-950 relative transition-colors duration-200 group">
      
      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-200 dark:border-gray-700 m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Keyboard className="w-5 h-5" /> Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowShortcuts(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex justify-between"><span>Next Page</span> <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">Right / Space</kbd></div>
              <div className="flex justify-between"><span>Previous Page</span> <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">Left</kbd></div>
              <div className="flex justify-between"><span>Zoom In / Font Up</span> <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">+</kbd></div>
              <div className="flex justify-between"><span>Zoom Out / Font Down</span> <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">-</kbd></div>
              <div className="flex justify-between"><span>Reset View</span> <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">0</kbd></div>
              <div className="flex justify-between"><span>Fullscreen</span> <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">F</kbd></div>
            </div>
          </div>
        </div>
      )}

      {/* Table of Contents Drawer */}
      <div 
        className={`fixed inset-y-0 left-0 w-80 bg-white dark:bg-gray-900 shadow-2xl z-40 transform transition-transform duration-300 ease-in-out border-r border-gray-200 dark:border-gray-800 ${showToc ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
           <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
             <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
               <List className="w-5 h-5" /> Table of Contents
             </h3>
             <button onClick={() => setShowToc(false)} className="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
               <X className="w-5 h-5" />
             </button>
           </div>
           <div className="flex-1 overflow-y-auto p-2">
             {book.toc && book.toc.length > 0 ? (
               <div className="space-y-1">
                 {book.toc.map((item, idx) => (
                   <button
                     key={idx}
                     onClick={() => handleTocClick(item.page)}
                     className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                       currentPage === item.page 
                         ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium' 
                         : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                     }`}
                     style={{ paddingLeft: `${(item.level * 12) + 12}px` }}
                   >
                     <div className="flex justify-between items-baseline gap-2">
                       <span className="truncate">{item.title || `Page ${item.page + 1}`}</span>
                       <span className="text-xs text-gray-400 shrink-0">{item.page + 1}</span>
                     </div>
                   </button>
                 ))}
               </div>
             ) : (
               <div className="text-center p-8 text-gray-500 dark:text-gray-400 text-sm">
                 No table of contents available for this book.
               </div>
             )}
           </div>
        </div>
      </div>
      
      {/* TOC Overlay backdrop */}
      {showToc && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30" onClick={() => setShowToc(false)} />
      )}

      {/* Reader Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 dark:border-gray-800 bg-paper dark:bg-gray-900 sticky top-0 z-20 shadow-sm transition-colors duration-200">
        <div className="flex items-center min-w-0 mr-4 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Home Button */}
            <button
              onClick={onBackToHome}
              className="p-1.5 hover:bg-stone-100 dark:hover:bg-gray-700 rounded-md text-stone-600 dark:text-stone-300 transition-all"
              title="Back to Home"
            >
              <Home className="w-5 h-5" />
            </button>

            {/* TOC Toggle Button */}
            <button 
              onClick={() => setShowToc(true)}
              className="p-1.5 hover:bg-stone-100 dark:hover:bg-gray-700 rounded-md text-stone-600 dark:text-stone-300 transition-all"
              title="Table of Contents"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col min-w-0">
              <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-200 truncate max-w-[150px] md:max-w-xs" title={book.title}>
                {book.title}
              </h2>
            </div>
          </div>
          
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          
           {/* Settings Dropdown Trigger */}
           {book.fileType !== 'pdf' && (
            <div className="relative">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-md transition-all ${showSettings ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400' : 'hover:bg-stone-100 dark:hover:bg-gray-700 text-stone-600 dark:text-stone-300'}`}
                title="Typography Settings"
              >
                <Type className="w-4 h-4" />
              </button>
              
              {showSettings && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSettings(false)} />
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-900 border border-stone-200 dark:border-gray-700 rounded-xl shadow-xl z-20 p-4 animate-in fade-in zoom-in-95 duration-100">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Typography</h4>
                    
                    <div className="space-y-4">
                      {/* Font Family */}
                      <div className="flex gap-2 bg-stone-100 dark:bg-gray-800 p-1 rounded-lg">
                        {(['serif', 'sans', 'mono'] as const).map((font) => (
                          <button
                            key={font}
                            onClick={() => setFontFamily(font)}
                            className={`flex-1 py-1.5 px-2 text-xs rounded-md transition-all ${fontFamily === font ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400 font-medium' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'}`}
                          >
                            {font.charAt(0).toUpperCase() + font.slice(1)}
                          </button>
                        ))}
                      </div>

                      {/* Font Size */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-stone-600 dark:text-stone-300">
                          <span>Size</span>
                          <span>{fontSize}px</span>
                        </div>
                        <input 
                          type="range" 
                          min="12" 
                          max="32" 
                          step="1" 
                          value={fontSize} 
                          onChange={(e) => setFontSize(parseInt(e.target.value))}
                          className="w-full accent-indigo-600 h-1.5 bg-stone-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* Line Height */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-stone-600 dark:text-stone-300">
                          <span>Spacing</span>
                          <span>{lineHeight}</span>
                        </div>
                        <input 
                          type="range" 
                          min="1.0" 
                          max="2.5" 
                          step="0.1" 
                          value={lineHeight} 
                          onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                          className="w-full accent-indigo-600 h-1.5 bg-stone-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="w-px h-4 bg-stone-300 dark:bg-gray-700 mx-1"></div>

          <div className="flex items-center gap-1 bg-stone-100 dark:bg-gray-800 rounded-lg p-1 transition-colors duration-200">
            <button 
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm rounded-md text-stone-600 dark:text-stone-300 transition-all"
              title={book.fileType === 'pdf' ? "Zoom Out" : "Decrease Font Size"}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium w-12 text-center tabular-nums text-stone-600 dark:text-stone-300 select-none">
              {book.fileType === 'pdf' ? `${Math.round(renderedScale * 100)}%` : `${fontSize}px`}
            </span>
            <button 
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm rounded-md text-stone-600 dark:text-stone-300 transition-all"
              title={book.fileType === 'pdf' ? "Zoom In" : "Increase Font Size"}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

           {/* PDF Specific Scale Options */}
           {book.fileType === 'pdf' && (
             <div className="hidden md:flex items-center gap-1 bg-stone-100 dark:bg-gray-800 rounded-lg p-1 ml-2 transition-colors duration-200">
              <button 
                onClick={() => setScaleMode('width')}
                className={`p-1.5 rounded-md transition-all ${scaleMode === 'width' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-stone-600 dark:text-stone-300 hover:bg-white/50 dark:hover:bg-gray-700/50'}`}
                title="Fit Width"
              >
                <MoveHorizontal className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setScaleMode('page')}
                className={`p-1.5 rounded-md transition-all ${scaleMode === 'page' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-stone-600 dark:text-stone-300 hover:bg-white/50 dark:hover:bg-gray-700/50'}`}
                title="Fit Page"
              >
                <Minimize className="w-4 h-4" />
              </button>
            </div>
           )}

          <div className="w-px h-4 bg-stone-300 dark:bg-gray-700 mx-1 hidden md:block"></div>
          
           <button 
            onClick={toggleFullscreen}
            className={`p-1.5 rounded-md transition-all hidden md:block ${isFullscreen ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400' : 'hover:bg-stone-100 dark:hover:bg-gray-700 text-stone-600 dark:text-stone-300'}`}
            title="Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          <button 
            onClick={() => setShowShortcuts(true)}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-gray-700 rounded-md text-stone-600 dark:text-stone-300 transition-all hidden md:block"
            title="Keyboard Shortcuts"
          >
             <Keyboard className="w-4 h-4" />
          </button>

          <button 
            onClick={onToggleDarkMode}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-gray-700 rounded-md text-stone-600 dark:text-stone-300 transition-all"
            title={isDarkMode ? "Light Mode" : "Dark Mode"}
          >
             {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div 
        ref={contentRef}
        className="flex-1 overflow-auto bg-stone-100/50 dark:bg-gray-950 relative transition-colors duration-200 overscroll-y-none"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        tabIndex={0}
      >
        <div className="min-h-full flex items-center justify-center p-4 md:p-8">
          {book.fileType === 'pdf' ? (
             <div className="relative shadow-lg transition-transform duration-200 ease-out origin-center bg-white">
               <canvas ref={canvasRef} className="block" />
               {/* Text Layer Overlay */}
               <div ref={textLayerRef} className="textLayer" />
               
               {isRendering && (
                 <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                   <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                 </div>
               )}
            </div>
          ) : (
            /* EPUB / HTML Content */
            <div 
              className={`w-full max-w-3xl bg-white dark:bg-gray-900 shadow-sm border border-stone-200 dark:border-gray-800 min-h-[60vh] p-8 md:p-12 transition-colors duration-200 ${fontFamilyClass[fontFamily]}`}
              style={{ fontSize: `${fontSize}px`, lineHeight: lineHeight }}
            >
               <div 
                 className="prose dark:prose-invert max-w-none prose-img:rounded-lg prose-img:shadow-sm prose-img:mx-auto prose-p:mb-4 prose-headings:font-serif prose-headings:text-ink dark:prose-headings:text-gray-100 text-ink dark:text-gray-200"
                 dangerouslySetInnerHTML={{ __html: (book.renderData as string[])[currentPage] || "<p>No content</p>" }}
               />
            </div>
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="bg-paper dark:bg-gray-900 border-t border-stone-200 dark:border-gray-800 p-4 z-20 transition-colors duration-200">
        <div className="w-full h-1 bg-stone-200 dark:bg-gray-700 rounded-full mb-4 overflow-hidden">
          <div 
            className="h-full bg-stone-400 dark:bg-indigo-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-8">
          <button
            onClick={handlePrev}
            disabled={currentPage === 0}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-6 py-2 rounded-full hover:bg-stone-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-stone-700 dark:text-stone-300 font-medium"
            title="Previous Page (Left Arrow)"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Previous</span>
          </button>
          
          <form onSubmit={handlePageSubmit} className="flex items-center gap-2 bg-stone-100 dark:bg-gray-800 rounded-md px-3 py-1.5 shadow-sm">
             <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Page</span>
             <input 
               type="number" 
               min={1} 
               max={book.totalPages}
               value={pageInput}
               onChange={handlePageInputChange}
               onBlur={handlePageSubmit}
               className="w-12 text-center bg-transparent text-sm font-mono font-medium focus:outline-none text-stone-800 dark:text-stone-200"
             />
             <span className="text-xs text-stone-400 dark:text-stone-500">of {book.totalPages}</span>
          </form>

          <button
            onClick={handleNext}
            disabled={currentPage === book.totalPages - 1}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-6 py-2 rounded-full hover:bg-stone-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-stone-700 dark:text-stone-300 font-medium"
            title="Next Page (Right Arrow)"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Reader;