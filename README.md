# StorySoFar Reader

> **An AI-powered reading assistant that reads with you, page by page, without spoiling the ending.**


## Inspiration
Reading a complex novel often leads to forgotten characters or plot points. Asking ChatGPT usually results in massive spoilers because it knows the whole book. **StorySoFar Reader** solves this by feeding the AI *only* the pages you have actually read, effectively simulating a reading buddy who is discovering the story at the exact same pace as you.

## Key Features
- **Zero-Spoiler Guarantee**: The AI assistant's context is strictly limited to your current page. It literally *cannot* spoil future events.
- **Multi-Format Support**: Seemless reading experience for **PDF** and **EPUB** files.
- **Context-Aware Chat**: Ask "Who is this character?" or "What just happened?" and get an answer based *only* on the story so far.
- **Dark Mode**: Built-in dark mode support that respects system preferences.
- **Auto-Save Progress**: Your reading position is automatically saved to local storage so you never lose your place.
- **Modern Tech Stack**: Built with performance and developer experience in mind.

## Tech Stack
- **Frontend Framework**: [React 19](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **AI Intelligence**: [Google Gemini 1.5 Flash](https://deepmind.google/technologies/gemini/) (via Google GenAI SDK)
- **PDF Rendering**: [PDF.js](https://mozilla.github.io/pdf.js/)
- **Icons**: [Lucide React](https://lucide.dev/)

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/KVenkateshaDeepak/StorySoFar-Reader.git
   cd storysofar-reader
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file in the root directory and add your API Key:
   ```env
   GEMINI_API_KEY=your_google_api_key_here
   ```

4. **Run the application**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to start reading!


## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.


