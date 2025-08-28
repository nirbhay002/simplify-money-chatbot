// File: app/page.js (with improved mobile event handling)

'use client';

import { useState, useEffect, useRef } from 'react';

// Helper function to detect if the app is running on a mobile device
const isMobileDevice = () => {
  if (typeof window !== 'undefined') {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  return false;
};

export default function Home() {
  // State for chat
  const [userInput, setUserInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // State and refs for advanced speech recognition
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const transcriptRef = useRef(""); 
  const finalizedTranscriptRef = useRef(""); // Exclusively for the mobile logic

  // --- Core Chat Functions ---
  const speak = (text, lang = 'en-IN') => {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang; 
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (message) => {
    if (isListening) {
        recognitionRef.current?.stop();
    }
    if (!message.trim()) return;

    setIsLoading(true);
    const newHistory = [...chatHistory, { role: 'user', parts: [{ text: message }] }];
    setChatHistory(newHistory);
    setUserInput('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: chatHistory, message: message }),
      });
      const data = await response.json();
      if (data.reply && data.language_code) {
        setChatHistory([...newHistory, { role: 'model', parts: [{ text: data.reply }] }]);
        speak(data.reply, data.language_code);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // --- Advanced Speech Recognition Logic ---
  useEffect(() => {
    isListeningRef.current = isListening;
    transcriptRef.current = liveTranscript;
  }, [isListening, liveTranscript]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    
    const isMobile = isMobileDevice();

    if (isMobile) {
      console.log("Mobile device detected. Using mobile-specific logic.");
      recog.onresult = (event) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          interimTranscript += event.results[i][0].transcript;
        }
        setLiveTranscript(finalizedTranscriptRef.current + interimTranscript);
      };
      recog.onend = () => {
        if (isListeningRef.current) {
          finalizedTranscriptRef.current = transcriptRef.current + " ";
          console.log("Mobile timeout detected, restarting...");
          recognitionRef.current.start();
        }
      };
    } else {
      console.log("Desktop device detected. Using desktop-specific logic.");
      recog.onresult = (event) => {
        let fullTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript;
        }
        setLiveTranscript(fullTranscript);
      };
      recog.onend = () => setIsListening(false);
    }
    recognitionRef.current = recog;
  }, []);

  const startListening = () => {
    if (recognitionRef.current) {
      setLiveTranscript(""); 
      finalizedTranscriptRef.current = "";
      recognitionRef.current.lang = 'en-IN';
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      setIsListening(false); 
      recognitionRef.current.stop();
      const finalTranscript = transcriptRef.current.trim();
      if (finalTranscript) {
        handleSendMessage(finalTranscript);
      }
      setLiveTranscript("");
      finalizedTranscriptRef.current = "";
    }
  };
  
  const handleMicClick = (event) => {
    // Prevent default behavior to avoid double-firing on mobile
    event.preventDefault();
    if (isListening) {
        stopListening();
    } else {
        startListening();
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      <header className="bg-blue-600 text-white p-4 text-center shadow-md">
        <h1 className="text-xl sm:text-2xl font-bold">Simplify Money Chatbot</h1>
        <p className="text-sm sm:text-base">Your AI Financial Friend, Kuber.AI</p>
      </header>

      {isListening && (
        <div className="w-full max-w-2xl mx-auto p-4 bg-white shadow-md rounded-b-lg border-t">
          <p className="font-medium text-gray-700 text-lg text-center">Listening...</p>
          <div className="mt-2 p-4 border-2 border-dashed rounded-lg min-h-[100px] text-gray-800">
            {liveTranscript || "Speak now..."}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-black shadow'}`}>
              <p>{msg.parts[0].text}</p>
            </div>
          </div>
        ))}
        {isLoading && ( <div className="flex justify-start"> <div className="max-w-lg p-3 rounded-lg bg-white text-black shadow"> <p className="animate-pulse">Kuber is thinking...</p> </div> </div> )}
      </main>

      <footer className="p-4 bg-white border-t sticky bottom-0">
        <div className="flex items-center max-w-2xl mx-auto">
          <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(userInput)} className="flex-1 p-3 border rounded-l-full focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ask about saving, investing..." disabled={isListening || isLoading} />
          {/* --- BUTTON CHANGE IS HERE --- */}
          <button
            onMouseDown={handleMicClick} // For desktop clicks
            onTouchStart={handleMicClick} // For mobile taps
            className={`p-3 px-4 rounded-r-full text-white text-2xl transition-colors ${isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'} disabled:bg-gray-400`}
            disabled={isLoading}
          >
            {isListening ? '⏹️' : '🎤'}
          </button>
        </div>
      </footer>
    </div>
  );
}