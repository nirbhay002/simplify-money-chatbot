// File: app/page.js (Final Version with all features)

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
  const [isSpeaking, setIsSpeaking] = useState(false);

  // State and refs for speech recognition
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const transcriptRef = useRef(""); 
  const finalizedTranscriptRef = useRef("");
  const isHeldRef = useRef(false);
  const touchStartXRef = useRef(0);

  // --- Core Chat & Speech Functions ---
  const speak = (text, lang = 'en-IN') => {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang; 
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
  }

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
        setChatHistory([...newHistory, { role: 'model', parts: [{ text: data.reply, lang: data.language_code }] }]);
        speak(data.reply, data.language_code);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // --- Speech Recognition Logic ---
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
      recog.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          interim += event.results[i][0].transcript;
        }
        setLiveTranscript(finalizedTranscriptRef.current + interim);
      };
      recog.onend = () => {
        if (isListeningRef.current) {
          finalizedTranscriptRef.current = transcriptRef.current + " ";
          recognitionRef.current.start();
        }
      };
    } else {
      recog.onresult = (event) => {
        let full = "";
        for (let i = 0; i < event.results.length; i++) {
          full += event.results[i][0].transcript;
        }
        setLiveTranscript(full);
      };
      recog.onend = () => setIsListening(false);
    }
    recognitionRef.current = recog;
  }, []);

  // --- Control Functions (start, stop, cancel) ---
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      stopSpeaking();
      setLiveTranscript(""); 
      finalizedTranscriptRef.current = "";
      recognitionRef.current.lang = 'en-IN';
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListeningAndSend = () => {
    if (recognitionRef.current && isListening) {
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

  const cancelListening = () => {
    if (recognitionRef.current && isListening) {
      setIsListening(false);
      recognitionRef.current.abort();
      setLiveTranscript("");
      finalizedTranscriptRef.current = "";
    }
  }

  // --- Event Handlers for Desktop and Mobile ---
  const handleMicClick = (event) => { // For Desktop: Toggle
    event.preventDefault();
    if (isListening) {
        stopListeningAndSend();
    } else {
        startListening();
    }
  }

  const handleTouchStart = (e) => { // For Mobile: Hold
    e.preventDefault();
    isHeldRef.current = true;
    touchStartXRef.current = e.touches[0].clientX;
    startListening();
  };

  const handleTouchEnd = (e) => { // For Mobile: Release
    e.preventDefault();
    if (isHeldRef.current) {
      stopListeningAndSend();
    }
    isHeldRef.current = false;
  };
  
  const handleTouchMove = (e) => { // For Mobile: Swipe
    if (!isHeldRef.current) return;
    const touchX = e.touches[0].clientX;
    const deltaX = touchStartXRef.current - touchX;
    if (deltaX > 50) {
      cancelListening();
      isHeldRef.current = false;
    }
  };

  // New handler for the speaker icon
  const handleSpeakerClick = (text, lang) => {
    if (isSpeaking) {
        stopSpeaking();
    } else {
        speak(text, lang);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      <header className="bg-blue-600 text-white p-4 text-center shadow-md">
        <h1 className="text-xl sm:text-2xl font-bold">Simplify Money Chatbot</h1>
        <p className="text-sm sm:text-base">Your AI Financial Friend, Kuber.AI</p>
      </header>

      {isListening && isMobileDevice() && (
        <div className="fixed inset-x-0 bottom-24 flex justify-center items-center text-gray-500 animate-pulse">
            &larr; Swipe left to cancel
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-black shadow'}`}>
              <p>{msg.parts[0].text}</p>
              {/* Add speaker button only for model responses */}
              {msg.role === 'model' && (
                <button 
                  onClick={() => handleSpeakerClick(msg.parts[0].text, msg.parts[0].lang)} 
                  className="text-blue-500 mt-2 text-2xl"
                  aria-label="Stop or replay audio"
                >
                  {isSpeaking ? '🔇' : '🔊'}
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && ( <div className="flex justify-start"> <div className="max-w-lg p-3 rounded-lg bg-white text-black shadow"> <p className="animate-pulse">Kuber is thinking...</p> </div> </div> )}
      </main>

      <footer className="p-4 bg-white border-t sticky bottom-0" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className="flex items-center max-w-2xl mx-auto">
          <input type="text" value={isListening ? liveTranscript : userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(userInput)} className="flex-1 p-3 border rounded-l-full focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ask or hold mic to speak..." disabled={isLoading} readOnly={isListening} />
          <button
            onMouseDown={handleMicClick}
            onTouchStart={handleTouchStart}
            className={`p-3 px-4 rounded-none border-y border-l-0 border-gray-200 text-white text-2xl transition-transform ${isListening ? 'bg-red-500 scale-110' : 'bg-blue-600'} disabled:bg-gray-400`}
            disabled={isLoading}
          >
            🎤
          </button>
          <button
            onClick={() => handleSendMessage(userInput)}
            disabled={isLoading || !userInput.trim() || isListening}
            className="bg-blue-600 text-white p-3 px-6 rounded-r-full hover:bg-blue-700 disabled:bg-gray-400"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}