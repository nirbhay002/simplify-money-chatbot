// File: app/page.js (Mobile-Friendly Version)

'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [userInput, setUserInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const recognitionRef = useRef(null);
  const silenceTimeoutRef = useRef(null);

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
  
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognition.onresult = (event) => {
        clearTimeout(silenceTimeoutRef.current);
        let finalTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
            finalTranscript += event.results[i][0].transcript;
        }
        setUserInput(finalTranscript);

        silenceTimeoutRef.current = setTimeout(() => {
          recognition.stop();
          handleSendMessage(finalTranscript);
        }, 2500);
      };
      
      recognitionRef.current = recognition;
    } else {
        console.warn("Speech recognition not supported in this browser.");
    }
  }, [chatHistory]);

  const handleMicClick = () => {
    if (isListening) {
      clearTimeout(silenceTimeoutRef.current);
      recognitionRef.current?.stop();
      handleSendMessage(userInput);
    } else {
      window.speechSynthesis.cancel();
      setUserInput('');
      recognitionRef.current?.start();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      <header className="bg-blue-600 text-white p-4 text-center shadow-md">
        {/* --- RESPONSIVE CHANGE HERE --- */}
        <h1 className="text-2xl sm:text-3xl font-bold">Simplify Money Chatbot</h1>
        <p className="text-sm sm:text-base">Your AI Financial Friend, Kuber.AI</p>
      </header>

      <main className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-4">
        {chatHistory.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs sm:max-w-lg p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-black shadow'}`}>
              <p>{msg.parts[0].text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="max-w-xs sm:max-w-lg p-3 rounded-lg bg-white text-black shadow">
                    <p className="animate-pulse">Kuber is thinking...</p>
                </div>
            </div>
        )}
      </main>

      <footer className="p-4 bg-white border-t">
        <div className="flex items-center max-w-2xl mx-auto">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(userInput)}
            className="flex-1 p-3 border rounded-l-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ask a question..."
            disabled={isLoading || isListening}
          />
           <button 
             onClick={handleMicClick}
             className={`p-3 px-4 rounded-none border-y border-gray-200 text-white text-2xl transition-colors ${isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'} disabled:bg-gray-400`}
             disabled={isLoading}
             aria-label="Use Microphone"
            >
             🎤
           </button>
           <button
            onClick={() => handleSendMessage(userInput)}
            disabled={isLoading || !userInput.trim()}
            className="bg-blue-600 text-white p-3 px-4 sm:px-6 rounded-r-full hover:bg-blue-700 disabled:bg-gray-400"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}