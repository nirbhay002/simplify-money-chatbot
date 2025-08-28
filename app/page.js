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

  // State and refs for advanced speech recognition
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const transcriptRef = useRef(""); 
  const finalizedTranscriptRef = useRef("");

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
      // --- THE FIX IS HERE ---
      // Create a "sanitized" version of the history for the API call,
      // removing any extra properties like "lang".
      const sanitizedHistory = newHistory.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.parts[0].text }] // Only include the 'text' property
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            // Send the sanitized history, not the original
            history: sanitizedHistory, 
            message: message 
        }),
      });
      const data = await response.json();
      if (data.reply && data.language_code) {
        // We still store the 'lang' property in our local state for the UI
        setChatHistory([...newHistory, { role: 'model', parts: [{ text: data.reply, lang: data.language_code }] }]);
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
    transcriptRef.current = userInput;
  }, [isListening, userInput]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error("Speech recognition not supported.");
        return;
    };
    
    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-IN';

    const isMobile = isMobileDevice();

    if (isMobile) {
      recog.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          interim += event.results[i][0].transcript;
        }
        setUserInput(finalizedTranscriptRef.current + interim);
      };
      recog.onend = () => {
        if (isListeningRef.current) {
          finalizedTranscriptRef.current = transcriptRef.current + " ";
          console.log("Mobile timeout detected, restarting...");
          recognitionRef.current.start();
        }
      };
    } else {
      recog.onresult = (event) => {
        let full = "";
        for (let i = 0; i < event.results.length; i++) {
          full += event.results[i][0].transcript;
        }
        setUserInput(full);
      };
      recog.onend = () => setIsListening(false);
    }
    recognitionRef.current = recog;
  }, []);

  const startListening = () => {
    if (recognitionRef.current) {
      setUserInput(""); 
      finalizedTranscriptRef.current = "";
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListeningAndSend = () => {
    if (recognitionRef.current) {
      setIsListening(false);
      recognitionRef.current.stop();
      
      const finalTranscript = transcriptRef.current.trim();
      if (finalTranscript) {
        handleSendMessage(finalTranscript);
      } else {
        setUserInput("");
      }
      finalizedTranscriptRef.current = "";
    }
  };
  
  const handleMicClick = () => {
    if (isListening) {
        stopListeningAndSend();
    } else {
        startListening();
    }
  };

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

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-black shadow'}`}>
              <p>{msg.parts[0].text}</p>
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

      <footer className="p-4 bg-white border-t sticky bottom-0">
        <div className="flex items-center max-w-2xl mx-auto">
          <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(userInput)} className="flex-1 p-3 border rounded-l-full focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ask or click the mic to speak..." disabled={isLoading || isListening}/>
          <button
            onClick={handleMicClick}
            className={`p-3 px-4 rounded-none border-y border-l-0 border-gray-200 text-white text-2xl transition-transform ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-600'} disabled:bg-gray-400`}
            disabled={isLoading}
          >
            {isListening ? '⏹️' : '🎤'}
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