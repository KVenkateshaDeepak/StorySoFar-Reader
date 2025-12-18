import { Book, TocItem } from '../types';

declare global {
  interface Window {
    pdfjsLib: any;
    JSZip: any;
  }
}

const PDFJS_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export const parseFile = async (file: File): Promise<Book> => {
  const fileType = file.type;
  
  if (fileType === 'application/pdf') {
    return parsePdf(file);
  } else if (fileType === 'application/epub+zip' || file.name.endsWith('.epub')) {
    return parseEpub(file);
  } else {
    throw new Error('Unsupported file type. Please upload PDF or EPUB.');
  }
};

const parsePdf = async (file: File): Promise<Book> => {
  if (!window.pdfjsLib) {
    throw new Error('PDF.js library not loaded');
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;

  const arrayBuffer = await file.arrayBuffer();
  // We keep the original buffer for rendering
  const renderData = arrayBuffer.slice(0); 

  const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pages: string[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    
    pages.push(pageText.replace(/\s+/g, ' ').trim());
  }

  // Extract Table of Contents
  const toc: TocItem[] = [];
  const outline = await pdf.getOutline();
  
  if (outline) {
    const processOutline = async (items: any[], level = 0) => {
      for (const item of items) {
        let dest = item.dest;
        let pageIndex = -1;

        if (typeof dest === 'string') {
          dest = await pdf.getDestination(dest);
        }
        
        if (Array.isArray(dest) && dest[0]) {
          const ref = dest[0];
          try {
            // PDF.js uses a map for refs, getPageIndex returns 0-based index
            pageIndex = await pdf.getPageIndex(ref);
          } catch (e) {
            console.warn("Could not find page for outline item", item.title);
          }
        } else if (item.url) {
           // Skip external links
           continue;
        }

        if (pageIndex !== -1) {
          toc.push({
            title: item.title,
            page: pageIndex,
            level: level
          });
        }

        if (item.items && item.items.length > 0) {
          await processOutline(item.items, level + 1);
        }
      }
    };
    await processOutline(outline);
  }

  return {
    title: file.name.replace('.pdf', ''),
    fileType: 'pdf',
    content: pages,
    renderData: renderData,
    totalPages: pages.length,
    fileName: file.name,
    toc: toc,
  };
};

const parseEpub = async (file: File): Promise<Book> => {
  if (!window.JSZip) {
    throw new Error('JSZip library not loaded');
  }

  const zip = new window.JSZip();
  const content = await zip.loadAsync(file);
  
  const files = Object.keys(content.files).filter(fileName => 
    fileName.endsWith('.html') || fileName.endsWith('.xhtml') || fileName.endsWith('.htm')
  );
  
  // Basic sorting to try and respect order (not perfect without OPF parsing but sufficient for simple reader)
  files.sort();

  const textPages: string[] = [];
  const htmlPages: string[] = [];
  const toc: TocItem[] = [];

  // Helper to resolve relative paths for images
  const resolvePath = (base: string, relative: string) => {
    const stack = base.split("/");
    stack.pop(); // remove current filename
    const parts = relative.split("/");
    for (let part of parts) {
      if (part === ".") continue;
      if (part === "..") stack.pop();
      else stack.push(part);
    }
    return stack.join("/");
  };

  const getMimeType = (filename: string) => {
    if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
    if (filename.endsWith('.png')) return 'image/png';
    if (filename.endsWith('.gif')) return 'image/gif';
    if (filename.endsWith('.svg')) return 'image/svg+xml';
    return 'application/octet-stream';
  };

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    const fileData = await content.files[fileName].async('string');
    const parser = new DOMParser();
    const doc = parser.parseFromString(fileData, 'application/xhtml+xml');

    // Process Images
    const images = doc.getElementsByTagName('img');
    for (let j = 0; j < images.length; j++) {
      const img = images[j];
      const src = img.getAttribute('src');
      if (src) {
        // Resolve path within zip
        const absolutePath = resolvePath(fileName, src);
        // Try to find file in zip (handle potential URL encoding)
        const zipFile = content.files[absolutePath] || content.files[decodeURIComponent(absolutePath)];
        
        if (zipFile) {
          const blob = await zipFile.async('base64');
          const mime = getMimeType(absolutePath);
          img.setAttribute('src', `data:${mime};base64,${blob}`);
          img.style.maxWidth = '100%'; // Ensure images fit
          img.style.height = 'auto';
        }
      }
    }

    const text = doc.body.textContent || "";
    // Only add page if it has content (text or images)
    if (text.trim().length > 0 || images.length > 0) {
      const pageIndex = textPages.length;
      textPages.push(text.replace(/\s+/g, ' ').trim());
      // Serialize back to HTML string for the reader
      htmlPages.push(doc.body.innerHTML);

      // Add to TOC
      // Use <title> tag if available, else filename
      let title = doc.querySelector('title')?.textContent?.trim();
      if (!title) {
        title = fileName.split('/').pop()?.replace(/\.[^/.]+$/, "") || `Chapter ${pageIndex + 1}`;
      }
      
      toc.push({
        title: title,
        page: pageIndex,
        level: 0
      });
    }
  }

  return {
    title: file.name.replace('.epub', ''),
    fileType: 'epub',
    content: textPages.length > 0 ? textPages : ["No text content found."],
    renderData: htmlPages.length > 0 ? htmlPages : ["<p>No content found.</p>"],
    totalPages: htmlPages.length > 0 ? htmlPages.length : 1,
    fileName: file.name,
    toc: toc,
  };
};